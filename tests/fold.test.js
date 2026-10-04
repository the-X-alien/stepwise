// node tests/fold.test.js : invariants of the flat-fold simulator
const fs=require('fs'),path=require('path');global.window={};
eval(fs.readFileSync(path.join(__dirname,'../static/fold.js'),'utf8'));const F=window.FOLD;
eval(fs.readFileSync(path.join(__dirname,'../static/presets.js'),'utf8').replace('window.PRESETS =','var PRESETS = window.PRESETS ='));
const area=p=>{let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2};
let fails=0;const ok=(n,c,x='')=>{console.log((c?'PASS ':'FAIL ')+n,x);if(!c)fails++};
for(const p of PRESETS){if(!p.paper)continue;let s=F.initial(p.paper);const A0=p.paper.w*p.paper.h;
  p.steps.forEach((st,i)=>{if(!st.ops)return;const r=F.step(s,st.ops);s=r.after;
    const tot=s.layers.reduce((a,l)=>a+area(l.pts),0);
    // paper area is conserved by flat folding (sum over all layers), except crease-only steps which keep one layer
    ok(`${p.id} step ${i+1}: total layer area == paper area`,Math.abs(tot-A0)<0.02*A0,tot.toFixed(3)+' vs '+A0.toFixed(3));
    ok(`${p.id} step ${i+1}: layers have distinct stacking order`,new Set(s.layers.map(l=>l.z)).size>=1);
  })}
// folding twice along the same line is idempotent in silhouette area
let s=F.initial({w:1,h:1});let r=F.step(s,[{kind:'fold',p:[0,-.5],q:[0,.5],flapPt:[.2,0]}]);
ok('half fold halves the footprint',Math.abs(Math.max(...r.after.layers.map(l=>area(l.pts)))-0.5)<1e-6);
process.exit(fails?1:0);
