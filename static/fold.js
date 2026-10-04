// Flat-fold simulator (own code). Layers are polygons in (x,z) with a stacking index and a face flag.
// Ops: fold{p,q,flapPt,dir,crease}, foldTo{from,to,dir}, rotate{deg}, flip{}.
(function(){
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1],len=a=>Math.hypot(a[0],a[1]);
function clip(poly,p,n){ // keep dot(x-p,n)>=0
  const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=dot(sub(a,p),n),db=dot(sub(b,p),n);
    if(da>=0)out.push(a);if((da>=0)!=(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}}
  return out.length>=3&&area(out)>1e-6?out:null}
function area(p){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1]}return Math.abs(s)/2}
function clipLine(poly,a,b){ // Cyrus-Beck: clip segment a-b to convex polygon (CCW or CW)
  let sgn=0;for(let i=0;i<poly.length;i++){const p0=poly[i],p1=poly[(i+1)%poly.length],p2=poly[(i+2)%poly.length];const c=(p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]);if(Math.abs(c)>1e-9){sgn=Math.sign(c);break}}
  let t0=0,t1=1;const d=[b[0]-a[0],b[1]-a[1]];
  for(let i=0;i<poly.length;i++){const p0=poly[i],p1=poly[(i+1)%poly.length],e=[p1[0]-p0[0],p1[1]-p0[1]],n=[-e[1]*sgn,e[0]*sgn]; // inward normal
    const num=n[0]*(a[0]-p0[0])+n[1]*(a[1]-p0[1]),den=n[0]*d[0]+n[1]*d[1];
    if(Math.abs(den)<1e-12){if(num<0)return null;continue}const t=-num/den;if(den>0)t0=Math.max(t0,t);else t1=Math.min(t1,t)}
  return t0<t1?[[a[0]+d[0]*t0,a[1]+d[1]*t0],[a[0]+d[0]*t1,a[1]+d[1]*t1]]:null}
function refl(x,p,u){const d=sub(x,p),t=dot(d,u);return[2*(p[0]+u[0]*t)-x[0],2*(p[1]+u[1]*t)-x[1]]}
function line(op){
  if(op.kind=="foldTo"){const m=[(op.from[0]+op.to[0])/2,(op.from[1]+op.to[1])/2],d=sub(op.to,op.from),L=len(d),u=[-d[1]/L,d[0]/L];return{p:m,u,flapPt:op.from}}
  const d=sub(op.q,op.p),L=len(d);return{p:op.p,u:[d[0]/L,d[1]/L],flapPt:op.flapPt}}
function initial(paper){const w=paper.w/2,h=paper.h/2;return{layers:[{pts:[[-w,-h],[w,-h],[w,h],[-w,h]],z:0,face:0}],creases:[]}}
// Apply a list of ops. Returns {statics, moves, after}. Rotate/flip are instant (applied to the starting state).
function step(state,ops){
  let layers=state.layers.map(l=>({...l,mv:false})),creases=state.creases.slice(),moves=[],touched=false;
  for(const op of ops){
    if(op.kind=="rotate"){const a=op.deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),R=q=>[q[0]*c-q[1]*s,q[0]*s+q[1]*c];layers.forEach(l=>l.pts=l.pts.map(R));creases=creases.map(c=>c.map(R));continue}
    if(op.kind=="flip"){const M=layers.reduce((m,l)=>Math.max(m,l.z),0);layers.forEach(l=>{l.pts=l.pts.map(q=>[-q[0],q[1]]);l.z=M-l.z;l.face=1-l.face});creases=creases.map(c=>c.map(q=>[-q[0],q[1]]));continue}
    const {p,u:u0,flapPt}=line(op);let u=u0,v=[-u[1],u[0]];if(dot(sub(flapPt,p),v)<0){u=[-u[0],-u[1]];v=[-u[1],u[0]]}
    const under=op.dir=="under",zs=layers.map(l=>l.z),zH=under?Math.min(...zs)-.5:Math.max(...zs)+.5,out=[];
    for(const l of layers){if(l.mv){out.push(l);continue}
      const keep=clip(l.pts,p,[-v[0],-v[1]]),fl=clip(l.pts,p,v);
      if(keep)out.push({...l,pts:keep});
      if(fl){moves.push({pts:fl,z:l.z,face:l.face,p,u,v,zH,under,crease:!!op.crease});
        if(!op.crease)out.push({pts:fl.map(q=>refl(q,p,u)),z:2*zH-l.z,face:1-l.face,mv:true})}}
    if(op.crease){const ext=3;{const seg=clipLine(layers[0].pts,[p[0]-u[0]*ext,p[1]-u[1]*ext],[p[0]+u[0]*ext,p[1]+u[1]*ext]);if(seg)creases.push(seg)}}
    else{layers=out;creases=[]}
    touched=true;
  }
  const zs2=[...new Set(layers.map(l=>l.z))].sort((a,b)=>a-b);const rank=z=>zs2.indexOf(z);
  const statics=layers.filter(l=>!l.mv);
  const after={layers:layers.map(l=>({pts:l.pts,z:rank(l.z),face:l.face})),creases:op_crease(creases)};
  return{statics,moves,after,creases}}
function op_crease(c){return c}
// Simulate steps 0..i-1 fully; stop (stale=true) after first step without ops.
function stateAt(preset,i){let s=initial(preset.paper),stale=false;
  for(let k=0;k<i;k++){const st=preset.steps[k];if(!st.ops){stale=true;continue}if(stale)continue;s=step(s,st.ops).after}
  return{state:s,stale}}
window.FOLD={step,stateAt,initial};
})();
