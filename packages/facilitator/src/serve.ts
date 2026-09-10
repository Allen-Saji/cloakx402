import { FUJI, FUJI_CHAIN_ID } from "@cloakx402/eerc";
import { ethers } from "ethers";
import { createFacilitatorApp } from "./app.js";
import { deriveAuditorKeys } from "./auditor.js";
import { EercExactFacilitator } from "./scheme.js";

const DEFAULT_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

const main = async () => {
  const key = process.env.FACILITATOR_PRIVATE_KEY;
  if (!key) {
    console.error("FACILITATOR_PRIVATE_KEY is not set");
    process.exit(1);
  }
  const rpcUrl = process.env.FUJI_RPC_URL ?? DEFAULT_RPC;
  const port = Number(process.env.PORT ?? 4021);

  // Fuji produces blocks in ~2s; ethers' default 4s receipt polling adds
  // dead time to every settle. staticNetwork skips per-call chainId probes.
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true,
    pollingInterval: 1_000,
  });
  const signer = new ethers.Wallet(key, provider);
  const auditorKeys = await deriveAuditorKeys(signer, FUJI_CHAIN_ID);

  const scheme = new EercExactFacilitator({
    provider,
    signer,
    auditorKeys,
    deployment: FUJI,
  });

  // refuse to serve if the on-chain auditor key is not ours: every verify
  // would fail with undecryptable auditor PCTs
  const eerc = new ethers.Contract(
    FUJI.encryptedERC,
    ["function auditorPublicKey() view returns (uint256 x, uint256 y)"],
    provider,
  );
  const onchain = await eerc.auditorPublicKey();
  if (
    BigInt(onchain.x) !== auditorKeys.publicKey[0] ||
    BigInt(onchain.y) !== auditorKeys.publicKey[1]
  ) {
    console.error(
      "on-chain auditor key does not match the derived facilitator auditor key",
    );
    console.error("run: pnpm --filter @cloakx402/facilitator rotate-auditor");
    process.exit(1);
  }

  const { app } = createFacilitatorApp(scheme);
  app.listen(port, () => {
    console.log(`cloakx402 facilitator on :${port}`);
    console.log(`  signer:  ${signer.address}`);
    console.log(`  network: ${FUJI.network}`);
    console.log(`  scheme:  ${scheme.scheme}`);
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
