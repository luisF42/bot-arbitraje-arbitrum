// Ajustes del bot. Se pueden cambiar en el archivo .env de la carpeta bot-cripto.
import "dotenv/config";

const num = (nombre, pd) => {
  const v = process.env[nombre];
  if (v === undefined || v === "") return pd;
  const n = Number(v);
  return Number.isNaN(n) ? pd : n;
};

export const config = {
  rpcUrl: process.env.RPC_URL || "https://arb1.arbitrum.io/rpc",
  // Dinero (virtual) con el que trabaja cada operación
  montoUsdc: num("MONTO_USDC", 100),
  // Capital virtual inicial de la simulación
  capitalInicial: num("CAPITAL_INICIAL", 1000),
  // Ganancia mínima, en dólares, para que valga la pena operar
  gananciaMinimaUsdc: num("GANANCIA_MINIMA_USDC", 0.05),
  // Unidades de gas que costarían las dos operaciones
  gasEstimado: BigInt(num("GAS_ESTIMADO", 450000)),
  // Segundos entre cada revisión del mercado
  intervaloSeg: num("INTERVALO_SEG", 20),
  // Puerto del panel web
  puerto: num("PUERTO", 8080),
};
