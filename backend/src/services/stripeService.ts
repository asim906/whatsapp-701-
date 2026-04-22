import Stripe from 'stripe';

export const STRIPE_PRICES = {
  starter: process.env.STARTER_PRICE_ID || "price_1TOsj6Lk5rZwPf2ZLWDx9JEd",
  starter_pro: process.env.STARTER_PRO_PLUS_PRICE_ID || "price_1TOsj8Lk5rZwPf2ZWiSrqge2"
};

export class StripeService {
  /**
   * Creates a Stripe Checkout Session for a given user and plan.
   */
  static async createCheckoutSession(userId: string, email: string, planId: 'starter' | 'starter_pro') {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_123', {
      apiVersion: '2023-10-16',
    });

    const priceId = STRIPE_PRICES[planId];
    
    if (!priceId) {
      throw new Error(`Invalid plan ID or missing price ID for ${planId}`);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      client_reference_id: userId, // CRITICAL: This ties the Stripe Checkout back to our Firebase User
      subscription_data: {
        metadata: {
          planId: planId,
          userId: userId
        }
      },
      success_url: `http://localhost:3000/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `http://localhost:3000/pricing?canceled=true`,
    });

    return session;
  }
}
