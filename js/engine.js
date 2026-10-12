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
  if(!m)return null;const t={opp:!!m[2],own:!!m[6],kinds:KINDS[m[5]],kind:m[5]==="character"?"char":m[5]==="item"?"item":"any",other:!!m[1]};
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
  if((m=l.match(/^put (?:a|any) card from your hand into your inkwell facedown(?: and exerted)?$/)))return{k:"handToInk"};
  if((m=l.match(/^return this card to your hand$/)))return{k:"returnSelf"};
  if((m=l.match(/^put this card into your inkwell facedown and exerted$/)))return{k:"inkSelf"};
  if((m=l.match(/^you pay (\d+) ink less for the next (character|item|action|song|location) you play this turn$/)))return{k:"discount",n:+m[1],type:m[2]};
  if((m=l.match(/^banish all characters$/)))return{k:"banishAll"};
  if((m=l.match(/^each player puts the top (\d+) cards? of their deck into their inkwell facedown and exerted$/)))return{k:"rampAll",n:+m[1]};
  if((m=l.match(/^the challenging player chooses and discards (a|one) card$/)))return{k:"oppDiscard",n:1};
  if((m=l.match(/^__dig (\d+) (\w+)$/)))return{k:"dig",n:+m[1],type:m[2]};
  if(l==="__ramp")return{k:"ramp"};if(l==="__banishchallenger")return{k:"banishChallenger"};if(l==="__scry")return{k:"scry"};
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
  if((m=txt.match(/^(?:you may )?choose one:\s*•\s*(.+)$/i))){const raw=m[1].split(/\s*•\s*/),opts=raw.map(o=>parseEffects(o));if(opts.every(Boolean))return[{k:"modal",opts,optText:raw.map(x=>x.replace(/\.$/,""))}];return null}
  if((m=txt.match(/^if you have a character named ([^,]+?) in play, (.+)$/i))){const e=parseEffects(m[2]);return e?[{k:"cond",name:m[1],eff:e}]:null}
  if((m=txt.match(/^if you have (\d+) or more other characters in play, (.+)$/i))){const e=parseEffects(m[2]);return e?[{k:"cond",count:+m[1],eff:e}]:null}
  const parts=txt.replace(/\.\s*$/,"").split(/\.\s+|,? then,? (?=[a-z])(?!choose and discard)|;\s*/i).filter(Boolean);if(!parts.length)return null;
  const out=[];for(const p of parts){const e=parseOne(p);if(!e)return null;out.push(e)}
  if(out.filter(e=>e.t).length>1)return null; // only one chosen target per ability in v1
  return out;
}
function onceTrig(c,when,e){when=when.toLowerCase();
  if(/^a card is put into your inkwell$/.test(when)){c.onInk.push(...e);return true}
  if(/^this character quests$/.test(when)){c.onQuest.push(...e);return true}
  if(/^you play (a|an) (song|item|character|action|location)$/.test(when)){c.onYouPlay.push({type:when.split(" ").pop(),eff:e,once:true});return true}
  if(/^one of your (?:other )?characters quests$/.test(when)){c.onAllyQuest.push({eff:e,once:true});return true}
  return false}
function normCard(r){
  const type=(r.type||[]).map(x=>x.toLowerCase());
  const c={id:r.id,name:r.name,version:r.version||"",full:r.name+(r.version?" - "+r.version:""),ink:r.ink||null,inks:r.inks||(r.ink?[r.ink]:[]),
    cost:r.cost||0,inkable:!!r.inkwell,type:type.includes("character")?"character":type.includes("location")?"location":type.includes("item")?"item":type.includes("song")?"song":"action",
    str:r.strength||0,wil:r.willpower||0,lore:r.lore||0,move:r.move_cost!=null?r.move_cost:null,text:r.text||"",img:r.img||null,set:r.set,num:r.collector_number,rarity:r.rarity,
    cls:r.classifications||[],kw:{},onPlay:[],onQuest:[],onBanish:[],onStart:[],onEnd:[],onBanishOther:[],onYouPlay:[],onInk:[],onSing:[],onAllyBanished:[],onAllyChallenge:[],onAllyQuest:[],onUnder:[],onChallenge:[],onChallenged:[],onActionPlayed:[],statics:[],acts:[],unsupported:[]};
  c.imgLarge=c.img?c.img.replace("/small/","/normal/"):null;
  const lines=[];for(const ln of String(r.text||"").split("\n").map(x=>x.trim()).filter(Boolean)){if(/^[•·-]\s/.test(ln)&&lines.length)lines[lines.length-1]+=" "+ln;else lines.push(ln)}
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
    else if((m=line.match(/^Whenever one of your (other )?characters is banished( in a challenge)?, (.+)$/i))&&(e=parseEffects(m[3])))c.onAllyBanished.push({other:!!m[1],eff:e});
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
  if(c.onPlay.filter(e=>e.t).length>1){c.unsupported.push("multi-target");c.onPlay=c.onPlay.filter(e=>!e.t);}
  c.supported=c.unsupported.length===0;
  const simulated=c.onSing.length+c.onAllyBanished.length+c.onAllyChallenge.length+c.onAllyQuest.length+c.onUnder.length+(c.alias?1:0)+(c.kw.shiftAny||c.kw.shiftCls?1:0)+(c.kw.boost!=null?1:0)+(c.costRed?1:0)+(c.singTogether?1:0)+c.onBanishOther.length+c.onYouPlay.length+c.onInk.length+c.onPlay.length+c.onQuest.length+c.onBanish.length+c.onStart.length+c.onEnd.length+c.onChallenge.length+c.onChallenged.length+c.onActionPlayed.length+c.statics.length+c.acts.length+(c.entersExerted?1:0)+(c.enterDamage?1:0);
  c.status=!c.text?"plain":c.supported?(simulated?"full":"keywords"):(simulated||Object.keys(c.kw).length?"partial":"vanilla");
  return c;
}

/* ---------- rng / helpers ---------- */
function rng(seed){let a=seed>>>0||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
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
  return st;
}
function mk(st,card,owner){return{uid:st.uid++,card,owner,damage:0,exerted:false,playedOn:-1,tStr:0,lStr:0,tLore:0,tChal:0,noQuest:false,noReady:false,at:null,under:[]}}
function reset(x){x.grants=[];x.noQuestNext=x.noChalNext=x.noQuestNow=x.noChalNow=false;x.damage=0;x.exerted=false;x.tStr=0;x.lStr=0;x.tLore=0;x.tChal=0;x.noQuest=false;x.noReady=false;x.at=null}
const YOU={inks:"ink",plays:"play",shifts:"shift",mulligans:"mulligan",keeps:"keep",ends:"end",reaches:"reach"};
const log=(st,s)=>{s=s.replace(/^You (\w+)/,(m,v)=>"You "+(YOU[v]||v)).replace(/^You keep their hand/,"You keep your hand").replace(/You end their turn/,"You end your turn");st.log.push(s);if(st.log.length>300)st.log.shift()};
const opp=i=>1-i;
const ev=(st,o)=>{(st.events=st.events||[]).push(o)};
function find(st,uid){for(let i=0;i<2;i++){const p=st.players[i];for(const z of["hand","play","deck","discard"]){const x=p[z].find(c=>c.uid===uid);if(x)return{inst:x,pi:i,zone:z}}const k=p.ink.find(c=>c.uid===uid);if(k)return{inst:k,pi:i,zone:"ink"}}return null}
const inkAvail=p=>p.ink.filter(c=>!c.exerted).length;
function costOf(st,pi,c){let n=c.cost;const P=st.players[pi];for(const d of (P.disc||[]))if(d.type===c.type||d.type==="action"&&c.type==="song")n-=d.n;
  if(c.costRed&&c.costRed.perChar)n-=c.costRed.perChar*P.play.filter(x=>x.card.type==="character").length;else if(c.costRed&&c.costRed.secondFirst){if(pi!==st.first&&st.turnNo===2)n-=c.costRed.n}else if(c.costRed&&st.players[pi].play.some(x=>x.card.type==="character"&&x.card.name.toLowerCase()===c.costRed.name.toLowerCase()))n-=c.costRed.n;return Math.max(0,n)}
