const fs=require('fs');const D=require('../js/learn-data.js');const E=require('../js/engine.js');
const gj=JSON.parse(fs.readFileSync('data/game-cards.js','utf8').replace(/^window\.LORCANA_GAME_CARDS=/,'').replace(/;\s*$/,''));
const byId=new Map(gj.cards.map(c=>[c.id,c]));let fails=[];
if(D.chapters.length!==15)fails.push('chapters '+D.chapters.length);
let lessons=0, ids=new Set();
for(const ch of D.chapters){if(ch.lessons.length<8||ch.lessons.length>12)fails.push(ch.id+' count '+ch.lessons.length);
 for(const l of ch.lessons){lessons++;const c=byId.get(l.exampleId);if(!c)fails.push(l.id+' missing card');else if(!['9','10','11','12','13','14'].includes(String(c.set)))fails.push(l.id+' set '+c.set);else if(ids.has(l.exampleId+'')){} ids.add(l.exampleId);
  // keyword tags must exist in 9-13 text
  if(['bodyguard','evasive','ward','resist','rush','challenger','support','reckless','shift','singer','alert','boost'].includes(l.tag)){const ok=gj.cards.some(x=>['9','10','11','12','13'].includes(String(x.set))&&(x.text||'').toLowerCase().includes(l.tag));if(!ok)fails.push(l.id+' kw absent '+l.tag)}}}
console.log(JSON.stringify({chapters:D.chapters.length,lessons,uniqueExampleCards:ids.size,setsPresent:[...new Set(gj.cards.map(c=>String(c.set)))].sort(),set14Cards:gj.cards.filter(c=>String(c.set)==='14').length,fails},null,2));
if(fails.length||lessons<120)process.exit(1);
