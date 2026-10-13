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
  // #11 Long-press zoom ~320ms (before iOS callout); suppress native copy/image menus on cards
  let lpT=null,lpX=0,lpY=0;root.addEventListener("pointerdown",e=>{const t=e.target.closest("[data-a=tile],[data-zuid],[data-a=bview1],[data-a=mtog]");if(!t)return;
    lpX=e.clientX;lpY=e.clientY;clearTimeout(lpT);lpT=setTimeout(()=>{S.lp=true;S._tapLock=Date.now()+400;longZoom(t)},320);
    if(e.pointerType==="touch"){try{t.setPointerCapture(e.pointerId)}catch(_){}}},{passive:true});
  const clearLp=e=>{if(e&&e.type==="pointermove"){const dx=e.clientX-lpX,dy=e.clientY-lpY;if(dx*dx+dy*dy<100)return}clearTimeout(lpT)};
  ["pointerup","pointercancel","pointerleave","pointermove"].forEach(n=>root.addEventListener(n,clearLp,{passive:true}));
  root.addEventListener("contextmenu",e=>e.preventDefault());
  // #14 Disable pinch-zoom / double-tap zoom on the game surface
  root.addEventListener("gesturestart",e=>e.preventDefault());
  root.addEventListener("gesturechange",e=>e.preventDefault());
  // Double-tap zoom is blocked via viewport maximum-scale + touch-action; click debounce handles duplicate actions.
}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
const GC_URL="./data/game-cards.js?v="+V,GC_CACHE="lorcana-game-cards-v1";
async function loadScriptCached(url){
  if(window.LORCANA_GAME_CARDS)return;
  try{
    if(window.caches){
      const c=await caches.open(GC_CACHE);let r=await c.match(url);
      if(!r){r=await fetch(url,{cache:"force-cache"});if(r&&r.ok)await c.put(url,r.clone())}
      if(r&&r.ok){const blob=await r.blob();const u=URL.createObjectURL(blob);try{await loadScript(u);if(window.LORCANA_GAME_CARDS)return}finally{URL.revokeObjectURL(u)}}
    }
  }catch(e){}
  await loadScript(url)}
let _poolP=null;
function prefetchPool(){if(pool||window.LORCANA_GAME_CARDS||_poolP)return _poolP;_poolP=loadScriptCached(GC_URL).catch(()=>{_poolP=null});return _poolP}
async function loadPool(){
  if(pool)return;await prefetchPool();if(!window.LORCANA_GAME_CARDS)await loadScript(GC_URL);
  setPool(window.LORCANA_GAME_CARDS.cards);refreshLive();
}
// Kick off game data fetch as soon as the tracker is idle (faster Play tap)
if(typeof requestIdleCallback==="function")requestIdleCallback(()=>prefetchPool(),{timeout:2500});else setTimeout(()=>prefetchPool(),1200);
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
  const ok=d.filter(x=>x&&typeof x==="object"&&x.cards&&typeof x.cards==="object"&&!Array.isArray(x.cards)).map(x=>({name:typeof x.name==="string"&&x.name.trim()?x.name:"My deck",notes:typeof x.notes==="string"?x.notes.slice(0,500):"",cards:Object.fromEntries(Object.entries(x.cards).filter(([k,n])=>typeof k==="string"&&Number.isFinite(+n)&&+n>0).map(([k,n])=>[k,Math.min(99,Math.floor(+n))]))}));
  if(ok.length!==d.length||JSON.stringify(ok)!==JSON.stringify(d))try{localStorage.setItem(DKEY,JSON.stringify(ok))}catch(e){}return ok};
const saveDecks=d=>localStorage.setItem(DKEY,JSON.stringify(d));
function deckMeta(d){const cards=[];for(const[id,n]of Object.entries(d.cards||{})){const c=byId.get(id);if(c)for(let i=0;i<n;i++)cards.push(c)}
  const n=cards.length,inks=[...new Set(cards.flatMap(c=>c.inks||[]))];
  const err=n?E.validateDeck(cards):(n<60?"Need 60 cards":null);const ok=n>=60&&inks.length<=2&&!err;
  return{n,inks,ok,label:`${n} cards · ${inks.slice(0,2).join("/")||"no ink"}${ok?" · legal":" · draft"}`}}
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
  const PPm=S.mode==="pp",GLm=S.mode==="gold";const HS=histStats();
  const title=PPm?"Pass and play":GLm?"Practice (goldfish)":"Play vs AI";
  root.innerHTML=`<div class="phead">`+bar(title)+`<div class="startbar top"><button class="wide primary" data-a="start">Start game</button></div></div><div class="pbody">
  <h4>Mode</h4><div class="opts"><button class="opt ${!PPm&&!GLm?"on":""}" data-a="mode" data-v="ai">Vs AI</button><button class="opt ${PPm?"on":""}" data-a="mode" data-v="pp">Pass and play</button><button class="opt ${GLm?"on":""}" data-a="mode" data-v="gold">Practice (goldfish)</button></div>
  ${!PPm&&!GLm&&HS.n?`<div class="histbar" data-a="history"><b>${HS.w}W – ${HS.l}L</b><span>${HS.streak?("Win streak "+HS.streak):"Tap for match history"}${!HS.streak&&HS.best>1?" · Best "+HS.best:HS.streak&&HS.best>HS.streak?" · Best "+HS.best:""}</span></div>`:""}
  ${(()=>{const sv=loadSavedMeta();return sv?`<button class="wide primary" data-a="resumeSave">Resume saved game <small>${new Date(sv.meta.savedAt).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</small></button><button class="wide ghostw" data-a="forgetSave">Discard saved game</button>`:""})()}
  ${!PPm&&!GLm?`<button class="wide" data-a="quick" aria-label="Quick play random starters">Quick play <small>random starters</small></button><button class="wide" data-a="daily" aria-label="Daily challenge ${phoenixDateKey()}">Daily challenge <small>${phoenixDateKey()}${HS.streak?` · streak ${HS.streak}`:""}${(HS.dailyW||HS.dailyL)?` · ${HS.dailyW}W–${HS.dailyL}L`:""}</small></button>`:""}
  <button class="wide" data-a="tutorial">Tutorial <small>guided first game</small></button>
  <button class="wide ghostw" data-a="rules">Rules reference</button>
  <h4>${PPm?"Player 1 deck":"Your deck"}</h4>${STARTERS.map((p,i)=>opt("s"+i,p.name,p.title+" · official starter · 60 cards")).join("")}
  ${opt("own","Build from my collection",own.cards?own.name+" · 60 cards":`Need 60 owned cards in two inks (best: ${own.need})`,!own.cards)}
  ${cus.map((d,i)=>{const m=deckMeta(d);return opt("c"+i,d.name,m.label)}).join("")}
  <button class="wide" data-a="builder">Deck builder</button>
  <h4>${PPm?"Player 2 deck":GLm?"Goldfish deck":"Opponent"}</h4><div class="opts"><button class="opt ${S.opp==="random"?"on":""}" data-a="opp" data-v="random">Random starter</button>${STARTERS.map((p,i)=>`<button class="opt ${S.opp==="s"+i?"on":""}" data-a="opp" data-v="s${i}">${esc(p.name)}</button>`).join("")}</div>
  ${PPm||GLm?"":`<h4>AI difficulty</h4><div class="opts">${["easy","normal","hard"].map(l=>`<button class="opt ${SET.level===l?"on":""}" data-a="lvl" data-v="${l}">${LEVELS[l]}</button>`).join("")}</div>
  <h4>AI style</h4><div class="opts">${Object.entries(STYLES).map(([k,l])=>`<button class="opt ${SET.style===k?"on":""}" data-a="sty" data-v="${k}">${l}</button>`).join("")}</div>`}
  ${GLm?`<p class="meta small">Goldfish never plays cards — it only draws and ends its turn. Practice your opening and combos.</p>`:""}
  <button class="wide" data-a="history">Match history</button>
  <button class="wide" data-a="settings">Settings</button>
  <p class="meta small">${pool.length} main-set cards loaded (${source=="live"?"live from Lorcast":"snapshot"}). ${coverageLine()}</p></div>`;
}
function coverageLine(){const c=E.coverage(pool).byStatus;return`Ability simulation: ${c.full||0} full, ${c.keywords||0} keyword-only, ${c.plain||0} no-text, ${c.partial||0} partial, ${c.vanilla||0} vanilla fallback.`}
/* deck builder */
function bInit(d){S.build={name:d?d.name:"My deck",notes:d&&d.notes||"",cards:d?{...d.cards}:{},idx:d?d.idx:null,q:"",ink:"",type:"",kw:"",cls:"",set:"",cost:"",sort:"cost",ownedOnly:false,limit:60,view:"all"}}
const bCount=()=>Object.values(S.build.cards).reduce((a,b)=>a+b,0);
function bInks(){const s=new Set();for(const id of Object.keys(S.build.cards))(byId.get(id)?.inks||[]).forEach(i=>s.add(i));return[...s]}
function fullCount(c){let n=0;for(const[id,k]of Object.entries(S.build.cards))if(byId.get(id)?.full===c.full)n+=k;return n}
function bCardsList(){const out=[];for(const[id,n]of Object.entries(S.build.cards)){const c=byId.get(id);if(c)for(let i=0;i<n;i++)out.push(c)}return out}
function bValidity(){const cards=bCardsList(),n=cards.length,inks=bInks(),reasons=[];
  if(n<60)reasons.push((60-n)+" more cards needed");else if(n>60)reasons.push((n-60)+" over 60 (still playable as draft)");
  if(inks.length>2)reasons.push("Too many inks ("+inks.join(", ")+")");
  const v=cards.length?E.validateDeck(cards):"Deck must have at least 60 cards";
  if(v&&!reasons.some(r=>r.includes("inks")||r.includes("more cards")))reasons.push(v);
  const inkable=cards.filter(c=>c.inkable).length,pct=n?Math.round(100*inkable/n):0;
  if(n>=20&&pct<30)reasons.push("Low inkable count ("+inkable+"/"+n+", "+pct+"%)");
  return{ok:!reasons.length&&n>=60&&inks.length<=2,reasons,n,inks,inkable,pct}}
function priceMap(){const m=new Map();try{const Snp=window.LORCANA_SNAPSHOT;if(!Snp||!Snp.cards)return m;const bag=Snp.cards;
  const add=c=>{if(c&&c.id!=null&&c.usd!=null&&!isNaN(+c.usd))m.set(c.id,+c.usd)};
  if(Array.isArray(bag))bag.forEach(add);else for(const arr of Object.values(bag))if(Array.isArray(arr))arr.forEach(add);
}catch(e){}return m}
function bPriceTotal(){const pm=priceMap();let t=0,miss=0;for(const[id,n]of Object.entries(S.build.cards)){const u=pm.get(id);if(u==null){miss+=n;continue}t+=u*n}return{t,miss}}
function bCurveHtml(){const cards=bCardsList(),bins=[0,0,0,0,0,0,0,0],b=S.build; // 0..6, 7+
  for(const c of cards){const k=Math.min(7,Math.max(0,c.cost|0));bins[k]++}
  const mx=Math.max(1,...bins);
  return`<div class="curve" aria-label="Cost curve">${bins.map((n,i)=>{const v=i===7?"7+":String(i);const on=String(b.cost)===v;
    return`<button type="button" class="cbar ${on?"on":""}" data-a="bcost" data-v="${v}" aria-label="Filter cost ${v}"><i style="height:${Math.round(100*n/mx)}%"></i><b>${v}</b><small>${n}</small></button>`}).join("")}</div>`}
function bSplitHtml(){const cards=bCardsList(),ink={},typ={};
  for(const c of cards){(c.inks||[]).forEach(i=>ink[i]=(ink[i]||0)+1);const t=c.type||"?";typ[t]=(typ[t]||0)+1}
  const inkRow=Object.entries(ink).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="pill">${esc(k)} ${v}</span>`).join("")||`<span class="meta">No cards</span>`;
  const typRow=Object.entries(typ).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="pill">${esc(k)} ${v}</span>`).join("");
  return`<div class="bsplit"><div><small>Ink</small><div class="pills">${inkRow}</div></div><div><small>Types</small><div class="pills">${typRow}</div></div></div>`}
function bExportText(){const by=new Map();for(const[id,n]of Object.entries(S.build.cards)){const c=byId.get(id);if(!c)continue;by.set(c.full,(by.get(c.full)||0)+n)}
  return[...by.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,n])=>n+" "+name).join("\n")}
