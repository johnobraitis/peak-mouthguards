// api/orders/flag-impression.js
// Called from admin dashboard when an impression arrives with quality issues
// Sets impression_flagged = true and stores the admin's note

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { order_number, flagged, flag_note } = req.body;

  if (!order_number) {
    return res.status(400).json({ error: 'order_number required' });
  }

  try {
    const { error } = await supabase
      .from('orders')
      .update({
        impression_flagged:   flagged !== false,  // default true
        impression_flag_note: flag_note || null
      })
      .eq('order_number', order_number.toUpperCase());

    if (error) throw error;

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Flag impression error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
