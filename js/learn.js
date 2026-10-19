/* Learn: Duolingo-style path of hand-authored lessons (js/learn-data.js). Each lesson board is a REAL
   LorcanaEngine state (js/learn-core.js); every move you make is checked with E.isLegal and applied with E.act. */
(function(){
"use strict";
const E=window.LorcanaEngine, D=window.LEARN_DATA, V=window.APP_VERSION||"dev", Core=window.LearnCore;
const KEY="lorcanaLearn.v2", OLD="lorcanaLearn.v1";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let root=null,ctx=null,cur=null,si=0,st=null,hist=[],sel=null,answered=false,busy=false,picks=[],mistakes=0;
/* Real icons only (inline SVG). No emoji anywhere in Learn. */
const ICO={
 book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M8 8h8M8 12h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
 chest:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 7 0 0116 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2z" fill="currentColor"/><path d="M4 12h16M12 5.2V20" stroke="#14112a" stroke-width="2"/><circle cx="12" cy="15" r="2.1" fill="#14112a"/></svg>',
 trophy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v4a6 6 0 01-12 0z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M6 5H3.5a3.5 3.5 0 003.6 4M18 5h2.5a3.5 3.5 0 01-3.6 4M12 13v3M8.5 21h7l-.8-5H9.3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" fill="currentColor"/></svg>',
 flame:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a6.5 6.5 0 006.5-6.5c0-3-1.8-5-3.4-6.9C13.7 5.9 12.6 4.3 12.6 2c-3 1.8-4.4 4.3-4.5 6.8-.8-.6-1.4-1.5-1.8-2.6C5 7.8 5.5 9.5 5.5 14.5A6.5 6.5 0 0012 21z" fill="currentColor"/></svg>',
 lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M7.5 10V7.5a4.5 4.5 0 019 0V10M12 14.5v2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
 check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
 sword:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l3.2-.7L19.5 7 17 4.5 4.7 16.8 4 20zM14 4l6 6M7 15l2 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 lore:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5L21 12l-9 9.5L3 12z" fill="currentColor"/></svg>',
 ink:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 01-12 0c0-3 2.5-6.4 6-11z" fill="currentColor"/></svg>',
 deck:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9 22h9a2 2 0 002-2V7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
 disc:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
 hand:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="9" height="13" rx="2" transform="rotate(-12 7 12)" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="11" y="5" width="9" height="13" rx="2" transform="rotate(10 15 11)" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
 note:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5.5L20 3v12.5" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.8" fill="currentColor"/><circle cx="17.5" cy="15.5" r="2.8" fill="currentColor"/></svg>',
 pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.4-6.5-10.4A6.5 6.5 0 0112 4a6.5 6.5 0 016.5 6.6C18.5 15.6 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2.3"/><circle cx="12" cy="10.5" r="2.3" fill="currentColor"/></svg>',
 box:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
 bolt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4.5 13.5H11L9.8 22l8.7-11.5H12z" fill="currentColor"/></svg>',
 shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7.5 2.8v5.7c0 4.8-3.2 8-7.5 9.5-4.3-1.5-7.5-4.7-7.5-9.5V5.8z" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/></svg>',
 back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'};

const flat=()=>D.chapters.flatMap((ch,ci)=>ch.lessons.map((l,li)=>({ch,ci,li,l})));
/* ---------- progress (with v1 migration: keep XP, streak, chests and the chapter reached) ---------- */
function loadP(){let o=null;try{o=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
 if(!o){o={done:{},xp:0,chests:{},streak:0,lastDay:""};try{const v1=JSON.parse(localStorage.getItem(OLD)||"null");
  if(v1){o.xp=+v1.xp||0;o.streak=+v1.streak||0;o.lastDay=v1.lastDay||"";o.chests=v1.chests||{};o.sparkle=!!v1.sparkle;
   let reached=0;for(const id in (v1.done||{})){const m=id.match(/^c(\d+)l/);if(m)reached=Math.max(reached,+m[1]-1)}
   const auth=D.chapters.filter(c=>!c.soon).length;reached=Math.min(reached,auth);o.migratedFrom=reached+1;
   D.chapters.slice(0,reached).forEach(ch=>ch.lessons.forEach(l=>o.done[l.id]=1));}}catch(e){}
  try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
 return{done:o.done||{},xp:+o.xp||0,chests:o.chests||{},streak:+o.streak||0,lastDay:o.lastDay||"",sparkle:!!o.sparkle,migratedFrom:o.migratedFrom||0}}
let P=loadP();const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){}};
const day=()=>new Date().toLocaleDateString("en-CA");
function touchStreak(){const t=day();if(P.lastDay===t)return;const y=new Date(Date.now()-864e5).toLocaleDateString("en-CA");P.streak=(P.lastDay===y)?P.streak+1:1;P.lastDay=t;save()}
const isDone=id=>!!P.done[id];
function unlocked(idx){const f=flat();return idx===0||isDone(f[idx-1].l.id)}
function currentIdx(){const f=flat();const i=f.findIndex(x=>!isDone(x.l.id));return i<0?f.length-1:i}
/* ---------- cards + image preloading (small images only; board shows only after all decode) ---------- */
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function loadPool(){if(ctx)return;if(!window.LORCANA_GAME_CARDS)await loadScript("./data/game-cards.js?v="+V);
 const raw=(window.LORCANA_GAME_CARDS&&window.LORCANA_GAME_CARDS.cards)||[];
 const cards=raw.filter(c=>/^(9|10|11|12|13)$/.test(String(c.set))).map(E.normCard);ctx=Core.mkCtx(E,cards,D.cards)}
const thumb=u=>u?String(u).replace(/\/(normal|large)\//,"/small/"):u;
const imgOK=new Map();
function preloadOne(u){if(!u)return Promise.resolve();if(imgOK.has(u))return imgOK.get(u);
 const p=new Promise(res=>{const im=new Image();im.decoding="async";let done=false;const fin=()=>{if(!done){done=true;res()}};im.onload=()=>{(im.decode?im.decode().catch(()=>{}):Promise.resolve()).then(fin)};im.onerror=fin;im.src=u;setTimeout(fin,6000)});
 imgOK.set(u,p);return p}
function keysOfSetup(S){const ks=[];if(!S)return ks;for(const side of [S.me||{},S.opp||{}]){for(const k of (side.hand||[]))ks.push(k);for(const e of (side.play||[]))ks.push(typeof e==="string"?e:e.c)}return ks}
function lessonKeys(l){const ks=keysOfSetup(l.setup);for(const s of l.steps){ks.push(...keysOfSetup(s.setup));for(const o of (s.opts||[]))if(o&&o.c)ks.push(o.c)}return[...new Set(ks)]}
function preloadLesson(l){return Promise.all(lessonKeys(l).map(k=>{try{return preloadOne(thumb(ctx.card(k).img))}catch(e){return null}}))}
/* ---------- path ---------- */
function iconFor(l){return ICO[l.icon]||ICO.book}
function renderPath(){
 const f=flat(),ci=currentIdx(),doneN=f.filter(x=>isDone(x.l.id)).length,pct=f.length?Math.round(100*doneN/f.length):0;
 const auth=D.chapters.filter(c=>!c.soon).length;
 let h=`<div class="lbar"><button class="lbtn" data-act="close">${ICO.back}<span>Close</span></button><div class="ltitle">LEARN</div><div class="lstats"><span class="lstat" data-testid="xp">${ICO.star}<b>${P.xp} XP</b></span><span class="lstat">${ICO.flame}<b>${P.streak}</b></span></div></div>
 <div class="lhero"><b>${doneN}/${f.length} lessons</b><span>${pct}%</span><div class="lprog"><i style="width:${pct}%"></i></div><p>${auth} of ${D.chapters.length} chapters open. Real cards from sets 9-13.</p></div><div class="lpath">`;
 D.chapters.forEach((ch,chi)=>{
  h+=`<div class="lchap" style="--ch:${esc(ch.color)}"><h2>Chapter ${chi+1}: ${esc(ch.title)}</h2><p>${esc(ch.desc)}</p></div>`;
  if(ch.soon){h+=`<div class="lnode mid"><div class="ln lock soon" aria-label="${esc(ch.title)} coming soon"><span class="ln-ic">${ICO.lock}</span><span class="ln-t">Coming soon</span></div></div>`;return}
  ch.lessons.forEach((l,li)=>{
   const idx=f.findIndex(x=>x.l.id===l.id),dn=isDone(l.id),un=unlocked(idx),curL=idx===ci;
   h+=`<div class="lnode ${["left","mid","right","mid"][li%4]}"><button class="ln ${dn?"done":""} ${un?"":"lock"} ${curL?"cur":""} ${l.test?"trophy":""}" data-act="${un?"lesson":"locked"}" data-id="${esc(l.id)}" aria-label="${esc(l.title)}"><span class="ln-ic">${dn?ICO.check:un?iconFor(l):ICO.lock}</span><span class="ln-t">${esc(l.title)}</span></button></div>`;
   if(li===3){const cid=ch.id,claimed=!!P.chests[cid],can=ch.lessons.slice(0,4).every(x=>isDone(x.id));
    h+=`<div class="lnode mid"><button class="ln chest ${claimed?"done":""} ${can||claimed?"":"lock"}" data-act="${claimed?"chestdone":can?"chest":"locked"}" data-id="${esc(cid)}" aria-label="Bonus Chest"><span class="ln-ic">${claimed?ICO.check:ICO.chest}</span><span class="ln-t">${claimed?"Claimed":can?"+20 XP":"Chest"}</span></button></div>`}
  });
 });
 root.innerHTML=h+`</div>`;
 requestAnimationFrame(()=>{const el=root.querySelector(".ln.cur")||root.querySelector(".ln:not(.lock)");if(el)el.scrollIntoView({block:"center",behavior:"auto"})});
}
/* ---------- board rendering from the engine state ---------- */
function cardImg(c){return c&&c.img?`<img src="${esc(thumb(c.img))}" alt="${esc(c.full)}" loading="lazy" decoding="async" draggable="false">`:""}
const isWet=x=>x.card.type==="character"&&!E.dry(st,x);
function tile(x,zone,opts){const c=x.card,ch=c.type==="character",loc=c.type==="location",it=c.type==="item";
 const cls=["lt",zone,x.exerted?"ex":"",opts.cand&&opts.cand.has(x.uid)?"cand":"",opts.ring===x.uid?"ring":"",sel&&sel.uid===x.uid?"sel":"",opts.flash===x.uid?"flash":""].join(" ");
 let stats="";
 if(zone==="hand")stats=`<span class="lbdg cost">${ICO.ink}<b>${c.cost}</b></span>${c.inkable?`<span class="lbdg inkok" title="Inkable">${ICO.ink}</span>`:`<span class="lbdg noink" title="Not inkable">${ICO.x}</span>`}`;
 else if(ch)stats=`<span class="lbdg str">${ICO.sword}<b>${E.strOf(x)}</b></span><span class="lbdg wil">${ICO.shield}<b>${E.wilOf(x)}</b></span><span class="lbdg lor">${ICO.lore}<b>${E.loreOf(x)}</b></span>`;
 else if(loc)stats=`<span class="lbdg wil">${ICO.shield}<b>${E.wilOf(x)}</b></span><span class="lbdg lor">${ICO.lore}<b>${E.loreOf(x)||0}</b></span><span class="lbdg mv">${ICO.pin}<b>${c.move??0}</b></span>`;
 else if(it)stats=`<span class="lbdg it">${ICO.box}<b>Item</b></span>`;
 const status=zone==="hand"?"":x.damage?`<span class="lst hurt">${x.damage} damage</span>`:isWet(x)?`<span class="lst wet">Drying</span>`:x.exerted?`<span class="lst exd">Exerted</span>`:ch?`<span class="lst rdy">Ready</span>`:"";
 const here=x.at!=null?`<span class="lst at">${ICO.pin}At place</span>`:"";
 return`<button class="${cls}" data-act="card" data-uid="${x.uid}" aria-label="${esc(c.full)}"><span class="lart">${cardImg(c)}</span><span class="lbars">${stats}</span>${status||here?`<span class="lsts">${status}${here}</span>`:""}</button>`}
function sideHUD(p,label,mine){const ready=p.ink.filter(x=>!x.exerted).length;
 return`<div class="lhud ${mine?"me":"op"}"><span class="lore"><b data-testid="${mine?"mylore":"oplore"}">${p.lore}</b><small>${label}</small></span><span class="pips">${Array.from({length:20},(_,i)=>`<i class="${i<p.lore?"on":""}"></i>`).join("")}</span><span class="chip">${ICO.ink}<b data-testid="${mine?"myink":"opink"}">${ready}/${p.ink.length}</b></span>${mine?`<span class="chip">${ICO.deck}<b>${p.deck.length}</b></span>`:`<span class="chip">${ICO.hand}<b>${p.hand.length}</b></span>`}</div>`}
function zone(p,mine,opts){const chars=p.play.filter(x=>x.card.type==="character"),other=p.play.filter(x=>x.card.type!=="character");
 if(!p.play.length)return"";
 return`<div class="lzone ${mine?"me":"op"}">${other.length?`<div class="lrow strip">${other.map(x=>tile(x,"play",opts)).join("")}</div>`:""}${chars.length?`<div class="lrow">${chars.map(x=>tile(x,"play",opts)).join("")}</div>`:""}</div>`}
function boardHTML(opts){const me=st.players[0],op=st.players[1];
 return`<div class="lboard">${sideHUD(op,"Rival",false)}${zone(op,false,opts)}${zone(me,true,opts)}${sideHUD(me,"You",true)}${me.hand.length?`<div class="lhand">${me.hand.map(x=>tile(x,"hand",opts)).join("")}</div>`:""}</div>`}
/* ---------- lesson flow ---------- */
const step=()=>cur.l.steps[si];
async function startLesson(id){const f=flat();cur=f.find(x=>x.l.id===id);if(!cur)return;si=0;mistakes=0;sel=null;picks=[];answered=false;hist=[];busy=false;root.scrollTop=0;
 root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="back">${ICO.back}<span>Path</span></button><div class="ltitle">${esc(cur.l.title)}</div></div><div class="lspin" role="status" aria-label="Loading"><i></i></div>`;
 await preloadLesson(cur.l);
 st=Core.build(ctx,cur.l.setup);hist=[];enterStep();
 const nx=f[f.findIndex(x=>x.l.id===cur.l.id)+1];if(nx)setTimeout(()=>preloadLesson(nx.l),50)}
function enterStep(){const s=step();sel=null;answered=false;picks=[];busy=false;if(s.setup){st=Core.build(ctx,s.setup);hist=[]}render();if(s.k==="demo")setTimeout(runDemo,650)}
function stepNeedsBoard(s){if(s.k!=="pick")return true;const S=s.setup||cur.l.setup;return keysOfSetup(S).length>0&&!s.opts.some(o=>o&&o.c&&!(S.me&&((S.me.play||[]).some(e=>(e.c||e)===o.c))))}
function render(fb){const s=step(),l=cur.l;const opts={cand:new Set(),ring:null};
 if(sel&&sel.cands)sel.cands.forEach(u=>opts.cand.add(u));
 if(s.k==="do"&&s.guide&&!answered){const a=Core.resolve(ctx,st,s.a);if(a){opts.ring=sel?(sel.field&&a[sel.field]!=null?(sel.field==="singers"?null:a[sel.field]):null):a.uid}}
 if(s.k==="demo"&&!answered){const a=Core.resolve(ctx,st,s.a);if(a)opts.ring=a.uid}
 if(fb&&fb.flash)opts.flash=fb.flash;
 const head=`<div class="lbar"><button class="lbtn" data-act="back">${ICO.back}<span>Path</span></button><div class="ltitle">${esc(l.title)}</div><div class="lstats"><span class="lstat">${ICO.star}<b>${si+1}/${l.steps.length}</b></span></div></div><div class="lprog thin"><i style="width:${Math.round(100*si/l.steps.length)}%"></i></div>`;
 const tag={demo:"Watch",do:"Your move",goal:s.puzzle?"Puzzle":"Your turn",pick:"Quick pick",turn:"Turn steps"}[s.k];
 const prompt=`<div class="lprompt"><span class="ltag">${tag}</span><b class="lsay">${esc(sel&&sel.ask?sel.ask:s.say)}</b></div>`;
 let body="";
 if(s.k==="pick"){const board=stepNeedsBoard(s)?boardHTML(opts):"";
  const cardOpts=s.opts.some(o=>o&&o.c);
  body=board+`<div class="lopts ${cardOpts?"cards":""}">${s.opts.map((o,i)=>o&&o.c?`<button class="lopt lcard ${picks.includes(i)?"on":""}" data-act="pick" data-i="${i}">${cardImg(ctx.card(o.c))}<span>${esc(ctx.card(o.c).name)}</span></button>`:`<button class="lopt ${picks.includes(i)?"on":""}" data-act="pick" data-i="${i}">${esc(o)}</button>`).join("")}</div>${s.multi&&!answered?`<button class="lgo" data-act="check">Check</button>`:""}`}
 else body=boardHTML(opts);
 const verbs=sel&&sel.verbs?`<div class="lverbs">${sel.verbs.map((v,i)=>`<button class="lverb" data-act="verb" data-i="${i}" data-sig="${esc((v.acts||[]).map(sig).join(";"))}">${ICO[v.icon]||""}<span>${esc(v.label)}</span></button>`).join("")}<button class="lcancel" data-act="cancel" aria-label="Cancel">${ICO.x}<span>Cancel</span></button></div>`:sel&&sel.cands?`<div class="lverbs"><button class="lcancel" data-act="cancel" aria-label="Cancel">${ICO.x}<span>Cancel</span></button></div>`:"";
 const tools=(s.k==="goal"&&!answered)?`<div class="ltools"><button class="lbtn" data-act="reset">Reset</button></div>`:(s.k==="turn"&&!answered)?`<div class="ltools"><button class="lgo" data-act="endturn">End turn</button></div>`:"";
 const feed=fb&&fb.msg?`<div class="lfeed ${fb.ok?"ok":"bad"}" role="status"><b class="lfeed-h">${fb.ok?ICO.check:ICO.x}<span>${esc(fb.msg)}</span></b>${fb.ok?`<button class="lgo" data-act="next">Continue</button>`:""}</div>`:"";
 root.innerHTML=head+`<main class="llesson">${prompt}${body}${verbs}${tools}${feed}</main>`;
}
/* verbs for a tapped card, straight from E.legalActions */
const VERB={ink:["Ink it","ink"],quest:["Quest","lore"],challenge:["Challenge","sword"],move:["Move","pin"],act:["Use","bolt"],boost:["Boost","deck"]};
function verbsFor(uid){const L=E.legalActions(st).filter(a=>a.uid===uid&&!a.decline);const g=new Map();
 for(const a of L){let k=a.t,lab,ic;
  if(a.t==="play"){if(a.singers){k="singT";lab="Sing together";ic="note"}else if(a.singer!=null){k="sing";lab="Sing";ic="note"}else if(a.shift!=null){k="shift";lab="Shift";ic="bolt"}else if(a.exerted){k="playEx";lab="Play exerted";ic="shield"}else{k="play";lab="Play ("+E.costOf(st,0,find(uid).card)+")";ic="ink"}}
  else{[lab,ic]=VERB[a.t]||[a.t,"star"]}
  if(!g.has(k))g.set(k,{label:lab,icon:ic,acts:[]});g.get(k).acts.push(a)}
 return[...g.values()]}
const sig=a=>[a.t,a.singer??"",a.singers??"",a.shift??"",a.loc??"",a.exerted?1:0].join("|");
function find(uid){for(const p of st.players)for(const z of["hand","play","ink","discard"]){const x=p[z].find(y=>y.uid===uid);if(x)return x}return null}
function whyNot(x){const c=x.card,me=st.players[0];
 if(x.owner!==0)return"That is the rival's card.";
 if(me.hand.includes(x)){if(!c.inkable&&me.inked===false&&E.costOf(st,0,c)>E.inkAvail(me))return"No ink symbol, and not enough ink to play it.";if(E.costOf(st,0,c)>E.inkAvail(me))return"Not enough ready ink to play that.";return"That card can't be used right now."}
 if(c.type==="character"){if(x.exerted)return"Exerted cards can't act until they ready.";if(isWet(x))return"Drying: it can't quest or challenge this turn.";if(c.kw&&c.kw.reckless)return"Reckless can't quest and has nothing to challenge.";}
 return"That card has no move right now."}
const FIELDS=[["singers","Choose who sings together"],["singer","Choose a singer"],["shift","Choose a character to shift onto"],["loc","Choose a location"],["target","Choose a target"]];
function narrow(acts){for(const[f,ask]of FIELDS){const vals=[...new Set(acts.map(a=>a[f]??null))];if(vals.length>1)return{f,ask,vals}}return null}
function chooseFrom(acts){const n=narrow(acts);if(!n){commit(acts[0]);return}
 if(n.f==="singers"){sel={uid:sel.uid,verbs:n.vals.map(v=>({label:String(v).split(",").map(u=>find(+u).card.name).join(" + "),icon:"note",acts:acts.filter(a=>a.singers===v)})),ask:n.ask};render();return}
 sel={uid:sel.uid,acts,field:n.f,cands:new Set(n.vals.filter(v=>v!=null)),ask:n.ask};render()}
function onCard(uid){const s=step();if(answered||busy||s.k==="pick"||s.k==="turn"||s.k==="demo")return;
 if(sel&&sel.cands){if(sel.cands.has(uid)){const acts=sel.acts.filter(a=>a[sel.field]===uid);sel={uid:sel.uid};chooseFrom(acts)}return}
 const x=find(uid);const vs=verbsFor(uid);
 if(!vs.length){render({ok:false,msg:whyNot(x)});return}
 sel={uid,verbs:vs};render()}
function commit(a){const s=step();sel=null;
 if(s.k==="do"){if(!Core.matchRef(ctx,st,a,s.a)){mistakes++;render({ok:false,msg:"Legal, but not this lesson's move. Try again."});return}}
 if(!E.isLegal(st,a)){render({ok:false,msg:"The engine says that move isn't legal."});return}
 E.act(st,a);while(st.pending){const L=E.legalActions(st);if(!L.length)break;E.act(st,L[0])}hist.push(a);
 const flash=a.target??a.uid;
 if(s.k==="do"){answered=true;fx();render({ok:true,msg:outcome(a),flash});return}
 if(s.k==="goal"){if(Core.goalMet(ctx,st,s.goal,hist)){answered=true;fx();render({ok:true,msg:s.puzzle?"Solved!":"Turn complete!",flash});return}
  const left=E.legalActions(st).filter(b=>b.t!=="end");if(!left.length||st.winner!=null){mistakes++;render({ok:false,msg:"Out of moves. Tap Reset and try another line.",flash});return}
  render({flash})}}
function outcome(a){const me=st.players[0];if(st.winner===0)return"20 lore. You win!";
 if(a.t==="quest")return"+"+(E.loreOf(find(a.uid))||0)+" lore. Now "+me.lore+".";
 if(a.t==="ink")return"Inked. "+me.ink.filter(x=>!x.exerted).length+" ready ink.";
 if(a.t==="challenge"){const t=find(a.target);return t&&st.players[1].play.includes(t)?t.card.name+" took damage: "+t.damage+".":"Banished!"}
 if(a.t==="move")return"Moved. Ink left: "+E.inkAvail(me)+".";
 if(a.t==="act")return"Used. Lore "+me.lore+", hand "+me.hand.length+".";
 return"Done. Ready ink: "+E.inkAvail(me)+"."}
function runDemo(){const s=step();if(!s||s.k!=="demo"||answered)return;const a=Core.resolve(ctx,st,s.a);if(!a||!E.isLegal(st,a)){answered=true;render({ok:true,msg:"Demo skipped."});return}
 E.act(st,a);while(st.pending){const L=E.legalActions(st);if(!L.length)break;E.act(st,L[0])}hist.push(a);answered=true;render({ok:true,msg:outcome(a),flash:a.target??a.uid})}
function endTurn(){if(busy)return;busy=true;const me=st.players[0],l0=me.lore;
 E.act(st,{t:"end"});const ban=root.querySelector(".lsay");if(ban)ban.textContent="Rival's turn: they pass.";
 setTimeout(()=>{E.act(st,{t:"end"});busy=false;answered=true;const g=me.lore-l0;render({ok:true,msg:"Ready step: all ready. Draw step: +1 card."+(g?" Places gave +"+g+" lore.":"")})},500)}
function fx(){if(window.FX&&FX.at)try{FX.at(root.querySelector(".lt.flash,.lt"),{n:12})}catch(e){}}
function nextBtn(c,nx,f){const end=!nx||nx.ci!==c.ci,cid=c.ch.id;
 if(c.li===3&&c.ch.lessons.slice(0,4).every(x=>isDone(x.id))&&!P.chests[cid])return `<button class="lgo" data-act="chestnext" data-id="${esc(cid)}" data-next="${nx?esc(nx.l.id):""}">Open chapter chest</button>`;
 if(nx&&unlocked(f.findIndex(x=>x.l.id===nx.l.id)))return `<button class="lgo" data-act="lesson" data-id="${esc(nx.l.id)}">${end?"Next chapter":"Next lesson"}</button>`;return ""}
function chestScreen(cid,nid){cur=null;sel=null;
 root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="back">${ICO.back}<span>Path</span></button><div class="ltitle">Chapter chest</div></div><main class="llesson center"><div class="lbig">${ICO.chest}</div><h2>+20 XP</h2><p class="ltext">${P.xp} XP · ${P.streak} day streak</p>${nid?`<button class="lgo" data-act="lesson" data-id="${esc(nid)}">Next lesson</button>`:""}<button class="lbtn wide" data-act="back">Back to path</button></main>`;
 if(window.FX&&FX.celebrate)FX.celebrate()}
function finish(){const l=cur.l,first=!isDone(l.id);if(first){P.done[l.id]=Date.now();P.xp+=l.xp;touchStreak();save()}
 const f=flat(),doneN=f.filter(x=>isDone(x.l.id)).length,nx=f[f.findIndex(x=>x.l.id===cur.l.id)+1];
 root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="back">${ICO.back}<span>Path</span></button><div class="ltitle">Lesson complete</div></div><main class="llesson center"><div class="lbig">${ICO.trophy}</div><h2>${esc(l.title)}</h2><p class="ltext">${first?"+"+l.xp+" XP":"Replay done"}${mistakes?"":" · Perfect"}</p><p class="ltext">${doneN}/${f.length} lessons · ${P.xp} XP · ${P.streak} day streak</p>${nextBtn(cur,nx,f)}<button class="lbtn wide" data-act="back">Back to path</button></main>`;
 if(window.FX&&FX.celebrate)FX.celebrate()}
function onClick(e){const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;
 if(a==="close"){close();location.hash="";return}
 if(a==="back"){cur=null;renderPath();return}
 if(a==="locked"||a==="chestdone")return;
 if(a==="lesson"){startLesson(b.dataset.id);return}
 if(a==="chestnext"){const cid=b.dataset.id;if(!P.chests[cid]){P.chests[cid]=1;P.xp+=20;save()}chestScreen(cid,b.dataset.next);return}
 if(a==="chest"){const cid=b.dataset.id;if(!P.chests[cid]){P.chests[cid]=1;P.xp+=20;save();if(window.FX&&FX.celebrate)FX.celebrate()}renderPath();return}
 if(a==="next"){si++;if(si>=cur.l.steps.length)finish();else enterStep();return}
 if(a==="card"){onCard(+b.dataset.uid);return}
 if(a==="verb"){const v=sel&&sel.verbs&&sel.verbs[+b.dataset.i];if(v)chooseFrom(v.acts);return}
 if(a==="cancel"){sel=null;render();return}
 if(a==="reset"){st=Core.build(ctx,step().setup||lastSetup());hist=[];sel=null;render();return}
 if(a==="endturn"){endTurn();return}
 if(a==="pick"){const s=step();if(answered)return;const i=+b.dataset.i;
  if(s.multi){picks=picks.includes(i)?picks.filter(x=>x!==i):picks.concat(i);render();return}
  if(i===s.ans){answered=true;picks=[i];render({ok:true,msg:"Right!"})}else{mistakes++;picks=[];render({ok:false,msg:"Not quite. Look again."})}return}
 if(a==="check"){const s=step();const want=[].concat(s.ans).sort().join(),got=picks.slice().sort().join();if(want===got){answered=true;render({ok:true,msg:"Right!"})}else{mistakes++;render({ok:false,msg:"Not quite. Pick exactly "+[].concat(s.ans).length+"."})}return}
}
function lastSetup(){for(let i=si;i>=0;i--)if(cur.l.steps[i].setup)return cur.l.steps[i].setup;return cur.l.setup}
function ensureRoot(){if(root)return;root=document.createElement("div");root.id="learn";root.hidden=true;document.body.appendChild(root);root.addEventListener("click",onClick)}
async function open(){ensureRoot();root.hidden=false;document.body.classList.add("learning");root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="close">${ICO.back}<span>Close</span></button><div class="ltitle">LEARN</div></div><div class="lspin" role="status" aria-label="Loading"><i></i></div>`;await loadPool();renderPath();
 const i=currentIdx(),f=flat();if(f[i])preloadLesson(f[i].l)}
function close(){if(root)root.hidden=true;document.body.classList.remove("learning")}
window.LorcanaLearn={open,close,state:()=>({P,cur:cur&&cur.l.id,si,answered,hist:hist.length}),
 _test:{sig,flat,startLesson,unlocked,step:()=>cur&&step(),engine:()=>st,ctx:()=>ctx,commit:a=>commit(a),
  resolve:ref=>Core.resolve(ctx,st,ref),solve:()=>{const s=step();const r=Core.solve(ctx,st,s.goal,s.depth||4,20000);return r.wins[0]||null},
  reload:()=>{P=loadP()}}};
})();
