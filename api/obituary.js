// 부고장 읽기: 사진/PDF → AI가 고인 정보·상주·장례 일정을 뽑아 양식에 채울 값으로 돌려줌 (저장은 가족이 확인 후)
const { readJson, send, getUser, extractJson } = require('./_lib');

const SYSTEM = `당신은 한국 교회 부고장(부고 문자, 부고 카드)을 읽는 도우미입니다.
이미지/문서에 실제로 적힌 내용만 옮깁니다. 적혀 있지 않은 값은 빈 문자열로 둡니다. 추측하지 않습니다.
날짜는 YYYY-MM-DD 형식으로(연도가 없으면 빈 문자열). '별세','소천','영면' 날짜는 death_date. 나이만 있고 생년월일이 없으면 birth_date는 빈 문자열. 이름 앞의 '故'는 빼고 name에 넣습니다. 직분은 '권사','장로','집사','성도' 등 부고에 적힌 그대로.
출력은 JSON 하나만:
{"name":"","title":"","birth_date":"","death_date":"","hometown":"",
 "chief_mourners":"상주·유족을 관계와 함께 한 줄씩 (예: 장남 홍길동). '홍길동의 모친'처럼 적혀 있으면 '자녀 홍길동'으로",
 "funeral_info":"빈소(주소 포함), 입관, 발인(장례예배), 장지, 연락처, 마음 전하실 곳(계좌) 등 적힌 항목을 '항목: 내용' 형태로 한 줄씩",
 "verse":"","verse_ref":""}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST만 가능합니다.' });
  try {
    const auth = await getUser(req);
    if (!auth) return send(res, 401, { error: '로그인이 필요합니다.' });
    const { data, media_type } = await readJson(req);
    if (!data || !media_type) return send(res, 400, { error: '부고장 파일이 없습니다.' });
    const isPdf = media_type === 'application/pdf';
    if (!isPdf && !/^image\/(jpeg|png|gif|webp)$/.test(media_type)) return send(res, 400, { error: '사진(JPG/PNG) 또는 PDF만 가능합니다.' });
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return send(res, 500, { error: 'AI 키가 설정되지 않았습니다.' });
    const block = isPdf
      ? { type: 'document', source: { type: 'base64', media_type, data } }
      : { type: 'image', source: { type: 'base64', media_type, data } };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5', max_tokens: 1500, system: SYSTEM,
        messages: [{ role: 'user', content: [block, { type: 'text', text: '이 부고장의 내용을 JSON으로 정리해 주세요.' }] }]
      })
    });
    const j = await r.json();
    if (!r.ok) return send(res, 502, { error: `AI 오류: ${j.error?.message || r.status}` });
    const text = (j.content || []).map(c => c.text || '').join('');
    return send(res, 200, extractJson(text));
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
