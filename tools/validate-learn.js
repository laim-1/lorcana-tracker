/* Validates the hand-authored Learn curriculum against the real engine.
   - every card exists in sets 9-13; every scripted move is E.isLegal and applied with E.act
   - every 'do'/'demo' move produces a visible state change
   - puzzles: brute force all legal lines; intended key moves must appear in EVERY winning line
   - no two consecutive lessons share a board fingerprint or step-type sequence; no duplicate prompts
   - emoji scan of Learn sources */
const fs=require('fs');const E=require('../js/engine.js');const Core=require('../js/learn-core.js');const D=require('../js/learn-data.js');
const gj=JSON.parse(fs.readFileSync('data/game-cards.js','utf8').replace(/^window\.LORCANA_GAME_CARDS=/,'').replace(/;\s*$/,''));
const raw=gj.cards.filter(c=>/^(9|10|11|12|13)$/.test(String(c.set)));const cards=raw.map(E.normCard);
const ctx=Core.mkCtx(E,cards,D.cards);const fails=[];const out={chapters:D.chapters.length,authored:0,locked:0,lessons:0,puzzles:[]};
for(const k in D.cards){try{const c=ctx.card(k);if(c.unsupported&&c.unsupported.length)fails.push('unsupported text '+k)}catch(e){fails.push(e.message)}}
const prompts=new Map(),lids=new Set();let prev=null;const snap=st=>JSON.stringify(st.players.map(p=>[p.lore,p.hand.length,p.ink.map(x=>x.exerted),p.play.map(x=>[x.card.id,x.exerted,x.damage,x.at,x.under.length]),p.discard.length]));
for(const ch of D.chapters){if(ch.soon){out.locked++;continue}out.authored++;
 for(const l of ch.lessons){out.lessons++;if(lids.has(l.id))fails.push('duplicate lesson id '+l.id);lids.add(l.id);const fp=JSON.stringify(l.setup),seq=l.steps.map(s=>s.k).join(">");
  if(prev&&prev.fp===fp)fails.push(l.id+' same board as '+prev.id);if(prev&&prev.seq===seq&&l.steps.length>1)fails.push(l.id+' same step sequence as '+prev.id+' ('+seq+')');
  prev={fp,seq,id:l.id};
  let st=Core.build(ctx,l.setup);let hist=[];
  l.steps.forEach((s,i)=>{const tag=l.id+'#'+(i+1);
   if(!s.say||s.say.length>64)fails.push(tag+' prompt missing/too long: '+s.say);
   if(prompts.has(s.say))fails.push(tag+' duplicate prompt with '+prompts.get(s.say)+': '+s.say);prompts.set(s.say,tag);
   if(s.setup){st=Core.build(ctx,s.setup);hist=[]}
   if(s.k==='do'||s.k==='demo'){const a=Core.resolve(ctx,st,s.a);if(!a||!E.isLegal(st,a)){fails.push(tag+' illegal move '+JSON.stringify(s.a));return}
     const b=snap(st);E.act(st,a);while(st.pending){E.act(st,E.legalActions(st)[0])}hist.push(a);if(snap(st)===b)fails.push(tag+' move changed nothing');}
   else if(s.k==='turn'){if(!E.isLegal(st,{t:'end'})){fails.push(tag+' cannot end turn');return}const h=st.players[0].hand.length;E.act(st,{t:'end'});if(st.active!==1)fails.push(tag+' rival turn did not start');E.act(st,{t:'end'});
     if(st.active!==0||st.players[0].hand.length!==h+1||st.players[0].play.some(x=>x.exerted&&x.card.type!=="location"))fails.push(tag+' ready/draw step wrong');hist=[]}
   else if(s.k==='pick'){const n=s.opts.length;const A=[].concat(s.ans);if(!n||A.some(x=>x<0||x>=n))fails.push(tag+' bad answer');s.opts.forEach(o=>{if(o.c)try{ctx.card(o.c)}catch(e){fails.push(tag+' '+e.message)}})}
   else if(s.k==='goal'){if(Core.goalMet(ctx,st,s.goal,[]))fails.push(tag+' goal already met');
     const r=Core.solve(ctx,st,s.goal,s.depth||4);const keys=s.key||[];
     if(!r.wins.length){fails.push(tag+' puzzle unsolvable');return}
     const bad=r.wins.filter(w=>!keys.every(k=>w.some(a=>Core.matchRef(ctx,st,a,k))));
     if(s.puzzle&&!keys.length)fails.push(tag+' puzzle has no key');
     if(bad.length)fails.push(tag+' alternative solution without key: '+bad[0].map(a=>a._n).join(' ; '));
     out.puzzles.push({id:tag,goal:s.goal,winningLines:r.wins.length,searched:r.tried,sample:r.wins[0].map(a=>a._n).join(' ; ')});
     for(const a of r.wins[0]){const b={...a};delete b._n;E.act(st,b);while(st.pending)E.act(st,E.legalActions(st)[0]);hist.push(b)}}
   else fails.push(tag+' unknown step '+s.k)});
 }}
const emo=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2300}-\u{23FF}]/u;
for(const f of['js/learn.js','js/learn-data.js','js/learn-core.js','css/learn.css'])if(emo.test(fs.readFileSync(f,'utf8')))fails.push('emoji in '+f);
out.fails=fails;console.log(JSON.stringify(out,null,1));if(fails.length)process.exit(1);