function bParseImport(text){const lines=String(text||"").split(/\r?\n/),got=[],bad=[];
  const byFull=new Map();for(const c of pool){const k=nzName(c.full);if(!byFull.has(k))byFull.set(k,c);
    // also comma form "Name, Version"
    if(c.version){const alt=nzName(c.name+", "+c.version);if(!byFull.has(alt))byFull.set(alt,c)}}
  for(let raw of lines){raw=raw.trim();if(!raw||/^#/.test(raw)||/^\/\//.test(raw)||/^total\b/i.test(raw)||/^sideboard\b/i.test(raw)||/^\[/.test(raw))continue;
    let m=raw.match(/^(\d+)\s*[xX]?\s+(.+)$/)||raw.match(/^(\d+)x?\s+(.+)$/);
    let n=1,name=raw;if(m){n=Math.min(99,+m[1]||1);name=m[2].trim()}
    name=name.replace(/\s*\*[EeFf]\*\s*$/,"").trim();
    const c=byFull.get(nzName(name))||byFull.get(nzName(name.replace(/,/g," - ")));
    if(!c){bad.push(raw);continue}got.push({c,n})}
  return{got,bad}}
const nzName=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\u2010-\u2015]/g,"-").replace(/[\u2018\u2019]/g,"'").toLowerCase().replace(/\s+/g," ").trim();
function applyImport(text,replace){const {got,bad}=bParseImport(text);if(!got.length){toast("No cards matched");return}
  if(replace)S.build.cards={};
  for(const {c,n} of got){const max=/up to 99 copies/.test(c.text)?99:4;const have=fullCount(c);const add=Math.min(n,Math.max(0,max-have));
    if(add>0)S.build.cards[c.id]=(S.build.cards[c.id]||0)+add}
  toast("Imported "+got.reduce((a,x)=>a+x.n,0)+" cards"+(bad.length?" · "+bad.length+" unmatched":""));
  closeSheet();renderBuilder();
  if(bad.length)sheet(`<h4>Unmatched lines</h4><div class="logfull">${bad.map(x=>`<div>${esc(x)}</div>`).join("")}</div><button class="wide" data-a="close">Close</button>`)}
function sampleHand(){const cards=bCardsList();if(cards.length<7){toast("Need at least 7 cards");return}
  const arr=cards.slice();for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}
  const hand=arr.slice(0,7),inkN=hand.filter(c=>c.inkable).length,cost=hand.reduce((a,c)=>a+(c.cost|0),0);
  sheet(`<h4>Sample opening hand</h4><p class="meta small">${inkN}/7 inkable · total cost ${cost}</p><div class="bgrid">${hand.map(c=>`<button class="bcard" data-a="bview1" data-id="${c.id}"><img src="${esc(c.img)}" alt="${esc(c.full)}"><span class="mcost">${c.cost}</span>${c.inkable?`<span class="inkable" title="Inkable"></span>`:""}</button>`).join("")}</div>
  <button class="wide primary" data-a="bhandagain">Draw again</button><button class="wide" data-a="close">Close</button>`)}
function renderBuilder(){
  const b=S.build,inks=bInks(),n=bCount(),q=b.q.toLowerCase(),val=bValidity(),pr=bPriceTotal(),own=ownedMap();
  let list=b.view==="deck"?Object.keys(b.cards).map(id=>byId.get(id)).filter(Boolean):pool.filter(c=>{
    if(q&&!c.full.toLowerCase().includes(q)&&!(c.text||"").toLowerCase().includes(q))return false;
    if(b.ink&&!c.inks.includes(b.ink))return false;
    if(b.type&&c.type!==b.type)return false;
    if(b.ownedOnly&&!(own[c.id]>0))return false;
    if(b.kw){const kw=(c.kw&&Object.keys(c.kw).filter(k=>c.kw[k]).join(" ")||"")+" "+(c.text||"");if(!kw.toLowerCase().includes(b.kw.toLowerCase()))return false}
    if(b.cls){const cls=(c.cls||[]).join(" ").toLowerCase();if(!cls.includes(b.cls.toLowerCase()))return false}
    if(b.set&&String(c.set)!==String(b.set))return false;
    if(b.cost!==""&&b.cost!=null){const mx=b.cost==="7+"?99:+b.cost;const mn=b.cost==="7+"?7:+b.cost;if(c.cost<mn||c.cost>mx)return false}
    return true});
  const sortFn={cost:(x,y)=>x.cost-y.cost||x.name.localeCompare(y.name),type:(x,y)=>x.type.localeCompare(y.type)||x.cost-y.cost||x.name.localeCompare(y.name),name:(x,y)=>x.name.localeCompare(y.name)||x.cost-y.cost,set:(x,y)=>String(x.set).localeCompare(String(y.set))||x.cost-y.cost};
  list.sort(sortFn[b.sort]||sortFn.cost);const total=list.length;list=list.slice(0,b.limit);
  const sets=[...new Set(pool.map(c=>String(c.set)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const money=v=>v==null?"—":"$"+v.toFixed(2);
  root.innerHTML=bar("Deck builder",`<button class="pbtn" data-a="bsave">Save</button>`)+`<div class="pbody">
  <div class="bstat ${val.ok?"ok":""}"><b>${n}/60</b><span>${inks.join(" / ")||"No inks yet"} · ${val.ok?"Legal deck":(val.reasons[0]||"Draft")}</span></div>
  <div class="bbadge ${val.ok?"ok":"bad"}">${val.ok?"Valid":"Issues"}: ${val.ok?"60 cards · ≤2 inks · copy limits OK":esc(val.reasons.join(" · "))}</div>
  <input class="pin" id="bname" value="${esc(b.name)}" placeholder="Deck name">
  <textarea class="pin bnotes" id="bnotes" rows="2" placeholder="Deck notes (optional)">${esc(b.notes||"")}</textarea>
  <div class="bstats">${bCurveHtml()}${bSplitHtml()}
  <div class="meta small">Inkable ${val.inkable}/${n||0} (${val.pct||0}%)${n&&val.pct<30?' · <b class="warn">low</b>':''} · Est. price ${money(pr.t)}${pr.miss?` · ${pr.miss} without price`:""}</div></div>
  <div class="row2"><button class="opt ${b.view==="all"?"on":""}" data-a="bview" data-v="all">All cards</button><button class="opt ${b.view==="deck"?"on":""}" data-a="bview" data-v="deck">This deck</button><button class="opt" data-a="btools">Tools</button></div>
  ${b.view==="all"?`<input class="pin" id="bq" type="search" value="${esc(b.q)}" placeholder="Search name or text">
  <div class="opts">${["",...E.INKS].map(i=>`<button class="opt sm ${b.ink===i?"on":""}" data-a="bink" data-v="${i}">${i||"Any ink"}</button>`).join("")}</div>
  <div class="opts">${["","character","action","song","item","location"].map(i=>`<button class="opt sm ${b.type===i?"on":""}" data-a="btype" data-v="${i}">${i?i[0].toUpperCase()+i.slice(1):"Any type"}</button>`).join("")}</div>
  <div class="opts"><button class="opt sm ${b.ownedOnly?"on":""}" data-a="bowned">Only owned</button>
  ${["","0","1","2","3","4","5","6","7+"].map(i=>`<button class="opt sm ${String(b.cost)===i?"on":""}" data-a="bcost" data-v="${i}">${i===""?"Any cost":i}</button>`).join("")}</div>
  <div class="opts"><input class="pin sm" id="bkw" value="${esc(b.kw||"")}" placeholder="Keyword / text filter" style="flex:1;min-width:140px">
  <input class="pin sm" id="bcls" value="${esc(b.cls||"")}" placeholder="Classification" style="flex:1;min-width:120px"></div>
  <div class="opts">${[`<button class="opt sm ${!b.set?"on":""}" data-a="bset" data-v="">Any set</button>`].concat(sets.slice(0,16).map(i=>`<button class="opt sm ${b.set===i?"on":""}" data-a="bset" data-v="${esc(i)}">Set ${esc(i)}</button>`)).join("")}</div>`:""}
  <div class="opts"><span class="meta small">Sort</span>${[["cost","Cost"],["type","Type"],["name","Name"],["set","Set"]].map(([k,l])=>`<button class="opt sm ${b.sort===k?"on":""}" data-a="bsort" data-v="${k}">${l}</button>`).join("")}</div>
  <div class="meta small">${total} cards${total>b.limit?`, showing ${b.limit}`:""}</div>
  ${n===0&&b.view==="deck"?`<div class="emptydeck"><p class="meta">This deck is empty. Load an official starter, import a list, or switch to All cards to add cards.</p>
  <button class="wide primary" data-a="bstarter">Load official starter…</button>
  <button class="wide" data-a="bimport">Import Dreamborn / text list</button>
  <button class="wide" data-a="bview" data-v="all">Browse all cards</button></div>`:""}
  <div class="bgrid">${list.map(c=>{const k=b.cards[c.id]||0;return`<button class="bcard ${k?"in":""}" data-a="bview1" data-id="${c.id}"><img loading="lazy" src="${esc(c.img)}" alt="${esc(c.full)}">${k?`<span class="cnt">${k}</span>`:""}${badge(c)}</button>`}).join("")}</div>
  ${total>b.limit?`<button class="wide" data-a="bmore">Show more</button>`:""}</div>`;
}
function builderTools(){sheet(`<h4>Deck tools</h4>
  <button class="wide primary" data-a="bexport">Export Dreamborn list</button>
  <button class="wide" data-a="bimport">Import Dreamborn / text list</button>
  <button class="wide" data-a="bhand">Sample opening hand</button>
  <button class="wide" data-a="bstarter">Load official starter…</button>
  <button class="wide" data-a="brename">Rename deck</button>
  <button class="wide" data-a="bdup">Duplicate deck</button>
  <button class="wide" data-a="bdel">Delete this saved deck</button>
  <button class="wide" data-a="bclear">Clear all cards</button>
  <button class="wide ghostw" data-a="close">Close</button>`)}
function loadStarterPicker(){sheet(`<h4>Load official starter</h4><p class="meta small">Replaces the current builder list with an official 60-card starter.</p>
  ${STARTERS.map((p,i)=>`<button class="wide" data-a="bstartergo" data-v="${i}"><b>${esc(p.name)}</b><br><small>${esc(p.title)} · ${esc(p.set)}</small></button>`).join("")}
  <button class="wide ghostw" data-a="btools">Back</button>`)}
function applyStarter(i){const p=STARTERS[+i];if(!p)return;const cards=E.deckFromList(pool,p.list)||E.deckFromList(snapPool||[],p.list);if(!cards){toast("Starter cards not loaded yet");return}
  const map={};for(const c of cards)map[c.id]=(map[c.id]||0)+1;
  S.build.cards=map;S.build.name=p.name;S.build.notes=(S.build.notes||"")||("Official starter: "+p.title);
  closeSheet();renderBuilder();toast("Loaded "+p.name)}

function badge(c){return c.status==="partial"?`<span class="sb part">PARTIAL</span>`:c.status==="vanilla"?`<span class="sb van">TEXT OFF</span>`:""}
function cardSheet(c,extra){
  const st=c.type==="character"?`${c.cost} ink · ${c.str} STR · ${c.wil} WIL · ${c.lore} lore`:c.type==="location"?`${c.cost} ink · ${c.wil} WIL · ${c.lore} lore · move ${c.move??"-"}`:`${c.cost} ink · ${c.type}`;
  return`<img class="big-img" src="${esc(c.imgLarge||c.img)}" alt="${esc(c.full)}"><div class="sname2">${esc(c.full)}</div><div class="meta">${st}${c.inkable?" · inkable":""}</div>
  <div class="status s-${c.status}">${STATUS_LABEL[c.status]}</div>${c.unsupported.length?`<div class="meta small">Not simulated: ${c.unsupported.map(u=>esc(u.replace(/\([^)]*\)/g,"").slice(0,90))).join(" | ")}</div>`:""}${extra||""}`;
}
function sheet(html){$("#sheet-body").innerHTML=html;$("#scrim").hidden=false;$("#sheet").classList.add("open");$("#sheet").setAttribute("aria-hidden","false");$("#sheet-body").onclick=onClick;$("#sheet-body").oninput=onInput}
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
const SET=(()=>{const d={level:"normal",speed:"normal",sound:false,volume:70,music:false,tips:true,style:"balanced"};let o={};try{o=JSON.parse(localStorage.getItem(SKEY2)||"{}")||{}}catch(e){}
  if(typeof o!=="object"||Array.isArray(o))o={};const r={...d,...o};if(!["easy","normal","hard"].includes(r.level))r.level="normal";if(!["slow","normal","fast"].includes(r.speed))r.speed="normal";if(!STYLES[r.style])r.style="balanced";r.sound=!!r.sound;r.music=!!r.music;r.tips=r.tips!==false;r.volume=Math.max(0,Math.min(100,Number(r.volume)||70));return r})();
const saveSet=()=>localStorage.setItem(SKEY2,JSON.stringify(SET));
const SPEED={slow:1500,normal:950,fast:450};
function showHistory(){S.histFilter=S.histFilter||"all";const H=histStats();const fmt=t=>{const d=new Date(t);return d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})};
  const f=S.histFilter,filt=r=>f==="all"||(f==="ai"&&(r.mode==="ai"||r.mode==="daily"))||r.mode===f;
  const shown=H.rows.filter(filt);
  const rows=shown.map(r=>{const res=r.mode==="pp"?(r.winner===0?"P1 win":"P2 win"):(r.mode==="gold"?(r.winner===0?"Practice clear":"Practice end"):(r.won?"Win":"Loss"));
    return`<div class="histrow ${r.won?"win":(r.mode==="ai"||r.mode==="daily"?"loss":"")}"><b>${esc(res)}</b><span>${esc(r.me||"You")} vs ${esc(r.opp||"?")}</span><small>${fmt(r.t)} · ${r.turns||"?"} turns · lore ${(r.lore||[]).join("–")}${r.deckName?" · "+r.deckName:""}${r.level?" · "+r.level:""}${r.streak?" · streak "+r.streak:""}${r.reward?" · "+r.reward:""}</small></div>`}).join("")||`<p class="meta">No matches in this filter.</p>`;
  const rates=deckRates().map(d=>{const n=d.w+d.l,pct=n?Math.round(100*d.w/n):0;return`<div class="histrow"><b>${esc(d.name)}</b><span>${d.w}W – ${d.l}L</span><small>${pct}% win rate · ${n} games</small></div>`}).join("")||`<p class="meta">Play AI games to track per-deck rates.</p>`;
  const chips=[["all","All"],["ai","AI"],["pp","Pass & play"],["gold","Practice"],["daily","Daily"]].map(([k,l])=>`<button class="opt ${f===k?"on":""}" data-a="histf" data-v="${k}">${l}</button>`).join("");
  const dailyLine=(H.dailyW||H.dailyL)?` · Daily ${H.dailyW}W–${H.dailyL}L`:"";
  sheet(`<h4>Match history</h4><div class="histsum"><b>${H.w}W – ${H.l}L</b><span>${H.streak?"Current streak "+H.streak:"No active streak"}${H.best>1?" · Best "+H.best:""}${dailyLine}</span></div><div class="opts">${chips}</div><h4>Per-deck win rates</h4><div class="histlist">${rates}</div><h4>Recent (${shown.length})</h4><div class="histlist">${rows}</div><button class="wide" data-a="histexp">Export history text</button><button class="wide" data-a="histclear">Clear history</button><button class="wide" data-a="close">Close</button>`)}
