// 공개 모바일 부고장: /b/{id} → 서버에서 HTML 생성(카톡 미리보기용 OG 태그 포함)
const SB = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${y}년 ${+m}월 ${+dd}일`; };
const nl = s => esc(s).replace(/\n/g, '<br>');
const FLOWER = `<svg viewBox="0 0 120 120" width="64" height="64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2">${Array.from({length:12},(_,i)=>`<ellipse cx="60" cy="38" rx="7" ry="22" transform="rotate(${i*30} 60 60)"/>`).join('')}<circle cx="60" cy="60" r="7"/></svg>`;

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '').replace(/[^0-9a-f-]/gi, '').slice(0, 36);
  let o = null;
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/get_obituary`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mid: id }) });
    if (r.ok) o = await r.json();
  } catch (e) {}
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!o) { res.statusCode = 404; return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>부고장을 찾을 수 없습니다</title><body style="font-family:sans-serif;text-align:center;padding:60px 20px;color:#444">부고장을 찾을 수 없습니다.<br>링크를 다시 확인해 주세요.<p><a href="/memorial/obituary/">무료 모바일 부고장 만들기</a></p>`); }
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  const christian = o.style !== 'general';
  const nm = `故 ${o.name}${o.title ? ' ' + o.title : ''}`;
  const verb = christian ? '소천' : '별세';
  const msg = o.message || `${nm}님께서 ${o.death_date ? ymd(o.death_date) + '에 ' : ''}${christian ? '하나님의 부르심을 받아 소천하셨기에' : '별세하셨기에'} 삼가 알려 드립니다.`;
  const age = o.birth_date && o.death_date ? Math.floor((new Date(o.death_date) - new Date(o.birth_date)) / 31557600000) : null;
  const portrait = o.portrait ? `${SB}/storage/v1/object/public/obit-public/${o.portrait}` : '';
  const url = `https://chunchurch.com/b/${o.id}`;
  const ogimg = portrait || 'https://chunchurch.com/memorial/obit-og.png';
  const tel = (o.contact || '').match(/0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/);
  const comforts = (o.comforts || []).slice(0, 30);
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>[부고] ${esc(nm)}님 ${verb}</title><meta name="robots" content="noindex">
<meta property="og:type" content="website"><meta property="og:url" content="${url}">
<meta property="og:title" content="[부고] ${esc(nm)}님께서 ${verb}하셨습니다">
<meta property="og:description" content="${esc((o.chief_mourners || '').split('\n')[0] || '삼가 고인의 명복을 빕니다')} · 빈소와 발인 안내">
<meta property="og:image" content="${esc(ogimg)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap">
<style>
:root{--bg:#efede8;--paper:#fdfcfa;--ink:#2a2724;--muted:#6f6860;--line:#e3ddd3;--gold:#9a8457;--accent:#3b4a47}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.8 "Noto Sans KR",system-ui,sans-serif;word-break:keep-all;overflow-wrap:anywhere}
.card{max-width:520px;margin:0 auto;background:var(--paper);min-height:100vh;padding:36px 22px 40px;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.top{text-align:center;color:var(--gold)}.top h1{font:700 30px "Nanum Myeongjo",serif;letter-spacing:.5em;margin:8px 0 2px;color:var(--ink);padding-left:.5em}
.top .sub{font:400 15px "Nanum Myeongjo",serif;color:var(--muted)}
.frame{width:160px;margin:26px auto 18px;padding:8px;border:1px solid var(--gold);border-radius:80px 80px 2px 2px}
.frame img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:72px 72px 0 0;filter:grayscale(.15)}
.name{text-align:center;font:700 26px "Nanum Myeongjo",serif;letter-spacing:.08em}.name small{font-size:16px;color:var(--muted);font-weight:400}
.dates{text-align:center;color:var(--muted);font-size:14px}
.msg{margin:22px 0;padding:18px 4px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);text-align:center;font:400 16px/1.95 "Nanum Myeongjo",serif}
.verse{text-align:center;color:var(--muted);font:400 14px/1.8 "Nanum Myeongjo",serif;margin-bottom:18px}
dl{margin:0}dl div{display:grid;grid-template-columns:92px 1fr;gap:8px;padding:12px 0;border-bottom:1px dashed var(--line)}
dt{color:var(--gold);font-weight:700;font-size:14px}dd{margin:0;white-space:pre-line}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0}
.btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:13px 10px;border-radius:999px;border:1px solid var(--line);background:var(--paper);color:var(--accent);font-family:inherit;font-size:15px;font-weight:500;text-decoration:none;cursor:pointer}
.btn.p{background:var(--accent);color:#fff;border-color:var(--accent)}
.sec{margin-top:30px;text-align:center;font:700 18px "Nanum Myeongjo",serif;letter-spacing:.2em}
.c{background:#f7f5f1;border:1px solid var(--line);padding:14px 16px;margin-top:10px}.c p{margin:0;font-family:"Nanum Myeongjo",serif}.c small{display:block;text-align:right;color:var(--muted);margin-top:6px}
.foot{margin-top:34px;text-align:center;font-size:13px;color:var(--muted)}.foot a{color:var(--accent)}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#2a2724;color:#fff;padding:10px 18px;border-radius:999px;font-size:14px}
</style></head><body><main class="card">
<div class="top">${FLOWER}<h1>訃告</h1><div class="sub">삼가 고인의 명복을 빕니다</div></div>
${portrait ? `<div class="frame"><img src="${esc(portrait)}" alt="${esc(o.name)}님 영정"></div>` : '<div style="height:22px"></div>'}
<div class="name">${esc(nm)}</div>
<div class="dates">${o.birth_date ? ymd(o.birth_date) + ' — ' : ''}${ymd(o.death_date)}${age ? ` · 향년 ${age}세` : ''}</div>
<div class="msg">${nl(msg)}</div>
${o.verse ? `<div class="verse">"${esc(o.verse)}"<br>${esc(o.verse_ref || '')}</div>` : ''}
<dl>
${o.chief_mourners ? `<div><dt>상주 · 유족</dt><dd>${esc(o.chief_mourners)}</dd></div>` : ''}
${o.place ? `<div><dt>빈소</dt><dd>${esc(o.place)}</dd></div>` : ''}
${o.funeral_info ? `<div><dt>장례 일정</dt><dd>${esc(o.funeral_info)}</dd></div>` : ''}
${o.contact ? `<div><dt>연락처</dt><dd>${esc(o.contact)}</dd></div>` : ''}
${o.account ? `<div><dt>마음 전하실 곳</dt><dd>${esc(o.account)} <button class="btn" style="display:inline-flex;padding:4px 12px;font-size:13px" onclick="cp(${JSON.stringify(o.account).replace(/"/g, '&quot;')})">복사</button></dd></div>` : ''}
</dl>
<div class="btns">
${o.place ? `<a class="btn" href="https://map.kakao.com/link/search/${encodeURIComponent(o.place)}" target="_blank" rel="noopener">빈소 길찾기</a>` : ''}
${tel ? `<a class="btn" href="tel:${tel[0].replace(/[^0-9]/g, '')}">상주께 전화</a>` : ''}
<a class="btn p" href="/memorial/app/?obit=${o.id}">위로의 말 남기기</a>
<button class="btn" onclick="share()">부고 전달하기</button>
</div>
${comforts.length ? `<div class="sec">위로의 말</div>${comforts.map(c => `<div class="c"><p>${nl(c.body)}</p><small>${esc(c.name)} · ${new Date(c.at).toLocaleDateString('ko-KR')}</small></div>`).join('')}` : ''}
<div class="foot">${o.visibility !== 'private' ? `<a href="/memorial/app/#view-${o.id}">추모관에서 사진과 생애 보기 →</a><br>` : ''}이 부고장은 <a href="/memorial/obituary/">무료 모바일 부고장</a>으로 만들었습니다.<br>광고 없는 비영리 서비스 · 여의도순복음춘천교회</div>
</main><script>
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2500)}
function cp(t){navigator.clipboard.writeText(t).then(()=>toast('복사했습니다.'),()=>prompt('복사해 주세요',t))}
function share(){const d={title:document.title,text:${JSON.stringify(`[부고] ${nm}님께서 ${verb}하셨습니다.`)},url:${JSON.stringify(url)}};if(navigator.share)navigator.share(d).catch(()=>{});else cp(d.url)}
</script></body></html>`;
  res.statusCode = 200; res.end(html);
};
