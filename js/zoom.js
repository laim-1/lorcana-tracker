/* Card zoom: near full-screen high-res card + readable text, zoom-from-origin, tap outside / swipe down to close. */
(function(){
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const SYM={S:["str","STR"],W:["wil","WIL"],L:["lore","LORE"],I:["ink","INK"],E:["ex","EXERT"],C:["ink","INK"]};
const sym=k=>{const s=SYM[k];return s?`<span class="zs zs-${s[0]}">${s[1]}</span>`:k};
function fmtText(t){if(!t)return"";return esc(t).split(/\n+/).map(line=>{
  line=line.replace(/\(([^)]*)\)/g,(m,x)=>`<i class="zrem">(${x})</i>`);
  line=line.replace(/^((?:[A-Z0-9'’!?.,\-&]+ )+)(?=[A-Z][a-z]|\{|&quot;|“|—|<)/,(m)=>{const t=m.trim();return /[A-Z]{2}/.test(t)&&!/^(Shift|Evasive|Bodyguard|Rush|Ward|Reckless|Support|Challenger|Resist|Singer|Vanish|Boost)\b/.test(t)?`<b class="zan">${t}</b> `:m});
  line=line.replace(/\{([A-Z])\}/g,(m,k)=>sym(k));return`<p>${line}</p>`}).join("")}
const big=u=>u?String(u).replace(/\/(small|normal)\//,"/large/"):u;
let el=null,origin=null,closing=false;
function build(o){const c=o.card||{};const stats=[];
  if(c.cost!=null)stats.push(`<span class="zst cost"><b>${c.cost}</b>COST</span>`);
  if(c.str!=null&&c.type==="character")stats.push(`<span class="zst str"><b>${o.live?.str??c.str}</b>STR</span>`);
  if(c.wil!=null&&(c.type==="character"||c.type==="location"))stats.push(`<span class="zst wil"><b>${o.live?.wil??c.wil}</b>WIL</span>`);
  if(c.lore!=null&&(c.type==="character"||c.type==="location"))stats.push(`<span class="zst lore"><b>${o.live?.lore??c.lore}</b>LORE</span>`);
  if(c.move!=null&&c.type==="location")stats.push(`<span class="zst"><b>${c.move}</b>MOVE</span>`);
  const meta=[c.ink,c.type&&c.type[0].toUpperCase()+c.type.slice(1),...(c.cls||[])].filter(Boolean).join(" · ");
  const acts=o.actions&&o.actions.length?`<div class="zacts">${o.actions.map((a,i)=>`<button class="ab ${a.cls||""}" data-zi="${i}" ${a.key?`data-k="${a.key}"`:""}>${esc(a.label)}${a.sub?` <small>${esc(a.sub)}</small>`:""}</button>`).join("")}</div>`:"";
  return`<div class="zscrim"></div><div class="zpanel ${acts?"hasacts":""}" role="dialog" aria-label="${esc(c.full||c.name||"Card")}">
   <div class="zwrap">
   <div class="zgrab"></div><div class="zimg"><img class="zlo" src="${esc(o.img)}" alt="${esc(c.full||c.name||"")}"><img class="zhi" alt="" ${o.img?`src="${esc(big(o.large||o.img))}"`:""}></div>
   <div class="zinfo"><h3>${esc(c.name||"")}${c.version?`<small>${esc(c.version)}</small>`:""}</h3>
    ${meta?`<div class="zmeta">${esc(meta)}${c.inkable===false?" · Not inkable":c.inkable?" · Inkable":""}${c.rarity?" · "+esc(c.rarity):""}</div>`:""}
    ${stats.length?`<div class="zstats">${stats.join("")}</div>`:""}
    ${o.state&&o.state.length?`<div class="zstate">${o.state.map(s=>`<span class="${s.cls||""}">${esc(s.t||s)}</span>`).join("")}</div>`:""}
    <div class="ztext">${fmtText(c.text)||(c.type?`<p class="zrem">No rules text.</p>`:"")}</div>${o.extra||""}</div>
   </div>${acts}<button class="zclose" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button></div>`}
const low=()=>document.body.classList.contains("lowfx")||(matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
function open(o){if(el)el.remove();closing=false;origin=o.from&&o.from.getBoundingClientRect?o.from:null;
  el=document.createElement("div");el.className="zoom";el.innerHTML=build(o);document.body.appendChild(el);document.body.classList.add("zoomed");
  const hi=el.querySelector(".zhi");hi.onload=()=>hi.classList.add("in");hi.onerror=()=>hi.remove();
  el.querySelector(".zscrim").onclick=close;el.querySelector(".zclose").onclick=close;
  el.querySelectorAll("[data-zi]").forEach(b=>b.onclick=()=>{const a=o.actions[+b.dataset.zi];close(true);a.fn&&a.fn()});
  const im=el.querySelector(".zimg"),panel=el.querySelector(".zpanel"),wrap=el.querySelector(".zwrap");
  if(!low()&&origin){const r=origin.getBoundingClientRect(),f=im.getBoundingClientRect();if(r.width&&f.width){
    const s=r.width/f.width,dx=r.left+r.width/2-(f.left+f.width/2),dy=r.top+r.height/2-(f.top+f.height/2);
    im.animate([{transform:`translate(${dx}px,${dy}px) scale(${s})`},{transform:"none"}],{duration:340,easing:"cubic-bezier(.2,.9,.25,1)"})}}
  if(!low()){el.querySelector(".zinfo").animate([{opacity:0,transform:"translateY(24px)"},{opacity:1,transform:"none"}],{duration:380,delay:80,fill:"backwards",easing:"ease-out"});
    el.querySelector(".zscrim").animate([{opacity:0},{opacity:1}],{duration:250})}
  // swipe down to close (ignore when scrolling card text)
  let y0=null,dy=0;wrap.addEventListener("touchstart",e=>{if(wrap.scrollTop>0)return;y0=e.touches[0].clientY;dy=0},{passive:true});
  wrap.addEventListener("touchmove",e=>{if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);panel.style.transform=`translateY(${dy}px)`;panel.style.opacity=String(1-Math.min(.6,dy/400))},{passive:true});
  wrap.addEventListener("touchend",()=>{if(y0==null)return;y0=null;if(dy>90)close();else{panel.style.transform="";panel.style.opacity=""}});
  return el}
function close(fast){if(!el||closing)return;closing=true;const z=el;el=null;document.body.classList.remove("zoomed");
  if(low()||fast===true){z.remove();return}
  const im=z.querySelector(".zimg");let a;
  if(origin&&origin.isConnected){const r=origin.getBoundingClientRect(),f=im.getBoundingClientRect();const s=r.width/f.width,dx=r.left+r.width/2-(f.left+f.width/2),dy=r.top+r.height/2-(f.top+f.height/2);
    a=im.animate([{transform:"none"},{transform:`translate(${dx}px,${dy}px) scale(${s})`}],{duration:260,easing:"ease-in",fill:"forwards"})}
  z.querySelector(".zinfo").animate([{opacity:1},{opacity:0}],{duration:180,fill:"forwards"});z.querySelector(".zscrim").animate([{opacity:1},{opacity:0}],{duration:260,fill:"forwards"});
  const kill=()=>z.remove();if(a)a.onfinish=kill;setTimeout(kill,320)}
addEventListener("keydown",e=>{if(e.key==="Escape")close()});
window.Zoom={open,close,isOpen:()=>!!el,fmtText,big};
})();
