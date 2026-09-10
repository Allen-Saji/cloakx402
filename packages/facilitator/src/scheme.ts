import {
  type BjjKeys,
  type CloakX402Deployment,
  type PackedUserOperation,
  type SerializedUserOperation,
  decryptPCT,
  deserializeUserOp,
  ENCRYPTED_ERC_ABI,
  ENTRYPOINT_ABI,
  REGISTRAR_ABI,
  signalSlice,
  toBalanceView,
  TRANSFER_SIGNAL_COUNT,
  TRANSFER_SIGNALS,
  TRANSFER_VERIFIER_ABI,
  SIMPLE_ACCOUNT_ABI,
} from "@cloakx402/eerc";
import type {
  FacilitatorContext,
  Network,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { ethers } from "ethers";
import { KeyedQueue } from "./queue.js";

export const SCHEME = "eerc-exact";

export interface EercExactFacilitatorConfig {
  provider: ethers.Provider;
  /** pays gas for handleOps and sponsors EntryPoint deposits */
  signer: ethers.Wallet;
  /** auditor BabyJubJub keys; must match the on-chain auditor public key */
  auditorKeys: BjjKeys;
  deployment: CloakX402Deployment;
  /** EntryPoint deposit sponsorship: top up to this many wei when below min */
  depositTopUpWei?: bigint;
  depositMinWei?: bigint;
}

interface DecodedPayment {
  userOp: PackedUserOperation;
  receiver: string;
  tokenId: bigint;
  proofPoints: {
    a: [bigint, bigint];
    b: [[bigint, bigint], [bigint, bigint]];
    c: [bigint, bigint];
  };
  publicSignals: bigint[];
}

const invalid = (
  invalidReason: string,
  invalidMessage: string,
  payer?: string,
): VerifyResponse => ({ isValid: false, invalidReason, invalidMessage, payer });

/**
 * x402 SchemeNetworkFacilitator for confidential eERC payments.
 *
 * verify: statically validates that the carried ERC-4337 UserOperation is a
 * well-formed private eERC transfer paying `requirements.payTo` exactly
 * `requirements.amount` (decrypted via the auditor key), bound to the payer's
 * registered key and current balance ciphertext (single-use by construction).
 *
 * settle: serializes per sender, sponsors the account's EntryPoint deposit,
 * and self-bundles the UserOperation via entryPoint.handleOps -- no external
 * bundler or paymaster service.
 */
export class EercExactFacilitator {
  readonly scheme = SCHEME;
  readonly caipFamily = "eip155:*";

  private readonly signer: ethers.Wallet;
  private readonly auditorKeys: BjjKeys;
  private readonly deployment: CloakX402Deployment;
  private readonly queue = new KeyedQueue();
  private readonly depositTopUpWei: bigint;
  private readonly depositMinWei: bigint;

  private readonly entryPoint: ethers.Contract;
  private readonly registrar: ethers.Contract;
  private readonly eerc: ethers.Contract;
  private readonly verifier: ethers.Contract;
  private readonly accountIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
  private readonly eercIface = new ethers.Interface(ENCRYPTED_ERC_ABI);
  private tokenIdCache?: bigint;

  constructor(config: EercExactFacilitatorConfig) {
    this.signer = config.signer.connect(config.provider);
    this.auditorKeys = config.auditorKeys;
    this.deployment = config.deployment;
    this.depositTopUpWei = config.depositTopUpWei ?? ethers.parseEther("0.03");
    this.depositMinWei = config.depositMinWei ?? ethers.parseEther("0.01");

    this.entryPoint = new ethers.Contract(
      config.deployment.entryPoint,
      ENTRYPOINT_ABI,
      this.signer,
    );
    this.registrar = new ethers.Contract(
      config.deployment.registrar,
      REGISTRAR_ABI,
      config.provider,
    );
    this.eerc = new ethers.Contract(
      config.deployment.encryptedERC,
      ENCRYPTED_ERC_ABI,
      config.provider,
    );
    this.verifier = new ethers.Contract(
      config.deployment.transferVerifier,
      TRANSFER_VERIFIER_ABI,
      config.provider,
    );
  }

  getExtra(_network: Network): Record<string, unknown> | undefined {
    return {
      entryPoint: this.deployment.entryPoint,
      simpleAccountFactory: this.deployment.simpleAccountFactory,
      registrar: this.deployment.registrar,
      encryptedERC: this.deployment.encryptedERC,
      erc20: this.deployment.testERC20,
      auditorPublicKey: this.auditorKeys.publicKey.map(String),
      decimals: 6,
    };
  }

  getSigners(_network: string): string[] {
    return [this.signer.address];
  }

  /** the eERC token id for the wrapped ERC20; immutable once set on-chain */
  private async expectedTokenId(): Promise<bigint> {
    if (this.tokenIdCache !== undefined) return this.tokenIdCache;
    const id: bigint = await this.eerc.tokenIds(this.deployment.testERC20);
    if (id !== 0n) this.tokenIdCache = id;
    return id;
  }

  private decodePayment(payload: PaymentPayload): DecodedPayment {
    const wire = payload.payload as { userOp?: SerializedUserOperation };
    if (!wire?.userOp) throw new Error("payload.userOp missing");
    const userOp = deserializeUserOp(wire.userOp);

    const exec = this.accountIface.decodeFunctionData(
      "execute",
      userOp.callData,
    );
    const [dest, value, func] = [exec[0] as string, exec[1] as bigint, exec[2] as string];
    if (dest.toLowerCase() !== this.deployment.encryptedERC.toLowerCase()) {
      throw new Error("userOp does not call the eERC contract");
    }
    if (value !== 0n) throw new Error("userOp sends nonzero value");

    const transfer = this.eercIface.decodeFunctionData("transfer", func);
    const receiver = transfer[0] as string;
    const tokenId = transfer[1] as bigint;
    const proof = transfer[2];
    const proofPoints = {
      a: [BigInt(proof[0][0][0]), BigInt(proof[0][0][1])] as [bigint, bigint],
      b: [
        [BigInt(proof[0][1][0][0]), BigInt(proof[0][1][0][1])],
        [BigInt(proof[0][1][1][0]), BigInt(proof[0][1][1][1])],
      ] as [[bigint, bigint], [bigint, bigint]],
      c: [BigInt(proof[0][2][0]), BigInt(proof[0][2][1])] as [bigint, bigint],
    };
    const publicSignals = (proof[1] as readonly bigint[]).map((x) => BigInt(x));
    if (publicSignals.length !== TRANSFER_SIGNAL_COUNT) {
      throw new Error("unexpected public signal count");
    }
    return { userOp, receiver, tokenId, proofPoints, publicSignals };
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    _context?: FacilitatorContext,
  ): Promise<VerifyResponse> {
    try {
      return await this.verifyInner(payload, requirements);
    } catch (error) {
      return invalid(
        "invalid_payload",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async verifyInner(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    if (requirements.scheme !== SCHEME) {
      return invalid("unsupported_scheme", `scheme must be ${SCHEME}`);
    }
    if (requirements.network !== this.deployment.network) {
      return invalid(
        "invalid_network",
        `network must be ${this.deployment.network}`,
      );
    }
    if (
      requirements.asset.toLowerCase() !==
      this.deployment.encryptedERC.toLowerCase()
    ) {
      return invalid("invalid_payment_requirements", "asset must be the eERC contract");
    }

    const decoded = this.decodePayment(payload);
    const { userOp, receiver, tokenId, proofPoints, publicSignals } = decoded;
    const payer = userOp.sender;

    if (receiver.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return invalid(
        "invalid_payment",
        "transfer receiver does not match payTo",
        payer,
      );
    }

    // all chain reads are independent; issue them in one tick so the
    // provider batches them into a single RPC round trip
    const [
      expectedTokenId,
      senderRegistered,
      receiverRegistered,
      senderKeyRaw,
      receiverKeyRaw,
      balanceRaw,
      proofOk,
      nonce,
    ] = await Promise.all([
      this.expectedTokenId(),
      this.registrar.isUserRegistered(payer) as Promise<boolean>,
      this.registrar.isUserRegistered(receiver) as Promise<boolean>,
      this.registrar.getUserPublicKey(payer),
      this.registrar.getUserPublicKey(receiver),
      this.eerc.balanceOf(payer, tokenId),
      this.verifier.verifyProof(
        proofPoints.a,
        proofPoints.b,
        proofPoints.c,
        publicSignals,
      ) as Promise<boolean>,
      this.entryPoint.getNonce(payer, 0n) as Promise<bigint>,
    ]);

    if (tokenId !== expectedTokenId) {
      return invalid("invalid_payment", "unexpected eERC token id", payer);
    }

    // proof is bound to the payer's registered key: eERC checks this at
    // execution via msg.sender; mirror it here so verify fails fast
    if (!senderRegistered) {
      return invalid("invalid_payment", "payer account not registered in eERC", payer);
    }
    if (!receiverRegistered) {
      return invalid("invalid_payment", "payTo not registered in eERC", payer);
    }
    const senderKey: bigint[] = senderKeyRaw.map((x: bigint) => BigInt(x));
    const proofSenderKey = signalSlice(
      publicSignals,
      TRANSFER_SIGNALS.senderPublicKey,
    );
    if (senderKey[0] !== proofSenderKey[0] || senderKey[1] !== proofSenderKey[1]) {
      return invalid(
        "invalid_payment",
        "proof sender key does not match payer's registered key",
        payer,
      );
    }
    const receiverKey: bigint[] = receiverKeyRaw.map((x: bigint) => BigInt(x));
    const proofReceiverKey = signalSlice(
      publicSignals,
      TRANSFER_SIGNALS.receiverPublicKey,
    );
    if (
      receiverKey[0] !== proofReceiverKey[0] ||
      receiverKey[1] !== proofReceiverKey[1]
    ) {
      return invalid(
        "invalid_payment",
        "proof receiver key does not match payTo's registered key",
        payer,
      );
    }

    // freshness / replay: the proof commits to the sender's current balance
    // ciphertext; a spent or stale proof cannot match the live one
    const balance = toBalanceView(balanceRaw);
    const proofBalance = [
      ...signalSlice(publicSignals, TRANSFER_SIGNALS.senderBalanceC1),
      ...signalSlice(publicSignals, TRANSFER_SIGNALS.senderBalanceC2),
    ];
    if (balance.eGCT.some((v, i) => v !== proofBalance[i])) {
      return invalid(
        "invalid_payment",
        "proof balance ciphertext is stale (already spent or superseded)",
        payer,
      );
    }

    // auditor binding + amount: decrypt the in-proof auditor PCT with our key
    const proofAuditorKey = signalSlice(
      publicSignals,
      TRANSFER_SIGNALS.auditorPublicKey,
    );
    if (
      proofAuditorKey[0] !== this.auditorKeys.publicKey[0] ||
      proofAuditorKey[1] !== this.auditorKeys.publicKey[1]
    ) {
      return invalid(
        "invalid_payment",
        "proof auditor key does not match the facilitator auditor",
        payer,
      );
    }
    const auditorPCT = [
      ...signalSlice(publicSignals, TRANSFER_SIGNALS.auditorPCT),
      ...signalSlice(publicSignals, TRANSFER_SIGNALS.auditorPCTAuthKey),
      ...signalSlice(publicSignals, TRANSFER_SIGNALS.auditorPCTNonce),
    ];
    let amount: bigint;
    try {
      amount = decryptPCT(auditorPCT, this.auditorKeys.raw);
    } catch {
      return invalid("invalid_payment", "auditor PCT does not decrypt", payer);
    }
    if (amount !== BigInt(requirements.amount)) {
      return invalid(
        "invalid_payment",
        `encrypted amount ${amount} does not match required ${requirements.amount}`,
        payer,
      );
    }

    // the zk proof itself, via the audited on-chain verifier
    if (!proofOk) {
      return invalid("invalid_payment", "transfer proof does not verify", payer);
    }

    // userOp nonce must be current, otherwise settle will revert
    if (userOp.nonce !== nonce) {
      return invalid(
        "invalid_payment",
        `userOp nonce ${userOp.nonce} != expected ${nonce}`,
        payer,
      );
    }

    return { isValid: true, payer };
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    _context?: FacilitatorContext,
  ): Promise<SettleResponse> {
    const network = requirements.network;
    let decoded: DecodedPayment;
    try {
      decoded = this.decodePayment(payload);
    } catch (error) {
      return {
        success: false,
        errorReason: "invalid_payload",
        errorMessage: error instanceof Error ? error.message : String(error),
        transaction: "",
        network,
      };
    }
    const payer = decoded.userOp.sender;

    return this.queue.run(payer.toLowerCase(), async () => {
      // deposit read is only consumed on the success path; fetch it alongside
      // the re-verify instead of after it
      const [check, deposit] = await Promise.all([
        this.verify(payload, requirements),
        this.entryPoint.balanceOf(payer) as Promise<bigint>,
      ]);
      if (!check.isValid) {
        return {
          success: false,
          errorReason: check.invalidReason ?? "invalid_payment",
          errorMessage: check.invalidMessage,
          payer,
          transaction: "",
          network,
        };
      }

      try {
        // sponsor gas: the payer's smart account pays its own prefund from
        // an EntryPoint deposit the facilitator keeps topped up
        if (deposit < this.depositMinWei) {
          const tx = await this.entryPoint.depositTo(payer, {
            value: this.depositTopUpWei,
          });
          await tx.wait();
        }

        const tx = await this.entryPoint.handleOps(
          [decoded.userOp],
          this.signer.address,
        );
        const receipt = await tx.wait();
        if (!receipt) throw new Error("no receipt for handleOps");

        // handleOps succeeds even when the inner call reverts; check the
        // UserOperationEvent success flag
        const opEvent = receipt.logs
          .map((log: ethers.Log) => {
            try {
              return this.entryPoint.interface.parseLog(log);
            } catch {
              return null;
            }
          })
          .find((e: ethers.LogDescription | null) => e?.name === "UserOperationEvent");
        if (!opEvent) throw new Error("UserOperationEvent not found");
        if (!opEvent.args.success) {
          return {
            success: false,
            errorReason: "invalid_transaction_state",
            errorMessage: "user operation executed but the eERC transfer reverted",
            payer,
            transaction: receipt.hash,
            network,
          };
        }

        return {
          success: true,
          payer,
          transaction: receipt.hash,
          network,
          amount: requirements.amount,
        };
      } catch (error) {
        return {
          success: false,
          errorReason: "unexpected_settle_error",
          errorMessage: error instanceof Error ? error.message : String(error),
          payer,
          transaction: "",
          network,
        };
      }
    });
  }
}
