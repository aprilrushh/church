// 녹음 받아쓰기: 녹음 파일 → OpenAI 음성인식 → recordings.transcript 저장
const { readJson, send, getUser, rest, signedUrl } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST만 가능합니다.' });
  try {
    const auth = await getUser(req);
    if (!auth) return send(res, 401, { error: '로그인이 필요합니다.' });
    const { recording_id } = await readJson(req);
    const rows = await rest(auth.token, `recordings?id=eq.${encodeURIComponent(recording_id)}&select=id,audio_path,memorial_id`);
    if (!rows || !rows.length) return send(res, 404, { error: '녹음을 찾을 수 없습니다.' });
    const rec = rows[0];

    const url = await signedUrl(auth.token, rec.audio_path);
    const audio = await fetch(url);
    if (!audio.ok) return send(res, 400, { error: '녹음 파일을 불러오지 못했습니다.' });
    const buf = Buffer.from(await audio.arrayBuffer());

    const key = process.env.OPENAI_API_KEY;
    if (!key) return send(res, 500, { error: 'OPENAI_API_KEY가 설정되지 않았습니다.' });
    const fd = new FormData();
    const name = rec.audio_path.split('/').pop() || 'audio.webm';
    fd.append('file', new Blob([buf], { type: audio.headers.get('content-type') || 'audio/webm' }), name);
    fd.append('model', process.env.OPENAI_STT_MODEL || 'whisper-1');
    fd.append('language', 'ko');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd
    });
    const j = await r.json();
    if (!r.ok) return send(res, 502, { error: `음성인식 오류: ${j.error?.message || r.status}` });

    // 편집 권한이 없으면 RLS가 막아서 저장되지 않음
    await rest(auth.token, `recordings?id=eq.${rec.id}`, { method: 'PATCH', body: JSON.stringify({ transcript: j.text }) });
    return send(res, 200, { transcript: j.text });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