function payInk(p,n){for(const c of p.ink){if(n<=0)break;if(!c.exerted){c.exerted=true;n--}}}
const isChar=x=>x.card.type==="character",isLoc=x=>x.card.type==="location",isItem=x=>x.card.type==="item";
const dry=(st,x)=>x.playedOn<st.turnNo;
let CUR=null; // current state, for "during your turn" statics
function condOk(x,c){switch(c){case"damaged":return!!x.damage;case"undamaged":return!x.damage;case"exerted":return x.exerted;case"atLoc":return x.at!=null;case"under":return x.under.length>0;case"yourTurn":return!!(CUR&&CUR.active===x.owner);case"oppTurn":return!!(CUR&&CUR.active!==x.owner);
  case"emptyHand":return!!(CUR&&!CUR.players[x.owner].hand.length);case"another":return!!(CUR&&CUR.players[x.owner].play.some(y=>y!==x&&y.card.type==="character"));case"item":return!!(CUR&&CUR.players[x.owner].play.some(y=>y.card.type==="item"));case"defending":return!!x.defending;default:
  if(!CUR)return true;const P=CUR.players[x.owner];
  if(c.startsWith("named:"))return P.play.some(y=>y!==x&&y.card.type==="character"&&y.card.name.toLowerCase()===c.slice(6));
  if(c.startsWith("cls:"))return P.play.some(y=>y!==x&&y.card.cls.some(k=>k.toLowerCase()===c.slice(4).toLowerCase()));
  if(c.startsWith("ink:"))return P.ink.length>=+c.slice(4);
  if(c.startsWith("str:"))return x.card.str+x.tStr>=+c.slice(4);
  return true}}
function hereStatics(x){if(x.at==null||!CUR)return[];const l=CUR.players[x.owner].play.find(y=>y.uid===x.at);return l?l.card.statics.filter(s=>s.here&&(!s.name||namesOf(x).includes(s.name))):[]}
function statOn(x,f){let n=0;for(const s of x.card.statics){if(s.stat!==f||s.here||!condOk(x,s.cond))continue;n+=s.perHand?s.perHand*(CUR?CUR.players[x.owner].hand.length:0):s.perOther?s.perOther*(CUR?CUR.players[x.owner].play.filter(y=>y!==x&&y.card.type==="character").length:0):s.n}
  for(const s of hereStatics(x))if(s.stat===f)n+=s.n;return n}
function K(x,k){const v=x.card.kw[k];if(v!=null)return v;
  for(const g of (x.grants||[])){const [nm,val]=g.kw.split(" ");if(nm===k)return val?parseInt(val):true}
  for(const s of hereStatics(x)){if(!s.kw)continue;const [nm,val]=s.kw.split(" ");if(nm===k)return val?parseInt(val):true}
  for(const s of x.card.statics){if(!s.kw||s.here||!condOk(x,s.cond))continue;const [nm,val]=s.kw.split(" ");if(nm===k)return val?parseInt(val):true}return k==="challenger"||k==="resist"?0:undefined}
const blocked=(x,b)=>x.card.statics.some(s=>s.block===b)||(b==="quest"&&x.noQuestNow)||(b==="challenge"&&x.noChalNow);const flag=(x,f)=>x.card.statics.some(s=>s.flag===f);
const strOf=x=>Math.max(0,x.card.str+x.tStr+(x.lStr||0)+statOn(x,"str"));const loreOf=x=>Math.max(0,x.card.lore+(x.tLore||0)+statOn(x,"lore"));const wilOf=x=>x.card.wil+statOn(x,"wil");

