/* Lorcana rules engine (v1). Pure JS, no DOM. Works in browser (window.LorcanaEngine) and Node (require). */
(function(root){
"use strict";
const NUMW={a:1,an:1,one:1,two:2,three:3,four:4,five:5};
const nw=s=>NUMW[s]!=null?NUMW[s]:parseInt(s,10);
const KW_SIMPLE=["bodyguard","evasive","rush","ward","reckless","support","vanish","alert"];

/* ---------- card text parsing ---------- */
function clean(t){return String(t||"").replace(/\([^)]*\)/g,"").replace(/\{S\}/g,"STR").replace(/\{W\}/g,"WIL").replace(/\{L\}/g,"LORE").replace(/\{I\}/g,"INK").replace(/[’]/g,"'").replace(/\s+/g," ").trim();}
function stripName(line){ // remove leading ALL-CAPS ability name
  let w=line.split(" "),i=0;
  while(i<w.length&&/^[A-Z0-9'!?,.&:\-–—]+$/.test(w[i])&&/[A-Z]/.test(w[i])&&w[i]!=="{E}"&&!(w[i]==="I"&&i>0&&w[i+1]&&/^[a-z]/.test(w[i+1]))) i++;
  if(i>0&&i<w.length&&/^[A-Z][a-z]|^\{E\}|^[0-9]/.test(w[i])) return w.slice(i).join(" ");
  return line;
}
const TGT="chosen (opposing )?(character|item|character or location)( of yours)?";
function parseOne(s){
  s=s.trim().replace(/\.$/,"").replace(/^then,? /i,"");const may=/^you may /i.test(s);s=s.replace(/^you may /i,"");const r=parseOne0(s);if(r&&may)r.may=true;return r}
const KINDS={"character":["character"],"item":["item"],"location":["location"],"character or location":["character","location"],"item or location":["item","location"],"character or item":["character","item"],"character, item, or location":["character","item","location"]};
function parseTarget(ph){ // e.g. "another chosen opposing damaged princess character of yours with cost 3 or less"
  const m=ph.match(/^(another )?chosen (opposing )?(damaged |exerted |ready |undamaged )?([a-z][a-z' -]*? )?(character, item, or location|character or location|item or location|character or item|character|item|location)( of yours)?(?: with (\d+) str or (less|more)| with cost (\d+) or less| named (.+?))?$/);
  if(!m)return null;if(m[4]&&KINDS[(m[4]+m[5]).trim()]){m[5]=(m[4]+m[5]).trim();m[4]=undefined}
  const t={opp:!!m[2],own:!!m[6],kinds:KINDS[m[5]],kind:m[5]==="character"?"char":m[5]==="item"?"item":"any",other:!!m[1]};
  if(m[3])t.state=m[3].trim();if(m[4]){const c=m[4].trim();if(c==="opposing")t.opp=true;else t.cls=c}
  if(m[7]){if(m[8]==="less")t.maxStr=+m[7];else t.minStr=+m[7]}if(m[9])t.maxCost=+m[9];if(m[10])t.name=m[10];
  t.helpful=t.own;return t}
const RIDE=/^(they|he|she|it) can't (quest|challenge|quest or challenge) for the rest of this turn$/;
function parseOne0(s){let l=s.toLowerCase().replace(/^if you do, /,"").trim();let m,t;
  if((m=l.match(/^(?:deal (\d+) damage to|put (\d+) damage counters? on) (.+)$/))&&(t=parseTarget(m[3])))return{k:"dmg",n:+(m[1]||m[2]),t,counters:!!m[2]};
  if((m=l.match(/^banish (.+)$/))&&(t=parseTarget(m[1])))return{k:"banish",t};
  if((m=l.match(/^exert (.+)$/))&&(t=parseTarget(m[1])))return{k:"exert",t};
  if((m=l.match(/^ready (.+)$/))&&(t=parseTarget(m[1]))){t.helpful=true;if(!t.opp)t.own=true;return{k:"ready",t}}
  if((m=l.match(/^return (.+?) to (?:their|its) player's hand$/))&&(t=parseTarget(m[1])))return{k:"bounce",t};
  if((m=l.match(/^return (.+?) to your hand$/))&&(t=parseTarget(m[1]))){t.own=true;t.helpful=true;return{k:"bounce",t}}
  if((m=l.match(/^remove up to (\d+) damage from (.+)$/))&&(t=parseTarget(m[2]))){t.helpful=true;return{k:"heal",n:+m[1],t}}
  if((m=l.match(/^remove up to (\d+) damage from one of your characters$/)))return{k:"heal",n:+m[1],t:{own:true,kind:"char",helpful:true}};
  if((m=l.match(/^(.+?) gets? ([+-])(\d+) (str|lore|wil) (this turn|until the start of your next turn)$/))&&(t=parseTarget(m[1]))){const n=+m[3]*(m[2]==="-"?-1:1);t.helpful=n>0&&!t.opp;
    if(m[4]==="str")return n<0?{k:"debuff",n:-n,long:m[5]!=="this turn",t}:{k:"buffStr",n,t};if(m[4]==="lore")return{k:"buffLore",n,t};return{k:"buffStr",n:0,t}}
  if((m=l.match(/^give (.+?) -(\d+) str (this turn|until the start of your next turn)$/))&&(t=parseTarget(m[1])))return{k:"debuff",n:+m[2],long:m[3]!=="this turn",t};
  if((m=l.match(/^(.+?) gains? (rush|evasive|support|ward|bodyguard|reckless|alert|resist \+\d+|challenger \+\d+) (this turn|until the start of your next turn|during their next turn)$/))&&(t=parseTarget(m[1]))){t.helpful=!t.opp&&m[2]!=="reckless";return{k:"grant",kw:m[2],long:m[3]!=="this turn",t}}
  if((m=l.match(/^(.+?) can't (quest|challenge) during their next turn$/))&&(t=parseTarget(m[1])))return{k:"noNext",what:m[2],t};
  if((m=l.match(/^(.+?) can't (quest|challenge|quest or challenge) for the rest of this turn$/))&&(t=parseTarget(m[1])))return{k:"noQuest",t,also:m[2]};
  if((m=l.match(/^put (.+?) into (?:its|their) player's inkwell facedown(?: and exerted)?$/))&&(t=parseTarget(m[1])))return{k:"toInk",t};
  if((m=l.match(/^put (.+?) into your inkwell facedown and exerted$/))&&(t=parseTarget(m[1]))){t.own=true;return{k:"toInk",t}}
  if((m=l.match(/^move (?:up to )?(\d+) damage(?: counters?)? from (.+?) to chosen opposing character$/))&&(t=parseTarget(m[2])))return{k:"moveDmg",n:+m[1],t:{...t,helpful:true}};
  if((m=l.match(/^shuffle (.+?) into their player's deck$/))&&(t=parseTarget(m[1].replace(/ card$/,""))))return{k:"shuffleIn",t};
  if((m=l.match(/^give (.+?) ([+-])(\d+) (str|lore) (this turn|until the start of your next turn)$/))&&parseTarget(m[1]))return parseOne0(m[1]+" gets "+m[2]+m[3]+" "+m[4]+" "+m[5]);
  if((m=l.match(/^give (.+?) (rush|evasive|ward|bodyguard|alert|resist \+\d+|challenger \+\d+) (this turn|until the start of your next turn)$/))&&parseTarget(m[1]))return parseOne0(m[1]+" gains "+m[2]+" "+m[3]);
  if((m=l.match(/^(.+?) gains (rush|evasive|ward|resist \+\d+|challenger \+\d+) and (rush|evasive|ward|resist \+\d+|challenger \+\d+) (this turn|until the start of your next turn)$/))&&(t=parseTarget(m[1]))){t.helpful=!t.opp;return{k:"grant",kw:m[2],kw2:m[3],long:m[4]!=="this turn",t}}
  if((m=l.match(/^(.+?) gets -(\d+) str and gains reckless (this turn|until the start of your next turn)$/))&&(t=parseTarget(m[1])))return{k:"debuff",n:+m[2],long:m[3]!=="this turn",t,reckless:true};
  if((m=l.match(/^your (other )?(?:([a-z]+) )?characters get \+(\d+) (lore|str) (this turn|until the start of your next turn)$/)))return{k:"teamBuff",other:!!m[1],cls:m[2]||null,stat:m[4],n:+m[3]};
  if((m=l.match(/^your (other )?(?:([a-z]+) )?characters gain (rush|evasive|ward|alert|resist \+\d+|challenger \+\d+) (this turn|until the start of your next turn)$/)))return{k:"teamGrant",other:!!m[1],cls:m[2]||null,kw:m[3],long:m[4]!=="this turn"};
  if((m=l.match(/^banish all opposing characters with (\d+) str or less$/)))return{k:"banishAllX",what:"opposing characters",maxStr:+m[1]};
  if((m=l.match(/^return (?:an?|up to (\d+)) (character|item|action|song|location) cards? with cost (\d+) or less(?: each)? from your discard to your hand$/)))return{k:"recur",type:m[2],max:+m[3],n:m[1]?+m[1]:1};
  if((m=l.match(/^if you have (?:a|an|another) ([a-z]+) character in play, (.+)$/))){const e=parseEffects(m[2]);if(e)return{k:"cond",hasCls:m[1],eff:e}}
  if((m=l.match(/^if you have a location in play, (.+)$/))){const e=parseEffects(m[1]);if(e)return{k:"cond",hasLoc:true,eff:e}}
  if((m=l.match(/^if you used shift to play (?:him|her|them), (.+)$/))){const e=parseEffects(m[1]);if(e)return{k:"cond",shifted:true,eff:e}}
  if((m=l.match(/^if you played another character this turn, (.+)$/))){const e=parseEffects(m[1]);if(e)return{k:"cond",playedOther:true,eff:e}}
  if((m=l.match(/^if there(?:'s| is) a card under (?:him|her|it|this character), (.+)$/))){const e=parseEffects(m[1]);if(e)return{k:"cond",under:true,eff:e}}
  if((m=l.match(/^if an opponent has an exerted character in play, (.+)$/))){const e=parseEffects(m[1]);if(e)return{k:"cond",oppExerted:true,eff:e}}
  if((m=l.match(/^ready one of your items$/)))return{k:"readyItem"};
  if((m=l.match(/^put all cards from under (?:him|her|it|this character) into your hand$/)))return{k:"underToHand"};
  if((m=l.match(/^(deal (\d+) damage to|exert|banish|ready|return) up to (\d+) chosen (.+?)( to (?:their|its) player's hand)?$/))&&(t=parseTarget("chosen "+m[4]))){const inner=parseOne0(m[1].replace(/ to$/," to")+" chosen "+m[4]+(m[5]||""));if(inner)return{k:"multi",n:+m[3],inner}}
  if((m=l.match(/^search your deck for an? (?:([a-z]+) )?(character|item|action|song|location) card(?: named (.+?))?(?: with cost (\d+) or less)?(?: and reveal that card to all players)?(?:\. (?:then, )?shuffle your deck and put that card on top of it|,? and put (?:it|that card) into your hand\. (?:then, )?shuffle your deck|\. put that card into your hand and shuffle your deck)$/)))return{k:"tutor",cls:m[1]||null,type:m[2],name:m[3]||null,max:m[4]?+m[4]:99,top:/on top/.test(l)};
  if((m=l.match(/^name a card, then reveal the top card of your deck\. if it's the named card, put (?:it|that card) into your (hand|inkwell facedown and exerted)\. otherwise, put it on the (top|bottom) of your deck$/)))return{k:"nameReveal",to:m[1].startsWith("hand")?"hand":"ink"};
  if((m=l.match(/^each player discards their hand and draws (\d+) cards$/)))return{k:"wheel",n:+m[1]};
  {const KWL="(?:rush|evasive|ward|bodyguard|reckless|alert|support|resist \\+\\d+|challenger \\+\\d+)";
   const re=new RegExp("^(.+?) (?:gets \\+(\\d+) (lore|str) and )?gains? ("+KWL+"(?:(?:,| and|, and) "+KWL+")*) (this turn|until the start of your next turn|during their next turn)$");
   if((m=l.match(re))&&(t=parseTarget(m[1]))){const kws=m[4].split(/,? and |, /).map(z=>z.trim()).filter(Boolean);const bad=kws.includes("reckless");t.helpful=!t.opp&&!bad;
     return{k:"grantMulti",kws,lore:m[3]==="lore"?+m[2]:0,str:m[3]==="str"?+m[2]:0,long:m[5]!=="this turn",t}}}
  if((m=l.match(/^each opponent chooses one of their characters and deals (\d+) damage to them$/)))return{k:"fn",v:+m[1]*2,f:(st,pi)=>oppPicks(st,pi,y=>damage(st,y,+m[1]))};
  if((m=l.match(/^deal (\d+) damage each to up to (\d+) chosen characters$/)))return{k:"multi",n:+m[2],inner:{k:"dmg",n:+m[1],t:{kind:"char"}}};
  if((m=l.match(/^deal (\d+) damage to each opposing (damaged )?character$/)))return{k:"fn",v:6,f:(st,pi)=>OWNCH(st,opp(pi)).filter(y=>!m[2]||y.damage).forEach(y=>damage(st,y,+m[1]))};
  if(RIDE.test(l)){const r=l.match(RIDE);return{k:"noQuest",rider:true,also:r[2]}}
  if((m=l.match(/^__reveal (\w+) (hand|play|playex)$/)))return{k:"reveal",type:m[1],to:m[2]};
  if((m=l.match(/^__digm (\d+) (\d+) (\w+)$/)))return{k:"dig",n:+m[1],take:+m[2],type:m[3]};
  if((m=l.match(/^play (?:an?|one) (character|item|action|song|location)( with cost (\d+) or less)? for free$/)))return{k:"free",type:m[1],max:m[3]!=null?+m[3]:99};
  if((m=l.match(/^play a character for free$/)))return{k:"free",type:"character",max:99};
  if((m=l.match(/^move a character of yours to a location for free$/)))return{k:"freeMove"};
  if((m=l.match(/^(?:you gain (\d+) lore and each opponent loses (\d+) lore|each opponent loses (\d+) lore and you gain (\d+) lore)$/)))return{k:"drain",g:+(m[1]||m[4]),lo:+(m[2]||m[3])};
  if((m=l.match(/^each opponent with more lore than you loses (\d+) lore$/)))return{k:"oppLose",n:+m[1],ifMore:true};
  if((m=l.match(/^each player may draw a card$/)))return{k:"drawAll",n:1};
  if((m=l.match(/^(exert|ready) all (opposing |your )?(damaged )?(characters|cards in your inkwell|items)$/)))return{k:"massState",to:m[1],who:(m[2]||"").trim()||(m[4].includes("inkwell")?"your":"all"),damaged:!!m[3],what:m[4]};
  if((m=l.match(/^ready (?:all )?your (other )?(?:([a-z]+) )?characters( with cost (\d+) or less)?$/)))return{k:"massReady",other:!!m[1],cls:m[2]&&m[2]!=="other"?m[2]:null,max:m[4]!=null?+m[4]:99};
  if((m=l.match(/^discard your hand$/)))return{k:"discardHand"};
  if((m=l.match(/^choose and discard (a|one|two|\d+) cards?$/)))return{k:"selfDiscard",n:nw(m[1])};
  if((m=l.match(/^put the top (card|\d+ cards) of your deck into your discard$/)))return{k:"mill",n:m[1]==="card"?1:parseInt(m[1])};
  if((m=l.match(/^banish all (items|characters|opposing characters|opposing items)$/)))return{k:"banishAllX",what:m[1]};
  if((m=l.match(/^return an? (character|item|action|song|location) card named (.+?) from your discard to your hand$/)))return{k:"recur",type:m[1],name:m[2]};
  if((m=l.match(/^chosen opponent reveals their hand and discards a non-character card of your choice$/)))return{k:"oppDiscard",n:1,nonChar:true};
  if((m=l.match(/^remove up to (\d+) damage from each of your ([a-z]+ )?characters$/)))return{k:"healAll",n:+m[1],cls:m[2]?m[2].trim():null};
  if((m=l.match(/^pay (\d+) ink to (.+)$/))){const e=parseOne(m[2]);if(e&&!e.t)return{k:"pay",n:+m[1],eff:[e]};if(e&&e.t)return{...e,payInk:+m[1]}}
  if((m=l.match(/^if an opponent has more cards in their (hand|inkwell) than you, (.+)$/))){const e=parseEffects(m[2]);if(e)return{k:"cond",oppMore:m[1],eff:e}}
  if((m=l.match(/^if you have no cards in your hand, (.+)$/))){const e=parseEffects(m[1]);if(e)return{k:"cond",emptyHand:true,eff:e}}
  if((m=l.match(/^if you played a song this turn, (.+)$/))){const e=parseEffects(m[1]);if(e)return{k:"cond",songThisTurn:true,eff:e}}
  if((m=l.match(/^put a character card from your discard into your inkwell facedown and exerted$/)))return{k:"discardToInk"};
  if((m=l.match(/^put (?:a|any) card from your hand into your inkwell facedown( and exerted)?$/)))return{k:"handToInk",exerted:!!m[1]};
  if((m=l.match(/^return this card to your hand$/)))return{k:"returnSelf"};
  if((m=l.match(/^put this card into your inkwell facedown and exerted$/)))return{k:"inkSelf"};
  if((m=l.match(/^you pay (\d+) ink less for the next (character|item|action|song|location) you play this turn$/)))return{k:"discount",n:+m[1],type:m[2]};
  if((m=l.match(/^banish all characters$/)))return{k:"banishAll"};
  if((m=l.match(/^each player puts the top (\d+) cards? of their deck into their inkwell facedown and exerted$/)))return{k:"rampAll",n:+m[1]};
  if((m=l.match(/^the challenging player chooses and discards (a|one) card$/)))return{k:"oppDiscard",n:1};
  if((m=l.match(/^__dig (\d+) (\w+)$/)))return{k:"dig",n:+m[1],type:m[2]};
  if(l==="__ramp")return{k:"ramp"};if(/^return that card to your hand$/.test(l))return{k:"fn",v:4,f:(st,pi)=>{const b=st._banished,P=st.players[pi];if(b&&P.discard.includes(b)){P.discard.splice(P.discard.indexOf(b),1);P.hand.push(b)}}};if(l==="__banishchallenger")return{k:"banishChallenger"};if(l==="__scry")return{k:"scry"};
  if((m=l.match(/^draw (a|an|one|two|three|four|\d+) cards?$/)))return{k:"draw",n:nw(m[1])};
  if((m=l.match(/^each player draws (a|one|two|three|\d+) cards?$/)))return{k:"drawAll",n:nw(m[1])};
  if((m=l.match(/^gain (\d+) lore$/)))return{k:"gainLore",n:+m[1]};
  if((m=l.match(/^each opponent loses (\d+) lore$/)))return{k:"oppLose",n:+m[1]};
  if((m=l.match(/^deal (\d+) damage to each opposing character$/)))return{k:"dmgAllOpp",n:+m[1]};
  if((m=l.match(/^deal (\d+) damage to chosen (opposing )?character( or location)?$/)))return{k:"dmg",n:+m[1],t:{opp:!!m[2],kind:"char"}};
  if((m=l.match(/^banish chosen (opposing )?character( with (\d+) str or less)?$/)))return{k:"banish",t:{opp:!!m[1],kind:"char",maxStr:m[3]!=null?+m[3]:null}};
  if((m=l.match(/^banish chosen (opposing )?item$/)))return{k:"banish",t:{opp:!!m[1],kind:"item"}};
  if((m=l.match(/^return chosen (opposing )?character( with cost (\d+) or less)? to (their|its) player's hand$/)))return{k:"bounce",t:{opp:!!m[1],kind:"char",maxCost:m[3]!=null?+m[3]:null}};
  if((m=l.match(/^remove up to (\d+) damage from chosen (character|character of yours)$/)))return{k:"heal",n:+m[1],t:{own:m[2]!=="character",kind:"char",helpful:true}};
  if((m=l.match(/^remove up to (\d+) damage from each of your characters$/)))return{k:"healAll",n:+m[1]};
  if((m=l.match(/^chosen (opposing )?character( of yours)? gets \+(\d+) str this turn$/)))return{k:"buffStr",n:+m[3],t:{opp:!!m[1],own:!!m[2],kind:"char",helpful:!m[1]}};
  if((m=l.match(/^exert chosen (opposing )?character$/)))return{k:"exert",t:{opp:!!m[1],kind:"char"}};
  if((m=l.match(/^ready chosen character( of yours)?$/)))return{k:"ready",t:{own:true,kind:"char",helpful:true}};
  const KWG="(rush|evasive|support|ward|bodyguard|reckless|alert|resist \\+\\d+|challenger \\+\\d+)";
  if((m=l.match(/^(?:this character|he|she|it|they) gets? \+(\d+) (str|lore|wil)( this turn)?$/)))return{k:"self",stat:m[2],n:+m[1]};
  if((m=l.match(/^(?:this character|he|she|it|they) gets? \+(\d+) str and \+(\d+) lore( this turn)?$/)))return{k:"self2",s:+m[1],l:+m[2]};
  if((m=l.match(/^ready this character$/)))return{k:"readySelf"};
  if((m=l.match(/^remove up to (\d+) damage from this character$/)))return{k:"healSelf",n:+m[1]};
  if((m=l.match(/^remove all damage from chosen character( of yours)?$/)))return{k:"heal",n:99,t:{own:!!m[1],kind:"char",helpful:true}};
  if((m=l.match(new RegExp("^chosen (opposing )?character( of yours)? gains "+KWG+" (this turn|until the start of your next turn|during their next turn)$"))))return{k:"grant",kw:m[3],long:m[4]!=="this turn",t:{opp:!!m[1],own:!!m[2],kind:"char",helpful:!m[1]&&m[3]!=="reckless"}};
  if((m=l.match(new RegExp("^(?:this character|he|she|it|they) gains? "+KWG+"( this turn)?$"))))return{k:"grantSelf",kw:m[1]};
  if((m=l.match(/^chosen (opposing |exerted )?character can't (quest|challenge) during their next turn$/)))return{k:"noNext",what:m[2],t:{opp:m[1]==="opposing ",kind:"char"}};
  if((m=l.match(/^chosen exerted character can't ready at the start of their next turn$/)))return{k:"noReady",t:{kind:"char",exerted:true}};
  if((m=l.match(/^put the top card of your deck into your inkwell facedown and exerted$/)))return{k:"ramp"};
  if((m=l.match(/^exert chosen (opposing )?character( with (\d+) str or less)?$/)))return{k:"exert",t:{opp:!!m[1],kind:"char",maxStr:m[3]!=null?+m[3]:null}};
  if((m=l.match(/^your (other )?characters get \+(\d+) (str|lore) this turn$/)))return{k:"team",stat:m[3],n:+m[2],other:!!m[1]};
  if((m=l.match(/^return chosen character, item, or location with cost (\d+) or less to (their|its) player's hand$/)))return{k:"bounce",t:{kind:"any",maxCost:+m[1]}};
  if((m=l.match(/^return chosen character of yours to your hand$/)))return{k:"bounce",t:{own:true,kind:"char",helpful:true}};
  if((m=l.match(/^return (?:an?|one) (character|item|action|song) card from your discard to your hand$/)))return{k:"recur",type:m[1]};
  if((m=l.match(/^chosen opponent chooses and discards (a|one|two|\d+) cards?$/)))return{k:"oppDiscard",n:nw(m[1])};
  if((m=l.match(/^each opponent chooses and exerts one of their ready characters$/)))return{k:"oppExert"};
  if((m=l.match(/^each opponent chooses and banishes one of their characters$/)))return{k:"oppBanish"};
  if((m=l.match(/^give chosen (opposing )?character -(\d+) str this turn$/)))return{k:"debuff",n:+m[2],t:{opp:!!m[1],kind:"char"}};
  if((m=l.match(/^you gain (\d+) lore$/)))return{k:"gainLore",n:+m[1]};
  if((m=l.match(/^pay (\d+) ink to draw a card$/)))return{k:"payDraw",n:+m[1]};
  if((m=l.match(/^banish this (character|item)$/)))return{k:"banishSelf"};
  if((m=l.match(/^deal (\d+) damage to this character$/)))return{k:"dmgSelf",n:+m[1]};
  if((m=l.match(/^choose and discard (a card|an? ([a-z]+) card) to (.+)$/))){const e=parseEffects(m[3]);if(e){const ty=m[2]||null;return{k:"discCost",ty,eff:e,may:true}}}
  if((m=l.match(/^return (?:an?|another|up to (\d+)) (?:([a-z]+) )?(character|item|action|song|location) cards?(?: that isn't a song card)?(?: with cost (\d+) or less)?(?: each)? from your discard to your hand$/)))return{k:"recur",cls:m[2]&&!/^(another)$/.test(m[2])?m[2]:null,type:m[3],max:m[4]!=null?+m[4]:null,n:m[1]?+m[1]:1};
  if((m=l.match(/^chosen opponent reveals their hand and discards an? (action|song|item|location|character|non-character) card of (?:your|their) choice$/)))return{k:"oppDiscard",n:1,ofType:m[1]};
  if((m=l.match(/^(?:chosen opponent|each opponent) discards a card at random$/)))return{k:"oppDiscard",n:1,random:true};
  if((m=l.match(/^put a card from chosen player's discard on the bottom of their deck$|^shuffle a card from chosen player's discard into their deck$/)))return{k:"gyHate"};
  if((m=l.match(/^if (?:there's|you have) an? (?:([a-z]+) )?(character|item|action|song|location) card(?: named (.+?))? in your discard, (.+)$/))){const e=parseEffects(m[4]);if(e)return{k:"cond",gy:{cls:m[1]||null,type:m[2],name:m[3]||null},eff:e}}
  if((m=l.match(/^draw (a|an|one|two|three|\d+) cards?,? then choose and discard (a|one|two|\d+) cards?$/)))return{k:"loot",n:nw(m[1]),d:nw(m[2])};
  if((m=l.match(/^chosen (opposing )?character gets -(\d+) str (this turn|until the start of your next turn)$/)))return{k:"debuff",n:+m[2],long:m[3]!=="this turn",t:{opp:!!m[1],kind:"char"}};
  if((m=l.match(/^deal (\d+) damage to chosen damaged (opposing )?character$/)))return{k:"dmg",n:+m[1],t:{opp:!!m[2],kind:"char",damaged:true}};
  if((m=l.match(/^chosen character( of yours)? gets \+(\d+) lore this turn$/)))return{k:"buffLore",n:+m[2],t:{own:true,kind:"char",helpful:true}};
  if((m=l.match(/^chosen character( of yours)? gains challenger \+(\d+) this turn$/)))return{k:"buffChal",n:+m[2],t:{own:true,kind:"char",helpful:true}};
  if((m=l.match(/^each opponent chooses and discards (a|one|two|\d+) cards?$/)))return{k:"oppDiscard",n:nw(m[1])};
  if((m=l.match(/^return a character card from your discard to your hand$/)))return{k:"recur"};
  if((m=l.match(/^chosen opposing character can't ready at the start of their next turn$/)))return{k:"noReady",t:{opp:true,kind:"char"}};
  if((m=l.match(/^(they|he|she|it) can't quest for the rest of this turn$/)))return{k:"noQuest",rider:true};
  if((m=l.match(/^(they|he|she|it) can't ready at the start of their next turn$/)))return{k:"noReady",rider:true};
  return null;
}
function preDig(t){
  return t.replace(/look at the top (\d+) cards of your deck\. you may reveal an? (character|item|action|song|location) card and put it into your hand\. put the rest on the bottom of your deck in any order/gi,"__dig $1 $2")
   .replace(/look at the top (\d+) cards of your deck\. put one into your hand and the (?:rest|other) on the bottom of (?:your|the) deck(?: in any order)?/gi,"__dig $1 any")
   .replace(/look at the top 2 cards of your deck\. put one into your hand and the other into your inkwell facedown and exerted/gi,"__dig 2 any. __ramp")
   .replace(/look at the top (\d+) cards of your deck\. put them back on the top of your deck in any order/gi,"__scry")
   .replace(/look at the top card of your deck\. put it on either the top or the bottom of your deck/gi,"__scry")
   .replace(/look at the top (\d+) cards of your deck and put them back in any order/gi,"__scry")
   .replace(/look at the top (\d+) cards of your deck\. put (?:one on the top of your deck and the other on the bottom|any number of them on the top or the bottom of your deck in any order|them back on the top of your deck in any order)/gi,"__scry")
   .replace(/look at the top (\d+) cards of your deck\. you may reveal up to (\d+) (character|item|action|song|location) cards and put them into your hand\. put the rest on the bottom of your deck in any order/gi,"__digm $1 $2 $3")
   .replace(/look at the top (\d+) cards of your deck\. you may reveal an? (character|item|action|song|location) card (?:with cost \d+ or less )?and put it into your hand\. put the rest on the bottom of your deck in any order/gi,"__dig $1 $2")
   .replace(/look at the top (\d+) cards of your deck\. you may (?:reveal any card and )?put one into your hand\. put the rest on the bottom of your deck in any order/gi,"__dig $1 any")
   .replace(/reveal the top card of your deck\. if it's an? (character|item|action|song|location) card(?: with cost \d+ or less)?, (?:you may )?put (?:it|that card) into your hand\. otherwise, put it on the (?:top|bottom) of your deck/gi,"__reveal $1 hand")
   .replace(/reveal the top card of your deck\. if it's an? (character|item|action|song|location) card(?: with cost \d+ or less)?, you may play (?:it|that \w+) for free( and they enter play exerted)?\. otherwise, put it on the (?:top|bottom) of your deck/gi,(m,a,b)=>"__reveal "+a+(b?" playex":" play"));
}
function parseEffects(txt){
  txt=preDig(txt);let m;
  txt=txt.replace(/(choose one(?: of the following)?:)\s*[-*]\s+/i,"$1 • ").replace(/\s+[-*]\s+(?=[A-Z])/g," • ").replace(/choose one of the following:/i,"choose one:");
  if((m=txt.match(/^(?:you may )?choose one:\s*•\s*(.+)$/i))){const raw=m[1].split(/\s*•\s*/),opts=raw.map(o=>parseEffects(o));if(opts.every(Boolean))return[{k:"modal",opts,optText:raw.map(x=>x.replace(/\.$/,""))}];return null}
  if((m=txt.match(/^if you have a character named ([^,]+?) in play, (.+)$/i))){const e=parseEffects(m[2]);return e?[{k:"cond",name:m[1],eff:e}]:null}
  if((m=txt.match(/^if you have (\d+) or more other characters in play, (.+)$/i))){const e=parseEffects(m[2]);return e?[{k:"cond",count:+m[1],eff:e}]:null}
  const parts=txt.replace(/\.\s*$/,"").split(/\.\s+|,? then,? (?=[a-z])(?!choose and discard)|;\s*/i).filter(Boolean);if(!parts.length)return null;
  const out=[];for(const p of parts){const e=parseOne(p);if(!e)return null;out.push(e)}
  if(out.filter(e=>e.t).length>1)return null; // only one chosen target per ability in v1
  return out;
}
function onceTrig(c,when,e){when=when.toLowerCase();
  if(/^a card is put into your inkwell$/.test(when)){c.onInk.push(...e);c.onInkOnce=true;return true}
  if(/^this character quests$/.test(when)){c.onQuest.push(...e);return true}
  if(/^you play (a|an) (song|item|character|action|location)$/.test(when)){c.onYouPlay.push({type:when.split(" ").pop(),eff:e,once:true});return true}
  if(/^one of your (?:other )?characters quests$/.test(when)){c.onAllyQuest.push({eff:e,once:true});return true}
  return false}
const DEFS_EXTRA={};
// ---------- per-card definitions (cards whose wording the generic parser can't express) ----------
const T_=(o)=>Object.assign({kind:"char"},o);
const FN=(f,v,t,extra)=>Object.assign({k:"fn",f,v:v??2},t?{t}:{},extra||{});
const DH={P:s=>parseEffects(s)};

/* ---------- player choices: every choice for a human player goes through CH (bottom-sheet picker in the UI); the AI picks via opts.ai ---------- */
const by=f=>(list,n)=>list.slice().sort((a,b)=>f(b)-f(a))/*nc:ai-order*/.slice(0,n);
function humanAsk(st,pi){return!!(st&&st.human&&st.human[pi])&&!st._sim}
function queueP(st,P){if(st.pending)(st.pq=st.pq||[]).push(P);else st.pending=P}
function srcCardOf(st){const f=st._src!=null?find(st,st._src):null;return f?f.inst.card:(st._srcCard||null)}
function srcLabel(st){const f=st._src!=null?find(st,st._src):null;return f?f.inst.card.full:(st._srcName||"")}
// CH(st, chooser, list, cont(picks, first), {n, min, optional, prompt, ai(list,n)->picks, label(x)->string, reveal})
function CH(st,pi,list,cont,o={}){list=(list||[]).filter(x=>x!=null);
  const n=Math.min(o.n??1,list.length),min=o.optional?0:Math.min(o.min??n,list.length);
  if(o.reveal){if(humanAsk(st,pi)&&list.length)queueP(st,{pi,kind:"ask",reveal:true,items:list,opts:list.map(optOf(o)),n:0,min:0,sel:[],why:o.prompt||"Revealed cards",src:o.src||srcLabel(st),srcCard:srcCardOf(st)});if(cont)cont(list,list[0]);return}
  if(!list.length){if(o.empty)cont([],undefined);return}
  const run=(picks)=>cont(picks,picks[0]);
  if(!humanAsk(st,pi)){const pk=(o.ai||by(x=>x&&x.card?x.card.cost:0))(list,n);if(pk.length||o.empty||o.optional)run(pk.slice(0,Math.max(n,pk.length)));return}
  if(list.length<=min&&!o.always){run(list.slice());return}
  const ctx=st._ctx,srcUid=st._src;
  queueP(st,{pi,kind:"ask",zones:list.map(x=>x&&x.card&&x.uid!=null?(find(st,x.uid)||{}).zone:null),items:list,opts:list.map(optOf(o)).concat((o.extra||[]).filter(x=>!list.includes(x)).map(x=>({...optOf(o)(x),dis:true}))),n,min,sel:[],why:o.prompt||"Make a choice",src:o.src||srcLabel(st),srcCard:o.srcCard||srcCardOf(st),cont:(picks)=>{const c0=st._ctx,s0=st._src;st._ctx=ctx;st._src=srcUid;try{run(picks)}finally{if(st._ctx===ctx)st._ctx=c0;st._src=s0}}})}
const optOf=o=>x=>x&&x.card?{uid:x.uid,card:x.card,owner:x.owner,label:o.label?o.label(x):null,zone:null}:{label:String(x&&x.label!=null?x.label:x)};
const srt=cmp=>(l,n)=>l.slice().sort(cmp)/*nc:ai-order*/.slice(0,n);
const PKs=(st,pi,list,f,o)=>CH(st,pi,list,(p,c)=>f(c),{...o,empty:true});
const UPTO=(st,pi,list,n,f,prompt,cmp,min=0)=>CH(st,pi,list,ps=>ps.forEach(f),{n,min,always:min<Math.min(n,list.length),prompt,ai:srt(cmp)});
const healStep=(st,pi,left,done,tot=0)=>{if(left<=0||noHeal(st))return done(tot);CH(st,pi,OWNCH(st,pi).filter(y=>y.damage),(p,y)=>{if(!y)return done(tot);y.damage--;healStep(st,pi,left-1,done,tot+1)},{optional:true,always:true,prompt:`remove 1 damage from which character? (${left} left; skip to stop)`,ai:l=>{const y=l.slice().sort((a,b)=>b.damage-a.damage)/*nc:ai-order*/[0];return y?[y]:[]}})};
const revealHand=(st,viewer,q,why)=>{const H=st.players[q].hand;log(st,`${st.players[q].name} reveal${q===0?"":"s"} their hand (${H.length} cards).`);if(humanAsk(st,viewer)&&viewer!==q)CH(st,viewer,H.slice(),null,{reveal:true,prompt:why||`${st.players[q].name}'s hand`})};
const YN=(st,pi,prompt,yes,no,ai)=>CH(st,pi,[{label:"Yes",v:1},{label:"No",v:0}],(p,c)=>{if(c&&c.v)yes();else if(no)no()},{prompt,ai:ai?(l=>[l[ai()?0:1]]):(l=>[l[0]])});
function finishAsk(st){const P=st.pending;st.pending=null;const picks=P.sel.map(i=>P.items[i]).filter((x,k)=>{if(!x||!x.card||!P.zones||!P.zones[P.sel[k]])return true;const f=find(st,x.uid);return f&&f.zone===P.zones[P.sel[k]]});if(P.cont)P.cont(picks);if(!st.pending&&st.pq&&st.pq.length)st.pending=st.pq.shift()}
// discard n cards from player q's hand (q chooses); byOpp = forced by the other player
function discPick(st,q,n,o={}){const P=st.players[q];if(!P.hand.length||n<=0)return;const list=o.test?P.hand.filter(o.test):P.hand.slice();
  CH(st,q,list,picks=>{let k=0;for(const y of picks){if(!P.hand.includes(y))continue;P.hand.splice(P.hand.indexOf(y),1);P.discard.push(y);k++;log(st,`${P.name} discards ${y.card.full}.`);fire(st,q,"onSelfDiscard",y)}if(k&&o.byOpp)fire(st,opp(q),"onOppDiscard",k);if(o.then)o.then(picks)},{n,prompt:o.prompt||(o.byOpp?`Your opponent makes you discard ${n>1?n+" cards":"a card"}`:`Choose ${n>1?n+" cards":"a card"} to discard`),ai:o.ai||by(x=>discardPri(x)),src:o.src})}
// a trigger / ability with possible targets, "you may", or choose-one: the human chooses
function sub(st,pi,effs,tgt,src,fa){if(tgt!=null&&needsTarget(effs))return resolve(st,pi,effs,tgt,src,fa);trig(st,pi,effs,src,fa)}
function trig(st,pi,h,src,fa){if(!h||!h.length)return;if(!humanAsk(st,pi))return resolve(st,pi,h,autoTarget(st,pi,h),src,fa);
  const ctx=st._ctx,nm=src?src.card.full:"",go=(tgt,dec)=>{const d0=st._decline,c0=st._ctx;st._ctx=ctx;st._decline=!!dec;try{resolve(st,pi,h,tgt,src,fa)}finally{st._decline=d0;st._ctx=c0}};
  const may=h.some(e=>e.may&&e.k!=="modal");if(src)st._src=src.uid;const nt=needsTarget(h);
  if(nt){const ts=targets(st,pi,nt.t).map(u=>find(st,u).inst);if(!ts.length)return go(null,false);
    if(ts.length===1&&!may)return go(ts[0].uid,false);
    return CH(st,pi,ts,(p,c)=>c?go(c.uid,false):go(null,true),{srcCard:src?src.card:null,optional:may,always:may,prompt:`${nm}: choose ${nt.t.opp?"an opposing":nt.t.own?"one of your":"a"} ${nt.t.kind==="item"?"item":nt.t.kinds&&nt.t.kinds.includes("location")&&nt.t.kinds.length===1?"location":"character"}${may?" (or skip)":""}`,src:nm})}
  if(may)return CH(st,pi,[{label:"Yes",v:1},{label:"No",v:0}],(p,c)=>c&&c.v?go(null,false):go(null,true),{prompt:"use this ability?",src:nm,srcCard:src?src.card:null,ai:l=>[l[0]]});
  go(null,false)}
const inDiscard=(st,x)=>{const f=find(st,x.uid);return f&&f.zone==="discard"};
const OWNCH=(st,pi)=>st.players[pi].play.filter(isChar);const hasCls=(x,c)=>x.card.cls.some(k=>k.toLowerCase()===c)||!!(x.tmpCls&&x.tmpCls.c===c&&CUR&&x.tmpCls.until>=CUR.turnNo);
const cheapest=a=>a.slice().sort((p,q)=>instVal(p)-instVal(q))/*nc:ai-order (callers pass it as the AI pick)*/[0];
function mimBounce(n){return FN((st,pi,self)=>{const P=st.players[pi],L=OWNCH(st,pi).filter(y=>y!==self);const back=o=>{for(const y of o){P.play=P.play.filter(c=>c!==y);P.hand.push(y,...y.under);y.under=[];reset(y)}};
  if(!self)return;if(L.length<n){banish(st,self);return}CH(st,pi,L,o=>{if(o.length===n)back(o);else banish(st,self)},{n,min:0,always:true,prompt:`return ${n} of your other characters to your hand, or choose none to banish ${self.card.name}`,ai:(l,k)=>{const o=l.slice().sort((a,b)=>instVal(a)-instVal(b))/*nc:ai-order*/.slice(0,k);return o.reduce((s2,y)=>s2+instVal(y),0)<instVal(self)*1.2?o:[]}})},0)}
function freeRushEOT(st,pi){const P=st.players[pi];PKs(st,pi,P.hand.filter(y=>isChar(y)&&y.card.cost<=4),(h)=>{if(!h)return;playFree(st,pi,h);h.grants.push({kw:"rush",until:"turnEnd",src:pi});h.banishEOT=st.turnNo},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your hand"});}
Object.assign(DEFS_EXTRA,{
 "Bashful - Hopeless Romantic":c=>c.statics.push({block:"quest",cond:(x,S)=>!S||!S.players[x.owner].play.some(y=>y!==x&&hasCls(y,"seven dwarfs"))}),
 "Christopher Robin - Adventurer":c=>c.onReadyT=[FN((st,pi,self)=>{if(OWNCH(st,pi).length>=3)gain(st,pi,2)},3)],
 "Dopey - Always Playful":c=>c.onBanish.push(FN((st,pi,self)=>{OWNCH(st,pi).filter(y=>y!==self&&hasCls(y,"seven dwarfs")).forEach(y=>y.lStr=(y.lStr||0)+2)},2)),
 "Grand Duke - Advisor to the King":c=>(c.auras=c.auras||[]).push({side:"own",test:x=>["prince","princess","king","queen"].some(k=>hasCls(x,k)),stat:"str",n:1}),
 "King Louie - Jungle VIP":c=>c.onAnyBanished=[FN((st,pi,self)=>{if(self)self.damage=Math.max(0,self.damage-2)},1)],
 "Rapunzel - Gifted Artist":c=>c.onHeal=[{k:"draw",n:1,may:true}],
 "Sneezy - Very Allergic":c=>{const e=FN((st,pi,self,x)=>{x.tStr-=1},1,T_({opp:true}),{may:true});c.onPlay.push(e);c.onYouPlay.push({type:"character",test:(st,pi,x)=>hasCls(x,"seven dwarfs"),eff:[e]})},
 "Snow White - Unexpected Houseguest":c=>(c.auras=c.auras||[]).push({side:"none",costCls:"seven dwarfs",costN:1}),
 "The Queen - Commanding Presence":c=>c.onQuest.push(FN((st,pi,self,x)=>{x.tStr-=4;CH(st,pi,OWNCH(st,pi),(p,b)=>{if(b)b.tStr+=4},{prompt:"choose a character to get +4 strength",ai:l=>[l.filter(y=>!y.exerted).sort((a,b)=>strOf(b)-strOf(a))/*nc:ai-order*/[0]||self||l[0]]})},3,T_({opp:true}))),
 "Last Stand":c=>c.onPlay.push({k:"banish",t:T_({test:(x,st)=>x.chalT===st.turnNo})}),
 "Painting the Roses Red":c=>c.onPlay.push({k:"multi",n:2,inner:{k:"debuff",n:1,t:T_({opp:true})}},{k:"draw",n:1}),
 "Zero to Hero":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];(P.disc=P.disc||[]).push({type:"character",n:OWNCH(st,pi).length})},(st,pi)=>OWNCH(st,pi).length*1.5)),
 "Dragon Gem":c=>c.acts.push({ink:3,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.discard.filter(z=>isChar(z)&&z.card.kw.support).pop();if(y){P.discard.splice(P.discard.indexOf(y),1);P.hand.push(y)}},2)],req:(st,pi)=>st.players[pi].discard.some(z=>isChar(z)&&z.card.kw.support)}),
 "Arthur - Wizard's Apprentice":c=>c.onQuest.push(FN((st,pi,self,x)=>{const P=st.players[pi];P.play=P.play.filter(y=>y!==x);P.hand.push(x,...x.under);x.under=[];reset(x);gain(st,pi,2);fire(st,pi,"onAllyReturned",x)},(st,pi,x)=>x&&x.card.cost<=2?6:-4,T_({own:true,other:true,helpful:true}),{may:true})),
 "Fairy Godmother - Mystic Armorer":c=>c.onQuest.push(FN((st,pi)=>OWNCH(st,pi).forEach(y=>{y.grants.push({kw:"challenger 3",until:"turnEnd",src:pi});y._rcb=st.turnNo}),3)),
 "Madam Mim - Fox":c=>c.onPlay.push(mimBounce(1)),"Madam Mim - Snake":c=>c.onPlay.push(mimBounce(1)),"Madam Mim - Purple Dragon":c=>c.onPlay.push(mimBounce(2)),
 "Madam Mim - Rival of Merlin":c=>c.acts.push({ink:0,eff:[FN(freeRushEOT,4)],req:(st,pi)=>st.players[pi].hand.some(y=>isChar(y)&&y.card.cost<=4)}),
 "Gruesome and Grim":c=>c.onPlay.push(FN(freeRushEOT,4)),
 "Merlin - Shapeshifter":c=>c.onAllyReturned=[FN((st,pi,self)=>{if(self&&st._ctx!==self)self.tLore+=1},1)],
 "Peter Pan's Shadow - Not Sewn On":c=>(c.auras=c.auras||[]).push({side:"own",other:true,kw2:"rush",kw:"evasive"}),
 "Yzma - Scary Beyond All Reason":c=>c.onPlay.push(FN((st,pi,self,x)=>{const f=find(st,x.uid),P=st.players[f.pi];P.play=P.play.filter(y=>y!==x);reset(x);P.deck.push(x,...x.under);x.under=[];shuffle(P.deck,st.r);draw(st,f.pi,2)},(st,pi,x,mine)=>x?(mine?-12:instVal(x)-6):0,T_({other:true}))),
 "Binding Contract":c=>c.acts.push({ink:0,eff:[{k:"exert",t:T_({opp:true})}],req:(st,pi)=>OWNCH(st,pi).some(y=>!y.exerted&&dry(st,y)),cost:(st,pi)=>{const y=cheapest(OWNCH(st,pi).filter(y=>!y.exerted&&dry(st,y)));if(y)y.exerted=true}}),
 "Beast - Relentless":c=>c.onOppDamaged=[FN((st,pi,self)=>{if(self)self.exerted=false},2,null,{may:true})],
 "Belle - Bookworm":c=>c.statics.push({stat:"lore",n:2,cond:(x,S)=>!!S&&!S.players[opp(x.owner)].hand.length}),
 "Belle - Hidden Archer":c=>c.onChallenged.push(FN((st,pi)=>{const o=st.players[opp(pi)];o.discard.push(...o.hand);o.hand=[]},6)),
 "Flynn Rider - His Own Biggest Fan":c=>c.statics.push({stat:"lore",per:-1,cond:"always",count:(x,P,S)=>S.players[opp(x.owner)].hand.length}),
 "Gaston - Scheming Suitor":c=>c.statics.push({stat:"str",n:3,cond:(x,S)=>!!S&&!S.players[opp(x.owner)].hand.length}),
 "Lucifer - Cunning Cat":c=>c.onPlay.push(FN((st,pi)=>{const q=opp(pi),o=st.players[q];if(!o.hand.length||o.play.some(y=>y.card.noDiscardOpp))return;const acts=o.hand.filter(y=>y.card.type==="action"||y.card.type==="song");const two=()=>discPick(st,q,Math.min(2,o.hand.length),{byOpp:true}),one=()=>discPick(st,q,1,{byOpp:true,test:y=>acts.includes(y),prompt:"Discard an action card"});if(!acts.length)return two();CH(st,q,[{label:"Discard 2 cards",v:2},{label:"Discard 1 action card",v:1}],(p,c)=>c.v===2?two():one(),{always:true,prompt:"Lucifer - Cunning Cat: your opponent makes you choose",ai:l=>[acts.some(a=>discardPri(a)<0)&&o.hand.length>=2?l[0]:l[1]]})},6)),
 "Panic - Underworld Imp":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.tStr+=x.card.name==="Pain"?4:2},1,T_({own:true,helpful:true}))),
 "Prince John - Greediest of All":c=>c.onOppDiscard=[FN((st,pi)=>draw(st,pi,st._ctx||1),4,null,{may:true})],
 "The Queen - Disguised Peddler":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.hand.filter(isChar),(h)=>{if(h){P.hand.splice(P.hand.indexOf(h),1);P.discard.push(h);gain(st,pi,h.card.lore)}},{ai:srt((a,b)=>b.card.lore-a.card.lore),prompt:"choose a card from your hand"});},(st,pi)=>{const h=st.players[pi].hand.filter(isChar).sort((a,b)=>b.card.lore-a.card.lore)/*nc:ai-value*/[0];return h?h.card.lore*6-5:-9})],req:(st,pi)=>st.players[pi].hand.some(isChar)}),
 "Bibbidi Bobbidi Boo":c=>c.onPlay.push(FN((st,pi,self,x)=>{const P=st.players[pi],cost=x.card.cost;P.play=P.play.filter(y=>y!==x);reset(x);P.hand.push(...x.under);x.under=[];PKs(st,pi,P.hand.filter(y=>isChar(y)&&y.card.cost<=cost),(h)=>{P.hand.push(x);if(h)playFree(st,pi,h)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your hand"});},(st,pi,x)=>x?(st.players[pi].hand.some(y=>isChar(y)&&y.card.cost<=x.card.cost&&y.card.cost>=x.card.cost-1)?4+x.damage*2:-3):0,T_({own:true,helpful:true}))),
 "Pack Tactics":c=>c.onPlay.push(FN((st,pi)=>gain(st,pi,st.players[opp(pi)].play.filter(y=>isChar(y)&&y.damage).length),(st,pi)=>st.players[opp(pi)].play.filter(y=>isChar(y)&&y.damage).length*6)),
 "Donald Duck - Not Again!":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:x=>x.damage}),
 "Minnie Mouse - Wide-Eyed Diver":c=>c.onYouPlay.push({type:"action",test:(st,pi)=>st.players[pi].actionsN===2,eff:[FN((st,pi,self)=>{if(self)self.tLore+=2},4)]}),
 "Ratigan - Very Large Mouse":c=>c.onPlay.push({k:"exert",t:T_({opp:true,maxStr:3})},FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z.exerted),(y)=>{if(y){y.exerted=false;y.noQuest=true}},{ai:srt((a,b)=>strOf(b)-strOf(a)),prompt:"choose one of your characters"});},1)),
 "Raya - Leader of Heart":c=>c.onChallenge.push(FN((st,pi,self)=>{const d=st._defender!=null&&find(st,st._defender);if(self&&d&&d.inst.damage)self.noChalDmg=true},2)),
 "Teeth and Ambitions":c=>c.onPlay.push(FN((st,pi,self,x)=>{CH(st,pi,OWNCH(st,pi),(p,y)=>{if(!y)return;damage(st,y,2);if(find(st,x.uid)?.zone==="play")damage(st,x,2)},{prompt:"deal 2 damage to one of your characters",ai:l=>[l.filter(z=>wilOf(z)-z.damage>2).sort((a,b)=>instVal(a)-instVal(b))/*nc:ai-order*/[0]||cheapest(l)]})},(st,pi,x)=>OWNCH(st,pi).length&&x?(wilOf(x)-x.damage<=2?instVal(x)-3:1):-5,T_({opp:true}))),
 "Dinner Bell":c=>c.acts.push({ink:2,eff:[FN((st,pi,self,x)=>{draw(st,pi,x.damage);banish(st,x)},(st,pi,x)=>x?x.damage*4-instVal(x)*0.5:-5,T_({own:true,helpful:true}))]}),
 "Peter Pan's Dagger":c=>(c.auras=c.auras||[]).push({side:"own",kw2:"evasive",stat:"str",n:1}),
 "Sword in the Stone":c=>c.acts.push({ink:2,eff:[FN((st,pi,self,x)=>{x.tStr+=x.damage},(st,pi,x)=>x?x.damage-1:-1,T_({own:true,helpful:true}))]}),
 "Basil - Great Mouse Detective":c=>c.onPlay.push({k:"cond",shifted:true,eff:[{k:"draw",n:2,may:true}]}),
 "Cogsworth - Talking Clock":c=>(c.auras=c.auras||[]).push({side:"own",kw2:"reckless",grantAct:{ink:0,eff:[{k:"gainLore",n:1}]}}),
 "Grand Pabbie - Oldest and Wisest":c=>c.onHeal=[{k:"gainLore",n:2}],
 "Hiram Flaversham - Toymaker":c=>{const e=FN((st,pi)=>{const P=st.players[pi],it=null;PKs(st,pi,P.play.filter(isItem),it=>{if(it){banish(st,it);draw(st,pi,2)}},{prompt:"banish one of your items",ai:l=>[cheapest(l)]})},(st,pi)=>st.players[pi].play.some(isItem)?5:0,null,{may:true});c.onPlay.push(e);c.onQuest.push(e)},
 "Judy Hopps - Optimistic Officer":c=>c.onPlay.push(FN((st,pi,self,x)=>{const f=find(st,x.uid);banish(st,x);draw(st,f.pi,1)},(st,pi,x,mine)=>x?(mine?-5:instVal(x)-4):0,{kind:"item",kinds:["item"]},{may:true})),
 "Noi - Orphaned Thief":c=>c.statics.push({cond:"item",kw:"resist 1"},{cond:"item",kw:"ward"}),
 "Falling Down the Rabbit Hole":c=>c.onPlay.push(FN((st,pi)=>{for(const q of [pi,opp(pi)]){PKs(st,q,OWNCH(st,q),y=>{if(y){const P=st.players[q];P.play=P.play.filter(z=>z!==y);P.discard.push(...y.under);y.under=[];reset(y);y.exerted=true;P.ink.push(y)}},{prompt:"choose one of your characters to put into your inkwell",ai:l=>[cheapest(l)]})}},(st,pi)=>{const a=cheapest(OWNCH(st,pi)),b=cheapest(OWNCH(st,opp(pi)));return(b?instVal(b):0)-(a?instVal(a):0)+2})),
 "Launch":c=>c.onPlay.push(FN((st,pi,self,x)=>{const it=null;PKs(st,pi,st.players[pi].play.filter(isItem),it=>{if(!it)return;banish(st,it);damage(st,x,5)},{prompt:"banish one of your items",ai:l=>[cheapest(l)]})},(st,pi,x)=>st.players[pi].play.some(isItem)&&x?(wilOf(x)-x.damage<=5?instVal(x)-4:0):-9,T_({opp:true,kinds:["character","location"],kind:"any"}))),
 "Nothing to Hide":c=>c.onPlay.push(FN((st,pi)=>revealHand(st,pi,opp(pi),"Nothing to Hide: opponent's hand"),0),{k:"draw",n:1}),
 "Gumbo Pot":c=>c.acts.push({ink:0,eff:[{k:"multi",n:2,inner:{k:"heal",n:1,t:T_({own:true,helpful:true,state:"damaged"})}}]}),
 "Beast - Selfless Protector":c=>{c.shield=true},
 "Beast - Tragic Hero":c=>c.onStart.push(FN((st,pi,self)=>{if(!self)return;if(!self.damage)draw(st,pi,1);else self.tStr+=4},4)),
 "Cinderella - Stouthearted":c=>c.onYouPlay.push({type:"song",eff:[FN((st,pi,self)=>{if(self)self.chReady=st.turnNo},2)]}),
 "Tiana - Celebrating Princess":c=>{c.blockActions=(y,S)=>y.exerted&&!S.players[y.owner].hand.length},
 "Pick a Fight":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.chReady=st.turnNo},2,T_({own:true,helpful:true}))),
 "Strength of a Raging Fire":c=>c.onPlay.push(FN((st,pi,self,x)=>damage(st,x,OWNCH(st,pi).length),(st,pi,x)=>x&&wilOf(x)-x.damage<=OWNCH(st,pi).length?instVal(x):1,T_({opp:true}))),
 "Last Cannon":c=>c.acts.push({ink:1,sac:true,noExert:true,eff:[parseOne0("chosen character gains challenger +3 this turn")]}),
 "Weight Set":c=>c.onYouPlay.push({type:"character",test:(st,pi,x)=>x.card.str>=4,eff:[{k:"pay",n:1,eff:[{k:"draw",n:1}],may:true}]}),
});

const LOC=(st,x)=>x&&x.at!=null?st.players[x.owner].play.find(y=>y.uid===x.at):null;
const toHandFrom=(P,zone,y)=>{P[zone].splice(P[zone].indexOf(y),1);reset(y);P.hand.push(y)};
const chalDef=(st)=>st._defender!=null?find(st,st._defender)?.inst:null;
const hereChars=(st,l)=>st.players[l.owner].play.filter(y=>isChar(y)&&y.at===l.uid);
Object.assign(DEFS_EXTRA,{
 "Bernard - Brand-New Agent":c=>c.onEnd.push(FN((st,pi,self)=>{if(!self||!self.exerted)return;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.exerted),(y)=>{if(y)y.exerted=false},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose one of your characters"});},2,null,{may:true})),
 "Chernabog - Evildoer":c=>{c.costFn=(st,pi)=>st.players[pi].discard.filter(isChar).length;c.onPlay.push(FN((st,pi)=>{const P=st.players[pi],cs=P.discard.filter(isChar);P.discard=P.discard.filter(y=>!isChar(y));cs.forEach(reset);P.deck.push(...cs);shuffle(P.deck,st.r)},1))},
 "Dalmatian Puppy - Tail Wagger":c=>{c.anyCopies=true},
 "Kida - Protector of Atlantis":c=>c.onPlay.push(FN((st,pi)=>{for(const q of [0,1])OWNCH(st,q).forEach(y=>{y.lStr=(y.lStr||0)-3;if(q!==pi)y.lSrc=pi})},(st,pi)=>OWNCH(st,opp(pi)).length*2-OWNCH(st,pi).length)),
 "Lucky - The 15th Puppy":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-3));for(const y of top){if(isChar(y)&&y.card.cost<=2)P.hand.push(y);else P.deck.unshift(y)}},3)]}),
 "Perdita - Devoted Mother":c=>{const e=FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(z=>isChar(z)&&z.card.cost<=2),(y)=>{if(y){toHandFrom(P,"discard",y);playFree(st,pi,y)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},(st,pi)=>st.players[pi].discard.some(z=>isChar(z)&&z.card.cost<=2)?5:0,null,{may:true});c.onPlay.push(e);c.onQuest.push(e)},
 "Piglet - Pooh Pirate Captain":c=>c.statics.push({stat:"lore",n:2,cond:(x,S)=>!!S&&S.players[x.owner].play.filter(y=>y!==x&&isChar(y)).length>=2}),
 "Pongo - Determined Father":c=>c.acts.push({ink:2,noExert:true,once:true,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.deck.pop();if(!y)return;log(st,`${P.name} reveals ${y.card.full}.`);if(isChar(y))P.hand.push(y);else P.deck.unshift(y)},2)]}),
 "99 Puppies":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];(P.hooks=P.hooks||[]).push({on:"quest",eff:[{k:"gainLore",n:1}]})},(st,pi)=>OWNCH(st,pi).filter(y=>!y.exerted).length*6)),
 "Pride Lands - Pride Rock":c=>(c.auras=c.auras||[]).push({side:"none",costCls:"any",costType:"character",costN:1,cond:(l,S)=>hereChars(S,l).some(y=>hasCls(y,"prince")||hasCls(y,"king"))}),
 "Tiana's Palace - Jazz Restaurant":c=>c.statics.push({here:true,block:"challenged"}),
 "Alice - Tea Alchemist":c=>c.acts.push({ink:0,eff:[FN((st,pi,self,x)=>{st.players[opp(pi)].play.filter(y=>isChar(y)&&y.card.name===x.card.name).forEach(y=>y.exerted=true)},3,T_({opp:true}))]}),
 "Chernabog's Followers - Creatures of Evil":c=>c.onQuest.push(FN((st,pi,self)=>{if(self){banish(st,self);draw(st,pi,1)}},(st,pi)=>1,null,{may:true})),
 "Genie - Supportive Friend":c=>c.onQuest.push(FN((st,pi,self)=>{if(!self)return;const P=st.players[pi];P.play=P.play.filter(y=>y!==self);reset(self);P.deck.push(self,...self.under);self.under=[];shuffle(P.deck,st.r);draw(st,pi,3)},8,null,{may:true})),
 "Jafar - Striking Illusionist":c=>c.onDrawYT=[FN((st,pi,self)=>{if(self&&self.exerted)gain(st,pi,1)},3)],
 "Magic Broom - Swift Cleaner":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi],cs=P.discard.filter(y=>hasCls(y,"broom"));P.discard=P.discard.filter(y=>!cs.includes(y));P.deck.push(...cs);shuffle(P.deck,st.r)},1,null,{may:true})),
 "Magica De Spell - The Midas Touch":c=>c.onQuest.push(FN((st,pi)=>gain(st,pi,Math.max(0,...st.players[pi].play.filter(isItem).map(y=>y.card.cost))),4)),
 "Magica De Spell - Thieving Sorceress":c=>c.acts.push({ink:0,eff:[{k:"bounce",t:{kind:"item",kinds:["item"],test:(x,st)=>{const s0=find(st,st._src);return s0&&x.card.cost<=strOf(s0.inst)}}}]}),
 "Maleficent - Mistress of All Evil":c=>c.onDrawYT=[FN((st,pi)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z.damage),(y)=>{if(y)resolve(st,pi,[{k:"moveDmg",n:1,t:{}}],y.uid,null)},{ai:srt((a,b)=>b.damage-a.damage),prompt:"choose one of your characters"});},2,null,{may:true})],
 "Pua - Potbellied Buddy":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const P=st.players[pi],y=ctx.src;if(y&&P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);P.deck.push(y);shuffle(P.deck,st.r)}},1,null,{may:true})),
 "Rafiki - Mystical Fighter":c=>c.onChallenge.push(FN((st,pi,self)=>{const d=chalDef(st);if(self&&d&&hasCls(d,"hyena"))self.noChalDmg=true},1)),
 "Peter Pan - Pirate's Bane":c=>c.onChallenge.push(FN((st,pi,self)=>{const d=chalDef(st);if(self&&d&&hasCls(d,"pirate"))self.noChalDmg=true},1)),
 "Stratos - Tornado Titan":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>gain(st,pi,OWNCH(st,pi).filter(y=>hasCls(y,"titan")).length),(st,pi)=>OWNCH(st,pi).filter(y=>hasCls(y,"titan")).length*6)]}),
 "Treasure Guardian - Protector of the Cave":c=>c.statics.push({block:"quest",cond:x=>x.at==null},{block:"challenge",cond:x=>x.at==null}),
 "It Calls Me":c=>c.onPlay.push({k:"draw",n:1}),
 "Last-Ditch Effort":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.exerted=true;PKs(st,pi,OWNCH(st,pi),(y)=>{if(y){y.grants=y.grants||[];y.grants.push({kw:"challenger 2",until:"turnEnd",src:pi})}},{ai:srt((a,b)=>(!b.exerted&&dry(st,b))-(!a.exerted&&dry(st,a))||strOf(b)-strOf(a)),prompt:"choose one of your characters"});},4,T_({opp:true}))),
 "The Lamp":c=>c.acts.push({ink:0,sac:true,noExert:true,eff:[FN((st,pi)=>{const P=st.players[pi];if(P.play.some(y=>y.card.name==="Jafar"))draw(st,pi,2);if(P.play.some(y=>y.card.name==="Genie")){PKs(st,pi,st.players[opp(pi)].play.filter(y=>isChar(y)&&y.card.cost<=4),(t)=>{if(t)resolve(st,pi,[{k:"bounce",t:{}}],t.uid,null)},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose an opposing character"});}},(st,pi)=>{const P=st.players[pi];return(P.play.some(y=>y.card.name==="Jafar")?8:0)+(P.play.some(y=>y.card.name==="Genie")?5:0)-3})]}),
 "The Sorcerer's Hat":c=>c.acts.push({ink:1,eff:[{k:"nameReveal",to:"hand"}]}),
 "The Queen's Castle - Mirror Chamber":c=>c.onStart.push(FN((st,pi,self)=>{if(self)draw(st,pi,hereChars(st,self).length)},3)),
 "The Sorcerer's Tower - Wondrous Workspace":c=>{c.moveFree=x=>x.card.name==="Magic Broom"},
 "Cubby - Mighty Lost Boy":c=>c.onMoveSelf=[FN((st,pi,self)=>{if(self)self.tStr+=3},2)],
 "Friar Tuck - Priest of Nottingham":c=>c.onPlay.push(FN((st,pi)=>{const a=st.players[pi].hand.length,b=st.players[opp(pi)].hand.length;if(b>=a)resolve(st,pi,[{k:"oppDiscard",n:1}],null,null);if(a>=b)resolve(st,pi,[{k:"selfDiscard",n:1}],null,null)},(st,pi)=>st.players[opp(pi)].hand.length>st.players[pi].hand.length?3:-1)),
 "Milo Thatch - King of Atlantis":c=>c.onBanish.push(FN((st,pi)=>{for(const y of OWNCH(st,opp(pi)))resolve(st,pi,[{k:"bounce",t:{}}],y.uid,null)},6)),
 "Morph - Space Goo":c=>{c.morph=true},
 "Peter Pan - Lost Boy Leader":c=>c.onMoveSelf=[FN((st,pi,self)=>{if(!self||self.onceM===st.turnNo)return;self.onceM=st.turnNo;const l=st._ctx;if(l&&l.card)gain(st,pi,l.card.lore||0)},3)],
 "Shenzi - Hyena Pack Leader":c=>c.onChallenge.push(FN((st,pi,self)=>{if(self&&self.at!=null)draw(st,pi,1)},3,null,{may:true})),
 "Ursula - Deceiver":c=>{c.onPlay=c.onPlay.filter(e=>e.k==="oppDiscard")},
 "Ursula - Deceiver of All":c=>{c.replaySong=true},
 "I Will Find My Way":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.tStr+=2;pickLoc(st,pi,l=>{if(x.at!==l.uid)doMove(st,pi,x,l)},`move ${x.card.name} to which location?`)},2,T_({own:true,helpful:true}))),
 "Airfoil":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>{if((st.players[pi].actionsN||0)>=2)draw(st,pi,1)},(st,pi)=>(st.players[pi].actionsN||0)>=2?4:-1)]}),
 "Robin's Bow":c=>c.onAllyQuest.push({test:x=>x.card.name==="Robin Hood",eff:[FN((st,pi,self)=>{if(self)self.exerted=false},2,null,{may:true})]}),
 "Starlight Vial":c=>c.acts.push({ink:2,sac:true,noExert:true,eff:[{k:"draw",n:2},{k:"selfDiscard",n:1}]}),
 "Fang - River City":c=>c.statics.push({here:true,kw:"ward"},{here:true,kw:"evasive"}),
 "Kuzco's Palace - Home of the Emperor":c=>{c.onBanishedHere=[FN((st,pi)=>{if(st._challenger!=null&&st.active!==pi){const f=find(st,st._challenger);if(f&&f.zone==="play")banish(st,f.inst)}},3)]},
 "Captain Hook - Master Swordsman":c=>(c.auras=c.auras||[]).push({side:"all",name:["peter pan"],kwOff:"evasive"}),
 "HeiHei - Accidental Explorer":c=>c.onMoveSelf=[FN((st,pi,self)=>{if(!self||self.onceM===st.turnNo)return;self.onceM=st.turnNo;const o=st.players[opp(pi)];loseLore(st,o,1)},3)],
 "Hydra - Deadly Serpent":c=>c.onDamagedSelf=[FN((st,pi)=>{const n=st._ctx||0;PKs(st,pi,st.players[opp(pi)].play.filter(y=>isChar(y)&&!K(y,"ward")),(t)=>{if(t&&n)damage(st,t,n)},{ai:srt((a,b)=>(wilOf(a)-a.damage<=n?-100:0)-(wilOf(b)-b.damage<=n?-100:0)||instVal(b)-instVal(a)),prompt:"choose an opposing character"});},3)],
 "Jim Hawkins - Space Traveler":c=>c.onYouPlay.push({type:"location",eff:[FN((st,pi,self)=>{const P=st.players[pi],l=P.play[P.play.length-1];if(self&&l&&isLoc(l))doMove(st,pi,self,l)},2,null,{may:true})]}),
 "Maui - Soaring Demigod":c=>c.onAllyQuest.push({test:x=>x.card.name==="HeiHei",eff:[FN((st,pi,self)=>{if(self){self.tLore+=1;self.noReckT=st.turnNo}},3)]}),
 "Maui - Whale":c=>{c.noReadySelf=true;c.acts.push({ink:2,noExert:true,eff:[FN((st,pi,self)=>{if(self){self.exerted=false;self.noQuest=true}},(st,pi,x)=>1)],req:(st,pi,x)=>x.exerted})},
 "Moana - Born Leader":c=>c.onQuest.push(FN((st,pi,self)=>{const l=LOC(st,self);if(l)hereChars(st,l).filter(y=>y!==self).forEach(y=>{y.exerted=false;y.noQuest=true})},2)),
 "Divebomb":c=>c.onPlay.push(FN((st,pi,self,x)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>K(z,"reckless")&&strOf(z)>strOf(x)),(y)=>{if(y){banish(st,y);banish(st,x)}},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose one of your characters"});},(st,pi,x)=>{const y=OWNCH(st,pi).filter(z=>K(z,"reckless")&&x&&strOf(z)>strOf(x)).sort((a,b)=>instVal(a)-instVal(b))/*nc:ai-value*/[0];return y?instVal(x)-instVal(y):-9},T_({opp:true}))),
 "I've Got a Dream":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.exerted=false;x.noQuest=true;const l=LOC(st,x);if(l)gain(st,pi,l.card.lore||0)},(st,pi,x)=>x?2+(LOC(st,x)?.card.lore||0)*6:0,T_({own:true,helpful:true,test:x=>x.at!=null}))),
 "On Your Feet! Now!":c=>c.onPlay.push(FN((st,pi)=>OWNCH(st,pi).forEach(y=>{y.exerted=false;y.noQuest=true;damage(st,y,1)}),(st,pi)=>OWNCH(st,pi).filter(y=>y.exerted&&wilOf(y)-y.damage>1).length*2-2)),
 "Voyage":c=>c.onPlay.push(FN((st,pi)=>pickLoc(st,pi,l=>UPTO(st,pi,OWNCH(st,pi).filter(y=>y.at!==l.uid),2,y=>doMove(st,pi,y,l),`move up to 2 characters to ${l.card.name}`,(a,b)=>b.card.lore-a.card.lore),"choose a location to move to"),(st,pi)=>st.players[pi].play.some(isLoc)?3:-3)),
 "Maui's Fish Hook":c=>{c.acts=[];const m=(x,S)=>S.players[x.owner].play.some(y=>y.card.name==="Maui");const A=[parseOne0("chosen character gains evasive until the start of your next turn"),parseOne0("chosen character gets +3 str this turn")];
   for(const e of A){c.acts.push({ink:2,eff:[e],req:(st,pi,x)=>!m(x,st)});c.acts.push({ink:0,eff:[e],req:(st,pi,x)=>m(x,st)})}},
 "Jolly Roger - Hook's Ship":c=>{c.moveFree=x=>hasCls(x,"pirate")},
 "RLS Legacy - Solar Galleon":c=>{c.moveRed=(x,l,st)=>hereChars(st,l).length?2:0},
 "Gramma Tala - Spirit of the Ocean":c=>{c.onInk.push({k:"gainLore",n:1})},
 "Gyro Gearloose - Gadget Whiz":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(isItem),(y)=>{if(y){P.discard.splice(P.discard.indexOf(y),1);P.deck.push(y)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},(st,pi)=>st.players[pi].discard.some(isItem)?2:-1)]}),
 "Huey - Savvy Nephew":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi];if(P.play.some(y=>y.card.name==="Dewey")&&P.play.some(y=>y.card.name==="Louie"))draw(st,pi,3)},6,null,{may:true})),
 "Tinker Bell - Very Clever Fairy":c=>c.onItemBanished=[FN((st,pi)=>{const P=st.players[pi],y=st._ctx;if(y&&P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);y.exerted=true;P.ink.push(y)}},3,null,{may:true})],
 "Repair":c=>c.onPlay.push({k:"heal",n:3,t:{own:true,helpful:true,kind:"any",kinds:["character","location"]}}),
 "Lucky Dime":c=>c.acts.push({ink:2,eff:[FN((st,pi)=>gain(st,pi,Math.max(0,...OWNCH(st,pi).map(loreOf))),(st,pi)=>Math.max(0,...OWNCH(st,pi).map(loreOf))*6-4)]}),
 "Vault Door":c=>(c.auras=c.auras||[]).push({side:"own",kinds:["location"],kw:"resist 1"},{side:"own",test:x=>x.at!=null,kw:"resist 1"}),
 "Belle's House - Maurice's Workshop":c=>(c.auras=c.auras||[]).push({side:"none",costCls:"any",costType:"item",costN:1,cond:(l,S)=>hereChars(S,l).length>0}),
 "Motunui - Island Paradise":c=>{c.onBanishedHere=[FN((st,pi)=>{const P=st.players[pi],y=st._ctx;if(y&&P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);y.exerted=true;P.ink.push(y)}},3,null,{may:true})]},
 "Gustav the Giant - Terror of the Kingdom":c=>{c.entersExerted=true;c.noReadySelf=true;c.onAllyBanishOther=[FN((st,pi,self)=>{if(self&&st._ctx!==self&&st.active===pi)self.exerted=false},2,null,{may:true})]},
 "John Silver - Greedy Treasure Seeker":c=>{const cnt=(x,P)=>P.play.filter(isLoc).length;c.statics.push({stat:"lore",per:1,cond:"always",count:cnt},{kwPer:"resist",count:cnt})},
 "Little John - Resourceful Outlaw":c=>(c.auras=c.auras||[]).push({side:"own",kw2:"bodyguard",cond:"exerted",kw:"resist 1"},{side:"own",kw2:"bodyguard",cond:"exerted",stat:"lore",n:1}),
 "Mr. Smee - Bumbling Mate":c=>c.onEnd.push(FN((st,pi,self)=>{if(self&&self.exerted&&!OWNCH(st,pi).some(y=>hasCls(y,"captain")))damage(st,self,1)},-1)),
 "Sheriff of Nottingham - Corrupt Official":c=>c.onSelfDiscard=[FN((st,pi)=>{PKs(st,pi,st.players[opp(pi)].play.filter(y=>isChar(y)&&!K(y,"ward")),(t)=>{if(t)damage(st,t,1)},{ai:srt((a,b)=>(wilOf(a)-a.damage<=1?-100:0)-(wilOf(b)-b.damage<=1?-100:0)||instVal(b)-instVal(a)),prompt:"choose an opposing character"});},2,null,{may:true})],
 "Simba - Fighting Prince":c=>{const md={k:"modal",may:true,opts:[[{k:"draw",n:2},{k:"selfDiscard",n:2}],[parseOne0("deal 2 damage to chosen character")]],optText:["Draw 2, then discard 2","Deal 2 damage to chosen character"]};c.onPlay.push(md);c.onBanishOther.push({...md,yourTurn:true})},
 "Olympus Would Be That Way":c=>c.onPlay.push(FN((st,pi)=>{st.players[pi].locBonusT=st.turnNo},(st,pi)=>st.players[opp(pi)].play.some(isLoc)?3:-1)),
 "Captain Hook's Rapier":c=>c.onAllyBanishOther=[{k:"pay",n:1,eff:[{k:"draw",n:1}],may:true}],
 "Map of Treasure Planet":c=>{c.moveDisc=1},
 "The Bayou - Mysterious Swamp":c=>{c.onQuestHere=[{k:"draw",n:1,may:true},{k:"selfDiscard",n:1}]},
});

const SHIFTD=(n,test)=>c=>{c.shiftAlt={n,test}};
const oppPicks=(st,pi,f)=>PKs(st,opp(pi),OWNCH(st,opp(pi)),y=>{if(y)f(y)},{prompt:"your opponent makes you choose one of your characters",ai:l=>[cheapest(l)]});
const toBottom=(st,y)=>{const f=find(st,y.uid),P=st.players[f.pi];P.play=P.play.filter(z=>z!==y);reset(y);P.deck.unshift(y,...y.under);y.under=[]};
const retHand=(st,y)=>resolve(st,y.owner,[{k:"bounce",t:{}}],y.uid,null);
const dmgBest=(st,pi,n,filter)=>{PKs(st,pi,st.players[opp(pi)].play.filter(y=>isChar(y)&&!K(y,"ward")&&(!filter||filter(y))),(t)=>{if(t)damage(st,t,n)},{ai:srt((a,b)=>(wilOf(a)-a.damage<=n?-100:0)-(wilOf(b)-b.damage<=n?-100:0)||instVal(b)-instVal(a)),prompt:"choose an opposing character"});};
const fromDiscardToHand=(st,pi,test,n)=>{const P=st.players[pi];CH(st,pi,P.discard.filter(test),ps=>ps.forEach(y=>toHandFrom(P,"discard",y)),{n:n||1,prompt:`return ${n>1?"up to "+n+" cards":"a card"} from your discard to your hand`,ai:srt((a,b)=>b.card.cost-a.card.cost)})};
Object.assign(DEFS_EXTRA,{
 "Alma Madrigal - Family Matriarch":c=>c.onPlay.push({k:"tutor",cls:"madrigal",type:"character",max:99,top:true,may:true}),
 "Golden Harp - Enchanter of the Land":c=>c.onEnd.push(FN((st,pi,self)=>{if(self&&st.players[pi].songTurn!==st.turnNo)banish(st,self)},-2)),
 "Julieta Madrigal - Excellent Cook":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(noHeal(st))return;const r0=Math.min(2,x.damage);x.damage-=r0;if(r0){(st.players[x.owner].healT=st.turnNo),(st._ctx=x),fire(st,x.owner,"onHealAny",x),fire(st,x.owner,"onHeal",r0);draw(st,pi,1)}},(st,pi,x,mine)=>mine&&x&&x.damage?6:-1,T_({helpful:true}),{may:true})),
 "Mickey Mouse - Musketeer Captain":c=>c.onPlay.push({k:"cond",shifted:true,eff:[FN((st,pi)=>draw(st,pi,OWNCH(st,pi).filter(y=>K(y,"bodyguard")).length),4,null,{may:true})]}),
 "Prince Eric - Ursula's Groom":c=>c.statics.push({cond:"named:ursula",kw:"bodyguard"},{cond:"named:ursula",stat:"wil",n:2}),
 "Ursula - Eric's Bride":SHIFTD(1,y=>y.card.type==="song"),
 "Lost in the Woods":c=>c.onPlay.push(FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>{y.lStr=(y.lStr||0)-2;y.lSrc=pi}),(st,pi)=>OWNCH(st,opp(pi)).length*2)),
 "Sign the Scroll":c=>c.onPlay.push(FN((st,pi)=>{const o=st.players[opp(pi)];PKs(st,pi,o.hand,(y)=>{if(y&&(discardPri(y)>0||o.hand.length>=4)){o.hand.splice(o.hand.indexOf(y),1);o.discard.push(y);fire(st,pi,"onOppDiscard",1)}else gain(st,pi,2)},{ai:srt((a,b)=>discardPri(b)-discardPri(a)),prompt:"choose a card from your hand"});},6)),
 "Miracle Candle":c=>c.acts.push({ink:0,sac:true,noExert:true,req:(st,pi)=>OWNCH(st,pi).length>=3,eff:[FN((st,pi)=>{gain(st,pi,2);if(!noHeal(st))PKs(st,pi,st.players[pi].play.filter(y=>isLoc(y)&&y.damage),l=>{if(l)l.damage=Math.max(0,l.damage-2)},{prompt:"remove up to 2 damage from one of your locations",ai:l=>[l[0]]})},12)]}),
 "Record Player":c=>(c.auras=c.auras||[]).push({side:"own",name:["stitch"],singBonus:1}),
 "Atlantica - Concert Hall":c=>c.statics.push({here:true,singBonus:2}),
 "The Underworld - River Styx":c=>{c.onQuestHere=[{k:"pay",n:3,may:true,eff:[FN((st,pi)=>fromDiscardToHand(st,pi,isChar),4)]}]},
 "Bruno Madrigal - Out of the Shadows":c=>c.onPlay.push(FN((st,pi,self,x)=>{x._rcb=st.turnNo},2,T_({own:true,helpful:true}))),
 "Bruno Madrigal - Undetected Uncle":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>{const P=st.players[pi],h=P.hand.length;resolve(st,pi,[{k:"nameReveal",to:"hand"}],null,null);if(P.hand.length>h)gain(st,pi,3)},3)]}),
 "Flotsam - Ursula's \"Baby\"":c=>{c.giveRcb=x=>x.card.name==="Jetsam"},
 "Flotsam & Jetsam - Entangling Eels":SHIFTD(2,()=>true),
 "Isabela Madrigal - Golden Child":c=>{c.statics.push({stat:"lore",n:3,cond:(x,S)=>!!S&&S.active===x.owner&&!(S.players[x.owner].questedT===S.turnNo&&S.players[x.owner].questedBy!==x.uid)});c.onQuest.push(FN((st,pi,self)=>OWNCH(st,pi).forEach(y=>{if(y!==self)y.noQuest=true}),0))},
 "Magic Broom - Illuminary Keeper":c=>c.onYouPlay.push({type:"character",eff:[FN((st,pi,self)=>{if(self){banish(st,self);draw(st,pi,1)}},(st,pi)=>0,null,{may:true})]}),
 "Pepa Madrigal - Weather Maker":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.exerted=true;if(x.at==null)x.noReady=true},(st,pi,x)=>x?3+x.card.cost/2:0,T_({opp:true}),{may:true})),
 "Peter Pan - Shadow Finder":c=>(c.auras=c.auras||[]).push({side:"own",other:true,kw2:"evasive",kw:"rush"}),
 "Ursula - Sea Witch Queen":c=>(c.auras=c.auras||[]).push({side:"all",other:true,block:"sing"}),
 "Yen Sid - Powerful Sorcerer":c=>c.statics.push({stat:"lore",n:2,cond:(x,S)=>!!S&&S.players[x.owner].play.filter(y=>hasCls(y,"broom")).length>=2}),
 "Second Star to the Right":c=>c.onPlay.push({k:"draw",n:5}),
 "Ursula’s Plan":c=>c.onPlay.push(FN((st,pi)=>oppPicks(st,pi,y=>{y.exerted=true;y.noReady=true}),4)),
 "Mystical Rose":c=>c.acts.push({ink:0,sac:true,noExert:true,eff:[FN((st,pi,self,x)=>{x.tLore+=2;if(st.players[pi].play.some(y=>y.card.name==="Belle")){PKs(st,pi,OWNCH(st,pi).filter(z=>z.damage),(y)=>{if(y)resolve(st,pi,[{k:"moveDmg",n:3,t:{}}],y.uid,null)},{ai:srt((a,b)=>b.damage-a.damage),prompt:"choose one of your characters"});}},5,T_({own:true,helpful:true,name:"beast"}))]}),
 "Triton's Trident":c=>c.acts.push({ink:0,sac:true,noExert:true,eff:[FN((st,pi,self,x)=>{x.tStr+=st.players[pi].hand.length},(st,pi)=>st.players[pi].hand.length-3,T_({own:true,helpful:true}))]}),
 "Casa Madrigal - Casita":c=>c.onStart.push(FN((st,pi,self)=>{if(self&&hereChars(st,self).length)gain(st,pi,1)},4)),
 "Ursula’s Lair - Eye of the Storm":c=>{c.onBanishedHere=[FN((st,pi)=>{const y=st._ctx,P=st.players[pi];if(st._challenger!=null&&y&&P.discard.includes(y))toHandFrom(P,"discard",y)},4,null,{may:true})]},
 "Diablo - Devoted Herald":c=>{c.shiftAlt={n:1,test:y=>y.card.type==="action"||y.card.type==="song"};c.onOppDraw=[FN((st,pi,self)=>{if(self&&self.exerted)draw(st,pi,1)},4,null,{may:true})]},
 "Diablo - Maleficent's Spy":c=>{c.onPlay.push(FN((st,pi)=>revealHand(st,pi,opp(pi),"Diablo: opponent's hand"),0,null,{may:true}))},
 "Gunther - Interior Designer":c=>c.onBanish.push(FN((st,pi)=>oppPicks(st,pi,y=>retHand(st,y)),4,null,{challengedOnly:true})),
 "Hades - Double Dealer":c=>c.acts.push({ink:0,req:(st,pi,x)=>OWNCH(st,pi).some(y=>y!==x&&st.players[pi].hand.some(h=>h.card.name===y.card.name&&isChar(h))),
   eff:[FN((st,pi,self)=>{const P=st.players[pi];PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&P.hand.some(h=>h.card.name===z.card.name&&isChar(h))),(y)=>{if(!y)return;PKs(st,pi,P.hand.filter(z=>z.card.name===y.card.name&&isChar(z)),(h)=>{banish(st,y);playFree(st,pi,h)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your hand"});},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose a card from your hand"});},(st,pi)=>3)]}),
 "Jasmine - Desert Warrior":c=>{c.onPlay.push({k:"oppDiscard",n:1});c.onChallenged.push({k:"oppDiscard",n:1})},
 "Megara - Captivating Cynic":c=>c.onPlay.push(FN((st,pi,self)=>{const P=st.players[pi];if(P.hand.length){resolve(st,pi,[{k:"selfDiscard",n:1}],null,null)}else if(self)banish(st,self)},-2)),
 "Panic - Immortal Sidekick":c=>(c.auras=c.auras||[]).push({side:"own",cls:"villain",block:"challenged",cond:(y,S)=>y.exerted&&S.players[y.owner].play.some(z=>z.card.name==="Pain")}),
 "Pete - Born to Cheat":c=>c.onQuest.push(FN((st,pi,self,x)=>{if(self&&strOf(self)>=5)retHand(st,x)},(st,pi,x,mine)=>x?(mine?-8:instVal(x)*0.7):0,T_({maxStr:2}))),
 "Prince Phillip - Vanquisher of Foes":c=>c.onPlay.push(FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.damage).forEach(y=>banish(st,y)),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.damage).reduce((s,y)=>s+instVal(y),0))),
 "The Fates - Only One Eye":c=>c.onPlay.push(FN(()=>{},0)),
 "Zeus - Mr. Lightning Bolts":c=>c.onChallenge.push(FN((st,pi,self)=>{if(self)self.tStr+=Math.max(0,...OWNCH(st,pi).concat(OWNCH(st,opp(pi))).map(strOf))},3)),
 "Under the Sea":c=>c.onPlay.push(FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>strOf(y)<=2).forEach(y=>toBottom(st,y)),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>strOf(y)<=2).reduce((s,y)=>s+instVal(y),0))),
 "Ursula’s Trickery":c=>c.onPlay.push(FN((st,pi)=>{const o=st.players[opp(pi)];PKs(st,pi,o.hand,(y)=>{if(y&&(discardPri(y)>0||o.hand.length>=4)){o.hand.splice(o.hand.indexOf(y),1);o.discard.push(y);fire(st,pi,"onOppDiscard",1)}else draw(st,pi,1)},{ai:srt((a,b)=>discardPri(b)-discardPri(a)),prompt:"choose a card from your hand"});},4)),
 "We Don’t Talk About Bruno":c=>c.onPlay.push(FN((st,pi,self,x)=>{const q=x.owner;retHand(st,x);const P=st.players[q];if(P.hand.length){const y=P.hand[Math.floor(st.r()*P.hand.length)];P.hand.splice(P.hand.indexOf(y),1);P.discard.push(y)}},(st,pi,x,mine)=>x?(mine?-10:instVal(x)+4):0,T_({}))),
 "We Don't Talk About Bruno":c=>DEFS_EXTRA["We Don’t Talk About Bruno"](c),
 "Hidden Inkcaster":c=>{c.inkAll=true},
 "Signed Contract":c=>{c.onOppSong=[{k:"draw",n:1,may:true}]},
 "Vision Slab":c=>{c.noHeal=true;c.onStart.push(FN((st,pi)=>{if(OWNCH(st,opp(pi)).some(y=>y.damage))gain(st,pi,1)},4))},
 "Hidden Cove - Tranquil Haven":c=>c.statics.push({here:true,stat:"str",n:1},{here:true,stat:"wil",n:1}),
 "Ursula’s Garden - Full of the Unfortunate":c=>(c.auras=c.auras||[]).push({side:"opp",stat:"lore",n:-1,cond:(l,S)=>hereChars(S,l).some(y=>y.exerted)}),
 "Flynn Rider - Frenemy":c=>c.onStart.push(FN((st,pi)=>{const m=Math.max(0,...OWNCH(st,pi).map(strOf)),o=Math.max(-1,...OWNCH(st,opp(pi)).map(strOf));if(OWNCH(st,pi).length&&m>o)gain(st,pi,3)},6)),
 "Li Shang - Valorous General":c=>{c.shiftAlt={n:1,test:y=>isChar(y)};(c.auras=c.auras||[]).push({side:"own",test:x=>strOf0(x)>=4,stat:"lore",n:1})},
 "Mulan - Elite Archer":c=>c.onDealChal=[FN((st,pi)=>{const n=st._ctx;for(let k=0;k<2;k++)dmgBest(st,pi,n,y=>y.uid!==st._defender)},4)],
 "Namaari - Heir of Fang":c=>c.onDealChal=[FN((st,pi)=>dmgBest(st,pi,st._ctx,y=>y.uid!==st._defender),3,null,{may:true})],
 "Noi - Acrobatic Baby":c=>c.onYouPlay.push({type:"action",eff:[FN((st,pi,self)=>{if(self)self.noChalDmgT=st.turnNo},2)]}),
 "Raya - Fierce Protector":c=>c.onChallenge.push(FN((st,pi,self)=>gain(st,pi,OWNCH(st,pi).filter(y=>y!==self&&y.damage).length),3)),
 "Sisu - Emboldened Warrior":c=>c.statics.push({stat:"str",per:1,cond:"always",count:(x,P,S)=>S.players[opp(x.owner)].hand.length}),
 "Tuk Tuk - Lively Partner":c=>c.onPlay.push(FN((st,pi,self)=>{if(!self)return;pickLoc(st,pi,l=>PKs(st,pi,OWNCH(st,pi).filter(y=>y!==self),(o)=>{doMove(st,pi,self,l);if(o){doMove(st,pi,o,l);o.tStr+=2}},{ai:srt((a,b)=>strOf(b)-strOf(a)),prompt:"choose another character to move with Tuk Tuk"}),"move to which location?")},3,null,{may:true})),
 "A Pirate's Life":c=>{c.onPlay=[{k:"drain",g:2,lo:2}]},
 "Medallion Weights":c=>c.acts.push({ink:2,eff:[FN((st,pi,self,x)=>{x.tStr+=2;x.drawOnChalT=st.turnNo},2,T_({own:true,helpful:true}))]}),
 "The Plank":c=>c.acts.push({ink:2,sac:true,noExert:true,eff:[{k:"banish",t:T_({cls:"hero"})}]},{ink:2,sac:true,noExert:true,eff:[{k:"ready",t:T_({cls:"villain",own:true,helpful:true})},{k:"noQuest",rider:true}]}),
 "Vitalisphere":c=>c.acts.push({ink:1,sac:true,noExert:true,eff:[FN((st,pi,self,x)=>{x.tStr+=2;x.grants.push({kw:"rush",until:"turnEnd",src:pi})},3,T_({own:true,helpful:true}))]}),
 "Snuggly Duckling - Disreputable Pub":c=>{c.onChalHere=[FN((st,pi)=>{const x=st._ctx,v=strOf(x);if(v>=6)gain(st,pi,3);else if(v>=3)gain(st,pi,1)},3)]},
 "Training Grounds - Impossible Pillar":c=>c.acts.push({ink:1,noExert:true,eff:[FN((st,pi,self,x)=>{x.tStr+=1},1,T_({own:true,helpful:true,test:(x,st)=>x.at===st._src}))]}),
 "Anna - Braving the Storm":c=>c.statics.push({stat:"lore",n:1,cond:"cls:hero"}),
 "Ariel - Treasure Collector":c=>c.statics.push({stat:"lore",n:2,cond:(x,S)=>!!S&&S.players[x.owner].play.filter(isItem).length>S.players[opp(x.owner)].play.filter(isItem).length}),
 "Aurora - Lore Guardian":c=>{c.protectItems=true;c.acts.push({ink:0,noExert:true,req:(st,pi)=>st.players[pi].play.some(y=>isItem(y)&&!y.exerted),cost:(st,pi)=>PKs(st,pi,st.players[pi].play.filter(z=>isItem(z)&&!z.exerted),y=>{if(y)y.exerted=true},{prompt:"exert one of your items",ai:l=>[l[0]]}),eff:[{k:"scry"}]})},
 "Hans - Noble Scoundrel":c=>c.onPlay.push(FN((st,pi)=>{if(st.players.some(P=>P.play.some(y=>hasCls(y,"princess")||hasCls(y,"queen"))))gain(st,pi,1)},4)),
 "Olaf - Carrot Enthusiast":c=>{c.shiftAlt={n:1,test:y=>isItem(y)};c.onQuest.push(FN((st,pi,self)=>{if(self)OWNCH(st,pi).forEach(y=>{if(y!==self)y.tStr+=strOf(self)})},2))},
 "Prince Phillip - Gallant Defender":c=>{c.onSupportChosen=[FN((st,pi)=>{const y=st._ctx;if(y)y.grants.push({kw:"resist 1",until:"turnEnd",src:pi})},1)]},
 "The Queen - Diviner":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-4));PKs(st,pi,top.filter(isItem),(it)=>{P.deck.unshift(...top.filter(y=>y!==it));if(it){if(it.card.cost<=3){P.hand.push(it);playFree(st,pi,it,true)}else P.hand.push(it)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card"});},3)]}),
 "Triton - Champion of Atlantica":c=>(c.auras=c.auras||[]).push({side:"opp",stat:"str",n:0,test:(x,y,S)=>true,perLoc:true}),
 "Triton - Discerning King":c=>c.acts.push({ink:0,req:(st,pi)=>st.players[pi].play.some(isItem),cost:(st,pi)=>{sacOwn(st,pi,isItem,null,1,l=>[cheapest(l)])},eff:[{k:"gainLore",n:3}]}),
 "Triton - Young Prince":c=>{c.onLocBanished=[FN((st,pi)=>{const P=st.players[pi],y=st._ctx;if(y&&P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);y.exerted=true;P.ink.push(y)}},3,null,{may:true})]},
 "Dig a Little Deeper":c=>{c.onPlay=[{k:"dig",n:7,take:2,type:"any",must:true}]},
 "Glean":c=>c.onPlay.push(FN((st,pi,self,x)=>{const q=x.owner;banish(st,x);gain(st,q,2)},(st,pi,x,mine)=>x?(mine?-9:instVal(x)-10):0,{kind:"item",kinds:["item"]})),
 "Treasures Untold":c=>c.onPlay.push(FN((st,pi)=>fromDiscardToHand(st,pi,isItem,2),4)),
 "Field of Ice":c=>c.onYouPlay.push({type:"character",eff:[FN((st,pi)=>{const P=st.players[pi],y=P.play[P.play.length-1];if(y&&isChar(y))y.grants.push({kw:"resist 1",until:"srcStart",src:pi})},1)]}),
 "Ariel’s Grotto - A Secret Place":c=>c.statics.push({stat:"lore",n:2,cond:(x,S)=>!!S&&S.players[x.owner].play.filter(isItem).length>=3}),
 "Winter Camp - Medical Tent":c=>{c.onQuestHere=[FN((st,pi)=>{const x=st._ctx;if(x&&!noHeal(st))x.damage=Math.max(0,x.damage-(hasCls(x,"hero")?4:2))},2)]},
 "Aladdin - Brave Rescuer":SHIFTD(1,y=>isLoc(y)),
 "Donald Duck - Buccaneer":c=>c.onBanishOther.push(FN((st,pi,self)=>OWNCH(st,pi).forEach(y=>{if(y!==self)y.tLore+=1}),4)),
 "LeFou - Opportunistic Flunky":c=>{c.freeIf=(st,pi)=>st.players[pi].chalBanishT===st.turnNo},
 "Magic Broom - Brigade Commander":c=>c.statics.push({stat:"str",per:2,cond:"always",count:(x,P)=>P.play.filter(y=>y!==x&&y.card.name==="Magic Broom").length}),
 "Mickey Mouse - Playful Sorcerer":c=>c.onPlay.push(FN((st,pi,self,x)=>damage(st,x,OWNCH(st,pi).filter(y=>hasCls(y,"broom")).length),(st,pi,x)=>x?Math.min(OWNCH(st,pi).filter(y=>hasCls(y,"broom")).length,wilOf(x))*2:0,T_({opp:true}))),
 "Philoctetes - No-Nonsense Instructor":c=>c.onYouPlay.push({type:"character",test:(st,pi,x)=>hasCls(x,"hero"),eff:[{k:"gainLore",n:1}]}),
 "Piglet - Sturdy Swordsman":c=>c.statics.push({flag:"challengeReady",cond:"emptyHand"}),
 "Rajah - Royal Protector":c=>(c.auras=c.auras||[]).push({side:"own",test:(x,y)=>x===y,protect:4,cond:(y,S)=>!S.players[y.owner].hand.length}),
 "One Last Hope":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.grants.push({kw:"resist 2",until:"srcStart",src:pi});if(hasCls(x,"hero"))x.chReady=st.turnNo},2,T_({own:true,helpful:true}))),
 "The Mob Song":c=>{c.onPlay=[{k:"multi",n:3,inner:{k:"dmg",n:3,t:{opp:true,kind:"any",kinds:["character","location"]}}}]},
 "Triton's Decree":c=>c.onPlay.push(FN((st,pi)=>oppPicks(st,pi,y=>damage(st,y,2)),3)),
 "Fortisphere":c=>c.acts.push({ink:1,sac:true,noExert:true,eff:[parseOne0("chosen character of yours gains bodyguard until the start of your next turn")]}),
 "RLS Legacy's Cannon":c=>c.acts.push({ink:2,req:(st,pi)=>st.players[pi].hand.length>0,cost:(st,pi)=>resolve(st,pi,[{k:"selfDiscard",n:1}],null,null),eff:[{k:"dmg",n:2,t:{opp:true,kind:"any",kinds:["character","location"]}}]}),
 "The Wall - Border Fortress":c=>(c.auras=c.auras||[]).push({side:"own",other:true,kinds:["location"],block:"challenged",cond:(l,S)=>hereChars(S,l).some(y=>y.exerted)}),
 "Thebes - The Big Olive":c=>{c.onBanishOtherHere=[{k:"gainLore",n:2}]},
});

const drawToMatch=(st,pi)=>{const d=st.players[opp(pi)].hand.length-st.players[pi].hand.length;if(d>0)draw(st,pi,d)};
const revealTopIf=(st,pi,test,ok)=>{const P=st.players[pi],y=P.deck[P.deck.length-1];if(!y)return;log(st,`${P.name} reveals ${y.card.full}.`);if(test(y)){P.deck.pop();ok(y,P)}};
const playFromDiscard=(st,pi,test,ex)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(test),y=>{if(y){toHandFrom(P,"discard",y);playFree(st,pi,y,ex)}},{prompt:"choose a card from your discard to play for free",ai:srt((a,b)=>b.card.cost-a.card.cost)})};
Object.assign(DEFS_EXTRA,{
 "Koda - Talkative Cub":c=>{c.noLoseOppTurn=true},
 "Kenai - Big Brother":c=>(c.auras=c.auras||[]).push({side:"own",name:["koda"],block:"challenged",cond:"exerted"}),
 "Kristoff - Reindeer Keeper":c=>{c.costFn=(st,pi)=>st.players[pi].discard.filter(y=>y.card.type==="song").length},
 "Mirabel Madrigal - Family Gatherer":c=>{c.playReq=(st,pi)=>OWNCH(st,pi).length>=5},
 "Minnie Mouse - Drum Major":c=>c.onPlay.push({k:"cond",shifted:true,eff:[{k:"tutor",type:"character",max:99,top:true,may:true}]}),
 "Daisy Duck - Donald's Date":c=>c.onQuest.push(FN((st,pi)=>{const o=st.players[opp(pi)],y=o.deck.pop();if(!y)return;if(isChar(y))o.hand.push(y);else o.deck.unshift(y)},1)),
 "Vanellope von Schweetz - Sugar Rush Princess":c=>c.onYouPlay.push({type:"character",test:(st,pi,x,y)=>x!==y&&hasCls(x,"princess"),eff:[FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>{y.lStr=(y.lStr||0)-1;y.lSrc=pi}),3)]}),
 "Wreck-It Ralph - Admiral Underpants":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(isChar),(y)=>{if(y){toHandFrom(P,"discard",y);if(hasCls(y,"princess"))gain(st,pi,2)}},{ai:srt((a,b)=>(hasCls(b,"princess")-hasCls(a,"princess"))||b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},4)),
 "Try Everything":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(!noHeal(st))x.damage=Math.max(0,x.damage-3);x.exerted=false;x.noQuest=true;x.noChalNow=true},(st,pi,x)=>x?Math.min(3,x.damage)*2+(x.exerted?1:0):0,T_({own:true,helpful:true}))),
 "Revive":c=>c.onPlay.push(FN((st,pi)=>playFromDiscard(st,pi,y=>isChar(y)&&y.card.cost<=5),(st,pi)=>st.players[pi].discard.some(y=>isChar(y)&&y.card.cost<=5)?9:-5)),
 "Blast from Your Past":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi],cnt={};P.discard.filter(isChar).forEach(y=>cnt[y.card.name]=(cnt[y.card.name]||0)+1);PKs(st,pi,Object.entries(cnt),(nm)=>{if(nm)P.discard.filter(y=>isChar(y)&&y.card.name===nm[0]).forEach(y=>toHandFrom(P,"discard",y))},{ai:srt((a,b)=>b[1]-a[1]),prompt:"choose a card"});},(st,pi)=>st.players[pi].discard.filter(isChar).length?5:-5)),
 "Invited to the Ball":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-2));for(const y of top){if(isChar(y))P.hand.push(y);else P.deck.unshift(y)}},4)),
 "Queen's Sensor Core":c=>{const pq=y=>isChar(y)&&(hasCls(y,"princess")||hasCls(y,"queen"));c.onStart.push(FN((st,pi)=>{if(st.players[pi].play.some(pq))gain(st,pi,1)},4));c.acts.push({ink:2,eff:[FN((st,pi)=>revealTopIf(st,pi,pq,(y,P)=>P.hand.push(y)),2)]})},
 "Pride Lands - Jungle Oasis":c=>c.acts.push({ink:0,noExert:true,req:(st,pi,x)=>hereChars(st,x).length>=3&&st.players[pi].discard.some(isChar),eff:[FN((st,pi,self)=>{banish(st,self);playFromDiscard(st,pi,isChar)},6)]}),
 "Maleficent - Formidable Queen":c=>c.onPlay.push(FN((st,pi)=>{const n=OWNCH(st,pi).filter(y=>y.card.name==="Maleficent").length;UPTO(st,pi,st.players[opp(pi)].play.filter(y=>y.card.cost<=3&&!K(y,"ward")),n,y=>retHand(st,y),`return up to ${n} opposing cards with cost 3 or less`,(a,b)=>instVal(b)-instVal(a))},6)),
 "Earth Giant - Living Mountain":c=>c.onPlay.push(FN((st,pi)=>draw(st,opp(pi),1),-3)),
 "Madam Mim - Elephant":c=>{c.onPlay.push(mimBounce(1));c.onStart.push(FN((st,pi,self)=>{if(self&&self.damage)resolve(st,pi,[{k:"moveDmg",n:2,t:{}}],self.uid,null)},2,null,{may:true}))},
 "Genie - Main Attraction":c=>{c.noReadyOpp=(y)=>y.exerted},
 "Olaf - Happy Passenger":c=>{c.costFn=(st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.exerted).length},
 "Maleficent - Vexed Partygoer":c=>c.onQuest.push(FN((st,pi,self,x)=>{if(!st.players[pi].hand.length)return;resolve(st,pi,[{k:"selfDiscard",n:1}],null,null);retHand(st,x)},(st,pi,x,mine)=>x&&st.players[pi].hand.length>2?(mine?-9:instVal(x)-3):-5,T_({opp:true,maxCost:3,kind:"any",kinds:["character","item","location"]}),{may:true})),
 "Magica De Spell - Cruel Sorceress":c=>{c.noDiscardOpp=true},
 "Camilo Madrigal - Family Copycat":c=>c.onQuest.push(FN((st,pi,self,x)=>{gain(st,pi,loreOf(x));retHand(st,x)},(st,pi,x)=>x?loreOf(x)*6-instVal(x)*0.6:0,T_({own:true,other:true,helpful:true}),{may:true})),
 "We Know the Way":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.discard,(y)=>{if(!y)return;P.discard.splice(P.discard.indexOf(y),1);P.deck.push(y);shuffle(P.deck,st.r);const t=P.deck.pop();P.hand.push(t);if(t.card.name===y.card.name)playFree(st,pi,t)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},4)),
 "Magical Aid":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.grants.push({kw:"challenger 3",until:"turnEnd",src:pi});x._rcb=st.turnNo},3,T_({own:true,helpful:true}))),
 "Retrosphere":c=>c.acts.push({ink:2,sac:true,noExert:true,eff:[{k:"bounce",t:{opp:true,maxCost:3,kind:"any",kinds:["character","item","location"]}}]}),
 "Half Hexwell Crown":c=>c.acts.push({ink:2,req:(st,pi)=>st.players[pi].hand.length>0,cost:(st,pi)=>resolve(st,pi,[{k:"selfDiscard",n:1}],null,null),eff:[{k:"exert",t:T_({opp:true})}]}),
 "Elsa's Ice Palace - Place of Solitude":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(self)x.frozenBy=self.uid},(st,pi,x)=>x?instVal(x)*0.6:0,T_({opp:true,state:"exerted"}))),
 "The Library - A Gift for Belle":c=>{c.onBanishedHere=[{k:"draw",n:1,may:true}]},
 "Robin Hood - Timely Contestant":c=>{c.costFn=(st,pi)=>OWNCH(st,opp(pi)).reduce((s,y)=>s+y.damage,0)},
 "Shenzi - Scar's Accomplice":c=>c.statics.push({stat:"str",n:2,cond:"vsDamaged"}),
 "Robin Hood - Archery Contestant":c=>c.onPlay.push(FN((st,pi)=>{if(OWNCH(st,opp(pi)).some(y=>y.damage))gain(st,pi,1)},4)),
 "Ed - Hysterical Partygoer":c=>(c.auras=c.auras||[]).push({side:"own",test:(x,y)=>x===y,protectFn:a=>a.damage>0}),
 "Prince Phillip - Swordsman of the Realm":c=>c.onChallenge.push(FN((st,pi,self)=>{const d=chalDef(st);if(self&&d&&d.damage)self._readyAfter=true},3)),
 "Clarabelle - Light on Her Hooves":c=>c.onEnd.push(FN(drawToMatch,3,null,{may:true})),
 "Anna - Diplomatic Queen":c=>c.onPlay.push({k:"modal",may:true,opts:[[{k:"oppDiscard",n:1,payInk:2}],[{k:"buffStr",n:2,t:T_({own:true,helpful:true}),payInk:2}],[{k:"banish",t:T_({opp:true,state:"damaged"}),payInk:2}]],optText:["Pay 2: each opponent discards a card","Pay 2: chosen character gets +2 STR","Pay 2: banish chosen damaged character"]}),
 "Robin Hood - Sneaky Sleuth":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:(x,P,S)=>S.players[opp(x.owner)].play.filter(y=>isChar(y)&&y.damage).length}),
 "Shenzi - Head Hyena":c=>{const e=FN((st,pi,self)=>{const d=chalDef(st);if(d&&d.damage)gain(st,pi,2)},5);c.onAllyChallenge.push(FN((st,pi,self)=>{const d=chalDef(st),a=find(st,st._challenger)?.inst;if(d&&d.damage&&a&&hasCls(a,"hyena"))gain(st,pi,2)},5));c.onChallenge.push(e)},
 "Scar - Vengeful Lion":c=>{const e=FN((st,pi)=>{const d=chalDef(st);if(d&&d.damage)draw(st,pi,1)},3,null,{may:true});c.onAllyChallenge.push(e);c.onChallenge.push(e)},
 "Mother Gothel - Unwavering Schemer":c=>c.onPlay.push(FN((st,pi)=>oppPicks(st,pi,y=>retHand(st,y)),4)),
 "Hypnotic Deduction":c=>c.onPlay.push(FN((st,pi)=>{draw(st,pi,3);const P=st.players[pi];CH(st,pi,P.hand,ps=>{for(const y of ps){P.hand.splice(P.hand.indexOf(y),1);P.deck.push(y)}},{n:2,prompt:"put 2 cards from your hand on top of your deck (last chosen ends on top)",ai:by(x=>discardPri(x))})},2)),
 "You're Welcome":c=>c.onPlay.push(FN((st,pi,self,x)=>{const q=x.owner,P=st.players[q];P.play=P.play.filter(y=>y!==x);reset(x);P.deck.push(x,...x.under);x.under=[];shuffle(P.deck,st.r);draw(st,q,2)},(st,pi,x,mine)=>x?(mine?-12:instVal(x)-6):0,{kind:"any",kinds:["character","item","location"]})),
 "Remember Who You Are":c=>c.onPlay.push(FN(drawToMatch,(st,pi)=>Math.max(0,st.players[opp(pi)].hand.length-st.players[pi].hand.length)*4-2)),
 "Prince John's Mirror":c=>{c.onOppEnd=[FN((st,pi)=>{const o=st.players[opp(pi)];if(o.hand.length>3)discPick(st,opp(pi),o.hand.length-3,{byOpp:true,prompt:"Prince John's Mirror: discard down to 3 cards"})},2)]},
 "Obscurosphere":c=>c.acts.push({ink:2,sac:true,noExert:true,eff:[FN((st,pi)=>OWNCH(st,pi).forEach(y=>y.grants.push({kw:"ward",until:"srcStart",src:pi})),2)]}),
 "Emerald Chromicon":c=>c.onAllyBanished.push({eff:[FN((st,pi)=>{if(st.active===pi)return;PKs(st,pi,OWNCH(st,opp(pi)).filter(y=>!K(y,"ward")),(t)=>{if(t)retHand(st,t)},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose an opposing character"});},4,null,{may:true})]}),
 "Sherwood Forest - Outlaw Hideaway":c=>{c.moveFree=x=>x.card.name==="Robin Hood";c.statics.push({here:true,kw:"ward"},{here:true,grantAct:{ink:1,eff:[{k:"dmg",n:2,t:T_({state:"damaged",opp:true})}]}})},
 "Tropical Rainforest - Jaguar Lair":c=>(c.auras=c.auras||[]).push({side:"opp",damaged:true,kw:"reckless"}),
 "Wreck-It Ralph - Demolition Dude":c=>c.onReadyT=[FN((st,pi,self)=>{if(self)gain(st,pi,self.damage)},3)],
 "Maximus - Team Champion":c=>c.onEnd.push(FN((st,pi)=>{const m=Math.max(0,...OWNCH(st,pi).map(strOf));if(m>=10)gain(st,pi,5);else if(m>=5)gain(st,pi,2)},5)),
 "Donald Duck - Pie Slinger":c=>c.statics.push({stat:"str",n:6,cond:(x,S)=>!!S&&S.players[opp(x.owner)].lore>=10}),
 "Pete - Steamboat Rival":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(OWNCH(st,pi).some(y=>y!==self&&y.card.name==="Pete"))banish(st,x)},(st,pi,x)=>x&&OWNCH(st,pi).filter(y=>y.card.name==="Pete").length>1?instVal(x):0,T_({opp:true}),{may:true})),
 "Taffyta Muttonfudge - Sour Speedster":c=>c.onMoveSelf=[FN((st,pi,self)=>{if(!self||self.onceM===st.turnNo)return;self.onceM=st.turnNo;gain(st,pi,2)},6)],
 "Robin Hood - Sharpshooter":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-4));PKs(st,pi,top.filter(y=>(y.card.type==="action"||y.card.type==="song")&&y.card.cost<=6),(a)=>{P.discard.push(...top.filter(y=>y!==a));if(a){P.hand.push(a);playFree(st,pi,a)}},{ai:srt((p,q)=>q.card.cost-p.card.cost),prompt:"choose a card"});},4)),
 "Gaston - Pure Paragon":c=>{c.costFn=(st,pi)=>2*OWNCH(st,pi).filter(y=>y.damage).length},
 "Vanellope von Schweetz - Random Roster Racer":c=>c.onPlay.push(FN((st,pi,self)=>{if(self)self.grants.push({kw:"evasive",until:"srcStart",src:pi})},2)),
 "Minnie Mouse - Dazzling Dancer":c=>{c.onChallenge.push({k:"gainLore",n:1});c.onAllyChallenge.push(FN((st,pi)=>{const a=find(st,st._challenger)?.inst;if(a&&a.card.name==="Mickey Mouse")gain(st,pi,1)},3))},
 "Break Free":c=>c.onPlay.push(FN((st,pi,self,x)=>{damage(st,x,1);if(find(st,x.uid)?.zone==="play"){x.grants.push({kw:"rush",until:"turnEnd",src:pi});x.tStr+=1}},(st,pi,x)=>x&&!dry(st,x)&&wilOf(x)-x.damage>1?4:-2,T_({own:true,helpful:true}))),
 "Evil Comes Prepared":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.exerted=false;x.noQuest=true;if(hasCls(x,"villain"))gain(st,pi,1)},(st,pi,x)=>x?(x.exerted?2:0)+(hasCls(x,"villain")?6:0):0,T_({own:true,helpful:true}))),
 "Who's With Me?":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];(P.hooks=P.hooks||[]).push({on:"challenge",test:x=>K(x,"reckless"),eff:[{k:"gainLore",n:2}]})},(st,pi)=>OWNCH(st,pi).filter(y=>K(y,"reckless")).length*8)),
 "Potion of Might":c=>c.acts.push({ink:1,sac:true,noExert:true,eff:[FN((st,pi,self,x)=>{x.tStr+=hasCls(x,"villain")?4:3},2,T_({own:true,helpful:true}))]}),
 "The Sword Released":c=>c.onStart.push(FN((st,pi)=>{const m=Math.max(-1,...OWNCH(st,pi).map(strOf)),o=Math.max(-1,...OWNCH(st,opp(pi)).map(strOf));if(OWNCH(st,pi).length&&m>o)gain(st,pi,loseLore(st,st.players[opp(pi)],1))},5)),
 "Sugar Rush Speedway - Starting Line":c=>c.acts.push({ink:0,noExert:true,once:true,req:(st,pi,x)=>hereChars(st,x).some(y=>!y.exerted)&&st.players[pi].play.filter(isLoc).length>1,eff:[FN((st,pi,self)=>{PKs(st,pi,hereChars(st,self).filter(z=>!z.exerted),y=>{if(!y)return;PKs(st,pi,st.players[pi].play.filter(z=>isLoc(z)&&z!==self),l=>{if(!l)return;y.exerted=true;damage(st,y,1);if(find(st,y.uid)?.zone==="play")doMove(st,pi,y,l)},{prompt:`move ${y.card.name} to which location?`,ai:l2=>[l2[0]]})},{prompt:"choose a ready character here",ai:l=>[l[0]]})},(st,pi)=>0)]}),
 "Ratigan's Party - Seedy Back Room":c=>c.statics.push({stat:"lore",n:2,cond:(l,S)=>!!S&&hereChars(S,l).some(y=>y.damage)}),
 "Pacha - Emperor's Guide":c=>c.onStart.push(FN((st,pi)=>{if(st.players[pi].play.some(isItem))gain(st,pi,1)},4)),
 "The Queen - Fairest of All":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:(x,P)=>P.play.filter(y=>y!==x&&y.card.name==="The Queen").length}),
 "Sheriff of Nottingham - Bushel Britches":c=>{c.costFn=(st,pi)=>st.players[pi].play.filter(isItem).length},
 "Chicha - Dedicated Mother":c=>{c.onInk.push(FN((st,pi)=>{if(st.players[pi].inkN===2)draw(st,pi,1)},3,null,{may:true}))},
 "Prince John - Gold Lover":c=>c.acts.push({ink:0,req:(st,pi)=>{const P=st.players[pi];return P.hand.concat(P.discard).some(y=>isItem(y)&&y.card.cost<=5)},eff:[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.hand.concat(P.discard).filter(z=>isItem(z)&&z.card.cost<=5),(y)=>{if(!y)return;if(P.discard.includes(y))toHandFrom(P,"discard",y);playFree(st,pi,y,true)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},5)]}),
 "The Queen - Crown of the Council":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-3));for(const y of top){if(isChar(y)&&y.card.name==="The Queen")P.hand.push(y);else P.deck.unshift(y)}},3)),
 "Kuzco - Selfish Emperor":c=>c.acts.push({ink:4,noExert:true,eff:[FN((st,pi,self)=>OWNCH(st,pi).forEach(y=>{if(y!==self)y.grants.push({kw:"resist 1",until:"srcStart",src:pi})}),(st,pi)=>OWNCH(st,pi).length-2)]}),
 "Mufasa - Ruler of Pride Rock":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];P.ink.forEach(y=>y.exerted=true);for(let k=0;k<2&&P.ink.length;k++){const y=P.ink.splice(Math.floor(st.r()*P.ink.length),1)[0];y.exerted=false;P.hand.push(y)}},1)),
 "King Candy - Sweet Abomination":c=>c.onPlay.push(FN((st,pi)=>{draw(st,pi,2);const P=st.players[pi];PKs(st,pi,P.hand,y=>{if(y){P.hand.splice(P.hand.indexOf(y),1);P.deck.unshift(y)}},{prompt:"put a card from your hand on the bottom of your deck",ai:by(x=>discardPri(x))})},4,null,{may:true})),
 "Merlin - Intellectual Visionary":c=>c.onPlay.push({k:"cond",shifted:true,eff:[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.deck,(y)=>{if(y){P.deck.splice(P.deck.indexOf(y),1);P.hand.push(y)}shuffle(P.deck,st.r)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card"});},5,null,{may:true})]}),
 "Royal Tantrum":c=>c.onPlay.push(FN((st,pi)=>{const its=st.players[pi].play.filter(y=>isItem(y)&&(y.exerted||!y.card.acts.length)&&!y.card.auras&&!y.card.statics.length);its.forEach(y=>banish(st,y));draw(st,pi,its.length)},(st,pi)=>st.players[pi].play.filter(isItem).length*3-2)),
 "Ever as Before":c=>c.onPlay.push({k:"healAll",n:2}),
 "Medal of Heroes":c=>c.acts.push({ink:2,sac:true,eff:[{k:"buffLore",n:2,t:T_({own:true,helpful:true})}]}),
 "Sapphire Chromicon":c=>c.acts.push({ink:2,req:(st,pi,x)=>st.players[pi].play.some(y=>isItem(y)&&y!==x),cost:(st,pi,x)=>{sacOwn(st,pi,z=>isItem(z)&&z!==x)},eff:[{k:"gainLore",n:2}]}),
 "The Great Illuminary - Radiant Ballroom":c=>c.statics.push({here:true,test:x=>!!x.card.kw.support,stat:"lore",n:1},{here:true,test:x=>!!x.card.kw.support,stat:"wil",n:2}),
 "Merlin's Cottage - The Wizard's Home":c=>{},
 "Jafar - Tyrannical Hypnotist":c=>(c.auras=c.auras||[]).push({side:"opp",maxCost:4,block:"challenge"}),
 "Namaari - Resolute Daughter":c=>{c.costFn=(st,pi)=>{const P=st.players[pi];return P.oppChalBanT===st.turnNo?2*P.oppChalBan:0}},
 "Snow White - Fair-Hearted":c=>c.statics.push({kwPer:"resist",count:(x,P)=>P.play.filter(y=>y!==x&&hasCls(y,"knight")).length}),
 "Yzma - Unjustly Treated":c=>{c.onAllyBanishOther=[FN((st,pi)=>{if(st.active===pi)dmgBest(st,pi,1)},2,null,{may:true})]},
 "Grumpy - Skeptical Knight":c=>(c.auras=c.auras||[]).push({side:"own",cls:"knight",test:x=>x.at!=null,kw:"resist 2"}),
 "Pete - Wrestling Champ":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>revealTopIf(st,pi,y=>isChar(y)&&y.card.name==="Pete",(y,P)=>{P.hand.push(y);playFree(st,pi,y)}),2)]}),
 "Doc - Bold Knight":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];P.discard.push(...P.hand);P.hand=[];draw(st,pi,2)},(st,pi)=>st.players[pi].hand.length<=2?3:-6,null,{may:true})),
 "Arthur - King Victorious":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.grants.push({kw:"challenger 2",until:"turnEnd",src:pi},{kw:"resist 2",until:"turnEnd",src:pi});x.chReady=st.turnNo},3,T_({own:true,helpful:true}))),
 "Pete - Games Referee":c=>c.onPlay.push(FN((st,pi)=>{st.players[opp(pi)].noActionsT=st.turnNo+1},3)),
 "Tug-of-War":c=>{c.onPlay=[{k:"modal",opts:[[FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>!K(y,"evasive")).forEach(y=>damage(st,y,1)),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>!K(y,"evasive")).length*2)],[FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>K(y,"evasive")).forEach(y=>damage(st,y,3)),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>K(y,"evasive")).length*5)]],optText:["1 damage to each opposing character without Evasive","3 damage to each opposing character with Evasive"]}]},
 "Food Fight!":c=>c.onPlay.push(FN((st,pi)=>{st.players[pi].tempAct={t:st.turnNo,ab:{ink:1,eff:[{k:"dmg",n:1,t:T_({opp:true})}]}}},(st,pi)=>OWNCH(st,pi).filter(y=>!y.exerted).length*2)),
 "Bad-Anon - Villain Support Center":c=>c.statics.push({here:true,test:x=>hasCls(x,"villain"),grantAct:{ink:3,req:(st,pi,x)=>st.players[pi].hand.some(h=>h.card.name===x.card.name&&isChar(h)),eff:[FN((st,pi)=>{const P=st.players[pi],s0=find(st,st._src)?.inst;if(!s0)return;PKs(st,pi,P.hand.filter(z=>z.card.name===s0.card.name&&isChar(z)),h=>{if(h)playFree(st,pi,h)},{prompt:"choose a card with the same name to play for free",ai:srt((a,b)=>b.card.cost-a.card.cost)})},5)]}}),
 "Seven Dwarfs' Mine - Secure Fortress":c=>{c.onMoveHere=[FN((st,pi)=>dmgBest(st,pi,hasCls(st._ctx,"knight")?2:1),3,null,{may:true})]},
});

const each2=(st,f)=>{for(const q of [0,1])f(q,st.players[q])};
const discOne=(st,q,then)=>{const P=st.players[q];if(!P.hand.length){if(then)then(null);return}discPick(st,q,1,{then:ps=>{if(then)then(ps[0]||null)},prompt:"Choose a card to discard",byOpp:CUR&&CUR._discBy!=null&&CUR._discBy!==q})};
const mill=(P,n)=>{for(let k=0;k<n&&P.deck.length;k++)P.discard.push(P.deck.pop())};
const D2=(st,pi)=>discThisTurn(st,st.players[pi])>=2;
const allGyToDeck=(st,test)=>each2(st,(q,P)=>{const cs=P.discard.filter(test);P.discard=P.discard.filter(y=>!cs.includes(y));P.deck.push(...cs);shuffle(P.deck,st.r)});
Object.assign(DEFS_EXTRA,{
 "Lilo - Escape Artist":c=>{c.onStartDiscard=[FN((st,pi,self,x,ctx)=>{},0)];c.gyStart=true},
 "Dale - Mischievous Ranger":c=>c.onPlay.push(FN((st,pi,self,x)=>{mill(st.players[pi],3);x.lStr=(x.lStr||0)-3;x.lSrc=pi},(st,pi,x)=>x?3:0,T_({opp:true}),{may:true})),
 "A Very Merry Unbirthday":c=>c.onPlay.push(FN((st,pi)=>mill(st.players[opp(pi)],2),1)),
 "Lose the Way":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.exerted=true;if(st.players[pi].hand.length>3&&discOne(st,pi))x.noReady=true},4,T_({opp:true}))),
 "Mad Hatter's Teapot":c=>{c.acts=[{ink:1,eff:[FN((st,pi)=>mill(st.players[opp(pi)],1),1)]}]},
 "Honey Lemon - Chemical Genius":c=>c.onPlay.push({k:"pay",n:2,may:true,eff:[{k:"oppDiscard",n:1}]}),
 "Bend to My Will":c=>c.onPlay.push(FN((st,pi)=>{const o=st.players[opp(pi)];if(o.play.some(y=>y.card.noDiscardOpp||y.card.noSelfDiscard))return;const n=o.hand.length;o.discard.push(...o.hand);o.hand=[];if(n)fire(st,pi,"onOppDiscard",n)},(st,pi)=>st.players[opp(pi)].hand.length*3)),
 "Perilous Maze - Watery Labyrinth":c=>{c.onChallengedHere=[{k:"oppDiscard",n:1}]},
 "Kakamora - Pirate Chief":c=>c.onQuest.push(FN((st,pi)=>{draw(st,pi,1);discOne(st,pi,y=>{if(y)dmgBest(st,pi,isChar(y)&&hasCls(y,"pirate")?3:1)})},3,null,{may:true})),
 "Tramp - Street-Smart Dog":c=>c.onPlay.push(FN((st,pi,self)=>{const n=OWNCH(st,pi).filter(y=>y!==self).length;draw(st,pi,n);for(let k=0;k<n;k++)discOne(st,pi)},2,null,{may:true})),
 "Fix-It Felix, Jr. - Pint-Sized Hero":c=>{c.onLeaveDiscard=[FN((st,pi)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>hasCls(z,"racer")&&z.exerted),y=>{if(y){y.exerted=false;y.noQuest=true}},{prompt:"ready one of your Racer characters",ai:l=>[l[0]]})},1,null,{may:true})]},
 "Madame Medusa - Diamond Lover":c=>c.onQuest.push(FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self),y=>{if(y){damage(st,y,2);mill(st.players[opp(pi)],3)}},{prompt:"deal 2 damage to another of your characters",ai:l=>[l.find(z=>wilOf(z)-z.damage>2)]})},0,null,{may:true})),
 "Kronk - Laid Back":c=>{c.noSelfDiscard=true;c.noDiscardOpp=true},
 "Yzma - Above It All":c=>{c.onAnyBanished=[FN((st,pi)=>{const x=st._ctx;if(st._challenger==null||!x)return;const f=find(st,x.uid);if(!f||f.zone!=="discard")return;const P=st.players[f.pi];toHandFrom(P,"discard",x);if(P.hand.length){const y=P.hand[Math.floor(st.r()*P.hand.length)];P.hand.splice(P.hand.indexOf(y),1);P.discard.push(y)}},1)]},
 "Kuzco - Panicked Llama":c=>c.onStart.push({k:"modal",opts:[[FN((st,pi)=>{draw(st,pi,1);draw(st,opp(pi),1)},1)],[FN((st,pi)=>{discOne(st,pi);discOne(st,opp(pi))},1)]],optText:["Each player draws a card","Each player discards a card"]}),
 "The Queen - Jealous Beauty":c=>c.acts.push({ink:0,req:(st,pi)=>st.players[opp(pi)].discard.length>=3,eff:[FN((st,pi)=>{const o=st.players[opp(pi)],cs=o.discard.splice(-3);o.deck.unshift(...cs);gain(st,pi,cs.some(y=>hasCls(y,"princess"))?4:3)},18)]}),
 "Belle - Mechanic Extraordinaire":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi];CH(st,pi,P.discard.filter(isItem),cs=>{P.discard=P.discard.filter(y=>!cs.includes(y));P.deck.unshift(...cs);gain(st,pi,cs.length)},{n:3,min:0,always:true,prompt:"put up to 3 items from your discard on the bottom of your deck",ai:(l,n)=>l.slice(0,n)})},6,null,{may:true})),
 "Cogsworth - Climbing Clock":c=>c.statics.push({stat:"str",n:2,cond:(x,S)=>!!S&&S.players[x.owner].discard.some(isItem)}),
 "Lumiere - Nimble Candelabra":c=>c.statics.push({kw:"evasive",cond:(x,S)=>!!S&&S.players[x.owner].discard.some(isItem)}),
 "Bolt - Headstrong Dog":c=>c.onQuest.push(FN((st,pi,self)=>{if(self&&!self.damage){draw(st,pi,1);discOne(st,pi)}},2,null,{may:true})),
 "Elsa - Fierce Protector":c=>c.acts.push({ink:1,noExert:true,req:(st,pi)=>st.players[pi].hand.length>0,cost:(st,pi)=>discOne(st,pi),eff:[{k:"exert",t:T_({opp:true})}]}),
 "Flynn Rider - Breaking and Entering":c=>c.onChallenged.push(FN((st,pi)=>{const o=st.players[opp(pi)];if(o.hand.length>=4)discOne(st,opp(pi));else gain(st,pi,2)},6)),
 "Wrong Lever!":c=>{c.onPlay=[parseOne0("return chosen character to their player's hand")]},
 "Geppetto - Skilled Craftsman":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi],its=P.hand.filter(isItem).filter(y=>y.card.cost>=4||P.ink.length>=6);P.hand=P.hand.filter(y=>!its.includes(y));P.discard.push(...its);gain(st,pi,its.length)},3,null,{may:true})),
 "Namaari - Single-Minded Rival":c=>c.statics.push({stat:"str",per:1,cond:"always",count:(x,P)=>P.discard.length}),
 "Desperate Plan":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];if(!P.hand.length)draw(st,pi,3);else{const bad=P.hand.filter(y=>discardPri(y)>0);P.hand=P.hand.filter(y=>!bad.includes(y));P.discard.push(...bad);draw(st,pi,bad.length)}},3)),
 "Beyond the Horizon":c=>c.onPlay.push(FN((st,pi)=>{for(const q of [pi,opp(pi)]){const P=st.players[q];if(q===pi&&P.hand.length>=3)continue;if(q!==pi&&P.hand.length<3)continue;P.discard.push(...P.hand);P.hand=[];draw(st,q,3)}},3)),
 "The Queen - Conceited Ruler":c=>c.onStart.push(FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.hand.filter(y=>isChar(y)&&(hasCls(y,"princess")||hasCls(y,"queen"))),h=>{if(!h)return;PKs(st,pi,P.discard.filter(g=>isChar(g)&&g.card.cost>h.card.cost),(g)=>{if(g&&P.hand.includes(h)){P.hand.splice(P.hand.indexOf(h),1);P.discard.push(h);toHandFrom(P,"discard",g)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"return a character with higher cost from your discard"})},{prompt:"choose a Princess or Queen to discard",ai:srt((a,b)=>a.card.cost-b.card.cost)})},2,null,{may:true})),
 "Scar - Finally King":c=>c.onEnd.push(FN((st,pi,self)=>{if(!self||!self.exerted)return;PKs(st,pi,OWNCH(st,pi).filter(y=>hasCls(y,"ally")),(a)=>{if(a){draw(st,pi,strOf(a));discOne(st,pi);discOne(st,pi)}},{ai:srt((p,q)=>strOf(q)-strOf(p)),prompt:"choose one of your characters"});},3,null,{may:true})),
 "Search for Clues":c=>c.onPlay.push(FN((st,pi)=>{const a=st.players[pi].hand.length,b=st.players[opp(pi)].hand.length;if(b>=a){discOne(st,opp(pi));discOne(st,opp(pi))}if(a>=b){discOne(st,pi);discOne(st,pi)}if(OWNCH(st,pi).some(y=>hasCls(y,"detective")))gain(st,pi,1)},3)),
 "The Black Cauldron":c=>c.acts.push({ink:1,req:(st,pi)=>st.players[pi].discard.some(isChar),eff:[FN((st,pi,self)=>{const P=st.players[pi],y=P.discard.filter(isChar).pop();if(y&&self){P.discard.splice(P.discard.indexOf(y),1);self.under.push(y)}},1)]}),
 "The Horned King - Wicked Ruler":c=>c.onAllyBanished.push({inChal:true,eff:[FN((st,pi)=>{const P=st.players[pi],b=st._banished;if(b&&P.discard.includes(b)){toHandFrom(P,"discard",b);discOne(st,pi)}},3,null,{may:true})]}),
 "The Horned King - Triumphant Ghoul":c=>c.statics.push({stat:"lore",n:2,cond:(x,S)=>!!S&&S.active===x.owner&&S.leftT===S.turnNo}),
 "Coldstone - Reincarnated Cyborg":c=>c.onPlay.push(FN((st,pi)=>{if(st.players[pi].discard.filter(y=>isChar(y)&&hasCls(y,"gargoyle")).length>=2)gain(st,pi,2)},5)),
 "Baloo - Carefree Bear":c=>c.onPlay.push({k:"modal",opts:[[FN((st,pi)=>{draw(st,pi,1);draw(st,opp(pi),1)},1)],[FN((st,pi)=>{discOne(st,pi);discOne(st,opp(pi))},1)]],optText:["Each player draws a card","Each player discards a card"]}),
 "Goldie O'Gilt - Cunning Prospector":c=>c.onQuest.push(FN((st,pi)=>{const L=[...st.players[opp(pi)].discard.filter(isLoc),...st.players[pi].discard.filter(isLoc)];PKs(st,pi,L,y=>{if(!y)return;const P=st.players[y.owner];if(!P.discard.includes(y))return;P.discard.splice(P.discard.indexOf(y),1);P.deck.unshift(y);gain(st,pi,1)},{prompt:"put a location from a discard on the bottom of its deck",ai:l=>[l[0]]})},4,null,{may:true})),
 "Trust In Me":c=>{c.onPlay=[{k:"modal",opts:[[FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>{y.lStr=(y.lStr||0)-1;y.lSrc=pi}),(st,pi)=>OWNCH(st,opp(pi)).length*1.5)],[{k:"oppDiscard",n:2}]],optText:["Opposing characters get -1 STR","Each opponent discards 2 cards"]}]},
 "Pluto - Clever Cluefinder":c=>c.acts.push({ink:0,req:(st,pi)=>st.players[pi].discard.some(isItem),eff:[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(isItem),(y)=>{if(!y)return;if(OWNCH(st,pi).some(z=>hasCls(z,"detective")))toHandFrom(P,"discard",y);else{P.discard.splice(P.discard.indexOf(y),1);P.deck.push(y)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},2)]}),
 "Goliath - Clan Leader":c=>{const f=FN((st,pi)=>{const q=st.active,P=st.players[q];if(P.hand.length>2)discPick(st,q,P.hand.length-2,{prompt:"Discard down to 2 cards"});else if(P.hand.length<2)draw(st,q,2-P.hand.length)},1);c.onEnd.push(f);c.onOppEnd=[f]},
 "The Headless Horseman - Cursed Rider":c=>c.onPlay.push(FN((st,pi)=>{let acts=0;for(const q of [pi,opp(pi)]){draw(st,q,3);const P=st.players[q];for(let k=0;k<3&&P.hand.length;k++){const y=P.hand.splice(Math.floor(st.r()*P.hand.length),1)[0];P.discard.push(y);if(q===pi&&(y.card.type==="action"||y.card.type==="song"))acts++}}for(let k=0;k<acts;k++)dmgBest(st,pi,2)},3)),
 "Ingenious Device":c=>c.acts.push({ink:2,sac:true,eff:[{k:"loot",n:1,d:1}]}),
 "Zootopia - Police Headquarters":c=>{c.onMoveHere=[{k:"loot",n:1,d:1,may:true}]},
 "Taran - Magically Armed":c=>c.onPlay.push({k:"gyHate"},{k:"gyHate"}),
 "Meeko - Skittish Scrounger":c=>c.onEnd.push(FN((st,pi,self)=>{if(!self||!self.exerted)return;if(st.players[pi].hand.length&&!st.players[pi].play.some(y=>y.card.noSelfDiscard))discOne(st,pi);else banish(st,self)},-2)),
 "Anna - Soothing Sister":c=>{c.shiftFreeIf=(st,pi)=>st.leftT===st.turnNo;c.onQuest.push(FN((st,pi,self)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(isChar),(y)=>{if(y){gain(st,pi,y.card.lore);P.discard.splice(P.discard.indexOf(y),1);P.deck.unshift(y)}},{ai:srt((a,b)=>b.card.lore-a.card.lore),prompt:"choose a card from your discard"});},4,null,{may:true}))},
 "Kristoff - Icy Explorer":c=>{c.onLeaveDiscard=[FN((st,pi,self)=>{if(!self||self.onceLD===st.turnNo||st.active!==pi)return;self.onceLD=st.turnNo;draw(st,pi,1)},3)]},
 "Heihei - Persistent Presence":c=>{c._rcbAlways=true},
 "The Frozen Vine - Monstrous Plant":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const y=ctx.src,P=st.players[pi];if(y&&y._hadEx&&P.discard.includes(y))toHandFrom(P,"discard",y)},2)),
 "Goofy - Ghost of Jacob Marley":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const n=(ctx.src&&ctx.src._underN)||0;for(let k=0;k<n;k++)discOne(st,opp(pi))},2)),
 "Snowball Fight":c=>c.onPlay.push({k:"oppDiscard",n:1},FN((st,pi)=>{if(OWNCH(st,pi).some(y=>K(y,"evasive")))gain(st,pi,1)},4)),
 "Freeze the Vine":c=>c.onPlay.push(FN((st,pi)=>each2(st,(q,P)=>P.play.filter(isLoc).forEach(y=>banish(st,y))),(st,pi)=>st.players[opp(pi)].play.filter(isLoc).length*6-st.players[pi].play.filter(isLoc).length*6),{k:"loot",n:2,d:1}),
 "Moana - Curious Explorer":c=>{c.inkFromDiscard=true},
 "Launchpad - Trusty Sidekick":c=>c.acts.push({ink:0,eff:[FN((st,pi)=>{draw(st,pi,1);if(!OWNCH(st,pi).some(y=>y.card.name==="Darkwing Duck"))discOne(st,pi)},2)]}),
 "Angel - Experiment 624":c=>c.acts.push({ink:0,noExert:true,once:true,req:(st,pi)=>st.players[pi].hand.length>0,cost:(st,pi)=>discOne(st,pi),eff:[{k:"dmg",n:2,t:T_({opp:true})}]}),
 "Containment Unit":c=>c.onStart.push(FN((st,pi,self)=>{if(st.players[pi].hand.length>2)discOne(st,pi);else if(self)banish(st,self)},-1)),
 "DunBroch Family Tapestry":c=>c.acts.push({ink:0,sac:true,eff:[FN(st=>allGyToDeck(st,isChar),1)]}),
 "Milo Thatch - Getting His Hands Dirty":c=>c.onEnd.push(FN((st,pi)=>{if(D2(st,pi))draw(st,pi,1)},3)),
 "Lyle Tiberius Rourke - Adventurer for Hire":c=>c.onEnd.push(FN((st,pi)=>{if(D2(st,pi))loseLore(st,st.players[opp(pi)],1)},3)),
 "Helga Sinclair - Prepared for Anything":c=>c.onQuest.push(FN((st,pi,self,x)=>damage(st,x,D2(st,pi)?2:1),3,T_({opp:true}))),
 "Milo Thatch - Courageous Explorer":c=>c.statics.push({stat:"lore",n:1,cond:(x,S)=>!!S&&S.active===x.owner&&D2(S,x.owner)}),
 "Jack-Jack Parr - Incredible Potential":c=>c.onStart.push(FN((st,pi,self)=>{const P=st.players[pi],y=P.deck.pop();if(!y)return;P.discard.push(y);if(self){if(isChar(y))self.tStr+=2;else if(y.card.type==="action"||y.card.type==="song")self.tLore+=1;else self.grants.push({kw:"resist 1",until:"turnEnd",src:pi})}},1,null,{may:true})),
 "The Leviathan - Guardian of Atlantis":c=>c.onPlay.push(FN((st,pi)=>{if(!D2(st,pi))return;const step=left=>CH(st,pi,OWNCH(st,opp(pi)).filter(y=>strOf(y)<=left),(p,y)=>{if(!y)return;const s0=strOf(y);banish(st,y);step(left-s0)},{optional:true,always:true,prompt:`banish opposing characters with total strength up to 10 (${left} left; skip to stop)`,ai:l=>{const y=l.slice().sort((a,b)=>instVal(b)-instVal(a))/*nc:ai-order*/[0];return y?[y]:[]}});step(10)},8,null,{may:true})),
 "Firefly Swarm":c=>{c.onPlay=[{k:"modal",opts:[[{k:"banish",t:T_({opp:true,maxStr:2})}],[FN((st,pi,self,x)=>{if(discThisTurn(st,st.players[pi])>=3)banish(st,x)},(st,pi,x)=>x&&discThisTurn(st,st.players[pi])>=3?instVal(x):-5,T_({opp:true}))]],optText:["Banish chosen character with 2 STR or less","If 2+ other cards were discarded this turn, banish chosen character"]}]},
 "Dangerous Plan":c=>c.onPlay.push(FN((st,pi)=>{draw(st,pi,2);const P=st.players[pi];if(P.hand.length){P.discard.push(P.hand.splice(Math.floor(st.r()*P.hand.length),1)[0])}},3)),
 "Escape Plan":c=>{c.playReq=(st,pi)=>D2(st,pi)},
 "Salvage Operation":c=>c.onPlay.push(FN((st,pi)=>{fromDiscardToHand(st,pi,isItem);if(OWNCH(st,pi).some(y=>wilOf(y)>=4))gain(st,pi,1)},4)),
 "Shepherd's Journal":c=>c.acts.push({ink:1,sac:true,noExert:true,req:(st,pi)=>st.players[pi].discard.some(isItem),eff:[FN((st,pi)=>fromDiscardToHand(st,pi,isItem),3)]}),
 "Syndrome's Remote":c=>{c.onAnyBanished=[FN((st,pi,self)=>{const x=st._ctx;if(!self||!x||!hasCls(x,"robot"))return;const P=st.players[pi];if(P.hand.length>2)return;banish(st,self);P.discard.push(...P.hand);P.hand=[];draw(st,pi,2)},2,null,{may:true})]},
 "Peter Pan - Created by the Vine":c=>{c.onAllyChallenged=[FN((st,pi)=>{const d=chalDef(st);if(d&&hasCls(d,"floodborn"))discOne(st,opp(pi))},3)]},
 "Rapunzel - Escaping the Tower":c=>c.acts.push({ink:0,noExert:true,once:true,req:(st,pi)=>st.players[pi].hand.length>0,cost:(st,pi)=>discOne(st,pi),eff:[FN((st,pi,self)=>{if(self){self.tLore+=1;self.grants.push({kw:"evasive",until:"srcStart",src:pi})}},(st,pi)=>st.players[pi].hand.length>3?4:-2)]}),
 "Merlin - Envisioning the Future":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const y=ctx.src,P=st.players[pi];if(y&&P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);P.deck.unshift(y)}},0)),
 "Quackerjack - Loony Toymaker":c=>{const f=FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-4));P.discard.push(...top);for(const y of top)if(isItem(y))dmgBest(st,pi,1)},2);c.onPlay.push(f);c.onQuest.push(f)},
 "Violet Parr - Super Resilient":c=>{const e={k:"loot",n:1,d:1,may:true};c.onPlay.push(e);c.onYouPlay.push({type:"character",test:(st,pi,x)=>hasCls(x,"hero"),eff:[e]})},
 "Sprout - Experiment 509":c=>c.onPlay.push(FN((st,pi,self,x)=>{const P=st.players[pi];discPick(st,pi,1,{test:y=>(isChar(y)&&hasCls(y,"alien"))||isLoc(y),prompt:"discard an Alien character or a location",ai:l=>[l[0]],then:ps=>{if(ps.length)damage(st,x,2)}})},(st,pi,x)=>st.players[pi].hand.some(y=>(isChar(y)&&hasCls(y,"alien"))||isLoc(y))&&x?3:-2,T_({opp:true}),{may:true})),
 "Flynn Rider - High-Climbing Rogue":c=>{c.onChosen=[FN((st,pi)=>discOne(st,opp(pi)),2)]},
 "Kronk - Meat Hut Cook":c=>c.acts.push({ink:1,noExert:true,once:true,eff:[{k:"loot",n:1,d:1}]}),
 "Discarded Armor":c=>c.acts.push({ink:0,eff:[FN((st,pi,self,x)=>{if(discThisTurn(st,st.players[pi])>=1)x.grants.push({kw:"resist 1",until:"srcStart",src:pi})},1,T_({own:true,helpful:true}))]}),
});

Object.assign(DEFS_EXTRA,{
 "Pixie Dust":c=>{c.acts=[{ink:2,eff:[{k:"grantMulti",kws:["challenger 2","evasive"],long:true,lore:0,str:0,t:T_({own:true,helpful:true})}]}]},
 "Scar - Heartless Hunter":c=>DEFS_EXTRA["Teeth and Ambitions"](c),
 "Baymax's Healthcare Chip":c=>{c.acts=[{ink:0,eff:[FN((st,pi,self,x)=>{if(noHeal(st))return;const n=OWNCH(st,pi).some(y=>hasCls(y,"robot"))?3:1;const r0=Math.min(n,x.damage);x.damage-=r0;if(r0)(st.players[x.owner].healT=st.turnNo),(st._ctx=x),fire(st,x.owner,"onHealAny",x),fire(st,x.owner,"onHeal",r0)},(st,pi,x,mine)=>x&&mine?Math.min(x.damage,3)*2:-1,T_({own:true,helpful:true}))]}]},
 "Microbots":c=>{c.anyCopies=true;c.onPlay.push(FN((st,pi,self,x)=>{x.tStr-=st.players[pi].play.filter(y=>y.card.name==="Microbots").length},1,T_({opp:true})))},
 "Mirabel Madrigal - Hopeful Dreamer":c=>{c.kw.evasive=true;c.kw.singer=5},
 "Penny - Bolt's Person":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(!noHeal(st))x.damage=Math.max(0,x.damage-2);x.grants.push({kw:"resist 1",until:"srcStart",src:pi})},(st,pi,x,mine)=>mine?2+Math.min(2,x?x.damage:0)*2:-2,T_({own:true,helpful:true}),{may:true})),
 "The Glass Slipper":c=>{c.maxCopies=2},
 "Donald Duck - Flustered Sorcerer":c=>{c.win25=true},
 "Dolores Madrigal - Within Earshot":c=>{c.onAllySing=[FN((st,pi)=>revealHand(st,pi,opp(pi),"Dolores Madrigal: opponent's hand"),0)]},
 "Hiro Hamada - Armor Designer":c=>(c.auras=c.auras||[]).push({side:"own",cls:"floodborn",test:x=>x.under.length>0,kw:"evasive"},{side:"own",cls:"floodborn",test:x=>x.under.length>0,kw:"ward"}),
 "Stabbington Brother - Without a Patch":c=>{c.kw.rush=true;(c.auras=c.auras||[]).push({side:"own",other:true,name:["stabbington brother"],kw:"rush"})},
 "Mushu - Majestic Dragon":c=>(c.auras=c.auras||[]).push({side:"own",test:(x,y,S)=>S._challenger===x.uid,kw:"resist 2"}),
 "Gantu - Experienced Enforcer":c=>{c.taxAI=true},
 "Joey - Blue Pigeon":c=>c.onQuest.push(FN((st,pi)=>{if(!noHeal(st))OWNCH(st,pi).filter(y=>K(y,"bodyguard")).forEach(y=>y.damage=Math.max(0,y.damage-1))},1,null,{may:true})),
 "She's Your Person":c=>{c.onPlay=[{k:"modal",opts:[[{k:"heal",n:3,t:T_({own:true,helpful:true})}],[FN((st,pi)=>{if(!noHeal(st))OWNCH(st,pi).filter(y=>K(y,"bodyguard")).forEach(y=>y.damage=Math.max(0,y.damage-3))},(st,pi)=>OWNCH(st,pi).filter(y=>K(y,"bodyguard")).reduce((s,y)=>s+Math.min(3,y.damage),0)*2)]],optText:["Remove up to 3 damage from chosen character","Remove up to 3 damage from each of your Bodyguard characters"]}]},
 "Thumper - Young Bunny":c=>{c.acts=[{ink:0,eff:[{k:"buffStr",n:3,t:T_({own:true,helpful:true})}]}]},
 "Mushu - Your Worst Nightmare":c=>c.onYouPlay.push({type:"character",test:(st,pi,x,y)=>x!==y,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.play[P.play.length-1];if(y&&isChar(y))["rush","reckless","evasive"].forEach(kw=>y.grants.push({kw,until:"turnEnd",src:pi}))},3)]}),
 "Prince John - Fraidy-Cat":c=>{c.onOppPlayChar=[FN((st,pi,self)=>{if(self)damage(st,self,1)},-1)]},
 "Nathaniel Flint - Notorious Pirate":c=>{c.playReq=(st,pi)=>st.players[opp(pi)].dmgT===st.turnNo},
 "Hamster Ball":c=>{c.acts=[{ink:1,eff:[{k:"grant",kw:"resist 2",long:true,t:T_({own:true,helpful:true,state:"undamaged"})}]}]},
 "The Magic Feather":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(self)x.featherBy=self.uid},2,T_({own:true,helpful:true}))),
 "Powerline - Musical Superstar":c=>c.statics.push({kw:"rush",cond:(x,S)=>!!S&&S.players[x.owner].songTurn===S.turnNo}),
 "Rapunzel - Ready for Adventure":c=>{c.onSupportChosen=[FN((st,pi)=>{const y=st._ctx;if(y){y.supShieldT=st.turnNo;y._supUsed=false}},2)]},
 "Scrooge McDuck - On the Right Track":c=>c.onPlay.push({k:"buffLore",n:1,t:T_({own:true,helpful:true,test:x=>x.under.length>0})}),
 "Hans - Brazen Manipulator":c=>(c.auras=c.auras||[]).push({side:"all",test:x=>hasCls(x,"king")||hasCls(x,"queen"),block:"quest"}),
 "Hercules - Mighty Leader":c=>{c.dmgImmune=(st,x,inChal)=>!inChal},
 "Detective's Badge":c=>{c.acts=[{ink:1,eff:[FN((st,pi,self,x)=>{x.grants.push({kw:"resist 1",until:"srcStart",src:pi});x.tmpCls={c:"detective",until:st.turnNo+1}},2,T_({own:true,helpful:true}))]}]},
 "Robin Hood - Ephemeral Archer":c=>c.onQuest.push(FN((st,pi,self)=>{if(self&&self.under.length){dmgBest(st,pi,1);dmgBest(st,pi,1)}},3)),
 "Chief Bogo - Calling the Shots":c=>{c.dmgImmune=(st,x)=>st.active===x.owner},
 "Prince Charming - Protector of the Realm":c=>{c.oneChallenger=true},
 "Castle Wyvern - Above the Clouds":c=>c.statics.push({here:true,kw:"challenger 1"},{here:true,kw:"resist 1"}),
 "Mother's Necklace":c=>c.onEnd.push(FN((st,pi)=>{if(st.players[pi].chalT===st.turnNo)return;PKs(st,pi,OWNCH(st,pi),(y)=>{if(y)y.grants.push({kw:"evasive",until:"srcStart",src:pi})},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose one of your characters"});},2)),
 "Aladdin - On the Edge of Adventure":c=>c.onYouPlay.push({type:"action",eff:[FN((st,pi,self)=>{if(self)self.grants.push({kw:"evasive",until:"srcStart",src:pi})},2)]}),
 "Copper - Champion of the Forest":c=>c.onQuest.push(FN((st,pi)=>OWNCH(st,pi).filter(y=>K(y,"evasive")).forEach(y=>y.tLore+=1),3)),
 "Copper - Hound Pup":c=>{c.onPlay.push(FN((st,pi)=>revealHand(st,pi,opp(pi),"Copper: opponent's hand"),0))},
 "Donald Duck - Fred Honeywell":c=>{c.onBoostAny=[FN((st,pi)=>{const y=st._ctx,P=st.players[pi];if(y&&P.deck.length)y.under.push(P.deck.pop())},2,null,{may:true})]},
 "Willie the Giant - Ghost of Christmas Present":c=>c.statics.push({block:"quest",cond:(x,S)=>!S||x.underT!==S.turnNo},{block:"challenge",cond:(x,S)=>!S||x.underT!==S.turnNo}),
 "Morty Fieldmouse - Tiny Tim":c=>{c.onBoostAny=[FN((st,pi,self)=>{const y=st._ctx,P=st.players[pi];if(!self||y===self||self.onceU===st.turnNo||!P.deck.length)return;self.onceU=st.turnNo;self.under.push(P.deck.pop())},2)]},
 "Mickey Mouse - Bob Cratchit":c=>c.onQuest.push(FN((st,pi,self)=>{const P=st.players[pi];if(self&&P.deck.length){self.under.push(P.deck.pop());self.underT=st.turnNo}},2)),
 "Angela - Night Warrior":c=>c.onPlay.push({k:"grantMulti",kws:["challenger 2","resist 2"],long:true,lore:0,str:0,may:true,t:T_({own:true,helpful:true})}),
 "John Smith - Undaunted Protector":c=>{c.mustChoose=true},
 "Lilo - Bundled Up":c=>{c.firstDmgShield=true},
 "Keep the Ancient Ways":c=>c.onPlay.push(FN((st,pi)=>{const o=st.players[opp(pi)];o.noActionsT=st.turnNo+1;o.noItemsT=st.turnNo+1},3)),
 "The Terror That Flaps in the Night":c=>{c.onPlay=[FN((st,pi,self,x)=>damage(st,x,OWNCH(st,pi).some(y=>y.card.name==="Darkwing Duck")?3:2),(st,pi,x)=>x&&wilOf(x)-x.damage<=2?instVal(x):2,T_({opp:true}))]},
 "Pedro Madrigal - Family Patriarch":c=>c.onPlay.push(FN((st,pi,self)=>{if(noHeal(st))return;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&hasCls(z,"madrigal")&&z.damage),y=>{if(y)y.damage-=1},{prompt:"remove 1 damage from a Madrigal character",ai:l=>[l[0]]})},1,null,{may:true})),
 "Pepa Madrigal - Calm Before the Storm":c=>c.onPlay.push(FN((st,pi,self)=>OWNCH(st,pi).filter(y=>y!==self).forEach(y=>damage(st,y,1)),(st,pi)=>-OWNCH(st,pi).length)),
 "Dash Parr - Lava Runner":c=>{c.questFresh=true},
 "RC - Remote-Controlled Car":c=>{c.actTax=true},
 "Gadget Hackwrench - Resourceful Mechanic":c=>(c.auras=c.auras||[]).push({side:"own",kw2:"support",stat:"lore",n:1}),
 "Isabela Madrigal - Perfectly in Control":c=>c.onEnd.push(FN((st,pi,self)=>{if(self&&!noHeal(st))self.damage=0},2,null,{may:true})),
 "Three Arrows":c=>{c.onPlay=[FN((st,pi,self,x)=>{damage(st,x,2);dmgBest(st,pi,1,y=>y!==x)},(st,pi,x)=>x&&wilOf(x)-x.damage<=2?instVal(x)+2:3,T_({opp:true}))]},
 "Meilin Lee - Lead Vocalist":c=>c.statics.push({block:"sing"}),
 "Christopher Robin - Hunny Sage":c=>{c.hunnyAny=true},
 "Magical Hunny Staff":c=>c.acts.push({ink:1,noExert:true,once:true,eff:[FN((st,pi,self,x)=>{x.tmpCls={c:"hunny",until:st.turnNo+1}},1,T_({own:true,helpful:true}))]}),
 "Buzz Lightyear - Grounded":c=>{c.noEvasive=true},
 "Madam Mim - Hummingbird":c=>{c.inkAll=true},
 "Kevin - Flightless Bird":c=>c.onQuest.push(FN((st,pi,self)=>{if(!self)return;const P=st.players[pi];P.play=P.play.filter(y=>y!==self);reset(self);P.discard.push(...self.under);self.under=[];P.deck.push(self)},0)),
 "Piercing Attack":c=>{c.onPlay=[FN((st,pi,self,x)=>damage(st,x,2,true),(st,pi,x)=>x&&wilOf(x)-x.damage<=2?instVal(x):2,T_({opp:true}))]},
 "Roz - Always Watching":c=>{},
 "Hana's Inkcaster":c=>{c.acts=[{ink:0,eff:[FN((st,pi,self,x)=>{if(!noHeal(st))x.damage=Math.max(0,x.damage-2);if(x.under.length)x.grants.push({kw:"resist 1",until:"srcStart",src:pi})},(st,pi,x,mine)=>mine&&x?Math.min(2,x.damage)*2+1:-1,T_({own:true,helpful:true}))]}]},
 "Hundred Acre Wood - Hunny Campsite":c=>c.statics.push({here:true,test:x=>hasCls(x,"hunny"),stat:"lore",n:1}),
});

const playGyBottom=(st,pi,test)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(test),(y)=>{if(!y)return;toHandFrom(P,"discard",y);playFree(st,pi,y);if(P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);P.deck.unshift(y)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});};
const freeFromHand=(st,pi,test,then)=>{const P=st.players[pi];CH(st,pi,P.hand.filter(test),(p,y)=>{if(y)playFree(st,pi,y);if(then)then(y)},{empty:true,prompt:"choose a card from your hand to play for free",ai:srt((a,b)=>b.card.cost-a.card.cost)})};
const gyBottom=(st,pi,test,n,then)=>{const P=st.players[pi],cs=P.discard.filter(test);if(cs.length<n)return false;CH(st,pi,cs,pick=>{P.discard=P.discard.filter(y=>!pick.includes(y));P.deck.unshift(...pick);if(then)then()},{n,prompt:`choose ${n>1?n+" cards":"a card"} from your discard to put on the bottom of your deck`,ai:(l,k)=>l.slice(0,k)});return true};
const gyTop=(st,pi,test)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(test),(y)=>{if(y){P.discard.splice(P.discard.indexOf(y),1);P.deck.push(y)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});};
const firstLoc=(st,pi)=>st.players[pi].play.find(isLoc)/*nc:existence-check-only*/;
const pickLoc=(st,pi,f,prompt)=>PKs(st,pi,st.players[pi].play.filter(isLoc),l=>{if(l)f(l)},{prompt:prompt||"choose one of your locations",ai:l=>[l[0]]});
function doShift(st,pi,x,b){const P=st.players[pi];const idx=P.play.indexOf(b);reset(x);x.damage=b.damage;x.exerted=b.exerted;x.playedOn=b.playedOn;x.at=b.at;x.under=[...b.under,b];b.under=[];x.shiftedOn=st.turnNo;if(b.card.onShiftedOn)trig(st,pi,b.card.onShiftedOn,x);b.at=null;P.play[idx]=x;log(st,`${P.name} shifts ${x.card.full} onto ${b.card.name}.`);trig(st,pi,x.card.onPlay,x)}
const isAct=y=>y.card.type==="action"||y.card.type==="song";
Object.assign(DEFS_EXTRA,{
 "Stitch - Alien Buccaneer":c=>c.onPlay.push({k:"cond",shifted:true,eff:[FN((st,pi)=>gyTop(st,pi,isAct),2,null,{may:true})]}),
 "Moana - Kakamora Leader":c=>c.onPlay.push(FN((st,pi,self)=>{pickLoc(st,pi,l=>{const cs=OWNCH(st,pi).filter(y=>y.at!==l.uid);cs.forEach(y=>doMove(st,pi,y,l));gain(st,pi,cs.length)},"move all your characters to which location?")},(st,pi)=>firstLoc(st,pi)?OWNCH(st,pi).length*5:0,null,{may:true})),
 "Yokai - Scientific Supervillain":c=>{c.onPlay.push(FN(()=>{},0));c.freeMicro=true},
 "Cinderella - The Right One":c=>c.onPlay.push(FN((st,pi)=>{gyBottom(st,pi,y=>y.card.name==="The Glass Slipper",1,()=>gain(st,pi,3))},15,null,{may:true})),
 "Pongo - Dear Old Dad":c=>c.onStart.push(FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.ink.filter(z=>isChar(z)&&hasCls(z,"puppy")),(y)=>{if(y){P.ink.splice(P.ink.indexOf(y),1);P.hand.push(y);playFree(st,pi,y)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your inkwell"});},5,null,{may:true})),
 "Scrooge Mcduck - Resourceful Miser":c=>{c.freeAlt={req:(st,pi)=>st.players[pi].play.filter(y=>isItem(y)&&!y.exerted).length>=4,pay:(st,pi)=>CH(st,pi,st.players[pi].play.filter(y=>isItem(y)&&!y.exerted),ps=>ps.forEach(y=>y.exerted=true),{n:4,prompt:"exert 4 of your items",ai:(l,n)=>l.slice(0,n)})}},
 "Belle - Apprentice Inventor":c=>{c.freeAlt={req:(st,pi)=>st.players[pi].play.some(isItem),pay:(st,pi)=>{sacOwn(st,pi,isItem,null,1,l=>[cheapest(l)])}}},
 "Aladdin - Research Assistant":c=>c.onQuest.push(FN((st,pi)=>freeFromHand(st,pi,y=>isChar(y)&&hasCls(y,"ally")&&y.card.cost<=3),5,null,{may:true})),
 "Perdita - Determined Mother":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi],cs=P.discard.filter(y=>isChar(y)&&hasCls(y,"puppy"));P.discard=P.discard.filter(y=>!cs.includes(y));cs.forEach(y=>{reset(y);y.exerted=true;P.ink.push(y)})},(st,pi)=>st.players[pi].discard.filter(y=>isChar(y)&&hasCls(y,"puppy")).length*3,null,{may:true})),
 "Jafar - High Sultan of Lorcana":c=>c.onQuest.push(FN((st,pi)=>{draw(st,pi,1);const P=st.players[pi];discPick(st,pi,1,{ai:by(y=>isChar(y)&&hasCls(y,"illusion")?100+y.card.cost:discardPri(y)),then:ps=>{const y=ps[0];if(y&&isChar(y)&&hasCls(y,"illusion")&&P.discard.includes(y))YN(st,pi,`Play ${y.card.full} for free?`,()=>{toHandFrom(P,"discard",y);playFree(st,pi,y)})}})},4,null,{may:true})),
 "Lilo - Causing an Uproar":c=>{c.freeIf=(st,pi)=>(st.players[pi].actionsN||0)>=3},
 "Stitch - Experiment 626":c=>{c.gyStart=(st,pi)=>{const P=st.players[pi],L=P.hand.filter(z=>z.card.inkable);if(!L.length)return false;CH(st,pi,L,(p,y)=>{if(y&&P.hand.includes(y)){P.hand.splice(P.hand.indexOf(y),1);P.discard.push(y)}},{prompt:"discard an inkable card",ai:by(x=>discardPri(x))});return true}},
 "Circle of Life":c=>{c.onPlay=[FN((st,pi)=>playFromDiscard(st,pi,isChar),(st,pi)=>st.players[pi].discard.some(isChar)?10:-5)]},
 "Ursula - Voice Stealer":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.exerted=true;const cost=x.card.cost;const P=st.players[pi];PKs(st,pi,P.hand.filter(z=>z.card.type==="song"&&z.card.cost<=cost),(y)=>{if(y)playFree(st,pi,y)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your hand"});},4,T_({opp:true,state:"ready"}))),
 "Goofy - Set for Adventure":c=>c.onMoveSelf=[FN((st,pi,self)=>{if(!self||self.onceM===st.turnNo)return;self.onceM=st.turnNo;const l=st._ctx;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.at!==l.uid),y=>{if(y){doMove(st,pi,y,l);draw(st,pi,1)}},{prompt:`move another character to ${l.card.name}`,ai:l2=>[l2[0]]})},3,null,{may:true})],
 "Max Goof - Chart Topper":c=>c.onQuest.push(FN((st,pi)=>playGyBottom(st,pi,y=>y.card.type==="song"&&y.card.cost<=4),4,null,{may:true})),
 "Gazelle - Ballad Singer":c=>c.onPlay.push(FN((st,pi)=>gyTop(st,pi,y=>y.card.type==="song"),2,null,{may:true})),
 "Lady Tremaine - Sinister Socialite":c=>c.onQuest.push(FN((st,pi,self)=>{if(self&&self.underT===st.turnNo)playGyBottom(st,pi,y=>isAct(y)&&y.card.cost<=5)},4,null,{may:true})),
 "Get to Safety!":c=>{c.onPlay=[FN((st,pi)=>{playFromDiscard(st,pi,y=>isLoc(y)&&y.card.cost<=3);if(st.players[pi].play.some(y=>y.card.name==="Sleepy Hollow"))draw(st,pi,1)},4)]},
 "The Game's Afoot!":c=>{c.onPlay=[FN((st,pi)=>pickLoc(st,pi,l=>{UPTO(st,pi,OWNCH(st,pi).filter(y=>y.at!==l.uid),2,y=>doMove(st,pi,y,l),`move up to 2 characters to ${l.card.name}`,(a,b)=>b.card.lore-a.card.lore);l.grants=l.grants||[];l.grants.push({kw:"resist 2",until:"srcStart",src:pi})},"choose a location"),(st,pi)=>firstLoc(st,pi)?4:-4)]},
 "Pudge - Controls the Weather":c=>{c.freeIf=(st,pi)=>OWNCH(st,pi).some(y=>y.card.name==="Lilo")},
 "Lilo - Rock Star":c=>c.onQuest.push(FN((st,pi)=>playFromDiscard(st,pi,y=>isChar(y)&&y.card.cost<=2),4,null,{may:true})),
 "Widow Tweed - Kindly Soul":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.discard.filter(isChar),(y)=>{if(!y)return;toHandFrom(P,"discard",y);if(y.card.name==="Tod")playFree(st,pi,y)},{ai:srt((a,b)=>(b.card.name==="Tod")-(a.card.name==="Tod")||b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},4)),
 "Mystical Inkcaster":c=>c.acts.push({ink:3,req:(st,pi)=>st.players[pi].hand.some(y=>isChar(y)&&y.card.cost<=5),eff:[FN((st,pi)=>{freeFromHand(st,pi,z=>isChar(z)&&z.card.cost<=5,y=>{if(!y)return;y.grants.push({kw:"rush",until:"turnEnd",src:pi});y.banishEOT=st.turnNo})},4)]}),
 "Chernabog - Unnatural Force":c=>c.onPlay.push(FN((st,pi,self,x)=>{const q=x.owner,P=st.players[q];P.play=P.play.filter(y=>y!==x);reset(x);P.deck.push(x,...x.under);x.under=[];shuffle(P.deck,st.r);playFromDiscard(st,q,isChar)},(st,pi,x)=>x?instVal(x)-4:0,T_({opp:true}),{may:true})),
 "Stegmutt - Clumsy Dinosaur":c=>c.onPlay.push(FN((st,pi)=>{gyBottom(st,pi,isItem,3,()=>dmgBest(st,pi,3))},5,null,{may:true})),
 "Retro Evolution Device":c=>c.acts.push({ink:1,req:(st,pi)=>OWNCH(st,pi).some(b=>st.players[pi].hand.some(h=>isChar(h)&&h.card.cost<=b.card.cost+2&&h.card.cost>b.card.cost)),eff:[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,OWNCH(st,pi).filter(z=>P.hand.some(h=>isChar(h)&&h.card.cost<=z.card.cost+2&&h.card.cost>z.card.cost)),(b)=>{if(!b)return;const lim=b.card.cost+2;banish(st,b);freeFromHand(st,pi,h=>isChar(h)&&h.card.cost<=lim)},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose a card from your hand"});},4)]}),
 "Darkwing Duck - Dashing Gadgeteer":c=>c.onQuest.push(FN((st,pi)=>{gyBottom(st,pi,isItem,1,()=>playFromDiscard(st,pi,y=>isItem(y)&&y.card.cost<=5))},3,null,{may:true})),
 "Let's Get Dangerous":c=>{c.onPlay=[FN((st,pi)=>{for(const q of [pi,opp(pi)]){const P=st.players[q];shuffle(P.deck,st.r);const y=P.deck.pop();if(!y)continue;if(isChar(y)){P.hand.push(y);playFree(st,q,y)}else P.deck.unshift(y)}},2)]},
 "Chip - Retrieval Expert":c=>c.onPlay.push(FN((st,pi)=>fromDiscardToHand(st,pi,y=>isChar(y)&&y.card.wil>=4),3,null,{may:true})),
 "Metamorphosis":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[pi],base=y=>OWNCH(st,pi).filter(z=>namesOf(z).includes(y.card.name.toLowerCase()));CH(st,pi,P.discard.filter(z=>isChar(z)&&z.card.kw.shift!=null&&base(z).length),(p,y)=>{if(!y)return;CH(st,pi,base(y),(q,b)=>{if(b&&P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);doShift(st,pi,y,b)}},{prompt:`shift ${y.card.name} onto which character?`,ai:l=>[l[0]]})},{prompt:"choose a Shift character in your discard to play",ai:srt((a,b)=>b.card.cost-a.card.cost)})},(st,pi)=>{const P=st.players[pi];return P.discard.some(y=>isChar(y)&&y.card.kw.shift!=null&&OWNCH(st,pi).some(z=>namesOf(z).includes(y.card.name.toLowerCase())))?10:-5})]},
 "When You Need Help, Just Call":c=>{c.onPlay=[FN((st,pi)=>{if(OWNCH(st,opp(pi)).length>OWNCH(st,pi).length)freeFromHand(st,pi,y=>isChar(y)&&y.card.cost<=4)},5)]},
 "Safety Rope":c=>c.onPlay.push(FN((st,pi)=>gyTop(st,pi,isChar),2,null,{may:true})),
 "Right Behind You":c=>{c.onPlay=[{k:"draw",n:1},FN((st,pi)=>{const P=OWNCH(st,pi);if(P.some(y=>hasCls(y,"seven dwarfs"))&&P.some(y=>hasCls(y,"princess")))freeFromHand(st,pi,y=>isChar(y)&&hasCls(y,"seven dwarfs"))},3)]},
 "Ring of Stones - Place of Legends":c=>{c.moveFree=x=>x.exerted},
 "Buzz's Arm":c=>{c.freeIf=(st,pi)=>st.buzzBanT===st.turnNo},
 "Pizza Planet - Spaceport":c=>{c.moveFree=x=>hasCls(x,"toy")},
 "Roller Bob - Sid's Toy":c=>c.onPlay.push(FN((st,pi,self)=>{if(self)gyBottom(st,pi,isChar,2,()=>self.grants.push({kw:"rush",until:"turnEnd",src:pi}))},2,null,{may:true})),
 "Hand-in-the-Box - Sid's Toy":c=>{c.freeAlt={req:(st,pi)=>st.players[pi].discard.some(y=>isChar(y)&&hasCls(y,"toy")),pay:(st,pi)=>gyBottom(st,pi,y=>isChar(y)&&hasCls(y,"toy"),1)}},
 "Bouncing Ducky - Sid's Toy":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];gyBottom(st,pi,y=>isChar(y)&&hasCls(y,"toy"),P.discard.filter(y=>isChar(y)&&hasCls(y,"toy")).length)},0)),
 "Hercules - Young Rescuer":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];P.discard.push(...P.hand);P.hand=[];PKs(st,pi,P.discard,(y)=>{if(y)toHandFrom(P,"discard",y)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},(st,pi)=>st.players[pi].hand.length<=1?3:-5,null,{may:true})),
 "Syndrome - Out for Revenge":c=>c.onQuest.push(FN((st,pi)=>{fromDiscardToHand(st,pi,y=>isChar(y)&&hasCls(y,"robot"));const P=st.players[pi];PKs(st,pi,P.hand.filter(z=>isChar(z)&&hasCls(z,"robot")&&z.card.cost<=8),(y)=>{if(!y)return;const bs=OWNCH(st,pi).filter(z=>z.card.name===y.card.name);if(bs.length&&y.card.kw.shift!=null)PKs(st,pi,bs,b=>{if(b&&P.hand.includes(y)){P.hand.splice(P.hand.indexOf(y),1);doShift(st,pi,y,b)}},{prompt:`shift ${y.card.name} onto which character?`,ai:l=>[l[0]]});else playFree(st,pi,y)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your hand"});},6)),
 "Fergus - Outpost Builder":c=>{c.onExertYT=[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.hand.concat(P.discard).filter(z=>isLoc(z)&&z.card.cost<=4),(y)=>{if(!y)return;if(P.discard.includes(y))toHandFrom(P,"discard",y);playFree(st,pi,y)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your discard"});},4,null,{may:true})]},
 "Touch the Sky":c=>{c.onPlay=[FN((st,pi)=>{pickLoc(st,pi,l=>PKs(st,pi,OWNCH(st,pi).filter(z=>z.at!==l.uid),y=>{if(y)doMove(st,pi,y,l);draw(st,pi,loreOf(l))},{prompt:`move which character to ${l.card.name}?`,ai:l2=>[l2[0]]}),"choose a location")},(st,pi)=>firstLoc(st,pi)?4*loreOf(firstLoc(st,pi))+1:-4)]},
 "Club Door":c=>{c.freeIf=(st,pi)=>OWNCH(st,pi).some(y=>y.card.name==="Fat Cat")},
 "Woody - Helping a Friend":c=>c.onPlay.push(FN((st,pi,self)=>{const both=OWNCH(st,pi).some(y=>y!==self&&hasCls(y,"toy"));const P=st.players[pi];const a=()=>fromDiscardToHand(st,pi,y=>isChar(y)&&y.card.cost<=2),b=()=>freeFromHand(st,pi,y=>isChar(y)&&y.card.cost<=2);if(both){b();a()}else if(P.hand.some(y=>isChar(y)&&y.card.cost<=2))b();else a()},4)),
 "Buzz Lightyear - Providing Cover":c=>c.onPlay.push(FN((st,pi,self)=>{const both=OWNCH(st,pi).some(y=>y!==self&&hasCls(y,"toy"));const P=st.players[pi];const a=()=>fromDiscardToHand(st,pi,y=>isAct(y)&&y.card.cost<=2),b=()=>freeFromHand(st,pi,y=>isAct(y)&&y.card.cost<=2);if(both){b();a()}else if(P.hand.some(y=>isAct(y)&&y.card.cost<=2))b();else a()},4)),
 "Pocahontas - Guiding the Tribe":c=>c.onPlay.push(FN((st,pi)=>freeFromHand(st,pi,y=>isChar(y)&&y.card.cost===1),3,null,{may:true})),
 "The Horned King - Merciless Master":c=>{c.gyPlay=true},
 "Pocahontas & Meeko - Adventurous Friends":c=>c.onQuest.push(FN((st,pi,self,x)=>{retHand(st,x);freeFromHand(st,pi,y=>isChar(y)&&y.card.cost===1&&y!==x,y=>{if(!y)playFree(st,pi,x)})},(st,pi,x)=>x&&x.exerted?3:0,T_({own:true,helpful:true,maxCost:1}),{may:true})),
 "Woody & Buzz Lightyear - Best Buddies":c=>c.onQuest.push(FN((st,pi)=>freeFromHand(st,pi,y=>y.card.cost<=2&&!isLoc(y)||y.card.cost<=2),4,null,{may:true})),
 "Sulley & Boo - Scare Buddies":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const P=st.players[pi];for(const y of (ctx.src&&ctx.src._underCards)||[])if(isChar(y)&&P.discard.includes(y)){toHandFrom(P,"discard",y);playFree(st,pi,y)}},5,null,{may:true})),
 "Maleficent & Diablo - Evil Incarnate":c=>{c.shiftAlt={n:0,test:()=>false};c.shiftGy=5},
 "Russell - Junior Wilderness Explorer":c=>c.onQuest.push(FN((st,pi,self)=>{if(!self)return;pickLoc(st,pi,l=>{if(self.at!==l.uid)doMove(st,pi,self,l)},"move to which location?");const l=self.at!=null?LOC(st,self):null;if(!l)return;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.at!==l.uid),y=>{if(y)doMove(st,pi,y,l)},{prompt:`move another character to ${l.card.name}`,ai:l2=>[l2[0]]})},2,null,{may:true})),
 "Mother Gothel - Evil as Ever":c=>{c.playOnDiscard=true},
 "Rapunzel & Flynn Rider - Unlikely Pair":c=>{c.gyOnDiscardChar=true},
 "Vine Pod":c=>c.acts.push({ink:1,req:(st,pi)=>OWNCH(st,pi).some(b=>st.players[pi].hand.some(h=>isChar(h)&&h.card.name===b.card.name)),eff:[FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,OWNCH(st,pi).filter(z=>P.hand.some(h=>isChar(h)&&h.card.name===z.card.name)),(b)=>{if(!b)return;const nm=b.card.name;banish(st,b);freeFromHand(st,pi,h=>isChar(h)&&h.card.name===nm)},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose a card from your hand"});},3)]}),
 "Carl Fredricksen - On the Move":c=>c.onYouPlay.push({type:"location",eff:[FN((st,pi,self)=>{const P=st.players[pi],l=P.play[P.play.length-1];if(!self||!isLoc(l))return;doMove(st,pi,self,l);PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.at!==l.uid),y=>{if(y)doMove(st,pi,y,l)},{prompt:`move another character to ${l.card.name}`,ai:l2=>[l2[0]]})},2,null,{may:true})]}),
 "Colonel Hathi - On the March":c=>c.onQuest.push(FN((st,pi,self)=>{if(self)pickLoc(st,pi,l=>{if(self.at!==l.uid)doMove(st,pi,self,l)},"move to which location?")},2,null,{may:true})),
 "Carl's House - Flying High":c=>c.acts.push({ink:0,noExert:true,once:true,req:(st,pi,x)=>hereChars(st,x).length>0&&st.players[pi].play.filter(isLoc).length>1,eff:[FN((st,pi,self)=>{PKs(st,pi,hereChars(st,self),y=>{if(!y)return;PKs(st,pi,st.players[pi].play.filter(z=>isLoc(z)&&z!==self),l=>{if(l){doMove(st,pi,y,l);gain(st,pi,1)}},{prompt:`move ${y.card.name} to which location?`,ai:l2=>[l2[0]]})},{prompt:"choose a character here to move",ai:l=>[l[0]]})},6)]}),
 "Look What You've Done":c=>{c.onPlay=[parseOne0("deal 2 damage to chosen character")];c.playOnDiscard=true},
});

const gainIf=(n,f)=>FN((st,pi,self)=>{if(f(st,pi,self))gain(st,pi,n)},n*4);
const drainOne=(st,pi,n)=>{const o=st.players[opp(pi)],b=o.lore;loseLore(st,o,n);return b-o.lore};
Object.assign(DEFS_EXTRA,{
 "Sugar Rush Speedway - Finish Line":c=>{c.onMoveHere=[FN((st,pi,self)=>{const x=st._ctx;if(!self||!x||!x._fromLoc)return;banish(st,self);gain(st,pi,3);draw(st,pi,3)},18,null,{may:true})]},
 "Maleficent's Staff":c=>{c.onOppReturned=[{k:"gainLore",n:1}]},
 "Mystical Tree - Mama Odie's Home":c=>c.onStart.push(gainIf(1,(st,pi,self)=>hereChars(st,self).some(y=>y.card.name==="Mama Odie"))),
 "Peter Pan - Never Land Prankster":c=>{c.noGainUnlessChal=true},
 "Alistair Krei - Ambitious Entrepreneur":c=>c.onPlay.push(gainIf(1,(st,pi)=>st.players[opp(pi)].play.some(isItem))),
 "Owl Island - Secluded Entrance":c=>c.onYouPlay.push({type:"action",eff:[gainIf(3,(st,pi)=>(st.players[pi].actionsN||0)===2)]}),
 "Vanellope Von Schweetz - Gutsy Go-Getter":c=>c.onStart.push(FN((st,pi,self)=>{if(self&&self.at!=null){draw(st,pi,1);gain(st,pi,1)}},5)),
 "Thievery":c=>{c.onPlay=[FN((st,pi)=>{drainOne(st,pi,1);gain(st,pi,1)},8)]},
 "Flotilla - Coconut Armada":c=>c.onStart.push(FN((st,pi,self)=>{if(self&&hereChars(st,self).length)gain(st,pi,drainOne(st,pi,1))},8)),
 "Skull Rock - Isolated Fortress":c=>c.onStart.push(gainIf(1,(st,pi,self)=>hereChars(st,self).some(y=>hasCls(y,"pirate")))),
 "Institute of Technology - Prestigious University":c=>c.onStart.push(gainIf(1,(st,pi,self)=>hereChars(st,self).length>0)),
 "Wreck-It Ralph - Ham Hands":c=>c.onQuest.push(FN((st,pi,self,x)=>{banish(st,x);gain(st,pi,2)},(st,pi,x)=>x?(x.owner===pi?-instVal(x):instVal(x))+8:0,T_({kind:"itemloc"}),{may:true})),
 "Bolt - Superdog":c=>c.onReadyT=[FN((st,pi,self)=>gain(st,pi,OWNCH(st,pi).filter(y=>y!==self&&!y.damage).length),4)],
 "Pepa Madrigal - Sensitive Sister":c=>c.onAllySing=[{k:"gainLore",n:1}],
 "Spaghetti Dinner":c=>{c.acts=[{ink:1,eff:[gainIf(1,(st,pi)=>OWNCH(st,pi).length>=2)]}]},
 "Restoring the Crown":c=>c.onPlay.push(FN((st,pi)=>{st.players[pi].crownT=st.turnNo},2)),
 "Stabbington Brother - With a Patch":c=>c.onPlay.push(FN((st,pi)=>drainOne(st,pi,1),4)),
 "Ratigan - Nefarious Criminal":c=>c.onYouPlay.push({type:"action",eff:[FN((st,pi,self)=>{if(self&&self.exerted)gain(st,pi,1)},4)]}),
 "Devil's Eye Diamond":c=>{c.acts=[{ink:0,eff:[gainIf(1,(st,pi)=>st.players[pi].dmgT===st.turnNo)]}]},
 "Fa Zhou - War Hero":c=>{const e=gainIf(3,(st,pi)=>st.players[pi].chalN===2);c.onAllyChallenge.push(e);c.onChallenge.push(e)},
 "Abu - Illusory Pachyderm":c=>c.onQuest.push(FN((st,pi,self,x)=>gain(st,pi,loreOf(x)),(st,pi,x)=>x?loreOf(x)*4:0,T_({opp:true}))),
 "Fantastical and Magical":c=>{c.onPlay=[FN((st,pi)=>{const n=st._singers||1;draw(st,pi,n);gain(st,pi,n)},8)]},
 "Tinker Bell - Insistent Fairy":c=>c.onYouPlay.push({type:"character",test:(st,pi,x)=>strOf(x)>=5,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.play[P.play.length-1];if(y&&!y.exerted){y.exerted=true;gain(st,pi,2)}},4,null,{may:true})]}),
 "LeFou - Cake Thief":c=>{c.acts=[{ink:0,req:(st,pi)=>st.players[pi].play.some(isItem),cost:(st,pi)=>{sacOwn(st,pi,isItem,null,1,l=>[cheapest(l)])},eff:[FN((st,pi)=>{drainOne(st,pi,1);gain(st,pi,1)},5)]}]},
 "Dumbo - Ninth Wonder of the Universe":c=>{c.acts=[{ink:1,eff:[{k:"draw",n:1},{k:"gainLore",n:1}]}]},
 "Family Fishing Pole":c=>{c.acts=[{ink:1,sac:true,req:(st,pi)=>OWNCH(st,pi).some(y=>y.exerted),eff:[FN((st,pi,self,x)=>{retHand(st,x);gain(st,pi,2)},(st,pi,x)=>x?10-instVal(x):0,T_({own:true,state:"exerted"}))]}]},
 "Lena Sabrewing - Mysterious Duck":c=>c.onPlay.push(gainIf(1,(st,pi)=>st.players[pi].play.some(y=>y.under.length))),
 "Enigmatic Inkcaster":c=>{c.acts=[{ink:0,eff:[gainIf(1,(st,pi)=>st.players[pi].cardsT===st.turnNo&&st.players[pi].cardsN>=2)]}]},
 "Blessed Bagpipes":c=>{c.onAllyChallenged=[FN((st,pi)=>{const d=st._ctx;if(d&&d.under&&d.under.length)gain(st,pi,1)},4)]},
 "White Agony Plains - Golden Lagoon":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:(x,P,S)=>S?hereChars(S,x).length:0}),
 "Beast - Aggressive Lord":c=>c.onChallenge.push(FN((st,pi,self)=>{if(self&&self.under.length){drainOne(st,pi,1);gain(st,pi,1)}},5)),
 "Goliath - Guardian of Castle Wyvern":c=>{const e=FN((st,pi)=>{const a=find(st,st._challenger)?.inst;if(a&&hasCls(a,"gargoyle"))gain(st,pi,1)},4);c.onAllyChallenge.push(e);c.onChallenge.push(e)},
 "Brom Bones - Burly Bully":c=>c.onChallenge.push(FN((st,pi)=>{const d=chalDef(st);if(d&&strOf(d)<=2)drainOne(st,pi,1)},4)),
 "Next Stop, Olympus":c=>{c.onPlay=[FN((st,pi,self,x)=>{x.exerted=false;x.noQuest=true;x.olympusT=st.turnNo},3,T_({own:true,state:"exerted"}))]},
 "Sleepy Hollow - The Bridge":c=>{c.onQuestHere=[FN((st,pi,self)=>{const x=st._ctx;if(!self)return;banish(st,self);gain(st,pi,2);if(x)x.grants.push({kw:"evasive",until:"srcStart",src:pi})},(st,pi)=>st.players[pi].lore>=16?12:-2,null,{may:true})]},
 "Illuminary Tunnels - Linked Caverns":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:(x,P,S)=>S&&hereChars(S,x).length?P.play.filter(y=>isLoc(y)&&y!==x).length:0}),
 "John Smith - Snow Tracker":c=>c.onEnd.push(gainIf(1,(st,pi,self)=>self&&self.exerted&&st.players[pi].chalT!==st.turnNo)),
 "Pocahontas - Following the Wind":c=>c.onQuest.push(FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.exerted),(y)=>{if(y)gain(st,pi,loreOf(y))},{ai:srt((a,b)=>loreOf(b)-loreOf(a)),prompt:"choose one of your characters"});},4)),
 "Genie - Magical Researcher":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:x=>x.under.length}),
 "Do You Want to Build A Snowman?":c=>{c.onPlay=[FN((st,pi)=>{const q=opp(pi);PKs(st,pi,OWNCH(st,q),(y)=>{if(y&&instVal(y)<12){const P=st.players[q];P.play=P.play.filter(z=>z!==y);reset(y);P.discard.push(...y.under);y.under=[];P.deck.unshift(y)}else gain(st,pi,3)},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose a card"});},8)]},
 "Mulan - Resourceful Recruit":c=>c.onQuest.push(FN((st,pi,self)=>{if(self)gain(st,pi,Math.min(6,strOf(self)))},6)),
 "Scrooge McDuck - Ebenezer Scrooge":c=>c.onQuest.push(FN((st,pi)=>draw(st,pi,drainOne(st,pi,1)),6)),
 "Scrooge's Counting House - Ebenezer's Office":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:x=>x.under.length},{stat:"wil",per:1,cond:"always",count:x=>x.under.length}),
 "Beast's Castle - Winter Gardens":c=>{c.onChalHere=[{k:"gainLore",n:1}]},
 "The Thunderquack":c=>{c.acts=[{ink:0,eff:[gainIf(1,st=>st.chalBanT===st.turnNo)]}]},
 "Isabela Madrigal - Such a Lovely Voice":c=>c.onPlay.push(gainIf(1,(st,pi)=>st.players[pi].healT===st.turnNo)),
 "Elinor - Renowned Diplomat":c=>c.onEnd.push(FN((st,pi)=>{if(OWNCH(st,pi).filter(y=>y.exerted).length<3)return;dmgBest(st,pi,1);gain(st,pi,1);draw(st,pi,1)},8)),
 "Gyro-Evac":c=>{c.acts=[{ink:0,sac:true,eff:[FN((st,pi)=>{loseLore(st,st.players[pi],2);loseLore(st,st.players[opp(pi)],2)},(st,pi)=>st.players[opp(pi)].lore>=17?20:-3)]}]},
 "Julieta's Arepas":c=>{c.acts=[{ink:0,eff:[gainIf(1,(st,pi)=>st.players.some(P=>P.healT===st.turnNo))]}]},
 "Incrediboy - Buddy Pine":c=>c.onPlay.push(gainIf(1,st=>st.players.some(P=>P.play.some(y=>isChar(y)&&hasCls(y,"hero"))))),
 "Grandma Wu - Wise Grandmother":c=>{c.onShiftedOn=[{k:"gainLore",n:1}]},
 "Hera - Created by the Vine":c=>{c.onPlay.push({k:"gainLore",n:1});c.onYouPlay.push({type:"character",test:(st,pi,x)=>hasCls(x,"floodborn"),eff:[{k:"gainLore",n:1}]})},
 "Winnie the Pooh & Piglet - Hunny Mages":c=>c.statics.push({stat:"lore",per:1,cond:"always",count:(x,P)=>new Set(P.play.filter(isChar).flatMap(y=>y.card.inks)).size}),
 "Source of the Vine":c=>{c.onOppQuest=[FN((st,pi)=>{const o=st.players[opp(pi)];if(inkAvail(o)>=1&&o.lore<18)payInk(o,1);else gain(st,pi,1)},3)]},
 "Russell - Senior Wilderness Explorer":c=>{const e=FN((st,pi)=>{const x=st._ctx;if(x&&strOf(x)>=4)gain(st,pi,1)},4);c.onAllyQuest.push({eff:[e]});c.onQuest.push(FN((st,pi,self)=>{if(self&&strOf(self)>=4)gain(st,pi,1)},4))},
 "Scout Ahead":c=>{c.onPlay=[gainIf(2,(st,pi)=>st.players[opp(pi)].lore>st.players[pi].lore)]},
 "Meilin Lee - Popular Red Panda":c=>c.onSing.push(FN((st,pi,self)=>{if(self&&self.onceS!==st.turnNo){self.onceS=st.turnNo;gain(st,pi,3)}},12)),
 "Red Alert":c=>{c.onPlay=[{k:"banish",t:T_({opp:true,maxStr:3})},FN((st,pi)=>{if(OWNCH(st,pi).some(y=>hasCls(y,"monster")))drainOne(st,pi,1)},4)]},
});

Object.assign(DEFS_EXTRA,{
 "Captain Hook - Underhanded":c=>(c.auras=c.auras||[]).push({side:"opp",cls:"pirate",block:"quest",test:(x,y)=>y.exerted}),
 "Captain Amelia - Commander of the Legacy":c=>(c.auras=c.auras||[]).push({side:"own",other:true,test:(x,y,S)=>S._defender===x.uid,kw:"resist 1"}),
 "Pete - Space Pirate":c=>(c.auras=c.auras||[]).push({side:"opp",block:"sing",test:(x,y)=>y.exerted},{side:"own",cls:"pirate",kw:"resist 1",test:(x,y)=>y.exerted}),
 "Louie - One Cool Duck":c=>(c.auras=c.auras||[]).push({side:"opp",stat:"str",n:-1,test:(x,y,S)=>S._challenger===x.uid&&S._defender===y.uid}),
 "Jiminy Cricket - Level-Headed and Wise":c=>{c.rushExerted=true},
 "Mulan - Standing Her Ground":c=>{c.dmgImmune=(st,x,inChal)=>inChal&&st.active===x.owner&&st.players[x.owner].play.some(y=>y.underT===st.turnNo)},
 "Game Preserve - Protected Land":c=>c.statics.push({kw:"evasive",cond:(x,S)=>!!S&&hereChars(S,x).some(y=>K(y,"evasive"))}),
 "Marching Off to Battle":c=>{c.onPlay=[FN((st,pi)=>{if(st.banT===st.turnNo)draw(st,pi,2)},(st)=>st.banT===st.turnNo?8:-3)]},
 "Mickey Mouse - Expedition Leader":c=>c.onAllyQuest.push({eff:[FN((st,pi,self,x)=>{if(self&&self.exerted&&x){x.lStr=(x.lStr||0)-2;x.lSrc=pi}},2,T_({opp:true}))]}),
 "Andy's Room - Home Base":c=>c.statics.push({here:true,test:(x,S,L)=>!S||hereChars(S,L||x).length===1,stat:"wil",n:2},{here:true,test:(x,S,L)=>!S||hereChars(S,L||x).length===1,stat:"lore",n:1}),
 "Merida - Gifted Archer":c=>{c.onOppChallenge=[FN((st,pi,self)=>{const a=find(st,st._challenger)?.inst;if(self&&self.exerted&&a)damage(st,a,1)},2,null,{may:true})]},
 "Gizmoduck - Duckburg Defender":c=>(c.auras=c.auras||[]).push({side:"opp",test:()=>false}),
 "Card Advantage":c=>{c.onPlay=[FN((st,pi)=>{if(st.oppChalBanT2===st.turnNo)draw(st,pi,2)},st=>st.oppChalBanT2===st.turnNo?8:-3)]},
 "Carl Fredricksen & Russell - Intrepid Explorers":c=>(c.auras=c.auras||[]).push({side:"all",test:(x,y)=>y.at!=null&&x.at===y.at&&x.owner===y.owner,stat:"lore",n:1},{side:"all",test:(x,y)=>y.at!=null&&x.at===y.at&&x.owner===y.owner,kw:"evasive"}),
 "Paradise Falls - Exotic Destination":c=>c.statics.push({stat:"lore",n:3,cond:(x,S)=>!!S&&hereChars(S,x).length>0}),
});

const DG=(n,test,o={})=>Object.assign({k:"dig",n,test,take:1},o);
const cl=c=>y=>isChar(y)&&hasCls(y,c);
const topIs=(st,pi)=>st.players[pi].deck[st.players[pi].deck.length-1];
const scry1=(st,q,keepTest)=>{const P=st.players[q],y=P.deck[P.deck.length-1];if(!y)return;if(!keepTest(y)){P.deck.pop();P.deck.unshift(y)}};
const inkTop=(st,pi)=>{const P=st.players[pi],y=P.deck.pop();if(y){reset(y);y.exerted=true;P.ink.push(y)}};
const tutorF=(st,pi,test,toTop)=>{const P=st.players[pi];CH(st,pi,P.deck.filter(test),(p,y)=>{if(!y){shuffle(P.deck,st.r);return}P.deck.splice(P.deck.indexOf(y),1);shuffle(P.deck,st.r);if(toTop)P.deck.push(y);else P.hand.push(y);log(st,`${P.name} reveals ${y.card.full}.`)},{empty:true,prompt:`search your deck: choose a card${toTop?" to put on top":""}`,ai:srt((a,b)=>b.card.cost-a.card.cost)})};
Object.assign(DEFS_EXTRA,{
 "Jim Hawkins - Honorable Pirate":c=>c.onPlay.push(DG(4,cl("pirate"),{take:99})),
 "Sisu - Uniting Dragon":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi];for(let k=0;k<60;k++){const y=topIs(st,pi);if(!y)break;if(isChar(y)&&hasCls(y,"dragon")){P.deck.pop();P.hand.push(y)}else{P.deck.pop();P.deck.unshift(y);break}}},3)),
 "Mad Hatter - Eccentric Host":c=>c.onQuest.push(FN((st,pi)=>{const o=st.players[opp(pi)],y=o.deck[o.deck.length-1];if(y&&y.card.cost>=4){o.deck.pop();o.discard.push(y)}},1,null,{may:true})),
 "The Islands I Pulled from the Sea":c=>{c.onPlay=[FN((st,pi)=>tutorF(st,pi,isLoc),4)]},
 "The Islands I Pulled From the Sea":c=>{c.onPlay=[FN((st,pi)=>tutorF(st,pi,isLoc),4)]},
 "Oswald - The Lucky Rabbit":c=>{c.onInk=[FN((st,pi)=>{const y=topIs(st,pi),P=st.players[pi];if(!y)return;if(isItem(y)){P.deck.pop();P.hand.push(y);playFree(st,pi,y)}else{P.deck.pop();P.deck.unshift(y)}},3,null,{may:true})]},
 "Hiro Hamada - Robotics Prodigy":c=>{c.acts=[{ink:2,eff:[FN((st,pi)=>tutorF(st,pi,y=>isItem(y)||cl("robot")(y),true),3)]}]},
 "King's Sensor Core":c=>{c.acts=[{ink:2,eff:[FN((st,pi)=>revealTopIf(st,pi,y=>isChar(y)&&(hasCls(y,"prince")||hasCls(y,"king")),(y,P)=>P.hand.push(y)),2)]}]},
 "The Family Madrigal":c=>{c.onPlay=[DG(5,y=>cl("madrigal")(y)||y.card.type==="song",{take:2,rest:"top",pickOk:(y,ps)=>!ps.some(z=>(cl("madrigal")(z)&&cl("madrigal")(y))||(z.card.type==="song"&&y.card.type==="song"))})]},
 "Merlin - Clever Clairvoyant":c=>c.onQuest.push({k:"nameReveal",dest:"ink"}),
 "The Return of Hercules":c=>{c.onPlay=[FN((st,pi)=>{for(const q of [pi,opp(pi)]){const P=st.players[q];PKs(st,pi,P.hand.filter(isChar),(y)=>{if(y)playFree(st,q,y)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your hand"});}},4)]},
 "Lucky - Runt of the Litter":c=>c.onQuest.push(DG(2,cl("puppy"),{take:99})),
 "Dawson - Puzzling Sleuth":c=>{c.onInk=[FN((st,pi,self)=>{if(!self||self.onceI===st.turnNo)return;self.onceI=st.turnNo;scry1(st,pi,y=>y.card.cost<=st.players[pi].ink.length+1)},1)]},
 "Kida - Creative Thinker":c=>{c.acts=[{ink:0,eff:[FN((st,pi)=>{const P=st.players[pi];if(P.deck.length<1)return;const a=P.deck.pop(),b=P.deck.pop();const [toInk,keep]=!b?[a,null]:(a.card.cost>b.card.cost?[a,b]:[b,a]);reset(toInk);toInk.exerted=true;P.ink.push(toInk);if(keep)P.deck.push(keep)},4)]}]},
 "Baymax - Upgraded Robot":c=>c.onPlay.push(DG(4,cl("floodborn"))),
 "Water Has Memory":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-4));if(!top.length)return;CH(st,pi,top,(p,keep)=>{top.splice(top.indexOf(keep),1);P.deck.unshift(...top);P.deck.push(keep)},{always:true,prompt:"look at the top 4: choose 1 to put on top (the rest go to the bottom)",ai:l=>[l.slice().sort((a,b)=>a.card.cost-b.card.cost)/*nc:ai-order*/.find(y=>y.card.cost<=st.players[pi].ink.length+1)||l[0]]})},2)]},
 "Antonio Madrigal - Friend to All":c=>c.onAllySing=[FN((st,pi,self)=>{if(!self||self.onceS===st.turnNo)return;self.onceS=st.turnNo;tutorF(st,pi,y=>isChar(y)&&y.card.cost<=3)},4,null,{may:true})],
 "Mirabel Madrigal - Curious Child":c=>c.onPlay.push(FN((st,pi)=>{if(st.players[pi].hand.some(y=>y.card.type==="song"))gain(st,pi,1)},4,null,{may:true})),
 "Chief Bogo - Commanding Officer":c=>{c.onAllyBanished.push({eff:[FN((st,pi)=>{const b=st._banished;if(st.active===pi||!b||!K(b,"bodyguard"))return;revealTopIf(st,pi,y=>isChar(y)&&y.card.cost<=3,(y,P)=>{P.hand.push(y);playFree(st,pi,y)})},3,null,{may:true})]})},
 "Yzma - On Edge":c=>c.onPlay.push(FN((st,pi)=>{if(st.players[pi].discard.some(y=>y.card.name==="Pull the Lever!"))tutorF(st,pi,y=>y.card.name==="Wrong Lever!")},3,null,{may:true})),
 "Fred - Giant-Sized":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi],i=P.deck.map(cl("floodborn")).lastIndexOf(true);if(i<0)return;const y=P.deck.splice(i,1)[0];P.hand.push(y);shuffle(P.deck,st.r)},4)),
 "Jasmine - Steady Strategist":c=>c.onQuest.push(DG(3,cl("ally"))),
 "Down in New Orleans":c=>{c.onPlay=[DG(3,y=>!isAct(y)&&y.card.cost<=6,{play:true})]},
 "Television Set":c=>{c.acts=[{ink:1,eff:[FN((st,pi)=>{const P=st.players[pi],y=topIs(st,pi);if(!y)return;P.deck.pop();if(cl("puppy")(y))P.hand.push(y);else P.deck.unshift(y)},2)]}]},
 "Powerline - World's Greatest Rock Star":c=>c.onSing.push(FN((st,pi,self)=>{if(!self||self.onceS===st.turnNo)return;self.onceS=st.turnNo;resolve(st,pi,[DG(4,y=>y.card.type==="song"&&y.card.cost<=9,{play:true})],null,self)},5)),
 "Mulan - Considerate Diplomat":c=>c.onQuest.push(DG(4,cl("princess"))),
 "Judy Hopps - Uncovering Clues":c=>{const e=DG(3,cl("detective"));c.onPlay.push(e);c.onQuest.push(e)},
 "Hen Wen's Visions":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-4));if(!top.length)return;CH(st,pi,top,(p,keep)=>{top.splice(top.indexOf(keep),1);P.deck.unshift(...top);P.deck.push(keep)},{always:true,prompt:"look at the top 4: choose 1 to put on top (the rest go to the bottom)",ai:l=>[l.slice().sort((a,b)=>b.card.cost-a.card.cost)/*nc:ai-order*/.find(y=>y.card.cost<=st.players[pi].ink.length+1)||l[0]]})},2)]},
 "Might Solve a Mystery":c=>{c.onPlay=[DG(4,y=>isChar(y)||isItem(y),{take:2,pickOk:(y,ps)=>!ps.some(z=>(isChar(z)&&isChar(y))||(isItem(z)&&isItem(y)))})]},
 "Fairy Godmother - Magical Benefactor":c=>{c.onBoostAny=[FN((st,pi,self)=>{if(st._ctx!==self)return;PKs(st,pi,OWNCH(st,opp(pi)),(y)=>{if(!y)return;banish(st,y);revealTopIf(st,opp(pi),z=>isChar(z)&&z.card.cost<=y.card.cost,(z,P)=>{P.hand.push(z);playFree(st,opp(pi),z)})},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose an opposing character"});},5,null,{may:true})]},
 "Bambi - Ethereal Fawn":c=>{c.onExertYT=[FN((st,pi,self)=>{if(!self)return;const P=st.players[pi],top=P.deck.splice(Math.max(0,P.deck.length-self.under.length));for(const y of top){if(isChar(y))P.hand.push(y);else P.deck.unshift(y)}},3)]},
 "John Smith's Compass":c=>c.onEnd.push(FN((st,pi)=>{if(st.players[pi].chalT===st.turnNo)return;revealTopIf(st,pi,y=>isChar(y)&&(y.card.cost<=3||y.card.name==="Pocahontas"),(y,P)=>P.hand.push(y))},2)),
 "The Cold Never Bothered Me":c=>{c.onPlay=[DG(4,isLoc,{rest:"discard",after:(st,pi)=>{st.players[pi].locDisc={n:3,t:st.turnNo}}})]},
 "Kristoff's Lute":c=>{c.acts=[{ink:2,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.deck.pop();if(!y)return;const cost=costOf(st,pi,y.card);if(inkAvail(P)>=cost&&!isLoc(y)||inkAvail(P)>=cost){payInk(P,cost);P.hand.push(y);playFree(st,pi,y)}else P.discard.push(y)},2)]}]},
 "Pete - Ghost of Christmas Future":c=>c.onQuest.push(DG((st,pi,self)=>self?self.under.length:0,()=>true,{rest:"top"})),
 "Chief Tui - Weaving a Tale":c=>{c.onInk=[FN((st,pi,self)=>{if(!self||self.onceI===st.turnNo)return;self.onceI=st.turnNo;scry1(st,pi,y=>y.card.cost<=st.players[pi].ink.length+1)},1)]},
 "Dolores Madrigal - Hears Everything":c=>{c.onPlay.push(FN((st,pi)=>revealHand(st,pi,opp(pi),"Dolores Madrigal: opponent's hand"),0))},
 "Woody - Leader of the Toys":c=>c.onPlay.push(DG(4,y=>cl("toy")(y)||y.card.name==="Andy's Room")),
 "You've Got a Friend in Me":c=>{c.onPlay=[DG(4,cl("toy"),{take:2})]},
 "Don't Be Nervous":c=>{c.onPlay=[FN((st,pi)=>{tutorF(st,pi,cl("princess"));if(OWNCH(st,pi).filter(cl("seven dwarfs")).length>=2)tutorF(st,pi,cl("seven dwarfs"))},4)]},
 "Bruno Madrigal - Oasis Oracle":c=>{c.onHeal=[FN((st,pi,self)=>{if(!self||self.onceH===st.turnNo)return;self.onceH=st.turnNo;resolve(st,pi,[DG(2,()=>true,{rest:"bottom"})],null,self)},3,null,{may:true})]},
 "Bruno Madrigal - Seeing the Future":c=>c.onPlay.push(FN((st,pi)=>{const o=st.players[opp(pi)],y=o.deck[o.deck.length-1];if(y&&y.card.cost<=o.ink.length+1){o.deck.pop();o.deck.unshift(y)}},1,null,{may:true})),
 "What Else Can I Do?":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[pi];const a=P.deck.pop(),b=P.deck.pop();if(!a)return;if(!b){P.hand.push(a);return}const [h,i]=a.card.cost>=b.card.cost?[a,b]:[b,a];P.hand.push(h);reset(i);i.exerted=true;P.ink.push(i);if(st._sung)OWNCH(st,pi).forEach(z=>z.grants.push({kw:"ward",until:"srcStart",src:pi}))},6)]},
 "Meilin Lee - Losing Control":c=>c.onPlay.push(DG(4,y=>cl("red panda")(y)||y.card.type==="song")),
 "My Adventure Book":c=>{c.acts=[{ink:1,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.deck.pop();if(!y)return;if(!isChar(y)||y.card.name==="Kevin")P.hand.push(y);else P.deck.unshift(y)},2)]}]},
 "Dash Parr - Super Fast":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi],y=P.deck.pop();if(!y)return;const cost=costOf(st,pi,y.card);if(inkAvail(P)>=cost){payInk(P,cost);P.hand.push(y);playFree(st,pi,y)}else P.discard.push(y)},2,null,{may:true})),
 "Prophetic Vision":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[pi];shuffle(P.deck,st.r);const y=P.deck.pop();if(!y)return;if(isAct(y)){P.hand.push(y);playFree(st,pi,y)}else{P.deck.unshift(y);drainOne(st,pi,1);gain(st,pi,1)}},4)]},
 "Charles Muntz - Obsessive Explorer":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi],y=topIs(st,pi);if(y&&y.card.name==="Kevin"){P.deck.pop();P.hand.push(y);gain(st,pi,3)}},3)),
 "Focused Search":c=>{c.onPlay=[DG(4,y=>y.card.name==="Kevin"||isItem(y))]},
 "Closet Door Portal":c=>{c.acts=[{ink:2,eff:[DG(3,y=>!isAct(y)&&y.card.cost<=6,{play:true})]}]},
 "Big Book of Hunny":c=>{c.acts=[{ink:2,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.deck.pop();if(!y)return;if(hasCls(y,"hunny")||y.card.name.toLowerCase().includes("hunny"))P.hand.push(y);else P.deck.unshift(y)},2)]}]},
});

const rdy=(x,nc)=>{if(!x)return;x.exerted=false;x.noQuest=true;if(nc)x.noChalNow=true};
const enterEx=(f,v,t)=>FN((st,pi,self,x,ctx)=>{if(self)self.exerted=true;f(st,pi,self,x,ctx)},v,t,{may:true});
const rdyPick=(st,pi,ex)=>PKs(st,pi,OWNCH(st,pi).filter(y=>y.exerted&&y!==ex),y=>rdy(y),{prompt:"choose one of your exerted characters to ready",ai:srt((a,b)=>strOf(b)-strOf(a))});
Object.assign(DEFS_EXTRA,{
 "Dale - Friend in Need":c=>{c.entersExeIf=(st,pi)=>!OWNCH(st,pi).some(y=>y.card.name==="Chip")},
 "Tiana - Restaurant Owner":c=>{c.onAllyChallenged=[FN((st,pi,self)=>{const a=find(st,st._challenger)?.inst,o=st.players[opp(pi)];if(!self||!self.exerted||!a)return;if(inkAvail(o)>=3&&o.lore<17)payInk(o,3);else a.tStr-=3},3)]},
 "Simba - Pride Protector":c=>c.onEnd.push(FN((st,pi,self)=>{if(self&&self.exerted)OWNCH(st,pi).forEach(y=>{if(y!==self)y.exerted=false})},4,null,{may:true})),
 "Mr. Litwak - Arcade Owner":c=>c.onYouPlay.push({type:"character",test:(st,pi,x,y)=>x!==y,eff:[FN((st,pi,self)=>{if(!self||!self.exerted||self.onceP===st.turnNo)return;self.onceP=st.turnNo;rdy(self,true)},1,null,{may:true})]}),
 "Jasmine - Royal Commodore":c=>c.onPlay.push({k:"cond",shifted:true,eff:[FN((st,pi,self)=>{for(const q of [0,1])for(const y of OWNCH(st,q).filter(z=>z.exerted&&z!==self))retHand(st,y)},(st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.exerted).length*4-OWNCH(st,pi).filter(y=>y.exerted).length*4)]}),
 "John Silver - Ferocious Friend":c=>c.onQuest.push(FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.exerted&&wilOf(z)-z.damage>1),(y)=>{if(y){damage(st,y,1);rdy(y)}},{ai:srt((a,b)=>strOf(b)-strOf(a)),prompt:"choose one of your characters"});},1,null,{may:true})),
 "Gold Coin":c=>{c.acts=[{ink:1,sac:true,eff:[FN((st,pi,self,x)=>rdy(x),(st,pi,x)=>x&&x.exerted?2:-2,T_({own:true,state:"exerted"}))]}]},
 "Heihei - Not-So-Tricky Chicken":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.exerted=true;x.noReady=true},2,T_({opp:true,kind:"item"}))),
 "John Silver - Stern Captain":c=>c.onStart.push(FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>!y.exerted).forEach(y=>damage(st,y,1)),3)),
 "Aurora - Waking Beauty":c=>{c.onHealAny=[FN((st,pi,self)=>rdy(self,true),1)]},
 "Kenai - Protective Brother":c=>c.onEnd.push(FN((st,pi,self)=>{if(!self||!self.exerted)return;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&(z.exerted||z.damage)),(y)=>{if(y){y.exerted=false;if(!noHeal(st))y.damage=0}},{ai:srt((a,b)=>b.damage-a.damage),prompt:"choose one of your characters"});},4,null,{may:true})),
 "Elsa - Ice Maker":c=>c.onQuest.push(FN((st,pi,self,x)=>{x.exerted=true;if(OWNCH(st,pi).some(y=>y.card.name==="Anna"))x.noReady=true},3,T_({opp:true}),{may:true})),
 "Magical Maneuvers":c=>{c.onPlay=[FN((st,pi,self,x)=>{CH(st,pi,OWNCH(st,pi),(p,y)=>{if(y)retHand(st,y);if(x)x.exerted=true},{empty:true,prompt:"return one of your characters to your hand",ai:l=>[l.filter(z=>z.exerted).sort((a,b)=>a.card.cost-b.card.cost)/*nc:ai-order*/[0]||cheapest(l)].filter(Boolean)})},3,T_({opp:true,state:"ready"}))]},
 "Goofy - Groundbreaking Chef":c=>c.onEnd.push(FN((st,pi,self)=>{if(noHeal(st))return;OWNCH(st,pi).filter(y=>y!==self&&y.damage).forEach(y=>{y.damage-=1;y.exerted=false})},3,null,{may:true})),
 "Alma Madrigal - Accepting Grandmother":c=>c.onAllySing=[FN((st,pi,self)=>{if(!self||self.onceS===st.turnNo)return;self.onceS=st.turnNo;st._singerList=st._singerList||[];for(const u of st._singerList){const y=find(st,u)?.inst;if(y)y.exerted=false}},3,null,{may:true})],
 "Pinocchio - Strings Attached":c=>c.onReadyT=[FN((st,pi,self)=>{if(!self||self.onceR===st.turnNo)return;self.onceR=st.turnNo;draw(st,pi,1)},3,null,{may:true})],
 "They Never Come Back":c=>{c.onPlay=[FN((st,pi)=>{UPTO(st,pi,OWNCH(st,opp(pi)).filter(y=>!K(y,"ward")),2,y=>y.noReady=true,"choose up to 2 opposing characters: they can't ready",(a,b)=>instVal(b)-instVal(a));draw(st,pi,1)},5)]},
 "Ice Spikes":c=>{c.acts=[{ink:1,req:(st,pi)=>st.players[opp(pi)].play.some(isItem),eff:[FN((st,pi)=>{PKs(st,pi,st.players[opp(pi)].play.filter(isItem),(y)=>{if(y){y.exerted=true;y.noReady=true}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose an item"});},2)]}]},
 "Figaro - Tuxedo Cat":c=>{c.oppItemsExerted=true},
 "Nothing We Won't Do":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,pi).forEach(y=>{y.exerted=false;y.noQuest=true;y.chalImmT=st.turnNo}),(st,pi)=>OWNCH(st,pi).filter(y=>y.exerted).length*3)]},
 "Light the Fuse":c=>{c.onPlay=[FN((st,pi,self,x)=>damage(st,x,OWNCH(st,pi).filter(y=>y.exerted).length),(st,pi,x)=>x&&wilOf(x)-x.damage<=OWNCH(st,pi).filter(y=>y.exerted).length?instVal(x):1,T_({opp:true}))]},
 "The Sword of Shan-Yu":c=>{c.acts=[{ink:0,req:(st,pi)=>OWNCH(st,pi).some(y=>!y.exerted&&dry(st,y))&&OWNCH(st,pi).some(y=>y.exerted),cost:(st,pi)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>!z.exerted&&dry(st,z)),(y)=>{if(y)y.exerted=true},{ai:srt((a,b)=>strOf(a)-strOf(b)),prompt:"choose one of your characters"});},eff:[FN((st,pi)=>rdyPick(st,pi),1)]}]},
 "I2I":c=>{c.onPlay=[FN((st,pi)=>{draw(st,pi,2);draw(st,opp(pi),2);gain(st,pi,2);gain(st,opp(pi),2);if((st._singers||0)>=2)(st._singerList||[]).forEach(u=>rdy(find(st,u)?.inst))},2)]},
 "Della Duck - Returning Mother":c=>c.onPlay.push(FN((st,pi,self,x)=>rdy(x,true),(st,pi,x)=>x&&x.exerted?1:-1,T_({own:true,state:"exerted",test:y=>y.card.kw.boost!=null}),{may:true})),
 "Demona - Scourge of the Wyvern Clan":c=>c.onPlay.push(FN((st,pi)=>{OWNCH(st,opp(pi)).forEach(y=>y.exerted=true);for(const q of [0,1]){const P=st.players[q];if(P.hand.length<3)draw(st,q,3-P.hand.length)}},8)),
 "Performance Review":c=>{c.onPlay=[FN((st,pi,self,x)=>{if(!x||x.exerted)return;x.exerted=true;draw(st,pi,loreOf(x))},(st,pi,x)=>x?loreOf(x)*3-2:-3,T_({own:true,state:"ready"}))]},
 "Little John - Impermanent Outlaw":c=>{c.onBoostAny=[FN((st,pi,self)=>{if(st._ctx===self&&self)self.exerted=false},2)]},
 "Ares - God of War":c=>{c.kw.reckless=true;c.onBoostAny=[FN((st,pi,self)=>{if(!self||self.onceU===st.turnNo)return;self.onceU=st.turnNo;rdyPick(st,pi)},2,null,{may:true})]},
 "Rama - Vigilant Father":c=>c.onYouPlay.push({type:"character",test:(st,pi,x)=>strOf(x)>=5,eff:[FN((st,pi,self)=>rdy(self),1,null,{may:true})]}),
 "Shere Khan - Fierce and Furious":c=>c.acts.push({ink:1,noExert:true,req:(st,pi,x)=>x.exerted&&wilOf(x)-x.damage>1,cost:(st,pi,x)=>damage(st,x,1),eff:[FN((st,pi,self)=>rdy(self),1)]}),
 "Ghostly Tale":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>strOf(y)<=2).forEach(y=>y.exerted=true),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>strOf(y)<=2&&!y.exerted).length*2)]},
 "Castle of the Horned King - Bastion of Evil":c=>{c.onQuestHere=[FN((st,pi,self)=>{if(!self||self.onceQ===st.turnNo)return;PKs(st,pi,st.players[pi].play.filter(z=>isItem(z)&&z.exerted),y=>{if(y){self.onceQ=st.turnNo;y.exerted=false}},{prompt:"ready one of your items",ai:l=>[l[0]]})},2,null,{may:true})]},
 "Eeyore - In the Way":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.noReady=true},(st,pi,x)=>x&&x.exerted?instVal(x)/2:0.5,T_({opp:true}),{may:true})),
 "Marshmallow - Cranky Climber":c=>c.onQuest.push(FN((st,pi)=>{st.players[opp(pi)].readyMax1=true},3)),
 "Tod - Knows All the Tricks":c=>{c.onChosen=[];c.onChosenAny=[FN((st,pi,self)=>{if(!self)return;self.todN=self.todT===st.turnNo?(self.todN||0)+1:1;self.todT=st.turnNo;if(self.todN<=2)self.exerted=false},2,null,{may:true})]},
 "Elsa - Ice Artisan":c=>{const e=FN((st,pi,self,x)=>{if(x)x.exerted=true},2,T_({opp:true,maxStr:3}),{may:true});c.onPlay.push(e);c.onYouPlay.push({type:"location",eff:[e]})},
 "Hamish, Hubert & Harris - Making Mischief":c=>c.onEnd.push(FN((st,pi,self,x)=>{if(self&&self.exerted&&x)x.noReady=true},2,T_({opp:true}))),
 "Mor'du - Savage Cursed Prince":c=>c.onPlay.push(FN((st,pi)=>OWNCH(st,pi).filter(y=>y.card.name!=="Mor'du").forEach(y=>y.exerted=true),(st,pi)=>-OWNCH(st,pi).filter(y=>!y.exerted).length*2)),
 "Alma Madrigal - Keeper of the Flame":c=>{c.onHeal=[FN((st,pi,self,x)=>{if(x)x.exerted=true},2,T_({opp:true,state:"ready"}),{may:true})]},
 "Lord MacGuffin - Clever Swordsman":c=>c.onPlay.push(enterEx((st,pi,self,x)=>damage(st,x,3),(st,pi,x)=>x?instVal(x)-3:-3,T_({opp:true,state:"damaged"}))),
 "Daisy Duck - Trendy Traveler":c=>c.onQuest.push(FN((st,pi,self)=>{if((st.players[pi].playedChars||0)>0&&st.players[pi].playedTurn===st.turnNo)rdyPick(st,pi,self)},2,null,{may:true})),
 "Vincenzo Santorini - On the Run":c=>{c.oppItemsNoReady=true},
 "Lord Macintosh - Wiry and High-Strung":c=>c.onPlay.push(enterEx((st,pi,self,x)=>x.grants.push({kw:"resist 2",until:"srcStart",src:pi}),-1,T_({own:true,helpful:true}))),
 "Lord Dingwall - Bullheaded":c=>c.onPlay.push(enterEx((st,pi,self,x)=>{x.tChal=(x.tChal||0)+3},-1,T_({own:true,helpful:true}))),
 "Mirabel Madrigal - Family Guardian":c=>{c.onHealAny=[FN((st,pi)=>{const y=st._ctx;if(y&&y.owner===pi)rdy(y,true)},1,null,{may:true})]},
 "Powhatan's Staff":c=>{c.acts=[{ink:1,eff:[FN((st,pi)=>{st.players[pi].nextBG=st.turnNo},0)]}]},
 "Ming Lee - Overprotective Parent":c=>{c.onShiftedOn=[FN((st,pi,self,x)=>{if(x)x.noReady=true},3,T_({opp:true,state:"exerted"}))]},
 "Merida - Wisp Conjurer":c=>c.onPlay.push(enterEx((st,pi)=>draw(st,pi,1),2)),
 "Tigger - Hunny Barbarian":c=>c.onChallenge.push(FN((st,pi,self)=>{if(!self||self.onceC===st.turnNo)return;PKs(st,pi,OWNCH(st,pi).filter(z=>z.exerted&&hasCls(z,"hunny")),(y)=>{if(y){self.onceC=st.turnNo;rdy(y)}},{ai:srt((a,b)=>strOf(b)-strOf(a)),prompt:"choose one of your characters"});},2,null,{may:true})),
 "Ming Lee - Giant Red Panda":c=>c.onChallenge.push(FN((st,pi,self)=>{if(self)self._readyAfter=true;if(self)self.noQuest=true},3)),
});

const sacOwn=(st,pi,test,then,n=1,ai)=>{const L=OWNCH(st,pi).concat(st.players[pi].play.filter(z=>!isChar(z))).filter(test);if(L.length<n)return;CH(st,pi,L,ps=>{for(const y of ps)banish(st,y);if(then)then(ps[0])},{n,prompt:`choose ${n>1?n+" cards":"a card"} of yours to banish`,ai:ai||srt((a,b)=>instVal(a)-instVal(b))})};
const underBoost=(st,pi)=>{const P=st.players[pi];if(!P.deck.length)return;PKs(st,pi,P.play.filter(z=>z.card.kw.boost!=null),y=>{if(y&&P.deck.length){y.under.push(P.deck.pop());y.underT=st.turnNo;st._ctx=y;fire(st,pi,"onBoostAny",y)}},{prompt:"put the top card of your deck under which Boost card?",ai:l=>[l[0]]})};
Object.assign(DEFS_EXTRA,{
 "Naveen's Ukulele":c=>{c.acts=[{ink:1,sac:true,noExert:true,eff:[FN((st,pi,self,x)=>{x.tSing=3;x.tSingT=st.turnNo},(st,pi,x,mine)=>mine&&st.players[pi].hand.some(y=>y.card.type==="song"&&y.card.cost>x.card.cost&&y.card.cost<=x.card.cost+3)?3:-2,T_({own:true,helpful:true}))]}]},
 "Hades - Strong Arm":c=>{c.acts=[{ink:3,req:(st,pi,x)=>OWNCH(st,pi).some(y=>y!==x),cost:(st,pi,x)=>sacOwn(st,pi,y=>isChar(y)&&y!==x),eff:[{k:"banish",t:T_({opp:true})}]}]},
 "Wasabi - Methodical Engineer":c=>c.onPlay.push(FN((st,pi,self,x)=>{banish(st,x);gain(st,x.owner,1)},(st,pi,x)=>x?(x.owner===pi?-5:instVal(x)-4):0,T_({kind:"item"}),{may:true})),
 "Beast - Frustrated Designer":c=>{c.acts=[{ink:2,req:(st,pi)=>st.players[pi].play.filter(isItem).length>=2,cost:(st,pi)=>{sacOwn(st,pi,isItem,null,2)},eff:[{k:"dmg",n:5,t:T_({opp:true})}]}]},
 "Maurice - Unconventional Inventor":c=>c.onPlay.push(FN((st,pi)=>{PKs(st,pi,st.players[pi].play.filter(isItem),(y)=>{if(!y)return;const mm=y.card.name==="Maurice's Machine";banish(st,y);draw(st,pi,1);if(mm){PKs(st,pi,OWNCH(st,opp(pi)).filter(q=>q.card.cost<=2),(z)=>{if(z)banish(st,z)},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose an opposing character"});}},{ai:srt((a,b)=>(b.card.name==="Maurice's Machine")-(a.card.name==="Maurice's Machine")||a.card.cost-b.card.cost),prompt:"choose an item"});},(st,pi)=>st.players[pi].play.some(isItem)?2:-3,null,{may:true})),
 "Monsieur D'Arque - Despicable Proprietor":c=>c.onQuest.push(FN((st,pi)=>{sacOwn(st,pi,y=>isItem(y)&&y.card.cost<=2,()=>draw(st,pi,1))},1,null,{may:true})),
 "Bagheera - Guardian Jaguar":c=>c.onBanish.push(FN((st,pi)=>{if(st.active!==pi)OWNCH(st,opp(pi)).forEach(y=>damage(st,y,2))},6)),
 "Candy Drift":c=>{c.onPlay=[{k:"draw",n:1},FN((st,pi,self,x)=>{x.tStr+=5;x.banishEOT=st.turnNo},2,T_({own:true,helpful:true}))]},
 "Gaston - Arrogant Showoff":c=>c.onPlay.push(FN((st,pi,self,x)=>{sacOwn(st,pi,y=>isItem(y)&&y.card.cost<=1,()=>{x.tStr+=2})},0,T_({own:true,helpful:true}),{may:true})),
 "Mrs. Potts - Head Housekeeper":c=>{c.acts=[{ink:0,req:(st,pi)=>st.players[pi].play.some(isItem),cost:(st,pi)=>sacOwn(st,pi,isItem),eff:[FN((st,pi)=>draw(st,pi,1),0)]}]},
 "The Horseman Strikes!":c=>{c.onPlay=[{k:"draw",n:1},{k:"banish",may:true,t:T_({opp:true,test:y=>K(y,"evasive")})}]},
 "Recovered Page":c=>{c.acts=[{ink:1,sac:true,noExert:true,req:(st,pi)=>st.players[pi].play.some(z=>z.card.kw.boost!=null),eff:[FN((st,pi)=>underBoost(st,pi),2)]}]},
 "Merlin - Completing His Research":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const y=ctx.src;if(y&&y._wasChal&&y._underN)draw(st,pi,2)},6)),
 "Goofy - Emerald Champion":c=>c.onAllyBanished.push({inChal:true,eff:[FN((st,pi,self)=>{const b=st._banished;if(!b||b===self||!b.card.inks.includes("Emerald")||st._defender!==b.uid)return;const a=find(st,st._challenger)?.inst;if(a)banish(st,a)},5)]}),
 "Time to Go!":c=>{c.onPlay=[FN((st,pi,self,x)=>{const n=x.under.length?3:2;banish(st,x);draw(st,pi,n)},(st,pi,x)=>x?8-instVal(x):-5,T_({own:true}))]},
 "Pluto - Steel Champion":c=>c.onYouPlay.push({type:"character",test:(st,pi,x)=>x.card.inks.includes("Steel"),eff:[FN((st,pi)=>{PKs(st,pi,st.players[opp(pi)].play.filter(isItem),(y)=>{if(y)banish(st,y)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose an item"});},3,null,{may:true})]}),
 "The Robot Queen":c=>c.onYouPlay.push({type:"character",eff:[FN((st,pi,self)=>{const P=st.players[pi];if(!self||inkAvail(P)<1)return;PKs(st,pi,OWNCH(st,opp(pi)).filter(y=>wilOf(y)-y.damage<=2),(t)=>{if(!t)return;payInk(P,1);banish(st,self);damage(st,t,2)},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose an opposing character"});},2,null,{may:true})]}),
 "Wreck-it Ralph - Raging Wrecker":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const s0=ctx.src?ctx.src._lastStr||0:0;for(const q of [0,1])OWNCH(st,q).filter(y=>strOf(y)<=s0).forEach(y=>banish(st,y))},2)),
 "Grab Your Bow":c=>{c.onPlay=[FN((st,pi)=>UPTO(st,pi,OWNCH(st,opp(pi)).filter(y=>strOf(y)<=2&&!K(y,"ward")),2,y=>banish(st,y),"banish up to 2 opposing characters with 2 strength or less",(a,b)=>instVal(b)-instVal(a)),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>strOf(y)<=2).length*5)]},
 "Lonely Grave":c=>{c.acts=[{ink:0,req:(st,pi)=>st.players[pi].play.some(z=>z.card.kw.boost!=null)&&OWNCH(st,pi).length>1,cost:(st,pi)=>sacOwn(st,pi,y=>isChar(y)&&y.card.kw.boost==null),eff:[FN((st,pi)=>underBoost(st,pi),1)]}]},
 "Graveyard of Christmas Future - Lonely Resting Place":c=>c.onStart.push(FN((st,pi,self)=>{if(!self||self.under.length<2)return;const P=st.players[pi];P.hand.push(...self.under);self.under=[];banish(st,self)},4,null,{may:true})),
 "Darkwing's Chair Set":c=>{c.acts=[{ink:0,sac:true,eff:[FN((st,pi,self,x)=>{if(!noHeal(st))x.damage=Math.max(0,x.damage-(x.card.name==="Darkwing Duck"?4:2))},(st,pi,x,mine)=>mine&&x?Math.min(x.damage,2)*2-1:-2,T_({own:true,helpful:true}))]}]},
 "Chief - Seasoned Tracker":c=>{c.acts=[{ink:0,eff:[FN((st,pi)=>{if(st.oppChalBanT2===st.turnNo)draw(st,pi,1)},st=>st.oppChalBanT2===st.turnNo?3:-1)]}]},
 "Sleepy - Deep Sleeper":c=>c.onBanish.push(FN((st,pi)=>{if(OWNCH(st,pi).some(y=>hasCls(y,"seven dwarfs")||hasCls(y,"princess")))draw(st,pi,1)},2,null,{may:true})),
 "Sabotage":c=>{c.onPlay=[FN((st,pi,self,x)=>{const nm=x.card.name;for(const q of [0,1])st.players[q].play.filter(y=>(isItem(y)||isLoc(y))&&y.card.name===nm).forEach(y=>banish(st,y))},(st,pi,x)=>x?(x.owner===pi?-6:instVal(x)):-3,T_({kind:"itemloc",opp:true}))]},
 "The Island of Nomanisan - Syndrome's Headquarters":c=>{c.onBanishOtherHere=[FN((st,pi,self)=>{if(!self||self.onceB===st.turnNo)return;self.onceB=st.turnNo;dmgBest(st,pi,2)},3,null,{may:true})]},
 "Abu - Wise Sultan":c=>c.onQuest.push(FN((st,pi,self)=>{if(self)banish(st,self)},-3)),
 "One and Only":c=>{c.onPlay=[FN((st,pi)=>{const all=st.players.flatMap(P=>P.play.filter(isChar));const sc=k=>all.filter(y=>y!==k&&y.card.name===k.card.name).reduce((v,y)=>v+(y.owner===pi?-instVal(y):instVal(y)),0);PKs(st,pi,all,(keep)=>{if(!keep||sc(keep)<=0)return;all.filter(y=>y!==keep&&y.card.name===keep.card.name).forEach(y=>banish(st,y))},{ai:srt((a,b)=>sc(b)-sc(a)),prompt:"choose a card"});},1)]},
 "Boo - Energetic Child":c=>c.onChallenge.push(FN((st,pi)=>{const d=chalDef(st);if(d&&isChar(d)&&strOf(d)<=3)banish(st,d)},5)),
 "Mulan - Created by the Vine":c=>{const e=FN((st,pi)=>{PKs(st,pi,st.players[opp(pi)].play.filter(isItem),(y)=>{if(y)banish(st,y)},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose an item"});},3,null,{may:true});c.onPlay.push(e);c.onYouPlay.push({type:"character",test:(st,pi,x)=>hasCls(x,"floodborn"),eff:[e]})},
 "Absorbing Bloom":c=>{c.acts=[{ink:1,eff:[FN((st,pi)=>{if(st.chalBanT===st.turnNo)draw(st,pi,1)},st=>st.chalBanT===st.turnNo?3:-1)]}]},
});

const inkTop2=(st,q)=>putInk(st,q,st.players[q].deck.pop());
Object.assign(DEFS_EXTRA,{
 "Sail the Azurite Sea":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[pi];P.bonusInkT=st.turnNo;if(P.inked&&P.inkN<2)P.inked=false;draw(st,pi,1)},4)]},
 "Rescue Rangers Submarine - Mobile Headquarters":c=>c.onStart.push(FN((st,pi,self)=>{if(self&&hereChars(st,self).length)inkTop2(st,pi)},4,null,{may:true})),
 "Mittens - Sassy Street Cat":c=>{c.onInk=[FN((st,pi,self)=>OWNCH(st,pi).filter(y=>y!==self&&K(y,"bodyguard")).forEach(y=>y.tLore+=1),2)];c.onInkOnce=true},
 "Kuzco - Temporary Whale":c=>{c.onInk=[FN((st,pi,self,x)=>{if(x)retHand(st,x)},(st,pi,x)=>x?(x.owner===pi?-2:instVal(x)):0,T_({opp:true,kind:"any",maxCost:2}),{may:true})];c.onInkOnce=true},
 "Daisy Duck - Multitalented Pirate":c=>{c.onInk=[FN((st,pi)=>oppPicks(st,pi,y=>retHand(st,y)),4)];c.onInkOnce=true},
 "Ink Geyser":c=>{c.onPlay=[FN((st,pi)=>{for(const q of [0,1]){const P=st.players[q];P.ink.forEach(y=>y.exerted=true);while(P.ink.length>3){const y=P.ink.splice(Math.floor(st.r()*P.ink.length),1)[0];reset(y);P.hand.push(y)}}},(st,pi)=>st.players[opp(pi)].ink.length-st.players[pi].ink.length)]},
 "Lyle Tiberius Rourke - Crystallized Mercenary":c=>{c.onInk=[FN((st,pi)=>{for(const q of [0,1])OWNCH(st,q).forEach(y=>damage(st,y,2))},(st,pi)=>OWNCH(st,opp(pi)).length*3-OWNCH(st,pi).length*3)];c.onInkOnce=true},
 "Heihei - Expanded Consciousness":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];const h=P.hand.splice(0);h.forEach(y=>putInk(st,pi,y))},(st,pi)=>st.players[pi].ink.length<6?3:-6)),
 "Pepper - Quick-Thinking Puppy":c=>c.onAllyBanished.push({eff:[FN((st,pi)=>{const b=st._banished,P=st.players[pi];if(b&&hasCls(b,"puppy")&&P.discard.includes(b)){P.discard.splice(P.discard.indexOf(b),1);putInk(st,pi,b)}},3,null,{may:true})]}),
 "All Is Found":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[pi];UPTO(st,pi,P.discard.slice(),2,y=>{if(P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);putInk(st,pi,y)}},"put up to 2 cards from your discard into your inkwell",(a,b)=>a.card.cost-b.card.cost,2)},5)]},
 "Jeweled Collar":c=>{c.onAllyChallenged=[FN((st,pi)=>inkTop2(st,pi),3,null,{may:true})]},
 "Go Go Tomago - Mechanical Engineer":c=>{c.onShiftedOn=[FN((st,pi,self,x)=>{if(x&&hasCls(x,"floodborn"))inkTop2(st,pi)},3,null,{may:true})]},
 "Ratigan - Greedy Genius":c=>c.onEnd.push(FN((st,pi,self)=>{if(self&&st.players[pi].inkT!==st.turnNo)banish(st,self)},-3)),
 "Belle's Favorite Book":c=>{c.acts=[{ink:0,req:(st,pi,x)=>st.players[pi].play.some(y=>isItem(y)&&y!==x),cost:(st,pi,x)=>sacOwn(st,pi,y=>isItem(y)&&y!==x),eff:[FN((st,pi)=>inkTop2(st,pi),3)]}]},
 "Cruella De Vil - Style Icon":c=>{c.onAnyBanished=[FN((st,pi,self)=>{const x=st._ctx;if(!self||!x||!isChar(x)||x.card.cost>2||self.onceB===st.turnNo||st.active!==pi)return;self.onceB=st.turnNo;inkTop2(st,pi)},3)]},
 "Ichabod Crane - Bookish Schoolmaster":c=>c.onQuest.push(FN((st,pi)=>{if(st.players[pi].big5T===st.turnNo)inkTop2(st,pi)},3)),
 "Daisy Duck - Paranormal Investigator":c=>{c.oppInkExerted=true},
 "Cinderella - Dream Come True":c=>c.onEnd.push(FN((st,pi)=>{const P=st.players[pi];if(P.princessT!==st.turnNo||!P.hand.length)return;PKs(st,pi,P.hand,y=>{if(!y)return;P.hand.splice(P.hand.indexOf(y),1);putInk(st,pi,y,false);draw(st,pi,1)},{prompt:"put a card from your hand into your inkwell",ai:by(x=>discardPri(x))})},3,null,{may:true})),
 "Sudden Scare":c=>{c.onPlay=[FN((st,pi,self,x)=>{const q=x.owner,P=st.players[q];P.play=P.play.filter(y=>y!==x);P.discard.push(...x.under);x.under=[];putInk(st,q,x,false);inkTop2(st,q)},(st,pi,x)=>x?instVal(x)-4:-5,T_({opp:true}))]},
 "Spooky Sight":c=>{c.onPlay=[FN((st,pi)=>{for(const q of [0,1])for(const y of OWNCH(st,q).filter(z=>z.card.cost<=3)){const P=st.players[q];P.play=P.play.filter(z=>z!==y);P.discard.push(...y.under);y.under=[];putInk(st,q,y)}},(st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.card.cost<=3).reduce((v,y)=>v+instVal(y),0)-OWNCH(st,pi).filter(y=>y.card.cost<=3).reduce((v,y)=>v+instVal(y),0))]},
 "Ink Amplifier":c=>{c.onOppDraw=[FN((st,pi)=>{const o=st.players[opp(pi)];if(st.active===opp(pi)&&o.drawsT===st.turnNo&&o.drawsN===2)inkTop2(st,pi)},3,null,{may:true})]},
 "Jiminy Cricket - Ghost of Christmas Past":c=>{c.onBoostAny=[FN((st,pi,self)=>{if(st._ctx!==self)return;const P=st.players[pi];PKs(st,pi,P.discard,y=>{if(y){P.discard.splice(P.discard.indexOf(y),1);putInk(st,pi,y)}},{prompt:"put a card from your discard into your inkwell",ai:srt((a,b)=>a.card.cost-b.card.cost)})},3,null,{may:true})]},
 "Belle - Snowfield Strategist":c=>c.onAllyBanished.push({eff:[FN((st,pi)=>{const b=st._banished,P=st.players[pi];if(b&&P.discard.includes(b)){P.discard.splice(P.discard.indexOf(b),1);putInk(st,pi,b)}},3,null,{may:true})]}),
 "Visiting Christmas Past":c=>{c.onPlay=[FN((st,pi)=>{for(const y of st.players[pi].play){const u=y.under.splice(0);u.forEach(z=>putInk(st,pi,z))}},(st,pi)=>st.players[pi].play.reduce((v,y)=>v+y.under.length,0)*3)]},
 "Kida - Discovering the Unknown":c=>c.onQuest.push(FN((st,pi)=>{if(D2(st,pi))inkTop2(st,pi)},3,null,{may:true})),
 "Kashekim - Wise King":c=>c.onEnd.push(FN((st,pi)=>{if(D2(st,pi))putInk(st,pi,st.players[pi].deck.pop(),false)},3,null,{may:true})),
 "Kida - Crystal Scion":c=>c.onPlay.push(FN((st,pi)=>{for(const q of [pi,opp(pi)]){const P=st.players[q];if(q!==pi&&P.ink.length>=8)continue;UPTO(st,q,P.discard.slice(),5,y=>{if(P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);putInk(st,q,y)}},"put up to 5 cards from your discard into your inkwell",(a,b)=>0,5)}},4)),
 "Ursula - Deal Maker":c=>c.onEnd.push(FN((st,pi,self)=>{if(!self||!self.exerted)return;PKs(st,pi,OWNCH(st,pi),(y)=>{if(!y)return;const P=st.players[pi];P.play=P.play.filter(z=>z!==y);P.discard.push(...y.under);y.under=[];putInk(st,pi,y)},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose one of your characters"});},-1)),
 "The Madrigal Family - Every Generation":c=>{c.onHeal=[FN((st,pi,self)=>{if(!self||self.onceH===st.turnNo)return;self.onceH=st.turnNo;inkTop2(st,pi)},3)]},
 "Mickey Mouse & Minnie Mouse - Adventuring Duo":c=>{c.banishToInk=true},
 "Randall Boggs - Scary Smart":c=>c.onEnd.push(FN((st,pi)=>{const P=st.players[pi];if(P.ink.length&&P.ink.every(y=>y.exerted))gain(st,pi,1)},3)),
 "Antonio Madrigal - Animal Doctor":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(!x||!x.damage||noHeal(st))return;x.damage=Math.max(0,x.damage-3);st.players[pi].healT=st.turnNo;inkTop2(st,pi)},(st,pi,x)=>x&&x.damage?5:-1,T_({own:true,helpful:true}),{may:true})),
 "Laugh Canister":c=>{c.acts=[{ink:0,eff:[FN((st,pi)=>{inkTop2(st,pi);const o=st.players[opp(pi)];if(o.ink.length<o.hand.length+2&&o.ink.length<7)inkTop2(st,opp(pi))},2)]}]},
});

const myT=(st,pi)=>st.active===pi;
Object.assign(DEFS_EXTRA,{
 "Hundred Acre Island - Pooh's Home":c=>{c.onBanishedHere=[FN((st,pi)=>{if(!myT(st,pi))gain(st,pi,1)},4)]},
 "Hades - Lord of the Dead":c=>c.onAllyBanished.push({eff:[FN((st,pi,self)=>{if(!myT(st,pi)&&st._banished!==self)gain(st,pi,2)},6)]}),
 "Basil - Disguised Detective":c=>c.onInk.push(FN((st,pi)=>{const P=st.players[pi];if(myT(st,pi)&&inkAvail(P)>=1&&st.players[opp(pi)].hand.length){payInk(P,1);resolve(st,pi,[{k:"oppDiscard",n:1}],null)}},3,null,{may:true})),
 "Tadashi Hamada - Gifted Roboticist":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{if(myT(st,pi))return;const P=st.players[pi];putInk(st,pi,P.deck.pop(),false);const y=ctx.src;if(y&&P.discard.includes(y)){P.discard.splice(P.discard.indexOf(y),1);putInk(st,pi,y)}},5,null,{may:true})),
 "Jim Hawkins - Stubborn Cabin Boy":c=>c.onInk.push(FN((st,pi,self)=>{if(myT(st,pi)&&self)self.tChal=(self.tChal||0)+2},2)),
 "Te Kā - Elemental Terror":c=>{c.onOppExerted=[FN((st,pi)=>{const y=st._ctx;if(y&&find(st,y.uid)?.zone==="play")banish(st,y)},6)]},
 "Kenai - Magical Bear":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const y=ctx.src,P=st.players[pi];if(!myT(st,pi)||!y||!y._wasChal||!P.discard.includes(y))return;toHandFrom(P,"discard",y);gain(st,pi,1)},5)),
 "Maid Marian - Badminton Ace":c=>{c.onAllyDamaged=[FN((st,pi)=>{const y=st._ctx;if(!myT(st,pi)&&y&&hasCls(y,"ally"))dmgBest(st,pi,1)},2)]},
 "Raya - Guidance Seeker":c=>c.onInk.push(FN((st,pi,self)=>{if(myT(st,pi)&&self)self.grants.push({kw:"resist 1",until:"srcStart",src:pi})},2)),
 "Archimedes - Resourceful Owl":c=>{c.onAnyBanished=[FN((st,pi)=>{const y=st._ctx;if(myT(st,pi)&&y&&isItem(y)){draw(st,pi,1);discOne(st,pi)}},2,null,{may:true})]},
 "Brutus - Fearsome Crocodile":c=>c.onBanish.push(FN((st,pi)=>{if(myT(st,pi)&&st.players[pi].dmgT===st.turnNo)gain(st,pi,2)},6)),
 "Stitch - Alien Troublemaker":c=>c.onBanishOther.push(FN((st,pi)=>{if(myT(st,pi)){draw(st,pi,1);gain(st,pi,1)}},6,null,{may:true})),
 "Duckworth - Ghost Butler":c=>c.onBanish.push(FN((st,pi)=>{if(myT(st,pi))underBoost(st,pi)},2,null,{may:true})),
 "Grimorum Arcanorum":c=>{c.onOppExerted=[{k:"gainLore",n:1}]},
 "The Headless Horseman - Terror of Sleepy Hollow":c=>{c.onAnyBanished=[FN((st,pi)=>{const y=st._ctx;if(myT(st,pi)&&y&&isChar(y)&&y.owner!==pi)OWNCH(st,pi).forEach(z=>z.tStr+=1)},2)]},
 "Fairy Godmother's Wand":c=>c.onInk.push(FN((st,pi)=>{if(!myT(st,pi))return;PKs(st,pi,OWNCH(st,pi).filter(z=>hasCls(z,"princess")),(y)=>{if(y)y.grants.push({kw:"ward",until:"srcStart",src:pi})},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose one of your characters"});},2)),
 "Nick Wilde - Persistent Investigator":c=>{const e=FN((st,pi)=>{const a=find(st,st._challenger)?.inst;if(myT(st,pi)&&a&&hasCls(a,"detective"))draw(st,pi,1)},3);c.onAllyBanishOther=[e];c.onBanishOther.push(e)},
 "The Sword of Hercules":c=>{c.onAllyBanishOther=[FN((st,pi)=>{if(myT(st,pi))gain(st,pi,1)},4)]},
 "Wisdom of the Willow":c=>{c.onPlay=[FN((st,pi)=>{st.players[pi].willowT=st.turnNo},4)]},
 "Darkwing Duck - Darkwarrior":c=>{c.onAnyBanished=[FN((st,pi,self)=>{const y=st._ctx;if(myT(st,pi)&&y&&isItem(y)&&self)self.grants.push({kw:"resist 1",until:"srcStart",src:pi})},2)]},
 "Darkwing Duck - Cool Under Pressure":c=>{c.onAnyBanished=[FN((st,pi)=>{const y=st._ctx,P=st.players[pi];if(myT(st,pi)&&y&&isItem(y)&&inkAvail(P)>=1){payInk(P,1);dmgBest(st,pi,2)}},3,null,{may:true})]},
 "Darkwing Tower - Icy Headquarters":c=>{c.onAnyBanished=[FN((st,pi,self)=>{const y=st._ctx;if(!myT(st,pi)||!y||!isChar(y)||y.owner===pi||!hasCls(y,"villain")||!self)return;PKs(st,pi,hereChars(st,self).filter(q=>q.exerted),z=>rdy(z),{prompt:"ready a character at this location",ai:l=>[l[0]]})},2,null,{may:true})]},
 "Alien - True Believer":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{if(!myT(st,pi))return;const P=st.players[pi];PKs(st,pi,P.discard.filter(z=>z.card.name==="Alien"&&z!==ctx.src),y=>{if(y)toHandFrom(P,"discard",y)},{prompt:"return an Alien from your discard",ai:l=>[l[0]]})},3)),
 "Sid Phillips - Toy Surgeon":c=>{c.onAnyBanished=[FN((st,pi)=>{const y=st._ctx;if(myT(st,pi)&&y&&isChar(y)&&hasCls(y,"toy"))gain(st,pi,2)},5)]},
 "Mrs. Incredible - Determined Rescuer":c=>{c.onAnyBanished=[FN((st,pi)=>{const y=st._ctx;if(!myT(st,pi)||!y||!y._wasChal)return;PKs(st,pi,OWNCH(st,pi).filter(q=>q.exerted&&hasCls(q,"super")),(z)=>{rdy(z)},{ai:srt((a,b)=>strOf(b)-strOf(a)),prompt:"choose one of your characters"});},2,null,{may:true})]},
 "Scar - Created by the Vine":c=>{const e=FN((st,pi)=>{const a=find(st,st._challenger)?.inst;if(myT(st,pi)&&a&&hasCls(a,"floodborn"))gain(st,pi,1)},4);c.onAllyBanishOther=[e];c.onBanishOther.push(e)},
});

const nextDisc=(st,pi,n,test,shift)=>{const P=st.players[pi];(P.disc=P.disc||[]).push({n,test,shift})};
Object.assign(DEFS_EXTRA,{
 "Winnie the Pooh - Hunny Pirate":c=>c.onQuest.push(FN((st,pi)=>nextDisc(st,pi,1,y=>y.type==="character"&&y.cls.includes("Pirate")),1)),
 "Seeking the Half Crown":c=>{c.costFn=(st,pi)=>OWNCH(st,pi).filter(y=>hasCls(y,"sorcerer")).length},
 "Gadget Hackwrench - Brilliant Bosun":c=>(c.auras=c.auras||[]).push({costCls:"inventor",costType:"character",costN:1,cond:(x,S)=>!!S&&S.players[x.owner].play.filter(isItem).length>=3}),
 "Yokai - Enigmatic Inventor":c=>c.onQuest.push(FN((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.play.filter(isItem),(y)=>{if(!y||!P.hand.some(isItem))return;P.play=P.play.filter(z=>z!==y);reset(y);P.hand.push(y);nextDisc(st,pi,2,z=>z.type==="item")},{ai:srt((a,b)=>a.card.cost-b.card.cost),prompt:"choose an item"});},1,null,{may:true})),
 "Baymax - Personal Healthcare Companion":c=>{c.costFn=(st,pi)=>OWNCH(st,pi).some(y=>hasCls(y,"inventor"))?1:0},
 "Perdita - Playful Mother":c=>c.onQuest.push(FN((st,pi)=>nextDisc(st,pi,2,y=>y.type==="character"&&y.cls.includes("Puppy")),1)),
 "Yokai - Intellectual Schemer":c=>(c.auras=c.auras||[]).push({shiftDisc:1}),
 "John Silver - Vengeful Pirate":c=>{c.costFn=(st,pi)=>st.players[opp(pi)].dmgT===st.turnNo?2:0},
 "Miss Bianca - Unwavering Agent":c=>{c.costFn=(st,pi)=>OWNCH(st,pi).some(y=>hasCls(y,"ally"))?2:0},
 "Donald Duck - Coin Collector":c=>{c.costFn=(st,pi)=>2*st.players[pi].play.filter(y=>y.card.name==="The Nephews' Piggy Bank").length},
 "Aurora - Holding Court":c=>c.onQuest.push(FN((st,pi)=>nextDisc(st,pi,1,y=>y.type==="character"&&(y.cls.includes("Princess")||y.cls.includes("Queen"))),1)),
 "Munchings and Crunchings":c=>(c.auras=c.auras||[]).push({costCls:"any",costType:"character",costN:1,costName:"Gurgi"}),
 "Duckburg - Funso's Funzone":c=>{c.onQuestHere=[FN((st,pi)=>nextDisc(st,pi,2,y=>y.type==="character"),2)]},
 "Raksha - Fearless Mother":c=>{c.moveDiscOnce=1},
 "Grandmother Willow - Ancient Advisor":c=>c.onStart.push(FN((st,pi)=>nextDisc(st,pi,1,y=>y.type==="character"),2)),
 "Reuben - Sandwich Expert":c=>{c.acts=[{ink:0,eff:[FN((st,pi,self,x)=>{if(!x||noHeal(st))return;const r0=Math.min(2,x.damage);x.damage-=r0;if(r0){st.players[pi].healT=st.turnNo;fire(st,pi,"onHeal",r0);nextDisc(st,pi,r0,y=>y.type==="character")}},(st,pi,x,mine)=>mine&&x?Math.min(2,x.damage)*2.5:-1,T_({own:true,helpful:true}))]}]},
 "Mulan - Ready for Battle":c=>{c.costFn=(st,pi)=>OWNCH(st,pi).some(y=>y.damage)?1:0},
 "Olaf - Snowman of Action":c=>{c.costFn=(st,pi)=>st.players[pi].discard.filter(isAct).length},
 "Gramma Tala - Connected to Nature":c=>{c.costFn=(st,pi)=>st.players[pi].ink.length},
 "Dr. Hamsterviel - Infamous Scientist":c=>{c.costFn=(st,pi)=>st.players[pi].discard.filter(y=>isChar(y)&&hasCls(y,"alien")).length},
 "Jessie - Lively Cowgirl":c=>{c.onPaySmall=[FN((st,pi,self,x)=>{if(x){x.lStr=(x.lStr||0)-1;x.lSrc=pi}},2,T_({opp:true}))]},
 "Helga Sinclair - No Backup Needed":c=>{c.costFn=(st,pi)=>D2(st,pi)?2:0},
 "Buzz Lightyear - On the Way":c=>{c.onPaySmall=[FN((st,pi)=>{const y=st._ctx;if(y&&!isChar(y)){draw(st,pi,1);discOne(st,pi)}},2)]},
 "Wind-Up Frog - Sid's Toy":c=>{c.costFn=(st,pi)=>st.players[pi].toyBanT===st.turnNo?2:0},
 "Babyhead - Leader of Sid's Toys":c=>{c.onPaySmall=[FN((st,pi,self,x)=>{if(x)x.tStr+=2},1,T_({own:true,helpful:true}))]},
 "Ming Lee - Proud Parent":c=>{c.costFn=(st,pi)=>st.players[pi].songTurn===st.turnNo?1:0},
 "Mrs. Incredible - Created by the Vine":c=>c.onAllyQuest.push({test:x=>hasCls(x,"floodborn"),eff:[FN((st,pi)=>nextDisc(st,pi,1,()=>true,true),2)]}),
 "Carl Fredricksen - Loving Husband":c=>c.onPlay.push(FN((st,pi)=>nextDisc(st,pi,2,y=>y.name==="Ellie Fredricksen"),1)),
 "Belle - Always Reading":c=>{c.shiftOntoDisc=1},
});

const drawIf=(f,may)=>FN((st,pi,self)=>{if(f(st,pi,self))draw(st,pi,1)},2,null,may?{may:true}:undefined);
Object.assign(DEFS_EXTRA,{
 "Yzma - Conniving Chemist":c=>{c.acts=[{ink:0,eff:[FN((st,pi)=>{const P=st.players[pi];if(P.hand.length<3)draw(st,pi,3-P.hand.length)},(st,pi)=>(3-Math.min(3,st.players[pi].hand.length))*2.5-1)]}]},
 "Genie - Wonderful Trickster":c=>c.onYouPlay.push({type:"any",eff:[{k:"draw",n:1}]}),
 "Daisy Duck - Pirate Captain":c=>{const e=FN((st,pi)=>{const x=st._ctx;if(x&&x.at!=null&&hasCls(x,"pirate"))draw(st,pi,1)},2);c.onAllyQuest.push({eff:[e]});c.onQuest.push(FN((st,pi,self)=>{if(self&&self.at!=null&&hasCls(self,"pirate"))draw(st,pi,1)},2))},
 "Archimedes - Exceptional Owl":c=>{c.onChosen=[FN((st,pi)=>draw(st,pi,1),2,null,{may:true})]},
 "Hiro Hamada - Future Champion":c=>{c.onShiftedOn=[FN((st,pi,self,x)=>{if(x&&hasCls(x,"floodborn"))draw(st,pi,1)},2)]},
 "Mad Hatter - Unruly Eccentric":c=>{const e=FN((st,pi)=>{const a=find(st,st._challenger)?.inst;if(a&&a.damage)draw(st,pi,1)},2,null,{may:true});c.onAnyChallenge=[e]},
 "Jasmine - Inspired Researcher":c=>c.onQuest.push(FN((st,pi)=>{if(!st.players[pi].hand.length)draw(st,pi,OWNCH(st,pi).filter(y=>hasCls(y,"ally")).length)},3)),
 "Bruno Madrigal - Singing Seer":c=>c.onSing.push(FN((st,pi)=>draw(st,pi,OWNCH(st,pi).length),3,null,{may:true})),
 "Hades - Ruthless Tyrant":c=>{const e=FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&wilOf(z)-z.damage>2),(y)=>{if(y){damage(st,y,2);draw(st,pi,2)}},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose one of your characters"});},2,null,{may:true});c.onPlay.push(e);c.onQuest.push(e)},
 "Royal Guard - Octopus Soldier":c=>{c.chalOnDraw=true},
 "Arthur - Determined Squire":c=>{c.skipDraw=true},
 "The Bitterwood - Underground Forest":c=>{c.onMoveHere=[FN((st,pi,self)=>{const x=st._ctx;if(!self||!x||strOf(x)<5||self.onceM===st.turnNo)return;self.onceM=st.turnNo;draw(st,pi,1)},2,null,{may:true})]},
 "Colors of the Wind":c=>{c.onPlay=[FN((st,pi)=>{const inks=new Set();for(const q of [0,1]){const y=st.players[q].deck[st.players[q].deck.length-1];if(y)y.card.inks.forEach(k=>inks.add(k))}draw(st,pi,inks.size)},4)]},
 "Minnie Mouse - Mrs. Cratchit":c=>c.onPlay.push(FN((st,pi)=>{if(st.players[pi].play.some(z=>z.card.kw.boost!=null)){underBoost(st,pi);draw(st,pi,1)}},3,null,{may:true})),
 "Chip - Team Player":c=>c.onPlay.push(drawIf((st,pi,self)=>OWNCH(st,pi).some(y=>y!==self&&wilOf(y)>=4),true)),
 "Doc - Taking Notes":c=>c.onPlay.push(drawIf((st,pi,self)=>OWNCH(st,pi).some(y=>y!==self&&(hasCls(y,"seven dwarfs")||hasCls(y,"princess"))))),
 "Mirage - Super Recruiter":c=>c.onPlay.push(drawIf((st,pi,self)=>OWNCH(st,pi).some(y=>y!==self&&(hasCls(y,"super")||hasCls(y,"hero"))),true)),
 "Super Suit":c=>{c.acts=[{ink:2,eff:[drawIf((st,pi)=>st.players[pi].heroT===st.turnNo)]}]},
 "The Queen - Devious Disguise":c=>c.onPlay.push(FN((st,pi)=>{draw(st,pi,1);gain(st,opp(pi),2)},(st,pi)=>st.players[opp(pi)].lore<=12?1:-8,null,{may:true})),
 "Strange Things":c=>{c.onPlay=[FN((st,pi)=>{UPTO(st,pi,OWNCH(st,opp(pi)).filter(y=>!K(y,"ward")),2,y=>{y.noQuestNext=true;y.noQuestNow=true},"choose up to 2 opposing characters: they can't quest",(a,b)=>loreOf(b)-loreOf(a));draw(st,pi,1)},5)]},
 "Mr. Incredible - Super Strong":c=>{const e=FN((st,pi)=>{const a=find(st,st._challenger)?.inst;if(a&&hasCls(a,"super"))draw(st,pi,1)},3);c.onAllyChallenge.push(e);c.onChallenge.push(e)},
 "4*Town - Hottest Band of the Year":c=>c.onSing.push(FN((st,pi)=>{if((st._singers||1)>1||st._singTogether)draw(st,pi,1)},2)),
 "If I Didn't Have You":c=>{c.onPlay=[FN((st,pi)=>{draw(st,pi,2);draw(st,opp(pi),2)},2)]},
 "Fflewddur Fflam - Luckless Bard":c=>c.onPlay.push(drawIf((st,pi)=>st.players[pi].questT===st.turnNo)),
 "With a Few Good Friends":c=>{c.onPlay=[FN((st,pi)=>draw(st,pi,new Set(OWNCH(st,pi).flatMap(y=>y.card.inks)).size),4)]},
 "Dash Parr & Violet Parr - Super Siblings":c=>{const e=FN((st,pi,self)=>{if(self)draw(st,pi,self.under.length)},3);c.onQuest.push(e);c.onChallenge.push(e)},
 "Dug - Good Boy":c=>c.onPlay.push(drawIf((st,pi)=>st.players[pi].play.some(isItem))),
});

const unchal=(st,x)=>{if(x)x.unchalUntil=st.turnNo+2};
const noChal=(st,x,mq)=>{if(!x)return;x.noChalUntil=st.turnNo+2;if(mq)x.mustQuestUntil=st.turnNo+2};
Object.assign(DEFS_EXTRA,{
 "Kanga - Nurturing Mother":c=>c.onQuest.push(FN((st,pi,self,x)=>unchal(st,x),2,T_({own:true,helpful:true}))),
 "Safe and Sound":c=>{c.onPlay=[FN((st,pi,self,x)=>unchal(st,x),(st,pi,x)=>x?instVal(x)/3:0,T_({own:true,helpful:true}))]},
 "Moana - Self-Taught Sailor":c=>{c.chalNeed=(st,pi)=>OWNCH(st,pi).some(y=>hasCls(y,"captain"))},
 "Nick Wilde - Sly Fox":c=>{c.unchalBy=(st,a,x)=>st.players[x.owner].play.some(isItem)},
 "Mr. Big - Shrewd Tycoon":c=>{c.unchalBy=(st,a)=>strOf(a)>=2},
 "Galactic Council Chamber - Courtroom":c=>{c.unchalBy=(st,a,x)=>hereChars(st,x).some(y=>hasCls(y,"alien")||hasCls(y,"robot"))},
 "Isabela Madrigal - In the Moment":c=>c.onAllySing=[FN((st,pi,self)=>unchal(st,self),2)],
 "Gizmoduck - Suited Up":c=>{c.chalReadyDamaged=true},
 "King of Hearts - Picky Ruler":c=>{c.unchalAura=(st,y,x,a)=>isChar(x)&&!!a.damage},
 "Restoring Atlantis":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,pi).forEach(y=>unchal(st,y)),(st,pi)=>OWNCH(st,pi).length*2)]},
 "Iago - Out of Reach":c=>{c.unchalBy=(st,a,x)=>OWNCH(st,x.owner).some(y=>y!==x&&y.exerted)},
 "Gaston - Frightful Bully":c=>c.onQuest.push(FN((st,pi,self,x)=>{if(self&&self.under.length)noChal(st,x,true)},3,T_({opp:true}))),
 "Cobra Bubbles - Dedicated Official":c=>c.onQuest.push(FN((st,pi,self,x)=>noChal(st,x,true),3,T_({opp:true}))),
 "Pocahontas - Peacekeeper":c=>c.onPlay.push({k:"cond",shifted:true,eff:[FN((st,pi)=>{if(st.players[pi].chalT!==st.turnNo)st.noChalUntil=st.turnNo+2},3)]}),
 "Mother Will Protect You":c=>{c.onPlay=[FN((st,pi,self,x)=>unchal(st,x),(st,pi,x)=>x?instVal(x)/3:0,T_({own:true,helpful:true}))]},
 "Rapunzel - Ethereal Protector":c=>c.onQuest.push(FN((st,pi,self,x)=>{if(self&&self.under.length)noChal(st,x)},3,T_({opp:true}))),
 "Winterspell":c=>{c.onPlay=[FN((st,pi)=>{PKs(st,pi,st.players[pi].play.filter(isLoc),(l)=>{unchal(st,l)},{ai:srt((a,b)=>b.damage-a.damage),prompt:"choose a location"});},1),{k:"draw",n:1}]},
 "Ariel - Curious Traveler":c=>c.onQuest.push(FN((st,pi,self,x)=>{const P=st.players[pi];if(P.playedTurn===st.turnNo&&(P.playedChars||0)>((self&&self.playedOn===st.turnNo)?1:0))noChal(st,x,true)},3,T_({opp:true}))),
 "This Growing Pressure":c=>{c.onPlay=[FN((st,pi,self,x)=>noChal(st,x,true),3,T_({opp:true})),{k:"draw",n:1}]},
 "Diablo - Stone Servant":c=>{c.unchalAura=(st,y,x)=>y.exerted&&isChar(x)&&hasCls(x,"villain")},
 "Woody - Town Sheriff":c=>c.onPlay.push(FN((st,pi,self,x)=>noChal(st,x,true),3,T_({opp:true}))),
 "Boo - In Disguise":c=>{c.unchalBy=(st,a,x)=>OWNCH(st,x.owner).some(y=>y.card.name==="Sulley"&&y.exerted)},
 "Maximus - Relentless Stallion":c=>c.statics.push({kw:"challenger 2",cond:(x,S)=>!!S&&S.active===x.owner&&discThisTurn(S,S.players[x.owner])>0},{flag:"challengeReady",cond:(x,S)=>!!S&&S.active===x.owner&&discThisTurn(S,S.players[x.owner])>0}),
 "Cower Before Me!":c=>{c.onPlay=[FN((st,pi)=>UPTO(st,pi,OWNCH(st,opp(pi)).filter(y=>!K(y,"ward")),2,y=>noChal(st,y),"choose up to 2 opposing characters: they can't challenge",(a,b)=>strOf(b)-strOf(a)),4)]},
 "Attack of the Vine!":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,pi).filter(y=>hasCls(y,"floodborn")).forEach(y=>{y.grants.push({kw:"resist 2",until:"turnEnd",src:pi});y.chReady=st.turnNo}),3)]},
});

const putDmg=(st,x,n)=>{if(!x||n<=0||find(st,x.uid)?.zone!=="play")return;x.damage+=n;if(x.damage>=wilOf(x))banish(st,x)};
const moveDmg=(st,from,to,n)=>{if(!from||!to)return 0;const k=Math.min(n,from.damage);if(!k)return 0;from.damage-=k;putDmg(st,to,k);return k};
const healAmt=st=>typeof st._ctx==="number"?st._ctx:1;
Object.assign(DEFS_EXTRA,{
 "Go Go Tomago - Darting Dynamo":c=>c.onPlay.push(FN((st,pi,self,x)=>{const P=st.players[pi];if(inkAvail(P)>=2&&x&&x.damage){payInk(P,2);gain(st,pi,x.damage)}},(st,pi,x)=>x&&x.damage>=2?x.damage*3:-2,T_({opp:true,state:"damaged"}),{may:true})),
 "Baymax - Armored Companion":c=>{const e=FN((st,pi,self)=>{if(noHeal(st))return;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.damage),(y)=>{if(!y)return;const r0=Math.min(2,y.damage);y.damage-=r0;st.players[pi].healT=st.turnNo;fire(st,pi,"onHeal",r0);gain(st,pi,r0)},{ai:srt((a,b)=>b.damage-a.damage),prompt:"choose one of your characters"});},4,null,{may:true});c.onPlay.push(e);c.onQuest.push(e)},
 "Mr. Smee - Captain of the Jolly Roger":c=>c.onPlay.push(FN((st,pi,self,x)=>damage(st,x,OWNCH(st,pi).filter(y=>y!==self&&hasCls(y,"pirate")).length),(st,pi,x)=>x?2:0,T_({opp:true}),{may:true})),
 "Treasure Mountain - Azurite Sea Island":c=>c.onStart.push(FN((st,pi,self)=>{const n=self?hereChars(st,self).length:0;if(n)dmgBest(st,pi,n)},3)),
 "Mother Gothel - Vain Sorceress":c=>{const e=FN((st,pi)=>{PKs(st,pi,OWNCH(st,pi).filter(y=>y.damage),f=>{if(!f)return;PKs(st,pi,OWNCH(st,opp(pi)).filter(y=>!K(y,"ward")),(t)=>{moveDmg(st,f,t,1)},{ai:srt((a,b)=>(wilOf(a)-a.damage)-(wilOf(b)-b.damage)),prompt:"move 1 damage to which opposing character?"})},{prompt:"move 1 damage from which of your characters?",ai:srt((a,b)=>b.damage-a.damage)})},2,null,{may:true});c.onAllyChallenge.push(e);c.onChallenge.push(e)},
 "Queen of Hearts - Unpredictable Bully":c=>{const e=FN((st,pi)=>{const y=st._ctx;if(y&&isChar(y))putDmg(st,y,1)},1);c.onYouPlay.push({type:"character",eff:[FN((st,pi)=>{const P=st.players[pi];putDmg(st,P.play[P.play.length-1],1)},-1)]});c.onOppPlayChar=[e]},
 "Minnie Mouse - Daring Defender":c=>c.statics.push({stat:"str",cond:"always",count:x=>x.damage}),
 "Nero - Fearsome Crocodile":c=>{c.acts=[{ink:0,req:(st,pi,x)=>x.damage>0,eff:[FN((st,pi,self,x)=>moveDmg(st,self,x,1),3,T_({opp:true}))]}]},
 "Everybody's Got a Weakness":c=>{c.onPlay=[FN((st,pi,self,x)=>{let n=0;for(const y of OWNCH(st,pi).filter(z=>z.damage))n+=moveDmg(st,y,x,1);draw(st,pi,n)},(st,pi,x)=>OWNCH(st,pi).filter(y=>y.damage).length*4,T_({opp:true}))]},
 "Alice - Clumsy as Can Be":c=>c.onQuest.push(FN((st,pi,self)=>{for(const q of [0,1])OWNCH(st,q).filter(y=>y!==self).forEach(y=>putDmg(st,y,1))},(st,pi)=>OWNCH(st,opp(pi)).length*2-OWNCH(st,pi).length*2)),
 "Maui - Stubborn Trickster":c=>c.onBanish.push({k:"modal",opts:[[FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>putDmg(st,y,2)),(st,pi)=>OWNCH(st,opp(pi)).length*4)],[FN((st,pi)=>st.players[opp(pi)].play.filter(isItem).forEach(y=>banish(st,y)),(st,pi)=>st.players[opp(pi)].play.filter(isItem).length*5)],[FN((st,pi)=>st.players[opp(pi)].play.filter(isLoc).forEach(y=>banish(st,y)),(st,pi)=>st.players[opp(pi)].play.filter(isLoc).length*6)]],optText:["2 damage counters on all opposing characters","Banish all opposing items","Banish all opposing locations"]}),
 "The Dodo - Outlandish Storyteller":c=>c.statics.push({stat:"str",cond:"always",count:x=>x.damage}),
 "Most Everyone's Mad Here":c=>{c.onPlay=[FN((st,pi,self,x)=>{gain(st,pi,x.damage);banish(st,x)},(st,pi,x)=>x?x.damage*4+(x.owner!==pi?instVal(x):-instVal(x)):0,T_({kind:"char"}))]},
 "Can't Hold It Back Anymore":c=>{c.onPlay=[FN((st,pi,self,x)=>{x.exerted=true;for(const q of [0,1])for(const y of OWNCH(st,q))if(y!==x)moveDmg(st,y,x,y.damage)},(st,pi,x)=>x?st.players.flatMap(P=>P.play.filter(isChar)).reduce((v,y)=>v+(y!==x?y.damage:0),0)*2:0,T_({opp:true}))]},
 "Can't Hold it Back Anymore":c=>DEFS_EXTRA["Can't Hold It Back Anymore"](c),
 "Bellwether - Master Manipulator":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const y=ctx.src;if(y&&y._wasChal&&st._defender===y.uid)OWNCH(st,opp(pi)).forEach(z=>putDmg(st,z,1))},4)),
 "Shere Khan - Fearsome Tiger":c=>c.onQuest.push(FN((st,pi,self,x)=>{banish(st,x);PKs(st,pi,OWNCH(st,opp(pi)).filter(z=>z!==x&&!K(z,"ward")),y=>{if(y)putDmg(st,y,1)},{prompt:"put 1 damage counter on an opposing character",ai:l=>[l[0]]})},(st,pi,x)=>x?instVal(x):0,T_({opp:true,state:"damaged"}))),
 "Malicious, Mean, and Scary":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>putDmg(st,y,1)),(st,pi)=>OWNCH(st,opp(pi)).length*2)]},
 "Ohana Means Family":c=>{c.onPlay=[FN((st,pi,self,x)=>{if(noHeal(st))return;const n=x.damage;x.damage=0;if(n){st.players[pi].healT=st.turnNo;fire(st,pi,"onHeal",n)}draw(st,pi,n)},(st,pi,x)=>x?x.damage*3:0,T_({own:true,helpful:true}))]},
 "Nani's Payback":c=>{c.onPlay=[FN((st,pi,self,x)=>{loseLore(st,st.players[opp(pi)],Math.min(4,x?x.damage:0));draw(st,pi,1)},(st,pi,x)=>x?Math.min(4,x.damage)*4+2:2,T_({own:true}))]},
 "Isabela Madrigal - Caring Cultivator":c=>{c.onHeal=[FN((st,pi)=>gain(st,pi,healAmt(st)),4)]},
 "Merida - Formidable Archer":c=>{c.onPlay.push(FN(()=>{},0))},
 "I'm Never Not by Your Side":c=>{c.onPlay=[FN((st,pi)=>{if(noHeal(st))return;healStep(st,pi,4,tot=>{if(tot){st.players[pi].healT=st.turnNo;fire(st,pi,"onHeal",tot)}gain(st,pi,tot)})},(st,pi)=>Math.min(4,OWNCH(st,pi).reduce((v,y)=>v+y.damage,0))*4)]},
});

const toBottomX=(st,x)=>{const f=find(st,x.uid);if(!f||f.zone!=="play")return;const P=st.players[f.pi];P.play=P.play.filter(y=>y!==x);P.play.filter(y=>y.at===x.uid).forEach(y=>y.at=null);reset(x);P.discard.push(...x.under);x.under=[];P.deck.unshift(x)};
Object.assign(DEFS_EXTRA,{
 "Yzma - Transformed Kitten":c=>c.onBanish.push(FN((st,pi,self,x,ctx)=>{const P=st.players[pi],y=ctx.src;if(y&&P.discard.includes(y)&&P.hand.length>st.players[opp(pi)].hand.length)toHandFrom(P,"discard",y)},3,null,{may:true})),
 "Madame Medusa - Deceiving Partner":c=>c.onPlay.push(FN((st,pi,self,x)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&wilOf(z)-z.damage>2),(y)=>{if(!y||!x)return;damage(st,y,2);retHand(st,x)},{ai:srt((a,b)=>instVal(a)-instVal(b)),prompt:"choose one of your characters"});},(st,pi,x)=>x?instVal(x)-2:0,T_({opp:true,maxCost:2}),{may:true})),
 "Bambi - Little Prince":c=>{c.onOppPlayChar=[FN((st,pi,self)=>{if(self)retHand(st,self)},0)]},
 "Magica De Spell - Shadow Form":c=>c.onPlay.push(FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self),(y)=>{if(y){retHand(st,y);draw(st,pi,1)}},{ai:srt((a,b)=>(b.exerted-a.exerted)||a.card.cost-b.card.cost),prompt:"choose one of your characters"});},(st,pi,self)=>OWNCH(st,pi).some(z=>z.exerted&&z.card.cost<=3)?2:-3,null,{may:true})),
 "Kuzco - Impulsive Llama":c=>c.onPlay.push(FN((st,pi)=>{oppPicks(st,pi,y=>toBottomX(st,y));draw(st,opp(pi),1)},5)),
 "Madam Mim - Rhino":c=>c.onPlay.push(FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self),(y)=>{if(y&&y.card.cost<=self.card.cost)retHand(st,y);else if(self)banish(st,self)},{ai:srt((a,b)=>a.card.cost-b.card.cost),prompt:"choose one of your characters"});},-1)),
 "Stopped Chaos in Its Tracks":c=>{c.onPlay=[FN((st,pi)=>UPTO(st,pi,OWNCH(st,opp(pi)).filter(y=>strOf(y)<=3&&!K(y,"ward")),2,y=>retHand(st,y),"return up to 2 opposing characters with 3 strength or less",(a,b)=>instVal(b)-instVal(a)),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>strOf(y)<=3).length*4)]},
 "Hades - Looking for a Deal":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(!x)return;if(instVal(x)<=7)toBottomX(st,x);else draw(st,pi,2)},5,T_({opp:true}),{may:true})),
 "Scrooge McDuck - S.H.U.S.H. Agent":c=>c.onChallenged.push(FN((st,pi,self)=>{if(self){self._retAfterChal=true}},2)),
 "Come Out and Fight!":c=>{c.onPlay=[FN((st,pi)=>{PKs(st,pi,st.players[opp(pi)].play.filter(z=>z.under.length),(y)=>{if(y){const P=st.players[y.owner];P.deck.unshift(...y.under);y.under=[]}draw(st,pi,1)},{ai:srt((a,b)=>b.under.length-a.under.length),prompt:"choose an opposing character"});},3)]},
 "Snow White - Merry as the Morning":c=>c.onQuest.push(FN((st,pi,self)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&hasCls(z,"seven dwarfs")&&z.exerted),(y)=>{if(y){retHand(st,y);draw(st,pi,1)}},{ai:srt((a,b)=>a.card.cost-b.card.cost),prompt:"choose one of your characters"});},2,null,{may:true})),
 "Edna Mode - Fashion Designer":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(!x)return;const q=x.owner;retHand(st,x);draw(st,q,1)},(st,pi,x)=>x?(x.owner===pi?1:instVal(x)-3):0,T_({kind:"item",maxCost:2}),{may:true})),
 "Super Relocation Program":c=>{c.onPlay=[FN((st,pi,self,x)=>{const h=hasCls(x,"hero");retHand(st,x);if(h)draw(st,pi,2)},(st,pi,x)=>x?(hasCls(x,"hero")?6:0)-1:-3,T_({own:true}))]},
 "The Family Scattered":c=>{c.onPlay=[FN((st,pi)=>{const P=st.players[opp(pi)];CH(st,pi,OWNCH(st,opp(pi)).filter(y=>!K(y,"ward")),cs=>{if(cs[0])retHand(st,cs[0]);if(cs[1])toBottomX(st,cs[1]);if(cs[2]){toBottomX(st,cs[2]);P.deck.push(P.deck.shift())}},{n:3,prompt:"choose up to 3 opposing characters, in order: 1st to hand, 2nd to bottom of deck, 3rd to top of deck",ai:srt((a,b)=>instVal(a)-instVal(b))})},8)]},
 "The Claw":c=>{c.acts=[{ink:2,req:(st,pi)=>OWNCH(st,pi).length>0,cost:(st,pi)=>sacOwn(st,pi,isChar),eff:[{k:"bounce",t:T_({opp:true})}]}]},
 "Mike Wazowski - Heroic Climber":c=>{const e=FN((st,pi)=>{for(const q of [0,1]){const P=st.players[q],y=P.deck.pop();if(!y)continue;if(isChar(y))P.hand.push(y);else P.deck.unshift(y)}},2);c.onPlay.push(e);c.onQuest.push(e)},
 "Vixey - Expert Fisher":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(x&&OWNCH(st,pi).some(y=>K(y,"evasive")))retHand(st,x)},(st,pi,x)=>x&&OWNCH(st,pi).some(y=>K(y,"evasive"))?instVal(x):0,T_({opp:true,kind:"any",maxCost:2}),{may:true})),
 "Aladdin & Genie - Mischievous Pals":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi],bad=P.hand.filter(y=>discardPri(y)>0);P.hand=P.hand.filter(y=>!bad.includes(y));P.deck.unshift(...bad);draw(st,pi,bad.length+1)},3,null,{may:true})),
 "Narrow Escape":c=>{c.onPlay=[FN((st,pi)=>{const L=st.players[opp(pi)].play.filter(y=>y.card.cost<=2&&!K(y,"ward")).concat(OWNCH(st,pi).filter(y=>y.card.cost<=2));CH(st,pi,L,cs=>cs.forEach(y=>retHand(st,y)),{n:2,min:0,always:true,prompt:"return up to 2 characters with cost 2 or less",ai:(l)=>{const ts=l.filter(y=>y.owner!==pi).sort((a,b)=>instVal(b)-instVal(a))/*nc:ai-order*/;let cs=ts.slice(0,2);if(cs.length<2)cs=cs.concat(l.filter(y=>y.owner===pi&&y.damage).slice(0,2-cs.length));return cs}})},4)]},
 "Bunch of Balloons":c=>{c.acts=[{ink:1,noExert:true,eff:[FN((st,pi,self)=>{if(self)retHand(st,self)},-2)]}]},
 "Omnidroid - Ultimate Iteration":c=>c.onPlay.push({k:"cond",shifted:true,eff:[FN((st,pi,self)=>{if(!self)return;const P=st.players[pi],u=self.under.splice(0);u.forEach(y=>{reset(y);P.hand.push(y)})},(st,pi,self)=>2,null,{may:true})]}),
});

const debuffL=(st,pi,x,n)=>{if(!x)return;x.lStr=(x.lStr||0)-n;x.lSrc=pi};
const AU=(c,...a)=>(c.auras=c.auras||[]).push(...a);
Object.assign(DEFS_EXTRA,{
 "Scrump":c=>{c.acts=[{ink:0,req:(st,pi)=>OWNCH(st,pi).some(y=>!y.exerted&&dry(st,y)),cost:(st,pi)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>!z.exerted&&dry(st,z)),(y)=>{if(y)y.exerted=true},{ai:srt((a,b)=>loreOf(a)-loreOf(b)),prompt:"choose one of your characters"});},eff:[FN((st,pi,self,x)=>debuffL(st,pi,x,2),2,T_({opp:true}))]}]},
 "Mickey Mouse - Night Watch":c=>AU(c,{side:"own",name:["pluto"],kw:"resist 1"}),
 "Minnie Mouse - Storyteller":c=>c.onQuest.push(FN((st,pi,self,x)=>debuffL(st,pi,x,self?loreOf(self):1),2,T_({opp:true}))),
 "Basil - Secret Informer":c=>c.onQuest.push(FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.damage).forEach(y=>y.grants.push({kw:"reckless",until:"ownerTurnEnd",src:pi})),2)),
 "Tick-Tock - Relentless Crocodile":c=>c.statics.push({kw:"evasive",cond:(x,S)=>!!S&&S.active===x.owner&&S.players.some(P=>P.play.some(y=>isChar(y)&&hasCls(y,"pirate")))}),
 "Tiana - Natural Talent":c=>c.onYouPlay.push({type:"song",eff:[FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>debuffL(st,pi,y,1)),3)]}),
 "Captain Hook - The Pirate King":c=>{c.onOppDamaged=[FN((st,pi,self)=>{if(!self||st.active!==pi||self.onceD===st.turnNo)return;self.onceD=st.turnNo;OWNCH(st,pi).filter(y=>hasCls(y,"pirate")).forEach(y=>{y.tStr+=2;y.grants.push({kw:"resist 2",until:"turnEnd",src:pi})})},3)]},
 "Lumiere - Fired Up":c=>{c.onAnyBanished=[FN((st,pi,self)=>{const y=st._ctx;if(self&&y&&isItem(y)&&y.owner===pi)self.tLore+=1},2)]},
 "Sir Pellinore - Seasoned Knight":c=>c.onQuest.push(FN((st,pi,self)=>OWNCH(st,pi).filter(y=>y!==self).forEach(y=>y.grants.push({kw:"support",until:"turnEnd",src:pi})),2)),
 "Heads Held High":c=>{c.onPlay=[FN((st,pi)=>{healStep(st,pi,3,()=>{});OWNCH(st,opp(pi)).forEach(y=>y.tStr-=3)},5)]},
 "Beast - Gracious Prince":c=>AU(c,{side:"own",cls:"princess",stat:"str",n:1},{side:"own",cls:"princess",stat:"wil",n:1}),
 "Goofy - Galumphing Gumshoe":c=>{const e=FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>debuffL(st,pi,y,1)),3);c.onPlay.push(e);c.onQuest.push(e)},
 "So Be It!":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,pi).forEach(y=>y.tStr+=1),3),{k:"banish",may:true,t:T_({opp:true,kind:"item"})}]},
 "Potion of Malice":c=>{c.acts=[{ink:0,sac:true,eff:[FN((st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.damage).forEach(y=>y.grants.push({kw:"reckless",until:"srcStart",src:pi})),(st,pi)=>OWNCH(st,opp(pi)).filter(y=>y.damage).length*2-1)]}]},
 "Judy Hopps - Lead Detective":c=>AU(c,{side:"own",cls:"detective",kw:"alert",test:(x,y,S)=>S.active===x.owner},{side:"own",cls:"detective",kw:"resist 2",test:(x,y,S)=>S.active===x.owner}),
 "Basil - Tenacious Mouse":c=>c.onYouPlay.push({type:"character",test:(st,pi,x)=>hasCls(x,"detective"),eff:[FN((st,pi,self)=>{if(self)self.grants.push({kw:"resist 1",until:"srcStart",src:pi})},2)]}),
 "Scrooge McDuck - Reformed Ebenezer":c=>c.onPlay.push(FN((st,pi,self)=>{const P=st.players[pi];for(const y of OWNCH(st,pi).filter(z=>z!==self)){if(!P.deck.length)break;y.under.push(P.deck.pop());y.underT=st.turnNo;y.grants.push({kw:"ward",until:"srcStart",src:pi})}},3,null,{may:true})),
 "Mrs. Incredible - Super Stretchy":c=>c.onStart.push({k:"modal",opts:[[FN((st,pi,self)=>{if(self)self.grants.push({kw:"evasive",until:"srcStart",src:pi})},2)],[FN((st,pi,self)=>{if(self)self.tLore+=1},4)]],optText:["Gain Evasive until your next turn","+1 lore this turn"]}),
 "Someone Will Lose His Head":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,opp(pi)).forEach(y=>y.tStr-=2),3)]},
 "Gopher - Hunny Cook":c=>AU(c,{side:"own",other:true,cls:"hunny",kw:"resist 1",test:(x,y,S)=>S.active!==x.owner&&y.exerted}),
 "Rescue Rangers Away!":c=>{c.onPlay=[FN((st,pi,self,x)=>debuffL(st,pi,x,OWNCH(st,pi).length),3,T_({opp:true}))]},
 "Prepare to Board!":c=>{c.onPlay=[FN((st,pi,self,x)=>{x.tStr+=hasCls(x,"pirate")?3:2},2,T_({own:true,helpful:true}))]},
 "Tadashi Hamada - Baymax Inventor":c=>c.statics.push({stat:"str",cond:"always",count:(x,P)=>P.play.filter(isItem).length},{stat:"wil",cond:"always",count:(x,P)=>P.play.filter(isItem).length}),
 "Ambush!":c=>{c.onPlay=[FN((st,pi,self,x)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>!z.exerted),(y)=>{if(!y||!x)return;y.exerted=true;damage(st,x,strOf(y))},{ai:srt((a,b)=>strOf(b)-strOf(a)),prompt:"choose one of your characters"});},(st,pi,x)=>{const y=OWNCH(st,pi).filter(z=>!z.exerted).sort((a,b)=>strOf(b)-strOf(a))/*nc:ai-value*/[0];return y&&x&&wilOf(x)-x.damage<=strOf(y)?instVal(x)-2:-3},T_({opp:true}))]},
 "Tramp - Enterprising Dog":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.tStr+=OWNCH(st,pi).filter(y=>y!==self).length},1,T_({own:true,helpful:true}))),
 "He's A Tramp":c=>{c.onPlay=[FN((st,pi,self,x)=>{x.tStr+=OWNCH(st,pi).length},2,T_({own:true,helpful:true}))]},
 "Baloo - Ol' Iron Paws":c=>{c.bigImmune=true},
 "Clarabelle - News Reporter":c=>AU(c,{side:"own",other:true,kw2:"support",stat:"str",n:1}),
 "Pouncing Practice":c=>{c.onPlay=[FN((st,pi,self,x)=>{x.tStr-=2;PKs(st,pi,OWNCH(st,pi),(y)=>{if(y)y.grants.push({kw:"evasive",until:"turnEnd",src:pi})},{ai:srt((a,b)=>loreOf(b)-loreOf(a)),prompt:"choose one of your characters"});},3,T_({opp:true}))]},
 "Flynn Rider - Spectral Scoundrel":c=>c.statics.push({stat:"str",n:2,cond:x=>x.under.length>0},{stat:"lore",n:1,cond:x=>x.under.length>0}),
 "Donald Duck - Ruby Champion":c=>AU(c,{side:"own",other:true,test:(x,y)=>y.card.inks.includes("Ruby")&&strOf0(y)>=7,stat:"lore",n:1}),
 "Scrooge McDuck - Ghostly Ebenezer":c=>c.statics.push({stat:"str",cond:"always",count:x=>x.under.length},{stat:"wil",cond:"always",count:x=>x.under.length}),
 "Elisa Maza - Transformed Gargoyle":c=>{c.strFloor=true},
 "Darkwing's Gas Device":c=>{c.acts=[{ink:1,eff:[FN((st,pi,self,x)=>{x.tStr-=OWNCH(st,pi).some(y=>y.card.name==="Darkwing Duck")?2:1},2,T_({opp:true}))]}]},
 "Monterey Jack - Hypnotized by Cheese":c=>c.statics.push({block:"quest",cond:(x,S)=>!S||!OWNCH(S,x.owner).some(y=>wilOf(y)>=4)}),
 "Dale - Ready for His Shot":c=>{c.wilDamage=true},
 "Ranger Team-Up":c=>{c.onPlay=[FN((st,pi,self,x)=>{x.tStr+=wilOf(x)},3,T_({own:true,helpful:true}))]},
 "Zipper - Big Helper":c=>c.onQuest.push(FN((st,pi,self,x)=>{if(self&&x)x.tStr+=wilOf(self)},2,T_({own:true,helpful:true,other:true}),{may:true})),
});

Object.assign(DEFS_EXTRA,{
 "Max Goof - Rockin' Teen":c=>{c.noMove=true},
 "Scrooge McDuck - Cavern Prospector":c=>c.onYouPlay.push({type:"any",test:(st,pi,x)=>x.card.kw.boost!=null,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.play[P.play.length-1];if(y&&y.card.kw.boost!=null&&P.deck.length){y.under.push(P.deck.pop());y.underT=st.turnNo;st._ctx=y;fire(st,pi,"onBoostAny",y)}},2,null,{may:true})]}),
 "Emily Quackfaster - Level-Headed Librarian":c=>c.onPlay.push(FN((st,pi)=>underBoost(st,pi),2,null,{may:true})),
 "Morgana Macawber - Reformed Spellcaster":c=>c.onPlay.push(FN((st,pi,self,x)=>{for(const q of [0,1])for(const y of OWNCH(st,q))if(y!==x&&y.damage)moveDmg(st,y,x,1)},(st,pi,x)=>x?st.players.flatMap(P=>P.play.filter(isChar)).filter(y=>y!==x&&y.damage).length*2-OWNCH(st,opp(pi)).filter(y=>y!==x&&y.damage).length*2:0,T_({opp:true}),{may:true})),
 "Beast - Snowfield Troublemaker":c=>c.onChallenge.push(FN((st,pi,self)=>{if(self&&self.at!=null)self.noChalDmgT=st.turnNo},3)),
 "Roo - Little Helper":c=>{c.acts=[{ink:0,req:(st,pi,x)=>st.players[pi].play.some(z=>z!==x&&z.card.kw.boost!=null),eff:[FN((st,pi,self)=>{const P=st.players[pi];PKs(st,pi,P.play.filter(z=>z!==self&&z.card.kw.boost!=null),y=>{if(!y||!self)return;P.play=P.play.filter(z=>z!==self);reset(self);P.discard.push(...self.under);self.under=[];y.under.push(self);y.underT=st.turnNo;st._ctx=y;fire(st,pi,"onBoostAny",y)},{prompt:"put Roo under which Boost character?",ai:l=>[l[0]]})},1)]}]},
 "Luisa Madrigal - Confident Climber":c=>{c.acts=[{ink:1,noExert:true,eff:[FN((st,pi,self)=>{if(!self)return;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.damage),(y)=>{if(y&&self.damage+1<wilOf(self))moveDmg(st,y,self,1);if(self.damage>=3){PKs(st,pi,OWNCH(st,opp(pi)).filter(z=>!K(z,"ward")),(t)=>{if(t)moveDmg(st,self,t,self.damage)},{ai:srt((a,b)=>(wilOf(a)-a.damage)-(wilOf(b)-b.damage)),prompt:"choose an opposing character"});}},{ai:srt((a,b)=>b.damage-a.damage),prompt:"choose one of your characters"});},(st,pi,x)=>1)]}]},
 "Luisa Madrigal - No Pressure":c=>c.onQuest.push(FN((st,pi,self)=>{if(!self)return;PKs(st,pi,OWNCH(st,pi).filter(z=>z!==self&&z.damage),(y)=>{if(y){const room=Math.max(0,wilOf(self)-self.damage-1);moveDmg(st,y,self,Math.min(3,room))}},{ai:srt((a,b)=>b.damage-a.damage),prompt:"choose one of your characters"});},2,null,{may:true})),
 "Casa Madrigal - Courtyard":c=>{c.onQuestHere=[FN((st,pi,self)=>{const x=st._ctx;if(noHeal(st))return;if(x)x.damage=Math.max(0,x.damage-2);if(self)self.damage=Math.max(0,self.damage-2)},2,null,{may:true})]},
 "We'll Save Our Village":c=>{c.onPlay=[FN((st,pi)=>st.players[pi].play.filter(y=>isChar(y)||isLoc(y)).forEach(y=>{y.grants=y.grants||[];y.grants.push({kw:"resist 1",until:"srcStart",src:pi})}),3)]},
 "Windstorm":c=>{c.onPlay=[FN((st,pi)=>{const o=st.players[opp(pi)];for(const y of o.play.filter(z=>isChar(z)||isLoc(z)))damage(st,y,1);for(const y of o.play.filter(z=>(isChar(z)||isLoc(z))&&K(z,"evasive")))damage(st,y,2)},(st,pi)=>OWNCH(st,opp(pi)).length*2+3)]},
 "Vine Entrance - Ominous Passageway":c=>{c.onMoveHere=[FN((st,pi,self)=>{const x=st._ctx;if(!self||!x||!hasCls(x,"floodborn")||self.onceF===st.turnNo)return;self.onceF=st.turnNo;dmgBest(st,pi,1)},2,null,{may:true})]},
 "Mickey Mouse - Pirate Captain":c=>c.onQuest.push(FN((st,pi,self,x)=>{x.tStr+=2;x.noChalDmgT=st.turnNo},2,T_({own:true,helpful:true,test:y=>hasCls(y,"pirate")}))),
 "Mulan - Imperial General":c=>c.onChallenge.push(FN((st,pi,self)=>OWNCH(st,pi).filter(y=>y!==self).forEach(y=>y.chReady=st.turnNo),3)),
 "Mother Gothel - Knows What's Best":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(!x||wilOf(x)-x.damage<=2)return;damage(st,x,2);x.tChal=(x.tChal||0)+1;x._rcb=st.turnNo},0,T_({own:true,other:true}),{may:true})),
 "Forest Duel":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,pi).forEach(y=>{y.tChal=(y.tChal||0)+2;y._rcb=st.turnNo}),(st,pi)=>OWNCH(st,pi).length*2)]},
 "Walk the Plank!":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,pi).filter(y=>hasCls(y,"pirate")).forEach(y=>(y.tActs=y.tActs||[]).push({t:st.turnNo,ab:{ink:0,eff:[{k:"banish",t:T_({opp:true,state:"damaged"})}]}})),(st,pi)=>OWNCH(st,opp(pi)).some(y=>y.damage)?6:-2)]},
 "Lilo - Best Explorer Ever":c=>c.onQuest.push(FN((st,pi,self,x)=>{x.tChal=(x.tChal||0)+2;x.chReady=st.turnNo},2,T_({own:true,helpful:true,test:y=>hasCls(y,"alien")}))),
 "The Great Illuminary - Abandoned Laboratory":c=>c.statics.push({here:true,grantAct:{ink:0,eff:[{k:"draw",n:1}]}}),
 "Megara - Secret Keeper":c=>{c.statics.push({stat:"lore",n:1,cond:x=>x.under.length>0});c.onChallenged.push(FN((st,pi,self)=>{if(self&&self.under.length)resolve(st,pi,[{k:"oppDiscard",n:1}],null)},2))},
 "Aladdin - Barreling Through":c=>(c.auras=c.auras||[]).push({side:"own",test:(x,y)=>y.under.length>0&&!!K(x,"reckless"),grantAct:{ink:0,eff:[{k:"gainLore",n:1}]}}),
 "Hero Work":c=>{c.onPlay=[FN((st,pi)=>OWNCH(st,pi).forEach(y=>{y.tStr+=1;if(hasCls(y,"hero"))y.heroWorkT=st.turnNo}),(st,pi)=>OWNCH(st,pi).length*1.5)]},
 "Baymax - Giant Robot":c=>c.onPlay.push({k:"cond",shifted:true,eff:[FN((st,pi,self)=>{if(self&&!noHeal(st))self.damage=0},2)]}),
 "Omnidroid - V.9":c=>c.onPlay.push({k:"cond",shifted:true,eff:[{k:"dmg",n:2,may:true,t:T_({opp:true})}]}),
 "Meilin Lee - Superficially Obedient":c=>{c.onShiftedOn=[FN((st,pi,self,x)=>{if(x)x.grants.push({kw:"evasive",until:"srcStart",src:pi})},2)]},
 "Morph - Little Imitator":c=>{c.morph=true},
 "Sun Yee - Red Panda Spirit":c=>{c.kw.shift=2;c.kw.shiftCls="red panda";c.tempShift=true},
 "Grandma Wu - Fierce Red Panda":c=>{c.kw.shift=4;c.tempShift=true;c.onChallenge.push(FN((st,pi)=>{gain(st,pi,2);loseLore(st,st.players[opp(pi)],2)},8))},
});

Object.assign(DEFS_EXTRA,{
 "Moana - Of Motunui":c=>{c.onQuest=[FN((st,pi,self)=>OWNCH(st,pi).filter(y=>y!==self&&y.exerted&&hasCls(y,"princess")).forEach(y=>rdy(y)),2,null,{may:true})]},
 "Ariel - Adventurous Collector":c=>{c.kw.evasive=true;c.onYouPlay=c.onYouPlay.filter(h=>h.type!=="song");c.onYouPlay.push({type:"song",eff:[FN((st,pi)=>{PKs(st,pi,OWNCH(st,pi).filter(z=>!K(z,"evasive")),(y)=>{if(y)y.grants.push({kw:"evasive",until:"srcStart",src:pi})},{ai:srt((a,b)=>instVal(b)-instVal(a)),prompt:"choose one of your characters"});},2)]})},
 "Kristoff - Mining the Ruins":c=>{c.kw.boost=1;c.onQuest=[FN((st,pi,self)=>{if(self&&self.under.length)inkTop2(st,pi)},3)]},
});
// @@DEFS_INSERT
const DEFS={
 "Prince Phillip - Dragonslayer":c=>c.onBanish.push(FN((st,pi)=>{if(st._challenger!=null&&st._defender!=null){const f=find(st,st._defender);if(f&&f.zone==="play"&&st.players[f.pi]!==st.players[pi]&&(st._chalSrc===pi))banish(st,f.inst)}},3)),
 "Rapunzel - Gifted with Healing":c=>c.onPlay.push(FN((st,pi,self,x)=>{const n=Math.min(3,x.damage);x.damage-=n;draw(st,pi,n)},(st,pi,x,mine)=>mine&&x?Math.min(3,x.damage)*5:-1,T_({own:true,helpful:true}))),
 "Stitch - Rock Star":c=>c.onYouPlay.push({type:"character",maxCost:2,eff:[FN((st,pi)=>{const P=st.players[pi],y=P.play[P.play.length-1];if(y&&isChar(y)&&y.card.cost<=2&&!y.exerted){y.exerted=true;draw(st,pi,1)}},3,null,{may:true})]}),
 "Anna - Heir to Arendelle":c=>c.onPlay.push(FN((st,pi,self,x)=>{if(st.players[pi].play.some(y=>y.card.name==="Elsa"))x.noReady=true},(st,pi,x)=>st.players[pi].play.some(y=>y.card.name==="Elsa")?4:0,T_({opp:true}))),
 "Elsa - Spirit of Winter":c=>c.onPlay.push({k:"multi",n:2,inner:FN((st,pi,self,x)=>{x.exerted=true;x.noReady=true},(st,pi,x,mine)=>x?(mine?-6:3+x.card.cost):3,T_({}))}),
 "Magic Broom - Bucket Brigade":c=>c.onPlay.push(FN((st,pi)=>{const o=st.players[opp(pi)],c2=o.discard.filter(y=>y.card.onBanish.length||y.card.cost>=5).pop()||o.discard[o.discard.length-1];if(c2){o.discard.splice(o.discard.indexOf(c2),1);o.deck.push(c2);shuffle(o.deck,st.r)}},1,null,{may:true})),
 "Ursula - Power Hungry":c=>c.onPlay.push(FN((st,pi)=>{const o=st.players[opp(pi)],n=loseLore(st,o,1);draw(st,pi,n)},9)),
 "Befuddle":c=>c.onPlay.push(parseOne0("return chosen character or item with cost 2 or less to their player's hand")),
 "Kuzco - Temperamental Emperor":c=>c.onBanish.push({k:"banishChallenger",challengedOnly:true,may:true}),
 "Steal from the Rich":c=>c.onPlay.push(FN((st,pi)=>{const P=st.players[pi];(P.hooks=P.hooks||[]).push({on:"quest",eff:[{k:"oppLose",n:1}]})},(st,pi)=>st.players[pi].play.filter(y=>isChar(y)&&!y.exerted).length*5)),
 "Vicious Betrayal":c=>c.onPlay.push(FN((st,pi,self,x)=>{x.tStr+=x.card.cls.includes("Villain")?3:2},2,T_({own:true,helpful:true}))),
 "Stolen Scimitar":c=>c.acts.push({ink:0,eff:[FN((st,pi,self,x)=>{x.tStr+=x.card.name==="Aladdin"?2:1},1,T_({own:true,helpful:true}))]}),
 "Elsa - Ice Surfer":c=>c.onYouPlay.push({type:"character",name:"anna",eff:[FN((st,pi,self)=>{if(self){self.exerted=false;self.noQuest=true}},2)]}),
 "Poisoned Apple":c=>c.acts.push({ink:1,sac:true,noExert:true,eff:[FN((st,pi,self,x)=>{if(x.card.cls.includes("Princess"))banish(st,x);else x.exerted=true},(st,pi,x,mine)=>x?(mine?-5:x.card.cls.includes("Princess")?instVal(x):3):3,T_({opp:true}))]}),
};
function condFn(t){t=t.trim();let m;const P=(x,S)=>S.players[x.owner],OC=(x,S)=>P(x,S).play.filter(isChar),ALL=S=>S.players.flatMap(q=>q.play.filter(isChar)),OPP=(x,S)=>S.players[1-x.owner].play.filter(isChar);
  const W=f=>(x,S)=>!!S&&f(x,S);const nm=s=>s.toLowerCase().split(/ or /).map(z=>z.trim());
  if((m=t.match(/^you have a character named (.+?) in play$/)))return W((x,S)=>OC(x,S).some(y=>y!==x&&nm(m[1]).some(n=>namesOf(y).includes(n))));
  if((m=t.match(/^you have an item named (.+?) in play$/)))return W((x,S)=>P(x,S).play.some(y=>isItem(y)&&y.card.name.toLowerCase()===m[1]));
  if((m=t.match(/^you have (another|an?) ([a-z]+) character in play$/)))return W((x,S)=>OC(x,S).some(y=>(m[1]!=="another"||y!==x)&&hasCls(y,m[2])));
  if((m=t.match(/^you have (\d+) or more (other )?([a-z]+) characters in play$/)))return W((x,S)=>OC(x,S).filter(y=>(!m[2]||y!==x)&&(hasCls(y,m[3])||y.card.inks.some(k=>k.toLowerCase()===m[3]))).length>=+m[1]);
  if((m=t.match(/^you have (another|a) character with ([a-z]+) in play$/)))return W((x,S)=>OC(x,S).some(y=>(m[1]!=="another"||y!==x)&&K(y,m[2])));
  if(t==="this character is exerted")return x=>!!x.exerted;
  if(t==="this character is damaged")return x=>!!x.damage;
  if(t==="this character has no damage")return x=>!x.damage;
  if(/^(there's a card under this character|this character has a card under (him|her|them))$/.test(t))return x=>x.under.length>0;
  if(t==="you have a character or location in play with a card under them")return W((x,S)=>P(x,S).play.some(y=>y.under&&y.under.length));
  if(t==="a damaged character is in play")return W(S0=>true)&&((x,S)=>!!S&&ALL(S).some(y=>y.damage));
  if(t==="another character in play has damage")return (x,S)=>!!S&&ALL(S).some(y=>y!==x&&y.damage);
  if(t==="an opposing damaged character is in play")return (x,S)=>!!S&&OPP(x,S).some(y=>y.damage);
  if((m=t.match(/^there are (\d+) or more characters with damage in play$/)))return (x,S)=>!!S&&ALL(S).filter(y=>y.damage).length>=+m[1];
  if((m=t.match(/^you have (\d+) or more other exerted characters in play$/)))return (x,S)=>!!S&&OC(x,S).filter(y=>y!==x&&y.exerted).length>=+m[1];
  if((m=t.match(/^(\d+) or more characters of yours are exerted$/)))return (x,S)=>!!S&&OC(x,S).filter(y=>y.exerted).length>=+m[1];
  if(t==="you have more cards in your hand than each opponent")return (x,S)=>!!S&&P(x,S).hand.length>S.players[1-x.owner].hand.length;
  if((m=t.match(/^you have (\d+) or more cards in your hand$/)))return (x,S)=>!!S&&P(x,S).hand.length>=+m[1];
  if(t==="you have no cards in your hand")return (x,S)=>!!S&&!P(x,S).hand.length;
  if(t==="an opponent has more lore than you")return (x,S)=>!!S&&S.players[1-x.owner].lore>P(x,S).lore;
  if(t==="a character was banished this turn")return (x,S)=>!!S&&S.banT===S.turnNo;
  if(t==="you have a character in play with more str than each opposing character")return (x,S)=>{if(!S)return false;const mo=Math.max(0,...OPP(x,S).map(strOf0));return OC(x,S).some(y=>strOf0(y)>mo)};
  if((m=t.match(/^you have (\d+) or more other characters in play with (\d+) str or more$/)))return (x,S)=>!!S&&OC(x,S).filter(y=>y!==x&&strOf0(y)>=+m[2]).length>=+m[1];
  if(t==="all cards in your inkwell are exerted")return (x,S)=>!!S&&P(x,S).ink.length>0&&P(x,S).ink.every(y=>y.exerted);
  if(t==="you have more cards in your inkwell than each opposing player")return (x,S)=>!!S&&P(x,S).ink.length>S.players[1-x.owner].ink.length;
  return null}
function turnWrap(c,r,rest,mine){const t=normCard({...r,id:"tw",text:rest.charAt(0).toUpperCase()+rest.slice(1)});if(t.unsupported.length)return false;let any=false;
  const gate=effs=>[{k:"fn",v:(st,pi)=>((st.active===pi)===mine?effVal(st,pi,effs,null):0),f:(st,pi,self,x)=>{if((st.active===pi)===mine)trig(st,pi,effs,self)}}];
  for(const k of Object.keys(t)){if(!/^on[A-Z]/.test(k)||!Array.isArray(t[k])||!t[k].length||k==="onPlay")continue;any=true;c[k]=c[k]||[];
    for(const e of t[k])c[k].push(e&&e.eff&&!e.k?{...e,eff:gate(e.eff)}:gate([e])[0])}
  return any}
function condStatic(c,line){const m=line.match(/^(during your turn, )?(?:while|if) (.+?), (?:this character|he|she|they|this location) (gets|gains) (.+)$/i);if(!m)return false;let f=condFn(m[2].toLowerCase());if(!f)return false;
  if(m[1]){const g=f;f=(x,S)=>!!S&&S.active===x.owner&&g(x,S)}
  let rest=m[4].replace(/^gains /i,"");const out=[];const re=/\+(\d+) (STR|WIL|LORE)/gi;let q;while((q=re.exec(rest)))out.push({cond:f,stat:q[2].toLowerCase(),n:+q[1]});
  const kwm=(m[3].toLowerCase()==="gains"?rest:(rest.match(/and gains (.+)$/i)||[])[1]);
  if(kwm){for(const k of kwm.split(/,? and |, /)){const kk=k.trim().toLowerCase().replace(/\+/,"");if(!/^(evasive|ward|support|rush|bodyguard|alert|reckless|singer \d+|resist \d+|challenger \d+)$/.test(kk))return false;out.push({cond:f,kw:kk})}}
  if(!out.length)return false;c.statics.push(...out);return true}
function normCard(r){
  const type=(r.type||[]).map(x=>x.toLowerCase());
  const c={id:r.id,name:r.name,version:r.version||"",full:r.name+(r.version?" - "+r.version:""),ink:r.ink||null,inks:r.inks||(r.ink?[r.ink]:[]),
    cost:r.cost||0,inkable:!!r.inkwell,type:type.includes("character")?"character":type.includes("location")?"location":type.includes("item")?"item":type.includes("song")?"song":"action",
    str:r.strength||0,wil:r.willpower||0,lore:r.lore||0,move:r.move_cost!=null?r.move_cost:null,text:r.text||"",img:r.img||null,set:r.set,num:r.collector_number,rarity:r.rarity,
    cls:r.classifications||[],kw:{},onPlay:[],onQuest:[],onBanish:[],onStart:[],onEnd:[],onBanishOther:[],onYouPlay:[],onInk:[],onSing:[],onAllyBanished:[],onAllyChallenge:[],onAllyQuest:[],onUnder:[],onChallenge:[],onChallenged:[],onActionPlayed:[],statics:[],acts:[],unsupported:[]};
  c.imgLarge=c.img?c.img.replace("/small/","/normal/"):null;
  const lines=[];for(const ln of String(r.text||"").split("\n").map(x=>x.trim()).filter(Boolean)){if(/^[•·*-]\s/.test(ln)&&lines.length)lines[lines.length-1]+=" "+ln;else lines.push(ln)}
  const effLines=[];let m0;
  for(const raw of lines){
    let line=clean(raw);if(!line)continue;
    line=line.replace(/\s+\.$/,"").replace(/\.$/,"");const parts=line.split(/,\s*/);let allKw=true;
    for(const p of parts){let m,pl=p.toLowerCase();
      if(KW_SIMPLE.includes(pl)){c.kw[pl]=true}
      else if((m=pl.match(/^(challenger|resist) \+(\d+)$/)))c.kw[m[1]]=+m[2];
      else if((m=pl.match(/^singer (\d+)$/)))c.kw.singer=+m[1];
      else if((m=pl.match(/^boost (\d+)( ink)?$/)))c.kw.boost=+m[1];
      else if((m=pl.match(/^universal shift (\d+)( ink)?$/))){c.kw.shift=+m[1];c.kw.shiftAny=true}
      else if((m=pl.match(/^([a-z]+) shift (\d+)( ink)?$/))&&m[1]!=="temporary"){c.kw.shift=+m[2];c.kw.shiftCls=m[1]}
      else if((m=pl.match(/^shift (\d+)( ink)?$/)))c.kw.shift=+m[1];
      else {allKw=false;break}
    }
    if(allKw)continue;
    if((m0=line.match(/^Sing Together (\d+)$/i))){c.singTogether=+m0[1];continue}
    if(/ shift \d+/i.test(" "+line)&&/^[a-z ]*shift \d+/i.test(line)){c.unsupported.push(raw);continue}
    effLines.push([raw,line]);
  }
  for(const [raw,line0] of effLines){
    if(c.type==="action"||c.type==="song"){const e=parseEffects(line0);if(e)c.onPlay.push(...e);else c.unsupported.push(raw);continue}
    const line=stripName(line0).replace(/\.$/,"");let m,e;
    if((m=line.match(/^When you play this (character|item|location), (.+)$/i))&&(e=parseEffects(m[2])))c.onPlay.push(...e);
    else if((m=line.match(/^Whenever this character quests, (.+)$/i))&&(e=parseEffects(m[1])))c.onQuest.push(...e);
    else if((m=line.match(/^When you play this character and whenever (?:he|she|it|they) quests?, (.+)$/i))&&(e=parseEffects(m[1]))){c.onPlay.push(...e);c.onQuest.push(...e)}
    else if((m=line.match(/^(?:During your turn, )?whenever this character banishes another character in a challenge, (.+)$/i))&&(e=parseEffects(m[1])))c.onBanishOther.push(...e);
    else if((m=line.match(/^Whenever you play (a|an|another) (song|item|character|action|Floodborn character|location)s?, (.+)$/i))&&(e=parseEffects(m[3])))c.onYouPlay.push({type:m[2].toLowerCase(),eff:e});
    else if((m=line.match(/^During your turn, whenever a card is put into your inkwell, (.+)$/i))&&(e=parseEffects(m[1])))c.onInk.push(...e);
    else if((m=line.match(/^(\{E\}, )?Banish this item\s*[—–-]\s*(.+)$/i))&&(e=parseEffects(m[2])))c.acts.push({ink:0,eff:e,sac:true,noExert:!m[1]});
    else if((m=line.match(/^\{E\}, Banish this character\s*[—–-]\s*(.+)$/i))&&(e=parseEffects(m[1])))c.acts.push({ink:0,eff:e,sac:true});
    else if((m=line.match(/^While (this character is exerted|this character is at a location|there's a card under this character|this character has no damage|this character has damage), (?:this character|he|she|it|they) (gets? \+(\d+) (STR|LORE|WIL)|gains? (Evasive|Ward|Rush|Bodyguard|Resist \+\d+|Challenger \+\d+|Alert))$/i))){
      const cond={"this character is exerted":"exerted","this character is at a location":"atLoc","there's a card under this character":"under","this character has no damage":"undamaged","this character has damage":"damaged"}[m[1].toLowerCase()];
      c.statics.push(m[3]?{cond,stat:m[4].toLowerCase(),n:+m[3]}:{cond,kw:m[5].toLowerCase()})}
    else if(condStatic(c,line)){}
    else if((m0=line.match(/^During (your|an opponent['’]s|the opponent['’]s) turn, ((?:when|whenever) .+)$/i))&&turnWrap(c,r,m0[2],/^your$/i.test(m0[1]))){}
    else if((m=line.match(/^During your turn, this character gets \+(\d+) (STR|LORE)$/i)))c.statics.push({cond:"yourTurn",stat:m[2].toLowerCase(),n:+m[1]});
    else if((m=line.match(/^If you have a character named (.+?) in play, you pay (\d+) INK less to play this character$/i)))c.costRed={name:m[1],n:+m[2]};
    else if((m=line.match(/^Sing Together (\d+)$/i)))c.singTogether=+m[1];
    else if((m=line.match(/^If this is your first turn and you're not the first player, you pay (\d+) INK less to play this character$/i)))c.costRed={secondFirst:true,n:+m[1]};
    else if((m=line.match(/^If you have a character named (.+?) in play, you pay (\d+) INK less to play this item$/i)))c.costRed={name:m[1],n:+m[2]};
    else if((m=line.match(/^If you have (\d+) or more cards in your hand, this character can't ready$/i)))c.statics.push({cond:"always",noReadyHand:+m[1]});
    else if((m=line.match(/^While you have (?:a character named (.+?)|an? (\w+) character|(\d+) or more cards in your inkwell) in play, this character gets \+(\d+) (STR|LORE|WIL)$/i)))c.statics.push({cond:m[1]?"named:"+m[1].toLowerCase():m[2]?"cls:"+m[2]:"ink:"+m[3],stat:m[5].toLowerCase(),n:+m[4]});
    else if((m=line.match(/^While you have (\d+) or more cards in your inkwell, this character gets \+(\d+) (STR|LORE|WIL)$/i)))c.statics.push({cond:"ink:"+m[1],stat:m[3].toLowerCase(),n:+m[2]});
    else if((m=line.match(/^While being challenged, this character gets \+(\d+) (STR)$/i)))c.statics.push({cond:"defending",stat:"str",n:+m[1]});
    else if((m=line.match(/^While this character has (\d+) STR or more, (?:he|she|it|they) gets? \+(\d+) (LORE|WIL)$/i)))c.statics.push({cond:"str:"+m[1],stat:m[3].toLowerCase(),n:+m[2]});
    else if((m=line.match(/^This character gets \+(\d+) STR for each card in your hand$/i)))c.statics.push({cond:"always",stat:"str",perHand:+m[1]});
    else if(/^This character may enter play exerted$/i.test(line)){}
    else if((m=line.match(/^(?:Characters|Your characters)( named (.+?))? get \+(\d+) (STR|WIL|LORE) while here$/i)))c.statics.push({here:true,name:m[2]?m[2].toLowerCase():null,stat:m[4].toLowerCase(),n:+m[3]});
    else if((m=line.match(/^(?:Characters|Your characters) gain (Evasive|Ward|Rush|Bodyguard|Resist \+\d+|Challenger \+\d+|Alert) while here$/i)))c.statics.push({here:true,kw:m[1].toLowerCase()});
    else if((m=line.match(/^During (?:an opponent's turn|opponents' turns|each opponent's turn), this character (gets \+(\d+) (STR|WIL|LORE)|gains (Evasive|Ward|Resist \+\d+|Bodyguard|Challenger \+\d+))$/i)))c.statics.push(m[2]?{cond:"oppTurn",stat:m[3].toLowerCase(),n:+m[2]}:{cond:"oppTurn",kw:m[4].toLowerCase()});
    else if((m=line.match(/^While you have (no cards in your hand|another character in play|an item in play), this character (gets \+(\d+) (STR|WIL|LORE)|gains (Evasive|Ward|Resist \+\d+|Bodyguard|Challenger \+\d+|Rush))$/i))){const cond={"no cards in your hand":"emptyHand","another character in play":"another","an item in play":"item"}[m[1].toLowerCase()];c.statics.push(m[3]?{cond,stat:m[4].toLowerCase(),n:+m[3]}:{cond,kw:m[5].toLowerCase()})}
    else if((m=line.match(/^While you have a character named (.+?) in play, this character gains (Evasive|Ward|Resist \+\d+|Bodyguard|Challenger \+\d+|Rush|Alert)$/i)))c.statics.push({cond:"named:"+m[1].toLowerCase(),kw:m[2].toLowerCase()});
    else if((m=line.match(/^This character gets \+(\d+) STR for each other character you have in play$/i)))c.statics.push({cond:"always",stat:"str",perOther:+m[1]});
    else if((m=line.match(/^This character also counts as being named (.+)$/i)))c.alias=(c.alias||[]).concat(m[1].toLowerCase());
    else if((m=line.match(/^For each character you have in play, you pay (\d+) INK less to play this character$/i)))c.costRed={perChar:+m[1]};
    else if(/^This character can't be challenged$/i.test(line))c.statics.push({cond:"always",block:"challenged"});
    else if(/^This character can challenge ready characters$/i.test(line))c.statics.push({cond:"always",flag:"challengeReady"});
    else if(/^This character can't \{E\} to sing songs$/i.test(line))c.statics.push({cond:"always",block:"sing"});
    else if((m=line.match(/^When you play this character and when (?:he|she|it|they) leaves? play, (.+)$/i))&&(e=parseEffects(m[1]))){c.onPlay.push(...e);c.onBanish.push(...e)}
    else if((m=line.match(/^Whenever this character sings a song, (.+)$/i))&&(e=parseEffects(m[1])))c.onSing.push(...e);
    else if((m=line.match(/^Whenever this character quests while at a location, (.+)$/i))&&(e=parseEffects(m[1])))c.onQuest.push({k:"cond",atLoc:true,eff:e});
    else if((m=line.match(/^When(?:ever)? this character is challenged and banished, (.+)$/i))&&(e=parseEffects(m[1].replace(/^banish the challenging character$/i,"__banishChallenger"))))c.onBanish.push(...e.map(x=>({...x,challengedOnly:true})));
    else if((m=line.match(/^(During your turn, )?when(?:ever)? one of your (other )?(?:([A-Z][a-z]+) )?characters(?: with (Bodyguard|Evasive|Support|Rush|Ward))? is banished( in a challenge)?, (.+)$/i))&&(e=parseEffects(m[6])))c.onAllyBanished.push({yourTurn:!!m[1],other:!!m[2],cls:m[3]?m[3].toLowerCase():null,kw:m[4]?m[4].toLowerCase():null,inChal:!!m[5],eff:e});
    else if((m=line.match(/^(During your turn, )?whenever an opposing (?:([A-Z][a-z]+) )?(character|item|character or location) is banished( in a challenge)?, (.+)$/i))&&(e=parseEffects(m[5])))(c.onOppBanished=c.onOppBanished||[]).push({yourTurn:!!m[1],cls:m[2]?m[2].toLowerCase():null,kinds:m[3].split(" or "),inChal:!!m[4],eff:e});
    else if((m=line.match(/^(During your turn, |While this character is exerted, |During opponents' turns, |During an opponent's turn, )?Your (other )?(?:([A-Z][a-z]+(?: [A-Z][a-z]+)?) )?(characters|items|locations)(?: named (.+?))?( with Bodyguard)? (?:get \+(\d+) (STR|WIL|LORE)|gain (Evasive|Ward|Rush|Bodyguard|Alert|Support|Resist \+\d+|Challenger \+\d+))$/i))&&!/^(this|other)$/i.test(m[3]||"")){
      const cond={"during your turn, ":"yourTurn","while this character is exerted, ":"exerted","during opponents' turns, ":"oppTurn","during an opponent's turn, ":"oppTurn"}[(m[1]||"").toLowerCase()];(c.auras=c.auras||[]).push({side:"own",other:!!m[2],cls:m[3]?m[3].toLowerCase():null,kinds:[m[4].toLowerCase().replace(/s$/,"")],name:m[5]?m[5].toLowerCase().split(/ or /):null,kw2:m[6]?"bodyguard":null,cond,stat:m[8]?m[8].toLowerCase():null,n:m[7]?+m[7]:0,kw:m[9]?m[9].toLowerCase():null})}
    else if((m=line.match(/^(While this character is exerted, |During your turn, )?opposing characters( with Evasive)? (?:get -(\d+) (STR|LORE)|can't (quest|challenge)|gain (Reckless))$/i))){const cond={"while this character is exerted, ":"exerted","during your turn, ":"yourTurn"}[(m[1]||"").toLowerCase()];(c.auras=c.auras||[]).push({side:"opp",cond,kw2:m[2]?"evasive":null,stat:m[4]?m[4].toLowerCase():null,n:m[3]?-m[3]:0,block:m[5]?m[5].toLowerCase():null,kw:m[6]?"reckless":null})}
    else if((m=line.match(/^(?:During your turn, )?each opposing character with cost (\d+) or less gets -(\d+) (STR|LORE)$/i)))(c.auras=c.auras||[]).push({side:"opp",maxCost:+m[1],stat:m[3].toLowerCase(),n:-m[2],cond:/^during/i.test(line)?"yourTurn":null});
    else if((m=line.match(/^Characters with cost (\d+) or less can't challenge (this character|your characters)$/i)))(c.auras=c.auras||[]).push(m[2].toLowerCase()==="this character"?{side:"own",test:(x,y)=>x===y,protect:+m[1]}:{side:"own",protect:+m[1]});
    else if((m=line.match(/^You pay (\d+) INK less to play ([A-Z][a-z]+) (characters|items)$/i)))(c.auras=c.auras||[]).push({side:"none",costCls:m[2].toLowerCase(),costN:+m[1]});
    else if((m=line.match(/^This character gets \+(\d+) (STR|LORE|WIL) for each (other )?(?:([A-Z][a-z]+) )?(character|item|location|card in your hand|card under (?:him|her|it|this character)) you have in play$/i))||(m=line.match(/^This character gets \+(\d+) (STR|LORE|WIL) for each (other )?(?:([A-Z][a-z]+) )?(card under (?:him|her|it|this character)|damage on (?:him|her|it))$/i))){
      const oth=!!m[3],cl=m[4]?m[4].toLowerCase():null,kind=m[5].toLowerCase();c.statics.push({stat:m[2].toLowerCase(),per:+m[1],cond:"always",count:(x,P)=>kind.startsWith("card under")?x.under.length:kind.startsWith("damage")?x.damage:kind.startsWith("card in")?P.hand.length:P.play.filter(y=>y.card.type===kind&&(!oth||y!==x)&&(!cl||y.card.cls.some(k=>k.toLowerCase()===cl))).length})}
    else if((m=line.match(/^(During your turn, )?you may put an additional card from your hand into your inkwell facedown(?: during your turn)?$/i))){c.extraInk=true}
    else if((m=line.match(/^Whenever one of your (?:other )?characters challenges another character, (.+)$/i))&&(e=parseEffects(m[1])))c.onAllyChallenge.push(...e);
    else if((m=line.match(/^Whenever one of your (?:other )?(?:([A-Z][a-z]+) )?characters quests, (.+)$/i))&&(e=parseEffects(m[2])))c.onAllyQuest.push({cls:m[1]?m[1].toLowerCase():null,eff:e});
    else if((m=line.match(/^Whenever you play a character named (.+?), (.+)$/i))&&(e=parseEffects(m[2])))c.onYouPlay.push({type:"character",name:m[1].toLowerCase(),eff:e});
    else if((m=line.match(/^Whenever you play an action that isn't a song, (.+)$/i))&&(e=parseEffects(m[1])))c.onYouPlay.push({type:"actionOnly",eff:e});
    else if((m=line.match(/^Whenever you play a character with (Bodyguard|Evasive|Rush|Ward|Support|Reckless), (.+)$/i))&&(e=parseEffects(m[2])))c.onYouPlay.push({type:"character",kw:m[1].toLowerCase(),eff:e});
    else if((m=line.match(/^Once (?:during your turn|per turn), whenever (.+?), (.+)$/i))&&(e=parseEffects(m[2]))&&onceTrig(c,m[1],e)){}
    else if((m=line.match(/^Whenever you put a card under (this character|one of your characters or locations), (.+)$/i))&&(e=parseEffects(m[2])))c.onUnder.push(...e);
    else if((m=line.match(/^At the start of your turn, (.+)$/i))&&(e=parseEffects(m[1])))c.onStart.push(...e);
    else if((m=line.match(/^At the end of your turn, (.+)$/i))&&(e=parseEffects(m[1])))c.onEnd.push(...e);
    else if((m=line.match(/^Whenever this character challenges another character, (.+)$/i))&&(e=parseEffects(m[1])))c.onChallenge.push(...e);
    else if((m=line.match(/^Whenever this character is challenged, (.+)$/i))&&(e=parseEffects(m[1])))c.onChallenged.push(...e);
    else if((m=line.match(/^When you play this character and at the start of your turn, (.+)$/i))&&(e=parseEffects(m[1]))){c.onPlay.push(...e);c.onStart.push(...e)}
    else if((m=line.match(/^When this (?:character|item|location) leaves play, (.+)$/i))&&(e=parseEffects(m[1])))c.onLeave=(c.onLeave||[]).concat(e);
    else if((m=line.match(/^When this (?:item|location) is banished, (.+)$/i))&&(e=parseEffects(m[1])))c.onBanish.push(...e);
    else if((m=line.match(/^(?:(\{E\}),?\s*)?(?:(\d+ )?(INK|\{I\}))?\s*,?\s*(?:(Banish this item),?\s*)?(Choose and discard (?:a|an (\w+)) card)?\s*[—–-]\s*(.+)$/))&&(m[1]||m[3]||m[4]||m[5])&&(e=parseEffects(m[7]))){const ty=m[6]||null;
      c.acts.push({ink:m[3]?(m[2]?+m[2]:1):0,noExert:!m[1],sac:!!m[4],eff:e,req:m[5]?((st,pi)=>st.players[pi].hand.some(y=>!ty||y.card.type===ty)):undefined,cost:m[5]?((st,pi)=>{const P=st.players[pi];PKs(st,pi,P.hand.filter(y=>!ty||y.card.type===ty),(h)=>{if(h){P.hand.splice(P.hand.indexOf(h),1);P.discard.push(h);fire(st,pi,"onSelfDiscard",h)}},{ai:srt((a,b)=>discardPri(b)-discardPri(a)),prompt:"choose a card from your hand"});}):undefined})}
    else if((m=line.match(/^Whenever you play an action, this character gets \+(\d+) STR this turn$/i)))c.onActionPlayed.push({k:"selfStr",n:+m[1]});
    else if((m=line.match(/^While this character has (no )?damage, (?:he|she|it|they|this character) gets? \+(\d+) (STR|LORE|WIL)$/i)))c.statics.push({cond:m[1]?"undamaged":"damaged",stat:m[3].toLowerCase(),n:+m[2]});
    else if((m=line.match(/^During your turn, this character gains (Evasive|Rush|Ward|Resist \+\d+|Challenger \+\d+)$/i)))c.statics.push({cond:"yourTurn",kw:m[1].toLowerCase()});
    else if((m=line.match(/^This character can't (quest|challenge)$/i)))c.statics.push({cond:"always",block:m[1].toLowerCase()});
    else if(/^This (character|item) enters play exerted$/i.test(line))c.entersExerted=true;
    else if((m=line.match(/^This character enters play with (\d+) damage$/i)))c.enterDamage=+m[1];
    else if((m=line.match(/^When this character is banished( in a challenge)?, (.+)$/i))&&(e=parseEffects(m[2])))c.onBanish.push(...e);
    else if((m=line.match(/^\{E\}(?:,\s*(\d+) INK)?\s*[—–-]\s*(.+)$/))&&(e=parseEffects(m[2])))c.acts.push({ink:m[1]?+m[1]:0,eff:e});
    else if((m=line.match(/^(\d+) INK\s*[—–-]\s*(.+)$/))&&c.type==="item"&&(e=parseEffects(m[2])))c.acts.push({ink:+m[1],eff:e,noExert:true});
    else c.unsupported.push(raw);
  }
  const DF=DEFS[c.full]||DEFS_EXTRA[c.full];if(DF){DF(c,DH);c.unsupported=[];c.custom=true}
  if(c.onPlay.filter(e=>e.t).length>1){c.unsupported.push("multi-target");c.onPlay=c.onPlay.filter(e=>!e.t);}
  c.supported=c.unsupported.length===0;
  const simulated=(c.custom?1:0)+(c.auras||[]).length+(c.extraInk?1:0)+(c.onOppBanished||[]).length+(c.onLeave?1:0)+c.onSing.length+c.onAllyBanished.length+c.onAllyChallenge.length+c.onAllyQuest.length+c.onUnder.length+(c.alias?1:0)+(c.kw.shiftAny||c.kw.shiftCls?1:0)+(c.kw.boost!=null?1:0)+(c.costRed?1:0)+(c.singTogether?1:0)+c.onBanishOther.length+c.onYouPlay.length+c.onInk.length+c.onPlay.length+c.onQuest.length+c.onBanish.length+c.onStart.length+c.onEnd.length+c.onChallenge.length+c.onChallenged.length+c.onActionPlayed.length+c.statics.length+c.acts.length+(c.entersExerted?1:0)+(c.enterDamage?1:0);
  c.status=!c.text?"plain":c.supported?(simulated?"full":"keywords"):(simulated||Object.keys(c.kw).length?"partial":"vanilla");
  return c;
}

/* ---------- rng / helpers ---------- */
function rng(seed){let a=seed>>>0||1;const f=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};f.state=()=>a>>>0;f.set=s=>{a=s>>>0};return f}
function shuffle(arr,r){for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

/* ---------- game state ---------- */
function newGame(o){
  const st={human:o.human||[true,false],turnNo:0,active:o.first||0,first:o.first||0,phase:"mulligan",winner:null,log:[],uid:1,seed:o.seed||Date.now()%1e9,mull:[false,false],players:[]};
  st.r=rng(st.seed);
  for(let i=0;i<2;i++){
    const p={name:(o.names||["You","AI"])[i],deck:[],hand:[],ink:[],play:[],discard:[],lore:0,inked:false};
    p.deck=shuffle(o.decks[i].map(c=>mk(st,c,i)),st.r);
    for(let k=0;k<7&&p.deck.length;k++)p.hand.push(p.deck.pop());
    st.players.push(p);
  }
  CUR=st;return st;
}
function mk(st,card,owner){return{uid:st.uid++,card,owner,damage:0,exerted:false,playedOn:-1,tStr:0,lStr:0,tLore:0,tChal:0,noQuest:false,noReady:false,at:null,under:[],grants:[]}}
function reset(x){x.grants=[];x.noQuestNext=x.noChalNext=x.noQuestNow=x.noChalNow=false;x.damage=0;x.exerted=false;x.tStr=0;x.lStr=0;x.tLore=0;x.tChal=0;x.noQuest=false;x.noReady=false;x.at=null}
const YOU={inks:"ink",plays:"play",shifts:"shift",mulligans:"mulligan",keeps:"keep",ends:"end",reaches:"reach"};
const log=(st,s)=>{s=s.replace(/^You (\w+)/,(m,v)=>"You "+(YOU[v]||v)).replace(/^You keep their hand/,"You keep your hand").replace(/You end their turn/,"You end your turn");st.log.push(s);if(st.log.length>300)st.log.shift()};
const opp=i=>1-i;
const ev=(st,o)=>{(st.events=st.events||[]).push(o)};
function find(st,uid){for(let i=0;i<2;i++){const p=st.players[i];for(const z of["hand","play","deck","discard"]){const x=p[z].find(c=>c.uid===uid);if(x)return{inst:x,pi:i,zone:z}}const k=p.ink.find(c=>c.uid===uid);if(k)return{inst:k,pi:i,zone:"ink"}}return null}
const inkAvail=p=>p.ink.filter(c=>!c.exerted).length;
function costOf(st,pi,c){let n=c.cost;{const P=st.players[pi];if(c.type==="location"&&P.locDisc&&P.locDisc.t===st.turnNo)n-=P.locDisc.n}if((c.type==="action"||c.type==="song"||c.type==="item")&&st.players.some(P=>P.play.some(y=>y.card.taxAI)))n+=2;const P=st.players[pi];for(const d of (P.disc||[]))if(!d.shift&&discMatch(d,c))n-=d.n;
  for(const y of P.play)for(const a of (y.card.auras||[]))if(a.costCls&&(!a.cond||condOk(y,a.cond))&&(a.costCls==="any"||c.cls.some(k=>k.toLowerCase()===a.costCls))&&(!a.costType||a.costType===c.type)&&(!a.costName||c.name===a.costName))n-=a.costN;
  if(c.costFn)n-=c.costFn(st,pi);
  if(c.costRed&&c.costRed.perChar)n-=c.costRed.perChar*P.play.filter(x=>x.card.type==="character").length;else if(c.costRed&&c.costRed.secondFirst){if(pi!==st.first&&st.turnNo===2)n-=c.costRed.n}else if(c.costRed&&st.players[pi].play.some(x=>x.card.type==="character"&&x.card.name.toLowerCase()===c.costRed.name.toLowerCase()))n-=c.costRed.n;return Math.max(0,n)}
function discMatch(d,c){return d.test?d.test(c):(d.type===c.type||d.type==="action"&&c.type==="song")}
function shiftCost(st,pi,c,b){const P=st.players[pi];let n=c.kw.shift;for(const d of (P.disc||[]))if(d.shift&&discMatch(d,c))n-=d.n;for(const y of P.play)for(const a of (y.card.auras||[]))if(a.shiftDisc)n-=a.shiftDisc;if(b&&b.card.shiftOntoDisc)n-=b.card.shiftOntoDisc;return Math.max(0,n)}
function payInk(p,n){for(const c of p.ink){if(n<=0)break;if(!c.exerted){c.exerted=true;n--}}}
const isChar=x=>x.card.type==="character",isLoc=x=>x.card.type==="location",isItem=x=>x.card.type==="item";
const dry=(st,x)=>x.playedOn<st.turnNo;
let CUR=null; // current state, for "during your turn" statics
function condOk(x,c){if(typeof c==="function")return c(x,CUR);switch(c){case"vsDamaged":return!!(x._vs&&x._vs.damage);case"damaged":return!!x.damage;case"undamaged":return!x.damage;case"exerted":return x.exerted;case"atLoc":return x.at!=null;case"under":return x.under.length>0;case"yourTurn":return!!(CUR&&CUR.active===x.owner);case"oppTurn":return!!(CUR&&CUR.active!==x.owner);
  case"emptyHand":return!!(CUR&&!CUR.players[x.owner].hand.length);case"another":return!!(CUR&&CUR.players[x.owner].play.some(y=>y!==x&&y.card.type==="character"));case"item":return!!(CUR&&CUR.players[x.owner].play.some(y=>y.card.type==="item"));case"defending":return!!x.defending;default:
  if(!CUR)return true;const P=CUR.players[x.owner];
  if(c.startsWith("named:"))return P.play.some(y=>y!==x&&y.card.type==="character"&&y.card.name.toLowerCase()===c.slice(6));
  if(c.startsWith("cls:"))return P.play.some(y=>y!==x&&y.card.cls.some(k=>k.toLowerCase()===c.slice(4).toLowerCase()));
  if(c.startsWith("ink:"))return P.ink.length>=+c.slice(4);
  if(c.startsWith("str:"))return x.card.str+x.tStr>=+c.slice(4);
  return true}}
function auras(x){if(!CUR)return[];const r=[];for(const P of CUR.players)for(const y of P.play)for(const a of (y.card.auras||[])){
    if(a.side==="none")continue;if(a.side!=="all"&&(a.side==="own"?y.owner!==x.owner:y.owner===x.owner))continue;if(a.other&&y===x)continue;if(a.self===false&&y===x)continue;if(a.kinds&&!a.kinds.includes(x.card.type))continue;else if(!a.kinds&&x.card.type!=="character")continue;
    if(a.cls&&!x.card.cls.some(k=>k.toLowerCase()===a.cls))continue;if(a.name&&!a.name.some(n=>namesOf(x).includes(n)))continue;if(a.maxCost!=null&&x.card.cost>a.maxCost)continue;
    if(a.damaged&&!x.damage)continue;if(a.kw2&&!x.card.kw[a.kw2])continue;if(a.cond&&!condOk(y,a.cond))continue;if(a.test&&!a.test(x,y,CUR))continue;r.push({...a,src:y})}return r}
function countOf(x,what){if(!CUR)return 0;const P=CUR.players[x.owner];if(typeof what==="function")return what(x,P,CUR);return 0}
function actsOf(x){const g=auras(x).filter(a=>a.grantAct).map(a=>a.grantAct);if(CUR&&x.tActs)for(const q of x.tActs)if(q.t===CUR.turnNo)g.push(q.ab);if(CUR&&isChar(x)){const P=CUR.players[x.owner];if(P.tempAct&&P.tempAct.t===CUR.turnNo)g.push(P.tempAct.ab);for(const s of hereStatics(x))if(s.grantAct)g.push(s.grantAct)}return g.length?x.card.acts.concat(g):x.card.acts}
function hereStatics(x){if(x.at==null||!CUR)return[];const l=CUR.players[x.owner].play.find(y=>y.uid===x.at);return l?l.card.statics.filter(s=>s.here&&(!s.name||namesOf(x).includes(s.name))&&(!s.test||s.test(x,CUR,l))):[]}
function statOn(x,f){let n=0;for(const s of x.card.statics){if(s.stat!==f||s.here||!condOk(x,s.cond))continue;n+=typeof s.count==="function"?(s.per||1)*(CUR?s.count(x,CUR.players[x.owner],CUR):0):s.perHand?s.perHand*(CUR?CUR.players[x.owner].hand.length:0):s.perOther?s.perOther*(CUR?CUR.players[x.owner].play.filter(y=>y!==x&&y.card.type==="character").length:0):s.n}
  for(const s of hereStatics(x))if(s.stat===f)n+=s.n;for(const s of x.card.statics)if(s.stat===f&&s.per&&typeof s.count!=="function"&&s.count!=null&&condOk(x,s.cond||"always"))n+=s.per*countOf(x,s.count);
  for(const a of auras(x))if(a.stat===f)n+=a.perLoc?-CUR.players[a.src.owner].play.filter(isLoc).length:a.n;return n}
function K(x,k){if(k==="evasive"&&x.card.noEvasive)return undefined;if(k==="evasive"&&x.featherBy!=null&&CUR&&find(CUR,x.featherBy)?.zone==="play")return true;if(CUR&&auras(x).some(a=>a.kwOff===k))return k==="challenger"||k==="resist"?0:undefined;if(k==="reckless"&&CUR&&x.noReckT===CUR.turnNo)return undefined;
  if(CUR)for(const s of x.card.statics)if(s.kwPer===k){const n=countOf(x,s.count)+(x.card.kw[k]||0);if(n)return n}
  const v=x.card.kw[k];if(v!=null)return v;
  for(const g of (x.grants||[])){const [nm,val]=g.kw.split(" ");if(nm===k)return val?parseInt(val):true}
  for(const a of auras(x)){if(!a.kw)continue;const [nm,val]=a.kw.split(" ");if(nm===k)return val?parseInt(val):true}
  for(const s of hereStatics(x)){if(!s.kw)continue;const [nm,val]=s.kw.split(" ");if(nm===k)return val?parseInt(val):true}
  for(const s of x.card.statics){if(!s.kw||s.here||!condOk(x,s.cond))continue;const [nm,val]=s.kw.split(" ");if(nm===k)return val?parseInt(val):true}return k==="challenger"||k==="resist"?0:undefined}
const blocked=(x,b)=>x.card.statics.some(s=>s.block===b&&!s.here&&condOk(x,s.cond||"always"))||hereStatics(x).some(s=>s.block===b)||auras(x).some(a=>a.block===b)||(b==="quest"&&x.noQuestNow)||(b==="challenge"&&x.noChalNow);const flag=(x,f)=>x.card.statics.some(s=>s.flag===f&&condOk(x,s.cond||"always"));
const strOf0=x=>x.card.str+x.tStr+(x.lStr||0);const strOf=x=>{let v=Math.max(0,x.card.str+x.tStr+(x.lStr||0)+statOn(x,"str"));if(CUR&&v<x.card.str&&CUR.players[x.owner]&&CUR.players[x.owner].play.some(y=>y.card.strFloor))v=x.card.str;return v};
const chalStr=(st,x)=>st.players[x.owner].play.some(y=>y.card.wilDamage)&&isChar(x)?wilOf(x):strOf(x);const loreOf=x=>Math.max(0,x.card.lore+(x.tLore||0)+(x.lLore||0)+statOn(x,"lore"));const wilOf=x=>x.card.wil+statOn(x,"wil");

function mulligan(st,pi,uids){
  const p=st.players[pi];if(st.mull[pi])return;
  const back=p.hand.filter(c=>uids.includes(c.uid));p.hand=p.hand.filter(c=>!uids.includes(c.uid));
  for(let k=0;k<back.length&&p.deck.length;k++)p.hand.push(p.deck.pop());
  p.deck.push(...back);shuffle(p.deck,st.r);st.mull[pi]=true;
  log(st,`${p.name} ${back.length?"mulligans "+back.length+" card"+(back.length>1?"s":""):"keeps their hand"}.`);
  if(st.mull[0]&&st.mull[1]){st.phase="main";st.turnNo=1;st.active=st.first;startTurn(st)}
}
function draw(st,pi,n){const p=st.players[pi];for(let k=0;k<n;k++){if(!p.deck.length){lose(st,pi,"had to draw from an empty deck");return false}const c=p.deck.pop();p.hand.push(c);p.drawsN=p.drawsT===st.turnNo?(p.drawsN||0)+1:1;p.drawsT=st.turnNo;for(const y of p.play)if(y.card.chalOnDraw&&st.active===pi)y.tChal=(y.tChal||0)+1;ev(st,{t:"draw",pi,uid:c.uid});if(st.active===pi&&st.phase==="main")fire(st,pi,"onDrawYT",c);else if(st.phase==="main")fire(st,opp(pi),"onOppDraw",c)}return true}
function lose(st,pi,why){if(st.winner!=null)return;st.winner=opp(pi);st.phase="over";log(st,`${st.players[pi].name} ${why}. ${st.players[opp(pi)].name} wins!`)}
function winAt(st,pi){return st.players[opp(pi)].play.some(y=>y.card.win25)?25:20}
function checkWin(st){if(st.winner!=null)return;const a=st.players[0].lore>=winAt(st,0),b=st.players[1].lore>=winAt(st,1);
  if(a&&b){st.winner=st.active;st.phase="over";log(st,`${st.players[0].name} and ${st.players[1].name} both reached the lore goal — ${st.players[st.active].name} wins (active player)!`);return}
  if(a){st.winner=0;st.phase="over";log(st,`${st.players[0].name} reaches ${st.players[0].lore} lore and wins!`)}
  else if(b){st.winner=1;st.phase="over";log(st,`${st.players[1].name} reaches ${st.players[1].lore} lore and wins!`)}}
function gain(st,pi,n){const p=st.players[pi];if(n>0&&st.players[opp(pi)].play.some(y=>y.card.noGainUnlessChal&&y.exerted)&&p.chalT!==st.turnNo)return;p.lore+=n;if(n)ev(st,{t:"lore",pi,n});checkWin(st)}
function startTurn(st){
  const pi=st.active,p=st.players[pi];const wasEx=p.play.filter(c=>c.exerted);p.actionsN=0;p.inked=false;p.inkN=0;p.disc=[];p.boosted=new Set();
  p.ink.forEach(c=>c.exerted=false);let rMax=p.readyMax1?1:99;p.readyMax1=false;p.play.slice().sort((a,b)=>instVal(b)-instVal(a))/*nc:ready-step ordering; with "ready only one" the highest-value character is readied (remaining auto choice)*/.forEach(c=>{const nrh=c.card.statics.find(s=>s.noReadyHand);if(c.noReady)c.noReady=false;else if(isItem(c)&&st.players[opp(pi)].play.some(y=>y.card.oppItemsNoReady)){}else if(isChar(c)&&c.exerted&&rMax<=0){}else if(c.card.noReadySelf||st.players[opp(pi)].play.some(y=>y.card.noReadyOpp&&y.card.noReadyOpp(y,c))||(c.frozenBy!=null&&find(st,c.frozenBy)?.zone==="play")){}else if(!(nrh&&p.hand.length>=nrh.noReadyHand)){if(isChar(c)&&c.exerted)rMax--;c.exerted=false}if(c.lSrc==null||c.lSrc===pi)c.lStr=0;c.noQuestNow=!!c.noQuestNext;c.noChalNow=!!c.noChalNext;c.noQuestNext=c.noChalNext=false});
  for(const q of st.players)q.play.forEach(c=>{c.grants=(c.grants||[]).filter(g=>!(g.until==="srcStart"&&g.src===pi))});           // ready (long debuffs from this player expire)
  st.players[opp(pi)].play.forEach(c=>{if(c.lSrc===pi){c.lStr=0;c.lSrc=null}});for(const q of st.players)q.play.forEach(c=>{if(c.lLoreSrc===pi){c.lLore=0;c.lLoreSrc=null}});
  for(const c of wasEx)if(!c.exerted&&c.card.onReadyT&&c.card.onReadyT.length)trig(st,pi,c.card.onReadyT,c);
  log(st,`-- Turn ${st.turnNo}: ${p.name} --`);ev(st,{t:"turn",pi});
  for(const l of p.play.filter(isLoc)){const lv=loreOf(l);if(lv){gain(st,pi,lv);log(st,`${l.card.name} gives ${p.name} ${lv} lore.`)}} // set
  if(st.winner!=null)return;
  for(const y of [...p.discard])if(y.card.gyStart&&st.winner==null&&p.play.length<12&&(y.card.gyStart===true||y.card.gyStart(st,pi,y))){toHandFrom(p,"discard",y);playFree(st,pi,y,true)}
  for(const x of [...p.play])if(x.card.onStart.length){trig(st,pi,x.card.onStart,x);if(st.winner!=null)return}
  if(!(st.turnNo===1&&pi===st.first)&&!p.play.some(y=>y.card.skipDraw))draw(st,pi,1);                              // draw
}
function endTurn(st){
  const pi=st.active;fire(st,opp(pi),"onOppEnd");{const P=st.players[pi];for(const x of [...P.play])if(x.card.tempShift&&x.under.length){const idx=P.play.indexOf(x);const base=x.under.pop();base.under=x.under;base.at=x.at;base.damage=0;x.under=[];P.play[idx]=base;reset(x);P.hand.push(x);log(st,`${x.card.name} returns to hand (Temporary Shift).`)}}for(const x of [...st.players[pi].play])if(x.card.onEnd.length){trig(st,pi,x.card.onEnd,x);if(st.winner!=null)return}
  st.players.forEach(p=>p.play.forEach(c=>{c.tStr=0;c.tLore=0;c.tChal=0;c.noQuest=false;c.grants=(c.grants||[]).filter(g=>g.until!=="turnEnd"&&!(g.until==="ownerTurnEnd"&&c.owner===st.active));if(c.owner===st.active){c.noQuestNow=c.noChalNow=false}}));
  for(const q of st.players)for(const c of [...q.play])if(c.banishEOT===st.turnNo)banish(st,c);
  st.players.forEach(p=>p.hooks=[]);st.active=opp(st.active);st.turnNo++;startTurn(st);
}
function banish(st,x){
  const f=find(st,x.uid);if(!f||f.zone!=="play")return;const p=st.players[f.pi];if(x.card.banishToInk){p.play=p.play.filter(y=>y!==x);p.discard.push(...x.under);x.under=[];putInk(st,f.pi,x);log(st,`${x.card.full} goes into the inkwell instead.`);return}x._underN=x.under.length;if(isChar(x)&&hasCls(x,"toy"))st.players[x.owner].toyBanT=st.turnNo;x._wasChal=st._challenger!=null&&(st._defender===x.uid||st._challenger===x.uid);x._lastStr=isChar(x)?strOf(x):0;st.banT=st.turnNo;if(st._challenger!=null&&x.owner!==st.active)st.oppChalBanT2=st.turnNo;if(st._challenger!=null)st.chalBanT=st.turnNo;x._underCards=[...x.under];if(x.card.name==="Buzz Lightyear")st.buzzBanT=st.turnNo;if(isLoc(x))x._hadEx=p.play.some(y=>y.at===x.uid&&y.exerted);const atL=x.at!=null?p.play.find(y=>y.uid===x.at):null;
  p.play=p.play.filter(c=>c!==x);reset(x);
  if(isLoc(x))p.play.forEach(c=>{if(c.at===x.uid)c.at=null});
  p.discard.push(...x.under,x);x.under=[];log(st,`${x.card.full} is banished.`);
  if((x._rcb===st.turnNo||x.card._rcbAlways||p.play.some(y=>y.card.giveRcb&&y.card.giveRcb(x)))&&st._challenger!=null&&p.discard.includes(x)){p.discard.splice(p.discard.indexOf(x),1);p.hand.push(x);log(st,`${x.card.name} returns to hand.`)}
  if(isChar(x))for(const q of [0,1])fire(st,q,"onAnyBanished",x);
  if(atL&&atL.card.onBanishedHere&&find(st,atL.uid)?.zone==="play"){st._ctx=x;trig(st,f.pi,atL.card.onBanishedHere,atL)}
  if(isItem(x))fire(st,f.pi,"onItemBanished",x);if(isLoc(x))fire(st,f.pi,"onLocBanished",x);ev(st,{t:"banish",uid:x.uid,pi:f.pi});(st.stats=st.stats||[{},{}])[opp(f.pi)].banished=((st.stats[opp(f.pi)].banished)||0)+1;
  if(x.card.onBanish.length&&st.winner==null){const effs=x.card.onBanish.filter(e=>!e.challengedOnly||(st._challenger!=null&&st._challenger!==x.uid&&st.active!==f.pi));if(effs.length)trig(st,f.pi,effs,x)}
  st._banished=x;
  if(isChar(x)&&st.winner==null)for(const y of [...p.play])for(const h of y.card.onAllyBanished){if(h.inChal&&st._challenger==null)continue;if(h.cls&&!x.card.cls.some(k=>k.toLowerCase()===h.cls))continue;if(h.kw&&!x.card.kw[h.kw])continue;if(h.yourTurn&&st.active!==f.pi)continue;trig(st,f.pi,h.eff,y)}
  if(st.winner==null)for(const y of [...st.players[opp(f.pi)].play])for(const h of (y.card.onOppBanished||[])){if(h.inChal&&st._challenger==null)continue;if(h.yourTurn&&st.active===f.pi)continue;if(h.cls&&!x.card.cls.some(k=>k.toLowerCase()===h.cls))continue;if(h.kinds&&!h.kinds.includes(x.card.type))continue;trig(st,opp(f.pi),h.eff,y)}
  if(st.winner==null&&x.card.onLeave)trig(st,f.pi,x.card.onLeave,x);
}
function fire(st,pi,key,ctx){if(key==="onSelfDiscard"&&ctx&&ctx.card&&st.active===pi&&st.players[pi].discard.includes(ctx)&&(ctx.card.playOnDiscard||st.players[pi].play.some(y=>y.card.gyOnDiscardChar&&isChar(ctx)))&&inkAvail(st.players[pi])>=costOf(st,pi,ctx.card)&&st.winner==null){const P=st.players[pi];payInk(P,costOf(st,pi,ctx.card));toHandFrom(P,"discard",ctx);playFree(st,pi,ctx)}
  const trigs=[];for(const y of [...st.players[pi].play]){const h=y.card[key];if(h&&h.length&&st.winner==null&&find(st,y.uid)?.zone==="play")trigs.push({y,h})}
  if(!trigs.length)return;
  const run=ord=>{for(const t of ord){if(st.winner!=null)break;st._ctx=ctx;trig(st,pi,t.h,t.y)}};
  if(trigs.length===1||!humanAsk(st,pi)){run(trigs);return}
  // #20: simultaneous triggers — controller picks which ability resolves first; the rest keep board order
  CH(st,pi,trigs.map(t=>({label:t.y.card.full+" ability",v:t,card:t.y.card,uid:t.y.uid})),(p,c)=>{
    const first=c&&c.v?c.v:trigs[0];run([first,...trigs.filter(t=>t!==first)])
  },{always:true,prompt:"Several abilities triggered — which resolves first?",ai:l=>[l[0]]})}
function damage(st,x,n,pierce){if(n<=0)return;const inChal=st._challenger===x.uid||st._defender===x.uid;
  if(x.card.dmgImmune&&x.card.dmgImmune(st,x,inChal))return;if(isChar(x)&&strOf(x)>=7&&st.players[x.owner].play.some(y=>y.card.bigImmune))return;if(inChal&&x.chalImmT===st.turnNo)return;if(x.card.firstDmgShield&&st.active!==x.owner&&x.shieldT!==st.turnNo){x.shieldT=st.turnNo;return}if(x.supShieldT!=null&&x.supShieldT>=0&&!x._supUsed){x._supUsed=true;x.supShieldT=null;return}{const shs=st.players[x.owner].play.filter(y=>y!==x&&isChar(y)&&y.card.shield);if(shs.length&&isChar(x)){const apply=sh=>{sh.damage+=n;ev(st,{t:"damage",uid:sh.uid,n});if(sh.damage>=wilOf(sh))banish(st,sh)};
    if(shs.length===1||!humanAsk(st,x.owner)){apply(shs.slice().sort((a,b)=>(wilOf(a)-a.damage)-(wilOf(b)-b.damage)||a.card.cost-b.card.cost)/*nc:ai-order*/[0]);return}
    // #22: controller chooses which damage-redirect character takes the hit
    CH(st,x.owner,shs,(p,sh)=>{if(sh)apply(sh)},{always:true,prompt:"Which character takes the redirected damage?",ai:l=>[l.slice().sort((a,b)=>(wilOf(a)-a.damage)-(wilOf(b)-b.damage)||a.card.cost-b.card.cost)/*nc:ai-order*/[0]]});return}}const d=pierce?n:Math.max(0,n-(K(x,'resist')||0));x.damage+=d;ev(st,{t:"damage",uid:x.uid,n:d});if(d>0&&st._fromAct&&x.owner!==st.active&&isChar(x)&&!st._meridaNow&&st.players[st.active].play.some(y=>y.card.name==="Merida"&&y.card.version==="Formidable Archer")){st._meridaNow=1;try{damage(st,x,2)}finally{st._meridaNow=0}}
  if(d>0){st.players[x.owner].dmgT=st.turnNo;st._ctx=x;fire(st,x.owner,"onAllyDamaged",x);fire(st,opp(x.owner),'onOppDamaged',x)}if(d>0&&x.card.onDamagedSelf&&find(st,x.uid)?.zone==='play'){st._ctx=d;trig(st,x.owner,x.card.onDamagedSelf,x)}if(wilOf(x)&&x.damage>=wilOf(x)&&find(st,x.uid)?.zone==='play')banish(st,x)}

/* targets */
function namesOf(x){return[x.card.name.toLowerCase(),...(x.card.alias||[])]}
function targets(st,pi,t){
  const out=[];
  for(let i=0;i<2;i++){
    if(t.opp&&i===pi)continue;if(t.own&&i!==pi)continue;
    for(const x of st.players[i].play){
      if(t.kind==="char"&&!isChar(x))continue;if(t.kind==="item"&&!isItem(x))continue;if(t.exerted&&!x.exerted)continue;
      if(i!==pi&&K(x,'ward'))continue;
      if(t.damaged&&!x.damage)continue;
      if(t.kinds&&!t.kinds.includes(x.card.type))continue;if(t.state==="damaged"&&!x.damage||t.state==="undamaged"&&x.damage||t.state==="exerted"&&!x.exerted||t.state==="ready"&&x.exerted)continue;
      if(t.cls&&!x.card.cls.some(c=>c.toLowerCase()===t.cls))continue;if(t.name&&!namesOf(x).includes(t.name.toLowerCase()))continue;if(t.minStr!=null&&strOf(x)<t.minStr)continue;
      if(t.other&&CUR&&CUR._src&&x.uid===CUR._src)continue;if(isItem(x)&&x.owner!==pi&&st.players[x.owner].play.some(y=>y.card.protectItems))continue;if(t.test&&!t.test(x,st))continue;
      if(t.maxStr!=null&&strOf(x)>t.maxStr)continue;if(t.maxCost!=null&&x.card.cost>t.maxCost)continue;
      out.push(x.uid);
    }
  }
  {const forced=out.filter(u=>{const f=find(st,u);return f&&f.pi!==pi&&f.inst.card.mustChoose&&!K(f.inst,"ward")});if(forced.length)return out.filter(u=>{const f=find(st,u);return f.pi===pi||forced.includes(u)})}
  return out;
}
const needsTarget=effs=>effs.find(e=>e.t);
function yp(st,pi,x){const t=x.card.type,fl=x.card.cls.includes("Floodborn");for(const y of [...st.players[pi].play]){if(y===x)continue;for(const h of y.card.onYouPlay){
  let ok=h.type==="any"||h.type===t||h.type==="action"&&t==="song"||h.type==="floodborn character"&&fl&&t==="character"||h.type==="actionOnly"&&t==="action"||h.type==="another character"&&t==="character";
  if(h.name&&x.card.name.toLowerCase()!==h.name)ok=false;if(h.maxCost!=null&&x.card.cost>h.maxCost)ok=false;if(h.test&&!h.test(st,pi,x,y))ok=false;if(h.kw&&!x.card.kw[h.kw])ok=false;if(ok&&h.once){if(y.onceP===st.turnNo)ok=false;else y.onceP=st.turnNo}
  if(ok)trig(st,pi,h.eff,y)}if(st.winner!=null)return}}
function playFree(st,pi,x,exerted){const p=st.players[pi],c=x.card;p.hand=p.hand.filter(h=>h!==x);ev(st,{t:"play",pi,uid:x.uid,name:c.full});log(st,`${p.name} plays ${c.full} for free.`);
  if(c.type==="action"||c.type==="song"){trig(st,pi,c.onPlay,x,true);p.discard.push(x);return}
  reset(x);x.playedOn=st.turnNo;p.play.push(x);if(exerted||c.entersExerted)x.exerted=true;trig(st,pi,c.onPlay,x);yp(st,pi,x)}
function moveCost(st,pi,x,l){let n=l.card.move;if(l.card.moveFree&&l.card.moveFree(x,l,st))return 0;if(l.card.moveRed)n-=l.card.moveRed(x,l,st);for(const y of st.players[pi].play)if(y.card.moveDisc)n-=y.card.moveDisc;if(x.card.moveDiscOnce&&x.mvOnceT!==st.turnNo)n-=x.card.moveDiscOnce;return Math.max(0,n)}
function doMove(st,pi,x,l){if(st.active===pi&&x.card.moveDiscOnce)x.mvOnceT=st.turnNo;x._fromLoc=x.at!=null;x.at=l.uid;ev(st,{t:"move",pi,uid:x.uid,loc:l.uid});log(st,`${x.card.name} moves to ${l.card.name}.`);st._ctx=l;
  if(l.card.onMoveHere&&st.active===pi&&l.onceMH!==st.turnNo){l.onceMH=st.turnNo;st._ctx=x;trig(st,pi,l.card.onMoveHere,l)}
  if(x.card.onMoveSelf&&x.card.onMoveSelf.length){st._ctx=l;trig(st,pi,x.card.onMoveSelf,x)}}
function loseLore(st,P,n){const q=st.players.indexOf(P);if(st.active!==q&&P.play.some(y=>y.card.noLoseOppTurn))return 0;const l=Math.min(P.lore,n);P.lore-=l;return l}
function scanDisc(st){for(const P of st.players){const ids=new Set(P.discard.map(y=>y.uid));if(P._dset){for(const u of P._dset)if(!ids.has(u)){P.leftT=st.turnNo;st.leftT=st.turnNo;fire(st,st.players.indexOf(P),"onLeaveDiscard")}}
  for(const y of P.discard)if(!P._dset||!P._dset.has(y.uid))y._inD=st.turnNo;P._dset=ids}}
function scanEx(st){const A=st.active;for(const P of st.players)for(const y of P.play){if(isChar(y)&&y.exerted&&!y._wasEx&&y.owner!==A&&st.winner==null){y._wasEx=true;st._ctx=y;fire(st,A,"onOppExerted",y)}y._wasEx=!!y.exerted}}
function discThisTurn(st,P){scanDisc(st);return P.discard.filter(y=>y._inD===st.turnNo).length}
function inkFire(st,pi){const p=st.players[pi];for(const y of [...p.play])if(y.card.onInk.length&&!(y.card.onInkOnce&&y.inkUsed===st.turnNo)){y.inkUsed=st.turnNo;trig(st,pi,y.card.onInk,y)}}
function putInk(st,q,y,ex=true){if(!y)return;const P=st.players[q];reset(y);y.exerted=ex||st.players[1-q].play.some(z=>z.card.oppInkExerted&&z.exerted);y.owner=q;P.ink.push(y);P.inkT=st.turnNo;if(st.active===q)inkFire(st,q)}
function noHeal(st){return st.players.some(P=>P.play.some(y=>y.card.noHeal))}
function singVal(x){const ks=K(x,"singer");let v=typeof ks==="number"&&ks>x.card.cost?ks:x.card.kw.singer!=null?x.card.kw.singer:x.card.cost;if(CUR&&x.tSingT===CUR.turnNo)v+=x.tSing||0;for(const a of auras(x))if(a.singBonus)v+=a.singBonus;for(const s of hereStatics(x))if(s.singBonus)v+=s.singBonus;return v}
function discardPri(x){return x.card.cost+(x.card.inkable?0:1)}
function resolve(st,pi,effs,tgt,src,fromAction){if((st._depth||0)>30)return;st._depth=(st._depth||0)+1;const pf=st._fromAct;if(fromAction)st._fromAct=true;try{resolve0(st,pi,effs,tgt,src,fromAction)}finally{st._depth--;st._fromAct=pf}}
function resolve0(st,pi,effs,tgt,src,fromAction){st._src=src?src.uid:null;st._srcName=src?src.card.full:"";st._srcCard=src?src.card:null;
  let last=null;
  for(const e of effs){
    const T=(e.t||e.rider)&&tgt!=null?find(st,tgt):null,x=T&&T.zone==="play"?T.inst:null;
    if(st._decline&&e.may)continue;
    if((e.t||e.rider)&&!x)continue;
    if(fromAction&&x&&e.t&&T.pi!==pi&&K(x,"vanish")){banish(st,x);continue}
    const me=st.players[pi],o=st.players[opp(pi)],self=src&&find(st,src.uid)?.zone==="play"?src:null;
    if(e.payInk){if(inkAvail(me)<e.payInk)continue;payInk(me,e.payInk)}
    if(x&&e.t&&x.card.onChosenAny&&src&&!isChar(src)&&!x._chosenNow){x._chosenNow=1;try{trig(st,T.pi,x.card.onChosenAny,x)}finally{x._chosenNow=0}}
    if(x&&e.t&&T.pi!==pi&&x.card.onChosen&&!x._chosenNow){x._chosenNow=1;try{trig(st,T.pi,x.card.onChosen,x)}finally{x._chosenNow=0}}
    switch(e.k){
      case"draw":draw(st,pi,e.n);break;
      case"grantMulti":x.grants=x.grants||[];for(const kw of e.kws)x.grants.push({kw,until:e.long?(e.t.opp?"ownerTurnEnd":"srcStart"):"turnEnd",src:pi});if(e.lore){if(e.long){x.lLore=(x.lLore||0)+e.lore;x.lLoreSrc=pi}else x.tLore+=e.lore}if(e.str)x.tStr+=e.str;break;
      case"fn":e.f(st,pi,self,x,{me,o,src,e});break;
      case"discCost":{const h=me.hand.filter(y=>!e.ty||y.card.type===e.ty||(e.ty==="action"&&y.card.type==="song")||y.card.cls.some(k=>k.toLowerCase()===e.ty));if(!h.length)break;discPick(st,pi,1,{test:y=>h.includes(y),prompt:"Choose a card to discard (cost)",then:()=>resolve(st,pi,e.eff,tgt,src,fromAction)});break}
      case"gyHate":{PKs(st,pi,o.discard,(y)=>{if(y){o.discard.splice(o.discard.indexOf(y),1);o.deck.unshift(y)}},{ai:srt((a,b)=>b.card.cost-a.card.cost),prompt:"choose a card from your opponent's discard"});break;}
      case"multi":{const ts=targets(st,pi,e.inner.t).map(u=>find(st,u).inst);CH(st,pi,ts,ps=>{for(const z of ps)resolve(st,pi,[e.inner],z.uid,src,fromAction)},{n:e.n,min:0,always:true,prompt:`choose up to ${e.n} targets`,ai:(l,n)=>l.map(y=>({y,v:effVal(st,pi,[e.inner],y.uid)})).filter(z=>z.v>0).sort((a,b)=>b.v-a.v)/*nc:ai-order*/.slice(0,n).map(z=>z.y)});break}
      case"tutor":{const ok=me.deck.filter(c=>c.card.type===e.type&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls))&&(!e.name||c.card.name.toLowerCase()===e.name)&&c.card.cost<=e.max);
        CH(st,pi,ok,(p,c)=>{shuffle(me.deck,st.r);if(c){me.deck.splice(me.deck.indexOf(c),1);if(e.top)me.deck.push(c);else me.hand.push(c);log(st,`${me.name} searches for ${c.card.full}.`)}},{empty:true,prompt:"search your deck: choose a card",ai:srt((a,b)=>b.card.cost-a.card.cost)});break}
      case"nameReveal":{if(!me.deck.length)break;const go=nm=>{const top=me.deck[me.deck.length-1];if(!top)return;
        log(st,`${me.name} names ${nm} and reveals ${top.card.full}.`);if(top.card.full===nm){me.deck.pop();if(e.to==="hand")me.hand.push(top);else{top.exerted=true;me.ink.push(top)}}};const reps={};for(const z of [...me.deck,...me.hand,...me.discard,...me.play,...me.ink])if(!reps[z.card.full])reps[z.card.full]=z;const cnt={};me.deck.forEach(c=>cnt[c.card.full]=(cnt[c.card.full]||0)+1);CH(st,pi,Object.values(reps),(p,c)=>go(c.card.full),{always:true,prompt:"name a card, then reveal the top card of your deck",ai:(l)=>[reps[Object.entries(cnt).sort((a,b)=>b[1]-a[1])/*nc:ai-order*/[0][0]]]});break}
      case"wheel":for(const P of st.players){P.discard.push(...P.hand);P.hand=[]}draw(st,pi,e.n);draw(st,opp(pi),e.n);break;
      case"pay":if(inkAvail(me)>=e.n){payInk(me,e.n);resolve(st,pi,e.eff,tgt,src,fromAction)}break;
      case"toInk":{const P=st.players[T.pi];P.play=P.play.filter(c=>c!==x);reset(x);x.exerted=true;P.ink.push(x);P.discard.push(...x.under);x.under=[];log(st,`${x.card.full} goes into the inkwell.`);break}
      case"moveDmg":{const n=Math.min(e.n,x.damage);if(!n)break;const xx=x;PKs(st,pi,o.play.filter(isChar).filter(c=>!K(c,"ward")),(t)=>{if(!t)return;const k=Math.min(n,xx.damage);xx.damage-=k;t.damage+=k;ev(st,{t:"damage",uid:t.uid,n:k});if(t.damage>=wilOf(t))banish(st,t)},{prompt:"move damage to an opposing character",ai:srt((a,b)=>(wilOf(a)-a.damage<=n?-100:0)-(wilOf(b)-b.damage<=n?-100:0)||instVal(b)-instVal(a))});break}
      case"shuffleIn":{const P=st.players[T.pi];P.play=P.play.filter(c=>c!==x);reset(x);P.deck.push(x,...x.under);x.under=[];shuffle(P.deck,st.r);break}
      case"reveal":{if(!me.deck.length)break;const c=me.deck[me.deck.length-1];const ok=c.card.type===e.type||e.type==="action"&&c.card.type==="song";log(st,`${me.name} reveals ${c.card.full}.`);
        if(ok){me.deck.pop();if(e.to==="hand")me.hand.push(c);else{me.hand.push(c);playFree(st,pi,c,e.to==="playex")}}break}
      case"free":{const opts=me.hand.filter(h=>(h.card.type===e.type||e.type==="action"&&h.card.type==="song")&&h.card.cost<=e.max);if(!opts.length)break;
        CH(st,pi,opts,(p,c)=>{if(c)playFree(st,pi,c)},{optional:!!humanAsk(st,pi),always:true,prompt:`choose a ${e.type} to play for free`,ai:srt((a,b)=>b.card.cost-a.card.cost)});break}

      case"freeMove":{const ls=me.play.filter(isLoc);if(!ls.length)break;PKs(st,pi,me.play.filter(y=>isChar(y)&&y.at==null),(c)=>{if(!c)return;PKs(st,pi,ls,(l)=>{if(l){c.at=l.uid;log(st,`${c.card.name} moves to ${l.card.name}.`)}},{prompt:`move ${c.card.name} to which location?`,ai:l=>[l[0]]})},{prompt:"choose a character to move for free",ai:srt((a,b)=>b.card.cost-a.card.cost)});break}
      case"teamBuff":case"teamGrant":for(const y of me.play.filter(c=>isChar(c)&&(!e.other||c!==self)&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls)))){if(e.k==="teamGrant")y.grants.push({kw:e.kw,until:e.long?"srcStart":"turnEnd",src:pi});else if(e.stat==="lore")y.tLore+=e.n;else y.tStr+=e.n}break;
      case"teamBuffV":break;case"readyItem":{PKs(st,pi,me.play.filter(c=>isItem(c)&&c.exerted),it=>{if(it)it.exerted=false},{prompt:"ready one of your items",ai:l=>[l[0]]});break}
      case"underToHand":if(self){me.hand.push(...self.under);self.under=[]}break;
      case"drain":gain(st,pi,e.g);loseLore(st,o,e.lo);break;
      case"massState":{const ps=e.who==="opposing"?[o]:e.who==="your"?[me]:[me,o];for(const P of ps){if(e.what.includes("inkwell"))P.ink.forEach(c=>c.exerted=e.to==="exert");else P.play.filter(c=>e.what==="items"?isItem(c):isChar(c)).filter(c=>!e.damaged||c.damage).forEach(c=>c.exerted=e.to==="exert")}break}
      case"massReady":me.play.filter(c=>isChar(c)&&(!e.other||c!==self)&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls))&&c.card.cost<=e.max).forEach(c=>c.exerted=false);break;
      case"discardHand":me.discard.push(...me.hand);me.hand=[];break;
      case"selfDiscard":if(me.play.some(y=>y.card.noSelfDiscard))break;discPick(st,pi,e.n);break;
      case"mill":for(let k=0;k<e.n&&me.deck.length;k++)me.discard.push(me.deck.pop());break;
      case"banishAllX":{const ps=e.what.startsWith("opposing")?[o]:[me,o];for(const P of ps)[...P.play.filter(c=>(e.what.endsWith("items")?isItem(c):isChar(c))&&(e.maxStr==null||strOf(c)<=e.maxStr))].forEach(c=>banish(st,c));break}
      case"discardToInk":{const c=me.discard.filter(isChar).pop();if(c){me.discard.splice(me.discard.indexOf(c),1);reset(c);c.exerted=true;me.ink.push(c)}break}
      case"handToInk":{PKs(st,pi,me.hand,(c)=>{if(!c)return;me.hand.splice(me.hand.indexOf(c),1);c.exerted=!!e.exerted;me.ink.push(c)},{prompt:"choose a card from your hand to put into your inkwell",ai:by(x=>discardPri(x))});break}
      case"drawAll":draw(st,pi,e.n);draw(st,opp(pi),e.n);break;
      case"gainLore":gain(st,pi,e.n);break;
      case"oppLose":{if(e.ifMore&&o.lore<=me.lore)break;loseLore(st,o,e.n);break}
      case"dmgAllOpp":[...st.players[opp(pi)].play.filter(isChar)].forEach(c=>damage(st,c,e.n));break;
      case"dmg":if(e.counters){x.damage+=e.n;ev(st,{t:"damage",uid:x.uid,n:e.n});if(x.damage>=wilOf(x))banish(st,x)}else damage(st,x,e.n);break;
      case"banish":banish(st,x);break;
      case"bounce":{const o=st.players[T.pi];o.play=o.play.filter(c=>c!==x);const cards=[...x.under,x];x.under=[];
        if(isLoc(x))o.play.forEach(c=>{if(c.at===x.uid)c.at=null});
        cards.forEach(c=>{c.damage=0;c.exerted=false;c.tStr=0;c.at=null;st.players[c.owner].hand.push(c)});log(st,`${x.card.full} returns to hand.`);fire(st,T.pi,"onAllyReturned",x);fire(st,opp(T.pi),"onOppReturned",x);if(x.card.onLeave)trig(st,T.pi,x.card.onLeave,x);break}
      case"heal":{if(noHeal(st))break;const r0=Math.min(x.damage,e.n);x.damage-=r0;if(r0)fire(st,T.pi,"onHeal",r0);break}
      case"healAll":if(noHeal(st))break;st.players[pi].play.filter(c=>isChar(c)&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls))).forEach(c=>{const r0=Math.min(c.damage,e.n);c.damage-=r0;if(r0)fire(st,pi,"onHeal",r0)});break;
      case"buffStr":x.tStr+=e.n;break;
      case"exert":x.exerted=true;break;
      case"ready":x.exerted=false;break;
      case"loot":{draw(st,pi,e.n);discPick(st,pi,e.d);break}
      case"debuff":if(e.long){x.lStr-=e.n;x.lSrc=pi}else x.tStr-=e.n;if(e.reckless){x.grants=x.grants||[];x.grants.push({kw:"reckless",until:e.long?"ownerTurnEnd":"turnEnd",src:pi})}break;
      case"buffLore":x.tLore+=e.n;break;
      case"buffChal":x.tChal+=e.n;break;
      case"oppDiscard":{const yours=!!(src&&/of your choice/i.test(src.card.text||""));const yourPick=(ok,what)=>{if(!ok.length){revealHand(st,pi,opp(pi),`${src?src.card.full+": ":""}opponent's hand (no ${what} to discard)`);return}CH(st,pi,ok,(p,y)=>{if(y&&o.hand.includes(y)){o.hand.splice(o.hand.indexOf(y),1);o.discard.push(y);log(st,`${o.name} discards ${y.card.full}.`);fire(st,opp(pi),"onSelfDiscard",y);fire(st,pi,"onOppDiscard",1)}},{always:humanAsk(st,pi),extra:o.hand.slice(),prompt:`opponent reveals their hand: choose a ${what} for them to discard`,ai:srt((a,b)=>b.card.cost-a.card.cost)})};
        if(e.ofType&&e.ofType!=="non-character"){const ok=o.hand.filter(h=>h.card.type===e.ofType||e.ofType==="action"&&h.card.type==="song");if(yours){yourPick(ok,e.ofType+" card");break}if(ok.length)discPick(st,opp(pi),1,{test:h=>ok.includes(h),byOpp:true,ai:srt((a,b)=>b.card.cost-a.card.cost)});break}
        if(e.random){if(o.hand.length&&!o.play.some(y=>y.card.noDiscardOpp)){const y=o.hand[Math.floor(st.r()*o.hand.length)];o.hand.splice(o.hand.indexOf(y),1);o.discard.push(y);fire(st,pi,"onOppDiscard",1)}break}
        if(e.nonChar||e.ofType==="non-character"){const ok=o.hand.filter(h=>!isChar(h));if(yours){yourPick(ok,"non-character card");break}if(ok.length)discPick(st,opp(pi),1,{test:h=>ok.includes(h),ai:srt((a,b)=>b.card.cost-a.card.cost)});break}if(o.play.some(y=>y.card.noDiscardOpp))break;discPick(st,opp(pi),Math.min(e.n,o.hand.length),{byOpp:true});break}
      case"recur":{const d=st.players[pi].discard,cs=d.filter(c=>(c.card.type===(e.type||"character")||e.type==="action"&&c.card.type==="song")&&(!e.name||c.card.name.toLowerCase()===e.name)&&(e.max==null||c.card.cost<=e.max)&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls)));CH(st,pi,cs,ps=>{for(const c of ps){if(!d.includes(c))continue;d.splice(d.indexOf(c),1);reset(c);st.players[pi].hand.push(c)}},{n:e.n||1,prompt:"return a card from your discard to your hand",ai:srt((a,b)=>b.card.cost-a.card.cost)});break}
      case"noReady":x.noReady=true;break;
      case"noQuest":x.noQuest=true;if(e.also&&e.also.includes("challenge"))x.noChalNow=true;break;
      case"self":if(self){if(e.stat==="str")self.tStr+=e.n;else if(e.stat==="lore")self.tLore+=e.n}break;
      case"self2":if(self){self.tStr+=e.s;self.tLore+=e.l}break;
      case"readySelf":if(self)self.exerted=false;break;
      case"healSelf":if(self)self.damage=Math.max(0,self.damage-e.n);break;
      case"grant":x.grants=x.grants||[];for(const kw of [e.kw,e.kw2].filter(Boolean))x.grants.push({kw,until:e.long?(e.t.opp?"ownerTurnEnd":"srcStart"):"turnEnd",src:pi});break;
      case"grantSelf":if(self){self.grants=self.grants||[];self.grants.push({kw:e.kw,until:"turnEnd",src:pi})}break;
      case"noNext":if(e.what==="quest")x.noQuestNext=true;else x.noChalNext=true;break;
      case"ramp":if(me.deck.length){const c=me.deck.pop();c.exerted=true;me.ink.push(c)}break;
      case"team":me.play.filter(c=>isChar(c)&&(!e.other||c!==self)).forEach(c=>{if(e.stat==="str")c.tStr+=e.n;else c.tLore+=e.n});break;
      case"oppExert":{PKs(st,opp(pi),o.play.filter(c=>isChar(c)&&!c.exerted),(r)=>{if(r)r.exerted=true;},{ai:srt((a,b)=>loreOf(a)-loreOf(b)),prompt:"your opponent makes you exert one of your characters: choose"});break;}
      case"oppBanish":{PKs(st,opp(pi),o.play.filter(isChar),(r)=>{if(r)banish(st,r);},{ai:srt((a,b)=>a.card.cost-b.card.cost),prompt:"your opponent makes you banish one of your characters: choose"});break;}
      case"payDraw":if(inkAvail(me)>=e.n){payInk(me,e.n);draw(st,pi,1)}break;
      case"banishSelf":if(self)banish(st,self);break;
      case"dmgSelf":if(self)damage(st,self,e.n);break;
      case"dig":{const okF=c=>e.test?e.test(c,st,pi):(e.type==="any"||c.card.type===e.type||e.type==="action"&&c.card.type==="song");const N=typeof e.n==="function"?e.n(st,pi,self):e.n;if(N<=0)break;
        if(st.human[pi]){const top=me.deck.slice(Math.max(0,me.deck.length-N));const ok=top.filter(okF);
          queueP(st,{pi,kind:"dig",top:top.map(c=>c.uid),opts:ok.map(c=>c.uid),n:e.take||1,rest:e.rest,play:e.play,after:e.after,pickOk:e.pickOk,why:`Look at the top ${top.length}: choose ${e.take>1?"up to "+e.take+" cards":"a card"} for your hand`,optional:true,src:src?src.card.full:""});break}
        const top=me.deck.splice(Math.max(0,me.deck.length-N),N);const picks=[];
        for(let k=0;k<(e.take||1);k++){const ok=top.filter(c=>okF(c)&&(!e.pickOk||e.pickOk(c,picks))).sort((a,b)=>b.card.cost-a.card.cost)/*nc:ai-only branch; humans get the dig picker*/;const pick=ok[0];if(!pick)break;top.splice(top.indexOf(pick),1);picks.push(pick)}
        for(const pick of picks){me.hand.push(pick);if(e.play)playFree(st,pi,pick)}
        if(e.rest==="discard")me.discard.push(...top);else if(e.rest==="top")me.deck.push(...top);else me.deck.unshift(...top);if(e.after)e.after(st,pi,picks);break}
      case"scry":break;
      case"banishChallenger":{if(st._challenger!=null){const f2=find(st,st._challenger);if(f2&&f2.zone==="play")banish(st,f2.inst)}break}
      case"returnSelf":{if(!src)break;const P=st.players[src.owner],i=P.discard.indexOf(src);if(i>=0){P.discard.splice(i,1);reset(src);P.hand.push(src)}break}
      case"inkSelf":{if(!src)break;const P=st.players[src.owner],i=P.discard.indexOf(src);if(i>=0){P.discard.splice(i,1);reset(src);src.exerted=true;P.ink.push(src)}break}
      case"discount":me.disc=me.disc||[];me.disc.push({n:e.n,type:e.type});break;
      case"banishAll":for(const q of st.players)[...q.play.filter(isChar)].forEach(c=>banish(st,c));break;
      case"rampAll":for(const q of st.players)for(let k=0;k<e.n&&q.deck.length;k++){const c=q.deck.pop();c.exerted=true;q.ink.push(c)}break;
      case"cond":{if(e.oppMore){const ok=(e.oppMore==="hand"?o.hand.length>me.hand.length:o.ink.length>me.ink.length);if(ok)sub(st,pi,e.eff,tgt,src,fromAction);break}
        if(e.emptyHand){if(!me.hand.length)sub(st,pi,e.eff,tgt,src,fromAction);break}
        if(e.songThisTurn){if(me.songTurn===st.turnNo)sub(st,pi,e.eff,tgt,src,fromAction);break}
        {const P2=me;let c2=null;if(e.hasCls)c2=P2.play.some(y=>y!==self&&y.card.type==="character"&&y.card.cls.some(k=>k.toLowerCase()===e.hasCls));
         else if(e.hasLoc)c2=P2.play.some(isLoc);else if(e.shifted)c2=!!(self&&self.shiftedOn===st.turnNo);else if(e.playedOther)c2=(P2.playedChars||0)>(self&&self.playedOn===st.turnNo?1:0)&&P2.playedTurn===st.turnNo;
         else if(e.under)c2=!!(self&&self.under.length);else if(e.oppExerted)c2=o.play.some(y=>isChar(y)&&y.exerted);
         if(c2!==null){if(c2)sub(st,pi,e.eff,tgt,src,fromAction);break}}
        if(e.gy){const g=e.gy,ok=me.discard.some(y=>(y.card.type===g.type||g.type==="action"&&y.card.type==="song")&&(!g.cls||y.card.cls.some(k=>k.toLowerCase()===g.cls))&&(!g.name||y.card.name.toLowerCase()===g.name));if(ok)sub(st,pi,e.eff,tgt,src,fromAction);break}
        if(e.atLoc){if(self&&self.at!=null)sub(st,pi,e.eff,tgt,src,fromAction);break}
        const ok=e.name?me.play.some(c=>isChar(c)&&c.card.name.toLowerCase()===e.name.toLowerCase()):me.play.filter(c=>isChar(c)&&c!==self).length>=e.count;if(ok)sub(st,pi,e.eff,tgt,src,fromAction);break}
      case"modal":{if(st._mode!=null){const o=e.opts[st._mode];resolve(st,pi,o,tgt,src,fromAction);break}if(humanAsk(st,pi)){const ot=e.optText||e.opts.map((o,i)=>"Option "+(i+1));CH(st,pi,e.opts.map((o,i)=>({label:ot[i],i})),(p,c)=>{if(!c)return;const o=e.opts[c.i];if(tgt!=null&&needsTarget(o))resolve(st,pi,o,tgt,src,fromAction);else trig(st,pi,o,src,fromAction)},{prompt:`${src?src.card.full:"Choose one"}: choose one${e.may?" (or skip)":""}`,optional:!!e.may,always:true});break}let best=e.opts[0],bv=-1e9;for(const o of e.opts){const v=effVal(st,pi,o,autoTarget(st,pi,o));if(v>bv){bv=v;best=o}}resolve(st,pi,best,autoTarget(st,pi,best),src,fromAction);break}
    }
    if(st.winner!=null)return;
  }
}

/* ---------- legal actions ---------- */
function withTargets(st,pi,base,effs){
  effs=effs||[];const md=effs.find(e=>e.k==="modal");let out=[];
  if(md&&st.human[pi]){md.opts.forEach((o,i)=>out.push(...withTargets0(st,pi,{...base,mode:i},[...effs.filter(e=>e!==md),...o])))}else out=withTargets0(st,pi,base,effs);
  if(st.human[pi]&&effs.some(e=>e.may||e.k==="modal"&&e.opts.some(o=>o.some(x=>x.may))))out.push({...base,decline:true,target:null});
  return out;
}
function withTargets0(st,pi,base,effs){st._src=base.uid;
  const nt=needsTarget(effs||[]);if(!nt)return[base];
  const ts=targets(st,pi,nt.t);if(!ts.length)return[{...base,target:null}];
  return ts.map(t=>({...base,target:t}));
}
function challengeTargets(st,pi,a){
  const o=st.players[opp(pi)];
  const unch=x=>(x.unchalUntil||0)>st.turnNo||(x.card.unchalBy&&x.card.unchalBy(st,a,x))||st.players[x.owner].play.some(y=>y.card.unchalAura&&y.card.unchalAura(st,y,x,a));
  let chars=o.play.filter(x=>isChar(x)&&(x.exerted||flag(a,"challengeReady")||a.chReady===st.turnNo||(a.card.chalReadyDamaged&&x.damage))&&!blocked(x,"challenged")&&!unch(x)&&!auras(x).some(z=>z.protect!=null&&a.card.cost<=z.protect||z.protectFn&&z.protectFn(a))&&(!K(x,'evasive')||K(a,'evasive')||K(a,'alert')));
  const bg=chars.filter(x=>K(x,'bodyguard'));if(bg.length)chars=bg;
  return[...chars,...o.play.filter(l=>isLoc(l)&&!blocked(l,"challenged")&&!unch(l))].map(x=>x.uid);
}
function canChallenge(st,pi,a){return isChar(a)&&!blocked(a,"challenge")&&!((a.noChalUntil||0)>st.turnNo)&&!((st.noChalUntil||0)>st.turnNo)&&!(a.card.chalNeed&&!a.card.chalNeed(st,pi,a))&&!a.exerted&&(dry(st,a)||K(a,'rush'))&&!(st.chalTurn===st.turnNo&&st.players.some(P=>P.play.some(y=>y.card.oneChallenger)))&&!(a.card.actTax&&inkAvail(st.players[pi])<1)}
function legalActions(st){let A=legalActions0(st);if(st.pending)return A;const p=st.players[st.active],ink=inkAvail(p);
  if(A.some(a=>a.t==="quest"&&(find(st,a.uid).inst.mustQuestUntil||0)>st.turnNo))A=A.filter(a=>a.t!=="end");return A.filter(a=>!(a.t==="play"&&a.shift!=null&&!a.alt&&!a.free&&shiftCost(st,st.active,find(st,a.uid).inst.card,find(st,a.shift).inst)>ink))}
function legalActions0(st){
  CUR=st;if(st.phase!=="main"||st.winner!=null)return[];
  if(st.pending){const P=st.pending;if(P.kind==="ask"){const A=P.reveal?[]:P.items.map((x,i)=>i).filter(i=>!P.sel.includes(i)).map(i=>({t:"ask",i}));if(P.sel.length>=P.min)A.push({t:"askDone"});return A}if(P.kind==="dig"||P.kind==="free"){const zz=P.kind==="dig"?st.players[P.pi].deck:st.players[P.pi].hand;return[...P.opts.filter(u=>zz.some(d=>d.uid===u)).map(u=>({t:"pick",uid:u})),{t:"pickDone"}]};return st.players[P.pi].hand.map(h=>({t:"discard",uid:h.uid}))}
  const pi=st.active,p=st.players[pi],ink=inkAvail(p),A=[];
  for(const h of p.hand){
    const c=h.card;
    if(!p.inked&&(c.inkable||p.play.some(y=>y.card.inkAll)))A.push({t:"ink",uid:h.uid});
    if(c.shiftFreeIf&&c.shiftFreeIf(st,pi))for(const b of p.play.filter(x=>isChar(x)&&namesOf(x).includes(c.name.toLowerCase())))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,shift:b.uid,alt:2},c.onPlay));
    if((c.type==="action"||c.type==="song")&&(st.players[opp(pi)].play.some(y=>y.card.blockActions&&y.card.blockActions(y,st))||p.noActionsT>=st.turnNo))continue;
    if(c.type==="item"&&p.noItemsT>=st.turnNo)continue;
    if(isAct(h)&&c.cost>=4&&st.players[opp(pi)].play.some(y=>y.card.name==="Gizmoduck"&&y.card.version==="Duckburg Defender")&&!st.players[opp(pi)].hand.length)continue;
    if(c.playReq&&!c.playReq(st,pi))continue;
    if(costOf(st,pi,c)<=ink){A.push(...withTargets(st,pi,{t:"play",uid:h.uid},c.onPlay));if(c.kw.bodyguard&&c.type==="character")A.push(...withTargets(st,pi,{t:"play",uid:h.uid,exerted:true},c.onPlay))}
    if(c.singTogether){const sg=p.play.filter(x=>isChar(x)&&!x.exerted&&dry(st,x)&&!blocked(x,"sing"));
      // #21: every valid singer combination (Sing Together uses sing value / Singer N); AI still prefers cheapest later via scoreAction
      const N=Math.min(sg.length,10);const sets=[];
      for(let mask=1;mask<(1<<N);mask++){let sum=0,set=[],bits=0;for(let i=0;i<N;i++)if(mask&(1<<i)){sum+=singVal(sg[i]);set.push(sg[i].uid);bits++}
        if(bits>=2&&sum>=c.singTogether)sets.push(set.join(","))}
      if(!sets.length&&sg.length>N){const cheap=sg.slice().sort((a,b)=>singVal(a)-singVal(b))/*nc:ai-order*/;let tot=0,set=[];for(const x of cheap){if(tot>=c.singTogether&&set.length>=2)break;set.push(x.uid);tot+=singVal(x)}if(tot>=c.singTogether&&set.length>1)sets.push(set.join(","))}
      for(const s of sets)A.push(...withTargets(st,pi,{t:"play",uid:h.uid,singers:s},c.onPlay))}
    if(c.shiftGy&&p.discard.filter(isChar).length>=c.shiftGy)for(const b of p.play.filter(x=>isChar(x)&&(namesOf(x).includes("maleficent")||namesOf(x).includes("diablo"))))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,shift:b.uid,alt:3},c.onPlay));
    if(c.shiftAlt&&c.shiftAlt.n>0&&p.hand.filter(y=>y!==h&&c.shiftAlt.test(y)).length>=c.shiftAlt.n)for(const b of p.play.filter(x=>isChar(x)&&namesOf(x).includes(c.name.toLowerCase())))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,shift:b.uid,alt:1},c.onPlay));
    if(c.freeAlt&&c.freeAlt.req(st,pi,h)&&!(c.freeIf&&c.freeIf(st,pi)))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,free:2},c.onPlay));
    if(c.name==="Microbots"&&p.play.some(y=>y.card.freeMicro))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,free:1},c.onPlay));
    else if(c.freeIf&&c.freeIf(st,pi))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,free:1},c.onPlay));
    if(c.kw.shift!=null&&c.kw.shift-6<=ink)for(const b of p.play.filter(x=>isChar(x)&&(c.kw.shiftAny||x.card.morph||(c.kw.shiftCls?x.card.cls.some(k=>k.toLowerCase()===c.kw.shiftCls):namesOf(x).includes(c.name.toLowerCase())||(c.alias||[]).some(a=>namesOf(x).includes(a))))))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,shift:b.uid},c.onPlay));
    if(c.type==="song")for(const s of p.play.filter(x=>isChar(x)&&!x.exerted&&dry(st,x)&&!blocked(x,"sing")&&singVal(x)>=c.cost))
      A.push(...withTargets(st,pi,{t:"play",uid:h.uid,singer:s.uid},c.onPlay));
  }
  for(const x of p.play){
    if(isChar(x)&&!x.exerted&&(dry(st,x)||x.card.questFresh)&&!K(x,'reckless')&&!(x.card.actTax&&ink<1)&&!blocked(x,"quest")&&!x.noQuest&&loreOf(x)>0)A.push(...(st.human[pi]?withTargets(st,pi,{t:"quest",uid:x.uid},x.card.onQuest):[{t:"quest",uid:x.uid}]));
    if(canChallenge(st,pi,x))for(const t of challengeTargets(st,pi,x))A.push({t:"challenge",uid:x.uid,target:t});
    if(isChar(x)&&!x.card.noMove)for(const l of p.play.filter(isLoc))if(x.at!==l.uid&&l.card.move!=null&&moveCost(st,pi,x,l)<=ink)A.push({t:"move",uid:x.uid,loc:l.uid});
    if(x.card.kw.boost!=null&&isChar(x)&&!(p.boosted&&p.boosted.has(x.uid))&&x.card.kw.boost<=ink&&p.deck.length)A.push({t:"boost",uid:x.uid});
    actsOf(x).forEach((ab,i)=>{if((ab.noExert||!x.exerted)&&(!isChar(x)||dry(st,x))&&ab.ink<=ink&&(!ab.req||ab.req(st,pi,x))&&!(ab.once&&x.onceA===st.turnNo))A.push(...withTargets(st,pi,{t:"act",uid:x.uid,i},ab.eff))});
  }
  if(p.play.some(y=>y.card.gyPlay&&y.exerted))for(const y of p.discard)if(isChar(y)&&costOf(st,pi,y.card)<=ink)A.push(...withTargets(st,pi,{t:"play",uid:y.uid,fromGy:1},y.card.onPlay));
  if(!p.inked&&p.play.some(y=>y.card.inkFromDiscard))for(const y of p.discard)if(y.card.inkable)A.push({t:"ink",uid:y.uid});
  const mustChallenge=p.play.some(x=>K(x,'reckless')&&canChallenge(st,pi,x)&&challengeTargets(st,pi,x).length);
  if(!mustChallenge)A.push({t:"end"});
  return A;
}
function isLegal(st,a){return legalActions(st).some(b=>b.t===a.t&&b.uid===a.uid&&(b.i??null)===(a.i??null)&&(b.target??null)===(a.target??null)&&(b.shift??null)===(a.shift??null)&&(b.singer??null)===(a.singer??null)&&(b.loc??null)===(a.loc??null)&&(b.i??null)===(a.i??null)&&(b.t!=="pick"||true)&&(b.singers??null)===(a.singers??null)&&(b.mode??null)===(a.mode??null)&&!!b.decline===!!a.decline&&!!b.exerted===!!a.exerted)}

function act(st,a){
  CUR=st;if(!isLegal(st,a))throw new Error("Illegal action "+JSON.stringify(a));try{return act0(st,a)}finally{if(!st.pending&&st.pq&&st.pq.length)st.pending=st.pq.shift();if(!st._scanning){st._scanning=1;try{scanDisc(st);scanEx(st)}finally{st._scanning=0}}}}
function act0(st,a){
  if(a.t==="ask"){const P=st.pending;P.sel.push(a.i);if(P.sel.length>=P.n)finishAsk(st);return st}
  if(a.t==="askDone"){finishAsk(st);return st}
  if(a.t==="pick"||a.t==="pickDone"){const P=st.pending,me=st.players[P.pi];
    if(P.kind==="free"){st.pending=null;if(a.t==="pick")playFree(st,P.pi,me.hand.find(h=>h.uid===a.uid));return st}
    if(a.t==="pick"&&!me.deck.some(d=>d.uid===a.uid)){P.opts=P.opts.filter(u=>u!==a.uid);P.top=P.top.filter(u=>u!==a.uid);if(!P.opts.length)a={t:"pickDone"}}
    if(a.t==="pick"){const c=me.deck.find(d=>d.uid===a.uid);me.deck.splice(me.deck.indexOf(c),1);me.hand.push(c);(P.picked=P.picked||[]).push(c);if(P.play){st.pending=null;playFree(st,P.pi,c);if(st.pending)return st;st.pending=P}log(st,`${me.name} puts a card into their hand.`);P.opts=P.opts.filter(u=>u!==a.uid);P.top=P.top.filter(u=>u!==a.uid);P.n--;if(P.pickOk)P.opts=P.opts.filter(u=>{const d=me.deck.find(z=>z.uid===u);return d&&P.pickOk(d,P.picked)})}
    if(a.t==="pickDone"||P.n<=0||!P.opts.length){const rest=me.deck.filter(d=>P.top.includes(d.uid));me.deck=me.deck.filter(d=>!P.top.includes(d.uid));if(P.rest==="discard")me.discard.push(...rest);else if(P.rest==="top")me.deck.push(...rest);else me.deck.unshift(...rest);st.pending=null;if(P.after)P.after(st,P.pi,P.picked||[])}
    return st}
  if(a.t==="discard"){const P=st.players[st.pending.pi],x=P.hand.find(h=>h.uid===a.uid);P.hand=P.hand.filter(h=>h!==x);P.discard.push(x);log(st,`${P.name} discards ${x.card.full}.`);if(st.pending.pi!==st.active)fire(st,opp(st.pending.pi),"onOppDiscard",1);fire(st,st.pending.pi,"onSelfDiscard",x);if(--st.pending.n<=0||!P.hand.length)st.pending=null;return st}
  st._mode=a.mode??null;st._decline=!!a.decline;const pi=st.active,p=st.players[pi],o=st.players[opp(pi)];
  const F=a.uid!=null?find(st,a.uid):null,x=F&&F.inst;
  switch(a.t){
    case"ink":p.hand=p.hand.filter(c=>c!==x);p.discard=p.discard.filter(c=>c!==x);x.exerted=false;p.ink.push(x);p.inkN=(p.inkN||0)+1;p.inked=p.inkN>=1+(p.bonusInkT===st.turnNo?1:0)+p.play.filter(y=>y.card.extraInk&&(!y.card.extraInkCond||condOk(y,y.card.extraInkCond))).length;p.inkT=st.turnNo;if(st.players[opp(pi)].play.some(y=>y.card.oppInkExerted&&y.exerted))x.exerted=true;ev(st,{t:"ink",pi,uid:x.uid});log(st,`${p.name} inks ${x.card.full}.`);
      inkFire(st,pi);break;
    case"play":{
      const c=x.card;st._paid=null;p.hand=p.hand.filter(h=>h!==x);if(p.discard.includes(x)){p.discard=p.discard.filter(h=>h!==x);if(isChar(x))a={...a,fromGy:1}}ev(st,{t:"play",pi,uid:x.uid,name:c.full});
      if(c.type==="song"){p.songTurn=st.turnNo;fire(st,opp(pi),"onOppSong",x)}if(c.type==="action"||c.type==="song")p.actionsN=(p.actionsN||0)+1;
      st._singers=a.singers?a.singers.split(",").length:1;st._singerList=a.singers?a.singers.split(",").map(Number):a.singer!=null?[a.singer]:[];st._sung=a.singer!=null||!!a.singers;if(a.singer!=null||a.singers)fire(st,pi,"onAllySing",x);
      if(a.singer!=null){const s=find(st,a.singer).inst;s.exerted=true;log(st,`${s.card.name} sings ${c.name}.`);if(s.card.onSing.length)trig(st,pi,s.card.onSing,s)}
      else if(a.singers){a.singers.split(",").forEach(u=>find(st,+u).inst.exerted=true);log(st,`Characters sing ${c.name} together.`)}
      else if(a.shift!=null&&a.alt===2){}
      else if(a.shift!=null&&a.alt===3){gyBottom(st,pi,isChar,c.shiftGy)}
      else if(a.shift!=null&&a.alt){discPick(st,pi,c.shiftAlt.n,{test:z=>c.shiftAlt.test(z)&&z!==x,prompt:`Shift cost: discard ${c.shiftAlt.n>1?c.shiftAlt.n+" cards":"a card"}`});}
      else if(a.free){if(a.free===2&&c.freeAlt)c.freeAlt.pay(st,pi,x)}
      else if(a.shift!=null){const sc=shiftCost(st,pi,c,find(st,a.shift).inst);payInk(p,sc);st._paid=sc;if(p.disc&&p.disc.length)p.disc=p.disc.filter(d=>!(d.shift&&discMatch(d,c)))}else{const pc=costOf(st,pi,c);payInk(p,pc);st._paid=pc;if(p.disc&&p.disc.length)p.disc=p.disc.filter(d=>d.shift||!discMatch(d,c))}
      if(c.type==="action"||c.type==="song"){if(a.singer==null&&!a.singers)log(st,`${p.name} plays ${c.full}.`);p.play.forEach(y=>y.card.onActionPlayed.forEach(e=>{if(e.k==="selfStr")y.tStr+=e.n}));resolve(st,pi,c.onPlay,a.target,x,true);p.discard.push(x);yp(st,pi,x);
        if(a.singer!=null&&c.type==="song"){const sg=find(st,a.singer);if(sg&&sg.inst.card.replaySong&&st.winner==null){trig(st,pi,c.onPlay,x,true);p.discard.splice(p.discard.indexOf(x),1);p.deck.unshift(x);log(st,`${c.name} is sung again, then put on the bottom of the deck.`)}}break}
      x.playedOn=st.turnNo;reset(x);if(c.type==="character"){if(c.cls.includes("Hero"))p.heroT=st.turnNo;if(c.cost>=5)p.big5T=st.turnNo;if(c.cls.includes("Princess"))p.princessT=st.turnNo}if(c.type==="location"&&p.locDisc)p.locDisc=null;p.cardsN=p.cardsT===st.turnNo?(p.cardsN||0)+1:1;p.cardsT=st.turnNo;if(c.type==="character"){p.playedChars=p.playedTurn===st.turnNo?(p.playedChars||0)+1:1;p.playedTurn=st.turnNo}
      if(a.shift!=null){const b=find(st,a.shift).inst;const idx=p.play.indexOf(b);x.damage=b.damage;x.exerted=b.exerted;x.playedOn=b.playedOn;x.at=b.at;x.under=[...b.under,b];b.under=[];x.shiftedOn=st.turnNo;if(b.card.onShiftedOn)trig(st,pi,b.card.onShiftedOn,x);b.at=null;p.play[idx]=x;log(st,`${p.name} shifts ${c.full} onto ${b.card.name}.`)}
      else{p.play.push(x);if(c.entersExeIf&&c.entersExeIf(st,pi)||c.type==="item"&&st.players[opp(pi)].play.some(y=>y.card.oppItemsExerted)||(isChar(x)&&p.nextBG===st.turnNo&&(p.nextBG=-1,x.grants.push({kw:"bodyguard",until:"srcStart",src:pi}),true))||c.kw.rush&&st.players[opp(pi)].play.some(y=>y.card.rushExerted&&y.exerted)||c.entersExerted||a.exerted&&c.kw.bodyguard||a.fromGy&&p.play.some(y=>y.card.gyPlay))x.exerted=true;log(st,`${p.name} plays ${c.full}.`);if(c.enterDamage)damage(st,x,c.enterDamage)}
      resolve(st,pi,c.onPlay,a.target,x);yp(st,pi,x);if(st._paid!=null&&st._paid<=2){st._ctx=x;fire(st,pi,"onPaySmall",x)}if(c.type==="character")fire(st,opp(pi),"onOppPlayChar",x);break}
    case"quest":{x.exerted=true;p.questT=st.turnNo;if(x.card.onExertYT)trig(st,pi,x.card.onExertYT,x);if(x.card.actTax)payInk(p,1);const lv=loreOf(x);ev(st,{t:"quest",pi,uid:x.uid,n:lv});log(st,`${x.card.full} quests for ${lv} lore.`);if(p.willowT===st.turnNo)draw(st,pi,1);fire(st,opp(pi),"onOppQuest",x);
      if(x.card.kw.support){const others=p.play.filter(c=>isChar(c)&&c!==x);if(others.length){const bonus=strOf(x);const oPlay=st.players[opp(pi)].play.filter(y=>isChar(y)&&y.exerted);
        const supScore=t=>{let s=loreOf(t)*2+strOf(t);for(const d of oPlay){const base=d.damage+Math.max(0,strOf(t)+(K(t,"challenger")||0)-(K(d,"resist")||0));const withB=d.damage+Math.max(0,strOf(t)+bonus+(K(t,"challenger")||0)-(K(d,"resist")||0));
          if(withB>=wilOf(d)&&base<wilOf(d))s+=40+loreOf(d)*6;else if(withB>=wilOf(d))s+=8+loreOf(d)*2}return s};
        PKs(st,pi,(a.support!=null&&others.find(o=>o.uid===a.support))||others,(t)=>{t.tStr+=strOf(x);log(st,`Support: ${t.card.name} gets +${strOf(x)} strength.`);fire(st,pi,"onSupportChosen",t)},{ai:srt((a,b)=>supScore(b)-supScore(a)),prompt:"choose a card"});}}
      gain(st,pi,lv);if(p.questedT!==st.turnNo){p.questedT=st.turnNo;p.questedBy=x.uid}else p.questedBy=-1;for(const h of (p.hooks||[]))if(h.on==='quest'&&st.winner==null)trig(st,pi,h.eff,x);if(st.winner==null)for(const y of [...p.play])for(const h of y.card.onAllyQuest){if(y===x&&!h.cls)continue;if(h.cls&&!x.card.cls.some(k=>k.toLowerCase()===h.cls))continue;if(h.test&&!h.test(x,y,st))continue;if(h.once){if(y.onceT===st.turnNo)continue;y.onceT=st.turnNo}trig(st,pi,h.eff,y)}
      if(x.at!=null&&st.winner==null){const L=p.play.find(y=>y.uid===x.at);if(L&&L.card.onQuestHere){st._ctx=x;trig(st,pi,L.card.onQuestHere,L)}}
      if(st.winner==null){if(a.target!=null)resolve(st,pi,x.card.onQuest,a.target,x);else trig(st,pi,x.card.onQuest,x)}break}
    case"challenge":{const d=find(st,a.target).inst;x.exerted=true;if(x.olympusT===st.turnNo&&isChar(d)){x.olympusT=null;gain(st,pi,1)}st.chalTurn=st.turnNo;p.chalN=p.chalT===st.turnNo?(p.chalN||0)+1:1;p.chalT=st.turnNo;if(x.card.actTax)payInk(p,1);st._defender=a.target;d.chalT=st.turnNo;x._vs=d;for(const h of (p.hooks||[]))if(h.on==="challenge"&&(!h.test||h.test(x)))resolve(st,pi,h.eff,null,x);
      const as=chalStr(st,x)+(K(x,'challenger')||0)+x.tChal+(isLoc(d)&&p.locBonusT===st.turnNo?3:0),ds=isLoc(d)?0:chalStr(st,d);
      log(st,`${x.card.name} challenges ${d.card.name}.`);ev(st,{t:"challenge",pi,a:x.uid,d:d.uid});
      if(x.card.onChallenge.length)trig(st,pi,x.card.onChallenge,x);
      for(const y of p.play)if(y!==x&&y.card.onAllyChallenge.length)trig(st,pi,y.card.onAllyChallenge,y);
      st._challenger=x.uid;st._defender=a.target;st._chalSrc=pi;if(x.drawOnChalT===st.turnNo)draw(st,pi,1);
      for(const q of [0,1])fire(st,q,"onAnyChallenge",x);if(x.heroWorkT===st.turnNo&&isChar(d)){loseLore(st,st.players[opp(pi)],1);gain(st,pi,1)}fire(st,opp(pi),"onAllyChallenged",d);fire(st,opp(pi),"onOppChallenge",x);if(d.at!=null){const L=o.play.find(y=>y.uid===d.at);if(L&&L.card.onChallengedHere){st._ctx=d;trig(st,opp(pi),L.card.onChallengedHere,L)}}
      if(d.card.onChallenged.length)trig(st,opp(pi),d.card.onChallenged,d);
      if(st.winner!=null)break;const dIn=find(st,d.uid)?.zone==="play";d.defending=true;const ds2=isLoc(d)?0:chalStr(st,d);d.defending=false;const d0=d.damage;if(x.at!=null){const L=p.play.find(y=>y.uid===x.at);if(L&&L.card.onChalHere){st._ctx=x;trig(st,pi,L.card.onChalHere,L)}}
      damage(st,d,as);const dealt=find(st,d.uid)?.zone==="play"?d.damage-d0:Math.max(0,as-(K(d,'resist')||0));if(dealt>0&&x.card.onDealChal&&find(st,x.uid)?.zone==="play"){st._ctx=dealt;trig(st,pi,x.card.onDealChal,x)}
      if(!x.noChalDmg&&x.noChalDmgT!==st.turnNo)damage(st,x,ds2);x.noChalDmg=false;x._vs=null;if(x._readyAfter){x._readyAfter=false;if(find(st,x.uid)?.zone==="play")x.exerted=false}if(d._retAfterChal){d._retAfterChal=false;if(find(st,d.uid)?.zone==="play")retHand(st,d)}
      st._challenger=null;
      if(dIn&&find(st,d.uid)?.zone!=="play"&&isChar(d)){if(p.crownT===st.turnNo)gain(st,pi,2);fire(st,pi,"onAllyBanishOther",x);for(const q of [0,1])fire(st,q,"onAnyBanishOther",x);st.players[pi].chalBanishT=st.turnNo;p.oppChalBan=(p.oppChalBanT===st.turnNo?p.oppChalBan:0)+1;p.oppChalBanT=st.turnNo;if(x.at!=null){const L=p.play.find(y=>y.uid===x.at);if(L&&L.card.onBanishOtherHere){st._ctx=x;trig(st,pi,L.card.onBanishOtherHere,L)}}}
      if(dIn&&find(st,d.uid)?.zone!=="play"&&find(st,x.uid)?.zone==="play"&&x.card.onBanishOther.length)trig(st,pi,x.card.onBanishOther,x);break}
    case"move":{const l=find(st,a.loc).inst;payInk(p,moveCost(st,pi,x,l));doMove(st,pi,x,l);break}
    case"act":{const ab=actsOf(x)[a.i];if(ab.cost)ab.cost(st,pi,x);if(ab.once)x.onceA=st.turnNo;if(!ab.noExert)x.exerted=true;payInk(p,ab.ink);log(st,`${x.card.name} uses an ability.`);resolve(st,pi,ab.eff,a.target,x);if(ab.sac)banish(st,x);break}
    case"boost":payInk(p,x.card.kw.boost);x.under.push(p.deck.pop());x.underT=st.turnNo;fire(st,pi,"onBoostAny",x);p.boosted.add(x.uid);log(st,`${x.card.name} boosts (card put under it).`);
      for(const y of [...p.play])if(y.card.onUnder.length)trig(st,pi,y.card.onUnder,y);break;
    case"end":log(st,`${p.name} ends their turn.`);endTurn(st);break;
  }
  st._mode=null;st._decline=false;
  if(a.t!=="end"&&a.t!=="discard"&&a.t!=="ask"&&a.t!=="askDone"){const S2=(st.stats=st.stats||[{},{}])[pi];S2[a.t]=(S2[a.t]||0)+1}
  return st;
}
function autoTarget(st,pi,effs){if(effs&&effs.some(e=>e.t&&e.t.other)){}const nt=needsTarget(effs||[]);if(!nt)return null;const ts=targets(st,pi,nt.t);if(!ts.length)return null;
  const good=nt.t.helpful;return ts.map(u=>find(st,u)).sort/*nc:autoTarget is AI-only; humans go through trig()*/((a,b)=>((good?(b.pi===pi):(b.pi!==pi))-(good?(a.pi===pi):(a.pi!==pi)))||b.inst.card.cost-a.inst.card.cost)[0].inst.uid}

/* ---------- AI ---------- */
function instVal(x){return x.card.cost*2+x.card.lore*4+strOf(x)}
function effVal(st,pi,effs,tgt){
  let v=0;const T=tgt!=null?find(st,tgt):null;
  for(const e of effs||[]){
    const mine=T&&T.pi===pi,x=T&&T.inst;
    switch(e.k){
      case"draw":v+=e.n*4;break;case"drawAll":v+=1;break;case"gainLore":v+=e.n*6;break;case"oppLose":v+=e.n*5;break;
      case"dmgAllOpp":v+=st.players[opp(pi)].play.filter(isChar).length*e.n*2;break;
      case"dmg":if(x)v+=mine?-20:(x.damage+Math.max(0,e.n-(K(x,'resist')||0))>=wilOf(x)?instVal(x):e.n);break;
      case"banish":case"bounce":if(x)v+=mine?-30:instVal(x)*(e.k==="bounce"?0.7:1);break;
      case"exert":if(x)v+=mine?-5:x.exerted?0:x.card.lore*3;break;
      case"heal":if(x)v+=mine?Math.min(x.damage,e.n)*2:-3;break;
      case"healAll":v+=st.players[pi].play.reduce((s,c)=>s+Math.min(c.damage,e.n),0);break;
      case"buffStr":if(x)v+=mine?1:-2;break;
      case"self":case"self2":case"readySelf":case"healSelf":case"grantSelf":v+=2;break;
      case"grant":if(x)v+=e.t.helpful?(mine?2:-2):(mine?-3:2);break;
      case"noNext":case"noReady":if(x)v+=mine?-3:3;break;
      case"ramp":v+=4;break;case"discCost":v+=effVal(st,pi,e.eff,tgt)-4;break;case"gyHate":v+=0.5;break;case"grantMulti":if(x)v+=(e.t.helpful?(mine?2:-2):(mine?-3:2))*e.kws.length+(mine?e.lore*5:0);break;case"fn":v+=typeof e.v==="function"?e.v(st,pi,x,mine):(e.v??2);break;case"multi":v+=e.n*effVal(st,pi,[e.inner],null)+e.n*3;break;case"tutor":v+=4;break;case"nameReveal":v+=1;break;case"wheel":v+=(7-st.players[pi].hand.length)*2;break;case"toInk":if(x)v+=mine?-6:instVal(x)*0.9;break;case"moveDmg":v+=e.n*2;break;case"shuffleIn":if(x)v+=mine?-10:instVal(x);break;
      case"reveal":v+=2;break;case"free":v+=8;break;case"freeMove":v+=1;break;case"drain":v+=e.g*6+e.lo*5;break;case"massState":v+=e.to==="exert"&&e.who==="opposing"?6:e.to==="ready"?4:0;break;
      case"massReady":v+=4;break;case"discardHand":v-=st.players[pi].hand.length*3;break;case"selfDiscard":v-=3*e.n;break;case"mill":v-=0.5;break;case"pay":v+=effVal(st,pi,e.eff,null)-e.n*1.5;break;
      case"banishAllX":v+=(e.what.startsWith("opposing")?8:0);break;case"discardToInk":case"handToInk":v+=3;break;case"banishChallenger":v+=5;break;case"teamBuff":v+=e.stat==="lore"?4:2;break;case"teamGrant":v+=2;break;case"readyItem":v+=1;break;case"underToHand":v+=3;break;case"returnSelf":case"inkSelf":v+=3;break;case"discount":v+=1;break;case"rampAll":v+=1;break;
      case"banishAll":v+=st.players[opp(pi)].play.filter(isChar).reduce((a,c)=>a+instVal(c),0)-st.players[pi].play.filter(isChar).reduce((a,c)=>a+instVal(c),0);break;case"team":v+=st.players[pi].play.length*e.n;break;case"oppExert":v+=3;break;case"oppBanish":v+=8;break;
      case"recur":v+=4;break;case"payDraw":v+=2;break;case"oppDiscard":v+=3*e.n;break;case"loot":v+=2*e.n;break;case"dig":v+=3;break;
      case"debuff":if(x)v+=mine?-3:2;break;case"buffLore":case"buffChal":if(x)v+=mine?3:-3;break;
      case"banishSelf":v-=8;break;case"dmgSelf":v-=2;break;
      case"cond":v+=effVal(st,pi,e.eff,null)/2;break;case"modal":v+=Math.max(...e.opts.map(o=>effVal(st,pi,o,null)));break;case"ready":if(x)v+=mine&&x.exerted?x.card.lore*3:0;break;
    }
  }
  return v;
}
function locBenefit(l){ // how valuable is this location to park a character on
  let v=l.card.lore*4+(l.card.onStart.length?8:0)+(l.card.onEnd.length?4:0)+(l.card.acts.length?5:0);
  for(const s of l.card.statics){if(s.here){if(s.stat==="lore")v+=s.n*10;else if(s.stat==="wil")v+=s.n*3;else if(s.stat==="str")v+=s.n*2;else if(s.kw)v+=6;else if(s.block==="challenged")v+=12;else if(s.grantAct)v+=5;else v+=2}
    else if(s.stat==="lore")v+=s.n*6+(typeof s.count==="function"?4:0)}
  if((l.card.auras||[]).length)v+=4;if(l.card.text&&!l.card.statics.length&&!l.card.onStart.length)v+=3;
  return v}
function locPlayValue(c){let v=c.lore*6+c.wil*0.5+(c.onStart.length?10:0)+(c.onEnd.length?4:0)+(c.acts.length?6:0);
  for(const s of c.statics){if(s.here){if(s.stat==="lore")v+=s.n*8;else if(s.block==="challenged")v+=10;else if(s.kw)v+=5;else v+=2}else if(s.stat==="lore")v+=s.n*5}
  if((c.auras||[]).length)v+=5;return v}
function scoreAction(st,a){
  const pi=st.active,p=st.players[pi],o=st.players[opp(pi)],F=a.uid!=null?find(st,a.uid):null,x=F&&F.inst;
  switch(a.t){
    case"ink":{const c=x.card,ink=p.ink.length,ready=inkAvail(p);if(ink>=8&&p.hand.length<4)return -1;
      const dup=p.hand.filter(h=>h.card.name===c.name).length>1?8:0;
      const onlyPlay=c.cost===ink+1&&!p.hand.some(h=>h.uid!==x.uid&&h.card.cost<=ink+1&&h.card.type==="character");
      let s=200-c.lore*3-(c.cost<=ink+1?c.cost*2:0)+dup+(c.cost>ink+3?10:0);
      if(onlyPlay&&p.lore+3<o.lore&&c.type==="character"&&c.lore>=2)s-=20;if(ink<3&&c.cost>=5)s+=10;
      // Don't ink win-cons: high lore, Shift-with-base, Bodyguard/Ward when board needs them
      if(c.type==="character"){const H=LEVEL==="hard";
        if(c.lore>=3)s-=(H?28:14);else if(c.lore>=2)s-=(H?18:8);
        if(c.kw.shift!=null&&p.play.some(y=>isChar(y)&&(namesOf(y).includes(c.name.toLowerCase())||(c.alias||[]).some(a=>namesOf(y).includes(a)))))s-=(H?32:16);
        if(c.kw.bodyguard&&o.play.some(y=>isChar(y)&&strOf(y)>=3))s-=(H?16:6);
        if(c.kw.ward)s-=(H?10:4);
        // Prefer inking 0–1 lore junk when other inkables exist
        const junk=p.hand.filter(h=>h.uid!==x.uid&&h.card.inkable&&(h.card.lore||0)<=1&&h.card.type==="character");
        if(c.lore>=2&&junk.length)s-=(H?22:10)}
      // Hold ink for songs: don't ink a song/action we can sing or pay for this turn with positive value
      if(c.type==="song"||c.type==="action"){const ev=effVal(st,pi,c.onPlay,null);if(ev>0){
        const canSing=c.type==="song"&&p.play.some(y=>isChar(y)&&!y.exerted&&dry(st,y)&&!blocked(y,"sing")&&singVal(y)>=c.cost);
        const canPay=costOf(st,pi,c)<=ready;if(canSing||canPay)s-=35+Math.min(20,ev)}}
      // Prefer inking junk over keeping a dead song we cannot cast soon
      if((c.type==="song"||c.type==="action")&&effVal(st,pi,c.onPlay,null)<=0)s+=12;
      return s}
    case"play":{const c=x.card,effs=a.mode!=null?c.onPlay.find(e=>e.k==="modal").opts[a.mode]:c.onPlay;
      let exertBonus=0;if(a.exerted&&c.kw.bodyguard){const H=LEVEL==="hard";const others=p.play.filter(y=>isChar(y)&&loreOf(y)>=2).length;const threats=o.play.filter(y=>isChar(y)&&!y.exerted&&strOf(y)>=2).length;
        exertBonus=others||threats?(H?18:6)+others*4+threats*3:-8}else if(a.exerted)exertBonus=p.play.some(y=>isChar(y)&&loreOf(y)>=2)?3:-6;
      let s=100+c.cost*4+effVal(st,pi,effs,a.target)+exertBonus-(a.decline?3:0);
      if(c.type==="character")s+=c.lore*3;if(c.type==="location"){s+=locPlayValue(c)+(LEVEL==="hard"?10:LEVEL==="normal"?4:0)+(PERS==="control"?8:0);if(p.play.some(isChar)&&!p.play.some(isLoc))s+=8}
      if(c.type==="item"){const H=LEVEL==="hard";s+=(H?6:2)+(p.ink.length<=3?(H?10:4):0)+(p.hand.length<=3?(H?6:2):0)+(PERS==="control"?6:0);
        if(!p.play.some(isItem))s+=(H?5:2)}
      // Shift vs play: prefer Shift when lore rises, base is dry (can quest), or ink-tight; prefer full play when board is thin
      if(a.shift!=null){const base=find(st,a.shift)?.inst;const loreGain=c.lore-(base?loreOf(base):0);const sc=base?shiftCost(st,pi,c,base):c.cost;const H=LEVEL==="hard";
        s+=14+loreGain*8+(base&&base.damage?5:0)+(H?10:2);
        if(base&&dry(st,base)&&!base.exerted&&c.lore>0)s+=(H?14:4); // keep dry → quest after Shift
        if(sc+2<=costOf(st,pi,c))s+=(H?10:3); // ink saved for other plays
        if(p.play.filter(isChar).length<=1)s-=6; // need bodies: full play may be better elsewhere
        // Prefer this Shift over full-cost play of same card when both legal
        if(loreGain>=0&&legalActions(st).some(b=>b.t==="play"&&b.uid===a.uid&&b.shift==null))s+=(H?12:4)}
      else if(c.type==="character"&&c.kw.shift!=null&&legalActions(st).some(b=>b.t==="play"&&b.uid===a.uid&&b.shift!=null)){
        s-=(LEVEL==="hard"?20:8)} // full-cost when Shift exists: usually worse
      if(PERS==="control"&&c.type!=="character")s+=10;if(PERS==="aggro"&&c.type==="character")s+=c.str;
      if(a.singer!=null){const sg=find(st,a.singer).inst;const sl=loreOf(sg);const H=LEVEL==="hard";
        s+=c.cost*2-sl*5+(H?12:4); // prefer sing over pay; burn low-lore singers
        if(sl<=1)s+=(H?10:3);if(CTX.lethal){const qs=legalActions(st).filter(b=>b.t==="quest").map(b=>find(st,b.uid).inst);
          const without=p.lore+qs.filter(q=>q.uid!==sg.uid).reduce((t,q)=>t+loreOf(q),0);
          if(without<20&&p.lore+qs.reduce((t,q)=>t+loreOf(q),0)>=20)s-=80} // don't sing away lethal
        if(CTX.threat&&effVal(st,pi,c.onPlay,a.target)>=6)s+=(H?14:6)} // sing removal/draw when threatened
      if(a.singers){const ids=String(a.singers).split(",").map(Number);const H=LEVEL==="hard";
        const loreBurn=ids.reduce((t,u)=>{const f=find(st,u);return t+(f?loreOf(f.inst):0)},0);
        const singSum=ids.reduce((t,u)=>{const f=find(st,u);return t+(f?singVal(f.inst):0)},0);
        s+=c.cost*2-loreBurn*(H?5:3)-(ids.length-2)*(H?4:2)+(singSum>c.singTogether?(H?-3:0):0)+(H?12:2);
        // Prefer this set over higher-lore alternatives of the same song
        const alts=legalActions(st).filter(b=>b.t==="play"&&b.uid===a.uid&&b.singers&&b.singers!==a.singers);
        for(const b of alts){const oids=String(b.singers).split(",").map(Number);
          const ol=oids.reduce((t,u)=>{const f=find(st,u);return t+(f?loreOf(f.inst):0)},0);
          if(ol<loreBurn){s-=(H?6:2);break}if(ol>loreBurn&&oids.length<=ids.length)s+=(H?5:2)}
        if(CTX.lethal){const qs=legalActions(st).filter(b=>b.t==="quest");const qset=new Set(qs.map(b=>b.uid));
          const burnLore=ids.filter(u=>qset.has(u)).reduce((t,u)=>t+loreOf(find(st,u).inst),0);
          if(burnLore&&p.lore+qs.reduce((t,b)=>t+loreOf(find(st,b.uid).inst),0)-burnLore<20&&p.lore+qs.reduce((t,b)=>t+loreOf(find(st,b.uid).inst),0)>=20)s-=80}}
      if((c.type==="song"||c.type==="action")&&!a.singer&&!a.singers){ // paying ink: hold for better songs, boost strong songs
        const ev=effVal(st,pi,c.onPlay,a.target);if(ev>=8)s+=10+(CTX.threat?8:0);
        const ready=inkAvail(p),need=costOf(st,pi,c);if(need>=ready&&ready>0&&ev>0)s+=6; // spend last ink on a good song
        // Prefer paying only when no singer; otherwise singing scored above
        if(c.type==="song"&&legalActions(st).some(b=>b.t==="play"&&b.uid===a.uid&&(b.singer!=null||b.singers)))s-=20}
      if((c.type==="action"||c.type==="song")&&effVal(st,pi,c.onPlay,a.target)<=0)s=-1;
      return s}
    case"act":{const ab=actsOf(x)[a.i],v=effVal(st,pi,ab.eff,a.target);if(v<=0)return -1;
      let s=60+v-(isChar(x)?loreOf(x)*4:0)-ab.ink;const H=LEVEL==="hard";
      // Don't burn a lethal / race quester on a weak ability
      if(isChar(x)&&!x.exerted&&dry(st,x)&&loreOf(x)>0){
        if(CTX.lethal)s-=90;
        if(!CTX.threat&&p.lore>=o.lore&&loreOf(x)>=2&&v<10)s-=(H?22:8);
        if(CTX.threat&&v<8)s-=(H?12:4)}
      if(H&&v>=12)s+=8;return s}
    case"challenge":{const d=find(st,a.target).inst,as=strOf(x)+(K(x,'challenger')||0);
      const kills=d.damage+Math.max(0,as-(K(d,'resist')||0))>=wilOf(d),dies=!isLoc(d)&&x.damage+Math.max(0,strOf(d)-(K(x,'resist')||0))>=wilOf(x);
      // Value: removing a defender (plus its lore threat, more when the opponent is close to 20), or chip damage;
      // minus our attacker if it dies and the lore we give up by not questing.
      const dl=isLoc(d)?d.card.lore:loreOf(d),race=o.lore>=14?dl*6:0;
      let v=(kills?instVal(d)+dl*5+race+(isLoc(d)?d.card.lore*3:0):(dies?0:Math.min(as,wilOf(d)-d.damage)*0.8+(d.damage+as>=wilOf(d)-2?dl:0)))-(dies?instVal(x)*0.9:0)-(K(x,'reckless')?0:loreOf(x)*3);
      if(kills&&!dies)v+=(LEVEL==="hard"?12:5); // clean kill (Hard weights more)
      if(kills&&dies){const ivd=instVal(d),ivx=instVal(x);if(ivd>ivx*1.1)v+=(LEVEL==="hard"?10:4);else if(ivd<ivx*0.85)v-=(LEVEL==="hard"?16:8)}
      // Ward: challenge is often the only removal — value clean kills more
      if(kills&&K(d,"ward"))v+=(LEVEL==="hard"?16:6)+(dl>=2?6:0);
      // Bodyguard: clearing the wall opens high-lore behind it
      if(kills&&K(d,"bodyguard")){const behind=o.play.filter(y=>isChar(y)&&y.uid!==d.uid&&loreOf(y)>=2).length;v+=(LEVEL==="hard"?8:3)+behind*4}
      // Multi-challenger: prefer lowest-lore clean killer (Hard searches alts; Normal light bias)
      if(kills&&!dies&&!K(x,'reckless')&&(LEVEL==="hard"||LEVEL==="normal")){const alts=legalActions(st).filter(b=>b.t==="challenge"&&b.target===a.target&&b.uid!==a.uid);
        const mul=LEVEL==="hard"?5:2;
        for(const b of alts){const ox=find(st,b.uid)?.inst;if(!ox)continue;
          const oas=strOf(ox)+(K(ox,"challenger")||0);const ok=d.damage+Math.max(0,oas-(K(d,"resist")||0))>=wilOf(d);
          const od=!isLoc(d)&&ox.damage+Math.max(0,strOf(d)-(K(ox,"resist")||0))>=wilOf(ox);
          if(ok&&!od){if(loreOf(ox)<loreOf(x))v-=(loreOf(x)-loreOf(ox))*mul;if(LEVEL==="hard"&&instVal(ox)+2<instVal(x))v-=6}}}
      if(CTX.lethal&&!K(x,'reckless')&&!isLoc(d))return -1; // we win by questing this turn: don't exert questers to fight
      if(CTX.threat&&kills&&dl>0)v+=40+dl*10; // they can reach 20 next turn: remove their questers
      // Lore race: when clearly ahead, avoid bad or even trades that spend high-lore attackers
      if(!CTX.threat&&p.lore>=o.lore+3&&!K(x,'reckless')){
        if(dies&&!kills)v-=(LEVEL==="hard"?30:12);
        if(dies&&kills&&loreOf(x)>=2)v-=(LEVEL==="hard"?14:5);
        if(!kills&&loreOf(x)>=2)v-=(LEVEL==="hard"?18:6);
        if(kills&&!dies&&dl<=1&&loreOf(x)>=2&&p.lore>=16)v-=(LEVEL==="hard"?10:3)}
      // When behind / close race, prefer removing their lore over chipping low-lore
      if((p.lore+2<=o.lore||o.lore>=14)&&kills&&dl>=2)v+=(LEVEL==="hard"?12:4);
      // Rush: value using the free challenge the turn played on clean kills
      if(K(x,"rush")&&!dry(st,x)&&kills)v+=(LEVEL==="hard"?14:5)+(dies?0:6)+(dl>=2?6:0);
      if(PERS==="aggro")v+=15;else if(PERS==="control")v+=6;else if(PERS==="quester")v-=10;
      if(K(x,'reckless'))v+=50;return v>0?70+v:(K(x,'reckless')?10+v/100:-1)}
    case"quest":{let qs=50+loreOf(x)*6+(p.lore+loreOf(x)>=20?500:0)+(CTX.lethal?900:0)+(PERS==="quester"?12:PERS==="aggro"?-5:0);
      // Race: push lore when ahead or when we can outpace without threat removal
      if(!CTX.threat&&p.lore>=o.lore)qs+=(LEVEL==="hard"?10:3)+(loreOf(x)>=2?(LEVEL==="hard"?6:2):0);
      if(!CTX.threat&&p.lore+loreOf(x)>=o.lore+4)qs+=(LEVEL==="hard"?8:2);
      // Bodyguard wall: if already exerted it protects; if ready and we have other questers + threats, prefer keeping it ready to enter-exert... actually Bodyguard protects when EXERTED. So questing (exerting) a Bodyguard HELPS protection. Prefer questing BG when threats exist.
      if(K(x,"bodyguard")&&o.play.some(y=>isChar(y)&&!y.exerted&&strOf(y)>=2))qs+=(LEVEL==="hard"?8:2);
      // Prefer questing low-str Bodyguard over high-lore when both available? skip
      return qs}
    case"move":{if(!LEVEL||LEVEL==="easy")return -1;const l=find(st,a.loc).inst,mc=moveCost(st,pi,x,l),ben=locBenefit(l);
      // Prefer parking high-lore / fragile characters on protective or lore-buffing locations.
      const loreHere=l.card.statics.some(z=>z.here&&z.stat==="lore");
      const protect=l.card.statics.some(z=>z.here&&z.block==="challenged");
      const empty=!hereChars(st,l).length;const H=LEVEL==="hard";
      let s=ben+(loreOf(x)>=2?8:0)+(wilOf(x)<=4?5:0)-mc*3+(H?12:LEVEL==="normal"?3:0);
      if(loreHere)s+=(H?12:4)+(p.lore+2<=o.lore?(H?10:3):0)+(loreOf(x)>=2?(H?8:2):0); // race onto lore buffs
      if(protect&&(wilOf(x)<=5||x.damage))s+=(H?10:3);
      if(empty&&ben>=12)s+=(H?8:2); // claim valuable empty location
      if(x.at!=null){const cur=find(st,x.at);const curB=cur?locBenefit(cur.inst):0;if(ben<=curB+2)return -1;s-=4} // switching only when clearly better
      if(PERS==="control")s+=4;if(PERS==="quester"&&loreHere)s+=10;
      return s>0?16+s:-1}case"boost":return x.card.statics.some(s=>s.cond==="under")||x.card.onQuest.length?45:-1;
    case"end":return 0;
  }
  return -1;
}
let LEVEL="normal";
function cloneState(st){const cp=x=>({...x,under:[...x.under],grants:[...(x.grants||[])]});
  return{...st,_sim:true,pq:[...(st.pq||[])],r:rng((st.seed+st.turnNo*7919+(st.log.length))>>>0),log:[],events:[],stats:[{},{}],pending:st.pending?{...st.pending}:null,mull:[...st.mull],
    players:st.players.map(p=>({...p,deck:p.deck.map(cp),hand:p.hand.map(cp),ink:p.ink.map(cp),play:p.play.map(cp),discard:p.discard.map(cp),disc:[...(p.disc||[])],boosted:new Set(p.boosted||[])}))}}
function evalBoard(st,pi){
  if(st.winner!=null)return st.winner===pi?1e6:-1e6;
  const me=st.players[pi],op=st.players[opp(pi)],PW=PERS==='quester'?{lo:18,ob:0.8,h:2}:PERS==='aggro'?{lo:9,ob:1.5,h:1.5}:PERS==='control'?{lo:10,ob:1.3,h:3.5}:{lo:12,ob:1,h:2};let v=(me.lore-op.lore)*PW.lo+Math.min(me.ink.length,8)*3+me.hand.length*PW.h-op.hand.length*1.5;
  const opChars=op.play.filter(isChar);
  for(const x of me.play){if(!isChar(x)){v+=x.card.cost*1.5+(isLoc(x)?locPlayValue(x.card)+(hereChars(st,x).length?4:0):0);continue}
    let val=instVal(x)*(1-x.damage/Math.max(1,wilOf(x))*0.4);
    if(x.exerted&&opChars.some(o=>strOf(o)+(K(o,"challenger")||0)>=wilOf(x)-x.damage&&(!K(x,"evasive")||K(o,"evasive"))))val*=0.45; // exposed to a lethal challenge
    v+=val+loreOf(x)*3+(x.at!=null?3:0)}
  for(const x of op.play){if(!isChar(x)){v-=x.card.cost*1.5+(isLoc(x)?x.card.lore*6:0);continue}v-=(instVal(x)*(1-x.damage/Math.max(1,wilOf(x))*0.4)+loreOf(x)*5)*PW.ob}
  if(op.lore+opChars.reduce((a,x)=>a+loreOf(x),0)>=20)v-=400; // they threaten to win next turn
  return v}
function hardChoose(st,A,topK){const L0=LEVEL;if(topK&&A.length>topK){const sc=A.map(a=>[a,scoreAction(st,a)]).sort((x,y)=>y[1]-x[1])/*nc:ai-order*/;A=sc.slice(0,topK).map(x=>x[0]);if(!A.some(a=>a.t==="end")){const e=sc.find(x=>x[0].t==="end");if(e)A.push(e[0])}}const pi=st.active,op=st.players[opp(pi)],base=evalBoard(st,pi);let best=null,bs=-Infinity;
  // Rollout: take the candidate, finish our turn greedily, let the opponent play one greedy turn, then evaluate.
  const greedy=sim=>{const B=legalActions(sim);let b=null,bv=-Infinity;for(const x of B){const sc=scoreAction(sim,x);if(sc>bv){bv=sc;b=x}}if(bv<0&&B.some(x=>x.t==="end"))return{t:"end"};return b};
  const roll=sim=>{let n=0;while(sim.winner==null&&sim.active===pi&&n++<60){const x=greedy(sim);if(!x)break;act(sim,x)}n=0;while(sim.winner==null&&sim.active!==pi&&n++<60){const x=greedy(sim);if(!x)break;act(sim,x)}
    if(HDEEP){n=0;while(sim.winner==null&&sim.active===pi&&n++<60){const x=greedy(sim);if(!x)break;act(sim,x)}}};
  for(const a of A){let v;try{const sim=cloneState(st);LEVEL="normal";act(sim,a);roll(sim);LEVEL=L0;v=evalBoard(sim,pi);if(sim.players[pi].lore>sim.players[opp(pi)].lore)v+=6;if(CTX.threat&&sim.players[opp(pi)].lore<op.lore)v+=10;if(HDEEP&&CTX.lethal&&a.t==="quest")v+=100;if(HDEEP&&CTX.threat&&a.t==="challenge")v+=25;
    if(HDEEP&&a.t==="challenge"){const d=find(st,a.target)?.inst,at=find(st,a.uid)?.inst;if(d&&at&&isChar(d)){const kills=d.damage+Math.max(0,strOf(at)+(K(at,"challenger")||0)-(K(d,"resist")||0))>=wilOf(d);const live=at.damage+Math.max(0,strOf(d)-(K(at,"resist")||0))<wilOf(at);if(kills&&live)v+=18;else if(kills)v+=6}}
    if(HDEEP&&a.t==="play"&&(a.singer!=null||a.singers)){v+=14;if(a.singer!=null){const sg=find(st,a.singer)?.inst;if(sg&&loreOf(sg)<=1)v+=8}
      if(a.singers){const ids=String(a.singers).split(",").map(Number);const lb=ids.reduce((t,u)=>{const f=find(st,u);return t+(f?loreOf(f.inst):0)},0);v+=Math.max(0,6-lb)}}
    if(HDEEP&&a.t==="play"&&a.shift!=null){const base=find(st,a.shift)?.inst;if(base&&dry(st,base)&&!base.exerted)v+=16;const c=find(st,a.uid)?.inst?.card;if(c&&base&&c.lore>loreOf(base))v+=10}
    if(HDEEP&&a.t==="move"){const l=find(st,a.loc)?.inst;if(l&&l.card.statics.some(z=>z.here&&z.stat==="lore"))v+=14;if(l&&!hereChars(st,l).length&&locBenefit(l)>=12)v+=6}
    if(HDEEP&&a.t==="ink"){const c=find(st,a.uid)?.inst?.card;if(c&&c.type==="character"&&c.lore>=2)v-=12;if(c&&c.kw&&c.kw.shift!=null)v-=8}
    if(HDEEP&&a.t==="challenge"){const d=find(st,a.target)?.inst;if(d&&K(d,"ward"))v+=10;if(d&&K(d,"bodyguard"))v+=6}}catch(e){v=-Infinity}LEVEL=L0;CUR=st;
    try{v+=Math.max(0,scoreAction(st,a)+(HDEEP?hardAdj(st,a,0):0))/35}catch(e){};if(v>bs){bs=v;best=a}}
  LEVEL=L0;CUR=st;return best}
let PERS=null,CTX={},HDEEP=false,LITE_OFF=false;
// Turn context for the heuristics: can we win by questing now (lethal), can the opponent reach 20 on their next turn (threat)?
function aiCtx(st){const pi=st.active,p=st.players[pi],o=st.players[opp(pi)];
  const qs=legalActions(st).filter(a=>a.t==="quest").map(a=>find(st,a.uid).inst);const mine=p.lore+qs.reduce((t,x)=>t+loreOf(x),0);
  const theirs=o.lore+o.play.filter(isChar).reduce((t,x)=>t+loreOf(x),0)+o.play.filter(isLoc).reduce((t,x)=>t+(x.card.lore||0),0);
  return{lethal:mine>=20&&qs.length>0,threat:theirs>=20}}
// One-ply lookahead: apply each candidate to a copy, finish pending choices greedily, score the board.
function plyChoose(st,A,lv){const pi=st.active;let best=null,bs=-Infinity;const L0=LEVEL;
  for(const a of A){const h=scoreAction(st,a);if(h<0&&a.t!=="end")continue;let v;
    try{const sim=cloneState(st);LEVEL="normal";act(sim,a);let n=0;while(sim.pending&&sim.winner==null&&n++<20){const B=legalActions(sim);let b=null,bv=-Infinity;for(const x of B){const sc=scoreAction(sim,x);if(sc>bv){bv=sc;b=x}}if(!b)break;act(sim,b)}
      v=evalBoard(sim,pi)+(a.t==="end"?0:Math.max(0,h)/25)}catch(e){v=-Infinity}
    LEVEL=L0;CUR=st;if(v>bs){bs=v;best=a}}
  return best}
function aiChoose(st,level){
  level=level||"normal";const ci=level.indexOf(":");PERS=ci>0?level.slice(ci+1):null;if(ci>0)level=level.slice(0,ci);
  LEVEL=level;CTX=st.pending||LEVEL==="easy"?{}:aiCtx(st);LEVEL=level;const A=legalActions(st);if(!A.length)return null;let best=null,bs=-Infinity;
  // Hard: rollout every candidate through the opponent's reply and our next turn. Normal: same lookahead on the
  // 4 best heuristic candidates, one opponent turn deep. Easy: noisy heuristic only.
  if((LEVEL==="hard"||LEVEL==="hard2")&&!st.pending){HDEEP=true;try{const b=hardChoose(st,A);if(b)return b}finally{HDEEP=false;LEVEL="hard"}}
  if((LEVEL==="normal"||LEVEL==="lite")&&!st.pending&&!LITE_OFF){const b=hardChoose(st,A,2);LEVEL="normal";if(b)return b}
  if(LEVEL==="ply"&&!st.pending){const b=plyChoose(st,A);if(b)return b;LEVEL="normal"}
  const noise=LEVEL==="easy"?90:LEVEL==="normal"?16:0,r=st.r||Math.random;
  for(const a of A){let s=scoreAction(st,a);if(LEVEL==="hard")s+=hardAdj(st,a,s);
    if(LEVEL==="easy"&&(a.t==="challenge"&&r()<0.35||a.t==="ink"&&r()<0.3))s=-1;if(s>=0&&noise)s+=r()*noise;if(s>bs){bs=s;best=a}}
  if(bs<0&&A.some(a=>a.t==="end"))return{t:"end"};
  return best;
}
function hardAdj(st,a,s){ // lore race awareness: race when ahead, remove questers when behind/threat
  const pi=st.active,me=st.players[pi],op=st.players[opp(pi)];if(s<0)return 0;
  if(a.t==="quest"&&CTX.lethal)return 48;
  if(a.t==="quest"&&me.lore>=op.lore){const ch=find(st,a.uid)?.inst;return 16+(ch&&loreOf(ch)>=2?6:0)+(me.lore>=op.lore+3?8:0)}
  if(a.t==="quest"){const ch=find(st,a.uid)?.inst;if(ch&&K(ch,"bodyguard")&&op.play.some(y=>isChar(y)&&!y.exerted&&strOf(y)>=2))return 8}
  if(a.t==="challenge"&&!CTX.threat&&me.lore>=op.lore+3){const at=find(st,a.uid)?.inst,d=find(st,a.target)?.inst;
    if(at&&d&&isChar(d)&&loreOf(at)>=2){const kills=d.damage+Math.max(0,strOf(at)+(K(at,"challenger")||0)-(K(d,"resist")||0))>=wilOf(d);
      const dies=at.damage+Math.max(0,strOf(d)-(K(at,"resist")||0))>=wilOf(at);
      if(dies||!kills)return -16}}
  if(a.t==="challenge"){const d=find(st,a.target)?.inst,at=find(st,a.uid)?.inst;
    if(d&&isChar(d)){let b=0;if(at){const kills=d.damage+Math.max(0,strOf(at)+(K(at,"challenger")||0)-(K(d,"resist")||0))>=wilOf(d);const live=at.damage+Math.max(0,strOf(d)-(K(at,"resist")||0))<wilOf(at);
      if(kills&&live){b+=24; // clean kill
        // multi-challenger: extra if we are the lowest-lore clean killer
        const alts=legalActions(st).filter(x=>x.t==="challenge"&&x.target===a.target&&x.uid!==a.uid);
        let lower=false;for(const x of alts){const ox=find(st,x.uid)?.inst;if(!ox)continue;
          const oas=strOf(ox)+(K(ox,"challenger")||0);const ok=d.damage+Math.max(0,oas-(K(d,"resist")||0))>=wilOf(d);
          const od=ox.damage+Math.max(0,strOf(d)-(K(ox,"resist")||0))>=wilOf(ox);
          if(ok&&!od&&loreOf(ox)<loreOf(at)){lower=true;break}}
        if(lower)b-=10;else b+=4}
      else if(kills&&!live){const ivd=instVal(d),ivx=instVal(at);b+=ivd>ivx?10:ivd<ivx*0.8?-8:2}}
      if(op.lore>=8||loreOf(d)>=2||CTX.threat)b+=loreOf(d)*5+(op.lore>=12?8:0)+(CTX.threat?18:0);
      if(K(d,"ward")&&at&&d.damage+Math.max(0,strOf(at)+(K(at,"challenger")||0)-(K(d,"resist")||0))>=wilOf(d))b+=14;
      if(K(d,"bodyguard")&&at&&d.damage+Math.max(0,strOf(at)+(K(at,"challenger")||0)-(K(d,"resist")||0))>=wilOf(d))b+=8;
      return b}}
  if(a.t==="ink"){const c=find(st,a.uid)?.inst?.card;if(!c)return 0;
    if((c.type==="song"||c.type==="action")&&effVal(st,pi,c.onPlay,null)>4){
      const canSing=c.type==="song"&&me.play.some(y=>isChar(y)&&!y.exerted&&dry(st,y)&&!blocked(y,"sing")&&singVal(y)>=c.cost);
      if(canSing||costOf(st,pi,c)<=inkAvail(me))return -22} // hold: play/sing it instead
    if(c.type==="character"){if(c.lore>=3)return -24;if(c.lore>=2)return -14;
      if(c.kw.shift!=null&&me.play.some(y=>isChar(y)&&(namesOf(y).includes(c.name.toLowerCase())||(c.alias||[]).some(a=>namesOf(y).includes(a)))))return -30;
      if(c.kw.bodyguard&&op.play.some(y=>isChar(y)&&strOf(y)>=3))return -12}
    return 0}
  if(a.t==="play"){const c=find(st,a.uid).inst.card;
    if(a.shift!=null){const base=find(st,a.shift)?.inst;let b=16+c.lore*2+(c.lore-(base?loreOf(base):0))*5;
      if(base&&dry(st,base)&&!base.exerted)b+=14;return b}
    if(c.type==="character"&&c.kw.shift!=null&&legalActions(st).some(b=>b.t==="play"&&b.uid===a.uid&&b.shift!=null))return -18;
    if(c.type==="character"&&c.kw.bodyguard){let b=op.play.some(y=>isChar(y)&&strOf(y)>=3)?10:4;
      if(a.exerted&&(me.play.some(y=>isChar(y)&&loreOf(y)>=2)||op.play.some(y=>isChar(y)&&!y.exerted&&strOf(y)>=2)))b+=14;
      if(!a.exerted&&legalActions(st).some(x=>x.t==="play"&&x.uid===a.uid&&x.exerted)&&op.play.some(y=>isChar(y)&&!y.exerted&&strOf(y)>=2))b-=10;
      return b}
    if(c.type==="character"&&c.kw.ward)return 4;
    if(c.type==="location")return 8+locPlayValue(c)/4;
    if(c.type==="song"||c.type==="action"){let b=4+(CTX.threat?8:0);if(a.singer!=null||a.singers){b+=14;
        if(a.singer!=null){const sg=find(st,a.singer)?.inst;if(sg&&loreOf(sg)<=1)b+=8}
        if(a.singers){const ids=String(a.singers).split(",").map(Number);
          const lb=ids.reduce((t,u)=>{const f=find(st,u);return t+(f?loreOf(f.inst):0)},0);b+=Math.max(0,8-lb*2)-Math.max(0,ids.length-2)*3}}
      return b+(me.ink.length>=c.cost?2:0)}
    if(c.type!=="character"&&me.ink.length>=c.cost)return 4}
  if(a.t==="move"){const l=find(st,a.loc).inst;let b=8+locBenefit(l)/3;
    if(l.card.statics.some(z=>z.here&&z.stat==="lore"))b+=12+(me.lore<=op.lore?8:0);
    if(!hereChars(st,l).length&&locBenefit(l)>=12)b+=7;return b}
  if(a.t==="act"){const at=find(st,a.uid)?.inst;if(!at)return 0;
    if(CTX.lethal&&isChar(at)&&!at.exerted&&dry(st,at)&&loreOf(at)>0)return -40;
    if(isChar(at)&&loreOf(at)>=2&&!CTX.threat&&me.lore>=op.lore)return -10;
    return 4}
  return 0}
function aiMulligan(st,pi){const h=st.players[pi].hand;const cheap=h.filter(c=>c.card.cost<=3).length;const inkN=h.filter(c=>c.card.inkable).length;
  const cheapInk=h.filter(c=>c.card.inkable&&c.card.cost<=3).length;
  // Always dump 7+ bricks. Keep curve when we already have cheap ink; otherwise dump expensive/non-inkable.
  const always=h.filter(c=>c.card.cost>=7).map(c=>c.uid);
  if(cheap>=3&&inkN>=2&&cheapInk>=1)return always;
  if(cheap>=2&&inkN>=3)return always.concat(h.filter(c=>c.card.cost>=6&&!always.includes(c.uid)).map(c=>c.uid));
  const dump=h.filter(c=>{
    const cost=c.card.cost,inkable=!!c.card.inkable;
    if(cost>=7)return true;
    if(cost>=6&&(inkN<3||cheap<2))return true;
    if(cost>=5&&!inkable)return true;
    if(cost>=5&&cheapInk===0)return true;
    if(cost>=4&&!inkable&&inkN<2)return true;
    if(cheap<2&&cost>=4)return true;
    return false;
  }).map(c=>c.uid);
  return [...new Set(dump)]}

/* ---------- decks ---------- */
const INKS=["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"];
function cardScore(c){const kw=(c.kw.evasive?2:0)+(c.kw.bodyguard?1:0)+(c.kw.ward?1:0)+(c.kw.rush?1:0)+(c.kw.challenger?1:0);
  const abil=c.onPlay.length+c.acts.length+c.statics.length+c.onQuest.length;
  let v=c.type==="character"?c.lore*3+c.str+c.wil-c.cost*1.6+abil*1.5
    :c.type==="location"?c.lore*3+c.wil*0.6-c.cost*1.2+(abil?3:0)+2
    :c.type==="item"?(abil?7-c.cost*0.5:0)
    :(c.onPlay.length?7-c.cost*0.5+(c.type==="song"?2:0):0);
  return (c.supported?6:0)+(c.inkable?3:0)+v+kw}
function fitsInks(c,inks){return c.inks.length>0&&c.inks.every(i=>inks.includes(i))}
const CURVE={1:2,2:4,3:3,4:3,5:2,6:1,7:0};
const TYPE_CAP={action:8,item:6,location:4};
function buildDeck(pool,inks,owned){
  // pool: normalized cards. owned: optional map id->copies available. Returns array of 60 cards or null.
  // Includes characters, actions, songs, items and locations; a collection build reserves 12-18 non-character slots.
  const byFull=new Map();
  for(const c of pool){if(!fitsInks(c,inks))continue;const k=c.full;
    const avail=owned?(owned[c.id]||0):4;if(!avail)continue;const e=byFull.get(k);if(e)e.n=Math.min(e.c.maxCopies||4,e.n+avail);else byFull.set(k,{c,n:Math.min(c.maxCopies||4,avail)})}
  const list=[...byFull.values()].sort((a,b)=>cardScore(b.c)-cardScore(a.c))/*nc:ai-order*/;
  const deck=[];const take=(e,n)=>{n=Math.min(n,e.n,60-deck.length);for(let i=0;i<n;i++)deck.push(e.c);e.n-=n};
  if(!owned){const used=new Set();
    const CV={1:1,2:3,3:3,4:2,5:1,6:1,7:0};for(const [cost,slots] of Object.entries(CV)){let s=slots;for(const e of list){if(!s)break;const cc=Math.min(7,e.c.cost);if(cc!=+cost||used.has(e.c.full)||e.c.cost<1||e.c.type!=="character")continue;used.add(e.c.full);take(e,4);s--}}
    const per={};for(const e of list){if(deck.length>=60)break;const g=e.c.type==="song"?"action":e.c.type;if(g==="character"||used.has(e.c.full)||!e.c.supported||(per[g]||0)>=TYPE_CAP[g])continue;used.add(e.c.full);const t=Math.min(4,TYPE_CAP[g]-(per[g]||0));take(e,t);per[g]=(per[g]||0)+t}
    for(const e of list){if(deck.length>=60)break;if(!used.has(e.c.full)&&e.c.cost>=1){used.add(e.c.full);take(e,4)}}
  }else{const NC=list.filter(e=>e.c.type!=="character"),CH=list.filter(e=>e.c.type==="character");
    const ncAvail=NC.reduce((t,e)=>t+e.n,0),chAvail=CH.reduce((t,e)=>t+e.n,0);
    const ncTarget=Math.max(Math.min(18,ncAvail),60-chAvail),ncMin=Math.min(12,ncAvail);
    const goal=Math.max(ncMin,Math.min(ncTarget,18));let ncN=0;const per={};
    for(const pass of[0,1])for(const e of NC){if(ncN>=goal)break;const g=e.c.type==="song"?"action":e.c.type;if(pass===0&&(per[g]||0)>=TYPE_CAP[g])continue;const t=Math.min(e.n,goal-ncN,pass===0?TYPE_CAP[g]-(per[g]||0):99);take(e,t);ncN+=t;per[g]=(per[g]||0)+t}
    for(const e of CH){if(deck.length>=60)break;take(e,e.n)}
    for(const e of NC){if(deck.length>=60)break;take(e,e.n)}}
  return deck.length===60?deck:null;
}
function bestOwnedPair(pool,owned){let best=null;
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const inks=[INKS[i],INKS[j]];const n=pool.reduce((s,c)=>s+(fitsInks(c,inks)?Math.min(4,owned[c.id]||0):0),0);if(!best||n>best.n)best={inks,n}}
  return best;}
function validateDeck(deck){if(deck.length<60)return"Deck must have at least 60 cards";const hun=deck.some(c=>c.hunnyAny);const inks=new Set(deck.filter(c=>!(hun&&c.cls.includes("Hunny"))).flatMap(c=>c.inks));if(inks.size>2)return"Too many inks";
  const cnt={};for(const c of deck){cnt[c.full]=(cnt[c.full]||0)+1;if(cnt[c.full]>(c.maxCopies||4)&&!c.anyCopies&&!/up to 99 copies/.test(c.text))return"More than "+(c.maxCopies||4)+" copies of "+c.full}return null}

function coverage(pool){const seen0=new Map();for(const c of pool)if(!seen0.has(c.full))seen0.set(c.full,c);const st={};for(const c of seen0.values())st[c.status]=(st[c.status]||0)+1;
  const r=coverage0(pool);r.byStatus=st;return r}
function coverage0(pool){const seen=new Map();for(const c of pool)if(!seen.has(c.full))seen.set(c.full,c);const all=[...seen.values()];
  const sup=all.filter(c=>c.supported).length,vanilla=all.filter(c=>c.supported&&!c.onPlay.length&&!c.onQuest.length&&!c.acts.length&&!c.onBanish.length&&!c.entersExerted&&!c.enterDamage).length;
  return{unique:all.length,supported:sup,unsupported:all.length-sup,vanillaOrKeywordOnly:vanilla,withSimulatedText:sup-vanilla}}

/*STARTERS-BEGIN*/const STARTER_DECKS=[{"name":"Amber/Amethyst Starter - The First Chapter","title":"The Heart of Magic","set":"The First Chapter","inks":["Amber","Amethyst"],"list":[[2,"Ariel - On Human Legs"],[2,"Cinderella - Gentle and Kind"],[1,"Hades - Lord of the Underworld"],[2,"HeiHei - Boat Snack"],[2,"Maximus - Relentless Pursuer"],[3,"Mickey Mouse - True Friend"],[3,"Minnie Mouse - Beloved Princess"],[1,"Moana - Of Motunui"],[3,"Stitch - New Dog"],[2,"Be Our Guest"],[2,"Control Your Temper!"],[2,"Hakuna Matata"],[1,"Part of Your World"],[3,"Dinglehopper"],[1,"Dr. Facilier - Agent Provocateur"],[2,"Dr. Facilier - Charlatan"],[1,"Flotsam - Ursula's Spy"],[2,"Jafar - Wicked Sorcerer"],[3,"Magic Broom - Bucket Brigade"],[2,"Maleficent - Sorceress"],[1,"Mickey Mouse - Wayward Sorcerer"],[2,"Jetsam - Ursula's Spy"],[3,"Olaf - Friendly Snowman"],[2,"Pascal - Rapunzel's Companion"],[3,"Rafiki - Mysterious Sage"],[1,"Sven - Official Ice Deliverer"],[3,"The Wardrobe - Belle's Confidant"],[2,"Yzma - Alchemist"],[3,"Friends on the Other Side"]]},{"name":"Emerald/Ruby Starter - The First Chapter","title":"Daring and Deception","set":"The First Chapter","inks":["Emerald","Ruby"],"list":[[2,"Aladdin - Prince Ali"],[1,"Cruella De Vil - Miserable as Usual"],[2,"Duke of Weselton - Opportunistic Official"],[3,"Horace - No-Good Scoundrel"],[1,"Iago - Loud-Mouthed Parrot"],[2,"Jasper - Common Crook"],[3,"Mad Hatter - Gracious Host"],[3,"Megara - Pulling the Strings"],[3,"Mickey Mouse - Steamboat Pilot"],[2,"Peter Pan - Never Landing"],[3,"Mother Knows Best"],[2,"Stampede"],[1,"Steal from the Rich"],[2,"Vicious Betrayal"],[2,"Stolen Scimitar"],[1,"Aladdin - Heroic Outlaw"],[3,"Aladdin - Street Rat"],[2,"Captain - Colonel's Lieutenant"],[2,"Donald Duck - Boisterous Fowl"],[1,"LeFou - Instigator"],[3,"Pongo - Ol' Rascal"],[3,"Rapunzel - Letting Down Her Hair"],[2,"Scar - Fiery Usurper"],[3,"Sergeant Tibbs - Courageous Cat"],[1,"Stitch - Abomination"],[3,"Dragon Fire"],[2,"He's Got a Sword!"],[2,"Shield of Virtue"]]},{"name":"Sapphire/Steel Starter - The First Chapter","title":"A Steadfast Strategy","set":"The First Chapter","inks":["Sapphire","Steel"],"list":[[3,"Aurora - Briar Rose"],[1,"Aurora - Dreaming Guardian"],[3,"Aurora - Regal Princess"],[2,"Flounder - Voice of Reason"],[2,"Gramma Tala - Storyteller"],[2,"Jasmine - Disguised"],[3,"Maleficent - Sinister Visitor"],[1,"Maleficent - Uninvited"],[3,"Mickey Mouse - Detective"],[2,"Mufasa - King of the Pride Lands"],[1,"Scar - Mastermind"],[3,"Develop Your Brain"],[2,"One Jump Ahead"],[3,"Coconut Basket"],[2,"Magic Golden Flower"],[2,"Beast - Hardheaded"],[3,"Captain Hook - Forceful Duelist"],[2,"Goons - Maleficent's Underlings"],[2,"Hercules - True Hero"],[2,"Kristoff - Official Ice Master"],[1,"Maui - Demigod"],[2,"Prince Eric - Dashing and Brave"],[1,"Simba - Returned King"],[2,"Simba - Rightful Heir"],[3,"Fire the Cannons!"],[1,"Grab Your Sword"],[2,"Ransack"],[2,"Smash"],[2,"Frying Pan"]]},{"name":"Amber/Sapphire Starter - Rise of the Floodborn","title":"Tactical Teamwork","set":"Rise of the Floodborn","inks":["Amber","Sapphire"],"list":[[2,"Bashful - Hopeless Romantic"],[1,"Christopher Robin - Adventurer"],[2,"Doc - Leader of the Seven Dwarfs"],[2,"Dopey - Always Playful"],[3,"Gaston - Baritone Bully"],[1,"Grand Duke - Advisor to the King"],[3,"Grumpy - Bad-Tempered"],[2,"Happy - Good-Natured"],[2,"LeFou - Bumbler"],[3,"Sleepy - Nodding Off"],[3,"Sneezy - Very Allergic"],[2,"Snow White - Lost in the Forest"],[1,"The Queen - Commanding Presence"],[3,"The Queen - Regal Monarch"],[2,"Painting the Roses Red"],[1,"Belle - Inventive Engineer"],[3,"Cruella De Vil - Fashionable Cruiser"],[1,"Gaston - Intellectual Powerhouse"],[1,"Hiram Flaversham - Toymaker"],[2,"Judy Hopps - Optimistic Officer"],[3,"Owl - Logical Lecturer"],[2,"Philoctetes - Trainer of Heroes"],[3,"The Nokk - Water Spirit"],[1,"Winnie the Pooh - Having a Think"],[2,"Four Dozen Eggs"],[2,"Launch"],[2,"Fang Crossbow"],[2,"Gumbo Pot"],[3,"Pawpsicle"]]},{"name":"Amethyst/Steel Starter - Rise of the Floodborn","title":"Might and Magic","set":"Rise of the Floodborn","inks":["Amethyst","Steel"],"list":[[3,"Chip the Teacup - Gentle Soul"],[2,"Dr. Facilier - Savvy Opportunist"],[3,"HeiHei - Persistent Presence"],[3,"Kuzco - Wanted Llama"],[1,"Madam Mim - Fox"],[3,"Madam Mim - Snake"],[2,"Merlin - Crab"],[3,"Merlin - Goat"],[1,"Merlin - Rabbit"],[1,"Merlin - Shapeshifter"],[2,"Merlin - Squirrel"],[2,"Freeze"],[2,"I'm Stuck!"],[2,"Beast - Forbidding Recluse"],[2,"Benja - Guardian of the Dragon Gem"],[2,"Cinderella - Knight in Training"],[2,"Eli La Bouff - Big Daddy"],[2,"Hercules - Hero in Training"],[1,"Kronk - Junior Chipmunk"],[2,"Lawrence - Jealous Manservant"],[3,"Lilo - Galactic Hero"],[2,"Prince Eric - Dashing and Brave"],[3,"Prince Naveen - Penniless Royal"],[1,"The Huntsman - Reluctant Enforcer"],[2,"The Prince - Never Gives Up"],[1,"Tiana - Celebrating Princess"],[3,"Tiana - Diligent Waitress"],[2,"Last Cannon"],[2,"Mouse Armor"]]},{"name":"Amber/Emerald Starter - Into the Inklands","title":"Dogged and Dynamic","set":"Into the Inklands","inks":["Amber","Emerald"],"list":[[5,"Dalmatian Puppy - Tail Wagger"],[3,"Kida - Atlantean"],[1,"Lucky - The 15th Puppy"],[2,"Nani - Protective Sister"],[3,"Patch - Intimidating Pup"],[1,"Pluto - Determined Defender"],[3,"Pluto - Friendly Pooch"],[1,"Pongo - Determined Father"],[3,"Rolly - Hungry Pup"],[2,"Tinker Bell - Generous Fairy"],[3,"Wendy Darling - Talented Sailor"],[2,"Never Land - Mermaid Lagoon"],[3,"Cubby - Mighty Lost Boy"],[2,"Don Karnage - Prince of Pirates"],[2,"Flotsam - Riffraff"],[1,"Helga Sinclair - Vengeful Partner"],[2,"Horace - No-Good Scoundrel"],[2,"Jasper - Common Crook"],[2,"Jetsam - Riffraff"],[2,"Kit Cloudkicker - Tough Guy"],[1,"Peter Pan - Lost Boy Leader"],[1,"Robin Hood - Daydreamer"],[1,"Starkey - Devious Pirate"],[2,"Wildcat - Mechanic"],[2,"Strike a Good Match"],[2,"Hypnotize"],[3,"Improvise"],[3,"De Vil Manor - Cruella's Estate"]]},{"name":"Ruby/Sapphire Starter - Into the Inklands","title":"Plenty of Pluck","set":"Into the Inklands","inks":["Ruby","Sapphire"],"list":[[3,"Della Duck - Unstoppable Mom"],[3,"HeiHei - Accidental Explorer"],[3,"Kakamora - Menacing Sailor"],[3,"Maui - Soaring Demigod"],[2,"Minnie Mouse - Always Classy"],[1,"Moana - Born Leader"],[3,"Moana - Undeterred Voyager"],[1,"Simba - Scrappy Cub"],[3,"Webby Vanderquack - Enthusiastic Duck"],[2,"Dragon Fire"],[2,"Voyage"],[1,"Maui's Fish Hook"],[2,"Sumerian Talisman"],[3,"Agrabah - Marketplace"],[2,"Cogsworth - Talking Clock"],[2,"Dewey - Showy Nephew"],[2,"Duke Weaselton - Small-Time Crook"],[2,"Flintheart Glomgold - Lone Cheater"],[3,"Flounder - Voice of Reason"],[3,"Gramma Tala - Keeper of Ancient Stories"],[1,"Gyro Gearloose - Gadget Whiz"],[1,"Huey - Savvy Nephew"],[3,"Louie - Chill Nephew"],[2,"Maid Marian - Delightful Dreamer"],[1,"Scrooge McDuck - Richest Duck in the World"],[2,"Scrooge McDuck - Uncle Moneybags"],[2,"Vault Door"],[2,"Motunui - Island Paradise"]]},{"name":"Amber/Amethyst Starter - Ursula's Return","title":"Madrigal Magic","set":"Ursula's Return","inks":["Amber","Amethyst"],"list":[[3,"Agustin Madrigal - Clumsy Dad"],[1,"Ariel - Singing Mermaid"],[2,"Félix Madrigal - Fun-Loving Family Man"],[2,"Julieta Madrigal - Excellent Cook"],[2,"Mickey Mouse - Leader of the Band"],[1,"Mirabel Madrigal - Gift of the Family"],[3,"Mirabel Madrigal - Prophecy Finder"],[3,"Prince Eric - Seafaring Prince"],[2,"Rolly - Hungry Pup"],[2,"Sebastian - Court Composer"],[3,"Stitch - Alien Dancer"],[2,"Heal What Has Been Hurt"],[2,"Healing Glow"],[1,"Look at This Family"],[2,"Lost in the Woods"],[3,"Antonio Madrigal - Animal Expert"],[1,"Bruno Madrigal - Out of the Shadows"],[2,"Camilo Madrigal - Prankster"],[2,"Dolores Madrigal - Easy Listener"],[3,"Elsa - Queen Regent"],[2,"HeiHei - Persistent Presence"],[1,"Isabela Madrigal - Golden Child"],[2,"Luisa Madrigal - Magically Strong One"],[3,"Marshmallow - Terrifying Snowman"],[1,"Pepa Madrigal - Weather Maker"],[2,"The Queen - Hateful Rival"],[2,"Tick-Tock - Ever-Present Pursuer"],[2,"Poor Unfortunate Souls"],[3,"Casa Madrigal - Casita"]]},{"name":"Sapphire/Steel Starter - Ursula's Return","title":"Stand Together","set":"Ursula's Return","inks":["Sapphire","Steel"],"list":[[3,"Anna - Braving the Storm"],[1,"Anna - True-Hearted"],[3,"Aurora - Regal Princess"],[3,"Aurora - Tranquil Princess"],[2,"Basil - Of Baker Street"],[2,"Flounder - Collector's Companion"],[2,"Mickey Mouse - Detective"],[2,"Pascal - Inquisitive Pet"],[1,"Prince Phillip - Gallant Defender"],[1,"Rapunzel - Appreciative Artist"],[2,"Sisu - Wise Friend"],[2,"Transformed Chef - Castle Stove"],[2,"Dig a Little Deeper"],[2,"Seldom All They Seem"],[3,"Aladdin - Resolute Swordsman"],[3,"Ariel - Determined Mermaid"],[1,"Hercules - Beloved Hero"],[3,"Kida - Royal Warrior"],[2,"Li Shang - Imperial Captain"],[2,"Ling - Imperial Soldier"],[3,"Mickey Mouse - Standard Bearer"],[2,"Mulan - Armored Fighter"],[1,"Philoctetes - No-Nonsense Instructor"],[3,"Robin Hood - Beloved Outlaw"],[1,"One Last Hope"],[2,"Smash"],[3,"Imperial Bow"],[3,"Thebes - The Big Olive"]]},{"name":"Amethyst/Ruby Starter - Shimmering Skies","title":"Ready to Let Loose","set":"Shimmering Skies","inks":["Amethyst","Ruby"],"list":[[3,"Anna - Eager Acolyte"],[1,"Anna - Mystical Majesty"],[2,"Archimedes - Electrified Owl"],[2,"Archimedes - Exasperated Owl"],[2,"Bruni - Fire Salamander"],[2,"Earth Giant - Living Mountain"],[1,"Elsa - The Fifth Spirit"],[2,"Gale - Wind Spirit"],[2,"King of Hearts - Monarch of Wonderland"],[2,"Maleficent - Vengeful Sorceress"],[1,"Olaf - Happy Passenger"],[2,"The Nokk - Mythical Spirit"],[2,"Finders Keepers"],[3,"Hypnotic Strength"],[2,"Retrosphere"],[2,"The Library - A Gift for Belle"],[2,"Daisy Duck - Spotless Food-Fighter"],[2,"Donald Duck - Daisy's Date"],[2,"Mickey Mouse - Enthusiastic Dancer"],[2,"Minnie Mouse - Dazzling Dancer"],[2,"Rancis Fluggerbutter - Chocolate Charger"],[3,"Simba - Adventurous Successor"],[2,"Snowanna Rainbeau - Cool Competitor"],[3,"Taffyta Muttonfudge - Crowd Favorite"],[2,"Taffyta Muttonfudge - Ruthless Rival"],[2,"Taffyta Muttonfudge - Sour Speedster"],[2,"Turbo - Royal Hack"],[1,"Vanellope von Schweetz - Random Roster Racer"],[1,"Wreck-It Ralph - Demolition Dude"],[2,"Glimmer vs Glimmer"],[1,"The Sword Released"]]},{"name":"Emerald/Steel Starter - Shimmering Skies","title":"A Roaring Guest List","set":"Shimmering Skies","inks":["Emerald","Steel"],"list":[[3,"Banzai - Taunting Hyena"],[1,"Ed - Hysterical Partygoer"],[2,"Ed - Laughing Hyena"],[3,"Little John - Camp Cook"],[3,"Robin Hood - Archery Contestant"],[2,"Robin Hood - Sneaky Sleuth"],[1,"Robin Hood - Timely Contestant"],[1,"Scar - Vengeful Lion"],[1,"Shenzi - Head Hyena"],[2,"Shenzi - Scar's Accomplice"],[3,"Ulf - Mime"],[2,"Zazu - Advisor to Mufasa"],[3,"Hypnotic Deduction"],[2,"Night Howler Rage"],[2,"Tropical Rainforest - Jaguar Lair"],[2,"Arthur - Wart"],[2,"HeiHei - Protective Rooster"],[1,"Kronk - Head of Security"],[3,"Kronk - Unlicensed Investigator"],[2,"Pete - Games Referee"],[3,"Royal Guard - Bovine Protector"],[2,"Rudy - Groove Disrupter"],[3,"Simba - Lost Prince"],[2,"Simba - Son of Mufasa"],[2,"Sleepy - Sluggish Knight"],[1,"Yzma - Unjustly Treated"],[2,"Food Fight!"],[1,"Tug-of-War"],[3,"When Will My Life Begin?"]]},{"name":"Amber/Ruby Starter - Azurite Sea","title":"A Seaworthy Crew","set":"Azurite Sea","inks":["Amber","Ruby"],"list":[[2,"Fix-It Felix, Jr. - Delighted Sightseer"],[2,"Fix-It Felix, Jr. - Niceland Steward"],[2,"Gopher - Ship's Carpenter"],[1,"Jim Hawkins - Honorable Pirate"],[2,"Owl - Pirate Lookout"],[3,"Rabbit - Indignant Pirate"],[3,"Roo - Littlest Pirate"],[2,"Rutt - Northern Moose"],[2,"Tuke - Northern Moose"],[1,"Winnie the Pooh - Hunny Pirate"],[2,"I Won't Give In"],[2,"Rescue Rangers Away!"],[2,"Amber Chromicon"],[1,"Pooh Pirate Ship"],[2,"Hundred Acre Island - Pooh's Home"],[2,"Jasmine - Rebellious Princess"],[3,"John Darling - Sophisticated Swordsman"],[1,"John Silver - Ferocious Friend"],[2,"Kakamora - Boarding Party"],[3,"Kakamora - Pirate Pitcher"],[3,"Michael Darling - Playful Swordsman"],[3,"Mickey Mouse - Courageous Sailor"],[1,"Moana - Kakamora Leader"],[2,"Moana - Self-Taught Sailor"],[3,"Ratigan - Raging Rat"],[1,"Tigger - In the Crow's Nest"],[1,"Wendy Darling - Courageous Captain"],[2,"Lead the Way"],[1,"The Islands I Pulled from the Sea"],[1,"Ratigan's Party - Seedy Back Room"],[2,"Skull Rock - Isolated Fortress"]]},{"name":"Emerald/Sapphire Starter - Azurite Sea","title":"Genius Reinvented","set":"Azurite Sea","inks":["Emerald","Sapphire"],"list":[[3,"Alistair Krei - Ambitious Entrepreneur"],[2,"Basil - Hypnotized Mouse"],[2,"Clarabelle - Contented Wallflower"],[2,"Dawson - Basil's Assistant"],[3,"Fred - Mascot by Day"],[1,"Go Go Tomago - Darting Dynamo"],[1,"Goofy - Expert Shipwright"],[2,"Heathcliff - Stoic Butler"],[2,"Honey Lemon - Chemical Genius"],[2,"Merryweather - Good Fairy"],[2,"Prince Phillip - Royal Explorer"],[2,"Stitch - Little Trickster"],[2,"Heffalumps and Woozles"],[1,"You Came Back"],[2,"Emerald Chromicon"],[2,"Megabot"],[3,"Aunt Cass - Biggest Fan"],[3,"B.E.N. - Eccentric Robot"],[1,"Baymax - Personal Healthcare Companion"],[1,"Gadget Hackwrench - Brilliant Bosun"],[3,"Gadget Hackwrench - Perceptive Mouse"],[2,"HeiHei - Not-So-Tricky Chicken"],[2,"Hiro Hamada - Robotics Prodigy"],[1,"Hiro Hamada - Team Leader"],[2,"Ludwig Von Drake - Self-Proclaimed Genius"],[2,"Pleakley - Scientific Expert"],[2,"Wasabi - Methodical Engineer"],[3,"Yokai - Professor Callaghan"],[2,"Baymax's Healthcare Chip"],[2,"Institute of Technology - Prestigious University"]]},{"name":"Amethyst/Steel Starter - Archazia's Island","title":"Feathered and Feared","set":"Archazia's Island","inks":["Amethyst","Steel"],"list":[[3,"Giant Cobra - Ghostly Serpent"],[1,"Iago - Giant Spectral Parrot"],[1,"Jafar - Newly Crowned"],[2,"Kashekim - Ancient Ruler"],[1,"Madam Mim - Cheating Spellcaster"],[2,"Pain - Impudent Imp"],[2,"Panic - High-Strung Imp"],[3,"Rajah - Ghostly Tiger"],[2,"Tanana - Tribal Elder"],[2,"Te Kā - Lava Monster"],[2,"The Carpenter - Dinner Companion"],[2,"Treasure Guardian - Foreboding Sentry"],[2,"A Very Merry Unbirthday"],[2,"Magical Maneuvers"],[1,"Restoring the Crown"],[2,"Amethyst Coil"],[2,"Retrosphere"],[2,"Akela - Wolf Pack Elder"],[2,"Arthur - Wart"],[1,"Fa Zhou - War Hero"],[3,"HeiHei - Rambling Rooster"],[2,"Helga Sinclair - Tough as Nails"],[3,"Jafar - Aspiring Ruler"],[2,"King Hubert - Phillip's Father"],[3,"Mufasa - Respected King"],[1,"Raya - Guidance Seeker"],[3,"Razoul - Menacing Guard"],[2,"Royal Guard - Bovine Protector"],[2,"Double Trouble"],[2,"Training Dummy"]]},{"name":"Ruby/Sapphire Starter - Archazia's Island","title":"An Inventive Pair","set":"Archazia's Island","inks":["Ruby","Sapphire"],"list":[[2,"Beagle Boys - Small-Time Crooks"],[1,"Beast - Frustrated Designer"],[1,"Belle - Mechanic Extraordinaire"],[3,"Cogsworth - Climbing Clock"],[2,"Cy-Bug - Invasive Enemy"],[2,"Edgar Balthazar - Ambitious Butler"],[1,"Lyle Tiberius Rourke - Crystallized Mercenary"],[1,"Maurice - Unconventional Inventor"],[2,"Moana - Island Explorer"],[2,"Sir Kay - Unruly Knight"],[3,"Stabbington Brother - Without a Patch"],[3,"Toby - Dogged Companion"],[2,"Gold Coin"],[2,"Longboat"],[3,"Maurice's Machine"],[2,"Ruby Coil"],[2,"Unconventional Tool"],[3,"Belle - Apprentice Inventor"],[2,"Chaca - Impressive Daughter"],[2,"Donald Duck - Focused Flatfoot"],[2,"Gaetan Moliere - The Mole"],[3,"Jebidiah Farnsworth - Expedition Cook"],[1,"Kida - Creative Thinker"],[2,"Marie - Favored Kitten"],[2,"Monsieur D'Arque - Despicable Proprietor"],[2,"Robin Hood - Eye for Detail"],[1,"All Is Found"],[2,"Ever as Before"],[2,"Helping Hand"],[2,"Medal of Heroes"]]},{"name":"Amber/Amethyst Starter - Reign of Jafar","title":"A Harmonious Team","set":"Reign of Jafar","inks":["Amber","Amethyst"],"list":[[3,"Alma Madrigal - Accepting Grandmother"],[1,"Antonio Madrigal - Friend to All"],[2,"Antonio's Jaguar - Faithful Companion"],[1,"Bruno Madrigal - Singing Seer"],[2,"Charlotte La Bouff - Mardi Gras Princess"],[1,"Clawhauser - Front Desk Officer"],[2,"Dewey - Lovable Showoff"],[2,"Huey - Reliable Leader"],[2,"Louie - One Cool Duck"],[2,"Mariano Guzman - Handsome Suitor"],[3,"Mirabel Madrigal - Curious Child"],[3,"Pepa Madrigal - Sensitive Sister"],[1,"Tiana - Natural Talent"],[3,"So Much to Give"],[3,"Trials and Tribulations"],[2,"Try Everything"],[2,"Bambi - Prince of the Forest"],[3,"Bruno Madrigal - Single-Minded"],[3,"Camilo Madrigal - Center Stage"],[2,"Dolores Madrigal - Within Earshot"],[2,"Druun - Ravenous Plague"],[1,"Flower - Shy Skunk"],[2,"Madam Mim - Up to No Good"],[2,"Poe De Spell - Magica's Brother"],[2,"Ryder - Fleet-Footed Infiltrator"],[1,"Fantastical and Magical"],[2,"Forest Duel"],[2,"They Never Come Back"],[3,"This Is My Family"]]},{"name":"Ruby/Steel Starter - Reign of Jafar","title":"Brave and Brazen","set":"Reign of Jafar","inks":["Ruby","Steel"],"list":[[3,"Cri-Kee - Part of the Team"],[3,"Friend Owl - Cantankerous Neighbor"],[2,"Grandmother Fa - Spirited Elder"],[2,"Honest John - Shameless Schemer"],[2,"Kakamora - Boarding Party"],[3,"Lafayette - Sleepy Basset Hound"],[1,"Mulan - Charging Ahead"],[3,"Mushu - Fast-Talking Dragon"],[1,"Mushu - Your Worst Nightmare"],[1,"Prince John - Fraidy-Cat"],[3,"The Matchmaker - Unforgiving Expert"],[3,"Thumper - Young Bunny"],[2,"Light the Fuse"],[2,"Twitterpated"],[1,"The Sword of Shan-Yu"],[3,"Atitaya - Fang General"],[3,"Bobby - Purple Pigeon"],[3,"Captain Hook - Forceful Duelist"],[3,"General Li - Head of the Imperial Army"],[3,"Khan - War Horse"],[2,"Mulan - Disguised Soldier"],[1,"Stitch - Alien Troublemaker"],[1,"Vinnie - Green Pigeon"],[2,"Zipper - Flying Ranger"],[2,"Beyond the Horizon"],[2,"Quick Shot"],[3,"Training Staff"]]},{"name":"Amber/Sapphire Starter - Fabled","title":"Princess Power","set":"Fabled","inks":["Amber","Sapphire"],"list":[[1,"Ariel - Singing Mermaid"],[2,"Aurora - Holding Court"],[1,"Beast - Gracious Prince"],[2,"Cinderella - Gentle and Kind"],[2,"Julieta Madrigal - Excellent Cook"],[3,"Mulan - Free Spirit"],[2,"Nani - Protective Sister"],[3,"Pluto - Rescue Dog"],[3,"Rapunzel - Sunshine"],[3,"Be Our Guest"],[1,"Look at This Family"],[2,"Lost in the Woods"],[2,"World's Greatest Criminal Mind"],[1,"Alice - Accidentally Adrift"],[2,"Aurora - Regal Princess"],[3,"Aurora - Tranquil Princess"],[2,"Belle - Inventive Engineer"],[3,"Cruella De Vil - Fashionable Cruiser"],[1,"Grand Pabbie - Oldest and Wisest"],[3,"Hans - Noble Scoundrel"],[3,"Jasmine - Heir of Agrabah"],[3,"Maid Marian - Delightful Dreamer"],[3,"Mufasa - King of the Pride Lands"],[1,"Mulan - Considerate Diplomat"],[1,"The Queen - Mirror Seeker"],[1,"Dig a Little Deeper"],[2,"Aurelian Gyrosensor"],[2,"Coconut Basket"],[2,"Motunui - Island Paradise"]]},{"name":"Emerald/Ruby Starter - Fabled","title":"Standout Headliners","set":"Fabled","inks":["Emerald","Ruby"],"list":[[3,"Aladdin - Prince Ali"],[2,"Bobby Zimuruski - Spray Cheese Kid"],[2,"Donald Duck - Perfect Gentleman"],[3,"Donald Duck - Sleepwalker"],[1,"Goofy - Set for Adventure"],[1,"Kuzco - Temperamental Emperor"],[1,"Max Goof - Rebellious Teen"],[2,"Megara - Pulling the Strings"],[3,"Mickey Mouse - Steamboat Pilot"],[2,"Virana - Fang Chief"],[2,"Wildcat - Mechanic"],[3,"Improvise"],[2,"Mother Knows Best"],[2,"Stand Out"],[2,"Signed Contract"],[2,"LeFou - Instigator"],[3,"Max Goof - Rockin' Teen"],[3,"P.J. Pete - Caught Up in the Music"],[1,"Powerline - Musical Superstar"],[3,"Powerline - Taking the Stage"],[1,"Powerline - World's Greatest Rock Star"],[2,"Roxanne - Powerline Fan"],[3,"Sergeant Tibbs - Courageous Cat"],[2,"A Pirate's Life"],[2,"Be King Undisputed"],[1,"I2I"],[3,"You Can Fly!"],[3,"Agrabah - Marketplace"]]},{"name":"Amber/Emerald Starter - Whispers in the Well","title":"Spectacular Specters","set":"Whispers in the Well","inks":["Amber","Emerald"],"list":[[2,"Bagheera - Cautious Explorer"],[2,"Della Duck - Returning Mother"],[3,"Eilonwy - Princess of Llyr"],[3,"Gaston - Frightful Bully"],[2,"Goofy - Ghost Hunter"],[3,"Higgins - Undercover Officer"],[3,"Mrs. Beakley - Former S.H.U.S.H. Agent"],[1,"Scrooge McDuck - Cavern Prospector"],[1,"Scrooge McDuck - On the Right Track"],[1,"Simba - King in the Making"],[2,"Webby Vanderquack - Knowledge Seeker"],[2,"Della's Moon Lullaby"],[2,"Munchings and Crunchings"],[2,"Recovered Page"],[1,"Duckburg - Funso's Funzone"],[2,"Akela - Forest Runner"],[1,"Baloo - Carefree Bear"],[3,"Baloo - Laid-Back Bear"],[2,"Bellwether - Master Manipulator"],[3,"Big Nose - Lovesick Poet"],[1,"Emily Quackfaster - Level-Headed Librarian"],[3,"Flotsam - Slippery as an Eel"],[3,"Flynn Rider - Spectral Scoundrel"],[2,"Hook Hand - Unexpectedly Friendly"],[2,"Jetsam - Opportunistic Eel"],[1,"Megara - Secret Keeper"],[1,"Penumbra - Moon Alien"],[2,"Chomp!"],[2,"So Be It!"],[2,"Blessed Bagpipes"]]},{"name":"Sapphire/Steel Starter - Whispers in the Well","title":"On the Case","set":"Whispers in the Well","inks":["Sapphire","Steel"],"list":[[2,"Anna - Making Snow Plans"],[2,"Daisy Duck - Ghost Finder"],[2,"Genie - Investigative Mind"],[1,"Kristoff - Mining the Ruins"],[2,"Jasmine - Soothing Princess"],[1,"Judy Hopps - Lead Detective"],[3,"Judy Hopps - On the Case"],[1,"Judy Hopps - Uncovering Clues"],[3,"Hen Wen - Prophetic Pig"],[2,"Mickey Mouse - Detective"],[2,"Pluto - Clever Cluefinder"],[3,"Scuttle - Birdbrained"],[2,"Hen Wen's Visions"],[2,"Promising Lead"],[2,"Detective's Badge"],[2,"Basil - Tenacious Mouse"],[3,"Black Heron - Real Bad Egg"],[2,"Clawhauser - Donut Detective"],[2,"David Xanatos - Steel Clan Leader"],[2,"Donald Duck - Ghost Hunter"],[2,"Francine - Eyeing the Evidence"],[2,"Minnie Mouse - Ghost Hunter"],[1,"Nick Wilde - Persistent Investigator"],[3,"Nick Wilde - Sly Fox Sleuth"],[1,"Robin Hood - Ephemeral Archer"],[2,"The Headless Horseman - Relentless Spirit"],[1,"Zeus - Missing His Spark"],[2,"Putting It All Together"],[2,"The Robot Queen"],[2,"Zootopia - Police Headquarters"],[1,"Castle Wyvern - Above the Clouds"]]},{"name":"Amethyst/Ruby Starter - Wilds Unknown","title":"Daring Heroics","set":"Wilds Unknown","inks":["Amethyst","Ruby"],"list":[[1,"Edna Mode - Fashion Designer"],[2,"Elinor - Bespelled Queen"],[1,"Frozone - Super Cool"],[3,"Frozone - Super Slick"],[3,"Happy - Joyful Adventurer"],[2,"Mickey Mouse - Experienced Traveler"],[3,"Mirage - Super Recruiter"],[1,"Mrs. Incredible - Super Stretchy"],[2,"Rabbit - Fed Up"],[3,"Sleepy - Deep Sleeper"],[3,"Sneezy - Startlingly Loud"],[2,"Violet Parr - Learning New Powers"],[2,"Will O' the Wisp - Forest Spirit"],[3,"Winnie the Pooh - Hunny Wizard"],[2,"Super Relocation Program"],[2,"Super Suit"],[2,"Daisy Duck - Trendy Traveler"],[2,"Dash Parr - Super Speedy"],[3,"Goofy - Marley's Clumsy Spirit"],[1,"Jack-Jack Parr - Incredible Potential"],[2,"LeFou - Instigator"],[3,"Mr. Incredible - Bob Parr"],[3,"Negaduck - Evil Doppelganger"],[1,"Negaduck - Public Enemy Number One"],[1,"Hero Work"],[3,"Inner Strength"],[2,"Mushu's Rocket"],[2,"Sleepy Hollow - The Bridge"]]},{"name":"Amber/Emerald Starter - Wilds Unknown","title":"Playful Teamwork","set":"Wilds Unknown","inks":["Amber","Emerald"],"list":[[3,"Agustin Madrigal - Exceptionally Kind"],[2,"Bo Peep - Caring Shepherd"],[3,"Bullseye - Loyal Horse"],[2,"Chip - Team Player"],[1,"Hamm - Piggy Bank"],[1,"Jessie - Lively Cowgirl"],[3,"Julieta Madrigal - Caring Baker"],[2,"Pluto - Vigilant Traveler"],[1,"Rex - Protective Dinosaur"],[3,"Woody - Leader of the Toys"],[3,"Woody - Waiting for a Friend"],[3,"This Growing Pressure"],[2,"Safety Rope"],[1,"Andy's Room - Home Base"],[1,"Buzz Lightyear - On the Way"],[3,"Buzz Lightyear - Space Ranger"],[3,"Donald Duck - Distracted Traveler"],[3,"Hamish, Hubert & Harris - Troublemaking Triplets"],[1,"Lenny - Toy Binoculars"],[2,"Lord MacGuffin - Clever Swordsman"],[3,"Merida - Defiant Daughter"],[1,"Merida - Gifted Archer"],[2,"Peter Pan - Searching Far and Wide"],[3,"RC - Remote-Controlled Car"],[3,"The Queen - Evil Ruler"],[2,"Tod - Nimble Fox"],[3,"Strange Things"]]}];/*STARTERS-END*/
const nzName=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\u2010-\u2015]/g,"-").replace(/[\u2018\u2019]/g,"'").toLowerCase().replace(/\s+/g," ").trim();
function deckFromList(pool,list){const by=new Map();for(const c of pool){const k=nzName(c.full);if(!by.has(k))by.set(k,c)}const out=[];for(const[n,name]of list){const c=by.get(nzName(name));if(!c)return null;for(let i=0;i<n;i++)out.push(c)}return out.length>=60?out:null}

/* #38 Save/resume: only safe when no pending choice graph (closures). Serializes zones + RNG counter. */
function freezeInst(x){const c=x.card;return{uid:x.uid,id:c.id,full:c.full,snap:{id:c.id,name:c.name,version:c.version||'',type:c.type==='song'?['Action','Song']:c.type==='action'?['Action']:c.type==='item'?['Item']:c.type==='location'?['Location']:['Character'],cost:c.cost,inkwell:!!c.inkable,ink:(c.inks&&c.inks[0])||'Amber',strength:c.str||0,willpower:c.wil||1,lore:c.lore||0,text:c.text||'',move_cost:c.move,set:c.set,img:c.img},owner:x.owner,damage:x.damage|0,exerted:!!x.exerted,playedOn:x.playedOn|0,turnPlayed:x.turnPlayed|0,tStr:x.tStr|0,lStr:x.lStr|0,tLore:x.tLore|0,tChal:x.tChal|0,lLore:x.lLore|0,noQuest:!!x.noQuest,noReady:!!x.noReady,at:x.at,under:(x.under||[]).map(freezeInst),grants:(x.grants||[]).map(g=>({kw:g.kw,until:g.until,src:g.src})),shiftedOn:x.shiftedOn,onceA:x.onceA,onceT:x.onceT,onceP:x.onceP,onceMH:x.onceMH,mvOnceT:x.mvOnceT,noQuestNow:!!x.noQuestNow,noChalNow:!!x.noChalNow,noQuestNext:!!x.noQuestNext,noChalNext:!!x.noChalNext,lSrc:x.lSrc,lLoreSrc:x.lLoreSrc}}
function freezeState(st){if(!st||st.winner!=null)return null;if(st.pending||(st.pq&&st.pq.length))return{error:"pending"};
  return{v:1,seed:st.seed,r:st.r&&st.r.state?st.r.state():null,turnNo:st.turnNo,active:st.active,first:st.first,phase:st.phase,uid:st.uid,mull:[...st.mull],human:[...st.human],log:(st.log||[]).slice(-80),
    players:st.players.map(p=>({name:p.name,lore:p.lore|0,inked:!!p.inked,inkN:p.inkN|0,deck:p.deck.map(freezeInst),hand:p.hand.map(freezeInst),ink:p.ink.map(freezeInst),play:p.play.map(freezeInst),discard:p.discard.map(freezeInst)}))}}
function thawInst(o,byId,byFull){let card=byId.get(o.id)||byFull.get(nzName(o.full));if(!card&&o.snap)card=normCard(o.snap);if(!card)throw new Error("missing card "+(o.full||o.id));
  const x={uid:o.uid,card,owner:o.owner,damage:o.damage|0,exerted:!!o.exerted,playedOn:o.playedOn|0,turnPlayed:o.turnPlayed|0,tStr:o.tStr|0,lStr:o.lStr|0,tLore:o.tLore|0,tChal:o.tChal|0,lLore:o.lLore|0,noQuest:!!o.noQuest,noReady:!!o.noReady,at:o.at,under:(o.under||[]).map(u=>thawInst(u,byId,byFull)),grants:(o.grants||[]).map(g=>({...g})),shiftedOn:o.shiftedOn,onceA:o.onceA,onceT:o.onceT,onceP:o.onceP,onceMH:o.onceMH,mvOnceT:o.mvOnceT,noQuestNow:!!o.noQuestNow,noChalNow:!!o.noChalNow,noQuestNext:!!o.noQuestNext,noChalNext:!!o.noChalNext,lSrc:o.lSrc,lLoreSrc:o.lLoreSrc};
  return x}
function thawState(data,pool){if(!data||data.v!==1)throw new Error("bad save");if(data.error)throw new Error(data.error);
  const byId=new Map(),byFull=new Map();for(const c of pool){byId.set(c.id,c);const k=nzName(c.full);if(!byFull.has(k))byFull.set(k,c)}
  const st={human:[...data.human],turnNo:data.turnNo,active:data.active,first:data.first,phase:data.phase||"main",winner:null,log:[...(data.log||[])],uid:data.uid,seed:data.seed,mull:[...data.mull],pending:null,pq:[],events:[],stats:[{},{}],players:[]};
  st.r=rng(data.seed);if(data.r!=null&&st.r.set)st.r.set(data.r);
  for(const P of data.players){st.players.push({name:P.name,lore:P.lore|0,inked:!!P.inked,inkN:P.inkN|0,deck:P.deck.map(o=>thawInst(o,byId,byFull)),hand:P.hand.map(o=>thawInst(o,byId,byFull)),ink:P.ink.map(o=>thawInst(o,byId,byFull)),play:P.play.map(o=>thawInst(o,byId,byFull)),discard:P.discard.map(o=>thawInst(o,byId,byFull)),disc:[],boosted:new Set()})}
  CUR=st;return st}

const E={STARTER_DECKS,deckFromList,actsOf,ev,costOf,normCard,parseEffects,newGame,mulligan,legalActions,act,aiChoose,aiMulligan,buildDeck,bestOwnedPair,validateDeck,coverage,INKS,inkAvail,dry,strOf,targets,find,isLegal,challengeTargets,loreOf,K,wilOf,moveCost,checkWin,winAt,freezeState,thawState,singVal};
if(typeof module!=="undefined"&&module.exports)module.exports=E;else root.LorcanaEngine=E;
})(typeof window!=="undefined"?window:globalThis);