/* #33 Match history */ const HKEY="lorcanaMatchHistory.v1";
function loadHist(){try{const a=JSON.parse(localStorage.getItem(HKEY)||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}}
function saveHist(a){try{localStorage.setItem(HKEY,JSON.stringify(a.slice(0,80)))}catch(e){}}
function recordMatch(st){if(!st||st._recorded)return;st._recorded=true;const w=st.winner,meWon=S.pp?null:(w===0),oppName=S.pp?(S.names||["P1","P2"])[1]:(S.oppName||"AI");
  const row={t:Date.now(),mode:S.pp?"pp":(S.mode==="gold"?"gold":(S.daily?"daily":"ai")),won:meWon,winner:w,turns:st.turnNo,lore:[st.players[0].lore,st.players[1].lore],
    me:S.meName||"You",opp:oppName,deckId:S.deck||null,deckName:S.meName||null,level:S.pp||S.mode==="gold"?null:SET.level,style:S.pp||S.mode==="gold"?null:SET.style,
    streak:0,reward:null};const h=loadHist();if(!S.pp&&S.mode!=="gold"){const last=h[0];row.streak=meWon?(last&&last.won?((last.streak||0)+1):1):0;
    // #46 victory rewards from streak
    if(meWon){const s=row.streak;row.reward=s>=10?"Legend streak x"+s:s>=5?"Hot streak x"+s:s>=3?"On a roll x"+s:s>=2?"Win streak x"+s:"Victory"}}
  h.unshift(row);saveHist(h);S.lastResult=row}
function deckRates(){const m={};for(const r of loadHist().filter(x=>x.mode==="ai"||x.mode==="daily")){const k=r.deckName||r.deckId||"Unknown";if(!m[k])m[k]={w:0,l:0,name:k};if(r.won)m[k].w++;else m[k].l++}
  return Object.values(m).sort((a,b)=>(b.w+b.l)-(a.w+a.l))}
function histStats(){const h=loadHist().filter(x=>x.mode==="ai"||x.mode==="daily");let w=0,l=0,st=0,best=0,dw=0,dl=0;
  for(const x of h){if(x.won)w++;else l++;if((x.streak||0)>best)best=x.streak||0;if(x.mode==="daily"){if(x.won)dw++;else dl++}}
  for(const x of h){if(x.won)st=x.streak||st;else break}
  return{w,l,n:h.length,streak:st,best,dailyW:dw,dailyL:dl,rows:loadHist()}}
/* #27 Action log with card images */ function pushLog(ev){if(!ev)return;S.alog=S.alog||[];const imgOf=u=>{const f=E.find(S.st,u);return f&&f.inst&&f.inst.card?f.inst.card.img:""};
  const nameOf=u=>{const f=E.find(S.st,u);return f&&f.inst&&f.inst.card?f.inst.card.full:(ev.name||"")};
  let row=null;const who=pi=>S.pp?PN(pi):(pi===ME()?"You":"AI");
  if(ev.t==="play")row={t:"play",pi:ev.pi,img:imgOf(ev.uid)||"",label:who(ev.pi)+" played",name:ev.name||nameOf(ev.uid)};
  else if(ev.t==="quest")row={t:"quest",pi:ev.pi,img:imgOf(ev.uid),label:who(ev.pi)+" quested",name:nameOf(ev.uid),sub:"+"+ev.n+" lore"};
  else if(ev.t==="challenge")row={t:"challenge",pi:ev.pi,img:imgOf(ev.a),img2:imgOf(ev.d),label:who(ev.pi)+" challenged",name:nameOf(ev.a),sub:"vs "+nameOf(ev.d)};
  else if(ev.t==="banish")row={t:"banish",pi:ev.pi,img:imgOf(ev.uid),label:"Banished",name:nameOf(ev.uid)};
  else if(ev.t==="ink")row={t:"ink",pi:ev.pi,img:imgOf(ev.uid),label:who(ev.pi)+" inked",name:nameOf(ev.uid)};
  else if(ev.t==="turn")row={t:"turn",pi:ev.pi,label:"Turn "+(S.st?S.st.turnNo:"")+" · "+who(ev.pi),name:""};
  else if(ev.t==="lore"&&ev.n)row={t:"lore",pi:ev.pi,label:who(ev.pi)+" gained lore",sub:"+"+ev.n};
  if(row){row.at=Date.now();S.alog.push(row);if(S.alog.length>120)S.alog.shift()}}
function noteEvents(evs){for(const e of evs||[])pushLog(e)}
function alogHtml(){const rows=(S.alog||[]).slice().reverse();
  if(!rows.length)return`<p class="meta">No actions yet.</p>`;
  return`<div class="alog">${rows.map(r=>`<div class="alogrow ${r.t||""}"><div class="alogimgs">${r.img?`<img src="${esc(r.img)}" alt="">`:""}${r.img2?`<img src="${esc(r.img2)}" alt="">`:""}</div><div class="alogtxt"><small>${esc(r.label||"")}</small>${r.name?`<b>${esc(r.name)}</b>`:""}${r.sub?`<span>${esc(r.sub)}</span>`:""}</div></div>`).join("")}</div>`}

const LEVELS={easy:"Easy",normal:"Normal",hard:"Hard"};
function startGame(rematch,swap){
  let me,op;
  if(rematch&&S.last){me=S.last.me;op=S.last.op;if(swap){const t=me;me=op;op=t;S.deck=S.opp&&S.opp[0]==="s"?S.opp:S.deck;}}else{me=deckFromSel(S.deck);if(!me||!me.cards){alert("That deck isn't ready (needs 60 legal cards).");return}
    const os=S.opp==="random"?"s"+Math.floor(Math.random()*STARTERS.length):S.opp;op=deckFromSel(os)}
  S.daily=false;S.tut=null;S.tutLock=false;S.last={me,op};S.oppName=op.name;S.meName=me.name;
  S.pp=S.mode==="pp";S.gold=S.mode==="gold";S.names=["Player 1","Player 2"];S.shown=null;S.mullSeat=0;clearUndo();
  const oppHuman=S.pp,oppLabel=S.pp?S.names:S.gold?["You","Goldfish"]:["You","AI"];
  S.st=E.newGame({decks:[me.cards,op.cards],names:S.pp?S.names:oppLabel,seed:Date.now()%1e9,first:Math.random()<.5?0:1,human:[true,oppHuman]});
  if(!S.pp){if(S.gold)E.mulligan(S.st,1,[]);else E.mulligan(S.st,1,E.aiMulligan(S.st,1))}
  S.mullSel=new Set();S.sel=null;S.tm=null;S.alog=[];S.celebrated=false;S.screen="coin";render();
}
function renderCoin(){const f=S.st.first===0,fn=S.st.first;
  const face=S.pp?"P"+(fn+1):f?"YOU":(S.gold?"GF":"AI");const whoFirst=S.pp?esc(PN(fn))+" goes first":f?"You go first":(S.gold?"Goldfish goes first":"AI goes first");
  root.innerHTML=`<div class="coinwrap"><div class="coin spin"><div class="cface">${face}</div></div><h2 class="cres hidden">${whoFirst}</h2>
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
const aiTurn=()=>!S.pp&&!S.gold&&S.st&&S.st.active===1&&S.st.winner==null;
const goldTurn=()=>S.gold&&S.st&&S.st.active===1&&S.st.winner==null;
const PN=i=>S.pp?(S.names||["Player 1","Player 2"])[i]:i===0?"You":"AI";
const myTurn=()=>S.st&&S.st.active===ME()&&S.st.winner==null&&!S.st.pending;
function legalFor(uid){return myTurn()?E.legalActions(S.st).filter(a=>a.uid===uid):[]}
function canAct(x){return legalFor(x.uid).some(a=>a.t!=="ink")}
function cardTile(x,pos,size){const pi=SEAT(pos);const c=x.card,st=S.st,tm=S.tm;
  const isT=tm&&(tm.mode==="singT"?tm.eligible.has(x.uid):tm.targets.has(x.uid));
  const picked=tm&&tm.mode==="singT"&&tm.sel.has(x.uid);
  const sel=S.sel===x.uid,glow=pi===ME()&&!tm&&myTurn()&&canAct(x);
  const hint=S.hint&&glow;const drying=c.type==="character"&&!E.dry(st,x)&&!K0(x,"rush");
  const readyChip=c.type==="character"&&!x.exerted&&E.dry(st,x)&&pi===st.active&&myTurn()&&!tm;
  const kind=tm&&isT?(tm.kind||tm.key||""):"";
  const moveBadge=(tm&&tm.key==="loc"&&isT&&tm.moveOf)?`<span class="mcostb">${tm.moveOf.get(x.uid)??"?"} ink</span>`:"";
  const singMark=picked?`<span class="singmark">SING</span>`:"";
  return`<button class="ct ${size} ${x.exerted?"ex":""} ${sel?"sel":""} ${isT?"tgt":""} ${kind==="shift"||tm&&tm.key==="shift"?"tgt-shift":""} ${kind==="loc"||tm&&tm.key==="loc"?"tgt-move":""} ${picked?"tgt-sing":""} ${glow?"glow":""} ${hint?"hint":""} ${tm&&!isT?"dim":""} ${readyChip?"rdy":""}" data-a="tile" data-uid="${x.uid}">
   <span class="art"><img src="${esc(c.img)}" alt="${esc(c.full)}" loading="lazy"></span>
   ${x.damage?`<span class="dtok">${x.damage}</span>`:""}${drying&&pi===st.active?`<span class="dry" aria-label="Drying">DRYING</span>`:(readyChip?`<span class="rdyb" aria-label="Ready">READY</span>`:"")}${moveBadge}${singMark}
   ${c.type==="character"?`<span class="stats"><b>${E.strOf(x)}</b><i>${c.wil-x.damage}</i></span>`:c.type==="location"?`<span class="stats"><i>${c.wil-x.damage}</i></span>`:""}
   ${x.at?`<span class="atl">AT ${esc((E.find(st,x.at)?.inst.card.name||"").slice(0,10).toUpperCase())}</span>`:""}${x.under&&x.under.length?`<span class="und">+${x.under.length}</span>`:""}</button>`}
const K0=(x,k)=>E.K?E.K(x,k):x.card.kw[k];
function lorePips(n){let h="";for(let i=1;i<=20;i++)h+=`<i class="${i<=n?"on":""}"></i>`;return h}
const ICO={menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
 ink:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z" fill="currentColor"/></svg>',
 deck:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9 22h9a2 2 0 0 0 2-2V7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
 disc:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
 hand:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="9" height="13" rx="2" transform="rotate(-12 7 12)" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="11" y="5" width="9" height="13" rx="2" transform="rotate(10 15 11)" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
 hint:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
 log:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h12v14H6z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
 undo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8H5V4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 8a7 7 0 1 1 2 9.9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>'};
function hud(pos){const pi=SEAT(pos),p=S.st.players[pi],ink=E.inkAvail(p);
  return`<div class="hud h${pos}">${pos===1?`<button class="mbtn" data-a="pause" aria-label="Menu">${ICO.menu}</button>`:""}
   <div class="loretrk" id="lore-${pos}"><b>${p.lore}</b><div><span>${S.pp?esc(PN(pi)).toUpperCase():pos===1?(S.gold?"GOLDFISH":("AI · "+LEVELS[SET.level].toUpperCase()+(SET.style!=="balanced"?" · "+STYLES[SET.style].toUpperCase():""))):"YOUR LORE"}</span><div class="pips">${lorePips(p.lore)}</div></div></div>
   <div class="chips"><div class="chip ink pile ${p.ink.length?"":"emptychip"}" id="ink-${pos}" title="Ink ready / total" aria-label="${p.ink.length?ink+" of "+p.ink.length+" ink ready":"Inkwell empty"}">${ICO.ink}<b>${ink}<small>/${p.ink.length}</small></b></div>
   <div class="chip pile ${p.deck.length?"":"emptychip"}" id="deck-${pos}" title="Deck" aria-label="Deck ${p.deck.length} cards">${ICO.deck}<b>${p.deck.length}</b></div>
   <button class="chip pile disc ${p.discard.length?"":"emptychip"}" data-a="disc" data-pi="${pi}" id="disc-${pos}" aria-label="Discard pile ${p.discard.length} cards">${ICO.disc}<b>${p.discard.length}</b></button>
   ${pos===1?`<div class="chip pile" id="hand-1" title="Hand">${ICO.hand}<b>${p.hand.length}</b></div>`:`<div class="chip pile" id="inkable-0" title="Inkable cards in hand">${ICO.ink}<b>${p.hand.filter(h=>h.card.inkable).length}<small> inkable</small></b></div>`}</div>
  </div>`}
function zone(pos){const pi=pos,p=S.st.players[SEAT(pos)],ch=p.play.filter(x=>x.card.type==="character"),it=p.play.filter(x=>x.card.type!=="character");
  const who=pi===0?(S.pp?esc(PN(ME())):"You"):(S.pp?esc(PN(OP())):"Opponent");
  const emptyCh=`<span class="rowlbl zempty" role="status">${who}${pi===0?" · no characters yet":" · empty board"}</span>`;
  const strip=it.length?`<div class="strip">${it.map(x=>cardTile(x,pi,"sm")).join("")}</div>`:(ch.length?`<div class="strip emptystrip" role="status"><span class="zempty">${pi===0?"No items or locations":"No opposing items / locations"}</span></div>`:"");
  return`<div class="zone z${pi}">${pi===0?strip:""}
   <div class="row chars r${pi}">${ch.map(x=>cardTile(x,pi,"lg")).join("")||emptyCh}</div>
   ${pi===1?strip:""}</div>`}
function fitBoard(again){const gb=root.querySelector(".gb");if(!gb)return;
  // #2: shrink hand when the board is full so character rows stay usable on short phones
  const nChars=(S.st?S.st.players.reduce((a,p)=>a+p.play.filter(x=>x.card.type==="character").length,0):0);
  gb.classList.toggle("crowded",nChars>=8);gb.classList.toggle("packed",nChars>=12);gb.classList.toggle("hinting",!!S.hint);
  const rowsC=[...gb.querySelectorAll(".row.chars")];rowsC.forEach(r=>{r.style.setProperty("--ch","40px");r.classList.remove("wrap","scroll")});void gb.offsetHeight; // measure free space, not current content
  if(!again)requestAnimationFrame(()=>fitBoard(true));
  for(const r of rowsC){const tiles=[...r.children].filter(x=>x.classList.contains("ct"));if(!tiles.length)continue;
    const cs0=getComputedStyle(r),padY=parseFloat(cs0.paddingTop)+parseFloat(cs0.paddingBottom),padX=parseFloat(cs0.paddingLeft)+parseFloat(cs0.paddingRight);
    // Leave a little vertical slack so damage badges / stats never clip the row.
    const H=Math.max(0,r.clientHeight-padY),W=Math.max(0,r.clientWidth-padX-2),g=8,n=tiles.length,exr=tiles.filter(t=>t.classList.contains("ex")).length/n,u=.716+(1-.716)*exr;
    let best=0,rows=1;for(let k=1;k<=3;k++){const per=Math.ceil(n/k),h=Math.min((H-g*(k-1))/k,(W-g*(per-1))/(per*u+.12),165);if(h>best+4){best=h;rows=k}}
    // Prefer one scrolling row only when wrapping would make tiles too small to tap.
    let sc=false;const minTap=64;if(best<minTap||(rows>1&&rows*best+g*(rows-1)>H+1)){const h1=Math.min(H,165);if(h1>=best||best<minTap){best=Math.max(60,Math.min(h1,165));rows=1;sc=n*(best*u+g)>W+1}}
    // Cap so a single huge card does not dominate a sparse board.
    if(n<=3&&rows===1&&!sc)best=Math.min(best,130);
    r.style.setProperty("--ch",Math.floor(best)+"px");r.classList.toggle("wrap",rows>1);r.classList.toggle("scroll",sc)}
  for(const s of gb.querySelectorAll(".strip"))s.style.setProperty("--ch",nChars>=12?"48px":"56px");
  // #3 Hand fan: every card keeps a usable >=44px peek / hit strip; scroll when needed.
  const hd=gb.querySelector(".hand2");if(hd){const cs=[...hd.children],n=cs.length;hd.classList.toggle("big",n>=8);
    // Re-measure after crowded class may have changed flex-basis
    const w=cs[0]?cs[0].getBoundingClientRect().width:(n>=8?62:78),W=hd.clientWidth-40;
    const minPeek=n>=10?44:n>=8?46:50;
    let ov=n>1?Math.max(0,(n*w-W)/(n-1)):0;ov=Math.min(ov,Math.max(0,w-minPeek));
    hd.style.setProperty("--ov",(-ov)+"px");hd.classList.toggle("scroll",n>1&&(n*w-(n-1)*ov>W+1));
    const spread=n>=8?8:n>3?5:3,arc=n>=8?16:10;
    cs.forEach((c,i)=>{const k=n>1?i/(n-1)-.5:0;c.style.setProperty("--rot",(k*spread).toFixed(2)+"deg");c.style.setProperty("--dy",(k*k*arc).toFixed(1)+"px");
      c.style.zIndex=c.classList.contains("sel")?50:(c.classList.contains("hint")?40:i+1)})}}
addEventListener("resize",()=>{if(S.screen==="board")fitBoard()});
function banner(){const st=S.st;if(st.winner!=null)return`<div class="banner over2">GAME OVER</div>`;
  if(S.tm){if(S.tm.mode==="singT"){const sum=[...S.tm.sel].reduce((a,u)=>{const f=E.find(st,u);return a+(f&&E.singVal?E.singVal(f.inst):(f?f.inst.card.cost:0))},0);
    const ok=S.tm.sel.size>=2&&sum>=S.tm.need;
    return`<div class="banner tm"><span>${esc(S.tm.label)} · ${sum}/${S.tm.need} · ${S.tm.sel.size} singers</span>${ok?`<button class="bbtn pri" data-a="singtok">Sing</button>`:""}<button class="bbtn" data-a="cancel">Cancel</button></div>`}
    return`<div class="banner tm"><span>${esc(S.tm.label)}</span><button class="bbtn" data-a="cancel">Cancel</button></div>`}
  const my=st.active===ME();const acts=my&&!st.pending?E.legalActions(st):[];const canEnd=acts.some(a=>a.t==="end");
  const ml=st.players[ME()].lore,ol=st.players[OP()].lore,race=ml===ol?"Tied "+ml+"–"+ol:ml>ol?(S.pp?esc(PN(ME())):"You")+" ahead "+ml+"–"+ol:(S.pp?esc(PN(OP())):"AI")+" ahead "+ol+"–"+ml;
  const near=ml>=18||ol>=18;
  const hintBtn=my&&!S.tm?`<button class="hintbtn ${S.hint?"on":""}" data-a="hint" aria-label="${S.hint?"Hide hints":"Show legal moves"}" title="Legal moves">${ICO.hint}</button>`:"";
  const undoBtn=canUndo()?`<button class="hintbtn" data-a="undo" aria-label="Undo last action" title="Undo">${ICO.undo}</button>`:"";
  const turnLab=S.pp?esc(PN(st.active)).toUpperCase()+"'S TURN":my?"YOUR TURN":(S.gold?"GOLDFISH TURN":"AI TURN");
  const meP=st.players[ME()];
  const dryN=my?meP.play.filter(x=>x.card.type==="character"&&!E.dry(st,x)&&!K0(x,"rush")).length:0;
  const readyN=my?meP.play.filter(x=>x.card.type==="character"&&!x.exerted&&E.dry(st,x)).length:0;
  const nearLab=near?(ml>=18&&ol>=18?" · both near 20":ml>=18?" · you near 20":" · AI near 20"):"";
  const handN=my?meP.hand.length:0;
  const sub=my?(meP.inked?"Ink used":"Ink available")+(handN!=null?` · ${handN} in hand`:"")+(readyN?` · ${readyN} ready`:"")+(dryN?` · ${dryN} drying`:"")+(S.hint?" · hints on":"")+nearLab:(S.gold?"Pass and draw only":"AI is playing")+nearLab;
  const logBtn=`<button class="hintbtn" data-a="alog" aria-label="Action log" title="Action log">${ICO.log}</button>`;
  return`<div class="banner ${my?"mine":"theirs"} ${near?"near":""}"><div><b>${turnLab}</b><small>Turn ${st.turnNo} · ${race} · ${sub}</small></div>
   <div class="bacts">${undoBtn}${logBtn}${hintBtn}${my||S.pp?`<button class="endbtn" data-a="end" aria-label="${canEnd?"End turn":"Must challenge before ending"}" ${canEnd?"":"disabled"}>${canEnd?"End turn":"Must challenge"}</button>`:`<span class="thinking" aria-label="Opponent thinking"><i></i><i></i><i></i></span>`}</div></div>`}
function actionBar(){
  if(!S.sel||S.tm)return"";const f=E.find(S.st,S.sel);if(!f)return"";const acts=legalFor(S.sel);
  const g=groupActs(acts);const btn=(k,l,cls="")=>`<button class="ab ${cls}" data-a="grp" data-k="${k}">${l}</button>`;
  let h="";
  if(g.play)h+=btn("play",`Play <small>${E.costOf(S.st,ME(),f.inst.card)} ink</small>`,"pri");
  if(g.quest)h+=btn("quest",`Quest <small>+${E.loreOf(f.inst)}</small>`,"pri");
  if(g.challenge)h+=btn("challenge","Challenge","red");
  if(g.shift)h+=btn("shift",`Shift <small>${f.inst.card.kw.shift} ink</small>`);
  if(g.sing)h+=btn("sing","Sing");if(g.singT)h+=btn("singT","Sing together");
  if(g.act)h+=btn("act","Ability");
  if(g.move){const costs=g.move.map(a=>{const l=E.find(S.st,a.loc)?.inst;return l?E.moveCost(S.st,ME(),f.inst,l):9});const lo=Math.min(...costs);
    h+=btn("move",`Move <small>${lo} ink</small>`)}
  if(g.boost)h+=btn("boost",`Boost <small>${f.inst.card.kw.boost}</small>`);
  if(g.ink)h+=btn("ink","Ink it","ink");
  h+=`<button class="ab ghost" data-a="zoom" data-uid="${S.sel}">Details</button>`;
  return`<div class="abar">${h}</div>`}
function groupActs(acts){const g={};for(const a of acts){let k=a.t;if(a.t==="play")k=a.shift!=null?"shift":a.singer!=null?"sing":a.singers?"singT":"play";(g[k]=g[k]||[]).push(a)}return g}
function renderBoard(){
  const st=S.st;if(S.pp&&st.winner==null&&S.shown!==ME()){clearFx();root.innerHTML=handoff(ME(),st.pending&&st.pending.pi!==st.active?"Your choice":"Your turn");return}
  const me=st.players[ME()];
  const rects=snapRects();
  // #7: scrub leftover animation copies before redraw (keep snapRects first)
  document.querySelectorAll("body > .ghost, body > .ftext, body > .tsweep, body > .shuffle").forEach(x=>{try{x.getAnimations&&x.getAnimations().forEach(a=>a.cancel())}catch(_){ }x.remove()});
  noteOppPlay(st.events||[]);
  root.innerHTML=`<div class="gb">
   ${hud(1)}${zone(1)}
   ${banner()}
   ${zone(0)}${hud(0)}
   <div class="handwrap">${actionBar()}<div class="hand2">${me.hand.length?me.hand.map(h=>{const acts=myTurn()&&!S.tm?legalFor(h.uid):[];const pl=acts.some(a=>a.t==="play");const ik=myTurn()&&!S.tm&&!me.inked&&h.card.inkable;const hint=S.hint&&acts.length>0;
     return`<button class="hc ${pl?"play":""} ${S.sel===h.uid?"sel":""} ${hint?"hint":""} ${S.tm?"dim":""}" data-a="tile" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}"><span class="mcost">${E.costOf(st,ME(),h.card)}</span>${h.card.inkable?`<span class="inkable" title="Inkable"></span>`:""}${badge(h.card)}${ik&&!pl?"":""}</button>`}).join(""):`<span class="handempty" role="status">Hand empty — draw next turn</span>`}</div></div>
   ${lastPlayHtml()}<div id="toast" role="status" aria-live="polite" class="toast"></div></div>
   ${st.pending&&st.pending.pi===ME()&&st.human[st.pending.pi]&&st.winner==null?discardPrompt():""}${st.winner!=null?endScreen():""}${S.tut&&st.winner==null?tutHtml():""}`;
  fitBoard();if(st.winner!=null){noteEvents(st.events||[]);clearFx();st.events=[];recordMatch(st);closeSheet();if(S.tut){S.tut=null}}else animate(rects);if(window.FX)FX.mode("board");tickLore();
  if(st.winner!=null&&!S.celebrated){S.celebrated=true;if((S.pp||st.winner===0||S.gold)&&window.FX)setTimeout(FX.celebrate,300);sfx("win")}if(st.winner==null)S.celebrated=false;
  if(SET.tips&&!S.tipShown&&st.winner==null&&!S.tut){S.tipShown=true;setTimeout(()=>tip(0),400)}
  if(goldTurn()&&!S.busy)goldLoop();
  advanceTut();
}
function lastPlayHtml(){const lp=S.lastOpp;if(!lp||!lp.img)return"";const age=Date.now()-(lp.at||0);if(age>4200){return""}
  return`<div class="lastplay ${age>3400?"out":""}" aria-live="polite"><img src="${esc(lp.img)}" alt=""><div><small>${S.pp?esc(PN(OP())):"Opponent"} played</small><b>${esc(lp.name||"Card")}</b></div></div>`}
function noteOppPlay(evs){for(const e of evs){if(e.t==="play"&&e.pi===OP()){const f=E.find(S.st,e.uid);const c=f?.inst?.card;
    const next={uid:e.uid,name:e.name||c?.full||"Card",img:c?.img||"",at:Date.now()};
    if(S.lastOpp&&S.lastOpp.uid===next.uid&&Date.now()-(S.lastOpp.at||0)<500)continue; // same event peeked twice
    S.lastOpp=next;clearTimeout(S._lpT);S._lpT=setTimeout(()=>{if(S.screen==="board"){S.lastOpp=null;renderBoard()}},4000)}}}
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
function handoff(seat,what){const st=S.st,l0=st?st.players[0].lore:0,l1=st?st.players[1].lore:0,tn=st?st.turnNo:"";
  const P=st?st.players[seat]:null;
  const dryN=P?P.play.filter(x=>x.card.type==="character"&&!E.dry(st,x)).length:0;
  const readyN=P?P.play.filter(x=>x.card.type==="character"&&!x.exerted&&E.dry(st,x)).length:0;
  const inkN=P?E.inkAvail(P):0;const inkT=P?P.ink.length:0;
  const handN=P?P.hand.length:0;const inkableN=P?P.hand.filter(h=>h.card.inkable).length:0;
  const boardBits=[inkT?`${inkN}/${inkT} ink ready`:null,handN?`${handN} in hand${inkableN?` · ${inkableN} inkable`:""}`:`hand empty`,readyN?`${readyN} ready`:null,dryN?`${dryN} drying`:null].filter(Boolean).join(" · ");
  const d0=(S.last&&S.last.me&&S.last.me.name)||S.meName||"";const d1=(S.last&&S.last.op&&S.last.op.name)||S.oppName||"";
  const deckBits=d0&&d1?`<p class="hdecks" aria-live="polite">${esc(PN(0))}: ${esc(d0)} · ${esc(PN(1))}: ${esc(d1)}</p>`:"";
  return`<div class="handoff" role="dialog" aria-label="Pass the phone"><div class="hbox"><div class="hico">${ICO.hand}</div><h2>Pass to ${esc(PN(seat))}</h2>
  <p class="hscore" aria-live="polite">${esc(PN(0))} ${l0} – ${l1} ${esc(PN(1))}${tn?` · Turn ${tn}`:""}</p>
  ${deckBits}${boardBits?`<p class="hboard" aria-live="polite">${esc(PN(seat))}: ${esc(boardBits)}</p>`:""}
  <p class="meta">${esc(what)}. ${esc(PN(1-seat))}, look away while ${esc(PN(seat))} takes the phone.</p>
  <button class="wide primary" data-a="handoff" data-v="${seat}" aria-label="Show cards for ${esc(PN(seat))}">I'm ${esc(PN(seat))}, show my cards</button></div></div>`}
function endScreen(){const st=S.st,w=S.pp?(st.winner===ME()):(st.winner===0),s0=(st.stats||[{},{}])[0],s1=(st.stats||[{},{}])[1];
  if(!st._recorded)recordMatch(st);const R=S.lastResult||{},streak=(!S.pp&&!S.gold&&R.won)?(R.streak||0):0;
  const rowS=(l,a,b)=>`<tr><td>${l}</td><td>${a||0}</td><td>${b||0}</td></tr>`;
  const title=S.pp?esc(PN(st.winner))+" wins":S.gold?(st.winner===0?"Practice complete":"Goldfish wins"):(w?"Victory":"Defeat");
  const cine=w?"VICTORY":"DEFEAT";
  const d0=S.last&&S.last.me&&S.last.me.name,d1=S.last&&S.last.op&&S.last.op.name;
  const deckLine=S.last&&d0&&d1?`<p class="meta rematchdecks">${esc(d0)} vs ${esc(d1)}${S.daily?" · Daily":""}${SET.level&&!S.pp&&!S.gold?" · "+String(SET.level).toUpperCase():""}${S.pp?" · Pass and play":""}</p>`:"";
  const streakBlock=streak?`<p class="streak" role="status">${esc(R.reward||("Win streak "+streak))} <b>${streak}</b></p>`:(!S.pp&&!S.gold&&!w?`<p class="streak broke" role="status">Streak ended</p>`:"");
  const ch0=st.players[0].play.filter(x=>x.card.type==="character").length,ch1=st.players[1].play.filter(x=>x.card.type==="character").length;
  const ink0=st.players[0].ink.length,ink1=st.players[1].ink.length;
  const hand0=st.players[0].hand.length,hand1=st.players[1].hand.length;
  const boardLine=`<p class="endboard" role="status">Final board · chars ${ch0}–${ch1} · ink ${ink0}–${ink1} · hand ${hand0}–${hand1}</p>`;
  return`<div class="modal end ${w?"won":"lost"}" role="dialog" aria-label="${esc(title)}"><div class="cine" aria-hidden="true"><div class="rays"></div><div class="ctitle">${cine}</div></div><div class="mbox"><h2 class="${w?"win":"lose"}">${title}</h2>
  ${streakBlock}${deckLine}${boardLine}<p class="meta">${esc(st.log[st.log.length-1]||"")}</p>
  <table class="stt"><tr><th></th><th>${esc(PN(0))}</th><th>${esc(PN(1))}</th></tr>${rowS("Lore",st.players[0].lore,st.players[1].lore)}${rowS("Cards played",s0.play,s1.play)}${rowS("Quests",s0.quest,s1.quest)}${rowS("Challenges",s0.challenge,s1.challenge)}${rowS("Characters banished",s0.banished,s1.banished)}${rowS("Chars left",ch0,ch1)}${rowS("Ink",ink0,ink1)}<tr><td>Turns</td><td colspan="2">${st.turnNo}</td></tr></table>
  <button class="wide" data-a="alog" aria-label="Open action log">Action log</button><button class="wide" data-a="sumcopy" aria-label="Copy match summary">Copy match summary</button>
  <button class="wide primary" data-a="again" aria-label="Rematch same decks">Rematch</button>${!S.pp&&!S.gold?`<button class="wide" data-a="againSwap" aria-label="Rematch with decks swapped">Rematch · swap decks</button>`:""}<button class="wide" data-a="tomenu" aria-label="Change decks">Change decks</button></div></div>`}
/* ---- animation & feedback ---- */
function snapRects(){const m=new Map();root.querySelectorAll("[data-uid]").forEach(e=>{m.set(+e.dataset.uid,{r:e.getBoundingClientRect(),html:e.querySelector("img")?.outerHTML||"",ex:e.classList.contains("ex"),dmg:+(e.querySelector(".dtok")?.textContent||0),hand:e.classList.contains("hc")})});
  for(const id of["lore-0","lore-1","ink-0","ink-1","deck-0","deck-1","disc-0","disc-1","hand-1"]){const e=document.getElementById(id);if(e)m.set(id,{r:e.getBoundingClientRect()})}return m}
function ghost(r,html,cls){const g=document.createElement("div");g.className="ghost "+(cls||"");g.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;g.innerHTML=html;document.body.appendChild(g);GH.add(g);const kill=()=>{g.remove();GH.delete(g)};g.addEventListener("animationend",kill);g._t=setTimeout(kill,2500);return g}
const GH=new Set();function clearFx(){for(const g of GH){clearTimeout(g._t);try{g.getAnimations&&g.getAnimations().forEach(a=>a.cancel())}catch(_){ }g.remove()}GH.clear();
  document.querySelectorAll(".ghost,.ftext,.tsweep,.shuffle").forEach(x=>{try{x.getAnimations&&x.getAnimations().forEach(a=>a.cancel())}catch(_){ }x.remove()});
  if(root)root.querySelectorAll(".ct.enter,.ct.flipin,.ct.readied,.ct.aifocus,.chip.fill").forEach(el=>{el.classList.remove("enter","flipin","readied","aifocus","fill");el.style.opacity="";el.style.visibility="";el.style.transform=""})}
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
  noteEvents(evs);noteOppPlay(evs);
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
/* #31/#32 Sound pack + volume + background music (Web Audio, no external files) */
let AC=null,MUS={on:false,t:null,nodes:[]};
function audioCtx(){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();return AC}catch(e){return null}}
function volN(){return Math.max(0,Math.min(1,(+SET.volume||0)/100))}
function sfx(k){if(!SET.sound||volN()<=0)return;const ctx=audioCtx();if(!ctx)return;
  try{const t0=ctx.currentTime,V=volN()*.22;
    const tone=(type,f,dur,g0,toF)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t0);if(toF)o.frequency.exponentialRampToValueAtTime(Math.max(.01,toF),t0+dur*.9);g.gain.setValueAtTime(Math.max(.0001,g0*V),t0);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);o.connect(g).connect(ctx.destination);o.start(t0);o.stop(t0+dur+.02)};
    const noise=(dur,g0,bp)=>{const n=Math.max(1,Math.floor(ctx.sampleRate*dur)),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.6);const src=ctx.createBufferSource();src.buffer=buf;const g=ctx.createGain(),f=ctx.createBiquadFilter();f.type="bandpass";f.frequency.value=bp||800;f.Q.value=0.7;g.gain.setValueAtTime(g0*V,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);src.connect(f).connect(g).connect(ctx.destination);src.start(t0);src.stop(t0+dur+.02)};
    if(k==="play"){tone("triangle",523,.18,.55,784);tone("sine",784,.22,.25,1046)}
    else if(k==="ink"){tone("sine",220,.28,.5,110);noise(.2,.35,180)}
    else if(k==="quest"){tone("sine",660,.16,.5,990);tone("triangle",990,.22,.3,1320)}
    else if(k==="hit"){noise(.18,.7,220);tone("square",140,.14,.4,70)}
    else if(k==="ban"){noise(.32,.8,140);tone("sawtooth",90,.3,.45,40)}
    else if(k==="turn"){tone("sine",392,.12,.4);setTimeout(()=>{try{const c=audioCtx();if(!c||!SET.sound)return;const o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.value=523;g.gain.value=.35*volN()*.22;g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.18);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.2)}catch(e){}},90)}
    else if(k==="flip"){tone("triangle",600,.2,.45,900)}
    else if(k==="ui"){tone("sine",880,.06,.25)}
    else if(k==="win"){tone("sine",523,.2,.5,784);setTimeout(()=>sfx("quest"),120)}
    else tone("sine",400,.15,.35)
  }catch(e){}}
