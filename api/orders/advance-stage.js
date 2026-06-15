// api/orders/advance-stage.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const STAGE_NAMES = {
  1: 'Kit dispatched',
  2: 'Kit delivered',
  3: 'Impression received',
  4: 'In fabrication',
  5: 'Guard shipped'
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { order_number, to_stage, changed_by, note, usps_tracking_number } = req.body;

  if (!order_number || !to_stage || !changed_by) {
    return res.status(400).json({ error: 'order_number, to_stage, and changed_by are required' });
  }

  if (to_stage < 1 || to_stage > 5) {
    return res.status(400).json({ error: 'Stage must be between 1 and 5' });
  }

  try {
    // Fetch current order + customer email
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`id, stage, order_number, option, color, usps_tracking_number, customers ( first_name, email )`)
      .eq('order_number', order_number.toUpperCase())
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const from_stage = order.stage;

    // Build update payload
    const updatePayload = { stage: to_stage };
    if (usps_tracking_number) {
      updatePayload.usps_tracking_number = usps_tracking_number;
    }

    // Update order stage
    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateError) throw updateError;

    // Log the event
    await supabase.from('order_events').insert({
      order_id:   order.id,
      from_stage,
      to_stage,
      changed_by,
      note: note || null
    });

    return res.status(200).json({ success: true, from_stage, to_stage, order_number });

  } catch (err) {
    console.error('Advance stage error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
