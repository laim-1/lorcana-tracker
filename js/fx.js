/* Native long-press/drag suppression (iOS Safari callout "Copy image", text selection, drag ghosts). */
(function(){const isField=t=>t&&t.closest&&t.closest("input,textarea,select,[contenteditable=true]");
  document.addEventListener("contextmenu",e=>{if(!isField(e.target))e.preventDefault()},{capture:true});
  document.addEventListener("dragstart",e=>{if(e.target&&e.target.tagName==="IMG")e.preventDefault()},{capture:true});
  document.addEventListener("selectstart",e=>{if(!isField(e.target))e.preventDefault()},{capture:true});
  const fix=root=>{if(root.tagName==="IMG")root.draggable=false;if(root.querySelectorAll)for(const i of root.querySelectorAll("img"))i.draggable=false};
  const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)fix(n)});
  const go=()=>{fix(document.body);mo.observe(document.body,{childList:true,subtree:true})};
  if(document.body)go();else document.addEventListener("DOMContentLoaded",go)})();
/* Visual effects: animated inky background + particles. One RAF loop, capped particle count,
   pauses when hidden, honours prefers-reduced-motion and a low-power setting. */
(function(){
const KEY="lorcanaFx.v1",rm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)");
let cfg={low:false};try{const o=JSON.parse(localStorage.getItem(KEY)||"{}");if(o&&typeof o==="object")cfg.low=o.low===true}catch(e){}
const reduced=()=>!!(rm&&rm.matches),low=()=>cfg.low||reduced();
const bg=document.createElement("canvas"),fg=document.createElement("canvas");bg.id="fx-bg";fg.id="fx-fg";
bg.setAttribute("aria-hidden","true");fg.setAttribute("aria-hidden","true");
document.body.prepend(bg);document.body.appendChild(fg);
const bx=bg.getContext("2d"),fx=fg.getContext("2d");let W=0,H=0,DPR=1;
function size(){DPR=Math.min(2,window.devicePixelRatio||1);W=innerWidth;H=innerHeight;
  for(const c of[bg,fg]){c.width=Math.round(W*(c===bg?Math.min(DPR,1):DPR));c.height=Math.round(H*(c===bg?Math.min(DPR,1):DPR))}
  bx.setTransform(bg.width/W,0,0,bg.height/H,0,0);fx.setTransform(DPR,0,0,DPR,0,0);drawBg(0,true)}
let mode="tracker";
const THEMES={tracker:{base:["#120d2e","#1d1550","#0b0a1f"],blobs:["#4b2fa8","#1f5fb8","#a0368f","#d4a73c"]},
              board:{base:["#0c1430","#16123f","#070814"],blobs:["#22549e","#5a2fa8","#1d8a8a","#d4a73c"]}};
const blobs=[0,1,2,3].map(i=>({x:Math.random(),y:Math.random(),r:.45+Math.random()*.3,sx:(Math.random()-.5)*.00004,sy:(Math.random()-.5)*.00004,ph:Math.random()*6.28,i}));
let lastBg=0;
function drawBg(t,force){if(!force&&t-lastBg<(low()?1e9:66))return;lastBg=t;const th=THEMES[mode];
  const g=bx.createLinearGradient(0,0,W*.3,H);g.addColorStop(0,th.base[0]);g.addColorStop(.55,th.base[1]);g.addColorStop(1,th.base[2]);
  bx.globalCompositeOperation="source-over";bx.fillStyle=g;bx.fillRect(0,0,W,H);bx.globalCompositeOperation="lighter";
  for(const b of blobs){if(!low()){b.x+=b.sx*66;b.y+=b.sy*66;if(b.x<-.2||b.x>1.2)b.sx*=-1;if(b.y<-.2||b.y>1.2)b.sy*=-1}
    const x=b.x*W,y=b.y*H,r=b.r*Math.max(W,H)*(1+.08*Math.sin(t/4000+b.ph)),c=th.blobs[b.i];
    const rg=bx.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,c+(b.i===3?"22":"55"));rg.addColorStop(1,c+"00");bx.fillStyle=rg;bx.fillRect(0,0,W,H)}
  // ink swirl ley-lines
  bx.strokeStyle="rgba(245,201,85,.07)";bx.lineWidth=1.5;
  for(let k=0;k<3;k++){bx.beginPath();for(let x=0;x<=W;x+=12){const y=H*(.25+.25*k)+Math.sin(x/90+t/(5000+k*900)+k)*26+Math.sin(x/37+k)*6;x?bx.lineTo(x,y):bx.moveTo(x,y)}bx.stroke()}
  bx.globalCompositeOperation="source-over";const v=bx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(3,2,10,.65)");bx.fillStyle=v;bx.fillRect(0,0,W,H)}
const P=[],MAX=()=>low()?40:160;
function amb(){return{x:Math.random()*W,y:H+10,vx:(Math.random()-.5)*.15,vy:-(.15+Math.random()*.35),life:1,decay:.0012+Math.random()*.0015,s:1+Math.random()*2.2,c:Math.random()<.7?"245,201,85":"150,180,255",amb:1,tw:Math.random()*6}}
function add(p){if(P.length>=MAX())P.splice(P.findIndex(q=>q.amb)>=0?P.findIndex(q=>q.amb):0,1);P.push(p)}
const COL={gold:"245,201,85",ink:"150,110,255",blue:"110,190,255",red:"255,110,120",white:"255,255,255",green:"120,230,170"};
function burst(x,y,o={}){if(reduced())return;const n=Math.min(o.n||24,low()?10:40),c=o.colors||[COL[o.color||"gold"]];
  for(let i=0;i<n;i++){const a=Math.random()*6.283,sp=(o.speed||2.2)*(.4+Math.random());
    add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-(o.up||0),g:o.gravity??.04,life:1,decay:.012+Math.random()*.02,s:(o.size||2.2)*(.6+Math.random()),c:c[i%c.length],drag:.96,to:o.to?{x:o.to.x,y:o.to.y,k:.0}:null,smoke:o.smoke})}}
