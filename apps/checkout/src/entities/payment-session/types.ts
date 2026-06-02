/**
 * Composite view-model for the checkout shell. Pairs the public session DTO
 * with the methods the buyer can pick. The shape lives in `entities/`
 * because both widgets and the page-level composition consume it; promoting
 * it to a shared concept keeps cross-feature reuse honest (FSD §5.2).
 */
import type {
  AvailablePaymentMethod,
  PublicCheckoutSession,
} from "@payins/types";

export interface CheckoutView {
  readonly session: PublicCheckoutSession;
  readonly methods: readonly AvailablePaymentMethod[];
}
