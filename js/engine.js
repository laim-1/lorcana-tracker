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
  s=s.trim().replace(/\.$/,"").replace(/^you may /i,"").replace(/^then,? /i,"");const l=s.toLowerCase();let m;
  if((m=l.match(/^return this card to your hand$/)))return{k:"returnSelf"};
  if((m=l.match(/^put this card into your inkwell facedown and exerted$/)))return{k:"inkSelf"};
  if((m=l.match(/^you pay (\d+) ink less for the next (character|item|action|song|location) you play this turn$/)))return{k:"discount",n:+m[1],type:m[2]};
  if((m=l.match(/^banish all characters$/)))return{k:"banishAll"};
  if((m=l.match(/^each player puts the top (\d+) cards? of their deck into their inkwell facedown and exerted$/)))return{k:"rampAll",n:+m[1]};
  if((m=l.match(/^the challenging player chooses and discards (a|one) card$/)))return{k:"oppDiscard",n:1};
  if((m=l.match(/^__dig (\d+) (\w+)$/)))return{k:"dig",n:+m[1],type:m[2]};
  if(l==="__ramp")return{k:"ramp"};if(l==="__scry")return{k:"scry"};
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
   .replace(/look at the top card of your deck\. put it on either the top or the bottom of your deck/gi,"__scry");
}
function parseEffects(txt){
  txt=preDig(txt);let m;
  if((m=txt.match(/^(?:you may )?choose one:\s*•\s*(.+)$/i))){const opts=m[1].split(/\s*•\s*/).map(o=>parseEffects(o));if(opts.every(Boolean))return[{k:"modal",opts}];return null}
  if((m=txt.match(/^if you have a character named ([^,]+?) in play, (.+)$/i))){const e=parseEffects(m[2]);return e?[{k:"cond",name:m[1],eff:e}]:null}
  if((m=txt.match(/^if you have (\d+) or more other characters in play, (.+)$/i))){const e=parseEffects(m[2]);return e?[{k:"cond",count:+m[1],eff:e}]:null}
  const parts=txt.replace(/\.\s*$/,"").split(/\.\s+|,? then,? (?=[a-z])(?!choose and discard)|;\s*/i).filter(Boolean);if(!parts.length)return null;
  const out=[];for(const p of parts){const e=parseOne(p);if(!e)return null;out.push(e)}
  if(out.filter(e=>e.t).length>1)return null; // only one chosen target per ability in v1
  return out;
}
function normCard(r){
  const type=(r.type||[]).map(x=>x.toLowerCase());
  const c={id:r.id,name:r.name,version:r.version||"",full:r.name+(r.version?" - "+r.version:""),ink:r.ink||null,inks:r.inks||(r.ink?[r.ink]:[]),
    cost:r.cost||0,inkable:!!r.inkwell,type:type.includes("character")?"character":type.includes("location")?"location":type.includes("item")?"item":type.includes("song")?"song":"action",
    str:r.strength||0,wil:r.willpower||0,lore:r.lore||0,move:r.move_cost!=null?r.move_cost:null,text:r.text||"",img:r.img||null,set:r.set,num:r.collector_number,rarity:r.rarity,
    cls:r.classifications||[],kw:{},onPlay:[],onQuest:[],onBanish:[],onStart:[],onEnd:[],onBanishOther:[],onYouPlay:[],onInk:[],onChallenge:[],onChallenged:[],onActionPlayed:[],statics:[],acts:[],unsupported:[]};
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
    else if(/^This character can't be challenged$/i.test(line))c.statics.push({cond:"always",block:"challenged"});
    else if(/^This character can challenge ready characters$/i.test(line))c.statics.push({cond:"always",flag:"challengeReady"});
    else if(/^This character can't \{E\} to sing songs$/i.test(line))c.statics.push({cond:"always",block:"sing"});
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
  const simulated=(c.kw.boost!=null?1:0)+(c.costRed?1:0)+(c.singTogether?1:0)+c.onBanishOther.length+c.onYouPlay.length+c.onInk.length+c.onPlay.length+c.onQuest.length+c.onBanish.length+c.onStart.length+c.onEnd.length+c.onChallenge.length+c.onChallenged.length+c.onActionPlayed.length+c.statics.length+c.acts.length+(c.entersExerted?1:0)+(c.enterDamage?1:0);
  c.status=!c.text?"plain":c.supported?(simulated?"full":"keywords"):(simulated||Object.keys(c.kw).length?"partial":"vanilla");
  return c;
}

/* ---------- rng / helpers ---------- */
function rng(seed){let a=seed>>>0||1;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function shuffle(arr,r){for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

/* ---------- game state ---------- */
function newGame(o){
  const st={turnNo:0,active:o.first||0,first:o.first||0,phase:"mulligan",winner:null,log:[],uid:1,seed:o.seed||Date.now()%1e9,mull:[false,false],players:[]};
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
function find(st,uid){for(let i=0;i<2;i++){const p=st.players[i];for(const z of["hand","play","deck","discard"]){const x=p[z].find(c=>c.uid===uid);if(x)return{inst:x,pi:i,zone:z}}const k=p.ink.find(c=>c.uid===uid);if(k)return{inst:k,pi:i,zone:"ink"}}return null}
const inkAvail=p=>p.ink.filter(c=>!c.exerted).length;
function costOf(st,pi,c){let n=c.cost;const P=st.players[pi];for(const d of (P.disc||[]))if(d.type===c.type||d.type==="action"&&c.type==="song")n-=d.n;
  if(c.costRed&&c.costRed.secondFirst){if(pi!==st.first&&st.turnNo===2)n-=c.costRed.n}else if(c.costRed&&st.players[pi].play.some(x=>x.card.type==="character"&&x.card.name.toLowerCase()===c.costRed.name.toLowerCase()))n-=c.costRed.n;return Math.max(0,n)}
function payInk(p,n){for(const c of p.ink){if(n<=0)break;if(!c.exerted){c.exerted=true;n--}}}
const isChar=x=>x.card.type==="character",isLoc=x=>x.card.type==="location",isItem=x=>x.card.type==="item";
const dry=(st,x)=>x.playedOn<st.turnNo;
let CUR=null; // current state, for "during your turn" statics
function condOk(x,c){switch(c){case"damaged":return!!x.damage;case"undamaged":return!x.damage;case"exerted":return x.exerted;case"atLoc":return x.at!=null;case"under":return x.under.length>0;case"yourTurn":return!!(CUR&&CUR.active===x.owner);case"defending":return!!x.defending;default:
  if(!CUR)return true;const P=CUR.players[x.owner];
  if(c.startsWith("named:"))return P.play.some(y=>y!==x&&y.card.type==="character"&&y.card.name.toLowerCase()===c.slice(6));
  if(c.startsWith("cls:"))return P.play.some(y=>y!==x&&y.card.cls.some(k=>k.toLowerCase()===c.slice(4).toLowerCase()));
  if(c.startsWith("ink:"))return P.ink.length>=+c.slice(4);
  if(c.startsWith("str:"))return x.card.str+x.tStr>=+c.slice(4);
  return true}}
function statOn(x,f){let n=0;for(const s of x.card.statics){if(s.stat!==f||!condOk(x,s.cond))continue;n+=s.perHand?s.perHand*(CUR?CUR.players[x.owner].hand.length:0):s.n}return n}
function K(x,k){const v=x.card.kw[k];if(v!=null)return v;
  for(const g of (x.grants||[])){const [nm,val]=g.kw.split(" ");if(nm===k)return val?parseInt(val):true}
  for(const s of x.card.statics){if(!s.kw||!condOk(x,s.cond))continue;const [nm,val]=s.kw.split(" ");if(nm===k)return val?parseInt(val):true}return k==="challenger"||k==="resist"?0:undefined}
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
function draw(st,pi,n){const p=st.players[pi];for(let k=0;k<n;k++){if(!p.deck.length){lose(st,pi,"had to draw from an empty deck");return false}p.hand.push(p.deck.pop())}return true}
function lose(st,pi,why){if(st.winner!=null)return;st.winner=opp(pi);st.phase="over";log(st,`${st.players[pi].name} ${why}. ${st.players[opp(pi)].name} wins!`)}
function gain(st,pi,n){const p=st.players[pi];p.lore+=n;if(p.lore>=20&&st.winner==null){st.winner=pi;st.phase="over";log(st,`${p.name} reaches ${p.lore} lore and wins!`)}}
function startTurn(st){
  const pi=st.active,p=st.players[pi];p.inked=false;p.disc=[];p.boosted=new Set();
  p.ink.forEach(c=>c.exerted=false);p.play.forEach(c=>{const nrh=c.card.statics.find(s=>s.noReadyHand);if(c.noReady)c.noReady=false;else if(!(nrh&&p.hand.length>=nrh.noReadyHand))c.exerted=false;c.lStr=0;c.noQuestNow=!!c.noQuestNext;c.noChalNow=!!c.noChalNext;c.noQuestNext=c.noChalNext=false});
  for(const q of st.players)q.play.forEach(c=>{c.grants=(c.grants||[]).filter(g=>!(g.until==="srcStart"&&g.src===pi))});           // ready (long debuffs from this player expire)
  st.players[opp(pi)].play.forEach(c=>{if(c.lSrc===pi){c.lStr=0;c.lSrc=null}});
  log(st,`-- Turn ${st.turnNo}: ${p.name} --`);
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
  p.discard.push(...x.under,x);x.under=[];log(st,`${x.card.full} is banished.`);
  if(x.card.onBanish.length&&st.winner==null)resolve(st,f.pi,x.card.onBanish,autoTarget(st,f.pi,x.card.onBanish),x);
}
function damage(st,x,n){if(n<=0)return;const d=Math.max(0,n-(K(x,'resist')||0));x.damage+=d;if(wilOf(x)&&x.damage>=wilOf(x))banish(st,x)}

/* targets */
function targets(st,pi,t){
  const out=[];
  for(let i=0;i<2;i++){
    if(t.opp&&i===pi)continue;if(t.own&&i!==pi)continue;
    for(const x of st.players[i].play){
      if(t.kind==="char"&&!isChar(x))continue;if(t.kind==="item"&&!isItem(x))continue;if(t.exerted&&!x.exerted)continue;
      if(i!==pi&&K(x,'ward'))continue;
      if(t.damaged&&!x.damage)continue;
      if(t.maxStr!=null&&strOf(x)>t.maxStr)continue;if(t.maxCost!=null&&x.card.cost>t.maxCost)continue;
      out.push(x.uid);
    }
  }
  return out;
}
const needsTarget=effs=>effs.find(e=>e.t);
function yp(st,pi,x){const t=x.card.type,fl=x.card.cls.includes("Floodborn");for(const y of [...st.players[pi].play]){if(y===x)continue;for(const h of y.card.onYouPlay){
  if(h.type===t||h.type==="action"&&t==="song"||h.type==="floodborn character"&&fl&&t==="character")resolve(st,pi,h.eff,autoTarget(st,pi,h.eff),y)}if(st.winner!=null)return}}
function discardPri(x){return x.card.cost+(x.card.inkable?0:1)}
function resolve(st,pi,effs,tgt,src,fromAction){
  let last=null;
  for(const e of effs){
    const T=(e.t||e.rider)&&tgt!=null?find(st,tgt):null,x=T&&T.zone==="play"?T.inst:null;
    if((e.t||e.rider)&&!x)continue;
    if(fromAction&&x&&e.t&&T.pi!==pi&&K(x,"vanish")){banish(st,x);continue}
    const me=st.players[pi],o=st.players[opp(pi)],self=src&&find(st,src.uid)?.zone==="play"?src:null;
    switch(e.k){
      case"draw":draw(st,pi,e.n);break;
      case"drawAll":draw(st,pi,e.n);draw(st,opp(pi),e.n);break;
      case"gainLore":gain(st,pi,e.n);break;
      case"oppLose":{const o=st.players[opp(pi)];o.lore=Math.max(0,o.lore-e.n);break}
      case"dmgAllOpp":[...st.players[opp(pi)].play.filter(isChar)].forEach(c=>damage(st,c,e.n));break;
      case"dmg":damage(st,x,e.n);break;
      case"banish":banish(st,x);break;
      case"bounce":{const o=st.players[T.pi];o.play=o.play.filter(c=>c!==x);const cards=[...x.under,x];x.under=[];
        if(isLoc(x))o.play.forEach(c=>{if(c.at===x.uid)c.at=null});
        cards.forEach(c=>{c.damage=0;c.exerted=false;c.tStr=0;c.at=null;st.players[c.owner].hand.push(c)});log(st,`${x.card.full} returns to hand.`);break}
      case"heal":x.damage=Math.max(0,x.damage-e.n);break;
      case"healAll":st.players[pi].play.filter(isChar).forEach(c=>c.damage=Math.max(0,c.damage-e.n));break;
      case"buffStr":x.tStr+=e.n;break;
      case"exert":x.exerted=true;break;
      case"ready":x.exerted=false;break;
      case"loot":{draw(st,pi,e.n);const h=st.players[pi].hand;for(let k=0;k<e.d&&h.length;k++){h.sort((a,b)=>discardPri(b)-discardPri(a));st.players[pi].discard.push(h.shift())}break}
      case"debuff":if(e.long){x.lStr-=e.n;x.lSrc=pi}else x.tStr-=e.n;break;
      case"buffLore":x.tLore+=e.n;break;
      case"buffChal":x.tChal+=e.n;break;
      case"oppDiscard":{const o=st.players[opp(pi)];for(let k=0;k<e.n&&o.hand.length;k++){o.hand.sort((a,b)=>discardPri(b)-discardPri(a));o.discard.push(o.hand.shift())}break}
      case"recur":{const d=st.players[pi].discard,cs=d.filter(c=>c.card.type===(e.type||"character")||e.type==="action"&&c.card.type==="song").sort((a,b)=>b.card.cost-a.card.cost);if(cs.length){d.splice(d.indexOf(cs[0]),1);reset(cs[0]);st.players[pi].hand.push(cs[0])}break}
      case"noReady":x.noReady=true;break;
      case"noQuest":x.noQuest=true;break;
      case"self":if(self){if(e.stat==="str")self.tStr+=e.n;else if(e.stat==="lore")self.tLore+=e.n}break;
      case"self2":if(self){self.tStr+=e.s;self.tLore+=e.l}break;
      case"readySelf":if(self)self.exerted=false;break;
      case"healSelf":if(self)self.damage=Math.max(0,self.damage-e.n);break;
      case"grant":x.grants=x.grants||[];x.grants.push({kw:e.kw,until:e.long?(e.t.opp?"ownerTurnEnd":"srcStart"):"turnEnd",src:pi});break;
      case"grantSelf":if(self){self.grants=self.grants||[];self.grants.push({kw:e.kw,until:"turnEnd",src:pi})}break;
      case"noNext":if(e.what==="quest")x.noQuestNext=true;else x.noChalNext=true;break;
      case"ramp":if(me.deck.length){const c=me.deck.pop();c.exerted=true;me.ink.push(c)}break;
      case"team":me.play.filter(c=>isChar(c)&&(!e.other||c!==self)).forEach(c=>{if(e.stat==="str")c.tStr+=e.n;else c.tLore+=e.n});break;
      case"oppExert":{const r=o.play.filter(c=>isChar(c)&&!c.exerted).sort((a,b)=>loreOf(a)-loreOf(b))[0];if(r)r.exerted=true;break}
      case"oppBanish":{const r=o.play.filter(isChar).sort((a,b)=>a.card.cost-b.card.cost)[0];if(r)banish(st,r);break}
      case"payDraw":if(inkAvail(me)>=e.n){payInk(me,e.n);draw(st,pi,1)}break;
      case"banishSelf":if(self)banish(st,self);break;
      case"dmgSelf":if(self)damage(st,self,e.n);break;
      case"dig":{const top=me.deck.splice(Math.max(0,me.deck.length-e.n),e.n);const ok=top.filter(c=>e.type==="any"||c.card.type===e.type||e.type==="action"&&c.card.type==="song").sort((a,b)=>b.card.cost-a.card.cost);
        const pick=ok[0];if(pick){top.splice(top.indexOf(pick),1);me.hand.push(pick)}me.deck.unshift(...top);break}
      case"scry":break;
      case"returnSelf":{if(!src)break;const P=st.players[src.owner],i=P.discard.indexOf(src);if(i>=0){P.discard.splice(i,1);reset(src);P.hand.push(src)}break}
      case"inkSelf":{if(!src)break;const P=st.players[src.owner],i=P.discard.indexOf(src);if(i>=0){P.discard.splice(i,1);reset(src);src.exerted=true;P.ink.push(src)}break}
      case"discount":me.disc=me.disc||[];me.disc.push({n:e.n,type:e.type});break;
      case"banishAll":for(const q of st.players)[...q.play.filter(isChar)].forEach(c=>banish(st,c));break;
      case"rampAll":for(const q of st.players)for(let k=0;k<e.n&&q.deck.length;k++){const c=q.deck.pop();c.exerted=true;q.ink.push(c)}break;
      case"cond":{const ok=e.name?me.play.some(c=>isChar(c)&&c.card.name.toLowerCase()===e.name.toLowerCase()):me.play.filter(c=>isChar(c)&&c!==self).length>=e.count;if(ok)resolve(st,pi,e.eff,autoTarget(st,pi,e.eff),src,fromAction);break}
      case"modal":{let best=e.opts[0],bv=-1e9;for(const o of e.opts){const v=effVal(st,pi,o,autoTarget(st,pi,o));if(v>bv){bv=v;best=o}}resolve(st,pi,best,autoTarget(st,pi,best),src,fromAction);break}
    }
    if(st.winner!=null)return;
  }
}

/* ---------- legal actions ---------- */
function withTargets(st,pi,base,effs){
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
  const pi=st.active,p=st.players[pi],ink=inkAvail(p),A=[];
  for(const h of p.hand){
    const c=h.card;
    if(!p.inked&&c.inkable)A.push({t:"ink",uid:h.uid});
    if(costOf(st,pi,c)<=ink)A.push(...withTargets(st,pi,{t:"play",uid:h.uid},c.onPlay));
    if(c.singTogether){const sg=p.play.filter(x=>isChar(x)&&!x.exerted&&dry(st,x)&&!blocked(x,"sing")).sort((a,b)=>a.card.cost-b.card.cost);let tot=0,set=[];for(const x of sg){if(tot>=c.singTogether)break;set.push(x.uid);tot+=x.card.cost}
      if(tot>=c.singTogether&&set.length>1)A.push(...withTargets(st,pi,{t:"play",uid:h.uid,singers:set.join(",")},c.onPlay))}
    if(c.kw.shift!=null&&c.kw.shift<=ink)for(const b of p.play.filter(x=>isChar(x)&&x.card.name===c.name))A.push(...withTargets(st,pi,{t:"play",uid:h.uid,shift:b.uid},c.onPlay));
    if(c.type==="song")for(const s of p.play.filter(x=>isChar(x)&&!x.exerted&&dry(st,x)&&!blocked(x,"sing")&&(x.card.kw.singer!=null?x.card.kw.singer:x.card.cost)>=c.cost))
      A.push(...withTargets(st,pi,{t:"play",uid:h.uid,singer:s.uid},c.onPlay));
  }
  for(const x of p.play){
    if(isChar(x)&&!x.exerted&&dry(st,x)&&!K(x,'reckless')&&!blocked(x,"quest")&&!x.noQuest&&loreOf(x)>0)A.push({t:"quest",uid:x.uid});
    if(canChallenge(st,pi,x))for(const t of challengeTargets(st,pi,x))A.push({t:"challenge",uid:x.uid,target:t});
    if(isChar(x))for(const l of p.play.filter(isLoc))if(x.at!==l.uid&&l.card.move!=null&&l.card.move<=ink)A.push({t:"move",uid:x.uid,loc:l.uid});
    if(x.card.kw.boost!=null&&isChar(x)&&!(p.boosted&&p.boosted.has(x.uid))&&x.card.kw.boost<=ink&&p.deck.length)A.push({t:"boost",uid:x.uid});
    x.card.acts.forEach((ab,i)=>{if((ab.noExert||!x.exerted)&&(!isChar(x)||dry(st,x))&&ab.ink<=ink)A.push(...withTargets(st,pi,{t:"act",uid:x.uid,i},ab.eff))});
  }
  const mustChallenge=p.play.some(x=>K(x,'reckless')&&canChallenge(st,pi,x)&&challengeTargets(st,pi,x).length);
  if(!mustChallenge)A.push({t:"end"});
  return A;
}
function isLegal(st,a){return legalActions(st).some(b=>b.t===a.t&&b.uid===a.uid&&(b.target??null)===(a.target??null)&&(b.shift??null)===(a.shift??null)&&(b.singer??null)===(a.singer??null)&&(b.loc??null)===(a.loc??null)&&(b.i??null)===(a.i??null)&&(b.singers??null)===(a.singers??null))}

function act(st,a){
  CUR=st;if(!isLegal(st,a))throw new Error("Illegal action "+JSON.stringify(a));
  const pi=st.active,p=st.players[pi],o=st.players[opp(pi)];
  const F=a.uid!=null?find(st,a.uid):null,x=F&&F.inst;
  switch(a.t){
    case"ink":p.hand=p.hand.filter(c=>c!==x);x.exerted=false;p.ink.push(x);p.inked=true;log(st,`${p.name} inks ${x.card.full}.`);
      for(const y of [...p.play])if(y.card.onInk.length&&!y.inkUsed){y.inkUsed=st.turnNo;resolve(st,pi,y.card.onInk,autoTarget(st,pi,y.card.onInk),y)}break;
    case"play":{
      const c=x.card;p.hand=p.hand.filter(h=>h!==x);
      if(a.singer!=null){const s=find(st,a.singer).inst;s.exerted=true;log(st,`${s.card.name} sings ${c.name}.`)}
      else if(a.singers){a.singers.split(",").forEach(u=>find(st,+u).inst.exerted=true);log(st,`Characters sing ${c.name} together.`)}
      else if(a.shift!=null){payInk(p,c.kw.shift)}else{payInk(p,costOf(st,pi,c));if(p.disc&&p.disc.length)p.disc=p.disc.filter(d=>!(d.type===c.type||d.type==="action"&&c.type==="song"))}
      if(c.type==="action"||c.type==="song"){if(a.singer==null&&!a.singers)log(st,`${p.name} plays ${c.full}.`);p.play.forEach(y=>y.card.onActionPlayed.forEach(e=>{if(e.k==="selfStr")y.tStr+=e.n}));resolve(st,pi,c.onPlay,a.target,x,true);p.discard.push(x);yp(st,pi,x);break}
      x.playedOn=st.turnNo;reset(x);
      if(a.shift!=null){const b=find(st,a.shift).inst;const idx=p.play.indexOf(b);x.damage=b.damage;x.exerted=b.exerted;x.playedOn=b.playedOn;x.at=b.at;x.under=[...b.under,b];b.under=[];b.at=null;p.play[idx]=x;log(st,`${p.name} shifts ${c.full} onto ${b.card.name}.`)}
      else{p.play.push(x);if(c.entersExerted||a.exerted&&c.kw.bodyguard)x.exerted=true;log(st,`${p.name} plays ${c.full}.`);if(c.enterDamage)damage(st,x,c.enterDamage)}
      resolve(st,pi,c.onPlay,a.target,x);yp(st,pi,x);break}
    case"quest":{x.exerted=true;const lv=loreOf(x);log(st,`${x.card.full} quests for ${lv} lore.`);
      if(x.card.kw.support){const others=p.play.filter(c=>isChar(c)&&c!==x);if(others.length){const t=others.sort((a,b)=>b.card.lore-a.card.lore)[0];t.tStr+=strOf(x);log(st,`Support: ${t.card.name} gets +${strOf(x)} strength.`)}}
      gain(st,pi,lv);if(st.winner==null)resolve(st,pi,x.card.onQuest,a.target!=null?a.target:autoTarget(st,pi,x.card.onQuest),x);break}
    case"challenge":{const d=find(st,a.target).inst;x.exerted=true;
      const as=strOf(x)+(K(x,'challenger')||0)+x.tChal,ds=isLoc(d)?0:strOf(d);
      log(st,`${x.card.name} challenges ${d.card.name}.`);
      if(x.card.onChallenge.length)resolve(st,pi,x.card.onChallenge,autoTarget(st,pi,x.card.onChallenge),x);
      if(d.card.onChallenged.length)resolve(st,opp(pi),d.card.onChallenged,autoTarget(st,opp(pi),d.card.onChallenged),d);
      if(st.winner!=null)break;const dIn=find(st,d.uid)?.zone==="play";d.defending=true;const ds2=isLoc(d)?0:strOf(d);d.defending=false;damage(st,d,as);damage(st,x,ds2);
      if(dIn&&find(st,d.uid)?.zone!=="play"&&find(st,x.uid)?.zone==="play"&&x.card.onBanishOther.length)resolve(st,pi,x.card.onBanishOther,autoTarget(st,pi,x.card.onBanishOther),x);break}
    case"move":{const l=find(st,a.loc).inst;payInk(p,l.card.move);x.at=l.uid;log(st,`${x.card.name} moves to ${l.card.name}.`);break}
    case"act":{const ab=x.card.acts[a.i];if(!ab.noExert)x.exerted=true;payInk(p,ab.ink);log(st,`${x.card.name} uses an ability.`);resolve(st,pi,ab.eff,a.target,x);if(ab.sac)banish(st,x);break}
    case"boost":payInk(p,x.card.kw.boost);x.under.push(p.deck.pop());p.boosted.add(x.uid);log(st,`${x.card.name} boosts (card put under it).`);break;
    case"end":log(st,`${p.name} ends their turn.`);endTurn(st);break;
  }
  return st;
}
function autoTarget(st,pi,effs){const nt=needsTarget(effs||[]);if(!nt)return null;const ts=targets(st,pi,nt.t);if(!ts.length)return null;
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
      case"ramp":v+=4;break;case"returnSelf":case"inkSelf":v+=3;break;case"discount":v+=1;break;case"rampAll":v+=1;break;
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
    case"play":{const c=x.card;let s=100+c.cost*4+effVal(st,pi,c.onPlay,a.target);
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
    case"move":return -1;case"boost":return x.card.statics.some(s=>s.cond==="under")||x.card.onQuest.length?45:-1;
    case"end":return 0;
  }
  return -1;
}
function aiChoose(st){
  const A=legalActions(st);if(!A.length)return null;let best=null,bs=-Infinity;
  for(const a of A){const s=scoreAction(st,a);if(s>bs){bs=s;best=a}}
  if(bs<0&&A.some(a=>a.t==="end"))return{t:"end"};
  return best;
}
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

const E={costOf,normCard,parseEffects,newGame,mulligan,legalActions,act,aiChoose,aiMulligan,buildDeck,bestOwnedPair,validateDeck,coverage,INKS,inkAvail,dry,strOf,targets,find,isLegal,challengeTargets,loreOf,K};
if(typeof module!=="undefined"&&module.exports)module.exports=E;else root.LorcanaEngine=E;
})(typeof window!=="undefined"?window:globalThis);