function mulligan(st,pi,uids){
  const p=st.players[pi];if(st.mull[pi])return;
  const back=p.hand.filter(c=>uids.includes(c.uid));p.hand=p.hand.filter(c=>!uids.includes(c.uid));
  for(let k=0;k<back.length&&p.deck.length;k++)p.hand.push(p.deck.pop());
  p.deck.push(...back);shuffle(p.deck,st.r);st.mull[pi]=true;
  log(st,`${p.name} ${back.length?"mulligans "+back.length+" card"+(back.length>1?"s":""):"keeps their hand"}.`);
  if(st.mull[0]&&st.mull[1]){st.phase="main";st.turnNo=1;st.active=st.first;startTurn(st)}
}
function draw(st,pi,n){const p=st.players[pi];for(let k=0;k<n;k++){if(!p.deck.length){lose(st,pi,"had to draw from an empty deck");return false}const c=p.deck.pop();p.hand.push(c);ev(st,{t:"draw",pi,uid:c.uid})}return true}
function lose(st,pi,why){if(st.winner!=null)return;st.winner=opp(pi);st.phase="over";log(st,`${st.players[pi].name} ${why}. ${st.players[opp(pi)].name} wins!`)}
function gain(st,pi,n){const p=st.players[pi];p.lore+=n;if(n)ev(st,{t:"lore",pi,n});if(p.lore>=20&&st.winner==null){st.winner=pi;st.phase="over";log(st,`${p.name} reaches ${p.lore} lore and wins!`)}}
function startTurn(st){
  const pi=st.active,p=st.players[pi];p.inked=false;p.disc=[];p.boosted=new Set();
  p.ink.forEach(c=>c.exerted=false);p.play.forEach(c=>{const nrh=c.card.statics.find(s=>s.noReadyHand);if(c.noReady)c.noReady=false;else if(!(nrh&&p.hand.length>=nrh.noReadyHand))c.exerted=false;c.lStr=0;c.noQuestNow=!!c.noQuestNext;c.noChalNow=!!c.noChalNext;c.noQuestNext=c.noChalNext=false});
  for(const q of st.players)q.play.forEach(c=>{c.grants=(c.grants||[]).filter(g=>!(g.until==="srcStart"&&g.src===pi))});           // ready (long debuffs from this player expire)
  st.players[opp(pi)].play.forEach(c=>{if(c.lSrc===pi){c.lStr=0;c.lSrc=null}});
  log(st,`-- Turn ${st.turnNo}: ${p.name} --`);ev(st,{t:"turn",pi});
  for(const l of p.play.filter(isLoc))if(l.card.lore){gain(st,pi,l.card.lore);log(st,`${l.card.name} gives ${p.name} ${l.card.lore} lore.`)} // set
  if(st.winner!=null)return;
  for(const x of [...p.play])if(x.card.onStart.length){resolve(st,pi,x.card.onStart,autoTarget(st,pi,x.card.onStart),x);if(st.winner!=null)return}
  if(!(st.turnNo===1&&pi===st.first))draw(st,pi,1);                              // draw
}
function endTurn(st){
  const pi=st.active;for(const x of [...st.players[pi].play])if(x.card.onEnd.length){resolve(st,pi,x.card.onEnd,autoTarget(st,pi,x.card.onEnd),x);if(st.winner!=null)return}
  st.players.forEach(p=>p.play.forEach(c=>{c.tStr=0;c.tLore=0;c.tChal=0;c.noQuest=false;c.grants=(c.grants||[]).filter(g=>g.until!=="turnEnd"&&!(g.until==="ownerTurnEnd"&&c.owner===st.active));if(c.owner===st.active){c.noQuestNow=c.noChalNow=false}}));
  st.active=opp(st.active);st.turnNo++;startTurn(st);
}
function banish(st,x){
  const f=find(st,x.uid);if(!f||f.zone!=="play")return;const p=st.players[f.pi];
  p.play=p.play.filter(c=>c!==x);reset(x);
  if(isLoc(x))p.play.forEach(c=>{if(c.at===x.uid)c.at=null});
  p.discard.push(...x.under,x);x.under=[];log(st,`${x.card.full} is banished.`);ev(st,{t:"banish",uid:x.uid,pi:f.pi});(st.stats=st.stats||[{},{}])[opp(f.pi)].banished=((st.stats[opp(f.pi)].banished)||0)+1;
  if(x.card.onBanish.length&&st.winner==null){const effs=x.card.onBanish.filter(e=>!e.challengedOnly||(st._challenger!=null&&st._challenger!==x.uid&&st.active!==f.pi));if(effs.length)resolve(st,f.pi,effs,autoTarget(st,f.pi,effs),x)}
  if(isChar(x)&&st.winner==null)for(const y of [...p.play])for(const h of y.card.onAllyBanished){resolve(st,f.pi,h.eff,autoTarget(st,f.pi,h.eff),y)}
}
function damage(st,x,n){if(n<=0)return;const d=Math.max(0,n-(K(x,'resist')||0));x.damage+=d;ev(st,{t:"damage",uid:x.uid,n:d});if(wilOf(x)&&x.damage>=wilOf(x))banish(st,x)}

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
      if(t.other&&CUR&&CUR._src&&x.uid===CUR._src)continue;
      if(t.maxStr!=null&&strOf(x)>t.maxStr)continue;if(t.maxCost!=null&&x.card.cost>t.maxCost)continue;
      out.push(x.uid);
    }
  }
  return out;
}
const needsTarget=effs=>effs.find(e=>e.t);
function yp(st,pi,x){const t=x.card.type,fl=x.card.cls.includes("Floodborn");for(const y of [...st.players[pi].play]){if(y===x)continue;for(const h of y.card.onYouPlay){
  let ok=h.type===t||h.type==="action"&&t==="song"||h.type==="floodborn character"&&fl&&t==="character"||h.type==="actionOnly"&&t==="action"||h.type==="another character"&&t==="character";
  if(h.name&&x.card.name.toLowerCase()!==h.name)ok=false;if(h.kw&&!x.card.kw[h.kw])ok=false;if(ok&&h.once){if(y.onceP===st.turnNo)ok=false;else y.onceP=st.turnNo}
  if(ok)resolve(st,pi,h.eff,autoTarget(st,pi,h.eff),y)}if(st.winner!=null)return}}
function playFree(st,pi,x,exerted){const p=st.players[pi],c=x.card;p.hand=p.hand.filter(h=>h!==x);ev(st,{t:"play",pi,uid:x.uid,name:c.full});log(st,`${p.name} plays ${c.full} for free.`);
  if(c.type==="action"||c.type==="song"){resolve(st,pi,c.onPlay,autoTarget(st,pi,c.onPlay),x,true);p.discard.push(x);return}
  reset(x);x.playedOn=st.turnNo;p.play.push(x);if(exerted||c.entersExerted)x.exerted=true;resolve(st,pi,c.onPlay,autoTarget(st,pi,c.onPlay),x);yp(st,pi,x)}
