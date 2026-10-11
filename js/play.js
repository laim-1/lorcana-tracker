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
  root.addEventListener("click",onClick);root.addEventListener("input",onInput)}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function loadPool(){
  if(pool)return;if(!window.LORCANA_GAME_CARDS)await loadScript("./data/game-cards.js?v="+V);
  setPool(window.LORCANA_GAME_CARDS.cards);refreshLive();
}
function setPool(raw){pool=raw.map(E.normCard);byId=new Map(pool.map(c=>[c.id,c]))}
async function refreshLive(){ // try to replace the snapshot with live Lorcast data (used for the next game)
  try{const sig=()=>AbortSignal.timeout(10000);const sets=(await (await fetch("https://api.lorcast.com/v0/sets",{signal:sig()})).json()).results;
    const today=new Date().toISOString().slice(0,10),out=[];
    await Promise.all(sets.filter(s=>(s.released_at||"9")<=today).map(async s=>{const cs=await (await fetch(`https://api.lorcast.com/v0/sets/${s.id}/cards`,{signal:sig()})).json();
      for(const c of cs)out.push({id:c.id,name:c.name,version:c.version,cost:c.cost,inkwell:c.inkwell,ink:c.ink,inks:c.inks,type:c.type,classifications:c.classifications,text:c.text,move_cost:c.move_cost,strength:c.strength,willpower:c.willpower,lore:c.lore,rarity:c.rarity,collector_number:c.collector_number,set:s.code,img:c.image_uris?.digital?.small})}));
    if(out.length>=pool.length*0.9){setPool(out);source="live"}}catch(e){}
}
const mainPool=()=>pool.filter(c=>/^\d+$/.test(c.set));
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
  ({menu:renderMenu,builder:renderBuilder,mull:renderMull,board:renderBoard}[S.screen])();
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
  <button class="wide primary" data-a="start">Start game</button>
  <p class="meta small">${pool.length} cards loaded (${source=="live"?"live from Lorcast":"snapshot"}). ${coverageLine()}</p></div>`;
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
  ${b.view==="all"?`<input class="pin" id="bq" type="search" value="${esc(b.q)}" placeholder="Search all ${pool.length} cards">
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
function closeSheet(){$("#sheet").classList.remove("open");$("#scrim").hidden=true;$("#sheet").setAttribute("aria-hidden","true")}
function builderSheet(id){const c=byId.get(id),k=S.build.cards[id]||0,max=/up to 99 copies/.test(c.text)?99:4,f=fullCount(c);
  sheet(cardSheet(c,`<div class="stepper big2"><button class="big" data-a="badd" data-id="${id}" data-d="-1">&minus;</button><b>${k}</b><button class="big plus" data-a="badd" data-id="${id}" data-d="1" ${f>=max?"disabled":""}>+</button></div><div class="meta small">Max ${max} copies of ${esc(c.full)} (you have ${f}).</div><button class="wide" data-a="close">Done</button>`))}
