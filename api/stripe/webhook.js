// api/stripe/webhook.js
// Stripe calls this automatically after a successful payment
// It creates the order in Supabase and sends the confirmation email

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendConfirmationEmail } from '../lib/email.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Required: tell Vercel not to parse the body — Stripe needs the raw bytes to verify signature
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // Only handle successful payments
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata;

  try {
    // 1. Upsert customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert(
        {
          first_name: meta.first_name,
          last_name:  meta.last_name,
          email:      meta.email,
          phone:      meta.phone || null,
          addr_line1: meta.addr_line1,
          addr_line2: meta.addr_line2 || null,
          city:       meta.city,
          state:      meta.state,
          zip:        meta.zip,
          country:    meta.country || 'US'
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (customerError) throw customerError;

    // 2. Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id:    customer.id,
        order_number:   '',
        stage:          1,
        option:         meta.option,
        color:          meta.color,
        amount_cents:   session.amount_total,
        payment_method: 'stripe',
        payment_id:     session.id,
        logo_requested: meta.option === 'logo',
        sport:          meta.sport || null,
        notes:          meta.notes || null
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 3. Log initial event
    await supabase.from('order_events').insert({
      order_id:   order.id,
      from_stage: null,
      to_stage:   1,
      changed_by: 'admin',
      note:       'Order created via Stripe payment'
    });

    // 4. Send confirmation email
    await sendConfirmationEmail({
      to:           meta.email,
      first_name:   meta.first_name,
      order_number: order.order_number,
      option:       meta.option,
      color:        meta.color,
      amount_cents: session.amount_total,
      addr_line1:   meta.addr_line1,
      city:         meta.city,
      state:        meta.state,
      zip:          meta.zip
    });

    console.log(`Order ${order.order_number} created for ${meta.email}`);
    return res.status(200).json({ received: true, order_number: order.order_number });

  } catch (err) {
    console.error('Webhook processing error:', err);
    // Still return 200 to Stripe so it doesn't retry — log the error for investigation
    return res.status(200).json({ received: true, error: err.message });
  }
}
