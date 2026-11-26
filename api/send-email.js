const SUPABASE_URL = 'https://ptomtfvwhhocaxgpvesg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9kIM2Vb-1qj9fHWytOj-ag_xc5hcQG0';

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

async function verifyNewsroomAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user || !user.email) return null;

  const roleRes = await fetch(
    `${SUPABASE_URL}/rest/v1/team_roles?select=role&email=eq.${encodeURIComponent(user.email)}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } }
  );
  if (!roleRes.ok) return null;
  const rows = await roleRes.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  const role = rows[0].role;
  if (role !== 'Admin' && role !== 'Moderator') return null;
  return { email: user.email, role };
}

async function sendResendEmail(apiKey, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.message || `Resend error ${r.status}`);
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'RESEND_API_KEY is not configured in Vercel Environment Variables.'
    });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'The Rise BD <onboarding@resend.dev>';
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = body.action;

  try {
    if (action === 'subscribe_welcome') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: 'Invalid email address' });
      }
      const topics = Array.isArray(body.topics) && body.topics.length ? body.topics.join(', ') : 'Latest Stories';
      const html = `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
          <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">THE RISE BD · NEWSLETTER</p>
          <h1 style="font-size:24px;margin:0 0 12px;">Welcome to The Rise BD.</h1>
          <p style="font-size:15px;line-height:1.6;color:#374151;">Thank you for subscribing to The Rise BD. Your selected topics: <strong>${escapeHtml(topics)}</strong>.</p>
          <p style="font-size:14px;line-height:1.6;color:#4b5563;">We publish reported journalism, researcher spotlights, and youth stories from across Bangladesh.</p>
          <p style="margin-top:20px;"><a href="https://therisebd.com" style="display:inline-block;padding:10px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-family:sans-serif;font-size:14px;">Visit therisebd.com</a></p>
        </div>`;

      const result = await sendResendEmail(apiKey, {
        from: fromEmail,
        to: [email],
        subject: 'Welcome to The Rise BD Newsletter',
        html
      });
      return res.status(200).json({ ok: true, id: result.id });
    }

    if (action === 'broadcast') {
      const member = await verifyNewsroomAuth(req.headers.authorization || '');
      if (!member) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: valid Newsroom Admin/Moderator session required.' });
      }

      const recipients = Array.isArray(body.recipients)
        ? body.recipients.map((e) => String(e || '').trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        : [];
      const subject = String(body.subject || '').trim();
      const headline = String(body.headline || '').trim();
      const message = String(body.body || '').trim();

      if (!recipients.length || !subject || !message) {
        return res.status(400).json({ ok: false, error: 'Recipients, subject, and body are required.' });
      }

      const html = `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
          <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">THE RISE BD · DISPATCH</p>
          ${headline ? `<h1 style="font-size:26px;line-height:1.25;margin:0 0 16px;">${escapeHtml(headline)}</h1>` : ''}
          <div style="font-size:16px;line-height:1.7;color:#1f2937;white-space:pre-line;">${escapeHtml(message)}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:12px;color:#6b7280;">Sent from The Rise BD Newsroom · <a href="https://therisebd.com" style="color:#111827;">therisebd.com</a></p>
        </div>`;

      const batchPayload = recipients.slice(0, 100).map((to) => ({
        from: fromEmail,
        to: [to],
        subject,
        html
      }));

      const batchRes = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchPayload)
      });
      const batchData = await batchRes.json().catch(() => ({}));
      if (!batchRes.ok) {
        throw new Error(batchData.message || `Resend batch error ${batchRes.status}`);
      }
      return res.status(200).json({ ok: true, sent: batchPayload.length, data: batchData });
    }

    if (action === 'interview_invite') {
      const member = await verifyNewsroomAuth(req.headers.authorization || '');
      if (!member) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: valid Newsroom session required.' });
      }
      const to = String(body.to || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return res.status(400).json({ ok: false, error: 'Valid applicant email is required.' });
      }
      const name = String(body.name || 'Applicant').trim();
      const role = String(body.role || 'Open Role').trim();
      const dateStr = String(body.date || '').trim();
      const timeStr = String(body.time || '').trim();
      const modeLink = String(body.location || '').trim();
      const note = String(body.note || '').trim();
      const subject = `Interview Invitation: ${role} — The Rise BD`;
      const html = `
        <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:24px;color:#111827;">
          <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">THE RISE BD · RECRUITMENT</p>
          <h1 style="font-size:24px;margin:0 0 12px;">Interview Invitation</h1>
          <p style="font-size:15px;line-height:1.6;color:#374151;">Dear <strong>${escapeHtml(name)}</strong>,</p>
          <p style="font-size:15px;line-height:1.6;color:#374151;">Thank you for applying for <strong>${escapeHtml(role)}</strong> at The Rise BD. We would like to invite you for an interview.</p>
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;margin:16px 0;font-family:sans-serif;font-size:14px;">
            ${dateStr ? `<p style="margin:4px 0;"><strong>Date:</strong> ${escapeHtml(dateStr)}</p>` : ''}
            ${timeStr ? `<p style="margin:4px 0;"><strong>Time:</strong> ${escapeHtml(timeStr)}</p>` : ''}
            ${modeLink ? `<p style="margin:4px 0;"><strong>Meeting Link / Location:</strong> ${escapeHtml(modeLink)}</p>` : ''}
          </div>
          ${note ? `<p style="font-size:14px;line-height:1.6;color:#374151;white-space:pre-line;">${escapeHtml(note)}</p>` : ''}
          <p style="font-size:13px;color:#6b7280;margin-top:20px;">Best regards,<br>The Rise BD Editorial &amp; Recruitment Desk</p>
        </div>`;

      const result = await sendResendEmail(apiKey, {
        from: fromEmail,
        to: [to],
        subject,
        html
      });
      return res.status(200).json({ ok: true, id: result.id });
    }

    if (action === 'contact_message') {
      const name = String(body.name || 'Visitor').trim();
      const visitorEmail = String(body.email || '').trim().toLowerCase();
      const msg = String(body.message || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail) || !msg) {
        return res.status(400).json({ ok: false, error: 'Valid email and message are required.' });
      }
      const inbox = process.env.CONTACT_INBOX_EMAIL || 'hello@therisebd.com';
      const html = `
        <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:24px;color:#111827;">
          <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin:0 0 8px;">THE RISE BD · CONTACT FORM</p>
          <h1 style="font-size:22px;margin:0 0 12px;">New Contact Message</h1>
          <p style="font-size:14px;color:#374151;"><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(visitorEmail)})</p>
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;margin:14px 0;font-size:15px;line-height:1.65;white-space:pre-line;">${escapeHtml(msg)}</div>
        </div>`;

      const result = await sendResendEmail(apiKey, {
        from: fromEmail,
        to: [inbox],
        reply_to: visitorEmail,
        subject: `Contact Message from ${name} — The Rise BD`,
        html
      });
      return res.status(200).json({ ok: true, id: result.id });
    }

    return res.status(400).json({ ok: false, error: 'Unsupported action' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err && err.message ? err.message : 'Email send failed' });
  }
};
