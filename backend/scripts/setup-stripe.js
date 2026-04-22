import Stripe from 'stripe';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

async function setup() {
  try {
    console.log('Creating Stripe Products & Prices...');

    // Starter Plan
    const starterProduct = await stripe.products.create({
      name: 'Starter Plan',
      description: 'Monthly active full systems stability.',
    });
    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 1000 * 100, // Stripe handles lowest denominator (e.g. paisa/cents)
      currency: 'pkr',
      recurring: { interval: 'month' },
    });

    // Starter Pro Plus Plan
    const proProduct = await stripe.products.create({
      name: 'Starter Pro Plus Plan',
      description: 'Advanced features, API + Webhooks access.',
    });
    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 2000 * 100,
      currency: 'pkr',
      recurring: { interval: 'month' },
    });

    console.log(`✅ Starter Product: ${starterProduct.id}`);
    console.log(`✅ Starter Price: ${starterPrice.id}`);
    console.log(`✅ Starter Pro Plus Product: ${proProduct.id}`);
    console.log(`✅ Starter Pro Plus Price: ${proPrice.id}`);

    console.log('\\n[!] Add the following Price IDs to your implementation code:');
    console.log(`STARTER_PRICE_ID="${starterPrice.id}"`);
    console.log(`STARTER_PRO_PLUS_PRICE_ID="${proPrice.id}"`);
    
  } catch (error) {
    console.error('Error setting up Stripe:', error);
  }
}

setup();
