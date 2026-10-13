// node tools/gen-starters.js -> regenerates the STARTER_DECKS block in js/engine.js from tools/starters.txt
// Source: Mushu Report wiki starter deck pages (official Ravensburger decklists), fetched 2026-10-11.
const fs=require("fs"),P=__dirname+"/../js/engine.js";const decks=[];let cur;
for(const l of fs.readFileSync(__dirname+"/starters.txt","utf8").split("\n")){if(!l.trim())continue;
  if(l[0]==="@"){const[t,s,i]=l.slice(1).split("|");cur={name:`${i} Starter - ${s}`,title:t,set:s,inks:i.split("/"),list:[]};decks.push(cur);continue}
  const m=l.match(/^(\d+) (.+)$/);cur.list.push([+m[1],m[2]])}
const blk="/*STARTERS-BEGIN*/const STARTER_DECKS="+JSON.stringify(decks)+";/*STARTERS-END*/";
let s=fs.readFileSync(P,"utf8");s=/\/\*STARTERS-BEGIN\*\/[\s\S]*?\/\*STARTERS-END\*\//.test(s)?s.replace(/\/\*STARTERS-BEGIN\*\/[\s\S]*?\/\*STARTERS-END\*\//,()=>blk):s.replace("\nconst E={",()=>"\n"+blk+"\nconst E={");
fs.writeFileSync(P,s);console.log(decks.length,"decks")
