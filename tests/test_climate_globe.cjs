const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('../frontend/node_modules/typescript');
const source=fs.readFileSync('frontend/components/climate/globe.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
function mount({reduced=false,mobile=false,context=true,throws=false}={}){
 let cleanup,queued=0;const handlers={}; const media={};
 const gradient={addColorStop(){}};
 const ctx=new Proxy({},{get:(_,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>gradient:()=>{}});
 const canvas={style:{},getContext(){if(throws)throw Error('Unavailable');return context?ctx:null;}};
 const document={hidden:false,addEventListener:(key,fn)=>handlers[key]=fn,removeEventListener:key=>delete handlers[key]};
 const sandbox={exports:{},require:name=>name==='react'?{useRef:()=>({current:canvas}),useEffect:fn=>cleanup=fn()}:{jsx:()=>null},matchMedia:query=>{const m={matches:query.includes('reduced')?reduced:mobile,addEventListener:(_,fn)=>m.change=fn,removeEventListener:()=>{}};media[query]=m;return m;},document,devicePixelRatio:3,performance:{now:()=>0},requestAnimationFrame:()=>++queued,cancelAnimationFrame:()=>{}};
 vm.runInNewContext(code,sandbox);sandbox.exports.default();return {canvas,document,handlers,cleanup,media,get queued(){return queued;}};
}
test('missing or failing canvas context leaves the static illustration available',()=>{for(const options of [{context:false},{throws:true}]){const m=mount(options);assert.equal(m.queued,0);assert.equal(m.canvas.style.opacity,undefined);}});
test('reduced motion and mobile render a static frame without scheduling animation',()=>{for(const options of [{reduced:true},{mobile:true}]){const m=mount(options);assert.equal(m.queued,0);assert.equal(m.canvas.style.opacity,'1');}});
test('animation caps pixel ratio, pauses in hidden tabs, resumes, and cleans up',()=>{const m=mount();assert.equal(m.canvas.width,960);assert.equal(m.queued,1);m.document.hidden=true;m.handlers.visibilitychange();assert.equal(m.queued,1);m.document.hidden=false;m.handlers.visibilitychange();assert.equal(m.queued,2);m.cleanup();assert.equal(Object.keys(m.handlers).length,0);});
