const $=s=>document.querySelector(s), esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let SERVER={ai:false,up:false}, T=null; // T = current tutorial
fetch("/api/status").then(r=>r.json()).then(s=>{SERVER={...s,up:true};$("#status").textContent=s.ai?`Server on. AI model: ${s.model}`:"Server on. No AI model connected: link/topic steps use rule-based extraction (rougher)."}).catch(()=>{$("#status").textContent="Offline mode: built-in guides only. Run server.py for links and topic search."});
$("#chips").innerHTML=PRESETS.map(p=>`<button class="chip" data-id="${p.id}">${esc(p.title.split(" (")[0])}</button>`).join("");
$("#chips").onclick=e=>{const b=e.target.closest("[data-id]");if(b)load(PRESETS.find(p=>p.id==b.dataset.id))};
$("#go").onclick=run; $("#q").onkeydown=e=>{if(e.key=="Enter")run()};
async function post(u,b){const r=await fetch(u,{method:"POST",body:JSON.stringify(b)});const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);return j}
async function run(){
  const q=$("#q").value.trim(); if(!q)return;
  if(!SERVER.up){$("#out").innerHTML=`<div class="card err">Links and topic search need the local server (python3 server.py). Built-in guides above work without it.</div>`;return}
  $("#out").innerHTML=`<div class="card">Working… searching, reading and checking sources.</div>`;
  try{const isUrl=/^https?:\/\//i.test(q); load(await (isUrl?post("/api/tutorial2",{url:q}):post("/api/topic",{topic:q})))}
  catch(e){$("#out").innerHTML=`<div class="card err">${esc(e.message)}</div>`}
}
// Guardrail: classify risk from the title + step text so high-risk tasks get a prominent notice (rules, not AI).
const RISK=[[/mains|230v|120v|live wire|breaker|outlet|rewir|electrical panel/i,"Electrical work can kill. Turn off power at the breaker and have a qualified adult or electrician do or check it."],[/gas (?:line|stove|leak)|propane|natural gas/i,"Gas work can cause fires and explosions. Do not do this yourself."],[/bleach|ammonia|acid|solvent|chemical|lye/i,"Chemicals: wear eye and skin protection, ventilate, and never mix cleaners."],[/chainsaw|table saw|circular saw|angle grinder|power tool|blade|knife|soldering|torch|welding/i,"Sharp or hot tools: get adult supervision if you're under 18 and wear eye protection."],[/medicat|dosage|surgery|suture|injection/i,"Medical steps: follow a professional, not a tutorial."],[/lithium|battery pack|li-?ion/i,"Lithium batteries can ignite if punctured or short-circuited."]];
function risks(){const h=(T.title+" "+T.steps.map(s=>s.title+" "+s.detail).join(" "));return RISK.filter(r=>r[0].test(h)).map(r=>r[1])}
// Materials on hand: user lists what they have; we flag listed needs that aren't mentioned.
function have(){return (localStorage.getItem("sw:have")||"").toLowerCase().split(/[,\n]/).map(s=>s.trim()).filter(Boolean)}
function missing(){const h=have();if(!h.length||!T.materials?.length)return null;const txt=T.materials.join(" ").toLowerCase();return T.materials.filter(m=>!h.some(x=>m.toLowerCase().includes(x)||x.includes(m.toLowerCase().split(" ")[0])))}
function setHave(v){localStorage.setItem("sw:have",v);render()}
function key(){return "sw:"+(T.id||T.source_url)}
function load(t){T=t;T.checked=JSON.parse(localStorage.getItem(key())||"[]");render()}
function render(){
  const n=T.steps.length, done=T.checked.filter(Boolean).length, cur=T.steps.findIndex((_,i)=>!T.checked[i]);
  let h=`<div class="card"><b>${esc(T.title)}</b><div class="meta">${T.id?`<span class="badge">built-in guide, hand-written, not extracted</span>`:`<span class="badge">${T.ai?"AI-structured":"rule-based extraction"}</span><a href="${esc(T.source_url)}" target="_blank" rel="noopener">source</a>`}</div>
  <div class="bar"><i style="width:${n?done/n*100:0}%"></i></div><div class="meta">${done} of ${n} steps done</div></div>`;
  if(T.materials?.length)h+=`<div class="card"><b>You'll need</b><div>${T.materials.map(esc).join(" · ")}</div></div>`;
  h+=`<div class="card"><b>What do you have on hand?</b><input type="text" id="have" value="${esc(localStorage.getItem("sw:have")||"")}" placeholder="e.g. paper, scissors" onchange="setHave(this.value)">${(()=>{const m=missing();return m===null?"":m.length?`<div class="meta">Possibly missing: ${m.map(esc).join("; ")}</div>`:`<div class="meta">You seem to have what's listed.</div>`})()}</div>`;
  const rk=risks();if(rk.length)h+=`<div class="card err"><b>⛔ High-risk task</b><ul>${rk.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>This app can't verify the steps are safe. Treat them as a starting point only.</div>`;
  if(T.warnings?.length)h+=`<div class="card warn"><h3>⚠ Before you start</h3><ul>${T.warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></div>`;
  if(T.rejected_steps?.length)h+=`<div class="card warn"><h3>Removed: not found in the source</h3><p>The AI wrote these, but the source text does not support them, so they are not in your steps:</p><ul>${T.rejected_steps.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></div>`;
  if(T.grounding_summary)h+=`<div class="card meta"><span class="badge ${T.grounding_summary.rate>=.8?"g":"r"}">${T.grounding_summary.grounded_steps}/${T.grounding_summary.total} steps matched to source text</span>${esc(T.method||"")}. Relevance ${T.relevance??"-"}. This is a word-overlap match with the source, not a check that the steps are correct. Check anything important against the source.</div>`;
  if(T.video_note)h+=`<div class="card warn"><b>${esc(T.video_note)}</b></div>`;
  if(T.trace)h+=`<details class="card"><summary>How the agent found this (${T.trace.length} actions)</summary><div class="trace">${esc(T.trace.map((t,i)=>`${i+1}. [${t.tool}] ${t.input||""} ${t.output?"-> "+t.output:""}`).join("\n"))}</div>${T.alternatives?.length?`<div class="meta">Other sources considered: ${T.alternatives.map(a=>`<a href="${esc(a.url)}" target="_blank">${esc(a.title.slice(0,40))}</a> (${a.quality})`).join(", ")}</div>`:""}</details>`;
  h+=`<div class="row" style="margin:6px 0"><button class="ghost sm" onclick="openAR(${Math.max(cur,0)})">📷 AR guide</button>${T.paper?`<button class="ghost sm" onclick="openAR(${Math.max(cur,0)},'ar.html?demo=1')">▶ 3D fold preview (no camera)</button><button class="ghost sm" onclick="openAR(${Math.max(cur,0)},'xr.html')">🧪 Surface AR (experimental, untested on devices)</button>`:""}<button class="ghost sm" onclick="resetAll()">Reset checks</button></div>`;
  T.steps.forEach((s,i)=>{h+=`<div class="card step ${T.checked[i]?"done":""} ${i==cur?"cur":""}"><input type="checkbox" ${T.checked[i]?"checked":""} onchange="tick(${i},this.checked)"><div style="flex:1">${s.section&&(i==0||T.steps[i-1].section!==s.section)?`<div class="meta"><span class="badge">${esc(s.section)}</span></div>`:""}<div class="t">${i+1}. ${esc(s.title)}</div>${s.detail&&s.detail!==s.title?`<div class="d">${esc(s.detail)}</div>`:""}${s.tip?`<div class="meta" style="background:#fff7ed;border-radius:8px;padding:6px 8px;margin-bottom:6px">💡 ${esc(s.tip)}</div>`:""}
   ${s.evidence?`<details><summary>Where this comes from ${s.grounded?"✓":"(weak match)"}</summary><div class="ev">${esc(s.evidence)}</div></details>`:""}
   <details class="ask"><summary>I'm stuck on this step</summary><div class="row"><input type="text" id="a${i}" placeholder="What's confusing?"><button class="sm" onclick="ask(${i})">Ask</button></div><div id="r${i}"></div></details></div></div>`});
  if(n&&done==n)h+=`<div class="card" style="background:#e7f7ee">🎉 All steps done.</div>`;
  $("#out").innerHTML=h;
}
function tick(i,v){T.checked[i]=v;localStorage.setItem(key(),JSON.stringify(T.checked));render()}
function resetAll(){T.checked=[];localStorage.removeItem(key());render()}
function localRetrieve(q,i){ // offline: search the guide's own text; abstain when it doesn't cover the question
  const stop=new Set("what which how does did should can could would will when where why with that this then your about into have just make made need".split());
  const w=(q.toLowerCase().match(/[a-z]{3,}/g)||[]).filter(x=>!stop.has(x)).map(x=>x.replace(/(ing|ed|es|s)$/,""));
  const sc=T.steps.map((s,j)=>{const t=(s.title+" "+s.detail).toLowerCase();return [w.filter(x=>t.includes(x)).length/Math.max(w.length,1),j]}).filter(x=>x[0]>=0.6).sort((a,b)=>b[0]-a[0]).slice(0,2);
  return sc.length?"No AI model: this guide says:\n"+sc.map(([_,j])=>`Step ${j+1}: ${T.steps[j].detail}`).join("\n"):"This guide doesn't seem to address that, and no AI model is connected to reason beyond it. Try different words, or look at the source."}
async function ask(i){
  const q=$("#a"+i).value.trim();if(!q)return;const box=$("#r"+i);box.innerHTML=`<div class="ans">Thinking…</div>`;
  if(T.id||!SERVER.up){box.innerHTML=`<div class="ans">${esc(localRetrieve(q,i))}</div>`;return}
  try{const r=await post("/api/ask",{question:q,step:T.steps[i].detail,context:T.source_text||""});
    box.innerHTML=`<div class="ans">${esc(r.answer)}</div><div class="meta">${r.ai?"AI answer, based on the source text":"No AI: retrieved passages only"}</div>`}
  catch(e){box.innerHTML=`<div class="ans">${esc(e.message)}</div>`}
}
function openAR(i,pg){localStorage.setItem("sw:ar",JSON.stringify({title:T.title,id:T.id||null,paper:T.paper||null,steps:T.steps,cur:i}));location.href=pg||"ar.html"}

{const h=location.hash.slice(1),p=PRESETS.find(x=>x.id==h);if(p)load(p)} // returning from the AR/3D page reopens that guide
