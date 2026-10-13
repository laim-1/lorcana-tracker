const V=window.APP_VERSION||"dev";
const API="https://api.lorcast.com/v0",KEY="lorcanaCollection.v1",SKEY="lorcanaSort.v2";
const LOGOS=new Set(["1","2","3","4","5","6","7","8","9","10","11","12"]);
const RAR=["Common","Uncommon","Rare","Super_rare","Legendary","Epic","Enchanted","Iconic","Promo","Special"];
const SET_SORTS={main:"Main sets first",new:"Newest first",old:"Oldest first",name:"Name A-Z",pct:"Most collected",value:"Highest value"};
const CARD_SORTS={num:"Card number",name:"Name A-Z",phigh:"Price high-low",plow:"Price low-high",rarity:"Rarity (rarest first)",qty:"Owned quantity"};
let col=(()=>{try{const o=JSON.parse(localStorage.getItem(KEY)||"{}");if(!o||typeof o!=="object"||Array.isArray(o))return{};for(const k of Object.keys(o)){const v=o[k];if(!v||typeof v!=="object"){delete o[k];continue}v.n=Math.max(0,+v.n||0);v.f=Math.max(0,+v.f||0);if(!v.n&&!v.f)delete o[k]}return o}catch(e){return{}}})(),sets=[],cache={},source="live",cur=null,F={own:"",rarity:"",ink:""};
let sort=(()=>{let o={};try{o=JSON.parse(localStorage.getItem(SKEY)||"{}")||{}}catch(e){}const r={sets:"main",cards:"num"};if(o&&SET_SORTS[o.sets])r.sets=o.sets;if(o&&CARD_SORTS[o.cards])r.cards=o.cards;return r})();
const S=window.LORCANA_SNAPSHOT,$=s=>document.querySelector(s),app=$("#app");
const save=()=>localStorage.setItem(KEY,JSON.stringify(col));
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pretty=r=>String(r||"").replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const slug=r=>String(r||"").toLowerCase().replace(/[_\s]+/g,"-");
const own=id=>{const c=col[id];return c&&(c.n+c.f)>0};
const qty=id=>{const c=col[id];return c?c.n+c.f:0};
function num(v){const n=parseFloat(v);return isNaN(n)?null:n}
const money=n=>n==null?"--":"$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const cardsFor=id=>cache[id]||S?.cards[id]||[];
const value=cards=>cards.reduce((t,c)=>{const v=col[c.id];return v?t+(c.usd||0)*v.n+(c.usd_foil||c.usd||0)*v.f:t},0);
const cnum=c=>parseInt(c.collector_number)||9999;
async function j(u){const r=await fetch(u,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw r.status;return r.json()}
const slim=c=>({id:c.id,name:c.name,version:c.version,collector_number:c.collector_number,rarity:c.rarity,ink:c.ink,img:c.image_uris?.digital?.normal,usd:num(c.prices?.usd),usd_foil:num(c.prices?.usd_foil),tcg:c.tcgplayer_id,text:c.text,cost:c.cost,type:c.type,str:c.strength,wil:c.willpower,lore:c.lore,inkwell:c.inkwell,cls:c.classifications,move:c.move_cost});
async function loadSets(){try{const today=new Date().toISOString().slice(0,10);
 sets=(await j(API+"/sets")).results.filter(s=>(s.released_at||"9")<=today);
 sets.forEach(s=>s.card_count=S?.sets.find(x=>x.id==s.id)?.card_count)}catch(e){sets=S.sets;source="snapshot"}}
async function loadCards(id){if(cache[id])return cache[id];
 try{if(source!="live")throw 0;cache[id]=(await j(`${API}/sets/${id}/cards`)).map(slim)}catch(e){cache[id]=S.cards[id]||[]}
 const s=sets.find(x=>x.id==id);if(s)s.card_count=cache[id].length;return cache[id]}
const srcLabel=()=>source=="live"?"Live TCGplayer prices via Lorcast":"Snapshot prices from "+S.fetched.slice(0,10);
const saveSort=()=>localStorage.setItem(SKEY,JSON.stringify(sort));
function chrome(set){const hid=(q,v)=>{const e=$(q);if(e)e.hidden=v};hid("#back",!set);hid("#tools",!set);hid("#menu-btn",!!set);
 hid("#play-btn",!!set);const ti=$("#title");if(ti){ti.textContent=set?set.name:"LIAM'S LORCANA";ti.classList.toggle("small",!!set)}}
function setStats(s){const cs=cardsFor(s.id),got=cs.filter(c=>own(c.id)).length,t=s.card_count||cs.length;return{got,t,p:t?got/t*100:0,v:value(cs)}}
let homeScroll=0,setScrollMap={};
function home(){cur=null;chrome(null);
 const st=new Map(sets.map(s=>[s.id,setStats(s)])),tot=[...st.values()].reduce((a,x)=>a+x.v,0),owned=Object.keys(col).length;
 const isMain=s=>/^\d+$/.test(String(s.code));
 const list=[...sets].sort({main:(a,b)=>isMain(b)-isMain(a)||b.released_at.localeCompare(a.released_at)||a.name.localeCompare(b.name),new:(a,b)=>b.released_at.localeCompare(a.released_at),old:(a,b)=>a.released_at.localeCompare(b.released_at),
  name:(a,b)=>a.name.localeCompare(b.name),pct:(a,b)=>st.get(b.id).p-st.get(a.id).p,value:(a,b)=>st.get(b.id).v-st.get(a.id).v}[sort.sets]);
 app.innerHTML=`<div class="hero"><div><div class="ql">Collection value</div><div class="hv">${money(tot)}</div></div><div class="hs">${owned} card${owned==1?"":"s"}<br>${sets.length} sets</div></div>
 <div class="sortnote">Sorted by ${SET_SORTS[sort.sets].toLowerCase()}</div>`+list.map(s=>{const {got,t,p,v}=st.get(s.id),logo=LOGOS.has(String(s.code));
  return `<button class="set" data-id="${s.id}">${logo?`<img class="logo" src="./assets/sets/${esc(s.code)}.png?v=${V}" alt="${esc(s.name)}" loading="lazy">`:`<div class="logo txt"><span>${esc(s.name)}</span></div>`}
  <div class="sbody"><div class="bar"><div style="width:${p}%"></div></div>
  <div class="prog"><span>${got}/${t}</span><span class="gold">${money(v)}</span></div></div></button>`}).join("");
 app.querySelectorAll(".set").forEach(e=>e.onclick=()=>location.hash="set/"+e.dataset.id);
 app.querySelectorAll("img.logo").forEach(i=>i.onerror=()=>{i.outerHTML=`<div class="logo txt"><span>${esc(i.alt)}</span></div>`});
 requestAnimationFrame(()=>{scrollTo(0,homeScroll||0)});watchImages(app)}
async function setView(id){homeScroll=scrollY;const s=sets.find(x=>x.id==id);chrome(s||{name:"Set"});$("#q").value="";app.innerHTML=`<p class="empty">Loading cards...</p>`;
 cur={id,cards:await loadCards(id)};F={own:"",rarity:"",ink:""};renderCards();scrollTo(0,setScrollMap[id]||0)}
function sortCards(a){const f={num:(x,y)=>cnum(x)-cnum(y),name:(x,y)=>x.name.localeCompare(y.name)||cnum(x)-cnum(y),
 phigh:(x,y)=>Math.max(y.usd||0,y.usd_foil||0)-Math.max(x.usd||0,x.usd_foil||0),plow:(x,y)=>(x.usd??x.usd_foil??1e9)-(y.usd??y.usd_foil??1e9),
 rarity:(x,y)=>RAR.indexOf(y.rarity)-RAR.indexOf(x.rarity)||cnum(x)-cnum(y),qty:(x,y)=>qty(y.id)-qty(x.id)||cnum(x)-cnum(y)}[sort.cards];return a.sort(f)}
function summary(){const got=cur.cards.filter(c=>own(c.id)).length;$("#sumline").innerHTML=`<span>${got}/${cur.cards.length} owned</span><span class="gold">${money(value(cur.cards))}</span>`}
function renderCards(){if(!cur)return;const {cards}=cur,q=$("#q").value.toLowerCase(),n=Object.values(F).filter(Boolean).length;
 $("#fcount").textContent=n||"";
 const list=sortCards(cards.filter(c=>(!q||(c.name+" "+(c.version||"")).toLowerCase().includes(q))&&(!F.rarity||c.rarity==F.rarity)&&(!F.ink||c.ink==F.ink)&&(!F.own||(F.own=="owned")==!!own(c.id))));
 app.innerHTML=`<div class="sumline" id="sumline"></div><div class="sortnote">${list.length} cards · ${CARD_SORTS[sort.cards].toLowerCase()}${source=="live"?"":" · "+srcLabel()}</div>`+(list.length?`<div class="grid">${list.map(c=>{const v=col[c.id]||{n:0,f:0};
  return `<div class="card ${own(c.id)?"owned":""}"><div class="art ${/Enchanted|Iconic|Epic|Legendary/.test(c.rarity||"")||(col[c.id]&&col[c.id].f)?"shiny":""} ${/Enchanted|Iconic/.test(c.rarity||"")?"ench":""}"><img loading="lazy" src="${esc(c.img)}" alt="${esc(c.name)} ${esc(c.version)}"></div>
  <div class="cn">#${esc(c.collector_number)} ${esc(c.name)}</div><div class="cv">${esc(c.version)}</div>
  <div class="tags"><span class="tag r-${slug(c.rarity)}">${esc(pretty(c.rarity))}</span>${c.ink?`<span class="tag">${esc(c.ink)}</span>`:""}</div>
  ${["n","f"].map(k=>`<div class="qty"><div class="ql"><span>${k=="n"?"Normal":"Foil"}</span><span class="pr">${money(k=="n"?c.usd:c.usd_foil)}</span></div><div class="stepper">
   <button class="big" data-id="${c.id}" data-k="${k}" data-d="-1" aria-label="Remove ${k=="n"?"normal":"foil"}">&minus;</button><b>${v[k]}</b>
   <button class="big plus" data-id="${c.id}" data-k="${k}" data-d="1" aria-label="Add ${k=="n"?"normal":"foil"}">+</button></div></div>`).join("")}
  ${c.tcg?`<a class="tcg" href="https://www.tcgplayer.com/product/${encodeURIComponent(c.tcg)}" target="_blank" rel="noopener">View on TCGplayer</a>`:""}</div>`}).join("")}</div>`:`<p class="empty">No cards match.</p>`);summary();watchImages(app)}
app.addEventListener("click",e=>{const im=e.target.closest(".card .art");if(im&&window.Zoom){zoomTracker(im);return}const b=e.target.closest(".big");if(!b)return;const id=b.dataset.id,k=b.dataset.k,c=col[id]||{n:0,f:0};
 const was=c.n+c.f;c[k]=Math.max(0,c[k]+ +b.dataset.d);if(c.n+c.f)col[id]=c;else delete col[id];save();if(+b.dataset.d>0&&window.FX){const card=b.closest(".card"),im=card&&card.querySelector("img");FX.at(b,{n:26,colors:k=="f"?[FX.COL.gold,FX.COL.blue,FX.COL.ink,FX.COL.white]:[FX.COL.gold,FX.COL.white],speed:2.8,size:2.8});if(im)FX.at(im,{n:was?14:34,colors:[FX.COL.gold,FX.COL.white,FX.COL.blue],speed:was?2:3.2,size:2.6});if(!was&&im){card.classList.remove("got");void card.offsetWidth;card.classList.add("got")}}
 b.parentNode.querySelector("b").textContent=c[k];b.closest(".card").classList.toggle("owned",c.n+c.f>0);summary()});
function zoomTracker(art,again){if(!again&&!window.LORCANA_GAME_CARDS){const s=document.createElement("script");s.src="./data/game-cards.js?v="+(window.APP_VERSION||"");s.onload=()=>{if(window.Zoom&&Zoom.isOpen()&&art.isConnected){Zoom.close(true);zoomTracker(art,true)}};document.head.appendChild(s)}const card=art.closest(".card"),id=card&&card.querySelector("[data-id]")?.dataset.id,c=cur&&cur.cards.find(x=>x.id===id);if(!c)return;
 const g=(window.LORCANA_GAME_CARDS&&window.LORCANA_GAME_CARDS.cards.find(x=>x.id===id))||{};const T=c.type||g.type,ty=T&&T[0]?String(T[0]).toLowerCase():"";
 const zc={name:c.name,version:c.version,full:c.name+(c.version?" - "+c.version:""),cost:c.cost??g.cost,ink:c.ink,type:ty,cls:c.cls||g.classifications,str:c.str??g.strength,wil:c.wil??g.willpower,lore:c.lore??g.lore,move:c.move??g.move_cost,text:c.text??g.text,inkable:c.inkwell??g.inkwell,rarity:pretty(c.rarity)};
 const v=col[id]||{n:0,f:0};Zoom.open({card:zc,img:c.img,large:c.img,from:art,state:[{t:"Owned: "+v.n+" normal, "+v.f+" foil",cls:v.n+v.f?"":"info"},{t:"#"+c.collector_number},...(c.usd?[{t:"Normal "+money(c.usd)}]:[]),...(c.usd_foil?[{t:"Foil "+money(c.usd_foil)}]:[])]})}
function openSheet(html,bind){$("#sheet-body").innerHTML=html;bind&&bind();$("#scrim").hidden=false;$("#sheet").classList.add("open");$("#sheet").setAttribute("aria-hidden","false")}
function closeSheet(){$("#sheet").classList.remove("open");$("#scrim").hidden=true;$("#sheet").setAttribute("aria-hidden","true")}
$("#scrim").onclick=closeSheet;
$("#sheet-body").addEventListener("click",e=>{const b=e.target.closest("[data-fx]");if(!b||!window.FX)return;FX.setLow(b.dataset.fx==="1");b.parentNode.querySelectorAll("[data-fx]").forEach(x=>x.classList.toggle("on",x===b))});
function filterSheet(){const u=k=>[...new Set(cur.cards.map(c=>c[k]).filter(Boolean))].sort((a,b)=>k=="rarity"?RAR.indexOf(a)-RAR.indexOf(b):a.localeCompare(b));
 const grp=(t,k,vals)=>`<h4>${t}</h4><div class="opts">${[["","All"],...vals].map(([v,l])=>`<button class="opt ${F[k]==v?"on":""}" data-k="${k}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>`;
 openSheet(grp("Collection","own",[["owned","Owned"],["missing","Missing"]])+grp("Rarity","rarity",u("rarity").map(r=>[r,pretty(r)]))+grp("Ink","ink",u("ink").map(r=>[r,r]))
  +`<button class="wide" id="reset">Clear filters</button><button class="wide primary" id="done">Show cards</button>`,
  ()=>{$("#sheet-body").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{F[b.dataset.k]=b.dataset.v;renderCards();filterSheet()});
   $("#reset").onclick=()=>{F={own:"",rarity:"",ink:""};renderCards();filterSheet()};$("#done").onclick=closeSheet})}
