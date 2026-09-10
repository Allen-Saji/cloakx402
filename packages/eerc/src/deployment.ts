/**
 * Fuji deployment addresses. Mirror of packages/contracts/deployments/fuji.json
 * (kept as a TS const so runtime packages need no fs access; update both together).
 */
export interface CloakX402Deployment {
  chainId: number;
  network: string;
  entryPoint: string;
  simpleAccountFactory: string;
  registrar: string;
  encryptedERC: string;
  transferVerifier: string;
  testERC20: string;
}

export const FUJI: CloakX402Deployment = {
  chainId: 43113,
  network: "eip155:43113",
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  simpleAccountFactory: "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
  registrar: "0xf85174CbdE66B05f4601c1d627A130c7969DCD9A",
  encryptedERC: "0x2A60EF46E6D65580144c734592AA8D163A97EFdd",
  transferVerifier: "0xE7dC9D868430FbBC38b764A1F9f5B75Ba96b419c",
  testERC20: "0xB7f18b4180E6d79e7BDE2907e847B9A17372Ebca",
};

export const CAIP_FUJI = "eip155:43113" as const;
export const FUJI_CHAIN_ID = 43113n;

/** eERC converter precision on this deployment (see fuji.json eercDecimals). */
export const EERC_DECIMALS = 6;
