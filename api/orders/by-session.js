// api/orders/by-session.js
// Called by confirmation page to get the real order number from a Stripe session ID
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: 'session_id required' });
  }

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('order_number, stage, option, color, amount_cents, customers(first_name, last_name, email, addr_line1, city, state, zip)')
      .eq('payment_id', session_id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({
      order_number: order.order_number,
      option:       order.option,
      color:        order.color,
      amount_cents: order.amount_cents,
      name:         `${order.customers.first_name} ${order.customers.last_name}`,
      email:        order.customers.email,
      addr_line1:   order.customers.addr_line1,
      city:         order.customers.city,
      state:        order.customers.state,
      zip:          order.customers.zip,
    });

  } catch (err) {
    console.error('By-session error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
