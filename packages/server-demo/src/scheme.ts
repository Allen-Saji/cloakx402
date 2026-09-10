import { EERC_DECIMALS, FUJI } from "@cloakx402/eerc";
import type {
  AssetAmount,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
  SupportedKind,
} from "@x402/core/types";

export const SCHEME = "eerc-exact";

/**
 * Resource-server side of the eerc-exact scheme: prices routes in the
 * eERC-wrapped token and forwards the facilitator's advertised contract
 * addresses to clients via requirements.extra.
 */
export class EercExactServer implements SchemeNetworkServer {
  readonly scheme = SCHEME;

  async parsePrice(price: Price, _network: Network): Promise<AssetAmount> {
    if (typeof price === "object") return price;
    const numeric =
      typeof price === "string"
        ? Number.parseFloat(price.replace(/^\$/, ""))
        : price;
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`cannot parse price: ${String(price)}`);
    }
    return {
      amount: BigInt(Math.round(numeric * 10 ** EERC_DECIMALS)).toString(),
      asset: FUJI.encryptedERC,
    };
  }

  getAssetDecimals(_asset: string, _network: Network): number {
    return EERC_DECIMALS;
  }

  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: SupportedKind,
    _facilitatorExtensions: string[],
  ): Promise<PaymentRequirements> {
    return {
      ...paymentRequirements,
      extra: {
        ...supportedKind.extra,
        ...paymentRequirements.extra,
      },
    };
  }
}
