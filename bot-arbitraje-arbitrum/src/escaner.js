// Cerebro del bot: en cada ciclo revisa todas las monedas en todos los mercados
// y busca una ruta "comprar barato aquí, vender caro allá" que deje ganancia.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { BASE } from "./tokens.js";
import { crearMotor } from "./motor.js";
import { config } from "./config.js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVO_ESTADO = path.join(AQUI, "estado.json");
const ARCHIVO_TOKENS = path.join(AQUI, "tokens-activos.json");
const MAX_HISTORIAL = 2000;

function estadoInicial() {
  return {
    inicio: Date.now(),
    capital: config.capitalInicial,
    capitalInicial: config.capitalInicial,
    ciclos: 0,
    oportunidades: 0,
    operaciones: [],      // las que "ejecutó" en la simulación
    historial: [],        // evolución del capital para la gráfica
    ultimaRevision: [],   // top de la última revisión
    mejorDeSiempre: null,
    ultimoError: null,
    actualizado: null,
    segundosCiclo: null,
  };
}

export function cargarEstado() {
  try {
    const d = JSON.parse(fs.readFileSync(ARCHIVO_ESTADO, "utf8"));
    // Si cambiaste el capital inicial, se reinicia la simulación para que los números cuadren
    if (d.capitalInicial !== config.capitalInicial) return estadoInicial();
    return { ...estadoInicial(), ...d };
  } catch {
    return estadoInicial();
  }
}

function guardarEstado(estado) {
  try {
    fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify(estado));
  } catch { /* si falla guardar, el bot sigue funcionando igual */ }
}

export function crearEscaner(estado) {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const motor = crearMotor(provider);

  const datos = JSON.parse(fs.readFileSync(ARCHIVO_TOKENS, "utf8"));
  const TOKENS = datos.tokens;
  const VENUES = datos.venues;

  const montoRaw = ethers.parseUnits(String(config.montoUsdc), BASE.decimals);
  const aUsd = (raw) => Number(ethers.formatUnits(raw, BASE.decimals));

  async function costoGasUsd(precioEth) {
    const fee = await provider.getFeeData();
    const gasPrice = fee.gasPrice ?? fee.maxFeePerGas ?? 0n;
    return Number(ethers.formatEther(gasPrice * config.gasEstimado)) * precioEth;
  }

  async function unCiclo() {
    const t0 = Date.now();

    // PASO 1: con nuestros dólares, ¿cuántas monedas nos da cada mercado?
    const pet1 = [];
    for (const t of TOKENS) for (const v of VENUES) {
      pet1.push({ venue: v, tokenIn: BASE.address, tokenOut: t.address, amountIn: montoRaw });
    }
    const res1 = await motor.cotizarMuchas(pet1);

    // Nos quedamos con el mercado que más monedas nos da (comprar barato)
    const compras = [];
    for (let i = 0; i < TOKENS.length; i++) {
      let mejor = null;
      for (let j = 0; j < VENUES.length; j++) {
        const q = res1[i * VENUES.length + j];
        if (q !== null && q > 0n && (mejor === null || q > mejor.cantidad)) {
          mejor = { cantidad: q, venue: VENUES[j] };
        }
      }
      if (mejor) compras.push({ token: TOKENS[i], ...mejor });
    }

    // Precio del ETH, para saber cuánto cuesta el gas en dólares
    const iWeth = TOKENS.findIndex((t) => t.symbol === "WETH");
    let precioEth = 0;
    if (iWeth >= 0) {
      const c = compras.find((c) => c.token.symbol === "WETH");
      if (c) precioEth = config.montoUsdc / Number(ethers.formatUnits(c.cantidad, 18));
    }
    const gasUsd = precioEth > 0 ? await costoGasUsd(precioEth) : 0;

    // PASO 2: esas monedas, ¿cuántos dólares nos devuelve cada OTRO mercado? (vender caro)
    const pet2 = [];
    const mapa = [];
    for (const c of compras) {
      for (const v of VENUES) {
        if (v.nombre === c.venue.nombre) continue;
        pet2.push({ venue: v, tokenIn: c.token.address, tokenOut: BASE.address, amountIn: c.cantidad });
        mapa.push({ compra: c, ventaVenue: v });
      }
    }
    const res2 = await motor.cotizarMuchas(pet2);

    // Nos quedamos con la mejor venta de cada moneda
    const porToken = new Map();
    for (let i = 0; i < mapa.length; i++) {
      const salida = res2[i];
      if (salida === null || salida <= 0n) continue;
      const { compra, ventaVenue } = mapa[i];
      const prev = porToken.get(compra.token.symbol);
      if (!prev || salida > prev.salida) {
        porToken.set(compra.token.symbol, { compra, ventaVenue, salida });
      }
    }

    // Calcular la ganancia real de cada moneda
    const filas = [];
    for (const [symbol, r] of porToken) {
      const bruta = aUsd(r.salida) - config.montoUsdc;
      const neta = bruta - gasUsd;
      filas.push({
        token: symbol,
        compra: r.compra.venue.nombre,
        venta: r.ventaVenue.nombre,
        bruta: Number(bruta.toFixed(4)),
        gas: Number(gasUsd.toFixed(4)),
        neta: Number(neta.toFixed(4)),
      });
    }
    filas.sort((a, b) => b.neta - a.neta);

    // Actualizar el estado que ve el panel
    estado.ciclos++;
    estado.actualizado = Date.now();
    estado.segundosCiclo = Number(((Date.now() - t0) / 1000).toFixed(1));
    estado.ultimaRevision = filas.slice(0, 12);
    estado.ultimoError = null;
    estado.monedasRevisadas = TOKENS.length;
    estado.mercadosRevisados = VENUES.length;
    estado.consultas = pet1.length + pet2.length;

    const mejor = filas[0];
    if (mejor && (!estado.mejorDeSiempre || mejor.neta > estado.mejorDeSiempre.neta)) {
      estado.mejorDeSiempre = { ...mejor, fecha: Date.now() };
    }

    // Si hay ganancia suficiente, la simulación "opera"
    if (mejor && mejor.neta >= config.gananciaMinimaUsdc) {
      estado.oportunidades++;
      estado.capital = Number((estado.capital + mejor.neta).toFixed(4));
      estado.operaciones.unshift({ ...mejor, fecha: Date.now() });
      if (estado.operaciones.length > 200) estado.operaciones.length = 200;
    }

    estado.historial.push({ t: Date.now(), c: estado.capital });
    if (estado.historial.length > MAX_HISTORIAL) estado.historial.shift();

    guardarEstado(estado);
    return filas;
  }

  async function comprobarRed() {
    const red = await provider.getNetwork();
    if (red.chainId !== 42161n) throw new Error(`El RPC apunta a la red ${red.chainId}, se esperaba Arbitrum One (42161)`);
    return { tokens: TOKENS.length, venues: VENUES.length };
  }

  return { unCiclo, comprobarRed, guardarEstado };
}
