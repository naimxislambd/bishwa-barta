#!/usr/bin/env node
/**
 * বিশ্ব বার্তা — static site builder
 * Reads data/news.json and generates the full site into docs/
 * (GitHub Pages serves the /docs folder). All links are relative so the
 * site works both at a domain root and under /<repo>/.
 * Run: node build-site.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'news.json');
const OUT = path.join(ROOT, 'docs');

const SITE_NAME = 'বিশ্ব বার্তা';
const TAGLINE = 'বিশ্বের খবর, বাংলায়';
const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8e0e1e"/><stop offset="1" stop-color="#d21034"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><text x="400" y="235" font-size="52" text-anchor="middle" fill="#ffffff" font-family="sans-serif">বিশ্ব বার্তা</text></svg>`);

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const bnDate = (iso) =>
  new Date(iso).toLocaleString('bn-BD', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
const bnDateShort = (iso) =>
  new Date(iso).toLocaleString('bn-BD', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true });
const todayBn = () =>
  new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const imgTag = (item, cls, eager) =>
  `<img class="${cls}" src="${esc(item.image || PLACEHOLDER)}" alt="${esc(item.title)}" loading="${eager ? 'eager' : 'lazy'}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;

function head(title, desc, rel, canonicalPath) {
  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | ${esc(SITE_NAME)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="stylesheet" href="${rel}style.css">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#d21034"/><text x="16" y="23" font-size="18" text-anchor="middle" fill="#fff" font-family="sans-serif">বি</text></svg>')}">
</head>`;
}

function header(rel, active) {
  const nav = [
    ['প্রচ্ছদ', `${rel}index.html`, 'home'],
    ['সর্বশেষ', `${rel}index.html#sorboshesh`, 'latest'],
    ['সব খবর', `${rel}sob-khobor.html`, 'all'],
  ];
  return `<div class="topbar"><div class="wrap topbar-in">
  <span>📅 ${todayBn()}</span>
  <span class="auto">⚡ প্রতি ঘণ্টায় স্বয়ংক্রিয় হালনাগাদ</span>
</div></div>
<header class="masthead"><div class="wrap masthead-in">
  <a class="brand" href="${rel}index.html"><span class="logo">বিশ্ব বার্তা</span><span class="tagline">${TAGLINE}</span></a>
  <div class="searchbox"><input id="q" type="search" placeholder="খবর খুঁজুন…" autocomplete="off"><div id="qres"></div></div>
</div></header>
<nav class="mainnav"><div class="wrap">
  ${nav.map(([t, h, k]) => `<a href="${h}" class="${k === active ? 'on' : ''}">${t}</a>`).join('')}
</div></nav>`;
}

function footer(rel) {
  return `<footer><div class="wrap foot-in">
  <div class="fbrand">বিশ্ব বার্তা<span>${TAGLINE}</span></div>
  <p class="fnote">শিরোনাম ও সারসংক্ষেপ সংগৃহীত — বিস্তারিত পড়ুন মূল সংবাদমাধ্যমে।<br>
  উৎস: BBC News বাংলা ও গুগল নিউজের মাধ্যমে বিভিন্ন বাংলা সংবাদমাধ্যম</p>
  <p class="fnote small">এই সাইটের খবর প্রতি ঘণ্টায় স্বয়ংক্রিয়ভাবে হালনাগাদ হয়।</p>
</div></footer>
<script>window.__NEWS_INDEX__ = %%NEWS_INDEX%%;</script>
<script src="${rel}app.js"></script>`;
}

function ticker(items, rel) {
  const links = items.slice(0, 8).map((it) =>
    `<a href="${rel}news/${it.id}.html">${esc(it.title)}</a>`).join('<span class="dot">●</span>');
  return `<div class="ticker"><div class="wrap ticker-in"><span class="tlabel">সর্বশেষ</span><div class="tview"><div class="tscroll">${links}<span class="dot">●</span>${links}</div></div></div></div>`;
}

function card(it, rel, eager) {
  return `<a class="card" href="${rel}news/${it.id}.html">
  ${imgTag(it, 'card-img', eager)}
  <div class="card-body">
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.summary)}</p>
    <div class="meta"><span class="src">${esc(it.source)}</span><span class="time" data-ts="${it.pubDate}">${bnDateShort(it.pubDate)}</span></div>
  </div></a>`;
}

function buildIndex(items) {
  const rel = '';
  const hero = items.slice(0, 3);
  const latest = items.slice(3, 15);
  const more = items.slice(15, 39);
  const bySource = {};
  for (const it of items) (bySource[it.source] = bySource[it.source] || []).push(it);

  const heroHtml = hero.length ? `<section class="wrap hero">
    <a class="hero-main" href="${rel}news/${hero[0].id}.html">
      ${imgTag(hero[0], 'hero-img', true)}
      <div class="hero-cap"><span class="kicker">${esc(hero[0].source)}</span><h2>${esc(hero[0].title)}</h2><p>${esc(hero[0].summary)}</p></div>
    </a>
    <div class="hero-side">
      ${hero.slice(1).map((it) => `<a class="hero-item" href="${rel}news/${it.id}.html">${imgTag(it, 'hero-thumb', true)}<div><h3>${esc(it.title)}</h3><div class="meta"><span class="src">${esc(it.source)}</span></div></div></a>`).join('')}
    </div></section>` : '';

  const sourceSections = Object.entries(bySource).map(([src, list]) => `
    <section class="wrap block"><div class="block-head"><h2>${esc(src)}</h2><a class="more" href="${rel}sob-khobor.html">সব দেখুন →</a></div>
    <div class="grid">${list.slice(0, 6).map((it) => card(it, rel)).join('')}</div></section>`).join('');

  const newsIndex = JSON.stringify(items.slice(0, 60).map((it) => ({ id: it.id, t: it.title })));

  return `${head(`${SITE_NAME} — ${TAGLINE}`, 'আন্তর্জাতিক খবর বাংলায় — প্রতি ঘণ্টায় স্বয়ংক্রিয় হালনাগাদ।', rel)}
<body>
${header(rel, 'home')}
${ticker(items, rel)}
${heroHtml}
<section class="wrap block" id="sorboshesh"><div class="block-head"><h2>সর্বশেষ খবর</h2><a class="more" href="${rel}sob-khobor.html">সব খবর →</a></div>
<div class="latest">${latest.map((it) => `
  <a class="lrow" href="${rel}news/${it.id}.html">${imgTag(it, 'lrow-img')}<div><h3>${esc(it.title)}</h3><div class="meta"><span class="src">${esc(it.source)}</span><span class="time" data-ts="${it.pubDate}">${bnDateShort(it.pubDate)}</span></div></div></a>`).join('')}</div></section>
${more.length ? `<section class="wrap block"><div class="block-head"><h2>আরও খবর</h2></div><div class="grid">${more.map((it) => card(it, rel)).join('')}</div></section>` : ''}
${sourceSections}
${footer(rel).replace('%%NEWS_INDEX%%', newsIndex)}
</body></html>`;
}

function buildArchive(items) {
  const rel = '';
  const rows = items.map((it) => `
  <a class="lrow" data-title="${esc(it.title.toLowerCase())}" href="${rel}news/${it.id}.html" style="display:none">${imgTag(it, 'lrow-img')}<div><h3>${esc(it.title)}</h3><p class="lsum">${esc(it.summary)}</p><div class="meta"><span class="src">${esc(it.source)}</span><span class="time" data-ts="${it.pubDate}">${bnDateShort(it.pubDate)}</span></div></div></a>`).join('');
  const newsIndex = JSON.stringify(items.slice(0, 300).map((it) => ({ id: it.id, t: it.title })));
  return `${head('সব খবর', 'সব সংগৃহীত আন্তর্জাতিক খবর এক জায়গায়।', rel)}
<body>
<script>window.__ARCHIVE__ = true;</script>
${header(rel, 'all')}
<main class="wrap block"><div class="block-head"><h2>সব খবর <span class="count">(${items.length})</span></h2></div>
<div class="latest" id="archlist">${rows}</div>
<button id="morebtn" class="morebtn">আরও দেখুন</button></main>
${footer(rel).replace('%%NEWS_INDEX%%', newsIndex)}
</body></html>`;
}

function buildArticle(it, others) {
  const rel = '../';
  const rel2 = others.slice(0, 4).map((o) => card(o, rel)).join('');
  return `${head(it.title, it.summary, rel)}
<body>
${header(rel, '')}
<main class="wrap article">
  <div class="crumb"><a href="${rel}index.html">প্রচ্ছদ</a> / <span>${esc(it.source)}</span></div>
  <h1>${esc(it.title)}</h1>
  <div class="ameta"><span class="src">${esc(it.source)}</span><span class="time" data-ts="${it.pubDate}">${bnDate(it.pubDate)}</span></div>
  ${imgTag(it, 'art-img', true)}
  <div class="abody"><p>${esc(it.summary)}</p>
  <p class="disclaimer">এটি সারসংক্ষেপ। বিস্তারিত প্রতিবেদন পড়ুন মূল সংবাদমাধ্যমে।</p>
  <a class="readmore" href="${esc(it.link)}" target="_blank" rel="noopener">মূল খবর পড়ুন — ${esc(it.source)} ↗</a></div>
  <div class="share-note">খবরটি ভালো লাগলে শেয়ার করুন</div>
</main>
${others.length ? `<section class="wrap block"><div class="block-head"><h2>আরও খবর</h2></div><div class="grid">${rel2}</div></section>` : ''}
${footer(rel).replace('%%NEWS_INDEX%%', '[]')}
</body></html>`;
}

function css() {
  return `:root{--red:#d21034;--dark:#141414;--mut:#666;--line:#e8e8e8;--bg:#f7f7f7}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Hind Siliguri","Noto Sans Bengali",SolaimanLipi,Arial,sans-serif;background:#fff;color:var(--dark);line-height:1.6}
a{color:inherit;text-decoration:none}
img{display:block;max-width:100%}
.wrap{max-width:1180px;margin:0 auto;padding:0 16px}
.topbar{background:var(--dark);color:#ddd;font-size:13px}
.topbar-in{display:flex;justify-content:space-between;padding:7px 16px;gap:8px;flex-wrap:wrap}
.auto{color:#ffb3c1}
.masthead{border-bottom:3px solid var(--red)}
.masthead-in{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 16px;flex-wrap:wrap}
.brand{display:flex;flex-direction:column}
.logo{font-size:44px;font-weight:800;color:var(--red);line-height:1.1;letter-spacing:-.5px}
.tagline{font-size:15px;color:var(--mut)}
.searchbox{position:relative;min-width:240px;flex:0 1 320px}
.searchbox input{width:100%;padding:10px 14px;border:2px solid var(--line);border-radius:24px;font-size:15px;font-family:inherit}
.searchbox input:focus{outline:none;border-color:var(--red)}
#qres{position:absolute;top:110%;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:50;display:none;max-height:320px;overflow:auto}
#qres a{display:block;padding:10px 14px;border-bottom:1px solid var(--line);font-size:14px}
#qres a:hover{background:var(--bg)}
.mainnav{background:var(--red);position:sticky;top:0;z-index:40}
.mainnav .wrap{display:flex;gap:4px}
.mainnav a{color:#fff;padding:11px 18px;font-weight:600;font-size:16px}
.mainnav a:hover,.mainnav a.on{background:rgba(0,0,0,.22)}
.ticker{background:#1c1c1c;color:#fff;overflow:hidden}
.ticker-in{display:flex;align-items:center;gap:12px;padding:0 16px}
.tlabel{background:var(--red);color:#fff;font-weight:700;padding:9px 16px;white-space:nowrap;font-size:15px}
.tview{overflow:hidden;flex:1;white-space:nowrap}
.tscroll{display:inline-block;padding:9px 0;animation:tick 60s linear infinite;font-size:15px}
.tview:hover .tscroll{animation-play-state:paused}
.tscroll a{color:#fff;margin:0 6px}
.tscroll a:hover{color:#ffd7de}
.dot{color:var(--red);margin:0 4px;font-size:10px}
@keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.block{padding:26px 16px 6px}
.block-head{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--red);margin-bottom:18px;padding-bottom:8px}
.block-head h2{font-size:24px}
.more{color:var(--red);font-weight:600;font-size:15px}
.count{color:var(--mut);font-size:18px;font-weight:400}
.hero{display:grid;grid-template-columns:2fr 1fr;gap:18px;padding-top:26px}
.hero-main{position:relative;border-radius:10px;overflow:hidden;min-height:380px;display:block;background:#222}
.hero-img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.hero-cap{position:absolute;left:0;right:0;bottom:0;padding:22px;background:linear-gradient(transparent,rgba(0,0,0,.88));color:#fff}
.kicker{background:var(--red);color:#fff;font-size:13px;padding:3px 10px;border-radius:4px;font-weight:600}
.hero-cap h2{font-size:28px;margin:10px 0 6px;line-height:1.35}
.hero-cap p{font-size:15px;color:#e6e6e6}
.hero-side{display:flex;flex-direction:column;gap:18px}
.hero-item{display:flex;gap:12px;background:var(--bg);border-radius:10px;overflow:hidden;padding:10px}
.hero-item h3{font-size:17px;line-height:1.4}
.hero-thumb{width:150px;height:100px;object-fit:cover;border-radius:6px;flex-shrink:0}
.latest{display:flex;flex-direction:column}
.lrow{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
.lrow h3{font-size:18px;line-height:1.45}
.lrow:hover h3{color:var(--red)}
.lrow-img{width:170px;height:110px;object-fit:cover;border-radius:8px;flex-shrink:0}
.lsum{font-size:14px;color:var(--mut);margin:4px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(0,0,0,.1)}
.card-img{width:100%;height:180px;object-fit:cover}
.card-body{padding:14px;display:flex;flex-direction:column;gap:8px;flex:1}
.card-body h3{font-size:17px;line-height:1.45}
.card-body p{font-size:14px;color:var(--mut);flex:1}
.meta{display:flex;gap:10px;font-size:13px;color:var(--mut);align-items:center}
.src{color:var(--red);font-weight:600}
.article{max-width:820px;padding-top:26px}
.crumb{font-size:14px;color:var(--mut);margin-bottom:10px}
.crumb a{color:var(--red)}
.article h1{font-size:32px;line-height:1.4;margin-bottom:10px}
.ameta{display:flex;gap:14px;font-size:14px;color:var(--mut);margin-bottom:18px}
.art-img{width:100%;border-radius:10px;margin-bottom:20px;max-height:460px;object-fit:cover}
.abody p{font-size:18px;margin-bottom:16px}
.disclaimer{font-size:14px!important;color:var(--mut);border-left:3px solid var(--red);padding-left:12px}
.readmore{display:inline-block;background:var(--red);color:#fff;padding:12px 26px;border-radius:8px;font-weight:700;margin:8px 0 4px}
.readmore:hover{background:#a50d29}
.share-note{margin:22px 0 6px;font-size:14px;color:var(--mut)}
.morebtn{display:block;margin:26px auto;padding:12px 40px;border:2px solid var(--red);background:#fff;color:var(--red);font-size:16px;font-weight:700;border-radius:30px;cursor:pointer;font-family:inherit}
.morebtn:hover{background:var(--red);color:#fff}
footer{background:var(--dark);color:#bbb;margin-top:40px}
.foot-in{padding:34px 16px;text-align:center}
.fbrand{font-size:28px;font-weight:800;color:#fff}
.fbrand span{display:block;font-size:14px;color:#888;font-weight:400;margin-top:4px}
.fnote{font-size:14px;margin-top:14px}
.fnote a{color:#ff8fa3}
.fnote.small{font-size:12px;color:#777}
@media(max-width:900px){.hero{grid-template-columns:1fr}.hero-main{min-height:300px}.hero-cap h2{font-size:22px}.grid{grid-template-columns:repeat(2,1fr)}.article h1{font-size:25px}.logo{font-size:34px}}
@media(max-width:600px){.grid{grid-template-columns:1fr}.lrow-img{width:120px;height:84px}.lrow h3{font-size:16px}.masthead-in{padding:14px 16px}.searchbox{flex:1 1 100%}}`;
}

function appjs() {
  return `// বিশ্ব বার্তা — client helpers: search, archive load-more, Bengali relative time
(function(){
var BN='০১২৩৪৫৬৭৮৯';
function bn(s){return String(s).replace(/[0-9]/g,function(d){return BN[d];});}
function ago(iso){
  var s=(Date.now()-new Date(iso).getTime())/1000;
  if(s<60) return 'এইমাত্র';
  var m=s/60|0; if(m<60) return bn(m)+' মিনিট আগে';
  var h=m/60|0; if(h<24) return bn(h)+' ঘণ্টা আগে';
  var d=h/24|0; if(d<7) return bn(d)+' দিন আগে';
  return null;
}
document.querySelectorAll('.time[data-ts]').forEach(function(el){
  var r=ago(el.getAttribute('data-ts')); if(r) el.textContent=r;
});
// search
var q=document.getElementById('q'),res=document.getElementById('qres');
var idx=window.__NEWS_INDEX__||[];
if(q){
  q.addEventListener('input',function(){
    var v=q.value.trim().toLowerCase();
    if(v.length<2){res.style.display='none';res.innerHTML='';return;}
    var hits=idx.filter(function(it){return it.t.toLowerCase().indexOf(v)>-1;}).slice(0,8);
    if(!hits.length){res.style.display='none';return;}
    var base=location.pathname.indexOf('/news/')>-1?'':'news/';
    res.innerHTML=hits.map(function(h){return '<a href="'+base+h.id+'.html">'+h.t.replace(/</g,'&lt;')+'</a>';}).join('');
    res.style.display='block';
  });
  document.addEventListener('click',function(e){ if(!e.target.closest('.searchbox')) res.style.display='none'; });
}
// archive load-more
if(window.__ARCHIVE__){
  var rows=Array.prototype.slice.call(document.querySelectorAll('#archlist .lrow'));
  var btn=document.getElementById('morebtn'), shown=0, PAGE=20;
  function showMore(){ shown+=PAGE;
    rows.forEach(function(r,i){ r.style.display=i<shown?'flex':'none'; });
    if(shown>=rows.length) btn.style.display='none';
    btn.textContent='আরও দেখুন ('+bn(Math.min(shown,rows.length))+'/'+bn(rows.length)+')';
  }
  btn.addEventListener('click',showMore); showMore();
}
})();`;
}

function main() {
  const items = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  fs.mkdirSync(path.join(OUT, 'news'), { recursive: true });

  fs.writeFileSync(path.join(OUT, 'index.html'), buildIndex(items));
  fs.writeFileSync(path.join(OUT, 'sob-khobor.html'), buildArchive(items));
  fs.writeFileSync(path.join(OUT, 'style.css'), css());
  fs.writeFileSync(path.join(OUT, 'app.js'), appjs());
  fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');

  const base = 'https://example.com/';
  const urls = ['', 'sob-khobor.html', ...items.slice(0, 100).map((it) => `news/${it.id}.html`)];
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n') + `\n</urlset>\n`);

  let n = 0;
  for (const it of items) {
    const others = items.filter((o) => o.id !== it.id).slice(0, 4);
    fs.writeFileSync(path.join(OUT, 'news', `${it.id}.html`), buildArticle(it, others));
    n++;
  }
  console.log(`built: index + archive + ${n} articles → ${OUT}`);
}

main();
