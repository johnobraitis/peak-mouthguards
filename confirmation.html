// api/stripe/checkout.js
// Creates a Stripe Checkout session and returns the URL
// Called when customer clicks "Proceed to payment" on product.html

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  standard: 'price_1TiT8nlxt6wPsnrz4hC5ymGB',
  logo:     'price_1TiT9Alxt6wPsnrz8QZfUEQC'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    option, color, sport, notes,
    first_name, last_name, email, phone,
    addr_line1, addr_line2, city, state, zip, country
  } = req.body;

  if (!option || !color || !email || !first_name || !last_name || !addr_line1 || !city || !state || !zip) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const priceId = PRICE_IDS[option];
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid option' });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      payment_method_types: ['card'],

      // Store all order details in metadata — webhook reads these to create the order
      metadata: {
        option, color, sport: sport || '', notes: notes || '',
        first_name, last_name, email, phone: phone || '',
        addr_line1, addr_line2: addr_line2 || '',
        city, state, zip, country: country || 'US'
      },

      success_url: `${siteUrl}/confirmation.html?order={ORDER_NUMBER}&email=${encodeURIComponent(email)}&option=${option}&color=${color}&name=${encodeURIComponent(first_name + ' ' + last_name)}&addr1=${encodeURIComponent(addr_line1)}&city=${encodeURIComponent(city)}&state=${state}&zip=${zip}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/product.html`,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session', detail: err.message });
  }
}
