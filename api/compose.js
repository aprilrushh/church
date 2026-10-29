// 자서전 정리: 받아쓴 답변들 → AI가 '생애의 장' 초안으로 정리 (가족 확인 전까지 approved=false)
const { readJson, send, getUser, rest, claude, extractJson } = require('./_lib');

const SYSTEM = `당신은 교회가 운영하는 '디지털 추모관'의 기록 정리 도우미입니다.
어르신이 말로 답한 인터뷰 받아쓰기를 읽고, 가족이 읽을 '생애의 장' 초안을 만듭니다.
규칙:
- 받아쓰기에 있는 사실만 씁니다. 없는 사건, 날짜, 감정, 신앙 고백을 지어내지 않습니다.
- 3인칭 존댓말 서술(예: "~하셨습니다"). 한 장의 본문은 2~5문장.
- 연도/시기가 분명하지 않으면 period는 빈 문자열.
- 각 장마다 근거가 된 녹음의 id를 recording_id에 넣습니다.
- 시간 순서대로 정렬합니다.
출력은 JSON 하나만: {"chapters":[{"period":"","title":"","body":"","recording_id":""}]}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST만 가능합니다.' });
  try {
    const auth = await getUser(req);
    if (!auth) return send(res, 401, { error: '로그인이 필요합니다.' });
    const { memorial_id } = await readJson(req);
    const m = await rest(auth.token, `memorials?id=eq.${encodeURIComponent(memorial_id)}&select=id,name,title,birth_date,hometown`);
    if (!m || !m.length) return send(res, 404, { error: '추모관을 찾을 수 없습니다.' });
    const recs = await rest(auth.token, `recordings?memorial_id=eq.${encodeURIComponent(memorial_id)}&transcript=not.is.null&select=id,question,transcript,recorded_on&order=created_at`);
    if (!recs.length) return send(res, 400, { error: '받아쓰기가 끝난 녹음이 없습니다. 먼저 녹음을 받아쓰기 해 주세요.' });

    const person = m[0];
    const input = `인물: ${person.name} ${person.title || ''} / 출생: ${person.birth_date || '미상'} / 고향: ${person.hometown || '미상'}\n\n` +
      recs.map(r => `[녹음 ${r.id}] 질문: ${r.question}\n답변: ${r.transcript}`).join('\n\n');
    const out = extractJson(await claude(SYSTEM, input, 6000));
    const ids = new Set(recs.map(r => r.id));
    const rows = (out.chapters || []).map((c, i) => ({
      memorial_id, period: c.period || null, title: String(c.title || '').slice(0, 120),
      body: c.body || '', recording_id: ids.has(c.recording_id) ? c.recording_id : null,
      sort: 100 + i, approved: false
    })).filter(c => c.title);
    if (!rows.length) return send(res, 500, { error: 'AI가 장을 만들지 못했습니다. 다시 시도해 주세요.' });
    const saved = await rest(auth.token, 'chapters', { method: 'POST', body: JSON.stringify(rows) });
    return send(res, 200, { chapters: saved });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
