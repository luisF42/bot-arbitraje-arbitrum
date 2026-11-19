// Configuración de Hardhat. Se llama .cjs porque el proyecto usa "type": "module".
// La URL de Alchemy y la clave privada se leen del .env (ya no van escritas en el código).
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const cuentas = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

module.exports = {
  solidity: "0.8.24",
  networks: {
    // Copia local de Arbitrum para pruebas sin dinero real: npx hardhat node
    hardhat: {
      chainId: 42161,
      forking: process.env.FORK_URL ? { url: process.env.FORK_URL } : undefined,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 42161,
    },
    arbitrum: {
      url: process.env.RPC_URL || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: cuentas,
    },
  },
};
