/* Learn: Duolingo-style winding path. Scripted tiny boards validated with LorcanaEngine (normCard/K/dry/legalActions/act). */
(function(){
"use strict";
const E=window.LorcanaEngine, D=window.LEARN_DATA, V=window.APP_VERSION||"dev";
const KEY="lorcanaLearn.v1";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let root=null, rawById=new Map(), pool=[], byId=new Map(), cur=null, steps=[], si=0, score=0, answered=false, practice=null;
function loadP(){try{const o=JSON.parse(localStorage.getItem(KEY)||"{}");return{done:o.done||{},xp:+o.xp||0,chests:o.chests||{},streak:+o.streak||0,lastDay:o.lastDay||"",sparkle:!!o.sparkle}}catch(e){return{done:{},xp:0,chests:{},streak:0,lastDay:"",sparkle:false}}}
let P=loadP();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){}};
const day=()=>new Date().toLocaleDateString("en-CA"); // America/Phoenix box/user local date
function touchStreak(){const t=day();if(P.lastDay===t)return;const y=new Date(Date.now()-864e5).toLocaleDateString("en-CA");P.streak=(P.lastDay===y)?P.streak+1:1;P.lastDay=t;save()}
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function loadPool(){if(pool.length)return;if(!window.LORCANA_GAME_CARDS)await loadScript("./data/game-cards.js?v="+V);
  const raw=(window.LORCANA_GAME_CARDS&&window.LORCANA_GAME_CARDS.cards)||[];
  for(const r of raw)rawById.set(r.id,r);
  pool=raw.filter(c=>/^(9|10|11|12|13|14)$/.test(String(c.set))).map(E.normCard);byId=new Map(pool.map(c=>[c.id,c]));}
function ensureRoot(){if(root)return;root=document.createElement("div");root.id="learn";root.hidden=true;document.body.appendChild(root);root.addEventListener("click",onClick)}
const flat=()=>D.chapters.flatMap((ch,ci)=>ch.lessons.map((l,li)=>({ch,ci,li,l})));
const isDone=id=>!!P.done[id];
function unlocked(idx){const f=flat();if(idx===0)return true;return isDone(f[idx-1].l.id)}
function currentIdx(){const f=flat();const i=f.findIndex(x=>!isDone(x.l.id));return i<0?f.length-1:i}
function cardFor(lesson,off){const c=byId.get(lesson.exampleId);if(c)return c;const tagged=pool.filter(x=>tagMatch(lesson.tag,x));return tagged[(Math.abs(off||0))%Math.max(1,tagged.length)]||pool[0]}
function tagMatch(tag,c){const t=(c.text||"").toLowerCase();const raw=c;
 const m={character:()=>c.type==="character",charLore2:()=>c.type==="character"&&c.lore>=2,charCheap:()=>c.type==="character"&&c.cost<=2,charBig:()=>c.type==="character"&&c.cost>=5,inkable:()=>c.inkable,nonink:()=>!c.inkable,song:()=>c.type==="song",action:()=>c.type==="action",item:()=>c.type==="item",location:()=>c.type==="location",draw:()=>t.includes("draw")};
 if(m[tag])return m[tag]();return t.includes(tag)}
