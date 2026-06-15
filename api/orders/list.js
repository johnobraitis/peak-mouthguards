// api/orders/list.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { stage, search } = req.query;

  try {
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, stage, option, color, amount_cents,
        payment_method, logo_requested, logo_received, sport, notes,
        impression_flagged, impression_flag_note, usps_tracking_number,
        stage_updated_at, created_at,
        customers ( first_name, last_name, email, phone, addr_line1, addr_line2, city, state, zip, country )
      `)
      .order('created_at', { ascending: false });

    if (stage && stage !== 'all') {
      query = query.eq('stage', parseInt(stage));
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    let results = orders || [];
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        `${o.customers.first_name} ${o.customers.last_name}`.toLowerCase().includes(q) ||
        o.customers.email.toLowerCase().includes(q)
      );
    }

    const now = new Date();
    results = results.map(o => ({
      ...o,
      days_in_stage: Math.floor((now - new Date(o.stage_updated_at)) / (1000 * 60 * 60 * 24))
    }));

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (orders || []).forEach(o => { counts[o.stage] = (counts[o.stage] || 0) + 1; });

    return res.status(200).json({ orders: results, total: orders?.length || 0, counts });

  } catch (err) {
    console.error('List orders error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
