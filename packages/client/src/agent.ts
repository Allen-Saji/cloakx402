import {
  agentKeyMessage,
  type BjjKeys,
  buildRegistrationWitness,
  buildTransferWitness,
  buildUserOp,
  type CircuitArtifacts,
  type CloakX402Deployment,
  deriveBjjRawKey,
  ENCRYPTED_ERC_ABI,
  ENTRYPOINT_ABI,
  ERC20_ABI,
  type PackedUserOperation,
  pctToArray,
  processPoseidonEncryption,
  prove,
  recoverBalance,
  REGISTRAR_ABI,
  registrationHash,
  SIMPLE_ACCOUNT_ABI,
  SIMPLE_ACCOUNT_FACTORY_ABI,
  toBalanceView,
  toBjjKeys,
  type UserOpGasOptions,
} from "@cloakx402/eerc";
import { ethers } from "ethers";

export interface CloakAgentConfig {
  provider: ethers.Provider;
  /** owner EOA; only ever signs -- it never needs gas */
  owner: ethers.Wallet;
  deployment: CloakX402Deployment;
  artifacts: {
    registration: CircuitArtifacts;
    transfer: CircuitArtifacts;
  };
  /** SimpleAccountFactory salt, default 0 */
  salt?: bigint;
}

/**
 * A gasless paying agent: an ERC-4337 SimpleAccount registered in eERC,
 * with its BabyJubJub key derived from the owner's signature. Builds signed
 * UserOperations; it never submits them itself -- the facilitator (or a
 * sponsor during setup) bundles via entryPoint.handleOps.
 */
export class CloakAgent {
  readonly account: string;
  readonly keys: BjjKeys;

  private readonly provider: ethers.Provider;
  private readonly owner: ethers.Wallet;
  private readonly deployment: CloakX402Deployment;
  private readonly artifacts: CloakAgentConfig["artifacts"];
  private readonly salt: bigint;

  private readonly entryPoint: ethers.Contract;
  private readonly factory: ethers.Contract;
  private readonly registrar: ethers.Contract;
  private readonly eerc: ethers.Contract;
  private readonly accountIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
  private readonly erc20Iface = new ethers.Interface(ERC20_ABI);
  private tokenIdCache?: bigint;

