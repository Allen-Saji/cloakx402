/**
 * The paying agent: calls the demo API, hits a 402 with eerc-exact terms,
 * proves an encrypted transfer, retries with X-PAYMENT, prints the result
 * and the settlement transaction.
 *
 * Usage: pnpm --filter @cloakx402/demo agent   (facilitator + demo API running)
 */
import { createCloakFetch } from "@cloakx402/client";
import { decodePaymentResponseHeader } from "@x402/core/http";
import { createDemoAgent, getProvider, loadOrCreateState } from "./shared.js";

const API = process.env.DEMO_API_URL ?? "http://localhost:4022";

const main = async () => {
  const provider = getProvider();
  const agent = await createDemoAgent(provider, loadOrCreateState());
  console.log(`agent smart account: ${agent.account}`);
  console.log(`encrypted balance:   ${await agent.getBalance()} (6d units)`);

  const cloakFetch = createCloakFetch(agent);
  const started = Date.now();
  const response = await cloakFetch(`${API}/api/alpha`);
  const elapsed = Date.now() - started;

  console.log(`\nHTTP ${response.status} in ${elapsed}ms`);
  const body = await response.json();
  console.log(`alpha: ${JSON.stringify(body)}`);

  if (response.status === 402) {
    const required = response.headers.get("payment-required");
    if (required) {
      const decoded = JSON.parse(
        Buffer.from(required, "base64").toString("utf8"),
      );
      console.log(`402 error: ${decoded.error ?? "(none)"}`);
    }
  }

  const paymentHeader = response.headers.get("payment-response");
  if (paymentHeader) {
    const settle = decodePaymentResponseHeader(paymentHeader);
    console.log(`settlement tx: ${settle.transaction}`);
    console.log(`explorer:      https://testnet.snowtrace.io/tx/${settle.transaction}`);
  }
  console.log(`encrypted balance after: ${await agent.getBalance()} (6d units)`);
  process.exit(0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