/* game */
function startGame(){
  const me=deckFromSel(S.sel);if(!me||!me.cards){alert("That deck isn't ready (needs 60 legal cards).");return}
  const os=S.opp==="random"?"s"+Math.floor(Math.random()*STARTERS.length):S.opp,op=deckFromSel(os);
  S.st=E.newGame({decks:[me.cards,op.cards],names:["You","AI"],seed:Date.now()%1e9,first:Math.random()<.5?0:1});S.oppName=op.name;S.meName=me.name;
  E.mulligan(S.st,1,E.aiMulligan(S.st,1));S.mullSel=new Set();S.screen="mull";render();
}
function renderMull(){const p=S.st.players[0];
  root.innerHTML=bar("Opening hand")+`<div class="pbody"><p class="meta">${S.st.first===0?"You go first (no draw on turn 1).":"AI goes first. You draw on your first turn."} Tap cards to put back, then confirm.</p>
  <div class="bgrid">${p.hand.map(h=>`<button class="bcard ${S.mullSel.has(h.uid)?"out":""}" data-a="mtog" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}">${S.mullSel.has(h.uid)?`<span class="sb van">PUT BACK</span>`:""}</button>`).join("")}</div>
  <button class="wide primary" data-a="mdone">${S.mullSel.size?"Mulligan "+S.mullSel.size+" card"+(S.mullSel.size>1?"s":""):"Keep hand"}</button></div>`}
function tile(x,pi){const c=x.card,st=S.st,dry=E.dry(st,x);
  return`<button class="tile ${x.exerted?"ex":""}" data-a="card" data-uid="${x.uid}"><img src="${esc(c.img)}" alt="${esc(c.full)}" loading="lazy">
  ${x.damage?`<span class="dmg">${x.damage}</span>`:""}${x.exerted?`<span class="lbl">EXERTED</span>`:(!dry&&c.type==="character"&&pi===st.active?`<span class="lbl dry">DRYING</span>`:"")}${badge(c)}
  ${c.type==="character"?`<span class="sw">${E.strOf(x)}/${c.wil}</span>`:""}${x.at?`<span class="atl">AT LOC</span>`:""}</button>`}
function pstats(p,i){const ink=E.inkAvail(p);return`<div class="pst"><span class="lore">${p.lore}<small>/20</small></span><span>Ink <b>${ink}/${p.ink.length}</b></span><span>Hand <b>${p.hand.length}</b></span><span>Deck <b>${p.deck.length}</b></span><span>Disc <b>${p.discard.length}</b></span></div>`}
function renderBoard(){
  const st=S.st,me=st.players[0],ai=st.players[1],my=st.active===0&&st.winner==null;
  const canEnd=my&&E.legalActions(st).some(a=>a.t==="end");
  root.innerHTML=`<div class="board">
   <div class="pbar slim"><button class="pbtn ghost" data-a="quit">Quit</button><div class="ptitle sm">AI · ${esc(S.oppName)}</div><button class="pbtn ghost" data-a="log">Log</button></div>
   ${pstats(ai,1)}<div class="zone opp">${ai.play.map(x=>tile(x,1)).join("")||`<span class="zempty">No cards in play</span>`}</div>
   <button class="logline" data-a="log">${esc(st.log.slice(-2).join("  ·  "))}</button>
   <div class="zone me">${me.play.map(x=>tile(x,0)).join("")||`<span class="zempty">Your characters appear here</span>`}</div>
   <div class="mebar">${pstats(me,0)}<button class="endbtn" data-a="end" ${canEnd?"":"disabled"}>${st.winner!=null?"Game over":my?(canEnd?"End turn":"Must challenge"):"AI turn..."}</button></div>
   <div class="hand">${me.hand.map(h=>`<button class="hcard ${E.costOf(st,0,h.card)<=E.inkAvail(me)&&my?"ok":""}" data-a="card" data-uid="${h.uid}"><img src="${esc(h.card.img)}" alt="${esc(h.card.full)}">${badge(h.card)}</button>`).join("")}</div>
  </div>${st.winner!=null?`<div class="over"><div><h2>${st.winner===0?"You win!":"AI wins"}</h2><p>${esc(st.log[st.log.length-1])}</p><button class="wide primary" data-a="again">Play again</button><button class="wide" data-a="tomenu">Change decks</button></div></div>`:""}`;
}
function actLabel(a){const st=S.st,n=u=>E.find(st,u)?.inst.card;
  switch(a.t){case"ink":return"Put into inkwell";case"quest":return`Quest (+${E.loreOf(E.find(st,a.uid).inst)} lore)`;
    case"play":{const c=n(a.uid);let s=a.shift!=null?`Shift onto ${n(a.shift).name} (${c.kw.shift} ink)`:a.singer!=null?`Sing with ${n(a.singer).name}`:a.singers?`Sing together (${a.singers.split(",").length} characters)`:`Play (${E.costOf(st,0,c)} ink)`;return s}
    case"challenge":return"Challenge";case"boost":return`Boost (${n(a.uid).kw.boost} ink)`;case"move":return`Move to ${n(a.loc).name}`;case"act":return"Use ability"+(n(a.uid).acts[a.i].ink?` (${n(a.uid).acts[a.i].ink} ink)`:"")}}
function cardActions(uid){
  const st=S.st,f=E.find(st,uid);const mine=st.active===0&&st.winner==null&&f.pi===0;
  const acts=mine?E.legalActions(st).filter(a=>a.uid===uid):[];
  const groups=new Map();for(const a of acts){const k=a.t+"|"+(a.shift??"")+"|"+(a.singer??"")+"|"+(a.singers??"")+"|"+(a.loc??"")+"|"+(a.i??"");if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a)}
  S.pending=[...groups.values()];
  const btns=S.pending.map((g,i)=>`<button class="wide ${g[0].t==="play"||g[0].t==="quest"?"primary":""}" data-a="do" data-i="${i}">${esc(actLabel(g[0]))}${g.length>1||g[0].target!=null?" ...":""}</button>`).join("");
  const info=f.zone==="play"?`<div class="meta">Damage ${f.inst.damage}${f.inst.exerted?" · exerted":""}${f.inst.at?" · at "+esc(E.find(st,f.inst.at)?.inst.card.name||""):""}</div>`:"";
  sheet(cardSheet(f.inst.card,info+(btns||(mine?`<p class="meta">No actions available for this card right now.</p>`:""))+`<button class="wide" data-a="close">Close</button>`));
}
function chooseTarget(g){
  const st=S.st;if(g.length===1&&(g[0].target==null)){doAct(g[0]);return}
  S.tgtGroup=g;sheet(`<h4>Choose a target</h4><div class="tgrid">${g.map((a,i)=>{const x=a.target!=null?E.find(st,a.target):null;
    return x?`<button class="tile tg" data-a="tgt" data-i="${i}"><img src="${esc(x.inst.card.img)}" alt=""><span class="lbl ${x.pi===0?"dry":""}">${x.pi===0?"YOURS":"OPPONENT"}</span>${x.inst.damage?`<span class="dmg">${x.inst.damage}</span>`:""}</button>`:`<button class="wide" data-a="tgt" data-i="${i}">No target (ability fizzles)</button>`}).join("")}</div><button class="wide" data-a="close">Cancel</button>`);
}
function doAct(a){closeSheet();try{E.act(S.st,a)}catch(e){console.error(e)}renderBoard();if(S.st.active===1)aiLoop()}
function aiLoop(){if(S.busy)return;S.busy=true;const step=()=>{const st=S.st;if(!st||S.screen!=="board"||st.winner!=null||st.active!==1){S.busy=false;renderBoard();return}
  const a=E.aiChoose(st);if(!a){S.busy=false;return}try{E.act(st,a)}catch(e){console.error(e);E.act(st,{t:"end"})}renderBoard();setTimeout(step,a.t==="end"?150:450)};setTimeout(step,450)}
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
    case"mdone":E.mulligan(S.st,0,[...S.mullSel]);S.screen="board";renderBoard();if(S.st.active===1)aiLoop();break;
    case"card":cardActions(+b.dataset.uid);break;
    case"do":{const g=S.pending[+b.dataset.i];chooseTarget(g);break}
    case"tgt":doAct(S.tgtGroup[+b.dataset.i]);break;
    case"end":doAct({t:"end"});break;
    case"log":sheet(`<h4>Game log</h4><div class="logfull">${S.st.log.slice().reverse().map(l=>`<div>${esc(l)}</div>`).join("")}</div><button class="wide" data-a="close">Close</button>`);break;
    case"close":closeSheet();break;
    case"again":startGame();break;case"tomenu":S.screen="menu";S.st=null;render();break;
  }
}
window.LorcanaPlay={async open(){ensureRoot();root.hidden=false;document.body.classList.add("playing");render();await loadPool();if(S.screen==="menu"||!S.st&&S.screen!=="builder")S.screen=S.screen==="builder"?"builder":"menu";render()},
  close(){if(root){root.hidden=true;document.body.classList.remove("playing");closeSheet()}},state:()=>S};
})();
