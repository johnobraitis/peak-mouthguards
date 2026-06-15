// api/orders/advance-stage.js
// Called by admin dashboard (advance button) and customer tracker
// (impression confirmation button). Updates stage and logs the event.
// Also triggers a stage-update email to the customer.

import { createClient } from '@supabase/supabase-js';
import { sendStageEmail } from '../lib/email.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { order_number, to_stage, changed_by, note, usps_tracking_number } = req.body;

  if (!order_number || !to_stage || !changed_by) {
    return res.status(400).json({ error: 'order_number, to_stage, and changed_by are required' });
  }

  // Validate changed_by
  if (!['admin', 'customer'].includes(changed_by)) {
    return res.status(400).json({ error: 'changed_by must be "admin" or "customer"' });
  }

  // Validate stage range
  if (to_stage < 1 || to_stage > 5) {
    return res.status(400).json({ error: 'Stage must be between 1 and 5' });
  }

  try {
    // 1. Fetch current order + customer email
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id, stage, order_number, option, color,
        usps_tracking_number,
        customers ( first_name, email )
      `)
      .eq('order_number', order_number.toUpperCase())
      .single();

    if (fetchError || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const from_stage = order.stage;

    // 2. Build update payload
    const updatePayload = { stage: to_stage };
    if (usps_tracking_number) {
      updatePayload.usps_tracking_number = usps_tracking_number;
    }

    // 3. Update order stage
    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateError) throw updateError;

    // 4. Log the event
    await supabase.from('order_events').insert({
      order_id:   order.id,
      from_stage,
      to_stage,
      changed_by,
      note:       note || null
    });

    // 5. Send stage update email to customer
    try {
      await sendStageEmail({
        to:           order.customers.email,
        first_name:   order.customers.first_name,
        order_number: order.order_number,
        stage:        to_stage,
        stage_name:   STAGE_NAMES[to_stage],
        tracking:     usps_tracking_number || order.usps_tracking_number || null
      });
    } catch (emailErr) {
      // Don't fail the whole request if email fails — log and continue
      console.error('Stage email failed:', emailErr);
    }

    return res.status(200).json({
      success:    true,
      from_stage,
      to_stage,
      order_number
    });

  } catch (err) {
    console.error('Advance stage error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