function discardPri(x){return x.card.cost+(x.card.inkable?0:1)}
function resolve(st,pi,effs,tgt,src,fromAction){st._src=src?src.uid:null;
  let last=null;
  for(const e of effs){
    const T=(e.t||e.rider)&&tgt!=null?find(st,tgt):null,x=T&&T.zone==="play"?T.inst:null;
    if(st._decline&&e.may)continue;
    if((e.t||e.rider)&&!x)continue;
    if(fromAction&&x&&e.t&&T.pi!==pi&&K(x,"vanish")){banish(st,x);continue}
    const me=st.players[pi],o=st.players[opp(pi)],self=src&&find(st,src.uid)?.zone==="play"?src:null;
    if(e.payInk){if(inkAvail(me)<e.payInk)continue;payInk(me,e.payInk)}
    switch(e.k){
      case"draw":draw(st,pi,e.n);break;
      case"pay":if(inkAvail(me)>=e.n){payInk(me,e.n);resolve(st,pi,e.eff,tgt,src,fromAction)}break;
      case"toInk":{const P=st.players[T.pi];P.play=P.play.filter(c=>c!==x);reset(x);x.exerted=true;P.ink.push(x);P.discard.push(...x.under);x.under=[];log(st,`${x.card.full} goes into the inkwell.`);break}
      case"moveDmg":{const n=Math.min(e.n,x.damage);if(!n)break;const ts=o.play.filter(isChar).filter(c=>!K(c,"ward")).sort((a,b)=>(wilOf(a)-a.damage<=n?-100:0)-(wilOf(b)-b.damage<=n?-100:0)||instVal(b)-instVal(a));if(!ts.length)break;x.damage-=n;ts[0].damage+=n;ev(st,{t:"damage",uid:ts[0].uid,n});if(ts[0].damage>=wilOf(ts[0]))banish(st,ts[0]);break}
      case"shuffleIn":{const P=st.players[T.pi];P.play=P.play.filter(c=>c!==x);reset(x);P.deck.push(x,...x.under);x.under=[];shuffle(P.deck,st.r);break}
      case"reveal":{if(!me.deck.length)break;const c=me.deck[me.deck.length-1];const ok=c.card.type===e.type||e.type==="action"&&c.card.type==="song";log(st,`${me.name} reveals ${c.card.full}.`);
        if(ok){me.deck.pop();if(e.to==="hand")me.hand.push(c);else{me.hand.push(c);playFree(st,pi,c,e.to==="playex")}}break}
      case"free":{const opts=me.hand.filter(h=>(h.card.type===e.type||e.type==="action"&&h.card.type==="song")&&h.card.cost<=e.max);if(!opts.length)break;
        if(st.human[pi]){st.pending={pi,kind:"free",opts:opts.map(h=>h.uid),why:`Choose a ${e.type} to play for free`,optional:true};break}
        playFree(st,pi,opts.sort((a,b)=>b.card.cost-a.card.cost)[0]);break}
      case"freeMove":{const l=me.play.find(isLoc),c=me.play.filter(y=>isChar(y)&&y.at==null).sort((a,b)=>b.card.cost-a.card.cost)[0];if(l&&c){c.at=l.uid;log(st,`${c.card.name} moves to ${l.card.name}.`)}break}
      case"teamBuff":case"teamGrant":for(const y of me.play.filter(c=>isChar(c)&&(!e.other||c!==self)&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls)))){if(e.k==="teamGrant")y.grants.push({kw:e.kw,until:e.long?"srcStart":"turnEnd",src:pi});else if(e.stat==="lore")y.tLore+=e.n;else y.tStr+=e.n}break;
      case"teamBuffV":break;case"readyItem":{const it=me.play.find(c=>isItem(c)&&c.exerted);if(it)it.exerted=false;break}
      case"underToHand":if(self){me.hand.push(...self.under);self.under=[]}break;
      case"drain":gain(st,pi,e.g);o.lore=Math.max(0,o.lore-e.lo);break;
      case"massState":{const ps=e.who==="opposing"?[o]:e.who==="your"?[me]:[me,o];for(const P of ps){if(e.what.includes("inkwell"))P.ink.forEach(c=>c.exerted=e.to==="exert");else P.play.filter(c=>e.what==="items"?isItem(c):isChar(c)).filter(c=>!e.damaged||c.damage).forEach(c=>c.exerted=e.to==="exert")}break}
      case"massReady":me.play.filter(c=>isChar(c)&&(!e.other||c!==self)&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls))&&c.card.cost<=e.max).forEach(c=>c.exerted=false);break;
      case"discardHand":me.discard.push(...me.hand);me.hand=[];break;
      case"selfDiscard":if(st.human[pi]){if(me.hand.length)st.pending={pi,n:e.n,why:"Choose a card to discard"};break}for(let k=0;k<e.n&&me.hand.length;k++){me.hand.sort((a,b)=>discardPri(b)-discardPri(a));me.discard.push(me.hand.shift())}break;
      case"mill":for(let k=0;k<e.n&&me.deck.length;k++)me.discard.push(me.deck.pop());break;
      case"banishAllX":{const ps=e.what.startsWith("opposing")?[o]:[me,o];for(const P of ps)[...P.play.filter(c=>(e.what.endsWith("items")?isItem(c):isChar(c))&&(e.maxStr==null||strOf(c)<=e.maxStr))].forEach(c=>banish(st,c));break}
      case"discardToInk":{const c=me.discard.filter(isChar).pop();if(c){me.discard.splice(me.discard.indexOf(c),1);reset(c);c.exerted=true;me.ink.push(c)}break}
      case"handToInk":{if(!me.hand.length)break;me.hand.sort((a,b)=>discardPri(b)-discardPri(a));const c=me.hand.shift();c.exerted=false;me.ink.push(c);break}
      case"drawAll":draw(st,pi,e.n);draw(st,opp(pi),e.n);break;
      case"gainLore":gain(st,pi,e.n);break;
      case"oppLose":{if(e.ifMore&&o.lore<=me.lore)break;o.lore=Math.max(0,o.lore-e.n);break}
      case"dmgAllOpp":[...st.players[opp(pi)].play.filter(isChar)].forEach(c=>damage(st,c,e.n));break;
      case"dmg":if(e.counters){x.damage+=e.n;ev(st,{t:"damage",uid:x.uid,n:e.n});if(x.damage>=wilOf(x))banish(st,x)}else damage(st,x,e.n);break;
      case"banish":banish(st,x);break;
      case"bounce":{const o=st.players[T.pi];o.play=o.play.filter(c=>c!==x);const cards=[...x.under,x];x.under=[];
        if(isLoc(x))o.play.forEach(c=>{if(c.at===x.uid)c.at=null});
        cards.forEach(c=>{c.damage=0;c.exerted=false;c.tStr=0;c.at=null;st.players[c.owner].hand.push(c)});log(st,`${x.card.full} returns to hand.`);break}
      case"heal":x.damage=Math.max(0,x.damage-e.n);break;
      case"healAll":st.players[pi].play.filter(c=>isChar(c)&&(!e.cls||c.card.cls.some(k=>k.toLowerCase()===e.cls))).forEach(c=>c.damage=Math.max(0,c.damage-e.n));break;
      case"buffStr":x.tStr+=e.n;break;
      case"exert":x.exerted=true;break;
      case"ready":x.exerted=false;break;
      case"loot":{draw(st,pi,e.n);if(st.human[pi]){st.pending={pi,n:e.d,why:"Choose a card to discard"};break}const h=st.players[pi].hand;for(let k=0;k<e.d&&h.length;k++){h.sort((a,b)=>discardPri(b)-discardPri(a));st.players[pi].discard.push(h.shift())}break}
      case"debuff":if(e.long){x.lStr-=e.n;x.lSrc=pi}else x.tStr-=e.n;if(e.reckless){x.grants=x.grants||[];x.grants.push({kw:"reckless",until:e.long?"ownerTurnEnd":"turnEnd",src:pi})}break;
      case"buffLore":x.tLore+=e.n;break;
      case"buffChal":x.tChal+=e.n;break;
      case"oppDiscard":{if(e.nonChar){const ok=o.hand.filter(h=>!isChar(h)).sort((a,b)=>b.card.cost-a.card.cost);if(ok.length){o.hand.splice(o.hand.indexOf(ok[0]),1);o.discard.push(ok[0])}break}if(st.human[opp(pi)]){st.pending={pi:opp(pi),n:e.n,why:"Your opponent makes you discard"};break}for(let k=0;k<e.n&&o.hand.length;k++){o.hand.sort((a,b)=>discardPri(b)-discardPri(a));o.discard.push(o.hand.shift())}break}
      case"recur":{const d=st.players[pi].discard,cs=d.filter(c=>(c.card.type===(e.type||"character")||e.type==="action"&&c.card.type==="song")&&(!e.name||c.card.name.toLowerCase()===e.name)&&(e.max==null||c.card.cost<=e.max)).sort((a,b)=>b.card.cost-a.card.cost);for(const c of cs.slice(0,e.n||1)){d.splice(d.indexOf(c),1);reset(c);st.players[pi].hand.push(c)}break}
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
      case"oppExert":{const r=o.play.filter(c=>isChar(c)&&!c.exerted).sort((a,b)=>loreOf(a)-loreOf(b))[0];if(r)r.exerted=true;break}
      case"oppBanish":{const r=o.play.filter(isChar).sort((a,b)=>a.card.cost-b.card.cost)[0];if(r)banish(st,r);break}
      case"payDraw":if(inkAvail(me)>=e.n){payInk(me,e.n);draw(st,pi,1)}break;
      case"banishSelf":if(self)banish(st,self);break;
      case"dmgSelf":if(self)damage(st,self,e.n);break;
      case"dig":{if(st.human[pi]){const top=me.deck.slice(Math.max(0,me.deck.length-e.n));const ok=top.filter(c=>e.type==="any"||c.card.type===e.type||e.type==="action"&&c.card.type==="song");
          st.pending={pi,kind:"dig",top:top.map(c=>c.uid),opts:ok.map(c=>c.uid),n:e.take||1,why:`Look at the top ${top.length}: choose ${e.take>1?"up to "+e.take+" cards":"a card"} for your hand`,optional:true};break}
        if(e.take>1){for(let k=0;k<e.take;k++)resolve(st,pi,[{k:"dig",n:e.n-k,type:e.type}],null,src);break}
        const top=me.deck.splice(Math.max(0,me.deck.length-e.n),e.n);const ok=top.filter(c=>e.type==="any"||c.card.type===e.type||e.type==="action"&&c.card.type==="song").sort((a,b)=>b.card.cost-a.card.cost);
        const pick=ok[0];if(pick){top.splice(top.indexOf(pick),1);me.hand.push(pick)}me.deck.unshift(...top);break}
      case"scry":break;
      case"banishChallenger":{if(st._challenger!=null){const f2=find(st,st._challenger);if(f2&&f2.zone==="play")banish(st,f2.inst)}break}
      case"returnSelf":{if(!src)break;const P=st.players[src.owner],i=P.discard.indexOf(src);if(i>=0){P.discard.splice(i,1);reset(src);P.hand.push(src)}break}
      case"inkSelf":{if(!src)break;const P=st.players[src.owner],i=P.discard.indexOf(src);if(i>=0){P.discard.splice(i,1);reset(src);src.exerted=true;P.ink.push(src)}break}
      case"discount":me.disc=me.disc||[];me.disc.push({n:e.n,type:e.type});break;
      case"banishAll":for(const q of st.players)[...q.play.filter(isChar)].forEach(c=>banish(st,c));break;
      case"rampAll":for(const q of st.players)for(let k=0;k<e.n&&q.deck.length;k++){const c=q.deck.pop();c.exerted=true;q.ink.push(c)}break;
      case"cond":{if(e.oppMore){const ok=(e.oppMore==="hand"?o.hand.length>me.hand.length:o.ink.length>me.ink.length);if(ok)resolve(st,pi,e.eff,autoTarget(st,pi,e.eff),src,fromAction);break}
        if(e.emptyHand){if(!me.hand.length)resolve(st,pi,e.eff,autoTarget(st,pi,e.eff),src,fromAction);break}
        if(e.songThisTurn){if(me.songTurn===st.turnNo)resolve(st,pi,e.eff,autoTarget(st,pi,e.eff),src,fromAction);break}
        {const P2=me;let c2=null;if(e.hasCls)c2=P2.play.some(y=>y!==self&&y.card.type==="character"&&y.card.cls.some(k=>k.toLowerCase()===e.hasCls));
         else if(e.hasLoc)c2=P2.play.some(isLoc);else if(e.shifted)c2=!!(self&&self.shiftedOn===st.turnNo);else if(e.playedOther)c2=(P2.playedChars||0)>(self&&self.playedOn===st.turnNo?1:0)&&P2.playedTurn===st.turnNo;
         else if(e.under)c2=!!(self&&self.under.length);else if(e.oppExerted)c2=o.play.some(y=>isChar(y)&&y.exerted);
         if(c2!==null){if(c2)resolve(st,pi,e.eff,autoTarget(st,pi,e.eff),src,fromAction);break}}
        if(e.atLoc){if(self&&self.at!=null)resolve(st,pi,e.eff,autoTarget(st,pi,e.eff),src,fromAction);break}
        const ok=e.name?me.play.some(c=>isChar(c)&&c.card.name.toLowerCase()===e.name.toLowerCase()):me.play.filter(c=>isChar(c)&&c!==self).length>=e.count;if(ok)resolve(st,pi,e.eff,autoTarget(st,pi,e.eff),src,fromAction);break}
      case"modal":{if(st._mode!=null){const o=e.opts[st._mode];resolve(st,pi,o,tgt,src,fromAction);break}let best=e.opts[0],bv=-1e9;for(const o of e.opts){const v=effVal(st,pi,o,autoTarget(st,pi,o));if(v>bv){bv=v;best=o}}resolve(st,pi,best,autoTarget(st,pi,best),src,fromAction);break}
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
  let chars=o.play.filter(x=>isChar(x)&&(x.exerted||flag(a,"challengeReady"))&&!blocked(x,"challenged")&&(!K(x,'evasive')||K(a,'evasive')||K(a,'alert')));
  const bg=chars.filter(x=>K(x,'bodyguard'));if(bg.length)chars=bg;
  return[...chars,...o.play.filter(isLoc)].map(x=>x.uid);
}
function canChallenge(st,pi,a){return isChar(a)&&!blocked(a,"challenge")&&!a.exerted&&(dry(st,a)||K(a,'rush'))}
function legalActions(st){
  CUR=st;if(st.phase!=="main"||st.winner!=null)return[];
  if(st.pending){const P=st.pending;if(P.kind==="dig"||P.kind==="free")return[...P.opts.map(u=>({t:"pick",uid:u})),{t:"pickDone"}];return st.players[P.pi].hand.map(h=>({t:"discard",uid:h.uid}))}
  const pi=st.active,p=st.players[pi],ink=inkAvail(p),A=[];
  for(const h of p.hand){
    const c=h.card;
    if(!p.inked&&c.inkable)A.push({t:"ink",uid:h.uid});
    if(costOf(st,pi,c)<=ink){A.push(...withTargets(st,pi,{t:"play",uid:h.uid},c.onPlay));if(c.kw.bodyguard&&c.type==="character")A.push(...withTargets(st,pi,{t:"play",uid:h.uid,exerted:true},c.onPlay))}
    if(c.singTogether){const sg=p.play.filter(x=>isChar(x)&&!x.exerted&&dry(st,x)&&!blocked(x,"sing")).sort((a,b)=>a.card.cost-b.card.cost);let tot=0,set=[];for(const x of sg){if(tot>=c.singTogether)break;set.push(x.uid);tot+=x.card.cost}
      if(tot>=c.singTogether&&set.length>1)A.push(...withTargets(st,pi,{t:"play",uid:h.uid,singers:set.join(",")},c.onPlay))}
    if(c.kw.shift!=null&&c.kw.shift<=ink)for(const b of p.play.filter(x=>isChar(x)&&(c.kw.shiftAny||(c.kw.shiftCls?x.card.cls.some(k=>k.toLowerCase()===c.kw.shiftCls):namesOf(x).includes(c.name.toLowerCase())||(c.alias||[]).some(a=>namesOf(x).includes(a))))))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,shift:b.uid},c.onPlay));
    if(c.type==="song")for(const s of p.play.filter(x=>isChar(x)&&!x.exerted&&dry(st,x)&&!blocked(x,"sing")&&(x.card.kw.singer!=null?x.card.kw.singer:x.card.cost)>=c.cost))
      A.push(...withTargets(st,pi,{t:"play",uid:h.uid,singer:s.uid},c.onPlay));
  }
  for(const x of p.play){
    if(isChar(x)&&!x.exerted&&dry(st,x)&&!K(x,'reckless')&&!blocked(x,"quest")&&!x.noQuest&&loreOf(x)>0)A.push(...(st.human[pi]?withTargets(st,pi,{t:"quest",uid:x.uid},x.card.onQuest):[{t:"quest",uid:x.uid}]));
    if(canChallenge(st,pi,x))for(const t of challengeTargets(st,pi,x))A.push({t:"challenge",uid:x.uid,target:t});
    if(isChar(x))for(const l of p.play.filter(isLoc))if(x.at!==l.uid&&l.card.move!=null&&l.card.move<=ink)A.push({t:"move",uid:x.uid,loc:l.uid});
    if(x.card.kw.boost!=null&&isChar(x)&&!(p.boosted&&p.boosted.has(x.uid))&&x.card.kw.boost<=ink&&p.deck.length)A.push({t:"boost",uid:x.uid});
    x.card.acts.forEach((ab,i)=>{if((ab.noExert||!x.exerted)&&(!isChar(x)||dry(st,x))&&ab.ink<=ink)A.push(...withTargets(st,pi,{t:"act",uid:x.uid,i},ab.eff))});
  }
  const mustChallenge=p.play.some(x=>K(x,'reckless')&&canChallenge(st,pi,x)&&challengeTargets(st,pi,x).length);
  if(!mustChallenge)A.push({t:"end"});
  return A;
}
function isLegal(st,a){return legalActions(st).some(b=>b.t===a.t&&b.uid===a.uid&&(b.target??null)===(a.target??null)&&(b.shift??null)===(a.shift??null)&&(b.singer??null)===(a.singer??null)&&(b.loc??null)===(a.loc??null)&&(b.i??null)===(a.i??null)&&(b.t!=="pick"||true)&&(b.singers??null)===(a.singers??null)&&(b.mode??null)===(a.mode??null)&&!!b.decline===!!a.decline&&!!b.exerted===!!a.exerted)}

