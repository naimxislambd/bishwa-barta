// বিশ্ব বার্তা — client helpers: search, archive load-more, Bengali relative time
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
// ticker: duplicate content for a seamless loop
var ts=document.getElementById('tscroll');
if(ts){ ts.innerHTML += '<span class="dot">●</span>' + ts.innerHTML; }
// search
var q=document.getElementById('q'),res=document.getElementById('qres');
var idx=window.__NEWS_INDEX__||[];
var searchBase=location.pathname.indexOf('/news/')>-1?'../':'';
fetch(searchBase+'search.json').then(function(r){return r.json();}).then(function(j){idx=j;}).catch(function(){});
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
})();