/**
 * Idempotent Fuji demo setup:
 *  1. rotates the eERC auditor to the facilitator's derived key
 *  2. registers a seller EOA (the paid API's payTo identity)
 *  3. registers the agent's smart account and funds its encrypted balance
 *
 * Usage: FACILITATOR_PRIVATE_KEY=... pnpm --filter @cloakx402/demo setup
 */
import {
  buildRegistrationWitness,
  deriveBjjRawKey,
  ENTRYPOINT_ABI,
  ERC20_ABI,
  FUJI,
  FUJI_CHAIN_ID,
  type PackedUserOperation,
  prove,
  REGISTRAR_ABI,
  registrationHash,
  toBjjKeys,
} from "@cloakx402/eerc";
import { ensureAuditorRotated } from "@cloakx402/facilitator";
import { ethers } from "ethers";
import {
  ARTIFACTS,
  createDemoAgent,
  getProvider,
  loadOrCreateState,
  requireOperatorKey,
} from "./shared.js";

const SELLER_GAS = ethers.parseEther("0.005");
const AGENT_DEPOSIT = ethers.parseEther("0.05");
const ERC20_SEED = ethers.parseEther("20"); // 20 test tokens -> 20_000_000 system units
const MIN_AGENT_BALANCE = 1_000_000n; // re-seed below 1 token

// Keep this domain stable so rerunning setup derives the existing Fuji seller key.
export const SELLER_KEY_MESSAGE = "cloak402 seller key v1";

const main = async () => {
  const provider = getProvider();
  const operator = new ethers.Wallet(requireOperatorKey(), provider);
  const state = loadOrCreateState();
  const entryPoint = new ethers.Contract(FUJI.entryPoint, ENTRYPOINT_ABI, operator);
  const registrar = new ethers.Contract(FUJI.registrar, REGISTRAR_ABI, provider);
  const erc20 = new ethers.Contract(FUJI.testERC20, ERC20_ABI, operator);

  const bundle = async (op: PackedUserOperation, label: string) => {
    const tx = await entryPoint.handleOps([op], operator.address);
    const receipt = await tx.wait();
    console.log(`  bundled [${label}]: ${receipt?.hash}`);
  };

  console.log("1. auditor");
  await ensureAuditorRotated(operator, FUJI, ARTIFACTS.registration);
  console.log("  auditor key is current (derived from operator)");

  console.log("2. seller");
  const seller = new ethers.Wallet(state.sellerKey, provider);
  if ((await provider.getBalance(seller.address)) < SELLER_GAS / 2n) {
    await (
      await operator.sendTransaction({ to: seller.address, value: SELLER_GAS })
    ).wait();
  }
  if (!(await registrar.isUserRegistered(seller.address))) {
    const sellerKeys = toBjjKeys(
      deriveBjjRawKey(await seller.signMessage(SELLER_KEY_MESSAGE)),
    );
    const proof = await prove(
      ARTIFACTS.registration,
      buildRegistrationWitness({
        formattedKey: sellerKeys.formatted,
        publicKey: sellerKeys.publicKey,
        account: seller.address,
        chainId: FUJI_CHAIN_ID,
        registrationHash: registrationHash(
          FUJI_CHAIN_ID,
          sellerKeys.formatted,
          seller.address,
        ),
      }),
    );
    const tx = await (registrar.connect(seller) as ethers.Contract).register([
      [proof.proofPoints.a, proof.proofPoints.b, proof.proofPoints.c],
      proof.publicSignals,
    ]);
    await tx.wait();
    console.log(`  seller registered: ${seller.address}`);
  } else {
    console.log(`  seller already registered: ${seller.address}`);
  }

  console.log("3. agent smart account");
  const agent = await createDemoAgent(provider, state);
  if ((await entryPoint.balanceOf(agent.account)) < AGENT_DEPOSIT / 2n) {
    await (
      await entryPoint.depositTo(agent.account, { value: AGENT_DEPOSIT })
    ).wait();
    console.log("  prefunded EntryPoint deposit");
  }
  if (!(await agent.isRegistered())) {
    await bundle(await agent.buildRegisterUserOp(), "register");
    console.log(`  agent registered: ${agent.account}`);
  } else {
    console.log(`  agent already registered: ${agent.account}`);
  }

  console.log("4. encrypted balance");
  const balance = await agent.getBalance();
  if (balance < MIN_AGENT_BALANCE) {
    const operatorErc20: bigint = await erc20.balanceOf(operator.address);
    if (operatorErc20 < ERC20_SEED) {
      throw new Error("operator does not hold enough test ERC20 to seed the agent");
    }
    await (await erc20.transfer(agent.account, ERC20_SEED)).wait();
    await bundle(await agent.buildApproveUserOp(ERC20_SEED), "approve");
    await bundle(await agent.buildDepositUserOp(ERC20_SEED), "deposit");
    console.log(`  deposited; encrypted balance: ${await agent.getBalance()} (6d units)`);
  } else {
    console.log(`  encrypted balance sufficient: ${balance} (6d units)`);
  }

  console.log("\nsetup complete");
  console.log(`  operator (facilitator): ${operator.address}`);
  console.log(`  seller   (PAY_TO):      ${seller.address}`);
  console.log(`  agent smart account:    ${agent.account}`);
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
