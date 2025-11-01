const DEFAULT_CONTRACT_ID =
  "ST2S0QHZC65P50HFAA2P7GD9CJBT48KDJ9DNYGDSK.marketplace";

const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ID;

const [CONTRACT_PRINCIPAL, CONTRACT_ID_NAME] = CONTRACT_ID.split(".");

export const CONTRACT_ADDRESS = CONTRACT_PRINCIPAL;
export const CONTRACT_NAME = CONTRACT_ID_NAME || "marketplace";
export const NETWORK_LABEL = "Stacks Testnet";
export const ROYALTY_DENOMINATOR = 10_000;

export const TESTNET_HINT =
  "Connect your Hiro wallet to the Stacks Testnet (https://testnet.hiro.so) and ensure the contract is deployed before interacting.";
