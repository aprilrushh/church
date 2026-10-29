// 여쭤보기: 가족의 질문에 '생전 실제 녹음' 중 가장 맞는 것을 고름. 새 답을 만들지 않음.
const { readJson, send, getUser, rest, claude, extractJson } = require('./_lib');

const SYSTEM = `당신은 추모관의 녹음 검색기입니다. 질문과 녹음 목록(질문+받아쓰기)을 보고,
질문에 가장 잘 답하는 녹음 하나의 id를 고릅니다. 새로운 답변을 만들거나 고인의 말을 지어내지 않습니다.
맞는 녹음이 없으면 id는 null.
출력은 JSON 하나만: {"recording_id": "...", "why": "한 문장 이유"}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST만 가능합니다.' });
  try {
    const auth = await getUser(req);
    if (!auth) return send(res, 401, { error: '로그인이 필요합니다.' });
    const { memorial_id, question } = await readJson(req);
    if (!question || question.length > 300) return send(res, 400, { error: '질문을 300자 이내로 입력해 주세요.' });
    const recs = await rest(auth.token, `recordings?memorial_id=eq.${encodeURIComponent(memorial_id)}&transcript=not.is.null&select=id,question,transcript`);
    if (!recs.length) return send(res, 200, { recording_id: null, why: '아직 받아쓰기가 끝난 녹음이 없습니다.' });
    const list = recs.map(r => `[${r.id}] 질문: ${r.question}\n답변: ${r.transcript.slice(0, 1500)}`).join('\n\n');
    const out = extractJson(await claude(SYSTEM, `가족의 질문: ${question}\n\n녹음 목록:\n${list}`, 400));
    const hit = recs.find(r => r.id === out.recording_id);
    return send(res, 200, { recording_id: hit ? hit.id : null, why: out.why || '' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