function act(st,a){
  CUR=st;if(!isLegal(st,a))throw new Error("Illegal action "+JSON.stringify(a));
  if(a.t==="pick"||a.t==="pickDone"){const P=st.pending,me=st.players[P.pi];
    if(P.kind==="free"){st.pending=null;if(a.t==="pick")playFree(st,P.pi,me.hand.find(h=>h.uid===a.uid));return st}
    if(a.t==="pick"){const c=me.deck.find(d=>d.uid===a.uid);me.deck.splice(me.deck.indexOf(c),1);me.hand.push(c);log(st,`${me.name} puts a card into their hand.`);P.opts=P.opts.filter(u=>u!==a.uid);P.top=P.top.filter(u=>u!==a.uid);P.n--}
    if(a.t==="pickDone"||P.n<=0||!P.opts.length){const rest=me.deck.filter(d=>P.top.includes(d.uid));me.deck=me.deck.filter(d=>!P.top.includes(d.uid));me.deck.unshift(...rest);st.pending=null}
    return st}
  if(a.t==="discard"){const P=st.players[st.pending.pi],x=P.hand.find(h=>h.uid===a.uid);P.hand=P.hand.filter(h=>h!==x);P.discard.push(x);log(st,`${P.name} discards ${x.card.full}.`);if(--st.pending.n<=0||!P.hand.length)st.pending=null;return st}
  st._mode=a.mode??null;st._decline=!!a.decline;const pi=st.active,p=st.players[pi],o=st.players[opp(pi)];
  const F=a.uid!=null?find(st,a.uid):null,x=F&&F.inst;
  switch(a.t){
    case"ink":p.hand=p.hand.filter(c=>c!==x);x.exerted=false;p.ink.push(x);p.inked=true;ev(st,{t:"ink",pi,uid:x.uid});log(st,`${p.name} inks ${x.card.full}.`);
      for(const y of [...p.play])if(y.card.onInk.length&&!y.inkUsed){y.inkUsed=st.turnNo;resolve(st,pi,y.card.onInk,autoTarget(st,pi,y.card.onInk),y)}break;
    case"play":{
      const c=x.card;p.hand=p.hand.filter(h=>h!==x);ev(st,{t:"play",pi,uid:x.uid,name:c.full});
      if(c.type==="song")p.songTurn=st.turnNo;
      if(a.singer!=null){const s=find(st,a.singer).inst;s.exerted=true;log(st,`${s.card.name} sings ${c.name}.`);if(s.card.onSing.length)resolve(st,pi,s.card.onSing,autoTarget(st,pi,s.card.onSing),s)}
      else if(a.singers){a.singers.split(",").forEach(u=>find(st,+u).inst.exerted=true);log(st,`Characters sing ${c.name} together.`)}
      else if(a.shift!=null){payInk(p,c.kw.shift)}else{payInk(p,costOf(st,pi,c));if(p.disc&&p.disc.length)p.disc=p.disc.filter(d=>!(d.type===c.type||d.type==="action"&&c.type==="song"))}
      if(c.type==="action"||c.type==="song"){if(a.singer==null&&!a.singers)log(st,`${p.name} plays ${c.full}.`);p.play.forEach(y=>y.card.onActionPlayed.forEach(e=>{if(e.k==="selfStr")y.tStr+=e.n}));resolve(st,pi,c.onPlay,a.target,x,true);p.discard.push(x);yp(st,pi,x);break}
      x.playedOn=st.turnNo;reset(x);if(c.type==="character"){p.playedChars=p.playedTurn===st.turnNo?(p.playedChars||0)+1:1;p.playedTurn=st.turnNo}
      if(a.shift!=null){const b=find(st,a.shift).inst;const idx=p.play.indexOf(b);x.damage=b.damage;x.exerted=b.exerted;x.playedOn=b.playedOn;x.at=b.at;x.under=[...b.under,b];b.under=[];x.shiftedOn=st.turnNo;b.at=null;p.play[idx]=x;log(st,`${p.name} shifts ${c.full} onto ${b.card.name}.`)}
      else{p.play.push(x);if(c.entersExerted||a.exerted&&c.kw.bodyguard)x.exerted=true;log(st,`${p.name} plays ${c.full}.`);if(c.enterDamage)damage(st,x,c.enterDamage)}
      resolve(st,pi,c.onPlay,a.target,x);yp(st,pi,x);break}
    case"quest":{x.exerted=true;const lv=loreOf(x);ev(st,{t:"quest",pi,uid:x.uid,n:lv});log(st,`${x.card.full} quests for ${lv} lore.`);
      if(x.card.kw.support){const others=p.play.filter(c=>isChar(c)&&c!==x);if(others.length){const t=(a.support!=null&&others.find(o=>o.uid===a.support))||others.sort((a,b)=>b.card.lore-a.card.lore)[0];t.tStr+=strOf(x);log(st,`Support: ${t.card.name} gets +${strOf(x)} strength.`)}}
      gain(st,pi,lv);if(st.winner==null)for(const y of [...p.play])for(const h of y.card.onAllyQuest){if(y===x&&!h.cls)continue;if(h.cls&&!x.card.cls.some(k=>k.toLowerCase()===h.cls))continue;if(h.once){if(y.onceT===st.turnNo)continue;y.onceT=st.turnNo}resolve(st,pi,h.eff,autoTarget(st,pi,h.eff),y)}
      if(st.winner==null)resolve(st,pi,x.card.onQuest,a.target!=null?a.target:autoTarget(st,pi,x.card.onQuest),x);break}
    case"challenge":{const d=find(st,a.target).inst;x.exerted=true;
      const as=strOf(x)+(K(x,'challenger')||0)+x.tChal,ds=isLoc(d)?0:strOf(d);
      log(st,`${x.card.name} challenges ${d.card.name}.`);ev(st,{t:"challenge",pi,a:x.uid,d:d.uid});
      if(x.card.onChallenge.length)resolve(st,pi,x.card.onChallenge,autoTarget(st,pi,x.card.onChallenge),x);
      for(const y of p.play)if(y!==x&&y.card.onAllyChallenge.length)resolve(st,pi,y.card.onAllyChallenge,autoTarget(st,pi,y.card.onAllyChallenge),y);
      st._challenger=x.uid;
      if(d.card.onChallenged.length)resolve(st,opp(pi),d.card.onChallenged,autoTarget(st,opp(pi),d.card.onChallenged),d);
      if(st.winner!=null)break;const dIn=find(st,d.uid)?.zone==="play";d.defending=true;const ds2=isLoc(d)?0:strOf(d);d.defending=false;damage(st,d,as);damage(st,x,ds2);
      st._challenger=null;
      if(dIn&&find(st,d.uid)?.zone!=="play"&&find(st,x.uid)?.zone==="play"&&x.card.onBanishOther.length)resolve(st,pi,x.card.onBanishOther,autoTarget(st,pi,x.card.onBanishOther),x);break}
    case"move":{const l=find(st,a.loc).inst;payInk(p,l.card.move);x.at=l.uid;ev(st,{t:"move",pi,uid:x.uid,loc:l.uid});log(st,`${x.card.name} moves to ${l.card.name}.`);break}
    case"act":{const ab=x.card.acts[a.i];if(!ab.noExert)x.exerted=true;payInk(p,ab.ink);log(st,`${x.card.name} uses an ability.`);resolve(st,pi,ab.eff,a.target,x);if(ab.sac)banish(st,x);break}
    case"boost":payInk(p,x.card.kw.boost);x.under.push(p.deck.pop());p.boosted.add(x.uid);log(st,`${x.card.name} boosts (card put under it).`);
      for(const y of [...p.play])if(y.card.onUnder.length)resolve(st,pi,y.card.onUnder,autoTarget(st,pi,y.card.onUnder),y);break;
    case"end":log(st,`${p.name} ends their turn.`);endTurn(st);break;
  }
  st._mode=null;st._decline=false;
  if(a.t!=="end"&&a.t!=="discard"){const S2=(st.stats=st.stats||[{},{}])[pi];S2[a.t]=(S2[a.t]||0)+1}
  return st;
}
function autoTarget(st,pi,effs){if(effs&&effs.some(e=>e.t&&e.t.other)){}const nt=needsTarget(effs||[]);if(!nt)return null;const ts=targets(st,pi,nt.t);if(!ts.length)return null;
  const good=nt.t.helpful;return ts.map(u=>find(st,u)).sort((a,b)=>((good?(b.pi===pi):(b.pi!==pi))-(good?(a.pi===pi):(a.pi!==pi)))||b.inst.card.cost-a.inst.card.cost)[0].inst.uid}

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
      case"ramp":v+=4;break;case"toInk":if(x)v+=mine?-6:instVal(x)*0.9;break;case"moveDmg":v+=e.n*2;break;case"shuffleIn":if(x)v+=mine?-10:instVal(x);break;
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
function scoreAction(st,a){
  const pi=st.active,p=st.players[pi],o=st.players[opp(pi)],F=a.uid!=null?find(st,a.uid):null,x=F&&F.inst;
  switch(a.t){
    case"ink":{const c=x.card,ink=p.ink.length;if(ink>=8&&p.hand.length<4)return -1;
      const dup=p.hand.filter(h=>h.card.name===c.name).length>1?6:0;return 200-c.lore*3-(c.cost<=ink+1?c.cost*2:0)+dup+(c.cost>ink+3?8:0)}
    case"play":{const c=x.card,effs=a.mode!=null?c.onPlay.find(e=>e.k==="modal").opts[a.mode]:c.onPlay;let s=100+c.cost*4+effVal(st,pi,effs,a.target)+(a.exerted?(p.play.some(y=>isChar(y)&&loreOf(y)>=2)?3:-6):0)-(a.decline?3:0);
      if(c.type==="character")s+=c.lore*3;if(a.shift!=null)s+=10;
      if(a.singer!=null){const sg=find(st,a.singer).inst;s+=c.cost*2-sg.card.lore*5}
      if((c.type==="action"||c.type==="song")&&effVal(st,pi,c.onPlay,a.target)<=0)s=-1;
      return s}
    case"act":{const ab=x.card.acts[a.i],v=effVal(st,pi,ab.eff,a.target);return v<=0?-1:60+v-(isChar(x)?x.card.lore*4:0)-ab.ink}
    case"challenge":{const d=find(st,a.target).inst,as=strOf(x)+(K(x,'challenger')||0);
      const kills=d.damage+Math.max(0,as-(K(d,'resist')||0))>=wilOf(d),dies=!isLoc(d)&&x.damage+Math.max(0,strOf(d)-(K(x,'resist')||0))>=wilOf(x);
      let v=(kills?instVal(d)+(isLoc(d)?d.card.lore*3:0):as)-(dies?instVal(x):0)-(K(x,'reckless')?0:x.card.lore*4);
      if(K(x,'reckless'))v+=50;return v>0?70+v:(K(x,'reckless')?10+v/100:-1)}
    case"quest":return 50+x.card.lore*6+(p.lore+x.card.lore>=20?500:0);
    case"move":{if(!LEVEL||LEVEL==="easy")return -1;const l=find(st,a.loc).inst;const ben=l.card.statics.length||l.card.text?6:2;return x.at==null?14+ben-l.card.move*2:-1}case"boost":return x.card.statics.some(s=>s.cond==="under")||x.card.onQuest.length?45:-1;
    case"end":return 0;
  }
  return -1;
}
let LEVEL="normal";
function cloneState(st){const cp=x=>({...x,under:[...x.under],grants:[...(x.grants||[])]});
  return{...st,r:rng((st.seed+st.turnNo*7919+(st.log.length))>>>0),log:[],events:[],stats:[{},{}],pending:st.pending?{...st.pending}:null,mull:[...st.mull],
    players:st.players.map(p=>({...p,deck:p.deck.map(cp),hand:p.hand.map(cp),ink:p.ink.map(cp),play:p.play.map(cp),discard:p.discard.map(cp),disc:[...(p.disc||[])],boosted:new Set(p.boosted||[])}))}}
