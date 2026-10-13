#!/bin/sh
# tools/expert-par.sh N K [args...] -> runs expert-bench in K shards and aggregates
N=$1; K=$2; shift 2; D=$(mktemp -d)
i=0; while [ $i -lt $K ]; do SHARD=$i/$K RAW=1 node tools/expert-bench.js $N "$@" > $D/$i.json & i=$((i+1)); done; wait
node -e '
const fs=require("fs"),d=process.argv[1];let r={mirror:[0,0],mixed:[0,0]},tms=0,tn=0,tmax=0,st=0,pd={};
for(const f of fs.readdirSync(d)){const j=JSON.parse(fs.readFileSync(d+"/"+f));for(const k of ["mirror","mixed"]){r[k][0]+=j.res[k][0];r[k][1]+=j.res[k][1]}tms+=j.tms;tn+=j.tn;tmax=Math.max(tmax,j.tmax);st+=j.stall;for(const[k,v]of Object.entries(j.perDeck)){pd[k]=pd[k]||[0,0];pd[k][0]+=v[0];pd[k][1]+=v[1]}}
const ci=(w,n)=>{if(!n)return null;const p=w/n,z=1.96,dd=1+z*z/n,c=(p+z*z/(2*n))/dd,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/dd;return (100*p).toFixed(1)+"% [95% CI "+(100*(c-h)).toFixed(1)+"-"+(100*(c+h)).toFixed(1)+"] n="+n};
console.log(JSON.stringify({all:ci(r.mirror[0]+r.mixed[0],r.mirror[1]+r.mixed[1]),mirror:ci(...r.mirror),mixed:ci(...r.mixed),avgMs:+(tms/tn).toFixed(1),maxMs:tmax,stall:st}));
if(process.env.DECKS)for(const[k,v]of Object.entries(pd))console.log(k,v[0]+"/"+v[1]);' $D