function flyTo(x,y,tx,ty,o={}){if(reduced())return;const n=Math.min(o.n||14,low()?6:22);
  for(let i=0;i<n;i++){const a=Math.random()*6.283,sp=1+Math.random()*2;add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:0,life:1,decay:.008,s:2+Math.random()*2,c:COL[o.color||"gold"],drag:.94,to:{x:tx,y:ty,k:0,d:i*2}})}}
function rect(el){const r=(typeof el==="string"?document.querySelector(el):el)?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2,r}:null}
function at(el,o){const p=rect(el);if(p)burst(p.x,p.y,o)}
function celebrate(){if(reduced())return;let k=0;const go=()=>{for(let i=0;i<3;i++)burst(W*(.15+Math.random()*.7),H*(.15+Math.random()*.4),{n:30,colors:[COL.gold,COL.blue,COL.ink,COL.white],speed:3.2,gravity:.06});if(++k<(low()?2:6))setTimeout(go,350)};go()}
let run=true,lastT=0,ambT=0;
function loop(t){if(!run)return;requestAnimationFrame(loop);const dt=Math.min(3,(t-lastT)/16.7||1);lastT=t;
  drawBg(t);fx.clearRect(0,0,W,H);
  if(!reduced()&&t-ambT>(low()?900:260)){ambT=t;if(P.filter(p=>p.amb).length<(low()?8:26))P.push(amb())}
  fx.globalCompositeOperation="lighter";
  for(let i=P.length-1;i>=0;i--){const p=P[i];
    if(p.to){p.to.k=Math.min(1,p.to.k+.012*dt);if(p.to.d>0){p.to.d--;}else{p.vx+=(p.to.x-p.x)*.012*p.to.k*dt;p.vy+=(p.to.y-p.y)*.012*p.to.k*dt}if(Math.abs(p.to.x-p.x)+Math.abs(p.to.y-p.y)<14&&p.to.k>.3)p.life=0}
    if(p.drag){p.vx*=Math.pow(p.drag,dt);p.vy*=Math.pow(p.drag,dt)}p.vy+=(p.g||0)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=p.decay*dt;
    if(p.life<=0||p.y<-20){P.splice(i,1);continue}
    const a=p.amb?Math.min(1,p.life*3)*(.45+.35*Math.sin(t/400+p.tw)):p.life,s=p.s*(p.smoke?(2-p.life)*2:1);
    fx.fillStyle=`rgba(${p.c},${(a*(p.smoke?.35:1)).toFixed(3)})`;fx.beginPath();fx.arc(p.x,p.y,s,0,6.283);fx.fill();
    if(!low()&&s>1.6){fx.fillStyle=`rgba(${p.c},${(a*.18).toFixed(3)})`;fx.beginPath();fx.arc(p.x,p.y,s*3,0,6.283);fx.fill()}}
  fx.globalCompositeOperation="source-over"}
document.addEventListener("visibilitychange",()=>{if(document.hidden)run=false;else if(!run){run=true;lastT=performance.now();requestAnimationFrame(loop)}});
addEventListener("resize",size);size();requestAnimationFrame(loop);
window.FX={burst,flyTo,at,rect,celebrate,COL,
  mode(m){if(m!==mode&&THEMES[m]){mode=m;document.body.dataset.fx=m;drawBg(performance.now(),true)}},
  get low(){return cfg.low},setLow(v){cfg.low=!!v;localStorage.setItem(KEY,JSON.stringify(cfg));document.body.classList.toggle("lowfx",low());drawBg(performance.now(),true)},
  count:()=>P.length};
document.body.classList.toggle("lowfx",low());document.body.dataset.fx=mode;
})();