function stopMusic(){MUS.on=false;if(MUS.t){clearTimeout(MUS.t);MUS.t=null}for(const n of MUS.nodes){try{n.stop()}catch(e){}}MUS.nodes=[];}
function musicTick(){if(!MUS.on||!SET.music||volN()<=0){stopMusic();return}const ctx=audioCtx();if(!ctx)return;
  try{const t0=ctx.currentTime,V=volN()*.045,notes=[196,246.94,293.66,392,493.88,392,329.63,246.94];
    notes.forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();
      o.type="sine";o.frequency.value=f;lfo.frequency.value=0.15+i*.02;lg.gain.value=6;lfo.connect(lg).connect(o.frequency);
      const st=t0+i*.42;g.gain.setValueAtTime(.0001,st);g.gain.linearRampToValueAtTime(V,st+.08);g.gain.linearRampToValueAtTime(.0001,st+.55);
      o.connect(g).connect(ctx.destination);o.start(st);o.stop(st+.6);lfo.start(st);lfo.stop(st+.6);MUS.nodes.push(o,lfo)});
    MUS.t=setTimeout(musicTick,notes.length*420)}catch(e){MUS.t=setTimeout(musicTick,2000)}}
function syncMusic(){if(SET.music&&SET.sound&&volN()>0){if(!MUS.on){MUS.on=true;musicTick()}}else stopMusic()}
function setVol(n){SET.volume=Math.max(0,Math.min(100,+n||0));saveSet();if(SET.volume<=0){stopMusic()}else syncMusic()}
function toast(msg){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.classList.remove("show");void t.offsetWidth;t.classList.add("show")}
function describe(a,st){const n=u=>E.find(st,u)?.inst.card.full||"";switch(a.t){case"ink":return"AI puts a card into its inkwell";case"play":return a.singer!=null?`AI sings ${n(a.uid)}`:a.shift!=null?`AI shifts ${n(a.uid)}`:`AI plays ${n(a.uid)}`;
  case"quest":return`AI quests with ${n(a.uid)}`;case"challenge":return`AI challenges ${n(a.target)} with ${n(a.uid)}`;case"move":return`AI moves ${n(a.uid)} to ${n(a.loc)}`;case"act":return`AI uses ${n(a.uid)}'s ability`;case"boost":return`AI boosts ${n(a.uid)}`;case"end":return"AI ends its turn";case"discard":return"AI discards a card"}return""}
