// Prepara la copia LOCAL de Arbitrum para probar el bot en modo real sin arriesgar dinero:
// despliega el contrato, cambia 0.02 ETH de prueba por USDC y los deposita en el contrato.
//   1) En una terminal:  npx hardhat node
//   2) En otra:          npx hardhat run scripts/preparar-local.js --network localhost
import hre from "hardhat";
const { ethers } = hre;

const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"; // Uniswap V3 SwapRouter02

async function main() {
  if (hre.network.name !== "localhost") throw new Error("Este script es solo para --network localhost");
  const [cuenta] = await ethers.getSigners();
  console.log("Cuenta de prueba:", cuenta.address);

  const Fabrica = await ethers.getContractFactory("ArbExecutor");
  const executor = await Fabrica.deploy();
  await executor.waitForDeployment();
  const executorAddr = await executor.getAddress();
  console.log("ArbExecutor:", executorAddr);

  const weth = new ethers.Contract(WETH, [
    "function deposit() payable",
    "function approve(address,uint256) returns (bool)",
  ], cuenta);
  const router = new ethers.Contract(ROUTER, [
    "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256)",
  ], cuenta);
  const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], cuenta);

  const monto = ethers.parseEther("0.02");
  await (await weth.deposit({ value: monto })).wait();
  await (await weth.approve(ROUTER, monto)).wait();
  await (await router.exactInputSingle({
    tokenIn: WETH, tokenOut: USDC, fee: 500, recipient: executorAddr,
    amountIn: monto, amountOutMinimum: 0, sqrtPriceLimitX96: 0,
  })).wait();

  console.log(`USDC en el contrato: ${ethers.formatUnits(await usdc.balanceOf(executorAddr), 6)}`);
  console.log("\nPara probar el bot contra esta red local, en tu .env pon:");
  console.log("  RPC_URL=http://127.0.0.1:8545");
  console.log("  PRIVATE_KEY=<la clave de la Account #0 que muestra 'npx hardhat node'>");
  console.log(`  EXECUTOR_ADDRESS=${executorAddr}`);
  console.log("  MODO=real");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
