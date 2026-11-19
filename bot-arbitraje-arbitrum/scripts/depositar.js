// Mueve USDC de tu wallet al contrato (o los retira de vuelta).
//   Depositar:  npx hardhat run scripts/depositar.js --network arbitrum
//   Retirar:    set ACCION=retirar  (Windows CMD)  y luego el mismo comando
// Cantidad: variable CANTIDAD_USDC del .env (por defecto 20)
import "dotenv/config";
import hre from "hardhat";
const { ethers } = hre;

const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const executorAddr = process.env.EXECUTOR_ADDRESS;
  if (!executorAddr) throw new Error("Falta EXECUTOR_ADDRESS en el .env");
  const cantidad = ethers.parseUnits(process.env.CANTIDAD_USDC || "20", 6);
  const accion = (process.env.ACCION || "depositar").toLowerCase();

  const [cuenta] = await ethers.getSigners();
  const usdc = new ethers.Contract(USDC, [
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
  ], cuenta);
  const executor = new ethers.Contract(executorAddr, [
    "function withdraw(address token, uint256 amount)",
  ], cuenta);

  if (accion === "retirar") {
    await (await executor.withdraw(USDC, cantidad)).wait();
    console.log(`✅ Retirados ${ethers.formatUnits(cantidad, 6)} USDC a tu wallet`);
  } else {
    await (await usdc.transfer(executorAddr, cantidad)).wait();
    console.log(`✅ Depositados ${ethers.formatUnits(cantidad, 6)} USDC en el contrato`);
  }
  console.log(`USDC en wallet:   ${ethers.formatUnits(await usdc.balanceOf(cuenta.address), 6)}`);
  console.log(`USDC en contrato: ${ethers.formatUnits(await usdc.balanceOf(executorAddr), 6)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