/* ---- player interaction ---- */
/* #26 One-step undo: snapshot via freezeState before a human main action (no pending). Thaw restores even if that action opened a choice. Cleared when AI/gold acts or a new game starts. */
function clearUndo(){S.undo=null}
function snapUndo(){if(!S.st||S.st.winner!=null||S.st.pending||(S.st.pq&&S.st.pq.length))return;const fr=E.freezeState(S.st);if(fr&&!fr.error)S.undo=fr}
function canUndo(){return!!(S.undo&&S.st&&S.st.winner==null&&!S.busy&&S.screen==="board"&&!S.tutLock)}
function doUndo(){if(!canUndo()){toast("Nothing to undo");return}try{const last=((S.st&&S.st.log)||[]).slice(-1)[0];const st=E.thawState(S.undo,pool);S.st=st;S.undo=null;S.sel=null;S.tm=null;S.hint=false;S.pkSel=[];closeSheet();sfx("ui");toast(last?"Undid: "+String(last).slice(0,48):"Undid last action");renderBoard();advanceTut()}catch(e){console.error(e);clearUndo();toast("Undo failed")}}
function illegalWhy(a,e){const msg=(e&&e.message)||"";
  if(/ink|inkwell/i.test(msg))return "Not enough ink for that";
  if(/dry|drying/i.test(msg))return "That character is still drying";
  if(/exert/i.test(msg))return "That character is exerted";
  if(/target/i.test(msg))return "That target is not legal";
  if(a&&a.t==="ink")return "You already inked this turn, or that card is not inkable";
  if(a&&a.t==="quest")return "Cannot quest with that character right now";
  if(a&&a.t==="challenge")return "That challenge is not legal";
  if(a&&a.t==="play")return "Cannot play that card right now (cost, ink, or timing)";
  if(a&&a.t==="move")return "Cannot move there (ink cost or location)";
  return "That move is not allowed"}
