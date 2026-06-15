// api/orders/[orderNumber].js
// Used by track.html to fetch live order data
// Public endpoint — returns order + customer name + event history

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderNumber } = req.query;

  if (!orderNumber) {
    return res.status(400).json({ error: 'Order number required' });
  }

  try {
    // Fetch order with customer join
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        stage,
        option,
        color,
        logo_requested,
        sport,
        impression_flagged,
        usps_tracking_number,
        stage_updated_at,
        created_at,
        customers (
          first_name,
          last_name,
          email
        )
      `)
      .eq('order_number', orderNumber.toUpperCase())
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Fetch event history
    const { data: events } = await supabase
      .from('order_events')
      .select('from_stage, to_stage, changed_by, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    return res.status(200).json({
      order_number:         order.order_number,
      stage:                order.stage,
      option:               order.option,
      color:                order.color,
      logo_requested:       order.logo_requested,
      sport:                order.sport,
      impression_flagged:   order.impression_flagged,
      usps_tracking_number: order.usps_tracking_number,
      stage_updated_at:     order.stage_updated_at,
      created_at:           order.created_at,
      customer_name:        `${order.customers.first_name} ${order.customers.last_name}`,
      events:               events || []
    });

  } catch (err) {
    console.error('Get order error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
