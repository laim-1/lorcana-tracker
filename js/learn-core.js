/* Learn core: builds hand-authored lesson boards as REAL LorcanaEngine states, resolves scripted
   moves to engine actions (checked with E.isLegal / applied with E.act), evaluates goals, and
   (in Node) brute-forces puzzles. Shared by js/learn.js (browser) and tools/validate-learn.js. */
(function(root){
"use strict";
function mkCtx(E,cards,alias){const byFull=new Map();for(const c of cards)if(!byFull.has(c.full))byFull.set(c.full,c);
 const card=k=>{const full=alias[k]||k;const c=byFull.get(full);if(!c)throw new Error("Learn card missing: "+full);return c};
 return{E,cards,alias,byFull,card,filler:card("FILL")}}
/* setup: {turn, me:{lore,ink,inkEx,hand,play,deck,discard}, opp:{...}}; play entries "KEY" or {c:"KEY",ex,wet,dmg,at:"KEY"} */
function build(ctx,setup){const E=ctx.E,F=ctx.filler;
 const st=E.newGame({decks:[Array(30).fill(F),Array(30).fill(F)],names:["You","Rival"],first:0,seed:7,human:[false,false]});
 E.mulligan(st,0,[]);E.mulligan(st,1,[]);
 st.turnNo=setup.turn||3;st.active=0;st.phase="main";st.pending=null;st.pq=[];st.winner=null;st.log=[];
 const fresh=(card,owner)=>({uid:st.uid++,card,owner,damage:0,exerted:false,playedOn:0,tStr:0,lStr:0,tLore:0,tChal:0,noQuest:false,noReady:false,at:null,under:[],grants:[]});
 [setup.me||{},setup.opp||{}].forEach((S,pi)=>{const p=st.players[pi];p.inked=!!S.inked;p.inkN=S.inked?1:0;p.lore=S.lore||0;
  p.hand=(S.hand||[]).map(k=>fresh(ctx.card(k),pi));
  for(let i=0;i<(S.handN||0);i++)p.hand.push(fresh(F,pi));
  p.ink=[];for(let i=0;i<(S.ink||0);i++)p.ink.push(fresh(F,pi));for(let i=0;i<(S.inkEx||0);i++){const x=fresh(F,pi);x.exerted=true;p.ink.push(x)}
  p.deck=[];for(let i=0;i<(S.deck==null?20:S.deck);i++)p.deck.push(fresh(F,pi));
  if(S.top)p.deck.push(...S.top.map(k=>fresh(ctx.card(k),pi)));
  p.discard=(S.discard||[]).map(k=>fresh(ctx.card(k),pi));
  p.play=[];const locs={};
  for(const e of (S.play||[])){const o=typeof e==="string"?{c:e}:e;const x=fresh(ctx.card(o.c),pi);x.exerted=!!o.ex;x.damage=o.dmg||0;x.playedOn=o.wet?st.turnNo:0;x._key=o.c;p.play.push(x);if(x.card.type==="location")locs[o.c]=x}
  p.play.forEach((x,i)=>{const o=(S.play||[])[i];if(o&&typeof o==="object"&&o.at)x.at=locs[o.at].uid});
  p.hand.forEach((x,i)=>x._key=(S.hand||[])[i]);});
 st._learn=true;return st}
function findKey(ctx,st,pi,key,zones){const full=(ctx.alias[key]||key);for(const z of zones||["hand","play","discard"]){const x=st.players[pi][z].find(y=>y.card.full===full);if(x)return x}return null}
/* ref: {t, c, target, tside:"me"|"opp", singer, singers:[..], shift, loc, exerted, i} */
function resolve(ctx,st,ref){const a={t:ref.t};
 if(ref.t==="end")return a;
 const src=findKey(ctx,st,0,ref.c,ref.t==="ink"||ref.t==="play"?["hand"]:["play","hand"]);if(!src)return null;a.uid=src.uid;
 if(ref.target){const x=findKey(ctx,st,ref.tside==="me"?0:1,ref.target,["play"]);if(!x)return null;a.target=x.uid}
 if(ref.singer){const x=findKey(ctx,st,0,ref.singer,["play"]);if(!x)return null;a.singer=x.uid}
 if(ref.singers){const xs=ref.singers.map(k=>findKey(ctx,st,0,k,["play"]));if(xs.some(x=>!x))return null;a.singers=xs.map(x=>x.uid).join(",")}
 if(ref.shift){const x=findKey(ctx,st,0,ref.shift,["play"]);if(!x)return null;a.shift=x.uid}
 if(ref.loc){const x=findKey(ctx,st,0,ref.loc,["play"]);if(!x)return null;a.loc=x.uid}
 if(ref.exerted)a.exerted=true;if(ref.i!=null)a.i=ref.i;
 /* engine may attach a target to play/act (withTargets); adopt the unique legal variant */
 const L=ctx.E.legalActions(st).filter(b=>b.t===a.t&&b.uid===a.uid&&(a.target==null||b.target===a.target)&&(b.singer??null)===(a.singer??null)&&(b.singers??null)===(a.singers??null)&&(b.shift??null)===(a.shift??null)&&(b.loc??null)===(a.loc??null)&&!!b.exerted===!!a.exerted&&(a.i==null||b.i===a.i)&&!b.decline&&(b.mode??null)===(ref.mode??null));
 if(L.length===1)return L[0];if(L.length>1&&a.target!=null)return L[0];
 return L.length?L[0]:a}
const same=(a,b)=>a&&b&&a.t===b.t&&(a.uid??null)===(b.uid??null)&&(a.target??null)===(b.target??null)&&(a.singer??null)===(b.singer??null)&&(a.singers??null)===(b.singers??null)&&(a.shift??null)===(b.shift??null)&&(a.loc??null)===(b.loc??null)&&!!a.exerted===!!b.exerted&&(a.i??null)===(b.i??null);
function oppMax(st){const o=st.players[1],E=root.LorcanaEngine||NODE_E;let n=o.lore;for(const x of o.play){if(x.card.type==="location")n+=E.loreOf(x)||0;else if(x.card.type==="character"&&!x.card.kw.reckless)n+=E.loreOf(x)||0}return n}
let NODE_E=null;
/* goal: "&"-joined tokens */
function cloneSt(ctx,st){const E=ctx.E,ZK=new Set(["deck","hand","ink","play","discard"]);const s=E.thawState(E.freezeState(st),ctx.cards);s.human=[false,false];
 st.players.forEach((P,i)=>{for(const k in P)if(!ZK.has(k)&&!(k in s.players[i]&&k!=="disc"&&k!=="boosted"))s.players[i][k]=Array.isArray(P[k])?P[k].slice():P[k] instanceof Set?new Set(P[k]):P[k]});for(const k in st)if(!(k in s))s[k]=st[k];return s}
/* after this turn ends and the rival passes, can the goal be reached next turn? */
function nextTurn(ctx,st){if(st.winner!=null||st.pending)return null;const s=cloneSt(ctx,st);const E=ctx.E;if(!E.isLegal(s,{t:"end"}))return null;E.act(s,{t:"end"});if(s.winner!=null)return null;E.act(s,{t:"end"});return s.winner==null||s.winner===0?s:null}
function goalMet(ctx,st,goal,hist){NODE_E=ctx.E;const me=st.players[0];
 const toks=String(goal).split("&").map(t=>t.trim());const nx=toks.filter(t=>t.startsWith("next:")),now=toks.filter(t=>!t.startsWith("next:"));
 if(!now.every(tok=>tokMet(ctx,st,tok,hist)))return false;
 for(const t of nx){const s=nextTurn(ctx,st);if(!s)return false;const sub=t.slice(5).replace(/\|/g,"&");if(goalMet(ctx,s,sub,[]))continue;if(!solve(ctx,s,sub,4,4000).wins.length)return false}
 return true}
function tokMet(ctx,st,tok,hist){const me=st.players[0];
 return [tok].every(tok=>{let m;
  if(tok==="win")return st.winner===0;
  if((m=tok.match(/^lore>=(\d+)$/)))return me.lore>=+m[1];
  if((m=tok.match(/^opplore<=(\d+)$/)))return st.players[1].lore<=+m[1];
  if((m=tok.match(/^banish:(\w+)$/)))return !findKey(ctx,st,1,m[1],["play"]);
  if((m=tok.match(/^alive:(\w+)$/)))return !!findKey(ctx,st,0,m[1],["play"]);
  if((m=tok.match(/^inplay:(\w+)$/)))return !!findKey(ctx,st,0,m[1],["play"]);
  if((m=tok.match(/^oppMax<(\d+)$/)))return oppMax(st)<+m[1];
  if((m=tok.match(/^plays>=(\d+)$/)))return hist.filter(a=>a.t==="play").length>=+m[1];
  if(tok==="inked")return hist.some(a=>a.t==="ink");
  if((m=tok.match(/^hand>=(\d+)$/)))return me.hand.length>=+m[1];
  if(tok==="inkUsed")return me.ink.every(x=>x.exerted);
  if((m=tok.match(/^exerted:(\w+)$/))){const x=findKey(ctx,st,0,m[1],["play"]);return !!x&&x.exerted}
  if((m=tok.match(/^oppChars<=(\d+)$/)))return st.players[1].play.filter(x=>x.card.type==="character").length<=+m[1];
  if((m=tok.match(/^inkN>=(\d+)$/)))return me.ink.length>=+m[1];
  throw new Error("bad goal token "+tok)})}
/* Node-only brute force over every legal line (no 'end'): returns {wins, lines[], tried} */
function solve(ctx,st0,goal,maxDepth,limit){const E=ctx.E,pool=ctx.cards;let tried=0;const wins=[];const seen=new Set();
 const key=st=>JSON.stringify(st.players.map(p=>[p.lore,p.hand.map(x=>x.card.id).sort(),p.ink.map(x=>x.exerted).sort(),p.play.map(x=>[x.card.id,x.exerted,x.damage,x.at,x.tStr,x.under.length]),p.discard.length,p.inked]));
 const clone=st=>cloneSt(ctx,st);
 function rec(st,hist){if(tried++>(limit||200000))return;
  if(goalMet(ctx,st,goal,hist)){wins.push(hist.slice());return}
  if(hist.length>=maxDepth||st.winner!=null)return;const k=key(st)+"|"+hist.filter(a=>a.t==="play").length+hist.some(a=>a.t==="ink");if(seen.has(k))return;seen.add(k);
  for(const a of E.legalActions(st)){if(a.t==="end"||a.decline)continue;const s=clone(st);try{E.act(s,a)}catch(e){continue}
   while(s.pending){const L=E.legalActions(s);if(!L.length)break;E.act(s,L[0])}
   rec(s,hist.concat([{...a,_n:describe(st,a)}]))}}
 rec(clone(st0),[]);return{wins,tried}}
function describe(st,a){const nm=u=>{for(const p of st.players)for(const z of["hand","play","ink","discard"]){const x=p[z].find(y=>y.uid===u);if(x)return x.card.full}return"?"};
 return a.t+" "+(a.uid!=null?nm(a.uid):"")+(a.target!=null?" -> "+nm(a.target):"")+(a.singer!=null?" sung by "+nm(a.singer):"")+(a.shift!=null?" onto "+nm(a.shift):"")+(a.loc!=null?" to "+nm(a.loc):"")}
/* does an engine action satisfy a key ref (only the fields the ref names)? */
function matchRef(ctx,st,a,ref){if(a.t!==ref.t)return false;const u=(k,pi)=>{const x=findKey(ctx,st,pi,k,["hand","play","discard"]);return x&&x.uid};
 if(ref.c&&a.uid!==u(ref.c,0))return false;if(ref.target&&a.target!==u(ref.target,ref.tside==="me"?0:1))return false;if(ref.singer&&a.singer!==u(ref.singer,0))return false;
 if(ref.shift&&a.shift!==u(ref.shift,0))return false;if(ref.loc&&a.loc!==u(ref.loc,0))return false;if(ref.singers&&a.singers!==ref.singers.map(k=>u(k,0)).join(","))return false;if(ref.exerted&&!a.exerted)return false;return true}
const API={cloneSt,nextTurn,matchRef,mkCtx,build,resolve,same,goalMet,solve,findKey,oppMax,describe};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.LearnCore=API;
})(typeof window!=="undefined"?window:globalThis);