function playerConfirm(a,st){const n=u=>{const f=E.find(st,u);return f?f.inst.card.name:""};
  if(a.t==="quest"){const x=E.find(st,a.uid)?.inst;return x?`Quest +${E.loreOf(x)} lore with ${n(a.uid)}`:""}
  if(a.t==="challenge"){const at=E.find(st,a.uid)?.inst,d=E.find(st,a.target)?.inst;if(!at||!d)return"";
    const dmg=Math.max(0,E.strOf(at)+(E.K(at,"challenger")||0)-(E.K(d,"resist")||0));
    return `Challenge ${n(a.target)} (${dmg} dmg) with ${n(a.uid)}`}
  if(a.t==="ink")return `Inked ${n(a.uid)}`;
  if(a.t==="move")return `Moved ${n(a.uid)} to ${n(a.loc)}`;
  if(a.t==="play"&&a.shift!=null)return `Shifted ${n(a.uid)} onto ${n(a.shift)}`;
  return ""}
function doAct(a){if(S._tapLock&&Date.now()<S._tapLock&&a&&a.t!=="end"){return}S._tapLock=Date.now()+280;const conf=playerConfirm(a,S.st);S.sel=null;S.tm=null;S.hint=false;closeSheet();
  if(!S.st.pending&&!(S.st.pq&&S.st.pq.length))snapUndo();
  try{E.act(S.st,a);if(conf)toast(conf)}catch(e){console.error(e);toast(illegalWhy(a,e))}
  renderBoard();advanceTut();if(aiTurn()&&S.st.winner==null)aiLoop();else if(goldTurn())goldLoop()}
function goldLoop(){if(S.busy||!S.st||S.screen!=="board")return;S.busy=true;
  const step=()=>{const st=S.st;if(!st||!S.gold||st.winner!=null||st.active!==1){S.busy=false;if(st&&S.screen==="board")renderBoard();return}
    if(st.pending){ // auto-resolve goldfish choices: skip / first option / discard last
      const P=st.pending;clearUndo();try{if(P.kind==="ask"){if(P.min===0||P.reveal)E.act(st,{t:"askDone"});else E.act(st,{t:"ask",i:0});if(st.pending===P)E.act(st,{t:"askDone"})}
        else if(P.kind==="dig"||P.kind==="free")E.act(st,{t:"pickDone"});
        else if(P.n){const h=st.players[1].hand;if(h.length)E.act(st,{t:"discard",uid:h[h.length-1].uid})}
        else E.act(st,{t:"askDone"})}catch(e){try{E.act(st,{t:"end"})}catch(_){ }}
      renderBoard();setTimeout(step,SPEED[SET.speed]*.35);return}
    clearUndo();try{E.act(st,{t:"end"})}catch(e){console.error(e)}renderBoard();S.busy=false};
  setTimeout(step,SPEED[SET.speed]*.4)}
function startTargeting(list,key,label){
  if(list.length===1&&(list[0][key]==null)){doAct(list[0]);return}
  const withT=list.filter(a=>a[key]!=null);if(!withT.length){doAct(list[0]);return}
  const tm={list:withT,key,kind:key,label,targets:new Set(withT.map(a=>a[key])),none:list.find(a=>a[key]==null)};
  // #23: show ink cost to move onto each location
  if(key==="loc"&&S.sel!=null){const ch=E.find(S.st,S.sel)?.inst;tm.moveOf=new Map();
    for(const a of withT){const l=E.find(S.st,a.loc)?.inst;if(ch&&l)tm.moveOf.set(a.loc,E.moveCost(S.st,ME(),ch,l))}}
  // #24: shift targets get distinct highlight via kind
  if(key==="shift")tm.label=(label||"Shift")+" — purple glow marks legal Shift targets";
  S.tm=tm;renderBoard();
  if(S.tm.none)toast("No legal target? Tap Cancel and play it without one.");
}
function startSingTogether(acts,c){
  const need=c.singTogether,uids=new Set();
  for(const a of acts)if(a.singers)a.singers.split(",").forEach(u=>uids.add(+u));
  if(uids.size<2){toast("Need at least 2 ready characters to Sing Together");return}
  S.tm={mode:"singT",uid:S.sel,need,sel:new Set(),eligible:uids,label:`Sing Together ${need}: tap singers`,acts};
  renderBoard();
}
function choose(title,opts){ // opts: [{label,fn,cls}]
  sheet(`<h4>${esc(title)}</h4>${opts.map((o,i)=>`<button class="wide ${o.cls||""}" data-a="chs" data-i="${i}">${esc(o.label)}</button>`).join("")}<button class="wide ghostw" data-a="close">Cancel</button>`);S.chs=opts}
function runGroup(k){const acts=groupActs(legalFor(S.sel))[k];if(!acts)return;const f=E.find(S.st,S.sel),c=f.inst.card;
  if(k==="ink"||k==="boost")return doAct(acts[0]);
  if(k==="challenge"){const at=f.inst,as=E.strOf(at)+(E.K(at,"challenger")||0);return startTargeting(acts,"target",`Challenge with ${c.name} (${as} STR) — tap a glowing target`);}
  if(k==="move")return startTargeting(acts,"loc",`Choose a location for ${c.name}`);
  if(k==="shift")return startTargeting(acts,"shift",`Choose which ${c.name} to shift onto`);
  if(k==="sing")return startTargeting(acts,"singer",`Choose a character to sing ${c.name}`);
  if(k==="singT"){const f0=E.find(S.st,S.sel);return startSingTogether(acts,f0.inst.card)}
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
  if(S.tm){
    if(S.tm.mode==="singT"){if(!S.tm.eligible.has(uid)){toast("Tap a glowing singer, or Cancel");return}
      if(S.tm.sel.has(uid))S.tm.sel.delete(uid);else S.tm.sel.add(uid);renderBoard();return}
    if(S.tm.targets.has(uid)){const a=S.tm.list.find(x=>x[S.tm.key]===uid);doAct(a)}else toast("Tap a glowing card, or Cancel");return}
  const f=E.find(st,uid);if(!f)return;
  if(f.pi!==ME()||!myTurn()){zoom(uid);return}
  S.sel=uid;renderBoard();zoom(uid,elOf(uid),true);
}
function afterPick(){S.pkSel=[];S.pkMin=false;if(S.screen!=="board")return;renderBoard();advanceTut();if(aiTurn()&&!S.st.pending&&S.st.winner==null)aiLoop()}
function aiLoop(){if(S.busy)return;S.busy=true;
  const step=()=>{const st=S.st;if(!st||S.screen!=="board"||st.winner!=null||S.paused){S.busy=false;if(st&&S.screen==="board")renderBoard();return}
    if(st.pending&&st.human[st.pending.pi]){S.busy=false;renderBoard();return} // wait for the player's discard
    if(S.pp||st.active!==1){S.busy=false;renderBoard();return}
    const a=E.aiChoose(st,AILV());if(!a){S.busy=false;return}
    if(a.uid!=null){const el=elOf(a.uid);if(el)el.classList.add("aifocus")}
    toast(describe(a,st));
    setTimeout(()=>{clearUndo();try{E.act(st,a)}catch(e){console.error(e);try{E.act(st,{t:"end"})}catch(_){}}renderBoard();setTimeout(step,a.t==="end"?SPEED[SET.speed]*.6:SPEED[SET.speed])},SPEED[SET.speed]*.45)};
  setTimeout(step,SPEED[SET.speed]*.6)}
const TIPS=["Your side is at the bottom: characters, then items and locations, then your lore, inkwell, deck and discard.","Cards in your hand that glow gold can be played now. The small drop icon means a card is inkable: select it and tap Ink it (once per turn).","Tap one of your characters to select it, then choose Quest or Challenge. Legal targets glow red; tap one to confirm.","Characters that are drying (blue DRYING tag) can't quest or challenge until your next turn. Green READY means dry and ready. Rush can challenge the turn they are played.","First to 20 lore wins. The banner shows the lore race and whether ink is still available this turn.","Shift: play a Floodborn onto a matching character for the Shift cost — it keeps damage and drying. Look for purple glow on Shift targets.","Songs can be sung for free by exerting a ready character with cost (or Singer N) ≥ the song cost. Sing Together combines several singers.","Bodyguard: if an opposing Bodyguard is exerted, you must challenge it before other characters. Ward: actions and abilities cannot choose that character — challenge it instead.","Support: when a character with Support quests, choose another character to get +Strength equal to the supporter's Strength this turn — great before a challenge.","Evasive characters can only be challenged by Evasive (or Alert) characters. Use your Evasive/Alert attackers to remove opposing Evasive lore threats.","Challenger characters get +Strength while challenging — use them to clean-kill exerted lore threats you could not otherwise finish.","Singer N lets a character sing songs costing up to N — keep Singer characters when you have expensive songs, and prefer them over high-lore singers.","Reckless characters cannot quest and must challenge before you can end your turn — pick the best trade (clean kill on a lore threat when you can).","When a move is illegal you will see a short toast (for example drying, not enough ink, or wrong target). Use the hint button to highlight legal moves."];
function tip(i){if(i>=TIPS.length){SET.tips=false;saveSet();closeSheet();return}sheet(`<h4>Tip ${i+1} of ${TIPS.length}</h4><p class="tiptext">${TIPS[i]}</p><button class="wide primary" data-a="tip" data-i="${i+1}">${i+1<TIPS.length?"Next":"Got it"}</button><button class="wide ghostw" data-a="tip" data-i="99">Skip tips</button>`)}
function settingsHtml(){const pill=(k,v,l)=>`<button class="opt ${SET[k]===v?"on":""}" data-a="set" data-k="${k}" data-v="${v}">${l}</button>`;
  return`<h4>AI difficulty</h4><div class="opts">${pill("level","easy","Easy")}${pill("level","normal","Normal")}${pill("level","hard","Hard")}</div>
  <h4>AI style</h4><div class="opts">${Object.entries(STYLES).map(([k,l])=>pill("style",k,l)).join("")}</div>
  <h4>Game speed</h4><div class="opts">${pill("speed","slow","Slow")}${pill("speed","normal","Normal")}${pill("speed","fast","Fast")}</div>
  <p class="meta small">Controls AI thinking pauses and board animations.</p>
  <h4>Effects</h4><div class="opts"><button class="opt ${window.FX&&!FX.low?"on":""}" data-a="fxlow" data-v="0">Full</button><button class="opt ${window.FX&&FX.low?"on":""}" data-a="fxlow" data-v="1">Low power</button></div>
  <h4>Sound effects</h4><div class="opts">${pill("sound",false,"Off")}${pill("sound",true,"On")}</div>
  <h4>Volume <small>${SET.volume|0}%</small></h4><div class="volrow"><input type="range" min="0" max="100" step="5" value="${SET.volume|0}" data-a="vol" id="volrange" aria-label="Volume"><span class="vollbl">${SET.volume|0}%</span></div>
  <h4>Background music</h4><div class="opts">${pill("music",false,"Off")}${pill("music",true,"On")}</div>
  <p class="meta small">Music uses soft generated tones (no downloads). Requires Sound effects On.</p>
  <h4>Tips</h4><div class="opts"><button class="opt" data-a="tipsagain">Show tips again</button></div>`}
