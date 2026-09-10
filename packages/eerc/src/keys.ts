import { createHash } from "node:crypto";
import { Base8, mulPointEscalar, subOrder } from "@zk-kit/baby-jubjub";
import { formatPrivKeyForBabyJub } from "maci-crypto";
import { poseidon3 } from "poseidon-lite";

export interface BjjKeys {
  /** unformatted key; processPoseidonDecryption formats internally, pass this one */
  raw: bigint;
  formatted: bigint;
  publicKey: [bigint, bigint];
}

/**
 * Mirrors @avalabs/ac-eerc-sdk key derivation: take the signature's r
 * component and grind it with indexed sha256 until it falls in the BabyJubJub
 * subgroup order. Deterministic per (signer, message).
 */
export const deriveBjjRawKey = (signature: string): bigint => {
  const r = signature.replace(/^0x/, "").slice(0, 64);
  const limit = subOrder;
  const shaMax = (1n << 256n) - 1n;
  const maxAllowed = shaMax - (shaMax % limit);
  for (let i = 0; i < 1000; i++) {
    const idx = i.toString(16).padStart(2, "0");
    const digest = createHash("sha256")
      .update(Buffer.from(r + idx, "hex"))
      .digest("hex");
    const key = BigInt(`0x${digest}`);
    if (key < maxAllowed) return key % limit;
  }
  throw new Error("could not grind a valid BabyJubJub key");
};

export const toBjjKeys = (raw: bigint): BjjKeys => {
  const formatted = formatPrivKeyForBabyJub(raw) % subOrder;
  const publicKey = mulPointEscalar(Base8, formatted).map((x) => BigInt(x)) as [
    bigint,
    bigint,
  ];
  return { raw, formatted, publicKey };
};

/** Registrar registration hash: poseidon(chainId, formattedKey, account). */
export const registrationHash = (
  chainId: bigint,
  formattedKey: bigint,
  account: string,
): bigint => poseidon3([chainId, formattedKey, BigInt(account)]);

/**
 * Domain-separated message an account owner signs to derive its eERC key.
 * Keep the original domain stable so existing Fuji registrations remain valid.
 */
export const agentKeyMessage = (chainId: bigint, account: string): string =>
  `cloak402 eERC key v1 | chain ${chainId} | account ${account}`;

/**
 * Message the facilitator operator signs to derive the auditor key.
 * Keep the original domain stable so the deployed auditor key does not change.
 */
export const auditorKeyMessage = (chainId: bigint): string =>
  `cloak402 auditor key v1 | chain ${chainId}`;