  private constructor(
    config: CloakAgentConfig,
    account: string,
    keys: BjjKeys,
  ) {
    this.provider = config.provider;
    this.owner = config.owner;
    this.deployment = config.deployment;
    this.artifacts = config.artifacts;
    this.salt = config.salt ?? 0n;
    this.account = account;
    this.keys = keys;

    this.entryPoint = new ethers.Contract(
      config.deployment.entryPoint,
      ENTRYPOINT_ABI,
      config.provider,
    );
    this.factory = new ethers.Contract(
      config.deployment.simpleAccountFactory,
      SIMPLE_ACCOUNT_FACTORY_ABI,
      config.provider,
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
  }

  static async create(config: CloakAgentConfig): Promise<CloakAgent> {
    const factory = new ethers.Contract(
      config.deployment.simpleAccountFactory,
      SIMPLE_ACCOUNT_FACTORY_ABI,
      config.provider,
    );
    // ethers v6 reserves contract.getAddress(); fetch the ABI function explicitly
    const account: string = await factory
      .getFunction("getAddress(address,uint256)")
      .staticCall(config.owner.address, config.salt ?? 0n);
    const chainId = BigInt(config.deployment.chainId);
    const signature = await config.owner.signMessage(
      agentKeyMessage(chainId, account),
    );
    const keys = toBjjKeys(deriveBjjRawKey(signature));
    return new CloakAgent(config, account, keys);
  }

  async isRegistered(): Promise<boolean> {
    return this.registrar.isUserRegistered(this.account);
  }

  async isDeployed(): Promise<boolean> {
    const code = await this.provider.getCode(this.account);
    return code !== "0x";
  }

  /** the eERC token id for the wrapped ERC20; immutable once set on-chain */
  private async tokenId(): Promise<bigint> {
    if (this.tokenIdCache !== undefined) return this.tokenIdCache;
    const id: bigint = await this.eerc.tokenIds(this.deployment.testERC20);
    if (id !== 0n) this.tokenIdCache = id;
    return id;
  }

  /** current confidential balance in eERC system units (6 decimals) */
  async getBalance(): Promise<bigint> {
    const tokenId = await this.tokenId();
    const view = toBalanceView(await this.eerc.balanceOf(this.account, tokenId));
    return recoverBalance(view, this.keys.raw);
  }

  /** builds and owner-signs a UserOperation wrapping execute(dest, 0, data) */
  async signUserOp(
    dest: string,
    data: string,
    gas: Partial<UserOpGasOptions> & { initCode?: string },
  ): Promise<PackedUserOperation> {
    const [feeData, nonce] = await Promise.all([
      this.provider.getFeeData(),
      this.entryPoint.getNonce(this.account, 0n) as Promise<bigint>,
    ]);
    const maxFeePerGas = (feeData.maxFeePerGas ?? 25_000_000_000n) * 2n;
    const maxPriorityFeePerGas =
      feeData.maxPriorityFeePerGas ?? 1_000_000_000n;
    const callData = this.accountIface.encodeFunctionData("execute", [
      dest,
      0n,
      data,
    ]);
    const op = buildUserOp(
      this.account,
      nonce,
      callData,
      { ...gas, maxFeePerGas, maxPriorityFeePerGas },
      gas.initCode ?? "0x",
    );
    const opHash: string = await this.entryPoint.getUserOpHash(op);
    op.signature = await this.owner.signMessage(ethers.getBytes(opHash));
    return op;
  }

  /**
   * Registration UserOp. When the account is not yet deployed, includes the
   * factory initCode so deployment and eERC registration land in one op.
   */
  async buildRegisterUserOp(): Promise<PackedUserOperation> {
    const chainId = BigInt(this.deployment.chainId);
    const proof = await prove(
      this.artifacts.registration,
      buildRegistrationWitness({
        formattedKey: this.keys.formatted,
        publicKey: this.keys.publicKey,
        account: this.account,
        chainId,
        registrationHash: registrationHash(
          chainId,
          this.keys.formatted,
          this.account,
        ),
      }),
    );
    const registrarIface = new ethers.Interface(REGISTRAR_ABI);
    const data = registrarIface.encodeFunctionData("register", [
      [[proof.proofPoints.a, proof.proofPoints.b, proof.proofPoints.c], proof.publicSignals],
    ]);
    const initCode = (await this.isDeployed())
      ? "0x"
      : ethers.concat([
          this.deployment.simpleAccountFactory,
          this.factory.interface.encodeFunctionData("createAccount", [
            this.owner.address,
            this.salt,
          ]),
        ]);
    return this.signUserOp(this.deployment.registrar, data, {
      initCode,
      verificationGas: 1_000_000n,
      callGas: 500_000n,
    });
  }

  async buildApproveUserOp(amount: bigint): Promise<PackedUserOperation> {
    const data = this.erc20Iface.encodeFunctionData("approve", [
      this.deployment.encryptedERC,
      amount,
    ]);
    return this.signUserOp(this.deployment.testERC20, data, {
      callGas: 100_000n,
    });
  }

  /** deposits `erc20Amount` of the underlying token into eERC */
  async buildDepositUserOp(erc20Amount: bigint): Promise<PackedUserOperation> {
    const decimals: bigint = await this.erc20Decimals();
    const systemAmount =
      (erc20Amount * 10n ** 6n) / 10n ** decimals;
    const pct = processPoseidonEncryption([systemAmount], this.keys.publicKey);
    const data = this.eerc.interface.encodeFunctionData("deposit", [
      erc20Amount,
      this.deployment.testERC20,
      pctToArray(pct),
    ]);
    return this.signUserOp(this.deployment.encryptedERC, data, {
      callGas: 900_000n,
    });
  }

  /**
   * The payment path: a signed UserOperation carrying a confidential eERC
   * transfer of `amount` (system units) to `payTo`. Reads the live balance
   * ciphertext, receiver key, and auditor key from chain, so the proof is
   * bound to current state and single-use.
   */
  async buildPaymentUserOp(
    payTo: string,
    amount: bigint,
  ): Promise<PackedUserOperation> {
    const tokenId = await this.tokenId();
    const [balanceResult, receiverKeyRaw, auditorKeyRaw] = await Promise.all([
      this.eerc.balanceOf(this.account, tokenId),
      this.registrar.getUserPublicKey(payTo),
      this.eerc.auditorPublicKey(),
    ]);
    const view = toBalanceView(balanceResult);
    const balance = recoverBalance(view, this.keys.raw);
    const receiverPublicKey = [
      BigInt(receiverKeyRaw[0]),
      BigInt(receiverKeyRaw[1]),
    ] as [bigint, bigint];
    const auditorPublicKey = [
      BigInt(auditorKeyRaw.x),
      BigInt(auditorKeyRaw.y),
    ] as [bigint, bigint];

    const witness = buildTransferWitness({
      amount,
      senderFormattedKey: this.keys.formatted,
      senderPublicKey: this.keys.publicKey,
      senderBalance: balance,
      senderEncryptedBalance: view.eGCT,
      receiverPublicKey,
      auditorPublicKey,
    });
    const proof = await prove(this.artifacts.transfer, witness.circuitInput);
    const data = this.eerc.interface.encodeFunctionData("transfer", [
      payTo,
      tokenId,
      [[proof.proofPoints.a, proof.proofPoints.b, proof.proofPoints.c], proof.publicSignals],
      witness.senderBalancePCT,
    ]);
    return this.signUserOp(this.deployment.encryptedERC, data, {
      callGas: 1_400_000n,
    });
  }

  private async erc20Decimals(): Promise<bigint> {
    const erc20 = new ethers.Contract(
      this.deployment.testERC20,
      ERC20_ABI,
      this.provider,
    );
    return BigInt(await erc20.decimals());
  }
}
