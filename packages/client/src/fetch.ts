import { CAIP_FUJI } from "@cloakx402/eerc";
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { CloakAgent } from "./agent.js";
import { EercExactClient } from "./scheme.js";

/**
 * A fetch that pays confidentially: 402 responses with eerc-exact
 * requirements are settled via the agent's encrypted eERC balance.
 */
export const createCloakFetch = (
  agent: CloakAgent,
  baseFetch: typeof globalThis.fetch = globalThis.fetch,
): ReturnType<typeof wrapFetchWithPayment> => {
  const client = new x402Client().register(CAIP_FUJI, new EercExactClient(agent));
  return wrapFetchWithPayment(baseFetch, client);
};