$("#filter-btn").onclick=filterSheet;
$("#sort-btn").onclick=()=>{const k=cur?"cards":"sets",opts=cur?CARD_SORTS:SET_SORTS;
 openSheet(`<h4>Sort ${k}</h4><div class="list">${Object.entries(opts).map(([v,l])=>`<button class="li ${sort[k]==v?"on":""}" data-v="${v}">${l}</button>`).join("")}</div>`,
  ()=>$("#sheet-body").querySelectorAll(".li").forEach(b=>b.onclick=()=>{sort[k]=b.dataset.v;saveSort();closeSheet();cur?renderCards():home()}))};
$("#menu-btn").onclick=()=>openSheet(`<h4>Effects</h4><div class="opts"><button class="opt ${window.FX&&!FX.low?"on":""}" data-fx="0">Full</button><button class="opt ${window.FX&&FX.low?"on":""}" data-fx="1">Low power</button></div><h4>Collection data</h4><p class="meta">${srcLabel()}</p>
 <button class="wide primary" id="exp">Export JSON</button><button class="wide" id="imp">Import JSON</button><button class="wide" id="cls">Close</button>`,
 ()=>{$("#exp").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,exported:new Date().toISOString(),collection:col},null,1)],{type:"application/json"}));a.download="lorcana-collection.json";a.click()};
  $("#imp").onclick=()=>$("#import").click();$("#cls").onclick=closeSheet});
