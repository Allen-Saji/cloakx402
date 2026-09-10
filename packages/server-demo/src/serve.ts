import { CAIP_FUJI } from "@cloakx402/eerc";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddlewareFromConfig } from "@x402/express";
import express from "express";
import { EercExactServer } from "./scheme.js";

const PRICE = process.env.PRICE ?? "$0.10";

/**
 * The paid resource: per-request market notes an agent would buy mid-task.
 * The content is illustrative; the point is that each request settles as an
 * encrypted eERC transfer nobody on-chain can size.
 */
const ALPHA = [
  "Fuji faucet flows spiked 3x this week; expect testnet congestion around hackathon deadlines.",
  "Three of four Avalanche x402 facilitators settle plain USDC; confidential settlement is an open niche.",
  "eERC converter deposits round to 6 decimals; price feeds below 1e-6 USDC truncate to zero.",
  "EntryPoint v0.7 canonical deployment on Fuji sees < 2s inclusion at 2 gwei priority.",
  "Agents that reveal per-call API spend leak their strategy; encrypted rails hide the trace.",
];

const main = async () => {
  const payTo = process.env.PAY_TO;
  if (!payTo) {
    console.error("PAY_TO is not set (must be an eERC-registered receiver address)");
    process.exit(1);
  }
  const facilitatorUrl = process.env.FACILITATOR_URL ?? "http://localhost:4021";
  const port = Number(process.env.PORT ?? 4022);

  const app = express();
  app.use(
    paymentMiddlewareFromConfig(
      {
        "GET /api/alpha": {
          accepts: {
            scheme: "eerc-exact",
            network: CAIP_FUJI,
            payTo,
            price: PRICE,
            maxTimeoutSeconds: 120,
          },
          description: "One confidential market note, paid per request in encrypted eERC",
          mimeType: "application/json",
        },
      },
      new HTTPFacilitatorClient({ url: facilitatorUrl }),
      [{ network: CAIP_FUJI, server: new EercExactServer() }],
    ),
  );

  app.get("/api/alpha", (_req, res) => {
    const note = ALPHA[Math.floor(Math.random() * ALPHA.length)];
    res.json({ alpha: note, paidWith: "eerc-exact (encrypted amount)" });
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.listen(port, () => {
    console.log(`cloakx402 demo API on :${port}`);
    console.log(`  paid route:  GET /api/alpha (${PRICE})`);
    console.log(`  payTo:       ${payTo}`);
    console.log(`  facilitator: ${facilitatorUrl}`);
  });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