function pick(tag,seed,not){const a=pool.filter(x=>tagMatch(tag,x)&&(!not||!not.includes(x)));return a[Math.abs(seed)%a.length]}
const KWDEF={bodyguard:"Bodyguard may enter play exerted. Opponents challenging your characters must choose a Bodyguard if able.",evasive:"Only characters with Evasive can challenge this character.",ward:"Opponents can't choose this character except to challenge.",resist:"Damage dealt to this character is reduced by the Resist number.",rush:"This character can challenge the turn they are played.",challenger:"This character gets the Challenger bonus to strength while challenging.",support:"Whenever this character quests, add their strength to another chosen character's strength this turn.",reckless:"This character must challenge each turn if able.",shift:"Pay the Shift cost to play this on top of a character with the same name.",singer:"This character counts as the Singer cost when singing songs.",alert:"This character can challenge as if they had Evasive.",boost:"Once during your turn, pay the Boost cost to put the top card of your deck facedown under this character."};
const TEACH={
 goal:"First player to reach 20 lore wins. Almost everything you do should either gain lore, stop their lore, or set up next turn.",
 turn:"A turn is: ready your cards, draw a card (not on the very first turn of the game), then ink once and take actions. End when finished.",
 ready:"Ready cards are upright and can act. Exerted cards are turned sideways: they have quested, challenged, sung, or paid a cost.",
 stats:"Characters show cost (top), strength (sword), willpower (heart/shield), and lore (diamond). Strength deals damage; willpower is health.",
 lore:"Questing exerts a dry, ready character and gains lore equal to its lore value. Exerted characters are easier for rivals to challenge.",
 ink:"Once per turn you may put a card from hand into your inkwell. Ink is your resource: exert ink to pay costs.",
 inkable:"Only cards with the inkwell symbol can be inked. If a card has no symbol, you cannot put it in the inkwell.",
 drying:"A character's ink must dry: it cannot quest, challenge, or sing the turn it is played (unless Rush for challenging).",
 quest:"To quest: exert a dry, ready character. You gain its lore. It stays exerted until your next ready step.",
 challenge:"To challenge: exert your dry, ready character and choose an exerted opposing character. Each deals damage equal to its strength to the other.",
 damage:"Damage stays on a character. If damage equals or exceeds willpower, that character is banished to the discard.",
 song:"A character with cost equal to or greater than a song can exert to sing it for free instead of paying ink. The singer must be dry.",
 singer:"Singer N means the character counts as cost N for singing songs, even if its printed cost is different.",
 singtogether:"Sing Together lets several characters exert and add their costs to sing one big song for free.",
 action:"Actions do their effect once, then go to the discard. Read them top to bottom and do what you can.",
 item:"Items stay in play. Many have abilities you exert or pay ink to use, turn after turn.",
 location:"Locations stay in play. Characters can move to them by paying the move cost, and may gain bonuses or lore there.",
 deck60:"Core Constructed deck rules used in this app: exactly 60 cards is the goal, at most 2 ink colours, at most 4 copies of any one full card name.",
 mulligan:"After drawing 7, you may put any number on the bottom and draw that many replacements, then shuffle. Keep early ink and plays.",
 race:"Always count: your lore, their lore, and how many lore each board can gain next turn. That tells you whether to race or to challenge.",
 proplan:"Plan the whole turn before tapping: what will I ink, play, sing, quest with, and challenge with — in that order?"};
