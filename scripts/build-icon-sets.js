const fs=require('fs'),P=process.argv[2],OUT=process.argv[3];
// Tabler
const nodes=JSON.parse(fs.readFileSync(P+'/tabler/package/tabler-nodes-outline.json'));
const meta=JSON.parse(fs.readFileSync(P+'/tabler/package/icons.json'));
const tb=[];
for(const [n,els] of Object.entries(nodes)){
  const e=els.filter(([t,a])=>!(a.stroke==='none'||a.d==='M0 0h24v24H0z')).map(([t,a])=>{const o={};for(const k of ['d','x','y','width','height','rx','ry','cx','cy','r','x1','y1','x2','y2','points'])if(a[k]!=null)o[k]=String(a[k]);return [t,o]});
  if(!e.length)continue;
  const m=meta[n]||{};const tags=[...(m.tags||[]).map(String),...(m.category?[String(m.category).toLowerCase()]:[])].map(s=>s.toLowerCase());
  tb.push(['tb-'+n,e,tags]);
}
// Heroicons
const hd=P+'/hero/package/24/outline',hi=[];
for(const f of fs.readdirSync(hd).filter(f=>f.endsWith('.svg'))){
  const s=fs.readFileSync(hd+'/'+f,'utf8');const e=[];
  for(const m of s.matchAll(/<(path|circle|rect|line|polyline|polygon|ellipse)\b([^>]*)\/?>/g)){const o={};for(const a of m[2].matchAll(/([a-z-]+)="([^"]*)"/g)){if(['d','x','y','width','height','rx','ry','cx','cy','r','x1','y1','x2','y2','points'].includes(a[1]))o[a[1]]=a[2]}e.push([m[1],o])}
  const n=f.replace('.svg','');hi.push(['hi-'+n,e,n.split('-')]);
}
fs.writeFileSync(OUT+'/icons-tabler.json',JSON.stringify(tb));fs.writeFileSync(OUT+'/icons-hero.json',JSON.stringify(hi));
const tags=new Set();for(const [,e] of [...tb,...hi])for(const [t] of e)tags.add(t);
console.log('tabler',tb.length,'hero',hi.length,'element types',[...tags]);
