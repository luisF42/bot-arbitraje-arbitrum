// Lista de monedas que el bot vigila, todas en la red Arbitrum One.
// La moneda base es USDC (dólar digital): el bot siempre empieza y termina en USDC.
import { ethers } from "ethers";

const d = (a) => ethers.getAddress(a.toLowerCase());

export const BASE = { symbol: "USDC", address: d("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"), decimals: 6 };

// Candidatas. El verificador comprueba cuáles funcionan de verdad y escribe tokens-activos.json
export const CANDIDATAS = [
  { symbol: "WETH",   address: d("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"), decimals: 18 },
  { symbol: "WBTC",   address: d("0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"), decimals: 8 },
  { symbol: "ARB",    address: d("0x912CE59144191C1204E64559FE8253a0e49E6548"), decimals: 18 },
  { symbol: "USDT",   address: d("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"), decimals: 6 },
  { symbol: "USDC.e", address: d("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"), decimals: 6 },
  { symbol: "DAI",    address: d("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"), decimals: 18 },
  { symbol: "LINK",   address: d("0xf97f4df75117a78c1A5a0DBb814Af92458539FB4"), decimals: 18 },
  { symbol: "UNI",    address: d("0xFa7F8980b0f1E64A2062791cC3b0871572f1F7f0"), decimals: 18 },
  { symbol: "GMX",    address: d("0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a"), decimals: 18 },
  { symbol: "MAGIC",  address: d("0x539bdE0d7Dbd336b79148AA742883198BBF60342"), decimals: 18 },
  { symbol: "PENDLE", address: d("0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8"), decimals: 18 },
  { symbol: "CRV",    address: d("0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978"), decimals: 18 },
  { symbol: "LDO",    address: d("0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60"), decimals: 18 },
  { symbol: "STG",    address: d("0x6694340fc020c5E6B96567843da2df01b2CE1eb6"), decimals: 18 },
  { symbol: "GRT",    address: d("0x9623063377AD1B27544C965cCd7342f7EA7e88C7"), decimals: 18 },
  { symbol: "FRAX",   address: d("0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F"), decimals: 18 },
  { symbol: "RDNT",   address: d("0x3082CC23568eA640225c2467653dB90e9250AaA0"), decimals: 18 },
  { symbol: "SUSHI",  address: d("0xd4d42F0b6DEF4CE0383636770eF773390d85c61A"), decimals: 18 },
  { symbol: "COMP",   address: d("0x354A6dA3fcde098F8389cad84b0182725c6C91dE"), decimals: 18 },
  { symbol: "AAVE",   address: d("0xba5DdD1f9d7F570dc94a51479a000E3BCE967196"), decimals: 18 },
  { symbol: "WSTETH", address: d("0x5979D7b546E38E414F7E9822514be443A4800529"), decimals: 18 },
  { symbol: "SPELL",  address: d("0x3E6648C5a70A150A88bCE65F4aD4d506Fe15d2AF"), decimals: 18 },
  { symbol: "DPX",    address: d("0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55"), decimals: 18 },
  { symbol: "JONES",  address: d("0x10393c20975cF177a3513071bC110f7962CD67da"), decimals: 18 },
];

// Lugares donde se puede comprar o vender. kind 0 = Uniswap V3, kind 1 = router estilo Uniswap V2
export const CONTRATOS = {
  QUOTER_V2:   d("0x61fFE014bA17989E743c5F6cB21bF9697530B21e"), // Uniswap V3: consulta precios
  MULTICALL3:  d("0xcA11bde05977b3631167028862bE2a173976CA11"), // permite preguntar cientos de precios de un solo golpe
  UNI_ROUTER:  d("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"),
  SUSHI_V2:    d("0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"),
  CAMELOT_V2:  d("0xc873fEcbd354f5A56E00E710B90EF4201db2448d"),
};

export const VENUES = [
  { nombre: "Uniswap 0.01%", kind: 0, router: CONTRATOS.UNI_ROUTER, fee: 100 },
  { nombre: "Uniswap 0.05%", kind: 0, router: CONTRATOS.UNI_ROUTER, fee: 500 },
  { nombre: "Uniswap 0.30%", kind: 0, router: CONTRATOS.UNI_ROUTER, fee: 3000 },
  { nombre: "Uniswap 1.00%", kind: 0, router: CONTRATOS.UNI_ROUTER, fee: 10000 },
  { nombre: "SushiSwap",     kind: 1, router: CONTRATOS.SUSHI_V2,   fee: 0 },
  { nombre: "Camelot",       kind: 1, router: CONTRATOS.CAMELOT_V2, fee: 0 },
];
