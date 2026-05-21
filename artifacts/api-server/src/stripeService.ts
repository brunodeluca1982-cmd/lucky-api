import { getUncachableStripeClient } from "./stripeClient.js";
import { logger } from "./lib/logger.js";

/**
 * StripeService — thin wrapper around the Stripe API for write operations.
 * Read operations use the PostgreSQL stripe schema via storage.ts.
 */
export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.customers.create({ email, metadata: { userId } });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    customerEmail?: string,
  ) {
    const stripe = await getUncachableStripeClient();
    const payload = {
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      payment_method_collection: "if_required",
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customerEmail && !customerId ? { customer_email: customerEmail } : {}),
    };
    logger.info({ payload }, "createCheckoutSession payload");
    return stripe.checkout.sessions.create(payload);
  }

  async createCheckoutSessionForNewCustomer(
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const stripe = await getUncachableStripeClient();
    return stripe.checkout.sessions.create({
      customer_email: email,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      payment_method_collection: "if_required",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }
}

export const stripeService = new StripeService();