function evalBoard(st,pi){
  if(st.winner!=null)return st.winner===pi?1e6:-1e6;
  const me=st.players[pi],op=st.players[opp(pi)];let v=(me.lore-op.lore)*12+Math.min(me.ink.length,8)*3+me.hand.length*2-op.hand.length*1.5;
  const opChars=op.play.filter(isChar);
  for(const x of me.play){if(!isChar(x)){v+=x.card.cost*1.5+(isLoc(x)?x.card.lore*6:0);continue}
    let val=instVal(x)*(1-x.damage/Math.max(1,wilOf(x))*0.4);
    if(x.exerted&&opChars.some(o=>strOf(o)+(K(o,"challenger")||0)>=wilOf(x)-x.damage&&(!K(x,"evasive")||K(o,"evasive"))))val*=0.45; // exposed to a lethal challenge
    v+=val+loreOf(x)*3}
  for(const x of op.play){if(!isChar(x)){v-=x.card.cost*1.5+(isLoc(x)?x.card.lore*6:0);continue}v-=instVal(x)*(1-x.damage/Math.max(1,wilOf(x))*0.4)+loreOf(x)*5}
  if(op.lore+opChars.reduce((a,x)=>a+loreOf(x),0)>=20)v-=400; // they threaten to win next turn
  return v}