$("#import").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());col=d.collection||d;save();closeSheet();route();alert("Collection imported")}catch(x){alert("Invalid JSON file")}e.target.value=""};
$("#q").oninput=renderCards;
$("#back").onclick=()=>{if(cur)setScrollMap[cur.id]=scrollY;location.hash=""};
function route(){if(window.FX&&location.hash!=="#play")FX.mode("tracker");document.body.classList.remove("enter-anim");void document.body.offsetWidth;document.body.classList.add("enter-anim");if(location.hash==="#play"){window.LorcanaPlay.open();return}window.LorcanaPlay&&window.LorcanaPlay.close();const m=location.hash.match(/set\/(.+)/);m?setView(m[1]):home()}
$("#play-btn").onclick=()=>location.hash="play";
window.onhashchange=route;loadSets().then(route);
// Cache control: drop service workers; keep card-image cache across deploys (versioned app files still bust via ?v=).
if("serviceWorker" in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
const IMG_CACHE="lorcana-imgs-v1";
if(window.caches)caches.keys().then(ks=>ks.forEach(k=>{if(k!==IMG_CACHE&&!k.startsWith("lorcana-game-cards"))caches.delete(k)})).catch(()=>{});
async function cacheImg(url){if(!url||!window.caches)return;try{const c=await caches.open(IMG_CACHE);if(await c.match(url))return;const r=await fetch(url,{mode:"cors",credentials:"omit",cache:"force-cache"});if(r&&r.ok)await c.put(url,r.clone())}catch(e){}}
function watchImages(root){if(!root)return;root.querySelectorAll("img[src]").forEach(img=>{const u=img.currentSrc||img.src;if(u&&!u.startsWith("data:")){if(img.complete)cacheImg(u);else img.addEventListener("load",()=>cacheImg(u),{once:true})}})}
async function checkVersion(){if(V=="dev")return;try{
 const r=await fetch("./version.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const {version}=await r.json();
 if(!version||version==V)return;const g="lorcanaReloadedFor";if(sessionStorage.getItem(g)==version)return;
 sessionStorage.setItem(g,version);const u=new URL(location.href);u.searchParams.set("v",version);location.replace(u.toString())}catch(e){}}
checkVersion();document.addEventListener("visibilitychange",()=>{if(document.visibilityState=="visible")checkVersion()});
