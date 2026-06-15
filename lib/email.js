// lib/email.js
// Sends transactional emails via Resend (resend.com)
// Two email types: order confirmation and stage update

const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'Peak Mouthguards <onboarding@resend.dev>';

const STAGE_MESSAGES = {
  1: {
    subject: 'Your impression kit is on its way — Peak Mouthguards',
    body: (name, orderNum) => `
      <p>Hi ${name},</p>
      <p>Your impression kit has been packed and is headed your way via USPS. It usually arrives within 2–3 business days.</p>
      <p>Once it arrives, follow the included instruction card — the whole process takes about 5 minutes.</p>
      <p>Track your order anytime at:<br>
      <a href="https://peakmouthguards.com/track.html?order=${orderNum}">peakmouthguards.com/track — ${orderNum}</a></p>
    `
  },
  2: {
    subject: 'Your kit has arrived — time to take your impression',
    body: (name, orderNum) => `
      <p>Hi ${name},</p>
      <p>Your impression kit should be with you now. When you're ready, follow the instruction card inside — it takes about 5 minutes.</p>
      <p>Once you've taken your impression, seal it in the prepaid return envelope and drop it at any USPS location.</p>
      <p>Then confirm you've sent it on your tracking page:<br>
      <a href="https://peakmouthguards.com/track.html?order=${orderNum}">Track order ${orderNum}</a></p>
      <p>Need help? Check our <a href="https://peakmouthguards.com/guide.html">step-by-step impression guide</a> or reply to this email.</p>
    `
  },
  3: {
    subject: "We've received your impression — fabrication starting soon",
    body: (name, orderNum) => `
      <p>Hi ${name},</p>
      <p>Great news — we've received your impression and it's been quality-checked. Your custom guard will move into fabrication shortly.</p>
      <p>Fabrication takes 3–5 business days. We'll email you again the moment your guard ships.</p>
      <p><a href="https://peakmouthguards.com/track.html?order=${orderNum}">Track order ${orderNum}</a></p>
    `
  },
  4: {
    subject: 'Your guard is being made — Peak Mouthguards',
    body: (name, orderNum) => `
      <p>Hi ${name},</p>
      <p>Your custom mouthguard is now in fabrication at our workshop in Irvine, CA. We handcraft every guard from your exact impression.</p>
      <p>This stage takes 3–5 business days. You'll get a shipping notification with a USPS tracking number as soon as it's done.</p>
      <p><a href="https://peakmouthguards.com/track.html?order=${orderNum}">Track order ${orderNum}</a></p>
    `
  },
  5: {
    subject: 'Your Peak guard has shipped!',
    body: (name, orderNum, tracking) => `
      <p>Hi ${name},</p>
      <p>Your custom mouthguard is on its way! Expect delivery within 2–3 business days.</p>
      ${tracking ? `<p><strong>USPS Tracking:</strong> <a href="https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}">${tracking}</a></p>` : ''}
      <p><a href="https://peakmouthguards.com/track.html?order=${orderNum}">Track order ${orderNum}</a></p>
      <p>Thanks for choosing Peak Mouthguards. Protect your smile — perform at your peak.</p>
      <p>— The Peak Team · Irvine, CA</p>
    `
  }
};

async function sendEmail({ to, subject, html }) {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html: wrapEmail(html)
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }

  return res.json();
}

function wrapEmail(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#F4F4F4;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;">
            <tr>
              <td style="background:#0A0A0A;padding:20px 32px;">
                <span style="font-size:20px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#ffffff;">
                  PEAK<span style="color:#D0021B;">.</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-size:14px;line-height:1.7;color:#444444;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="background:#F4F4F4;padding:20px 32px;font-size:11px;color:#999999;text-align:center;">
                Peak Mouthguards · Irvine, CA · <a href="https://peakmouthguards.com" style="color:#D0021B;">peakmouthguards.com</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

// Sends confirmation email right after purchase
export async function sendConfirmationEmail({ to, first_name, order_number, option, color, amount_cents, addr_line1, city, state, zip }) {
  const total = (amount_cents / 100).toFixed(2);
  const optLabel = option === 'logo' ? 'Custom logo guard' : 'Standard guard';
  const colorLabel = color.charAt(0).toUpperCase() + color.slice(1);

  const html = `
    <p>Hi ${first_name},</p>
    <p>Your order is confirmed. We'll ship your impression kit within 24 hours.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#999;font-size:12px;">Order ID</td><td style="padding:8px 0;font-weight:700;color:#D0021B;font-size:16px;">${order_number}</td></tr>
      <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#999;font-size:12px;">Guard</td><td style="padding:8px 0;">${optLabel} — ${colorLabel}</td></tr>
      <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#999;font-size:12px;">Shipping to</td><td style="padding:8px 0;">${addr_line1}, ${city}, ${state} ${zip}</td></tr>
      <tr><td style="padding:8px 0;color:#999;font-size:12px;">Total charged</td><td style="padding:8px 0;font-weight:700;">$${total}</td></tr>
    </table>
    <p><strong>What happens next:</strong></p>
    <ol style="padding-left:20px;line-height:2;">
      <li>Your impression kit ships within 24 hours</li>
      <li>Take your impression at home (5 minutes, instructions included)</li>
      <li>Mail it back in the prepaid envelope</li>
      <li>We fabricate and ship your guard in 3–5 business days</li>
    </ol>
    ${option === 'logo' ? `<p><strong>Logo add-on:</strong> Email your JPG or PNG to <a href="mailto:hello@peakmouthguards.com">hello@peakmouthguards.com</a> with subject line <strong>${order_number}</strong>.</p>` : ''}
    <p style="margin-top:24px;">
      <a href="https://peakmouthguards.com/track.html?order=${order_number}" 
         style="background:#D0021B;color:#fff;padding:12px 24px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">
        Track your order →
      </a>
    </p>
  `;

  return sendEmail({
    to,
    subject: `Order confirmed — ${order_number} — Peak Mouthguards`,
    html
  });
}

// Sends stage update email when order advances
export async function sendStageEmail({ to, first_name, order_number, stage, stage_name, tracking }) {
  const template = STAGE_MESSAGES[stage];
  if (!template) return; // No email for unknown stages

  return sendEmail({
    to,
    subject: template.subject,
    html:    template.body(first_name, order_number, tracking)
  });
}