function pauseMenu(){S.paused=true;const canSave=S.st&&S.st.winner==null&&!S.st.pending&&!(S.st.pq&&S.st.pq.length)&&S.st.phase==="main";
  const st0=S.st,me0=st0&&st0.players[ME()];
  const dry0=me0?me0.play.filter(x=>x.card.type==="character"&&!E.dry(st0,x)).length:0;
  const rdy0=me0?me0.play.filter(x=>x.card.type==="character"&&!x.exerted&&E.dry(st0,x)).length:0;
  const ink0=me0?`${E.inkAvail(me0)}/${me0.ink.length} ink`:"";
  const inkable0=me0?me0.hand.filter(h=>h.card.inkable).length:0;
  const lore0=st0?`${st0.players[ME()].lore}–${st0.players[OP()].lore}`:"";
  const meta=st0?`<p class="meta small pausemeta">Turn ${st0.turnNo} · ${lore0} lore · seed ${st0.seed||"?"} · ${(S.meName||"You")} vs ${(S.oppName||"AI")}${(rdy0||dry0)?` · ${rdy0} ready${dry0?` · ${dry0} drying`:""}`:""}${ink0?` · ${ink0}`:""}${inkable0?` · ${inkable0} inkable`:""}</p>`:"";
  sheet(`<h4>Game paused</h4>${meta}<button class="wide primary" data-a="resume">Resume</button>${canSave?`<button class="wide" data-a="savegame">Save game</button>`:`<p class="meta small">Save is available between actions (not mid-choice).</p>`}${settingsHtml()}<button class="wide" data-a="concede">Concede</button><button class="wide ghostw" data-a="quitgame">Quit to menu</button>`)}
const SAVEKEY="lorcanaSave.v1";
function saveGameNow(){if(!S.st)return toast("No game");const fr=E.freezeState(S.st);if(!fr)return toast("Can't save a finished game");if(fr.error)return toast("Finish the current choice before saving");
  const meta={savedAt:Date.now(),mode:S.mode||"ai",pp:!!S.pp,gold:!!S.gold,daily:!!S.daily,deck:S.deck,meName:S.meName,oppName:S.oppName,level:SET.level,style:SET.style,names:S.names,last:S.last?{me:{name:S.last.me.name},op:{name:S.last.op.name}}:null};
  try{localStorage.setItem(SAVEKEY,JSON.stringify({meta,state:fr}));toast("Game saved");closeSheet();S.paused=false}catch(e){toast("Save failed (storage full?)")}}
function loadSavedMeta(){try{const o=JSON.parse(localStorage.getItem(SAVEKEY)||"null");return o&&o.meta&&o.state?o:null}catch(e){return null}}
function resumeSaved(){const o=loadSavedMeta();if(!o){toast("No saved game");return}
  try{const st=E.thawState(o.state,pool);S.st=st;S.pp=!!o.meta.pp;S.gold=!!o.meta.gold;S.daily=!!o.meta.daily;S.mode=o.meta.mode||"ai";S.deck=o.meta.deck;S.meName=o.meta.meName;S.oppName=o.meta.oppName;S.names=o.meta.names||["Player 1","Player 2"];
    if(o.meta.level)SET.level=o.meta.level;if(o.meta.style)SET.style=o.meta.style;S.sel=null;S.tm=null;S.alog=[];S.celebrated=false;S.tipShown=true;S.paused=false;S.screen="board";renderBoard();
    if(aiTurn())aiLoop();toast("Game resumed")}catch(e){console.error(e);toast("Could not resume save")}}
