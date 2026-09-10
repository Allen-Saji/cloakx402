import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CloakAgent } from "@cloakx402/client";
import { FUJI } from "@cloakx402/eerc";
import { ethers } from "ethers";

export const DEFAULT_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BUILD = path.resolve(
  HERE,
  "../../../vendor/EncryptedERC/circom/build",
);
export const ARTIFACTS = {
  registration: {
    wasm: path.join(BUILD, "registration/registration.wasm"),
    zkey: path.join(BUILD, "registration/circuit_final.zkey"),
  },
  transfer: {
    wasm: path.join(BUILD, "transfer/transfer.wasm"),
    zkey: path.join(BUILD, "transfer/transfer.zkey"),
  },
};

/** persistent demo identities; gitignored, keys never printed */
const STATE_FILE = path.resolve(HERE, "../.state.json");

export interface DemoState {
  agentOwnerKey: string;
  sellerKey: string;
}

export const loadOrCreateState = (): DemoState => {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as DemoState;
  }
  const state: DemoState = {
    agentOwnerKey: ethers.Wallet.createRandom().privateKey,
    sellerKey: ethers.Wallet.createRandom().privateKey,
  };
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, {
    mode: 0o600,
  });
  return state;
};

export const getProvider = (): ethers.JsonRpcProvider =>
  // 1s polling to match Fuji's ~2s blocks; staticNetwork skips chainId probes
  new ethers.JsonRpcProvider(process.env.FUJI_RPC_URL ?? DEFAULT_RPC, undefined, {
    staticNetwork: true,
    pollingInterval: 1_000,
  });

export const requireOperatorKey = (): string => {
  const key = process.env.FACILITATOR_PRIVATE_KEY;
  if (!key) {
    console.error("FACILITATOR_PRIVATE_KEY is not set");
    process.exit(1);
  }
  return key;
};

export const createDemoAgent = async (
  provider: ethers.Provider,
  state: DemoState,
): Promise<CloakAgent> =>
  CloakAgent.create({
    provider,
    owner: new ethers.Wallet(state.agentOwnerKey),
    deployment: FUJI,
    artifacts: ARTIFACTS,
  });
