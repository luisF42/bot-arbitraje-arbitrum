// Despliega el contrato ArbExecutor.
//   Local (pruebas):  npx hardhat run scripts/desplegar.js --network localhost
//   Real (Arbitrum):  npx hardhat run scripts/desplegar.js --network arbitrum
import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const [cuenta] = await ethers.getSigners();
  console.log(`Red: ${hre.network.name} | Cuenta: ${cuenta.address}`);
  console.log(`Saldo ETH: ${ethers.formatEther(await ethers.provider.getBalance(cuenta.address))}`);

  const Fabrica = await ethers.getContractFactory("ArbExecutor");
  const contrato = await Fabrica.deploy();
  await contrato.waitForDeployment();
  const direccion = await contrato.getAddress();

  console.log(`\n✅ ArbExecutor desplegado en: ${direccion}`);
  console.log(`Ponlo en tu .env como:  EXECUTOR_ADDRESS=${direccion}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
