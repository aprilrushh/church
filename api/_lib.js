// 공용 도우미: Supabase 사용자 확인 + REST 호출(사용자 토큰으로 → RLS 권한 그대로 적용)
const SB = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !SB || !ANON) return null;
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const user = await r.json();
  return { user, token };
}

async function rest(token, path, opts = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      Prefer: 'return=representation', ...(opts.headers || {})
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`DB ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signedUrl(token, path) {
  const r = await fetch(`${SB}/storage/v1/object/sign/memorial-media/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 })
  });
  if (!r.ok) throw new Error('파일 접근 권한이 없습니다.');
  const j = await r.json();
  return `${SB}/storage/v1${j.signedURL}`;
}

async function claude(system, user, maxTokens = 4000) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user }]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`AI 오류: ${j.error?.message || r.status}`);
  return j.content.map(c => c.text || '').join('');
}

function extractJson(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return JSON.parse(m ? m[1] : text);
}

module.exports = { readJson, send, getUser, rest, signedUrl, claude, extractJson };
