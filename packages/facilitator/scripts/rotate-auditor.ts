/**
 * Points the on-chain eERC auditor at the facilitator's derived auditor key.
 * Run once before first serving, and again after rotating the operator key.
 *
 * Usage: FACILITATOR_PRIVATE_KEY=... pnpm --filter @cloakx402/facilitator rotate-auditor
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { FUJI } from "@cloakx402/eerc";
import { ethers } from "ethers";
import { ensureAuditorRotated } from "../src/auditor.js";

const DEFAULT_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const BUILD = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../vendor/EncryptedERC/circom/build",
);

const main = async () => {
  const key = process.env.FACILITATOR_PRIVATE_KEY;
  if (!key) {
    console.error("FACILITATOR_PRIVATE_KEY is not set");
    process.exit(1);
  }
  const provider = new ethers.JsonRpcProvider(
    process.env.FUJI_RPC_URL ?? DEFAULT_RPC,
  );
  const operator = new ethers.Wallet(key, provider);
  const keys = await ensureAuditorRotated(operator, FUJI, {
    wasm: path.join(BUILD, "registration/registration.wasm"),
    zkey: path.join(BUILD, "registration/circuit_final.zkey"),
  });
  console.log("auditor is current");
  console.log(`  auditor public key: [${keys.publicKey[0]}, ${keys.publicKey[1]}]`);
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
