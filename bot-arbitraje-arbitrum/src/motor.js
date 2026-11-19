// Motor de consultas: pregunta cientos de precios en muy pocas peticiones usando Multicall3.
// Multicall3 es un contrato que recibe muchas preguntas y las responde todas de una vez.
import { ethers } from "ethers";
import { CONTRATOS } from "./tokens.js";

const ifaceQuoter = new ethers.Interface([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const ifaceV2 = new ethers.Interface([
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
]);
const ifaceMulti = new ethers.Interface([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);
const ifaceErc20 = new ethers.Interface([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

// Cuántas preguntas se mandan por petición. No todos los servidores aguantan lo mismo:
// los RPC públicos suelen rechazar lotes grandes, así que el motor se adapta solo.
const LOTE_INICIAL = 70;
const LOTE_MINIMO = 8;

function llamadaCotizacion(venue, tokenIn, tokenOut, amountIn) {
  if (venue.kind === 0) {
    return {
      target: CONTRATOS.QUOTER_V2,
      allowFailure: true,
      callData: ifaceQuoter.encodeFunctionData("quoteExactInputSingle", [
        { tokenIn, tokenOut, amountIn, fee: venue.fee, sqrtPriceLimitX96: 0 },
      ]),
    };
  }
  return {
    target: venue.router,
    allowFailure: true,
    callData: ifaceV2.encodeFunctionData("getAmountsOut", [amountIn, [tokenIn, tokenOut]]),
  };
}

function leerCotizacion(venue, res) {
  if (!res.success || res.returnData === "0x") return null;
  try {
    if (venue.kind === 0) {
      return ifaceQuoter.decodeFunctionResult("quoteExactInputSingle", res.returnData)[0];
    }
    const amounts = ifaceV2.decodeFunctionResult("getAmountsOut", res.returnData)[0];
    return amounts[amounts.length - 1];
  } catch {
    return null;
  }
}

export function crearMotor(provider) {
  const multicall = new ethers.Contract(CONTRATOS.MULTICALL3, ifaceMulti, provider);

  // Tamaño de lote que este servidor sí acepta. Empieza alto y baja si hace falta.
  let tamanoLote = LOTE_INICIAL;

  // Envía un lote. Si el servidor lo rechaza por ser demasiado grande, lo parte
  // en dos y reintenta, y recuerda el tamaño menor para las siguientes veces.
  async function enviarLote(lote) {
    try {
      return await multicall.aggregate3.staticCall(lote);
    } catch (e) {
      if (lote.length <= 1) {
        // Ni siquiera una sola llamada funcionó: se devuelve como fallo controlado
        // para que el resto del ciclo siga adelante.
        return lote.map(() => ({ success: false, returnData: "0x" }));
      }
      const mitad = Math.ceil(lote.length / 2);
      if (mitad < tamanoLote) tamanoLote = Math.max(LOTE_MINIMO, mitad);
      const [a, b] = await Promise.all([
        enviarLote(lote.slice(0, mitad)),
        enviarLote(lote.slice(mitad)),
      ]);
      return [...a, ...b];
    }
  }

  // Manda las llamadas en lotes y devuelve todas las respuestas en orden
  async function ejecutarLotes(llamadas) {
    const lotes = [];
    for (let i = 0; i < llamadas.length; i += tamanoLote) {
      lotes.push(llamadas.slice(i, i + tamanoLote));
    }
    const resultados = await Promise.all(lotes.map((lote) => enviarLote(lote)));
    return resultados.flat();
  }

  // peticiones: [{ venue, tokenIn, tokenOut, amountIn }] -> [bigint | null]
  async function cotizarMuchas(peticiones) {
    if (!peticiones.length) return [];
    const llamadas = peticiones.map((p) => llamadaCotizacion(p.venue, p.tokenIn, p.tokenOut, p.amountIn));
    const res = await ejecutarLotes(llamadas);
    return res.map((r, i) => leerCotizacion(peticiones[i].venue, r));
  }

  // Comprueba que una lista de direcciones sean tokens de verdad y lee su símbolo y decimales
  async function leerTokens(direcciones) {
    const llamadas = [];
    for (const a of direcciones) {
      llamadas.push({ target: a, allowFailure: true, callData: ifaceErc20.encodeFunctionData("symbol") });
      llamadas.push({ target: a, allowFailure: true, callData: ifaceErc20.encodeFunctionData("decimals") });
    }
    const res = await ejecutarLotes(llamadas);
    return direcciones.map((a, i) => {
      const rs = res[i * 2], rd = res[i * 2 + 1];
      try {
        if (!rs.success || !rd.success) return null;
        return {
          address: a,
          symbol: ifaceErc20.decodeFunctionResult("symbol", rs.returnData)[0],
          decimals: Number(ifaceErc20.decodeFunctionResult("decimals", rd.returnData)[0]),
        };
      } catch {
        return null;
      }
    });
  }

  return { cotizarMuchas, leerTokens };
}
