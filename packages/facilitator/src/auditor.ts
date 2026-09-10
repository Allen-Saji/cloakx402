import {
  auditorKeyMessage,
  type BjjKeys,
  buildRegistrationWitness,
  type CircuitArtifacts,
  type CloakX402Deployment,
  deriveBjjRawKey,
  ENCRYPTED_ERC_ABI,
  prove,
  REGISTRAR_ABI,
  registrationHash,
  toBjjKeys,
} from "@cloakx402/eerc";
import { ethers } from "ethers";

/**
 * The facilitator's auditor identity. Deterministically derived from the
 * operator key by signing a domain-separated message, so a restarted
 * facilitator always recovers the same BabyJubJub keypair. The on-chain
 * auditor public key must match (see ensureAuditorRotated).
 */
export const deriveAuditorKeys = async (
  operator: ethers.Wallet,
  chainId: bigint,
): Promise<BjjKeys> => {
  const signature = await operator.signMessage(auditorKeyMessage(chainId));
  return toBjjKeys(deriveBjjRawKey(signature));
};

/**
 * Points the on-chain eERC auditor at the operator's derived key. The eERC
 * auditor is rotatable by the contract owner (our operator): (re-)registers
 * the operator address with the derived key, then setAuditorPublicKey.
 * No-op when already current. Returns the auditor keys either way.
 */
export const ensureAuditorRotated = async (
  operator: ethers.Wallet,
  deployment: CloakX402Deployment,
  registrationArtifacts: CircuitArtifacts,
): Promise<BjjKeys> => {
  const chainId = BigInt(deployment.chainId);
  const auditorKeys = await deriveAuditorKeys(operator, chainId);

  const registrar = new ethers.Contract(
    deployment.registrar,
    REGISTRAR_ABI,
    operator,
  );
  const eerc = new ethers.Contract(
    deployment.encryptedERC,
    ENCRYPTED_ERC_ABI,
    operator,
  );

  const onchain = await eerc.auditorPublicKey();
  if (
    BigInt(onchain.x) === auditorKeys.publicKey[0] &&
    BigInt(onchain.y) === auditorKeys.publicKey[1]
  ) {
    return auditorKeys;
  }

  const registered: bigint[] = (
    await registrar.getUserPublicKey(operator.address)
  ).map((x: bigint) => BigInt(x));
  if (
    registered[0] !== auditorKeys.publicKey[0] ||
    registered[1] !== auditorKeys.publicKey[1]
  ) {
    const proof = await prove(
      registrationArtifacts,
      buildRegistrationWitness({
        formattedKey: auditorKeys.formatted,
        publicKey: auditorKeys.publicKey,
        account: operator.address,
        chainId,
        registrationHash: registrationHash(
          chainId,
          auditorKeys.formatted,
          operator.address,
        ),
      }),
    );
    const tx = await registrar.register([
      [proof.proofPoints.a, proof.proofPoints.b, proof.proofPoints.c],
      proof.publicSignals,
    ]);
    await tx.wait();
  }

  const tx = await eerc.setAuditorPublicKey(operator.address);
  await tx.wait();
  return auditorKeys;
};
