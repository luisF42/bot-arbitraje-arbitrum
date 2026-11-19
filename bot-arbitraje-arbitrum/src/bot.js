// Programa principal: arranca el escáner y el panel web en la misma ventana.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { config } from "./config.js";
import { cargarEstado, crearEscaner } from "./escaner.js";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const estado = cargarEstado();
const escaner = crearEscaner(estado);

let detenido = false;
let errores = 0;

// ---------- Panel web ----------
function servidor() {
  const srv = http.createServer((req, res) => {
    if (req.url.startsWith("/api/estado")) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({
        ...estado,
        config: {
          monto: config.montoUsdc,
          gananciaMinima: config.gananciaMinimaUsdc,
          intervalo: config.intervaloSeg,
        },
        corriendo: !detenido,
      }));
      return;
    }
    try {
      const html = fs.readFileSync(path.join(AQUI, "panel.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(500); res.end("No se encontró panel.html");
    }
  });

  srv.on("error", (e) => {
    if (e.code !== "EADDRINUSE") console.error("Error del panel:", e.message);
  });

  // Busca un puerto libre empezando por el configurado.
  // Si el que está ocupado resulta ser OTRA copia de este mismo bot, avisa y se cierra,
  // para no tener dos bots peleando por el mismo archivo de progreso.
  intentarPuerto(srv, config.puerto, 0);
}

function abrirNavegador(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

// ¿Lo que está en ese puerto es otra copia de este bot?
function esNuestroBot(puerto) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: puerto, path: "/api/estado", timeout: 1500 }, (res) => {
      let cuerpo = "";
      res.on("data", (c) => { cuerpo += c; if (cuerpo.length > 200000) req.destroy(); });
      res.on("end", () => {
        try { resolve(JSON.parse(cuerpo).capitalInicial !== undefined); }
        catch { resolve(false); }
      });
    });
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.on("error", () => resolve(false));
  });
}

function intentarPuerto(srv, puerto, intento) {
  srv.once("error", async (e) => {
    if (e.code !== "EADDRINUSE") return;

    if (await esNuestroBot(puerto)) {
      console.log(`\n⚠️  El bot ya estaba abierto en otra ventana.`);
      console.log(`   Te abro ese panel: http://localhost:${puerto}`);
      console.log(`   (no hace falta tener dos abiertos; esta ventana se cierra sola)\n`);
      abrirNavegador(`http://localhost:${puerto}`);
      process.exit(0);
    }

    if (intento >= 10) {
      console.error(`\n❌ No encontré ningún puerto libre entre ${config.puerto} y ${puerto}.`);
      console.error(`   Cambia PUERTO en el archivo "Iniciar bot cripto.bat" a otro número, por ejemplo 9500.\n`);
      process.exit(1);
    }

    console.log(`   El puerto ${puerto} está ocupado por otro programa, pruebo con el ${puerto + 1}...`);
    // Quitamos el aviso del intento fallido para que no se anuncie un puerto equivocado
    srv.removeAllListeners("listening");
    intentarPuerto(srv, puerto + 1, intento + 1);
  });

  srv.listen(puerto, "127.0.0.1", () => {
    const url = `http://localhost:${puerto}`;
    console.log(`\n🖥  Panel abierto en: ${url}`);
    console.log(`   (si no se abre solo, copia esa dirección en tu navegador)\n`);
    abrirNavegador(url);
  });
}

// ---------- Bucle de análisis ----------
async function bucle() {
  while (!detenido) {
    const t0 = Date.now();
    try {
      const filas = await escaner.unCiclo();
      errores = 0;
      const m = filas[0];
      const hora = new Date().toLocaleTimeString();
      if (m) {
        const señal = m.neta >= config.gananciaMinimaUsdc ? "🎯 GANANCIA" : "  sin ganancia";
        console.log(
          `[${hora}] #${estado.ciclos} ${señal} | mejor: ${m.token} ${m.compra} → ${m.venta} | ` +
          `neta ${m.neta >= 0 ? "+" : ""}${m.neta.toFixed(4)} USD | ${estado.consultas} precios en ${estado.segundosCiclo}s`
        );
      } else {
        console.log(`[${hora}] #${estado.ciclos} sin respuestas del mercado`);
      }
    } catch (e) {
      errores++;
      estado.ultimoError = e.shortMessage || e.message;
      console.error(`⚠️  Error (${errores} seguidos): ${estado.ultimoError}`);
      if (errores >= 10) {
        console.error("❌ Demasiados errores seguidos. Revisa tu conexión a internet. Deteniendo.");
        break;
      }
    }
    // Si hay errores, espera más tiempo para no saturar el servidor
    const espera = config.intervaloSeg * 1000 * Math.min(2 ** errores, 10) - (Date.now() - t0);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  }
  resumen();
  process.exit(0);
}

function resumen() {
  const g = estado.capital - estado.capitalInicial;
  const horas = ((Date.now() - estado.inicio) / 3600000).toFixed(1);
  console.log("\n================ RESUMEN ================");
  console.log(`Tiempo analizando:   ${horas} horas`);
  console.log(`Revisiones hechas:   ${estado.ciclos}`);
  console.log(`Oportunidades:       ${estado.oportunidades}`);
  console.log(`Capital virtual:     $${estado.capital.toFixed(2)} (empezó en $${estado.capitalInicial.toFixed(2)})`);
  console.log(`Resultado:           ${g >= 0 ? "+" : ""}$${g.toFixed(2)}`);
  console.log("=========================================");
  console.log("Recuerda: esto es una simulación. No se usó ni se ganó dinero real.");
}

async function main() {
  console.log("==========================================================");
  console.log("🤖 ESCÁNER DE OPORTUNIDADES — Arbitrum (SIMULACIÓN)");
  const info = await escaner.comprobarRed();
  console.log(`Vigilando ${info.tokens} monedas en ${info.venues} mercados`);
  console.log(`Monto por operación: $${config.montoUsdc} | Ganancia mínima: $${config.gananciaMinimaUsdc}`);
  console.log(`Capital virtual: $${estado.capital.toFixed(2)}`);
  console.log("NO se usa dinero real. Cierra esta ventana para detenerlo.");
  console.log("==========================================================");
  servidor();
  bucle();
}

process.on("SIGINT", () => {
  if (detenido) process.exit(0);
  detenido = true;
  console.log("\n⏹  Deteniendo...");
});

main().catch((e) => {
  console.error("\n❌ No se pudo arrancar:", e.shortMessage || e.message);
  if (String(e.message).includes("tokens-activos")) {
    console.error("   Falta la lista de monedas. Ejecuta primero: npm run verificar");
  }
  process.exit(1);
});