function hardChoose(st,A){const pi=st.active,base=evalBoard(st,pi);let best=null,bs=-Infinity;
  // Rollout: take the candidate, finish our turn greedily, let the opponent play one greedy turn, then evaluate.
  const greedy=sim=>{const B=legalActions(sim);let b=null,bv=-Infinity;for(const x of B){const sc=scoreAction(sim,x);if(sc>bv){bv=sc;b=x}}if(bv<0&&B.some(x=>x.t==="end"))return{t:"end"};return b};
  const roll=sim=>{let n=0;while(sim.winner==null&&sim.active===pi&&n++<60){const x=greedy(sim);if(!x)break;act(sim,x)}n=0;while(sim.winner==null&&sim.active!==pi&&n++<60){const x=greedy(sim);if(!x)break;act(sim,x)}};
  for(const a of A){let v;try{const sim=cloneState(st);LEVEL="normal";act(sim,a);roll(sim);v=evalBoard(sim,pi)}catch(e){v=-Infinity}LEVEL="hard";
    v+=Math.max(0,scoreAction(st,a))/40;if(v>bs){bs=v;best=a}}
  CUR=st;return best}
function aiChoose(st,level){
  LEVEL=level||"normal";const A=legalActions(st);if(!A.length)return null;let best=null,bs=-Infinity;
  if(LEVEL==="hard"&&!st.pending)return hardChoose(st,A);
  const noise=LEVEL==="easy"?90:LEVEL==="normal"?8:0,r=st.r||Math.random;
  for(const a of A){let s=scoreAction(st,a);if(LEVEL==="hard")s+=hardAdj(st,a,s);
    if(LEVEL==="easy"&&(a.t==="challenge"&&r()<0.6||a.t==="ink"&&r()<0.3))s=-1;if(s>=0&&noise)s+=r()*noise;if(s>bs){bs=s;best=a}}
  if(bs<0&&A.some(a=>a.t==="end"))return{t:"end"};
  return best;
}
function hardAdj(st,a,s){ // lore race awareness: race when ahead, remove questers when behind
  const pi=st.active,me=st.players[pi],op=st.players[opp(pi)];if(s<0)return 0;
  if(a.t==="quest"&&me.lore>=op.lore)return 12;
  if(a.t==="challenge"){const d=find(st,a.target).inst;if(isChar(d)&&op.lore>=12)return loreOf(d)*6;}
  if(a.t==="play"){const c=find(st,a.uid).inst.card;if(c.type==="character"&&c.kw.bodyguard&&op.play.some(y=>isChar(y)&&strOf(y)>=3))return 6}
  return 0}
