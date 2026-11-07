// 전환 단계 측정: 개인정보 없이 단계명·익명 세션ID·유입경로만 기록
const SB = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const OK = /^[a-z_]{2,40}$/;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  try {
    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b || '{}');
    if (!b || typeof b !== 'object') { const chunks = []; for await (const c of req) chunks.push(c); b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
    const step = String(b.step || ''); if (!OK.test(step)) { res.statusCode = 400; return res.end(); }
    const row = { step, sid: String(b.sid || '').slice(0, 40), src: String(b.src || '').slice(0, 60), path: String(b.path || '').slice(0, 120) };
    await fetch(`${SB}/rest/v1/funnel_events`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) });
  } catch (e) {}
  res.statusCode = 204; res.end();
};
