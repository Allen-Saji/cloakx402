import { serializeUserOp } from "@cloakx402/eerc";
import type {
  PaymentRequirements,
  SchemeNetworkClient,
} from "@x402/core/types";
import type { CloakAgent } from "./agent.js";

export const SCHEME = "eerc-exact";

/**
 * x402 SchemeNetworkClient for eerc-exact: on a 402, builds a confidential
 * eERC transfer proof for exactly the required amount and wraps it in a
 * signed ERC-4337 UserOperation the facilitator will bundle.
 */
export class EercExactClient implements SchemeNetworkClient {
  readonly scheme = SCHEME;

  constructor(private readonly agent: CloakAgent) {}

  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<{ x402Version: number; payload: Record<string, unknown> }> {
    const userOp = await this.agent.buildPaymentUserOp(
      paymentRequirements.payTo,
      BigInt(paymentRequirements.amount),
    );
    return {
      x402Version,
      payload: { userOp: serializeUserOp(userOp) },
    };
  }
}
