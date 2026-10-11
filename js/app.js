const API="https://api.lorcast.com/v0",KEY="lorcanaCollection.v1";
let col=JSON.parse(localStorage.getItem(KEY)||"{}"),sets=[],cache={},source="live",cur=null,F={own:"",rarity:"",ink:""};
const S=window.LORCANA_SNAPSHOT,$=s=>document.querySelector(s),app=$("#app");
const save=()=>localStorage.setItem(KEY,JSON.stringify(col));
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pretty=r=>String(r||"").replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const slug=r=>String(r||"").toLowerCase().replace(/[_\s]+/g,"-");
const own=id=>{const c=col[id];return c&&(c.n+c.f)>0};
async function j(u){const r=await fetch(u,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw r.status;return r.json()}
const slim=c=>({id:c.id,name:c.name,version:c.version,collector_number:c.collector_number,rarity:c.rarity,ink:c.ink,img:c.image_uris?.digital?.normal,usd:num(c.prices?.usd),usd_foil:num(c.prices?.usd_foil),tcg:c.tcgplayer_id});
function num(v){const n=parseFloat(v);return isNaN(n)?null:n}
const money=n=>n==null?"--":"$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const cardsFor=id=>cache[id]||S?.cards[id]||[];
const value=cards=>cards.reduce((t,c)=>{const v=col[c.id];return v?t+(c.usd||0)*v.n+(c.usd_foil||c.usd||0)*v.f:t},0);
async function loadSets(){try{const today=new Date().toISOString().slice(0,10);
 sets=(await j(API+"/sets")).results.filter(s=>(s.released_at||"9")<=today);
 sets.forEach(s=>s.card_count=S?.sets.find(x=>x.id==s.id)?.card_count)}catch(e){sets=S.sets;source="snapshot"}}
async function loadCards(id){if(cache[id])return cache[id];
 try{if(source!="live")throw 0;cache[id]=(await j(`${API}/sets/${id}/cards`)).map(slim)}catch(e){cache[id]=S.cards[id]||[]}
 const s=sets.find(x=>x.id==id);if(s)s.card_count=cache[id].length;return cache[id]}
const srcLabel=()=>source=="live"?"Live prices: TCGplayer via Lorcast":"Snapshot prices from "+S.fetched.slice(0,10);
function chrome(set){$("#back").hidden=!set;$("#filter-btn").hidden=!set;$("#title").textContent=set?set.name:"LIAM'S LORCANA";
 $("#q").placeholder=set?"Search cards by name":"Search sets";}
function home(){cur=null;chrome(null);const q=$("#q").value.toLowerCase();
 const list=sets.filter(s=>!q||s.name.toLowerCase().includes(q)||String(s.code).toLowerCase()==q);
 const tot=sets.reduce((t,s)=>t+value(cardsFor(s.id)),0);
 $("#sub").textContent=`${sets.length} released sets · ${srcLabel()}`;
 const hero=`<div class="hero"><div class="ql">COLLECTION VALUE</div><div class="hv">${money(tot)}</div><div class="meta">${Object.keys(col).length} card${Object.keys(col).length==1?"":"s"} owned · market prices from TCGplayer</div></div>`;
 app.innerHTML=hero+list.map(s=>{const ids=cardsFor(s.id).map(c=>c.id),got=ids.filter(own).length,t=s.card_count||ids.length,p=t?got/t*100:0;
  return `<button class="set" data-id="${s.id}"><h3>${esc(s.name)}</h3><div class="meta">Set ${esc(s.code)} · ${esc(s.released_at)} · ${t} cards</div>
  <div class="bar"><div style="width:${p}%"></div></div><div class="prog"><span>${got} / ${t} collected</span><span>${p.toFixed(0)}%</span></div><div class="prog val"><span>Owned value</span><span>${money(value(cardsFor(s.id)))}</span></div></button>`}).join("")||`<p class="empty">No sets match.</p>`;
 app.querySelectorAll(".set").forEach(e=>e.onclick=()=>{$("#q").value="";location.hash="set/"+e.dataset.id})}
async function setView(id){const s=sets.find(x=>x.id==id);chrome(s||{name:"Set"});app.innerHTML=`<p class="empty">Loading cards...</p>`;
 cur={id,cards:await loadCards(id)};F={own:"",rarity:"",ink:""};renderCards();scrollTo(0,0)}
function renderCards(){if(!cur)return;const {cards}=cur,q=$("#q").value.toLowerCase();
 const got=cards.filter(c=>own(c.id)).length,n=Object.values(F).filter(Boolean).length;
 $("#fcount").textContent=n||"";
 const list=cards.filter(c=>(!q||(c.name+" "+(c.version||"")).toLowerCase().includes(q))&&(!F.rarity||c.rarity==F.rarity)&&(!F.ink||c.ink==F.ink)&&(!F.own||(F.own=="owned")==!!own(c.id)));
 $("#sub").textContent=`${got} / ${cards.length} collected · ${money(value(cards))} · showing ${list.length}`;
 app.innerHTML=list.length?`<div class="grid">${list.map(c=>{const v=col[c.id]||{n:0,f:0};
  return `<div class="card ${own(c.id)?"owned":""}"><img loading="lazy" src="${esc(c.img)}" alt="${esc(c.name)} ${esc(c.version)}">
  <div class="cn">#${esc(c.collector_number)} ${esc(c.name)}</div><div class="cv">${esc(c.version)}</div>
  <div class="tags"><span class="tag r-${slug(c.rarity)}">${esc(pretty(c.rarity))}</span>${c.ink?`<span class="tag">${esc(c.ink)}</span>`:""}</div>
  ${["n","f"].map(k=>`<div class="qty"><div class="ql"><span>${k=="n"?"NORMAL":"FOIL"}</span><span class="pr">${money(k=="n"?c.usd:c.usd_foil)}</span></div><div class="stepper">
   <button class="big" data-id="${c.id}" data-k="${k}" data-d="-1" aria-label="Remove ${k=="n"?"normal":"foil"}">&minus;</button><b>${v[k]}</b>
   <button class="big plus" data-id="${c.id}" data-k="${k}" data-d="1" aria-label="Add ${k=="n"?"normal":"foil"}">+</button></div></div>`).join("")}${c.tcg?`<a class="tcg" href="https://www.tcgplayer.com/product/${encodeURIComponent(c.tcg)}" target="_blank" rel="noopener">View on TCGplayer</a>`:""}</div>`}).join("")}</div>`:`<p class="empty">No cards match.</p>`}
app.addEventListener("click",e=>{const b=e.target.closest(".big");if(!b)return;const id=b.dataset.id,k=b.dataset.k,c=col[id]||{n:0,f:0};
 c[k]=Math.max(0,c[k]+ +b.dataset.d);if(c.n+c.f)col[id]=c;else delete col[id];save();
 const card=b.closest(".card");b.parentNode.querySelector("b").textContent=c[k];card.classList.toggle("owned",c.n+c.f>0);
 const got=cur.cards.filter(x=>own(x.id)).length;$("#sub").textContent=$("#sub").textContent.replace(/^\d+ \/ (\d+) collected · [^·]+·/,`${got} / $1 collected · ${money(value(cur.cards))} ·`)});
function openSheet(html,bind){$("#sheet-body").innerHTML=html;bind&&bind();$("#scrim").hidden=false;$("#sheet").classList.add("open");$("#sheet").setAttribute("aria-hidden","false")}
function closeSheet(){$("#sheet").classList.remove("open");$("#scrim").hidden=true;$("#sheet").setAttribute("aria-hidden","true")}
$("#scrim").onclick=closeSheet;
function filterSheet(){const u=k=>[...new Set(cur.cards.map(c=>c[k]).filter(Boolean))].sort();
 const grp=(t,k,vals)=>`<h4>${t}</h4><div class="opts">${[["","All"],...vals].map(([v,l])=>`<button class="opt ${F[k]==v?"on":""}" data-k="${k}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>`;
 openSheet(grp("Collection","own",[["owned","Owned"],["missing","Missing"]])+grp("Rarity","rarity",u("rarity").map(r=>[r,pretty(r)]))+grp("Ink","ink",u("ink").map(r=>[r,r]))
  +`<button class="wide" id="reset">Clear filters</button><button class="wide primary" id="done">Show cards</button>`,
  ()=>{$("#sheet-body").querySelectorAll(".opt").forEach(b=>b.onclick=()=>{F[b.dataset.k]=b.dataset.v;renderCards();filterSheet()});
   $("#reset").onclick=()=>{F={own:"",rarity:"",ink:""};renderCards();filterSheet()};$("#done").onclick=closeSheet})}
$("#filter-btn").onclick=filterSheet;
$("#menu-btn").onclick=()=>openSheet(`<h4>Collection data</h4><p class="meta">${Object.keys(col).length} cards owned · ${srcLabel()}</p>
 <button class="wide primary" id="exp">Export JSON</button><button class="wide" id="imp">Import JSON</button><button class="wide" id="cls">Close</button>`,
 ()=>{$("#exp").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({version:1,exported:new Date().toISOString(),collection:col},null,1)],{type:"application/json"}));a.download="lorcana-collection.json";a.click()};
  $("#imp").onclick=()=>$("#import").click();$("#cls").onclick=closeSheet});
$("#import").onchange=async e=>{try{const d=JSON.parse(await e.target.files[0].text());col=d.collection||d;save();closeSheet();route();alert("Collection imported")}catch(x){alert("Invalid JSON file")}e.target.value=""};
$("#q").oninput=()=>cur?renderCards():home();
$("#back").onclick=()=>{$("#q").value="";location.hash=""};
function route(){const m=location.hash.match(/set\/(.+)/);m?setView(m[1]):home()}
window.onhashchange=route;loadSets().then(route);
