// api/stripe/webhook.js
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { sendConfirmationEmail } = require('../../lib/email.js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports.config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
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

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const meta = session.metadata;

  try {
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

    await supabase.from('order_events').insert({
      order_id:   order.id,
      from_stage: null,
      to_stage:   1,
      changed_by: 'admin',
      note:       'Order created via Stripe payment'
    });

    // Send confirmation email
    try {
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
      console.log(`Confirmation email sent to ${meta.email}`);
    } catch (emailErr) {
      console.error('Confirmation email failed:', emailErr.message);
    }

    console.log(`Order ${order.order_number} created for ${meta.email}`);
    return res.status(200).json({ received: true, order_number: order.order_number });

  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(200).json({ received: true, error: err.message });
  }
};
