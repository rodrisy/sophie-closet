/* Minimal software canvas so the page's real cutout/wrap code can run in node. */
const store = new Map();
let uid = 0;

class Img {
  constructor(w,h,data){ this.width=w; this.height=h; this.data=data; }
}
function blank(w,h){ return new Uint8ClampedArray(w*h*4); }

function makeCtx(cv){
  return {
    canvas: cv,
    globalCompositeOperation:'source-over',
    fillStyle:null,
    drawImage(src, ...a){
      const sd = src.data, sw = src.width, sh = src.height;
      let sx=0,sy=0,sW=sw,sH=sh,dx=0,dy=0,dW=sw,dH=sh;
      if(a.length===2){ [dx,dy]=a; }
      else if(a.length===4){ [dx,dy,dW,dH]=a; }
      else if(a.length===8){ [sx,sy,sW,sH,dx,dy,dW,dH]=a; }
      for(let y=0;y<Math.round(dH);y++){
        for(let x=0;x<Math.round(dW);x++){
          const tx=Math.round(dx+x), ty=Math.round(dy+y);
          if(tx<0||ty<0||tx>=cv.width||ty>=cv.height) continue;
          const ux=Math.min(sW-1,Math.floor(x*sW/dW)), uy=Math.min(sH-1,Math.floor(y*sH/dH));
          const si=((sy+uy)*sw+(sx+ux))*4, ti=(ty*cv.width+tx)*4;
          if(sd[si+3]===0) continue;
          cv.data[ti]=sd[si]; cv.data[ti+1]=sd[si+1];
          cv.data[ti+2]=sd[si+2]; cv.data[ti+3]=sd[si+3];
        }
      }
    },
    getImageData(x,y,w,h){ return {data:cv.data, width:w, height:h}; },
    putImageData(d){ cv.data = d.data; },
    createLinearGradient(){ return {addColorStop(){}}; },
    fillRect(){},
  };
}
function makeCanvas(){
  const cv = { width:0, height:0, _d:null,
    get data(){ if(!this._d||this._d.length!==this.width*this.height*4) this._d=blank(this.width,this.height); return this._d; },
    set data(v){ this._d=v; },
    getContext(){ return makeCtx(this); },
    toDataURL(){ const k='mem://'+(++uid); store.set(k,new Img(this.width,this.height,this.data.slice())); return k; }
  };
  return cv;
}
global.document = { createElement:()=>makeCanvas() };
global.Image = class { set src(v){ const im=store.get(v); if(!im){ this.onerror&&this.onerror(); return; } this.width=im.width; this.height=im.height; this.data=im.data; queueMicrotask(()=>this.onload&&this.onload()); } };
global.register = (w,h,data)=>{ const k='mem://'+(++uid); store.set(k,new Img(w,h,data)); return k; };
global.fetchImg = k => store.get(k);

/* the page's real code, minus DOM wiring */
import fs from 'fs';
let src = fs.readFileSync(new URL('../index.html', import.meta.url).pathname,'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const grab = name => {
  const i = src.indexOf('async function '+name) >= 0 ? src.indexOf('async function '+name) : src.indexOf('function '+name);
  let d=0, j=src.indexOf('{', i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(!d){ return src.slice(i,k+1); }} }
};
const prelude = `
const loadImg = s => new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=s; });
${grab('autoCrop')}
${grab('quickCut')}
${grab('measure')}
${grab('bodyAt')}
${grab('wrapToBody')}
const PROFILE = ${src.match(/const PROFILE = (\{[\s\S]*?\n\});/)[1]};
const CATS = ${src.match(/const CATS = (\{[\s\S]*?\n\});/)[1]};
const POSES = ${src.match(/const POSES = (\{[\s\S]*?\n\});/)[1]};
const state = {pose:'stand'};
export {quickCut, measure, wrapToBody, bodyAt, loadImg, CATS};
`;
fs.writeFileSync(new URL('./.lib.generated.mjs', import.meta.url).pathname, prelude);
const L = await import(new URL('./.lib.generated.mjs', import.meta.url).pathname);

/* ---- TEST 1: a 'coat' on white, with an enclosed neck hole ---- */
const W=120,H=120, d=blank(W,H);
for(let y=0;y<H;y++) for(let x=0;x<W;x++){
  const i=(y*W+x)*4;
  const inCoat = x>=30&&x<90&&y>=20&&y<100;
  const inNeck = x>=52&&x<68&&y>=20&&y<34;   // enclosed white neckline
  const c = (inCoat&&!inNeck) ? 70 : 255;
  d[i]=d[i+1]=d[i+2]=c; d[i+3]=255;
}
const key = register(W,H,d);
const cut = await L.quickCut(key, 32);
const out = fetchImg(cut.src);
const at = (im,x,y)=>im.data[(y*im.width+x)*4+3];
// cut image is cropped to the coat bbox (+2px pad), so map coords
console.log('cut size', out.width+'x'+out.height, 'removed', (cut.ratio*100).toFixed(1)+'%');
const neckX = 60-28, neckY = 26-18;      // crop origin ~ (28,18)
const bodyX = 60-28, bodyY = 70-18;
console.log('T1 neck hole transparent :', at(out,neckX,neckY)===0 ? 'PASS' : 'FAIL alpha='+at(out,neckX,neckY));
console.log('T1 garment body kept     :', at(out,bodyX,bodyY)>200 ? 'PASS' : 'FAIL alpha='+at(out,bodyX,bodyY));
console.log('T1 outer bg gone         :', at(out,1,1)===0 ? 'PASS' : 'FAIL alpha='+at(out,1,1));

/* ---- TEST 2: wrap should narrow the garment toward the waist ---- */
const m = await L.measure(cut.src);
console.log('T2 median width measured :', m ? 'PASS ('+m.median+'px)' : 'FAIL');

const it = { cat:'top', src:cut.src, natW:out.width, natH:out.height,
             base: L.CATS.top.fit/m.median, scale:1, dx:0, dy:0,
             wrap:true, wrapAmt:0.9 };
const wrapped = await L.wrapToBody(it);
const wi = fetchImg(wrapped);
const rowWidth = (im,y)=>{ let n=0; for(let x=0;x<im.width;x++) if(im.data[(y*im.width+x)*4+3]>40) n++; return n; };
const top = rowWidth(wi, Math.round(wi.height*0.15));
const bot = rowWidth(wi, Math.round(wi.height*0.85));
const flatTop = rowWidth(out, Math.round(out.height*0.15));
const flatBot = rowWidth(out, Math.round(out.height*0.85));
console.log('flat  rows: top',flatTop,' bottom',flatBot);
console.log('wrap  rows: top',top,' bottom',bot);
console.log('T2 wrap tapers to waist  :', bot < flatBot ? 'PASS' : 'FAIL');
console.log('T2 wrap kept pixels      :', top>0 && bot>0 ? 'PASS' : 'FAIL');