function clearSave(){try{localStorage.removeItem(SAVEKEY)}catch(e){}}
/* #47 Daily challenge: fixed seed from Phoenix date + fixed starter pair */
function phoenixDateKey(){const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Phoenix",year:"numeric",month:"2-digit",day:"2-digit"});return fmt.format(new Date())}
function dailySeed(key){let h=2166136261>>>0;for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function startDaily(){if(!pool||!pool.length){toast("Cards still loading");return}
  const key=phoenixDateKey(),seed=dailySeed(key),i=seed%STARTERS.length,j=(seed>>>8)%STARTERS.length;
  const me=deckFromSel("s"+i),op=deckFromSel("s"+((j===i?(j+1)%STARTERS.length:j)));
  if(!me.cards||!op.cards){toast("Daily decks not ready");return}
  S.daily=true;S.mode="ai";S.pp=false;S.gold=false;S.tut=null;S.deck="s"+i;S.last={me,op};S.meName=me.name+" (Daily)";S.oppName=op.name;
  S.names=["You","AI"];S.shown=null;S.mullSeat=0;clearUndo();
  S.st=E.newGame({decks:[me.cards,op.cards],names:["You","AI"],seed:seed,first:seed%2,human:[true,false]});
  E.mulligan(S.st,1,E.aiMulligan(S.st,1));
  S.mullSel=new Set();S.sel=null;S.tm=null;S.alog=[];S.celebrated=false;S.screen="coin";render();
}
/* #40 Rules reference */
function rulesHtml(){return`<h4>Rules reference</h4><div class="rules">
<h5>Goal</h5><p>Be the first to reach <b>20 lore</b>. If both players reach the goal at the same time, the <b>active player</b> wins.</p>
<h5>Turn flow</h5><p>Ready (exerted cards become ready) → Set (clear temporary effects) → Draw (except first player's first turn) → Main (ink, play, quest, challenge, move, abilities) → End.</p>
<h5>Inking</h5><p>Once per turn, put an inkable card from your hand facedown into your inkwell. Ready ink pays costs.</p>
<h5>Quest &amp; Challenge</h5><p>Exert a ready, dry character to quest for its lore. Challenge an exerted character or a location: both deal Strength damage (Resist reduces it). Bodyguard must be challenged first. Evasive can only be challenged by Evasive. Rush may challenge the turn it is played.</p>
<h5>Sing &amp; Sing Together</h5><p>Exert a character with cost (or Singer N) ≥ a song's cost to sing it for free. <b>Sing Together</b> lets multiple ready characters combine their sing values — tap them until you meet the number, then confirm.</p>
<h5>Shift</h5><p>Play a Floodborn onto another character with the same name (or matching Shift text) paying the Shift cost. It keeps damage, exerted state, and drying.</p>
<h5>Locations</h5><p>Pay the shown move cost to move a character onto a location. Locations can be challenged.</p>
</div><button class="wide" data-a="close">Close</button>`}

/* #39 Tutorial game with guided steps */
const TUT_STEPS=[
  {id:"welcome",title:"Welcome to Lorcana",body:"This short tutorial walks you through inking, playing a character, ending your turn, and questing. Tap Next when you are ready — the board stays interactable.",auto:false},
  {id:"ink",title:"Ink a card",body:"Once per turn you may put an inkable card from your hand into your inkwell. Cards with a gold drop can be inked. Select an inkable hand card, then tap Ink it.",check:st=>{const p=st.players[0];return p.inked||p.ink.length>0}},
  {id:"play",title:"Play a character",body:"Spend ready ink to play a character from your hand. Glowing hand cards are playable — tap one, then Play. New characters are drying and cannot quest this turn.",check:st=>st.players[0].play.some(x=>x.card.type==="character")},
  {id:"end",title:"End your turn",body:"When you are done, tap End turn. The practice opponent only draws and passes — then it is your turn again.",check:st=>st.turnNo>=2||(st.active===1&&!st.pending)},
  {id:"quest",title:"Quest for lore",body:"On your next turn, ready dry characters can quest. Tap a ready character that is not drying, then Quest to gain lore. First to 20 wins!",check:st=>st.players[0].lore>0||(S.alog||[]).some(r=>r.t==="quest"&&r.pi===0)},
  {id:"done",title:"You're ready!",body:"Great work. Keep playing this game, or quit to the menu and try Daily challenge or a full AI match. Use the undo button (curved arrow) to take back your last action when it is available.",auto:false}
];
function tutHtml(){if(!S.tut)return"";const step=TUT_STEPS[S.tut.i];if(!step)return"";
  const n=S.tut.i+1,tot=TUT_STEPS.length;
  return`<div class="tut" role="dialog" aria-label="Tutorial"><div class="tutcard"><div class="tuthead"><b>Tutorial ${n}/${tot}</b><button class="tutx" data-a="tutskip" aria-label="Skip tutorial">Skip</button></div>
  <h4>${esc(step.title)}</h4><p>${esc(step.body)}</p>
  <div class="tutacts">${S.tut.i<TUT_STEPS.length-1?`<button class="wide primary" data-a="tutnext">${step.check?"I did it — Next":"Next"}</button>`:`<button class="wide primary" data-a="tutdone">Finish tutorial</button>`}</div></div></div>`}
function advanceTut(){if(!S.tut||S.st==null)return;const step=TUT_STEPS[S.tut.i];if(!step||!step.check)return;
  try{if(step.check(S.st)){S.tut.i=Math.min(S.tut.i+1,TUT_STEPS.length-1);S.tut.seen=S.tut.seen||{};S.tut.seen[step.id]=true;if(S.screen==="board")renderBoard()}}catch(e){}}
function startTutorial(){if(!pool||!pool.length){toast("Cards still loading");return}
  const me=deckFromSel("s0"),op=deckFromSel("s1");
  if(!me.cards||!op.cards){toast("Tutorial decks not ready");return}
  SET.level="easy";SET.style="balanced";saveSet();
  // Goldfish opponent keeps steps predictable (draw + end only)
  S.daily=false;S.mode="gold";S.pp=false;S.gold=true;S.deck="s0";S.opp="s1";S.last={me,op};
  S.meName=me.name+" (Tutorial)";S.oppName="Goldfish";S.names=["You","Goldfish"];S.shown=null;S.mullSeat=0;clearUndo();
  S.tut={i:0,seen:{}};S.tutLock=false;
  S.st=E.newGame({decks:[me.cards,op.cards],names:["You","Goldfish"],seed:42,first:0,human:[true,false]});
  E.mulligan(S.st,1,[]);
  S.mullSel=new Set();S.sel=null;S.tm=null;S.alog=[];S.celebrated=false;S.tipShown=true;S.screen="coin";render();
  toast("Tutorial started — practice opponent");syncMusic()}

/* events */
function onInput(e){const id=e.target.id;
  if(id==="bq"){S.build.q=e.target.value;S.build.limit=60;const pos=e.target.selectionStart;renderBuilder();const q=$("#bq");if(q){q.focus();q.setSelectionRange(pos,pos)}}
  if(id==="bname")S.build.name=e.target.value;
  if(id==="bnotes")S.build.notes=e.target.value.slice(0,500);
  if(id==="bkw"){S.build.kw=e.target.value;S.build.limit=60;const pos=e.target.selectionStart;renderBuilder();const q=$("#bkw");if(q){q.focus();q.setSelectionRange(pos,pos)}}
  if(id==="bcls"){S.build.cls=e.target.value;S.build.limit=60;const pos=e.target.selectionStart;renderBuilder();const q=$("#bcls");if(q){q.focus();q.setSelectionRange(pos,pos)}}
  if(id==="volrange"){setVol(e.target.value);const lbl=e.target.parentNode&&e.target.parentNode.querySelector(".vollbl");if(lbl)lbl.textContent=(SET.volume|0)+"%";
    const h=e.target.closest("#sheet-body");if(h){const hs=[...h.querySelectorAll("h4")].find(x=>/Volume/.test(x.textContent));if(hs)hs.innerHTML="Volume <small>"+(SET.volume|0)+"%</small>"}}
  if(id==="bimptext"){/* live textarea — no-op */}
}
function onClick(e){if(S.lp){S.lp=false;e.preventDefault();e.stopPropagation();return}
  const b=e.target.closest("[data-a]");if(!b)return;const a=b.dataset.a,v=b.dataset.v;
  // #15 Prevent double-taps from firing twice on board actions only (not menu/nav)
  if(/^(tile|grp|end|endforce|act|pkpick|ppick|pdisc|chs|concedeok)$/.test(a)){
    const now=Date.now();const key=a+":"+(b.dataset.uid||b.dataset.k||b.dataset.i||"");
    if(S._lastAct&&S._lastAct.key===key&&now-S._lastAct.t<300){e.preventDefault();return}
    S._lastAct={key,t:now}}

  switch(a){
    case"quit":if(S.screen==="builder"||S.screen==="mull"){S.screen="menu";render()}else if(S.screen==="board"&&S.st.winner==null&&!confirm("Quit this game?"))return;else if(S.screen==="board"){S.screen="menu";S.st=null;render()}else location.hash="";break;
    case"sel":S.deck=v;renderMenu();break;case"opp":S.opp=v;renderMenu();break;case"quick":{S.mode="ai";S.deck="s"+Math.floor(Math.random()*STARTERS.length);S.opp="s"+Math.floor(Math.random()*STARTERS.length);startGame();break}
    case"start":startGame();break;
    case"daily":startDaily();break;case"tutorial":startTutorial();break;case"rules":sheet(rulesHtml());break;case"resumeSave":resumeSaved();break;case"forgetSave":if(confirm("Discard the saved game?")){clearSave();toast("Save discarded");renderMenu()}break;
    case"undo":doUndo();break;case"tutnext":if(S.tut){S.tut.i=Math.min(S.tut.i+1,TUT_STEPS.length-1);renderBoard()}break;
    case"tutdone":case"tutskip":S.tut=null;if(S.screen==="board")renderBoard();toast(a==="tutskip"?"Tutorial skipped":"Tutorial complete");break;
    case"savegame":saveGameNow();break;case"singtok":{if(!S.tm||S.tm.mode!=="singT")break;const set=[...S.tm.sel].join(",");
      const acts=E.legalActions(S.st).filter(a=>a.t==="play"&&a.uid===S.tm.uid&&a.singers===set);if(!acts.length){toast("Those singers don't meet Sing Together "+S.tm.need);break}
      doAct(acts[0]);break}
    case"builder":{const sel=String(S.deck||"");if(sel[0]==="c"&&decks()[+sel.slice(1)]){const d=decks()[+sel.slice(1)];bInit({...d,idx:+sel.slice(1)})}else bInit();S.screen="builder";render();break}
    case"bview":S.build.view=v;renderBuilder();break;case"bink":S.build.ink=v;S.build.limit=60;renderBuilder();break;case"btype":S.build.type=v;S.build.limit=60;renderBuilder();break;
    case"bmore":S.build.limit+=60;renderBuilder();break;
    case"bclear":if(confirm("Remove all cards from this deck?")){S.build.cards={};closeSheet();renderBuilder()}break;
    case"btools":builderTools();break;
    case"bowned":S.build.ownedOnly=!S.build.ownedOnly;S.build.limit=60;renderBuilder();break;
    case"bcost":S.build.cost=String(S.build.cost)===String(v)?"":v;S.build.view="deck";S.build.limit=60;renderBuilder();break;
    case"bset":S.build.set=v;S.build.limit=60;renderBuilder();break;
    case"bsort":S.build.sort=v;renderBuilder();break;
    case"bexport":{const t=bExportText();sheet(`<h4>Export (Dreamborn)</h4><p class="meta small">Copy this list into Dreamborn, Pixelborn, or a friend.</p><textarea class="pin bimp" id="bexptext" rows="12" readonly>${esc(t)}</textarea>
      <button class="wide primary" data-a="bcopy">Copy to clipboard</button><button class="wide" data-a="close">Close</button>`);break}
    case"bcopy":{const el=$("#bexptext")||$("#bimptext");if(!el)break;el.select();try{navigator.clipboard.writeText(el.value);toast("Copied")}catch(e){toast("Select and copy manually")}break}
    case"bimport":sheet(`<h4>Import deck list</h4><p class="meta small">Paste a Dreamborn / Pixelborn list: <code>4 Elsa - Spirit of Winter</code> per line.</p>
      <textarea class="pin bimp" id="bimptext" rows="12" placeholder="4 Mickey Mouse - True Friend&#10;3 Friends on the Other Side"></textarea>
      <button class="wide primary" data-a="bimportgo" data-v="merge">Add to deck</button>
      <button class="wide" data-a="bimportgo" data-v="replace">Replace deck</button>
      <button class="wide ghostw" data-a="close">Cancel</button>`);break;
    case"bimportgo":{const el=$("#bimptext");if(!el)break;applyImport(el.value,v==="replace");break}
    case"bhand":case"bhandagain":sampleHand();break;
    case"bstarter":loadStarterPicker();break;
    case"bstartergo":applyStarter(v);break;
    case"brename":{const n=prompt("Deck name",S.build.name||"My deck");if(n==null)break;S.build.name=String(n).trim().slice(0,60)||"My deck";closeSheet();renderBuilder();toast("Renamed");break}
    case"bdup":{const b2=S.build;if(!bCount()){toast("Deck is empty");break}
      const all=decks(),d={name:(b2.name||"My deck")+" copy",notes:b2.notes||"",cards:{...b2.cards}};all.push(d);saveDecks(all);
      bInit({...d,idx:all.length-1});toast("Duplicated");closeSheet();renderBuilder();break}
    case"bdel":{const b2=S.build;if(b2.idx==null){toast("Save the deck first");break}
      if(!confirm("Delete \""+(b2.name||"My deck")+"\" permanently?"))break;
      const all=decks();all.splice(b2.idx,1);saveDecks(all);
      if(S.deck==="c"+b2.idx)S.deck="s0";
      toast("Deck deleted");closeSheet();S.screen="menu";render();break}
    case"bview1":builderSheet(b.dataset.id,b);break;
    case"badd":badd(b.dataset.id,+b.dataset.d);break;
    case"bsave":{const b2=S.build,n=bCount(),inks=bInks();if(n<60||inks.length>2){if(!confirm(`This deck has ${n} cards${inks.length>2?" and too many inks":""}. Save it anyway as a draft?`))return}
      const all=decks(),d={name:b2.name||"My deck",notes:b2.notes||"",cards:b2.cards};if(b2.idx!=null)all[b2.idx]=d;else{all.push(d);b2.idx=all.length-1}saveDecks(all);S.deck="c"+b2.idx;S.screen="menu";render();break}
    case"mtog":{const u=+b.dataset.uid;S.mullSel.has(u)?S.mullSel.delete(u):S.mullSel.add(u);renderMull();break}
    case"mdone":{const go=()=>{E.mulligan(S.st,S.pp?S.mullSeat:0,[...S.mullSel]);S.mullSel=new Set();if(S.pp&&S.mullSeat===0){S.mullSeat=1;renderMull();return}S.st.events=[];S.screen="board";S.tipShown=false;renderBoard();if(aiTurn())aiLoop()};
      if(lowA()||!S.mullSel.size){go();break}
      const outs=[...root.querySelectorAll(".bcard.out")],dk={left:innerWidth/2-30,top:innerHeight-120,width:60,height:84};
      outs.forEach((el,i)=>{const r=el.getBoundingClientRect();el.style.visibility="hidden";const a=flyGhost(r,dk,el.querySelector("img").outerHTML,{dur:520,delay:i*70,t1:"rotate(12deg)"});a.onfinish=()=>a.effect.target.remove()});
      setTimeout(()=>{const sh=document.createElement("div");sh.className="shuffle";sh.innerHTML='<i></i><i></i><i></i>';document.body.appendChild(sh);GH.add(sh);sh._t=setTimeout(()=>{sh.remove();GH.delete(sh);go()},850)},520+outs.length*70);break}
    case"handoff":S.shown=+v;if(S.screen==="mull")renderMull();else renderBoard();break;
    case"mode":S.mode=v;renderMenu();break;
    case"lvl":SET.level=v;saveSet();renderMenu();break;case"sty":SET.style=v;saveSet();renderMenu();break;
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
    case"set":{const k=b.dataset.k;if(k==="sound"||k==="music")SET[k]=v==="true";else SET[k]=v;saveSet();syncMusic();if(k==="sound"&&SET.sound)sfx("ui");
      if(S.paused)pauseMenu();else if($("#sheet")&&$("#sheet").classList.contains("open"))sheet(settingsHtml()+`<button class="wide" data-a="close">Done</button>`);
      else if(S.screen==="menu")renderMenu();break}
    case"vol":break;
    case"tipsagain":SET.tips=true;saveSet();S.tipShown=false;closeSheet();S.paused=false;if(S.screen==="board")renderBoard();break;
    case"tip":tip(+b.dataset.i);break;
    case"concede":sheet(`<h4>Concede?</h4><p class="conwarn">You will lose this game. This cannot be undone.</p><button class="wide primary" data-a="concedeok" style="background:#c4163a;border-color:#ff4d6a">Concede and lose</button><button class="wide ghostw" data-a="pause">Keep playing</button>`);break;
    case"concedeok":S.paused=false;closeSheet();S.st.winner=S.pp?OP():1;S.st.phase="over";S.st.log.push((S.pp?PN(ME()):"You")+" conceded.");renderBoard();break;
    case"hint":{if(!myTurn()||S.tm){S.hint=false;break}S.hint=!S.hint;if(S.hint){const A=E.legalActions(S.st),kinds={};const lab={end:"end turn",quest:"quest",challenge:"challenge",play:"play",ink:"ink",move:"move",act:"ability",boost:"boost",shift:"shift"};
      for(const a of A){let k=a.t;if(a.t==="play"&&a.shift!=null)k="shift";else if(a.t==="play"&&(a.singer!=null||a.singers))k="sing";kinds[k]=(kinds[k]||0)+1}
      const useful=Object.keys(kinds).filter(k=>k!=="end");
      if(!useful.length)toast("No plays left — tap End turn when ready");
      else{const parts=useful.map(k=>kinds[k]+" "+(lab[k]||k));toast("Highlighted: "+parts.slice(0,5).join(", ")+" · gold glow = legal")}
      }else toast("Hints off");renderBoard();break}
    case"quitgame":S.paused=false;closeSheet();S.screen="menu";S.st=null;render();break;
    case"end":{const acts=E.legalActions(S.st).filter(a=>a.t!=="end");
      const remain=acts.filter(a=>a.t==="quest"||a.t==="challenge"||a.t==="play"||a.t==="act"||a.t==="move"||a.t==="ink");
      if(remain.length&&!S.skipEndConfirm){const kinds=[...new Set(remain.map(a=>a.t==="play"?"play a card":a.t==="act"?"use an ability":a.t==="ink"?"ink a card":a.t==="quest"?"quest":a.t==="challenge"?"challenge":a.t))];
        const meP=S.st.players[ME()];const dryN=meP.play.filter(x=>x.card.type==="character"&&!E.dry(S.st,x)&&!K0(x,"rush")).length;
        const qLore=remain.filter(a=>a.t==="quest").reduce((t,a)=>{const f=E.find(S.st,a.uid);return t+(f?E.loreOf(f.inst):0)},0);
        const extra=(!meP.inked?" Ink still available.":"")+(dryN?` ${dryN} character${dryN>1?"s are":" is"} still drying.`:"");
        const qNote=qLore?` About ${qLore} lore still questable.`:"";
        sheet(`<h4>End your turn?</h4><p class="tiptext">You can still ${kinds.slice(0,4).join(", ")}${kinds.length>4?", …":""}.${extra}${qNote}</p><button class="wide primary" data-a="endforce" aria-label="End turn anyway">End turn</button><button class="wide ghostw" data-a="close" aria-label="Keep playing">Keep playing</button>`);break}
      S.skipEndConfirm=false;doAct({t:"end"});break}
    case"endforce":S.skipEndConfirm=true;closeSheet();doAct({t:"end"});break;
    case"log":sheet(`<h4>Game log</h4><div class="logfull">${S.st.log.slice().reverse().map(l=>`<div>${esc(l)}</div>`).join("")}</div><button class="wide" data-a="close">Close</button>`);break;
    case"alog":sheet(`<h4>Action log</h4>${alogHtml()}<button class="wide" data-a="close">Close</button>`);break;
    case"history":showHistory();break
    case"histf":S.histFilter=v;showHistory();break
    case"histexp":{const rows=loadHist();const t=rows.map(r=>{const res=r.mode==="pp"?(r.winner===0?"P1":"P2"):(r.won?"W":"L");
      return[new Date(r.t).toISOString().slice(0,16),r.mode,res,(r.me||"You")+" vs "+(r.opp||"?"),(r.lore||[]).join("-"),r.turns||"?",r.deckName||"",r.level||""].join("\t")}).join("\n");
      const head="when\tmode\tresult\tmatchup\tlore\tturns\tdeck\tlevel\n";
      try{navigator.clipboard.writeText(head+t);toast("History copied")}catch(e){sheet(`<h4>Match history export</h4><textarea class="pin bimp" rows="12" readonly>${esc(head+t)}</textarea><button class="wide" data-a="close">Close</button>`)}break}
    case"histclear":if(confirm("Clear all match history on this device?")){saveHist([]);toast("History cleared")}showHistory();break
    case"close":closeSheet();break;case"settings":sheet(settingsHtml()+`<button class="wide" data-a="close">Done</button>`);break;
    case"sumcopy":{const st=S.st,s0=(st.stats||[{},{}])[0],s1=(st.stats||[{},{}])[1];
      const ch0=st.players[0].play.filter(x=>x.card.type==="character").length,ch1=st.players[1].play.filter(x=>x.card.type==="character").length;
      const d0=S.last&&S.last.me&&S.last.me.name,d1=S.last&&S.last.op&&S.last.op.name;
      const lines=[(S.pp?PN(st.winner)+" wins":(st.winner===0?"Victory":"Defeat"))+" · Turn "+st.turnNo+(SET.level&&!S.pp&&!S.gold?" · "+String(SET.level).toUpperCase():""),
        (d0&&d1?d0+" vs "+d1:(S.meName||"")+" vs "+(S.oppName||"AI")),
        PN(0)+": "+st.players[0].lore+" lore · "+ch0+" chars · "+st.players[0].ink.length+" ink · played "+(s0.play||0)+" · quests "+(s0.quest||0)+" · challenges "+(s0.challenge||0),
        PN(1)+": "+st.players[1].lore+" lore · "+ch1+" chars · "+st.players[1].ink.length+" ink · played "+(s1.play||0)+" · quests "+(s1.quest||0)+" · challenges "+(s1.challenge||0)];
      const t=lines.filter(Boolean).join("\n");
      try{navigator.clipboard.writeText(t);toast("Match summary copied")}catch(e){sheet(`<h4>Match summary</h4><textarea class="pin bimp" rows="8" readonly>${esc(t)}</textarea><button class="wide" data-a="close">Close</button>`)}break}
    case"again":startGame(true);break;case"againSwap":startGame(true,true);break;case"tomenu":S.screen="menu";S.st=null;render();break;
  }
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const sh=document.getElementById("sheet");if(sh&&sh.classList.contains("open")){e.preventDefault();closeSheet()}}});
window.LorcanaPlay={async open(){ensureRoot();root.hidden=false;document.body.classList.add("playing");render();await loadPool();if(S.screen==="menu"||!S.st&&S.screen!=="builder")S.screen=S.screen==="builder"?"builder":"menu";render();syncMusic()},
  close(){stopMusic();if(root){root.hidden=true;document.body.classList.remove("playing");closeSheet()}},state:()=>S,render:()=>render()};
})();
