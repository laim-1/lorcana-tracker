/* Learn: Duolingo-style winding path. Scripted tiny boards validated with LorcanaEngine (normCard/K/dry/legalActions/act). */
(function(){
"use strict";
const E=window.LorcanaEngine, D=window.LEARN_DATA, V=window.APP_VERSION||"dev";
const KEY="lorcanaLearn.v1";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let root=null, rawById=new Map(), pool=[], byId=new Map(), cur=null, steps=[], si=0, score=0, answered=false, practice=null;
/* Real icons only (inline SVG, same stroke style as js/play.js ICO). No emoji anywhere in Learn. */
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
const SHORT={goal:"20 Lore",turn:"Your Turn",ready:"Ready",stats:"Card Stats",lore:"Quest Lore",hand:"Your Hand",win:"Winning",plan:"First Plan",ink:"Inkwell",inkable:"Inkable",nonink:"Cannot Ink",pay:"Pay Costs",inkearly:"Ink Early",inkchoice:"Choose Ink",inkhand:"Hand Size",inksave:"Save a Card",play:"Play a Card",drying:"Drying",dryquest:"Can Quest?",drychal:"Can Hit?",cheap:"Cheap First",big:"Big Cards",playchoice:"One or Two?",playhand:"Hold Back",quest:"Quest",queststat:"Lore Value",questrisk:"Quest Risk",race:"Lore Race",queststeady:"Quest Often",questno:"Skip Quest?",finish:"Finish It",questloc:"Locations",challenge:"Challenge",chaltarget:"Exerted Only",chalboth:"Hits Back",chalboard:"Read Board",chalsafe:"Safe Hit",chalbad:"Bad Hit",chalwhy:"Slow Them",chalevasive:"Evasive",damage:"Damage",willpower:"Willpower",banish:"Banish",dmgmath:"Damage Math",heal:"Healing",resistprev:"Resist",dmgfinish:"Finish Them",dmgplan:"Aim Damage",song:"Songs",sing:"Sing Free",singer:"Singer",singtogether:"Sing Together",singchoice:"Ink or Sing?",singdry:"Dry Singers",songdraw:"Draw Songs",songremove:"Remove",action:"Actions",actiondraw:"Draw",actiondmg:"Damage",actionbanish:"Banish",actionbounce:"Bounce",actionhold:"Hold It",actionink:"Action Ink",actionread:"Read It",item:"Items",itemuse:"Use Items",itemdraw:"Draw Items",itemprotect:"Protect",itemsac:"One-Time",itemvalue:"Worth It?",itemcombo:"Combos",itemanswer:"Answers",location:"Locations",movecost:"Move Cost",loclore:"Place Lore",locbonus:"Bonuses",locchal:"Hit Places",movewhen:"When to Move",movefree:"Free Moves",locplan:"Place Plans",bodyguard:"Bodyguard",bodyguardface:"Face Guard",evasive:"Evasive",ward:"Ward",resist:"Resist",alert:"Alert",boost:"Boost",kwmatch1:"Match-Up",rush:"Rush",challenger:"Challenger",support:"Support",reckless:"Reckless",shift:"Shift",shiftcheap:"Shift Cheap",singer2:"Singer",kwmatch2:"Match-Up",drawcard:"Draw",handsize:"Hand Size",deckknow:"Deck Know",tempo:"Tempo",racecount:"Count Race",tradevalue:"Trading",lowcards:"Running Low",comeback:"Comeback",deck60:"60 Cards",copies:"4 Copies",deckink:"Inkable Mix",curve:"Cost Curve",deckchars:"Questers",deckmix:"Card Mix",mulligan:"Mulligan",keephand:"Keep a Hand",proplan:"Plan First",prochoice:"Quest or Hit?",procount:"Count Race",prosongs:"Dodge Songs",proremoval:"Dodge Removal",proink:"Late Ink",protrade:"Trade Smart",profinal:"Final Turn",test:"Test"};
function shortTitle(l){if(l.test)return "Test";if(SHORT[l.topic])return SHORT[l.topic];const t=String(l.title||"").replace(/^The /,"").replace(/,.*$/,"");const w=t.split(/\s+/).filter(Boolean);return w.length<=2?t:w.slice(0,2).join(" ")}
function iconFor(l){if(l.test)return ICO.trophy;const k=(l.topic+" "+l.tag).toLowerCase();
 if(/ink/.test(k))return ICO.ink; if(/song|sing/.test(k))return ICO.note; if(/chal|damage|dmg|trade|prochoice/.test(k))return ICO.sword;
 if(/loc|move/.test(k))return ICO.pin; if(/item/.test(k))return ICO.box; if(/action|comeback/.test(k))return ICO.bolt;
 if(/bodyguard|evasive|ward|resist|alert|boost|rush|challenger|support|reckless|shift|kwmatch/.test(k))return ICO.shield;
 if(/draw|deck|copies|curve|mulligan|hand|tempo/.test(k))return ICO.deck; if(/quest|lore|race|finish|goal|win/.test(k))return ICO.lore;
 return ICO.book}
function oneLine(txt){const t=String(txt||"").split(/(?<=[.!?])\s/)[0];return t.length>96?t.slice(0,93).trim()+"...":t}

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
   if(good&&d1)return{focus:song,q:"Tap the dry character that can sing "+song.name+" (cost "+song.cost+") for free.",hud:"Song in hand · Singers must be dry",cards:shuffle([mk(good,"Yours","Dry · Ready"),mk(d1,"Yours","Dry · Ready"),mk(d2||d1,"Yours","Dry · Ready")],seed),answerId:good.id,why:good.full+" costs "+good.cost+", enough to sing a cost "+song.cost+" song."}}
 if(/chal|damage|trade|prochoice/.test(l.topic)){const atk=pickWhere(c=>c.type==="character"&&c.str>=3&&!c.kw.challenger,seed)||ex;const good=pickWhere(c=>c.type==="character"&&c.wil<=atk.str&&!c.kw.resist&&c!==atk,seed+3);const hard=pickWhere(c=>c.type==="character"&&c.wil>atk.str&&!c.kw.resist,seed+6,[good]);const ready=pickWhere(c=>c.type==="character",seed+9,[good,hard]);
   if(good&&hard)return{q:"Your "+atk.name+" (strength "+atk.str+") can challenge. Tap the exerted rival it can banish.",hud:"Your lore 8 · Rival lore 9",cards:shuffle([mk(atk,"Yours","Dry · Ready"),mk(good,"Rival","Exerted"),mk(hard,"Rival","Exerted"),mk(ready,"Rival","Ready")],seed),answerId:good.id,why:atk.name+" deals "+atk.str+" damage, enough for "+good.full+"'s "+good.wil+" willpower. Ready rivals cannot be challenged."}}
 if(/loc|move/.test(l.topic)||l.tag==="location"){const good=pickWhere(c=>c.type==="location",seed)||ex;const d1=pickWhere(c=>c.type==="character",seed+2,[good]);const d2=pickWhere(c=>c.type==="character",seed+5,[good,d1]);
   return{q:"Tap the location to move your character to it.",hud:"Move costs are paid with ink",cards:shuffle([mk(good,"Location","In play"),mk(d1,"Yours","In play"),mk(d2,"Yours","In play")],seed),answerId:good.id,why:good.full+" is the location. Characters move to locations; locations stay in play."}}
 if(/play|dry|curve|copies|deck|mulligan|keep|tempo|big|cheap/.test(l.topic)){const good=pickWhere(c=>c.type==="character"&&c.cost<=3,seed)||ex;const d1=pickWhere(c=>c.cost>3,seed+4,[good]);const d2=pickWhere(c=>c.cost>3,seed+8,[good,d1]);
   if(d1)return{q:"You have 3 ink ready. Tap the card you can play now.",hud:"Ready ink: 3",cards:shuffle([mk(good,"Hand","In hand"),mk(d1,"Hand","In hand"),mk(d2||d1,"Hand","In hand")],seed),answerId:good.id,why:good.full+" costs "+good.cost+" ink, within your 3 ready ink."}}
 // Default: quest — exactly one dry+ready quester, so the answer is rules-true, not a guess
 const good=(ex.type==="character"?ex:pickWhere(c=>c.type==="character"&&c.lore>=1,seed));const d1=pickWhere(c=>c.type==="character",seed+3,[good]);const d2=pickWhere(c=>c.type==="character",seed+6,[good,d1]);
 return{q:"Tap your dry, ready character to quest for lore.",hud:"Your lore 6 · Rival lore 7 · First to 20 wins",cards:shuffle([mk(good,"Yours","Dry · Ready"),mk(d1,"Yours","Exerted"),mk(d2,"Yours","Just played · Wet ink")],seed),answerId:good.id,why:good.full+" is dry and ready, so it can exert to quest for "+good.lore+" lore. Exerted and just-played characters cannot."}
}
function shuffle(a,seed){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.abs(seed+i*7)%(i+1);[x[i],x[j]]=[x[j],x[i]]}return x}
function makeMC(l,c){
 const seed=l.title.length*7+11;
 const mk=(card)=>card;
 if(KWDEF[l.tag]){const good=pickWhere(x=>x.type==="character"&&!!x.kw[l.tag],seed)||pickWhere(x=>x.type==="character"&&(x.text||"").toLowerCase().includes(l.tag),seed)||c;
  const d1=pickWhere(x=>x.type==="character"&&!(x.text||"").toLowerCase().includes(l.tag),seed+5,[good]);const d2=pickWhere(x=>x.type==="character"&&!(x.text||"").toLowerCase().includes(l.tag),seed+11,[good,d1]);
  if(d1&&d2)return{q:"Tap the card with "+l.tag[0].toUpperCase()+l.tag.slice(1)+".",choices:shuffle([mk(good),mk(d1),mk(d2)],seed),answerId:good.id,why:KWDEF[l.tag],card:good}}
 if(/ink/.test(l.topic)&&!/proink/.test(l.topic)){const good=pickWhere(x=>x.inkable,seed)||c;const d1=pickWhere(x=>!x.inkable,seed+3,[good]);const d2=pickWhere(x=>!x.inkable,seed+7,[good,d1]);
  if(d1&&d2)return{q:"Tap the card you can put in your inkwell.",choices:shuffle([mk(good),mk(d1),mk(d2)],seed),answerId:good.id,why:good.full+" has the inkwell symbol, so it can be inked.",card:good}}
 if(/song|sing/.test(l.topic)||l.tag==="song"){const good=pickWhere(x=>x.type==="song",seed)||c;const d1=pickWhere(x=>x.type==="character",seed+3,[good]);const d2=pickWhere(x=>x.type==="item",seed+7,[good,d1]);
  if(d1&&d2)return{q:"Tap the song card.",choices:shuffle([mk(good),mk(d1),mk(d2)],seed),answerId:good.id,why:good.full+" is a song: a dry character of equal or higher cost can sing it for free.",card:good}}
 if(/loc|move/.test(l.topic)||l.tag==="location"){const good=pickWhere(x=>x.type==="location",seed)||c;const d1=pickWhere(x=>x.type==="character",seed+3,[good]);const d2=pickWhere(x=>x.type==="character",seed+7,[good,d1]);
  if(d1&&d2)return{q:"Tap the location card.",choices:shuffle([mk(good),mk(d1),mk(d2)],seed),answerId:good.id,why:good.full+" is a location. It stays in play and characters can move to it.",card:good}}
 if(l.tag==="item"){const good=pickWhere(x=>x.type==="item",seed)||c;const d1=pickWhere(x=>x.type==="character",seed+3,[good]);const d2=pickWhere(x=>x.type==="character",seed+7,[good,d1]);
  if(d1&&d2)return{q:"Tap the item card.",choices:shuffle([mk(good),mk(d1),mk(d2)],seed),answerId:good.id,why:good.full+" is an item. Items stay in play after you play them.",card:good}}
 if(l.tag==="action"){const good=pickWhere(x=>x.type==="action",seed)||c;const d1=pickWhere(x=>x.type==="character",seed+3,[good]);const d2=pickWhere(x=>x.type==="item",seed+7,[good,d1]);
  if(d1&&d2)return{q:"Tap the action card.",choices:shuffle([mk(good),mk(d1),mk(d2)],seed),answerId:good.id,why:good.full+" is an action: do what it says once, then discard it.",card:good}}
 const good=(c.type==="character"&&c.lore>=2)?c:(pickWhere(x=>x.type==="character"&&x.lore>=2,seed)||c);
 const d1=pickWhere(x=>x.type==="character"&&x.lore<2,seed+3,[good]);const d2=pickWhere(x=>x.type==="character"&&x.lore<2,seed+7,[good,d1]);
 if(d1&&d2)return{q:"Tap the character that quests for 2 or more lore.",choices:shuffle([mk(good),mk(d1),mk(d2)],seed),answerId:good.id,why:good.full+" has "+good.lore+" lore, shown by the lore diamond on the card.",card:good};
 const rq=ruleQ(l);return{q:rq.q,choices:null,options:optsFor(rq.a,rq.o),answer:rq.a,why:rq.w,card:c};
}
function makeSteps(l){
 const c=cardFor(l);
 const g1=boardTask(l,0), g2=boardTask(l,1), yt=boardTask(l,2), mc=makeMC(l,c); if(mc.answerId&&!mc.answer)mc.answer=mc.answerId;
 return [
  {k:"board",phase:"Guided walkthrough",guide:true,...g1,card:g1.focus||c},
  {k:"board",phase:"Guided walkthrough",guide:true,...g2,card:g2.focus||c},
  {k:"board",phase:"Your turn",guide:false,...yt,card:yt.focus||c},
  {k:"practice",phase:"Mini challenge",topic:l.topic,tag:l.tag,card:c},
  {k:"mc",phase:"Quick check",...mc}
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
 let h=`<div class="lbar"><button class="lbtn" data-act="close">${ICO.back}<span>Close</span></button><div class="ltitle">LEARN</div><div class="lstats"><span class="lstat" data-testid="xp">${ICO.star}<b>${P.xp} XP</b></span><span class="lstat">${ICO.flame}<b>${P.streak}</b></span></div></div>
 <div class="lhero"><b>${doneN}/${f.length} lessons</b><span>${pct}%</span><div class="lprog"><i style="width:${pct}%"></i></div><p>Example cards from sets 9-13.</p></div><div class="lpath">`;
 D.chapters.forEach((ch,chi)=>{
  h+=`<div class="lchap" style="--ch:${esc(ch.color)}"><h2>Chapter ${chi+1}: ${esc(ch.title)}</h2><p>${esc(ch.desc)}</p></div>`;
  ch.lessons.forEach((l,li)=>{
   const idx=f.findIndex(x=>x.l.id===l.id), dn=isDone(l.id), un=unlocked(idx), curL=idx===ci;
   const side=(li%2===0)?"left":"right";
   const status=dn?`${ICO.check}<span>Done</span>`:un?`${ICO.star}<span>${l.xp} XP</span>`:`${ICO.lock}<span>Locked</span>`;
   h+=`<div class="lnode ${side}"><button class="ln ${dn?"done":""} ${un?"":"lock"} ${curL?"cur":""} ${l.test?"trophy":""}" data-act="${un?"lesson":"locked"}" data-id="${esc(l.id)}" ${un?"":"aria-disabled=true"} aria-label="${esc(l.title)}"><span class="ln-ic">${dn?ICO.check:iconFor(l)}</span><span class="ln-t">${esc(shortTitle(l))}</span><small>${status}</small></button></div>`;
   if(li===3){const cid=ch.id, claimed=!!P.chests[cid], can=ch.lessons.slice(0,4).every(x=>isDone(x.id));
    h+=`<div class="lnode mid"><button class="ln chest ${claimed?"done":""} ${can||claimed?"":"lock"}" data-act="${claimed?"chestdone":can?"chest":"locked"}" data-id="${esc(cid)}" aria-label="Bonus Chest"><span class="ln-ic">${claimed?ICO.check:ICO.chest}</span><span class="ln-t">Chest</span><small>${claimed?`${ICO.check}<span>Claimed</span>`:can?`${ICO.star}<span>+20 XP</span>`:`${ICO.lock}<span>4 lessons</span>`}</small></button></div>`}
  });
 });
 h+=`</div>`;
 root.innerHTML=h;
 requestAnimationFrame(()=>{const el=root.querySelector(".ln.cur")||root.querySelector(".ln:not(.lock)");if(el)el.scrollIntoView({block:"center",behavior:"auto"})});
}
const thumb=u=>u?String(u).replace(/\/(normal|large)\//,"/small/"):u;
function cardImg(c,cls){return c&&c.img?`<img class="${cls||""}" src="${esc(thumb(c.img))}" alt="${esc(c.full)}" loading="lazy" decoding="async">`:""}
function lorePips(n){let h="";for(let i=1;i<=20;i++)h+=`<i class="${i<=n?"on":""}"></i>`;return h}
function parseHud(hud){const t=String(hud||"");const num=(re,d)=>{const m=t.match(re);return m?+m[1]:d};
 return{me:num(/Your lore (\d+)/,6),opp:num(/Rival lore (\d+)/,7),ink:num(/Inkwell: (\d+)/,3),readyInk:num(/Ready ink: (\d+)/,3)}}
function hudHTML(label,lore,inkReady,inkTotal,deckN,discN,handN){
 return`<div class="hud"><div class="loretrk"><b>${lore}</b><div><span>${esc(label)}</span><div class="pips">${lorePips(lore)}</div></div></div><div class="chips"><div class="chip ink pile">${ICO.ink}<b>${inkReady}<small>/${inkTotal}</small></b></div><div class="chip pile">${ICO.deck}<b>${deckN}</b></div><div class="chip pile disc">${ICO.disc}<b>${discN}</b></div><div class="chip pile">${ICO.hand}<b>${handN}</b></div></div></div>`}
function spotHTML(sm,label){return`<div class="lspot ${sm?"sm":""}" aria-hidden="true">${ICO.lore}<span>${esc(label||"Empty spot")}</span></div>`}
function tileHTML(x,guideId,act,extra){
 const c=x.card,ex=/Exerted/.test(x.state),dry=/Just played|Wet|Drying/.test(x.state),loc=c.type==="location";
 const stats=c.type==="character"?`<span class="stats"><b>${c.str}</b><i>${c.wil}</i></span>`:loc?`<span class="stats"><i>${c.wil}</i></span>`:"";
 return`<button class="lbcard ct ${loc?"sm":"lg"} ${ex?"ex":""} ${guideId&&x.id===guideId?"guide":""}" data-act="${act||"board"}" data-v="${esc(extra||x.id)}" aria-label="${esc(x.role)}: ${esc(c.full)}, ${esc(x.state)}"><span class="art">${cardImg(c)}</span>${dry?`<span class="dry">DRYING</span>`:""}${stats}<span class="lrole">${esc(x.role)}</span></button>`}
function zoneHTML(cards,guideId,act,who){
 const chars=cards.filter(x=>x.card.type!=="location"&&x.card.type!=="item");
 const strip=cards.filter(x=>x.card.type==="location"||x.card.type==="item");
 const row=`<div class="row chars">${chars.length?chars.map(x=>tileHTML(x,guideId,act)).join(""):spotHTML(false,"No characters")+spotHTML(false,"Empty spot")}</div>`;
 const stripH=`<div class="strip">${strip.length?strip.map(x=>tileHTML(x,guideId,act)).join(""):`<span class="zempty">No items or locations</span>`}</div>`;
 return who==="opp"?`<div class="zone z1">${row}${stripH}</div>`:`<div class="zone z0">${stripH}${row}</div>`}
function handHTML(cards,guideId,act){
 if(!cards.length)return`<div class="handwrap"><div class="hand2"><span class="handempty">Hand empty</span><div class="lback" aria-hidden="true"></div><div class="lback" aria-hidden="true"></div></div></div>`;
 return`<div class="handwrap"><div class="hand2">${cards.map(x=>{const c=x.card;return`<button class="lbcard hc ${guideId&&x.id===guideId?"guide":""}" data-act="${act||"board"}" data-v="${esc(x.id)}" aria-label="In hand: ${esc(c.full)}">${cardImg(c)}<span class="mcost">${c.cost}</span>${c.inkable?`<span class="inkable" title="Inkable"></span>`:""}</button>`}).join("")}</div></div>`}
function boardHTML(st){
 const nums=parseHud(st.hud);
 const opp=st.cards.filter(x=>x.role==="Rival"), hand=st.cards.filter(x=>x.role==="Hand");
 const mine=st.cards.filter(x=>x.role!=="Rival"&&x.role!=="Hand");
 return`<div class="lgb gb">${hudHTML("RIVAL LORE",nums.opp,nums.ink,Math.max(nums.ink,3),12,0,4)}
 ${zoneHTML(opp,st.guide?st.answerId:null,"board","opp")}
 <div class="banner mine"><div><b>${esc(st.q)}</b><small>${st.guide?"Follow the gold ring":"Your call - no ring"}</small></div></div>
 ${zoneHTML(mine,st.guide?st.answerId:null,"board","me")}
 ${hudHTML("YOUR LORE",nums.me,nums.readyInk,Math.max(nums.readyInk,nums.ink,3),12,1,hand.length||3)}
 ${handHTML(hand,st.guide?st.answerId:null,"board")}</div>`}
function teachHTML(st,l){
 const c=st.card||cardFor(l);
 return`<div class="lteach">${cardImg(c,"lteach-img")}<div><div class="lphase">${esc(st.phase)}</div><p>${esc(oneLine(l.desc||teachText(l)))}</p></div></div>`}
function renderStep(){
 const l=cur.l, st=steps[si];answered=false;
 let body="";
 if(st.k==="mc"&&st.choices){body=`<div class="lphase">${esc(st.phase)}</div><p class="lq">${esc(st.q)}</p><div class="lchoices">${st.choices.map(c=>`<button class="lopt lchoice" data-act="answer" data-v="${esc(c.id)}">${cardImg(c)}<span>${esc(c.name)}</span><small>${esc(c.version||c.type)} - Cost ${c.cost}</small></button>`).join("")}</div><div class="lfeed" hidden></div>`}
 else if(st.k==="mc"){body=`<div class="lphase">${esc(st.phase)}</div>${teachHTML(st,l)}<p class="lq">${esc(st.q)}</p><div class="lopts">${st.options.map(o=>`<button class="lopt" data-act="answer" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div><div class="lfeed" hidden></div>`}
 else if(st.k==="board"){body=`${teachHTML(st,l)}${boardHTML(st)}<div class="lfeed" hidden></div>`}
 else if(st.k==="practice"){practice=buildPractice(st.topic,st.tag,st.card);
   practiceRole=practice?(practice.action.t==="challenge"?"theirs":practice.action.t==="quest"?"mine":"hand"):null;
   if(practice){const me=practice.st.players[0],op=practice.st.players[1];
    const mineX={card:practice.mine.card,role:"Yours",state:"Dry - Ready",id:"mine"}, theirsX={card:practice.theirs.card,role:"Rival",state:"Exerted",id:"theirs"};
    const handX={card:practice.handCard.card,role:"In hand",state:"In hand",id:"hand"};
    body=`${teachHTML(st,l)}<div class="lgb gb">${hudHTML("RIVAL LORE",op.lore,op.ink.filter(x=>!x.exerted).length,op.ink.length,op.deck.length,op.discard.length,op.hand.length)}
    ${zoneHTML([theirsX],null,"pcard","opp")}
    <div class="banner mine"><div><b>${esc(practice.goal)}</b><small>Real engine board - tap the right card</small></div></div>
    ${zoneHTML([mineX],null,"pcard","me")}
    ${hudHTML("YOUR LORE",me.lore,me.ink.filter(x=>!x.exerted).length,me.ink.length,me.deck.length,me.discard.length,me.hand.length)}
    <div class="handwrap"><div class="hand2"><button class="lbcard hc" data-act="pcard" data-v="hand" aria-label="In hand: ${esc(handX.card.full)}">${cardImg(handX.card)}<span class="mcost">${handX.card.cost}</span>${handX.card.inkable?`<span class="inkable" title="Inkable"></span>`:""}</button></div></div></div><div class="lfeed" hidden></div>`}
   else{body=`<div class="lphase">Mini challenge</div><div class="lbanner">Tap your ready character to quest.</div><button class="lgo" data-act="practiceFallback">Quest</button><div class="lfeed" hidden></div>`}}
 root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="back">${ICO.back}<span>Back</span></button><div class="ltitle">${esc(shortTitle(l))}</div><div class="lstats"><span class="lstat">${ICO.star}<b>${si+1}/${steps.length}</b></span></div></div><div class="lprog thin"><i style="width:${Math.round(100*si/steps.length)}%"></i></div><main class="llesson">${body}</main>`;
}
let practiceRole=null;
function feedback(ok,why,retry){
 const f=root.querySelector(".lfeed");if(f){f.hidden=false;f.className="lfeed "+(ok?"ok":"bad");f.innerHTML=`<b class="lfeed-h">${ok?ICO.check:ICO.x}<span>${ok?"Correct - board updated":"Not quite - try again"}</span></b><p>${esc(why)}</p>${ok||!retry?`<button class="lgo" data-act="next">Continue</button>`:`<p><b>Tap another card.</b></p>`}`}
 if(ok){score++;answered=true;if(window.FX&&FX.at)try{FX.at(root.querySelector(".lbcard.guide,.lbcard"),{n:14})}catch(e){}
   root.querySelectorAll(".lopt,.lbcard").forEach(b=>b.disabled=true);}
}
function finish(){
 const l=cur.l, first=!isDone(l.id);
 if(first){P.done[l.id]=Date.now();P.xp+=l.xp;touchStreak();save()}
 const total=flat().length, doneN=flat().filter(x=>isDone(x.l.id)).length;
 root.innerHTML=`<div class="lbar"><button class="lbtn" data-act="back">${ICO.back}<span>Path</span></button><div class="ltitle">Lesson complete</div></div><main class="llesson center"><div class="lbig">${ICO.trophy}</div><h2>${esc(l.title)}</h2><p class="ltext">${first?("+"+l.xp+" XP · Score "+score+"/"+steps.length):"Already completed - good practice."}</p><p class="ltext">${doneN}/${total} lessons done · ${P.xp} XP · ${P.streak} day streak${P.sparkle?" · Sparkle cosmetic on":""}</p><button class="lgo" data-act="back">Back to path</button></main>`;
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
