"use strict";var SimscopePlayer=(()=>{var Sl=Object.defineProperty;var tp=Object.getOwnPropertyDescriptor;var ep=Object.getOwnPropertyNames;var np=Object.prototype.hasOwnProperty;var Oh=(i,t)=>{for(var e in t)Sl(i,e,{get:t[e],enumerable:!0})},ip=(i,t,e,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of ep(t))!np.call(i,s)&&s!==e&&Sl(i,s,{get:()=>t[s],enumerable:!(n=tp(t,s))||n.enumerable});return i};var sp=i=>ip(Sl({},"__esModule",{value:!0}),i);var ov={};Oh(ov,{Clock:()=>Ci,HttpSource:()=>pl,PackSource:()=>Wi,Player:()=>Ws,SimscopePlayerElement:()=>Yr,SourceError:()=>ye,attachMaster:()=>qf,clockFor:()=>Zi,decodeBase64:()=>Sh,format:()=>jn,linkCameras:()=>Hh,register:()=>bh,startLoop:()=>Yh,stepLoop:()=>Zh});var jn={};Oh(jn,{casPath:()=>Ys,checkFormat:()=>$s,computeNormals:()=>wl,crc32:()=>qs,decodeBlock:()=>Zs,decodeEnv:()=>up,decodeMesh:()=>Cl,indexWindows:()=>Al,inflate:()=>El,inflateIfGzip:()=>to,parseBlk:()=>Tl,parseJson:()=>Ai,parsePack:()=>Qr,renormalizePoses:()=>zh,unwrapPack:()=>op});var kh=new TextDecoder;function jt(i){throw new Error(`simscope: ${i}`)}var rp=(()=>{let i=new Uint32Array(256);for(let t=0;t<256;t++){let e=t;for(let n=0;n<8;n++)e=e&1?3988292384^e>>>1:e>>>1;i[t]=e>>>0}return i})();function qs(i,t=0,e=i.length){let n=4294967295;for(let s=t;s<e;s++)n=rp[(n^i[s])&255]^n>>>8;return(n^4294967295)>>>0}function Jr(i,t){return String.fromCharCode(i[t],i[t+1],i[t+2],i[t+3])}function jr(i){return new DataView(i.buffer,i.byteOffset,i.byteLength)}function Ti(i,t,e){let n=i.byteOffset+t;return t+4*e>i.length&&jt("truncated float data"),n%4===0?new Float32Array(i.buffer,n,e):new Float32Array(i.slice(t,t+4*e).buffer)}async function El(i,t="deflate-raw"){let e=new DecompressionStream(t),n=e.writable.getWriter();n.write(i).catch(()=>{}),n.close().catch(()=>{});try{return new Uint8Array(await new Response(e.readable).arrayBuffer())}catch(s){return jt(`inflate failed (${s&&s.message?s.message:s})`)}}async function bl(i,t,e){let n=await El(i);return n.length!==t&&jt(`${e}: inflated ${n.length} bytes, expected ${t}`),n}function Qr(i){(i.length<32||Jr(i,0)!=="SSPK")&&jt("not a simscope pack (bad SSPK magic)");let t=jr(i),e=t.getUint16(4,!0);e!==1&&jt(`unsupported pack major version ${e}`);let n=t.getUint32(8,!0),s=Number(t.getBigUint64(16,!0)),r=t.getUint32(24,!0),o=t.getUint32(28,!0);s+r>i.length&&jt("pack directory out of bounds"),qs(i,s,s+r)!==o&&jt("pack directory CRC mismatch");let a;try{a=JSON.parse(kh.decode(i.subarray(s,s+r)))}catch(h){return jt(`pack directory is not valid JSON (${h.message})`)}let l=a&&a.entries;(!Array.isArray(l)||l.length!==n)&&jt("pack directory entry count mismatch");let c=new Map;for(let h of l)h.offset+h.length>s&&jt(`pack entry out of bounds: ${h.path}`),c.set(h.path,i.subarray(h.offset,h.offset+h.length));return{entries:c}}async function to(i){return i.length>2&&i[0]===31&&i[1]===139?El(i,"gzip"):i}async function op(i){return Qr(await to(i))}function Ys(i,t,e=""){return`${i}/${t.slice(0,2)}/${t}${e}`}var Dh=64,Nh=32,Fh=1,ap=2;function lp(i,t){let e=jr(i);return{offset:t,env:e.getUint32(t+8,!0),t0:e.getUint32(t+12,!0),n:e.getUint32(t+16,!0),clen:e.getUint32(t+20,!0),ulen:e.getUint32(t+24,!0),codec:i[t+4],crc:e.getUint32(t+28,!0)}}function Tl(i){(i.length<Dh||Jr(i,0)!=="SSBK")&&jt("bad SSBK magic in block file");let t=jr(i),e=t.getUint16(4,!0);e!==1&&jt(`unsupported block file major version ${e}`),qs(i,0,60)!==t.getUint32(60,!0)&&jt("block file header CRC mismatch");let n=t.getUint32(12,!0);n>4&&jt(`bad item_ndim ${n}`);let s=[],r=1;for(let p=0;p<n;p++)s.push(t.getUint32(16+4*p,!0)),r*=s[p];let o=t.getUint32(32,!0),a=t.getUint32(36,!0),l=t.getUint32(40,!0),c=t.getUint32(44,!0),h=Number(t.getBigUint64(48,!0)),f=t.getUint32(56,!0);h===0&&jt("unfinished block file (dir_offset = 0); recover or finalize it with the simscope library first"),(f!==32*c||h<Dh||h+f>i.length)&&jt("bad block directory");let u=new Array(c);for(let p=0;p<c;p++){let g=h+32*p;u[p]={offset:Number(t.getBigUint64(g,!0)),env:t.getUint32(g+8,!0),t0:t.getUint32(g+12,!0),n:t.getUint32(g+16,!0),clen:t.getUint32(g+20,!0),ulen:t.getUint32(g+24,!0),codec:i[g+28]}}return{bytes:i,itemShape:s,itemK:r,nEnvs:o,nFrames:a,blockFrames:l,blocks:u}}function Al(i){let t=[];for(let e of i.blocks){e.env>=i.nEnvs&&jt(`block env ${e.env} out of range`);let n=Math.floor(e.t0/i.blockFrames);(t[n]||(t[n]=new Array(i.nEnvs)))[e.env]=e}return t}function cp(i,t,e){let n=t*e,s=new Uint32Array(n),r=i.subarray(0,n),o=i.subarray(n,2*n),a=i.subarray(2*n,3*n),l=i.subarray(3*n,4*n);for(let c=0;c<t;c++){let h=0,f=c*e;for(let u=0;u<e;u++){let p=f+u;h=h+((r[p]|o[p]<<8|a[p]<<16|l[p]<<24)>>>0)>>>0,s[u*t+c]=h}}return new Float32Array(s.buffer)}function hp(i,t,e){let n=Ti(i,0,t),s=Ti(i,4*t,t),r=t*e,o=i.subarray(8*t,8*t+r),a=i.subarray(8*t+r,8*t+2*r),l=new Float32Array(r);for(let c=0;c<t;c++){let h=0,f=c*e,u=n[c],p=s[c];for(let g=0;g<e;g++){let _=f+g;h=h+(o[_]|a[_]<<8)&65535,l[g*t+c]=Math.fround(u+Math.fround(h*p))}}return l}function zh(i){let t=Math.fround;for(let e=0;e+7<=i.length;e+=7){let n=i[e+3],s=i[e+4],r=i[e+5],o=i[e+6],a=t(Math.sqrt(t(t(t(t(n*n)+t(s*s))+t(r*r))+t(o*o))));a>0&&(i[e+3]=n/a,i[e+4]=s/a,i[e+5]=r/a,i[e+6]=o/a)}}async function Zs(i,t,e={}){let{bytes:n,itemK:s}=i,r=t.offset;(r+Nh>n.length||Jr(n,r)!=="SSBB")&&jt(`bad SSBB magic at offset ${r}`);let o=lp(n,r);o.codec!==Fh&&o.codec!==ap&&jt(`unknown block codec ${o.codec}`);let a=r+Nh;a+o.clen>n.length&&jt(`block at offset ${r} is truncated`);let l=n.subarray(a,a+o.clen);if(qs(l)!==o.crc&&jt(`block CRC mismatch at offset ${r}`),o.codec===Fh)return o.ulen!==4*s*o.n&&jt(`block ulen ${o.ulen} does not match f32s layout (${4*s*o.n})`),cp(await bl(l,o.ulen,"block"),s,o.n);let c=8*s+2*s*o.n;o.ulen!==c&&jt(`block ulen ${o.ulen} does not match q16d layout (${c})`);let h=await bl(l,c,"block"),f=hp(h,s,o.n);return e.pose&&zh(f),f}async function up(i,t,e={}){let n=new Float32Array(i.nFrames*i.itemK),s=i.blocks.filter(o=>o.env===t),r=await Promise.all(s.map(o=>Zs(i,o,e)));return s.forEach((o,a)=>n.set(r[a],o.t0*i.itemK)),n}function wl(i,t){let e=new Float32Array(i.length);for(let n=0;n<t.length;n+=3){let s=t[n]*3,r=t[n+1]*3,o=t[n+2]*3,a=i[r]-i[s],l=i[r+1]-i[s+1],c=i[r+2]-i[s+2],h=i[o]-i[s],f=i[o+1]-i[s+1],u=i[o+2]-i[s+2],p=l*u-c*f,g=c*h-a*u,_=a*f-l*h;for(let m of[s,r,o])e[m]+=p,e[m+1]+=g,e[m+2]+=_}for(let n=0;n<e.length;n+=3){let s=Math.hypot(e[n],e[n+1],e[n+2]);s>0?(e[n]/=s,e[n+1]/=s,e[n+2]/=s):e[n+2]=1}return e}function Bh(i,t,e,n,s,r){let o=n*e,a=i.subarray(t,t+o),l=i.subarray(t+o,t+2*o),c=new Float32Array(o);for(let h=0;h<n;h++){let f=0;for(let u=0;u<e;u++){let p=h*e+u;f=f+(a[p]|l[p]<<8)&65535,c[u*n+h]=Math.fround(s[h]+Math.fround(f*r[h]))}}return c}async function Cl(i){(i.length<32||Jr(i,0)!=="SSMH")&&jt("bad SSMH magic in mesh blob");let t=jr(i),e=t.getUint16(4,!0);e!==1&&jt(`unsupported mesh major version ${e}`);let n=t.getUint32(8,!0),s=t.getUint32(12,!0),r=t.getUint32(16,!0),o=i[20],a=t.getUint32(24,!0),l=i.subarray(32);qs(l)!==t.getUint32(28,!0)&&jt("mesh CRC mismatch"),o!==0&&o!==1&&jt(`unknown mesh codec ${o}`);let c=(r&1)!==0,h=(r&2)!==0,f=await bl(l,a,"mesh");if(o===0){let S=0,A=L=>{let N=Ti(f,S,L);return S+=4*L,N},y=A(3*n),T=new Uint32Array(f.slice(S,S+12*s).buffer);S+=12*s;let C=c?A(3*n):wl(y,T),I=h?A(2*n):null;return{verts:y,faces:T,normals:C,uvs:I,nVerts:n,nFaces:s}}c&&jt("q16 mesh must not have the normals flag");let u=f,p=Ti(u,0,3),g=Ti(u,12,3),_=Bh(u,24,n,3,p,g),m=24+6*n,d=3*s,M=new Uint32Array(d),E=[0,1,2,3].map(S=>u.subarray(m+S*d,m+(S+1)*d)),v=0;for(let S=0;S<d;S++)v=v+((E[0][S]|E[1][S]<<8|E[2][S]<<16|E[3][S]<<24)>>>0)>>>0,M[S]=v;m+=4*d;let b=null;if(h){let S=Ti(u,m,2),A=Ti(u,m+8,2);b=Bh(u,m+16,n,2,S,A)}return{verts:_,faces:M,normals:wl(_,M),uvs:b,nVerts:n,nFaces:s}}function Ai(i,t){try{return JSON.parse(kh.decode(i))}catch(e){return jt(`${t} is not valid JSON (${e.message})`)}}function $s(i,t,e){let n=i&&i.format,s=typeof n=="string"?/^([a-z-]+)\/(\d+)$/.exec(n):null;(!s||s[1]!==t)&&jt(`${e}: expected format "${t}/1", got ${JSON.stringify(n)}`),Number(s[2])!==1&&jt(`${e}: unsupported major version ${s[2]}`)}var Ks=class{constructor(){this.period=0,this.owed=0}reset(){this.owed=0}step(t){if(!(t>0))return 0;t=Math.min(t,.25),this.period?t>.4*this.period&&t<2.5*this.period&&(this.period+=.1*(t-this.period)):this.period=t;let e=Math.min(this.period+.15*this.owed,.25);return this.owed=Math.min(Math.max(this.owed+t-e,-.25),.25),e}},Ci=class extends EventTarget{constructor(){super(),this._time=0,this._playing=!1,this._speed=1,this._loop=!1,this._region=null,this._explicit=0,this._claims=new Map,this._holds=new Set,this._duration=0,this._pad=0,this._last=0,this._timer=new Ks,this._live=!1}get time(){return this._time}get duration(){return this._duration}get playing(){return this._playing}get speed(){return this._speed}set speed(t){let e=Number(t);Number.isFinite(e)&&e>0&&(this._speed=Math.min(Math.max(e,.01),32)),this._emit("state")}get loop(){return this._loop}set loop(t){this._loop=!!t,this._emit("state")}get loopRegion(){return this._region}set loopRegion(t){let e=Array.isArray(t)&&t.length===2&&t[1]>t[0];this._region=e?[Math.max(0,t[0]),Math.min(t[1],this._duration||t[1])]:null,this._emit("state")}play(){if(this._duration<=0)return;let t=this._region?this._region[1]:this._duration;!this._loop&&this._time>=t-1e-6&&(this._time=this._region?this._region[0]:0),this._playing=!0,this._last=0,this._timer.reset(),this._emit("state"),this._emit("time")}pause(){this._playing&&(this._playing=!1,this._emit("state"))}toggle(){this._playing?this.pause():this.play()}seek(t){let e=Math.min(Math.max(Number(t)||0,0),this._duration);this._time=e,this._last=0,this._timer.reset(),this._emit("time")}step(t,e){e>0&&this.seek((Math.round(this._time/e+1e-6)+t)*e)}setDuration(t){this._explicit=Math.max(0,Number(t)||0),this._recount()}claim(t,e,n=0,s=!1){this._claims.set(t,{seconds:Math.max(0,e),pad:Math.max(0,n),live:!!s}),this._recount()}release(t){this._claims.delete(t),this._holds.delete(t),this._recount()}hold(t,e){e?this._holds.add(t):this._holds.delete(t)}rebase(){this._last=0,this._timer.reset()}tick(t){let e=this._last;if(this._last=t,!this._playing)return;if(this._holds.size){this._timer.reset();return}let n=this._timer.step(e?Math.max((t-e)/1e3,0):0);if(n===0)return;let s=this._time+n*this._speed,r=this._region;if(r&&s>=r[1]-1e-6)if(this._loop)s=r[0]+(s-r[0])%(r[1]-r[0]);else return this._finish(r[1]);else if(s>this._duration+(this._loop?this._pad:0)-1e-6)if(this._loop)s%=this._duration+this._pad;else if(this._live){this._time<this._duration&&(this._time=this._duration,this._emit("time"));return}else return this._finish(this._duration);this._time=s,this._emit("time")}_finish(t){this._time=t,this._playing=!1,this._emit("time"),this._emit("state"),this._emit("ended")}_recount(){let t=this._explicit,e=0,n=!1;for(let s of this._claims.values())t=Math.max(t,s.seconds),e=Math.max(e,s.pad),n=n||s.live;this._pad=e,this._live=n,t!==this._duration&&(this._duration=t,this._time>t&&(this._time=t),this._region&&this._region[1]>t&&(this._region=t>this._region[0]?[this._region[0],t]:null)),this._emit("state")}_emit(t){this.dispatchEvent(t==="time"?new CustomEvent("time",{detail:{t:this._time}}):new CustomEvent(t))}},Vh=new Map;function Zi(i){let t=Vh.get(i);return t||Vh.set(i,t=new Ci),t}function dp(i){let t={players:i,zc:null,pending:!1,members:()=>i.filter(e=>e.linked===t),loaded:()=>t.members().filter(e=>e.info()),z(){if(t.zc!==null)return t.zc;for(let e of i){if(e.linked!==t)continue;let n=e.standingHeight();if(n!==null)return n}return null},clearPan(){for(let e of t.members())e._zeroPan(!1)},setView(e,n){for(let s of t.members())s._setView(e,n);t.zc!==null&&!t.zoomed()&&t.trajectory(n.animate!==!1)},zoomed:()=>t.members().some(e=>e.rig.userZoomed),playing:()=>t.members().some(e=>e.clock.playing),trajectory(e){let n=t.loaded(),s=n.map(l=>l._extent());if(!n.length||s.some(l=>l===void 0))return!1;let r=s.filter(Boolean);if(!r.length)return!1;let o=(Math.min(...r.map(l=>l.zlo))+Math.max(...r.map(l=>l.zhi)))/2,a=0;n.forEach((l,c)=>{a=Math.max(a,s[c]?l._fitHeight(o):l.rig.targetHeight)}),t.zc=o;for(let l of n)l._fitVertical(o,a,e);return!0},arrived(){t.loaded().some(n=>n._extent()===void 0)||(t.playing()?t.pending=!0:t.zoomed()||t.trajectory(!0))},flush(){!t.pending||t.playing()||(t.pending=!1,t.zoomed()||t.trajectory(!0))},frame(e,n){let s=n.animate!==!1,r=t.loaded(),o=r.map(l=>l._frameTarget(e,s));if(e!=="all"&&t.trajectory(s))return;t.zc=null,r.forEach((l,c)=>l._fitFrame(e,o[c],s));let a=Math.max(...r.map(l=>l.rig.targetHeight));for(let l of r)l.rig.setHeight(a,s)},refit(){let e=t.loaded();if(!e.length)return;t.zc=null,t.pending=!1;let n=e[0].rig.state(!1);for(let s of e)s.rig.setAngles(n,!1);t.frame("focus",{animate:!1})}};return t}function Hh(i,{alignGround:t=!0}={}){let e=t?dp(i):null,n=i.map(s=>{let r=a=>{for(let l of i)l!==s&&l.setCameraState(a.detail,{animate:!1})};if(s.addEventListener("camera",r),!e)return()=>s.removeEventListener("camera",r);let o=()=>e.refit();return s.addEventListener("loaded",o),s.linked=e,()=>{s.removeEventListener("camera",r),s.removeEventListener("loaded",o),s.linked===e&&(s.linked=null,s._autoFit())}});return e&&e.refit(),()=>n.forEach(s=>s())}var Js=new Set,Gh=new Ks,$i=0,eo=0;function Qn(){!$i&&Js.size&&typeof requestAnimationFrame=="function"&&($i=requestAnimationFrame(qh))}function Wh(i){Js.add(i),Qn()}function Xh(i){Js.delete(i)}function qh(i){$i=0;let t=Gh.step(eo?Math.max((i-eo)/1e3,0):0);eo=i;let e=new Set;for(let s of Js)e.add(s.clock);for(let s of e)s.tick(i);let n=!1;for(let s of Js){if(!s.visible)continue;(s.update(t,i)||s.dirty)&&s.renderer.draw(s),s.needsFrame()&&(n=!0)}if(n)Qn();else{eo=0,Gh.reset();for(let s of e)s.rebase()}}function Yh(){Qn()}function Zh(i){$i&&typeof cancelAnimationFrame=="function"&&cancelAnimationFrame($i),$i=0,qh(i)}var Eu=0,rc=1,Tu=2;var Ar=1,Au=2,ws=3,fi=0,Xe=1,Pn=2,In=0,Es=1,oc=2,ac=3,lc=4,Cu=5;var Bi=100,Ru=101,Pu=102,Iu=103,Lu=104,Uu=200,Ou=201,Du=202,Nu=203,cc=204,hc=205,Fu=206,Bu=207,ku=208,zu=209,Vu=210,Hu=211,Gu=212,Wu=213,Xu=214,Ao=0,Co=1,Ro=2,ds=3,Po=4,Io=5,Lo=6,Uo=7,uc=0,qu=1,Yu=2,yn=0,dc=1,fc=2,pc=3,mc=4,gc=5,_c=6,xc=7;var yc=300,pi=301,ki=302,ra=303,oa=304,Cr=306,fs=1e3,Tn=1001,Oo=1002,Pe=1003,Zu=1004;var Rr=1005;var Le=1006,aa=1007;var mi=1008;var $e=1009,vc=1010,Mc=1011,Ts=1012,la=1013,vn=1014,cn=1015,Mn=1016,ca=1017,ha=1018,As=1020,Sc=35902,bc=35899,wc=1021,Ec=1022,hn=1023,An=1026,gi=1027,ua=1028,da=1029,_i=1030,fa=1031;var pa=1033,Pr=33776,Ir=33777,Lr=33778,Ur=33779,ma=35840,ga=35841,_a=35842,xa=35843,ya=36196,va=37492,Ma=37496,Sa=37488,ba=37489,Or=37490,wa=37491,Ea=37808,Ta=37809,Aa=37810,Ca=37811,Ra=37812,Pa=37813,Ia=37814,La=37815,Ua=37816,Oa=37817,Da=37818,Na=37819,Fa=37820,Ba=37821,ka=36492,za=36494,Va=36495,Ha=36283,Ga=36284,Dr=36285,Wa=36286;var ar=2300,Do=2301,Eo=2302,Jl=2303,jl=2400,Ql=2401,tc=2402;var $u=3200;var Xa=0,Ku=1,qn="",me="srgb",lr="srgb-linear",cr="linear",ee="srgb";var To=7680;var Ju=519,ju=512,Qu=513,td=514,qa=515,ed=516,nd=517,Ya=518,id=519,sd=35044,xi=35048;var Tc="300 es",gn=2e3,ps=2001;function fp(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function pp(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function hr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function rd(){let i=hr("canvas");return i.style.display="block",i}var $h={},ms=null;function Ac(...i){let t="THREE."+i.shift();ms?ms("log",t,...i):console.log(t,...i)}function od(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Lt(...i){i=od(i);let t="THREE."+i.shift();if(ms)ms("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function Dt(...i){i=od(i);let t="THREE."+i.shift();if(ms)ms("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function Ui(...i){let t=i.join(" ");t in $h||($h[t]=!0,Lt(...i))}function ad(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var ld={[Ao]:Co,[Ro]:Lo,[Po]:Uo,[ds]:Io,[Co]:Ao,[Lo]:Ro,[Uo]:Po,[Io]:ds},Cn=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}},Fe=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Kh=1234567,rr=Math.PI/180,gs=180/Math.PI;function Cs(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Fe[i&255]+Fe[i>>8&255]+Fe[i>>16&255]+Fe[i>>24&255]+"-"+Fe[t&255]+Fe[t>>8&255]+"-"+Fe[t>>16&15|64]+Fe[t>>24&255]+"-"+Fe[e&63|128]+Fe[e>>8&255]+"-"+Fe[e>>16&255]+Fe[e>>24&255]+Fe[n&255]+Fe[n>>8&255]+Fe[n>>16&255]+Fe[n>>24&255]).toLowerCase()}function Wt(i,t,e){return Math.max(t,Math.min(e,i))}function Cc(i,t){return(i%t+t)%t}function mp(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function gp(i,t,e){return i!==t?(e-i)/(t-i):0}function or(i,t,e){return(1-e)*i+e*t}function _p(i,t,e,n){return or(i,t,1-Math.exp(-e*n))}function xp(i,t=1){return t-Math.abs(Cc(i,t*2)-t)}function yp(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function vp(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function Mp(i,t){return i+Math.floor(Math.random()*(t-i+1))}function Sp(i,t){return i+Math.random()*(t-i)}function bp(i){return i*(.5-Math.random())}function wp(i){i!==void 0&&(Kh=i);let t=Kh+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Ep(i){return i*rr}function Tp(i){return i*gs}function Ap(i){return i>0&&Number.isInteger(i)&&2**Math.round(Math.log2(i))===i}function Cp(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function Rp(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Pp(i,t,e,n,s){let r=Math.cos,o=Math.sin,a=r(e/2),l=o(e/2),c=r((t+n)/2),h=o((t+n)/2),f=r((t-n)/2),u=o((t-n)/2),p=r((n-t)/2),g=o((n-t)/2);switch(s){case"XYX":i.set(a*h,l*f,l*u,a*c);break;case"YZY":i.set(l*u,a*h,l*f,a*c);break;case"ZXZ":i.set(l*f,l*u,a*h,a*c);break;case"XZX":i.set(a*h,l*g,l*p,a*c);break;case"YXY":i.set(l*p,a*h,l*g,a*c);break;case"ZYZ":i.set(l*g,l*p,a*h,a*c);break;default:Lt("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function hs(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Ge(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var yi={DEG2RAD:rr,RAD2DEG:gs,generateUUID:Cs,clamp:Wt,euclideanModulo:Cc,mapLinear:mp,inverseLerp:gp,lerp:or,damp:_p,pingpong:xp,smoothstep:yp,smootherstep:vp,randInt:Mp,randFloat:Sp,randFloatSpread:bp,seededRandom:wp,degToRad:Ep,radToDeg:Tp,isPowerOfTwo:Ap,ceilPowerOfTwo:Cp,floorPowerOfTwo:Rp,setQuaternionFromProperEuler:Pp,normalize:Ge,denormalize:hs},Ht=class i{static{i.prototype.isVector2=!0}constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Wt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},en=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let l=n[s+0],c=n[s+1],h=n[s+2],f=n[s+3],u=r[o+0],p=r[o+1],g=r[o+2],_=r[o+3];if(f!==_||l!==u||c!==p||h!==g){let m=l*u+c*p+h*g+f*_;m<0&&(u=-u,p=-p,g=-g,_=-_,m=-m);let d=1-a;if(m<.9995){let M=Math.acos(m),E=Math.sin(M);d=Math.sin(d*M)/E,a=Math.sin(a*M)/E,l=l*d+u*a,c=c*d+p*a,h=h*d+g*a,f=f*d+_*a}else{l=l*d+u*a,c=c*d+p*a,h=h*d+g*a,f=f*d+_*a;let M=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=M,c*=M,h*=M,f*=M}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=f}static multiplyQuaternionsFlat(t,e,n,s,r,o){let a=n[s],l=n[s+1],c=n[s+2],h=n[s+3],f=r[o],u=r[o+1],p=r[o+2],g=r[o+3];return t[e]=a*g+h*f+l*p-c*u,t[e+1]=l*g+h*u+c*f-a*p,t[e+2]=c*g+h*p+a*u-l*f,t[e+3]=h*g-a*f-l*u-c*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(s/2),f=a(r/2),u=l(n/2),p=l(s/2),g=l(r/2);switch(o){case"XYZ":this._x=u*h*f+c*p*g,this._y=c*p*f-u*h*g,this._z=c*h*g+u*p*f,this._w=c*h*f-u*p*g;break;case"YXZ":this._x=u*h*f+c*p*g,this._y=c*p*f-u*h*g,this._z=c*h*g-u*p*f,this._w=c*h*f+u*p*g;break;case"ZXY":this._x=u*h*f-c*p*g,this._y=c*p*f+u*h*g,this._z=c*h*g+u*p*f,this._w=c*h*f-u*p*g;break;case"ZYX":this._x=u*h*f-c*p*g,this._y=c*p*f+u*h*g,this._z=c*h*g-u*p*f,this._w=c*h*f+u*p*g;break;case"YZX":this._x=u*h*f+c*p*g,this._y=c*p*f+u*h*g,this._z=c*h*g-u*p*f,this._w=c*h*f-u*p*g;break;case"XZY":this._x=u*h*f-c*p*g,this._y=c*p*f-u*h*g,this._z=c*h*g+u*p*f,this._w=c*h*f+u*p*g;break;default:Lt("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],h=e[6],f=e[10],u=n+a+f;if(u>0){let p=.5/Math.sqrt(u+1);this._w=.25/p,this._x=(h-l)*p,this._y=(r-c)*p,this._z=(o-s)*p}else if(n>a&&n>f){let p=2*Math.sqrt(1+n-a-f);this._w=(h-l)/p,this._x=.25*p,this._y=(s+o)/p,this._z=(r+c)/p}else if(a>f){let p=2*Math.sqrt(1+a-n-f);this._w=(r-c)/p,this._x=(s+o)/p,this._y=.25*p,this._z=(l+h)/p}else{let p=2*Math.sqrt(1+f-n-a);this._w=(o-s)/p,this._x=(r+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Wt(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-s*a,this._w=o*h-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=this.dot(t);a<0&&(n=-n,s=-s,r=-r,o=-o,a=-a);let l=1-e;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},k=class i{static{i.prototype.isVector3=!0}constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Jh.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Jh.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*s-a*n),h=2*(a*e-r*s),f=2*(r*n-o*e);return this.x=e+l*c+o*f-a*h,this.y=n+l*h+a*c-r*f,this.z=s+l*f+r*h-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this.z=Wt(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this.z=Wt(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Rl.copy(this).projectOnVector(t),this.sub(Rl)}reflect(t){return this.sub(Rl.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Wt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Rl=new k,Jh=new en,Ft=class i{static{i.prototype.isMatrix3=!0}constructor(t,e,n,s,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c)}set(t,e,n,s,r,o,a,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=a,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],f=n[7],u=n[2],p=n[5],g=n[8],_=s[0],m=s[3],d=s[6],M=s[1],E=s[4],v=s[7],b=s[2],S=s[5],A=s[8];return r[0]=o*_+a*M+l*b,r[3]=o*m+a*E+l*S,r[6]=o*d+a*v+l*A,r[1]=c*_+h*M+f*b,r[4]=c*m+h*E+f*S,r[7]=c*d+h*v+f*A,r[2]=u*_+p*M+g*b,r[5]=u*m+p*E+g*S,r[8]=u*d+p*v+g*A,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8];return e*o*h-e*a*c-n*r*h+n*a*l+s*r*c-s*o*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=h*o-a*c,u=a*l-h*r,p=c*r-o*l,g=e*f+n*u+s*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/g;return t[0]=f*_,t[1]=(s*c-h*n)*_,t[2]=(a*n-s*o)*_,t[3]=u*_,t[4]=(h*e-s*l)*_,t[5]=(s*r-a*e)*_,t[6]=p*_,t[7]=(n*l-c*e)*_,t[8]=(o*e-n*r)*_,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+t,-s*c,s*l,-s*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return Ui("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Pl.makeScale(t,e)),this}rotate(t){return Ui("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Pl.makeRotation(-t)),this}translate(t,e){return Ui("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Pl.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}},Pl=new Ft,jh=new Ft().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Qh=new Ft().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Ip(){let i={enabled:!0,workingColorSpace:lr,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===ee&&(s.r=Gn(s.r),s.g=Gn(s.g),s.b=Gn(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ee&&(s.r=us(s.r),s.g=us(s.g),s.b=us(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===qn?cr:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Ui("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Ui("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[lr]:{primaries:t,whitePoint:n,transfer:cr,toXYZ:jh,fromXYZ:Qh,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:me},outputColorSpaceConfig:{drawingBufferColorSpace:me}},[me]:{primaries:t,whitePoint:n,transfer:ee,toXYZ:jh,fromXYZ:Qh,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:me}}}),i}var Zt=Ip();function Gn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function us(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Ki,No=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{Ki===void 0&&(Ki=hr("canvas")),Ki.width=t.width,Ki.height=t.height;let s=Ki.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=Ki}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=hr("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=Gn(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Gn(e[n]/255)*255):e[n]=Gn(e[n]);return{data:e,width:t.width,height:t.height}}else return Lt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Lp=0,_s=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Lp++}),this.uuid=Cs(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Il(s[o].image)):r.push(Il(s[o]))}else r=Il(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function Il(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?No.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Lt("Texture: Unable to serialize Texture."),{})}var Up=0,Ll=new k,ke=class i extends Cn{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=Tn,s=Tn,r=Le,o=mi,a=hn,l=$e,c=i.DEFAULT_ANISOTROPY,h=qn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Up++}),this.uuid=Cs(),this.name="",this.source=new _s(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Ht(0,0),this.repeat=new Ht(1,1),this.center=new Ht(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ft,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ll).x}get height(){return this.source.getSize(Ll).y}get depth(){return this.source.getSize(Ll).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){Lt(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Lt(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==yc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case fs:t.x=t.x-Math.floor(t.x);break;case Tn:t.x=t.x<0?0:1;break;case Oo:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case fs:t.y=t.y-Math.floor(t.y);break;case Tn:t.y=t.y<0?0:1;break;case Oo:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};ke.DEFAULT_IMAGE=null;ke.DEFAULT_MAPPING=yc;ke.DEFAULT_ANISOTROPY=1;var he=class i{static{i.prototype.isVector4=!0}constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],h=l[4],f=l[8],u=l[1],p=l[5],g=l[9],_=l[2],m=l[6],d=l[10];if(Math.abs(h-u)<.01&&Math.abs(f-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+u)<.1&&Math.abs(f+_)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+d-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let E=(c+1)/2,v=(p+1)/2,b=(d+1)/2,S=(h+u)/4,A=(f+_)/4,y=(g+m)/4;return E>v&&E>b?E<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(E),s=S/n,r=A/n):v>b?v<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),n=S/s,r=y/s):b<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(b),n=A/r,s=y/r),this.set(n,s,r,e),this}let M=Math.sqrt((m-g)*(m-g)+(f-_)*(f-_)+(u-h)*(u-h));return Math.abs(M)<.001&&(M=1),this.x=(m-g)/M,this.y=(f-_)/M,this.z=(u-h)/M,this.w=Math.acos((c+p+d-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this.z=Wt(this.z,t.z,e.z),this.w=Wt(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this.z=Wt(this.z,t,e),this.w=Wt(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Fo=class extends Cn{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Le,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new he(0,0,t,e),this.scissorTest=!1,this.viewport=new he(0,0,t,e),this.textures=[];let s={width:t,height:e,depth:n.depth},r=new ke(s),o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Le,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),t!==null&&t.renderTarget===null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new _s(s)}if(this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveColorBuffer=t.resolveColorBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,this.storeMultisampledColorBuffer=t.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=t.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=t.storeMultisampledStencilBuffer,t.depthTexture!==null)if(t.depthTexture.renderTarget===t){let e=t.depthTexture.clone();e.renderTarget=null,this.depthTexture=e}else this.depthTexture=t.depthTexture;return this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Ze=class extends Fo{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},ur=class extends ke{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Pe,this.minFilter=Pe,this.wrapR=Tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Bo=class extends ke{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Pe,this.minFilter=Pe,this.wrapR=Tn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}};var ne=class i{static{i.prototype.isMatrix4=!0}constructor(t,e,n,s,r,o,a,l,c,h,f,u,p,g,_,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c,h,f,u,p,g,_,m)}set(t,e,n,s,r,o,a,l,c,h,f,u,p,g,_,m){let d=this.elements;return d[0]=t,d[4]=e,d[8]=n,d[12]=s,d[1]=r,d[5]=o,d[9]=a,d[13]=l,d[2]=c,d[6]=h,d[10]=f,d[14]=u,d[3]=p,d[7]=g,d[11]=_,d[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/Ji.setFromMatrixColumn(t,0).length(),r=1/Ji.setFromMatrixColumn(t,1).length(),o=1/Ji.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),f=Math.sin(r);if(t.order==="XYZ"){let u=o*h,p=o*f,g=a*h,_=a*f;e[0]=l*h,e[4]=-l*f,e[8]=c,e[1]=p+g*c,e[5]=u-_*c,e[9]=-a*l,e[2]=_-u*c,e[6]=g+p*c,e[10]=o*l}else if(t.order==="YXZ"){let u=l*h,p=l*f,g=c*h,_=c*f;e[0]=u+_*a,e[4]=g*a-p,e[8]=o*c,e[1]=o*f,e[5]=o*h,e[9]=-a,e[2]=p*a-g,e[6]=_+u*a,e[10]=o*l}else if(t.order==="ZXY"){let u=l*h,p=l*f,g=c*h,_=c*f;e[0]=u-_*a,e[4]=-o*f,e[8]=g+p*a,e[1]=p+g*a,e[5]=o*h,e[9]=_-u*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){let u=o*h,p=o*f,g=a*h,_=a*f;e[0]=l*h,e[4]=g*c-p,e[8]=u*c+_,e[1]=l*f,e[5]=_*c+u,e[9]=p*c-g,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){let u=o*l,p=o*c,g=a*l,_=a*c;e[0]=l*h,e[4]=_-u*f,e[8]=g*f+p,e[1]=f,e[5]=o*h,e[9]=-a*h,e[2]=-c*h,e[6]=p*f+g,e[10]=u-_*f}else if(t.order==="XZY"){let u=o*l,p=o*c,g=a*l,_=a*c;e[0]=l*h,e[4]=-f,e[8]=c*h,e[1]=u*f+_,e[5]=o*h,e[9]=p*f-g,e[2]=g*f-p,e[6]=a*h,e[10]=_*f+u}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Op,t,Dp)}lookAt(t,e,n){let s=this.elements;return Qe.subVectors(t,e),Qe.lengthSq()===0&&(Qe.z=1),Qe.normalize(),ti.crossVectors(n,Qe),ti.lengthSq()===0&&(Math.abs(n.z)===1?Qe.x+=1e-4:Qe.z+=1e-4,Qe.normalize(),ti.crossVectors(n,Qe)),ti.normalize(),no.crossVectors(Qe,ti),s[0]=ti.x,s[4]=no.x,s[8]=Qe.x,s[1]=ti.y,s[5]=no.y,s[9]=Qe.y,s[2]=ti.z,s[6]=no.z,s[10]=Qe.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],f=n[5],u=n[9],p=n[13],g=n[2],_=n[6],m=n[10],d=n[14],M=n[3],E=n[7],v=n[11],b=n[15],S=s[0],A=s[4],y=s[8],T=s[12],C=s[1],I=s[5],L=s[9],N=s[13],P=s[2],O=s[6],U=s[10],V=s[14],J=s[3],Z=s[7],tt=s[11],it=s[15];return r[0]=o*S+a*C+l*P+c*J,r[4]=o*A+a*I+l*O+c*Z,r[8]=o*y+a*L+l*U+c*tt,r[12]=o*T+a*N+l*V+c*it,r[1]=h*S+f*C+u*P+p*J,r[5]=h*A+f*I+u*O+p*Z,r[9]=h*y+f*L+u*U+p*tt,r[13]=h*T+f*N+u*V+p*it,r[2]=g*S+_*C+m*P+d*J,r[6]=g*A+_*I+m*O+d*Z,r[10]=g*y+_*L+m*U+d*tt,r[14]=g*T+_*N+m*V+d*it,r[3]=M*S+E*C+v*P+b*J,r[7]=M*A+E*I+v*O+b*Z,r[11]=M*y+E*L+v*U+b*tt,r[15]=M*T+E*N+v*V+b*it,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],h=t[2],f=t[6],u=t[10],p=t[14],g=t[3],_=t[7],m=t[11],d=t[15],M=l*p-c*u,E=a*p-c*f,v=a*u-l*f,b=o*p-c*h,S=o*u-l*h,A=o*f-a*h;return e*(_*M-m*E+d*v)-n*(g*M-m*b+d*S)+s*(g*E-_*b+d*A)-r*(g*v-_*S+m*A)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],o=t[5],a=t[9],l=t[2],c=t[6],h=t[10];return e*(o*h-a*c)-n*(r*h-a*l)+s*(r*c-o*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=t[9],u=t[10],p=t[11],g=t[12],_=t[13],m=t[14],d=t[15],M=e*a-n*o,E=e*l-s*o,v=e*c-r*o,b=n*l-s*a,S=n*c-r*a,A=s*c-r*l,y=h*_-f*g,T=h*m-u*g,C=h*d-p*g,I=f*m-u*_,L=f*d-p*_,N=u*d-p*m,P=M*N-E*L+v*I+b*C-S*T+A*y;if(P===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let O=1/P;return t[0]=(a*N-l*L+c*I)*O,t[1]=(s*L-n*N-r*I)*O,t[2]=(_*A-m*S+d*b)*O,t[3]=(u*S-f*A-p*b)*O,t[4]=(l*C-o*N-c*T)*O,t[5]=(e*N-s*C+r*T)*O,t[6]=(m*v-g*A-d*E)*O,t[7]=(h*A-u*v+p*E)*O,t[8]=(o*L-a*C+c*y)*O,t[9]=(n*C-e*L-r*y)*O,t[10]=(g*S-_*v+d*M)*O,t[11]=(f*v-h*S-p*M)*O,t[12]=(a*T-o*I-l*y)*O,t[13]=(e*I-n*T+s*y)*O,t[14]=(_*E-g*b-m*M)*O,t[15]=(h*b-f*E+u*M)*O,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,l=t.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+n,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,h=o+o,f=a+a,u=r*c,p=r*h,g=r*f,_=o*h,m=o*f,d=a*f,M=l*c,E=l*h,v=l*f,b=n.x,S=n.y,A=n.z;return s[0]=(1-(_+d))*b,s[1]=(p+v)*b,s[2]=(g-E)*b,s[3]=0,s[4]=(p-v)*S,s[5]=(1-(u+d))*S,s[6]=(m+M)*S,s[7]=0,s[8]=(g+E)*A,s[9]=(m-M)*A,s[10]=(1-(u+_))*A,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let o=Ji.set(s[0],s[1],s[2]).length(),a=Ji.set(s[4],s[5],s[6]).length(),l=Ji.set(s[8],s[9],s[10]).length();r<0&&(o=-o),dn.copy(this);let c=1/o,h=1/a,f=1/l;return dn.elements[0]*=c,dn.elements[1]*=c,dn.elements[2]*=c,dn.elements[4]*=h,dn.elements[5]*=h,dn.elements[6]*=h,dn.elements[8]*=f,dn.elements[9]*=f,dn.elements[10]*=f,e.setFromRotationMatrix(dn),n.x=o,n.y=a,n.z=l,this}makePerspective(t,e,n,s,r,o,a=gn,l=!1){let c=this.elements,h=2*r/(e-t),f=2*r/(n-s),u=(e+t)/(e-t),p=(n+s)/(n-s),g,_;if(l)g=r/(o-r),_=o*r/(o-r);else if(a===gn)g=-(o+r)/(o-r),_=-2*o*r/(o-r);else if(a===ps)g=-o/(o-r),_=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=f,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=gn,l=!1){let c=this.elements,h=2/(e-t),f=2/(n-s),u=-(e+t)/(e-t),p=-(n+s)/(n-s),g,_;if(l)g=1/(o-r),_=o/(o-r);else if(a===gn)g=-2/(o-r),_=-(o+r)/(o-r);else if(a===ps)g=-1/(o-r),_=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=f,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}},Ji=new k,dn=new ne,Op=new k(0,0,0),Dp=new k(1,1,1),ti=new k,no=new k,Qe=new k,tu=new ne,eu=new en,Wn=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],f=s[2],u=s[6],p=s[10];switch(e){case"XYZ":this._y=Math.asin(Wt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Wt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(Wt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-f,p),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Wt(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(u,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Wt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-Wt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,p),this._y=0);break;default:Lt("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return tu.makeRotationFromQuaternion(t),this.setFromRotationMatrix(tu,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return eu.setFromEuler(this),this.setFromQuaternion(eu,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Wn.DEFAULT_ORDER="XYZ";var xs=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Np=0,nu=new k,ji=new en,Bn=new ne,io=new k,js=new k,Fp=new k,Bp=new en,iu=new k(1,0,0),su=new k(0,1,0),ru=new k(0,0,1),ou={type:"added"},kp={type:"removed"},Qi={type:"childadded",child:null},Ul={type:"childremoved",child:null},Ue=class i extends Cn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Np++}),this.uuid=Cs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new k,e=new Wn,n=new en,s=new k(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ne},normalMatrix:{value:new Ft}}),this.matrix=new ne,this.matrixWorld=new ne,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new xs,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ji.setFromAxisAngle(t,e),this.quaternion.multiply(ji),this}rotateOnWorldAxis(t,e){return ji.setFromAxisAngle(t,e),this.quaternion.premultiply(ji),this}rotateX(t){return this.rotateOnAxis(iu,t)}rotateY(t){return this.rotateOnAxis(su,t)}rotateZ(t){return this.rotateOnAxis(ru,t)}translateOnAxis(t,e){return nu.copy(t).applyQuaternion(this.quaternion),this.position.add(nu.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(iu,t)}translateY(t){return this.translateOnAxis(su,t)}translateZ(t){return this.translateOnAxis(ru,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Bn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?io.copy(t):io.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),js.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Bn.lookAt(js,io,this.up):Bn.lookAt(io,js,this.up),this.quaternion.setFromRotationMatrix(Bn),s&&(Bn.extractRotation(s.matrixWorld),ji.setFromRotationMatrix(Bn),this.quaternion.premultiply(ji.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(Dt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(ou),Qi.child=t,this.dispatchEvent(Qi),Qi.child=null):Dt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(kp),Ul.child=t,this.dispatchEvent(Ul),Ul.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Bn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Bn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Bn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(ou),Qi.child=t,this.dispatchEvent(Qi),Qi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(js,t,Fp),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(js,Bp,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let f=l[c];r(t.shapes,f)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];s.animations.push(r(t.animations,l))}}if(e){let a=o(t.geometries),l=o(t.materials),c=o(t.textures),h=o(t.images),f=o(t.shapes),u=o(t.skeletons),p=o(t.animations),g=o(t.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),f.length>0&&(n.shapes=f),u.length>0&&(n.skeletons=u),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=s,n;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Ue.DEFAULT_UP=new k(0,1,0);Ue.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ue.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var an=class extends Ue{constructor(){super(),this.isGroup=!0,this.type="Group"}},zp={type:"move"},ys=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new an,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new an,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new k,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new k),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new an,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new k,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new k,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(let _ of t.hand.values()){let m=e.getJointPose(_,n),d=this._getHandJoint(c,_);m!==null&&(d.matrix.fromArray(m.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,d.jointRadius=m.radius),d.visible=m!==null}let h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],u=h.position.distanceTo(f.position),p=.02,g=.005;c.inputState.pinching&&u>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(zp)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new an;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},cd={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ei={h:0,s:0,l:0},so={h:0,s:0,l:0};function Ol(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Ut=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=me){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Zt.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=Zt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Zt.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=Zt.workingColorSpace){if(t=Cc(t,1),e=Wt(e,0,1),n=Wt(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=Ol(o,r,t+1/3),this.g=Ol(o,r,t),this.b=Ol(o,r,t-1/3)}return Zt.colorSpaceToWorking(this,s),this}setStyle(t,e=me){function n(r){r!==void 0&&parseFloat(r)<1&&Lt("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Lt("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);Lt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=me){let n=cd[t.toLowerCase()];return n!==void 0?this.setHex(n,e):Lt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Gn(t.r),this.g=Gn(t.g),this.b=Gn(t.b),this}copyLinearToSRGB(t){return this.r=us(t.r),this.g=us(t.g),this.b=us(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=me){return Zt.workingToColorSpace(Be.copy(this),t),Math.round(Wt(Be.r*255,0,255))*65536+Math.round(Wt(Be.g*255,0,255))*256+Math.round(Wt(Be.b*255,0,255))}getHexString(t=me){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Zt.workingColorSpace){Zt.workingToColorSpace(Be.copy(this),e);let n=Be.r,s=Be.g,r=Be.b,o=Math.max(n,s,r),a=Math.min(n,s,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=h<=.5?f/(o+a):f/(2-o-a),o){case n:l=(s-r)/f+(s<r?6:0);break;case s:l=(r-n)/f+2;break;case r:l=(n-s)/f+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Zt.workingColorSpace){return Zt.workingToColorSpace(Be.copy(this),e),t.r=Be.r,t.g=Be.g,t.b=Be.b,t}getStyle(t=me){Zt.workingToColorSpace(Be.copy(this),t);let e=Be.r,n=Be.g,s=Be.b;return t!==me?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(ei),this.setHSL(ei.h+t,ei.s+e,ei.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(ei),t.getHSL(so);let n=or(ei.h,so.h,e),s=or(ei.s,so.s,e),r=or(ei.l,so.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Be=new Ut;Ut.NAMES=cd;var dr=class extends Ue{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Wn,this.environmentIntensity=1,this.environmentRotation=new Wn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),e.object.backgroundBlurriness=this.backgroundBlurriness,e.object.backgroundIntensity=this.backgroundIntensity,e.object.backgroundRotation=this.backgroundRotation.toArray(),e.object.environmentIntensity=this.environmentIntensity,e.object.environmentRotation=this.environmentRotation.toArray(),e}},fn=new k,kn=new k,Dl=new k,zn=new k,ts=new k,es=new k,au=new k,Nl=new k,Fl=new k,Bl=new k,kl=new he,zl=new he,Vl=new he,ri=class i{constructor(t=new k,e=new k,n=new k){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),fn.subVectors(t,e),s.cross(fn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){fn.subVectors(s,e),kn.subVectors(n,e),Dl.subVectors(t,e);let o=fn.dot(fn),a=fn.dot(kn),l=fn.dot(Dl),c=kn.dot(kn),h=kn.dot(Dl),f=o*c-a*a;if(f===0)return r.set(0,0,0),null;let u=1/f,p=(c*l-a*h)*u,g=(o*h-a*l)*u;return r.set(1-p-g,g,p)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,zn)===null?!1:zn.x>=0&&zn.y>=0&&zn.x+zn.y<=1}static getInterpolation(t,e,n,s,r,o,a,l){return this.getBarycoord(t,e,n,s,zn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,zn.x),l.addScaledVector(o,zn.y),l.addScaledVector(a,zn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,o){return kl.setScalar(0),zl.setScalar(0),Vl.setScalar(0),kl.fromBufferAttribute(t,e),zl.fromBufferAttribute(t,n),Vl.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(kl,r.x),o.addScaledVector(zl,r.y),o.addScaledVector(Vl,r.z),o}static isFrontFacing(t,e,n,s){return fn.subVectors(n,e),kn.subVectors(t,e),fn.cross(kn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return fn.subVectors(this.c,this.b),kn.subVectors(this.a,this.b),fn.cross(kn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,o,a;ts.subVectors(s,n),es.subVectors(r,n),Nl.subVectors(t,n);let l=ts.dot(Nl),c=es.dot(Nl);if(l<=0&&c<=0)return e.copy(n);Fl.subVectors(t,s);let h=ts.dot(Fl),f=es.dot(Fl);if(h>=0&&f<=h)return e.copy(s);let u=l*f-h*c;if(u<=0&&l>=0&&h<=0)return o=l/(l-h),e.copy(n).addScaledVector(ts,o);Bl.subVectors(t,r);let p=ts.dot(Bl),g=es.dot(Bl);if(g>=0&&p<=g)return e.copy(r);let _=p*c-l*g;if(_<=0&&c>=0&&g<=0)return a=c/(c-g),e.copy(n).addScaledVector(es,a);let m=h*g-p*f;if(m<=0&&f-h>=0&&p-g>=0)return au.subVectors(r,s),a=(f-h)/(f-h+(p-g)),e.copy(s).addScaledVector(au,a);let d=1/(m+_+u);return o=_*d,a=u*d,e.copy(n).addScaledVector(ts,o).addScaledVector(es,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},ln=class{constructor(t=new k(1/0,1/0,1/0),e=new k(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(pn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(pn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=pn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,pn):pn.fromBufferAttribute(r,o),pn.applyMatrix4(t.matrixWorld),this.expandByPoint(pn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),ro.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ro.copy(n.boundingBox)),ro.applyMatrix4(t.matrixWorld),this.union(ro)}let s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,pn),pn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Qs),oo.subVectors(this.max,Qs),ns.subVectors(t.a,Qs),is.subVectors(t.b,Qs),ss.subVectors(t.c,Qs),ni.subVectors(is,ns),ii.subVectors(ss,is),Ri.subVectors(ns,ss);let e=[0,-ni.z,ni.y,0,-ii.z,ii.y,0,-Ri.z,Ri.y,ni.z,0,-ni.x,ii.z,0,-ii.x,Ri.z,0,-Ri.x,-ni.y,ni.x,0,-ii.y,ii.x,0,-Ri.y,Ri.x,0];return!Hl(e,ns,is,ss,oo)||(e=[1,0,0,0,1,0,0,0,1],!Hl(e,ns,is,ss,oo))?!1:(ao.crossVectors(ni,ii),e=[ao.x,ao.y,ao.z],Hl(e,ns,is,ss,oo))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,pn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(pn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Vn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Vn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Vn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Vn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Vn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Vn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Vn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Vn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Vn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Vn=[new k,new k,new k,new k,new k,new k,new k,new k],pn=new k,ro=new ln,ns=new k,is=new k,ss=new k,ni=new k,ii=new k,Ri=new k,Qs=new k,oo=new k,ao=new k,Pi=new k;function Hl(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){Pi.fromArray(i,r);let a=s.x*Math.abs(Pi.x)+s.y*Math.abs(Pi.y)+s.z*Math.abs(Pi.z),l=t.dot(Pi),c=e.dot(Pi),h=n.dot(Pi);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var be=new k,lo=new Ht,Vp=0,we=class extends Cn{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Vp++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=sd,this.updateRanges=[],this.gpuType=cn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)lo.fromBufferAttribute(this,e),lo.applyMatrix3(t),this.setXY(e,lo.x,lo.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.applyMatrix3(t),this.setXYZ(e,be.x,be.y,be.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.applyMatrix4(t),this.setXYZ(e,be.x,be.y,be.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.applyNormalMatrix(t),this.setXYZ(e,be.x,be.y,be.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.transformDirection(t),this.setXYZ(e,be.x,be.y,be.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=hs(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Ge(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=hs(e,this.array)),e}setX(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=hs(e,this.array)),e}setY(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=hs(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=hs(e,this.array)),e}setW(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array),s=Ge(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array),s=Ge(s,this.array),r=Ge(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}};var fr=class extends we{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var pr=class extends we{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var _e=class extends we{constructor(t,e,n){super(new Float32Array(t),e,n)}},Hp=new ln,tr=new k,Gl=new k,_n=class{constructor(t=new k,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):Hp.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;tr.subVectors(t,this.center);let e=tr.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(tr,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Gl.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(tr.copy(t.center).add(Gl)),this.expandByPoint(tr.copy(t.center).sub(Gl))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},Gp=0,on=new ne,Wl=new Ue,rs=new k,tn=new ln,er=new ln,Re=new k,Ie=class i extends Cn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Gp++}),this.uuid=Cs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(fp(t)?pr:fr)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Ft().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return on.makeRotationFromQuaternion(t),this.applyMatrix4(on),this}rotateX(t){return on.makeRotationX(t),this.applyMatrix4(on),this}rotateY(t){return on.makeRotationY(t),this.applyMatrix4(on),this}rotateZ(t){return on.makeRotationZ(t),this.applyMatrix4(on),this}translate(t,e,n){return on.makeTranslation(t,e,n),this.applyMatrix4(on),this}scale(t,e,n){return on.makeScale(t,e,n),this.applyMatrix4(on),this}lookAt(t){return Wl.lookAt(t),Wl.updateMatrix(),this.applyMatrix4(Wl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(rs).negate(),this.translate(rs.x,rs.y,rs.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new _e(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&Lt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ln);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Dt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new k(-1/0,-1/0,-1/0),new k(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];tn.setFromBufferAttribute(r),this.morphTargetsRelative?(Re.addVectors(this.boundingBox.min,tn.min),this.boundingBox.expandByPoint(Re),Re.addVectors(this.boundingBox.max,tn.max),this.boundingBox.expandByPoint(Re)):(this.boundingBox.expandByPoint(tn.min),this.boundingBox.expandByPoint(tn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Dt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new _n);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Dt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new k,1/0);return}if(t){let n=this.boundingSphere.center;if(tn.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){let a=e[r];er.setFromBufferAttribute(a),this.morphTargetsRelative?(Re.addVectors(tn.min,er.min),tn.expandByPoint(Re),Re.addVectors(tn.max,er.max),tn.expandByPoint(Re)):(tn.expandByPoint(er.min),tn.expandByPoint(er.max))}tn.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)Re.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Re));if(e)for(let r=0,o=e.length;r<o;r++){let a=e[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Re.fromBufferAttribute(a,c),l&&(rs.fromBufferAttribute(t,c),Re.add(rs)),s=Math.max(s,n.distanceToSquared(Re))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Dt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){Dt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new we(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let y=0;y<n.count;y++)a[y]=new k,l[y]=new k;let c=new k,h=new k,f=new k,u=new Ht,p=new Ht,g=new Ht,_=new k,m=new k;function d(y,T,C){c.fromBufferAttribute(n,y),h.fromBufferAttribute(n,T),f.fromBufferAttribute(n,C),u.fromBufferAttribute(r,y),p.fromBufferAttribute(r,T),g.fromBufferAttribute(r,C),h.sub(c),f.sub(c),p.sub(u),g.sub(u);let I=1/(p.x*g.y-g.x*p.y);isFinite(I)&&(_.copy(h).multiplyScalar(g.y).addScaledVector(f,-p.y).multiplyScalar(I),m.copy(f).multiplyScalar(p.x).addScaledVector(h,-g.x).multiplyScalar(I),a[y].add(_),a[T].add(_),a[C].add(_),l[y].add(m),l[T].add(m),l[C].add(m))}let M=this.groups;M.length===0&&(M=[{start:0,count:t.count}]);for(let y=0,T=M.length;y<T;++y){let C=M[y],I=C.start,L=C.count;for(let N=I,P=I+L;N<P;N+=3)d(t.getX(N+0),t.getX(N+1),t.getX(N+2))}let E=new k,v=new k,b=new k,S=new k;function A(y){b.fromBufferAttribute(s,y),S.copy(b);let T=a[y];E.copy(T),E.sub(b.multiplyScalar(b.dot(T))).normalize(),v.crossVectors(S,T);let I=v.dot(l[y])<0?-1:1;o.setXYZW(y,E.x,E.y,E.z,I)}for(let y=0,T=M.length;y<T;++y){let C=M[y],I=C.start,L=C.count;for(let N=I,P=I+L;N<P;N+=3)A(t.getX(N+0)),A(t.getX(N+1)),A(t.getX(N+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new we(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let u=0,p=n.count;u<p;u++)n.setXYZ(u,0,0,0);let s=new k,r=new k,o=new k,a=new k,l=new k,c=new k,h=new k,f=new k;if(t)for(let u=0,p=t.count;u<p;u+=3){let g=t.getX(u+0),_=t.getX(u+1),m=t.getX(u+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),o.fromBufferAttribute(e,m),h.subVectors(o,r),f.subVectors(s,r),h.cross(f),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,m),a.add(h),l.add(h),c.add(h),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let u=0,p=e.count;u<p;u+=3)s.fromBufferAttribute(e,u+0),r.fromBufferAttribute(e,u+1),o.fromBufferAttribute(e,u+2),h.subVectors(o,r),f.subVectors(s,r),h.cross(f),n.setXYZ(u+0,h.x,h.y,h.z),n.setXYZ(u+1,h.x,h.y,h.z),n.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Re.fromBufferAttribute(t,e),Re.normalize(),t.setXYZ(e,Re.x,Re.y,Re.z)}toNonIndexed(){function t(a,l){let c=a.array,h=a.itemSize,f=a.normalized,u=new c.constructor(l.length*h),p=0,g=0;for(let _=0,m=l.length;_<m;_++){a.isInterleavedBufferAttribute?p=l[_]*a.data.stride+a.offset:p=l[_]*h;for(let d=0;d<h;d++)u[g++]=c[p++]}return new we(u,h,f)}if(this.index===null)return Lt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let a in s){let l=s[a],c=t(l,n);e.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,f=c.length;h<f;h++){let u=c[h],p=t(u,n);l.push(p)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let f=0,u=c.length;f<u;f++){let p=c[f];h.push(p.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(t.data.boundingSphere=a.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],f=r[c];for(let u=0,p=f.length;u<p;u++)h.push(f[u].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let o=t.groups;for(let c=0,h=o.length;c<h;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Xl=new k,Wp=new k,Xp=new Ft,mn=class{constructor(t=new k(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=Xl.subVectors(n,e).cross(Wp.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(Xl),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let o=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(o<0||o>1)?null:e.copy(t.start).addScaledVector(s,o)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||Xp.getNormalMatrix(t),s=this.coplanarPoint(Xl).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},qp=0,Xn=class extends Cn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:qp++}),this.uuid=Cs(),this.name="",this.type="Material",this.blending=Es,this.side=fi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=cc,this.blendDst=hc,this.blendEquation=Bi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ut(0,0,0),this.blendAlpha=0,this.depthFunc=ds,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Ju,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=To,this.stencilZFail=To,this.stencilZPass=To,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){Lt(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Lt(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(e){let r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Ut().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(n=>new mn().fromJSON(n))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new Ht().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Ht().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Hn=new k,ql=new k,co=new k,ho=new k,vs=class{constructor(t=new k,e=new k(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Hn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=Hn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Hn.copy(this.origin).addScaledVector(this.direction,e),Hn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){ql.copy(t).add(e).multiplyScalar(.5),co.copy(e).sub(t).normalize(),ho.copy(this.origin).sub(ql);let r=t.distanceTo(e)*.5,o=-this.direction.dot(co),a=ho.dot(this.direction),l=-ho.dot(co),c=ho.lengthSq(),h=Math.abs(1-o*o),f,u,p,g;if(h>0)if(f=o*l-a,u=o*a-l,g=r*h,f>=0)if(u>=-g)if(u<=g){let _=1/h;f*=_,u*=_,p=f*(f+o*u+2*a)+u*(o*f+u+2*l)+c}else u=r,f=Math.max(0,-(o*u+a)),p=-f*f+u*(u+2*l)+c;else u=-r,f=Math.max(0,-(o*u+a)),p=-f*f+u*(u+2*l)+c;else u<=-g?(f=Math.max(0,-(-o*r+a)),u=f>0?-r:Math.min(Math.max(-r,-l),r),p=-f*f+u*(u+2*l)+c):u<=g?(f=0,u=Math.min(Math.max(-r,-l),r),p=u*(u+2*l)+c):(f=Math.max(0,-(o*r+a)),u=f>0?r:Math.min(Math.max(-r,-l),r),p=-f*f+u*(u+2*l)+c);else u=o>0?-r:r,f=Math.max(0,-(o*u+a)),p=-f*f+u*(u+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(ql).addScaledVector(co,u),p}intersectSphere(t,e){if(t.radius<0)return null;Hn.subVectors(t.center,this.origin);let n=Hn.dot(this.direction),s=Hn.dot(Hn)-n*n,r=t.radius*t.radius;if(s>r)return null;let o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,u=this.origin;return c>=0?(n=(t.min.x-u.x)*c,s=(t.max.x-u.x)*c):(n=(t.max.x-u.x)*c,s=(t.min.x-u.x)*c),h>=0?(r=(t.min.y-u.y)*h,o=(t.max.y-u.y)*h):(r=(t.max.y-u.y)*h,o=(t.min.y-u.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),f>=0?(a=(t.min.z-u.z)*f,l=(t.max.z-u.z)*f):(a=(t.max.z-u.z)*f,l=(t.min.z-u.z)*f),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,Hn)!==null}intersectTriangle(t,e,n,s,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,h=a.z,f=t.x-o.x,u=t.y-o.y,p=t.z-o.z,g=e.x-o.x,_=e.y-o.y,m=e.z-o.z,d=n.x-o.x,M=n.y-o.y,E=n.z-o.z,v=Math.abs(l),b=Math.abs(c),S=Math.abs(h),A,y,T,C,I,L,N,P,O,U,V,J;if(v>=b&&v>=S?(T=l,L=f,O=g,J=d,l>=0?(A=c,y=h,C=u,I=p,N=_,P=m,U=M,V=E):(A=h,y=c,C=p,I=u,N=m,P=_,U=E,V=M)):b>=S?(T=c,L=u,O=_,J=M,c>=0?(A=h,y=l,C=p,I=f,N=m,P=g,U=E,V=d):(A=l,y=h,C=f,I=p,N=g,P=m,U=d,V=E)):(T=h,L=p,O=m,J=E,h>=0?(A=l,y=c,C=f,I=u,N=g,P=_,U=d,V=M):(A=c,y=l,C=u,I=f,N=_,P=g,U=M,V=d)),T===0)return null;let Z=A/T,tt=y/T,it=1/T,W=C-Z*L,st=I-tt*L,ct=N-Z*O,lt=P-tt*O,bt=U-Z*J,X=V-tt*J,K=bt*lt-X*ct,ot=W*X-st*bt,wt=ct*st-lt*W;if(s){if(K<0||ot<0||wt<0)return null}else if((K<0||ot<0||wt<0)&&(K>0||ot>0||wt>0))return null;let _t=K+ot+wt;if(_t===0)return null;let zt=it*(K*L+ot*O+wt*J);return(_t>0?zt<0:zt>0)?null:this.at(zt/_t,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Oi=class extends Xn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ut(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Wn,this.combine=uc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},lu=new ne,Ii=new vs,uo=new _n,cu=new k,fo=new k,po=new k,mo=new k,Yl=new k,go=new k,hu=new k,_o=new k,ze=class extends Ue{constructor(t=new Ie,e=new Oi){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let a=this.morphTargetInfluences;if(r&&a){go.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],f=r[l];h!==0&&(Yl.fromBufferAttribute(f,t),o?go.addScaledVector(Yl,h):go.addScaledVector(Yl.sub(e),h))}e.add(go)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),uo.copy(n.boundingSphere),uo.applyMatrix4(r),Ii.copy(t.ray).recast(t.near),!(uo.containsPoint(Ii.origin)===!1&&(Ii.intersectSphere(uo,cu)===null||Ii.origin.distanceToSquared(cu)>(t.far-t.near)**2))&&(lu.copy(r).invert(),Ii.copy(t.ray).applyMatrix4(lu),!(n.boundingBox!==null&&Ii.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Ii)))}_computeIntersections(t,e,n){let s,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,u=r.groups,p=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,_=u.length;g<_;g++){let m=u[g],d=o[m.materialIndex],M=Math.max(m.start,p.start),E=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let v=M,b=E;v<b;v+=3){let S=a.getX(v),A=a.getX(v+1),y=a.getX(v+2);s=xo(this,d,t,n,c,h,f,S,A,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,p.start),_=Math.min(a.count,p.start+p.count);for(let m=g,d=_;m<d;m+=3){let M=a.getX(m),E=a.getX(m+1),v=a.getX(m+2);s=xo(this,o,t,n,c,h,f,M,E,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,_=u.length;g<_;g++){let m=u[g],d=o[m.materialIndex],M=Math.max(m.start,p.start),E=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let v=M,b=E;v<b;v+=3){let S=v,A=v+1,y=v+2;s=xo(this,d,t,n,c,h,f,S,A,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,p.start),_=Math.min(l.count,p.start+p.count);for(let m=g,d=_;m<d;m+=3){let M=m,E=m+1,v=m+2;s=xo(this,o,t,n,c,h,f,M,E,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}};function Yp(i,t,e,n,s,r,o,a){let l;if(t.side===Xe?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,t.side===fi,a),l===null)return null;_o.copy(a),_o.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(_o);return c<e.near||c>e.far?null:{distance:c,point:_o.clone(),object:i}}function xo(i,t,e,n,s,r,o,a,l,c){i.getVertexPosition(a,fo),i.getVertexPosition(l,po),i.getVertexPosition(c,mo);let h=Yp(i,t,e,n,fo,po,mo,hu);if(h){let f=new k;ri.getBarycoord(hu,fo,po,mo,f),s&&(h.uv=ri.getInterpolatedAttribute(s,a,l,c,f,new Ht)),r&&(h.uv1=ri.getInterpolatedAttribute(r,a,l,c,f,new Ht)),o&&(h.normal=ri.getInterpolatedAttribute(o,a,l,c,f,new k),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let u={a,b:l,c,normal:new k,materialIndex:0};ri.getNormal(fo,po,mo,u.normal),h.face=u,h.barycoord=f}return h}var mr=class extends ke{constructor(t=null,e=1,n=1,s,r,o,a,l,c=Pe,h=Pe,f,u){super(null,o,a,l,c,h,s,r,f,u),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Di=class extends we{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){let t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}},os=new ne,uu=new ne,yo=[],du=new ln,Zp=new ne,nr=new ze,ir=new _n,xn=class extends ze{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Di(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Zp)}computeBoundingBox(){let t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new ln),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,os),du.copy(t.boundingBox).applyMatrix4(os),this.boundingBox.union(du)}computeBoundingSphere(){let t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new _n),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,os),ir.copy(t.boundingSphere).applyMatrix4(os),this.boundingSphere.union(ir)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){return this.instanceColor===null?e.setRGB(1,1,1):e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){return e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){let n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){let n=this.matrixWorld,s=this.count;if(nr.geometry=this.geometry,nr.material=this.material,nr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ir.copy(this.boundingSphere),ir.applyMatrix4(n),t.ray.intersectsSphere(ir)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,os),uu.multiplyMatrices(n,os),nr.matrixWorld=uu,nr.raycast(t,yo);for(let o=0,a=yo.length;o<a;o++){let l=yo[o];l.instanceId=r,l.object=this,e.push(l)}yo.length=0}}setColorAt(t,e){return this.instanceColor===null&&(this.instanceColor=new Di(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3),this}setMatrixAt(t,e){return e.toArray(this.instanceMatrix.array,t*16),this}setMorphAt(t,e){let n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new mr(new Float32Array(s*this.count),s,this.count,ua,cn));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<n.length;c++)o+=n[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=s*t;return r[l]=a,r.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Li=new _n,$p=new Ht(.5,.5),vo=new k,Ms=class{constructor(t=new mn,e=new mn,n=new mn,s=new mn,r=new mn,o=new mn){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){let a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=gn,n=!1){let s=this.planes,r=t.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],f=r[5],u=r[6],p=r[7],g=r[8],_=r[9],m=r[10],d=r[11],M=r[12],E=r[13],v=r[14],b=r[15];if(s[0].setComponents(c-o,p-h,d-g,b-M).normalize(),s[1].setComponents(c+o,p+h,d+g,b+M).normalize(),s[2].setComponents(c+a,p+f,d+_,b+E).normalize(),s[3].setComponents(c-a,p-f,d-_,b-E).normalize(),n)s[4].setComponents(l,u,m,v).normalize(),s[5].setComponents(c-l,p-u,d-m,b-v).normalize();else if(s[4].setComponents(c-l,p-u,d-m,b-v).normalize(),e===gn)s[5].setComponents(c+l,p+u,d+m,b+v).normalize();else if(e===ps)s[5].setComponents(l,u,m,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Li.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Li.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Li)}intersectsSprite(t){Li.center.set(0,0,0);let e=$p.distanceTo(t.center);return Li.radius=.7071067811865476+e,Li.applyMatrix4(t.matrixWorld),this.intersectsSphere(Li)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(vo.x=s.normal.x>0?t.max.x:t.min.x,vo.y=s.normal.y>0?t.max.y:t.min.y,vo.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(vo)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Ss=class extends Xn{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ut(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},ko=new k,zo=new k,fu=new ne,sr=new vs,Mo=new _n,Zl=new k,pu=new k,Vo=class extends Ue{constructor(t=new Ie,e=new Ss){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[0];for(let s=1,r=e.count;s<r;s++)ko.fromBufferAttribute(e,s-1),zo.fromBufferAttribute(e,s),n[s]=n[s-1],n[s]+=ko.distanceTo(zo);t.setAttribute("lineDistance",new _e(n,1))}else Lt("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Mo.copy(n.boundingSphere),Mo.applyMatrix4(s),Mo.radius+=r,t.ray.intersectsSphere(Mo)===!1)return;fu.copy(s).invert(),sr.copy(t.ray).applyMatrix4(fu);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=n.index,u=n.attributes.position;if(h!==null){let p=Math.max(0,o.start),g=Math.min(h.count,o.start+o.count);for(let _=p,m=g-1;_<m;_+=c){let d=h.getX(_),M=h.getX(_+1),E=So(this,t,sr,l,d,M,_);E&&e.push(E)}if(this.isLineLoop){let _=h.getX(g-1),m=h.getX(p),d=So(this,t,sr,l,_,m,g-1);d&&e.push(d)}}else{let p=Math.max(0,o.start),g=Math.min(u.count,o.start+o.count);for(let _=p,m=g-1;_<m;_+=c){let d=So(this,t,sr,l,_,_+1,_);d&&e.push(d)}if(this.isLineLoop){let _=So(this,t,sr,l,g-1,p,g-1);_&&e.push(_)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function So(i,t,e,n,s,r,o){let a=i.geometry.attributes.position;if(ko.fromBufferAttribute(a,s),zo.fromBufferAttribute(a,r),e.distanceSqToSegment(ko,zo,Zl,pu)>n)return;Zl.applyMatrix4(i.matrixWorld);let c=t.ray.origin.distanceTo(Zl);if(!(c<t.near||c>t.far))return{distance:c,point:pu.clone().applyMatrix4(i.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:i}}var mu=new k,gu=new k,gr=class extends Vo{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[];for(let s=0,r=e.count;s<r;s+=2)mu.fromBufferAttribute(e,s),gu.fromBufferAttribute(e,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+mu.distanceTo(gu);t.setAttribute("lineDistance",new _e(n,1))}else Lt("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var _r=class extends ke{constructor(t=[],e=pi,n,s,r,o,a,l,c,h){super(t,e,n,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}};var oi=class extends ke{constructor(t,e,n=vn,s,r,o,a=Pe,l=Pe,c,h=An,f=1){if(h!==An&&h!==gi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:e,depth:f};super(u,s,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new _s(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return e.compareFunction=this.compareFunction,e}},Ho=class extends oi{constructor(t,e=vn,n=pi,s,r,o=Pe,a=Pe,l,c=An){let h={width:t,height:t,depth:1},f=[h,h,h,h,h,h];super(t,t,e,n,s,r,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},xr=class extends ke{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},Rn=class i extends Ie{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};let a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],f=[],u=0,p=0;g("z","y","x",-1,-1,n,e,t,o,r,0),g("z","y","x",1,-1,n,e,-t,o,r,1),g("x","z","y",1,1,t,n,e,s,o,2),g("x","z","y",1,-1,t,n,-e,s,o,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new _e(c,3)),this.setAttribute("normal",new _e(h,3)),this.setAttribute("uv",new _e(f,2));function g(_,m,d,M,E,v,b,S,A,y,T){let C=v/A,I=b/y,L=v/2,N=b/2,P=S/2,O=A+1,U=y+1,V=0,J=0,Z=new k;for(let tt=0;tt<U;tt++){let it=tt*I-N;for(let W=0;W<O;W++){let st=W*C-L;Z[_]=st*M,Z[m]=it*E,Z[d]=P,c.push(Z.x,Z.y,Z.z),Z[_]=0,Z[m]=0,Z[d]=S>0?1:-1,h.push(Z.x,Z.y,Z.z),f.push(W/A),f.push(1-tt/y),V+=1}}for(let tt=0;tt<y;tt++)for(let it=0;it<A;it++){let W=u+it+O*tt,st=u+it+O*(tt+1),ct=u+(it+1)+O*(tt+1),lt=u+(it+1)+O*tt;l.push(W,st,lt),l.push(st,ct,lt),J+=6}a.addGroup(p,J,T),p+=J,u+=V}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},yr=class i extends Ie{constructor(t=1,e=1,n=4,s=8,r=1){super(),this.type="CapsuleGeometry",this.parameters={radius:t,height:e,capSegments:n,radialSegments:s,heightSegments:r},e=Math.max(0,e),n=Math.max(1,Math.floor(n)),s=Math.max(3,Math.floor(s)),r=Math.max(1,Math.floor(r));let o=[],a=[],l=[],c=[],h=e/2,f=Math.PI/2*t,u=e,p=2*f+u,g=n*2+r,_=s+1,m=new k,d=new k;for(let M=0;M<=g;M++){let E=0,v=0,b=0,S=0;if(M<=n){let T=M/n,C=T*Math.PI/2;v=-h-t*Math.cos(C),b=t*Math.sin(C),S=-t*Math.cos(C),E=T*f}else if(M<=n+r){let T=(M-n)/r;v=-h+T*e,b=t,S=0,E=f+T*u}else{let T=(M-n-r)/n,C=T*Math.PI/2;v=h+t*Math.sin(C),b=t*Math.cos(C),S=t*Math.sin(C),E=f+u+T*f}let A=Math.max(0,Math.min(1,E/p)),y=0;M===0?y=.5/s:M===g&&(y=-.5/s);for(let T=0;T<=s;T++){let C=T/s,I=C*Math.PI*2,L=Math.sin(I),N=Math.cos(I);d.x=-b*N,d.y=v,d.z=b*L,a.push(d.x,d.y,d.z),m.set(-b*N,S,b*L),m.normalize(),l.push(m.x,m.y,m.z),c.push(C+y,A)}if(M>0){let T=(M-1)*_;for(let C=0;C<s;C++){let I=T+C,L=T+C+1,N=M*_+C,P=M*_+C+1;o.push(I,L,N),o.push(L,P,N)}}}this.setIndex(o),this.setAttribute("position",new _e(a,3)),this.setAttribute("normal",new _e(l,3)),this.setAttribute("uv",new _e(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.height,t.capSegments,t.radialSegments,t.heightSegments)}};var ai=class i extends Ie{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],f=[],u=[],p=[],g=0,_=[],m=n/2,d=0;M(),o===!1&&(t>0&&E(!0),e>0&&E(!1)),this.setIndex(h),this.setAttribute("position",new _e(f,3)),this.setAttribute("normal",new _e(u,3)),this.setAttribute("uv",new _e(p,2));function M(){let v=new k,b=new k,S=0,A=(e-t)/n;for(let y=0;y<=r;y++){let T=[],C=y/r,I=C*(e-t)+t;for(let L=0;L<=s;L++){let N=L/s,P=N*l+a,O=Math.sin(P),U=Math.cos(P);b.x=I*O,b.y=-C*n+m,b.z=I*U,f.push(b.x,b.y,b.z),v.set(O,A,U).normalize(),u.push(v.x,v.y,v.z),p.push(N,1-C),T.push(g++)}_.push(T)}for(let y=0;y<s;y++)for(let T=0;T<r;T++){let C=_[T][y],I=_[T+1][y],L=_[T+1][y+1],N=_[T][y+1];(t>0||T!==0)&&(h.push(C,I,N),S+=3),(e>0||T!==r-1)&&(h.push(I,L,N),S+=3)}c.addGroup(d,S,0),d+=S}function E(v){let b=g,S=new Ht,A=new k,y=0,T=v===!0?t:e,C=v===!0?1:-1;for(let L=1;L<=s;L++)f.push(0,m*C,0),u.push(0,C,0),p.push(.5,.5),g++;let I=g;for(let L=0;L<=s;L++){let P=L/s*l+a,O=Math.cos(P),U=Math.sin(P);A.x=T*U,A.y=m*C,A.z=T*O,f.push(A.x,A.y,A.z),u.push(0,C,0),S.x=O*.5+.5,S.y=U*.5*C+.5,p.push(S.x,S.y),g++}for(let L=0;L<s;L++){let N=b+L,P=I+L;v===!0?h.push(P,P+1,N):h.push(P+1,P,N),y+=3}c.addGroup(d,y,v===!0?1:2),d+=y}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},vr=class i extends ai{constructor(t=1,e=1,n=32,s=1,r=!1,o=0,a=Math.PI*2){super(0,t,e,n,s,r,o,a),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(t){return new i(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var Ni=class i extends Ie{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,o=e/2,a=Math.floor(n),l=Math.floor(s),c=a+1,h=l+1,f=t/a,u=e/l,p=[],g=[],_=[],m=[];for(let d=0;d<h;d++){let M=d*u-o;for(let E=0;E<c;E++){let v=E*f-r;g.push(v,-M,0),_.push(0,0,1),m.push(E/a),m.push(1-d/l)}}for(let d=0;d<l;d++)for(let M=0;M<a;M++){let E=M+c*d,v=M+c*(d+1),b=M+1+c*(d+1),S=M+1+c*d;p.push(E,v,S),p.push(v,b,S)}this.setIndex(p),this.setAttribute("position",new _e(g,3)),this.setAttribute("normal",new _e(_,3)),this.setAttribute("uv",new _e(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}};var Fi=class i extends Ie{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(o+a,Math.PI),c=0,h=[],f=new k,u=new k,p=[],g=[],_=[],m=[];for(let d=0;d<=n;d++){let M=[],E=d/n,v=o+E*a,b=t*Math.cos(v),S=Math.sqrt(t*t-b*b),A=0;d===0&&o===0?A=.5/e:d===n&&l===Math.PI&&(A=-.5/e);for(let y=0;y<=e;y++){let T=y/e,C=s+T*r;f.x=-S*Math.cos(C),f.y=b,f.z=S*Math.sin(C),g.push(f.x,f.y,f.z),u.copy(f).normalize(),_.push(u.x,u.y,u.z),m.push(T+A,1-E),M.push(c++)}h.push(M)}for(let d=0;d<n;d++)for(let M=0;M<e;M++){let E=h[d][M+1],v=h[d][M],b=h[d+1][M],S=h[d+1][M+1];(d!==0||o>0)&&p.push(E,v,S),(d!==n-1||l<Math.PI)&&p.push(v,b,S)}this.setIndex(p),this.setAttribute("position",new _e(g,3)),this.setAttribute("normal",new _e(_,3)),this.setAttribute("uv",new _e(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function zi(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(_u(s))s.isRenderTargetTexture?(Lt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(_u(s[0])){let r=[];for(let o=0,a=s.length;o<a;o++)r[o]=s[o].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function Ve(i){let t={};for(let e=0;e<i.length;e++){let n=zi(i[e]);for(let s in n)t[s]=n[s]}return t}function _u(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function Kp(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Rc(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Zt.workingColorSpace}var hd={clone:zi,merge:Ve},Jp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,jp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,We=class extends Xn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Jp,this.fragmentShader=jp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=zi(t.uniforms),this.uniformsGroups=Kp(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new Ut().setHex(s.value);break;case"v2":this.uniforms[n].value=new Ht().fromArray(s.value);break;case"v3":this.uniforms[n].value=new k().fromArray(s.value);break;case"v4":this.uniforms[n].value=new he().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Ft().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ne().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},Go=class extends We{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},li=class extends Xn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ut(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ut(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Xa,this.normalScale=new Ht(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Wn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}};var Wo=class extends Xn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=$u,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},Xo=class extends Xn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function as(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function $l(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var ci=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let o;e:{i:if(!(t<s)){for(let a=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=s,s=e[++n],t<s)break t}o=e.length;break e}if(!(t>=r)){let a=e[1];t<a&&(n=2,r=a);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}o=n,n=0;break e}break n}for(;n<o;){let a=n+o>>>1;t<e[a]?o=a:n=a+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let o=0;o!==s;++o)e[o]=n[r+o];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},qo=class extends ci{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:jl,endingEnd:jl}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,o=t+1,a=s[r],l=s[o];if(a===void 0)switch(this.getSettings_().endingStart){case Ql:r=t,a=2*e-n;break;case tc:r=s.length-2,a=e+s[r]-s[r+1];break;default:r=t,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Ql:o=t,l=2*n-e;break;case tc:o=1,l=n+s[1]-s[0];break;default:o=t-1,l=e}let c=(n-e)*.5,h=this.valueSize;this._weightPrev=c/(e-a),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this._offsetPrev,f=this._offsetNext,u=this._weightPrev,p=this._weightNext,g=(n-e)/(s-e),_=g*g,m=_*g,d=-u*m+2*u*_-u*g,M=(1+u)*m+(-1.5-2*u)*_+(-.5+u)*g+1,E=(-1-p)*m+(1.5+p)*_+.5*g,v=p*m-p*_;for(let b=0;b!==a;++b)r[b]=d*o[h+b]+M*o[c+b]+E*o[l+b]+v*o[f+b];return r}},Yo=class extends ci{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=(n-e)/(s-e),f=1-h;for(let u=0;u!==a;++u)r[u]=o[c+u]*f+o[l+u]*h;return r}},Zo=class extends ci{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},$o=class extends ci{interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this.inTangents,f=this.outTangents;if(!h||!f){let g=(n-e)/(s-e),_=1-g;for(let m=0;m!==a;++m)r[m]=o[c+m]*_+o[l+m]*g;return r}let u=a*2,p=t-1;for(let g=0;g!==a;++g){let _=o[c+g],m=o[l+g],d=p*u+g*2,M=f[d],E=f[d+1],v=t*u+g*2,b=h[v],S=h[v+1],A=tm(n,e,M,b,s);r[g]=ud(A,_,E,S,m)}return r}};function ud(i,t,e,n,s){let r=1-i;return r*r*r*t+3*r*r*i*e+3*r*i*i*n+i*i*i*s}function Qp(i,t,e,n,s){let r=1-i;return 3*r*r*(e-t)+6*r*i*(n-e)+3*i*i*(s-n)}function tm(i,t,e,n,s){let r=(i-t)/(s-t);for(let o=0;o<8;o++){let a=ud(r,t,e,n,s)-i;if(Math.abs(a)<1e-10)break;let l=Qp(r,t,e,n,s);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var nn=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=as(e,this.TimeBufferType),this.values=as(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:as(t.times,Array),values:as(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s),$l(t.settings)&&(n.settings={inTangents:as(t.settings.inTangents,Array),outTangents:as(t.settings.outTangents,Array)})}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new Zo(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new Yo(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new qo(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new $o(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case ar:e=this.InterpolantFactoryMethodDiscrete;break;case Do:e=this.InterpolantFactoryMethodLinear;break;case Eo:e=this.InterpolantFactoryMethodSmooth;break;case Jl:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Lt("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ar;case this.InterpolantFactoryMethodLinear:return Do;case this.InterpolantFactoryMethodSmooth:return Eo;case this.InterpolantFactoryMethodBezier:return Jl}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t;$l(this.settings)&&(xu(this.settings.inTangents,t),xu(this.settings.outTangents,t))}return this}trim(t,e){let n=this.times,s=n.length,r=0,o=s-1;for(;r!==s&&n[r]<t;)++r;for(;o!==-1&&n[o]>e;)--o;if(++o,r!==0||o!==s){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(Dt("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(Dt("KeyframeTrack: Track is empty.",this),t=!1);let o=null;for(let a=0;a!==r;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){Dt("KeyframeTrack: Time is not a valid number.",this,a,l),t=!1;break}if(o!==null&&o>l){Dt("KeyframeTrack: Out of order keys.",this,a,l,o),t=!1;break}o=l}if(s!==void 0&&pp(s))for(let a=0,l=s.length;a!==l;++a){let c=s[a];if(isNaN(c)){Dt("KeyframeTrack: Value is not a valid number.",this,a,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Eo,r=t.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=t[a],h=t[a+1];if(c!==h&&(a!==1||c!==t[0]))if(s)l=!0;else{let f=a*n,u=f-n,p=f+n;for(let g=0;g!==n;++g){let _=e[f+g];if(_!==e[u+g]||_!==e[p+g]){l=!0;break}}}if(l){if(a!==o){t[o]=t[a];let f=a*n,u=o*n;for(let p=0;p!==n;++p)e[u+p]=e[f+p]}++o}}if(r>0){t[o]=t[r];for(let a=r*n,l=o*n,c=0;c!==n;++c)e[l+c]=e[a+c];++o}return o!==t.length?(this.times=t.slice(0,o),this.values=e.slice(0,o*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,$l(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function xu(i,t){for(let e=0,n=i.length;e!==n;e+=2)i[e]*=t}nn.prototype.ValueTypeName="";nn.prototype.TimeBufferType=Float32Array;nn.prototype.ValueBufferType=Float32Array;nn.prototype.DefaultInterpolation=Do;var hi=class extends nn{constructor(t,e,n){super(t,e,n)}};hi.prototype.ValueTypeName="bool";hi.prototype.ValueBufferType=Array;hi.prototype.DefaultInterpolation=ar;hi.prototype.InterpolantFactoryMethodLinear=void 0;hi.prototype.InterpolantFactoryMethodSmooth=void 0;var Ko=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}};Ko.prototype.ValueTypeName="color";var Jo=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}};Jo.prototype.ValueTypeName="number";var jo=class extends ci{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-e)/(s-e),c=t*a;for(let h=c+a;c!==h;c+=4)en.slerpFlat(r,0,o,c-a,o,c,l);return r}},Mr=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new jo(this.times,this.values,this.getValueSize(),t)}};Mr.prototype.ValueTypeName="quaternion";Mr.prototype.InterpolantFactoryMethodSmooth=void 0;var ui=class extends nn{constructor(t,e,n){super(t,e,n)}};ui.prototype.ValueTypeName="string";ui.prototype.ValueBufferType=Array;ui.prototype.DefaultInterpolation=ar;ui.prototype.InterpolantFactoryMethodLinear=void 0;ui.prototype.InterpolantFactoryMethodSmooth=void 0;var Qo=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}};Qo.prototype.ValueTypeName="vector";var ta=class{constructor(t,e,n){let s=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(h){a++,r===!1&&s.onStart!==void 0&&s.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,s.onProgress!==void 0&&s.onProgress(h,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){let f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,u=c.length;f<u;f+=2){let p=c[f],g=c[f+1];if(p.global&&(p.lastIndex=0),p.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},dd=new ta,ea=class{constructor(t){this.manager=t!==void 0?t:dd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};ea.DEFAULT_MATERIAL_NAME="__DEFAULT";var Sr=class extends Ue{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ut(t),this.intensity=e}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},br=class extends Sr{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ue.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ut(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},Kl=new ne,yu=new k,vu=new k,na=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Ht(512,512),this.mapType=$e,this.map=null,this.mapPass=null,this.matrix=new ne,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ms,this._frameExtents=new Ht(1,1),this._viewportCount=1,this._viewports=[new he(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera;yu.setFromMatrixPosition(t.matrixWorld),e.position.copy(yu),vu.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(vu),e.updateMatrixWorld(),this._updateMatrix(e,this.matrix,this._frustum)}_updateMatrix(t,e,n,s){Kl.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),n.setFromProjectionMatrix(Kl,t.coordinateSystem,t.reversedDepth);let r=this._frameExtents,o=s?s.z/r.x:1,a=s?s.w/r.y:1,l=s?s.x/r.x:0,c=s?s.y/r.y:0;t.coordinateSystem===ps||t.reversedDepth?e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),e.multiply(Kl)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return t.intensity=this.intensity,t.bias=this.bias,t.normalBias=this.normalBias,t.radius=this.radius,t.blurSamples=this.blurSamples,t.mapSize=this.mapSize.toArray(),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},bo=new k,wo=new en,En=new k,wr=class extends Ue{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ne,this.projectionMatrix=new ne,this.projectionMatrixInverse=new ne,this.coordinateSystem=gn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(bo,wo,En),En.x===1&&En.y===1&&En.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(bo,wo,En.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(bo,wo,En),En.x===1&&En.y===1&&En.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(bo,wo,En.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},si=new k,Mu=new Ht,Su=new Ht,Ye=class extends wr{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=gs*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(rr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return gs*2*Math.atan(Math.tan(rr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){si.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(si.x,si.y).multiplyScalar(-t/si.z),si.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(si.x,si.y).multiplyScalar(-t/si.z)}getViewSize(t,e){return this.getViewBounds(t,Mu,Su),e.subVectors(Su,Mu)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(rr*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,e-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var di=class extends wr{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,o=n+t,a=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},ec=class extends na{constructor(){super(new di(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Er=class extends Sr{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ue.DEFAULT_UP),this.updateMatrix(),this.target=new Ue,this.shadow=new ec}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}};var ls=-90,cs=1,ia=class extends Ue{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Ye(ls,cs,t,e);s.layers=this.layers,this.add(s);let r=new Ye(ls,cs,t,e);r.layers=this.layers,this.add(r);let o=new Ye(ls,cs,t,e);o.layers=this.layers,this.add(o);let a=new Ye(ls,cs,t,e);a.layers=this.layers,this.add(a);let l=new Ye(ls,cs,t,e);l.layers=this.layers,this.add(l);let c=new Ye(ls,cs,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,l]=e;for(let c of e)this.remove(c);if(t===gn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===ps)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,f=t.getRenderTarget(),u=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;t.isWebGLRenderer===!0?m=t.state.buffers.depth.getReversed():m=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,2,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,3,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(n,4,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(f,u,p),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},sa=class extends Ye{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var Pc="\\[\\]\\.:\\/",em=new RegExp("["+Pc+"]","g"),Ic="[^"+Pc+"]",nm="[^"+Pc.replace("\\.","")+"]",im=/((?:WC+[\/:])*)/.source.replace("WC",Ic),sm=/(WCOD+)?/.source.replace("WCOD",nm),rm=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Ic),om=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Ic),am=new RegExp("^"+im+sm+rm+om+"$"),lm=["material","materials","bones","map"],nc=class{constructor(t,e,n){let s=n||fe.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},fe=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(em,"")}static parseTrackName(t){let e=am.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);lm.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===e||a.uuid===e)return a;let l=n(a.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Lt("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){Dt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Dt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Dt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Dt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Dt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){Dt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){Dt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let o=t[s];if(o===void 0){let c=e.nodeName;Dt("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let a=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?a=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Dt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Dt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};fe.Composite=nc;fe.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};fe.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};fe.prototype.GetterByBindingType=[fe.prototype._getValue_direct,fe.prototype._getValue_array,fe.prototype._getValue_arrayElement,fe.prototype._getValue_toArray];fe.prototype.SetterByBindingTypeAndVersioning=[[fe.prototype._setValue_direct,fe.prototype._setValue_direct_setNeedsUpdate,fe.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[fe.prototype._setValue_array,fe.prototype._setValue_array_setNeedsUpdate,fe.prototype._setValue_array_setMatrixWorldNeedsUpdate],[fe.prototype._setValue_arrayElement,fe.prototype._setValue_arrayElement_setNeedsUpdate,fe.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[fe.prototype._setValue_fromArray,fe.prototype._setValue_fromArray_setNeedsUpdate,fe.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var dv=new Float32Array(1);var bu=new ne,Tr=class{constructor(t,e,n=0,s=1/0){this.ray=new vs(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new xs,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):Dt("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return bu.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(bu),this}intersectObject(t,e=!0,n=[]){return ic(t,this,n,e),n.sort(wu),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)ic(t[s],this,n,e);return n.sort(wu),n}};function wu(i,t){return i.distance-t.distance}function ic(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let o=0,a=r.length;o<a;o++)ic(r[o],t,e,!0)}}var bs=class{constructor(t=1,e=0,n=0){this.radius=t,this.phi=e,this.theta=n}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Wt(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(Wt(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var sc=class i{static{i.prototype.isMatrix2=!0}constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};function Lc(i,t,e,n){let s=cm(n);switch(e){case wc:return i*t;case ua:return i*t/s.components*s.byteLength;case da:return i*t/s.components*s.byteLength;case _i:return i*t*2/s.components*s.byteLength;case fa:return i*t*2/s.components*s.byteLength;case Ec:return i*t*3/s.components*s.byteLength;case hn:return i*t*4/s.components*s.byteLength;case pa:return i*t*4/s.components*s.byteLength;case Pr:case Ir:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Lr:case Ur:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case ga:case xa:return Math.max(i,16)*Math.max(t,8)/4;case ma:case _a:return Math.max(i,8)*Math.max(t,8)/2;case ya:case va:case Sa:case ba:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Ma:case Or:case wa:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ea:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ta:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case Aa:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case Ca:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Ra:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Pa:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case Ia:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case La:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case Ua:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Oa:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case Da:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case Na:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case Fa:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case Ba:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case ka:case za:case Va:return Math.ceil(i/4)*Math.ceil(t/4)*16;case Ha:case Ga:return Math.ceil(i/4)*Math.ceil(t/4)*8;case Dr:case Wa:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function cm(i){switch(i){case $e:case vc:return{byteLength:1,components:1};case Ts:case Mc:case Mn:return{byteLength:2,components:1};case ca:case ha:return{byteLength:2,components:4};case vn:case la:case cn:return{byteLength:4,components:1};case Sc:case bc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?Lt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function Od(){let i=null,t=!1,e=null,n=null;function s(r,o){n=i.requestAnimationFrame(s),e(r,o)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function um(i){let t=new WeakMap;function e(a,l){let c=a.array,h=a.usage,f=c.byteLength,u=i.createBuffer();i.bindBuffer(l,u),i.bufferData(l,c,h),a.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=i.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function n(a,l,c){let h=l.array,f=l.updateRanges;if(i.bindBuffer(c,a),f.length===0)i.bufferSubData(c,0,h);else{f.sort((p,g)=>p.start-g.start);let u=0;for(let p=1;p<f.length;p++){let g=f[u],_=f[p];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++u,f[u]=_)}f.length=u+1;for(let p=0,g=f.length;p<g;p++){let _=f[p];i.bufferSubData(c,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=t.get(a);l&&(i.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var dm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,fm=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,pm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,mm=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,gm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,_m=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,xm=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,ym=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,vm=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Mm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Sm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,bm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,wm=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Em=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Tm=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Am=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Cm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Rm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Pm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Im=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Lm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Um=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Om=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Dm=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Nm=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Fm=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Bm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,km=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,zm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Vm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Hm="gl_FragColor = linearToOutputTexel( gl_FragColor );",Gm=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Wm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Xm=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,qm=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Ym=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Zm=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,$m=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Km=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Jm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,jm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Qm=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,tg=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,eg=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,ng=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,ig=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,sg=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,rg=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,og=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,ag=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lg=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,cg=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,hg=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,ug=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,dg=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,fg=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,pg=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,mg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,gg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,_g=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,xg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,yg=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,vg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Mg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Sg=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,bg=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,wg=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Eg=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Tg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ag=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Cg=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Rg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Pg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Ig=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Lg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ug=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Og=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Dg=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Ng=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Fg=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Bg=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,kg=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,zg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Vg=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Hg=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Gg=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Wg=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Xg=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,qg=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Yg=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Zg=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,$g=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Kg=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Jg=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,jg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Qg=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,t_=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,e_=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,n_=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,i_=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,s_=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,r_=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,o_=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,a_=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,l_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,c_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,h_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,u_=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,d_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,f_=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,p_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,m_=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,g_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,__=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,x_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,y_=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,v_=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,M_=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,S_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,b_=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,w_=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,E_=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,T_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,A_=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,C_=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,R_=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,P_=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,I_=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,L_=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,U_=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,O_=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,D_=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,N_=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,F_=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,B_=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,k_=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,z_=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,V_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,H_=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,G_=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,W_=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,X_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Gt={alphahash_fragment:dm,alphahash_pars_fragment:fm,alphamap_fragment:pm,alphamap_pars_fragment:mm,alphatest_fragment:gm,alphatest_pars_fragment:_m,aomap_fragment:xm,aomap_pars_fragment:ym,batching_pars_vertex:vm,batching_vertex:Mm,begin_vertex:Sm,beginnormal_vertex:bm,bsdfs:wm,iridescence_fragment:Em,bumpmap_pars_fragment:Tm,clipping_planes_fragment:Am,clipping_planes_pars_fragment:Cm,clipping_planes_pars_vertex:Rm,clipping_planes_vertex:Pm,color_fragment:Im,color_pars_fragment:Lm,color_pars_vertex:Um,color_vertex:Om,common:Dm,cube_uv_reflection_fragment:Nm,defaultnormal_vertex:Fm,displacementmap_pars_vertex:Bm,displacementmap_vertex:km,emissivemap_fragment:zm,emissivemap_pars_fragment:Vm,colorspace_fragment:Hm,colorspace_pars_fragment:Gm,envmap_fragment:Wm,envmap_common_pars_fragment:Xm,envmap_pars_fragment:qm,envmap_pars_vertex:Ym,envmap_physical_pars_fragment:sg,envmap_vertex:Zm,fog_vertex:$m,fog_pars_vertex:Km,fog_fragment:Jm,fog_pars_fragment:jm,gradientmap_pars_fragment:Qm,lightmap_pars_fragment:tg,lights_lambert_fragment:eg,lights_lambert_pars_fragment:ng,lights_pars_begin:ig,lights_toon_fragment:rg,lights_toon_pars_fragment:og,lights_phong_fragment:ag,lights_phong_pars_fragment:lg,lights_physical_fragment:cg,lights_physical_pars_fragment:hg,lights_fragment_begin:ug,lights_fragment_maps:dg,lights_fragment_end:fg,lightprobes_pars_fragment:pg,logdepthbuf_fragment:mg,logdepthbuf_pars_fragment:gg,logdepthbuf_pars_vertex:_g,logdepthbuf_vertex:xg,map_fragment:yg,map_pars_fragment:vg,map_particle_fragment:Mg,map_particle_pars_fragment:Sg,metalnessmap_fragment:bg,metalnessmap_pars_fragment:wg,morphinstance_vertex:Eg,morphcolor_vertex:Tg,morphnormal_vertex:Ag,morphtarget_pars_vertex:Cg,morphtarget_vertex:Rg,normal_fragment_begin:Pg,normal_fragment_maps:Ig,normal_pars_fragment:Lg,normal_pars_vertex:Ug,normal_vertex:Og,normalmap_pars_fragment:Dg,clearcoat_normal_fragment_begin:Ng,clearcoat_normal_fragment_maps:Fg,clearcoat_pars_fragment:Bg,iridescence_pars_fragment:kg,opaque_fragment:zg,packing:Vg,premultiplied_alpha_fragment:Hg,project_vertex:Gg,dithering_fragment:Wg,dithering_pars_fragment:Xg,roughnessmap_fragment:qg,roughnessmap_pars_fragment:Yg,shadowmap_pars_fragment:Zg,shadowmap_pars_vertex:$g,shadowmap_vertex:Kg,shadowmask_pars_fragment:Jg,skinbase_vertex:jg,skinning_pars_vertex:Qg,skinning_vertex:t_,skinnormal_vertex:e_,specularmap_fragment:n_,specularmap_pars_fragment:i_,tonemapping_fragment:s_,tonemapping_pars_fragment:r_,transmission_fragment:o_,transmission_pars_fragment:a_,uv_pars_fragment:l_,uv_pars_vertex:c_,uv_vertex:h_,worldpos_vertex:u_,background_vert:d_,background_frag:f_,backgroundCube_vert:p_,backgroundCube_frag:m_,cube_vert:g_,cube_frag:__,depth_vert:x_,depth_frag:y_,distance_vert:v_,distance_frag:M_,equirect_vert:S_,equirect_frag:b_,linedashed_vert:w_,linedashed_frag:E_,meshbasic_vert:T_,meshbasic_frag:A_,meshlambert_vert:C_,meshlambert_frag:R_,meshmatcap_vert:P_,meshmatcap_frag:I_,meshnormal_vert:L_,meshnormal_frag:U_,meshphong_vert:O_,meshphong_frag:D_,meshphysical_vert:N_,meshphysical_frag:F_,meshtoon_vert:B_,meshtoon_frag:k_,points_vert:z_,points_frag:V_,shadow_vert:H_,shadow_frag:G_,sprite_vert:W_,sprite_frag:X_},gt={common:{diffuse:{value:new Ut(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ft},alphaMap:{value:null},alphaMapTransform:{value:new Ft},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ft}},envmap:{envMap:{value:null},envMapRotation:{value:new Ft},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ft}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ft}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ft},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ft},normalScale:{value:new Ht(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ft},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ft}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ft}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ft}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ut(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new k},probesMax:{value:new k},probesResolution:{value:new k}},points:{diffuse:{value:new Ut(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ft},alphaTest:{value:0},uvTransform:{value:new Ft}},sprite:{diffuse:{value:new Ut(16777215)},opacity:{value:1},center:{value:new Ht(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ft},alphaMap:{value:null},alphaMapTransform:{value:new Ft},alphaTest:{value:0}}},Un={basic:{uniforms:Ve([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.fog]),vertexShader:Gt.meshbasic_vert,fragmentShader:Gt.meshbasic_frag},lambert:{uniforms:Ve([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)},envMapIntensity:{value:1}}]),vertexShader:Gt.meshlambert_vert,fragmentShader:Gt.meshlambert_frag},phong:{uniforms:Ve([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)},specular:{value:new Ut(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Gt.meshphong_vert,fragmentShader:Gt.meshphong_frag},standard:{uniforms:Ve([gt.common,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.roughnessmap,gt.metalnessmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag},toon:{uniforms:Ve([gt.common,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.gradientmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)}}]),vertexShader:Gt.meshtoon_vert,fragmentShader:Gt.meshtoon_frag},matcap:{uniforms:Ve([gt.common,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,{matcap:{value:null}}]),vertexShader:Gt.meshmatcap_vert,fragmentShader:Gt.meshmatcap_frag},points:{uniforms:Ve([gt.points,gt.fog]),vertexShader:Gt.points_vert,fragmentShader:Gt.points_frag},dashed:{uniforms:Ve([gt.common,gt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Gt.linedashed_vert,fragmentShader:Gt.linedashed_frag},depth:{uniforms:Ve([gt.common,gt.displacementmap]),vertexShader:Gt.depth_vert,fragmentShader:Gt.depth_frag},normal:{uniforms:Ve([gt.common,gt.bumpmap,gt.normalmap,gt.displacementmap,{opacity:{value:1}}]),vertexShader:Gt.meshnormal_vert,fragmentShader:Gt.meshnormal_frag},sprite:{uniforms:Ve([gt.sprite,gt.fog]),vertexShader:Gt.sprite_vert,fragmentShader:Gt.sprite_frag},background:{uniforms:{uvTransform:{value:new Ft},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Gt.background_vert,fragmentShader:Gt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ft}},vertexShader:Gt.backgroundCube_vert,fragmentShader:Gt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Gt.cube_vert,fragmentShader:Gt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Gt.equirect_vert,fragmentShader:Gt.equirect_frag},distance:{uniforms:Ve([gt.common,gt.displacementmap,{referencePosition:{value:new k},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Gt.distance_vert,fragmentShader:Gt.distance_frag},shadow:{uniforms:Ve([gt.lights,gt.fog,{color:{value:new Ut(0)},opacity:{value:1}}]),vertexShader:Gt.shadow_vert,fragmentShader:Gt.shadow_frag}};Un.physical={uniforms:Ve([Un.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ft},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ft},clearcoatNormalScale:{value:new Ht(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ft},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ft},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ft},sheen:{value:0},sheenColor:{value:new Ut(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ft},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ft},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ft},transmissionSamplerSize:{value:new Ht},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ft},attenuationDistance:{value:0},attenuationColor:{value:new Ut(0)},specularColor:{value:new Ut(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ft},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ft},anisotropyVector:{value:new Ht},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ft}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag};var Za={r:0,b:0,g:0},q_=new ne,Dd=new Ft;Dd.set(-1,0,0,0,1,0,0,0,1);function Y_(i,t,e,n,s,r){let o=new Ut(0),a=s===!0?0:1,l,c,h=null,f=0,u=null;function p(M){let E=M.isScene===!0?M.background:null;if(E&&E.isTexture){let v=M.backgroundBlurriness>0;E=t.get(E,v)}return E}function g(M){let E=!1,v=p(M);v===null?m(o,a):v&&v.isColor&&(m(v,1),E=!0);let b=i.xr.getEnvironmentBlendMode();b==="additive"?e.buffers.color.setClear(0,0,0,1,r):b==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||E)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function _(M,E){let v=p(E);v&&(v.isCubeTexture||v.mapping===Cr)?(c===void 0&&(c=new ze(new Rn(1,1,1),new We({name:"BackgroundCubeMaterial",uniforms:zi(Un.backgroundCube.uniforms),vertexShader:Un.backgroundCube.vertexShader,fragmentShader:Un.backgroundCube.fragmentShader,side:Xe,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(b,S,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(q_.makeRotationFromEuler(E.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Dd),c.material.toneMapped=Zt.getTransfer(v.colorSpace)!==ee,(h!==v||f!==v.version||u!==i.toneMapping)&&(c.material.needsUpdate=!0,h=v,f=v.version,u=i.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new ze(new Ni(2,2),new We({name:"BackgroundMaterial",uniforms:zi(Un.background.uniforms),vertexShader:Un.background.vertexShader,fragmentShader:Un.background.fragmentShader,side:fi,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,l.material.toneMapped=Zt.getTransfer(v.colorSpace)!==ee,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(h!==v||f!==v.version||u!==i.toneMapping)&&(l.material.needsUpdate=!0,h=v,f=v.version,u=i.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function m(M,E){M.getRGB(Za,Rc(i)),e.buffers.color.setClear(Za.r,Za.g,Za.b,E,r)}function d(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,E=1){o.set(M),a=E,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(M){a=M,m(o,a)},render:g,addToRenderList:_,dispose:d}}function Z_(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=u(null),r=s,o=!1;function a(I,L,N,P,O){let U=!1,V=f(I,P,N,L);r!==V&&(r=V,c(r.object)),U=p(I,P,N,O),U&&g(I,P,N,O),O!==null&&t.update(O,i.ELEMENT_ARRAY_BUFFER),(U||o)&&(o=!1,v(I,L,N,P),O!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(O).buffer))}function l(){return i.createVertexArray()}function c(I){return i.bindVertexArray(I)}function h(I){return i.deleteVertexArray(I)}function f(I,L,N,P){let O=P.wireframe===!0,U=n[L.id];U===void 0&&(U={},n[L.id]=U);let V=I.isInstancedMesh===!0?I.id:0,J=U[V];J===void 0&&(J={},U[V]=J);let Z=J[N.id];Z===void 0&&(Z={},J[N.id]=Z);let tt=Z[O];return tt===void 0&&(tt=u(l()),Z[O]=tt),tt}function u(I){let L=[],N=[],P=[];for(let O=0;O<e;O++)L[O]=0,N[O]=0,P[O]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:N,attributeDivisors:P,object:I,attributes:{},index:null}}function p(I,L,N,P){let O=r.attributes,U=L.attributes,V=0,J=N.getAttributes();for(let Z in J)if(J[Z].location>=0){let it=O[Z],W=U[Z];if(W===void 0&&(Z==="instanceMatrix"&&I.instanceMatrix&&(W=I.instanceMatrix),Z==="instanceColor"&&I.instanceColor&&(W=I.instanceColor)),it===void 0||it.attribute!==W||W&&it.data!==W.data)return!0;V++}return r.attributesNum!==V||r.index!==P}function g(I,L,N,P){let O={},U=L.attributes,V=0,J=N.getAttributes();for(let Z in J)if(J[Z].location>=0){let it=U[Z];it===void 0&&(Z==="instanceMatrix"&&I.instanceMatrix&&(it=I.instanceMatrix),Z==="instanceColor"&&I.instanceColor&&(it=I.instanceColor));let W={};W.attribute=it,it&&it.data&&(W.data=it.data),O[Z]=W,V++}r.attributes=O,r.attributesNum=V,r.index=P}function _(){let I=r.newAttributes;for(let L=0,N=I.length;L<N;L++)I[L]=0}function m(I){d(I,0)}function d(I,L){let N=r.newAttributes,P=r.enabledAttributes,O=r.attributeDivisors;N[I]=1,P[I]===0&&(i.enableVertexAttribArray(I),P[I]=1),O[I]!==L&&(i.vertexAttribDivisor(I,L),O[I]=L)}function M(){let I=r.newAttributes,L=r.enabledAttributes;for(let N=0,P=L.length;N<P;N++)L[N]!==I[N]&&(i.disableVertexAttribArray(N),L[N]=0)}function E(I,L,N,P,O,U,V){V===!0?i.vertexAttribIPointer(I,L,N,O,U):i.vertexAttribPointer(I,L,N,P,O,U)}function v(I,L,N,P){_();let O=P.attributes,U=N.getAttributes(),V=L.defaultAttributeValues;for(let J in U){let Z=U[J];if(Z.location>=0){let tt=O[J];if(tt===void 0&&(J==="instanceMatrix"&&I.instanceMatrix&&(tt=I.instanceMatrix),J==="instanceColor"&&I.instanceColor&&(tt=I.instanceColor)),tt!==void 0){let it=tt.normalized,W=tt.itemSize,st=t.get(tt);if(st===void 0)continue;let ct=st.buffer,lt=st.type,bt=st.bytesPerElement,X=lt===i.INT||lt===i.UNSIGNED_INT||tt.gpuType===la;if(tt.isInterleavedBufferAttribute){let K=tt.data,ot=K.stride,wt=tt.offset;if(K.isInstancedInterleavedBuffer){for(let _t=0;_t<Z.locationSize;_t++)d(Z.location+_t,K.meshPerAttribute);I.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=K.meshPerAttribute*K.count)}else for(let _t=0;_t<Z.locationSize;_t++)m(Z.location+_t);i.bindBuffer(i.ARRAY_BUFFER,ct);for(let _t=0;_t<Z.locationSize;_t++)E(Z.location+_t,W/Z.locationSize,lt,it,ot*bt,(wt+W/Z.locationSize*_t)*bt,X)}else{if(tt.isInstancedBufferAttribute){for(let K=0;K<Z.locationSize;K++)d(Z.location+K,tt.meshPerAttribute);I.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=tt.meshPerAttribute*tt.count)}else for(let K=0;K<Z.locationSize;K++)m(Z.location+K);i.bindBuffer(i.ARRAY_BUFFER,ct);for(let K=0;K<Z.locationSize;K++)E(Z.location+K,W/Z.locationSize,lt,it,W*bt,W/Z.locationSize*K*bt,X)}}else if(V!==void 0){let it=V[J];if(it!==void 0)switch(it.length){case 2:i.vertexAttrib2fv(Z.location,it);break;case 3:i.vertexAttrib3fv(Z.location,it);break;case 4:i.vertexAttrib4fv(Z.location,it);break;default:i.vertexAttrib1fv(Z.location,it)}}}}M()}function b(){T();for(let I in n){let L=n[I];for(let N in L){let P=L[N];for(let O in P){let U=P[O];for(let V in U)h(U[V].object),delete U[V];delete P[O]}}delete n[I]}}function S(I){if(n[I.id]===void 0)return;let L=n[I.id];for(let N in L){let P=L[N];for(let O in P){let U=P[O];for(let V in U)h(U[V].object),delete U[V];delete P[O]}}delete n[I.id]}function A(I){for(let L in n){let N=n[L];for(let P in N){let O=N[P];if(O[I.id]===void 0)continue;let U=O[I.id];for(let V in U)h(U[V].object),delete U[V];delete O[I.id]}}}function y(I){for(let L in n){let N=n[L],P=I.isInstancedMesh===!0?I.id:0,O=N[P];if(O!==void 0){for(let U in O){let V=O[U];for(let J in V)h(V[J].object),delete V[J];delete O[U]}delete N[P],Object.keys(N).length===0&&delete n[L]}}}function T(){C(),o=!0,r!==s&&(r=s,c(r.object))}function C(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:T,resetDefaultState:C,dispose:b,releaseStatesOfGeometry:S,releaseStatesOfObject:y,releaseStatesOfProgram:A,initAttributes:_,enableAttribute:m,disableUnusedAttributes:M}}function $_(i,t,e){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),e.update(c,n,1)}function o(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),e.update(c,n,h))}function a(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let u=0;for(let p=0;p<h;p++)u+=c[p];e.update(u,n,1)}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function K_(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let A=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(A.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(A){return!(A!==hn&&n.convert(A)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(A){let y=A===Mn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(A!==$e&&A!==cn&&!y&&n.convert(A)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(A){if(A==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";A="mediump"}return A==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(Lt("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let f=e.logarithmicDepthBuffer===!0,u=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&u===!1&&Lt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),d=i.getParameter(i.MAX_VERTEX_ATTRIBS),M=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),E=i.getParameter(i.MAX_VARYING_VECTORS),v=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),b=i.getParameter(i.MAX_SAMPLES),S=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:u,maxTextures:p,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:d,maxVertexUniforms:M,maxVaryings:E,maxFragmentUniforms:v,maxSamples:b,samples:S}}function J_(i){let t=this,e=null,n=0,s=!1,r=!1,o=new mn,a=new Ft,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,u){let p=f.length!==0||u||n!==0||s;return s=u,n=f.length,p},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,u){e=h(f,u,0)},this.setState=function(f,u,p){let g=f.clippingPlanes,_=f.clipIntersection,m=f.clipShadows,d=i.get(f);if(!s||g===null||g.length===0||r&&!m)r?h(null):c();else{let M=r?0:n,E=M*4,v=d.clippingState||null;l.value=v,v=h(g,u,E,p);for(let b=0;b!==E;++b)v[b]=e[b];d.clippingState=v,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(f,u,p,g){let _=f!==null?f.length:0,m=null;if(_!==0){if(m=l.value,g!==!0||m===null){let d=p+_*4,M=u.matrixWorldInverse;a.getNormalMatrix(M),(m===null||m.length<d)&&(m=new Float32Array(d));for(let E=0,v=p;E!==_;++E,v+=4)o.copy(f[E]).applyMatrix4(M,a),o.normal.toArray(m,v),m[v+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}var Ps=4,j_=6,Q_=20,t0=256,Nr=new di,fd=new Ut,Uc=null,Oc=0,Dc=0,Nc=!1,e0=new k,Vi=new k,Ka=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:o=256,position:a=e0}=r;Uc=this._renderer.getRenderTarget(),Oc=this._renderer.getActiveCubeFace(),Dc=this._renderer.getActiveMipmapLevel(),Nc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,n,s,l,a),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=gd(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=md(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(Uc,Oc,Dc),this._renderer.xr.enabled=Nc,t.scissorTest=!1,Rs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===pi||t.mapping===ki?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Uc=this._renderer.getRenderTarget(),Oc=this._renderer.getActiveCubeFace(),Dc=this._renderer.getActiveMipmapLevel(),Nc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Le,minFilter:Le,generateMipmaps:!1,type:Mn,format:hn,colorSpace:lr,depthBuffer:!1},s=pd(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=pd(t,e,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=n0(r)),this._blurMaterial=s0(r,t,e),this._ggxMaterial=i0(r,t,e)}return s}_compileMaterial(t){let e=new ze(new Ie,t);this._renderer.compile(e,Nr)}_sceneToCubeUV(t,e,n,s,r){let l=new Ye(90,1,e,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],f=this._renderer,u=f.autoClear,p=f.toneMapping;f.getClearColor(fd),f.toneMapping=yn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(s),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ze(new Rn,new Oi({name:"PMREM.Background",side:Xe,depthWrite:!1,depthTest:!1})));let _=this._backgroundBox,m=_.material,d=!1,M=t.background;M?M.isColor&&(m.color.copy(M),t.background=null,d=!0):(m.color.copy(fd),d=!0);for(let E=0;E<6;E++){let v=E%3;v===0?(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[E],r.y,r.z)):v===1?(l.up.set(0,0,c[E]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[E],r.z)):(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[E]));let b=this._cubeSize;Rs(s,v*b,E>2?b:0,b,b),f.setRenderTarget(s),d&&f.render(_,l),f.render(t,l)}f.toneMapping=p,f.autoClear=u,t.background=M}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===pi||t.mapping===ki;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=gd()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=md());let r=s?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=t;let l=this._cubeSize;Rs(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(o,Nr)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=n}_applyGGXFilter(t,e,n){let s=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[n];a.material=o;let l=o.uniforms,c=n/(this._lodMeshes.length-1),h=e/(this._lodMeshes.length-1),f=Math.sqrt(c*c-h*h),u=c*1.25,p=f*u,{_lodMax:g}=this,_=this._sizeLods[n],m=3*_*(n>g-Ps?n-g+Ps:0),d=4*(this._cubeSize-_);l.envMap.value=t.texture,l.roughness.value=p,l.mipInt.value=g-e,Rs(r,m,d,3*_,2*_),s.setRenderTarget(r),s.render(a,Nr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-n,Rs(t,m,d,3*_,2*_),s.setRenderTarget(t),s.render(a,Nr)}_blur(t,e,n,s){let r=this._pingPongRenderTarget,o=Math.min(s,Math.PI)/Math.SQRT2;this._blurPass(t,r,e,n,o),this._blurPass(r,t,n,n,o)}_blurPass(t,e,n,s,r){let o=this._renderer,a=this._blurMaterial,l=this._lodMeshes[s];l.material=a;let c=a.uniforms;c.envMap.value=t.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-n;let h=this._sizeLods[s],f=3*h*(s>this._lodMax-Ps?s-this._lodMax+Ps:0),u=4*(this._cubeSize-h);Rs(e,f,u,3*h,2*h),o.setRenderTarget(e),o.render(l,Nr)}};function n0(i){let t=[],e=[],n=i,s=i-Ps+1+j_;for(let r=0;r<s;r++){let o=Math.pow(2,n);t.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,u=6,p=3,g=new Float32Array(p*u*f),_=new Float32Array(p*u*f);for(let d=0;d<f;d++){let M=d%3*2/3-1,E=d>2?0:-1,v=[M,E,0,M+2/3,E,0,M+2/3,E+1,0,M,E,0,M+2/3,E+1,0,M,E+1,0];g.set(v,p*u*d);for(let b=0;b<u;b++){let S=h[b*2]*2-1,A=h[b*2+1]*2-1;d===0?Vi.set(1,A,S):d===1?Vi.set(-S,1,-A):d===2?Vi.set(-S,A,1):d===3?Vi.set(-1,A,-S):d===4?Vi.set(-S,-1,A):Vi.set(S,A,-1),Vi.toArray(_,(d*u+b)*p)}}let m=new Ie;m.setAttribute("position",new we(g,p)),m.setAttribute("outputDirection",new we(_,p)),e.push(new ze(m,null)),n>Ps&&n--}return{lodMeshes:e,sizeLods:t}}function pd(i,t,e){let n=new Ze(i,t,e);return n.texture.mapping=Cr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Rs(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function i0(i,t,e){return new We({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:t0,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:ja(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function s0(i,t,e){return new We({name:"SphericalGaussianBlur",defines:{SAMPLES:Q_,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:ja(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function md(){return new We({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:ja(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function gd(){return new We({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:ja(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function ja(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Ja=class extends Ze{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new _r(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new Rn(5,5,5),r=new We({name:"CubemapFromEquirect",uniforms:zi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Xe,blending:In});r.uniforms.tEquirect.value=e;let o=new ze(s,r),a=e.minFilter;return e.minFilter===mi&&(e.minFilter=Le),new ia(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}};function r0(i){let t=new WeakMap,e=new WeakMap,n=null;function s(u,p=!1){return u==null?null:p?o(u):r(u)}function r(u){if(u&&u.isTexture){let p=u.mapping;if(p===ra||p===oa)if(t.has(u)){let g=t.get(u).texture;return a(g,u.mapping)}else{let g=u.image;if(g&&g.height>0){let _=new Ja(g.height);return _.fromEquirectangularTexture(i,u),t.set(u,_),u.addEventListener("dispose",c),a(_.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let p=u.mapping,g=p===ra||p===oa,_=p===pi||p===ki;if(g||_){let m=e.get(u),d=m!==void 0?m.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==d)return n===null&&(n=new Ka(i)),m=g?n.fromEquirectangular(u,m):n.fromCubemap(u,m),m.texture.pmremVersion=u.pmremVersion,e.set(u,m),m.texture;if(m!==void 0)return m.texture;{let M=u.image;return g&&M&&M.height>0||_&&M&&l(M)?(n===null&&(n=new Ka(i)),m=g?n.fromEquirectangular(u):n.fromCubemap(u),m.texture.pmremVersion=u.pmremVersion,e.set(u,m),u.addEventListener("dispose",h),m.texture):null}}}return u}function a(u,p){return p===ra?u.mapping=pi:p===oa&&(u.mapping=ki),u}function l(u){let p=0,g=6;for(let _=0;_<g;_++)u[_]!==void 0&&p++;return p===g}function c(u){let p=u.target;p.removeEventListener("dispose",c);let g=t.get(p);g!==void 0&&(t.delete(p),g.dispose())}function h(u){let p=u.target;p.removeEventListener("dispose",h);let g=e.get(p);g!==void 0&&(e.delete(p),g.dispose())}function f(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:f}}function o0(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&Ui("WebGLRenderer: "+n+" extension not supported."),s}}}function a0(i,t,e,n){let s={},r=new WeakMap;function o(f){let u=f.target;u.index!==null&&t.remove(u.index);for(let g in u.attributes)t.remove(u.attributes[g]);u.removeEventListener("dispose",o),delete s[u.id];let p=r.get(u);p&&(t.remove(p),r.delete(u)),n.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,e.memory.geometries--}function a(f,u){return s[u.id]===!0||(u.addEventListener("dispose",o),s[u.id]=!0,e.memory.geometries++),u}function l(f){let u=f.attributes;for(let p in u)t.update(u[p],i.ARRAY_BUFFER)}function c(f){let u=[],p=f.index,g=f.attributes.position,_=0;if(g===void 0)return;if(p!==null){let M=p.array;_=p.version;for(let E=0,v=M.length;E<v;E+=3){let b=M[E+0],S=M[E+1],A=M[E+2];u.push(b,S,S,A,A,b)}}else{let M=g.array;_=g.version;for(let E=0,v=M.length/3-1;E<v;E+=3){let b=E+0,S=E+1,A=E+2;u.push(b,S,S,A,A,b)}}let m=new(g.count>=65535?pr:fr)(u,1);m.version=_;let d=r.get(f);d&&t.remove(d),r.set(f,m)}function h(f){let u=r.get(f);if(u){let p=f.index;p!==null&&u.version<p.version&&c(f)}else c(f);return r.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function l0(i,t,e){let n;function s(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,u){i.drawElements(n,u,r,f*o),e.update(u,n,1)}function c(f,u,p){p!==0&&(i.drawElementsInstanced(n,u,r,f*o,p),e.update(u,n,p))}function h(f,u,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,r,f,0,p);let _=0;for(let m=0;m<p;m++)_+=u[m];e.update(_,n,1)}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function c0(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:Dt("WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function h0(i,t,e){let n=new WeakMap,s=new he;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,u=n.get(a);if(u===void 0||u.count!==f){let T=function(){A.dispose(),n.delete(a),a.removeEventListener("dispose",T)};u!==void 0&&u.texture.dispose();let p=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],d=a.morphAttributes.normal||[],M=a.morphAttributes.color||[],E=0;p===!0&&(E=1),g===!0&&(E=2),_===!0&&(E=3);let v=a.attributes.position.count*E,b=1;v>t.maxTextureSize&&(b=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize);let S=new Float32Array(v*b*4*f),A=new ur(S,v,b,f);A.type=cn,A.needsUpdate=!0;let y=E*4;for(let C=0;C<f;C++){let I=m[C],L=d[C],N=M[C],P=v*b*4*C;for(let O=0;O<I.count;O++){let U=O*y;p===!0&&(s.fromBufferAttribute(I,O),S[P+U+0]=s.x,S[P+U+1]=s.y,S[P+U+2]=s.z,S[P+U+3]=0),g===!0&&(s.fromBufferAttribute(L,O),S[P+U+4]=s.x,S[P+U+5]=s.y,S[P+U+6]=s.z,S[P+U+7]=0),_===!0&&(s.fromBufferAttribute(N,O),S[P+U+8]=s.x,S[P+U+9]=s.y,S[P+U+10]=s.z,S[P+U+11]=N.itemSize===4?s.w:1)}}u={count:f,texture:A,size:new Ht(v,b)},n.set(a,u),a.addEventListener("dispose",T)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let p=0;for(let _=0;_<c.length;_++)p+=c[_];let g=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",u.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",u.size)}return{update:r}}function u0(i,t,e,n,s){let r=new WeakMap;function o(c){let h=s.render.frame,f=c.geometry,u=t.get(c,f);if(r.get(u)!==h&&(t.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let p=c.skeleton;r.get(p)!==h&&(p.update(),r.set(p,h))}return u}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:o,dispose:a}}var d0={[dc]:"LINEAR_TONE_MAPPING",[fc]:"REINHARD_TONE_MAPPING",[pc]:"CINEON_TONE_MAPPING",[mc]:"ACES_FILMIC_TONE_MAPPING",[_c]:"AGX_TONE_MAPPING",[xc]:"NEUTRAL_TONE_MAPPING",[gc]:"CUSTOM_TONE_MAPPING"};function f0(i,t,e,n,s,r){let o=new Ze(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new Ie;c.setAttribute("position",new _e([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new _e([0,2,0,0,2,0],2));let h=new Go({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),f=new ze(c,h),u=new di(-1,1,1,-1,0,1),p=null,g=null,_=!1,m,d=null,M=[],E=!1;this.setSize=function(v,b){o.setSize(v,b),a!==null&&a.setSize(v,b),l!==null&&l.setSize(v,b);for(let S=0;S<M.length;S++){let A=M[S];A.setSize&&A.setSize(v,b)}},this.setEffects=function(v){M=v,E=M.length>0&&M[0].isRenderPass===!0;let b=o.width,S=o.height;M.length>0&&a===null&&(a=new Ze(b,S,{type:Mn,depthBuffer:!1,stencilBuffer:!1}),l=new Ze(b,S,{type:Mn,depthBuffer:!1,stencilBuffer:!1}));for(let A=0;A<M.length;A++){let y=M[A];y.setSize&&y.setSize(b,S)}},this.begin=function(v,b){if(_||v.toneMapping===yn&&M.length===0)return!1;if(d=b,b!==null){let S=b.width,A=b.height;(o.width!==S||o.height!==A)&&this.setSize(S,A)}return E===!1&&v.setRenderTarget(o),m=v.toneMapping,v.toneMapping=yn,!0},this.hasRenderPass=function(){return E},this.end=function(v,b){v.toneMapping=m,_=!0;let S=o,A=a;for(let y=0;y<M.length;y++){let T=M[y];T.enabled!==!1&&(T.render(v,A,S,b),T.needsSwap!==!1&&(S=A,A=A===a?l:a))}if(p!==v.outputColorSpace||g!==v.toneMapping){p=v.outputColorSpace,g=v.toneMapping,h.defines={},Zt.getTransfer(p)===ee&&(h.defines.SRGB_TRANSFER="");let y=d0[g];y&&(h.defines[y]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=S.texture,v.setRenderTarget(d),v.render(f,u),d=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),c.dispose(),h.dispose()}}var Nd=new ke,kc=new oi(1,1),Fd=new ur,Bd=new Bo,kd=new _r,_d=[],xd=[],yd=new Float32Array(16),vd=new Float32Array(9),Md=new Float32Array(4);function Ls(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=_d[s];if(r===void 0&&(r=new Float32Array(s),_d[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function Te(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Ae(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function Qa(i,t){let e=xd[t];e===void 0&&(e=new Int32Array(t),xd[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function p0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function m0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2fv(this.addr,t),Ae(e,t)}}function g0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Te(e,t))return;i.uniform3fv(this.addr,t),Ae(e,t)}}function _0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4fv(this.addr,t),Ae(e,t)}}function x0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;Md.set(n),i.uniformMatrix2fv(this.addr,!1,Md),Ae(e,n)}}function y0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;vd.set(n),i.uniformMatrix3fv(this.addr,!1,vd),Ae(e,n)}}function v0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;yd.set(n),i.uniformMatrix4fv(this.addr,!1,yd),Ae(e,n)}}function M0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function S0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2iv(this.addr,t),Ae(e,t)}}function b0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3iv(this.addr,t),Ae(e,t)}}function w0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4iv(this.addr,t),Ae(e,t)}}function E0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function T0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2uiv(this.addr,t),Ae(e,t)}}function A0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3uiv(this.addr,t),Ae(e,t)}}function C0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4uiv(this.addr,t),Ae(e,t)}}function R0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(kc.compareFunction=e.isReversedDepthBuffer()?Ya:qa,r=kc):r=Nd,e.setTexture2D(t||r,s)}function P0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Bd,s)}function I0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||kd,s)}function L0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Fd,s)}function U0(i){switch(i){case 5126:return p0;case 35664:return m0;case 35665:return g0;case 35666:return _0;case 35674:return x0;case 35675:return y0;case 35676:return v0;case 5124:case 35670:return M0;case 35667:case 35671:return S0;case 35668:case 35672:return b0;case 35669:case 35673:return w0;case 5125:return E0;case 36294:return T0;case 36295:return A0;case 36296:return C0;case 35678:case 36198:case 36298:case 36306:case 35682:return R0;case 35679:case 36299:case 36307:return P0;case 35680:case 36300:case 36308:case 36293:return I0;case 36289:case 36303:case 36311:case 36292:return L0}}function O0(i,t){i.uniform1fv(this.addr,t)}function D0(i,t){let e=Ls(t,this.size,2);i.uniform2fv(this.addr,e)}function N0(i,t){let e=Ls(t,this.size,3);i.uniform3fv(this.addr,e)}function F0(i,t){let e=Ls(t,this.size,4);i.uniform4fv(this.addr,e)}function B0(i,t){let e=Ls(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function k0(i,t){let e=Ls(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function z0(i,t){let e=Ls(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function V0(i,t){i.uniform1iv(this.addr,t)}function H0(i,t){i.uniform2iv(this.addr,t)}function G0(i,t){i.uniform3iv(this.addr,t)}function W0(i,t){i.uniform4iv(this.addr,t)}function X0(i,t){i.uniform1uiv(this.addr,t)}function q0(i,t){i.uniform2uiv(this.addr,t)}function Y0(i,t){i.uniform3uiv(this.addr,t)}function Z0(i,t){i.uniform4uiv(this.addr,t)}function $0(i,t,e){let n=this.cache,s=t.length,r=Qa(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));let o;this.type===i.SAMPLER_2D_SHADOW?o=kc:o=Nd;for(let a=0;a!==s;++a)e.setTexture2D(t[a]||o,r[a])}function K0(i,t,e){let n=this.cache,s=t.length,r=Qa(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||Bd,r[o])}function J0(i,t,e){let n=this.cache,s=t.length,r=Qa(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||kd,r[o])}function j0(i,t,e){let n=this.cache,s=t.length,r=Qa(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||Fd,r[o])}function Q0(i){switch(i){case 5126:return O0;case 35664:return D0;case 35665:return N0;case 35666:return F0;case 35674:return B0;case 35675:return k0;case 35676:return z0;case 5124:case 35670:return V0;case 35667:case 35671:return H0;case 35668:case 35672:return G0;case 35669:case 35673:return W0;case 5125:return X0;case 36294:return q0;case 36295:return Y0;case 36296:return Z0;case 35678:case 36198:case 36298:case 36306:case 35682:return $0;case 35679:case 36299:case 36307:return K0;case 35680:case 36300:case 36308:case 36293:return J0;case 36289:case 36303:case 36311:case 36292:return j0}}var zc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=U0(e.type)}},Vc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Q0(e.type)}},Hc=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,o=s.length;r!==o;++r){let a=s[r];a.setValue(t,e[a.id],n)}}},Fc=/(\w+)(\])?(\[|\.)?/g;function Sd(i,t){i.seq.push(t),i.map[t.id]=t}function tx(i,t,e){let n=i.name,s=n.length;for(Fc.lastIndex=0;;){let r=Fc.exec(n),o=Fc.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){Sd(e,c===void 0?new zc(a,i,t):new Vc(a,i,t));break}else{let f=e.map[a];f===void 0&&(f=new Hc(a),Sd(e,f)),e=f}}}var Is=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=t.getActiveUniform(e,o),l=t.getUniformLocation(e,a.name);tx(a,l,this)}let s=[],r=[];for(let o of this.seq)o.type===t.SAMPLER_2D_SHADOW||o.type===t.SAMPLER_CUBE_SHADOW||o.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(o):r.push(o);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){let a=e[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let o=t[s];o.id in e&&n.push(o)}return n}};function bd(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var ex=37297,nx=0;function ix(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){let a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}var wd=new Ft;function sx(i){Zt._getMatrix(wd,Zt.workingColorSpace,i);let t=`mat3( ${wd.elements.map(e=>e.toFixed(4))} )`;switch(Zt.getTransfer(i)){case cr:return[t,"LinearTransferOETF"];case ee:return[t,"sRGBTransferOETF"];default:return Lt("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Ed(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return e.toUpperCase()+`

`+r+`

`+ix(i.getShaderSource(t),a)}else return r}function rx(i,t){let e=sx(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var ox={[dc]:"Linear",[fc]:"Reinhard",[pc]:"Cineon",[mc]:"ACESFilmic",[_c]:"AgX",[xc]:"Neutral",[gc]:"Custom"};function ax(i,t){let e=ox[t];return e===void 0?(Lt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var $a=new k;function lx(){Zt.getLuminanceCoefficients($a);let i=$a.x.toFixed(4),t=$a.y.toFixed(4),e=$a.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function cx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Br).join(`
`)}function hx(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function ux(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),o=r.name,a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function Br(i){return i!==""}function Td(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Ad(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var dx=/^[ \t]*#include +<([\w\d./]+)>/gm;function Gc(i){return i.replace(dx,px)}var fx=new Map;function px(i,t){let e=Gt[t];if(e===void 0){let n=fx.get(t);if(n!==void 0)e=Gt[n],Lt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return Gc(e)}var mx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Cd(i){return i.replace(mx,gx)}function gx(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Rd(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var _x={[Ar]:"SHADOWMAP_TYPE_PCF",[ws]:"SHADOWMAP_TYPE_VSM"};function xx(i){return _x[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var yx={[pi]:"ENVMAP_TYPE_CUBE",[ki]:"ENVMAP_TYPE_CUBE",[Cr]:"ENVMAP_TYPE_CUBE_UV"};function vx(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":yx[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var Mx={[ki]:"ENVMAP_MODE_REFRACTION"};function Sx(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Mx[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var bx={[uc]:"ENVMAP_BLENDING_MULTIPLY",[qu]:"ENVMAP_BLENDING_MIX",[Yu]:"ENVMAP_BLENDING_ADD"};function wx(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":bx[i.combine]||"ENVMAP_BLENDING_NONE"}function Ex(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Tx(i,t,e,n){let s=i.getContext(),r=e.defines,o=e.vertexShader,a=e.fragmentShader,l=xx(e),c=vx(e),h=Sx(e),f=wx(e),u=Ex(e),p=cx(e),g=hx(r),_=s.createProgram(),m,d,M=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Br).join(`
`),m.length>0&&(m+=`
`),d=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Br).join(`
`),d.length>0&&(d+=`
`)):(m=[Rd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Br).join(`
`),d=[Rd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+f:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.retroreflection?"#define USE_RETROREFLECTION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==yn?"#define TONE_MAPPING":"",e.toneMapping!==yn?Gt.tonemapping_pars_fragment:"",e.toneMapping!==yn?ax("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Gt.colorspace_pars_fragment,rx("linearToOutputTexel",e.outputColorSpace),lx(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Br).join(`
`)),o=Gc(o),o=Td(o,e),o=Ad(o,e),a=Gc(a),a=Td(a,e),a=Ad(a,e),o=Cd(o),a=Cd(a),e.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,d=["#define varying in",e.glslVersion===Tc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Tc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+d);let E=M+m+o,v=M+d+a,b=bd(s,s.VERTEX_SHADER,E),S=bd(s,s.FRAGMENT_SHADER,v);s.attachShader(_,b),s.attachShader(_,S),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function A(I){if(i.debug.checkShaderErrors){let L=s.getProgramInfoLog(_)||"",N=s.getShaderInfoLog(b)||"",P=s.getShaderInfoLog(S)||"",O=L.trim(),U=N.trim(),V=P.trim(),J=!0,Z=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(J=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,b,S);else{let tt=Ed(s,b,"vertex"),it=Ed(s,S,"fragment");Dt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+O+`
`+tt+`
`+it)}else O!==""?Lt("WebGLProgram: Program Info Log:",O):(U===""||V==="")&&(Z=!1);Z&&(I.diagnostics={runnable:J,programLog:O,vertexShader:{log:U,prefix:m},fragmentShader:{log:V,prefix:d}})}s.deleteShader(b),s.deleteShader(S),y=new Is(s,_),T=ux(s,_)}let y;this.getUniforms=function(){return y===void 0&&A(this),y};let T;this.getAttributes=function(){return T===void 0&&A(this),T};let C=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=s.getProgramParameter(_,ex)),C},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=nx++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=b,this.fragmentShader=S,this}var Ax=0,Wc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new Xc(t),e.set(t,n)),n}},Xc=class{constructor(t){this.id=Ax++,this.code=t,this.usedTimes=0}};function Cx(i){return i===_i||i===Or||i===Dr}function Rx(i,t,e,n,s,r){let o=new xs,a=new Wc,l=new Set,c=[],h=new Map,f=n.logarithmicDepthBuffer,u=n.precision,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(y){return l.add(y),y===0?"uv":`uv${y}`}function _(y,T,C,I,L,N){let P=I.fog,O=L.geometry,U=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?I.environment:null,V=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,J=t.get(y.envMap||U,V),Z=J&&J.mapping===Cr?J.image.height:null,tt=p[y.type];y.precision!==null&&(u=n.getMaxPrecision(y.precision),u!==y.precision&&Lt("WebGLProgram.getParameters:",y.precision,"not supported, using",u,"instead."));let it=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,W=it!==void 0?it.length:0,st=0;O.morphAttributes.position!==void 0&&(st=1),O.morphAttributes.normal!==void 0&&(st=2),O.morphAttributes.color!==void 0&&(st=3);let ct,lt,bt,X;if(tt){let le=Un[tt];ct=le.vertexShader,lt=le.fragmentShader}else{ct=y.vertexShader,lt=y.fragmentShader;let le=a.getVertexShaderStage(y),Qt=a.getFragmentShaderStage(y);a.update(y,le,Qt),bt=le.id,X=Qt.id}let K=i.getRenderTarget(),ot=i.state.buffers.depth.getReversed(),wt=L.isInstancedMesh===!0,_t=L.isBatchedMesh===!0,zt=!!y.map,Ee=!!y.matcap,Xt=!!J,Kt=!!y.aoMap,ae=!!y.lightMap,Yt=!!y.bumpMap&&y.wireframe===!1,pe=!!y.normalMap,Ce=!!y.displacementMap,qe=!!y.emissiveMap,ge=!!y.metalnessMap,Me=!!y.roughnessMap,B=y.anisotropy>0,De=y.clearcoat>0,se=y.dispersion>0,R=y.retroreflectivity>0,x=y.iridescence>0,z=y.sheen>0,q=y.transmission>0,j=B&&!!y.anisotropyMap,at=De&&!!y.clearcoatMap,ht=De&&!!y.clearcoatNormalMap,Q=De&&!!y.clearcoatRoughnessMap,nt=x&&!!y.iridescenceMap,ut=x&&!!y.iridescenceThicknessMap,Rt=z&&!!y.sheenColorMap,mt=z&&!!y.sheenRoughnessMap,dt=!!y.specularMap,Pt=!!y.specularColorMap,Ot=!!y.specularIntensityMap,Bt=q&&!!y.transmissionMap,F=q&&!!y.thicknessMap,ft=!!y.gradientMap,et=!!y.alphaMap,pt=y.alphaTest>0,vt=!!y.alphaHash,rt=!!y.extensions,It=yn;y.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(It=i.toneMapping);let At={shaderID:tt,shaderType:y.type,shaderName:y.name,vertexShader:ct,fragmentShader:lt,defines:y.defines,customVertexShaderID:bt,customFragmentShaderID:X,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:u,batching:_t,batchingColor:_t&&L._colorsTexture!==null,instancing:wt,instancingColor:wt&&L.instanceColor!==null,instancingMorph:wt&&L.morphTexture!==null,outputColorSpace:K===null?i.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:Zt.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:zt,matcap:Ee,envMap:Xt,envMapMode:Xt&&J.mapping,envMapCubeUVHeight:Z,aoMap:Kt,lightMap:ae,bumpMap:Yt,normalMap:pe,displacementMap:Ce,emissiveMap:qe,normalMapObjectSpace:pe&&y.normalMapType===Ku,normalMapTangentSpace:pe&&y.normalMapType===Xa,packedNormalMap:pe&&y.normalMapType===Xa&&Cx(y.normalMap.format),metalnessMap:ge,roughnessMap:Me,anisotropy:B,anisotropyMap:j,clearcoat:De,clearcoatMap:at,clearcoatNormalMap:ht,clearcoatRoughnessMap:Q,dispersion:se,retroreflection:R,iridescence:x,iridescenceMap:nt,iridescenceThicknessMap:ut,sheen:z,sheenColorMap:Rt,sheenRoughnessMap:mt,specularMap:dt,specularColorMap:Pt,specularIntensityMap:Ot,transmission:q,transmissionMap:Bt,thicknessMap:F,gradientMap:ft,opaque:y.transparent===!1&&y.blending===Es&&y.alphaToCoverage===!1,alphaMap:et,alphaTest:pt,alphaHash:vt,combine:y.combine,mapUv:zt&&g(y.map.channel),aoMapUv:Kt&&g(y.aoMap.channel),lightMapUv:ae&&g(y.lightMap.channel),bumpMapUv:Yt&&g(y.bumpMap.channel),normalMapUv:pe&&g(y.normalMap.channel),displacementMapUv:Ce&&g(y.displacementMap.channel),emissiveMapUv:qe&&g(y.emissiveMap.channel),metalnessMapUv:ge&&g(y.metalnessMap.channel),roughnessMapUv:Me&&g(y.roughnessMap.channel),anisotropyMapUv:j&&g(y.anisotropyMap.channel),clearcoatMapUv:at&&g(y.clearcoatMap.channel),clearcoatNormalMapUv:ht&&g(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Q&&g(y.clearcoatRoughnessMap.channel),iridescenceMapUv:nt&&g(y.iridescenceMap.channel),iridescenceThicknessMapUv:ut&&g(y.iridescenceThicknessMap.channel),sheenColorMapUv:Rt&&g(y.sheenColorMap.channel),sheenRoughnessMapUv:mt&&g(y.sheenRoughnessMap.channel),specularMapUv:dt&&g(y.specularMap.channel),specularColorMapUv:Pt&&g(y.specularColorMap.channel),specularIntensityMapUv:Ot&&g(y.specularIntensityMap.channel),transmissionMapUv:Bt&&g(y.transmissionMap.channel),thicknessMapUv:F&&g(y.thicknessMap.channel),alphaMapUv:et&&g(y.alphaMap.channel),vertexTangents:!!O.attributes.tangent&&(pe||B),vertexNormals:!!O.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,pointsUvs:L.isPoints===!0&&!!O.attributes.uv&&(zt||et),fog:!!P,useFog:y.fog===!0,fogExp2:!!P&&P.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||O.attributes.normal===void 0&&pe===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:ot,skinning:L.isSkinnedMesh===!0,hasPositionAttribute:O.attributes.position!==void 0,morphTargets:O.morphAttributes.position!==void 0,morphNormals:O.morphAttributes.normal!==void 0,morphColors:O.morphAttributes.color!==void 0,morphTargetsCount:W,morphTextureStride:st,numSunLights:T.sun.length,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numSunLightShadows:T.sunShadowMap.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numLightProbeGrids:N.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:y.dithering,shadowMapEnabled:i.shadowMap.enabled&&C.length>0,shadowMapType:i.shadowMap.type,toneMapping:It,decodeVideoTexture:zt&&y.map.isVideoTexture===!0&&Zt.getTransfer(y.map.colorSpace)===ee,decodeVideoTextureEmissive:qe&&y.emissiveMap.isVideoTexture===!0&&Zt.getTransfer(y.emissiveMap.colorSpace)===ee,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Pn,flipSided:y.side===Xe,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:rt&&y.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(rt&&y.extensions.multiDraw===!0||_t)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return At.vertexUv1s=l.has(1),At.vertexUv2s=l.has(2),At.vertexUv3s=l.has(3),l.clear(),At}function m(y){let T=[];if(y.shaderID?T.push(y.shaderID):(T.push(y.customVertexShaderID),T.push(y.customFragmentShaderID)),y.defines!==void 0)for(let C in y.defines)T.push(C),T.push(y.defines[C]);return y.isRawShaderMaterial===!1&&(d(T,y),M(T,y),T.push(i.outputColorSpace)),T.push(y.customProgramCacheKey),T.join()}function d(y,T){y.push(T.precision),y.push(T.outputColorSpace),y.push(T.envMapMode),y.push(T.envMapCubeUVHeight),y.push(T.mapUv),y.push(T.alphaMapUv),y.push(T.lightMapUv),y.push(T.aoMapUv),y.push(T.bumpMapUv),y.push(T.normalMapUv),y.push(T.displacementMapUv),y.push(T.emissiveMapUv),y.push(T.metalnessMapUv),y.push(T.roughnessMapUv),y.push(T.anisotropyMapUv),y.push(T.clearcoatMapUv),y.push(T.clearcoatNormalMapUv),y.push(T.clearcoatRoughnessMapUv),y.push(T.iridescenceMapUv),y.push(T.iridescenceThicknessMapUv),y.push(T.sheenColorMapUv),y.push(T.sheenRoughnessMapUv),y.push(T.specularMapUv),y.push(T.specularColorMapUv),y.push(T.specularIntensityMapUv),y.push(T.transmissionMapUv),y.push(T.thicknessMapUv),y.push(T.combine),y.push(T.fogExp2),y.push(T.sizeAttenuation),y.push(T.morphTargetsCount),y.push(T.morphAttributeCount),y.push(T.numSunLights),y.push(T.numDirLights),y.push(T.numPointLights),y.push(T.numSpotLights),y.push(T.numSpotLightMaps),y.push(T.numHemiLights),y.push(T.numRectAreaLights),y.push(T.numSunLightShadows),y.push(T.numDirLightShadows),y.push(T.numPointLightShadows),y.push(T.numSpotLightShadows),y.push(T.numSpotLightShadowsWithMaps),y.push(T.numLightProbes),y.push(T.shadowMapType),y.push(T.toneMapping),y.push(T.numClippingPlanes),y.push(T.numClipIntersection),y.push(T.depthPacking)}function M(y,T){o.disableAll(),T.instancing&&o.enable(0),T.instancingColor&&o.enable(1),T.instancingMorph&&o.enable(2),T.matcap&&o.enable(3),T.envMap&&o.enable(4),T.normalMapObjectSpace&&o.enable(5),T.normalMapTangentSpace&&o.enable(6),T.clearcoat&&o.enable(7),T.iridescence&&o.enable(8),T.alphaTest&&o.enable(9),T.vertexColors&&o.enable(10),T.vertexAlphas&&o.enable(11),T.vertexUv1s&&o.enable(12),T.vertexUv2s&&o.enable(13),T.vertexUv3s&&o.enable(14),T.vertexTangents&&o.enable(15),T.anisotropy&&o.enable(16),T.alphaHash&&o.enable(17),T.batching&&o.enable(18),T.dispersion&&o.enable(19),T.retroreflection&&o.enable(24),T.batchingColor&&o.enable(20),T.gradientMap&&o.enable(21),T.packedNormalMap&&o.enable(22),T.vertexNormals&&o.enable(23),y.push(o.mask),o.disableAll(),T.fog&&o.enable(0),T.useFog&&o.enable(1),T.flatShading&&o.enable(2),T.logarithmicDepthBuffer&&o.enable(3),T.reversedDepthBuffer&&o.enable(4),T.skinning&&o.enable(5),T.morphTargets&&o.enable(6),T.morphNormals&&o.enable(7),T.morphColors&&o.enable(8),T.premultipliedAlpha&&o.enable(9),T.shadowMapEnabled&&o.enable(10),T.doubleSided&&o.enable(11),T.flipSided&&o.enable(12),T.useDepthPacking&&o.enable(13),T.dithering&&o.enable(14),T.transmission&&o.enable(15),T.sheen&&o.enable(16),T.opaque&&o.enable(17),T.pointsUvs&&o.enable(18),T.decodeVideoTexture&&o.enable(19),T.decodeVideoTextureEmissive&&o.enable(20),T.alphaToCoverage&&o.enable(21),T.numLightProbeGrids>0&&o.enable(22),T.hasPositionAttribute&&o.enable(23),y.push(o.mask)}function E(y){let T=p[y.type],C;if(T){let I=Un[T];C=hd.clone(I.uniforms)}else C=y.uniforms;return C}function v(y,T){let C=h.get(T);return C!==void 0?++C.usedTimes:(C=new Tx(i,T,y,s),c.push(C),h.set(T,C)),C}function b(y){if(--y.usedTimes===0){let T=c.indexOf(y);c[T]=c[c.length-1],c.pop(),h.delete(y.cacheKey),y.destroy()}}function S(y){a.remove(y)}function A(){a.dispose()}return{getParameters:_,getProgramCacheKey:m,getUniforms:E,acquireProgram:v,releaseProgram:b,releaseShaderCache:S,programs:c,dispose:A}}function Px(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Ix(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function Pd(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Id(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(u){let p=0;return u.isInstancedMesh&&(p+=2),u.isSkinnedMesh&&(p+=1),p}function a(u,p,g,_,m,d){let M=i[t];return M===void 0?(M={id:u.id,object:u,geometry:p,material:g,materialVariant:o(u),groupOrder:_,renderOrder:u.renderOrder,z:m,group:d},i[t]=M):(M.id=u.id,M.object=u,M.geometry=p,M.material=g,M.materialVariant=o(u),M.groupOrder=_,M.renderOrder=u.renderOrder,M.z=m,M.group=d),t++,M}function l(u,p,g,_,m,d,M){M.reversedDepth===!0&&(m=-m);let E=a(u,p,g,_,m,d);g.transmission>0?n.push(E):g.transparent===!0?s.push(E):e.push(E)}function c(u,p,g,_,m,d){let M=a(u,p,g,_,m,d);g.transmission>0?n.unshift(M):g.transparent===!0?s.unshift(M):e.unshift(M)}function h(u,p){e.length>1&&e.sort(u||Ix),n.length>1&&n.sort(p||Pd),s.length>1&&s.sort(p||Pd)}function f(){for(let u=t,p=i.length;u<p;u++){let g=i[u];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:f,sort:h}}function Lx(){let i=new WeakMap;function t(n,s){let r=i.get(n),o;return r===void 0?(o=new Id,i.set(n,[o])):s>=r.length?(o=new Id,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function Ux(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={direction:new k,color:new Ut};break;case"SpotLight":e={position:new k,direction:new k,color:new Ut,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new k,color:new Ut,distance:0,decay:0};break;case"HemisphereLight":e={direction:new k,skyColor:new Ut,groundColor:new Ut};break;case"RectAreaLight":e={color:new Ut,position:new k,halfWidth:new k,halfHeight:new k};break}return i[t.id]=e,e}}}function Ox(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ht};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ht};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ht,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var Dx=0;function Nx(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function Fx(i){let t=new Ux,e=Ox(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new k);let s=new k,r=new ne,o=new ne;function a(c){let h=0,f=0,u=0;for(let L=0;L<9;L++)n.probe[L].set(0,0,0);let p=0,g=0,_=0,m=0,d=0,M=0,E=0,v=0,b=0,S=0,A=0,y=0,T=0,C=0;c.sort(Nx);for(let L=0,N=c.length;L<N;L++){let P=c[L],O=P.color,U=P.intensity,V=P.distance,J=null;if(P.shadow&&P.shadow.map&&(P.shadow.map.texture.format===_i?J=P.shadow.map.texture:J=P.shadow.map.depthTexture||P.shadow.map.texture),P.isAmbientLight)h+=O.r*U,f+=O.g*U,u+=O.b*U;else if(P.isLightProbe){for(let Z=0;Z<9;Z++)n.probe[Z].addScaledVector(P.sh.coefficients[Z],U);C++}else if(P.isSunLight){let Z=t.get(P);if(Z.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let tt=P.shadow,it=e.get(P);it.shadowIntensity=tt.intensity,it.shadowBias=tt.bias,it.shadowNormalBias=tt.normalBias,it.shadowRadius=tt.radius,it.shadowMapSize.copy(tt.mapSize).multiply(tt.getFrameExtents()),n.sunShadow[g]=it,n.sunShadowMap[g]=J;let W=tt.getViewportCount();for(let st=0;st<W;st++)n.sunShadowMatrix[_+st]=tt.getMatrix(st),n.sunShadowCascade[_+st]=tt._cascadeData[st];_+=W,g++}n.sun[p]=Z,p++}else if(P.isDirectionalLight){let Z=t.get(P);if(Z.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let tt=P.shadow,it=e.get(P);it.shadowIntensity=tt.intensity,it.shadowBias=tt.bias,it.shadowNormalBias=tt.normalBias,it.shadowRadius=tt.radius,it.shadowMapSize=tt.mapSize,n.directionalShadow[m]=it,n.directionalShadowMap[m]=J,n.directionalShadowMatrix[m]=P.shadow.matrix,b++}n.directional[m]=Z,m++}else if(P.isSpotLight){let Z=t.get(P);Z.position.setFromMatrixPosition(P.matrixWorld),Z.color.copy(O).multiplyScalar(U),Z.distance=V,Z.coneCos=Math.cos(P.angle),Z.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),Z.decay=P.decay,n.spot[M]=Z;let tt=P.shadow;if(P.map&&(n.spotLightMap[y]=P.map,y++,tt.updateMatrices(P),P.castShadow&&T++),n.spotLightMatrix[M]=tt.matrix,P.castShadow){let it=e.get(P);it.shadowIntensity=tt.intensity,it.shadowBias=tt.bias,it.shadowNormalBias=tt.normalBias,it.shadowRadius=tt.radius,it.shadowMapSize=tt.mapSize,n.spotShadow[M]=it,n.spotShadowMap[M]=J,A++}M++}else if(P.isRectAreaLight){let Z=t.get(P);Z.color.copy(O).multiplyScalar(U),Z.halfWidth.set(P.width*.5,0,0),Z.halfHeight.set(0,P.height*.5,0),n.rectArea[E]=Z,E++}else if(P.isPointLight){let Z=t.get(P);if(Z.color.copy(P.color).multiplyScalar(P.intensity),Z.distance=P.distance,Z.decay=P.decay,P.castShadow){let tt=P.shadow,it=e.get(P);it.shadowIntensity=tt.intensity,it.shadowBias=tt.bias,it.shadowNormalBias=tt.normalBias,it.shadowRadius=tt.radius,it.shadowMapSize=tt.mapSize,it.shadowCameraNear=tt.camera.near,it.shadowCameraFar=tt.camera.far,n.pointShadow[d]=it,n.pointShadowMap[d]=J,n.pointShadowMatrix[d]=P.shadow.matrix,S++}n.point[d]=Z,d++}else if(P.isHemisphereLight){let Z=t.get(P);Z.skyColor.copy(P.color).multiplyScalar(U),Z.groundColor.copy(P.groundColor).multiplyScalar(U),n.hemi[v]=Z,v++}}E>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=gt.LTC_FLOAT_1,n.rectAreaLTC2=gt.LTC_FLOAT_2):(n.rectAreaLTC1=gt.LTC_HALF_1,n.rectAreaLTC2=gt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=f,n.ambient[2]=u;let I=n.hash;(I.sunLength!==p||I.directionalLength!==m||I.pointLength!==d||I.spotLength!==M||I.rectAreaLength!==E||I.hemiLength!==v||I.numSunShadows!==g||I.numDirectionalShadows!==b||I.numPointShadows!==S||I.numSpotShadows!==A||I.numSpotMaps!==y||I.numLightProbes!==C)&&(n.sun.length=p,n.directional.length=m,n.spot.length=M,n.rectArea.length=E,n.point.length=d,n.hemi.length=v,n.sunShadow.length=g,n.sunShadowMap.length=g,n.sunShadowMatrix.length=_,n.sunShadowCascade.length=_,n.directionalShadow.length=b,n.directionalShadowMap.length=b,n.directionalShadowMatrix.length=b,n.pointShadow.length=S,n.pointShadowMap.length=S,n.pointShadowMatrix.length=S,n.spotShadow.length=A,n.spotShadowMap.length=A,n.spotLightMatrix.length=A+y-T,n.spotLightMap.length=y,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=C,I.sunLength=p,I.directionalLength=m,I.pointLength=d,I.spotLength=M,I.rectAreaLength=E,I.hemiLength=v,I.numSunShadows=g,I.numDirectionalShadows=b,I.numPointShadows=S,I.numSpotShadows=A,I.numSpotMaps=y,I.numLightProbes=C,n.version=Dx++)}function l(c,h){let f=0,u=0,p=0,g=0,_=0,m=0,d=h.matrixWorldInverse;for(let M=0,E=c.length;M<E;M++){let v=c[M];if(v.isSunLight){let b=n.sun[f];b.direction.setFromMatrixPosition(v.matrixWorld),b.direction.transformDirection(d),f++}else if(v.isDirectionalLight){let b=n.directional[u];b.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(d),u++}else if(v.isSpotLight){let b=n.spot[g];b.position.setFromMatrixPosition(v.matrixWorld),b.position.applyMatrix4(d),b.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(d),g++}else if(v.isRectAreaLight){let b=n.rectArea[_];b.position.setFromMatrixPosition(v.matrixWorld),b.position.applyMatrix4(d),o.identity(),r.copy(v.matrixWorld),r.premultiply(d),o.extractRotation(r),b.halfWidth.set(v.width*.5,0,0),b.halfHeight.set(0,v.height*.5,0),b.halfWidth.applyMatrix4(o),b.halfHeight.applyMatrix4(o),_++}else if(v.isPointLight){let b=n.point[p];b.position.setFromMatrixPosition(v.matrixWorld),b.position.applyMatrix4(d),p++}else if(v.isHemisphereLight){let b=n.hemi[m];b.direction.setFromMatrixPosition(v.matrixWorld),b.direction.transformDirection(d),m++}}}return{setup:a,setupView:l,state:n}}function Ld(i){let t=new Fx(i),e=[],n=[],s=[];function r(u){f.camera=u,e.length=0,n.length=0,s.length=0}function o(u){e.push(u)}function a(u){n.push(u)}function l(u){s.push(u)}function c(){t.setup(e)}function h(u){t.setupView(e,u)}let f={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function Bx(i){let t=new WeakMap;function e(s,r=0){let o=t.get(s),a;return o===void 0?(a=new Ld(i),t.set(s,[a])):r>=o.length?(a=new Ld(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}var kx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,zx=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Vx=[new k(1,0,0),new k(-1,0,0),new k(0,1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1)],Hx=[new k(0,-1,0),new k(0,-1,0),new k(0,0,1),new k(0,0,-1),new k(0,-1,0),new k(0,-1,0)],Ud=new ne,Fr=new k,Bc=new k;function Gx(i,t,e){let n=new Ms,s=new Ht,r=new Ht,o=new he,a=new Wo,l=new Xo,c={},h=e.maxTextureSize,f={[fi]:Xe,[Xe]:fi,[Pn]:Pn},u=new We({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ht},radius:{value:4}},vertexShader:kx,fragmentShader:zx}),p=u.clone();p.defines.HORIZONTAL_PASS=1;let g=new Ie;g.setAttribute("position",new we(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new ze(g,u),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Ar;let d=this.type;this.render=function(S,A,y){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||S.length===0)return;this.type===Au&&(Lt("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Ar);let T=i.getRenderTarget(),C=i.getActiveCubeFace(),I=i.getActiveMipmapLevel(),L=i.state;L.setBlending(In),L.buffers.depth.getReversed()===!0?L.buffers.color.setClear(0,0,0,0):L.buffers.color.setClear(1,1,1,1),L.buffers.depth.setTest(!0),L.setScissorTest(!1);let N=d!==this.type;N&&A.traverse(function(P){P.material&&(Array.isArray(P.material)?P.material.forEach(O=>O.needsUpdate=!0):P.material.needsUpdate=!0)});for(let P=0,O=S.length;P<O;P++){let U=S[P],V=U.shadow;if(V===void 0){Lt("WebGLShadowMap:",U,"has no shadow.");continue}if(V.autoUpdate===!1&&V.needsUpdate===!1)continue;s.copy(V.mapSize);let J=V.getFrameExtents();s.multiply(J),r.copy(V.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/J.x),s.x=r.x*J.x,V.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/J.y),s.y=r.y*J.y,V.mapSize.y=r.y));let Z=i.state.buffers.depth.getReversed();if(V.camera._reversedDepth=Z,V.map===null||N===!0){if(V.map!==null&&(V.map.depthTexture!==null&&(V.map.depthTexture.dispose(),V.map.depthTexture=null),V.map.dispose()),this.type===ws){if(U.isPointLight){Lt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}V.map=new Ze(s.x,s.y,{format:_i,type:Mn,minFilter:Le,magFilter:Le,generateMipmaps:!1}),V.map.texture.name=U.name+".shadowMap",V.map.depthTexture=new oi(s.x,s.y,cn),V.map.depthTexture.name=U.name+".shadowMapDepth",V.map.depthTexture.format=An,V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=Pe,V.map.depthTexture.magFilter=Pe}else U.isPointLight?(V.map=new Ja(s.x),V.map.depthTexture=new Ho(s.x,vn)):(V.map=new Ze(s.x,s.y),V.map.depthTexture=new oi(s.x,s.y,vn)),V.map.depthTexture.name=U.name+".shadowMap",V.map.depthTexture.format=An,this.type===Ar?(V.map.depthTexture.compareFunction=Z?Ya:qa,V.map.depthTexture.minFilter=Le,V.map.depthTexture.magFilter=Le):(V.map.depthTexture.compareFunction=null,V.map.depthTexture.minFilter=Pe,V.map.depthTexture.magFilter=Pe);V.camera.updateProjectionMatrix()}V.map.isWebGLCubeRenderTarget!==!0&&(V.map.width!==s.x||V.map.height!==s.y)&&V.map.setSize(s.x,s.y);let tt=V.map.isWebGLCubeRenderTarget?6:V.getViewportCount();U.isPointLight!==!0&&V.updateMatrices(U,y);for(let it=0;it<tt;it++){let W=V.getCamera(it);if(U.isPointLight){let st=V.camera,ct=V.matrix,lt=U.distance||st.far;lt!==st.far&&(st.far=lt,st.updateProjectionMatrix()),Fr.setFromMatrixPosition(U.matrixWorld),st.position.copy(Fr),Bc.copy(st.position),Bc.add(Vx[it]),st.up.copy(Hx[it]),st.lookAt(Bc),st.updateMatrixWorld(),ct.makeTranslation(-Fr.x,-Fr.y,-Fr.z),Ud.multiplyMatrices(st.projectionMatrix,st.matrixWorldInverse),V._frustum.setFromProjectionMatrix(Ud,st.coordinateSystem,st.reversedDepth)}if(V.map.isWebGLCubeRenderTarget)i.setRenderTarget(V.map,it),i.clear();else{it===0&&(i.setRenderTarget(V.map),i.clear());let st=V.getViewport(it);o.set(r.x*st.x,r.y*st.y,r.x*st.z,r.y*st.w),L.viewport(o)}n=V.getFrustum(it),v(A,y,W,U,this.type)}V.isPointLightShadow!==!0&&this.type===ws&&M(V,y),V.needsUpdate=!1}d=this.type,m.needsUpdate=!1,i.setRenderTarget(T,C,I)};function M(S,A){let y=t.update(_);u.defines.VSM_SAMPLES!==S.blurSamples&&(u.defines.VSM_SAMPLES=S.blurSamples,p.defines.VSM_SAMPLES=S.blurSamples,u.needsUpdate=!0,p.needsUpdate=!0),S.mapPass===null?S.mapPass=new Ze(s.x,s.y,{format:_i,type:Mn}):(S.mapPass.width!==S.map.width||S.mapPass.height!==S.map.height)&&S.mapPass.setSize(S.map.width,S.map.height),u.uniforms.shadow_pass.value=S.map.depthTexture,u.uniforms.resolution.value.set(S.map.width,S.map.height),u.uniforms.radius.value=S.radius,i.setRenderTarget(S.mapPass),i.clear(),i.renderBufferDirect(A,null,y,u,_,null),p.uniforms.shadow_pass.value=S.mapPass.texture,p.uniforms.resolution.value.set(S.map.width,S.map.height),p.uniforms.radius.value=S.radius,i.setRenderTarget(S.map),i.clear(),i.renderBufferDirect(A,null,y,p,_,null)}function E(S,A,y,T){let C=null,I=y.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(I!==void 0)C=I;else if(C=y.isPointLight===!0?l:a,i.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0||A.alphaToCoverage===!0){let L=C.uuid,N=A.uuid,P=c[L];P===void 0&&(P={},c[L]=P);let O=P[N];O===void 0&&(O=C.clone(),P[N]=O,A.addEventListener("dispose",b)),C=O}if(C.visible=A.visible,C.wireframe=A.wireframe,T===ws?C.side=A.shadowSide!==null?A.shadowSide:A.side:C.side=A.shadowSide!==null?A.shadowSide:f[A.side],C.alphaMap=A.alphaMap,C.alphaTest=A.alphaToCoverage===!0?.5:A.alphaTest,C.map=A.map,C.clipShadows=A.clipShadows,C.clippingPlanes=A.clippingPlanes,C.clipIntersection=A.clipIntersection,C.displacementMap=A.displacementMap,C.displacementScale=A.displacementScale,C.displacementBias=A.displacementBias,C.wireframeLinewidth=A.wireframeLinewidth,C.linewidth=A.linewidth,y.isPointLight===!0&&C.isMeshDistanceMaterial===!0){let L=i.properties.get(C);L.light=y}return C}function v(S,A,y,T,C){if(S.visible===!1)return;if(S.layers.test(A.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&C===ws)&&(!S.frustumCulled||S.intersectsFrustum(n))){S.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,S.matrixWorld);let N=t.update(S),P=S.material;if(Array.isArray(P)){let O=N.groups;for(let U=0,V=O.length;U<V;U++){let J=O[U],Z=P[J.materialIndex];if(Z&&Z.visible){let tt=E(S,Z,T,C);S.onBeforeShadow(i,S,A,y,N,tt,J),i.renderBufferDirect(y,null,N,tt,S,J),S.onAfterShadow(i,S,A,y,N,tt,J)}}}else if(P.visible){let O=E(S,P,T,C);S.onBeforeShadow(i,S,A,y,N,O,null),i.renderBufferDirect(y,null,N,O,S,null),S.onAfterShadow(i,S,A,y,N,O,null)}}let L=S.children;for(let N=0,P=L.length;N<P;N++)v(L[N],A,y,T,C)}function b(S){S.target.removeEventListener("dispose",b);for(let y in c){let T=c[y],C=S.target.uuid;C in T&&(T[C].dispose(),delete T[C])}}}function Wx(i,t){function e(){let F=!1,ft=new he,et=null,pt=new he(0,0,0,0);return{setMask:function(vt){et!==vt&&!F&&(i.colorMask(vt,vt,vt,vt),et=vt)},setLocked:function(vt){F=vt},setClear:function(vt,rt,It,At,le){le===!0&&(vt*=At,rt*=At,It*=At),ft.set(vt,rt,It,At),pt.equals(ft)===!1&&(i.clearColor(vt,rt,It,At),pt.copy(ft))},reset:function(){F=!1,et=null,pt.set(-1,0,0,0)}}}function n(){let F=!1,ft=!1,et=null,pt=null,vt=null;return{setReversed:function(rt){if(ft!==rt){let It=t.get("EXT_clip_control");rt?It.clipControlEXT(It.LOWER_LEFT_EXT,It.ZERO_TO_ONE_EXT):It.clipControlEXT(It.LOWER_LEFT_EXT,It.NEGATIVE_ONE_TO_ONE_EXT),ft=rt;let At=vt;vt=null,this.setClear(At)}},getReversed:function(){return ft},setTest:function(rt){rt?K(i.DEPTH_TEST):ot(i.DEPTH_TEST)},setMask:function(rt){et!==rt&&!F&&(i.depthMask(rt),et=rt)},setFunc:function(rt){if(ft&&(rt=ld[rt]),pt!==rt){switch(rt){case Ao:i.depthFunc(i.NEVER);break;case Co:i.depthFunc(i.ALWAYS);break;case Ro:i.depthFunc(i.LESS);break;case ds:i.depthFunc(i.LEQUAL);break;case Po:i.depthFunc(i.EQUAL);break;case Io:i.depthFunc(i.GEQUAL);break;case Lo:i.depthFunc(i.GREATER);break;case Uo:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}pt=rt}},setLocked:function(rt){F=rt},setClear:function(rt){vt!==rt&&(vt=rt,ft&&(rt=1-rt),i.clearDepth(rt))},reset:function(){F=!1,et=null,pt=null,vt=null,ft=!1}}}function s(){let F=!1,ft=null,et=null,pt=null,vt=null,rt=null,It=null,At=null,le=null;return{setTest:function(Qt){F||(Qt?K(i.STENCIL_TEST):ot(i.STENCIL_TEST))},setMask:function(Qt){ft!==Qt&&!F&&(i.stencilMask(Qt),ft=Qt)},setFunc:function(Qt,un,bn){(et!==Qt||pt!==un||vt!==bn)&&(i.stencilFunc(Qt,un,bn),et=Qt,pt=un,vt=bn)},setOp:function(Qt,un,bn){(rt!==Qt||It!==un||At!==bn)&&(i.stencilOp(Qt,un,bn),rt=Qt,It=un,At=bn)},setLocked:function(Qt){F=Qt},setClear:function(Qt){le!==Qt&&(i.clearStencil(Qt),le=Qt)},reset:function(){F=!1,ft=null,et=null,pt=null,vt=null,rt=null,It=null,At=null,le=null}}}let r=new e,o=new n,a=new s,l=new WeakMap,c=new WeakMap,h={},f={},u={},p=new WeakMap,g=[],_=null,m=!1,d=null,M=null,E=null,v=null,b=null,S=null,A=null,y=new Ut(0,0,0),T=0,C=!1,I=null,L=null,N=null,P=null,O=null,U=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),V=!1,J=0,Z=i.getParameter(i.VERSION);Z.indexOf("WebGL")!==-1?(J=parseFloat(/^WebGL (\d)/.exec(Z)[1]),V=J>=1):Z.indexOf("OpenGL ES")!==-1&&(J=parseFloat(/^OpenGL ES (\d)/.exec(Z)[1]),V=J>=2);let tt=null,it={},W=i.getParameter(i.SCISSOR_BOX),st=i.getParameter(i.VIEWPORT),ct=new he().fromArray(W),lt=new he().fromArray(st);function bt(F,ft,et,pt){let vt=new Uint8Array(4),rt=i.createTexture();i.bindTexture(F,rt),i.texParameteri(F,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(F,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let It=0;It<et;It++)F===i.TEXTURE_3D||F===i.TEXTURE_2D_ARRAY?i.texImage3D(ft,0,i.RGBA,1,1,pt,0,i.RGBA,i.UNSIGNED_BYTE,vt):i.texImage2D(ft+It,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,vt);return rt}let X={};X[i.TEXTURE_2D]=bt(i.TEXTURE_2D,i.TEXTURE_2D,1),X[i.TEXTURE_CUBE_MAP]=bt(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),X[i.TEXTURE_2D_ARRAY]=bt(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),X[i.TEXTURE_3D]=bt(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),K(i.DEPTH_TEST),o.setFunc(ds),Yt(!1),pe(rc),K(i.CULL_FACE),Kt(In);function K(F){h[F]!==!0&&(i.enable(F),h[F]=!0)}function ot(F){h[F]!==!1&&(i.disable(F),h[F]=!1)}function wt(F,ft){return u[F]!==ft?(i.bindFramebuffer(F,ft),u[F]=ft,F===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=ft),F===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=ft),!0):!1}function _t(F,ft){let et=g,pt=!1;if(F){et=p.get(ft),et===void 0&&(et=[],p.set(ft,et));let vt=F.textures;if(et.length!==vt.length||et[0]!==i.COLOR_ATTACHMENT0){for(let rt=0,It=vt.length;rt<It;rt++)et[rt]=i.COLOR_ATTACHMENT0+rt;et.length=vt.length,pt=!0}}else et[0]!==i.BACK&&(et[0]=i.BACK,pt=!0);pt&&i.drawBuffers(et)}function zt(F){return _!==F?(i.useProgram(F),_=F,!0):!1}let Ee={[Bi]:i.FUNC_ADD,[Ru]:i.FUNC_SUBTRACT,[Pu]:i.FUNC_REVERSE_SUBTRACT};Ee[Iu]=i.MIN,Ee[Lu]=i.MAX;let Xt={[Uu]:i.ZERO,[Ou]:i.ONE,[Du]:i.SRC_COLOR,[cc]:i.SRC_ALPHA,[Vu]:i.SRC_ALPHA_SATURATE,[ku]:i.DST_COLOR,[Fu]:i.DST_ALPHA,[Nu]:i.ONE_MINUS_SRC_COLOR,[hc]:i.ONE_MINUS_SRC_ALPHA,[zu]:i.ONE_MINUS_DST_COLOR,[Bu]:i.ONE_MINUS_DST_ALPHA,[Hu]:i.CONSTANT_COLOR,[Gu]:i.ONE_MINUS_CONSTANT_COLOR,[Wu]:i.CONSTANT_ALPHA,[Xu]:i.ONE_MINUS_CONSTANT_ALPHA};function Kt(F,ft,et,pt,vt,rt,It,At,le,Qt){if(F===In){m===!0&&(ot(i.BLEND),m=!1);return}if(m===!1&&(K(i.BLEND),m=!0),F!==Cu){if(F!==d||Qt!==C){if((M!==Bi||b!==Bi)&&(i.blendEquation(i.FUNC_ADD),M=Bi,b=Bi),Qt)switch(F){case Es:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case oc:i.blendFunc(i.ONE,i.ONE);break;case ac:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case lc:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Dt("WebGLState: Invalid blending: ",F);break}else switch(F){case Es:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case oc:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case ac:Dt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case lc:Dt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Dt("WebGLState: Invalid blending: ",F);break}E=null,v=null,S=null,A=null,y.set(0,0,0),T=0,d=F,C=Qt}return}vt=vt||ft,rt=rt||et,It=It||pt,(ft!==M||vt!==b)&&(i.blendEquationSeparate(Ee[ft],Ee[vt]),M=ft,b=vt),(et!==E||pt!==v||rt!==S||It!==A)&&(i.blendFuncSeparate(Xt[et],Xt[pt],Xt[rt],Xt[It]),E=et,v=pt,S=rt,A=It),(At.equals(y)===!1||le!==T)&&(i.blendColor(At.r,At.g,At.b,le),y.copy(At),T=le),d=F,C=!1}function ae(F,ft){F.side===Pn?ot(i.CULL_FACE):K(i.CULL_FACE);let et=F.side===Xe;ft&&(et=!et),Yt(et),F.blending===Es&&F.transparent===!1?Kt(In):Kt(F.blending,F.blendEquation,F.blendSrc,F.blendDst,F.blendEquationAlpha,F.blendSrcAlpha,F.blendDstAlpha,F.blendColor,F.blendAlpha,F.premultipliedAlpha),o.setFunc(F.depthFunc),o.setTest(F.depthTest),o.setMask(F.depthWrite),r.setMask(F.colorWrite);let pt=F.stencilWrite;a.setTest(pt),pt&&(a.setMask(F.stencilWriteMask),a.setFunc(F.stencilFunc,F.stencilRef,F.stencilFuncMask),a.setOp(F.stencilFail,F.stencilZFail,F.stencilZPass)),qe(F.polygonOffset,F.polygonOffsetFactor,F.polygonOffsetUnits),F.alphaToCoverage===!0?K(i.SAMPLE_ALPHA_TO_COVERAGE):ot(i.SAMPLE_ALPHA_TO_COVERAGE)}function Yt(F){I!==F&&(F?i.frontFace(i.CW):i.frontFace(i.CCW),I=F)}function pe(F){F!==Eu?(K(i.CULL_FACE),F!==L&&(F===rc?i.cullFace(i.BACK):F===Tu?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):ot(i.CULL_FACE),L=F}function Ce(F){F!==N&&(V&&i.lineWidth(F),N=F)}function qe(F,ft,et){F?(K(i.POLYGON_OFFSET_FILL),(P!==ft||O!==et)&&(P=ft,O=et,o.getReversed()&&(ft=-ft),i.polygonOffset(ft,et))):ot(i.POLYGON_OFFSET_FILL)}function ge(F){F?K(i.SCISSOR_TEST):ot(i.SCISSOR_TEST)}function Me(F){F===void 0&&(F=i.TEXTURE0+U-1),tt!==F&&(i.activeTexture(F),tt=F)}function B(F,ft,et){et===void 0&&(tt===null?et=i.TEXTURE0+U-1:et=tt);let pt=it[et];pt===void 0&&(pt={type:void 0,texture:void 0},it[et]=pt),(pt.type!==F||pt.texture!==ft)&&(tt!==et&&(i.activeTexture(et),tt=et),i.bindTexture(F,ft||X[F]),pt.type=F,pt.texture=ft)}function De(){let F=it[tt];F!==void 0&&F.type!==void 0&&(i.bindTexture(F.type,null),F.type=void 0,F.texture=void 0)}function se(){try{i.compressedTexImage2D(...arguments)}catch(F){Dt("WebGLState:",F)}}function R(){try{i.compressedTexImage3D(...arguments)}catch(F){Dt("WebGLState:",F)}}function x(){try{i.texSubImage2D(...arguments)}catch(F){Dt("WebGLState:",F)}}function z(){try{i.texSubImage3D(...arguments)}catch(F){Dt("WebGLState:",F)}}function q(){try{i.compressedTexSubImage2D(...arguments)}catch(F){Dt("WebGLState:",F)}}function j(){try{i.compressedTexSubImage3D(...arguments)}catch(F){Dt("WebGLState:",F)}}function at(){try{i.texStorage2D(...arguments)}catch(F){Dt("WebGLState:",F)}}function ht(){try{i.texStorage3D(...arguments)}catch(F){Dt("WebGLState:",F)}}function Q(){try{i.texImage2D(...arguments)}catch(F){Dt("WebGLState:",F)}}function nt(){try{i.texImage3D(...arguments)}catch(F){Dt("WebGLState:",F)}}function ut(F){return f[F]!==void 0?f[F]:i.getParameter(F)}function Rt(F,ft){f[F]!==ft&&(i.pixelStorei(F,ft),f[F]=ft)}function mt(F){ct.equals(F)===!1&&(i.scissor(F.x,F.y,F.z,F.w),ct.copy(F))}function dt(F){lt.equals(F)===!1&&(i.viewport(F.x,F.y,F.z,F.w),lt.copy(F))}function Pt(F,ft){let et=c.get(ft);et===void 0&&(et=new WeakMap,c.set(ft,et));let pt=et.get(F);pt===void 0&&(pt=i.getUniformBlockIndex(ft,F.name),et.set(F,pt))}function Ot(F,ft){let pt=c.get(ft).get(F);l.get(ft)!==pt&&(i.uniformBlockBinding(ft,pt,F.__bindingPointIndex),l.set(ft,pt))}function Bt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},f={},tt=null,it={},u={},p=new WeakMap,g=[],_=null,m=!1,d=null,M=null,E=null,v=null,b=null,S=null,A=null,y=new Ut(0,0,0),T=0,C=!1,I=null,L=null,N=null,P=null,O=null,ct.set(0,0,i.canvas.width,i.canvas.height),lt.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:K,disable:ot,bindFramebuffer:wt,drawBuffers:_t,useProgram:zt,setBlending:Kt,setMaterial:ae,setFlipSided:Yt,setCullFace:pe,setLineWidth:Ce,setPolygonOffset:qe,setScissorTest:ge,activeTexture:Me,bindTexture:B,unbindTexture:De,compressedTexImage2D:se,compressedTexImage3D:R,texImage2D:Q,texImage3D:nt,pixelStorei:Rt,getParameter:ut,updateUBOMapping:Pt,uniformBlockBinding:Ot,texStorage2D:at,texStorage3D:ht,texSubImage2D:x,texSubImage3D:z,compressedTexSubImage2D:q,compressedTexSubImage3D:j,scissor:mt,viewport:dt,reset:Bt}}function Xx(i,t,e,n,s,r,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ht,h=new WeakMap,f=new Set,u,p=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(R,x){return g?new OffscreenCanvas(R,x):hr("canvas")}function m(R,x,z){let q=1,j=se(R);if((j.width>z||j.height>z)&&(q=z/Math.max(j.width,j.height)),q<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let at=Math.floor(q*j.width),ht=Math.floor(q*j.height);u===void 0&&(u=_(at,ht));let Q=x?_(at,ht):u;return Q.width=at,Q.height=ht,Q.getContext("2d").drawImage(R,0,0,at,ht),Lt("WebGLRenderer: Texture has been resized from ("+j.width+"x"+j.height+") to ("+at+"x"+ht+")."),Q}else return"data"in R&&Lt("WebGLRenderer: Image in DataTexture is too big ("+j.width+"x"+j.height+")."),R;return R}function d(R){return R.generateMipmaps}function M(R){i.generateMipmap(R)}function E(R){return R.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?i.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function v(R,x,z,q,j,at=!1){if(R!==null){if(i[R]!==void 0)return i[R];Lt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let ht;q&&(ht=t.get("EXT_texture_norm16"),ht||Lt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Q=x;if(x===i.RED&&(z===i.FLOAT&&(Q=i.R32F),z===i.HALF_FLOAT&&(Q=i.R16F),z===i.UNSIGNED_BYTE&&(Q=i.R8),z===i.UNSIGNED_SHORT&&ht&&(Q=ht.R16_EXT),z===i.SHORT&&ht&&(Q=ht.R16_SNORM_EXT)),x===i.RED_INTEGER&&(z===i.UNSIGNED_BYTE&&(Q=i.R8UI),z===i.UNSIGNED_SHORT&&(Q=i.R16UI),z===i.UNSIGNED_INT&&(Q=i.R32UI),z===i.BYTE&&(Q=i.R8I),z===i.SHORT&&(Q=i.R16I),z===i.INT&&(Q=i.R32I)),x===i.RG&&(z===i.FLOAT&&(Q=i.RG32F),z===i.HALF_FLOAT&&(Q=i.RG16F),z===i.UNSIGNED_BYTE&&(Q=i.RG8),z===i.UNSIGNED_SHORT&&ht&&(Q=ht.RG16_EXT),z===i.SHORT&&ht&&(Q=ht.RG16_SNORM_EXT)),x===i.RG_INTEGER&&(z===i.UNSIGNED_BYTE&&(Q=i.RG8UI),z===i.UNSIGNED_SHORT&&(Q=i.RG16UI),z===i.UNSIGNED_INT&&(Q=i.RG32UI),z===i.BYTE&&(Q=i.RG8I),z===i.SHORT&&(Q=i.RG16I),z===i.INT&&(Q=i.RG32I)),x===i.RGB_INTEGER&&(z===i.UNSIGNED_BYTE&&(Q=i.RGB8UI),z===i.UNSIGNED_SHORT&&(Q=i.RGB16UI),z===i.UNSIGNED_INT&&(Q=i.RGB32UI),z===i.BYTE&&(Q=i.RGB8I),z===i.SHORT&&(Q=i.RGB16I),z===i.INT&&(Q=i.RGB32I)),x===i.RGBA_INTEGER&&(z===i.UNSIGNED_BYTE&&(Q=i.RGBA8UI),z===i.UNSIGNED_SHORT&&(Q=i.RGBA16UI),z===i.UNSIGNED_INT&&(Q=i.RGBA32UI),z===i.BYTE&&(Q=i.RGBA8I),z===i.SHORT&&(Q=i.RGBA16I),z===i.INT&&(Q=i.RGBA32I)),x===i.RGB&&(z===i.UNSIGNED_SHORT&&ht&&(Q=ht.RGB16_EXT),z===i.SHORT&&ht&&(Q=ht.RGB16_SNORM_EXT),z===i.UNSIGNED_INT_5_9_9_9_REV&&(Q=i.RGB9_E5),z===i.UNSIGNED_INT_10F_11F_11F_REV&&(Q=i.R11F_G11F_B10F)),x===i.RGBA){let nt=at?cr:Zt.getTransfer(j);z===i.FLOAT&&(Q=i.RGBA32F),z===i.HALF_FLOAT&&(Q=i.RGBA16F),z===i.UNSIGNED_BYTE&&(Q=nt===ee?i.SRGB8_ALPHA8:i.RGBA8),z===i.UNSIGNED_SHORT&&ht&&(Q=ht.RGBA16_EXT),z===i.SHORT&&ht&&(Q=ht.RGBA16_SNORM_EXT),z===i.UNSIGNED_SHORT_4_4_4_4&&(Q=i.RGBA4),z===i.UNSIGNED_SHORT_5_5_5_1&&(Q=i.RGB5_A1)}return(Q===i.R16F||Q===i.R32F||Q===i.RG16F||Q===i.RG32F||Q===i.RGBA16F||Q===i.RGBA32F)&&t.get("EXT_color_buffer_float"),Q}function b(R,x){let z;return R?x===null||x===vn||x===As?z=i.DEPTH24_STENCIL8:x===cn?z=i.DEPTH32F_STENCIL8:x===Ts&&(z=i.DEPTH24_STENCIL8,Lt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===vn||x===As?z=i.DEPTH_COMPONENT24:x===cn?z=i.DEPTH_COMPONENT32F:x===Ts&&(z=i.DEPTH_COMPONENT16),z}function S(R,x){return d(R)===!0||R.isFramebufferTexture&&R.minFilter!==Pe&&R.minFilter!==Le?Math.log2(Math.max(x.width,x.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?x.mipmaps.length:1}function A(R){let x=R.target;x.removeEventListener("dispose",A),T(x),x.isVideoTexture&&h.delete(x),x.isHTMLTexture&&f.delete(x)}function y(R){let x=R.target;x.removeEventListener("dispose",y),I(x)}function T(R){let x=n.get(R);if(x.__webglInit===void 0)return;let z=R.source,q=p.get(z);if(q){let j=q[x.__cacheKey];j.usedTimes--,j.usedTimes===0&&C(R),Object.keys(q).length===0&&p.delete(z)}n.remove(R)}function C(R){let x=n.get(R);i.deleteTexture(x.__webglTexture);let z=R.source,q=p.get(z);delete q[x.__cacheKey],o.memory.textures--}function I(R){let x=n.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),n.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(x.__webglFramebuffer[q]))for(let j=0;j<x.__webglFramebuffer[q].length;j++)i.deleteFramebuffer(x.__webglFramebuffer[q][j]);else i.deleteFramebuffer(x.__webglFramebuffer[q]);x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer[q])}else{if(Array.isArray(x.__webglFramebuffer))for(let q=0;q<x.__webglFramebuffer.length;q++)i.deleteFramebuffer(x.__webglFramebuffer[q]);else i.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&i.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let q=0;q<x.__webglColorRenderbuffer.length;q++)x.__webglColorRenderbuffer[q]&&i.deleteRenderbuffer(x.__webglColorRenderbuffer[q]);x.__webglDepthRenderbuffer&&i.deleteRenderbuffer(x.__webglDepthRenderbuffer)}let z=R.textures;for(let q=0,j=z.length;q<j;q++){let at=n.get(z[q]);at.__webglTexture&&(i.deleteTexture(at.__webglTexture),o.memory.textures--),n.remove(z[q])}n.remove(R)}let L=0;function N(){L=0}function P(){return L}function O(R){L=R}function U(){let R=L;return R>=s.maxTextures&&Lt("WebGLTextures: Trying to use "+(R+1)+" texture units while this GPU supports only "+s.maxTextures),L+=1,R}function V(R){let x=[];return x.push(R.wrapS),x.push(R.wrapT),x.push(R.wrapR||0),x.push(R.magFilter),x.push(R.minFilter),x.push(R.anisotropy),x.push(R.internalFormat),x.push(R.format),x.push(R.type),x.push(R.generateMipmaps),x.push(R.premultiplyAlpha),x.push(R.flipY),x.push(R.unpackAlignment),x.push(R.colorSpace),x.join()}function J(R,x){let z=n.get(R);if(R.isVideoTexture&&B(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&z.__version!==R.version){let q=R.image;if(q===null)Lt("WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)Lt("WebGLRenderer: Texture marked for update but image is incomplete");else{ot(z,R,x);return}}else R.isExternalTexture&&(z.__webglTexture=R.sourceTexture?R.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,z.__webglTexture,i.TEXTURE0+x)}function Z(R,x){let z=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&z.__version!==R.version){ot(z,R,x);return}else R.isExternalTexture&&(z.__webglTexture=R.sourceTexture?R.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,z.__webglTexture,i.TEXTURE0+x)}function tt(R,x){let z=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&z.__version!==R.version){ot(z,R,x);return}e.bindTexture(i.TEXTURE_3D,z.__webglTexture,i.TEXTURE0+x)}function it(R,x){let z=n.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&z.__version!==R.version){wt(z,R,x);return}e.bindTexture(i.TEXTURE_CUBE_MAP,z.__webglTexture,i.TEXTURE0+x)}let W={[fs]:i.REPEAT,[Tn]:i.CLAMP_TO_EDGE,[Oo]:i.MIRRORED_REPEAT},st={[Pe]:i.NEAREST,[Zu]:i.NEAREST_MIPMAP_NEAREST,[Rr]:i.NEAREST_MIPMAP_LINEAR,[Le]:i.LINEAR,[aa]:i.LINEAR_MIPMAP_NEAREST,[mi]:i.LINEAR_MIPMAP_LINEAR},ct={[ju]:i.NEVER,[id]:i.ALWAYS,[Qu]:i.LESS,[qa]:i.LEQUAL,[td]:i.EQUAL,[Ya]:i.GEQUAL,[ed]:i.GREATER,[nd]:i.NOTEQUAL};function lt(R,x){if(x.type===cn&&t.has("OES_texture_float_linear")===!1&&(x.magFilter===Le||x.magFilter===aa||x.magFilter===Rr||x.magFilter===mi||x.minFilter===Le||x.minFilter===aa||x.minFilter===Rr||x.minFilter===mi)&&Lt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(R,i.TEXTURE_WRAP_S,W[x.wrapS]),i.texParameteri(R,i.TEXTURE_WRAP_T,W[x.wrapT]),(R===i.TEXTURE_3D||R===i.TEXTURE_2D_ARRAY)&&i.texParameteri(R,i.TEXTURE_WRAP_R,W[x.wrapR]),i.texParameteri(R,i.TEXTURE_MAG_FILTER,st[x.magFilter]),i.texParameteri(R,i.TEXTURE_MIN_FILTER,st[x.minFilter]),x.compareFunction&&(i.texParameteri(R,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(R,i.TEXTURE_COMPARE_FUNC,ct[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===Pe||x.minFilter!==Rr&&x.minFilter!==mi||x.type===cn&&t.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||n.get(x).__currentAnisotropy){let z=t.get("EXT_texture_filter_anisotropic");i.texParameterf(R,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy}}}function bt(R,x){let z=!1;R.__webglInit===void 0&&(R.__webglInit=!0,x.addEventListener("dispose",A));let q=x.source,j=p.get(q);j===void 0&&(j={},p.set(q,j));let at=V(x);if(at!==R.__cacheKey){j[at]===void 0&&(j[at]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,z=!0),j[at].usedTimes++;let ht=j[R.__cacheKey];ht!==void 0&&(j[R.__cacheKey].usedTimes--,ht.usedTimes===0&&C(x)),R.__cacheKey=at,R.__webglTexture=j[at].texture}return z}function X(R,x,z){return Math.floor(Math.floor(R/z)/x)}function K(R,x,z,q){let at=R.updateRanges;if(at.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,x.width,x.height,z,q,x.data);else{at.sort((Rt,mt)=>Rt.start-mt.start);let ht=0;for(let Rt=1;Rt<at.length;Rt++){let mt=at[ht],dt=at[Rt],Pt=mt.start+mt.count,Ot=X(dt.start,x.width,4),Bt=X(mt.start,x.width,4);dt.start<=Pt+1&&Ot===Bt&&X(dt.start+dt.count-1,x.width,4)===Ot?mt.count=Math.max(mt.count,dt.start+dt.count-mt.start):(++ht,at[ht]=dt)}at.length=ht+1;let Q=e.getParameter(i.UNPACK_ROW_LENGTH),nt=e.getParameter(i.UNPACK_SKIP_PIXELS),ut=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,x.width);for(let Rt=0,mt=at.length;Rt<mt;Rt++){let dt=at[Rt],Pt=Math.floor(dt.start/4),Ot=Math.ceil(dt.count/4),Bt=Pt%x.width,F=Math.floor(Pt/x.width),ft=Ot,et=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,Bt),e.pixelStorei(i.UNPACK_SKIP_ROWS,F),e.texSubImage2D(i.TEXTURE_2D,0,Bt,F,ft,et,z,q,x.data)}R.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,Q),e.pixelStorei(i.UNPACK_SKIP_PIXELS,nt),e.pixelStorei(i.UNPACK_SKIP_ROWS,ut)}}function ot(R,x,z){let q=i.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(q=i.TEXTURE_2D_ARRAY),x.isData3DTexture&&(q=i.TEXTURE_3D);let j=bt(R,x),at=x.source;e.bindTexture(q,R.__webglTexture,i.TEXTURE0+z);let ht=n.get(at);if(at.version!==ht.__version||j===!0){if(e.activeTexture(i.TEXTURE0+z),(typeof ImageBitmap<"u"&&x.image instanceof ImageBitmap)===!1){let et=Zt.getPrimaries(Zt.workingColorSpace),pt=x.colorSpace===qn?null:Zt.getPrimaries(x.colorSpace),vt=x.colorSpace===qn||et===pt?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,vt)}e.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment);let nt=m(x.image,!1,s.maxTextureSize);nt=De(x,nt);let ut=r.convert(x.format,x.colorSpace),Rt=r.convert(x.type),mt=v(x.internalFormat,ut,Rt,x.normalized,x.colorSpace,x.isVideoTexture);lt(q,x);let dt,Pt=x.mipmaps,Ot=x.isVideoTexture!==!0,Bt=ht.__version===void 0||j===!0,F=at.dataReady,ft=S(x,nt);if(x.isDepthTexture)mt=b(x.format===gi,x.type),Bt&&(Ot?e.texStorage2D(i.TEXTURE_2D,1,mt,nt.width,nt.height):e.texImage2D(i.TEXTURE_2D,0,mt,nt.width,nt.height,0,ut,Rt,null));else if(x.isDataTexture)if(Pt.length>0){Ot&&Bt&&e.texStorage2D(i.TEXTURE_2D,ft,mt,Pt[0].width,Pt[0].height);for(let et=0,pt=Pt.length;et<pt;et++)dt=Pt[et],Ot?F&&e.texSubImage2D(i.TEXTURE_2D,et,0,0,dt.width,dt.height,ut,Rt,dt.data):e.texImage2D(i.TEXTURE_2D,et,mt,dt.width,dt.height,0,ut,Rt,dt.data);x.generateMipmaps=!1}else Ot?(Bt&&e.texStorage2D(i.TEXTURE_2D,ft,mt,nt.width,nt.height),F&&K(x,nt,ut,Rt)):e.texImage2D(i.TEXTURE_2D,0,mt,nt.width,nt.height,0,ut,Rt,nt.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Ot&&Bt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ft,mt,Pt[0].width,Pt[0].height,nt.depth);for(let et=0,pt=Pt.length;et<pt;et++)if(dt=Pt[et],x.format!==hn)if(ut!==null)if(Ot){if(F)if(x.layerUpdates.size>0){let vt=Lc(dt.width,dt.height,x.format,x.type);for(let rt of x.layerUpdates){let It=dt.data.subarray(rt*vt/dt.data.BYTES_PER_ELEMENT,(rt+1)*vt/dt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,et,0,0,rt,dt.width,dt.height,1,ut,It)}}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,et,0,0,0,dt.width,dt.height,nt.depth,ut,dt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,et,mt,dt.width,dt.height,nt.depth,0,dt.data,0,0);else Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ot?F&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,et,0,0,0,dt.width,dt.height,nt.depth,ut,Rt,dt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,et,mt,dt.width,dt.height,nt.depth,0,ut,Rt,dt.data);x.layerUpdates.size>0&&x.clearLayerUpdates()}else{Ot&&Bt&&e.texStorage2D(i.TEXTURE_2D,ft,mt,Pt[0].width,Pt[0].height);for(let et=0,pt=Pt.length;et<pt;et++)dt=Pt[et],x.format!==hn?ut!==null?Ot?F&&e.compressedTexSubImage2D(i.TEXTURE_2D,et,0,0,dt.width,dt.height,ut,dt.data):e.compressedTexImage2D(i.TEXTURE_2D,et,mt,dt.width,dt.height,0,dt.data):Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ot?F&&e.texSubImage2D(i.TEXTURE_2D,et,0,0,dt.width,dt.height,ut,Rt,dt.data):e.texImage2D(i.TEXTURE_2D,et,mt,dt.width,dt.height,0,ut,Rt,dt.data)}else if(x.isDataArrayTexture)if(Ot){if(Bt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ft,mt,nt.width,nt.height,nt.depth),F)if(x.layerUpdates.size>0){let et=Lc(nt.width,nt.height,x.format,x.type);for(let pt of x.layerUpdates){let vt=nt.data.subarray(pt*et/nt.data.BYTES_PER_ELEMENT,(pt+1)*et/nt.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,pt,nt.width,nt.height,1,ut,Rt,vt)}x.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,nt.width,nt.height,nt.depth,ut,Rt,nt.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,mt,nt.width,nt.height,nt.depth,0,ut,Rt,nt.data);else if(x.isData3DTexture)Ot?(Bt&&e.texStorage3D(i.TEXTURE_3D,ft,mt,nt.width,nt.height,nt.depth),F&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,nt.width,nt.height,nt.depth,ut,Rt,nt.data)):e.texImage3D(i.TEXTURE_3D,0,mt,nt.width,nt.height,nt.depth,0,ut,Rt,nt.data);else if(x.isFramebufferTexture){if(Bt)if(Ot)e.texStorage2D(i.TEXTURE_2D,ft,mt,nt.width,nt.height);else{let et=nt.width,pt=nt.height;for(let vt=0;vt<ft;vt++)e.texImage2D(i.TEXTURE_2D,vt,mt,et,pt,0,ut,Rt,null),et>>=1,pt>>=1}}else if(x.isHTMLTexture){if("texElementImage2D"in i){let et=i.canvas;if(et.hasAttribute("layoutsubtree")||et.setAttribute("layoutsubtree","true"),nt.parentNode!==et){et.appendChild(nt),f.add(x),et.onpaint=pt=>{let vt=pt.changedElements;for(let rt of f)vt.includes(rt.image)&&(rt.needsUpdate=!0)},et.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,nt);else{let vt=i.RGBA,rt=i.RGBA,It=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,vt,rt,It,nt)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Pt.length>0){if(Ot&&Bt){let et=se(Pt[0]);e.texStorage2D(i.TEXTURE_2D,ft,mt,et.width,et.height)}for(let et=0,pt=Pt.length;et<pt;et++)dt=Pt[et],Ot?F&&e.texSubImage2D(i.TEXTURE_2D,et,0,0,ut,Rt,dt):e.texImage2D(i.TEXTURE_2D,et,mt,ut,Rt,dt);x.generateMipmaps=!1}else if(Ot){if(Bt){let et=se(nt);e.texStorage2D(i.TEXTURE_2D,ft,mt,et.width,et.height)}F&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,ut,Rt,nt)}else e.texImage2D(i.TEXTURE_2D,0,mt,ut,Rt,nt);d(x)&&M(q),ht.__version=at.version,x.onUpdate&&x.onUpdate(x)}R.__version=x.version}function wt(R,x,z){if(x.image.length!==6)return;let q=bt(R,x),j=x.source;e.bindTexture(i.TEXTURE_CUBE_MAP,R.__webglTexture,i.TEXTURE0+z);let at=n.get(j);if(j.version!==at.__version||q===!0){e.activeTexture(i.TEXTURE0+z);let ht=Zt.getPrimaries(Zt.workingColorSpace),Q=x.colorSpace===qn?null:Zt.getPrimaries(x.colorSpace),nt=x.colorSpace===qn||ht===Q?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,nt);let ut=x.isCompressedTexture||x.image[0].isCompressedTexture,Rt=x.image[0]&&x.image[0].isDataTexture,mt=[];for(let rt=0;rt<6;rt++)!ut&&!Rt?mt[rt]=m(x.image[rt],!0,s.maxCubemapSize):mt[rt]=Rt?x.image[rt].image:x.image[rt],mt[rt]=De(x,mt[rt]);let dt=mt[0],Pt=r.convert(x.format,x.colorSpace),Ot=r.convert(x.type),Bt=v(x.internalFormat,Pt,Ot,x.normalized,x.colorSpace),F=x.isVideoTexture!==!0,ft=at.__version===void 0||q===!0,et=j.dataReady,pt=S(x,dt);lt(i.TEXTURE_CUBE_MAP,x);let vt;if(ut){F&&ft&&e.texStorage2D(i.TEXTURE_CUBE_MAP,pt,Bt,dt.width,dt.height);for(let rt=0;rt<6;rt++){vt=mt[rt].mipmaps;for(let It=0;It<vt.length;It++){let At=vt[It];x.format!==hn?Pt!==null?F?et&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,0,0,At.width,At.height,Pt,At.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,Bt,At.width,At.height,0,At.data):Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):F?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,0,0,At.width,At.height,Pt,Ot,At.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,Bt,At.width,At.height,0,Pt,Ot,At.data)}}}else{if(vt=x.mipmaps,F&&ft){vt.length>0&&pt++;let rt=se(mt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,pt,Bt,rt.width,rt.height)}for(let rt=0;rt<6;rt++)if(Rt){F?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,0,0,mt[rt].width,mt[rt].height,Pt,Ot,mt[rt].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,Bt,mt[rt].width,mt[rt].height,0,Pt,Ot,mt[rt].data);for(let It=0;It<vt.length;It++){let le=vt[It].image[rt].image;F?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,0,0,le.width,le.height,Pt,Ot,le.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,Bt,le.width,le.height,0,Pt,Ot,le.data)}}else{F?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,0,0,Pt,Ot,mt[rt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,Bt,Pt,Ot,mt[rt]);for(let It=0;It<vt.length;It++){let At=vt[It];F?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,0,0,Pt,Ot,At.image[rt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,Bt,Pt,Ot,At.image[rt])}}}d(x)&&M(i.TEXTURE_CUBE_MAP),at.__version=j.version,x.onUpdate&&x.onUpdate(x)}R.__version=x.version}function _t(R,x,z,q,j,at){let ht=r.convert(z.format,z.colorSpace),Q=r.convert(z.type),nt=v(z.internalFormat,ht,Q,z.normalized,z.colorSpace),ut=n.get(x),Rt=n.get(z);if(Rt.__renderTarget=x,!ut.__hasExternalTextures){let mt=Math.max(1,x.width>>at),dt=Math.max(1,x.height>>at);j===i.TEXTURE_3D||j===i.TEXTURE_2D_ARRAY?e.texImage3D(j,at,nt,mt,dt,x.depth,0,ht,Q,null):e.texImage2D(j,at,nt,mt,dt,0,ht,Q,null)}e.bindFramebuffer(i.FRAMEBUFFER,R),Me(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,q,j,Rt.__webglTexture,0,ge(x)):(j===i.TEXTURE_2D||j>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&j<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,q,j,Rt.__webglTexture,at),e.bindFramebuffer(i.FRAMEBUFFER,null)}function zt(R,x,z){if(i.bindRenderbuffer(i.RENDERBUFFER,R),x.depthBuffer){let q=x.depthTexture,j=q&&q.isDepthTexture?q.type:null,at=b(x.stencilBuffer,j),ht=x.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;Me(x)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ge(x),at,x.width,x.height):z?i.renderbufferStorageMultisample(i.RENDERBUFFER,ge(x),at,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,at,x.width,x.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ht,i.RENDERBUFFER,R)}else{let q=x.textures;for(let j=0;j<q.length;j++){let at=q[j],ht=r.convert(at.format,at.colorSpace),Q=r.convert(at.type),nt=v(at.internalFormat,ht,Q,at.normalized,at.colorSpace);Me(x)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ge(x),nt,x.width,x.height):z?i.renderbufferStorageMultisample(i.RENDERBUFFER,ge(x),nt,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,nt,x.width,x.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Ee(R,x,z){let q=x.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,R),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let j=n.get(x.depthTexture);if(j.__renderTarget=x,(!j.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),q){if(j.__webglInit===void 0&&(j.__webglInit=!0,x.depthTexture.addEventListener("dispose",A)),j.__webglTexture===void 0){j.__webglTexture=i.createTexture(),e.bindTexture(i.TEXTURE_CUBE_MAP,j.__webglTexture),lt(i.TEXTURE_CUBE_MAP,x.depthTexture);let ut=r.convert(x.depthTexture.format),Rt=r.convert(x.depthTexture.type),mt;x.depthTexture.format===An?mt=i.DEPTH_COMPONENT24:x.depthTexture.format===gi&&(mt=i.DEPTH24_STENCIL8);for(let dt=0;dt<6;dt++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+dt,0,mt,x.width,x.height,0,ut,Rt,null)}}else J(x.depthTexture,0);let at=j.__webglTexture,ht=ge(x),Q=q?i.TEXTURE_CUBE_MAP_POSITIVE_X+z:i.TEXTURE_2D,nt=x.depthTexture.format===gi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(x.depthTexture.format===An)Me(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,nt,Q,at,0,ht):i.framebufferTexture2D(i.FRAMEBUFFER,nt,Q,at,0);else if(x.depthTexture.format===gi)Me(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,nt,Q,at,0,ht):i.framebufferTexture2D(i.FRAMEBUFFER,nt,Q,at,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Xt(R){let x=n.get(R),z=R.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==R.depthTexture){let q=R.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),q){let j=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,q.removeEventListener("dispose",j)};q.addEventListener("dispose",j),x.__depthDisposeCallback=j}x.__boundDepthTexture=q}if(R.depthTexture&&!x.__autoAllocateDepthBuffer)if(z)for(let q=0;q<6;q++)Ee(x.__webglFramebuffer[q],R,q);else{let q=R.texture.mipmaps;q&&q.length>0?Ee(x.__webglFramebuffer[0],R,0):Ee(x.__webglFramebuffer,R,0)}else if(z){x.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[q]),x.__webglDepthbuffer[q]===void 0)x.__webglDepthbuffer[q]=i.createRenderbuffer(),zt(x.__webglDepthbuffer[q],R,!1);else{let j=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=x.__webglDepthbuffer[q];i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,j,i.RENDERBUFFER,at)}}else{let q=R.texture.mipmaps;if(q&&q.length>0?e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=i.createRenderbuffer(),zt(x.__webglDepthbuffer,R,!1);else{let j=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=x.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,j,i.RENDERBUFFER,at)}}e.bindFramebuffer(i.FRAMEBUFFER,null)}function Kt(R,x,z){let q=n.get(R);x!==void 0&&_t(q.__webglFramebuffer,R,R.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),z!==void 0&&Xt(R)}function ae(R){let x=R.texture,z=n.get(R),q=n.get(x);R.addEventListener("dispose",y);let j=R.textures,at=R.isWebGLCubeRenderTarget===!0,ht=j.length>1;if(ht||(q.__webglTexture===void 0&&(q.__webglTexture=i.createTexture()),q.__version=x.version,o.memory.textures++),at){z.__webglFramebuffer=[];for(let Q=0;Q<6;Q++)if(x.mipmaps&&x.mipmaps.length>0){z.__webglFramebuffer[Q]=[];for(let nt=0;nt<x.mipmaps.length;nt++)z.__webglFramebuffer[Q][nt]=i.createFramebuffer()}else z.__webglFramebuffer[Q]=i.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){z.__webglFramebuffer=[];for(let Q=0;Q<x.mipmaps.length;Q++)z.__webglFramebuffer[Q]=i.createFramebuffer()}else z.__webglFramebuffer=i.createFramebuffer();if(ht)for(let Q=0,nt=j.length;Q<nt;Q++){let ut=n.get(j[Q]);ut.__webglTexture===void 0&&(ut.__webglTexture=i.createTexture(),o.memory.textures++)}if(R.samples>0&&Me(R)===!1){z.__webglMultisampledFramebuffer=i.createFramebuffer(),z.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let Q=0;Q<j.length;Q++){let nt=j[Q];z.__webglColorRenderbuffer[Q]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,z.__webglColorRenderbuffer[Q]);let ut=r.convert(nt.format,nt.colorSpace),Rt=r.convert(nt.type),mt=v(nt.internalFormat,ut,Rt,nt.normalized,nt.colorSpace,R.isXRRenderTarget===!0),dt=ge(R);i.renderbufferStorageMultisample(i.RENDERBUFFER,dt,mt,R.width,R.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Q,i.RENDERBUFFER,z.__webglColorRenderbuffer[Q])}i.bindRenderbuffer(i.RENDERBUFFER,null),R.depthBuffer&&(z.__webglDepthRenderbuffer=i.createRenderbuffer(),zt(z.__webglDepthRenderbuffer,R,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(at){e.bindTexture(i.TEXTURE_CUBE_MAP,q.__webglTexture),lt(i.TEXTURE_CUBE_MAP,x);for(let Q=0;Q<6;Q++)if(x.mipmaps&&x.mipmaps.length>0)for(let nt=0;nt<x.mipmaps.length;nt++)_t(z.__webglFramebuffer[Q][nt],R,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,nt);else _t(z.__webglFramebuffer[Q],R,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0);d(x)&&M(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(ht){for(let Q=0,nt=j.length;Q<nt;Q++){let ut=j[Q],Rt=n.get(ut),mt=i.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(mt=R.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(mt,Rt.__webglTexture),lt(mt,ut),_t(z.__webglFramebuffer,R,ut,i.COLOR_ATTACHMENT0+Q,mt,0),d(ut)&&M(mt)}e.unbindTexture()}else{let Q=i.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(Q=R.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(Q,q.__webglTexture),lt(Q,x),x.mipmaps&&x.mipmaps.length>0)for(let nt=0;nt<x.mipmaps.length;nt++)_t(z.__webglFramebuffer[nt],R,x,i.COLOR_ATTACHMENT0,Q,nt);else _t(z.__webglFramebuffer,R,x,i.COLOR_ATTACHMENT0,Q,0);d(x)&&M(Q),e.unbindTexture()}R.depthBuffer&&Xt(R)}function Yt(R){let x=R.textures;for(let z=0,q=x.length;z<q;z++){let j=x[z];if(d(j)){let at=E(R),ht=n.get(j).__webglTexture;e.bindTexture(at,ht),M(at),e.unbindTexture()}}}let pe=[],Ce=[];function qe(R){if(R.samples>0){if(Me(R)===!1){let x=R.textures,z=R.width,q=R.height,j=i.COLOR_BUFFER_BIT,at=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ht=n.get(R),Q=x.length>1;if(Q)for(let ut=0;ut<x.length;ut++)e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,ht.__webglMultisampledFramebuffer);let nt=R.texture.mipmaps;nt&&nt.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglFramebuffer);for(let ut=0;ut<x.length;ut++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(j|=i.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(j|=i.STENCIL_BUFFER_BIT)),Q){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ht.__webglColorRenderbuffer[ut]);let Rt=n.get(x[ut]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Rt,0)}i.blitFramebuffer(0,0,z,q,0,0,z,q,j,i.NEAREST),l===!0&&(pe.length=0,Ce.length=0,pe.push(i.COLOR_ATTACHMENT0+ut),R.depthBuffer&&R.storeMultisampledDepthBuffer===!1&&(pe.push(at),Ce.push(at),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Ce)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,pe))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),Q)for(let ut=0;ut<x.length;ut++){e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.RENDERBUFFER,ht.__webglColorRenderbuffer[ut]);let Rt=n.get(x[ut]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.TEXTURE_2D,Rt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.storeMultisampledDepthBuffer===!1&&l){let x=R.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[x])}}}function ge(R){return Math.min(s.maxSamples,R.samples)}function Me(R){let x=n.get(R);return R.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function B(R){let x=o.render.frame;h.get(R)!==x&&(h.set(R,x),R.update())}function De(R,x){let z=R.colorSpace,q=R.format,j=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||z!==lr&&z!==qn&&(Zt.getTransfer(z)===ee?(q!==hn||j!==$e)&&Lt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Dt("WebGLTextures: Unsupported texture color space:",z)),x}function se(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=U,this.resetTextureUnits=N,this.getTextureUnits=P,this.setTextureUnits=O,this.setTexture2D=J,this.setTexture2DArray=Z,this.setTexture3D=tt,this.setTextureCube=it,this.rebindTextures=Kt,this.setupRenderTarget=ae,this.updateRenderTargetMipmap=Yt,this.updateMultisampleRenderTarget=qe,this.setupDepthRenderbuffer=Xt,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=Me,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function qx(i,t){function e(n,s=qn){let r,o=Zt.getTransfer(s);if(n===$e)return i.UNSIGNED_BYTE;if(n===ca)return i.UNSIGNED_SHORT_4_4_4_4;if(n===ha)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Sc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===bc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===vc)return i.BYTE;if(n===Mc)return i.SHORT;if(n===Ts)return i.UNSIGNED_SHORT;if(n===la)return i.INT;if(n===vn)return i.UNSIGNED_INT;if(n===cn)return i.FLOAT;if(n===Mn)return i.HALF_FLOAT;if(n===wc)return i.ALPHA;if(n===Ec)return i.RGB;if(n===hn)return i.RGBA;if(n===An)return i.DEPTH_COMPONENT;if(n===gi)return i.DEPTH_STENCIL;if(n===ua)return i.RED;if(n===da)return i.RED_INTEGER;if(n===_i)return i.RG;if(n===fa)return i.RG_INTEGER;if(n===pa)return i.RGBA_INTEGER;if(n===Pr||n===Ir||n===Lr||n===Ur)if(o===ee)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Pr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Ir)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Lr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Ur)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Pr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Ir)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Lr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Ur)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===ma||n===ga||n===_a||n===xa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===ma)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===ga)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===_a)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===xa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===ya||n===va||n===Ma||n===Sa||n===ba||n===Or||n===wa)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===ya||n===va)return o===ee?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Ma)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Sa)return r.COMPRESSED_R11_EAC;if(n===ba)return r.COMPRESSED_SIGNED_R11_EAC;if(n===Or)return r.COMPRESSED_RG11_EAC;if(n===wa)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Ea||n===Ta||n===Aa||n===Ca||n===Ra||n===Pa||n===Ia||n===La||n===Ua||n===Oa||n===Da||n===Na||n===Fa||n===Ba)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Ea)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Ta)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Aa)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Ca)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ra)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Pa)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Ia)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===La)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Ua)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Oa)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Da)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Na)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Fa)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Ba)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===ka||n===za||n===Va)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===ka)return o===ee?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===za)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Va)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Ha||n===Ga||n===Dr||n===Wa)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===Ha)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ga)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Dr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Wa)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===As?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var Yx=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Zx=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,qc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new xr(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new We({vertexShader:Yx,fragmentShader:Zx,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new ze(new Ni(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Yc=class extends Cn{constructor(t,e){super();let n=this,s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,f=null,u=null,p=null,g=null,_=typeof XRWebGLBinding<"u",m=new qc,d={},M=e.getContextAttributes(),E=null,v=null,b=[],S=[],A=new Ht,y=null,T=null,C=new Ye;C.viewport=new he;let I=new Ye;I.viewport=new he;let L=[C,I],N=new sa,P=null,O=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(X){let K=b[X];return K===void 0&&(K=new ys,b[X]=K),K.getTargetRaySpace()},this.getControllerGrip=function(X){let K=b[X];return K===void 0&&(K=new ys,b[X]=K),K.getGripSpace()},this.getHand=function(X){let K=b[X];return K===void 0&&(K=new ys,b[X]=K),K.getHandSpace()};function U(X){let K=S.indexOf(X.inputSource);if(K===-1)return;let ot=b[K];ot!==void 0&&(ot.update(X.inputSource,X.frame,c||o),ot.dispatchEvent({type:X.type,data:X.inputSource}))}function V(){s.removeEventListener("select",U),s.removeEventListener("selectstart",U),s.removeEventListener("selectend",U),s.removeEventListener("squeeze",U),s.removeEventListener("squeezestart",U),s.removeEventListener("squeezeend",U),s.removeEventListener("end",V),s.removeEventListener("inputsourceschange",J);for(let X=0;X<b.length;X++){let K=S[X];K!==null&&(S[X]=null,b[X].disconnect(K))}P=null,O=null,m.reset();for(let X in d)delete d[X];if(t.setRenderTarget(E),p=null,u=null,f=null,s=null,v=null,bt.stop(),n.isPresenting=!1,t.setPixelRatio(y),t.setSize(A.width,A.height,!1),T!==null){let X=T.camera;X.fov=T.fov,X.zoom=T.zoom,X.updateProjectionMatrix(),T=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(X){r=X,n.isPresenting===!0&&Lt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(X){a=X,n.isPresenting===!0&&Lt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(X){c=X},this.getBaseLayer=function(){return u!==null?u:p},this.getBinding=function(){return f===null&&_&&(f=new XRWebGLBinding(s,e)),f},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(X){if(s=X,s!==null){if(E=t.getRenderTarget(),s.addEventListener("select",U),s.addEventListener("selectstart",U),s.addEventListener("selectend",U),s.addEventListener("squeeze",U),s.addEventListener("squeezestart",U),s.addEventListener("squeezeend",U),s.addEventListener("end",V),s.addEventListener("inputsourceschange",J),M.xrCompatible!==!0&&await e.makeXRCompatible(),y=t.getPixelRatio(),t.getSize(A),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let ot=null,wt=null,_t=null;M.depth&&(_t=M.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,ot=M.stencil?gi:An,wt=M.stencil?As:vn);let zt={colorFormat:e.RGBA8,depthFormat:_t,scaleFactor:r};f=this.getBinding(),u=f.createProjectionLayer(zt),s.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),v=new Ze(u.textureWidth,u.textureHeight,{format:hn,type:$e,depthTexture:new oi(u.textureWidth,u.textureHeight,wt,void 0,void 0,void 0,void 0,void 0,void 0,ot),stencilBuffer:M.stencil,colorSpace:t.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let ot={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,e,ot),s.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),v=new Ze(p.framebufferWidth,p.framebufferHeight,{format:hn,type:$e,colorSpace:t.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1,storeMultisampledDepthBuffer:p.ignoreDepthValues===!1,storeMultisampledStencilBuffer:p.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),bt.setContext(s),bt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function J(X){for(let K=0;K<X.removed.length;K++){let ot=X.removed[K],wt=S.indexOf(ot);wt>=0&&(S[wt]=null,b[wt].disconnect(ot))}for(let K=0;K<X.added.length;K++){let ot=X.added[K],wt=S.indexOf(ot);if(wt===-1){for(let zt=0;zt<b.length;zt++)if(zt>=S.length){S.push(ot),wt=zt;break}else if(S[zt]===null){S[zt]=ot,wt=zt;break}if(wt===-1)break}let _t=b[wt];_t&&_t.connect(ot)}}let Z=new k,tt=new k;function it(X,K,ot){Z.setFromMatrixPosition(K.matrixWorld),tt.setFromMatrixPosition(ot.matrixWorld);let wt=Z.distanceTo(tt),_t=K.projectionMatrix.elements,zt=ot.projectionMatrix.elements,Ee=_t[14]/(_t[10]-1),Xt=_t[14]/(_t[10]+1),Kt=(_t[9]+1)/_t[5],ae=(_t[9]-1)/_t[5],Yt=(_t[8]-1)/_t[0],pe=(zt[8]+1)/zt[0],Ce=Ee*Yt,qe=Ee*pe,ge=wt/(-Yt+pe),Me=ge*-Yt;if(K.matrixWorld.decompose(X.position,X.quaternion,X.scale),X.translateX(Me),X.translateZ(ge),X.matrixWorld.compose(X.position,X.quaternion,X.scale),X.matrixWorldInverse.copy(X.matrixWorld).invert(),_t[10]===-1)X.projectionMatrix.copy(K.projectionMatrix),X.projectionMatrixInverse.copy(K.projectionMatrixInverse);else{let B=Ee+ge,De=Xt+ge,se=Ce-Me,R=qe+(wt-Me),x=Kt*Xt/De*B,z=ae*Xt/De*B;X.projectionMatrix.makePerspective(se,R,x,z,B,De),X.projectionMatrixInverse.copy(X.projectionMatrix).invert()}}function W(X,K){K===null?X.matrixWorld.copy(X.matrix):X.matrixWorld.multiplyMatrices(K.matrixWorld,X.matrix),X.matrixWorldInverse.copy(X.matrixWorld).invert()}this.updateCamera=function(X){if(s===null)return;let K=X.near,ot=X.far;m.texture!==null&&(m.depthNear>0&&(K=m.depthNear),m.depthFar>0&&(ot=m.depthFar)),N.near=I.near=C.near=K,N.far=I.far=C.far=ot,(P!==N.near||O!==N.far)&&(s.updateRenderState({depthNear:N.near,depthFar:N.far}),P=N.near,O=N.far),N.layers.mask=X.layers.mask|6,C.layers.mask=N.layers.mask&-5,I.layers.mask=N.layers.mask&-3;let wt=X.parent,_t=N.cameras;W(N,wt);for(let zt=0;zt<_t.length;zt++)W(_t[zt],wt);_t.length===2?it(N,C,I):N.projectionMatrix.copy(C.projectionMatrix),T===null&&X.isPerspectiveCamera&&(T={camera:X,fov:X.fov,zoom:X.zoom}),st(X,N,wt)};function st(X,K,ot){ot===null?X.matrix.copy(K.matrixWorld):(X.matrix.copy(ot.matrixWorld),X.matrix.invert(),X.matrix.multiply(K.matrixWorld)),X.matrix.decompose(X.position,X.quaternion,X.scale),X.updateMatrixWorld(!0),X.projectionMatrix.copy(K.projectionMatrix),X.projectionMatrixInverse.copy(K.projectionMatrixInverse),X.isPerspectiveCamera&&(X.fov=gs*2*Math.atan(1/X.projectionMatrix.elements[5]),X.zoom=1)}this.getCamera=function(){return N},this.getFoveation=function(){if(!(u===null&&p===null))return l},this.setFoveation=function(X){l=X,u!==null&&(u.fixedFoveation=X),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=X)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(N)},this.getCameraTexture=function(X){return d[X]};let ct=null;function lt(X,K){if(h=K.getViewerPose(c||o),g=K,h!==null){let ot=h.views;p!==null&&(t.setRenderTargetFramebuffer(v,p.framebuffer),t.setRenderTarget(v));let wt=!1;ot.length!==N.cameras.length&&(N.cameras.length=0,wt=!0);for(let Xt=0;Xt<ot.length;Xt++){let Kt=ot[Xt],ae=null;if(p!==null)ae=p.getViewport(Kt);else{let pe=f.getViewSubImage(u,Kt);ae=pe.viewport,Xt===0&&(t.setRenderTargetTextures(v,pe.colorTexture,pe.depthStencilTexture),t.setRenderTarget(v))}let Yt=L[Xt];Yt===void 0&&(Yt=new Ye,Yt.layers.enable(Xt),Yt.viewport=new he,L[Xt]=Yt),Yt.matrix.fromArray(Kt.transform.matrix),Yt.matrix.decompose(Yt.position,Yt.quaternion,Yt.scale),Yt.projectionMatrix.fromArray(Kt.projectionMatrix),Yt.projectionMatrixInverse.copy(Yt.projectionMatrix).invert(),Yt.viewport.set(ae.x,ae.y,ae.width,ae.height),Xt===0&&(N.matrix.copy(Yt.matrix),N.matrix.decompose(N.position,N.quaternion,N.scale)),wt===!0&&N.cameras.push(Yt)}let _t=s.enabledFeatures;if(_t&&_t.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&_){f=n.getBinding();let Xt=f.getDepthInformation(ot[0]);Xt&&Xt.isValid&&Xt.texture&&m.init(Xt,s.renderState)}if(_t&&_t.includes("camera-access")&&_){t.state.unbindTexture(),f=n.getBinding();for(let Xt=0;Xt<ot.length;Xt++){let Kt=ot[Xt].camera;if(Kt){let ae=d[Kt];ae||(ae=new xr,d[Kt]=ae);let Yt=f.getCameraImage(Kt);ae.sourceTexture=Yt}}}}for(let ot=0;ot<b.length;ot++){let wt=S[ot],_t=b[ot];wt!==null&&_t!==void 0&&_t.update(wt,K,c||o)}ct&&ct(X,K),K.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:K}),g=null}let bt=new Od;bt.setAnimationLoop(lt),this.setAnimationLoop=function(X){ct=X},this.dispose=function(){}}},$x=new ne,zd=new Ft;zd.set(-1,0,0,0,1,0,0,0,1);function Kx(i,t){function e(m,d){m.matrixAutoUpdate===!0&&m.updateMatrix(),d.value.copy(m.matrix)}function n(m,d){d.color.getRGB(m.fogColor.value,Rc(i)),d.isFog?(m.fogNear.value=d.near,m.fogFar.value=d.far):d.isFogExp2&&(m.fogDensity.value=d.density)}function s(m,d,M,E,v){d.isNodeMaterial?d.uniformsNeedUpdate=!1:d.isMeshBasicMaterial?r(m,d):d.isMeshLambertMaterial?(r(m,d),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)):d.isMeshToonMaterial?(r(m,d),f(m,d)):d.isMeshPhongMaterial?(r(m,d),h(m,d),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)):d.isMeshStandardMaterial?(r(m,d),u(m,d),d.isMeshPhysicalMaterial&&p(m,d,v)):d.isMeshMatcapMaterial?(r(m,d),g(m,d)):d.isMeshDepthMaterial?r(m,d):d.isMeshDistanceMaterial?(r(m,d),_(m,d)):d.isMeshNormalMaterial?r(m,d):d.isLineBasicMaterial?(o(m,d),d.isLineDashedMaterial&&a(m,d)):d.isPointsMaterial?l(m,d,M,E):d.isSpriteMaterial?c(m,d):d.isShadowMaterial?(m.color.value.copy(d.color),m.opacity.value=d.opacity):d.isShaderMaterial&&(d.uniformsNeedUpdate=!1)}function r(m,d){m.opacity.value=d.opacity,d.color&&m.diffuse.value.copy(d.color),d.emissive&&m.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity),d.map&&(m.map.value=d.map,e(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.bumpMap&&(m.bumpMap.value=d.bumpMap,e(d.bumpMap,m.bumpMapTransform),m.bumpScale.value=d.bumpScale,d.side===Xe&&(m.bumpScale.value*=-1)),d.normalMap&&(m.normalMap.value=d.normalMap,e(d.normalMap,m.normalMapTransform),m.normalScale.value.copy(d.normalScale),d.side===Xe&&m.normalScale.value.negate()),d.displacementMap&&(m.displacementMap.value=d.displacementMap,e(d.displacementMap,m.displacementMapTransform),m.displacementScale.value=d.displacementScale,m.displacementBias.value=d.displacementBias),d.emissiveMap&&(m.emissiveMap.value=d.emissiveMap,e(d.emissiveMap,m.emissiveMapTransform)),d.specularMap&&(m.specularMap.value=d.specularMap,e(d.specularMap,m.specularMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest);let M=t.get(d),E=M.envMap,v=M.envMapRotation;E&&(m.envMap.value=E,m.envMapRotation.value.setFromMatrix4($x.makeRotationFromEuler(v)).transpose(),E.isCubeTexture&&E.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(zd),m.reflectivity.value=d.reflectivity,m.ior.value=d.ior,m.refractionRatio.value=d.refractionRatio),d.lightMap&&(m.lightMap.value=d.lightMap,m.lightMapIntensity.value=d.lightMapIntensity,e(d.lightMap,m.lightMapTransform)),d.aoMap&&(m.aoMap.value=d.aoMap,m.aoMapIntensity.value=d.aoMapIntensity,e(d.aoMap,m.aoMapTransform))}function o(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,d.map&&(m.map.value=d.map,e(d.map,m.mapTransform))}function a(m,d){m.dashSize.value=d.dashSize,m.totalSize.value=d.dashSize+d.gapSize,m.scale.value=d.scale}function l(m,d,M,E){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.size.value=d.size*M,m.scale.value=E*.5,d.map&&(m.map.value=d.map,e(d.map,m.uvTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function c(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.rotation.value=d.rotation,d.map&&(m.map.value=d.map,e(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function h(m,d){m.specular.value.copy(d.specular),m.shininess.value=Math.max(d.shininess,1e-4)}function f(m,d){d.gradientMap&&(m.gradientMap.value=d.gradientMap)}function u(m,d){m.metalness.value=d.metalness,d.metalnessMap&&(m.metalnessMap.value=d.metalnessMap,e(d.metalnessMap,m.metalnessMapTransform)),m.roughness.value=d.roughness,d.roughnessMap&&(m.roughnessMap.value=d.roughnessMap,e(d.roughnessMap,m.roughnessMapTransform)),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)}function p(m,d,M){m.ior.value=d.ior,d.sheen>0&&(m.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),m.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap&&(m.sheenColorMap.value=d.sheenColorMap,e(d.sheenColorMap,m.sheenColorMapTransform)),d.sheenRoughnessMap&&(m.sheenRoughnessMap.value=d.sheenRoughnessMap,e(d.sheenRoughnessMap,m.sheenRoughnessMapTransform))),d.clearcoat>0&&(m.clearcoat.value=d.clearcoat,m.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap&&(m.clearcoatMap.value=d.clearcoatMap,e(d.clearcoatMap,m.clearcoatMapTransform)),d.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,e(d.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),d.clearcoatNormalMap&&(m.clearcoatNormalMap.value=d.clearcoatNormalMap,e(d.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===Xe&&m.clearcoatNormalScale.value.negate())),d.dispersion>0&&(m.dispersion.value=d.dispersion),d.retroreflectivity>0&&(m.retroreflectivity.value=d.retroreflectivity),d.iridescence>0&&(m.iridescence.value=d.iridescence,m.iridescenceIOR.value=d.iridescenceIOR,m.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap&&(m.iridescenceMap.value=d.iridescenceMap,e(d.iridescenceMap,m.iridescenceMapTransform)),d.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=d.iridescenceThicknessMap,e(d.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),d.transmission>0&&(m.transmission.value=d.transmission,m.transmissionSamplerMap.value=M.texture,m.transmissionSamplerSize.value.set(M.width,M.height),d.transmissionMap&&(m.transmissionMap.value=d.transmissionMap,e(d.transmissionMap,m.transmissionMapTransform)),m.thickness.value=d.thickness,d.thicknessMap&&(m.thicknessMap.value=d.thicknessMap,e(d.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=d.attenuationDistance,m.attenuationColor.value.copy(d.attenuationColor)),d.anisotropy>0&&(m.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap&&(m.anisotropyMap.value=d.anisotropyMap,e(d.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=d.specularIntensity,m.specularColor.value.copy(d.specularColor),d.specularColorMap&&(m.specularColorMap.value=d.specularColorMap,e(d.specularColorMap,m.specularColorMapTransform)),d.specularIntensityMap&&(m.specularIntensityMap.value=d.specularIntensityMap,e(d.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,d){d.matcap&&(m.matcap.value=d.matcap)}function _(m,d){let M=t.get(d).light;m.referencePosition.value.setFromMatrixPosition(M.matrixWorld),m.nearDistance.value=M.shadow.camera.near,m.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Jx(i,t,e,n){let s={},r={},o=[],a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,b){let S=b.program;n.uniformBlockBinding(v,S)}function c(v,b){let S=s[v.id];S===void 0&&(m(v),S=h(v),s[v.id]=S,v.addEventListener("dispose",M));let A=b.program;n.updateUBOMapping(v,A);let y=t.render.frame;r[v.id]!==y&&(u(v),r[v.id]=y)}function h(v){let b=f();v.__bindingPointIndex=b;let S=i.createBuffer(),A=v.__size,y=v.usage;return i.bindBuffer(i.UNIFORM_BUFFER,S),i.bufferData(i.UNIFORM_BUFFER,A,y),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,b,S),S}function f(){for(let v=0;v<a;v++)if(o.indexOf(v)===-1)return o.push(v),v;return Dt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(v){let b=s[v.id],S=v.uniforms,A=v.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let y=0,T=S.length;y<T;y++){let C=S[y];if(Array.isArray(C))for(let I=0,L=C.length;I<L;I++)p(C[I],y,I,A);else p(C,y,0,A)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(v,b,S,A){if(_(v,b,S,A)===!0){let y=v.__offset,T=v.value;if(Array.isArray(T)){let C=0;for(let I=0;I<T.length;I++){let L=T[I],N=d(L);g(L,v.__data,C),typeof L!="number"&&typeof L!="boolean"&&!L.isMatrix3&&!ArrayBuffer.isView(L)&&(C+=N.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(T,v.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,y,v.__data)}}function g(v,b,S){typeof v=="number"||typeof v=="boolean"?b[0]=v:v.isMatrix3?(b[0]=v.elements[0],b[1]=v.elements[1],b[2]=v.elements[2],b[3]=0,b[4]=v.elements[3],b[5]=v.elements[4],b[6]=v.elements[5],b[7]=0,b[8]=v.elements[6],b[9]=v.elements[7],b[10]=v.elements[8],b[11]=0):ArrayBuffer.isView(v)?b.set(new v.constructor(v.buffer,v.byteOffset,b.length)):v.toArray(b,S)}function _(v,b,S,A){let y=v.value,T=b+"_"+S;if(A[T]===void 0)return typeof y=="number"||typeof y=="boolean"?A[T]=y:ArrayBuffer.isView(y)?A[T]=y.slice():A[T]=y.clone(),!0;{let C=A[T];if(typeof y=="number"||typeof y=="boolean"){if(C!==y)return A[T]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(C.equals(y)===!1)return C.copy(y),!0}}return!1}function m(v){let b=v.uniforms,S=0,A=16;for(let T=0,C=b.length;T<C;T++){let I=Array.isArray(b[T])?b[T]:[b[T]];for(let L=0,N=I.length;L<N;L++){let P=I[L],O=Array.isArray(P.value)?P.value:[P.value];for(let U=0,V=O.length;U<V;U++){let J=O[U],Z=d(J),tt=S%A,it=tt%Z.boundary,W=tt+it;S+=it,W!==0&&A-W<Z.storage&&(S+=A-W),P.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),P.__offset=S,S+=Z.storage}}}let y=S%A;return y>0&&(S+=A-y),v.__size=S,v.__cache={},this}function d(v){let b={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(b.boundary=4,b.storage=4):v.isVector2?(b.boundary=8,b.storage=8):v.isVector3||v.isColor?(b.boundary=16,b.storage=12):v.isVector4?(b.boundary=16,b.storage=16):v.isMatrix3?(b.boundary=48,b.storage=48):v.isMatrix4?(b.boundary=64,b.storage=64):v.isTexture?Lt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(b.boundary=16,b.storage=v.byteLength):Lt("WebGLRenderer: Unsupported uniform value type.",v),b}function M(v){let b=v.target;b.removeEventListener("dispose",M);let S=o.indexOf(b.__bindingPointIndex);o.splice(S,1),i.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function E(){for(let v in s)i.deleteBuffer(s[v]);o=[],s={},r={}}return{bind:l,update:c,dispose:E}}var jx=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Ln=null;function Qx(){return Ln===null&&(Ln=new mr(jx,16,16,_i,Mn),Ln.name="DFG_LUT",Ln.minFilter=Le,Ln.magFilter=Le,Ln.wrapS=Tn,Ln.wrapT=Tn,Ln.generateMipmaps=!1,Ln.needsUpdate=!0),Ln}var kr=class{constructor(t={}){let{canvas:e=rd(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:u=!1,outputBufferType:p=$e}=t;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=o;let _=p,m=new Set([pa,fa,da]),d=new Set([$e,vn,Ts,As,ca,ha]),M=new Uint32Array(4),E=new Int32Array(4),v=new k,b=null,S=null,A=[],y=[],T=null;this.domElement=e,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=yn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let C=this,I=!1,L=null,N=null,P=null,O=null;this._outputColorSpace=me;let U=0,V=0,J=null,Z=-1,tt=null,it=new he,W=new he,st=null,ct=new Ut(0),lt=0,bt=e.width,X=e.height,K=1,ot=null,wt=null,_t=new he(0,0,bt,X),zt=new he(0,0,bt,X),Ee=!1,Xt=new Ms,Kt=!1,ae=!1,Yt=new ne,pe=new k,Ce=new he,qe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ge=!1;function Me(){return J===null?K:1}let B=n;function De(w,D){return e.getContext(w,D)}let se,R,x,z,q,j,at,ht,Q,nt,ut,Rt,mt,dt,Pt,Ot,Bt,F,ft,et,pt,vt,rt;try{let w={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"186"}`),e.addEventListener("webglcontextlost",le,!1),e.addEventListener("webglcontextrestored",Qt,!1),e.addEventListener("webglcontextcreationerror",un,!1),B===null){let D="webgl2";if(B=De(D,w),B===null)throw De(D)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}It()}catch(w){throw e.removeEventListener("webglcontextlost",le,!1),e.removeEventListener("webglcontextrestored",Qt,!1),e.removeEventListener("webglcontextcreationerror",un,!1),Dt("WebGLRenderer: "+w.message),w}function It(){se=new o0(B),se.init(),pt=new qx(B,se),R=new K_(B,se,t,pt),x=new Wx(B,se),R.reversedDepthBuffer&&u&&x.buffers.depth.setReversed(!0),N=B.createFramebuffer(),P=B.createFramebuffer(),O=B.createFramebuffer(),z=new c0(B),q=new Px,j=new Xx(B,se,x,q,R,pt,z),at=new r0(C),ht=new um(B),vt=new Z_(B,ht),Q=new a0(B,ht,z,vt),nt=new u0(B,Q,ht,vt,z),F=new h0(B,R,j),Pt=new J_(q),ut=new Rx(C,at,se,R,vt,Pt),Rt=new Kx(C,q),mt=new Lx,dt=new Bx(se),Bt=new Y_(C,at,x,nt,g,l),Ot=new Gx(C,nt,R),rt=new Jx(B,z,R,x),ft=new $_(B,se,z),et=new l0(B,se,z),z.programs=ut.programs,C.capabilities=R,C.extensions=se,C.properties=q,C.renderLists=mt,C.shadowMap=Ot,C.state=x,C.info=z}_!==$e&&(T=new f0(_,e.width,e.height,a,s,r));let At=new Yc(C,B);this.xr=At,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let w=se.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){let w=se.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return K},this.setPixelRatio=function(w){w!==void 0&&(K=w,this.setSize(bt,X,!1))},this.getSize=function(w){return w.set(bt,X)},this.setSize=function(w,D,$=!0){if(At.isPresenting){Lt("WebGLRenderer: Can't change size while VR device is presenting.");return}bt=w,X=D,e.width=Math.floor(w*K),e.height=Math.floor(D*K),$===!0&&(e.style.width=w+"px",e.style.height=D+"px"),T!==null&&T.setSize(e.width,e.height),this.setViewport(0,0,w,D)},this.getDrawingBufferSize=function(w){return w.set(bt*K,X*K).floor()},this.setDrawingBufferSize=function(w,D,$){bt=w,X=D,K=$,e.width=Math.floor(w*$),e.height=Math.floor(D*$),this.setViewport(0,0,w,D)},this.setEffects=function(w){if(_===$e){Dt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(w){for(let D=0;D<w.length;D++)if(w[D].isOutputPass===!0){Lt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}T.setEffects(w||[])},this.getCurrentViewport=function(w){return w.copy(it)},this.getViewport=function(w){return w.copy(_t)},this.setViewport=function(w,D,$,H){w.isVector4?_t.set(w.x,w.y,w.z,w.w):_t.set(w,D,$,H),x.viewport(it.copy(_t).multiplyScalar(K).round())},this.getScissor=function(w){return w.copy(zt)},this.setScissor=function(w,D,$,H){w.isVector4?zt.set(w.x,w.y,w.z,w.w):zt.set(w,D,$,H),x.scissor(W.copy(zt).multiplyScalar(K).round())},this.getScissorTest=function(){return Ee},this.setScissorTest=function(w){x.setScissorTest(Ee=w)},this.setOpaqueSort=function(w){ot=w},this.setTransparentSort=function(w){wt=w},this.getClearColor=function(w){return w.copy(Bt.getClearColor())},this.setClearColor=function(){Bt.setClearColor(...arguments)},this.getClearAlpha=function(){return Bt.getClearAlpha()},this.setClearAlpha=function(){Bt.setClearAlpha(...arguments)},this.clear=function(w=!0,D=!0,$=!0){let H=0;if(w){let G=!1;if(J!==null){let yt=J.texture.format;G=m.has(yt)}if(G){let yt=J.texture.type,St=d.has(yt),xt=Bt.getClearColor(),Et=Bt.getClearAlpha(),Ct=xt.r,Vt=xt.g,qt=xt.b;St?(M[0]=Ct,M[1]=Vt,M[2]=qt,M[3]=Et,B.clearBufferuiv(B.COLOR,0,M)):(E[0]=Ct,E[1]=Vt,E[2]=qt,E[3]=Et,B.clearBufferiv(B.COLOR,0,E))}else H|=B.COLOR_BUFFER_BIT}D&&(H|=B.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),$&&(H|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),H!==0&&B.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(w){w.setRenderer(this),L=w},this.dispose=function(){e.removeEventListener("webglcontextlost",le,!1),e.removeEventListener("webglcontextrestored",Qt,!1),e.removeEventListener("webglcontextcreationerror",un,!1),Bt.dispose(),mt.dispose(),dt.dispose(),q.dispose(),at.dispose(),nt.dispose(),vt.dispose(),rt.dispose(),ut.dispose(),At.dispose(),At.removeEventListener("sessionstart",Eh),At.removeEventListener("sessionend",Th),Ei.stop()};function le(w){w.preventDefault(),Ac("WebGLRenderer: Context Lost."),I=!0}function Qt(){Ac("WebGLRenderer: Context Restored."),I=!1;let w=z.autoReset,D=Ot.enabled,$=Ot.autoUpdate,H=Ot.needsUpdate,G=Ot.type;It(),z.autoReset=w,Ot.enabled=D,Ot.autoUpdate=$,Ot.needsUpdate=H,Ot.type=G}function un(w){Dt("WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function bn(w){let D=w.target;D.removeEventListener("dispose",bn),Yf(D)}function Yf(w){Zf(w),q.remove(w)}function Zf(w){let D=q.get(w).programs;D!==void 0&&(D.forEach(function($){ut.releaseProgram($)}),w.isShaderMaterial&&ut.releaseShaderCache(w))}this.renderBufferDirect=function(w,D,$,H,G,yt){D===null&&(D=qe);let St=G.isMesh&&G.matrixWorld.determinantAffine()<0,xt=Jf(w,D,$,H,G);x.setMaterial(H,St);let Et=$.index,Ct=1;if(H.wireframe===!0){if(Et=Q.getWireframeAttribute($),Et===void 0)return;Ct=2}let Vt=$.drawRange,qt=$.attributes.position,Tt=Vt.start*Ct,te=(Vt.start+Vt.count)*Ct;yt!==null&&(Tt=Math.max(Tt,yt.start*Ct),te=Math.min(te,(yt.start+yt.count)*Ct)),Et!==null?(Tt=Math.max(Tt,0),te=Math.min(te,Et.count)):qt!=null&&(Tt=Math.max(Tt,0),te=Math.min(te,qt.count));let Se=te-Tt;if(Se<0||Se===1/0)return;vt.setup(G,H,xt,$,Et);let de,oe=ft;if(Et!==null&&(de=ht.get(Et),oe=et,oe.setIndex(de)),G.isMesh)H.wireframe===!0?(x.setLineWidth(H.wireframeLinewidth*Me()),oe.setMode(B.LINES)):oe.setMode(B.TRIANGLES);else if(G.isLine){let Ne=H.linewidth;Ne===void 0&&(Ne=1),x.setLineWidth(Ne*Me()),G.isLineSegments?oe.setMode(B.LINES):G.isLineLoop?oe.setMode(B.LINE_LOOP):oe.setMode(B.LINE_STRIP)}else G.isPoints?oe.setMode(B.POINTS):G.isSprite&&oe.setMode(B.TRIANGLES);if(G.isBatchedMesh)if(se.get("WEBGL_multi_draw"))oe.renderMultiDraw(G._multiDrawStarts,G._multiDrawCounts,G._multiDrawCount);else{let Ne=G._multiDrawStarts,Mt=G._multiDrawCounts,He=G._multiDrawCount,$t=Et?ht.get(Et).bytesPerElement:1,rn=q.get(H).currentProgram.getUniforms();for(let wn=0;wn<He;wn++)rn.setValue(B,"_gl_DrawID",wn),oe.render(Ne[wn]/$t,Mt[wn])}else if(G.isInstancedMesh)oe.renderInstances(Tt,Se,G.count);else if($.isInstancedBufferGeometry){let Ne=$._maxInstanceCount!==void 0?$._maxInstanceCount:1/0,Mt=Math.min($.instanceCount,Ne);oe.renderInstances(Tt,Se,Mt)}else oe.render(Tt,Se)};function wh(w,D,$,H){L!==null&&w.isNodeMaterial&&L.setObject(H,w),Kt===!0&&Pt.setState(w,$,!1),w.transparent===!0&&w.side===Pn&&w.forceSinglePass===!1?(w.side=Xe,w.needsUpdate=!0,Kr(w,D,H),w.side=fi,w.needsUpdate=!0,Kr(w,D,H),w.side=Pn):Kr(w,D,H)}this.compile=function(w,D,$=null){$===null&&($=w),L!==null&&L.renderStart(w,D,$),S=dt.get($),S.init(D),y.push(S),$.traverseVisible(function(G){G.isLight&&G.layers.test(D.layers)&&(S.pushLight(G),G.castShadow&&S.pushShadow(G))}),w!==$&&w.traverseVisible(function(G){G.isLight&&G.layers.test(D.layers)&&(S.pushLight(G),G.castShadow&&S.pushShadow(G))}),S.setupLights(),L!==null&&L.updateLights(S.state.lightsArray),ae=this.localClippingEnabled,Kt=Pt.init(this.clippingPlanes,ae),Kt===!0&&Pt.setGlobalState(this.clippingPlanes,D),L!==null&&Ot.render(S.state.shadowsArray,$,D);let H=new Set;return w.traverse(function(G){if(!(G.isMesh||G.isPoints||G.isLine||G.isSprite))return;let yt=G.material;if(yt)if(Array.isArray(yt))for(let St=0;St<yt.length;St++){let xt=yt[St];wh(xt,$,D,G),H.add(xt)}else wh(yt,$,D,G),H.add(yt)}),S=y.pop(),L!==null&&L.renderEnd(),H},this.compileAsync=function(w,D,$=null){let H=this.compile(w,D,$);return new Promise(G=>{function yt(){if(H.forEach(function(St){let Et=q.get(St).currentProgram;(Et===void 0||Et.isReady())&&H.delete(St)}),H.size===0){G(w);return}setTimeout(yt,10)}se.get("KHR_parallel_shader_compile")!==null?yt():setTimeout(yt,10)})};let vl=null;function $f(w){vl&&vl(w)}function Eh(){Ei.stop()}function Th(){Ei.start()}let Ei=new Od;Ei.setAnimationLoop($f),typeof self<"u"&&Ei.setContext(self),this.setAnimationLoop=function(w){vl=w,At.setAnimationLoop(w),w===null?Ei.stop():Ei.start()},At.addEventListener("sessionstart",Eh),At.addEventListener("sessionend",Th),this.render=function(w,D){if(D!==void 0&&D.isCamera!==!0){Dt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;L!==null&&L.renderStart(w,D);let $=At.enabled===!0&&At.isPresenting===!0,H=T!==null&&(J===null||$)&&T.begin(C,J);if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),D.parent===null&&D.matrixWorldAutoUpdate===!0&&D.updateMatrixWorld(),At.enabled===!0&&At.isPresenting===!0&&(T===null||T.isCompositing()===!1)&&(At.cameraAutoUpdate===!0&&At.updateCamera(D),D=At.getCamera()),w.isScene===!0&&w.onBeforeRender(C,w,D,J),S=dt.get(w,y.length),S.init(D),S.state.textureUnits=j.getTextureUnits(),y.push(S),Yt.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),Xt.setFromProjectionMatrix(Yt,gn,D.reversedDepth),ae=this.localClippingEnabled,Kt=Pt.init(this.clippingPlanes,ae),b=mt.get(w,A.length),b.init(),A.push(b),At.enabled===!0&&At.isPresenting===!0){let St=C.xr.getDepthSensingMesh();St!==null&&Ml(St,D,-1/0,C.sortObjects)}Ml(w,D,0,C.sortObjects),b.finish(),L!==null&&L.updateLights(S.state.lightsArray),C.sortObjects===!0&&b.sort(ot,wt),ge=At.enabled===!1||At.isPresenting===!1||At.hasDepthSensing()===!1,ge&&Bt.addToRenderList(b,w),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Kt===!0&&Pt.beginShadows();let G=S.state.shadowsArray;if(Ot.render(G,w,D),Kt===!0&&Pt.endShadows(),(H&&T.hasRenderPass())===!1){let St=b.opaque,xt=b.transmissive;if(S.setupLights(),D.isArrayCamera){let Et=D.cameras;if(xt.length>0)for(let Ct=0,Vt=Et.length;Ct<Vt;Ct++){let qt=Et[Ct];Ch(St,xt,w,qt)}ge&&Bt.render(w);for(let Ct=0,Vt=Et.length;Ct<Vt;Ct++){let qt=Et[Ct];Ah(b,w,qt,qt.viewport)}}else xt.length>0&&Ch(St,xt,w,D),ge&&Bt.render(w),Ah(b,w,D)}J!==null&&V===0&&(j.updateMultisampleRenderTarget(J),j.updateRenderTargetMipmap(J)),H&&T.end(C),w.isScene===!0&&w.onAfterRender(C,w,D),vt.resetDefaultState(),Z=-1,tt=null,y.pop(),y.length>0?(S=y[y.length-1],j.setTextureUnits(S.state.textureUnits),Kt===!0&&Pt.setGlobalState(C.clippingPlanes,S.state.camera)):S=null,A.pop(),A.length>0?b=A[A.length-1]:b=null,L!==null&&L.renderEnd()};function Ml(w,D,$,H){if(w.visible===!1)return;if(w.layers.test(D.layers)){if(w.isGroup)$=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(D);else if(w.isLightProbeGrid)S.pushLightProbeGrid(w);else if(w.isLight)S.pushLight(w),w.castShadow&&S.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||w.intersectsFrustum(Xt)){H&&Ce.setFromMatrixPosition(w.matrixWorld).applyMatrix4(Yt);let St=nt.update(w),xt=w.material;xt.visible&&b.push(w,St,xt,$,Ce.z,null,D)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||w.intersectsFrustum(Xt))){let St=nt.update(w),xt=w.material;if(H&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Ce.copy(w.boundingSphere.center)):(St.boundingSphere===null&&St.computeBoundingSphere(),Ce.copy(St.boundingSphere.center)),Ce.applyMatrix4(w.matrixWorld).applyMatrix4(Yt)),Array.isArray(xt)){let Et=St.groups;for(let Ct=0,Vt=Et.length;Ct<Vt;Ct++){let qt=Et[Ct],Tt=xt[qt.materialIndex];Tt&&Tt.visible&&b.push(w,St,Tt,$,Ce.z,qt,D)}}else xt.visible&&b.push(w,St,xt,$,Ce.z,null,D)}}let yt=w.children;for(let St=0,xt=yt.length;St<xt;St++)Ml(yt[St],D,$,H)}function Ah(w,D,$,H){let{opaque:G,transmissive:yt,transparent:St}=w;S.setupLightsView($),Kt===!0&&Pt.setGlobalState(C.clippingPlanes,$),H&&x.viewport(it.copy(H)),G.length>0&&$r(G,D,$),yt.length>0&&$r(yt,D,$),St.length>0&&$r(St,D,$),x.buffers.depth.setTest(!0),x.buffers.depth.setMask(!0),x.buffers.color.setMask(!0),x.setPolygonOffset(!1)}function Ch(w,D,$,H){if(($.isScene===!0?$.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[H.id]===void 0){let Tt=se.has("EXT_color_buffer_half_float")||se.has("EXT_color_buffer_float");S.state.transmissionRenderTarget[H.id]=new Ze(1,1,{generateMipmaps:!0,type:Tt?Mn:$e,minFilter:mi,samples:Math.max(4,R.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Zt.workingColorSpace})}let yt=S.state.transmissionRenderTarget[H.id],St=H.viewport||it;yt.setSize(St.z*C.transmissionResolutionScale,St.w*C.transmissionResolutionScale);let xt=C.getRenderTarget(),Et=C.getActiveCubeFace(),Ct=C.getActiveMipmapLevel();C.setRenderTarget(yt),C.getClearColor(ct),lt=C.getClearAlpha(),lt<1&&C.setClearColor(16777215,.5),C.clear(),ge&&Bt.render($);let Vt=C.toneMapping;C.toneMapping=yn;let qt=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),S.setupLightsView(H),Kt===!0&&Pt.setGlobalState(C.clippingPlanes,H),$r(w,$,H),j.updateMultisampleRenderTarget(yt),j.updateRenderTargetMipmap(yt),se.has("WEBGL_multisampled_render_to_texture")===!1){let Tt=!1;for(let te=0,Se=D.length;te<Se;te++){let de=D[te],{object:oe,geometry:Ne,material:Mt,group:He}=de;if(Mt.side===Pn&&oe.layers.test(H.layers)){let $t=Mt.side;Mt.side=Xe,Mt.needsUpdate=!0,Rh(oe,$,H,Ne,Mt,He),Mt.side=$t,Mt.needsUpdate=!0,Tt=!0}}Tt===!0&&(j.updateMultisampleRenderTarget(yt),j.updateRenderTargetMipmap(yt))}C.setRenderTarget(xt,Et,Ct),C.setClearColor(ct,lt),qt!==void 0&&(H.viewport=qt),C.toneMapping=Vt}function $r(w,D,$){let H=D.isScene===!0?D.overrideMaterial:null;for(let G=0,yt=w.length;G<yt;G++){let St=w[G],{object:xt,geometry:Et,group:Ct}=St,Vt=St.material;Vt.allowOverride===!0&&H!==null&&(Vt=H),xt.layers.test($.layers)&&Rh(xt,D,$,Et,Vt,Ct)}}function Rh(w,D,$,H,G,yt){L!==null&&G.isNodeMaterial&&L.setObject(w,G),w.onBeforeRender(C,D,$,H,G,yt),w.modelViewMatrix.multiplyMatrices($.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),G.onBeforeRender(C,D,$,H,w,yt),G.transparent===!0&&G.side===Pn&&G.forceSinglePass===!1?(G.side=Xe,G.needsUpdate=!0,C.renderBufferDirect($,D,H,G,w,yt),G.side=fi,G.needsUpdate=!0,C.renderBufferDirect($,D,H,G,w,yt),G.side=Pn):C.renderBufferDirect($,D,H,G,w,yt),w.onAfterRender(C,D,$,H,G,yt)}function Kr(w,D,$){D.isScene!==!0&&(D=qe);let H=q.get(w),G=S.state.lights,yt=S.state.shadowsArray,St=G.state.version,xt=ut.getParameters(w,G.state,yt,D,$,S.state.lightProbeGridArray),Et=ut.getProgramCacheKey(xt),Ct=H.programs;H.environment=w.isMeshStandardMaterial||w.isMeshLambertMaterial||w.isMeshPhongMaterial?D.environment:null,H.fog=D.fog;let Vt=w.isMeshStandardMaterial||w.isMeshLambertMaterial&&!w.envMap||w.isMeshPhongMaterial&&!w.envMap;H.envMap=at.get(w.envMap||H.environment,Vt),H.envMapRotation=H.environment!==null&&w.envMap===null?D.environmentRotation:w.envMapRotation,Ct===void 0&&(w.addEventListener("dispose",bn),Ct=new Map,H.programs=Ct);let qt=Ct.get(Et);if(qt!==void 0){if(H.currentProgram===qt&&H.lightsStateVersion===St)return Ih(w,xt),qt}else xt.uniforms=ut.getUniforms(w),L!==null&&w.isNodeMaterial&&L.build(w,$,xt),w.onBeforeCompile(xt,C),qt=ut.acquireProgram(xt,Et),Ct.set(Et,qt),H.uniforms=xt.uniforms;let Tt=H.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Tt.clippingPlanes=Pt.uniform),Ih(w,xt),H.needsLights=Qf(w),H.lightsStateVersion=St,H.needsLights&&(Tt.ambientLightColor.value=G.state.ambient,Tt.lightProbe.value=G.state.probe,Tt.sunLights.value=G.state.sun,Tt.sunLightShadows.value=G.state.sunShadow,Tt.directionalLights.value=G.state.directional,Tt.directionalLightShadows.value=G.state.directionalShadow,Tt.spotLights.value=G.state.spot,Tt.spotLightShadows.value=G.state.spotShadow,Tt.rectAreaLights.value=G.state.rectArea,Tt.ltc_1.value=G.state.rectAreaLTC1,Tt.ltc_2.value=G.state.rectAreaLTC2,Tt.pointLights.value=G.state.point,Tt.pointLightShadows.value=G.state.pointShadow,Tt.hemisphereLights.value=G.state.hemi,Tt.sunShadowMatrix.value=G.state.sunShadowMatrix,Tt.sunShadowCascade.value=G.state.sunShadowCascade,Tt.directionalShadowMatrix.value=G.state.directionalShadowMatrix,Tt.spotLightMatrix.value=G.state.spotLightMatrix,Tt.spotLightMap.value=G.state.spotLightMap,Tt.pointShadowMatrix.value=G.state.pointShadowMatrix),H.lightProbeGrid=S.state.lightProbeGridArray.length>0,H.currentProgram=qt,H.uniformsList=null,qt}function Ph(w){if(w.uniformsList===null){let D=w.currentProgram.getUniforms();w.uniformsList=Is.seqWithValue(D.seq,w.uniforms)}return w.uniformsList}function Ih(w,D){let $=q.get(w);$.outputColorSpace=D.outputColorSpace,$.batching=D.batching,$.batchingColor=D.batchingColor,$.instancing=D.instancing,$.instancingColor=D.instancingColor,$.instancingMorph=D.instancingMorph,$.skinning=D.skinning,$.morphTargets=D.morphTargets,$.morphNormals=D.morphNormals,$.morphColors=D.morphColors,$.morphTargetsCount=D.morphTargetsCount,$.numClippingPlanes=D.numClippingPlanes,$.numIntersection=D.numClipIntersection,$.vertexAlphas=D.vertexAlphas,$.vertexTangents=D.vertexTangents,$.toneMapping=D.toneMapping}function Kf(w,D){if(w.length===0)return null;if(w.length===1)return w[0].texture!==null?w[0]:null;v.setFromMatrixPosition(D.matrixWorld);for(let $=0,H=w.length;$<H;$++){let G=w[$];if(G.texture!==null&&G.boundingBox.containsPoint(v))return G}return null}function Jf(w,D,$,H,G){D.isScene!==!0&&(D=qe),j.resetTextureUnits();let yt=D.fog,St=H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial?D.environment:null,xt=J===null?C.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Zt.workingColorSpace,Et=H.isMeshStandardMaterial||H.isMeshLambertMaterial&&!H.envMap||H.isMeshPhongMaterial&&!H.envMap,Ct=at.get(H.envMap||St,Et),Vt=H.vertexColors===!0&&!!$.attributes.color&&$.attributes.color.itemSize===4,qt=!!$.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),Tt=!!$.morphAttributes.position,te=!!$.morphAttributes.normal,Se=!!$.morphAttributes.color,de=yn;H.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(de=C.toneMapping);let oe=$.morphAttributes.position||$.morphAttributes.normal||$.morphAttributes.color,Ne=oe!==void 0?oe.length:0,Mt=q.get(H),He=S.state.lights;if(Kt===!0&&(ae===!0||w!==tt)){let ce=w===tt&&H.id===Z;Pt.setState(H,w,ce)}let $t=!1;H.version===Mt.__version?(Mt.needsLights&&Mt.lightsStateVersion!==He.state.version||Mt.outputColorSpace!==xt||G.isBatchedMesh&&Mt.batching===!1||!G.isBatchedMesh&&Mt.batching===!0||G.isBatchedMesh&&Mt.batchingColor===!0&&G._colorsTexture===null||G.isBatchedMesh&&Mt.batchingColor===!1&&G._colorsTexture!==null||G.isInstancedMesh&&Mt.instancing===!1||!G.isInstancedMesh&&Mt.instancing===!0||G.isSkinnedMesh&&Mt.skinning===!1||!G.isSkinnedMesh&&Mt.skinning===!0||G.isInstancedMesh&&Mt.instancingColor===!0&&G.instanceColor===null||G.isInstancedMesh&&Mt.instancingColor===!1&&G.instanceColor!==null||G.isInstancedMesh&&Mt.instancingMorph===!0&&G.morphTexture===null||G.isInstancedMesh&&Mt.instancingMorph===!1&&G.morphTexture!==null||Mt.envMap!==Ct||H.fog===!0&&Mt.fog!==yt||Mt.numClippingPlanes!==void 0&&(Mt.numClippingPlanes!==Pt.numPlanes||Mt.numIntersection!==Pt.numIntersection)||Mt.vertexAlphas!==Vt||Mt.vertexTangents!==qt||Mt.morphTargets!==Tt||Mt.morphNormals!==te||Mt.morphColors!==Se||Mt.toneMapping!==de||Mt.morphTargetsCount!==Ne||!!Mt.lightProbeGrid!=S.state.lightProbeGridArray.length>0)&&($t=!0):($t=!0,Mt.__version=H.version);let rn=Mt.currentProgram;$t===!0&&(rn=Kr(H,D,G),L&&H.isNodeMaterial&&L.onUpdateProgram(H,rn,Mt));let wn=!1,$n=!1,qi=!1,re=rn.getUniforms(),ve=Mt.uniforms;if(x.useProgram(rn.program)&&(wn=!0,$n=!0,qi=!0),H.id!==Z&&(Z=H.id,$n=!0),Mt.needsLights){let ce=Kf(S.state.lightProbeGridArray,G);Mt.lightProbeGrid!==ce&&(Mt.lightProbeGrid=ce,$n=!0)}if(wn||tt!==w){x.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),re.setValue(B,"projectionMatrix",w.projectionMatrix),re.setValue(B,"viewMatrix",w.matrixWorldInverse);let Jn=re.map.cameraPosition;Jn!==void 0&&Jn.setValue(B,pe.setFromMatrixPosition(w.matrixWorld)),R.logarithmicDepthBuffer&&re.setValue(B,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&re.setValue(B,"isOrthographic",w.isOrthographicCamera===!0),tt!==w&&(tt=w,$n=!0,qi=!0)}if(Mt.needsLights&&(He.state.sunShadowMap.length>0&&re.setValue(B,"sunShadowMap",He.state.sunShadowMap,j),He.state.directionalShadowMap.length>0&&re.setValue(B,"directionalShadowMap",He.state.directionalShadowMap,j),He.state.spotShadowMap.length>0&&re.setValue(B,"spotShadowMap",He.state.spotShadowMap,j),He.state.pointShadowMap.length>0&&re.setValue(B,"pointShadowMap",He.state.pointShadowMap,j)),G.isSkinnedMesh){re.setOptional(B,G,"bindMatrix"),re.setOptional(B,G,"bindMatrixInverse");let ce=G.skeleton;ce&&(ce.boneTexture===null&&ce.computeBoneTexture(),re.setValue(B,"boneTexture",ce.boneTexture,j))}G.isBatchedMesh&&(re.setOptional(B,G,"batchingTexture"),re.setValue(B,"batchingTexture",G._matricesTexture,j),re.setOptional(B,G,"batchingIdTexture"),re.setValue(B,"batchingIdTexture",G._indirectTexture,j),re.setOptional(B,G,"batchingColorTexture"),G._colorsTexture!==null&&re.setValue(B,"batchingColorTexture",G._colorsTexture,j));let Kn=$.morphAttributes;if((Kn.position!==void 0||Kn.normal!==void 0||Kn.color!==void 0)&&F.update(G,$,rn),($n||Mt.receiveShadow!==G.receiveShadow)&&(Mt.receiveShadow=G.receiveShadow,re.setValue(B,"receiveShadow",G.receiveShadow)),(H.isMeshStandardMaterial||H.isMeshLambertMaterial||H.isMeshPhongMaterial)&&H.envMap===null&&D.environment!==null&&(ve.envMapIntensity.value=D.environmentIntensity),ve.dfgLUT!==void 0&&(ve.dfgLUT.value=Qx()),$n){if(re.setValue(B,"toneMappingExposure",C.toneMappingExposure),Mt.needsLights&&jf(ve,qi),yt&&H.fog===!0&&Rt.refreshFogUniforms(ve,yt),Rt.refreshMaterialUniforms(ve,H,K,X,S.state.transmissionRenderTarget[w.id]),Mt.needsLights&&Mt.lightProbeGrid){let ce=Mt.lightProbeGrid;ve.probesSH.value=ce.texture,ve.probesMin.value.copy(ce.boundingBox.min),ve.probesMax.value.copy(ce.boundingBox.max),ve.probesResolution.value.copy(ce.resolution)}Is.upload(B,Ph(Mt),ve,j)}if(H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Is.upload(B,Ph(Mt),ve,j),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&re.setValue(B,"center",G.center),re.setValue(B,"modelViewMatrix",G.modelViewMatrix),re.setValue(B,"normalMatrix",G.normalMatrix),re.setValue(B,"modelMatrix",G.matrixWorld),H.uniformsGroups!==void 0){let ce=H.uniformsGroups;for(let Jn=0,Yi=ce.length;Jn<Yi;Jn++){let Uh=ce[Jn];rt.update(Uh,rn),rt.bind(Uh,rn)}}return rn}function jf(w,D){w.ambientLightColor.needsUpdate=D,w.lightProbe.needsUpdate=D,w.sunLights.needsUpdate=D,w.sunLightShadows.needsUpdate=D,w.directionalLights.needsUpdate=D,w.directionalLightShadows.needsUpdate=D,w.pointLights.needsUpdate=D,w.pointLightShadows.needsUpdate=D,w.spotLights.needsUpdate=D,w.spotLightShadows.needsUpdate=D,w.rectAreaLights.needsUpdate=D,w.hemisphereLights.needsUpdate=D}function Qf(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return U},this.getActiveMipmapLevel=function(){return V},this.getRenderTarget=function(){return J},this.setRenderTargetTextures=function(w,D,$){let H=q.get(w);H.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,H.__autoAllocateDepthBuffer===!1&&(H.__useRenderToTexture=!1),q.get(w.texture).__webglTexture=D,q.get(w.depthTexture).__webglTexture=H.__autoAllocateDepthBuffer?void 0:$,H.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,D){let $=q.get(w);$.__webglFramebuffer=D,$.__useDefaultFramebuffer=D===void 0},this.setRenderTarget=function(w,D=0,$=0){J=w,U=D,V=$;let H=null,G=!1,yt=!1;if(w){let xt=q.get(w);if(xt.__useDefaultFramebuffer!==void 0){x.bindFramebuffer(B.FRAMEBUFFER,xt.__webglFramebuffer),it.copy(w.viewport),W.copy(w.scissor),st=w.scissorTest,x.viewport(it),x.scissor(W),x.setScissorTest(st),Z=-1;return}else if(xt.__webglFramebuffer===void 0)j.setupRenderTarget(w);else if(xt.__hasExternalTextures)j.rebindTextures(w,q.get(w.texture).__webglTexture,q.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){let Vt=w.depthTexture;if(xt.__boundDepthTexture!==Vt){if(Vt!==null&&q.has(Vt)&&(w.width!==Vt.image.width||w.height!==Vt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");j.setupDepthRenderbuffer(w)}}let Et=w.texture;(Et.isData3DTexture||Et.isDataArrayTexture||Et.isCompressedArrayTexture)&&(yt=!0);let Ct=q.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Ct[D])?H=Ct[D][$]:H=Ct[D],G=!0):w.samples>0&&j.useMultisampledRTT(w)===!1?H=q.get(w).__webglMultisampledFramebuffer:Array.isArray(Ct)?H=Ct[$]:H=Ct,it.copy(w.viewport),W.copy(w.scissor),st=w.scissorTest}else it.copy(_t).multiplyScalar(K).floor(),W.copy(zt).multiplyScalar(K).floor(),st=Ee;if($!==0&&(H=N),x.bindFramebuffer(B.FRAMEBUFFER,H)&&x.drawBuffers(w,H),x.viewport(it),x.scissor(W),x.setScissorTest(st),G){let xt=q.get(w.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+D,xt.__webglTexture,$)}else if(yt){let xt=D;for(let Et=0;Et<w.textures.length;Et++){let Ct=q.get(w.textures[Et]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+Et,Ct.__webglTexture,$,xt)}}else if(w!==null&&$!==0){let xt=q.get(w.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,xt.__webglTexture,$)}Z=-1};function Lh(w){let D=q.get(w);return(D.__readFormat!==w.format||D.__readType!==w.type)&&(D.__readFormat=w.format,D.__readType=w.type,D.__formatReadable=R.textureFormatReadable(w.format),D.__typeReadable=R.textureTypeReadable(w.type)),D}this.readRenderTargetPixels=function(w,D,$,H,G,yt,St,xt=0){if(!(w&&w.isWebGLRenderTarget)){Dt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Et=q.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&St!==void 0&&(Et=Et[St]),Et){x.bindFramebuffer(B.FRAMEBUFFER,Et);try{let Ct=w.textures[xt],Vt=Ct.format,qt=Ct.type;w.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+xt);let Tt=Lh(Ct);if(Tt.__formatReadable===!1){Dt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Tt.__typeReadable===!1){Dt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}D>=0&&D<=w.width-H&&$>=0&&$<=w.height-G&&B.readPixels(D,$,H,G,pt.convert(Vt),pt.convert(qt),yt)}finally{let Ct=J!==null?q.get(J).__webglFramebuffer:null;x.bindFramebuffer(B.FRAMEBUFFER,Ct)}}},this.readRenderTargetPixelsAsync=async function(w,D,$,H,G,yt,St,xt=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Et=q.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&St!==void 0&&(Et=Et[St]),Et)if(D>=0&&D<=w.width-H&&$>=0&&$<=w.height-G){x.bindFramebuffer(B.FRAMEBUFFER,Et);let Ct=w.textures[xt],Vt=Ct.format,qt=Ct.type;w.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+xt);let Tt=Lh(Ct);if(Tt.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Tt.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let te=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,te),B.bufferData(B.PIXEL_PACK_BUFFER,yt.byteLength,B.STREAM_READ),B.readPixels(D,$,H,G,pt.convert(Vt),pt.convert(qt),0),B.bindBuffer(B.PIXEL_PACK_BUFFER,null);let Se=J!==null?q.get(J).__webglFramebuffer:null;x.bindFramebuffer(B.FRAMEBUFFER,Se);let de=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await ad(B,de,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,te),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,yt),B.bindBuffer(B.PIXEL_PACK_BUFFER,null),B.deleteBuffer(te),B.deleteSync(de),yt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,D=null,$=0){let H=Math.pow(2,-$),G=Math.floor(w.image.width*H),yt=Math.floor(w.image.height*H),St=D!==null?D.x:0,xt=D!==null?D.y:0;j.setTexture2D(w,0),B.copyTexSubImage2D(B.TEXTURE_2D,$,0,0,St,xt,G,yt),x.unbindTexture()},this.copyTextureToTexture=function(w,D,$=null,H=null,G=0,yt=0){let St,xt,Et,Ct,Vt,qt,Tt,te,Se,de=w.isCompressedTexture?w.mipmaps[yt]:w.image;if($!==null)St=$.max.x-$.min.x,xt=$.max.y-$.min.y,Et=$.isBox3?$.max.z-$.min.z:1,Ct=$.min.x,Vt=$.min.y,qt=$.isBox3?$.min.z:0;else{let ve=Math.pow(2,-G);St=Math.floor(de.width*ve),xt=Math.floor(de.height*ve),w.isDataArrayTexture?Et=de.depth:w.isData3DTexture?Et=Math.floor(de.depth*ve):Et=1,Ct=0,Vt=0,qt=0}H!==null?(Tt=H.x,te=H.y,Se=H.z):(Tt=0,te=0,Se=0);let oe=pt.convert(D.format),Ne=pt.convert(D.type),Mt;D.isData3DTexture?(j.setTexture3D(D,0),Mt=B.TEXTURE_3D):D.isDataArrayTexture||D.isCompressedArrayTexture?(j.setTexture2DArray(D,0),Mt=B.TEXTURE_2D_ARRAY):(j.setTexture2D(D,0),Mt=B.TEXTURE_2D),x.activeTexture(B.TEXTURE0),x.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,D.flipY),x.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,D.premultiplyAlpha),x.pixelStorei(B.UNPACK_ALIGNMENT,D.unpackAlignment);let He=x.getParameter(B.UNPACK_ROW_LENGTH),$t=x.getParameter(B.UNPACK_IMAGE_HEIGHT),rn=x.getParameter(B.UNPACK_SKIP_PIXELS),wn=x.getParameter(B.UNPACK_SKIP_ROWS),$n=x.getParameter(B.UNPACK_SKIP_IMAGES);x.pixelStorei(B.UNPACK_ROW_LENGTH,de.width),x.pixelStorei(B.UNPACK_IMAGE_HEIGHT,de.height),x.pixelStorei(B.UNPACK_SKIP_PIXELS,Ct),x.pixelStorei(B.UNPACK_SKIP_ROWS,Vt),x.pixelStorei(B.UNPACK_SKIP_IMAGES,qt);let qi=w.isDataArrayTexture||w.isData3DTexture,re=D.isDataArrayTexture||D.isData3DTexture;if(w.isDepthTexture){let ve=q.get(w),Kn=q.get(D),ce=q.get(ve.__renderTarget),Jn=q.get(Kn.__renderTarget);x.bindFramebuffer(B.READ_FRAMEBUFFER,ce.__webglFramebuffer),x.bindFramebuffer(B.DRAW_FRAMEBUFFER,Jn.__webglFramebuffer);for(let Yi=0;Yi<Et;Yi++)qi&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,q.get(w).__webglTexture,G,qt+Yi),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,q.get(D).__webglTexture,yt,Se+Yi)),B.blitFramebuffer(Ct,Vt,St,xt,Tt,te,St,xt,B.DEPTH_BUFFER_BIT,B.NEAREST);x.bindFramebuffer(B.READ_FRAMEBUFFER,null),x.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(G!==0||w.isRenderTargetTexture||q.has(w)){let ve=q.get(w),Kn=q.get(D);x.bindFramebuffer(B.READ_FRAMEBUFFER,P),x.bindFramebuffer(B.DRAW_FRAMEBUFFER,O);for(let ce=0;ce<Et;ce++)qi?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,ve.__webglTexture,G,qt+ce):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,ve.__webglTexture,G),re?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Kn.__webglTexture,yt,Se+ce):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Kn.__webglTexture,yt),G!==0?B.blitFramebuffer(Ct,Vt,St,xt,Tt,te,St,xt,B.COLOR_BUFFER_BIT,B.NEAREST):re?B.copyTexSubImage3D(Mt,yt,Tt,te,Se+ce,Ct,Vt,St,xt):B.copyTexSubImage2D(Mt,yt,Tt,te,Ct,Vt,St,xt);x.bindFramebuffer(B.READ_FRAMEBUFFER,null),x.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else re?w.isDataTexture||w.isData3DTexture?B.texSubImage3D(Mt,yt,Tt,te,Se,St,xt,Et,oe,Ne,de.data):D.isCompressedArrayTexture?B.compressedTexSubImage3D(Mt,yt,Tt,te,Se,St,xt,Et,oe,de.data):B.texSubImage3D(Mt,yt,Tt,te,Se,St,xt,Et,oe,Ne,de):w.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,yt,Tt,te,St,xt,oe,Ne,de.data):w.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,yt,Tt,te,de.width,de.height,oe,de.data):B.texSubImage2D(B.TEXTURE_2D,yt,Tt,te,St,xt,oe,Ne,de);x.pixelStorei(B.UNPACK_ROW_LENGTH,He),x.pixelStorei(B.UNPACK_IMAGE_HEIGHT,$t),x.pixelStorei(B.UNPACK_SKIP_PIXELS,rn),x.pixelStorei(B.UNPACK_SKIP_ROWS,wn),x.pixelStorei(B.UNPACK_SKIP_IMAGES,$n),yt===0&&D.generateMipmaps&&B.generateMipmap(Mt),x.unbindTexture()},this.initRenderTarget=function(w){q.get(w).__webglFramebuffer===void 0&&j.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?j.setTextureCube(w,0):w.isData3DTexture?j.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?j.setTexture2DArray(w,0):j.setTexture2D(w,0),x.unbindTexture()},this.resetState=function(){U=0,V=0,J=null,x.reset(),vt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return gn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=Zt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Zt._getUnpackColorSpace()}};var Zc='"use strict";(()=>{var et=new TextDecoder;function m(t){throw new Error(`simscope: ${t}`)}var H=(()=>{let t=new Uint32Array(256);for(let e=0;e<256;e++){let n=e;for(let r=0;r<8;r++)n=n&1?3988292384^n>>>1:n>>>1;t[e]=n>>>0}return t})();function j(t,e=0,n=t.length){let r=4294967295;for(let o=e;o<n;o++)r=H[(r^t[o])&255]^r>>>8;return(r^4294967295)>>>0}function z(t,e){return String.fromCharCode(t[e],t[e+1],t[e+2],t[e+3])}function D(t){return new DataView(t.buffer,t.byteOffset,t.byteLength)}function b(t,e,n){let r=t.byteOffset+e;return e+4*n>t.length&&m("truncated float data"),r%4===0?new Float32Array(t.buffer,r,n):new Float32Array(t.slice(e,e+4*n).buffer)}async function J(t,e="deflate-raw"){let n=new DecompressionStream(e),r=n.writable.getWriter();r.write(t).catch(()=>{}),r.close().catch(()=>{});try{return new Uint8Array(await new Response(n.readable).arrayBuffer())}catch(o){return m(`inflate failed (${o&&o.message?o.message:o})`)}}async function x(t,e,n){let r=await J(t);return r.length!==e&&m(`${n}: inflated ${r.length} bytes, expected ${e}`),r}var K=32,M=1,L=2;function T(t,e){let n=D(t);return{offset:e,env:n.getUint32(e+8,!0),t0:n.getUint32(e+12,!0),n:n.getUint32(e+16,!0),clen:n.getUint32(e+20,!0),ulen:n.getUint32(e+24,!0),codec:t[e+4],crc:n.getUint32(e+28,!0)}}function G(t,e,n){let r=e*n,o=new Uint32Array(r),s=t.subarray(0,r),c=t.subarray(r,2*r),i=t.subarray(2*r,3*r),d=t.subarray(3*r,4*r);for(let a=0;a<e;a++){let f=0,u=a*n;for(let l=0;l<n;l++){let h=u+l;f=f+((s[h]|c[h]<<8|i[h]<<16|d[h]<<24)>>>0)>>>0,o[l*e+a]=f}}return new Float32Array(o.buffer)}function I(t,e,n){let r=b(t,0,e),o=b(t,4*e,e),s=e*n,c=t.subarray(8*e,8*e+s),i=t.subarray(8*e+s,8*e+2*s),d=new Float32Array(s);for(let a=0;a<e;a++){let f=0,u=a*n,l=r[a],h=o[a];for(let w=0;w<n;w++){let y=u+w;f=f+(c[y]|i[y]<<8)&65535,d[w*e+a]=Math.fround(l+Math.fround(f*h))}}return d}function V(t){let e=Math.fround;for(let n=0;n+7<=t.length;n+=7){let r=t[n+3],o=t[n+4],s=t[n+5],c=t[n+6],i=e(Math.sqrt(e(e(e(e(r*r)+e(o*o))+e(s*s))+e(c*c))));i>0&&(t[n+3]=r/i,t[n+4]=o/i,t[n+5]=s/i,t[n+6]=c/i)}}async function A(t,e,n={}){let{bytes:r,itemK:o}=t,s=e.offset;(s+K>r.length||z(r,s)!=="SSBB")&&m(`bad SSBB magic at offset ${s}`);let c=T(r,s);c.codec!==M&&c.codec!==L&&m(`unknown block codec ${c.codec}`);let i=s+K;i+c.clen>r.length&&m(`block at offset ${s} is truncated`);let d=r.subarray(i,i+c.clen);if(j(d)!==c.crc&&m(`block CRC mismatch at offset ${s}`),c.codec===M)return c.ulen!==4*o*c.n&&m(`block ulen ${c.ulen} does not match f32s layout (${4*o*c.n})`),G(await x(d,c.ulen,"block"),o,c.n);let a=8*o+2*o*c.n;c.ulen!==a&&m(`block ulen ${c.ulen} does not match q16d layout (${a})`);let f=await x(d,a,"block"),u=I(f,o,c.n);return n.pose&&V(u),u}function N(t,e){let n=new Float32Array(t.length);for(let r=0;r<e.length;r+=3){let o=e[r]*3,s=e[r+1]*3,c=e[r+2]*3,i=t[s]-t[o],d=t[s+1]-t[o+1],a=t[s+2]-t[o+2],f=t[c]-t[o],u=t[c+1]-t[o+1],l=t[c+2]-t[o+2],h=d*l-a*u,w=a*f-i*l,y=i*u-d*f;for(let g of[o,s,c])n[g]+=h,n[g+1]+=w,n[g+2]+=y}for(let r=0;r<n.length;r+=3){let o=Math.hypot(n[r],n[r+1],n[r+2]);o>0?(n[r]/=o,n[r+1]/=o,n[r+2]/=o):n[r+2]=1}return n}function O(t,e,n,r,o,s){let c=r*n,i=t.subarray(e,e+c),d=t.subarray(e+c,e+2*c),a=new Float32Array(c);for(let f=0;f<r;f++){let u=0;for(let l=0;l<n;l++){let h=f*n+l;u=u+(i[h]|d[h]<<8)&65535,a[l*r+f]=Math.fround(o[f]+Math.fround(u*s[f]))}}return a}async function P(t){(t.length<32||z(t,0)!=="SSMH")&&m("bad SSMH magic in mesh blob");let e=D(t),n=e.getUint16(4,!0);n!==1&&m(`unsupported mesh major version ${n}`);let r=e.getUint32(8,!0),o=e.getUint32(12,!0),s=e.getUint32(16,!0),c=t[20],i=e.getUint32(24,!0),d=t.subarray(32);j(d)!==e.getUint32(28,!0)&&m("mesh CRC mismatch"),c!==0&&c!==1&&m(`unknown mesh codec ${c}`);let a=(s&1)!==0,f=(s&2)!==0,u=await x(d,i,"mesh");if(c===0){let p=0,k=F=>{let W=b(u,p,F);return p+=4*F,W},B=k(3*r),E=new Uint32Array(u.slice(p,p+12*o).buffer);p+=12*o;let R=a?k(3*r):N(B,E),_=f?k(2*r):null;return{verts:B,faces:E,normals:R,uvs:_,nVerts:r,nFaces:o}}a&&m("q16 mesh must not have the normals flag");let l=u,h=b(l,0,3),w=b(l,12,3),y=O(l,24,r,3,h,w),g=24+6*r,U=3*o,S=new Uint32Array(U),$=[0,1,2,3].map(p=>l.subarray(g+p*U,g+(p+1)*U)),v=0;for(let p=0;p<U;p++)v=v+(($[0][p]|$[1][p]<<8|$[2][p]<<16|$[3][p]<<24)>>>0)>>>0,S[p]=v;g+=4*U;let C=null;if(f){let p=b(l,g,2),k=b(l,g+8,2);C=O(l,g+16,r,2,p,k)}return{verts:y,faces:S,normals:N(y,S),uvs:C,nVerts:r,nFaces:o}}async function X(t){let n=(await Promise.all(t.blocks.map(r=>{let o=new Uint8Array(r);return A({bytes:o,itemK:t.itemK},{offset:0},{pose:!!t.pose})}))).map(r=>r.buffer);return{reply:{ok:!0,arrays:n},transfer:n}}var q=256;async function Z(t){let e=t.blocks.length,n=t.itemK,r=null,o=0;for(let s=0;s<e;s+=q){let c=t.blocks.slice(s,s+q),i=await Promise.all(c.map(d=>A({bytes:new Uint8Array(d),itemK:n},{offset:0},{pose:!!t.pose})));r||(o=i[0].length/n,r=new Float32Array(o*e*n)),i.forEach((d,a)=>{if(d.length!==o*n)throw new Error("blocks of one window differ in length");let f=s+a;for(let u=0;u<o;u++)r.set(d.subarray(u*n,(u+1)*n),(u*e+f)*n)})}return{reply:{ok:!0,data:r.buffer,n:o},transfer:[r.buffer]}}async function Y(t){let e=await P(new Uint8Array(t.bytes)),n=[e.verts.buffer,e.faces.buffer,e.normals.buffer];return e.uvs&&n.push(e.uvs.buffer),{reply:{ok:!0,mesh:e},transfer:[...new Set(n)]}}async function tt(t){try{return t.op==="blocks"?await X(t):t.op==="window"?await Z(t):t.op==="mesh"?await Y(t):{reply:{ok:!1,error:`unknown op ${t.op}`},transfer:[]}}catch(e){return{reply:{ok:!1,error:e&&e.message?e.message:String(e)},transfer:[]}}}typeof WorkerGlobalScope<"u"&&typeof self<"u"&&self instanceof WorkerGlobalScope&&(self.onmessage=async t=>{let{id:e}=t.data,{reply:n,transfer:r}=await tt(t.data);self.postMessage({id:e,...n},r)});})();\n';async function ty(i){let e=(await Promise.all(i.blocks.map(n=>{let s=new Uint8Array(n);return Zs({bytes:s,itemK:i.itemK},{offset:0},{pose:!!i.pose})}))).map(n=>n.buffer);return{reply:{ok:!0,arrays:e},transfer:e}}var Vd=256;async function ey(i){let t=i.blocks.length,e=i.itemK,n=null,s=0;for(let r=0;r<t;r+=Vd){let o=i.blocks.slice(r,r+Vd),a=await Promise.all(o.map(l=>Zs({bytes:new Uint8Array(l),itemK:e},{offset:0},{pose:!!i.pose})));n||(s=a[0].length/e,n=new Float32Array(s*t*e)),a.forEach((l,c)=>{if(l.length!==s*e)throw new Error("blocks of one window differ in length");let h=r+c;for(let f=0;f<s;f++)n.set(l.subarray(f*e,(f+1)*e),(f*t+h)*e)})}return{reply:{ok:!0,data:n.buffer,n:s},transfer:[n.buffer]}}async function ny(i){let t=await Cl(new Uint8Array(i.bytes)),e=[t.verts.buffer,t.faces.buffer,t.normals.buffer];return t.uvs&&e.push(t.uvs.buffer),{reply:{ok:!0,mesh:t},transfer:[...new Set(e)]}}async function $c(i){try{return i.op==="blocks"?await ty(i):i.op==="window"?await ey(i):i.op==="mesh"?await ny(i):{reply:{ok:!1,error:`unknown op ${i.op}`},transfer:[]}}catch(t){return{reply:{ok:!1,error:t&&t.message?t.message:String(t)},transfer:[]}}}typeof WorkerGlobalScope<"u"&&typeof self<"u"&&self instanceof WorkerGlobalScope&&(self.onmessage=async i=>{let{id:t}=i.data,{reply:e,transfer:n}=await $c(i.data);self.postMessage({id:t,...e},n)});var iy=8;function sy(){if(typeof Worker>"u"||typeof Blob>"u"||typeof URL>"u"||!URL.createObjectURL||!Zc)return null;try{let i=URL.createObjectURL(new Blob([Zc],{type:"text/javascript"})),t=new Worker(i);return URL.revokeObjectURL(i),t}catch{return null}}var Kc=class{constructor(){this.worker=null,this.started=!1,this.nextId=1,this.jobs=new Map,this.queue=[],this.inFlight=0,this.onPending=null}_start(){if(this.started)return;this.started=!0;let t=sy();t&&(t.onmessage=e=>this._done(e.data),t.onerror=e=>{e.preventDefault?.(),this.worker=null;let n=[...this.jobs.values()];this.jobs.clear(),this.inFlight=0;for(let s of n)this.queue.unshift(s);this._pump()},this.worker=t)}get threaded(){return this._start(),!!this.worker}get pending(){return this.queue.length+this.inFlight}request(t,e=[]){return this._start(),new Promise((n,s)=>{this.queue.push({id:this.nextId++,msg:t,transfer:e,resolve:n,reject:s}),this._notify(),this._pump()})}_notify(){this.onPending&&this.onPending(this.pending)}_pump(){for(;this.inFlight<iy&&this.queue.length;){let t=this.queue.shift();this.inFlight++,this.worker?(this.jobs.set(t.id,t),this.worker.postMessage({id:t.id,...t.msg},t.transfer)):$c(t.msg).then(({reply:e})=>this._finish(t,e))}}_done(t){let e=this.jobs.get(t.id);e&&(this.jobs.delete(t.id),this._finish(e,t))}_finish(t,e){this.inFlight--,e.ok?t.resolve(e):t.reject(new Error(`simscope: ${e.error}`)),this._notify(),this._pump()}},Us=new Kc;async function Hd(i,t,e){let n=i.map(r=>r.byteOffset===0&&r.byteLength===r.buffer.byteLength?r.buffer:r.slice().buffer);return(await Us.request({op:"blocks",blocks:n,itemK:t,pose:e},n)).arrays.map(r=>new Float32Array(r))}async function Gd(i,t,e){let n=i.map(r=>r.byteOffset===0&&r.byteLength===r.buffer.byteLength?r.buffer:r.slice().buffer),s=await Us.request({op:"window",blocks:n,itemK:t,pose:e},n);return{data:new Float32Array(s.data),n:s.n}}async function Wd(i){let t=i.slice().buffer;return(await Us.request({op:"mesh",bytes:t},[t])).mesh}var Xd=256*1024*1024,jc=class{constructor(t=Xd){this.maxBytes=t,this.bytes=0,this.map=new Map}get size(){return this.map.size}has(t){return this.map.has(t)}get(t){let e=this.map.get(t);if(e)return this.map.delete(t),this.map.set(t,e),e.value}peek(t){let e=this.map.get(t);return e?e.value:void 0}set(t,e,n){let s=this.map.get(t);s&&(this.bytes-=s.size),this.map.delete(t),this.map.set(t,{value:e,size:n}),this.bytes+=n;for(let[r,o]of this.map){if(this.bytes<=this.maxBytes||r===t)break;this.map.delete(r),this.bytes-=o.size}}delete(t){let e=this.map.get(t);return e?(this.bytes-=e.size,this.map.delete(t)):!1}clear(){this.map.clear(),this.bytes=0}};function el(i,t,e,n){return{id:i,path:t,pose:n,itemK:e.itemK,blockFrames:e.blockFrames,nEnvs:e.nEnvs,nFrames:e.nFrames,nWindows:Math.ceil(e.nFrames/e.blockFrames)}}var Yn=(i,t,e)=>(i.id*65536+t)*16777216+e,Jc=16777215,tl=class{constructor(t,e=Xd){this.source=t,this.lru=new jc(e),this.inflight=new Map,this.epoch=0,this.pending=0,this.onChange=null,this.errors=new Map}get(t,e,n){return this.lru.get(Yn(t,e,n))}has(t,e,n){return this.lru.has(Yn(t,e,n))}ready(t,e,n){for(let s=0;s<n.length;s++)if(!this.lru.has(Yn(t,e,n[s])))return!1;return!0}request(t,e,n){if(e<0||e>=t.nWindows)return Promise.resolve();let s=[],r=[];for(let o=0;o<n.length;o++){let a=n[o],l=Yn(t,e,a);if(this.lru.has(l))continue;let c=this.inflight.get(l);c?r.push(c):s.push(a)}if(s.length){let o=this._fetch(t,e,s);for(let a of s)this.inflight.set(Yn(t,e,a),o);r.push(o)}return r.length?Promise.all(r).then(()=>{}):Promise.resolve()}getWindow(t,e){return this.lru.get(Yn(t,e,Jc))}hasWindow(t,e){return this.lru.has(Yn(t,e,Jc))}requestWindow(t,e){if(e<0||e>=t.nWindows)return Promise.resolve();let n=Yn(t,e,Jc);if(this.lru.has(n))return Promise.resolve();let s=this.inflight.get(n);return s||(s=this._fetchDense(t,e,n),this.inflight.set(n,s)),s}async _fetchDense(t,e,n){this._pending(1);try{let s=Array.from({length:t.nEnvs},(a,l)=>l),r=await this.source.blocks(t.path,e,s),o=await Gd(r,t.itemK,t.pose);this.lru.set(n,o,o.data.byteLength),this.epoch++}finally{this.inflight.delete(n),this._pending(-1)}}async _fetch(t,e,n){this._pending(1);let s=n.map(r=>Yn(t,e,r));try{let r=await this.source.blocks(t.path,e,n),o=await Hd(r,t.itemK,t.pose);for(let a=0;a<n.length;a++)this.lru.set(s[a],o[a],o[a].byteLength);this.epoch++}finally{for(let r of s)this.inflight.delete(r);this._pending(-1)}}_pending(t){this.pending+=t,this.onChange&&this.onChange(this.pending)}forget(t){for(let e of[...this.lru.map.keys()])Math.floor(e/(65536*16777216))===t.id&&this.lru.delete(e);this.epoch++}clear(){this.lru.clear(),this.inflight.clear(),this.epoch++}get bytes(){return this.lru.bytes}};var xe={LEFT:1,RIGHT:2,MIDDLE:4},Y=Object.freeze({NONE:0,ROTATE:1,TRUCK:2,SCREEN_PAN:4,OFFSET:8,DOLLY:16,ZOOM:32,TOUCH_ROTATE:64,TOUCH_TRUCK:128,TOUCH_SCREEN_PAN:256,TOUCH_OFFSET:512,TOUCH_DOLLY:1024,TOUCH_ZOOM:2048,TOUCH_DOLLY_TRUCK:4096,TOUCH_DOLLY_SCREEN_PAN:8192,TOUCH_DOLLY_OFFSET:16384,TOUCH_DOLLY_ROTATE:32768,TOUCH_ZOOM_TRUCK:65536,TOUCH_ZOOM_OFFSET:131072,TOUCH_ZOOM_SCREEN_PAN:262144,TOUCH_ZOOM_ROTATE:524288}),Os={NONE:0,IN:1,OUT:-1};function Hi(i){return i.isPerspectiveCamera}function Mi(i){return i.isOrthographicCamera}var vi=Math.PI*2,qd=Math.PI/2,tf=1e-5,zr=Math.PI/180;function Sn(i,t,e){return Math.max(t,Math.min(e,i))}function ue(i,t=tf){return Math.abs(i)<t}function ie(i,t,e=tf){return ue(i-t,e)}function Yd(i,t){return Math.round(i/t)*t}function Vr(i){return isFinite(i)?i:i<0?-Number.MAX_VALUE:Number.MAX_VALUE}function Hr(i){return Math.abs(i)<Number.MAX_VALUE?i:i*(1/0)}function nl(i,t,e,n,s=1/0,r){n=Math.max(1e-4,n);let o=2/n,a=o*r,l=1/(1+a+.48*a*a+.235*a*a*a),c=i-t,h=t,f=s*n;c=Sn(c,-f,f),t=i-c;let u=(e.value+o*c)*r;e.value=(e.value-o*u)*l;let p=t+(c+u)*l;return h-i>0==p>h&&(p=h,e.value=(p-h)/r),p}function Zd(i,t,e,n,s=1/0,r,o){n=Math.max(1e-4,n);let a=2/n,l=a*r,c=1/(1+l+.48*l*l+.235*l*l*l),h=t.x,f=t.y,u=t.z,p=i.x-h,g=i.y-f,_=i.z-u,m=h,d=f,M=u,E=s*n,v=E*E,b=p*p+g*g+_*_;if(b>v){let O=Math.sqrt(b);p=p/O*E,g=g/O*E,_=_/O*E}h=i.x-p,f=i.y-g,u=i.z-_;let S=(e.x+a*p)*r,A=(e.y+a*g)*r,y=(e.z+a*_)*r;e.x=(e.x-a*S)*c,e.y=(e.y-a*A)*c,e.z=(e.z-a*y)*c,o.x=h+(p+S)*c,o.y=f+(g+A)*c,o.z=u+(_+y)*c;let T=m-i.x,C=d-i.y,I=M-i.z,L=o.x-m,N=o.y-d,P=o.z-M;return T*L+C*N+I*P>0&&(o.x=m,o.y=d,o.z=M,e.x=(o.x-m)/r,e.y=(o.y-d)/r,e.z=(o.z-M)/r),o}function Qc(i,t){t.set(0,0),i.forEach(e=>{t.x+=e.clientX,t.y+=e.clientY}),t.x/=i.length,t.y/=i.length}function th(i,t){return Mi(i)?(console.warn(`${t} is not supported in OrthographicCamera`),!0):!1}var rh=class{_listeners={};addEventListener(t,e){let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let s=this._listeners[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}removeAllEventListeners(t){if(!t){this._listeners={};return}Array.isArray(this._listeners[t])&&(this._listeners[t].length=0)}dispatchEvent(t){let n=this._listeners[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t)}}},ry="3.1.2",il=1/8,oy=/Mac/.test(globalThis?.navigator?.platform),Nt,$d,sl,eh,Ke,kt,Jt,Ds,Gr,On,Dn,Gi,Kd,Jd,sn,Ns,Fs,jd,nh,Qd,ih,sh,rl,Bs=class i extends rh{static install(t){Nt=t.THREE,$d=Object.freeze(new Nt.Vector3(0,0,0)),sl=Object.freeze(new Nt.Vector3(0,1,0)),eh=Object.freeze(new Nt.Vector3(0,0,1)),Ke=new Nt.Vector2,kt=new Nt.Vector3,Jt=new Nt.Vector3,Ds=new Nt.Vector3,Gr=new Nt.Vector3,On=new Nt.Vector3,Dn=new Nt.Vector3,Gi=new Nt.Vector3,Kd=new Nt.Vector3,Jd=new Nt.Vector3,sn=new Nt.Spherical,Ns=new Nt.Spherical,Fs=new Nt.Box3,jd=new Nt.Box3,nh=new Nt.Sphere,Qd=new Nt.Quaternion,ih=new Nt.Quaternion,sh=new Nt.Matrix4,rl=new Nt.Raycaster}static get ACTION(){return Y}minPolarAngle=0;maxPolarAngle=Math.PI;minAzimuthAngle=-1/0;maxAzimuthAngle=1/0;minDistance=Number.EPSILON;maxDistance=1/0;infinityDolly=!1;minZoom=.01;maxZoom=1/0;smoothTime=.25;draggingSmoothTime=.125;maxSpeed=1/0;azimuthRotateSpeed=1;polarRotateSpeed=1;dollySpeed=1;dollyDragInverted=!1;truckSpeed=2;dollyToCursor=!1;dragToOffset=!1;boundaryFriction=0;restThreshold=.01;colliderMeshes=[];mouseButtons;touches;cancel=()=>{};lockPointer;unlockPointer;_enabled=!0;_camera;_yAxisUpSpace;_yAxisUpSpaceInverse;_state=Y.NONE;_domElement;_viewport=null;_target;_targetEnd;_focalOffset;_focalOffsetEnd;_spherical;_sphericalEnd;_lastDistance;_zoom;_zoomEnd;_lastZoom;_cameraUp0;_target0;_position0;_zoom0;_focalOffset0;_dollyControlCoord;_changedDolly=0;_changedZoom=0;_nearPlaneCorners;_hasRested=!0;_boundary;_boundaryEnclosesCamera=!1;_needsUpdate=!0;_updatedLastTime=!1;_elementRect=new DOMRect;_isDragging=!1;_dragNeedsUpdate=!0;_activePointers=[];_lockedPointer=null;_interactiveArea=new DOMRect(0,0,1,1);_isUserControllingRotate=!1;_isUserControllingDolly=!1;_isUserControllingTruck=!1;_isUserControllingOffset=!1;_isUserControllingZoom=!1;_lastDollyDirection=Os.NONE;_thetaVelocity={value:0};_phiVelocity={value:0};_radiusVelocity={value:0};_targetVelocity=new Nt.Vector3;_focalOffsetVelocity=new Nt.Vector3;_zoomVelocity={value:0};set verticalDragToForward(t){console.warn("camera-controls: `verticalDragToForward` was removed. Use `mouseButtons.left = CameraControls.ACTION.SCREEN_PAN` instead.")}constructor(t,e){super(),typeof Nt>"u"&&console.error("camera-controls: `THREE` is undefined. You must first run `CameraControls.install( { THREE: THREE } )`. Check the docs for further information."),this._camera=t,this._yAxisUpSpace=new Nt.Quaternion().setFromUnitVectors(this._camera.up,sl),this._yAxisUpSpaceInverse=this._yAxisUpSpace.clone().invert(),this._state=Y.NONE,this._target=new Nt.Vector3,this._targetEnd=this._target.clone(),this._focalOffset=new Nt.Vector3,this._focalOffsetEnd=this._focalOffset.clone(),this._spherical=new Nt.Spherical().setFromVector3(kt.copy(this._camera.position).applyQuaternion(this._yAxisUpSpace)),this._sphericalEnd=this._spherical.clone(),this._lastDistance=this._spherical.radius,this._zoom=this._camera.zoom,this._zoomEnd=this._zoom,this._lastZoom=this._zoom,this._nearPlaneCorners=[new Nt.Vector3,new Nt.Vector3,new Nt.Vector3,new Nt.Vector3],this._updateNearPlaneCorners(),this._boundary=new Nt.Box3(new Nt.Vector3(-1/0,-1/0,-1/0),new Nt.Vector3(1/0,1/0,1/0)),this._cameraUp0=this._camera.up.clone(),this._target0=this._target.clone(),this._position0=this._camera.position.clone(),this._zoom0=this._zoom,this._focalOffset0=this._focalOffset.clone(),this._dollyControlCoord=new Nt.Vector2,this.mouseButtons={left:Y.ROTATE,middle:Y.DOLLY,right:Y.TRUCK,wheel:Hi(this._camera)?Y.DOLLY:Mi(this._camera)?Y.ZOOM:Y.NONE},this.touches={one:Y.TOUCH_ROTATE,two:Hi(this._camera)?Y.TOUCH_DOLLY_TRUCK:Mi(this._camera)?Y.TOUCH_ZOOM_TRUCK:Y.NONE,three:Y.TOUCH_TRUCK};let n=new Nt.Vector2,s=new Nt.Vector2,r=new Nt.Vector2,o=d=>{if(!this._enabled||!this._domElement)return;if(this._interactiveArea.left!==0||this._interactiveArea.top!==0||this._interactiveArea.width!==1||this._interactiveArea.height!==1){let v=this._domElement.getBoundingClientRect(),b=d.clientX/v.width,S=d.clientY/v.height;if(b<this._interactiveArea.left||b>this._interactiveArea.right||S<this._interactiveArea.top||S>this._interactiveArea.bottom)return}let M=d.pointerType!=="mouse"?null:(d.buttons&xe.LEFT)===xe.LEFT?xe.LEFT:(d.buttons&xe.MIDDLE)===xe.MIDDLE?xe.MIDDLE:(d.buttons&xe.RIGHT)===xe.RIGHT?xe.RIGHT:null;if(M!==null){let v=this._findPointerByMouseButton(M);v&&this._disposePointer(v)}if((d.buttons&xe.LEFT)===xe.LEFT&&this._lockedPointer)return;let E={pointerId:d.pointerId,clientX:d.clientX,clientY:d.clientY,deltaX:0,deltaY:0,mouseButton:M};this._activePointers.push(E),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this._domElement.ownerDocument.addEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",l),this._isDragging=!0,u(d)},a=d=>{d.cancelable&&d.preventDefault();let M=d.pointerId,E=this._lockedPointer||this._findPointerById(M);if(E){if(E.clientX=d.clientX,E.clientY=d.clientY,E.deltaX=d.movementX,E.deltaY=d.movementY,this._state=0,d.pointerType==="touch")switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else(!this._isDragging&&this._lockedPointer||this._isDragging&&(d.buttons&xe.LEFT)===xe.LEFT)&&(this._state=this._state|this.mouseButtons.left),this._isDragging&&(d.buttons&xe.MIDDLE)===xe.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),this._isDragging&&(d.buttons&xe.RIGHT)===xe.RIGHT&&(this._state=this._state|this.mouseButtons.right);p()}},l=d=>{let M=this._findPointerById(d.pointerId);if(!(M&&M===this._lockedPointer)){if(M&&this._disposePointer(M),d.pointerType==="touch")switch(this._activePointers.length){case 0:this._state=Y.NONE;break;case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else this._state=Y.NONE;g()}},c=-1,h=d=>{if(!this._domElement||!this._enabled||this.mouseButtons.wheel===Y.NONE)return;if(this._interactiveArea.left!==0||this._interactiveArea.top!==0||this._interactiveArea.width!==1||this._interactiveArea.height!==1){let A=this._domElement.getBoundingClientRect(),y=d.clientX/A.width,T=d.clientY/A.height;if(y<this._interactiveArea.left||y>this._interactiveArea.right||T<this._interactiveArea.top||T>this._interactiveArea.bottom)return}if(d.preventDefault(),this.dollyToCursor||this.mouseButtons.wheel===Y.ROTATE||this.mouseButtons.wheel===Y.TRUCK){let A=performance.now();c-A<1e3&&this._getClientRect(this._elementRect),c=A}let M=oy?-1:-3,E=d.deltaMode===1&&!d.ctrlKey?d.deltaY/M:d.deltaY/(M*10),v=this.dollyToCursor?(d.clientX-this._elementRect.x)/this._elementRect.width*2-1:0,b=this.dollyToCursor?(d.clientY-this._elementRect.y)/this._elementRect.height*-2+1:0;switch(d.ctrlKey?Y.ZOOM:this.mouseButtons.wheel){case Y.ROTATE:{this._rotateInternal(d.deltaX,d.deltaY),this._isUserControllingRotate=!0;break}case Y.TRUCK:{this._truckInternal(d.deltaX,d.deltaY,!1,!1),this._isUserControllingTruck=!0;break}case Y.SCREEN_PAN:{this._truckInternal(d.deltaX,d.deltaY,!1,!0),this._isUserControllingTruck=!0;break}case Y.OFFSET:{this._truckInternal(d.deltaX,d.deltaY,!0,!1),this._isUserControllingOffset=!0;break}case Y.DOLLY:{this._dollyInternal(-E,v,b),this._isUserControllingDolly=!0;break}case Y.ZOOM:{this._zoomInternal(-E,v,b),this._isUserControllingZoom=!0;break}}this.dispatchEvent({type:"control"})},f=d=>{if(!(!this._domElement||!this._enabled)){if(this.mouseButtons.right===i.ACTION.NONE){let M=d instanceof PointerEvent?d.pointerId:0,E=this._findPointerById(M);E&&this._disposePointer(E),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l);return}d.preventDefault()}},u=d=>{if(!this._enabled)return;if(Qc(this._activePointers,Ke),this._getClientRect(this._elementRect),n.copy(Ke),s.copy(Ke),this._activePointers.length>=2){let E=Ke.x-this._activePointers[1].clientX,v=Ke.y-this._activePointers[1].clientY,b=Math.sqrt(E*E+v*v);r.set(0,b);let S=(this._activePointers[0].clientX+this._activePointers[1].clientX)*.5,A=(this._activePointers[0].clientY+this._activePointers[1].clientY)*.5;s.set(S,A)}if(this._state=0,!d)this._lockedPointer&&(this._state=this._state|this.mouseButtons.left);else if("pointerType"in d&&d.pointerType==="touch")switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else!this._lockedPointer&&(d.buttons&xe.LEFT)===xe.LEFT&&(this._state=this._state|this.mouseButtons.left),(d.buttons&xe.MIDDLE)===xe.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),(d.buttons&xe.RIGHT)===xe.RIGHT&&(this._state=this._state|this.mouseButtons.right);((this._state&Y.ROTATE)===Y.ROTATE||(this._state&Y.TOUCH_ROTATE)===Y.TOUCH_ROTATE||(this._state&Y.TOUCH_DOLLY_ROTATE)===Y.TOUCH_DOLLY_ROTATE||(this._state&Y.TOUCH_ZOOM_ROTATE)===Y.TOUCH_ZOOM_ROTATE)&&(this._sphericalEnd.theta=this._spherical.theta,this._sphericalEnd.phi=this._spherical.phi,this._thetaVelocity.value=0,this._phiVelocity.value=0),((this._state&Y.TRUCK)===Y.TRUCK||(this._state&Y.SCREEN_PAN)===Y.SCREEN_PAN||(this._state&Y.TOUCH_TRUCK)===Y.TOUCH_TRUCK||(this._state&Y.TOUCH_SCREEN_PAN)===Y.TOUCH_SCREEN_PAN||(this._state&Y.TOUCH_DOLLY_TRUCK)===Y.TOUCH_DOLLY_TRUCK||(this._state&Y.TOUCH_DOLLY_SCREEN_PAN)===Y.TOUCH_DOLLY_SCREEN_PAN||(this._state&Y.TOUCH_ZOOM_TRUCK)===Y.TOUCH_ZOOM_TRUCK||(this._state&Y.TOUCH_ZOOM_SCREEN_PAN)===Y.TOUCH_DOLLY_SCREEN_PAN)&&(this._targetEnd.copy(this._target),this._targetVelocity.set(0,0,0)),((this._state&Y.DOLLY)===Y.DOLLY||(this._state&Y.TOUCH_DOLLY)===Y.TOUCH_DOLLY||(this._state&Y.TOUCH_DOLLY_TRUCK)===Y.TOUCH_DOLLY_TRUCK||(this._state&Y.TOUCH_DOLLY_SCREEN_PAN)===Y.TOUCH_DOLLY_SCREEN_PAN||(this._state&Y.TOUCH_DOLLY_OFFSET)===Y.TOUCH_DOLLY_OFFSET||(this._state&Y.TOUCH_DOLLY_ROTATE)===Y.TOUCH_DOLLY_ROTATE)&&(this._sphericalEnd.radius=this._spherical.radius,this._radiusVelocity.value=0),((this._state&Y.ZOOM)===Y.ZOOM||(this._state&Y.TOUCH_ZOOM)===Y.TOUCH_ZOOM||(this._state&Y.TOUCH_ZOOM_TRUCK)===Y.TOUCH_ZOOM_TRUCK||(this._state&Y.TOUCH_ZOOM_SCREEN_PAN)===Y.TOUCH_ZOOM_SCREEN_PAN||(this._state&Y.TOUCH_ZOOM_OFFSET)===Y.TOUCH_ZOOM_OFFSET||(this._state&Y.TOUCH_ZOOM_ROTATE)===Y.TOUCH_ZOOM_ROTATE)&&(this._zoomEnd=this._zoom,this._zoomVelocity.value=0),((this._state&Y.OFFSET)===Y.OFFSET||(this._state&Y.TOUCH_OFFSET)===Y.TOUCH_OFFSET||(this._state&Y.TOUCH_DOLLY_OFFSET)===Y.TOUCH_DOLLY_OFFSET||(this._state&Y.TOUCH_ZOOM_OFFSET)===Y.TOUCH_ZOOM_OFFSET)&&(this._focalOffsetEnd.copy(this._focalOffset),this._focalOffsetVelocity.set(0,0,0)),this.dispatchEvent({type:"controlstart"})},p=()=>{if(!this._enabled||!this._dragNeedsUpdate)return;this._dragNeedsUpdate=!1,Qc(this._activePointers,Ke);let M=this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement?this._lockedPointer||this._activePointers[0]:null,E=M?-M.deltaX:s.x-Ke.x,v=M?-M.deltaY:s.y-Ke.y;if(s.copy(Ke),((this._state&Y.ROTATE)===Y.ROTATE||(this._state&Y.TOUCH_ROTATE)===Y.TOUCH_ROTATE||(this._state&Y.TOUCH_DOLLY_ROTATE)===Y.TOUCH_DOLLY_ROTATE||(this._state&Y.TOUCH_ZOOM_ROTATE)===Y.TOUCH_ZOOM_ROTATE)&&(this._rotateInternal(E,v),this._isUserControllingRotate=!0),(this._state&Y.DOLLY)===Y.DOLLY||(this._state&Y.ZOOM)===Y.ZOOM){let b=this.dollyToCursor?(n.x-this._elementRect.x)/this._elementRect.width*2-1:0,S=this.dollyToCursor?(n.y-this._elementRect.y)/this._elementRect.height*-2+1:0,A=this.dollyDragInverted?-1:1;(this._state&Y.DOLLY)===Y.DOLLY?(this._dollyInternal(A*v*il,b,S),this._isUserControllingDolly=!0):(this._zoomInternal(A*v*il,b,S),this._isUserControllingZoom=!0)}if((this._state&Y.TOUCH_DOLLY)===Y.TOUCH_DOLLY||(this._state&Y.TOUCH_ZOOM)===Y.TOUCH_ZOOM||(this._state&Y.TOUCH_DOLLY_TRUCK)===Y.TOUCH_DOLLY_TRUCK||(this._state&Y.TOUCH_ZOOM_TRUCK)===Y.TOUCH_ZOOM_TRUCK||(this._state&Y.TOUCH_DOLLY_SCREEN_PAN)===Y.TOUCH_DOLLY_SCREEN_PAN||(this._state&Y.TOUCH_ZOOM_SCREEN_PAN)===Y.TOUCH_ZOOM_SCREEN_PAN||(this._state&Y.TOUCH_DOLLY_OFFSET)===Y.TOUCH_DOLLY_OFFSET||(this._state&Y.TOUCH_ZOOM_OFFSET)===Y.TOUCH_ZOOM_OFFSET||(this._state&Y.TOUCH_DOLLY_ROTATE)===Y.TOUCH_DOLLY_ROTATE||(this._state&Y.TOUCH_ZOOM_ROTATE)===Y.TOUCH_ZOOM_ROTATE){let b=Ke.x-this._activePointers[1].clientX,S=Ke.y-this._activePointers[1].clientY,A=Math.sqrt(b*b+S*S),y=r.y-A;r.set(0,A);let T=this.dollyToCursor?(s.x-this._elementRect.x)/this._elementRect.width*2-1:0,C=this.dollyToCursor?(s.y-this._elementRect.y)/this._elementRect.height*-2+1:0;(this._state&Y.TOUCH_DOLLY)===Y.TOUCH_DOLLY||(this._state&Y.TOUCH_DOLLY_ROTATE)===Y.TOUCH_DOLLY_ROTATE||(this._state&Y.TOUCH_DOLLY_TRUCK)===Y.TOUCH_DOLLY_TRUCK||(this._state&Y.TOUCH_DOLLY_SCREEN_PAN)===Y.TOUCH_DOLLY_SCREEN_PAN||(this._state&Y.TOUCH_DOLLY_OFFSET)===Y.TOUCH_DOLLY_OFFSET?(this._dollyInternal(y*il,T,C),this._isUserControllingDolly=!0):(this._zoomInternal(y*il,T,C),this._isUserControllingZoom=!0)}((this._state&Y.TRUCK)===Y.TRUCK||(this._state&Y.TOUCH_TRUCK)===Y.TOUCH_TRUCK||(this._state&Y.TOUCH_DOLLY_TRUCK)===Y.TOUCH_DOLLY_TRUCK||(this._state&Y.TOUCH_ZOOM_TRUCK)===Y.TOUCH_ZOOM_TRUCK)&&(this._truckInternal(E,v,!1,!1),this._isUserControllingTruck=!0),((this._state&Y.SCREEN_PAN)===Y.SCREEN_PAN||(this._state&Y.TOUCH_SCREEN_PAN)===Y.TOUCH_SCREEN_PAN||(this._state&Y.TOUCH_DOLLY_SCREEN_PAN)===Y.TOUCH_DOLLY_SCREEN_PAN||(this._state&Y.TOUCH_ZOOM_SCREEN_PAN)===Y.TOUCH_ZOOM_SCREEN_PAN)&&(this._truckInternal(E,v,!1,!0),this._isUserControllingTruck=!0),((this._state&Y.OFFSET)===Y.OFFSET||(this._state&Y.TOUCH_OFFSET)===Y.TOUCH_OFFSET||(this._state&Y.TOUCH_DOLLY_OFFSET)===Y.TOUCH_DOLLY_OFFSET||(this._state&Y.TOUCH_ZOOM_OFFSET)===Y.TOUCH_ZOOM_OFFSET)&&(this._truckInternal(E,v,!0,!1),this._isUserControllingOffset=!0),this.dispatchEvent({type:"control"})},g=()=>{Qc(this._activePointers,Ke),s.copy(Ke),this._dragNeedsUpdate=!1,(this._activePointers.length===0||this._activePointers.length===1&&this._activePointers[0]===this._lockedPointer)&&(this._isDragging=!1),this._activePointers.length===0&&this._domElement&&(this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this.dispatchEvent({type:"controlend"}))};this.lockPointer=()=>{!this._enabled||!this._domElement||(this.cancel(),this._lockedPointer={pointerId:-1,clientX:0,clientY:0,deltaX:0,deltaY:0,mouseButton:null},this._activePointers.push(this._lockedPointer),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this._domElement.requestPointerLock(),this._domElement.ownerDocument.addEventListener("pointerlockchange",_),this._domElement.ownerDocument.addEventListener("pointerlockerror",m),this._domElement.ownerDocument.addEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",l),u())},this.unlockPointer=()=>{this._lockedPointer!==null&&(this._disposePointer(this._lockedPointer),this._lockedPointer=null),this._domElement?.ownerDocument.exitPointerLock(),this._domElement?.ownerDocument.removeEventListener("pointerlockchange",_),this._domElement?.ownerDocument.removeEventListener("pointerlockerror",m),this.cancel()};let _=()=>{this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement||this.unlockPointer()},m=()=>{this.unlockPointer()};this._addAllEventListeners=d=>{this._domElement=d,this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none",this._domElement.addEventListener("pointerdown",o),this._domElement.addEventListener("pointercancel",l),this._domElement.addEventListener("wheel",h,{passive:!1}),this._domElement.addEventListener("contextmenu",f)},this._removeAllEventListeners=()=>{this._domElement&&(this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect="",this._domElement.removeEventListener("pointerdown",o),this._domElement.removeEventListener("pointercancel",l),this._domElement.removeEventListener("wheel",h,{passive:!1}),this._domElement.removeEventListener("contextmenu",f),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this._domElement.ownerDocument.removeEventListener("pointerlockchange",_),this._domElement.ownerDocument.removeEventListener("pointerlockerror",m))},this.cancel=()=>{this._state!==Y.NONE&&(this._state=Y.NONE,this._activePointers.length=0,g())},e&&this.connect(e),this.update(0)}get camera(){return this._camera}set camera(t){this._camera=t,this.updateCameraUp(),this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0}get enabled(){return this._enabled}set enabled(t){this._enabled=t,this._domElement&&(t?(this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none"):(this.cancel(),this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect=""))}get active(){return!this._hasRested}get currentAction(){return this._state}get distance(){return this._spherical.radius}set distance(t){this._spherical.radius===t&&this._sphericalEnd.radius===t||(this._spherical.radius=t,this._sphericalEnd.radius=t,this._needsUpdate=!0)}get azimuthAngle(){return this._spherical.theta}set azimuthAngle(t){this._spherical.theta===t&&this._sphericalEnd.theta===t||(this._spherical.theta=t,this._sphericalEnd.theta=t,this._needsUpdate=!0)}get polarAngle(){return this._spherical.phi}set polarAngle(t){this._spherical.phi===t&&this._sphericalEnd.phi===t||(this._spherical.phi=t,this._sphericalEnd.phi=t,this._needsUpdate=!0)}get boundaryEnclosesCamera(){return this._boundaryEnclosesCamera}set boundaryEnclosesCamera(t){this._boundaryEnclosesCamera=t,this._needsUpdate=!0}set interactiveArea(t){this._interactiveArea.width=Sn(t.width,0,1),this._interactiveArea.height=Sn(t.height,0,1),this._interactiveArea.x=Sn(t.x,0,1-this._interactiveArea.width),this._interactiveArea.y=Sn(t.y,0,1-this._interactiveArea.height)}addEventListener(t,e){super.addEventListener(t,e)}removeEventListener(t,e){super.removeEventListener(t,e)}rotate(t,e,n=!1){return this.rotateTo(this._sphericalEnd.theta+t,this._sphericalEnd.phi+e,n)}rotateAzimuthTo(t,e=!1){return this.rotateTo(t,this._sphericalEnd.phi,e)}rotatePolarTo(t,e=!1){return this.rotateTo(this._sphericalEnd.theta,t,e)}rotateTo(t,e,n=!1){this._isUserControllingRotate=!1;let s=Sn(t,this.minAzimuthAngle,this.maxAzimuthAngle),r=Sn(e,this.minPolarAngle,this.maxPolarAngle);this._sphericalEnd.theta=s,this._sphericalEnd.phi=r,this._sphericalEnd.makeSafe(),this._needsUpdate=!0,n||(this._spherical.theta=this._sphericalEnd.theta,this._spherical.phi=this._sphericalEnd.phi);let o=!n||ie(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&ie(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold);return this._createOnRestPromise(o)}dolly(t,e=!1){return this.dollyTo(this._sphericalEnd.radius-t,e)}dollyTo(t,e=!1){return this._isUserControllingDolly=!1,this._lastDollyDirection=Os.NONE,this._changedDolly=0,this._dollyToNoClamp(Sn(t,this.minDistance,this.maxDistance),e)}_dollyToNoClamp(t,e=!1){let n=this._sphericalEnd.radius;if(this.colliderMeshes.length>=1){let o=this._collisionTest(),a=ie(o,this._spherical.radius);if(!(n>t)&&a)return Promise.resolve();this._sphericalEnd.radius=Math.min(t,o)}else this._sphericalEnd.radius=t;this._needsUpdate=!0,e||(this._spherical.radius=this._sphericalEnd.radius);let r=!e||ie(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(r)}dollyInFixed(t,e=!1){this._targetEnd.add(this._getCameraDirection(Gr).multiplyScalar(t)),e||this._target.copy(this._targetEnd);let n=!e||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(n)}zoom(t,e=!1){return this.zoomTo(this._zoomEnd+t,e)}zoomTo(t,e=!1){this._isUserControllingZoom=!1,this._zoomEnd=Sn(t,this.minZoom,this.maxZoom),this._needsUpdate=!0,e||(this._zoom=this._zoomEnd);let n=!e||ie(this._zoom,this._zoomEnd,this.restThreshold);return this._changedZoom=0,this._createOnRestPromise(n)}pan(t,e,n=!1){return console.warn("`pan` has been renamed to `truck`"),this.truck(t,e,n)}truck(t,e,n=!1){this._camera.updateMatrix(),On.setFromMatrixColumn(this._camera.matrix,0),Dn.setFromMatrixColumn(this._camera.matrix,1),On.multiplyScalar(t),Dn.multiplyScalar(-e);let s=kt.copy(On).add(Dn),r=Jt.copy(this._targetEnd).add(s);return this.moveTo(r.x,r.y,r.z,n)}forward(t,e=!1){kt.setFromMatrixColumn(this._camera.matrix,0),kt.crossVectors(this._camera.up,kt),kt.multiplyScalar(t);let n=Jt.copy(this._targetEnd).add(kt);return this.moveTo(n.x,n.y,n.z,e)}elevate(t,e=!1){return kt.copy(this._camera.up).multiplyScalar(t),this.moveTo(this._targetEnd.x+kt.x,this._targetEnd.y+kt.y,this._targetEnd.z+kt.z,e)}moveTo(t,e,n,s=!1){this._isUserControllingTruck=!1;let r=kt.set(t,e,n).sub(this._targetEnd);this._encloseToBoundary(this._targetEnd,r,this.boundaryFriction),this._needsUpdate=!0,s||this._target.copy(this._targetEnd);let o=!s||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(o)}lookInDirectionOf(t,e,n,s=!1){let a=kt.set(t,e,n).sub(this._targetEnd).normalize().multiplyScalar(-this._sphericalEnd.radius).add(this._targetEnd);return this.setPosition(a.x,a.y,a.z,s)}fitToBox(t,e,{cover:n=!1,paddingLeft:s=0,paddingRight:r=0,paddingBottom:o=0,paddingTop:a=0}={}){let l=[],c=t.isBox3?Fs.copy(t):Fs.setFromObject(t);c.isEmpty()&&(console.warn("camera-controls: fitTo() cannot be used with an empty box. Aborting"),Promise.resolve());let h=Yd(this._sphericalEnd.theta,qd),f=Yd(this._sphericalEnd.phi,qd);l.push(this.rotateTo(h,f,e));let u=kt.setFromSpherical(this._sphericalEnd).normalize(),p=Qd.setFromUnitVectors(u,eh),g=ie(Math.abs(u.y),1);g&&p.multiply(ih.setFromAxisAngle(sl,h)),p.multiply(this._yAxisUpSpaceInverse);let _=jd.makeEmpty();Jt.copy(c.min).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.min).setX(c.max.x).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.min).setY(c.max.y).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).setZ(c.min.z).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.min).setZ(c.max.z).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).setY(c.min.y).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).setX(c.min.x).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).applyQuaternion(p),_.expandByPoint(Jt),_.min.x-=s,_.min.y-=o,_.max.x+=r,_.max.y+=a,p.setFromUnitVectors(eh,u),g&&p.premultiply(ih.invert()),p.premultiply(this._yAxisUpSpace);let m=_.getSize(kt),d=_.getCenter(Jt).applyQuaternion(p);if(Hi(this._camera)){let M=this.getDistanceToFitBox(m.x,m.y,m.z,n);l.push(this.moveTo(d.x,d.y,d.z,e)),l.push(this.dollyTo(M,e)),l.push(this.setFocalOffset(0,0,0,e))}else if(Mi(this._camera)){let M=this._camera,E=M.right-M.left,v=M.top-M.bottom,b=n?Math.max(E/m.x,v/m.y):Math.min(E/m.x,v/m.y);l.push(this.moveTo(d.x,d.y,d.z,e)),l.push(this.zoomTo(b,e)),l.push(this.setFocalOffset(0,0,0,e))}return Promise.all(l)}fitToSphere(t,e){let n=[],r="isObject3D"in t?i.createBoundingSphere(t,nh):nh.copy(t);if(n.push(this.moveTo(r.center.x,r.center.y,r.center.z,e)),Hi(this._camera)){let o=this.getDistanceToFitSphere(r.radius);n.push(this.dollyTo(o,e))}else if(Mi(this._camera)){let o=this._camera.right-this._camera.left,a=this._camera.top-this._camera.bottom,l=2*r.radius,c=Math.min(o/l,a/l);n.push(this.zoomTo(c,e))}return n.push(this.setFocalOffset(0,0,0,e)),Promise.all(n)}setLookAt(t,e,n,s,r,o,a=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=Os.NONE,this._changedDolly=0;let l=Jt.set(s,r,o),c=kt.set(t,e,n);this._targetEnd.copy(l),this._sphericalEnd.setFromVector3(c.sub(l).applyQuaternion(this._yAxisUpSpace)),this._needsUpdate=!0,a||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let h=!a||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold)&&ie(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&ie(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&ie(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(h)}lerp(t,e,n,s=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=Os.NONE,this._changedDolly=0;let r=kt.set(...t.target);if("spherical"in t)sn.set(...t.spherical);else{let f=Jt.set(...t.position);sn.setFromVector3(f.sub(r).applyQuaternion(this._yAxisUpSpace))}let o=Ds.set(...e.target);if("spherical"in e)Ns.set(...e.spherical);else{let f=Jt.set(...e.position);Ns.setFromVector3(f.sub(o).applyQuaternion(this._yAxisUpSpace))}this._targetEnd.copy(r.lerp(o,n));let a=Ns.theta-sn.theta,l=Ns.phi-sn.phi,c=Ns.radius-sn.radius;this._sphericalEnd.set(sn.radius+c*n,sn.phi+l*n,sn.theta+a*n),this._needsUpdate=!0,s||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let h=!s||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold)&&ie(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&ie(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&ie(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(h)}lerpLookAt(t,e,n,s,r,o,a,l,c,h,f,u,p,g=!1){return this.lerp({position:[t,e,n],target:[s,r,o]},{position:[a,l,c],target:[h,f,u]},p,g)}setPosition(t,e,n,s=!1){return this.setLookAt(t,e,n,this._targetEnd.x,this._targetEnd.y,this._targetEnd.z,s)}setTarget(t,e,n,s=!1){let r=this.getPosition(kt),o=this.setLookAt(r.x,r.y,r.z,t,e,n,s);return this._sphericalEnd.phi=Sn(this._sphericalEnd.phi,this.minPolarAngle,this.maxPolarAngle),o}setFocalOffset(t,e,n,s=!1){this._isUserControllingOffset=!1,this._focalOffsetEnd.set(t,e,n),this._needsUpdate=!0,s||this._focalOffset.copy(this._focalOffsetEnd);let r=!s||ie(this._focalOffset.x,this._focalOffsetEnd.x,this.restThreshold)&&ie(this._focalOffset.y,this._focalOffsetEnd.y,this.restThreshold)&&ie(this._focalOffset.z,this._focalOffsetEnd.z,this.restThreshold);return this._createOnRestPromise(r)}setOrbitPoint(t,e,n){this._camera.updateMatrixWorld(),On.setFromMatrixColumn(this._camera.matrixWorldInverse,0),Dn.setFromMatrixColumn(this._camera.matrixWorldInverse,1),Gi.setFromMatrixColumn(this._camera.matrixWorldInverse,2);let s=kt.set(t,e,n),r=s.distanceTo(this._camera.position),o=s.sub(this._camera.position);On.multiplyScalar(o.x),Dn.multiplyScalar(o.y),Gi.multiplyScalar(o.z),kt.copy(On).add(Dn).add(Gi),kt.z=kt.z+r,this.dollyTo(r,!1),this.setFocalOffset(-kt.x,kt.y,-kt.z,!1),this.moveTo(t,e,n,!1)}setBoundary(t){if(!t){this._boundary.min.set(-1/0,-1/0,-1/0),this._boundary.max.set(1/0,1/0,1/0),this._needsUpdate=!0;return}this._boundary.copy(t),this._boundary.clampPoint(this._targetEnd,this._targetEnd),this._needsUpdate=!0}setViewport(t,e,n,s){if(t===null){this._viewport=null;return}this._viewport=this._viewport||new Nt.Vector4,typeof t=="number"?this._viewport.set(t,e,n,s):this._viewport.copy(t)}getDistanceToFitBox(t,e,n,s=!1){if(th(this._camera,"getDistanceToFitBox"))return this._spherical.radius;let r=t/e,o=this._camera.getEffectiveFOV()*zr,a=this._camera.aspect;return((s?r>a:r<a)?e:t/a)*.5/Math.tan(o*.5)+n*.5}getDistanceToFitSphere(t){if(th(this._camera,"getDistanceToFitSphere"))return this._spherical.radius;let e=this._camera.getEffectiveFOV()*zr,n=Math.atan(Math.tan(e*.5)*this._camera.aspect)*2,s=1<this._camera.aspect?e:n;return t/Math.sin(s*.5)}getTarget(t,e=!0){return(t&&t.isVector3?t:new Nt.Vector3).copy(e?this._targetEnd:this._target)}getPosition(t,e=!0){return(t&&t.isVector3?t:new Nt.Vector3).setFromSpherical(e?this._sphericalEnd:this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(e?this._targetEnd:this._target)}getSpherical(t,e=!0){return(t||new Nt.Spherical).copy(e?this._sphericalEnd:this._spherical)}getFocalOffset(t,e=!0){return(t&&t.isVector3?t:new Nt.Vector3).copy(e?this._focalOffsetEnd:this._focalOffset)}normalizeRotations(){return this._sphericalEnd.theta=(this._sphericalEnd.theta%vi+vi)%vi,this._sphericalEnd.theta>Math.PI&&(this._sphericalEnd.theta-=vi),this._spherical.theta+=vi*Math.round((this._sphericalEnd.theta-this._spherical.theta)/vi),this}stop(){this._focalOffset.copy(this._focalOffsetEnd),this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd),this._zoom=this._zoomEnd}reset(t=!1){if(!ie(this._camera.up.x,this._cameraUp0.x)||!ie(this._camera.up.y,this._cameraUp0.y)||!ie(this._camera.up.z,this._cameraUp0.z)){this._camera.up.copy(this._cameraUp0);let n=this.getPosition(kt);this.updateCameraUp(),this.setPosition(n.x,n.y,n.z)}let e=[this.setLookAt(this._position0.x,this._position0.y,this._position0.z,this._target0.x,this._target0.y,this._target0.z,t),this.setFocalOffset(this._focalOffset0.x,this._focalOffset0.y,this._focalOffset0.z,t),this.zoomTo(this._zoom0,t)];return Promise.all(e)}saveState(){this._cameraUp0.copy(this._camera.up),this.getTarget(this._target0),this.getPosition(this._position0),this._zoom0=this._zoom,this._focalOffset0.copy(this._focalOffset)}updateCameraUp(){this._yAxisUpSpace.setFromUnitVectors(this._camera.up,sl),this._yAxisUpSpaceInverse.copy(this._yAxisUpSpace).invert()}applyCameraUp(){let t=kt.subVectors(this._target,this._camera.position).normalize(),e=Jt.crossVectors(t,this._camera.up);this._camera.up.crossVectors(e,t).normalize(),this._camera.updateMatrixWorld();let n=this.getPosition(kt);this.updateCameraUp(),this.setPosition(n.x,n.y,n.z)}update(t){let e=this._sphericalEnd.theta-this._spherical.theta,n=this._sphericalEnd.phi-this._spherical.phi,s=this._sphericalEnd.radius-this._spherical.radius,r=Kd.subVectors(this._targetEnd,this._target),o=Jd.subVectors(this._focalOffsetEnd,this._focalOffset),a=this._zoomEnd-this._zoom;if(ue(e))this._thetaVelocity.value=0,this._spherical.theta=this._sphericalEnd.theta;else{let f=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.theta=nl(this._spherical.theta,this._sphericalEnd.theta,this._thetaVelocity,f,1/0,t),this._needsUpdate=!0}if(ue(n))this._phiVelocity.value=0,this._spherical.phi=this._sphericalEnd.phi;else{let f=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.phi=nl(this._spherical.phi,this._sphericalEnd.phi,this._phiVelocity,f,1/0,t),this._needsUpdate=!0}if(ue(s))this._radiusVelocity.value=0,this._spherical.radius=this._sphericalEnd.radius;else{let f=this._isUserControllingDolly?this.draggingSmoothTime:this.smoothTime;this._spherical.radius=nl(this._spherical.radius,this._sphericalEnd.radius,this._radiusVelocity,f,this.maxSpeed,t),this._needsUpdate=!0}if(ue(r.x)&&ue(r.y)&&ue(r.z))this._targetVelocity.set(0,0,0),this._target.copy(this._targetEnd);else{let f=this._isUserControllingTruck?this.draggingSmoothTime:this.smoothTime;Zd(this._target,this._targetEnd,this._targetVelocity,f,this.maxSpeed,t,this._target),this._needsUpdate=!0}if(ue(o.x)&&ue(o.y)&&ue(o.z))this._focalOffsetVelocity.set(0,0,0),this._focalOffset.copy(this._focalOffsetEnd);else{let f=this._isUserControllingOffset?this.draggingSmoothTime:this.smoothTime;Zd(this._focalOffset,this._focalOffsetEnd,this._focalOffsetVelocity,f,this.maxSpeed,t,this._focalOffset),this._needsUpdate=!0}if(ue(a))this._zoomVelocity.value=0,this._zoom=this._zoomEnd;else{let f=this._isUserControllingZoom?this.draggingSmoothTime:this.smoothTime;this._zoom=nl(this._zoom,this._zoomEnd,this._zoomVelocity,f,1/0,t)}if(this.dollyToCursor){if(Hi(this._camera)&&this._changedDolly!==0){let f=this._spherical.radius-this._lastDistance,u=this._camera,p=this._getCameraDirection(Gr),g=kt.copy(p).cross(u.up).normalize();g.lengthSq()===0&&(g.x=1);let _=Jt.crossVectors(g,p),m=this._sphericalEnd.radius*Math.tan(u.getEffectiveFOV()*zr*.5),M=(this._sphericalEnd.radius-f-this._sphericalEnd.radius)/this._sphericalEnd.radius,E=Ds.copy(this._targetEnd).add(g.multiplyScalar(this._dollyControlCoord.x*m*u.aspect)).add(_.multiplyScalar(this._dollyControlCoord.y*m)),v=kt.copy(this._targetEnd).lerp(E,M),b=this._lastDollyDirection===Os.IN&&this._spherical.radius<=this.minDistance,S=this._lastDollyDirection===Os.OUT&&this.maxDistance<=this._spherical.radius;if(this.infinityDolly&&(b||S)){this._sphericalEnd.radius-=f,this._spherical.radius-=f;let y=Jt.copy(p).multiplyScalar(-f);v.add(y)}this._boundary.clampPoint(v,v);let A=Jt.subVectors(v,this._targetEnd);this._targetEnd.copy(v),this._target.add(A),this._changedDolly-=f,ue(this._changedDolly)&&(this._changedDolly=0)}else if(Mi(this._camera)&&this._changedZoom!==0){let f=this._zoom-this._lastZoom,u=this._camera,p=kt.set(this._dollyControlCoord.x,this._dollyControlCoord.y,(u.near+u.far)/(u.near-u.far)).unproject(u),g=Jt.set(0,0,-1).applyQuaternion(u.quaternion),_=Ds.copy(p).add(g.multiplyScalar(-p.dot(u.up))),d=-(this._zoom-f-this._zoom)/this._zoom,M=this._getCameraDirection(Gr),E=this._targetEnd.dot(M),v=kt.copy(this._targetEnd).lerp(_,d),b=v.dot(M),S=M.multiplyScalar(b-E);v.sub(S),this._boundary.clampPoint(v,v);let A=Jt.subVectors(v,this._targetEnd);this._targetEnd.copy(v),this._target.add(A),this._changedZoom-=f,ue(this._changedZoom)&&(this._changedZoom=0)}}this._camera.zoom!==this._zoom&&(this._camera.zoom=this._zoom,this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0),this._dragNeedsUpdate=!0;let l=this._collisionTest();this._spherical.radius=Math.min(this._spherical.radius,l),this._spherical.makeSafe(),this._camera.position.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(this._target),this._camera.lookAt(this._target),(!ue(this._focalOffset.x)||!ue(this._focalOffset.y)||!ue(this._focalOffset.z))&&(this._camera.matrix.compose(this._camera.position,this._camera.quaternion,this._camera.scale),On.setFromMatrixColumn(this._camera.matrix,0),Dn.setFromMatrixColumn(this._camera.matrix,1),Gi.setFromMatrixColumn(this._camera.matrix,2),On.multiplyScalar(this._focalOffset.x),Dn.multiplyScalar(-this._focalOffset.y),Gi.multiplyScalar(this._focalOffset.z),kt.copy(On).add(Dn).add(Gi),this._camera.position.add(kt),this._camera.updateMatrixWorld()),this._boundaryEnclosesCamera&&this._encloseToBoundary(this._camera.position.copy(this._target),kt.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse),1);let h=this._needsUpdate;return h&&!this._updatedLastTime?(this._hasRested=!1,this.dispatchEvent({type:"wake"}),this.dispatchEvent({type:"update"})):h?(this.dispatchEvent({type:"update"}),ue(e,this.restThreshold)&&ue(n,this.restThreshold)&&ue(s,this.restThreshold)&&ue(r.x,this.restThreshold)&&ue(r.y,this.restThreshold)&&ue(r.z,this.restThreshold)&&ue(o.x,this.restThreshold)&&ue(o.y,this.restThreshold)&&ue(o.z,this.restThreshold)&&ue(a,this.restThreshold)&&!this._hasRested&&(this._hasRested=!0,this.dispatchEvent({type:"rest"}))):!h&&this._updatedLastTime&&this.dispatchEvent({type:"sleep"}),this._lastDistance=this._spherical.radius,this._lastZoom=this._zoom,this._updatedLastTime=h,this._needsUpdate=!1,h}toJSON(){return JSON.stringify({enabled:this._enabled,minDistance:this.minDistance,maxDistance:Vr(this.maxDistance),minZoom:this.minZoom,maxZoom:Vr(this.maxZoom),minPolarAngle:this.minPolarAngle,maxPolarAngle:Vr(this.maxPolarAngle),minAzimuthAngle:Vr(this.minAzimuthAngle),maxAzimuthAngle:Vr(this.maxAzimuthAngle),smoothTime:this.smoothTime,draggingSmoothTime:this.draggingSmoothTime,dollySpeed:this.dollySpeed,truckSpeed:this.truckSpeed,dollyToCursor:this.dollyToCursor,target:this._targetEnd.toArray(),position:kt.setFromSpherical(this._sphericalEnd).add(this._targetEnd).toArray(),zoom:this._zoomEnd,focalOffset:this._focalOffsetEnd.toArray(),target0:this._target0.toArray(),position0:this._position0.toArray(),zoom0:this._zoom0,focalOffset0:this._focalOffset0.toArray()})}fromJSON(t,e=!1){let n=JSON.parse(t);this.enabled=n.enabled,this.minDistance=n.minDistance,this.maxDistance=Hr(n.maxDistance),this.minZoom=n.minZoom,this.maxZoom=Hr(n.maxZoom),this.minPolarAngle=n.minPolarAngle,this.maxPolarAngle=Hr(n.maxPolarAngle),this.minAzimuthAngle=Hr(n.minAzimuthAngle),this.maxAzimuthAngle=Hr(n.maxAzimuthAngle),this.smoothTime=n.smoothTime,this.draggingSmoothTime=n.draggingSmoothTime,this.dollySpeed=n.dollySpeed,this.truckSpeed=n.truckSpeed,this.dollyToCursor=n.dollyToCursor,this._target0.fromArray(n.target0),this._position0.fromArray(n.position0),this._zoom0=n.zoom0,this._focalOffset0.fromArray(n.focalOffset0),this.moveTo(n.target[0],n.target[1],n.target[2],e),sn.setFromVector3(kt.fromArray(n.position).sub(this._targetEnd).applyQuaternion(this._yAxisUpSpace)),this.rotateTo(sn.theta,sn.phi,e),this.dollyTo(sn.radius,e),this.zoomTo(n.zoom,e),this.setFocalOffset(n.focalOffset[0],n.focalOffset[1],n.focalOffset[2],e),this._needsUpdate=!0}connect(t){if(this._domElement){console.warn("camera-controls is already connected.");return}t.setAttribute("data-camera-controls-version",ry),this._addAllEventListeners(t),this._getClientRect(this._elementRect)}disconnect(){this.cancel(),this._removeAllEventListeners(),this._domElement&&(this._domElement.removeAttribute("data-camera-controls-version"),this._domElement=void 0)}dispose(){this.removeAllEventListeners(),this.disconnect()}_getTargetDirection(t){return t.setFromSpherical(this._spherical).divideScalar(this._spherical.radius).applyQuaternion(this._yAxisUpSpaceInverse)}_getCameraDirection(t){return this._getTargetDirection(t).negate()}_findPointerById(t){return this._activePointers.find(e=>e.pointerId===t)}_findPointerByMouseButton(t){return this._activePointers.find(e=>e.mouseButton===t)}_disposePointer(t){this._activePointers.splice(this._activePointers.indexOf(t),1)}_encloseToBoundary(t,e,n){let s=e.lengthSq();if(s===0)return t;let r=Jt.copy(e).add(t),a=this._boundary.clampPoint(r,Ds).sub(r),l=a.lengthSq();if(l===0)return t.add(e);if(l===s)return t;if(n===0)return t.add(e).add(a);{let c=1+n*l/e.dot(a);return t.add(Jt.copy(e).multiplyScalar(c)).add(a.multiplyScalar(1-n))}}_updateNearPlaneCorners(){if(Hi(this._camera)){let t=this._camera,e=t.near,n=t.getEffectiveFOV()*zr,s=Math.tan(n*.5)*e,r=s*t.aspect;this._nearPlaneCorners[0].set(-r,-s,0),this._nearPlaneCorners[1].set(r,-s,0),this._nearPlaneCorners[2].set(r,s,0),this._nearPlaneCorners[3].set(-r,s,0)}else if(Mi(this._camera)){let t=this._camera,e=1/t.zoom,n=t.left*e,s=t.right*e,r=t.top*e,o=t.bottom*e;this._nearPlaneCorners[0].set(n,r,0),this._nearPlaneCorners[1].set(s,r,0),this._nearPlaneCorners[2].set(s,o,0),this._nearPlaneCorners[3].set(n,o,0)}}_truckInternal=(t,e,n,s)=>{let r,o;if(Hi(this._camera)){let a=kt.copy(this._camera.position).sub(this._target),l=this._camera.getEffectiveFOV()*zr,c=a.length()*Math.tan(l*.5);r=this.truckSpeed*t*c/this._elementRect.height,o=this.truckSpeed*e*c/this._elementRect.height}else if(Mi(this._camera)){let a=this._camera;r=this.truckSpeed*t*(a.right-a.left)/a.zoom/this._elementRect.width,o=this.truckSpeed*e*(a.top-a.bottom)/a.zoom/this._elementRect.height}else return;s?(n?this.setFocalOffset(this._focalOffsetEnd.x+r,this._focalOffsetEnd.y,this._focalOffsetEnd.z,!0):this.truck(r,0,!0),this.forward(-o,!0)):n?this.setFocalOffset(this._focalOffsetEnd.x+r,this._focalOffsetEnd.y+o,this._focalOffsetEnd.z,!0):this.truck(r,o,!0)};_rotateInternal=(t,e)=>{let n=vi*this.azimuthRotateSpeed*t/this._elementRect.height,s=vi*this.polarRotateSpeed*e/this._elementRect.height;this.rotate(n,s,!0)};_dollyInternal=(t,e,n)=>{let s=Math.pow(.95,-t*this.dollySpeed),r=this._sphericalEnd.radius,o=this._sphericalEnd.radius*s,a=Sn(o,this.minDistance,this.maxDistance),l=a-o;this.infinityDolly&&this.dollyToCursor?this._dollyToNoClamp(o,!0):this.infinityDolly&&!this.dollyToCursor?(this.dollyInFixed(l,!0),this._dollyToNoClamp(a,!0)):this._dollyToNoClamp(a,!0),this.dollyToCursor&&(this._changedDolly+=(this.infinityDolly?o:a)-r,this._dollyControlCoord.set(e,n)),this._lastDollyDirection=Math.sign(-t)};_zoomInternal=(t,e,n)=>{let s=Math.pow(.95,t*this.dollySpeed),r=this._zoom,o=this._zoom*s;this.zoomTo(o,!0),this.dollyToCursor&&(this._changedZoom+=o-r,this._dollyControlCoord.set(e,n))};_collisionTest(){let t=1/0;if(!(this.colliderMeshes.length>=1)||th(this._camera,"_collisionTest"))return t;let n=this._getTargetDirection(Gr);sh.lookAt($d,n,this._camera.up);for(let s=0;s<4;s++){let r=Jt.copy(this._nearPlaneCorners[s]);r.applyMatrix4(sh);let o=Ds.addVectors(this._target,r);rl.set(o,n),rl.far=this._spherical.radius+1;let a=rl.intersectObjects(this.colliderMeshes);a.length!==0&&a[0].distance<t&&(t=a[0].distance)}return t}_getClientRect(t){if(!this._domElement)return;let e=this._domElement.getBoundingClientRect();return t.x=e.left,t.y=e.top,this._viewport?(t.x+=this._viewport.x,t.y+=e.height-this._viewport.w-this._viewport.y,t.width=this._viewport.z,t.height=this._viewport.w):(t.width=e.width,t.height=e.height),t}_createOnRestPromise(t){return t?Promise.resolve():(this._hasRested=!1,this.dispatchEvent({type:"transitionstart"}),new Promise(e=>{let n=()=>{this.removeEventListener("rest",n),e()};this.addEventListener("rest",n)}))}_addAllEventListeners(t){}_removeAllEventListeners(){}get dampingFactor(){return console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead."),0}set dampingFactor(t){console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead.")}get draggingDampingFactor(){return console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead."),0}set draggingDampingFactor(t){console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead.")}static createBoundingSphere(t,e=new Nt.Sphere){let n=e,s=n.center;Fs.makeEmpty(),t.traverseVisible(o=>{o.isMesh&&Fs.expandByObject(o)}),Fs.getCenter(s);let r=0;return t.traverseVisible(o=>{if(!o.isMesh)return;let a=o;if(!a.geometry)return;let l=a.geometry.clone();l.applyMatrix4(a.matrixWorld);let h=l.attributes.position;for(let f=0,u=h.count;f<u;f++)kt.fromBufferAttribute(h,f),r=Math.max(r,s.distanceToSquared(kt))}),n.radius=Math.sqrt(r),n}};Bs.install({THREE:{Vector2:Ht,Vector3:k,Vector4:he,Quaternion:en,Matrix4:ne,Spherical:bs,Box3:ln,Sphere:_n,Raycaster:Tr,MathUtils:yi}});var ks=["iso","front","side","top"],ef={iso:[1,1,.8],front:[1,0,0],side:[0,1,0],top:[0,-.001,1]},nf=.001,sf=Math.PI/2,Si=.08,Je=Bs.ACTION,ay=Je.ROTATE|Je.TOUCH_ROTATE|Je.TOUCH_DOLLY_ROTATE|Je.TOUCH_ZOOM_ROTATE,ol=new k,bi=new bs,al=new en,ah=new k(0,0,1),ly=new k,Wr=new k,Xr=new k,of=new k(0,1,0),cy={rx:1,ry:0,rz:0,ux:0,uy:0,uz:1};function rf(i){let t=ef[Object.hasOwn(ef,i)?i:"iso"];return al.setFromUnitVectors(ah,of),bi.setFromVector3(ol.set(t[0],t[1],t[2]).normalize().applyQuaternion(al)),{azimuth:bi.theta,polar:bi.phi}}function oh(i,t){let e=2*Math.PI;return i+e*Math.round((t-i)/e)}var ll=class{constructor(t){this.camera=new di(-1,1,1,-1,.05,500),this.camera.up.set(0,0,1),this.camera.position.set(1,1,.8).normalize().multiplyScalar(50),this.controls=new Bs(this.camera,t||void 0);let e=this.controls;e.smoothTime=Si,e.draggingSmoothTime=.1,e.minPolarAngle=nf,e.maxPolarAngle=sf,e.minZoom=.001,e.maxZoom=1e3,e.dollyToCursor=!1,e.mouseButtons.left=Je.ROTATE,e.mouseButtons.middle=Je.ZOOM,e.mouseButtons.right=Je.TRUCK,e.mouseButtons.wheel=Je.ZOOM,e.touches.one=Je.TOUCH_ROTATE,e.touches.two=Je.TOUCH_ZOOM_TRUCK,e.touches.three=Je.TOUCH_TRUCK,this.scale=3,this.aspect=1,this.distance=50,this.dragging=!1,this.dragRotate=!1,this.applied=new k,this.userChanged=!1,this.userZoomed=!1,e.addEventListener("controlstart",()=>{this.dragging=!0,this.dragRotate=(e.currentAction&ay)!==0,e.smoothTime=Si}),e.addEventListener("controlend",()=>{this.dragging=!1,this.dragRotate=!1}),e.addEventListener("control",()=>{this.userChanged=!0,(!this.dragging||(e.currentAction&(Je.ZOOM|Je.TOUCH_ZOOM|Je.TOUCH_ZOOM_TRUCK))!==0)&&(this.userZoomed=!0)}),this.applyFrustum(),this.setAngles(rf("iso"),!1)}get dom(){return this.controls._domElement}setFrame(t,e){t>0&&(this.scale=t),e>0&&(this.aspect=e),this.applyFrustum()}applyFrustum(){let t=this.scale/2,e=t*this.aspect,n=this.camera;n.left=-e,n.right=e,n.top=t,n.bottom=-t,n.updateProjectionMatrix()}setDepth(t,e){this.distance=t,this.camera.near=.05,this.camera.far=e,this.camera.updateProjectionMatrix(),this.controls.dollyTo(t,!1)}get height(){return this.scale/this.camera.zoom}setAngles({azimuth:t,polar:e},n){let s=this.controls.getSpherical(bi,!0),r=oh(t,s.theta);this.controls.smoothTime=Si,this.controls.rotateTo(r,e,n)}setView(t,e){this.setAngles(rf(t),e)}get azimuth(){return this.controls.azimuthAngle}setAzimuthNow(t){let e=this.controls.getSpherical(bi,!0);this.controls.rotateTo(oh(t,e.theta),e.phi,!1)}getTarget(t){return this.controls.getTarget(t,!1)}setTargetNow(t,e,n){this.applied.set(t,e,n),this.controls.moveTo(t,e,n,!1)}setTarget(t,e,n,s){this.applied.set(t,e,n),this.controls.smoothTime=Si,this.controls.moveTo(t,e,n,s)}dragDelta(t){let e=this.controls.getTarget(ol,!0),n=e.x-this.applied.x,s=e.y-this.applied.y,r=e.z-this.applied.z;return n===0&&s===0&&r===0?!1:(this.camera.updateMatrix(),Wr.setFromMatrixColumn(this.camera.matrix,0),Xr.setFromMatrixColumn(this.camera.matrix,1),t[0]=Wr.x*n+Wr.y*s+Wr.z*r,t[1]=Xr.x*n+Xr.y*s+Xr.z*r,!0)}basis(t=!0){let e=this.controls.getSpherical(bi,t);al.setFromUnitVectors(ah,of).invert();let n=ol.setFromSpherical(e).normalize().applyQuaternion(al),s=ly.copy(n).negate(),r=Wr.crossVectors(s,ah);r.lengthSq()<1e-8&&r.set(1,0,0),r.normalize();let o=Xr.crossVectors(r,s).normalize(),a=cy;return a.rx=r.x,a.ry=r.y,a.rz=r.z,a.ux=o.x,a.uy=o.y,a.uz=o.z,a}fitRadius(t,e,n=1.15){let s=2*Math.max(t,.05)*n/Math.min(1,this.aspect);this.controls.smoothTime=Si,this.controls.zoomTo(yi.clamp(this.scale/s,this.controls.minZoom,this.controls.maxZoom),e),this.userZoomed=!1}fitBox(t,e,n,s,r=1.04){let o=this.basis(!0),a=t*Math.abs(o.rx)+e*Math.abs(o.ry)+n*Math.abs(o.rz),l=t*Math.abs(o.ux)+e*Math.abs(o.uy)+n*Math.abs(o.uz),c=2*r*Math.max(l,a/this.aspect,.05);this.controls.smoothTime=Si,this.controls.zoomTo(yi.clamp(this.scale/c,this.controls.minZoom,this.controls.maxZoom),s),this.userZoomed=!1}setZoomNow(t){this.controls.zoomTo(t,!1)}get targetHeight(){return this.scale/this.controls._zoomEnd}setHeight(t,e){this.controls.smoothTime=Si,this.controls.zoomTo(yi.clamp(this.scale/t,this.controls.minZoom,this.controls.maxZoom),e),this.userZoomed=!1}update(t){return this.controls.update(t)}get rotateBusy(){return this.dragRotate}state(t){let e=this.controls.getSpherical(bi,!0),n=this.controls.getTarget(ol,!0);return{v:1,azimuth:e.theta,polar:e.phi,zoom:this.controls._zoomEnd,scale:this.scale,target:[n.x,n.y,n.z],following:!!t}}apply(t,e,n){if(!t||t.v!==1)return;this.controls.smoothTime=Si;let s=this.controls.getSpherical(bi,!0),r=yi.clamp(t.polar,nf,sf);this.controls.rotateTo(oh(t.azimuth,s.theta),r,e);let o=t.scale/t.zoom;this.controls.zoomTo(yi.clamp(this.scale/o,this.controls.minZoom,this.controls.maxZoom),e),n&&this.setTarget(t.target[0],t.target[1],t.target[2],e)}dispose(){this.controls.dispose()}};var cl=null,lh="#010203";function af(i){let t=new Ut;if(typeof document<"u")try{cl??=document.createElement("canvas"),cl.width=cl.height=1;let e=cl.getContext("2d",{willReadFrequently:!0});if(e.clearRect(0,0,1,1),e.fillStyle=lh,e.fillStyle=i,e.fillStyle===lh&&String(i).trim().toLowerCase()!==lh)return null;e.fillRect(0,0,1,1);let[n,s,r]=e.getImageData(0,0,1,1).data;return t.setRGB(n/255,s/255,r/255,me)}catch{}try{return t.setStyle(i,me)}catch{return null}}function hy(i,t,e){let n=t*Math.cos(e*Math.PI/180),s=t*Math.sin(e*Math.PI/180),r=(i+.3963377774*n+.2158037573*s)**3,o=(i-.1055613458*n-.0638541728*s)**3,a=(i-.0894841775*n-1.291485548*s)**3;return[4.0767416621*r-3.3077115913*o+.2309699292*a,-1.2684380046*r+2.6097574011*o-.3413193965*a,-.0041960863*r-.7034186147*o+1.707614701*a].map(c=>{let h=Math.min(Math.max(c,0),1);return h<=.0031308?12.92*h:1.055*h**(1/2.4)-.055})}function uy(i,t=0,e=0){let[n,s,r]=hy(i,t,e);return new Ut().setRGB(n,s,r,me)}var lf={light:{viewport:[.97,0,0],checker:[[.94,0,0],[.9,0,0]],grid:{base:[.94,0,0],line:[.82,0,0]},contact:[.54,.2,295],arrow:[.35,0,0],fg:[.145,0,0]},dark:{viewport:[.18,0,0],checker:[[.24,0,0],[.205,0,0]],grid:{base:[.24,0,0],line:[.34,0,0]},contact:[.56,.2,295],arrow:[.8,0,0],fg:[.985,0,0]}},Nn=i=>i==="dark"?lf.dark:lf.light,Zn=i=>uy(i[0],i[1],i[2]);var dy="#8d99ae",hl=["#440154","#3b528b","#21918c","#5ec962","#fde725"].map(i=>new Ut().setStyle(i,me));function fy(i,t){let e=Math.min(Math.max(i,0),1)*(hl.length-1),n=Math.min(Math.floor(e),hl.length-2);return t.copy(hl[n]).lerp(hl[n+1],e-n)}function cf(i,t){let e=new Rn(1,1,1),n=new li({roughness:.75,metalness:0}),s=new xn(e,n,i);s.instanceMatrix.setUsage(xi),s.instanceMatrix.array.fill(0),s.frustumCulled=!1;let r=new Ut().setStyle(dy,me);s.instanceColor=new Di(new Float32Array(i*3),3);for(let p=0;p<i;p++)r.toArray(s.instanceColor.array,3*p);s.instanceColor.needsUpdate=!0;let o=s.instanceMatrix.array,[a,l,c]=t;function h(p,g,_){for(let m=0,d=0,M=0;m<i;m++,d+=7,M+=16){if(_[m]){o.fill(0,M,M+16);continue}let E=p[d+3],v=p[d+4],b=p[d+5],S=p[d+6],A=E*E,y=v*v,T=b*b,C=E*v,I=E*b,L=v*b,N=S*E,P=S*v,O=S*b;o[M]=(1-2*(y+T))*a,o[M+1]=2*(C+O)*a,o[M+2]=2*(I-P)*a,o[M+3]=0,o[M+4]=2*(C-O)*l,o[M+5]=(1-2*(A+T))*l,o[M+6]=2*(L+N)*l,o[M+7]=0,o[M+8]=2*(I+P)*c,o[M+9]=2*(L-N)*c,o[M+10]=(1-2*(A+y))*c,o[M+11]=0,o[M+12]=p[d]+g[3*m],o[M+13]=p[d+1]+g[3*m+1],o[M+14]=p[d+2]+g[3*m+2],o[M+15]=1}s.instanceMatrix.needsUpdate=!0}function f(p,g="high"){let _=new Ut,m=s.instanceColor.array;if(!p||p.length!==i)for(let d=0;d<i;d++)r.toArray(m,3*d);else{let d=1/0,M=-1/0;for(let v=0;v<i;v++){let b=p[v];Number.isFinite(b)&&(d=Math.min(d,b),M=Math.max(M,b))}let E=M>d?M-d:1;for(let v=0;v<i;v++){let b=p[v];Number.isFinite(b)?fy(g==="low"?1-(b-d)/E:(b-d)/E,_).toArray(m,3*v):r.toArray(m,3*v)}}s.instanceColor.needsUpdate=!0}function u(){e.dispose(),n.dispose(),s.dispose()}return{mesh:s,update:h,setColors:f,dispose:u}}function py(i,t,e,n){let s=i*i,r=t*t,o=e*e,a=i*t,l=i*e,c=t*e,h=n*i,f=n*t,u=n*e;return[1-2*(r+o),2*(a-u),2*(l+f),2*(a+u),1-2*(s+o),2*(c-h),2*(l-f),2*(c+h),1-2*(s+r)]}var Fn=[0,0,0],Oe=[0,0,0];function hf(i,t,e,n,s=[0,0,0],r=[0,0,0]){let o=py(t[e+3],t[e+4],t[e+5],t[e+6]),a=i.axes;for(let l=0;l<3;l++){let c=t[e+l]+n[l]+o[3*l]*i.c[0]+o[3*l+1]*i.c[1]+o[3*l+2]*i.c[2],h=0;for(let f=0;f<3;f++){let u=o[3*l]*a[3*f]+o[3*l+1]*a[3*f+1]+o[3*l+2]*a[3*f+2];h+=Math.abs(u)*i.h[f]}s[l]=c-h,r[l]=c+h}return{lo:s,hi:r}}var my=1024;function uf({poses:i,T:t,B:e,follow:n,origin:s,boxes:r}){let o=e*7,a=new Uint8Array(e);for(let P=1;P<t;P++){let O=P*o;for(let U=0;U<e;U++){if(a[U])continue;let V=O+7*U,J=7*U;if(Math.abs(i[V]-i[J])>1e-4||Math.abs(i[V+1]-i[J+1])>1e-4||Math.abs(i[V+2]-i[J+2])>1e-4){a[U]=1;continue}let Z=i[V+3]*i[J+3]+i[V+4]*i[J+4]+i[V+5]*i[J+5]+i[V+6]*i[J+6];1-Math.abs(Z)>1e-6&&(a[U]=1)}}let l=new Float32Array(t),c=new Float32Array(t),h=1/0,f=-1/0,u=1/0,p=-1/0,g=1/0,_=-1/0,m=0,d=0;for(let P=0;P<t;P++){let O=P*o+7*n,U=i[O]+s[0],V=i[O+1]+s[1],J=i[O+2]+s[2];l[P]=U,c[P]=V,J<h&&(h=J,m=P),J>f&&(f=J,d=P),U<u&&(u=U),U>p&&(p=U),V<g&&(g=V),V>_&&(_=V)}let M=r.filter(P=>P.body===n||a[P.body]),E=h,v=f,b=.05,S=Math.max(1,Math.floor(t/my)),A=P=>{let O=P*o+7*n,U=i[O]+s[0],V=i[O+1]+s[1];for(let J of M){let Z=P*o+7*J.body;if(J.body!==n&&Math.hypot(i[Z]-i[O],i[Z+1]-i[O+1],i[Z+2]-i[O+2])>1)continue;hf(J,i,Z,s,Fn,Oe),Fn[2]<E&&(E=Fn[2]),Oe[2]>v&&(v=Oe[2]);let tt=Math.max(Math.abs(Fn[0]-U),Math.abs(Oe[0]-U)),it=Math.max(Math.abs(Fn[1]-V),Math.abs(Oe[1]-V)),W=Math.hypot(tt,it);W>b&&(b=W)}};for(let P=0;P<t;P+=S)A(P);A(t-1),A(m),A(d),M.length||(E=h-.3,v=f+.3,b=.3);let y=1+b,T=[u-y,g-y],C=[p+y,_+y],I=[],L=-1/0,N=0;for(let P of r){if(a[P.body]||P.body===n)continue;if(++N>256)break;if(hf(P,i,7*P.body,s,Fn,Oe),Oe[2]<.05||Oe[0]<T[0]||Fn[0]>C[0]||Oe[1]<T[1]||Fn[1]>C[1])continue;let O=Math.max(Fn[0],T[0]),U=Math.min(Oe[0],C[0]),V=Math.max(Fn[1],T[1]),J=Math.min(Oe[1],C[1]);I.push(O,V,Oe[2],U,V,Oe[2],O,J,Oe[2],U,J,Oe[2]),Oe[2]>L&&(L=Oe[2])}return{zlo:Math.min(0,E),zhi:Math.max(v,L),rz:[E,v],Rxy:b,xs:l,ys:c,corners:Float32Array.from(I),T:t}}function df(i,t,e,n,s,r,o=1.1){let a=Math.max(Math.abs(s*(i.rz[0]-t)),Math.abs(s*(i.rz[1]-t)))+i.Rxy*Math.hypot(e,n);a=Math.max(a,Math.abs(s*t));let l=i.corners;if(l.length){let f=1/0,u=-1/0;for(let p=0;p<i.T;p++){let g=e*i.xs[p]+n*i.ys[p];g<f&&(f=g),g>u&&(u=g)}for(let p=0;p<l.length;p+=3){let g=e*l[p]+n*l[p+1],_=s*(l[p+2]-t);a=Math.max(a,Math.abs(g-u+_),Math.abs(g-f+_))}}let c=2*a*o,h=2*i.Rxy*o/Math.max(r,.001);return Math.max(c,h,.1)}var ff=["torso","base","trunk","pelvis","chassis"];function pf(i){let t=i.map(n=>String(n).toLowerCase());for(let n of[!0,!1])for(let s of ff){let r=t.findIndex(o=>n?o===s:o.startsWith(s));if(r>=0)return r}let e=t.findIndex(n=>n!=="world");return e>=0?e:0}function zs(i=0){return{x:i,v:0}}function Vs(i,t,e,n){if(!(n>0))return i.x;let r=2/Math.max(1e-4,e),o=r*n,a=1/(1+o+.48*o*o+.235*o*o*o),l=i.x-t,c=(i.v+r*l)*n;i.v=(i.v-r*c)*a;let h=t+(l+c)*a;return t-i.x>0==h>t&&(h=t,i.v=0),i.x=h,h}function gy(i,t){let e=(t-i)%(2*Math.PI);return e>Math.PI?e-=2*Math.PI:e<=-Math.PI&&(e+=2*Math.PI),e}function _y(i,t,e,n){return Vs(i,i.x+gy(i.x,t),e,n)}function mf(){return{x:zs(),y:zs(),z:zs(),yaw:zs(),primed:!1}}function ch(i,t,e,n,s=0){i.x.x=t,i.x.v=0,i.y.x=e,i.y.v=0,i.z.x=n,i.z.v=0,i.yaw.x=s,i.yaw.v=0,i.primed=!0}function gf(i,t,e,n,s,r,o=.12,a=1/0){return!i.primed||Math.hypot(t-i.x.x,e-i.y.x,n-i.z.x)>a?(ch(i,t,e,n,s),!0):(Vs(i.x,t,o,r),Vs(i.y,e,o,r),Vs(i.z,n,o,r),_y(i.yaw,s,o,r),!1)}var Hs=new Map;function xy(i){let t=new Ie;return t.setAttribute("position",new we(i.verts,3)),t.setAttribute("normal",new we(i.normals,3)),i.uvs&&t.setAttribute("uv",new we(i.uvs,2)),t.setIndex(new we(i.faces,1)),t}function _f(i,t){let e=Hs.get(i);return e||(e={refs:0,geometry:null,promise:null},e.promise=t().then(n=>e.geometry=xy(n),n=>{throw Hs.get(i)===e&&Hs.delete(i),n}),Hs.set(i,e)),e.refs++,e.promise}function xf(i){let t=Hs.get(i);!t||--t.refs>0||(Hs.delete(i),t.geometry?t.geometry.dispose():t.promise.then(e=>e.dispose(),()=>{}))}var ul=(i,t)=>i.copy(Zn(t)),yf=1,yy=`
uniform vec2 uCenter;
uniform float uHalf;
varying vec2 vWorld;
void main() {
  vec2 w = uCenter + position.xy * uHalf;
  vWorld = w;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(w, 0.0, 1.0);
}
`,vy=`
uniform vec2 uCenter;
uniform float uHalf;
uniform float uTile;
uniform float uMode;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uLine;
varying vec2 vWorld;

void main() {
  vec2 p = vWorld / uTile;
  vec2 w = fwidth(p) + 1e-4;
  vec3 col;
  if (uMode < 0.5) {
    // Box-filtered checker (period 2 in p): exact average once tiles are sub-pixel.
    vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
    float c = 0.5 - 0.5 * i.x * i.y;
    // Tiles under ~2 px (grazing views, zoomed far out): the exact average, with no noise.
    c = mix(c, 0.5, smoothstep(0.35, 0.8, max(w.x, w.y)));
    col = mix(uA, uB, c);
  } else {
    vec2 g = abs(fract(p - 0.5) - 0.5) / w;      // distance to a tile edge, in pixels
    float line = 1.0 - clamp(min(g.x, g.y) - 0.5, 0.0, 1.0);
    float keep = 1.0 - smoothstep(0.25, 0.5, max(w.x, w.y)); // drop lines once tiles are tiny
    col = mix(uA, uLine, line * keep);
  }
  float d = length(vWorld - uCenter) / uHalf;
  float alpha = 1.0 - smoothstep(0.55, 1.0, d);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;function vf(i="checker",t="light"){let e=new We({vertexShader:yy,fragmentShader:vy,uniforms:{uCenter:{value:[0,0]},uHalf:{value:100},uTile:{value:yf},uMode:{value:0},uA:{value:new Ut},uB:{value:new Ut},uLine:{value:new Ut}},transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1}),n=new Ni(2,2),s=new ze(n,e);s.frustumCulled=!1,s.renderOrder=-10;let r=e.uniforms,o={style:i,theme:t,z:0};function a(){s.visible=o.style!=="none";let l=Nn(o.theme);o.style==="grid"?(r.uMode.value=1,ul(r.uA.value,l.grid.base),ul(r.uLine.value,l.grid.line)):(r.uMode.value=0,ul(r.uA.value,l.checker[0]),ul(r.uB.value,l.checker[1]))}return a(),{mesh:s,get style(){return o.style},setStyle(l){o.style=l==="grid"||l==="none"?l:"checker",a()},setTheme(l){o.theme=l==="dark"?"dark":"light",a()},setPlane(l,c){o.z=l,s.position.z=l,r.uTile.value=c>0?c:yf},update(l,c,h,f){let u=h*Math.max(1,f);r.uCenter.value[0]=l,r.uCenter.value[1]=c,r.uHalf.value=Math.max(40,u*3)},dispose(){n.dispose(),e.dispose()}}}function hh(i,t,e,n,s,r,o,a){if(o<=1e-4){for(let c=0,h=7*a;c<h;c++)i[t+c]=e[n+c];return}if(o>=1-1e-4){for(let c=0,h=7*a;c<h;c++)i[t+c]=s[r+c];return}let l=1-o;for(let c=0;c<a;c++,t+=7,n+=7,r+=7){i[t]=e[n]*l+s[r]*o,i[t+1]=e[n+1]*l+s[r+1]*o,i[t+2]=e[n+2]*l+s[r+2]*o;let h=e[n+3],f=e[n+4],u=e[n+5],p=e[n+6],g=s[r+3],_=s[r+4],m=s[r+5],d=s[r+6];h*g+f*_+u*m+p*d<0&&(g=-g,_=-_,m=-m,d=-d);let M=h*l+g*o,E=f*l+_*o,v=u*l+m*o,b=p*l+d*o,S=Math.hypot(M,E,v,b);S>1e-12?(i[t+3]=M/S,i[t+4]=E/S,i[t+5]=v/S,i[t+6]=b/S):(i[t+3]=h,i[t+4]=f,i[t+5]=u,i[t+6]=p)}}function Mf(i,t,e,n){let s=i/t+1e-6,r=Math.floor(s);r<0&&(r=0);let o=e-1;return r>=o?(n.f0=n.f1=Math.max(o,0),n.t=0,n):(n.f0=r,n.f1=r+1,n.t=Math.min(Math.max(s-1e-6-r,0),1),n)}function Sf(i,t){let e=i[t+3],n=i[t+4],s=i[t+5],r=i[t+6];return Math.atan2(2*(r*s+e*n),1-2*(n*n+s*s))}var My=.013,Sy=.034,by=.07,wy=.022,Ey=1.7,Ty=3,dl=(i,t)=>Zn(t?Nn(i).contact:Nn(i).arrow);function bf(i,t,e,n,s={}){let r=Math.max(e,.3)/Ey,o=Ty*e,a=Math.max(i*t,1),l=new Oi({color:dl("light",s.points)}),c=new ai(1,1,1,10).rotateX(Math.PI/2).translate(0,0,.5),h=new vr(1,1,14).rotateX(Math.PI/2).translate(0,0,.5),f=new xn(c,l,a),u=new xn(h,l,a),p=new an,g=[f,u],_=null,m=null,d=null;s.points&&(_=new Fi(1,10,8),m=new xn(_,l,a),d=m.instanceMatrix.array,g.push(m));for(let C of g)C.instanceMatrix.array.fill(0),C.instanceMatrix.setUsage(xi),C.frustumCulled=!1,p.add(C);let M=f.instanceMatrix.array,E=u.instanceMatrix.array;function v(C,I,L,N,P,O,U,V,J,Z){let tt=0,it=0,W=1;Math.abs(P)>.9&&(tt=1,W=0);let st=it*P-W*N,ct=W*L-tt*P,lt=tt*N-it*L,bt=Math.hypot(st,ct,lt)||1;st/=bt,ct/=bt,lt/=bt;let X=N*lt-P*ct,K=P*st-L*lt,ot=L*ct-N*st;C[I]=st*O,C[I+1]=ct*O,C[I+2]=lt*O,C[I+3]=0,C[I+4]=X*O,C[I+5]=K*O,C[I+6]=ot*O,C[I+7]=0,C[I+8]=L*U,C[I+9]=N*U,C[I+10]=P*U,C[I+11]=0,C[I+12]=V,C[I+13]=J,C[I+14]=Z,C[I+15]=1}function b(C,I,L,N,P,O){for(let U=0,V=C*t;U<t;U++,L+=6,V++){let J=I[L+3],Z=I[L+4],tt=I[L+5],it=Math.hypot(J,Z,tt),W=V*16,st=Math.min(it*n,o);if(!(st>1e-6)){M.fill(0,W,W+16),E.fill(0,W,W+16),d&&d.fill(0,W,W+16);continue}let ct=J/it,lt=Z/it,bt=tt/it,X=I[L]+N,K=I[L+1]+P,ot=I[L+2]+O,wt=Math.min(by*r,.4*st),_t=st-wt;if(v(M,W,ct,lt,bt,My*r,_t,X,K,ot),v(E,W,ct,lt,bt,Sy*r,wt,X+ct*_t,K+lt*_t,ot+bt*_t),d){let zt=wy*r;d.fill(0,W,W+16),d[W]=d[W+5]=d[W+10]=zt,d[W+12]=X,d[W+13]=K,d[W+14]=ot,d[W+15]=1}}}function S(C){let I=C*t*16,L=I+t*16;M.fill(0,I,L),E.fill(0,I,L),d&&d.fill(0,I,L)}function A(){for(let C of g)C.instanceMatrix.needsUpdate=!0}function y(){c.dispose(),h.dispose(),_&&_.dispose(),l.dispose();for(let C of g)C.dispose()}function T(C){l.color.copy(dl(C,s.points))}return{root:p,update:b,clear:S,commit:A,dispose:y,setTheme:T}}function wf(i,t){let e=new Ss({color:dl("light",!1)}),n=Math.max(t-1,0),s=new Ie,r=new we(new Float32Array(Math.max(i*n*6,6)),3);r.setUsage(xi),s.setAttribute("position",r);let o=new gr(s,e);o.frustumCulled=!1;let a=new an;a.add(o);let l=r.array;function c(g,_,m,d,M,E){let v=g*n*6;for(let b=0;b<n;b++,v+=6,m+=3)l[v]=_[m]+d,l[v+1]=_[m+1]+M,l[v+2]=_[m+2]+E,l[v+3]=_[m+3]+d,l[v+4]=_[m+4]+M,l[v+5]=_[m+5]+E}function h(g){l.fill(0,g*n*6,(g+1)*n*6)}function f(){r.needsUpdate=!0}function u(){s.dispose(),e.dispose()}function p(g){e.color.copy(dl(g,!1))}return{root:a,update:c,clear:h,commit:f,dispose:u,setTheme:p}}function Ay(i,t,e,n,s,r,o,a,l,c){let h=o-i,f=a-t,u=l-e,p=h*n+f*s+u*r,g=h*h+f*f+u*u-p*p,_=c*c;if(g>_)return null;let m=Math.sqrt(_-g),d=p-m;return d>=0?d:p+m>=0?p+m:null}function Ef(i,t,e,n){let s=null,r=1/0,o=typeof n!="number";for(let a=0;a<e;a++){let l=Ay(i[0],i[1],i[2],i[3],i[4],i[5],t[3*a],t[3*a+1],t[3*a+2],o?n[a]:n);l!==null&&l<r&&(r=l,s=a)}return s}var qr=null,Tf=i=>[Math.max(1,Math.round(i.cssWidth*i.dpr)),Math.max(1,Math.round(i.cssHeight*i.dpr))],uh=class{constructor(){this.renderer=new kr({antialias:!0,alpha:!0}),this.renderer.setPixelRatio(1),this.renderer.setScissorTest(!0),this.canvas=this.renderer.domElement,this.width=0,this.height=0,this.players=new Set,this.lost=!1,this.onLost=t=>{t.preventDefault(),this.lost=!0},this.onRestored=()=>{this.lost=!1;for(let t of this.players)t.invalidate();Qn()},this.canvas.addEventListener("webglcontextlost",this.onLost),this.canvas.addEventListener("webglcontextrestored",this.onRestored)}attach(t){this.players.add(t)}detach(t){this.players.delete(t),this.players.size===0&&this.destroy()}draw(t){if(this.lost)return;let[e,n]=Tf(t),s=t.canvas;(s.width!==e||s.height!==n)&&(s.width=e,s.height=n),(e>this.width||n>this.height)&&(this.width=Math.max(this.width,e),this.height=Math.max(this.height,n),this.renderer.setSize(this.width,this.height,!1));let r=this.renderer;r.setViewport(0,0,e,n),r.setScissor(0,0,e,n),r.setClearColor(0,t.transparent?0:1),r.render(t.scene,t.camera);let o=s.getContext("2d");o.clearRect(0,0,e,n),o.drawImage(this.canvas,0,this.height-n,e,n,0,0,e,n),t.dirty=!1}get info(){return this.renderer.info}destroy(){this.canvas.removeEventListener("webglcontextlost",this.onLost),this.canvas.removeEventListener("webglcontextrestored",this.onRestored),this.renderer.dispose(),this.renderer.forceContextLoss(),qr===this&&(qr=null)}},dh=class{constructor(t){this.renderer=new kr({canvas:t,antialias:!0,alpha:!0}),this.renderer.setPixelRatio(1),this.canvas=t,this.player=null,this.lost=!1,this.onLost=e=>{e.preventDefault(),this.lost=!0},this.onRestored=()=>{this.lost=!1,this.player&&this.player.invalidate(),Qn()},t.addEventListener("webglcontextlost",this.onLost),t.addEventListener("webglcontextrestored",this.onRestored)}attach(t){this.player=t}detach(){this.player=null,this.canvas.removeEventListener("webglcontextlost",this.onLost),this.canvas.removeEventListener("webglcontextrestored",this.onRestored),this.renderer.dispose()}draw(t){if(this.lost)return;let[e,n]=Tf(t),s=this.renderer.getSize(Cy),r=this.renderer.getPixelRatio();(s.x!==e||s.y!==n||r!==1)&&this.renderer.setSize(e,n,!1),this.renderer.setClearColor(0,t.transparent?0:1),this.renderer.render(t.scene,t.camera),t.dirty=!1}get info(){return this.renderer.info}},Cy=new Ht;function Af(){return qr||(qr=new uh),qr}function Cf(i){return new dh(i)}function fh(i){return i>64}function Rf(i,t,e=5e6){if(!fh(i))return i;let n=Math.floor(e/Math.max(t,1));return Math.min(Math.max(n,1),64,i)}function Pf({nEnvs:i,selected:t,pinned:e=[],origins:n,capacity:s}){let r=Math.max(1,Math.min(s,i)),o=[],a=new Set,l=_=>{o.length<r&&_>=0&&_<i&&Number.isInteger(_)&&!a.has(_)&&(a.add(_),o.push(_))};l(t);let c=e.filter(_=>Number.isInteger(_)&&_>=0&&_<i&&_!==t);for(let _ of[...new Set(c)].slice(0,4))l(_);if(o.length>=r)return o;let h=n?n[3*t]:0,f=n?n[3*t+1]:0,u=n?n[3*t+2]:0,p=new Float64Array(i),g=new Int32Array(i);for(let _=0;_<i;_++)g[_]=_,p[_]=n?(n[3*_]-h)**2+(n[3*_+1]-f)**2+(n[3*_+2]-u)**2:Math.abs(_-t);g.sort((_,m)=>p[_]-p[m]||_-m);for(let _=0;_<i&&o.length<r;_++)l(g[_]);return o}var ye=class extends Error{constructor(t,e){super(t),this.name="SourceError",this.status=e}},fl=64,Ry=32;function Py(i){let{itemShape:t,itemK:e,nEnvs:n,nFrames:s,blockFrames:r,blocks:o}=i;return{itemShape:t,itemK:e,nEnvs:n,nFrames:s,blockFrames:r,blocks:o}}function Iy(i){if(i.length<fl||String.fromCharCode(i[0],i[1],i[2],i[3])!=="SSBK")throw new ye("simscope: /api/blk did not return a block file header",500);let t=new DataView(i.buffer,i.byteOffset,i.byteLength),e=t.getUint16(4,!0);if(e!==1)throw new ye(`simscope: unsupported block file major version ${e}`,500);let n=t.getUint32(12,!0),s=[],r=1;for(let g=0;g<Math.min(n,4);g++)s.push(t.getUint32(16+4*g,!0)),r*=s[g];let o=t.getUint32(32,!0),a=t.getUint32(36,!0),l=t.getUint32(40,!0),c=t.getUint32(44,!0),h=Number(t.getBigUint64(48,!0)),f=t.getUint32(56,!0),u=fl;h>=fl&&h+f<=i.length&&f===32*c?u=h:c=Math.floor((i.length-fl)/32);let p=new Array(c);for(let g=0;g<c;g++){let _=u+32*g;p[g]={offset:Number(t.getBigUint64(_,!0)),env:t.getUint32(_+8,!0),t0:t.getUint32(_+12,!0),n:t.getUint32(_+16,!0),clen:t.getUint32(_+20,!0),ulen:t.getUint32(_+24,!0),codec:i[_+28]}}if(a===0)for(let g of p)a=Math.max(a,g.t0+g.n);return{itemShape:s,itemK:r,nEnvs:o,nFrames:a,blockFrames:l,blocks:p}}function Ly(i){let t=[];for(let e of i.blocks){let n=Math.floor(e.t0/i.blockFrames);(t[n]||(t[n]=new Array(i.nEnvs)))[e.env]=e}return t}var Wi=class i{constructor(t){let e=t instanceof Uint8Array?t:new Uint8Array(t);this.pack=Qr(e),this._index=new Map}static async open(t){let e=t instanceof Uint8Array?t:new Uint8Array(t);return new i(await to(e))}has(t){return this.pack.entries.has(t)}async get(t){let e=this.pack.entries.get(t);if(!e)throw new ye(`simscope: entry missing from pack: ${t}`,404);return e}_blk(t){let e=this._index.get(t);if(!e){let n=this.pack.entries.get(t);if(!n)throw new ye(`simscope: stream missing from pack: ${t}`,404);let s=Tl(n);e={blk:s,windows:Al(s)},this._index.set(t,e)}return e}async blockIndex(t){return Py(this._blk(t).blk)}async blocks(t,e,n){let{blk:s,windows:r}=this._blk(t),o=r[e];return n.map(a=>{let l=o&&o[a];if(!l)throw new ye(`simscope: ${t} has no block for window ${e}, env ${a}`,404);return s.bytes.slice(l.offset,l.offset+Ry+l.clen)})}async runs(){let t=new Set;for(let e of this.pack.entries.keys()){let n=/^runs\/([^/]+)\/rollout\.json$/.exec(e);n&&t.add(n[1])}return[...t]}},If=256,Uy=6e4,Oy=i=>new Promise(t=>setTimeout(t,i)),Dy=i=>i.startsWith("scenes/")||i.startsWith("assets/"),pl=class{constructor(t=""){this.base=t.replace(/\/+$/,""),this._files=new Map,this._index=new Map}async _fetch(t,e){let n=Date.now(),s=250;for(;;){let r;try{r=await fetch(t)}catch(o){throw new ye(`simscope: could not fetch ${e} (${o.message})`,0)}if(r.status===202){if(Date.now()-n>Uy)throw new ye(`simscope: ${e} is still being computed`,202);let o=Number(r.headers.get("Retry-After"));await Oy(Math.max(s,Number.isFinite(o)?o*1e3:0)),s=Math.min(s*1.5,2e3);continue}if(r.status===404)throw new ye(`simscope: ${e} not found`,404);if(!r.ok)throw new ye(`simscope: fetching ${e} failed with HTTP ${r.status}`,r.status);return r}}get(t){let e=async()=>new Uint8Array(await(await this._fetch(`${this.base}/files/${t}`,t)).arrayBuffer());if(!Dy(t))return e();let n=this._files.get(t);return n||(n=e(),this._files.set(t,n),n.catch(()=>this._files.delete(t))),n}async blockIndex(t,e={}){let n=e.refresh?null:this._index.get(t);return n||(n=(async()=>{let s=await this._fetch(`${this.base}/api/blk?path=${encodeURIComponent(t)}`,t),r=Iy(new Uint8Array(await s.arrayBuffer()));return{index:r,windows:Ly(r)}})(),this._index.set(t,n),n.catch(()=>this._index.delete(t))),(await n).index}async blocks(t,e,n){let s=new Array(n.length),r=[];for(let o=0;o<n.length;o+=If){let a=n.slice(o,o+If);r.push((async()=>{let l=`${this.base}/api/blocks?path=${encodeURIComponent(t)}&w=${e}&envs=${a.join(",")}`,c=await this._fetch(l,`${t} window ${e}`),h=(c.headers.get("X-Simscope-Block-Lengths")||"").split(",").map(Number);if(h.length!==a.length)throw new ye(`simscope: /api/blocks returned ${h.length} block lengths for ${a.length} envs`,500);let f=new Uint8Array(await c.arrayBuffer()),u=0;h.forEach((p,g)=>{s[o+g]=f.slice(u,u+p),u+=p})})())}return await Promise.all(r),s}async runs(){return((await(await this._fetch(`${this.base}/api/runs`,"the run list")).json()).runs||[]).map(n=>n.name)}};var ph="body_pose",mh="contacts";function ml(i){throw new Error(`simscope: ${i}`)}async function Lf(i,t){if(t)return t;let e=await i.runs();return e.length||ml("pack contains no runs"),e[0]}async function gh(i,t){let e;try{e=await i.get(`runs/${t}/rollout.json`)}catch(r){if(!(r instanceof ye)||r.status!==404)throw r;let o=await i.runs().catch(()=>[]),a=o.length>0&&o.length<=20?` (have: ${o.join(", ")})`:"";return ml(`run "${t}" not found${a}`)}let n=Ai(e,"rollout.json");return $s(n,"simscope-rollout","rollout.json"),(!(n.n_envs>=1)||!(n.n_frames>=0)||!(n.dt>0))&&ml("manifest needs n_envs >= 1, n_frames >= 0, dt > 0"),n}async function Uf(i,t,e){let n=new Map,s=Object.entries(e.streams||{}),r=await Promise.all(s.map(async([o,a])=>{let l=`runs/${t}/${a.file}`;try{return await i.blockIndex(l)}catch(c){if(c instanceof ye&&c.status===404&&o!==ph)return null;throw c}}));return s.forEach(([o,a],l)=>{let c=r[l];if(!c)return;c.nEnvs!==e.n_envs&&ml(`stream ${a.file}: ${c.nEnvs} envs, manifest says ${e.n_envs}`);let h=el(l+1,`runs/${t}/${a.file}`,c,a.kind==="pose");Object.assign(h,{name:o,kind:a.kind,shape:c.itemShape,info:a}),n.set(o,h)}),n}async function Of(i,t){let e;try{e=await i.get(`runs/${t}/annotations.json`)}catch(s){if(s instanceof ye&&s.status===404)return[];throw s}let n=Ai(e,"annotations.json");return(Array.isArray(n.events)?n.events:[]).filter(s=>Number.isFinite(s.t0)).map(s=>({t0:s.t0,t1:Number.isFinite(s.t1)?s.t1:s.t0,label:String(s.label??"")}))}async function Df(i,t){try{return Ai(await i.get(t),t)}catch(e){if(e instanceof ye&&(e.status===404||e.status===202))return null;throw e}}function _h(i,t){let e=i.n_frames;for(let n of t)e=Math.min(e,n.nFrames);return e}function Gs(i){throw new Error(`simscope: ${i}`)}function gl(i,t,e){let n=`${t.id}:${e}:${t.nFrames}`,s=i.seriesCache.get(n);return s||(s=(async()=>{let r=t.itemK,o=t.blockFrames,a=new Float32Array(t.nFrames*r);for(let l=0;l<t.nWindows;l++){await i.store.request(t,l,[e]);let c=i.store.get(t,l,e);c&&a.set(c.subarray(0,Math.min(c.length,a.length-l*o*r)),l*o*r)}return a})(),i.seriesCache.set(n,s),s.catch(()=>i.seriesCache.delete(n))),s}async function Ff(i,t,e,n=0){let s=i.streams.get(t);s||Gs(`series(): run has no stream "${t}"`),e>=0&&e<i.nEnvs||Gs(`series(): env ${e} out of range`),n>=0&&n<s.itemK||Gs(`series(): component ${n} out of range (stream has ${s.itemK})`);let r=await gl(i,s,e),o=s.itemK,a=s.nFrames,l=new Float32Array(a);for(let c=0,h=n;c<a;c++,h+=o)l[c]=r[h];return l}async function Bf(i,t,e,n){t!=="height"&&t!=="speed"&&Gs(`bodySeries(): unknown kind "${t}"`),n>=0&&n<i.B||Gs(`bodySeries(): body ${n} out of range`),e>=0&&e<i.nEnvs||Gs(`bodySeries(): env ${e} out of range`);let s=await gl(i,i.pose,e),r=i.K,o=i.pose.nFrames,a=i.dt,l=n*7,c=new Float32Array(o);if(t==="height"){let h=i.origins[3*e+2];for(let f=0;f<o;f++)c[f]=s[f*r+l+2]+h;return c}for(let h=0;h<o;h++){let f=Math.max(h-1,0),u=Math.min(h+1,o-1),p=(u-f)*a;c[h]=p>0?Math.hypot(s[u*r+l]-s[f*r+l],s[u*r+l+1]-s[f*r+l+1],s[u*r+l+2]-s[f*r+l+2])/p:0}return c}function _l(i,t){let e=i.derived.get(t);return e||(e=Df(i.source,`derived/${i.run}/${t}`),i.derived.set(t,e),e.catch(()=>i.derived.delete(t))),e}function Ny(i){if(!i||!Array.isArray(i.highlights))return i;let t=new Map;for(let r of i.signals||[])t.set(r.key,r.label);for(let r of i.kinds||[])t.set(r.key,r.label);let e=i.highlights.map(r=>{let o=r.kind??r.signal;return{t1:null,frame1:null,ratio:null,body:null,also:[],detail:"",...r,kind:o,label:r.label??t.get(o)??o,signal:o}}),n=i.kinds||(i.signals||[]).map(r=>({key:r.key,label:r.label})),s=i.signals||n.map(r=>({key:r.key,label:r.label,unit:""}));return{...i,kinds:n,signals:s,highlights:e}}function kf(i){let t="highlights.json#2",e=i.derived.get(t);return e||(e=_l(i,"highlights.json").then(Ny),i.derived.set(t,e),e.catch(()=>i.derived.delete(t))),e}async function zf(i,t,e=0){let n=await _l(i,`envelopes/${t}.json`);return!n||!Array.isArray(n.p50)||!n.p50[e]?null:{dt:n.dt,t0:n.t0??0,components:n.components??n.p50.length,component:e,p5:Float32Array.from(n.p5[e]),p50:Float32Array.from(n.p50[e]),p95:Float32Array.from(n.p95[e])}}var Xi=class{constructor(t){this.w=-1,this.epoch=-1,this.ver=-1,this.arrs=new Array(t).fill(null),this.complete=!1}refresh(t,e,n,s,r){if(this.w===n&&this.epoch===t.epoch&&this.ver===r)return;(this.w!==n||this.ver!==r)&&this.arrs.fill(null);let o=!0;for(let a=0;a<s.length;a++){let l=t.get(e,n,s[a])||null;this.arrs[s[a]]=l,l||(o=!1)}this.w=n,this.epoch=t.epoch,this.ver=r,this.complete=o}};function By(i,t){let e=i.size,n=i.scale||[1,1,1],s=(r,o,a)=>[r*n[0],o*n[1],a*n[2]];switch(i.kind){case"box":return{key:"box",make:()=>new Rn(1,1,1),scale:s(2*e[0],2*e[1],2*e[2])};case"sphere":return{key:"sphere",make:Vf,scale:s(e[0],e[0],e[0])};case"ellipsoid":return{key:"sphere",make:Vf,scale:s(e[0],e[1],e[2])};case"cylinder":return{key:"cylinder",make:ky,scale:s(e[0],e[0],e[1])};case"capsule":return{key:`capsule:${e[0]}:${e[1]}`,make:()=>new yr(e[0],2*e[1],8,16).rotateX(Math.PI/2),scale:n.slice()};case"mesh":return i.mesh===null||i.mesh===void 0||!t[i.mesh]?null:{key:`mesh:${i.mesh}`,mesh:i.mesh,scale:n.slice()};default:return null}}function Vf(){return new Fi(1,24,16)}function ky(){return new ai(1,1,2,24).rotateX(Math.PI/2)}var zy=i=>(i.index?i.index.count:i.getAttribute("position").count)/3;function Vy(i,t,e){let n=[0,0,0],s;switch(i.kind){case"box":s=[t[0]/2,t[1]/2,t[2]/2];break;case"capsule":{let b=i.size,S=i.scale||[1,1,1];s=[b[0]*S[0],b[0]*S[1],(b[1]+b[0])*S[2]];break}case"mesh":{e.computeBoundingBox();let{min:b,max:S}=e.boundingBox;n=[(b.x+S.x)/2*t[0],(b.y+S.y)/2*t[1],(b.z+S.z)/2*t[2]],s=[(S.x-b.x)/2*Math.abs(t[0]),(S.y-b.y)/2*Math.abs(t[1]),(S.z-b.z)/2*Math.abs(t[2])];break}default:s=[Math.abs(t[0]),Math.abs(t[1]),Math.abs(t[2])]}let[r,o,a,l]=i.quat||[0,0,0,1],c=r*r,h=o*o,f=a*a,u=r*o,p=r*a,g=o*a,_=l*r,m=l*o,d=l*a,M=[1-2*(h+f),2*(u+d),2*(p-m),2*(u-d),1-2*(c+f),2*(g+_),2*(p+m),2*(g-_),1-2*(c+h)],E=i.pos||[0,0,0],v=[0,1,2].map(b=>E[b]+M[b]*n[0]+M[3+b]*n[1]+M[6+b]*n[2]);return{body:i.body,c:v,axes:M,h:s}}function Hy(i,t,e,n,s,r){let o=e[n],a=e[n+1],l=e[n+2],c=e[n+3],h=e[n+4],f=e[n+5],u=e[n+6],p=e[n+7],g=e[n+8];for(let M=0;M<3;M++){let E=s[r+3*M],v=s[r+3*M+1],b=s[r+3*M+2];i[t+4*M]=o*E+c*v+u*b,i[t+4*M+1]=a*E+h*v+p*b,i[t+4*M+2]=l*E+f*v+g*b,i[t+4*M+3]=0}let _=s[r+9],m=s[r+10],d=s[r+11];i[t+12]=o*_+c*m+u*d+e[n+9],i[t+13]=a*_+h*m+p*d+e[n+10],i[t+14]=l*_+f*m+g*d+e[n+11],i[t+15]=1}function Gy(i,t,e,n,s){let[r,o,a,l]=n,c=r*r,h=o*o,f=a*a,u=r*o,p=r*a,g=o*a,_=l*r,m=l*o,d=l*a,M=[1-2*(h+f),2*(u+d),2*(p-m),2*(u-d),1-2*(c+f),2*(g+_),2*(p+m),2*(g-_),1-2*(c+h)];for(let E=0;E<3;E++)for(let v=0;v<3;v++)i[t+3*E+v]=M[3*E+v]*s[E];i[t+9]=e[0],i[t+10]=e[1],i[t+11]=e[2]}function Wy(i,t,e,n,s,r,o){let a=e[n+3],l=e[n+4],c=e[n+5],h=e[n+6],f=a*a,u=l*l,p=c*c,g=a*l,_=a*c,m=l*c,d=h*a,M=h*l,E=h*c;i[t]=1-2*(u+p),i[t+1]=2*(g+E),i[t+2]=2*(_-M),i[t+3]=2*(g-E),i[t+4]=1-2*(f+p),i[t+5]=2*(m+d),i[t+6]=2*(_+M),i[t+7]=2*(m-d),i[t+8]=1-2*(f+u),i[t+9]=e[n]+s,i[t+10]=e[n+1]+r,i[t+11]=e[n+2]+o}async function Hf(i,t,e){let n=i.bodies||[],s=i.geoms||[],r=i.materials||[],o=i.meshes||[],a=n.length,l=e,c=new Map,h=[],f=new Uint8Array(a),u=new Set,p=new Set;for(let W=0;W<s.length;W++){let st=s[W];if(!(st.body>=0&&st.body<a))throw new Error(`simscope: geom ${W} references missing body ${st.body}`);let ct=st.role==="collision";if(st.kind==="plane"){ct||h.push({z:(st.pos||[0,0,0])[2],tile:st.size[2],body:st.body});continue}let lt=By(st,o);if(!lt){console.warn(`simscope: skipping geom ${W} (unsupported kind "${st.kind}" or missing mesh)`);continue}let bt=ct?-1:st.material,X=`${ct?"c":"v"}|${lt.key}|${bt}`,K=c.get(X);if(K||c.set(X,K={collision:ct,shape:lt,matIdx:bt,geoms:[],scales:[]}),K.geoms.push(st),K.scales.push(lt.scale),lt.mesh!==void 0&&u.add(lt.mesh),!ct){f[st.body]=1;let ot=r[st.material];ot&&ot.texture!==null&&ot.texture!==void 0&&p.add(ot.texture)}}let g=new Map,_=new Map;await Promise.all([...[...u].map(async W=>g.set(W,await t.mesh(W))),...[...p].map(async W=>_.set(W,await t.texture(W)))]);let m=new an,d=[],M=new Map,E=new Map,v=[],b=W=>{let st=M.get(W.key);return st||(W.mesh!==void 0?st=g.get(W.mesh):(st=W.make(),d.push(st)),M.set(W.key,st)),st},S=W=>{let st=E.get(W.matIdx);if(st)return st;let ct;if(W.collision)ct=new li({color:Zn(Nn("light").fg),opacity:.35,transparent:!0,roughness:.8}),v.push(ct);else{let lt=r[W.matIdx]||{rgba:[.7,.7,.7,1]},bt=lt.rgba||[.7,.7,.7,1],X=Math.min(Math.max(bt[3],.05),1),K={color:new Ut().setRGB(bt[0],bt[1],bt[2],me),opacity:X,transparent:X<1,metalness:lt.metallic??0,roughness:lt.roughness??.7},ot=lt.texture!==null&&lt.texture!==void 0?_.get(lt.texture):null;if(ot){let wt=new ke(ot);wt.colorSpace=me,wt.wrapS=wt.wrapT=fs;let _t=lt.texrepeat||[1,1];wt.repeat.set(_t[0],_t[1]),wt.needsUpdate=!0,d.push(wt),K.map=wt}ct=new li(K)}return E.set(W.matIdx,ct),d.push(ct),ct},A=new Float32Array(a),y=(W,st)=>{let ct=Math.max(...W.scale||[1,1,1]),lt=W.size;switch(W.kind){case"box":return Math.hypot(lt[0],lt[1],lt[2])*ct;case"sphere":return lt[0]*ct;case"ellipsoid":return Math.max(lt[0],lt[1],lt[2])*ct;case"capsule":return(lt[0]+lt[1])*ct;case"cylinder":return Math.hypot(lt[0],lt[1])*ct;case"mesh":{let bt=g.get(st.mesh);bt.computeBoundingSphere();let X=bt.boundingSphere.center;return(Math.hypot(X.x,X.y,X.z)+bt.boundingSphere.radius)*ct}default:return 0}};for(let W of c.values())if(!W.collision)for(let st of W.geoms){let ct=st.pos||[0,0,0];A[st.body]=Math.max(A[st.body],Math.hypot(ct[0],ct[1],ct[2])+y(st,W.shape))}let T=[];for(let W of c.values()){if(W.collision)continue;let st=W.shape.mesh!==void 0?g.get(W.shape.mesh):null;W.geoms.forEach((ct,lt)=>T.push(Vy(ct,W.scales[lt],st)))}let C=[],I=0;for(let W of c.values()){let st=W.geoms,ct=st.length,lt=b(W.shape);W.collision||(I+=ct*zy(lt));let bt=new xn(lt,S(W),l*ct);bt.instanceMatrix.array.fill(0),bt.instanceMatrix.setUsage(xi),bt.frustumCulled=!1,bt.visible=!W.collision;let X=new Int32Array(ct),K=new Float32Array(12*ct);st.forEach((ot,wt)=>{X[wt]=ot.body,Gy(K,12*wt,ot.pos||[0,0,0],ot.quat||[0,0,0,1],W.scales[wt])}),m.add(bt),C.push({mesh:bt,n:ct,body:X,local:K,collision:W.collision})}let L=new Float32Array(Math.max(l,1)*a*12),N=new Float32Array(l*a*7),P=new Float32Array(l*3),O=new Uint8Array(l),U=new Uint8Array(l);function V(){for(let W=0,st=0,ct=0;W<l;W++,st+=12*a,ct+=7*a){if(!O[W])continue;let lt=P[3*W],bt=P[3*W+1],X=P[3*W+2];for(let K=0,ot=ct,wt=st;K<a;K++,ot+=7,wt+=12)Wy(L,wt,N,ot,lt,bt,X)}for(let W of C){let st=W.mesh.instanceMatrix.array;for(let ct=0;ct<l;ct++){let lt=ct*W.n*16;if(!O[ct]){U[ct]&&st.fill(0,lt,lt+W.n*16);continue}let bt=ct*a*12;for(let X=0,K=lt;X<W.n;X++,K+=16)Hy(st,K,L,bt+12*W.body[X],W.local,12*X)}W.mesh.instanceMatrix.needsUpdate=!0}U.set(O)}function J(W){for(let st of C)st.mesh.count=Math.min(Math.max(W,0),l)*st.n}function Z(W,st){for(let ct of C)ct.mesh.visible=ct.collision?st:W}function tt(W){for(let st of v)st.color.copy(Zn(Nn(W).fg))}function it(){for(let W of d)W.dispose();for(let W of C)W.mesh.dispose();for(let W of u)t.release(W);d.length=0,u.clear()}return{root:m,poses:N,origins:P,slotOn:O,apply:V,limitSlots:J,setRoles:Z,setTheme:tt,dispose:it,drawnBodies:f,bodyRadius:A,geomBoxes:T,nSlots:l,nBodies:a,bodyNames:n.map(W=>W.name),hasCollision:C.some(W=>W.collision),trianglesPerEnv:I,planes:h}}var xh=["off","position","pose","heading"],$y=4e3,Ky=64*1024*1024;var yh=new k,Jy={f0:0,f1:0,t:0},vh=[0,0];function je(i){throw new Error(`simscope: ${i}`)}var Ws=class extends EventTarget{constructor(t,e={}){super(),this.canvas=t,this.clock=e.clock||new Ci,this.theme=e.theme==="dark"?"dark":"light",this.bgExplicit=e.background!==void 0&&e.background!==null,this.cssWidth=300,this.cssHeight=150,this.dpr=1,this.visible=typeof IntersectionObserver!="function",this.dirty=!0,this.transparent=!1,this.opts={budget:e.triangleBudget||5e6,arrowScale:e.arrowScale??1},this.showVisual=!0,this.showCollision=!1,this.contactsOn=!1,this.color=typeof e.color=="string"&&e.color?e.color:null,this.linked=null,this.pan={a:0,b:0},this.rest=new k,this.holdZ=null,this._fitPending=!1,this.r=null,this._token=0,this.followPref=e.follow,this.camMoving=!1,this.poseDirty=!0,this.viewName=ks.includes(e.view)?e.view:"iso",this.groundForced=!1,this.scene=new dr,this.scene.add(new br(16777215,4473924,.5*Math.PI));let n=new Er(16777215,.8*Math.PI);n.position.set(3,3,6),this.scene.add(n),this.ground=vf(e.ground||"checker",this.theme),this.scene.add(this.ground.mesh),this._groundStyle=e.ground||"checker",this._applyGroundVisibility(),this._setBackground(this.bgExplicit?e.background:void 0),this.rig=new ll(t),this.camera=this.rig.camera,this.rig.setView(this.viewName,!1);for(let s of["controlstart","control","controlend"])this.rig.controls.addEventListener(s,()=>this.invalidate());this.rig.controls.addEventListener("control",()=>this._onControl()),this.fstate={mode:"off",env:0,body:-1,follower:mf(),azOff:0,settled:!0,z0:new Map,z0Default:null,hold:zs(),holdInit:!1},this.followPt={valid:!1,x:0,y:0,z:0,yaw:0},this.renderer=e.renderer||(e.direct?Cf(t):Af()),this.renderer.attach(this),this._onClock=()=>this.invalidate(),this._onClockState=()=>{this.clock.playing||(this.linked?this.linked.flush():this._fitPending&&this._autoFit()),this.invalidate()},this.clock.addEventListener("time",this._onClock),this.clock.addEventListener("state",this._onClockState),this._onEnded=()=>this.emit("ended",{}),this.clock.addEventListener("ended",this._onEnded),typeof IntersectionObserver=="function"&&(this._seen=new IntersectionObserver(s=>{this.visible=s[s.length-1].isIntersecting,this.visible&&this.invalidate()},{rootMargin:"64px"}),this._seen.observe(t)),Wh(this)}async load(t,e,n={}){this.unload(),this._frozen=!1;let s=++this._token;try{return await this._load(t,e,n,s)}catch(r){throw this._token===s&&this.unload(),r}}async _load(t,e,n,s){let r=()=>this._token!==s,o=await Lf(t,e),a=await gh(t,o),l=a.n_envs,c=fh(l),h=await Uf(t,o,a),f=h.get(ph);(!f||f.kind!=="pose")&&je("manifest has no body_pose stream of kind pose"),r()&&je("load superseded");let u=a.status==="recording",p=[...h.values()].filter(U=>U.kind==="pose"||U.kind==="arrows"||U.kind==="polyline"),g=u?_h(a,p):a.n_frames;g>=1||je(u?"the run has no complete window yet":"manifest needs n_frames >= 1"),!u&&f.nFrames<g&&je(`stream ${f.name}: ${f.nFrames} frames, manifest says ${g}`);let _=a.env_scenes||Array.from({length:l},()=>a.scene);_.length!==l&&je("env_scenes length does not match n_envs");let m=new Map;_.forEach((U,V)=>{(!U||!U.sha256)&&je("manifest has no scene reference"),m.has(U.sha256)||m.set(U.sha256,[]),m.get(U.sha256).push(V)});let d=c?[[[...m.keys()][0],null]]:[...m.entries()];c&&m.size>1&&console.warn("simscope: per-env scenes are not supported above 64 envs; drawing every env with the first scene");let M=[];try{for(let[U,V]of d){let J=Ai(await t.get(Ys("scenes",U,".json")),"scene");$s(J,"simscope-scene","scene");let Z=await Hf(J,this._loaders(t,J),c?64:V.length);Z.envs=V,M.push(Z)}}catch(U){for(let V of M)V.dispose();throw U}if(r()){for(let U of M)U.dispose();je("load superseded")}let E=M[0].nBodies,v=M.some(U=>U.nBodies!==E)?"scenes of one run must have the same number of bodies":f.itemK!==E*7?`body_pose has ${f.itemK/7} bodies but the scene has ${E}`:null;if(v){for(let U of M)U.dispose();je(v)}let b=new tl(t);b.onChange=U=>{this.emit("progress",{pending:U}),this.invalidate()};let S=new Float32Array(3*l);(a.env_origins||[]).slice(0,l).forEach((U,V)=>S.set(U.slice(0,3),3*V));let A={source:t,run:o,manifest:a,live:u,dt:a.dt,nFrames:g,nEnvs:l,B:E,K:E*7,tiered:c,origins:S,parts:M,streams:h,pose:f,store:b,views:{a:new Xi(l),b:new Xi(l)},overlays:[],root:null,crowd:null,crowdState:c?"pending":"none",proxySize:[.5,.5,.5],rootPos:new Float32Array(3*l),rootBuf:null,hidden:null,allEnvs:null,focus:[],selected:0,pinned:[],capacity:l,envSlot:new Int32Array(l).fill(-1),gEnv:null,gBase:[],focusVer:0,derived:new Map,seriesCache:new Map,prefetch:{id:0,w0:-1,ahead:-1,ver:-1,contacts:-1,root:-1},events:[],extents:new Map,extentJobs:new Map,followBody:this._pickFollowBody(M[0]),hasContacts:h.has(mh)};this.r=A;let y=0;for(let U of M)A.gBase.push(y),y+=U.nSlots;A.gEnv=new Int32Array(y).fill(-1),A.capacity=c?Rf(l,M[0].trianglesPerEnv,this.opts.budget):l;let T=(n.envs||[]).filter(U=>Number.isInteger(U)&&U>=0&&U<l);A.selected=T.length?T[0]:0,A.pinned=T.slice(1,5),A.allEnvs=Int32Array.from({length:l},(U,V)=>V),this._assignFocus(),c&&M[0].limitSlots(A.capacity);for(let U of M)this.scene.add(U.root),U.setRoles(this.showVisual,this.showCollision),U.setTheme(this.theme);for(let U of h.values()){if(U.kind!=="arrows"&&U.kind!=="polyline")continue;let V=U.kind==="arrows"?6:3;U.itemK%V!==0&&je(`stream ${U.name}: bad item shape for kind ${U.kind}`);let J=typeof U.info.scale=="number"?U.info.scale:1;A.overlays.push({name:U.name,kind:U.kind,stream:U,k:U.itemK/V,scale:J,contacts:U.name===mh,layer:null,views:{a:new Xi(l),b:new Xi(l)}})}this._claimClock(),await Promise.all([b.request(f,0,A.focus),...A.overlays.filter(U=>!U.contacts).map(U=>b.request(U.stream,0,A.focus))]),r()&&je("load superseded"),A.events=await Of(t,o),r()&&je("load superseded"),this._refreshViews(0,0),A.views.a.arrs[A.selected]||je("the first window of body_pose is missing"),this._poseAt(0,0,0);let C=this._bounds(!1),I=this._bounds(!0);A.proxySize=this._proxySize(),this._applyGroundVisibility();for(let U of A.overlays){let V=Math.max(2*C.radius,.3);U.layer=U.kind==="arrows"?bf(y,U.k,V,this.opts.arrowScale*U.scale,{points:U.contacts}):wf(y,U.k),U.layer.setTheme(this.theme),U.layer.root.visible=U.contacts?this.contactsOn:!0,this.scene.add(U.layer.root)}let L=c?C:I;this.rig.setFrame(Math.max(2*Math.max(L.radius,.3)*1.15/Math.min(1,this.rig.aspect),1.5),this.rig.aspect),this.rig.setZoomNow(1),this.rig.setTarget(L.cx,L.cy,L.cz,!1),this.rest.set(L.cx,L.cy,L.cz),this.pan.a=this.pan.b=0,this.holdZ=null,this._fitPending=!1,this.rig.setView(this.viewName,!1),this.rig.fitBox(L.ex/2,L.ey/2,L.ez/2,!1),this._setDepth(c?I:L),this.rig.userZoomed=!1;let N=this.fstate;N.env=A.selected,N.body=A.followBody,N.z0.set(A.selected,this.followPt.z),N.z0Default=this.followPt.z;let P=this.followPref??(l===1?"position":"off");N.mode=xh.includes(P)?P:"off",N.holdInit=!1,N.follower.primed=!1,this._primeFollow(),this.poseDirty=!0,this._applyGroundVisibility(),this.invalidate();let O=this.info();return this.emit("loaded",O),c&&this._buildCrowd(s),this._scheduleWhole(s),this._requestExtent(A.selected),O}_loaders(t,e){let n=e.meshes||[],s=e.textures||[],r=new Map,o=(a,l)=>(r.has(a)||r.set(a,l()),r.get(a));return{mesh:a=>_f(n[a].sha256,async()=>Wd(await t.get(Ys("assets",n[a].sha256)))),release:a=>xf(n[a].sha256),texture:a=>o(`t${a}`,async()=>{let l=s[a];if(!l||typeof createImageBitmap!="function")return null;let c=await t.get(Ys("assets",l.sha256));return createImageBitmap(new Blob([c],{type:l.media_type||"image/png"}),{imageOrientation:"flipY"})})}}_pickFollowBody(t){return pf(t.bodyNames||[])}_claimClock(){let t=this.r;this.clock.claim(this,Math.max(t.nFrames-1,0)*t.dt,t.dt,t.live)}info(){let t=this.r;return t?{run:t.run,dt:t.dt,frames:t.nFrames,duration:Math.max(t.nFrames-1,0)*t.dt,envs:t.nEnvs,bodies:t.parts[0].bodyNames,followBody:t.followBody,streams:[...t.streams.values()].map(e=>({name:e.name,kind:e.kind,shape:e.shape})),hasCollision:t.parts.some(e=>e.hasCollision),hasContacts:t.hasContacts,live:t.live,tiered:t.tiered,events:t.events,hasGround:t.parts.some(e=>e.planes.length>0),color:this.color}:null}unload(t={}){this._token=(this._token||0)+1,this._frozen=!!t.keepFrame&&!!this.r;let e=this.r;if(e){for(let n of e.parts)this.scene.remove(n.root),n.dispose();for(let n of e.overlays)n.layer&&(this.scene.remove(n.layer.root),n.layer.dispose());e.crowd&&(this.scene.remove(e.crowd.mesh),e.crowd.dispose()),e.store.onChange=null,e.store.clear()}this.r=null,this.clock.release(this),this.followPt.valid=!1,this.fstate.mode="off",this.fstate.follower.primed=!1,this.fstate.holdInit=!1,this.fstate.z0.clear(),this.holdZ=null,this._fitPending=!1,this.pan.a=this.pan.b=0,this.poseDirty=!0,this.invalidate()}destroy(){this.unload(),this.linked=null,this.clock.removeEventListener("time",this._onClock),this.clock.removeEventListener("state",this._onClockState),this.clock.removeEventListener("ended",this._onEnded),this._seen&&this._seen.disconnect(),Xh(this),this.rig.dispose(),this.ground.dispose(),this.renderer.detach(this)}_assignFocus(){let t=this.r,e=t.tiered?Pf({nEnvs:t.nEnvs,selected:t.selected,pinned:t.pinned,origins:t.origins,capacity:t.capacity}):t.allEnvs?Array.from(t.allEnvs):Array.from({length:t.nEnvs},(s,r)=>r);t.focus=e;let n=new Set(e);if(t.tiered){let s=t.gEnv;for(let o=0;o<s.length;o++)s[o]>=0&&!n.has(s[o])&&(t.envSlot[s[o]]=-1,s[o]=-1);let r=0;for(let o of e)if(!(t.envSlot[o]>=0)){for(;r<s.length&&s[r]>=0;)r++;if(r>=s.length)break;s[r]=o,t.envSlot[o]=r}}else t.gEnv.some(s=>s>=0)===!1&&t.parts.forEach((s,r)=>{s.envs.forEach((o,a)=>{t.gEnv[t.gBase[r]+a]=o,t.envSlot[o]=t.gBase[r]+a})});t.focusVer++,t.prefetch.w0=-1}selectEnv(t){let e=this.r;!e||!Number.isInteger(t)||t<0||t>=e.nEnvs||t===e.selected||(e.selected=t,this.fstate.env=t,this._refocus())}pinEnvs(t){let e=this.r;e&&(e.pinned=(t||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<e.nEnvs&&n!==e.selected).slice(0,4),this._refocus())}_refocus(){let t=this.r;this._assignFocus(),this._requestZ0(t.selected),this._requestExtent(t.selected),this.poseDirty=!0,this.emit("focus",{env:t.selected,focus:t.focus.slice()}),this.invalidate()}focusEnvs(){return this.r?this.r.focus.slice():[]}_requestZ0(t){let e=this.r;!e||this.fstate.z0.has(t)||e.store.request(e.pose,0,[t]).then(()=>{let n=e.store.get(e.pose,0,t);n&&this.r===e&&this.fstate.z0.set(t,n[e.followBody*7+2]+e.origins[3*t+2])}).catch(()=>{})}_streamsWanted(){let t=this.r,e=[{stream:t.pose,envs:t.focus}];for(let n of t.overlays)(!n.contacts||this.contactsOn)&&e.push({stream:n.stream,envs:t.focus});return e}_prefetch(t,e){let n=this.r,s=n.prefetch,r=n.root?1:0,o=this.contactsOn?1:0;if(s.w0===t&&s.ahead===e&&s.ver===n.focusVer&&s.contacts===o&&s.root===r)return;let a=++s.id;Object.assign(s,{w0:t,ahead:e,ver:n.focusVer,contacts:o,root:r});let l=n.pose.nWindows,c=n.pose.blockFrames,h=new Set;for(let u=0;u<=e;u++)h.add(Math.min(t+u,l-1));this.clock.loop&&t>=l-1&&h.add(0);let f=u=>{let p=new Set;for(let g of h){let _=Math.floor(g*c/u.blockFrames),m=Math.floor(((g+1)*c-1)/u.blockFrames);for(let d=_;d<=m;d++)d>=0&&d<u.nWindows&&p.add(d)}return p};for(let{stream:u,envs:p}of this._streamsWanted())for(let g of f(u))n.store.request(u,g,p).catch(_=>this._dataError(_,a));if(n.root)for(let u of f(n.root.stream))n.store.requestWindow(n.root.stream,u).catch(p=>this._dataError(p,a))}_dataError(t,e){let n=this.r;if(n){if(t instanceof ye&&t.status===404&&n.live){setTimeout(()=>{this.r===n&&n.prefetch.id===e&&(n.prefetch.w0=-1,this.invalidate())},1e3);return}this.clock.pause(),this.emit("error",{error:t,message:t.message}),this.invalidate()}}_refreshViews(t,e){let n=this.r,s=n.pose.blockFrames,r=Math.floor(t/s),o=Math.floor(e/s);if(n.views.a.refresh(n.store,n.pose,r,n.focus,n.focusVer),n.views.b.refresh(n.store,n.pose,o,n.focus,n.focusVer),n.root){let a=n.root,l=a.stream.blockFrames;a.w0=Math.floor(t/l),a.w1=Math.floor(e/l),a.d0=n.store.getWindow(a.stream,a.w0)||null,a.d1=a.w1===a.w0?a.d0:n.store.getWindow(a.stream,a.w1)||null}return[r,o]}async _scheduleWhole(t){let e=this.r,n=this._streamsWanted().filter(r=>!e.root||r.stream!==e.root.stream),s=0;for(let{stream:r,envs:o}of n)s+=4*r.itemK*r.nFrames*o.length;if(!(e.live||s>Ky))try{for(let{stream:r,envs:o}of n)for(let a=1;a<r.nWindows;a++){if(this._token!==t||this.r!==e)return;await e.store.request(r,a,o)}}catch{}}async _buildCrowd(t){let e=this.r,n=`derived/${e.run}/root_pose.blk`;try{let s=await e.source.blockIndex(n);if(this._token!==t)return;let r=el($y,n,s,!0);if(r.itemK!==7&&je(`${n}: expected one pose per env`),await e.store.requestWindow(r,0),this._token!==t)return;e.root={stream:r,w0:-1,w1:-1,d0:null,d1:null},e.rootBuf=new Float32Array(7*e.nEnvs),e.hidden=new Uint8Array(e.nEnvs),e.crowd=cf(e.nEnvs,e.proxySize),this.scene.add(e.crowd.mesh),e.crowdState="ready",e.prefetch.w0=-1,this.poseDirty=!0,this.invalidate(),this.setCrowdColor("return").catch(()=>{})}catch(s){if(this._token!==t)return;e.crowdState=s instanceof ye&&s.status===404?"unavailable":"failed",console.warn(`simscope: no crowd tier for ${e.run} (${s.message})`)}}async setCrowdColor(t){let e=this.r;if(!e||(e.crowdColumn=t,!e.crowd))return;if(t===null)return e.crowd.setColors(null),this.invalidate();let n=await this.summaries();if(!n||this.r!==e||e.crowdColumn!==t)return;let s=(n.columns||[]).find(o=>o.key===t),r=n.values&&n.values[t];!s||!r||(e.crowd.setColors(r,s.better),this.invalidate())}_proxySize(){let t=this._bounds(!1);return[Math.max(t.ex,.15),Math.max(t.ey,.15),Math.max(t.ez,.15)]}needsFrame(){if(this.dirty||this.camMoving||!this.fstate.settled)return!0;let t=this.r;return t?this.clock.playing||t.store.pending>0:!1}invalidate(){this.dirty=!0,Qn()}update(t){let e=this.r;if(this._frozen&&!e)return this.dirty=!1,!1;let n=!1;e&&(n=this._syncPose(),n=this._followStep(t)||n);let s=this.rig.update(t);this.camMoving=s,s&&(n=!0);let r=this.rig.getTarget(yh);return this.ground.update(r.x,r.y,this.rig.height,this.rig.aspect),this.rig.userChanged&&(this.rig.userChanged=!1,this.emit("camera",this.cameraState())),n}_syncPose(){let t=this.r,e=Mf(this.clock.time,t.dt,t.nFrames,Jy),n=Math.floor(e.f0/t.pose.blockFrames);this._prefetch(n,this.clock.playing&&this.clock.speed>2?2:1),this._refreshViews(e.f0,e.f1);let s=!!t.views.a.arrs[t.selected],r=!t.root||!!t.root.d0;return this.clock.hold(this,!(s&&r)),!s||e.f0===t.f0&&e.f1===t.f1&&e.t===t.t&&t.store.epoch===t.epochSeen&&!this.poseDirty?!1:(this._poseAt(e.f0,e.f1,e.t),!0)}_poseAt(t,e,n){let s=this.r,r=s.K,o=s.B,a=s.pose.blockFrames,l=s.views.a.arrs,c=s.views.b.arrs,h=(t-s.views.a.w*a)*r,f=(e-s.views.b.w*a)*r,u=s.followBody;for(let _=0;_<s.parts.length;_++){let m=s.parts[_],d=s.gBase[_];for(let M=0;M<m.nSlots;M++){let E=s.gEnv[d+M],v=E>=0?l[E]:null;if(!v){m.slotOn[M]=0;continue}let b=c[E]||v;if(hh(m.poses,M*r,v,h,c[E]?b:v,c[E]?f:h,c[E]?n:0,o),m.origins[3*M]=s.origins[3*E],m.origins[3*M+1]=s.origins[3*E+1],m.origins[3*M+2]=s.origins[3*E+2],m.slotOn[M]=1,!s.tiered){let S=M*r+u*7;s.rootPos[3*E]=m.poses[S]+s.origins[3*E],s.rootPos[3*E+1]=m.poses[S+1]+s.origins[3*E+1],s.rootPos[3*E+2]=m.poses[S+2]+s.origins[3*E+2]}}m.apply()}let p=s.envSlot[s.selected];if(p>=0){let _=0;for(;_+1<s.parts.length&&s.gBase[_+1]<=p;)_++;let m=s.parts[_],d=p-s.gBase[_];if(m.slotOn[d]){let M=d*r+(this.fstate.body>=0?this.fstate.body:u)*7,E=this.followPt;E.x=m.poses[M]+s.origins[3*s.selected],E.y=m.poses[M+1]+s.origins[3*s.selected+1],E.z=m.poses[M+2]+s.origins[3*s.selected+2],E.yaw=Sf(m.poses,M),E.valid=!0}}if(s.crowd&&s.root.d0){let _=s.root,m=s.nEnvs,d=_.stream.blockFrames,M=_.d0.data,E=(_.d1||_.d0).data,v=(t-_.w0*d)*m*7,b=_.d1?(e-_.w1*d)*m*7:v,S=_.d1?n:0,A=s.rootBuf,y=s.hidden,T=s.parts[0].slotOn,C=s.envSlot,I=_.d1?E:M;for(let L=0,N=0;L<m;L++,N+=7){hh(A,N,M,v+N,I,b+N,S,1),s.rootPos[3*L]=A[N]+s.origins[3*L],s.rootPos[3*L+1]=A[N+1]+s.origins[3*L+1],s.rootPos[3*L+2]=A[N+2]+s.origins[3*L+2];let P=C[L];y[L]=P>=0&&T[P]?1:0}s.crowd.update(A,s.origins,y)}let g=n>=.5?e:t;for(let _ of s.overlays){if(!_.layer||_.contacts&&!this.contactsOn)continue;let m=_.stream.blockFrames,d=Math.floor(g/m);_.views.a.refresh(s.store,_.stream,d,s.focus,s.focusVer);let M=(g-d*m)*_.stream.itemK,E=_.views.a.arrs;for(let v=0;v<s.gEnv.length;v++){let b=s.gEnv[v],S=b>=0?E[b]:null;S?_.layer.update(v,S,M,s.origins[3*b],s.origins[3*b+1],s.origins[3*b+2]):_.layer.clear(v)}_.layer.commit()}s.f0=t,s.f1=e,s.t=n,s.epochSeen=s.store.epoch,this.poseDirty=!1,this.dirty=!0}_bounds(t){let e=this.r,n=[1/0,1/0,1/0],s=[-1/0,-1/0,-1/0],r=(f,u,p,g)=>{Number.isFinite(f)&&Number.isFinite(u)&&Number.isFinite(p)&&(f-g<n[0]&&(n[0]=f-g),u-g<n[1]&&(n[1]=u-g),p-g<n[2]&&(n[2]=p-g),f+g>s[0]&&(s[0]=f+g),u+g>s[1]&&(s[1]=u+g),p+g>s[2]&&(s[2]=p+g))},o=e.K,a=t?null:new Set([e.selected,...e.pinned]);if(t&&e.tiered){let f=e.crowd?e.rootPos:e.origins,u=Math.max(...e.proxySize)/2;for(let p=0;p<e.nEnvs;p++)r(f[3*p],f[3*p+1],f[3*p+2],u)}else for(let f=0;f<e.parts.length;f++){let u=e.parts[f],p=e.gBase[f],g=!1;for(let _=1;_<u.nBodies;_++)u.drawnBodies[_]&&(g=!0);for(let _=0;_<u.nSlots;_++){let m=e.gEnv[p+_];if(!(m<0||!u.slotOn[_])&&!(a&&!a.has(m)))for(let d=0;d<u.nBodies;d++){if(g&&(d===0||!u.drawnBodies[d]))continue;let M=_*o+d*7;r(u.poses[M]+e.origins[3*m],u.poses[M+1]+e.origins[3*m+1],u.poses[M+2]+e.origins[3*m+2],u.bodyRadius[d])}}}if(!(n[0]<=s[0]))return{cx:0,cy:0,cz:.6,radius:1.5,ex:.5,ey:.5,ez:1};let l=s[0]-n[0],c=s[1]-n[1],h=s[2]-n[2];return{cx:(n[0]+s[0])/2,cy:(n[1]+s[1])/2,cz:(n[2]+s[2])/2,radius:Math.hypot(l,c,h)/2,ex:l,ey:c,ez:h}}_setDepth(t){let e=Math.max(t.radius,5),n=Math.max(60,4*e);this.rig.setDepth(n,n+Math.max(1e3,40*e))}_primeFollow(){let t=this.fstate,e=this.rig.getTarget(yh);ch(t.follower,e.x,e.y,e.z,0),t.follower.primed=!0,t.holdInit=!1,t.settled=!1,t.mode==="heading"&&this.followPt.valid&&(t.azOff=this.rig.azimuth-this.followPt.yaw)}setFollow(t={}){let e=this.r,n=this.fstate,s=`${n.mode}:${n.env}:${n.body}`;t.body!==void 0&&Number.isInteger(t.body)&&e&&t.body>=0&&t.body<e.B&&(n.body=t.body,this.poseDirty=!0,this._requestExtent(e.selected)),t.env!==void 0&&this.selectEnv(t.env),t.mode!==void 0&&xh.includes(t.mode)&&(this.followPref=t.mode),t.mode!==void 0&&xh.includes(t.mode)&&t.mode!==n.mode&&(t.mode==="off"&&this.rest.copy(this.rig.getTarget(yh)),n.mode=t.mode,this._clearPan(),this._primeFollow(),n.mode==="heading"&&this.followPt.valid&&(n.azOff=this.rig.azimuth-this.followPt.yaw),this._autoFit()),`${n.mode}:${n.env}:${n.body}`!==s&&(this.emit("follow",this.follow()),this.invalidate())}follow(){let t=this.fstate,e=this.r;return{mode:t.mode,env:e?e.selected:t.env,body:t.body>=0?t.body:e?e.followBody:0}}_heldZ(){return this.linked?this.linked.z():this.fstate.mode==="position"?this.holdZ:null}_followStep(t){let e=this.fstate,n=this.rig,s=this.followPt;if(e.mode==="off"||!s.valid)return e.settled=!0,!1;let r=e.mode,o=this._heldZ(),a=e.follower,l,c=!1;if(o!==null){let u=e.hold;e.holdInit||(u.x=a.z.x,u.v=0,e.holdInit=!0),Vs(u,o,.08,t),l=u.x,c=Math.abs(u.x-o)>1e-4||Math.abs(u.v)>1e-4}else e.holdInit=!1,l=r==="position"?e.z0.get(this.r.selected)??e.z0Default??s.z:s.z;gf(a,s.x,s.y,l,s.yaw,t,.12,2*n.height),o!==null&&(a.z.x=l,a.z.v=0),r==="heading"&&(n.rotateBusy?e.azOff=n.azimuth-a.yaw.x:n.setAzimuthNow(a.yaw.x+e.azOff)),this._writeFollowTarget();let h=Math.hypot(a.x.x-s.x,a.y.x-s.y,a.z.x-l),f=Math.hypot(a.x.v,a.y.v,a.z.v)+Math.abs(a.yaw.v);return e.settled=this.clock.playing?!1:h<1e-4&&f<1e-4&&!c,!0}_onControl(){this.rig.dragDelta(vh)&&(this.pan.a+=vh[0],this.pan.b+=vh[1],this.fstate.mode!=="off"&&this.followPt.valid&&this.fstate.follower.primed?this._writeFollowTarget():this._writeRestTarget(!1,!1))}_writeFollowTarget(){let t=this.fstate.follower,e=this.rig.basis(!1),n=this.pan.a,s=this.pan.b;this.rig.setTargetNow(t.x.x+n*e.rx+s*e.ux,t.y.x+n*e.ry+s*e.uy,t.z.x+n*e.rz+s*e.uz)}_writeRestTarget(t,e){let n=this.rig.basis(e),s=this.pan.a,r=this.pan.b,o=this.rest;this.rig.setTarget(o.x+s*n.rx+r*n.ux,o.y+s*n.ry+r*n.uy,o.z+s*n.rz+r*n.uz,t)}_zeroPan(t){this.pan.a=this.pan.b=0,this.fstate.mode==="off"&&this.r&&this.rig.setTarget(this.rest.x,this.rest.y,this.rest.z,t)}_clearPan(){this.linked?this.linked.clearPan():this._zeroPan(!1)}_extentKey(t){let e=this.fstate;return`${t}:${e.body>=0?e.body:this.r.followBody}`}_extent(){let t=this.r;if(!t)return;let e=this._extentKey(t.selected);return t.extents.has(e)?t.extents.get(e):void 0}_requestExtent(t){let e=this.r;if(!e)return;let n=this._extentKey(t);if(e.extentJobs.has(n)){this._extentJob=e.extentJobs.get(n);return}if(e.live){e.extents.set(n,null),e.extentJobs.set(n,Promise.resolve());return}let s=this.fstate.body>=0?this.fstate.body:e.followBody,r=gl(e,e.pose,t).then(o=>{if(this.r!==e)return;let a=e.parts.find(l=>!l.envs||l.envs.includes(t))||e.parts[0];e.extents.set(n,uf({poses:o,T:e.pose.nFrames,B:e.B,follow:s,origin:[e.origins[3*t],e.origins[3*t+1],e.origins[3*t+2]],boxes:a.geomBoxes}))},()=>{this.r===e&&e.extents.set(n,null)}).then(()=>{this.r===e&&t===e.selected&&this._extentArrived()});e.extentJobs.set(n,r),this._extentJob=r}_extentArrived(){this.linked?this.linked.arrived():this._autoFit()}_fitHeight(t){let e=this._extent();if(!e)return null;let n=this.rig.basis(!0);return df(e,t,n.ux,n.uy,n.uz,this.rig.aspect)}_fitVertical(t,e,n){this.holdZ=t,this.rig.setHeight(e,n),this.fstate.settled=!1,this.invalidate()}_trajectoryFit(t){if(this.linked||this.fstate.mode!=="position")return!1;let e=this._extent();if(!e)return!1;let n=(e.zlo+e.zhi)/2;return this._fitVertical(n,this._fitHeight(n),t),!0}_autoFit(){if(!(this.linked||!this.r||this.fstate.mode!=="position"||!this._extent())){if(this.clock.playing){this._fitPending=!0;return}this._fitPending=!1,this.rig.userZoomed||this._trajectoryFit(!0)}}setView(t,e={}){this.linked?this.linked.setView(t,e):this._setView(t,e)}_setView(t,e){if(!ks.includes(t))return;this.viewName=t;let n=e.animate!==!1&&!!this.r;if(this.rig.setView(t,n),this._zeroPan(n),!this.linked&&this.r&&this.fstate.mode==="position"&&this.holdZ!==null&&!this.rig.userZoomed){let s=this._fitHeight(this.holdZ);s&&this.rig.setHeight(s,n)}this.invalidate()}frame(t="focus",e={}){this.linked?this.linked.frame(t,e):this._frame(t,e)}_frame(t,e){let n=e.animate!==!1,s=this._frameTarget(t,n);s&&this._fitFrame(t,s,n),this.invalidate()}_frameTarget(t,e){if(!this.r)return null;this._syncPose();let s=this.fstate;if(t==="all"){s.mode!=="off"&&this.setFollow({mode:"off"});let o=this._bounds(!0);return this.pan.a=this.pan.b=0,this.rest.set(o.cx,o.cy,o.cz),this.rig.setTarget(o.cx,o.cy,o.cz,e),o}let r=this._bounds(!1);return this.pan.a=this.pan.b=0,s.mode==="off"&&(this.rest.set(r.cx,r.cy,r.cz),this.rig.setTarget(r.cx,r.cy,r.cz,e)),r}_fitFrame(t,e,n){t==="all"?(this.rig.fitBox(e.ex/2,e.ey/2,e.ez/2,n),this._setDepth(e)):this._trajectoryFit(n)||this.rig.fitBox(e.ex/2,e.ey/2,e.ez/2,n)}cameraState(){let t=this.rig.state(this.fstate.mode!=="off");return t.pan=[this.pan.a,this.pan.b],t}standingHeight(){let t=this.r;return t?this.fstate.z0.get(t.selected)??this.fstate.z0Default:null}setCameraState(t,e={}){if(!t)return;let n=e.animate===!0;this.rig.apply(t,n,!1);let s=t.pan;Array.isArray(s)&&Number.isFinite(s[0])&&Number.isFinite(s[1])?(this.pan.a=s[0],this.pan.b=s[1],this.fstate.mode==="off"&&this._writeRestTarget(n,!0)):this.fstate.mode==="off"&&Array.isArray(t.target)&&(this.pan.a=this.pan.b=0,this.rest.set(t.target[0],t.target[1],t.target[2]),this.rig.setTarget(t.target[0],t.target[1],t.target[2],n)),this.invalidate()}pickEnv(t,e){let n=this.r;if(!n)return null;let s=this.canvas.getBoundingClientRect();if(!(s.width>0&&s.height>0))return null;let r=(t-s.left)/s.width*2-1,o=-((e-s.top)/s.height*2-1);this.camera.updateMatrixWorld();let a=new k(r,o,-1).unproject(this.camera),l=this.camera.getWorldDirection(new k),c=this.rig.height/s.height,h=Math.max(n.proxySize[0],n.proxySize[1],n.proxySize[2]),f=Math.max(.6*h,6*c);return Ef([a.x,a.y,a.z,l.x,l.y,l.z],n.rootPos,n.nEnvs,f)}resize(t,e,n=1){this.cssWidth=Math.max(t,1),this.cssHeight=Math.max(e,1),this.dpr=n,this.rig.setFrame(void 0,this.cssWidth/this.cssHeight),this.invalidate()}_setBackground(t){let e=t===null||t==="transparent"||t==="none";this.transparent=e,this.scene.background=e?null:typeof t=="string"&&af(t)||Zn(Nn(this.theme).viewport)}setTheme(t,e){if(this.theme=t==="dark"?"dark":"light",this.ground.setTheme(this.theme),this.r){for(let n of this.r.parts)n.setTheme(this.theme);for(let n of this.r.overlays)n.layer&&n.layer.setTheme(this.theme)}this.bgExplicit=e!=null,this._setBackground(this.bgExplicit?e:void 0),this.invalidate()}setBackground(t){this.bgExplicit=t!=null,this._setBackground(this.bgExplicit?t:void 0),this.invalidate()}setGround(t){this.groundForced=!0,this._groundStyle=t==="grid"||t==="none"?t:"checker",this.ground.setStyle(this._groundStyle),this._applyGroundVisibility(),this.invalidate()}_applyGroundVisibility(){let t=this.r,e=t?t.parts.some(n=>n.planes.length>0):!1;if(this.ground.mesh.visible=this._groundStyle!=="none"&&(e||this.groundForced||!t),t&&e){let n=t.parts.find(o=>o.planes.length).planes[0],s=t.tiered?2:Math.max(...t.proxySize),r=[.05,.1,.25,.5,1,2,5].reduce((o,a)=>Math.abs(a-s/2)<Math.abs(o-s/2)?a:o);this.ground.setPlane(n.z,r)}}setContacts(t){this.contactsOn=!!t;let e=this.r;if(e){for(let n of e.overlays)n.contacts&&n.layer&&(n.layer.root.visible=this.contactsOn);e.prefetch.w0=-1,this.poseDirty=!0}this.invalidate()}setVisual(t){if(this.showVisual=!!t,this.r)for(let e of this.r.parts)e.setRoles(this.showVisual,this.showCollision);this.invalidate()}setCollision(t){if(this.showCollision=!!t,this.r)for(let e of this.r.parts)e.setRoles(this.showVisual,this.showCollision);this.invalidate()}setColor(t){let e=typeof t=="string"&&t?t:null;e!==this.color&&(this.color=e,this.emit("color",{color:e}))}setRoles(t,e){if(this.showVisual=!!t,this.showCollision=!!e,this.r)for(let n of this.r.parts)n.setRoles(this.showVisual,this.showCollision);this.invalidate()}stats(){let t=this.r,e=this.renderer.info;return{cachedBytes:t?t.store.bytes:0,pending:(t?t.store.pending:0)+Us.pending,drawCalls:e.render.calls,triangles:e.render.triangles,focusEnvs:t?t.focus.length:0,threaded:Us.threaded}}async refresh(){let t=this.r;if(!t||!t.live)return;let e=await gh(t.source,t.run),n=[];for(let l of t.streams.values()){let c=await t.source.blockIndex(l.path,{refresh:!0});l.nFrames=c.nFrames,l.nWindows=Math.ceil(c.nFrames/c.blockFrames),n.push(l)}if(this.r!==t)return;let s=e.status==="recording",r=n.filter(l=>l.kind==="pose"||l.kind==="arrows"||l.kind==="polyline"),o=s?_h(e,r):e.n_frames,a=t.live;t.live=s,a!==s&&this._claimClock(),o>t.nFrames&&(t.nFrames=o,this._claimClock(),t.prefetch.w0=-1,this.emit("live",{frames:o}),this.invalidate())}async series(t,e,n=0){return Ff(this._need("series"),t,e,n)}async bodySeries(t,e,n){return Bf(this._need("bodySeries"),t,e,n)}highlights(){return this.r?kf(this.r):Promise.resolve(null)}summaries(){return this.r?_l(this.r,"summaries.json"):Promise.resolve(null)}envelope(t,e=0){return this.r?zf(this.r,t,e):Promise.resolve(null)}_need(t){return this.r||je(`${t}(): no run is loaded`),this.r}async snapshot(t="image/png"){return this.update(0),this.renderer.draw(this),new Promise((e,n)=>this.canvas.toBlob(s=>s?e(s):n(new Error("simscope: snapshot failed")),t))}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e}))}};function Gf(i,t=0){let e=Number.isFinite(i.t1)&&i.t1>i.t?`${i.t.toFixed(2)} s to ${i.t1.toFixed(2)} s`:`${i.t.toFixed(2)} s`,n=[i.label||i.kind||"Highlight"];return i.detail&&n.push(i.detail),n.push(e),t>0&&n.push(`and ${t} more nearby`),n.join(`
`)}function xl(i,t,e,n=6){let s=[],r=[];if(!(t>0))return{spans:s,ticks:r};let o=h=>Math.min(100,Math.max(0,h/t*100)),a=n/Math.max(e,1)*t,l=null,c=()=>{l&&r.push({left:o(l.best.t),t:l.best.t,title:Gf(l.best,l.n-1)}),l=null};for(let h of i)if(Number.isFinite(h.t)){if(Number.isFinite(h.t1)&&h.t1>h.t){s.push({left:o(h.t),width:o(h.t1)-o(h.t),t:h.t,title:Gf(h)});continue}l&&h.t-l.first<a?(l.n++,(h.score??0)>(l.best.score??0)&&(l.best=h)):(c(),l={best:h,first:h.t,n:1})}return c(),{spans:s,ticks:r}}var jy=[.25,.5,1,2,4],Qy=["off","position","pose","heading"],tv=["checker","grid","none"],ev=8,nv=`
:host { display: block; position: relative; aspect-ratio: 16 / 9; min-height: 96px;
  overflow: hidden; background: #f5f5f5; color: #0a0a0a; font: 12px/1.2 system-ui, sans-serif;
  --simscope-accent: #3b6ea5; --ss-bar: rgba(255, 255, 255, 0.86); --ss-line: rgba(0, 0, 0, 0.16);
  --ss-mark: #d1495b; --ss-hl: #2c7a7b; }
:host([theme="dark"]) { background: #121212; color: #fafafa; --simscope-accent: #6ea8e0;
  --ss-bar: rgba(18, 18, 18, 0.86); --ss-line: rgba(255, 255, 255, 0.22); --ss-hl: #5fc2c4; }
:host([hidden]) { display: none; }
canvas, img.poster { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
canvas { touch-action: none; }
img.poster { object-fit: contain; }
.msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 12px; text-align: center; color: #b3261e; pointer-events: none; }
.msg[hidden] { display: none; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 8px;
  padding: 4px 8px; background: var(--ss-bar); backdrop-filter: blur(6px); }
:host([nocontrols]) .bar { display: none; }
button, select { font: inherit; color: inherit; background: transparent; border: 1px solid var(--ss-line);
  border-radius: 6px; padding: 2px 6px; cursor: pointer; }
button.play { width: 28px; height: 24px; padding: 0; display: grid; place-items: center; }
button.on { background: var(--simscope-accent); color: #fff; border-color: transparent; }
button[hidden], select[hidden] { display: none; }
.track { position: relative; flex: 1; min-width: 40px; height: 26px; }
.marks { position: absolute; left: 0; right: 0; top: 1px; height: 8px; }
.marks i { position: absolute; top: 0; height: 6px; min-width: 3px; background: var(--ss-mark); border-radius: 1px;
  opacity: 0.85; cursor: pointer; }
.marks b { position: absolute; top: 0; width: 2px; height: 8px; margin-left: -1px; border-radius: 1px;
  background: var(--ss-hl); cursor: pointer; }
.marks b::before { content: ""; position: absolute; inset: 0 -4px; }
.marks u { position: absolute; top: 2px; height: 4px; min-width: 3px; border-radius: 2px; background: var(--ss-hl);
  opacity: 0.55; text-decoration: none; cursor: pointer; }
input.scrub { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 16px; margin: 0;
  accent-color: var(--simscope-accent); }
.time { font-variant-numeric: tabular-nums; white-space: nowrap; }
`,Wf='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1l9 5-9 5z" fill="currentColor"/></svg>',iv='<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor"/></svg>';function Sh(i){if(typeof Uint8Array.fromBase64=="function")return Uint8Array.fromBase64(i);let t=atob(i),e=new Uint8Array(t.length);for(let n=0;n<t.length;n++)e[n]=t.charCodeAt(n);return e}var Mh=new WeakMap,wi=[],yl=i=>`${i.toFixed(2)}s`,Yr=class i extends HTMLElement{static get observedAttributes(){return["src","run","loop","speed","view","background","collision","env","follow","ground","theme","sync","color"]}constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=`<style>${nv}</style>
      <canvas part="canvas"></canvas>
      <div class="msg" hidden></div>
      <div class="bar" part="controls">
        <button class="play" aria-label="Play" disabled>${Wf}</button>
        <div class="track"><div class="marks"></div>
          <input class="scrub" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" disabled></div>
        <span class="time">0.00s / 0.00s</span>
        <select class="speed" aria-label="Speed">${jy.map(r=>`<option value="${r}"${r===1?" selected":""}>${r}x</option>`).join("")}</select>
        <button class="col" hidden aria-pressed="false">collision</button>
      </div>`;let e=r=>t.querySelector(r);this._ui={canvas:e("canvas"),msg:e(".msg"),play:e(".play"),scrub:e(".scrub"),marks:e(".marks"),time:e(".time"),speed:e(".speed"),col:e(".col")},this._player=null,this._clock=null,this._loading=null,this._loaded=!1,this._visible=!1,this._scrubbing=!1,this._autoplayDone=!1,this._failed=!1,this._poster=null,this._info=null;let n=this._ui;n.play.addEventListener("click",()=>this._clock&&this._clock.playing?this.pause():this.play()),n.scrub.addEventListener("pointerdown",()=>this._scrubbing=!0),n.scrub.addEventListener("input",()=>this.seek(n.scrub.value/1e3*this._clock.duration));let s=()=>this._scrubbing=!1;n.scrub.addEventListener("pointerup",s),n.scrub.addEventListener("pointercancel",s),n.speed.addEventListener("change",()=>this.setSpeed(Number(n.speed.value))),n.col.addEventListener("click",()=>this.toggleAttribute("collision")),this._onTime=()=>this._time(),this._onState=()=>this._syncPlay(),this._onEnded=()=>this._emit("ended")}connectedCallback(){this._ensurePlayer(),this._resize=new ResizeObserver(()=>this._measure()),this._resize.observe(this),this._seen=new IntersectionObserver(t=>{let e=t[t.length-1].isIntersecting;this._setVisible(e)},{rootMargin:"64px"}),this._seen.observe(this),this._measure()}disconnectedCallback(){this._resize.disconnect(),this._seen.disconnect(),this._visible=!1,this._dropLive(),this._player&&(this._unbindClock(),this._player.destroy(),this._player=null,this._clock=null,this._loaded=!1,this._loading=null)}attributeChangedCallback(t,e,n){let s=this._player;t==="src"||t==="run"?this.isConnected&&(this._loaded||this._loading)&&e!==n&&(this.unload(),this._visible&&this.load().catch(()=>{})):s&&(t==="loop"?this._clock.loop=this.hasAttribute("loop"):t==="speed"?this.setSpeed(Number(n)):t==="view"?this.setView(n):t==="background"?s.setBackground(this._background()):t==="collision"?this._applyRoles():t==="env"?this._applyEnv():t==="follow"?this._applyFollow():t==="ground"?s.setGround(this._ground()):t==="theme"?s.setTheme(this._theme(),this._background()):t==="sync"?this._rebindClock():t==="color"&&s.setColor(this._color()))}_background(){let t=this.getAttribute("background");return t===null||t===""?void 0:t}_theme(){return this.getAttribute("theme")==="dark"?"dark":"light"}_ground(){let t=this.getAttribute("ground");return tv.includes(t)?t:"checker"}_color(){return this.getAttribute("color")||void 0}_followMode(){let t=this.getAttribute("follow");if(t!==null)return t===""||t==="true"?"position":Qy.includes(t)?t:"off"}_env(){let t=Number(this.getAttribute("env"));return Number.isInteger(t)&&t>=0?t:0}_ensurePlayer(){if(this._player)return;let t=this.getAttribute("view");this._clock=this.hasAttribute("sync")?Zi(this.getAttribute("sync")):null;let e;try{e=new Ws(this._ui.canvas,{clock:this._clock||void 0,theme:this._theme(),ground:this._ground(),view:ks.includes(t)?t:"iso",background:this._background(),follow:this._followMode(),color:this._color()})}catch(s){this._fail(new Error(`simscope: WebGL is not available (${s.message})`));return}this._player=e,this._clock=e.clock,this._clock.loop=this.hasAttribute("loop")||this._clock.loop;let n=Number(this.getAttribute("speed"));n>0&&(this._clock.speed=n),this._bindClock(),e.addEventListener("error",s=>this._fail(new Error(s.detail.message))),e.addEventListener("live",()=>this._buildUi(this._info)),e.addEventListener("color",()=>this._paintColor()),this._paintColor(),this._syncSpeedUi(this._clock.speed),this._measure()}_bindClock(){this._clock.addEventListener("time",this._onTime),this._clock.addEventListener("state",this._onState),this._clock.addEventListener("ended",this._onEnded)}_unbindClock(){this._clock&&(this._clock.removeEventListener("time",this._onTime),this._clock.removeEventListener("state",this._onState),this._clock.removeEventListener("ended",this._onEnded))}_rebindClock(){if(!this._player)return;let t=this._loaded||!!this._loading;this.unload(),this._unbindClock(),this._player.destroy(),this._player=null,this._ensurePlayer(),t&&this._visible&&this.load().catch(()=>{})}_measure(){if(!this._player)return;let t=this.getBoundingClientRect();t.width>0&&t.height>0&&this._player.resize(t.width,t.height,Math.min(window.devicePixelRatio||1,2)),this._placeMarks()}_setVisible(t){this._visible=t,this._player&&t&&(this._touchLive(),!this._loaded&&!this._loading&&!this._failed&&this.getAttribute("src")?this.load().catch(()=>{}):this._loaded&&this._maybeAutoplay())}_touchLive(){let t=wi.indexOf(this);t>=0&&wi.splice(t,1),wi.push(this)}_dropLive(){let t=wi.indexOf(this);t>=0&&wi.splice(t,1)}static _evict(){for(;wi.length>ev;){let t=wi.findIndex(n=>!n._visible);if(t<0)return;let[e]=wi.splice(t,1);e.unload(!0)}}load(){if(this._loading)return this._loading;if(this._ensurePlayer(),!this._player)return this._loadPosterOnly();this._failed=!1;let t=this._load().catch(n=>{throw this._failed=!0,this._fail(n),n});this._loading=t;let e=()=>{this._loading===t&&(this._loading=null)};return t.then(e,e),t}async _loadPosterOnly(){let t=this.getAttribute("src"),e=new Error("simscope: WebGL is not available");if(t)try{let n=await this._openSource(t),s=this.getAttribute("run")||(await n.runs())[0];this._showPoster(n,s)}catch{}return Promise.reject(e)}async _load(){let t=this.getAttribute("src");if(!t)throw new Error("simscope: <simscope-player> has no src attribute");this._ui.msg.hidden=!0;let e=await this._openSource(t);this._touchLive(),i._evict();let n=this._env(),s=await this._player.load(e,this.getAttribute("run")||void 0,{envs:n?[n]:void 0});return this._loaded=!0,this._info=s,this._source=e,this._showPoster(e,s.run),this._buildUi(s),this._applyRoles(),this._applyFollow(),this._clock.loop=this.hasAttribute("loop")||this._clock.loop,this._emit("ready",{duration:s.duration,frames:s.frames,dt:s.dt,run:s.run,events:s.events}),this._loadHighlights(s.run),this._maybeAutoplay(),s}async _openSource(t){if(!t.startsWith("#"))return Wi.open(await this._fetchBytes(t));let e=t.slice(1),n=this.getRootNode().getElementById?.(e)??document.getElementById(e);if(!n)throw new Error(`simscope: no element with id "${e}" for src="${t}"`);let s=Mh.get(n);return s||(s=Wi.open(Sh(n.textContent.trim())),Mh.set(n,s),s.catch(()=>Mh.delete(n))),s}async _fetchBytes(t){let e;try{e=await fetch(t)}catch(n){throw new Error(`simscope: could not fetch ${t} (${n.message}); file:// pages must use src="#id"`)}if(!e.ok)throw new Error(`simscope: fetching ${t} failed with HTTP ${e.status}`);return new Uint8Array(await e.arrayBuffer())}async _loadHighlights(t){try{let e=await this._player.highlights();if(!e||this._info?.run!==t)return;let n=this._player.follow().env;this._highlights=(e.highlights||[]).filter(s=>s.env===n).sort((s,r)=>s.t-r.t),this._placeMarks()}catch{}}_showPoster(t,e){this._player||this._poster||!e||t.get(`runs/${e}/poster.png`).then(n=>{this._poster||(this._poster=document.createElement("img"),this._poster.className="poster",this._poster.alt="",this._poster.src=URL.createObjectURL(new Blob([n],{type:"image/png"})),this.shadowRoot.insertBefore(this._poster,this._ui.msg))}).catch(()=>{})}unload(t=!1){this._loading=null,this._loaded=!1,this._failed=!1,this._autoplayDone=!1,this._info=null,this._highlights=[],this._dropLive(),this._player&&this._player.unload({keepFrame:t}),this._poster&&(URL.revokeObjectURL(this._poster.src),this._poster.remove(),this._poster=null);let e=this._ui;e.marks.textContent="",e.scrub.disabled=e.play.disabled=!0,e.scrub.value=0,e.col.hidden=!0,e.time.textContent=`${yl(0)} / ${yl(0)}`,this._syncPlay()}_fail(t){this._ui.msg.textContent=t.message,this._ui.msg.hidden=!1,this._emit("error",{message:t.message})}_emit(t,e={}){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}_buildUi(t){if(!t)return;let e=this._ui;e.play.disabled=e.scrub.disabled=!1,e.col.hidden=!t.hasCollision,this._events=t.events||[],this._placeMarks(),this._time(),this._syncPlay()}_paintColor(){let t=this._player?this._player.color:null;t?this._ui.marks.style.setProperty("--ss-hl",t):this._ui.marks.style.removeProperty("--ss-hl")}_placeMarks(){let t=this._ui;t.marks.textContent="";let e=this._clock?this._clock.duration:0;if(!(e>0)||!this._info)return;for(let o of this._events||[]){let a=document.createElement("i");a.style.left=`${Math.min(100,o.t0/e*100)}%`,a.style.width=`${Math.max(0,(o.t1-o.t0)/e*100)}%`,a.title=o.label,a.addEventListener("click",()=>this.seek(o.t0)),t.marks.appendChild(a)}let n=t.marks.getBoundingClientRect().width||300,{spans:s,ticks:r}=xl(this._highlights||[],e,n);for(let o of s){let a=document.createElement("u");a.style.left=`${o.left}%`,a.style.width=`${o.width}%`,a.title=o.title,a.addEventListener("click",()=>this.seek(o.t)),t.marks.appendChild(a)}for(let o of r){let a=document.createElement("b");a.style.left=`${o.left}%`,a.title=o.title,a.addEventListener("click",()=>this.seek(o.t)),t.marks.appendChild(a)}}_time(){let t=this._ui,e=this._clock;if(!e)return;let n=e.time,s=e.duration;t.time.textContent=`${yl(n)} / ${yl(s)}`,this._scrubbing||(t.scrub.value=s>0?Math.round(n/s*1e3):0),this._emit("timeupdate",{t:n,duration:s})}_syncPlay(){let t=!!this._clock&&this._clock.playing;this._ui.play.innerHTML=t?iv:Wf,this._ui.play.setAttribute("aria-label",t?"Pause":"Play")}_syncSpeedUi(t){let e=this._ui.speed;if(![...e.options].some(n=>Number(n.value)===t)){let n=new Option(`${t}x`,String(t)),s=[...e.options].findIndex(r=>Number(r.value)>t);e.add(n,s<0?null:e.options[s])}e.value=String(t)}_applyRoles(){if(!this._player)return;let t=this.hasAttribute("collision");this._player.setCollision(t),this._ui.col.classList.toggle("on",t),this._ui.col.setAttribute("aria-pressed",String(t))}_applyEnv(){!this._player||!this._loaded||(this._player.selectEnv(this._env()),this._info&&this._loadHighlights(this._info.run))}_applyFollow(){if(!this._player)return;let t=this._followMode();t!==void 0&&this._player.setFollow({mode:t})}_maybeAutoplay(){this._autoplayDone||!this.hasAttribute("autoplay")||!this._visible||!this._loaded||(this._autoplayDone=!0,this.play())}play(){this._clock&&this._clock.play()}pause(){this._clock&&this._clock.pause()}seek(t){this._clock&&this._clock.seek(t)}setSpeed(t){this._clock&&(this._clock.speed=t,this._syncSpeedUi(this._clock.speed))}setView(t){this._player&&ks.includes(t)&&this._player.setView(t)}get player(){return this._player}get clock(){return this._clock}async snapshot(){if(!this._player)throw new Error("simscope: nothing to snapshot (not loaded or no WebGL)");return this._player.snapshot()}get currentTime(){return this._clock?this._clock.time:0}get duration(){return this._clock?this._clock.duration:0}get playing(){return!!this._clock&&this._clock.playing}};function bh(i="simscope-player"){customElements.get(i)||customElements.define(i,Yr)}var Xf=i=>`${i.toFixed(2)}s`,sv="#2c7a7b",Xs=7;function Zr(i,t,e){let n=document.createElement(i);return Object.assign(n.style,t),e&&(n.title=e),n}function rv(i,t){let e=i.closest("figure")?.querySelector("figcaption");if(!e||e.querySelector("[data-ss-dot]"))return null;let n=Zr("span",{display:"inline-block",width:"8px",height:"8px",marginRight:"6px",borderRadius:"50%",background:t});return n.setAttribute("data-ss-dot",""),e.prepend(n),n}function qf(i,t="compare"){let e=S=>i.querySelector(`#${S}`)||document.getElementById(S),n=e("ss-play"),s=e("ss-scrub"),r=e("ss-time"),o=e("ss-speed"),a=e("ss-marks"),l=Zi(t),c=[...document.querySelectorAll(`simscope-player[sync="${t}"]`)];l.loop=i.dataset.loop==="1";let h=c.map(S=>{let A=S.getAttribute("color")||"";return{el:S,color:A||sv,events:[],highlights:[],dot:A?rv(S,A):null}}),f=()=>{r.textContent=`${Xf(l.time)} / ${Xf(l.duration)}`,document.activeElement!==s&&(s.value=l.duration>0?Math.round(l.time/l.duration*1e3):0)},u=()=>{n.textContent=l.playing?"Pause":"Play",n.setAttribute("aria-label",l.playing?"Pause":"Play")},p=()=>u();l.addEventListener("time",f),l.addEventListener("state",p);let g=()=>l.toggle(),_=()=>l.seek(s.value/1e3*l.duration),m=()=>l.speed=Number(o.value);n.addEventListener("click",g),s.addEventListener("input",_),o.addEventListener("change",m);let d=!1,M=()=>{a.textContent="";let S=l.duration;if(!d||!(S>0))return;let A=h.length;a.style.height=`${A*Xs}px`,a.parentElement&&(a.parentElement.style.height=`${A*Xs+24}px`);let y=a.getBoundingClientRect().width||300;h.forEach((T,C)=>{let I=Zr("div",{position:"absolute",left:"0",right:"0",top:`${C*Xs}px`,height:`${Xs}px`});for(let P of T.events){let O=Zr("i",{left:`${Math.min(100,P.t0/S*100)}%`,width:`${Math.max(0,(P.t1-P.t0)/S*100)}%`,top:`${Xs-2}px`,height:"2px"},P.label);O.addEventListener("click",()=>l.seek(P.t0)),I.appendChild(O)}let{spans:L,ticks:N}=xl(T.highlights,S,y);for(let P of L){let O=Zr("u",{position:"absolute",left:`${P.left}%`,width:`${P.width}%`,top:"2px",height:"3px",minWidth:"3px",borderRadius:"2px",background:T.color,opacity:"0.55",textDecoration:"none",cursor:"pointer"},P.title);O.addEventListener("click",()=>l.seek(P.t)),I.appendChild(O)}for(let P of N){let O=Zr("b",{position:"absolute",left:`${P.left}%`,top:"0",width:"2px",height:`${Xs-2}px`,marginLeft:"-1px",borderRadius:"1px",background:T.color,cursor:"pointer"},P.title);O.addEventListener("click",()=>l.seek(P.t)),I.appendChild(O)}a.appendChild(I)})},E=typeof ResizeObserver=="function"?new ResizeObserver(()=>M()):null;E&&E.observe(a);let v=new Set,b=S=>{if(v.add(S),v.size<h.length)return;l.duration>0&&(d=!0,M(),n.disabled=s.disabled=!1,f(),i.dataset.autoplay==="1"&&l.play()),i.hidden=!1};for(let S of h)S.el.addEventListener("ready",async A=>{S.events=A.detail.events||[];try{let y=await S.el.player.highlights(),T=S.el.player.follow().env;S.highlights=(y&&y.highlights||[]).filter(C=>C.env===T).sort((C,I)=>C.t-I.t)}catch{}b(S),d&&M()}),S.el.addEventListener("error",()=>b(S));return u(),{clock:l,dispose(){l.removeEventListener("time",f),l.removeEventListener("state",p),n.removeEventListener("click",g),s.removeEventListener("input",_),o.removeEventListener("change",m),E&&E.disconnect();for(let S of h)S.dot&&S.dot.remove()}}}bh();return sp(ov);})();
