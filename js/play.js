/* Play mode: deck select, deck builder, mulligan, board vs AI. Depends on LorcanaEngine. */
(function(){
"use strict";
const E=window.LorcanaEngine,V=window.APP_VERSION||"dev",DKEY="lorcanaDecks.v1";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const STARTERS=[["Amber","Amethyst"],["Ruby","Sapphire"],["Emerald","Steel"],["Amber","Steel"],["Amethyst","Ruby"],["Emerald","Sapphire"]];
const STATUS_LABEL={full:"Fully simulated",keywords:"Keywords simulated",plain:"No abilities",partial:"Partly simulated",vanilla:"Ability not simulated"};
let pool=null,byId=new Map(),source="snapshot",root,S={screen:"menu",sel:"s0",opp:"random",build:null,st:null,busy:false,mullSel:new Set()};

function ensureRoot(){if(root)return;root=document.createElement("div");root.id="play";root.hidden=true;document.body.appendChild(root);
  root.addEventListener("click",onClick);root.addEventListener("input",onInput);
  let lpT=null;root.addEventListener("pointerdown",e=>{const t=e.target.closest("[data-a=tile]");if(!t)return;lpT=setTimeout(()=>{S.lp=true;zoom(+t.dataset.uid)},480)});
  ["pointerup","pointercancel","pointerleave","pointermove"].forEach(n=>root.addEventListener(n,e=>{if(n==="pointermove"&&e.movementX*e.movementX+e.movementY*e.movementY<16)return;clearTimeout(lpT)}));
  root.addEventListener("contextmenu",e=>{if(e.target.closest("[data-a=tile]"))e.preventDefault()})}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function loadPool(){
  if(pool)return;if(!window.LORCANA_GAME_CARDS)await loadScript("./data/game-cards.js?v="+V);
  setPool(window.LORCANA_GAME_CARDS.cards);refreshLive();
}
function setPool(raw){pool=raw.filter(c=>/^\d+$/.test(String(c.set))).map(E.normCard); // main numbered sets only
  byId=new Map(pool.map(c=>[c.id,c]))}
async function refreshLive(){ // try to replace the snapshot with live Lorcast data (used for the next game)
  try{const sig=()=>AbortSignal.timeout(10000);const sets=(await (await fetch("https://api.lorcast.com/v0/sets",{signal:sig()})).json()).results;
    const today=new Date().toISOString().slice(0,10),out=[];
    await Promise.all(sets.filter(s=>(s.released_at||"9")<=today).map(async s=>{const cs=await (await fetch(`https://api.lorcast.com/v0/sets/${s.id}/cards`,{signal:sig()})).json();
      for(const c of cs)out.push({id:c.id,name:c.name,version:c.version,cost:c.cost,inkwell:c.inkwell,ink:c.ink,inks:c.inks,type:c.type,classifications:c.classifications,text:c.text,move_cost:c.move_cost,strength:c.strength,willpower:c.willpower,lore:c.lore,rarity:c.rarity,collector_number:c.collector_number,set:s.code,img:c.image_uris?.digital?.small})}));
    if(out.length>=pool.length*0.9){setPool(out);source="live"}}catch(e){}
}
const mainPool=()=>pool;
const decks=()=>JSON.parse(localStorage.getItem(DKEY)||"[]");
const saveDecks=d=>localStorage.setItem(DKEY,JSON.stringify(d));
function ownedMap(){const col=JSON.parse(localStorage.getItem("lorcanaCollection.v1")||"{}"),m={};for(const[id,v]of Object.entries(col))m[id]=(v.n||0)+(v.f||0);return m}
function deckFromSel(sel){
  if(sel[0]==="s"){const p=STARTERS[+sel.slice(1)];return{name:p.join(" / "),cards:E.buildDeck(mainPool(),p)}}
  if(sel==="own"){const o=ownedMap(),b=E.bestOwnedPair(pool,o);const d=b&&b.n>=60?E.buildDeck(pool,b.inks,o):null;return{name:"My collection"+(b?" ("+b.inks.join(" / ")+")":""),cards:d,need:b?b.n:0}}
  if(sel[0]==="c"){const d=decks()[+sel.slice(1)];if(!d)return{cards:null};const cards=[];for(const[id,n]of Object.entries(d.cards)){const c=byId.get(id);if(c)for(let i=0;i<n;i++)cards.push(c)}return{name:d.name,cards:cards.length>=60&&!E.validateDeck(cards)?cards:null}}
}
/* ---------- rendering ---------- */
function bar(title,right=""){return`<div class="pbar"><button class="pbtn ghost" data-a="quit">${S.screen==="menu"?"Close":"Back"}</button><div class="ptitle">${esc(title)}</div>${right}</div>`}
function render(){
  if(!pool){root.innerHTML=bar("Play")+`<p class="empty">Loading all cards...</p>`;return}
  ({menu:renderMenu,builder:renderBuilder,mull:renderMull,board:renderBoard,coin:renderCoin}[S.screen])();
}
function renderMenu(){
  const own=deckFromSel("own"),cus=decks();
  const opt=(id,name,sub,dis)=>`<button class="dopt ${S.sel===id?"on":""}" data-a="sel" data-v="${id}" ${dis?"disabled":""}><b>${esc(name)}</b><span>${esc(sub)}</span></button>`;
  root.innerHTML=bar("Play vs AI")+`<div class="pbody">
  <h4>Your deck</h4>${STARTERS.map((p,i)=>opt("s"+i,p.join(" / "),"Starter deck · 60 cards")).join("")}
  ${opt("own","Build from my collection",own.cards?own.name+" · 60 cards":`Need 60 owned cards in two inks (best: ${own.need})`,!own.cards)}
  ${cus.map((d,i)=>opt("c"+i,d.name,Object.values(d.cards).reduce((a,b)=>a+b,0)+" cards · custom")).join("")}
  <button class="wide" data-a="builder">Deck builder</button>
  <h4>Opponent</h4><div class="opts"><button class="opt ${S.opp==="random"?"on":""}" data-a="opp" data-v="random">Random starter</button>${STARTERS.map((p,i)=>`<button class="opt ${S.opp==="s"+i?"on":""}" data-a="opp" data-v="s${i}">${p.join("/")}</button>`).join("")}</div>
  <h4>AI difficulty</h4><div class="opts">${["easy","normal","hard"].map(l=>`<button class="opt ${SET.level===l?"on":""}" data-a="lvl" data-v="${l}">${LEVELS[l]}</button>`).join("")}</div>
  <button class="wide primary" data-a="start">Start game</button><button class="wide" data-a="settings">Settings</button>
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
function closeSheet(){if(S.paused&&S.screen==="board"){S.paused=false;if(S.st&&S.st.active===1)setTimeout(aiLoop,50)}$("#sheet").classList.remove("open");$("#scrim").hidden=true;$("#sheet").setAttribute("aria-hidden","true")}
function builderSheet(id){const c=byId.get(id),k=S.build.cards[id]||0,max=/up to 99 copies/.test(c.text)?99:4,f=fullCount(c);
  sheet(cardSheet(c,`<div class="stepper big2"><button class="big" data-a="badd" data-id="${id}" data-d="-1">&minus;</button><b>${k}</b><button class="big plus" data-a="badd" data-id="${id}" data-d="1" ${f>=max?"disabled":""}>+</button></div><div class="meta small">Max ${max} copies of ${esc(c.full)} (you have ${f}).</div><button class="wide" data-a="close">Done</button>`))}
/* game */
const SKEY2="lorcanaPlaySettings.v1";
const SET=Object.assign({level:"normal",speed:"normal",sound:false,tips:true},JSON.parse(localStorage.getItem(SKEY2)||"{}"));
const saveSet=()=>localStorage.setItem(SKEY2,JSON.stringify(SET));
const SPEED={slow:1500,normal:950,fast:450};
const LEVELS={easy:"Easy",normal:"Normal",hard:"Hard"};
function startGame(rematch){
  let me,op;
  if(rematch&&S.last){me=S.last.me;op=S.last.op}else{me=deckFromSel(S.sel);if(!me||!me.cards){alert("That deck isn't ready (needs 60 legal cards).");return}
    const os=S.opp==="random"?"s"+Math.floor(Math.random()*STARTERS.length):S.opp;op=deckFromSel(os)}
  S.last={me,op};S.oppName=op.name;S.meName=me.name;
  S.st=E.newGame({decks:[me.cards,op.cards],names:["You","AI"],seed:Date.now()%1e9,first:Math.random()<.5?0:1,human:[true,false]});
  E.mulligan(S.st,1,E.aiMulligan(S.st,1));S.mullSel=new Set();S.sel=null;S.tm=null;S.screen="coin";render();
}
function renderCoin(){const f=S.st.first===0;
  root.innerHTML=`<div class="coinwrap"><div class="coin spin"><div class="cface">${f?"YOU":"AI"}</div></div><h2 class="cres hidden">${f?"You go first":"AI goes first"}</h2>
  <p class="meta cres hidden">${f?"The first player skips their draw on turn 1.":"You will draw a card on your first turn."}</p><button class="wide primary cres hidden" data-a="tomull">Continue</button></div>`;
  setTimeout(()=>root.querySelectorAll(".cres").forEach(x=>x.classList.remove("hidden")),1300);sfx("flip")}
function renderMull(){const p=S.st.players[0],n=S.mullSel.size;
  root.innerHTML=bar("Opening hand")+`<div class="pbody"><p class="meta">Tap any cards you want to put back. They go to the bottom of your deck, you draw the same number, then your deck is shuffled.</p>
  <div class="bgrid">${p.hand.map(h=>`<button class="bcard ${S.mullSel.has(h.uid)?"out":""}" data-a="mtog" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}"><span class="mcost">${h.card.cost}</span>${S.mullSel.has(h.uid)?`<span class="sb van">PUT BACK</span>`:""}</button>`).join("")}</div>
  <button class="wide primary" data-a="mdone">${n?"Put back "+n+" and draw "+n:"Keep this hand"}</button></div>`}

/* ---- board ---- */
const myTurn=()=>S.st&&S.st.active===0&&S.st.winner==null&&!S.st.pending;
function legalFor(uid){return myTurn()?E.legalActions(S.st).filter(a=>a.uid===uid):[]}
function canAct(x){return legalFor(x.uid).some(a=>a.t!=="ink")}
function cardTile(x,pi,size){const c=x.card,st=S.st,tm=S.tm;
  const isT=tm&&tm.targets.has(x.uid),sel=S.sel===x.uid,glow=pi===0&&!tm&&myTurn()&&canAct(x);
  const drying=c.type==="character"&&!E.dry(st,x)&&!K0(x,"rush");
  return`<button class="ct ${size} ${x.exerted?"ex":""} ${sel?"sel":""} ${isT?"tgt":""} ${glow?"glow":""} ${tm&&!isT?"dim":""}" data-a="tile" data-uid="${x.uid}">
   <span class="art"><img src="${esc(c.img)}" alt="${esc(c.full)}" loading="lazy"></span>
   ${x.damage?`<span class="dtok">${x.damage}</span>`:""}${drying&&pi===st.active?`<span class="dry">DRYING</span>`:""}
   ${c.type==="character"?`<span class="stats"><b>${E.strOf(x)}</b><i>${c.wil-x.damage}</i></span>`:c.type==="location"?`<span class="stats"><i>${c.wil-x.damage}</i></span>`:""}
   ${x.at?`<span class="atl">AT ${esc((E.find(st,x.at)?.inst.card.name||"").slice(0,10).toUpperCase())}</span>`:""}${x.under&&x.under.length?`<span class="und">+${x.under.length}</span>`:""}</button>`}
const K0=(x,k)=>E.K?E.K(x,k):x.card.kw[k];
function lorePips(n){let h="";for(let i=1;i<=20;i++)h+=`<i class="${i<=n?"on":""}"></i>`;return h}
function hud(pi){const p=S.st.players[pi],ink=E.inkAvail(p),top=p.discard[p.discard.length-1];
  return`<div class="hud h${pi}">${pi===1?`<button class="mbtn" data-a="pause">Menu</button>`:""}
   <div class="loretrk" id="lore-${pi}"><b>${p.lore}</b><span>${pi===1?"AI · "+LEVELS[SET.level].toUpperCase():"YOUR LORE"}</span><div class="pips">${lorePips(p.lore)}</div></div>
   <div class="pile ink" id="ink-${pi}" title="Inkwell"><span class="stack s${Math.min(3,p.ink.length)}"></span><b>${ink}<small>/${p.ink.length}</small></b><span class="pl">INK</span></div>
   <div class="pile deck" id="deck-${pi}"><span class="back"></span><b>${p.deck.length}</b><span class="pl">DECK</span></div>
   <button class="pile disc" data-a="disc" data-pi="${pi}" id="disc-${pi}">${top?`<img src="${esc(top.card.img)}" alt="">`:`<span class="empty"></span>`}<b>${p.discard.length}</b><span class="pl">DISCARD</span></button>
   ${pi===1?`<div class="pile hand1"><span class="fan">${"<i></i>".repeat(Math.min(7,p.hand.length))}</span><b>${p.hand.length}</b><span class="pl">HAND</span></div>`:""}
  </div>`}
function row(pi,kind){const p=S.st.players[pi];const xs=p.play.filter(x=>kind==="chars"?x.card.type==="character":x.card.type!=="character");
  const size=kind==="chars"?(pi===0?"lg":"md"):"sm";
  return`<div class="row ${kind} r${pi}">${xs.map(x=>cardTile(x,pi,size)).join("")||`<span class="rowlbl">${kind==="chars"?(pi===0?"Your characters":"Opponent characters"):"Items and locations"}</span>`}</div>`}
function banner(){const st=S.st;if(st.winner!=null)return`<div class="banner over2">GAME OVER</div>`;
  if(S.tm)return`<div class="banner tm"><span>${esc(S.tm.label)}</span><button class="bbtn" data-a="cancel">Cancel</button></div>`;
  const my=st.active===0;const canEnd=my&&!st.pending&&E.legalActions(st).some(a=>a.t==="end");
  return`<div class="banner ${my?"mine":"theirs"}"><div><b>${my?"YOUR TURN":"AI TURN"}</b><small>Turn ${st.turnNo} · ${my?(st.players[0].inked?"Ink used":"Ink available")+" · Main phase":"AI is playing"}</small></div>
   ${my?`<button class="endbtn" data-a="end" ${canEnd?"":"disabled"}>${canEnd?"End turn":"Must challenge"}</button>`:`<span class="thinking"><i></i><i></i><i></i></span>`}</div>`}
function actionBar(){
  if(!S.sel||S.tm)return"";const f=E.find(S.st,S.sel);if(!f)return"";const acts=legalFor(S.sel);
  const g=groupActs(acts);const btn=(k,l,cls="")=>`<button class="ab ${cls}" data-a="grp" data-k="${k}">${l}</button>`;
  let h="";
  if(g.play)h+=btn("play",`Play <small>${E.costOf(S.st,0,f.inst.card)} ink</small>`,"pri");
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
  const st=S.st,me=st.players[0];
  const rects=snapRects();
  root.innerHTML=`<div class="gb">
   ${hud(1)}${row(1,"items")}${row(1,"chars")}
   ${banner()}
   ${row(0,"chars")}${row(0,"items")}${hud(0)}
   <div class="handwrap">${actionBar()}<div class="hand2">${me.hand.map(h=>{const pl=myTurn()&&!S.tm&&legalFor(h.uid).some(a=>a.t==="play");const ik=myTurn()&&!S.tm&&!me.inked&&h.card.inkable;
     return`<button class="hc ${pl?"play":""} ${S.sel===h.uid?"sel":""} ${S.tm?"dim":""}" data-a="tile" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}"><span class="mcost">${E.costOf(st,0,h.card)}</span>${h.card.inkable?`<span class="inkable" title="Inkable"></span>`:""}${badge(h.card)}${ik&&!pl?"":""}</button>`}).join("")}</div></div>
   <div id="toast" class="toast"></div></div>
   ${st.pending&&st.pending.pi===0?discardPrompt():""}${st.winner!=null?endScreen():""}`;
  animate(rects);
  if(SET.tips&&!S.tipShown&&st.winner==null){S.tipShown=true;setTimeout(()=>tip(0),400)}
}
function discardPrompt(){const p=S.st.players[0];return`<div class="modal"><div class="mbox"><h3>${esc(S.st.pending.why)}</h3><p class="meta">Tap a card to discard it (${S.st.pending.n} left).</p>
  <div class="bgrid">${p.hand.map(h=>`<button class="bcard" data-a="pdisc" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}"></button>`).join("")}</div></div></div>`}
function endScreen(){const st=S.st,w=st.winner===0,s0=(st.stats||[{},{}])[0],s1=(st.stats||[{},{}])[1];
  const rowS=(l,a,b)=>`<tr><td>${l}</td><td>${a||0}</td><td>${b||0}</td></tr>`;
  return`<div class="modal end"><div class="mbox"><h2 class="${w?"win":"lose"}">${w?"Victory":"Defeat"}</h2><p class="meta">${esc(st.log[st.log.length-1]||"")}</p>
  <table class="stt"><tr><th></th><th>You</th><th>AI</th></tr>${rowS("Lore",st.players[0].lore,st.players[1].lore)}${rowS("Cards played",s0.play,s1.play)}${rowS("Quests",s0.quest,s1.quest)}${rowS("Challenges",s0.challenge,s1.challenge)}${rowS("Characters banished",s0.banished,s1.banished)}<tr><td>Turns</td><td colspan="2">${st.turnNo}</td></tr></table>
  <button class="wide primary" data-a="again">Rematch</button><button class="wide" data-a="tomenu">Change decks</button></div></div>`}
/* ---- animation & feedback ---- */
function snapRects(){const m=new Map();root.querySelectorAll("[data-uid]").forEach(e=>{m.set(+e.dataset.uid,{r:e.getBoundingClientRect(),html:e.querySelector("img")?.outerHTML||""})});
  for(const id of["lore-0","lore-1","ink-0","ink-1","deck-0","deck-1","disc-0","disc-1"]){const e=document.getElementById(id);if(e)m.set(id,{r:e.getBoundingClientRect()})}return m}
function ghost(r,html,cls){const g=document.createElement("div");g.className="ghost "+(cls||"");g.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;g.innerHTML=html;document.body.appendChild(g);return g}
function floatText(r,text,cls){const g=document.createElement("div");g.className="ftext "+cls;g.textContent=text;g.style.left=(r.left+r.width/2)+"px";g.style.top=(r.top+r.height/3)+"px";document.body.appendChild(g);setTimeout(()=>g.remove(),1300);return g}
const elOf=u=>root.querySelector(`[data-uid="${u}"]`),rectOf=(m,u)=>m.get(u)?.r||elOf(u)?.getBoundingClientRect();
function animate(old){const evs=(S.st.events||[]).splice(0);if(!evs.length)return;const slow=SET.speed==="slow"?1.4:SET.speed==="fast"?.7:1;
  for(const e of evs){
    if(e.t==="play"){const el=elOf(e.uid);if(el){el.classList.add("enter")}sfx("play")}
    if(e.t==="ink"){const o=old.get(e.uid),to=document.getElementById("ink-"+e.pi)?.getBoundingClientRect();if(o&&to){const g=ghost(o.r,o.html,"");g.animate([{transform:"none",opacity:1},{transform:`translate(${to.left-o.r.left}px,${to.top-o.r.top}px) scale(.3)`,opacity:.2}],{duration:600*slow,easing:"ease-in"}).onfinish=()=>g.remove()}sfx("ink")}
    if(e.t==="quest"){const r=rectOf(old,e.uid),to=document.getElementById("lore-"+e.pi)?.getBoundingClientRect();if(r&&to){const g=floatText(r,"+"+e.n,"lore");g.animate([{transform:"translate(-50%,0) scale(1)"},{transform:`translate(calc(-50% + ${to.left+to.width/2-r.left-r.width/2}px),${to.top-r.top-r.height/3}px) scale(.6)`,opacity:.3}],{duration:900*slow,easing:"cubic-bezier(.5,0,.6,1)",fill:"forwards"})}sfx("quest")}
    if(e.t==="lore"){const l=document.getElementById("lore-"+e.pi);l&&l.animate([{transform:"scale(1)"},{transform:"scale(1.25)"},{transform:"scale(1)"}],{duration:500,delay:500*slow})}
    if(e.t==="challenge"){const a=rectOf(old,e.a),d=rectOf(old,e.d),el=elOf(e.a);if(a&&d){const dx=(d.left-a.left)*.7,dy=(d.top-a.top)*.7;
      (el||ghost(a,old.get(e.a)?.html||"","")).animate([{transform:"none"},{transform:`translate(${dx}px,${dy}px) scale(1.08)`,offset:.45},{transform:"none"}],{duration:650*slow,easing:"ease-in-out"})}sfx("hit")}
    if(e.t==="damage"){const r=rectOf(old,e.uid);if(r)setTimeout(()=>floatText(r,"-"+e.n,"dmg"),300*slow)}
    if(e.t==="banish"){const o=old.get(e.uid);if(o&&!elOf(e.uid)){const g=ghost(o.r,o.html,"ban");setTimeout(()=>g.animate([{opacity:1,transform:"none",filter:"none"},{opacity:0,transform:"scale(.6) rotate(-12deg)",filter:"grayscale(1) brightness(2)"}],{duration:700*slow,fill:"forwards"}).onfinish=()=>g.remove(),350*slow)}sfx("ban")}
    if(e.t==="draw"&&e.pi===0){const el=elOf(e.uid);if(el)el.classList.add("drawn")}
    if(e.t==="turn"){const b=root.querySelector(".banner");b&&b.animate([{transform:"scaleX(.6)",opacity:.2},{transform:"none",opacity:1}],{duration:400});sfx("turn")}
  }}
let AC=null;function sfx(k){if(!SET.sound)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();
  const f={play:440,ink:330,quest:660,hit:160,ban:110,turn:520,flip:600}[k]||400;o.frequency.value=f;o.type=k==="hit"||k==="ban"?"square":"sine";g.gain.value=.06;g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+.25);o.connect(g).connect(AC.destination);o.start();o.stop(AC.currentTime+.26)}catch(e){}}
function toast(msg){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.classList.remove("show");void t.offsetWidth;t.classList.add("show")}
function describe(a,st){const n=u=>E.find(st,u)?.inst.card.full||"";switch(a.t){case"ink":return"AI puts a card into its inkwell";case"play":return a.singer!=null?`AI sings ${n(a.uid)}`:a.shift!=null?`AI shifts ${n(a.uid)}`:`AI plays ${n(a.uid)}`;
  case"quest":return`AI quests with ${n(a.uid)}`;case"challenge":return`AI challenges ${n(a.target)} with ${n(a.uid)}`;case"move":return`AI moves ${n(a.uid)} to ${n(a.loc)}`;case"act":return`AI uses ${n(a.uid)}'s ability`;case"boost":return`AI boosts ${n(a.uid)}`;case"end":return"AI ends its turn";case"discard":return"AI discards a card"}return""}
/* ---- player interaction ---- */
function doAct(a){S.sel=null;S.tm=null;closeSheet();try{E.act(S.st,a)}catch(e){console.error(e);toast("That move is not allowed")}renderBoard();if(S.st.active===1&&S.st.winner==null)aiLoop()}
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
  if(k==="act"){const idx=[...new Set(acts.map(a=>a.i))];if(idx.length>1)return choose("Which ability?",idx.map(i=>({label:(c.acts[i].ink?c.acts[i].ink+" ink: ":"")+"Ability "+(i+1),fn:()=>effectFlow(acts.filter(a=>a.i===i),c)})));return effectFlow(acts,c)}
  if(k==="quest"){if(c.kw.support&&S.st.players[0].play.filter(x=>x.card.type==="character"&&x.uid!==S.sel).length){const base=acts[0];
      return startTargeting(S.st.players[0].play.filter(x=>x.card.type==="character"&&x.uid!==S.sel).map(x=>({...base,support:x.uid})),"support",`Support: choose a character to get +${E.strOf(f.inst)} strength`)}
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
function zoom(uid){const f=E.find(S.st,uid);if(!f)return;const x=f.inst;
  sheet(cardSheet(x.card,f.zone==="play"?`<div class="meta">${x.damage?x.damage+" damage · ":""}${x.exerted?"Exerted":"Ready"}${f.zone==="play"&&x.card.type==="character"?` · ${E.strOf(x)} STR now`:""}</div>`:"")+`<button class="wide" data-a="close">Close</button>`)}
function tapTile(uid){
  const st=S.st;
  if(S.tm){if(S.tm.targets.has(uid)){const a=S.tm.list.find(x=>x[S.tm.key]===uid);doAct(a)}else toast("Tap a glowing card, or Cancel");return}
  const f=E.find(st,uid);if(!f)return;
  if(f.pi!==0||!myTurn()){zoom(uid);return}
  if(S.sel===uid){S.sel=null;renderBoard();return}
  S.sel=uid;renderBoard();if(!legalFor(uid).length)toast(f.zone==="hand"?"You can't play this card right now":"This card can't act right now");
}
function aiLoop(){if(S.busy)return;S.busy=true;
  const step=()=>{const st=S.st;if(!st||S.screen!=="board"||st.winner!=null||S.paused){S.busy=false;if(st)renderBoard();return}
    if(st.pending&&st.pending.pi===0){S.busy=false;renderBoard();return} // wait for the player's discard
    if(st.active!==1){S.busy=false;renderBoard();return}
    const a=E.aiChoose(st,SET.level);if(!a){S.busy=false;return}
    if(a.uid!=null){const el=elOf(a.uid);if(el)el.classList.add("aifocus")}
    toast(describe(a,st));
    setTimeout(()=>{try{E.act(st,a)}catch(e){console.error(e);try{E.act(st,{t:"end"})}catch(_){}}renderBoard();setTimeout(step,a.t==="end"?SPEED[SET.speed]*.6:SPEED[SET.speed])},SPEED[SET.speed]*.45)};
  setTimeout(step,SPEED[SET.speed]*.6)}
const TIPS=["Your side is at the bottom: characters, then items and locations, then your lore, inkwell, deck and discard.","Cards in your hand that glow gold can be played now. The small drop icon means a card is inkable: select it and tap Ink it (once per turn).","Tap one of your characters to select it, then choose Quest or Challenge. Legal targets glow red; tap one to confirm.","Characters that are drying (just played) can't quest or challenge until your next turn. First to 20 lore wins. Hold a card or tap Details to read it."];
function tip(i){if(i>=TIPS.length){SET.tips=false;saveSet();closeSheet();return}sheet(`<h4>Tip ${i+1} of ${TIPS.length}</h4><p class="tiptext">${TIPS[i]}</p><button class="wide primary" data-a="tip" data-i="${i+1}">${i+1<TIPS.length?"Next":"Got it"}</button><button class="wide ghostw" data-a="tip" data-i="99">Skip tips</button>`)}
function settingsHtml(){const pill=(k,v,l)=>`<button class="opt ${SET[k]===v?"on":""}" data-a="set" data-k="${k}" data-v="${v}">${l}</button>`;
  return`<h4>AI difficulty</h4><div class="opts">${pill("level","easy","Easy")}${pill("level","normal","Normal")}${pill("level","hard","Hard")}</div>
  <h4>AI speed</h4><div class="opts">${pill("speed","slow","Slow")}${pill("speed","normal","Normal")}${pill("speed","fast","Fast")}</div>
  <h4>Sound</h4><div class="opts">${pill("sound",false,"Off")}${pill("sound",true,"On")}</div>
  <h4>Tips</h4><div class="opts"><button class="opt" data-a="tipsagain">Show tips again</button></div>`}
function pauseMenu(){S.paused=true;sheet(`<h4>Game paused</h4><button class="wide primary" data-a="resume">Resume</button>${settingsHtml()}<button class="wide" data-a="concede">Concede</button><button class="wide ghostw" data-a="quitgame">Quit to menu</button>`)}
/* events */
function onInput(e){if(e.target.id==="bq"){S.build.q=e.target.value;S.build.limit=60;const pos=e.target.selectionStart;renderBuilder();const q=$("#bq");q.focus();q.setSelectionRange(pos,pos)}if(e.target.id==="bname")S.build.name=e.target.value}
function onClick(e){const b=e.target.closest("[data-a]");if(!b)return;const a=b.dataset.a,v=b.dataset.v;
  switch(a){
    case"quit":if(S.screen==="builder"||S.screen==="mull"){S.screen="menu";render()}else if(S.screen==="board"&&S.st.winner==null&&!confirm("Quit this game?"))return;else if(S.screen==="board"){S.screen="menu";S.st=null;render()}else location.hash="";break;
    case"sel":S.sel=v;renderMenu();break;case"opp":S.opp=v;renderMenu();break;case"start":startGame();break;
    case"builder":{const sel=S.sel;if(sel[0]==="c"){const d=decks()[+sel.slice(1)];bInit({...d,idx:+sel.slice(1)})}else bInit();S.screen="builder";render();break}
    case"bview":S.build.view=v;renderBuilder();break;case"bink":S.build.ink=v;S.build.limit=60;renderBuilder();break;case"btype":S.build.type=v;S.build.limit=60;renderBuilder();break;
    case"bmore":S.build.limit+=60;renderBuilder();break;case"bclear":if(confirm("Remove all cards from this deck?")){S.build.cards={};renderBuilder()}break;
    case"bview1":builderSheet(b.dataset.id);break;
    case"badd":{const id=b.dataset.id,c=byId.get(id),d=+b.dataset.d,max=/up to 99 copies/.test(c.text)?99:4;
      if(d>0){if(fullCount(c)>=max)return;const inks=new Set(bInks());c.inks.forEach(i=>inks.add(i));if(inks.size>2){alert("A deck can use at most 2 inks.");return}}
      const k=Math.max(0,(S.build.cards[id]||0)+d);if(k)S.build.cards[id]=k;else delete S.build.cards[id];builderSheet(id);renderBuilder();break}
    case"bsave":{const b2=S.build,n=bCount(),inks=bInks();if(n<60||inks.length>2){if(!confirm(`This deck has ${n} cards${inks.length>2?" and too many inks":""}. Save it anyway as a draft?`))return}
      const all=decks(),d={name:b2.name||"My deck",cards:b2.cards};if(b2.idx!=null)all[b2.idx]=d;else{all.push(d);b2.idx=all.length-1}saveDecks(all);S.sel="c"+b2.idx;S.screen="menu";render();break}
    case"mtog":{const u=+b.dataset.uid;S.mullSel.has(u)?S.mullSel.delete(u):S.mullSel.add(u);renderMull();break}
    case"mdone":E.mulligan(S.st,0,[...S.mullSel]);S.st.events=[];S.screen="board";S.tipShown=false;renderBoard();if(S.st.active===1)aiLoop();break;
    case"tomull":S.screen="mull";render();break;
    case"tile":if(S.lp){S.lp=false;return}tapTile(+b.dataset.uid);break;
    case"grp":runGroup(b.dataset.k);break;case"cancel":S.tm=null;renderBoard();break;
    case"zoom":zoom(+b.dataset.uid);break;
    case"chs":{const o=S.chs[+b.dataset.i];closeSheet();o.fn();break}
    case"pdisc":E.act(S.st,{t:"discard",uid:+b.dataset.uid});renderBoard();if(S.st.active===1&&!S.st.pending)aiLoop();break;
    case"disc":{const p=S.st.players[+b.dataset.pi];sheet(`<h4>${p.name==="You"?"Your":"AI"} discard (${p.discard.length})</h4><div class="bgrid">${p.discard.slice().reverse().map(x=>`<div class="bcard"><img src="${esc(x.card.img)}" alt="${esc(x.card.full)}"></div>`).join("")||`<p class="meta">Empty</p>`}</div><button class="wide" data-a="close">Close</button>`);break}
    case"pause":pauseMenu();break;case"resume":S.paused=false;closeSheet();if(S.st.active===1)aiLoop();break;
    case"set":{const k=b.dataset.k;SET[k]=k==="sound"?v==="true":v;saveSet();if(S.paused)pauseMenu();else renderMenu();break}
    case"tipsagain":SET.tips=true;saveSet();S.tipShown=false;closeSheet();S.paused=false;if(S.screen==="board")renderBoard();break;
    case"tip":tip(+b.dataset.i);break;
    case"concede":if(confirm("Concede this game?")){S.paused=false;closeSheet();S.st.winner=1;S.st.phase="over";S.st.log.push("You conceded.");renderBoard()}break;
    case"quitgame":S.paused=false;closeSheet();S.screen="menu";S.st=null;render();break;
    case"end":doAct({t:"end"});break;
    case"log":sheet(`<h4>Game log</h4><div class="logfull">${S.st.log.slice().reverse().map(l=>`<div>${esc(l)}</div>`).join("")}</div><button class="wide" data-a="close">Close</button>`);break;
    case"close":closeSheet();break;case"settings":sheet(settingsHtml()+`<button class="wide" data-a="close">Done</button>`);break;
    case"again":startGame(true);break;case"tomenu":S.screen="menu";S.st=null;render();break;
  }
}
window.LorcanaPlay={async open(){ensureRoot();root.hidden=false;document.body.classList.add("playing");render();await loadPool();if(S.screen==="menu"||!S.st&&S.screen!=="builder")S.screen=S.screen==="builder"?"builder":"menu";render()},
  close(){if(root){root.hidden=true;document.body.classList.remove("playing");closeSheet()}},state:()=>S};
})();
