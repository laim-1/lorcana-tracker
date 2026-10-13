/* Play mode: deck select, deck builder, mulligan, board vs AI. Depends on LorcanaEngine. */
(function(){
"use strict";
const E=window.LorcanaEngine,V=window.APP_VERSION||"dev",DKEY="lorcanaDecks.v1";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const STARTERS=E.STARTER_DECKS; // official Ravensburger starter decklists (sets 1-10, 12)
const STATUS_LABEL={full:"Fully simulated",keywords:"Keywords simulated",plain:"No abilities",partial:"Partly simulated",vanilla:"Ability not simulated"};
let snapPool=null,pool=null,byId=new Map(),source="snapshot",root,S={screen:"menu",sel:null,deck:"s0",opp:"random",build:null,st:null,busy:false,mullSel:new Set()};

function ensureRoot(){if(root)return;root=document.createElement("div");root.id="play";root.hidden=true;document.body.appendChild(root);
  root.addEventListener("click",onClick);root.addEventListener("input",onInput);
  let lpT=null;root.addEventListener("pointerdown",e=>{const t=e.target.closest("[data-a=tile],[data-zuid],[data-a=bview1],[data-a=mtog]");if(!t)return;lpT=setTimeout(()=>{S.lp=true;longZoom(t)},450)});
  ["pointerup","pointercancel","pointerleave","pointermove"].forEach(n=>root.addEventListener(n,e=>{if(n==="pointermove"&&e.movementX*e.movementX+e.movementY*e.movementY<16)return;clearTimeout(lpT)}));
  root.addEventListener("contextmenu",e=>e.preventDefault())}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function loadPool(){
  if(pool)return;if(!window.LORCANA_GAME_CARDS)await loadScript("./data/game-cards.js?v="+V);
  setPool(window.LORCANA_GAME_CARDS.cards);refreshLive();
}
function setPool(raw){if(pool&&!snapPool)snapPool=pool;pool=raw.filter(c=>/^\d+$/.test(String(c.set))).map(E.normCard); // main numbered sets only
  byId=new Map(pool.map(c=>[c.id,c]))}
async function refreshLive(){ // try to replace the snapshot with live Lorcast data (used for the next game)
  try{const sig=()=>AbortSignal.timeout(10000);const sets=(await (await fetch("https://api.lorcast.com/v0/sets",{signal:sig()})).json()).results;
    const today=new Date().toISOString().slice(0,10),out=[];
    await Promise.all(sets.filter(s=>(s.released_at||"9")<=today).map(async s=>{const cs=await (await fetch(`https://api.lorcast.com/v0/sets/${s.id}/cards`,{signal:sig()})).json();
      for(const c of cs)out.push({id:c.id,name:c.name,version:c.version,cost:c.cost,inkwell:c.inkwell,ink:c.ink,inks:c.inks,type:c.type,classifications:c.classifications,text:c.text,move_cost:c.move_cost,strength:c.strength,willpower:c.willpower,lore:c.lore,rarity:c.rarity,collector_number:c.collector_number,set:s.code,img:c.image_uris?.digital?.small})}));
    if(out.length>=pool.length*0.9){setPool(out);source="live"}}catch(e){}
}
const mainPool=()=>pool;
const decks=()=>{let d;try{d=JSON.parse(localStorage.getItem(DKEY)||"[]")}catch(e){d=[]}if(!Array.isArray(d))d=[];
  const ok=d.filter(x=>x&&typeof x==="object"&&x.cards&&typeof x.cards==="object"&&!Array.isArray(x.cards)).map(x=>({name:typeof x.name==="string"&&x.name.trim()?x.name:"My deck",cards:Object.fromEntries(Object.entries(x.cards).filter(([k,n])=>typeof k==="string"&&Number.isFinite(+n)&&+n>0).map(([k,n])=>[k,Math.min(99,Math.floor(+n))]))}));
  if(ok.length!==d.length||JSON.stringify(ok)!==JSON.stringify(d))try{localStorage.setItem(DKEY,JSON.stringify(ok))}catch(e){}return ok};
const saveDecks=d=>localStorage.setItem(DKEY,JSON.stringify(d));
function ownedMap(){const col=(()=>{try{const o=JSON.parse(localStorage.getItem("lorcanaCollection.v1")||"{}");return o&&typeof o==="object"&&!Array.isArray(o)?o:{}}catch(e){return{}}})(),m={};for(const[id,v]of Object.entries(col))m[id]=v&&typeof v==="object"?(Math.max(0,+v.n||0)+Math.max(0,+v.f||0)):0;return m}
function deckFromSel(sel){if(typeof sel!=="string"||!/^(s\d+|own|c\d+)$/.test(sel)||(sel[0]==="s"&&!STARTERS[+sel.slice(1)]))sel="s0";
  if(sel[0]==="s"){const p=STARTERS[+sel.slice(1)];return{name:p.name,cards:E.deckFromList(mainPool(),p.list)||E.deckFromList(snapPool||[],p.list)||E.buildDeck(mainPool(),p.inks)}}
  if(sel==="own"){const o=ownedMap(),b=E.bestOwnedPair(pool,o);const d=b&&b.n>=60?E.buildDeck(pool,b.inks,o):null;return{name:"My collection"+(b?" ("+b.inks.join(" / ")+")":""),cards:d,need:b?b.n:0}}
  if(sel[0]==="c"){const d=decks()[+sel.slice(1)];if(!d)return{cards:null};const cards=[];for(const[id,n]of Object.entries(d.cards)){const c=byId.get(id);if(c)for(let i=0;i<n;i++)cards.push(c)}return{name:d.name,cards:cards.length>=60&&!E.validateDeck(cards)?cards:null}}
}
/* ---------- rendering ---------- */
function bar(title,right=""){return`<div class="pbar"><button class="pbtn ghost" data-a="quit">${S.screen==="menu"?"Close":"Back"}</button><div class="ptitle">${esc(title)}</div>${right}</div>`}
function render(){if(root){root.classList.toggle("onboard",S.screen==="board");if(S._lastScreen!==S.screen){root.scrollTop=0;S._lastScreen=S.screen}}clearFx();if(window.FX)FX.mode(S.screen==="board"?"board":"tracker");
  if(!pool){root.innerHTML=bar("Play")+`<p class="empty">Loading all cards...</p>`;return}
  ({menu:renderMenu,builder:renderBuilder,mull:renderMull,board:renderBoard,coin:renderCoin}[S.screen])();
}
function renderMenu(){
  const own=deckFromSel("own"),cus=decks();
  if(!/^(s\d+|own|c\d+)$/.test(String(S.deck))||(S.deck[0]==="c"&&!cus[+S.deck.slice(1)])||(S.deck[0]==="s"&&!STARTERS[+S.deck.slice(1)]))S.deck="s0";
  const opt=(id,name,sub,dis)=>`<button class="dopt ${S.deck===id?"on":""}" data-a="sel" data-v="${id}" ${dis?"disabled":""}><b>${esc(name)}</b><span>${esc(sub)}</span></button>`;
  const PPm=S.mode==="pp";root.innerHTML=`<div class="phead">`+bar(PPm?"Pass and play":"Play vs AI")+`<div class="startbar top"><button class="wide primary" data-a="start">Start game</button></div></div><div class="pbody">
  <h4>Mode</h4><div class="opts"><button class="opt ${!PPm?"on":""}" data-a="mode" data-v="ai">Vs AI</button><button class="opt ${PPm?"on":""}" data-a="mode" data-v="pp">Pass and play (2 players)</button></div>
  <h4>${PPm?"Player 1 deck":"Your deck"}</h4>${STARTERS.map((p,i)=>opt("s"+i,p.name,p.title+" · official starter · 60 cards")).join("")}
  ${opt("own","Build from my collection",own.cards?own.name+" · 60 cards":`Need 60 owned cards in two inks (best: ${own.need})`,!own.cards)}
  ${cus.map((d,i)=>opt("c"+i,d.name,Object.values(d.cards).reduce((a,b)=>a+b,0)+" cards · custom")).join("")}
  <button class="wide" data-a="builder">Deck builder</button>
  <h4>${PPm?"Player 2 deck":"Opponent"}</h4><div class="opts"><button class="opt ${S.opp==="random"?"on":""}" data-a="opp" data-v="random">Random starter</button>${STARTERS.map((p,i)=>`<button class="opt ${S.opp==="s"+i?"on":""}" data-a="opp" data-v="s${i}">${esc(p.name)}</button>`).join("")}</div>
  ${PPm?"":`<h4>AI difficulty</h4><div class="opts">${["easy","normal","hard"].map(l=>`<button class="opt ${SET.level===l?"on":""}" data-a="lvl" data-v="${l}">${LEVELS[l]}</button>`).join("")}</div>
  <h4>AI style</h4><div class="opts">${Object.entries(STYLES).map(([k,l])=>`<button class="opt ${SET.style===k?"on":""}" data-a="sty" data-v="${k}">${l}</button>`).join("")}</div>`}
  <button class="wide" data-a="settings">Settings</button>
  <p class="meta small">${pool.length} main-set cards loaded (${source=="live"?"live from Lorcast":"snapshot"}). ${coverageLine()}</p></div>`;
}
function coverageLine(){const c=E.coverage(pool).byStatus;return`Ability simulation: ${c.full||0} full, ${c.keywords||0} keyword-only, ${c.plain||0} no-text, ${c.partial||0} partial, ${c.vanilla||0} vanilla fallback.`}
/* deck builder */
function bInit(d){S.build={name:d?d.name:"My deck",cards:d?{...d.cards}:{},idx:d?d.idx:null,q:"",ink:"",type:"",limit:60,view:"all"}}
const bCount=()=>Object.values(S.build.cards).reduce((a,b)=>a+b,0);
function bInks(){const s=new Set();for(const id of Object.keys(S.build.cards))(byId.get(id)?.inks||[]).forEach(i=>s.add(i));return[...s]}
function fullCount(c){let n=0;for(const[id,k]of Object.entries(S.build.cards))if(byId.get(id)?.full===c.full)n+=k;return n}
function renderBuilder(){
  const b=S.build,inks=bInks(),n=bCount(),q=b.q.toLowerCase();
  let list=b.view==="deck"?Object.keys(b.cards).map(id=>byId.get(id)).filter(Boolean):pool.filter(c=>(!q||c.full.toLowerCase().includes(q))&&(!b.ink||c.inks.includes(b.ink))&&(!b.type||c.type===b.type));
  list.sort((x,y)=>x.cost-y.cost||x.name.localeCompare(y.name));const total=list.length;list=list.slice(0,b.limit);
  const warn=n<60?`${60-n} more needed`:inks.length>2?"Too many inks":"Legal deck";
  root.innerHTML=bar("Deck builder",`<button class="pbtn" data-a="bsave">Save</button>`)+`<div class="pbody">
  <div class="bstat ${n>=60&&inks.length<=2?"ok":""}"><b>${n}/60</b><span>${inks.join(" / ")||"No inks yet"} · ${warn}</span></div>
  <input class="pin" id="bname" value="${esc(b.name)}" placeholder="Deck name">
  <div class="row2"><button class="opt ${b.view==="all"?"on":""}" data-a="bview" data-v="all">All cards</button><button class="opt ${b.view==="deck"?"on":""}" data-a="bview" data-v="deck">This deck</button><button class="opt" data-a="bclear">Clear</button></div>
  ${b.view==="all"?`<input class="pin" id="bq" type="search" value="${esc(b.q)}" placeholder="Search ${pool.length} main-set cards">
  <div class="opts">${["",...E.INKS].map(i=>`<button class="opt sm ${b.ink===i?"on":""}" data-a="bink" data-v="${i}">${i||"Any ink"}</button>`).join("")}</div>
  <div class="opts">${["","character","action","song","item","location"].map(i=>`<button class="opt sm ${b.type===i?"on":""}" data-a="btype" data-v="${i}">${i?i[0].toUpperCase()+i.slice(1):"Any type"}</button>`).join("")}</div>`:""}
  <div class="meta small">${total} cards${total>b.limit?`, showing ${b.limit}`:""}</div>
  <div class="bgrid">${list.map(c=>{const k=b.cards[c.id]||0;return`<button class="bcard ${k?"in":""}" data-a="bview1" data-id="${c.id}"><img loading="lazy" src="${esc(c.img)}" alt="${esc(c.full)}">${k?`<span class="cnt">${k}</span>`:""}${badge(c)}</button>`}).join("")}</div>
  ${total>b.limit?`<button class="wide" data-a="bmore">Show more</button>`:""}</div>`;
}
function badge(c){return c.status==="partial"?`<span class="sb part">PARTIAL</span>`:c.status==="vanilla"?`<span class="sb van">TEXT OFF</span>`:""}
function cardSheet(c,extra){
  const st=c.type==="character"?`${c.cost} ink · ${c.str} STR · ${c.wil} WIL · ${c.lore} lore`:c.type==="location"?`${c.cost} ink · ${c.wil} WIL · ${c.lore} lore · move ${c.move??"-"}`:`${c.cost} ink · ${c.type}`;
  return`<img class="big-img" src="${esc(c.imgLarge||c.img)}" alt="${esc(c.full)}"><div class="sname2">${esc(c.full)}</div><div class="meta">${st}${c.inkable?" · inkable":""}</div>
  <div class="status s-${c.status}">${STATUS_LABEL[c.status]}</div>${c.unsupported.length?`<div class="meta small">Not simulated: ${c.unsupported.map(u=>esc(u.replace(/\([^)]*\)/g,"").slice(0,90))).join(" | ")}</div>`:""}${extra||""}`;
}
function sheet(html){$("#sheet-body").innerHTML=html;$("#scrim").hidden=false;$("#sheet").classList.add("open");$("#sheet").setAttribute("aria-hidden","false");$("#sheet-body").onclick=onClick}
function closeSheet(){if(S.paused&&S.screen==="board"){S.paused=false;if(aiTurn())setTimeout(aiLoop,50)}$("#sheet").classList.remove("open");$("#scrim").hidden=true;$("#sheet").setAttribute("aria-hidden","true")}
function badd(id,d){const c=byId.get(id),max=/up to 99 copies/.test(c.text)?99:4;
      if(d>0){if(fullCount(c)>=max){builderSheet(id);return}const inks=new Set(bInks());c.inks.forEach(i=>inks.add(i));if(inks.size>2){alert("A deck can use at most 2 inks.");builderSheet(id);return}}
      const k=Math.max(0,(S.build.cards[id]||0)+d);if(k)S.build.cards[id]=k;else delete S.build.cards[id];renderBuilder();builderSheet(id)}
function builderSheet(id,from){const c0=byId.get(id);if(window.Zoom&&c0){const k=S.build.cards[id]||0,max=/up to 99 copies/.test(c0.text)?99:4,f=fullCount(c0);
    zoomCard(c0,from,{state:[{t:"In deck: "+k},{t:"Max "+max+" · you have "+f+" incl. other printings",cls:"info"}],actions:[{label:"Remove one",fn:()=>badd(id,-1)},{label:f>=max?"Deck has max":"Add one",cls:"pri",fn:()=>badd(id,1)}]});return}
  const c=byId.get(id),k=S.build.cards[id]||0,max=/up to 99 copies/.test(c.text)?99:4,f=fullCount(c);
  sheet(cardSheet(c,`<div class="stepper big2"><button class="big" data-a="badd" data-id="${id}" data-d="-1">&minus;</button><b>${k}</b><button class="big plus" data-a="badd" data-id="${id}" data-d="1" ${f>=max?"disabled":""}>+</button></div><div class="meta small">Max ${max} copies of ${esc(c.full)} (you have ${f}).</div><button class="wide" data-a="close">Done</button>`))}
/* game */
const SKEY2="lorcanaPlaySettings.v1";
const STYLES={balanced:"Balanced",aggro:"Aggressive",quester:"Quester",control:"Control"};
const AILV=()=>SET.level+(SET.style&&SET.style!=="balanced"?":"+SET.style:"");
const SET=(()=>{const d={level:"normal",speed:"normal",sound:false,tips:true,style:"balanced"};let o={};try{o=JSON.parse(localStorage.getItem(SKEY2)||"{}")||{}}catch(e){}
  if(typeof o!=="object"||Array.isArray(o))o={};const r={...d,...o};if(!["easy","normal","hard"].includes(r.level))r.level="normal";if(!["slow","normal","fast"].includes(r.speed))r.speed="normal";if(!STYLES[r.style])r.style="balanced";r.sound=!!r.sound;r.tips=r.tips!==false;return r})();
const saveSet=()=>localStorage.setItem(SKEY2,JSON.stringify(SET));
const SPEED={slow:1500,normal:950,fast:450};
const LEVELS={easy:"Easy",normal:"Normal",hard:"Hard"};
function startGame(rematch){
  let me,op;
  if(rematch&&S.last){me=S.last.me;op=S.last.op}else{me=deckFromSel(S.deck);if(!me||!me.cards){alert("That deck isn't ready (needs 60 legal cards).");return}
    const os=S.opp==="random"?"s"+Math.floor(Math.random()*STARTERS.length):S.opp;op=deckFromSel(os)}
  S.last={me,op};S.oppName=op.name;S.meName=me.name;
  S.pp=S.mode==="pp";S.names=["Player 1","Player 2"];S.shown=null;S.mullSeat=0;
  S.st=E.newGame({decks:[me.cards,op.cards],names:S.pp?S.names:["You","AI"],seed:Date.now()%1e9,first:Math.random()<.5?0:1,human:[true,S.pp]});
  if(!S.pp)E.mulligan(S.st,1,E.aiMulligan(S.st,1));S.mullSel=new Set();S.sel=null;S.tm=null;S.screen="coin";render();
}
function renderCoin(){const f=S.st.first===0,fn=S.st.first;
  root.innerHTML=`<div class="coinwrap"><div class="coin spin"><div class="cface">${S.pp?"P"+(fn+1):f?"YOU":"AI"}</div></div><h2 class="cres hidden">${S.pp?esc(PN(fn))+" goes first":f?"You go first":"AI goes first"}</h2>
  <p class="meta cres hidden">${S.pp?"The first player skips their draw on turn 1. Each player now picks their opening hand in private.":f?"The first player skips their draw on turn 1.":"You will draw a card on your first turn."}</p><button class="wide primary cres hidden" data-a="tomull">Continue</button></div>`;
  setTimeout(()=>root.querySelectorAll(".cres").forEach(x=>x.classList.remove("hidden")),1300);sfx("flip")}
function renderMull(){const ms=S.pp?S.mullSeat:0,p=S.st.players[ms],n=S.mullSel.size;
  if(S.pp&&S.shown!==ms){root.innerHTML=handoff(ms,"Opening hand");return}
  root.innerHTML=bar(S.pp?PN(ms)+": opening hand":"Opening hand")+`<div class="pbody"><p class="meta">Tap any cards you want to put back. They go to the bottom of your deck, you draw the same number, then your deck is shuffled.</p>
  <div class="bgrid">${p.hand.map(h=>`<button class="bcard ${S.mullSel.has(h.uid)?"out":""}" data-a="mtog" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}"><span class="mcost">${h.card.cost}</span>${S.mullSel.has(h.uid)?`<span class="sb van">PUT BACK</span>`:""}</button>`).join("")}</div>
  <button class="wide primary" data-a="mdone">${n?"Put back "+n+" and draw "+n:"Keep this hand"}</button></div>`}

/* ---- board ---- */
// Viewer seat: 0 vs the AI; in pass-and-play it follows the active player (or whoever must answer a pending choice).
const ME=()=>!S.pp||!S.st?0:(S.st.pending&&S.st.winner==null?S.st.pending.pi:S.st.active),OP=()=>1-ME();
const SEAT=pos=>pos===0?ME():OP(); // board position (0 bottom, 1 top) -> seat
const aiTurn=()=>!S.pp&&S.st&&S.st.active===1&&S.st.winner==null;
const PN=i=>S.pp?(S.names||["Player 1","Player 2"])[i]:i===0?"You":"AI";
const myTurn=()=>S.st&&S.st.active===ME()&&S.st.winner==null&&!S.st.pending;
function legalFor(uid){return myTurn()?E.legalActions(S.st).filter(a=>a.uid===uid):[]}
function canAct(x){return legalFor(x.uid).some(a=>a.t!=="ink")}
function cardTile(x,pos,size){const pi=SEAT(pos);const c=x.card,st=S.st,tm=S.tm;
  const isT=tm&&tm.targets.has(x.uid),sel=S.sel===x.uid,glow=pi===ME()&&!tm&&myTurn()&&canAct(x);
  const drying=c.type==="character"&&!E.dry(st,x)&&!K0(x,"rush");
  return`<button class="ct ${size} ${x.exerted?"ex":""} ${sel?"sel":""} ${isT?"tgt":""} ${glow?"glow":""} ${tm&&!isT?"dim":""}" data-a="tile" data-uid="${x.uid}">
   <span class="art"><img src="${esc(c.img)}" alt="${esc(c.full)}" loading="lazy"></span>
   ${x.damage?`<span class="dtok">${x.damage}</span>`:""}${drying&&pi===st.active?`<span class="dry">DRYING</span>`:""}
   ${c.type==="character"?`<span class="stats"><b>${E.strOf(x)}</b><i>${c.wil-x.damage}</i></span>`:c.type==="location"?`<span class="stats"><i>${c.wil-x.damage}</i></span>`:""}
   ${x.at?`<span class="atl">AT ${esc((E.find(st,x.at)?.inst.card.name||"").slice(0,10).toUpperCase())}</span>`:""}${x.under&&x.under.length?`<span class="und">+${x.under.length}</span>`:""}</button>`}
const K0=(x,k)=>E.K?E.K(x,k):x.card.kw[k];
function lorePips(n){let h="";for(let i=1;i<=20;i++)h+=`<i class="${i<=n?"on":""}"></i>`;return h}
const ICO={menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
 ink:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z" fill="currentColor"/></svg>',
 deck:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9 22h9a2 2 0 0 0 2-2V7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
 disc:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
 hand:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="9" height="13" rx="2" transform="rotate(-12 7 12)" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="11" y="5" width="9" height="13" rx="2" transform="rotate(10 15 11)" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>'};
function hud(pos){const pi=SEAT(pos),p=S.st.players[pi],ink=E.inkAvail(p);
  return`<div class="hud h${pos}">${pos===1?`<button class="mbtn" data-a="pause" aria-label="Menu">${ICO.menu}</button>`:""}
   <div class="loretrk" id="lore-${pos}"><b>${p.lore}</b><div><span>${S.pp?esc(PN(pi)).toUpperCase():pos===1?"AI · "+LEVELS[SET.level].toUpperCase()+(SET.style!=="balanced"?" · "+STYLES[SET.style].toUpperCase():""):"YOUR LORE"}</span><div class="pips">${lorePips(p.lore)}</div></div></div>
   <div class="chips"><div class="chip ink pile" id="ink-${pos}" title="Ink ready / total">${ICO.ink}<b>${ink}<small>/${p.ink.length}</small></b></div>
   <div class="chip pile" id="deck-${pos}" title="Deck">${ICO.deck}<b>${p.deck.length}</b></div>
   <button class="chip pile disc" data-a="disc" data-pi="${pi}" id="disc-${pos}" aria-label="Discard pile">${ICO.disc}<b>${p.discard.length}</b></button>
   ${pos===1?`<div class="chip pile" id="hand-1" title="Hand">${ICO.hand}<b>${p.hand.length}</b></div>`:`<div class="chip pile" id="inkable-0" title="Inkable cards in hand">${ICO.ink}<b>${p.hand.filter(h=>h.card.inkable).length}<small> inkable</small></b></div>`}</div>
  </div>`}
function zone(pos){const pi=pos,p=S.st.players[SEAT(pos)],ch=p.play.filter(x=>x.card.type==="character"),it=p.play.filter(x=>x.card.type!=="character");
  return`<div class="zone z${pi}">${pi===0&&it.length?`<div class="strip">${it.map(x=>cardTile(x,pi,"sm")).join("")}</div>`:""}
   <div class="row chars r${pi}">${ch.map(x=>cardTile(x,pi,"lg")).join("")||`<span class="rowlbl">${pi===0?(S.pp?esc(PN(ME()))+"'s characters":"Your characters"):(S.pp?esc(PN(OP()))+"'s characters":"Opponent characters")}</span>`}</div>
   ${pi===1&&it.length?`<div class="strip">${it.map(x=>cardTile(x,pi,"sm")).join("")}</div>`:""}</div>`}
function fitBoard(again){const gb=root.querySelector(".gb");if(!gb)return;
  const rowsC=[...gb.querySelectorAll(".row.chars")];rowsC.forEach(r=>{r.style.setProperty("--ch","40px");r.classList.remove("wrap")});void gb.offsetHeight; // measure free space, not current content
  if(!again)requestAnimationFrame(()=>fitBoard(true));
  for(const r of rowsC){const tiles=[...r.children].filter(x=>x.classList.contains("ct"));if(!tiles.length)continue;
    const cs0=getComputedStyle(r),H=r.clientHeight-(parseFloat(cs0.paddingTop)+parseFloat(cs0.paddingBottom)),W=r.clientWidth-(parseFloat(cs0.paddingLeft)+parseFloat(cs0.paddingRight))-2,g=8,n=tiles.length,exr=tiles.filter(t=>t.classList.contains("ex")).length/n,u=.716+(1-.716)*exr;
    let best=0,rows=1;for(let k=1;k<=3;k++){const per=Math.ceil(n/k),h=Math.min((H-g*(k-1))/k,(W-g*(per-1))/(per*u+.15),165);if(h>best+6){best=h;rows=k}}
    // Too tight to wrap legibly: one full-height row that scrolls sideways (wrapping rows would clip above the zone).
    let sc=false;if(best<70||rows>1&&rows*best+g*(rows-1)>H+1){const h1=Math.min(H,165);if(h1>=best||best<70){best=Math.max(56,h1);rows=1;sc=n*(best*u+g)>W+1}}
    r.style.setProperty("--ch",Math.floor(best)+"px");r.classList.toggle("wrap",rows>1);r.classList.toggle("scroll",sc)}
  for(const s of gb.querySelectorAll(".strip"))s.style.setProperty("--ch","56px");
  const hd=gb.querySelector(".hand2");if(hd){hd.classList.toggle("big",hd.children.length>=8);const cs=[...hd.children],n=cs.length,W=hd.clientWidth-40,w=cs[0]?cs[0].offsetWidth:78;
    let ov=n>1?Math.max(0,(n*w-W)/(n-1)):0;ov=Math.min(ov,w-(n>=8?36:44));hd.style.setProperty("--ov",(-ov)+"px");hd.classList.toggle("scroll",n*w-(n-1)*ov>W+1);
    cs.forEach((c,i)=>{const k=n>1?i/(n-1)-.5:0;c.style.setProperty("--rot",(k*(n>3?5:3)).toFixed(2)+"deg");c.style.setProperty("--dy",(Math.abs(k)*k*0+k*k*10).toFixed(1)+"px");c.style.zIndex=c.classList.contains("sel")?50:i+1})}}
addEventListener("resize",()=>{if(S.screen==="board")fitBoard()});
function banner(){const st=S.st;if(st.winner!=null)return`<div class="banner over2">GAME OVER</div>`;
  if(S.tm)return`<div class="banner tm"><span>${esc(S.tm.label)}</span><button class="bbtn" data-a="cancel">Cancel</button></div>`;
  const my=st.active===ME();const canEnd=my&&!st.pending&&E.legalActions(st).some(a=>a.t==="end");
  const ml=st.players[ME()].lore,ol=st.players[OP()].lore,race=ml===ol?"Tied "+ml+"–"+ol:ml>ol?(S.pp?esc(PN(ME())):"You")+" ahead "+ml+"–"+ol:(S.pp?esc(PN(OP())):"AI")+" ahead "+ol+"–"+ml;
  return`<div class="banner ${my?"mine":"theirs"}"><div><b>${S.pp?esc(PN(st.active)).toUpperCase()+"'S TURN":my?"YOUR TURN":"AI TURN"}</b><small>Turn ${st.turnNo} · ${race} · ${my?(st.players[ME()].inked?"Ink used":"Ink available"):"AI is playing"}</small></div>
   ${my||S.pp?`<button class="endbtn" data-a="end" ${canEnd?"":"disabled"}>${canEnd?"End turn":"Must challenge"}</button>`:`<span class="thinking"><i></i><i></i><i></i></span>`}</div>`}
function actionBar(){
  if(!S.sel||S.tm)return"";const f=E.find(S.st,S.sel);if(!f)return"";const acts=legalFor(S.sel);
  const g=groupActs(acts);const btn=(k,l,cls="")=>`<button class="ab ${cls}" data-a="grp" data-k="${k}">${l}</button>`;
  let h="";
  if(g.play)h+=btn("play",`Play <small>${E.costOf(S.st,ME(),f.inst.card)} ink</small>`,"pri");
  if(g.quest)h+=btn("quest",`Quest <small>+${E.loreOf(f.inst)}</small>`,"pri");
  if(g.challenge)h+=btn("challenge","Challenge","red");
  if(g.shift)h+=btn("shift",`Shift <small>${f.inst.card.kw.shift} ink</small>`);
  if(g.sing)h+=btn("sing","Sing");if(g.singT)h+=btn("singT","Sing together");
  if(g.act)h+=btn("act","Ability");if(g.move)h+=btn("move","Move");if(g.boost)h+=btn("boost",`Boost <small>${f.inst.card.kw.boost}</small>`);
  if(g.ink)h+=btn("ink","Ink it","ink");
  h+=`<button class="ab ghost" data-a="zoom" data-uid="${S.sel}">Details</button>`;
  return`<div class="abar">${h}</div>`}
function groupActs(acts){const g={};for(const a of acts){let k=a.t;if(a.t==="play")k=a.shift!=null?"shift":a.singer!=null?"sing":a.singers?"singT":"play";(g[k]=g[k]||[]).push(a)}return g}
function renderBoard(){
  const st=S.st;if(S.pp&&st.winner==null&&S.shown!==ME()){clearFx();root.innerHTML=handoff(ME(),st.pending&&st.pending.pi!==st.active?"Your choice":"Your turn");return}
  const me=st.players[ME()];
  const rects=snapRects();
  root.innerHTML=`<div class="gb">
   ${hud(1)}${zone(1)}
   ${banner()}
   ${zone(0)}${hud(0)}
   <div class="handwrap">${actionBar()}<div class="hand2">${me.hand.map(h=>{const pl=myTurn()&&!S.tm&&legalFor(h.uid).some(a=>a.t==="play");const ik=myTurn()&&!S.tm&&!me.inked&&h.card.inkable;
     return`<button class="hc ${pl?"play":""} ${S.sel===h.uid?"sel":""} ${S.tm?"dim":""}" data-a="tile" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}"><span class="mcost">${E.costOf(st,ME(),h.card)}</span>${h.card.inkable?`<span class="inkable" title="Inkable"></span>`:""}${badge(h.card)}${ik&&!pl?"":""}</button>`}).join("")}</div></div>
   <div id="toast" class="toast"></div></div>
   ${st.pending&&st.pending.pi===ME()&&st.human[st.pending.pi]&&st.winner==null?discardPrompt():""}${st.winner!=null?endScreen():""}`;
  fitBoard();if(st.winner!=null){clearFx();st.events=[]}else animate(rects);if(window.FX)FX.mode("board");tickLore();if(st.winner!=null&&!S.celebrated){S.celebrated=true;if((S.pp||st.winner===0)&&window.FX)setTimeout(FX.celebrate,300)}if(st.winner==null)S.celebrated=false;
  if(SET.tips&&!S.tipShown&&st.winner==null){S.tipShown=true;setTimeout(()=>tip(0),400)}
}
function discardPrompt(){return pickerSheet()}
// One bottom-sheet picker for every choice the engine asks the player to make (st.pending with pi 0).
function pickerSheet(){const st=S.st,P=st.pending,p=st.players[ME()];if(!P)return"";
  const key=st.log.length+":"+(P.why||"")+":"+(P.src||"");if(S.pkKey!==key){S.pkKey=key;S.pkSel=[];S.pkMin=false}
  let head=P.src||"",prompt=P.why||"Make a choice",items=[],multi=false,btn="",sub="";
  const cardBtn=(c,attrs,cls,extra,i)=>`<span class="pkcw"><button class="pkc ${cls||""}" ${attrs} ${c.uid!=null?`data-zuid="${c.uid}"`:""}><img src="${esc(c.card?c.card.img:c.img)}" alt="${esc(c.card?c.card.full:c.full)}">${extra||""}</button>${i!=null?`<button class="pkz" data-a="pkz" data-i="${i}" aria-label="Zoom card"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>`:""}</span>`;
  if(P.kind==="ask"){const n=P.n,min=P.min;multi=n>1;
    if(P.reveal){sub=`${P.opts.length} card${P.opts.length===1?"":"s"}`;btn=`<button class="wide primary" data-a="pkok">OK</button>`}
    else{sub=multi?`Choose ${min<n?"up to ":""}${n} (${S.pkSel.length} selected)`:(min===0?"Choose one, or skip":"Choose one");
      if(multi)btn=`<button class="wide primary" data-a="pkgo" ${S.pkSel.length>=min&&S.pkSel.length>0||min===0?"":"disabled"}>${S.pkSel.length?"Confirm":"Choose none"}</button>`;
      else if(min===0)btn=`<button class="wide" data-a="pkskip">Skip</button>`}
    items=P.opts.map((o,i)=>{const sel=S.pkSel.includes(i),dis=o.dis||P.reveal;
      if(o.card){const own=o.owner!=null&&o.owner!==ME()?`<span class="pkown">Opponent</span>`:"";
        return cardBtn(o,dis?"disabled":`data-a="pkpick" data-i="${i}"`,(sel?"sel ":"")+(o.dis?"out":""),`${own}${o.label?`<span class="pklab">${esc(o.label)}</span>`:""}`,i)}
      return`<button class="pkopt ${sel?"sel":""}" ${dis?"disabled":`data-a="pkpick" data-i="${i}"`}>${esc(o.label)}</button>`})}
  else if(P.kind==="dig"||P.kind==="free"){const cards=(P.kind==="dig"?P.top.map(u=>p.deck.find(d=>d.uid===u)):P.opts.map(u=>p.hand.find(h=>h.uid===u))).filter(Boolean);
    sub=P.kind==="dig"?"Glowing cards can go to your hand; the rest go "+(P.rest==="discard"?"to your discard":P.rest==="top"?"back on top":"to the bottom of your deck"):"Tap a card to play it for free";
    items=cards.map(c=>{const ok=P.opts.includes(c.uid);return cardBtn(c,ok?`data-a="ppick" data-uid="${c.uid}"`:"disabled",ok?"in":"out")});btn=`<button class="wide" data-a="pdone">${P.kind==="dig"?"Done":"Skip"}</button>`}
  else{sub=`Tap a card to discard it (${P.n} left)`;items=p.hand.map(h=>cardBtn(h,`data-a="pdisc" data-uid="${h.uid}"`))}
  {const nm=head.split(" - ")[0];for(const k of [head,nm])if(k&&prompt.startsWith(k+": ")){prompt=prompt.slice(k.length+2);break}}
  const thumb=P.srcCard&&P.kind==="ask"&&(P.reveal||P.opts.every(o=>!o.card))?`<img class="pkthumb" src="${esc(P.srcCard.img)}" alt="${esc(P.srcCard.full)}" data-a="pkzoom">`:"";
  const lab=items.length&&P.opts&&P.opts.every&&P.kind==="ask"&&P.opts.every(o=>!o.card);
  return`<div class="pkscrim ${S.pkMin?"min":""}"></div><div class="pk ${S.pkMin?"min":""}" role="dialog" aria-label="${esc(prompt)}">
    <button class="pkbar" data-a="pkmin">${S.pkMin?"Show choice":"Hide to see the board"}</button>
    ${thumb}${head?`<div class="pksrc">${esc(head)}</div>`:""}<div class="pkq">${esc(prompt.charAt(0).toUpperCase()+prompt.slice(1))}</div>${sub?`<div class="pksub">${esc(sub)}</div>`:""}
    <div class="${lab?"pkopts":"pkgrid"}">${items.join("")}</div>${btn}</div>`}
function handoff(seat,what){return`<div class="handoff"><div class="hbox"><div class="hico">${ICO.hand}</div><h2>Pass to ${esc(PN(seat))}</h2><p class="meta">${esc(what)}. ${esc(PN(1-seat))}, look away while ${esc(PN(seat))} takes the phone.</p><button class="wide primary" data-a="handoff" data-v="${seat}">I'm ${esc(PN(seat))}, show my cards</button></div></div>`}
function endScreen(){const st=S.st,w=S.pp||st.winner===0,s0=(st.stats||[{},{}])[0],s1=(st.stats||[{},{}])[1];
  const rowS=(l,a,b)=>`<tr><td>${l}</td><td>${a||0}</td><td>${b||0}</td></tr>`;
  return`<div class="modal end ${w?"won":"lost"}"><div class="cine" aria-hidden="true"><div class="rays"></div><div class="ctitle">${w?"VICTORY":"DEFEAT"}</div></div><div class="mbox"><h2 class="${w?"win":"lose"}">${S.pp?esc(PN(st.winner))+" wins":w?"Victory":"Defeat"}</h2><p class="meta">${esc(st.log[st.log.length-1]||"")}</p>
  <table class="stt"><tr><th></th><th>${esc(PN(0))}</th><th>${esc(PN(1))}</th></tr>${rowS("Lore",st.players[0].lore,st.players[1].lore)}${rowS("Cards played",s0.play,s1.play)}${rowS("Quests",s0.quest,s1.quest)}${rowS("Challenges",s0.challenge,s1.challenge)}${rowS("Characters banished",s0.banished,s1.banished)}<tr><td>Turns</td><td colspan="2">${st.turnNo}</td></tr></table>
  <button class="wide primary" data-a="again">Rematch</button><button class="wide" data-a="tomenu">Change decks</button></div></div>`}
/* ---- animation & feedback ---- */
function snapRects(){const m=new Map();root.querySelectorAll("[data-uid]").forEach(e=>{m.set(+e.dataset.uid,{r:e.getBoundingClientRect(),html:e.querySelector("img")?.outerHTML||"",ex:e.classList.contains("ex"),dmg:+(e.querySelector(".dtok")?.textContent||0),hand:e.classList.contains("hc")})});
  for(const id of["lore-0","lore-1","ink-0","ink-1","deck-0","deck-1","disc-0","disc-1","hand-1"]){const e=document.getElementById(id);if(e)m.set(id,{r:e.getBoundingClientRect()})}return m}
function ghost(r,html,cls){const g=document.createElement("div");g.className="ghost "+(cls||"");g.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;g.innerHTML=html;document.body.appendChild(g);GH.add(g);const kill=()=>{g.remove();GH.delete(g)};g.addEventListener("animationend",kill);g._t=setTimeout(kill,2500);return g}
const GH=new Set();function clearFx(){for(const g of GH){clearTimeout(g._t);g.getAnimations&&g.getAnimations().forEach(a=>a.cancel());g.remove()}GH.clear();document.querySelectorAll(".ghost,.ftext").forEach(x=>x.remove())}
function floatText(r,text,cls){const g=document.createElement("div");g.className="ftext "+cls;g.textContent=text;g.style.left=(r.left+r.width/2)+"px";g.style.top=(r.top+r.height/3)+"px";document.body.appendChild(g);setTimeout(()=>g.remove(),1300);return g}
const elOf=u=>root.querySelector(`[data-uid="${u}"]`),rectOf=(m,u)=>m.get(u)?.r||elOf(u)?.getBoundingClientRect();
const fxp=(el,o)=>{if(window.FX&&el)FX.at(el,o)};
function tickLore(){S.lastLore=S.lastLore||[null,null];for(const pi of[0,1]){const el=document.querySelector(`#lore-${pi} b`);if(!el)continue;const v=S.st.players[pi].lore,o=S.lastLore[pi];S.lastLore[pi]=v;if(o==null||o===v||(window.FX&&FX.low)){continue}const t0=performance.now(),d=700;el.textContent=o;const step=t=>{const k=Math.min(1,(t-t0-450)/d);if(k>=0)el.textContent=Math.round(o+(v-o)*k);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}}
const lowA=()=>document.body.classList.contains("lowfx")||(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
const ctr=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
const BACK='<span class="cback"></span>';
function flyGhost(from,to,html,o={}){const g=ghost(from,html,o.cls||"");const d=ctr(to),f=ctr(from),sx=to.width/from.width;
  return g.animate([{transform:o.t0||"none",opacity:1},{transform:`translate(${d.x-f.x}px,${d.y-f.y}px) scale(${sx}) ${o.t1||""}`,opacity:o.o1??1}],{duration:o.dur||520,delay:o.delay||0,easing:o.ease||"cubic-bezier(.4,0,.2,1)",fill:"both"})}
function shatter(o,to,slow){const N=6;const polys=["0 0,55% 0,40% 45%,0 35%","55% 0,100% 0,100% 40%,40% 45%","0 35%,40% 45%,30% 100%,0 100%","40% 45%,100% 40%,100% 70%,65% 100%,30% 100%","100% 70%,100% 100%,65% 100%","0 0,0 0,0 0"];
  for(let i=0;i<N-1;i++){const g=ghost(o.r,o.html,"shard");g.style.clipPath=`polygon(${polys[i]})`;const ang=(i/(N-1))*6.28,dx=Math.cos(ang)*40,dy=Math.sin(ang)*40-10,rot=(i%2?1:-1)*(25+i*9);
    const t=to?ctr(to):null,f=ctr(o.r);const kf=[{transform:"none",opacity:1,filter:"none"},{transform:`translate(${dx}px,${dy}px) rotate(${rot}deg)`,opacity:1,filter:"brightness(1.4)",offset:.35}];
    if(t)kf.push({transform:`translate(${t.x-f.x}px,${t.y-f.y}px) rotate(${rot*2}deg) scale(.25)`,opacity:0,filter:"grayscale(1)"});else kf.push({transform:`translate(${dx*2}px,${dy*2+40}px) rotate(${rot*2}deg)`,opacity:0});
    g.animate(kf,{duration:900*slow,delay:300*slow,easing:"cubic-bezier(.3,.1,.3,1)",fill:"both"})}}
function turnSweep(mine){if(lowA())return;const d=document.createElement("div");d.className="tsweep "+(mine?"mine":"theirs");d.innerHTML=`<span>${mine?"YOUR TURN":"AI TURN"}</span>`;document.body.appendChild(d);GH.add(d);d._t=setTimeout(()=>{d.remove();GH.delete(d)},1500)}
function animate(old){const evs=(S.st.events||[]).splice(0);const slow=SET.speed==="slow"?1.4:SET.speed==="fast"?.7:1;const L=lowA();
  // state-diff tweens: exert/ready rotation, damage pop
  if(!L)for(const [u,o] of old){if(typeof u!=="number")continue;const el=elOf(u);if(!el||!el.classList.contains("ct"))continue;const ex=el.classList.contains("ex");
    if(o.ex!==ex){const art=el.querySelector(".art");art&&art.animate([{transform:ex?"translate(-50%,-50%) rotate(0deg)":"rotate(90deg) scale(.8)"},{transform:ex?"translate(-50%,-50%) rotate(90deg)":"none"}],{duration:380*slow,easing:"cubic-bezier(.3,1.3,.5,1)"});if(!ex)el.classList.add("readied")}
    const tok=el.querySelector(".dtok");if(tok&&+tok.textContent!==o.dmg)tok.animate([{transform:"scale(0)"},{transform:"scale(1.6)",offset:.6},{transform:"scale(1)"}],{duration:450,delay:300*slow,easing:"ease-out",fill:"backwards"})}
  if(!evs.length)return;
  for(const e of evs){
    if(e.t==="play"){const el=elOf(e.uid),o=old.get(e.uid);if(el){
        if(!L&&e.pi===1&&el.classList.contains("ct")){const from=old.get("hand-1")?.r||document.getElementById("hand-1")?.getBoundingClientRect();const to=el.getBoundingClientRect();
          if(from){el.style.opacity="0";const fr={left:from.left,top:from.top,width:to.width*.5,height:to.height*.5};const a=flyGhost(fr,to,BACK,{dur:480*slow,t1:"rotateY(90deg)"});a.onfinish=()=>{a.effect.target.remove();el.style.opacity="";el.classList.add("enter","flipin")}}}
        else el.classList.add("enter");
        setTimeout(()=>fxp(el,{n:22,colors:[FX.COL.gold,FX.COL.ink],speed:2.4}),e.pi===1&&!L?520*slow:180)}sfx("play")}
    if(e.t==="ink"){const ch=document.getElementById("ink-"+e.pi);setTimeout(()=>{fxp(ch,{n:16,color:"blue",speed:1.6,gravity:-.02});ch&&ch.classList.add("fill")},450*slow);
      const o=old.get(e.uid),to=ch?.getBoundingClientRect();if(o&&to&&!L){const a=flyGhost(o.r,to,o.html,{dur:600*slow,t1:"rotate(180deg)",o1:.2,ease:"ease-in"});a.onfinish=()=>a.effect.target.remove()}sfx("ink")}
    if(e.t==="quest"){const r=rectOf(old,e.uid),to=document.getElementById("lore-"+e.pi)?.getBoundingClientRect();if(r&&to&&window.FX)FX.flyTo(r.left+r.width/2,r.top+r.height/2,to.left+to.width/2,to.top+to.height/2,{n:10+4*e.n});if(r&&to){const g=floatText(r,"+"+e.n,"lore");g.animate([{transform:"translate(-50%,0) scale(1)"},{transform:`translate(calc(-50% + ${to.left+to.width/2-r.left-r.width/2}px),${to.top-r.top-r.height/3}px) scale(.6)`,opacity:.3}],{duration:900*slow,easing:"cubic-bezier(.5,0,.6,1)",fill:"forwards"})}sfx("quest")}
    if(e.t==="lore"){const l=document.getElementById("lore-"+e.pi);if(l){l.animate([{transform:"scale(1)"},{transform:"scale(1.25)"},{transform:"scale(1)"}],{duration:500,delay:500*slow});setTimeout(()=>fxp(l.querySelector("b"),{n:18,colors:[FX.COL.gold,FX.COL.white],speed:2,up:.5}),1100*slow)}}
    if(e.t==="challenge"){const a=rectOf(old,e.a),d=rectOf(old,e.d),el=elOf(e.a);if(a&&d){const dx=(d.left-a.left)*.7,dy=(d.top-a.top)*.7;
      (el||ghost(a,old.get(e.a)?.html||"","")).animate([{transform:"none"},{transform:`translate(${dx}px,${dy}px) scale(1.08)`,offset:.45},{transform:"none"}],{duration:650*slow,easing:"ease-in-out"});
      const de=elOf(e.d);de&&de.animate([{transform:"none"},{transform:"translateX(-5px) rotate(-2deg)",offset:.5},{transform:"translateX(4px)",offset:.65},{transform:"none"}],{duration:650*slow})}sfx("hit")}
    if(e.t==="damage"){const r=rectOf(old,e.uid);if(r)setTimeout(()=>{floatText(r,"-"+e.n,"dmg");if(window.FX)FX.burst(r.left+r.width/2,r.top+r.height/2,{n:14+4*e.n,colors:[FX.COL.red,FX.COL.white],speed:3})},300*slow)}
    if(e.t==="banish"){const o=old.get(e.uid);if(o&&window.FX)setTimeout(()=>FX.burst(o.r.left+o.r.width/2,o.r.top+o.r.height/2,{n:30,colors:[FX.COL.ink,"60,40,140"],speed:1.6,gravity:-.03,size:3,smoke:true}),350*slow);
      if(o&&!elOf(e.uid)){const to=document.getElementById("disc-"+e.pi)?.getBoundingClientRect();if(L){const g=ghost(o.r,o.html,"ban");g.animate([{opacity:1},{opacity:0}],{duration:400,fill:"forwards"})}else shatter(o,to,slow)}sfx("ban")}
    if(e.t==="draw"){const el=elOf(e.uid),dk=old.get("deck-"+e.pi)?.r||document.getElementById("deck-"+e.pi)?.getBoundingClientRect();
      if(e.pi===ME()&&el){if(L||!dk){el.classList.add("drawn")}else{const to=el.getBoundingClientRect();el.style.visibility="hidden";const a=flyGhost({left:dk.left,top:dk.top,width:to.width*.45,height:to.height*.45},to,BACK,{dur:380*slow,t1:"rotateY(90deg)"});
        a.onfinish=()=>{a.effect.target.remove();el.style.visibility="";el.animate([{transform:"rotateY(-90deg)"},{transform:"rotateY(0)"}],{duration:260*slow,easing:"ease-out"})}}}
      if(e.pi===1&&!L&&dk){const h=document.getElementById("hand-1")?.getBoundingClientRect();if(h){const a=flyGhost({left:dk.left,top:dk.top,width:28,height:39},{left:h.left,top:h.top,width:28,height:39},BACK,{dur:420*slow});a.onfinish=()=>a.effect.target.remove()}}}
    if(e.t==="turn"){const b=root.querySelector(".banner");if(b){b.classList.remove("sweep");void b.offsetWidth;b.classList.add("sweep")}b&&b.animate([{transform:"scaleX(.6)",opacity:.2},{transform:"none",opacity:1}],{duration:400});turnSweep(e.pi===ME());sfx("turn")}
  }}
let AC=null;function sfx(k){if(!SET.sound)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();
  const f={play:440,ink:330,quest:660,hit:160,ban:110,turn:520,flip:600}[k]||400;o.frequency.value=f;o.type=k==="hit"||k==="ban"?"square":"sine";g.gain.value=.06;g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+.25);o.connect(g).connect(AC.destination);o.start();o.stop(AC.currentTime+.26)}catch(e){}}
function toast(msg){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.classList.remove("show");void t.offsetWidth;t.classList.add("show")}
function describe(a,st){const n=u=>E.find(st,u)?.inst.card.full||"";switch(a.t){case"ink":return"AI puts a card into its inkwell";case"play":return a.singer!=null?`AI sings ${n(a.uid)}`:a.shift!=null?`AI shifts ${n(a.uid)}`:`AI plays ${n(a.uid)}`;
  case"quest":return`AI quests with ${n(a.uid)}`;case"challenge":return`AI challenges ${n(a.target)} with ${n(a.uid)}`;case"move":return`AI moves ${n(a.uid)} to ${n(a.loc)}`;case"act":return`AI uses ${n(a.uid)}'s ability`;case"boost":return`AI boosts ${n(a.uid)}`;case"end":return"AI ends its turn";case"discard":return"AI discards a card"}return""}
/* ---- player interaction ---- */
function doAct(a){S.sel=null;S.tm=null;closeSheet();try{E.act(S.st,a)}catch(e){console.error(e);toast("That move is not allowed")}renderBoard();if(aiTurn()&&S.st.winner==null)aiLoop()}
function startTargeting(list,key,label){
  if(list.length===1&&(list[0][key]==null)){doAct(list[0]);return}
  const withT=list.filter(a=>a[key]!=null);if(!withT.length){doAct(list[0]);return}
  S.tm={list:withT,key,label,targets:new Set(withT.map(a=>a[key])),none:list.find(a=>a[key]==null)};renderBoard();
  if(S.tm.none)toast("No legal target? Tap Cancel and play it without one.");
}
function choose(title,opts){ // opts: [{label,fn,cls}]
  sheet(`<h4>${esc(title)}</h4>${opts.map((o,i)=>`<button class="wide ${o.cls||""}" data-a="chs" data-i="${i}">${esc(o.label)}</button>`).join("")}<button class="wide ghostw" data-a="close">Cancel</button>`);S.chs=opts}
function runGroup(k){const acts=groupActs(legalFor(S.sel))[k];if(!acts)return;const f=E.find(S.st,S.sel),c=f.inst.card;
  if(k==="ink"||k==="boost")return doAct(acts[0]);
  if(k==="challenge")return startTargeting(acts,"target",`Choose a character or location to challenge with ${c.name}`);
  if(k==="move")return startTargeting(acts,"loc",`Choose a location for ${c.name}`);
  if(k==="shift")return startTargeting(acts,"shift",`Choose which ${c.name} to shift onto`);
  if(k==="sing")return startTargeting(acts,"singer",`Choose a character to sing ${c.name}`);
  if(k==="singT")return doAct(acts[0]);
  if(k==="act"){const idx=[...new Set(acts.map(a=>a.i))];if(idx.length>1)return choose("Which ability?",idx.map(i=>({label:(E.actsOf(f.inst)[i].ink?E.actsOf(f.inst)[i].ink+" ink: ":"")+"Ability "+(i+1),fn:()=>effectFlow(acts.filter(a=>a.i===i),c)})));return effectFlow(acts,c)}
  if(k==="quest"){if(c.kw.support&&S.st.players[ME()].play.filter(x=>x.card.type==="character"&&x.uid!==S.sel).length){const base=acts[0];
      return startTargeting(S.st.players[ME()].play.filter(x=>x.card.type==="character"&&x.uid!==S.sel).map(x=>({...base,support:x.uid})),"support",`Support: choose a character to get +${E.strOf(f.inst)} strength`)}
    return effectFlow(acts,c)}
  if(k==="play"){const ex=acts.filter(a=>a.exerted),rd=acts.filter(a=>!a.exerted);
    if(ex.length)return choose(`${c.name} has Bodyguard`,[{label:"Enter play ready",fn:()=>effectFlow(rd,c),cls:"primary"},{label:"Enter play exerted (protects your other characters)",fn:()=>effectFlow(ex,c)}]);
    return effectFlow(acts,c)}
}
function effectFlow(acts,c){
  const dec=acts.find(a=>a.decline),rest=acts.filter(a=>!a.decline);
  const modes=[...new Set(rest.map(a=>a.mode).filter(m=>m!=null))];
  const go=list=>startTargeting(list,"target",`Choose a target for ${c.name}`);
  const afterMode=list=>{if(dec)return choose("Use the optional effect?",[{label:"Yes, use it",fn:()=>go(list),cls:"primary"},{label:"No, skip it",fn:()=>doAct(dec)}]);go(list)};
  if(modes.length>1){const md=[...c.onPlay,...c.acts.flatMap(a=>a.eff),...c.onQuest].find(e=>e.k==="modal");
    return choose("Choose one",modes.map(m=>({label:md&&md.optText?md.optText[m]:"Option "+(m+1),fn:()=>afterMode(rest.filter(a=>a.mode===m))})))}
  afterMode(rest);
}

function longZoom(t){const u=t.dataset.zuid??t.dataset.uid;if(t.dataset.a==="bview1"){const c=byId.get(t.dataset.id);if(c)zoomCard(c,t);return}if(u!=null&&S.st){const f=E.find(S.st,+u);if(f){zoom(+u,t);return}}}
function zoomCard(c,from,o={}){if(!window.Zoom)return;Zoom.open(Object.assign({card:c,img:c.img,large:c.imgLarge,from},o))}
function instState(f){const x=f.inst,st=S.st,c=x.card,out=[];if(f.zone!=="play")return out;
  if(x.damage)out.push({t:x.damage+" damage",cls:"bad"});out.push(x.exerted?{t:"Exerted",cls:"bad"}:{t:"Ready",cls:"info"});
  if(c.type==="character"&&!E.dry(st,x)&&!K0(x,"rush"))out.push({t:"Drying",cls:"info"});
  if(x.at){const l=E.find(st,x.at);if(l)out.push({t:"At "+l.inst.card.name})}
  if(x.under&&x.under.length)out.push({t:x.under.length+" card"+(x.under.length>1?"s":"")+" under"});
  const kw=[...new Set((x.grants||[]).map(g=>g.kw))];for(const k of kw)out.push({t:"Gains "+String(k).replace(/\b\w/g,m=>m.toUpperCase())});
  if(c.type==="character"){const ds=E.strOf(x)-c.str;if(ds)out.push({t:(ds>0?"+":"")+ds+" STR this turn",cls:ds>0?"":"bad"});const dl=E.loreOf(x)-c.lore;if(dl)out.push({t:(dl>0?"+":"")+dl+" LORE",cls:dl>0?"":"bad"})}
  if(x.noReady)out.push({t:"Won't ready next turn",cls:"bad"});if(x.noQuest)out.push({t:"Can't quest",cls:"bad"});
  return out}
function zoom(uid,from,withActs){const f=E.find(S.st,uid);if(!f)return;const x=f.inst,c=x.card;
  from=from||elOf(uid);const live=f.zone==="play"?{str:E.strOf(x),wil:E.wilOf(x)-x.damage,lore:E.loreOf(x)}:null;
  const actions=[];if(withActs){const g=groupActs(legalFor(uid));const L={play:["Play",`${E.costOf(S.st,ME(),c)} ink`,"pri"],quest:["Quest",`+${E.loreOf(x)}`,"pri"],challenge:["Challenge","","red"],shift:["Shift",`${c.kw.shift} ink`,""],sing:["Sing","",""],singT:["Sing together","",""],act:["Ability","",""],move:["Move","",""],boost:["Boost",String(c.kw.boost||""),""],ink:["Ink it","","ink"]};
    for(const k of Object.keys(L))if(g[k])actions.push({key:k,label:L[k][0],sub:L[k][1],cls:L[k][2],fn:()=>{S.sel=uid;runGroup(k)}})}
  const extra=c.status&&!["full","keywords","plain"].includes(c.status)?`<div class="meta small">${esc(STATUS_LABEL[c.status]||"")}</div>`:"";
  zoomCard(c,from,{live,state:instState(f),actions,extra,note:withActs&&!actions.length?"":null});
  if(withActs&&!actions.length)toast(f.zone==="hand"?"You can't play this card right now":"This card can't act right now")}
function zoomOld(uid){const f=E.find(S.st,uid);if(!f)return;const x=f.inst;
  sheet(cardSheet(x.card,f.zone==="play"?`<div class="meta">${x.damage?x.damage+" damage · ":""}${x.exerted?"Exerted":"Ready"}${f.zone==="play"&&x.card.type==="character"?` · ${E.strOf(x)} STR now`:""}</div>`:"")+`<button class="wide" data-a="close">Close</button>`)}
function tapTile(uid){
  const st=S.st;
  if(S.tm){if(S.tm.targets.has(uid)){const a=S.tm.list.find(x=>x[S.tm.key]===uid);doAct(a)}else toast("Tap a glowing card, or Cancel");return}
  const f=E.find(st,uid);if(!f)return;
  if(f.pi!==ME()||!myTurn()){zoom(uid);return}
  S.sel=uid;renderBoard();zoom(uid,elOf(uid),true);
}
function afterPick(){S.pkSel=[];S.pkMin=false;if(S.screen!=="board")return;renderBoard();if(aiTurn()&&!S.st.pending&&S.st.winner==null)aiLoop()}
function aiLoop(){if(S.busy)return;S.busy=true;
  const step=()=>{const st=S.st;if(!st||S.screen!=="board"||st.winner!=null||S.paused){S.busy=false;if(st&&S.screen==="board")renderBoard();return}
    if(st.pending&&st.human[st.pending.pi]){S.busy=false;renderBoard();return} // wait for the player's discard
    if(S.pp||st.active!==1){S.busy=false;renderBoard();return}
    const a=E.aiChoose(st,AILV());if(!a){S.busy=false;return}
    if(a.uid!=null){const el=elOf(a.uid);if(el)el.classList.add("aifocus")}
    toast(describe(a,st));
    setTimeout(()=>{try{E.act(st,a)}catch(e){console.error(e);try{E.act(st,{t:"end"})}catch(_){}}renderBoard();setTimeout(step,a.t==="end"?SPEED[SET.speed]*.6:SPEED[SET.speed])},SPEED[SET.speed]*.45)};
  setTimeout(step,SPEED[SET.speed]*.6)}
const TIPS=["Your side is at the bottom: characters, then items and locations, then your lore, inkwell, deck and discard.","Cards in your hand that glow gold can be played now. The small drop icon means a card is inkable: select it and tap Ink it (once per turn).","Tap one of your characters to select it, then choose Quest or Challenge. Legal targets glow red; tap one to confirm.","Characters that are drying (just played) can't quest or challenge until your next turn. First to 20 lore wins. Hold a card or tap Details to read it."];
function tip(i){if(i>=TIPS.length){SET.tips=false;saveSet();closeSheet();return}sheet(`<h4>Tip ${i+1} of ${TIPS.length}</h4><p class="tiptext">${TIPS[i]}</p><button class="wide primary" data-a="tip" data-i="${i+1}">${i+1<TIPS.length?"Next":"Got it"}</button><button class="wide ghostw" data-a="tip" data-i="99">Skip tips</button>`)}
function settingsHtml(){const pill=(k,v,l)=>`<button class="opt ${SET[k]===v?"on":""}" data-a="set" data-k="${k}" data-v="${v}">${l}</button>`;
  return`<h4>AI difficulty</h4><div class="opts">${pill("level","easy","Easy")}${pill("level","normal","Normal")}${pill("level","hard","Hard")}</div>
  <h4>AI style</h4><div class="opts">${Object.entries(STYLES).map(([k,l])=>pill("style",k,l)).join("")}</div>
  <h4>AI speed</h4><div class="opts">${pill("speed","slow","Slow")}${pill("speed","normal","Normal")}${pill("speed","fast","Fast")}</div>
  <h4>Effects</h4><div class="opts"><button class="opt ${window.FX&&!FX.low?"on":""}" data-a="fxlow" data-v="0">Full</button><button class="opt ${window.FX&&FX.low?"on":""}" data-a="fxlow" data-v="1">Low power</button></div>
  <h4>Sound</h4><div class="opts">${pill("sound",false,"Off")}${pill("sound",true,"On")}</div>
  <h4>Tips</h4><div class="opts"><button class="opt" data-a="tipsagain">Show tips again</button></div>`}
function pauseMenu(){S.paused=true;sheet(`<h4>Game paused</h4><button class="wide primary" data-a="resume">Resume</button>${settingsHtml()}<button class="wide" data-a="concede">Concede</button><button class="wide ghostw" data-a="quitgame">Quit to menu</button>`)}
/* events */
function onInput(e){if(e.target.id==="bq"){S.build.q=e.target.value;S.build.limit=60;const pos=e.target.selectionStart;renderBuilder();const q=$("#bq");q.focus();q.setSelectionRange(pos,pos)}if(e.target.id==="bname")S.build.name=e.target.value}
function onClick(e){if(S.lp&&e.target.closest&&!e.target.closest('[data-a=tile]')){S.lp=false;e.preventDefault();return}const b=e.target.closest("[data-a]");if(!b)return;const a=b.dataset.a,v=b.dataset.v;
  switch(a){
    case"quit":if(S.screen==="builder"||S.screen==="mull"){S.screen="menu";render()}else if(S.screen==="board"&&S.st.winner==null&&!confirm("Quit this game?"))return;else if(S.screen==="board"){S.screen="menu";S.st=null;render()}else location.hash="";break;
    case"sel":S.deck=v;renderMenu();break;case"opp":S.opp=v;renderMenu();break;case"start":startGame();break;
    case"builder":{const sel=String(S.deck||"");if(sel[0]==="c"&&decks()[+sel.slice(1)]){const d=decks()[+sel.slice(1)];bInit({...d,idx:+sel.slice(1)})}else bInit();S.screen="builder";render();break}
    case"bview":S.build.view=v;renderBuilder();break;case"bink":S.build.ink=v;S.build.limit=60;renderBuilder();break;case"btype":S.build.type=v;S.build.limit=60;renderBuilder();break;
    case"bmore":S.build.limit+=60;renderBuilder();break;case"bclear":if(confirm("Remove all cards from this deck?")){S.build.cards={};renderBuilder()}break;
    case"bview1":builderSheet(b.dataset.id,b);break;
    case"badd":badd(b.dataset.id,+b.dataset.d);break;
    case"bsave":{const b2=S.build,n=bCount(),inks=bInks();if(n<60||inks.length>2){if(!confirm(`This deck has ${n} cards${inks.length>2?" and too many inks":""}. Save it anyway as a draft?`))return}
      const all=decks(),d={name:b2.name||"My deck",cards:b2.cards};if(b2.idx!=null)all[b2.idx]=d;else{all.push(d);b2.idx=all.length-1}saveDecks(all);S.deck="c"+b2.idx;S.screen="menu";render();break}
    case"mtog":{const u=+b.dataset.uid;S.mullSel.has(u)?S.mullSel.delete(u):S.mullSel.add(u);renderMull();break}
    case"mdone":{const go=()=>{E.mulligan(S.st,S.pp?S.mullSeat:0,[...S.mullSel]);S.mullSel=new Set();if(S.pp&&S.mullSeat===0){S.mullSeat=1;renderMull();return}S.st.events=[];S.screen="board";S.tipShown=false;renderBoard();if(aiTurn())aiLoop()};
      if(lowA()||!S.mullSel.size){go();break}
      const outs=[...root.querySelectorAll(".bcard.out")],dk={left:innerWidth/2-30,top:innerHeight-120,width:60,height:84};
      outs.forEach((el,i)=>{const r=el.getBoundingClientRect();el.style.visibility="hidden";const a=flyGhost(r,dk,el.querySelector("img").outerHTML,{dur:520,delay:i*70,t1:"rotate(12deg)"});a.onfinish=()=>a.effect.target.remove()});
      setTimeout(()=>{const sh=document.createElement("div");sh.className="shuffle";sh.innerHTML='<i></i><i></i><i></i>';document.body.appendChild(sh);GH.add(sh);sh._t=setTimeout(()=>{sh.remove();GH.delete(sh);go()},850)},520+outs.length*70);break}
    case"handoff":S.shown=+v;if(S.screen==="mull")renderMull();else renderBoard();break;
    case"mode":S.mode=v;renderMenu();break;
    case"sty":SET.style=v;saveSet();renderMenu();break;
    case"tomull":S.screen="mull";render();break;
    case"tile":if(S.lp){S.lp=false;return}tapTile(+b.dataset.uid);break;
    case"zc":zoom(+b.dataset.uid,b);break;
    case"pkz":{const P=S.st.pending,o=P&&(P.opts||P.items||[])[+b.dataset.i];const c=o&&(o.card||(o.uid!=null&&E.find(S.st,o.uid)?.inst.card));if(c)zoomCard(c,b.parentNode.querySelector(".pkc"));break}
    case"grp":runGroup(b.dataset.k);break;case"cancel":S.tm=null;renderBoard();break;
    case"zoom":zoom(+b.dataset.uid);break;
    case"chs":{const o=S.chs[+b.dataset.i];closeSheet();o.fn();break}
    case"pkpick":{const P=S.st.pending,i=+b.dataset.i;if(!P)break;if(P.n>1){const k=S.pkSel.indexOf(i);if(k>=0)S.pkSel.splice(k,1);else if(S.pkSel.length<P.n)S.pkSel.push(i);renderBoard();break}E.act(S.st,{t:"ask",i});afterPick();break}
    case"pkgo":{const P=S.st.pending;if(!P)break;for(const i of S.pkSel)if(S.st.pending===P)E.act(S.st,{t:"ask",i});if(S.st.pending===P)E.act(S.st,{t:"askDone"});S.pkSel=[];afterPick();break}
    case"pkskip":case"pkok":E.act(S.st,{t:"askDone"});afterPick();break;
    case"pkzoom":{const c=S.st.pending&&S.st.pending.srcCard;if(c)sheet(`<img src="${esc(c.img)}" alt="${esc(c.full)}" style="width:100%;border-radius:14px"><button class="wide" data-a="close">Close</button>`);break}
    case"fxlow":if(window.FX)FX.setLow(v==="1");if(S.paused)pauseMenu();else renderMenu();break;
    case"pkmin":S.pkMin=!S.pkMin;renderBoard();break;
    case"ppick":E.act(S.st,{t:"pick",uid:+b.dataset.uid});renderBoard();if(aiTurn()&&!S.st.pending)aiLoop();break;
    case"pdone":E.act(S.st,{t:"pickDone"});renderBoard();if(aiTurn()&&!S.st.pending)aiLoop();break;
    case"pdisc":E.act(S.st,{t:"discard",uid:+b.dataset.uid});renderBoard();if(aiTurn()&&!S.st.pending)aiLoop();break;
    case"disc":{const p=S.st.players[+b.dataset.pi];sheet(`<h4>${p.name==="You"?"Your":"AI"} discard (${p.discard.length})</h4><div class="bgrid">${p.discard.slice().reverse().map(x=>`<button class="bcard" data-a="zc" data-uid="${x.uid}"><img src="${esc(x.card.img)}" alt="${esc(x.card.full)}"></button>`).join("")||`<p class="meta">Empty</p>`}</div><button class="wide" data-a="close">Close</button>`);break}
    case"pause":pauseMenu();break;case"resume":S.paused=false;closeSheet();if(aiTurn())aiLoop();break;
    case"set":{const k=b.dataset.k;SET[k]=k==="sound"?v==="true":v;saveSet();if(S.paused)pauseMenu();else renderMenu();break}
    case"tipsagain":SET.tips=true;saveSet();S.tipShown=false;closeSheet();S.paused=false;if(S.screen==="board")renderBoard();break;
    case"tip":tip(+b.dataset.i);break;
    case"concede":if(confirm("Concede this game?")){S.paused=false;closeSheet();S.st.winner=1;S.st.phase="over";S.st.log.push("You conceded.");renderBoard()}break;
    case"quitgame":S.paused=false;closeSheet();S.screen="menu";S.st=null;render();break;
    case"end":{const acts=E.legalActions(S.st).filter(a=>a.t!=="end");
      const remain=acts.filter(a=>a.t==="quest"||a.t==="challenge"||a.t==="play"||a.t==="act"||a.t==="move"||a.t==="ink");
      if(remain.length&&!S.skipEndConfirm){const kinds=[...new Set(remain.map(a=>a.t==="play"?"play a card":a.t==="act"?"use an ability":a.t==="ink"?"ink a card":a.t))];
        sheet(`<h4>End your turn?</h4><p class="tiptext">You can still ${kinds.slice(0,3).join(", ")}${kinds.length>3?", …":""}.</p><button class="wide primary" data-a="endforce">End turn</button><button class="wide ghostw" data-a="close">Keep playing</button>`);break}
      S.skipEndConfirm=false;doAct({t:"end"});break}
    case"endforce":S.skipEndConfirm=true;closeSheet();doAct({t:"end"});break;
    case"log":sheet(`<h4>Game log</h4><div class="logfull">${S.st.log.slice().reverse().map(l=>`<div>${esc(l)}</div>`).join("")}</div><button class="wide" data-a="close">Close</button>`);break;
    case"close":closeSheet();break;case"settings":sheet(settingsHtml()+`<button class="wide" data-a="close">Done</button>`);break;
    case"again":startGame(true);break;case"tomenu":S.screen="menu";S.st=null;render();break;
  }
}
window.LorcanaPlay={async open(){ensureRoot();root.hidden=false;document.body.classList.add("playing");render();await loadPool();if(S.screen==="menu"||!S.st&&S.screen!=="builder")S.screen=S.screen==="builder"?"builder":"menu";render()},
  close(){if(root){root.hidden=true;document.body.classList.remove("playing");closeSheet()}},state:()=>S,render:()=>render()};
})();