function teachText(l){return TEACH[l.topic]||KWDEF[l.tag]||TEACH[l.tag]||l.desc+" Use the card shown: read its cost, type, and text, then answer from what the card actually says."}
function optsFor(correct,others){const a=[correct,...others.filter(x=>x!==correct)];for(let i=a.length-1;i>0;i--){const j=(si*7+i)%(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function pickWhere(fn,seed,not){const a=pool.filter(x=>fn(x)&&(!not||!not.includes(x)));return a.length?a[Math.abs(seed)%a.length]:null}
function boardTask(l,variant){
 const ex=cardFor(l); const seed=l.title.length*3+variant*17;
 const mk=(card,role,state)=>({card,role,state,id:card.id});
 // Keyword: tap the card that actually has it (distractors verified not to have it)
 if(KWDEF[l.tag]){const good=pickWhere(c=>c.type==="character"&&!!c.kw[l.tag],seed,[])||pickWhere(c=>c.type==="character"&&(c.text||"").toLowerCase().includes(l.tag),seed,[])||ex;
   const d1=pickWhere(c=>c.type==="character"&&!(c.text||"").toLowerCase().includes(l.tag),seed+5,[good]);
   const d2=pickWhere(c=>c.type==="character"&&!(c.text||"").toLowerCase().includes(l.tag),seed+11,[good,d1]);
   return{q:"Tap the character with "+l.tag[0].toUpperCase()+l.tag.slice(1)+".",cards:shuffle([mk(good,"Yours","In play"),mk(d1,"Yours","In play"),mk(d2,"Rival","In play")],seed),answerId:good.id,why:KWDEF[l.tag]}}
 if(/ink/.test(l.topic)&&!/proink/.test(l.topic)){const good=pickWhere(c=>c.inkable,seed)||ex;const d1=pickWhere(c=>!c.inkable,seed+3,[good]);const d2=pickWhere(c=>!c.inkable,seed+7,[good,d1]);
   return{q:"Tap a card in your hand to ink it.",hud:"Inkwell: 2 ink · You may ink once this turn",cards:shuffle([mk(good,"Hand","Can be inked?"),mk(d1,"Hand","Can be inked?"),mk(d2,"Hand","Can be inked?")],seed),answerId:good.id,why:good.full+" has the inkwell symbol, so it can go into your inkwell."}}
 if(/sing|song/.test(l.topic)||l.tag==="song"){const song=pickWhere(c=>c.type==="song",seed)||ex;const good=pickWhere(c=>c.type==="character"&&c.cost>=song.cost,seed+2);const d1=pickWhere(c=>c.type==="character"&&c.cost<song.cost&&!(c.kw.singer>=song.cost),seed+4,[good]);const d2=pickWhere(c=>c.type==="character"&&c.cost<song.cost&&!(c.kw.singer>=song.cost),seed+8,[good,d1]);
   if(good&&d1)return{q:"Tap the dry character that can sing "+song.name+" (cost "+song.cost+") for free.",hud:"Song in hand: "+song.full+" · Singers must be dry",cards:shuffle([mk(good,"Yours","Dry · Ready"),mk(d1,"Yours","Dry · Ready"),mk(d2||d1,"Yours","Dry · Ready")],seed),answerId:good.id,why:good.full+" costs "+good.cost+", enough to sing a cost "+song.cost+" song."}}
 if(/chal|damage|trade|prochoice/.test(l.topic)){const atk=pickWhere(c=>c.type==="character"&&c.str>=3&&!c.kw.challenger,seed)||ex;const good=pickWhere(c=>c.type==="character"&&c.wil<=atk.str&&!c.kw.resist&&c!==atk,seed+3);const hard=pickWhere(c=>c.type==="character"&&c.wil>atk.str&&!c.kw.resist,seed+6,[good]);const ready=pickWhere(c=>c.type==="character",seed+9,[good,hard]);
   if(good&&hard)return{q:"Your "+atk.name+" (strength "+atk.str+") can challenge. Tap the exerted rival it can banish.",hud:"Your lore 8 · Rival lore 9",cards:shuffle([mk(good,"Rival","Exerted"),mk(hard,"Rival","Exerted"),mk(ready,"Rival","Ready")],seed),answerId:good.id,why:atk.name+" deals "+atk.str+" damage, enough for "+good.full+"'s "+good.wil+" willpower. Ready rivals cannot be challenged."}}
 if(/loc|move/.test(l.topic)||l.tag==="location"){const good=pickWhere(c=>c.type==="location",seed)||ex;const d1=pickWhere(c=>c.type==="character",seed+2,[good]);const d2=pickWhere(c=>c.type==="character",seed+5,[good,d1]);
   return{q:"Tap the location to move your character to it.",hud:"Move costs are paid with ink",cards:shuffle([mk(good,"Location","In play"),mk(d1,"Yours","In play"),mk(d2,"Yours","In play")],seed),answerId:good.id,why:good.full+" is the location. Characters move to locations; locations stay in play."}}
 if(/play|dry|curve|copies|deck|mulligan|keep|tempo|big|cheap/.test(l.topic)){const good=pickWhere(c=>c.type==="character"&&c.cost<=3,seed)||ex;const d1=pickWhere(c=>c.cost>3,seed+4,[good]);const d2=pickWhere(c=>c.cost>3,seed+8,[good,d1]);
   if(d1)return{q:"You have 3 ink ready. Tap the card you can play now.",hud:"Ready ink: 3",cards:shuffle([mk(good,"Hand","In hand"),mk(d1,"Hand","In hand"),mk(d2||d1,"Hand","In hand")],seed),answerId:good.id,why:good.full+" costs "+good.cost+" ink, within your 3 ready ink."}}
 // Default: quest — exactly one dry+ready quester, so the answer is rules-true, not a guess
 const good=(ex.type==="character"?ex:pickWhere(c=>c.type==="character"&&c.lore>=1,seed));const d1=pickWhere(c=>c.type==="character",seed+3,[good]);const d2=pickWhere(c=>c.type==="character",seed+6,[good,d1]);
 return{q:"Tap your dry, ready character to quest for lore.",hud:"Your lore 6 · Rival lore 7 · First to 20 wins",cards:shuffle([mk(good,"Yours","Dry · Ready"),mk(d1,"Yours","Exerted"),mk(d2,"Yours","Just played · Wet ink")],seed),answerId:good.id,why:good.full+" is dry and ready, so it can exert to quest for "+good.lore+" lore. Exerted and just-played characters cannot."}
}
function shuffle(a,seed){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.abs(seed+i*7)%(i+1);[x[i],x[j]]=[x[j],x[i]]}return x}
function makeSteps(l){
 const c=cardFor(l);
 const g1=boardTask(l,0), g2=boardTask(l,1), yt=boardTask(l,2);
 return [
  {k:"board",phase:"Guided walkthrough",guide:true,...g1},
  {k:"board",phase:"Guided walkthrough",guide:true,...g2},
  {k:"board",phase:"Your turn",guide:false,...yt},
  {k:"practice",phase:"Mini challenge",topic:l.topic,tag:l.tag,card:c},
  {k:"mc",phase:"Quick check",q:ruleQ(l).q,options:optsFor(ruleQ(l).a,ruleQ(l).o),answer:ruleQ(l).a,why:ruleQ(l).w,card:c}
 ];
}
function ruleQ(l){const qs=[
 {q:"When does a character's ink dry?",a:"At the start of your next turn",o:["Immediately when played","After it quests","Never"],w:"A character played this turn cannot quest or challenge until your next turn (Rush only helps challenging)."},
 {q:"How many cards may you ink in one turn?",a:"One (unless a card says otherwise)",o:["As many as you like","Two every turn","Zero"],w:"The normal rule is one card into your inkwell per turn."},
 {q:"Who can be challenged?",a:"An exerted opposing character",o:["Any character","A ready character","A card in hand"],w:"Challenges target exerted opposing characters, unless a card says otherwise."},
 {q:"What happens at 20 lore?",a:"That player wins",o:["Draw another card","The game restarts","Nothing special"],w:"First to 20 lore wins Core Constructed games."},
 {q:"How many inks can a deck use?",a:"At most 2",o:["1 only","Up to 6","Any number"],w:"Deck building here allows at most 2 ink colours."}];
 return qs[(l.title.length)%qs.length]}
/* --- engine practice: tiny preset board, actions checked by E.isLegal/E.act --- */
function buildPractice(topic,tag,card){
 try{
  const quester=pick("charLore2",5)||card, foe=pick("character",17,[quester])||card, filler=pick("charCheap",23,[quester,foe])||card;
  const deckA=Array.from({length:14},()=>quester), deckB=Array.from({length:14},()=>foe);
  const st=E.newGame({decks:[deckA,deckB],names:["You","Rival"],first:0,seed:1234});
  E.mulligan(st,0,[]);E.mulligan(st,1,[]);
  const me=st.players[0], op=st.players[1];
  const take=(p,cd)=>{const x=p.hand[0]||p.deck[0];x.card=cd;return x};
  // clear zones into deck to keep it simple, then place scripted cards
  me.play=[];op.play=[];me.ink=[];op.ink=[];
  const mine=take(me, (tag==="rush"?(pick("rush",3)||quester):quester)); mine.playedOn=0;mine.exerted=false;me.play.push(mine);me.hand=me.hand.slice(1);
  const theirs=take(op,foe); theirs.playedOn=0;theirs.exerted=true;op.play.push(theirs);op.hand=op.hand.slice(1);
  const handCard=take(me,filler); // stays in hand for ink/play scenarios
  // ink: 3 ready ink
  me.ink=me.deck.slice(0,3).map(x=>{x.exerted=false;return x});me.deck=me.deck.slice(3);
  st.phase="main";st.active=0;st.turnNo=2;st.pending=null;
  let goal,action;
  if(topic.includes("chal")||tag==="rush"||topic.includes("trade")){goal="Challenge their exerted "+theirs.card.name+" with your "+mine.card.name+".";action={t:"challenge",uid:mine.uid,target:theirs.uid}}
  else if(topic.includes("ink")){goal="Put "+handCard.card.full+" into your inkwell.";action={t:"ink",uid:handCard.uid}}
  else if(topic==="play"||topic.includes("play")&&!topic.includes("pro")){ // try play hand card if affordable, else quest
    if(E.isLegal(st,{t:"play",uid:handCard.uid})){goal="Play "+handCard.card.full+" from your hand.";action={t:"play",uid:handCard.uid}}else{goal="Quest with "+mine.card.name+" for "+(E.loreOf?E.loreOf(mine):mine.card.lore)+" lore.";action={t:"quest",uid:mine.uid}}}
  else {goal="Quest with "+mine.card.name+" for "+mine.card.lore+" lore.";action={t:"quest",uid:mine.uid}}
  // If intended action illegal (e.g. vanilla constraints), fall back to any legal quest/challenge
  if(!E.isLegal(st,action)){const legal=E.legalActions(st);const q=legal.find(a=>a.t==="quest")||legal.find(a=>a.t==="challenge")||legal.find(a=>a.t==="ink");if(q){action=q;const f=E.find(st,q.uid);goal=(q.t==="quest"?"Quest with ":q.t==="challenge"?"Challenge with ":"Ink ")+(f?f.inst.card.full:"the shown card")+(q.t==="challenge"?" — tap Challenge.":" ")}}
  return{st,goal,action,mine,theirs,handCard,beforeLore:me.lore,beforeOpp:op.play.length};
 }catch(e){return null}
}
function renderPath(){
 const f=flat(),ci=currentIdx(),doneN=f.filter(x=>isDone(x.l.id)).length;
 const pct=Math.round(100*doneN/f.length);
 let h=`<div class="lbar"><button class="lbtn" data-act="close">Close</button><div class="ltitle">LEARN</div><div class="lstats"><span data-testid="xp">${P.xp} XP</span><span>${P.streak} day streak</span></div></div>
 <div class="lhero"><b>${doneN}/${f.length} lessons</b><span>${pct}% complete</span><div class="lprog"><i style="width:${pct}%"></i></div><p>Sets 9-14 Core Constructed only. Set 14 has no card data in the app yet, so examples use printed sets 9-13 cards.</p></div><div class="lpath">`;
 D.chapters.forEach((ch,chi)=>{
  h+=`<div class="lchap" style="--ch:${esc(ch.color)}"><h2>Chapter ${chi+1}: ${esc(ch.title)}</h2><p>${esc(ch.desc)}</p></div>`;
  ch.lessons.forEach((l,li)=>{
   const idx=f.findIndex(x=>x.l.id===l.id), dn=isDone(l.id), un=unlocked(idx), curL=idx===ci;
   const side=(li%2===0)?"left":"right";
   h+=`<div class="lnode ${side}"><button class="ln ${dn?"done":""} ${un?"":"lock"} ${curL?"cur":""} ${l.test?"trophy":""}" data-act="${un?"lesson":"locked"}" data-id="${esc(l.id)}" ${un?"":"aria-disabled=true"}><span class="ln-ic">${l.test?svgTrophy():svgBook()}</span><span class="ln-t">${esc(l.title)}</span><small>${dn?"Done":un?(l.xp+" XP"):"Locked"}</small></button></div>`;
   if(li===3){const cid=ch.id, claimed=!!P.chests[cid], can=ch.lessons.slice(0,4).every(x=>isDone(x.id));
    h+=`<div class="lnode mid"><button class="ln chest ${claimed?"done":""} ${can||claimed?"":"lock"}" data-act="${claimed?"chestdone":can?"chest":"locked"}" data-id="${esc(cid)}"><span class="ln-ic">${svgChest()}</span><span class="ln-t">Bonus Chest</span><small>${claimed?"Claimed +20 XP":can?"Tap to claim +20 XP":"Finish 4 lessons"}</small></button></div>`}
  });
 });
 h+=`</div>`;
 root.innerHTML=h;
 requestAnimationFrame(()=>{const el=root.querySelector(".ln.cur")||root.querySelector(".ln:not(.lock)");if(el)el.scrollIntoView({block:"center",behavior:"auto"})});
}
const svgBook=()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" fill="currentColor" opacity=".9"/><path d="M8 8h8M8 12h6" stroke="#14112a" stroke-width="2" stroke-linecap="round"/></svg>`;
const svgChest=()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="10" rx="2" fill="currentColor"/><path d="M3 12h18M12 9v10" stroke="#14112a" stroke-width="2"/><circle cx="12" cy="14" r="2" fill="#14112a"/></svg>`;
const svgTrophy=()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v4a6 6 0 01-12 0z" fill="currentColor"/><path d="M6 5H3a3 3 0 003 4M18 5h3a3 3 0 01-3 4M12 13v4M8 21h8l-1-4H9z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
function cardImg(c,cls){return c&&c.img?`<img class="${cls||""}" src="${esc(c.img)}" alt="${esc(c.full)}" loading="lazy" decoding="async">`:""}
function renderStep(){
 const l=cur.l, st=steps[si];answered=false;
 let body="";
 if(st.k==="mc"){body=`<div class="lphase">${esc(st.phase)}</div><p class="lq">${esc(st.q)}</p><div class="lopts">${st.options.map(o=>`<button class="lopt" data-act="answer" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div><div class="lfeed" hidden></div>`}
 else if(st.k==="board"){body=`<div class="lphase">${esc(st.phase)}${st.guide?" · Follow the highlight":" · No highlight — your call"}</div><div class="lbanner">${esc(st.q)}</div>${st.hud?`<div class="lhud">${esc(st.hud)}</div>`:""}<div class="lboard">${st.cards.map(x=>`<button class="lbcard ${st.guide&&x.id===st.answerId?"guide":""}" data-act="board" data-v="${esc(x.id)}">${cardImg(x.card)}<span><b>${esc(x.role)}</b> · ${esc(x.card.full)}<br><small>${esc(x.state)} · Cost ${x.card.cost} · Str ${x.card.str} · Wil ${x.card.wil} · Lore ${x.card.lore}${x.card.inkable?" · Inkable":""}</small></span></button>`).join("")}</div><div class="lfeed" hidden></div>`}
 else if(st.k==="practice"){practice=buildPractice(st.topic,st.tag,st.card);
   const roleFor=practice?(practice.action.t==="challenge"?"theirs":practice.action.t==="quest"?"mine":"hand"):null; practiceRole=roleFor;
   body=practice?`<div class="lphase">Mini challenge · Real engine board</div><div class="lbanner">${esc(practice.goal)}</div><div class="lhud">Tap the right card on the board — the engine will check it</div><div class="lboard"><button class="lbcard" data-act="pcard" data-v="mine">${cardImg(practice.mine.card)}<span><b>Yours</b> · ${esc(practice.mine.card.full)}<br><small>Dry · Ready · Lore ${practice.mine.card.lore} · Str ${practice.mine.card.str}</small></span></button><button class="lbcard" data-act="pcard" data-v="theirs">${cardImg(practice.theirs.card)}<span><b>Rival</b> · ${esc(practice.theirs.card.full)}<br><small>Exerted · Str ${practice.theirs.card.str} · Wil ${practice.theirs.card.wil}</small></span></button><button class="lbcard" data-act="pcard" data-v="hand">${cardImg(practice.handCard.card)}<span><b>In hand</b> · ${esc(practice.handCard.card.full)}<br><small>Cost ${practice.handCard.card.cost} · Ready ink ${practice.st.players[0].ink.filter(x=>!x.exerted).length}</small></span></button></div><div class="lfeed" hidden></div>`
   :`<div class="lphase">Mini challenge</div><div class="lbanner">Tap your ready character to quest.</div><button class="lgo" data-act="practiceFallback">Quest</button><div class="lfeed" hidden></div>`}
 root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="back">Back</button><div class="ltitle">${esc(l.title)}</div><div class="lstats"><span>${si+1}/${steps.length}</span></div></div><div class="lprog thin"><i style="width:${Math.round(100*si/steps.length)}%"></i></div><main class="llesson">${body}</main>`;
}
let practiceRole=null;
function feedback(ok,why,retry){
 const f=root.querySelector(".lfeed");if(f){f.hidden=false;f.className="lfeed "+(ok?"ok":"bad");f.innerHTML=`<b>${ok?"Correct — board updated":"Not quite — try again"}</b><p>${esc(why)}</p>${ok||!retry?`<button class="lgo" data-act="next">Continue</button>`:`<p><b>Tap another card.</b></p>`}`}
 if(ok){score++;answered=true;if(window.FX&&FX.at)try{FX.at(root.querySelector(".lbcard.guide,.lbcard"),{n:14})}catch(e){}
   root.querySelectorAll(".lopt,.lbcard").forEach(b=>b.disabled=true);}
}
function finish(){
 const l=cur.l, first=!isDone(l.id);
 if(first){P.done[l.id]=Date.now();P.xp+=l.xp;touchStreak();save()}
 const total=flat().length, doneN=flat().filter(x=>isDone(x.l.id)).length;
 root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="back">Path</button><div class="ltitle">Lesson complete</div></div><main class="llesson center"><div class="lbig">${svgTrophy()}</div><h2>${esc(l.title)}</h2><p class="ltext">${first?("+"+l.xp+" XP · Score "+score+"/"+steps.length):"Already completed — good practice."}</p><p class="ltext">${doneN}/${total} lessons done · ${P.xp} XP · ${P.streak} day streak${P.sparkle?" · Sparkle cosmetic on":""}</p><button class="lgo" data-act="back">Back to path</button></main>`;
 if(window.FX&&FX.celebrate)FX.celebrate();
}
function startLesson(id){const f=flat();cur=f.find(x=>x.l.id===id);if(!cur)return;steps=makeSteps(cur.l);si=0;score=0;renderStep()}
function onClick(e){const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act;
 if(a==="close"){close();location.hash="";return}
 if(a==="back"){practice=null;renderPath();return}
 if(a==="locked")return;
 if(a==="lesson")startLesson(b.dataset.id);
 if(a==="chest"){const cid=b.dataset.id;if(!P.chests[cid]){P.chests[cid]=1;P.xp+=20;P.sparkle=true;save()}renderPath();return}
 if(a==="chestdone")return;
 if(a==="next"){si++;if(si>=steps.length)finish();else renderStep();return}
 if(a==="answer"){if(answered)return;const st=steps[si];feedback(b.dataset.v===st.answer,st.why);return}
 if(a==="board"){if(answered)return;const st=steps[si];const ok=b.dataset.v===st.answerId;if(ok){b.classList.add("acted")}feedback(ok,ok?st.why:("That card cannot do that here. "+st.why),!ok);return}
 if(a==="practiceFallback"){const f=root.querySelector(".lfeed");feedback(true,"Questing exerted your dry character and gained its lore. That is the core engine quest action.");return}
 if(a==="pcard"){if(answered||!practice)return;
   if(b.dataset.v!==practiceRole){feedback(false,practice.action.t==="challenge"?"That is not the target. Challenge: tap the exerted rival card.":practice.action.t==="quest"?"Quest with your own dry character — tap Yours.":"That move uses the card in your hand — tap In hand.",true);return}
   try{if(!E.isLegal(practice.st,practice.action)){feedback(false,"The engine says that is not legal here: "+practice.goal+" Check dry, ready, exerted targets and ink.",true);return}
     E.act(practice.st,practice.action);b.classList.add("acted");feedback(true,"Engine accepted it. "+practice.goal+" Lore now "+practice.st.players[0].lore+", rival cards in play: "+practice.st.players[1].play.length+".");
   }catch(err){feedback(false,"The engine rejected that action. "+practice.goal,true)}
   return}

}
async function open(){ensureRoot();root.hidden=false;document.body.classList.add("learning");root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="close">Close</button><div class="ltitle">LEARN</div></div><p class="lload">Loading cards from sets 9-14...</p>`;await loadPool();renderPath()}
function close(){if(root)root.hidden=true;document.body.classList.remove("learning");practice=null}
window.LorcanaLearn={open,close,state:()=>({P,cur,steps:steps.length,si}),_test:{makeSteps,buildPractice,flat,unlocked,cardFor,startLesson,getSteps:()=>steps,getPractice:()=>({practice,practiceRole}),pool:()=>pool}};
})();
