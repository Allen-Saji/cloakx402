import { CAIP_FUJI } from "@cloakx402/eerc";
import { x402Facilitator } from "@x402/core/facilitator";
import express, { type Express } from "express";
import type { EercExactFacilitator } from "./scheme.js";

/**
 * Standard x402 facilitator HTTP surface, consumed by resource servers via
 * HTTPFacilitatorClient: POST /verify, POST /settle, GET /supported.
 */
export const createFacilitatorApp = (
  scheme: EercExactFacilitator,
): { app: Express; facilitator: x402Facilitator } => {
  const facilitator = new x402Facilitator().register(CAIP_FUJI, scheme);

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, scheme: scheme.scheme, network: CAIP_FUJI });
  });

  app.get("/supported", (_req, res) => {
    res.json(facilitator.getSupported());
  });

  app.post("/verify", async (req, res) => {
    const { paymentPayload, paymentRequirements } = req.body ?? {};
    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({
        isValid: false,
        invalidReason: "invalid_payload",
        invalidMessage: "body must include paymentPayload and paymentRequirements",
      });
      return;
    }
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    if (!result.isValid) {
      console.log(
        `verify REJECTED: ${result.invalidReason} -- ${result.invalidMessage ?? ""}`,
      );
    } else {
      console.log(`verify OK: payer ${result.payer}`);
    }
    res.json(result);
  });

  app.post("/settle", async (req, res) => {
    const { paymentPayload, paymentRequirements } = req.body ?? {};
    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({
        success: false,
        errorReason: "invalid_payload",
        errorMessage: "body must include paymentPayload and paymentRequirements",
        transaction: "",
        network: CAIP_FUJI,
      });
      return;
    }
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  });

  return { app, facilitator };
};
