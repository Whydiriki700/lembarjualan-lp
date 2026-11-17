// Vercel Serverless Function: meneruskan event LP ke Meta Conversions API (CAPI).
// Env yang wajib diisi di Vercel Project Settings:
//   META_PIXEL_ID    = ID pixel Meta
//   META_CAPI_TOKEN  = token akses CAPI dari Events Manager (jangan ditulis di kode)
// Env opsional:
//   META_TEST_EVENT_CODE = kode test event saat pengujian di Events Manager
//
// Event yang datang dari browser membawa event_id yang sama dengan event Pixel,
// jadi Meta mendeduplikasi keduanya di Events Manager.

const crypto = require('crypto');

function hashSha256(teks) {
  if (!teks) return undefined;
  return crypto.createHash('sha256').update(String(teks).trim().toLowerCase()).digest('hex');
}

function normalisasiHp(hp) {
  if (!hp) return '';
  let n = String(hp).replace(/[^0-9]/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return n;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) {
    // Belum dikonfigurasi: terima dan catat saja, jangan jatuhkan LP.
    res.status(202).json({ status: 'capi-belum-dikonfigurasi' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const userData = {
    client_ip_address: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined,
    client_user_agent: req.headers['user-agent'] || undefined,
    fbp: body.fbp || undefined,
    fbc: body.fbc || undefined,
    ph: body.phone ? [hashSha256(normalisasiHp(body.phone))] : undefined
  };

  const payload = {
    data: [{
      event_name: body.event_name || 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: body.event_id || undefined,
      event_source_url: body.event_source_url || undefined,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        value: body.value || 0,
        currency: body.currency || 'IDR',
        content_name: 'Paket Template LP Siap Pakai'
      }
    }]
  };
  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const r = await fetch(
      'https://graph.facebook.com/v21.0/' + pixelId + '/events?access_token=' + encodeURIComponent(token),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const hasil = await r.json();
    res.status(r.ok ? 200 : 502).json({ status: r.ok ? 'terkirim' : 'ditolak-meta', detail: hasil });
  } catch (err) {
    res.status(502).json({ status: 'gagal-kirim', error: String(err) });
  }
};
