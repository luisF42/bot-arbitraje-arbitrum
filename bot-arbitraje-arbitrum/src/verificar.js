// Comprueba qué monedas y qué mercados funcionan de verdad, y guarda la lista buena.
// Se ejecuta una vez al instalar (y cuando quieras refrescarla).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { BASE, CANDIDATAS, VENUES } from "./tokens.js";
import { crearMotor } from "./motor.js";
import { config } from "./config.js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const { cotizarMuchas, leerTokens } = crearMotor(provider);

  const red = await provider.getNetwork();
  console.log(`Red: ${red.chainId} (se espera 42161 = Arbitrum One)`);
  if (red.chainId !== 42161n) throw new Error("El RPC no apunta a Arbitrum One");

  console.log(`\nComprobando ${CANDIDATAS.length} monedas...`);
  const info = await leerTokens(CANDIDATAS.map((t) => t.address));

  const vivos = [];
  for (let i = 0; i < CANDIDATAS.length; i++) {
    const c = CANDIDATAS[i], real = info[i];
    if (!real) { console.log(`  ✗ ${c.symbol.padEnd(7)} no responde`); continue; }
    if (real.decimals !== c.decimals) {
      console.log(`  ! ${c.symbol.padEnd(7)} decimales corregidos: ${c.decimals} -> ${real.decimals}`);
    }
    // Usamos siempre el nombre de nuestra lista: es más legible y evita confusiones
    // (por ejemplo USDC.e, que on-chain se llama igual que USDC)
    vivos.push({ symbol: c.symbol, address: c.address, decimals: real.decimals });
  }

  // Probar con el monto configurado: ¿hay mercado donde comprar esta moneda?
  const monto = ethers.parseUnits(String(config.montoUsdc), BASE.decimals);
  const peticiones = [];
  for (const t of vivos) for (const v of VENUES) {
    peticiones.push({ venue: v, tokenIn: BASE.address, tokenOut: t.address, amountIn: monto });
  }

  console.log(`\nProbando ${peticiones.length} combinaciones de moneda y mercado...`);
  const inicio = Date.now();
  const res = await cotizarMuchas(peticiones);
  console.log(`Respondieron todas en ${Date.now() - inicio} ms\n`);

  // Nos quedamos con el mejor mercado de compra de cada moneda
  const venuesOk = new Set();
  const candidatas2 = [];
  for (let i = 0; i < vivos.length; i++) {
    const mercados = [];
    let mejor = null;
    for (let j = 0; j < VENUES.length; j++) {
      const q = res[i * VENUES.length + j];
      if (q !== null && q > 0n) {
        mercados.push(VENUES[j].nombre);
        venuesOk.add(VENUES[j].nombre);
        if (mejor === null || q > mejor.cantidad) mejor = { cantidad: q, venue: VENUES[j] };
      }
    }
    const t = vivos[i];
    // Para que haya arbitraje hacen falta al menos 2 mercados distintos
    if (mercados.length >= 2) {
      candidatas2.push({ token: t, mercados, mejor });
    } else {
      console.log(`  ✗ ${t.symbol.padEnd(7)} solo ${mercados.length} mercado, no sirve para comparar`);
    }
  }

  // Segunda prueba: el viaje de ida y vuelta. Si al revender la moneda no recuperamos
  // casi todo el dinero, ese mercado no tiene liquidez real y solo generaría ruido.
  const peticionesVuelta = [];
  const mapaVuelta = [];
  for (const c of candidatas2) {
    for (const v of VENUES) {
      if (v.nombre === c.mejor.venue.nombre) continue;
      peticionesVuelta.push({ venue: v, tokenIn: c.token.address, tokenOut: BASE.address, amountIn: c.mejor.cantidad });
      mapaVuelta.push(c);
    }
  }

  console.log(`Comprobando liquidez real con ${peticionesVuelta.length} operaciones de ida y vuelta...\n`);
  const resVuelta = await cotizarMuchas(peticionesVuelta);

  const recuperado = new Map();
  for (let i = 0; i < mapaVuelta.length; i++) {
    const q = resVuelta[i];
    if (q === null || q <= 0n) continue;
    const c = mapaVuelta[i];
    const prev = recuperado.get(c.token.symbol);
    if (prev === undefined || q > prev) recuperado.set(c.token.symbol, q);
  }

  const RECUPERACION_MINIMA = 0.9; // debe volver al menos el 90% del dinero
  const finales = [];
  for (const c of candidatas2) {
    const vuelta = recuperado.get(c.token.symbol);
    const ratio = vuelta === undefined ? 0 : Number(vuelta) / Number(monto);
    if (ratio >= RECUPERACION_MINIMA) {
      finales.push(c.token);
      console.log(`  ✓ ${c.token.symbol.padEnd(7)} ${c.mercados.length} mercados · recupera ${(ratio * 100).toFixed(1)}%`);
    } else {
      console.log(`  ✗ ${c.token.symbol.padEnd(7)} sin liquidez suficiente · solo recupera ${(ratio * 100).toFixed(1)}%`);
    }
  }

  const salida = {
    actualizado: new Date().toISOString(),
    montoProbado: config.montoUsdc,
    tokens: finales,
    venues: VENUES.filter((v) => venuesOk.has(v.nombre)),
  };
  fs.writeFileSync(path.join(AQUI, "tokens-activos.json"), JSON.stringify(salida, null, 2));

  console.log(`\n=========================================`);
  console.log(`Monedas utilizables: ${finales.length} de ${CANDIDATAS.length}`);
  console.log(`Mercados utilizables: ${salida.venues.length} de ${VENUES.length}`);
  console.log(`Guardado en tokens-activos.json`);
  console.log(`=========================================`);
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