function aiMulligan(st,pi){const h=st.players[pi].hand;const cheap=h.filter(c=>c.card.cost<=3).length;return cheap>=3?[]:h.filter(c=>c.card.cost>=5).map(c=>c.uid)}

/* ---------- decks ---------- */
const INKS=["Amber","Amethyst","Emerald","Ruby","Sapphire","Steel"];
function cardScore(c){return (c.supported?6:0)+(c.inkable?3:0)+(c.type==="character"?c.lore*3+c.str+c.wil-c.cost*1.6:c.onPlay.length?6-c.cost*0.5:0)+(c.kw.evasive?2:0)+(c.kw.bodyguard?1:0)+(c.kw.ward?1:0)}
function fitsInks(c,inks){return c.inks.length>0&&c.inks.every(i=>inks.includes(i))}
const CURVE={1:2,2:4,3:3,4:3,5:2,6:1,7:0};
function buildDeck(pool,inks,owned){
  // pool: normalized cards. owned: optional map id->copies available. Returns array of 60 cards or null.
  const byFull=new Map();
  for(const c of pool){if(!fitsInks(c,inks)||c.type==="location"&&!owned)continue;const k=c.full;
    const avail=owned?(owned[c.id]||0):4;if(!avail)continue;const e=byFull.get(k);if(e)e.n=Math.min(4,e.n+avail);else byFull.set(k,{c,n:Math.min(4,avail)})}
  const list=[...byFull.values()].sort((a,b)=>cardScore(b.c)-cardScore(a.c));
  const deck=[];const take=(e,n)=>{for(let i=0;i<n&&deck.length<60;i++)deck.push(e.c);e.n-=n};
  if(!owned){const used=new Set();
    for(const [cost,slots] of Object.entries(CURVE)){let s=slots;for(const e of list){if(!s)break;const cc=Math.min(7,e.c.cost);if(cc!=+cost||used.has(e.c.full)||e.c.cost<1)continue;used.add(e.c.full);take(e,4);s--}}
    for(const e of list){if(deck.length>=60)break;if(!used.has(e.c.full)&&e.c.cost>=1){used.add(e.c.full);take(e,Math.min(4,60-deck.length))}}
  }else{for(const e of list){if(deck.length>=60)break;take(e,Math.min(e.n,60-deck.length))}}
  return deck.length===60?deck:null;
}
function bestOwnedPair(pool,owned){let best=null;
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const inks=[INKS[i],INKS[j]];const n=pool.reduce((s,c)=>s+(fitsInks(c,inks)?Math.min(4,owned[c.id]||0):0),0);if(!best||n>best.n)best={inks,n}}
  return best;}
function validateDeck(deck){if(deck.length<60)return"Deck must have at least 60 cards";const inks=new Set(deck.flatMap(c=>c.inks));if(inks.size>2)return"Too many inks";
  const cnt={};for(const c of deck){cnt[c.full]=(cnt[c.full]||0)+1;if(cnt[c.full]>4&&!/up to 99 copies/.test(c.text))return"More than 4 copies of "+c.full}return null}

function coverage(pool){const seen0=new Map();for(const c of pool)if(!seen0.has(c.full))seen0.set(c.full,c);const st={};for(const c of seen0.values())st[c.status]=(st[c.status]||0)+1;
  const r=coverage0(pool);r.byStatus=st;return r}
function coverage0(pool){const seen=new Map();for(const c of pool)if(!seen.has(c.full))seen.set(c.full,c);const all=[...seen.values()];
  const sup=all.filter(c=>c.supported).length,vanilla=all.filter(c=>c.supported&&!c.onPlay.length&&!c.onQuest.length&&!c.acts.length&&!c.onBanish.length&&!c.entersExerted&&!c.enterDamage).length;
  return{unique:all.length,supported:sup,unsupported:all.length-sup,vanillaOrKeywordOnly:vanilla,withSimulatedText:sup-vanilla}}

const E={ev,costOf,normCard,parseEffects,newGame,mulligan,legalActions,act,aiChoose,aiMulligan,buildDeck,bestOwnedPair,validateDeck,coverage,INKS,inkAvail,dry,strOf,targets,find,isLegal,challengeTargets,loreOf,K};
if(typeof module!=="undefined"&&module.exports)module.exports=E;else root.LorcanaEngine=E;
})(typeof window!=="undefined"?window:globalThis);
