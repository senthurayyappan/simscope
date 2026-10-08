"use strict";var SimscopePlayer=(()=>{var Cl=Object.defineProperty;var dp=Object.getOwnPropertyDescriptor;var fp=Object.getOwnPropertyNames;var pp=Object.prototype.hasOwnProperty;var Gh=(i,t)=>{for(var e in t)Cl(i,e,{get:t[e],enumerable:!0})},mp=(i,t,e,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of fp(t))!pp.call(i,s)&&s!==e&&Cl(i,s,{get:()=>t[s],enumerable:!(n=dp(t,s))||n.enumerable});return i};var gp=i=>mp(Cl({},"__esModule",{value:!0}),i);var Rv={};Gh(Rv,{Clock:()=>Li,HttpSource:()=>xl,PackSource:()=>$i,Player:()=>Zs,SimscopePlayerElement:()=>Jr,SourceError:()=>ye,attachMaster:()=>sp,clockFor:()=>Qi,decodeBase64:()=>Ph,format:()=>ni,linkCameras:()=>so,register:()=>Ih,startLoop:()=>eu,stepLoop:()=>nu});var ni={};Gh(ni,{casPath:()=>js,checkFormat:()=>tr,computeNormals:()=>Pl,crc32:()=>Js,decodeBlock:()=>Qs,decodeEnv:()=>bp,decodeMesh:()=>Dl,indexWindows:()=>Ul,inflate:()=>Il,inflateIfGzip:()=>io,parseBlk:()=>Ll,parseJson:()=>Ii,parsePack:()=>no,renormalizePoses:()=>$h,unwrapPack:()=>xp});var Zh=new TextDecoder;function jt(i){throw new Error(`simscope: ${i}`)}var _p=(()=>{let i=new Uint32Array(256);for(let t=0;t<256;t++){let e=t;for(let n=0;n<8;n++)e=e&1?3988292384^e>>>1:e>>>1;i[t]=e>>>0}return i})();function Js(i,t=0,e=i.length){let n=4294967295;for(let s=t;s<e;s++)n=_p[(n^i[s])&255]^n>>>8;return(n^4294967295)>>>0}function to(i,t){return String.fromCharCode(i[t],i[t+1],i[t+2],i[t+3])}function eo(i){return new DataView(i.buffer,i.byteOffset,i.byteLength)}function Pi(i,t,e){let n=i.byteOffset+t;return t+4*e>i.length&&jt("truncated float data"),n%4===0?new Float32Array(i.buffer,n,e):new Float32Array(i.slice(t,t+4*e).buffer)}async function Il(i,t="deflate-raw"){let e=new DecompressionStream(t),n=e.writable.getWriter();n.write(i).catch(()=>{}),n.close().catch(()=>{});try{return new Uint8Array(await new Response(e.readable).arrayBuffer())}catch(s){return jt(`inflate failed (${s&&s.message?s.message:s})`)}}async function Rl(i,t,e){let n=await Il(i);return n.length!==t&&jt(`${e}: inflated ${n.length} bytes, expected ${t}`),n}function no(i){(i.length<32||to(i,0)!=="SSPK")&&jt("not a simscope pack (bad SSPK magic)");let t=eo(i),e=t.getUint16(4,!0);e!==1&&jt(`unsupported pack major version ${e}`);let n=t.getUint32(8,!0),s=Number(t.getBigUint64(16,!0)),r=t.getUint32(24,!0),o=t.getUint32(28,!0);s+r>i.length&&jt("pack directory out of bounds"),Js(i,s,s+r)!==o&&jt("pack directory CRC mismatch");let a;try{a=JSON.parse(Zh.decode(i.subarray(s,s+r)))}catch(u){return jt(`pack directory is not valid JSON (${u.message})`)}let l=a&&a.entries;(!Array.isArray(l)||l.length!==n)&&jt("pack directory entry count mismatch");let c=new Map;for(let u of l)u.offset+u.length>s&&jt(`pack entry out of bounds: ${u.path}`),c.set(u.path,i.subarray(u.offset,u.offset+u.length));return{entries:c}}async function io(i){return i.length>2&&i[0]===31&&i[1]===139?Il(i,"gzip"):i}async function xp(i){return no(await io(i))}function js(i,t,e=""){return`${i}/${t.slice(0,2)}/${t}${e}`}var Wh=64,Xh=32,qh=1,yp=2;function vp(i,t){let e=eo(i);return{offset:t,env:e.getUint32(t+8,!0),t0:e.getUint32(t+12,!0),n:e.getUint32(t+16,!0),clen:e.getUint32(t+20,!0),ulen:e.getUint32(t+24,!0),codec:i[t+4],crc:e.getUint32(t+28,!0)}}function Ll(i){(i.length<Wh||to(i,0)!=="SSBK")&&jt("bad SSBK magic in block file");let t=eo(i),e=t.getUint16(4,!0);e!==1&&jt(`unsupported block file major version ${e}`),Js(i,0,60)!==t.getUint32(60,!0)&&jt("block file header CRC mismatch");let n=t.getUint32(12,!0);n>4&&jt(`bad item_ndim ${n}`);let s=[],r=1;for(let p=0;p<n;p++)s.push(t.getUint32(16+4*p,!0)),r*=s[p];let o=t.getUint32(32,!0),a=t.getUint32(36,!0),l=t.getUint32(40,!0),c=t.getUint32(44,!0),u=Number(t.getBigUint64(48,!0)),f=t.getUint32(56,!0);u===0&&jt("unfinished block file (dir_offset = 0); recover or finalize it with the simscope library first"),(f!==32*c||u<Wh||u+f>i.length)&&jt("bad block directory");let h=new Array(c);for(let p=0;p<c;p++){let g=u+32*p;h[p]={offset:Number(t.getBigUint64(g,!0)),env:t.getUint32(g+8,!0),t0:t.getUint32(g+12,!0),n:t.getUint32(g+16,!0),clen:t.getUint32(g+20,!0),ulen:t.getUint32(g+24,!0),codec:i[g+28]}}return{bytes:i,itemShape:s,itemK:r,nEnvs:o,nFrames:a,blockFrames:l,blocks:h}}function Ul(i){let t=[];for(let e of i.blocks){e.env>=i.nEnvs&&jt(`block env ${e.env} out of range`);let n=Math.floor(e.t0/i.blockFrames);(t[n]||(t[n]=new Array(i.nEnvs)))[e.env]=e}return t}function Mp(i,t,e){let n=t*e,s=new Uint32Array(n),r=i.subarray(0,n),o=i.subarray(n,2*n),a=i.subarray(2*n,3*n),l=i.subarray(3*n,4*n);for(let c=0;c<t;c++){let u=0,f=c*e;for(let h=0;h<e;h++){let p=f+h;u=u+((r[p]|o[p]<<8|a[p]<<16|l[p]<<24)>>>0)>>>0,s[h*t+c]=u}}return new Float32Array(s.buffer)}function Sp(i,t,e){let n=Pi(i,0,t),s=Pi(i,4*t,t),r=t*e,o=i.subarray(8*t,8*t+r),a=i.subarray(8*t+r,8*t+2*r),l=new Float32Array(r);for(let c=0;c<t;c++){let u=0,f=c*e,h=n[c],p=s[c];for(let g=0;g<e;g++){let _=f+g;u=u+(o[_]|a[_]<<8)&65535,l[g*t+c]=Math.fround(h+Math.fround(u*p))}}return l}function $h(i){let t=Math.fround;for(let e=0;e+7<=i.length;e+=7){let n=i[e+3],s=i[e+4],r=i[e+5],o=i[e+6],a=t(Math.sqrt(t(t(t(t(n*n)+t(s*s))+t(r*r))+t(o*o))));a>0&&(i[e+3]=n/a,i[e+4]=s/a,i[e+5]=r/a,i[e+6]=o/a)}}async function Qs(i,t,e={}){let{bytes:n,itemK:s}=i,r=t.offset;(r+Xh>n.length||to(n,r)!=="SSBB")&&jt(`bad SSBB magic at offset ${r}`);let o=vp(n,r);o.codec!==qh&&o.codec!==yp&&jt(`unknown block codec ${o.codec}`);let a=r+Xh;a+o.clen>n.length&&jt(`block at offset ${r} is truncated`);let l=n.subarray(a,a+o.clen);if(Js(l)!==o.crc&&jt(`block CRC mismatch at offset ${r}`),o.codec===qh)return o.ulen!==4*s*o.n&&jt(`block ulen ${o.ulen} does not match f32s layout (${4*s*o.n})`),Mp(await Rl(l,o.ulen,"block"),s,o.n);let c=8*s+2*s*o.n;o.ulen!==c&&jt(`block ulen ${o.ulen} does not match q16d layout (${c})`);let u=await Rl(l,c,"block"),f=Sp(u,s,o.n);return e.pose&&$h(f),f}async function bp(i,t,e={}){let n=new Float32Array(i.nFrames*i.itemK),s=i.blocks.filter(o=>o.env===t),r=await Promise.all(s.map(o=>Qs(i,o,e)));return s.forEach((o,a)=>n.set(r[a],o.t0*i.itemK)),n}function Pl(i,t){let e=new Float32Array(i.length);for(let n=0;n<t.length;n+=3){let s=t[n]*3,r=t[n+1]*3,o=t[n+2]*3,a=i[r]-i[s],l=i[r+1]-i[s+1],c=i[r+2]-i[s+2],u=i[o]-i[s],f=i[o+1]-i[s+1],h=i[o+2]-i[s+2],p=l*h-c*f,g=c*u-a*h,_=a*f-l*u;for(let m of[s,r,o])e[m]+=p,e[m+1]+=g,e[m+2]+=_}for(let n=0;n<e.length;n+=3){let s=Math.hypot(e[n],e[n+1],e[n+2]);s>0?(e[n]/=s,e[n+1]/=s,e[n+2]/=s):e[n+2]=1}return e}function Yh(i,t,e,n,s,r){let o=n*e,a=i.subarray(t,t+o),l=i.subarray(t+o,t+2*o),c=new Float32Array(o);for(let u=0;u<n;u++){let f=0;for(let h=0;h<e;h++){let p=u*e+h;f=f+(a[p]|l[p]<<8)&65535,c[h*n+u]=Math.fround(s[u]+Math.fround(f*r[u]))}}return c}async function Dl(i){(i.length<32||to(i,0)!=="SSMH")&&jt("bad SSMH magic in mesh blob");let t=eo(i),e=t.getUint16(4,!0);e!==1&&jt(`unsupported mesh major version ${e}`);let n=t.getUint32(8,!0),s=t.getUint32(12,!0),r=t.getUint32(16,!0),o=i[20],a=t.getUint32(24,!0),l=i.subarray(32);Js(l)!==t.getUint32(28,!0)&&jt("mesh CRC mismatch"),o!==0&&o!==1&&jt(`unknown mesh codec ${o}`);let c=(r&1)!==0,u=(r&2)!==0,f=await Rl(l,a,"mesh");if(o===0){let S=0,C=P=>{let D=Pi(f,S,P);return S+=4*P,D},v=C(3*n),T=new Uint32Array(f.slice(S,S+12*s).buffer);S+=12*s;let R=c?C(3*n):Pl(v,T),A=u?C(2*n):null;return{verts:v,faces:T,normals:R,uvs:A,nVerts:n,nFaces:s}}c&&jt("q16 mesh must not have the normals flag");let h=f,p=Pi(h,0,3),g=Pi(h,12,3),_=Yh(h,24,n,3,p,g),m=24+6*n,d=3*s,M=new Uint32Array(d),E=[0,1,2,3].map(S=>h.subarray(m+S*d,m+(S+1)*d)),y=0;for(let S=0;S<d;S++)y=y+((E[0][S]|E[1][S]<<8|E[2][S]<<16|E[3][S]<<24)>>>0)>>>0,M[S]=y;m+=4*d;let b=null;if(u){let S=Pi(h,m,2),C=Pi(h,m+8,2);b=Yh(h,m+16,n,2,S,C)}return{verts:_,faces:M,normals:Pl(_,M),uvs:b,nVerts:n,nFaces:s}}function Ii(i,t){try{return JSON.parse(Zh.decode(i))}catch(e){return jt(`${t} is not valid JSON (${e.message})`)}}function tr(i,t,e){let n=i&&i.format,s=typeof n=="string"?/^([a-z-]+)\/(\d+)$/.exec(n):null;(!s||s[1]!==t)&&jt(`${e}: expected format "${t}/1", got ${JSON.stringify(n)}`),Number(s[2])!==1&&jt(`${e}: unsupported major version ${s[2]}`)}var er=class{constructor(){this.period=0,this.owed=0}reset(){this.owed=0}step(t){if(!(t>0))return 0;t=Math.min(t,.25),this.period?t>.4*this.period&&t<2.5*this.period&&(this.period+=.1*(t-this.period)):this.period=t;let e=Math.min(this.period+.15*this.owed,.25);return this.owed=Math.min(Math.max(this.owed+t-e,-.25),.25),e}},Li=class extends EventTarget{constructor(){super(),this._time=0,this._playing=!1,this._speed=1,this._loop=!1,this._region=null,this._explicit=0,this._claims=new Map,this._holds=new Set,this._duration=0,this._pad=0,this._last=0,this._timer=new er,this._live=!1}get time(){return this._time}get duration(){return this._duration}get playing(){return this._playing}get speed(){return this._speed}set speed(t){let e=Number(t);Number.isFinite(e)&&e>0&&(this._speed=Math.min(Math.max(e,.01),32)),this._emit("state")}get loop(){return this._loop}set loop(t){this._loop=!!t,this._emit("state")}get loopRegion(){return this._region}set loopRegion(t){let e=Array.isArray(t)&&t.length===2&&t[1]>t[0];this._region=e?[Math.max(0,t[0]),Math.min(t[1],this._duration||t[1])]:null,this._emit("state")}play(){if(this._duration<=0)return;let t=this._region?this._region[1]:this._duration;!this._loop&&this._time>=t-1e-6&&(this._time=this._region?this._region[0]:0),this._playing=!0,this._last=0,this._timer.reset(),this._emit("state"),this._emit("time")}pause(){this._playing&&(this._playing=!1,this._emit("state"))}toggle(){this._playing?this.pause():this.play()}seek(t){let e=Math.min(Math.max(Number(t)||0,0),this._duration);this._time=e,this._last=0,this._timer.reset(),this._emit("time")}step(t,e){e>0&&this.seek((Math.round(this._time/e+1e-6)+t)*e)}setDuration(t){this._explicit=Math.max(0,Number(t)||0),this._recount()}claim(t,e,n=0,s=!1){this._claims.set(t,{seconds:Math.max(0,e),pad:Math.max(0,n),live:!!s}),this._recount()}release(t){this._claims.delete(t),this._holds.delete(t),this._recount()}hold(t,e){e?this._holds.add(t):this._holds.delete(t)}rebase(){this._last=0,this._timer.reset()}tick(t){let e=this._last;if(this._last=t,!this._playing)return;if(this._duration<=0){this._timer.reset();return}if(this._holds.size){this._timer.reset();return}let n=this._timer.step(e?Math.max((t-e)/1e3,0):0);if(n===0)return;let s=this._time+n*this._speed,r=this._region;if(r&&s>=r[1]-1e-6)if(this._loop)s=r[0]+(s-r[0])%(r[1]-r[0]);else return this._finish(r[1]);else if(s>this._duration+(this._loop?this._pad:0)-1e-6)if(this._loop)s%=this._duration+this._pad;else if(this._live){this._time<this._duration&&(this._time=this._duration,this._emit("time"));return}else return this._finish(this._duration);this._time=s,this._emit("time")}_finish(t){this._time=t,this._playing=!1,this._emit("time"),this._emit("state"),this._emit("ended")}_recount(){let t=this._explicit,e=0,n=!1;for(let s of this._claims.values())t=Math.max(t,s.seconds),e=Math.max(e,s.pad),n=n||s.live;this._pad=e,this._live=n,t!==this._duration&&(this._duration=t,this._time>t&&(this._time=t),this._region&&this._region[1]>t&&(this._region=t>this._region[0]?[this._region[0],t]:null)),this._emit("state")}_emit(t){this.dispatchEvent(t==="time"?new CustomEvent("time",{detail:{t:this._time}}):new CustomEvent(t))}},Kh=new Map;function Qi(i){let t=Kh.get(i);return t||Kh.set(i,t=new Li),t}function wp(i){let t={players:i,zc:null,pending:!1,fitted:!1,members:()=>i.filter(e=>e.linked===t),loaded:()=>t.members().filter(e=>e.info()),z(){if(t.zc!==null)return t.zc;for(let e of i){if(e.linked!==t)continue;let n=e.standingHeight();if(n!==null)return n}return null},clearPan(){for(let e of t.members())e._zeroPan(!1)},setView(e,n){for(let s of t.members())s._setView(e,n);t.zc!==null&&!t.zoomed()&&t.trajectory(n.animate!==!1)},zoomed:()=>t.members().some(e=>e.rig.userZoomed),playing:()=>t.members().some(e=>e.clock.playing),trajectory(e){let n=t.loaded(),s=n.map(l=>l._extent());if(!n.length||s.some(l=>l===void 0))return!1;let r=s.filter(Boolean);if(!r.length)return!1;let o=(Math.min(...r.map(l=>l.zlo))+Math.max(...r.map(l=>l.zhi)))/2,a=0;n.forEach((l,c)=>{a=Math.max(a,s[c]?l._fitHeight(o):l.rig.targetHeight)}),t.zc=o,t.fitted=!0;for(let l of n)l._fitVertical(o,a,e);return!0},arrived(){t.loaded().some(n=>n._extent()===void 0)||(t.playing()&&t.fitted?t.pending=!0:t.zoomed()||t.trajectory(!0))},flush(){!t.pending||t.playing()||(t.pending=!1,t.zoomed()||t.trajectory(!0))},frame(e,n){let s=n.animate!==!1,r=t.loaded(),o=r.map(l=>l._frameTarget(e,s));if(e!=="all"&&t.trajectory(s))return;t.zc=null,r.forEach((l,c)=>l._fitFrame(e,o[c],s));let a=Math.max(...r.map(l=>l.rig.targetHeight));for(let l of r)l.rig.setHeight(a,s)},refit(){let e=t.loaded();if(!e.length)return;t.zc=null,t.pending=!1,t.fitted=!1;let n=e[0].rig.state(!1);for(let s of e)s.rig.setAngles(n,!1);t.frame("focus",{animate:!1})}};return t}function so(i,{alignGround:t=!0}={}){let e=t?wp(i):null,n=i.map(s=>{let r=a=>{for(let l of i)l!==s&&l.setCameraState(a.detail,{animate:!1})};if(s.addEventListener("camera",r),!e)return()=>s.removeEventListener("camera",r);let o=()=>e.refit();return s.addEventListener("loaded",o),s.linked=e,()=>{s.removeEventListener("camera",r),s.removeEventListener("loaded",o),s.linked===e&&(s.linked=null,s._autoFit())}});return e&&e.refit(),()=>n.forEach(s=>s())}var nr=new Set,Jh=new er,ts=0,ro=0;function ii(){!ts&&nr.size&&typeof requestAnimationFrame=="function"&&(ts=requestAnimationFrame(tu))}function jh(i){nr.add(i),ii()}function Qh(i){nr.delete(i)}function tu(i){ts=0;let t=Jh.step(ro?Math.max((i-ro)/1e3,0):0);ro=i;let e=new Set;for(let s of nr)e.add(s.clock);for(let s of e)s.tick(i);let n=!1;for(let s of nr){if(!s.visible)continue;(s.update(t,i)||s.dirty)&&s.renderer.draw(s),s.needsFrame()&&(n=!0)}if(n)ii();else{ro=0,Jh.reset();for(let s of e)s.rebase()}}function eu(){ii()}function nu(i){ts&&typeof cancelAnimationFrame=="function"&&cancelAnimationFrame(ts),ts=0,tu(i)}var Uu=0,uc=1,Du=2;var Lr=1,Ou=2,Rs=3,_i=0,qe=1,hn=2,Un=0,Ps=1,dc=2,fc=3,pc=4,Nu=5;var Vi=100,Fu=101,Bu=102,ku=103,zu=104,Vu=200,Hu=201,Gu=202,Wu=203,mc=204,gc=205,Xu=206,qu=207,Yu=208,Zu=209,$u=210,Ku=211,Ju=212,ju=213,Qu=214,Io=0,Lo=1,Uo=2,_s=3,Do=4,Oo=5,No=6,Fo=7,_c=0,td=1,ed=2,Mn=0,xc=1,yc=2,vc=3,Mc=4,Sc=5,bc=6,wc=7;var Ec=300,xi=301,Hi=302,ca=303,ha=304,Ur=306,xs=1e3,Rn=1001,Bo=1002,Ie=1003,nd=1004;var Dr=1005;var Le=1006,ua=1007;var yi=1008;var Ke=1009,Tc=1010,Ac=1011,Is=1012,da=1013,Sn=1014,un=1015,bn=1016,fa=1017,pa=1018,Ls=1020,Cc=35902,Rc=35899,Pc=1021,Ic=1022,dn=1023,Pn=1026,vi=1027,ma=1028,ga=1029,Mi=1030,_a=1031;var xa=1033,Or=33776,Nr=33777,Fr=33778,Br=33779,ya=35840,va=35841,Ma=35842,Sa=35843,ba=36196,wa=37492,Ea=37496,Ta=37488,Aa=37489,kr=37490,Ca=37491,Ra=37808,Pa=37809,Ia=37810,La=37811,Ua=37812,Da=37813,Oa=37814,Na=37815,Fa=37816,Ba=37817,ka=37818,za=37819,Va=37820,Ha=37821,Ga=36492,Wa=36494,Xa=36495,qa=36283,Ya=36284,zr=36285,Za=36286;var dr=2300,ko=2301,Ro=2302,ic=2303,sc=2400,rc=2401,oc=2402;var id=3200;var $a=0,sd=1,Kn="",ge="srgb",fr="srgb-linear",pr="linear",ee="srgb";var Po=7680;var rd=519,od=512,ad=513,ld=514,Ka=515,cd=516,hd=517,Ja=518,ud=519,dd=35044,Si=35048;var Lc="300 es",xn=2e3,ys=2001;function Ep(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function Tp(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function mr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function fd(){let i=mr("canvas");return i.style.display="block",i}var iu={},vs=null;function Uc(...i){let t="THREE."+i.shift();vs?vs("log",t,...i):console.log(t,...i)}function pd(i){let t=i[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=i[1];e&&e.isStackTrace?i[0]+=" "+e.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Lt(...i){i=pd(i);let t="THREE."+i.shift();if(vs)vs("warn",t,...i);else{let e=i[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...i)}}function Ot(...i){i=pd(i);let t="THREE."+i.shift();if(vs)vs("error",t,...i);else{let e=i[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...i)}}function Fi(...i){let t=i.join(" ");t in iu||(iu[t]=!0,Lt(...i))}function md(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}var gd={[Io]:Lo,[Uo]:No,[Do]:Fo,[_s]:Oo,[Lo]:Io,[No]:Uo,[Fo]:Do,[Oo]:_s},In=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let n=this._listeners;if(n===void 0)return;let s=n[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let n=e[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}},Be=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],su=1234567,hr=Math.PI/180,Ms=180/Math.PI;function Us(){let i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Be[i&255]+Be[i>>8&255]+Be[i>>16&255]+Be[i>>24&255]+"-"+Be[t&255]+Be[t>>8&255]+"-"+Be[t>>16&15|64]+Be[t>>24&255]+"-"+Be[e&63|128]+Be[e>>8&255]+"-"+Be[e>>16&255]+Be[e>>24&255]+Be[n&255]+Be[n>>8&255]+Be[n>>16&255]+Be[n>>24&255]).toLowerCase()}function Wt(i,t,e){return Math.max(t,Math.min(e,i))}function Dc(i,t){return(i%t+t)%t}function Ap(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function Cp(i,t,e){return i!==t?(e-i)/(t-i):0}function ur(i,t,e){return(1-e)*i+e*t}function Rp(i,t,e,n){return ur(i,t,1-Math.exp(-e*n))}function Pp(i,t=1){return t-Math.abs(Dc(i,t*2)-t)}function Ip(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function Lp(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function Up(i,t){return i+Math.floor(Math.random()*(t-i+1))}function Dp(i,t){return i+Math.random()*(t-i)}function Op(i){return i*(.5-Math.random())}function Np(i){i!==void 0&&(su=i);let t=su+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Fp(i){return i*hr}function Bp(i){return i*Ms}function kp(i){return i>0&&Number.isInteger(i)&&2**Math.round(Math.log2(i))===i}function zp(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function Vp(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Hp(i,t,e,n,s){let r=Math.cos,o=Math.sin,a=r(e/2),l=o(e/2),c=r((t+n)/2),u=o((t+n)/2),f=r((t-n)/2),h=o((t-n)/2),p=r((n-t)/2),g=o((n-t)/2);switch(s){case"XYX":i.set(a*u,l*f,l*h,a*c);break;case"YZY":i.set(l*h,a*u,l*f,a*c);break;case"ZXZ":i.set(l*f,l*h,a*u,a*c);break;case"XZX":i.set(a*u,l*g,l*p,a*c);break;case"YXY":i.set(l*p,a*u,l*g,a*c);break;case"ZYZ":i.set(l*g,l*p,a*u,a*c);break;default:Lt("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function ms(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function We(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var bi={DEG2RAD:hr,RAD2DEG:Ms,generateUUID:Us,clamp:Wt,euclideanModulo:Dc,mapLinear:Ap,inverseLerp:Cp,lerp:ur,damp:Rp,pingpong:Pp,smoothstep:Ip,smootherstep:Lp,randInt:Up,randFloat:Dp,randFloatSpread:Op,seededRandom:Np,degToRad:Fp,radToDeg:Bp,isPowerOfTwo:kp,ceilPowerOfTwo:zp,floorPowerOfTwo:Vp,setQuaternionFromProperEuler:Hp,normalize:We,denormalize:ms},Ht=class i{static{i.prototype.isVector2=!0}constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Wt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},en=class{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let l=n[s+0],c=n[s+1],u=n[s+2],f=n[s+3],h=r[o+0],p=r[o+1],g=r[o+2],_=r[o+3];if(f!==_||l!==h||c!==p||u!==g){let m=l*h+c*p+u*g+f*_;m<0&&(h=-h,p=-p,g=-g,_=-_,m=-m);let d=1-a;if(m<.9995){let M=Math.acos(m),E=Math.sin(M);d=Math.sin(d*M)/E,a=Math.sin(a*M)/E,l=l*d+h*a,c=c*d+p*a,u=u*d+g*a,f=f*d+_*a}else{l=l*d+h*a,c=c*d+p*a,u=u*d+g*a,f=f*d+_*a;let M=1/Math.sqrt(l*l+c*c+u*u+f*f);l*=M,c*=M,u*=M,f*=M}}t[e]=l,t[e+1]=c,t[e+2]=u,t[e+3]=f}static multiplyQuaternionsFlat(t,e,n,s,r,o){let a=n[s],l=n[s+1],c=n[s+2],u=n[s+3],f=r[o],h=r[o+1],p=r[o+2],g=r[o+3];return t[e]=a*g+u*f+l*p-c*h,t[e+1]=l*g+u*h+c*f-a*p,t[e+2]=c*g+u*p+a*h-l*f,t[e+3]=u*g-a*f-l*h-c*p,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(n/2),u=a(s/2),f=a(r/2),h=l(n/2),p=l(s/2),g=l(r/2);switch(o){case"XYZ":this._x=h*u*f+c*p*g,this._y=c*p*f-h*u*g,this._z=c*u*g+h*p*f,this._w=c*u*f-h*p*g;break;case"YXZ":this._x=h*u*f+c*p*g,this._y=c*p*f-h*u*g,this._z=c*u*g-h*p*f,this._w=c*u*f+h*p*g;break;case"ZXY":this._x=h*u*f-c*p*g,this._y=c*p*f+h*u*g,this._z=c*u*g+h*p*f,this._w=c*u*f-h*p*g;break;case"ZYX":this._x=h*u*f-c*p*g,this._y=c*p*f+h*u*g,this._z=c*u*g-h*p*f,this._w=c*u*f+h*p*g;break;case"YZX":this._x=h*u*f+c*p*g,this._y=c*p*f+h*u*g,this._z=c*u*g-h*p*f,this._w=c*u*f-h*p*g;break;case"XZY":this._x=h*u*f-c*p*g,this._y=c*p*f-h*u*g,this._z=c*u*g+h*p*f,this._w=c*u*f+h*p*g;break;default:Lt("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],u=e[6],f=e[10],h=n+a+f;if(h>0){let p=.5/Math.sqrt(h+1);this._w=.25/p,this._x=(u-l)*p,this._y=(r-c)*p,this._z=(o-s)*p}else if(n>a&&n>f){let p=2*Math.sqrt(1+n-a-f);this._w=(u-l)/p,this._x=.25*p,this._y=(s+o)/p,this._z=(r+c)/p}else if(a>f){let p=2*Math.sqrt(1+a-n-f);this._w=(r-c)/p,this._x=(s+o)/p,this._y=.25*p,this._z=(l+u)/p}else{let p=2*Math.sqrt(1+f-n-a);this._w=(o-s)/p,this._x=(r+c)/p,this._y=(l+u)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Wt(this.dot(t),-1,1)))}rotateTowards(t,e){let n=this.angleTo(t);if(n===0)return this;let s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,u=e._w;return this._x=n*u+o*a+s*c-r*l,this._y=s*u+o*l+r*a-n*c,this._z=r*u+o*c+n*l-s*a,this._w=o*u-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let n=t._x,s=t._y,r=t._z,o=t._w,a=this.dot(t);a<0&&(n=-n,s=-s,r=-r,o=-o,a=-a);let l=1-e;if(a<.9995){let c=Math.acos(a),u=Math.sin(c);l=Math.sin(l*c)/u,e=Math.sin(e*c)/u,this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this._onChangeCallback()}else this._x=this._x*l+n*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this.normalize();return this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},z=class i{static{i.prototype.isVector3=!0}constructor(t=0,e=0,n=0){this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(ru.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(ru.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){let e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*s-a*n),u=2*(a*e-r*s),f=2*(r*n-o*e);return this.x=e+l*c+o*f-a*u,this.y=n+l*u+a*c-r*f,this.z=s+l*f+r*u-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this.z=Wt(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this.z=Wt(this.z,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Ol.copy(this).projectOnVector(t),this.sub(Ol)}reflect(t){return this.sub(Ol.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let n=this.dot(t)/e;return Math.acos(Wt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){let s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Ol=new z,ru=new en,Ft=class i{static{i.prototype.isMatrix3=!0}constructor(t,e,n,s,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c)}set(t,e,n,s,r,o,a,l,c){let u=this.elements;return u[0]=t,u[1]=s,u[2]=a,u[3]=e,u[4]=r,u[5]=l,u[6]=n,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],u=n[4],f=n[7],h=n[2],p=n[5],g=n[8],_=s[0],m=s[3],d=s[6],M=s[1],E=s[4],y=s[7],b=s[2],S=s[5],C=s[8];return r[0]=o*_+a*M+l*b,r[3]=o*m+a*E+l*S,r[6]=o*d+a*y+l*C,r[1]=c*_+u*M+f*b,r[4]=c*m+u*E+f*S,r[7]=c*d+u*y+f*C,r[2]=h*_+p*M+g*b,r[5]=h*m+p*E+g*S,r[8]=h*d+p*y+g*C,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8];return e*o*u-e*a*c-n*r*u+n*a*l+s*r*c-s*o*l}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8],f=u*o-a*c,h=a*l-u*r,p=c*r-o*l,g=e*f+n*h+s*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/g;return t[0]=f*_,t[1]=(s*c-u*n)*_,t[2]=(a*n-s*o)*_,t[3]=h*_,t[4]=(u*e-s*l)*_,t[5]=(s*r-a*e)*_,t[6]=p*_,t[7]=(n*l-c*e)*_,t[8]=(o*e-n*r)*_,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+t,-s*c,s*l,-s*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return Fi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Nl.makeScale(t,e)),this}rotate(t){return Fi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Nl.makeRotation(-t)),this}translate(t,e){return Fi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Nl.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}},Nl=new Ft,ou=new Ft().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),au=new Ft().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Gp(){let i={enabled:!0,workingColorSpace:fr,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===ee&&(s.r=qn(s.r),s.g=qn(s.g),s.b=qn(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ee&&(s.r=gs(s.r),s.g=gs(s.g),s.b=gs(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Kn?pr:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Fi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Fi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[fr]:{primaries:t,whitePoint:n,transfer:pr,toXYZ:ou,fromXYZ:au,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:ge},outputColorSpaceConfig:{drawingBufferColorSpace:ge}},[ge]:{primaries:t,whitePoint:n,transfer:ee,toXYZ:ou,fromXYZ:au,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:ge}}}),i}var Zt=Gp();function qn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function gs(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var es,zo=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{es===void 0&&(es=mr("canvas")),es.width=t.width,es.height=t.height;let s=es.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),n=es}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=mr("canvas");e.width=t.width,e.height=t.height;let n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);let s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=qn(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(qn(e[n]/255)*255):e[n]=qn(e[n]);return{data:e,width:t.width,height:t.height}}else return Lt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Wp=0,Ss=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Wp++}),this.uuid=Us(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Fl(s[o].image)):r.push(Fl(s[o]))}else r=Fl(s);n.url=r}return e||(t.images[this.uuid]=n),n}};function Fl(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?zo.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Lt("Texture: Unable to serialize Texture."),{})}var Xp=0,Bl=new z,ze=class i extends In{constructor(t=i.DEFAULT_IMAGE,e=i.DEFAULT_MAPPING,n=Rn,s=Rn,r=Le,o=yi,a=dn,l=Ke,c=i.DEFAULT_ANISOTROPY,u=Kn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Xp++}),this.uuid=Us(),this.name="",this.source=new Ss(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Ht(0,0),this.repeat=new Ht(1,1),this.center=new Ht(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Ft,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Bl).x}get height(){return this.source.getSize(Bl).y}get depth(){return this.source.getSize(Bl).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let n=t[e];if(n===void 0){Lt(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Lt(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Ec)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case xs:t.x=t.x-Math.floor(t.x);break;case Rn:t.x=t.x<0?0:1;break;case Bo:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case xs:t.y=t.y-Math.floor(t.y);break;case Rn:t.y=t.y<0?0:1;break;case Bo:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};ze.DEFAULT_IMAGE=null;ze.DEFAULT_MAPPING=Ec;ze.DEFAULT_ANISOTROPY=1;var he=class i{static{i.prototype.isVector4=!0}constructor(t=0,e=0,n=0,s=1){this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r,l=t.elements,c=l[0],u=l[4],f=l[8],h=l[1],p=l[5],g=l[9],_=l[2],m=l[6],d=l[10];if(Math.abs(u-h)<.01&&Math.abs(f-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(u+h)<.1&&Math.abs(f+_)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+d-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let E=(c+1)/2,y=(p+1)/2,b=(d+1)/2,S=(u+h)/4,C=(f+_)/4,v=(g+m)/4;return E>y&&E>b?E<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(E),s=S/n,r=C/n):y>b?y<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(y),n=S/s,r=v/s):b<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(b),n=C/r,s=v/r),this.set(n,s,r,e),this}let M=Math.sqrt((m-g)*(m-g)+(f-_)*(f-_)+(h-u)*(h-u));return Math.abs(M)<.001&&(M=1),this.x=(m-g)/M,this.y=(f-_)/M,this.z=(h-u)/M,this.w=Math.acos((c+p+d-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this.z=Wt(this.z,t.z,e.z),this.w=Wt(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this.z=Wt(this.z,t,e),this.w=Wt(this.w,t,e),this}clampLength(t,e){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Vo=class extends In{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Le,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new he(0,0,t,e),this.scissorTest=!1,this.viewport=new he(0,0,t,e),this.textures=[];let s={width:t,height:e,depth:n.depth},r=new ze(s),o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Le,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),t!==null&&t.renderTarget===null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new Ss(s)}if(this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveColorBuffer=t.resolveColorBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,this.storeMultisampledColorBuffer=t.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=t.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=t.storeMultisampledStencilBuffer,t.depthTexture!==null)if(t.depthTexture.renderTarget===t){let e=t.depthTexture.clone();e.renderTarget=null,this.depthTexture=e}else this.depthTexture=t.depthTexture;return this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},$e=class extends Vo{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}},gr=class extends ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Ie,this.minFilter=Ie,this.wrapR=Rn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Ho=class extends ze{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=Ie,this.minFilter=Ie,this.wrapR=Rn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}};var ne=class i{static{i.prototype.isMatrix4=!0}constructor(t,e,n,s,r,o,a,l,c,u,f,h,p,g,_,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c,u,f,h,p,g,_,m)}set(t,e,n,s,r,o,a,l,c,u,f,h,p,g,_,m){let d=this.elements;return d[0]=t,d[4]=e,d[8]=n,d[12]=s,d[1]=r,d[5]=o,d[9]=a,d[13]=l,d[2]=c,d[6]=u,d[10]=f,d[14]=h,d[3]=p,d[7]=g,d[11]=_,d[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(t){let e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){let e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),n.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,n=t.elements,s=1/ns.setFromMatrixColumn(t,0).length(),r=1/ns.setFromMatrixColumn(t,1).length(),o=1/ns.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),u=Math.cos(r),f=Math.sin(r);if(t.order==="XYZ"){let h=o*u,p=o*f,g=a*u,_=a*f;e[0]=l*u,e[4]=-l*f,e[8]=c,e[1]=p+g*c,e[5]=h-_*c,e[9]=-a*l,e[2]=_-h*c,e[6]=g+p*c,e[10]=o*l}else if(t.order==="YXZ"){let h=l*u,p=l*f,g=c*u,_=c*f;e[0]=h+_*a,e[4]=g*a-p,e[8]=o*c,e[1]=o*f,e[5]=o*u,e[9]=-a,e[2]=p*a-g,e[6]=_+h*a,e[10]=o*l}else if(t.order==="ZXY"){let h=l*u,p=l*f,g=c*u,_=c*f;e[0]=h-_*a,e[4]=-o*f,e[8]=g+p*a,e[1]=p+g*a,e[5]=o*u,e[9]=_-h*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){let h=o*u,p=o*f,g=a*u,_=a*f;e[0]=l*u,e[4]=g*c-p,e[8]=h*c+_,e[1]=l*f,e[5]=_*c+h,e[9]=p*c-g,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){let h=o*l,p=o*c,g=a*l,_=a*c;e[0]=l*u,e[4]=_-h*f,e[8]=g*f+p,e[1]=f,e[5]=o*u,e[9]=-a*u,e[2]=-c*u,e[6]=p*f+g,e[10]=h-_*f}else if(t.order==="XZY"){let h=o*l,p=o*c,g=a*l,_=a*c;e[0]=l*u,e[4]=-f,e[8]=c*u,e[1]=h*f+_,e[5]=o*u,e[9]=p*f-g,e[2]=g*f-p,e[6]=a*u,e[10]=_*f+h}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(qp,t,Yp)}lookAt(t,e,n){let s=this.elements;return Qe.subVectors(t,e),Qe.lengthSq()===0&&(Qe.z=1),Qe.normalize(),si.crossVectors(n,Qe),si.lengthSq()===0&&(Math.abs(n.z)===1?Qe.x+=1e-4:Qe.z+=1e-4,Qe.normalize(),si.crossVectors(n,Qe)),si.normalize(),oo.crossVectors(Qe,si),s[0]=si.x,s[4]=oo.x,s[8]=Qe.x,s[1]=si.y,s[5]=oo.y,s[9]=Qe.y,s[2]=si.z,s[6]=oo.z,s[10]=Qe.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],u=n[1],f=n[5],h=n[9],p=n[13],g=n[2],_=n[6],m=n[10],d=n[14],M=n[3],E=n[7],y=n[11],b=n[15],S=s[0],C=s[4],v=s[8],T=s[12],R=s[1],A=s[5],P=s[9],D=s[13],L=s[2],F=s[6],U=s[10],O=s[14],q=s[3],H=s[7],j=s[11],it=s[15];return r[0]=o*S+a*R+l*L+c*q,r[4]=o*C+a*A+l*F+c*H,r[8]=o*v+a*P+l*U+c*j,r[12]=o*T+a*D+l*O+c*it,r[1]=u*S+f*R+h*L+p*q,r[5]=u*C+f*A+h*F+p*H,r[9]=u*v+f*P+h*U+p*j,r[13]=u*T+f*D+h*O+p*it,r[2]=g*S+_*R+m*L+d*q,r[6]=g*C+_*A+m*F+d*H,r[10]=g*v+_*P+m*U+d*j,r[14]=g*T+_*D+m*O+d*it,r[3]=M*S+E*R+y*L+b*q,r[7]=M*C+E*A+y*F+b*H,r[11]=M*v+E*P+y*U+b*j,r[15]=M*T+E*D+y*O+b*it,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],u=t[2],f=t[6],h=t[10],p=t[14],g=t[3],_=t[7],m=t[11],d=t[15],M=l*p-c*h,E=a*p-c*f,y=a*h-l*f,b=o*p-c*u,S=o*h-l*u,C=o*f-a*u;return e*(_*M-m*E+d*y)-n*(g*M-m*b+d*S)+s*(g*E-_*b+d*C)-r*(g*y-_*S+m*C)}determinantAffine(){let t=this.elements,e=t[0],n=t[4],s=t[8],r=t[1],o=t[5],a=t[9],l=t[2],c=t[6],u=t[10];return e*(o*u-a*c)-n*(r*u-a*l)+s*(r*c-o*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){let t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8],f=t[9],h=t[10],p=t[11],g=t[12],_=t[13],m=t[14],d=t[15],M=e*a-n*o,E=e*l-s*o,y=e*c-r*o,b=n*l-s*a,S=n*c-r*a,C=s*c-r*l,v=u*_-f*g,T=u*m-h*g,R=u*d-p*g,A=f*m-h*_,P=f*d-p*_,D=h*d-p*m,L=M*D-E*P+y*A+b*R-S*T+C*v;if(L===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let F=1/L;return t[0]=(a*D-l*P+c*A)*F,t[1]=(s*P-n*D-r*A)*F,t[2]=(_*C-m*S+d*b)*F,t[3]=(h*S-f*C-p*b)*F,t[4]=(l*R-o*D-c*T)*F,t[5]=(e*D-s*R+r*T)*F,t[6]=(m*y-g*C-d*E)*F,t[7]=(u*C-h*y+p*E)*F,t[8]=(o*P-a*R+c*v)*F,t[9]=(n*R-e*P-r*v)*F,t[10]=(g*S-_*y+d*M)*F,t[11]=(f*y-u*S-p*M)*F,t[12]=(a*T-o*A-l*v)*F,t[13]=(e*A-n*T+s*v)*F,t[14]=(_*E-g*b-m*M)*F,t[15]=(u*b-f*E+h*M)*F,this}scale(t){let e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,l=t.z,c=r*o,u=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,u*a+n,u*l-s*o,0,c*l-s*a,u*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){let s=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,u=o+o,f=a+a,h=r*c,p=r*u,g=r*f,_=o*u,m=o*f,d=a*f,M=l*c,E=l*u,y=l*f,b=n.x,S=n.y,C=n.z;return s[0]=(1-(_+d))*b,s[1]=(p+y)*b,s[2]=(g-E)*b,s[3]=0,s[4]=(p-y)*S,s[5]=(1-(h+d))*S,s[6]=(m+M)*S,s[7]=0,s[8]=(g+E)*C,s[9]=(m-M)*C,s[10]=(1-(h+_))*C,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),e.identity(),this;let o=ns.set(s[0],s[1],s[2]).length(),a=ns.set(s[4],s[5],s[6]).length(),l=ns.set(s[8],s[9],s[10]).length();r<0&&(o=-o),pn.copy(this);let c=1/o,u=1/a,f=1/l;return pn.elements[0]*=c,pn.elements[1]*=c,pn.elements[2]*=c,pn.elements[4]*=u,pn.elements[5]*=u,pn.elements[6]*=u,pn.elements[8]*=f,pn.elements[9]*=f,pn.elements[10]*=f,e.setFromRotationMatrix(pn),n.x=o,n.y=a,n.z=l,this}makePerspective(t,e,n,s,r,o,a=xn,l=!1){let c=this.elements,u=2*r/(e-t),f=2*r/(n-s),h=(e+t)/(e-t),p=(n+s)/(n-s),g,_;if(l)g=r/(o-r),_=o*r/(o-r);else if(a===xn)g=-(o+r)/(o-r),_=-2*o*r/(o-r);else if(a===ys)g=-o/(o-r),_=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=u,c[4]=0,c[8]=h,c[12]=0,c[1]=0,c[5]=f,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=xn,l=!1){let c=this.elements,u=2/(e-t),f=2/(n-s),h=-(e+t)/(e-t),p=-(n+s)/(n-s),g,_;if(l)g=1/(o-r),_=o/(o-r);else if(a===xn)g=-2/(o-r),_=-(o+r)/(o-r);else if(a===ys)g=-1/(o-r),_=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=u,c[4]=0,c[8]=0,c[12]=h,c[1]=0,c[5]=f,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){let n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}},ns=new z,pn=new ne,qp=new z(0,0,0),Yp=new z(1,1,1),si=new z,oo=new z,Qe=new z,lu=new ne,cu=new en,Yn=class i{constructor(t=0,e=0,n=0,s=i.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){let s=t.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],u=s[9],f=s[2],h=s[6],p=s[10];switch(e){case"XYZ":this._y=Math.asin(Wt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,p),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(h,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Wt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(Wt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-f,p),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Wt(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(h,p),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Wt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,p));break;case"XZY":this._z=Math.asin(-Wt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(h,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-u,p),this._y=0);break;default:Lt("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return lu.makeRotationFromQuaternion(t),this.setFromRotationMatrix(lu,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return cu.setFromEuler(this),this.setFromQuaternion(cu,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Yn.DEFAULT_ORDER="XYZ";var bs=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Zp=0,hu=new z,is=new en,Vn=new ne,ao=new z,ir=new z,$p=new z,Kp=new en,uu=new z(1,0,0),du=new z(0,1,0),fu=new z(0,0,1),pu={type:"added"},Jp={type:"removed"},ss={type:"childadded",child:null},kl={type:"childremoved",child:null},Ue=class i extends In{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Zp++}),this.uuid=Us(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let t=new z,e=new Yn,n=new en,s=new z(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new ne},normalMatrix:{value:new Ft}}),this.matrix=new ne,this.matrixWorld=new ne,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new bs,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return is.setFromAxisAngle(t,e),this.quaternion.multiply(is),this}rotateOnWorldAxis(t,e){return is.setFromAxisAngle(t,e),this.quaternion.premultiply(is),this}rotateX(t){return this.rotateOnAxis(uu,t)}rotateY(t){return this.rotateOnAxis(du,t)}rotateZ(t){return this.rotateOnAxis(fu,t)}translateOnAxis(t,e){return hu.copy(t).applyQuaternion(this.quaternion),this.position.add(hu.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(uu,t)}translateY(t){return this.translateOnAxis(du,t)}translateZ(t){return this.translateOnAxis(fu,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Vn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?ao.copy(t):ao.set(t,e,n);let s=this.parent;this.updateWorldMatrix(!0,!1),ir.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Vn.lookAt(ir,ao,this.up):Vn.lookAt(ao,ir,this.up),this.quaternion.setFromRotationMatrix(Vn),s&&(Vn.extractRotation(s.matrixWorld),is.setFromRotationMatrix(Vn),this.quaternion.premultiply(is.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(Ot("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(pu),ss.child=t,this.dispatchEvent(ss),ss.child=null):Ot("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Jp),kl.child=t,this.dispatchEvent(kl),kl.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Vn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Vn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Vn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(pu),ss.child=t,this.dispatchEvent(ss),ss.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){let o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,t,$p),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,Kp,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(t){t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,n=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*n-r[8]*s,r[13]+=n-r[1]*e-r[5]*n-r[9]*s,r[14]+=s-r[2]*e-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e,n=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),e===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,n)}}toJSON(t){let e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){let f=l[c];r(t.shapes,f)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];s.animations.push(r(t.animations,l))}}if(e){let a=o(t.geometries),l=o(t.materials),c=o(t.textures),u=o(t.images),f=o(t.shapes),h=o(t.skeletons),p=o(t.animations),g=o(t.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),u.length>0&&(n.images=u),f.length>0&&(n.shapes=f),h.length>0&&(n.skeletons=h),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=s,n;function o(a){let l=[];for(let c in a){let u=a[c];delete u.metadata,l.push(u)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){let s=t.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Ue.DEFAULT_UP=new z(0,1,0);Ue.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ue.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var ln=class extends Ue{constructor(){super(),this.isGroup=!0,this.type="Group"}},jp={type:"move"},ws=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ln,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ln,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new z,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new z),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ln,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new z,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new z,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(let _ of t.hand.values()){let m=e.getJointPose(_,n),d=this._getHandJoint(c,_);m!==null&&(d.matrix.fromArray(m.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,d.jointRadius=m.radius),d.visible=m!==null}let u=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],h=u.position.distanceTo(f.position),p=.02,g=.005;c.inputState.pinching&&h>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&h<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(jp)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let n=new ln;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}},_d={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ri={h:0,s:0,l:0},lo={h:0,s:0,l:0};function zl(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}var Ut=class{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=ge){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Zt.colorSpaceToWorking(this,e),this}setRGB(t,e,n,s=Zt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Zt.colorSpaceToWorking(this,s),this}setHSL(t,e,n,s=Zt.workingColorSpace){if(t=Dc(t,1),e=Wt(e,0,1),n=Wt(n,0,1),e===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=zl(o,r,t+1/3),this.g=zl(o,r,t),this.b=zl(o,r,t-1/3)}return Zt.colorSpaceToWorking(this,s),this}setStyle(t,e=ge){function n(r){r!==void 0&&parseFloat(r)<1&&Lt("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Lt("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);Lt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=ge){let n=_d[t.toLowerCase()];return n!==void 0?this.setHex(n,e):Lt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=qn(t.r),this.g=qn(t.g),this.b=qn(t.b),this}copyLinearToSRGB(t){return this.r=gs(t.r),this.g=gs(t.g),this.b=gs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=ge){return Zt.workingToColorSpace(ke.copy(this),t),Math.round(Wt(ke.r*255,0,255))*65536+Math.round(Wt(ke.g*255,0,255))*256+Math.round(Wt(ke.b*255,0,255))}getHexString(t=ge){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Zt.workingColorSpace){Zt.workingToColorSpace(ke.copy(this),e);let n=ke.r,s=ke.g,r=ke.b,o=Math.max(n,s,r),a=Math.min(n,s,r),l,c,u=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=u<=.5?f/(o+a):f/(2-o-a),o){case n:l=(s-r)/f+(s<r?6:0);break;case s:l=(r-n)/f+2;break;case r:l=(n-s)/f+4;break}l/=6}return t.h=l,t.s=c,t.l=u,t}getRGB(t,e=Zt.workingColorSpace){return Zt.workingToColorSpace(ke.copy(this),e),t.r=ke.r,t.g=ke.g,t.b=ke.b,t}getStyle(t=ge){Zt.workingToColorSpace(ke.copy(this),t);let e=ke.r,n=ke.g,s=ke.b;return t!==ge?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(ri),this.setHSL(ri.h+t,ri.s+e,ri.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(ri),t.getHSL(lo);let n=ur(ri.h,lo.h,e),s=ur(ri.s,lo.s,e),r=ur(ri.l,lo.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},ke=new Ut;Ut.NAMES=_d;var _r=class extends Ue{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Yn,this.environmentIntensity=1,this.environmentRotation=new Yn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),e.object.backgroundBlurriness=this.backgroundBlurriness,e.object.backgroundIntensity=this.backgroundIntensity,e.object.backgroundRotation=this.backgroundRotation.toArray(),e.object.environmentIntensity=this.environmentIntensity,e.object.environmentRotation=this.environmentRotation.toArray(),e}},mn=new z,Hn=new z,Vl=new z,Gn=new z,rs=new z,os=new z,mu=new z,Hl=new z,Gl=new z,Wl=new z,Xl=new he,ql=new he,Yl=new he,ci=class i{constructor(t=new z,e=new z,n=new z){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),mn.subVectors(t,e),s.cross(mn);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){mn.subVectors(s,e),Hn.subVectors(n,e),Vl.subVectors(t,e);let o=mn.dot(mn),a=mn.dot(Hn),l=mn.dot(Vl),c=Hn.dot(Hn),u=Hn.dot(Vl),f=o*c-a*a;if(f===0)return r.set(0,0,0),null;let h=1/f,p=(c*l-a*u)*h,g=(o*u-a*l)*h;return r.set(1-p-g,g,p)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Gn)===null?!1:Gn.x>=0&&Gn.y>=0&&Gn.x+Gn.y<=1}static getInterpolation(t,e,n,s,r,o,a,l){return this.getBarycoord(t,e,n,s,Gn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Gn.x),l.addScaledVector(o,Gn.y),l.addScaledVector(a,Gn.z),l)}static getInterpolatedAttribute(t,e,n,s,r,o){return Xl.setScalar(0),ql.setScalar(0),Yl.setScalar(0),Xl.fromBufferAttribute(t,e),ql.fromBufferAttribute(t,n),Yl.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(Xl,r.x),o.addScaledVector(ql,r.y),o.addScaledVector(Yl,r.z),o}static isFrontFacing(t,e,n,s){return mn.subVectors(n,e),Hn.subVectors(t,e),mn.cross(Hn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return mn.subVectors(this.c,this.b),Hn.subVectors(this.a,this.b),mn.cross(Hn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return i.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return i.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return i.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return i.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return i.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let n=this.a,s=this.b,r=this.c,o,a;rs.subVectors(s,n),os.subVectors(r,n),Hl.subVectors(t,n);let l=rs.dot(Hl),c=os.dot(Hl);if(l<=0&&c<=0)return e.copy(n);Gl.subVectors(t,s);let u=rs.dot(Gl),f=os.dot(Gl);if(u>=0&&f<=u)return e.copy(s);let h=l*f-u*c;if(h<=0&&l>=0&&u<=0)return o=l/(l-u),e.copy(n).addScaledVector(rs,o);Wl.subVectors(t,r);let p=rs.dot(Wl),g=os.dot(Wl);if(g>=0&&p<=g)return e.copy(r);let _=p*c-l*g;if(_<=0&&c>=0&&g<=0)return a=c/(c-g),e.copy(n).addScaledVector(os,a);let m=u*g-p*f;if(m<=0&&f-u>=0&&p-g>=0)return mu.subVectors(r,s),a=(f-u)/(f-u+(p-g)),e.copy(s).addScaledVector(mu,a);let d=1/(m+_+h);return o=_*d,a=h*d,e.copy(n).addScaledVector(rs,o).addScaledVector(os,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},cn=class{constructor(t=new z(1/0,1/0,1/0),e=new z(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(gn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(gn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let n=gn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let n=t.geometry;if(n!==void 0){let r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,gn):gn.fromBufferAttribute(r,o),gn.applyMatrix4(t.matrixWorld),this.expandByPoint(gn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),co.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),co.copy(n.boundingBox)),co.applyMatrix4(t.matrixWorld),this.union(co)}let s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,gn),gn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(sr),ho.subVectors(this.max,sr),as.subVectors(t.a,sr),ls.subVectors(t.b,sr),cs.subVectors(t.c,sr),oi.subVectors(ls,as),ai.subVectors(cs,ls),Ui.subVectors(as,cs);let e=[0,-oi.z,oi.y,0,-ai.z,ai.y,0,-Ui.z,Ui.y,oi.z,0,-oi.x,ai.z,0,-ai.x,Ui.z,0,-Ui.x,-oi.y,oi.x,0,-ai.y,ai.x,0,-Ui.y,Ui.x,0];return!Zl(e,as,ls,cs,ho)||(e=[1,0,0,0,1,0,0,0,1],!Zl(e,as,ls,cs,ho))?!1:(uo.crossVectors(oi,ai),e=[uo.x,uo.y,uo.z],Zl(e,as,ls,cs,ho))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,gn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(gn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Wn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Wn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Wn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Wn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Wn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Wn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Wn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Wn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Wn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Wn=[new z,new z,new z,new z,new z,new z,new z,new z],gn=new z,co=new cn,as=new z,ls=new z,cs=new z,oi=new z,ai=new z,Ui=new z,sr=new z,ho=new z,uo=new z,Di=new z;function Zl(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){Di.fromArray(i,r);let a=s.x*Math.abs(Di.x)+s.y*Math.abs(Di.y)+s.z*Math.abs(Di.z),l=t.dot(Di),c=e.dot(Di),u=n.dot(Di);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}var be=new z,fo=new Ht,Qp=0,we=class extends In{constructor(t,e,n=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Qp++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=dd,this.updateRanges=[],this.gpuType=un,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)fo.fromBufferAttribute(this,e),fo.applyMatrix3(t),this.setXY(e,fo.x,fo.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.applyMatrix3(t),this.setXYZ(e,be.x,be.y,be.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.applyMatrix4(t),this.setXYZ(e,be.x,be.y,be.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.applyNormalMatrix(t),this.setXYZ(e,be.x,be.y,be.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)be.fromBufferAttribute(this,e),be.transformDirection(t),this.setXYZ(e,be.x,be.y,be.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=ms(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=We(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=ms(e,this.array)),e}setX(t,e){return this.normalized&&(e=We(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=ms(e,this.array)),e}setY(t,e){return this.normalized&&(e=We(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=ms(e,this.array)),e}setZ(t,e){return this.normalized&&(e=We(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=ms(e,this.array)),e}setW(t,e){return this.normalized&&(e=We(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=We(e,this.array),n=We(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=We(e,this.array),n=We(n,this.array),s=We(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=We(e,this.array),n=We(n,this.array),s=We(s,this.array),r=We(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}};var xr=class extends we{constructor(t,e,n){super(new Uint16Array(t),e,n)}};var yr=class extends we{constructor(t,e,n){super(new Uint32Array(t),e,n)}};var pe=class extends we{constructor(t,e,n){super(new Float32Array(t),e,n)}},tm=new cn,rr=new z,$l=new z,yn=class{constructor(t=new z,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let n=this.center;e!==void 0?n.copy(e):tm.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;rr.subVectors(t,this.center);let e=rr.lengthSq();if(e>this.radius*this.radius){let n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(rr,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):($l.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(rr.copy(t.center).add($l)),this.expandByPoint(rr.copy(t.center).sub($l))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},em=0,an=new ne,Kl=new Ue,hs=new z,tn=new cn,or=new cn,Pe=new z,Ee=class i extends In{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:em++}),this.uuid=Us(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Ep(t)?yr:xr)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Ft().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return an.makeRotationFromQuaternion(t),this.applyMatrix4(an),this}rotateX(t){return an.makeRotationX(t),this.applyMatrix4(an),this}rotateY(t){return an.makeRotationY(t),this.applyMatrix4(an),this}rotateZ(t){return an.makeRotationZ(t),this.applyMatrix4(an),this}translate(t,e,n){return an.makeTranslation(t,e,n),this.applyMatrix4(an),this}scale(t,e,n){return an.makeScale(t,e,n),this.applyMatrix4(an),this}lookAt(t){return Kl.lookAt(t),Kl.updateMatrix(),this.applyMatrix4(Kl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(hs).negate(),this.translate(hs.x,hs.y,hs.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let n=[];for(let s=0,r=t.length;s<r;s++){let o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new pe(n,3))}else{let n=Math.min(t.length,e.count);for(let s=0;s<n;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&Lt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new cn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ot("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new z(-1/0,-1/0,-1/0),new z(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){let r=e[n];tn.setFromBufferAttribute(r),this.morphTargetsRelative?(Pe.addVectors(this.boundingBox.min,tn.min),this.boundingBox.expandByPoint(Pe),Pe.addVectors(this.boundingBox.max,tn.max),this.boundingBox.expandByPoint(Pe)):(this.boundingBox.expandByPoint(tn.min),this.boundingBox.expandByPoint(tn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ot('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new yn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Ot("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new z,1/0);return}if(t){let n=this.boundingSphere.center;if(tn.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){let a=e[r];or.setFromBufferAttribute(a),this.morphTargetsRelative?(Pe.addVectors(tn.min,or.min),tn.expandByPoint(Pe),Pe.addVectors(tn.max,or.max),tn.expandByPoint(Pe)):(tn.expandByPoint(or.min),tn.expandByPoint(or.max))}tn.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)Pe.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Pe));if(e)for(let r=0,o=e.length;r<o;r++){let a=e[r],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)Pe.fromBufferAttribute(a,c),l&&(hs.fromBufferAttribute(t,c),Pe.add(hs)),s=Math.max(s,n.distanceToSquared(Pe))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Ot('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){Ot("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=e.position,s=e.normal,r=e.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new we(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let v=0;v<n.count;v++)a[v]=new z,l[v]=new z;let c=new z,u=new z,f=new z,h=new Ht,p=new Ht,g=new Ht,_=new z,m=new z;function d(v,T,R){c.fromBufferAttribute(n,v),u.fromBufferAttribute(n,T),f.fromBufferAttribute(n,R),h.fromBufferAttribute(r,v),p.fromBufferAttribute(r,T),g.fromBufferAttribute(r,R),u.sub(c),f.sub(c),p.sub(h),g.sub(h);let A=1/(p.x*g.y-g.x*p.y);isFinite(A)&&(_.copy(u).multiplyScalar(g.y).addScaledVector(f,-p.y).multiplyScalar(A),m.copy(f).multiplyScalar(p.x).addScaledVector(u,-g.x).multiplyScalar(A),a[v].add(_),a[T].add(_),a[R].add(_),l[v].add(m),l[T].add(m),l[R].add(m))}let M=this.groups;M.length===0&&(M=[{start:0,count:t.count}]);for(let v=0,T=M.length;v<T;++v){let R=M[v],A=R.start,P=R.count;for(let D=A,L=A+P;D<L;D+=3)d(t.getX(D+0),t.getX(D+1),t.getX(D+2))}let E=new z,y=new z,b=new z,S=new z;function C(v){b.fromBufferAttribute(s,v),S.copy(b);let T=a[v];E.copy(T),E.sub(b.multiplyScalar(b.dot(T))).normalize(),y.crossVectors(S,T);let A=y.dot(l[v])<0?-1:1;o.setXYZW(v,E.x,E.y,E.z,A)}for(let v=0,T=M.length;v<T;++v){let R=M[v],A=R.start,P=R.count;for(let D=A,L=A+P;D<L;D+=3)C(t.getX(D+0)),C(t.getX(D+1)),C(t.getX(D+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==e.count)n=new we(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let h=0,p=n.count;h<p;h++)n.setXYZ(h,0,0,0);let s=new z,r=new z,o=new z,a=new z,l=new z,c=new z,u=new z,f=new z;if(t)for(let h=0,p=t.count;h<p;h+=3){let g=t.getX(h+0),_=t.getX(h+1),m=t.getX(h+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,_),o.fromBufferAttribute(e,m),u.subVectors(o,r),f.subVectors(s,r),u.cross(f),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,m),a.add(u),l.add(u),c.add(u),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let h=0,p=e.count;h<p;h+=3)s.fromBufferAttribute(e,h+0),r.fromBufferAttribute(e,h+1),o.fromBufferAttribute(e,h+2),u.subVectors(o,r),f.subVectors(s,r),u.cross(f),n.setXYZ(h+0,u.x,u.y,u.z),n.setXYZ(h+1,u.x,u.y,u.z),n.setXYZ(h+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Pe.fromBufferAttribute(t,e),Pe.normalize(),t.setXYZ(e,Pe.x,Pe.y,Pe.z)}toNonIndexed(){function t(a,l){let c=a.array,u=a.itemSize,f=a.normalized,h=new c.constructor(l.length*u),p=0,g=0;for(let _=0,m=l.length;_<m;_++){a.isInterleavedBufferAttribute?p=l[_]*a.data.stride+a.offset:p=l[_]*u;for(let d=0;d<u;d++)h[g++]=c[p++]}return new we(h,u,f)}if(this.index===null)return Lt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new i,n=this.index.array,s=this.attributes;for(let a in s){let l=s[a],c=t(l,n);e.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let u=0,f=c.length;u<f;u++){let h=c[u],p=t(h,n);l.push(p)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let n=this.attributes;for(let l in n){let c=n[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],u=[];for(let f=0,h=c.length;f<h;f++){let p=c[f];u.push(p.toJSON(t.data))}u.length>0&&(s[l]=u,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(t.data.boundingSphere=a.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let n=t.index;n!==null&&this.setIndex(n.clone());let s=t.attributes;for(let c in s){let u=s[c];this.setAttribute(c,u.clone(e))}let r=t.morphAttributes;for(let c in r){let u=[],f=r[c];for(let h=0,p=f.length;h<p;h++)u.push(f[h].clone(e));this.morphAttributes[c]=u}this.morphTargetsRelative=t.morphTargetsRelative;let o=t.groups;for(let c=0,u=o.length;c<u;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}};var Jl=new z,nm=new z,im=new Ft,_n=class{constructor(t=new z(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){let s=Jl.subVectors(n,e).cross(nm.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,n=!0){let s=t.delta(Jl),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let o=-(t.start.dot(this.normal)+this.constant)/r;return n===!0&&(o<0||o>1)?null:e.copy(t.start).addScaledVector(s,o)}intersectsLine(t){let e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let n=e||im.getNormalMatrix(t),s=this.coplanarPoint(Jl).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},sm=0,Zn=class extends In{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:sm++}),this.uuid=Us(),this.name="",this.type="Material",this.blending=Ps,this.side=_i,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=mc,this.blendDst=gc,this.blendEquation=Vi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ut(0,0,0),this.blendAlpha=0,this.depthFunc=_s,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=rd,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Po,this.stencilZFail=Po,this.stencilZPass=Po,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let n=t[e];if(n===void 0){Lt(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){Lt(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(e){let r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Ut().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(n=>new _n().fromJSON(n))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let n=t.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new Ht().fromArray(n)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Ht().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,n=null;if(e!==null){let s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}};var Xn=new z,jl=new z,po=new z,mo=new z,Es=class{constructor(t=new z,e=new z(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Xn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=Xn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Xn.copy(this.origin).addScaledVector(this.direction,e),Xn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){jl.copy(t).add(e).multiplyScalar(.5),po.copy(e).sub(t).normalize(),mo.copy(this.origin).sub(jl);let r=t.distanceTo(e)*.5,o=-this.direction.dot(po),a=mo.dot(this.direction),l=-mo.dot(po),c=mo.lengthSq(),u=Math.abs(1-o*o),f,h,p,g;if(u>0)if(f=o*l-a,h=o*a-l,g=r*u,f>=0)if(h>=-g)if(h<=g){let _=1/u;f*=_,h*=_,p=f*(f+o*h+2*a)+h*(o*f+h+2*l)+c}else h=r,f=Math.max(0,-(o*h+a)),p=-f*f+h*(h+2*l)+c;else h=-r,f=Math.max(0,-(o*h+a)),p=-f*f+h*(h+2*l)+c;else h<=-g?(f=Math.max(0,-(-o*r+a)),h=f>0?-r:Math.min(Math.max(-r,-l),r),p=-f*f+h*(h+2*l)+c):h<=g?(f=0,h=Math.min(Math.max(-r,-l),r),p=h*(h+2*l)+c):(f=Math.max(0,-(o*r+a)),h=f>0?r:Math.min(Math.max(-r,-l),r),p=-f*f+h*(h+2*l)+c);else h=o>0?-r:r,f=Math.max(0,-(o*h+a)),p=-f*f+h*(h+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(jl).addScaledVector(po,h),p}intersectSphere(t,e){if(t.radius<0)return null;Xn.subVectors(t.center,this.origin);let n=Xn.dot(this.direction),s=Xn.dot(Xn)-n*n,r=t.radius*t.radius;if(s>r)return null;let o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){let n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,l,c=1/this.direction.x,u=1/this.direction.y,f=1/this.direction.z,h=this.origin;return c>=0?(n=(t.min.x-h.x)*c,s=(t.max.x-h.x)*c):(n=(t.max.x-h.x)*c,s=(t.min.x-h.x)*c),u>=0?(r=(t.min.y-h.y)*u,o=(t.max.y-h.y)*u):(r=(t.max.y-h.y)*u,o=(t.min.y-h.y)*u),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),f>=0?(a=(t.min.z-h.z)*f,l=(t.max.z-h.z)*f):(a=(t.max.z-h.z)*f,l=(t.min.z-h.z)*f),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,Xn)!==null}intersectTriangle(t,e,n,s,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,u=a.z,f=t.x-o.x,h=t.y-o.y,p=t.z-o.z,g=e.x-o.x,_=e.y-o.y,m=e.z-o.z,d=n.x-o.x,M=n.y-o.y,E=n.z-o.z,y=Math.abs(l),b=Math.abs(c),S=Math.abs(u),C,v,T,R,A,P,D,L,F,U,O,q;if(y>=b&&y>=S?(T=l,P=f,F=g,q=d,l>=0?(C=c,v=u,R=h,A=p,D=_,L=m,U=M,O=E):(C=u,v=c,R=p,A=h,D=m,L=_,U=E,O=M)):b>=S?(T=c,P=h,F=_,q=M,c>=0?(C=u,v=l,R=p,A=f,D=m,L=g,U=E,O=d):(C=l,v=u,R=f,A=p,D=g,L=m,U=d,O=E)):(T=u,P=p,F=m,q=E,u>=0?(C=l,v=c,R=f,A=h,D=g,L=_,U=d,O=M):(C=c,v=l,R=h,A=f,D=_,L=g,U=M,O=d)),T===0)return null;let H=C/T,j=v/T,it=1/T,X=R-H*P,nt=A-j*P,lt=D-H*F,ct=L-j*F,bt=U-H*q,Y=O-j*q,J=bt*ct-Y*lt,ot=X*Y-nt*bt,wt=lt*nt-ct*X;if(s){if(J<0||ot<0||wt<0)return null}else if((J<0||ot<0||wt<0)&&(J>0||ot>0||wt>0))return null;let _t=J+ot+wt;if(_t===0)return null;let zt=it*(J*P+ot*F+wt*q);return(_t>0?zt<0:zt>0)?null:this.at(zt/_t,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},$n=class extends Zn{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ut(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.combine=_c,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},gu=new ne,Oi=new Es,go=new yn,_u=new z,_o=new z,xo=new z,yo=new z,Ql=new z,vo=new z,xu=new z,Mo=new z,De=class extends Ue{constructor(t=new Ee,e=new $n){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){let n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);let a=this.morphTargetInfluences;if(r&&a){vo.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let u=a[l],f=r[l];u!==0&&(Ql.fromBufferAttribute(f,t),o?vo.addScaledVector(Ql,u):vo.addScaledVector(Ql.sub(e),u))}e.add(vo)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),go.copy(n.boundingSphere),go.applyMatrix4(r),Oi.copy(t.ray).recast(t.near),!(go.containsPoint(Oi.origin)===!1&&(Oi.intersectSphere(go,_u)===null||Oi.origin.distanceToSquared(_u)>(t.far-t.near)**2))&&(gu.copy(r).invert(),Oi.copy(t.ray).applyMatrix4(gu),!(n.boundingBox!==null&&Oi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Oi)))}_computeIntersections(t,e,n){let s,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,u=r.attributes.uv1,f=r.attributes.normal,h=r.groups,p=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,_=h.length;g<_;g++){let m=h[g],d=o[m.materialIndex],M=Math.max(m.start,p.start),E=Math.min(a.count,Math.min(m.start+m.count,p.start+p.count));for(let y=M,b=E;y<b;y+=3){let S=a.getX(y),C=a.getX(y+1),v=a.getX(y+2);s=So(this,d,t,n,c,u,f,S,C,v),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,p.start),_=Math.min(a.count,p.start+p.count);for(let m=g,d=_;m<d;m+=3){let M=a.getX(m),E=a.getX(m+1),y=a.getX(m+2);s=So(this,o,t,n,c,u,f,M,E,y),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,_=h.length;g<_;g++){let m=h[g],d=o[m.materialIndex],M=Math.max(m.start,p.start),E=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let y=M,b=E;y<b;y+=3){let S=y,C=y+1,v=y+2;s=So(this,d,t,n,c,u,f,S,C,v),s&&(s.faceIndex=Math.floor(y/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let g=Math.max(0,p.start),_=Math.min(l.count,p.start+p.count);for(let m=g,d=_;m<d;m+=3){let M=m,E=m+1,y=m+2;s=So(this,o,t,n,c,u,f,M,E,y),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}};function rm(i,t,e,n,s,r,o,a){let l;if(t.side===qe?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,t.side===_i,a),l===null)return null;Mo.copy(a),Mo.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(Mo);return c<e.near||c>e.far?null:{distance:c,point:Mo.clone(),object:i}}function So(i,t,e,n,s,r,o,a,l,c){i.getVertexPosition(a,_o),i.getVertexPosition(l,xo),i.getVertexPosition(c,yo);let u=rm(i,t,e,n,_o,xo,yo,xu);if(u){let f=new z;ci.getBarycoord(xu,_o,xo,yo,f),s&&(u.uv=ci.getInterpolatedAttribute(s,a,l,c,f,new Ht)),r&&(u.uv1=ci.getInterpolatedAttribute(r,a,l,c,f,new Ht)),o&&(u.normal=ci.getInterpolatedAttribute(o,a,l,c,f,new z),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));let h={a,b:l,c,normal:new z,materialIndex:0};ci.getNormal(_o,xo,yo,h.normal),u.face=h,u.barycoord=f}return u}var vr=class extends ze{constructor(t=null,e=1,n=1,s,r,o,a,l,c=Ie,u=Ie,f,h){super(null,o,a,l,c,u,s,r,f,h),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Bi=class extends we{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){let t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}},us=new ne,yu=new ne,bo=[],vu=new cn,om=new ne,ar=new De,lr=new yn,vn=class extends De{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Bi(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,om)}computeBoundingBox(){let t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new cn),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,us),vu.copy(t.boundingBox).applyMatrix4(us),this.boundingBox.union(vu)}computeBoundingSphere(){let t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new yn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,us),lr.copy(t.boundingSphere).applyMatrix4(us),this.boundingSphere.union(lr)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){return this.instanceColor===null?e.setRGB(1,1,1):e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){return e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){let n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){let n=this.matrixWorld,s=this.count;if(ar.geometry=this.geometry,ar.material=this.material,ar.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),lr.copy(this.boundingSphere),lr.applyMatrix4(n),t.ray.intersectsSphere(lr)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,us),yu.multiplyMatrices(n,us),ar.matrixWorld=yu,ar.raycast(t,bo);for(let o=0,a=bo.length;o<a;o++){let l=bo[o];l.instanceId=r,l.object=this,e.push(l)}bo.length=0}}setColorAt(t,e){return this.instanceColor===null&&(this.instanceColor=new Bi(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3),this}setMatrixAt(t,e){return e.toArray(this.instanceMatrix.array,t*16),this}setMorphAt(t,e){let n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new vr(new Float32Array(s*this.count),s,this.count,ma,un));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<n.length;c++)o+=n[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=s*t;return r[l]=a,r.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Ni=new yn,am=new Ht(.5,.5),wo=new z,Ts=class{constructor(t=new _n,e=new _n,n=new _n,s=new _n,r=new _n,o=new _n){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){let a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){let e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=xn,n=!1){let s=this.planes,r=t.elements,o=r[0],a=r[1],l=r[2],c=r[3],u=r[4],f=r[5],h=r[6],p=r[7],g=r[8],_=r[9],m=r[10],d=r[11],M=r[12],E=r[13],y=r[14],b=r[15];if(s[0].setComponents(c-o,p-u,d-g,b-M).normalize(),s[1].setComponents(c+o,p+u,d+g,b+M).normalize(),s[2].setComponents(c+a,p+f,d+_,b+E).normalize(),s[3].setComponents(c-a,p-f,d-_,b-E).normalize(),n)s[4].setComponents(l,h,m,y).normalize(),s[5].setComponents(c-l,p-h,d-m,b-y).normalize();else if(s[4].setComponents(c-l,p-h,d-m,b-y).normalize(),e===xn)s[5].setComponents(c+l,p+h,d+m,b+y).normalize();else if(e===ys)s[5].setComponents(l,h,m,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Ni.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Ni.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Ni)}intersectsSprite(t){Ni.center.set(0,0,0);let e=am.distanceTo(t.center);return Ni.radius=.7071067811865476+e,Ni.applyMatrix4(t.matrixWorld),this.intersectsSphere(Ni)}intersectsSphere(t){let e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let n=0;n<6;n++){let s=e[n];if(wo.x=s.normal.x>0?t.max.x:t.min.x,wo.y=s.normal.y>0?t.max.y:t.min.y,wo.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(wo)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var As=class extends Zn{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ut(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},Go=new z,Wo=new z,Mu=new ne,cr=new Es,Eo=new yn,tc=new z,Su=new z,Xo=class extends Ue{constructor(t=new Ee,e=new As){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[0];for(let s=1,r=e.count;s<r;s++)Go.fromBufferAttribute(e,s-1),Wo.fromBufferAttribute(e,s),n[s]=n[s-1],n[s]+=Go.distanceTo(Wo);t.setAttribute("lineDistance",new pe(n,1))}else Lt("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let n=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Eo.copy(n.boundingSphere),Eo.applyMatrix4(s),Eo.radius+=r,t.ray.intersectsSphere(Eo)===!1)return;Mu.copy(s).invert(),cr.copy(t.ray).applyMatrix4(Mu);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,u=n.index,h=n.attributes.position;if(u!==null){let p=Math.max(0,o.start),g=Math.min(u.count,o.start+o.count);for(let _=p,m=g-1;_<m;_+=c){let d=u.getX(_),M=u.getX(_+1),E=To(this,t,cr,l,d,M,_);E&&e.push(E)}if(this.isLineLoop){let _=u.getX(g-1),m=u.getX(p),d=To(this,t,cr,l,_,m,g-1);d&&e.push(d)}}else{let p=Math.max(0,o.start),g=Math.min(h.count,o.start+o.count);for(let _=p,m=g-1;_<m;_+=c){let d=To(this,t,cr,l,_,_+1,_);d&&e.push(d)}if(this.isLineLoop){let _=To(this,t,cr,l,g-1,p,g-1);_&&e.push(_)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){let s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function To(i,t,e,n,s,r,o){let a=i.geometry.attributes.position;if(Go.fromBufferAttribute(a,s),Wo.fromBufferAttribute(a,r),e.distanceSqToSegment(Go,Wo,tc,Su)>n)return;tc.applyMatrix4(i.matrixWorld);let c=t.ray.origin.distanceTo(tc);if(!(c<t.near||c>t.far))return{distance:c,point:Su.clone().applyMatrix4(i.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:i}}var bu=new z,wu=new z,Mr=class extends Xo{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,n=[];for(let s=0,r=e.count;s<r;s+=2)bu.fromBufferAttribute(e,s),wu.fromBufferAttribute(e,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+bu.distanceTo(wu);t.setAttribute("lineDistance",new pe(n,1))}else Lt("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var Sr=class extends ze{constructor(t=[],e=xi,n,s,r,o,a,l,c,u){super(t,e,n,s,r,o,a,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}};var hi=class extends ze{constructor(t,e,n=Sn,s,r,o,a=Ie,l=Ie,c,u=Pn,f=1){if(u!==Pn&&u!==vi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:t,height:e,depth:f};super(h,s,r,o,a,l,u,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new Ss(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return e.compareFunction=this.compareFunction,e}},qo=class extends hi{constructor(t,e=Sn,n=xi,s,r,o=Ie,a=Ie,l,c=Pn){let u={width:t,height:t,depth:1},f=[u,u,u,u,u,u];super(t,t,e,n,s,r,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},br=class extends ze{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},Ln=class i extends Ee{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};let a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],u=[],f=[],h=0,p=0;g("z","y","x",-1,-1,n,e,t,o,r,0),g("z","y","x",1,-1,n,e,-t,o,r,1),g("x","z","y",1,1,t,n,e,s,o,2),g("x","z","y",1,-1,t,n,-e,s,o,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new pe(c,3)),this.setAttribute("normal",new pe(u,3)),this.setAttribute("uv",new pe(f,2));function g(_,m,d,M,E,y,b,S,C,v,T){let R=y/C,A=b/v,P=y/2,D=b/2,L=S/2,F=C+1,U=v+1,O=0,q=0,H=new z;for(let j=0;j<U;j++){let it=j*A-D;for(let X=0;X<F;X++){let nt=X*R-P;H[_]=nt*M,H[m]=it*E,H[d]=L,c.push(H.x,H.y,H.z),H[_]=0,H[m]=0,H[d]=S>0?1:-1,u.push(H.x,H.y,H.z),f.push(X/C),f.push(1-j/v),O+=1}}for(let j=0;j<v;j++)for(let it=0;it<C;it++){let X=h+it+F*j,nt=h+it+F*(j+1),lt=h+(it+1)+F*(j+1),ct=h+(it+1)+F*j;l.push(X,nt,ct),l.push(nt,lt,ct),q+=6}a.addGroup(p,q,T),p+=q,h+=O}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},wr=class i extends Ee{constructor(t=1,e=1,n=4,s=8,r=1){super(),this.type="CapsuleGeometry",this.parameters={radius:t,height:e,capSegments:n,radialSegments:s,heightSegments:r},e=Math.max(0,e),n=Math.max(1,Math.floor(n)),s=Math.max(3,Math.floor(s)),r=Math.max(1,Math.floor(r));let o=[],a=[],l=[],c=[],u=e/2,f=Math.PI/2*t,h=e,p=2*f+h,g=n*2+r,_=s+1,m=new z,d=new z;for(let M=0;M<=g;M++){let E=0,y=0,b=0,S=0;if(M<=n){let T=M/n,R=T*Math.PI/2;y=-u-t*Math.cos(R),b=t*Math.sin(R),S=-t*Math.cos(R),E=T*f}else if(M<=n+r){let T=(M-n)/r;y=-u+T*e,b=t,S=0,E=f+T*h}else{let T=(M-n-r)/n,R=T*Math.PI/2;y=u+t*Math.sin(R),b=t*Math.cos(R),S=t*Math.sin(R),E=f+h+T*f}let C=Math.max(0,Math.min(1,E/p)),v=0;M===0?v=.5/s:M===g&&(v=-.5/s);for(let T=0;T<=s;T++){let R=T/s,A=R*Math.PI*2,P=Math.sin(A),D=Math.cos(A);d.x=-b*D,d.y=y,d.z=b*P,a.push(d.x,d.y,d.z),m.set(-b*D,S,b*P),m.normalize(),l.push(m.x,m.y,m.z),c.push(R+v,C)}if(M>0){let T=(M-1)*_;for(let R=0;R<s;R++){let A=T+R,P=T+R+1,D=M*_+R,L=M*_+R+1;o.push(A,P,D),o.push(P,L,D)}}}this.setIndex(o),this.setAttribute("position",new pe(a,3)),this.setAttribute("normal",new pe(l,3)),this.setAttribute("uv",new pe(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.height,t.capSegments,t.radialSegments,t.heightSegments)}};var ui=class i extends Ee{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let u=[],f=[],h=[],p=[],g=0,_=[],m=n/2,d=0;M(),o===!1&&(t>0&&E(!0),e>0&&E(!1)),this.setIndex(u),this.setAttribute("position",new pe(f,3)),this.setAttribute("normal",new pe(h,3)),this.setAttribute("uv",new pe(p,2));function M(){let y=new z,b=new z,S=0,C=(e-t)/n;for(let v=0;v<=r;v++){let T=[],R=v/r,A=R*(e-t)+t;for(let P=0;P<=s;P++){let D=P/s,L=D*l+a,F=Math.sin(L),U=Math.cos(L);b.x=A*F,b.y=-R*n+m,b.z=A*U,f.push(b.x,b.y,b.z),y.set(F,C,U).normalize(),h.push(y.x,y.y,y.z),p.push(D,1-R),T.push(g++)}_.push(T)}for(let v=0;v<s;v++)for(let T=0;T<r;T++){let R=_[T][v],A=_[T+1][v],P=_[T+1][v+1],D=_[T][v+1];(t>0||T!==0)&&(u.push(R,A,D),S+=3),(e>0||T!==r-1)&&(u.push(A,P,D),S+=3)}c.addGroup(d,S,0),d+=S}function E(y){let b=g,S=new Ht,C=new z,v=0,T=y===!0?t:e,R=y===!0?1:-1;for(let P=1;P<=s;P++)f.push(0,m*R,0),h.push(0,R,0),p.push(.5,.5),g++;let A=g;for(let P=0;P<=s;P++){let L=P/s*l+a,F=Math.cos(L),U=Math.sin(L);C.x=T*U,C.y=m*R,C.z=T*F,f.push(C.x,C.y,C.z),h.push(0,R,0),S.x=F*.5+.5,S.y=U*.5*R+.5,p.push(S.x,S.y),g++}for(let P=0;P<s;P++){let D=b+P,L=A+P;y===!0?u.push(L,L+1,D):u.push(L+1,L,D),v+=3}c.addGroup(d,v,y===!0?1:2),d+=v}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},Er=class i extends ui{constructor(t=1,e=1,n=32,s=1,r=!1,o=0,a=Math.PI*2){super(0,t,e,n,s,r,o,a),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:s,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(t){return new i(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var ki=class i extends Ee{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};let r=t/2,o=e/2,a=Math.floor(n),l=Math.floor(s),c=a+1,u=l+1,f=t/a,h=e/l,p=[],g=[],_=[],m=[];for(let d=0;d<u;d++){let M=d*h-o;for(let E=0;E<c;E++){let y=E*f-r;g.push(y,-M,0),_.push(0,0,1),m.push(E/a),m.push(1-d/l)}}for(let d=0;d<l;d++)for(let M=0;M<a;M++){let E=M+c*d,y=M+c*(d+1),b=M+1+c*(d+1),S=M+1+c*d;p.push(E,y,S),p.push(y,b,S)}this.setIndex(p),this.setAttribute("position",new pe(g,3)),this.setAttribute("normal",new pe(_,3)),this.setAttribute("uv",new pe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.width,t.height,t.widthSegments,t.heightSegments)}};var zi=class i extends Ee{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));let l=Math.min(o+a,Math.PI),c=0,u=[],f=new z,h=new z,p=[],g=[],_=[],m=[];for(let d=0;d<=n;d++){let M=[],E=d/n,y=o+E*a,b=t*Math.cos(y),S=Math.sqrt(t*t-b*b),C=0;d===0&&o===0?C=.5/e:d===n&&l===Math.PI&&(C=-.5/e);for(let v=0;v<=e;v++){let T=v/e,R=s+T*r;f.x=-S*Math.cos(R),f.y=b,f.z=S*Math.sin(R),g.push(f.x,f.y,f.z),h.copy(f).normalize(),_.push(h.x,h.y,h.z),m.push(T+C,1-E),M.push(c++)}u.push(M)}for(let d=0;d<n;d++)for(let M=0;M<e;M++){let E=u[d][M+1],y=u[d][M],b=u[d+1][M],S=u[d+1][M+1];(d!==0||o>0)&&p.push(E,y,S),(d!==n-1||l<Math.PI)&&p.push(y,b,S)}this.setIndex(p),this.setAttribute("position",new pe(g,3)),this.setAttribute("normal",new pe(_,3)),this.setAttribute("uv",new pe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new i(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function Gi(i){let t={};for(let e in i){t[e]={};for(let n in i[e]){let s=i[e][n];if(Eu(s))s.isRenderTargetTexture?(Lt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone();else if(Array.isArray(s))if(Eu(s[0])){let r=[];for(let o=0,a=s.length;o<a;o++)r[o]=s[o].clone();t[e][n]=r}else t[e][n]=s.slice();else t[e][n]=s}}return t}function Ve(i){let t={};for(let e=0;e<i.length;e++){let n=Gi(i[e]);for(let s in n)t[s]=n[s]}return t}function Eu(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function lm(i){let t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Oc(i){let t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Zt.workingColorSpace}var xd={clone:Gi,merge:Ve},cm=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,hm=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Xe=class extends Zn{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=cm,this.fragmentShader=hm,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Gi(t.uniforms),this.uniformsGroups=lm(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let n={};for(let s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let n in t.uniforms){let s=t.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=e[s.value]||null;break;case"c":this.uniforms[n].value=new Ut().setHex(s.value);break;case"v2":this.uniforms[n].value=new Ht().fromArray(s.value);break;case"v3":this.uniforms[n].value=new z().fromArray(s.value);break;case"v4":this.uniforms[n].value=new he().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Ft().fromArray(s.value);break;case"m4":this.uniforms[n].value=new ne().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let n in t.extensions)this.extensions[n]=t.extensions[n];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},Yo=class extends Xe{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},di=class extends Zn{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ut(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ut(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=$a,this.normalScale=new Ht(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}};var Zo=class extends Zn{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=id,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},$o=class extends Zn{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function ds(i,t){return!i||i.constructor===t?i:typeof t.BYTES_PER_ELEMENT=="number"?new t(i):Array.prototype.slice.call(i)}function ec(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}var fi=class{constructor(t,e,n,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(n),this.sampleValues=e,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,n=this._cachedIndex,s=e[n],r=e[n-1];n:{t:{let o;e:{i:if(!(t<s)){for(let a=n+2;;){if(s===void 0){if(t<r)break i;return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=s,s=e[++n],t<s)break t}o=e.length;break e}if(!(t>=r)){let a=e[1];t<a&&(n=2,r=a);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(s=r,r=e[--n-1],t>=r)break t}o=n,n=0;break e}break n}for(;n<o;){let a=n+o>>>1;t<e[a]?o=a:n=a+1}if(s=e[n],r=e[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return n=e.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,s)}return this.interpolate_(n,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,n=this.sampleValues,s=this.valueSize,r=t*s;for(let o=0;o!==s;++o)e[o]=n[r+o];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Ko=class extends fi{constructor(t,e,n,s){super(t,e,n,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:sc,endingEnd:sc}}intervalChanged_(t,e,n){let s=this.parameterPositions,r=t-2,o=t+1,a=s[r],l=s[o];if(a===void 0)switch(this.getSettings_().endingStart){case rc:r=t,a=2*e-n;break;case oc:r=s.length-2,a=e+s[r]-s[r+1];break;default:r=t,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case rc:o=t,l=2*n-e;break;case oc:o=1,l=n+s[1]-s[0];break;default:o=t-1,l=e}let c=(n-e)*.5,u=this.valueSize;this._weightPrev=c/(e-a),this._weightNext=c/(l-n),this._offsetPrev=r*u,this._offsetNext=o*u}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,u=this._offsetPrev,f=this._offsetNext,h=this._weightPrev,p=this._weightNext,g=(n-e)/(s-e),_=g*g,m=_*g,d=-h*m+2*h*_-h*g,M=(1+h)*m+(-1.5-2*h)*_+(-.5+h)*g+1,E=(-1-p)*m+(1.5+p)*_+.5*g,y=p*m-p*_;for(let b=0;b!==a;++b)r[b]=d*o[u+b]+M*o[c+b]+E*o[l+b]+y*o[f+b];return r}},Jo=class extends fi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,u=(n-e)/(s-e),f=1-u;for(let h=0;h!==a;++h)r[h]=o[c+h]*f+o[l+h]*u;return r}},jo=class extends fi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t){return this.copySampleValue_(t-1)}},Qo=class extends fi{interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,u=this.inTangents,f=this.outTangents;if(!u||!f){let g=(n-e)/(s-e),_=1-g;for(let m=0;m!==a;++m)r[m]=o[c+m]*_+o[l+m]*g;return r}let h=a*2,p=t-1;for(let g=0;g!==a;++g){let _=o[c+g],m=o[l+g],d=p*h+g*2,M=f[d],E=f[d+1],y=t*h+g*2,b=u[y],S=u[y+1],C=dm(n,e,M,b,s);r[g]=yd(C,_,E,S,m)}return r}};function yd(i,t,e,n,s){let r=1-i;return r*r*r*t+3*r*r*i*e+3*r*i*i*n+i*i*i*s}function um(i,t,e,n,s){let r=1-i;return 3*r*r*(e-t)+6*r*i*(n-e)+3*i*i*(s-n)}function dm(i,t,e,n,s){let r=(i-t)/(s-t);for(let o=0;o<8;o++){let a=yd(r,t,e,n,s)-i;if(Math.abs(a)<1e-10)break;let l=um(r,t,e,n,s);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var nn=class{constructor(t,e,n,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=ds(e,this.TimeBufferType),this.values=ds(n,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,n;if(e.toJSON!==this.toJSON)n=e.toJSON(t);else{n={name:t.name,times:ds(t.times,Array),values:ds(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(n.interpolation=s),ec(t.settings)&&(n.settings={inTangents:ds(t.settings.inTangents,Array),outTangents:ds(t.settings.outTangents,Array)})}return n.type=t.ValueTypeName,n}InterpolantFactoryMethodDiscrete(t){return new jo(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new Jo(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new Ko(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new Qo(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case dr:e=this.InterpolantFactoryMethodDiscrete;break;case ko:e=this.InterpolantFactoryMethodLinear;break;case Ro:e=this.InterpolantFactoryMethodSmooth;break;case ic:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Lt("KeyframeTrack:",n),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return dr;case this.InterpolantFactoryMethodLinear:return ko;case this.InterpolantFactoryMethodSmooth:return Ro;case this.InterpolantFactoryMethodBezier:return ic}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let n=0,s=e.length;n!==s;++n)e[n]*=t;ec(this.settings)&&(Tu(this.settings.inTangents,t),Tu(this.settings.outTangents,t))}return this}trim(t,e){let n=this.times,s=n.length,r=0,o=s-1;for(;r!==s&&n[r]<t;)++r;for(;o!==-1&&n[o]>e;)--o;if(++o,r!==0||o!==s){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(Ot("KeyframeTrack: Invalid value size in track.",this),t=!1);let n=this.times,s=this.values,r=n.length;r===0&&(Ot("KeyframeTrack: Track is empty.",this),t=!1);let o=null;for(let a=0;a!==r;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){Ot("KeyframeTrack: Time is not a valid number.",this,a,l),t=!1;break}if(o!==null&&o>l){Ot("KeyframeTrack: Out of order keys.",this,a,l,o),t=!1;break}o=l}if(s!==void 0&&Tp(s))for(let a=0,l=s.length;a!==l;++a){let c=s[a];if(isNaN(c)){Ot("KeyframeTrack: Value is not a valid number.",this,a,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),n=this.getValueSize(),s=this.getInterpolation()===Ro,r=t.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=t[a],u=t[a+1];if(c!==u&&(a!==1||c!==t[0]))if(s)l=!0;else{let f=a*n,h=f-n,p=f+n;for(let g=0;g!==n;++g){let _=e[f+g];if(_!==e[h+g]||_!==e[p+g]){l=!0;break}}}if(l){if(a!==o){t[o]=t[a];let f=a*n,h=o*n;for(let p=0;p!==n;++p)e[h+p]=e[f+p]}++o}}if(r>0){t[o]=t[r];for(let a=r*n,l=o*n,c=0;c!==n;++c)e[l+c]=e[a+c];++o}return o!==t.length?(this.times=t.slice(0,o),this.values=e.slice(0,o*n)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),n=this.constructor,s=new n(this.name,t,e);return s.createInterpolant=this.createInterpolant,ec(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function Tu(i,t){for(let e=0,n=i.length;e!==n;e+=2)i[e]*=t}nn.prototype.ValueTypeName="";nn.prototype.TimeBufferType=Float32Array;nn.prototype.ValueBufferType=Float32Array;nn.prototype.DefaultInterpolation=ko;var pi=class extends nn{constructor(t,e,n){super(t,e,n)}};pi.prototype.ValueTypeName="bool";pi.prototype.ValueBufferType=Array;pi.prototype.DefaultInterpolation=dr;pi.prototype.InterpolantFactoryMethodLinear=void 0;pi.prototype.InterpolantFactoryMethodSmooth=void 0;var ta=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}};ta.prototype.ValueTypeName="color";var ea=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}};ea.prototype.ValueTypeName="number";var na=class extends fi{constructor(t,e,n,s){super(t,e,n,s)}interpolate_(t,e,n,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-e)/(s-e),c=t*a;for(let u=c+a;c!==u;c+=4)en.slerpFlat(r,0,o,c-a,o,c,l);return r}},Tr=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}InterpolantFactoryMethodLinear(t){return new na(this.times,this.values,this.getValueSize(),t)}};Tr.prototype.ValueTypeName="quaternion";Tr.prototype.InterpolantFactoryMethodSmooth=void 0;var mi=class extends nn{constructor(t,e,n){super(t,e,n)}};mi.prototype.ValueTypeName="string";mi.prototype.ValueBufferType=Array;mi.prototype.DefaultInterpolation=dr;mi.prototype.InterpolantFactoryMethodLinear=void 0;mi.prototype.InterpolantFactoryMethodSmooth=void 0;var ia=class extends nn{constructor(t,e,n,s){super(t,e,n,s)}};ia.prototype.ValueTypeName="vector";var sa=class{constructor(t,e,n){let s=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this._abortController=null,this.itemStart=function(u){a++,r===!1&&s.onStart!==void 0&&s.onStart(u,o,a),r=!0},this.itemEnd=function(u){o++,s.onProgress!==void 0&&s.onProgress(u,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(u){s.onError!==void 0&&s.onError(u)},this.resolveURL=function(u){return u=u.normalize("NFC"),l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,f){return c.push(u,f),this},this.removeHandler=function(u){let f=c.indexOf(u);return f!==-1&&c.splice(f,2),this},this.getHandler=function(u){for(let f=0,h=c.length;f<h;f+=2){let p=c[f],g=c[f+1];if(p.global&&(p.lastIndex=0),p.test(u))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},vd=new sa,ra=class{constructor(t){this.manager=t!==void 0?t:vd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let n=this;return new Promise(function(s,r){n.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};ra.DEFAULT_MATERIAL_NAME="__DEFAULT";var Ar=class extends Ue{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ut(t),this.intensity=e}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},Cr=class extends Ar{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ue.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ut(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},nc=new ne,Au=new z,Cu=new z,oa=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Ht(512,512),this.mapType=Ke,this.map=null,this.mapPass=null,this.matrix=new ne,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ts,this._frameExtents=new Ht(1,1),this._viewportCount=1,this._viewports=[new he(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera;Au.setFromMatrixPosition(t.matrixWorld),e.position.copy(Au),Cu.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Cu),e.updateMatrixWorld(),this._updateMatrix(e,this.matrix,this._frustum)}_updateMatrix(t,e,n,s){nc.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),n.setFromProjectionMatrix(nc,t.coordinateSystem,t.reversedDepth);let r=this._frameExtents,o=s?s.z/r.x:1,a=s?s.w/r.y:1,l=s?s.x/r.x:0,c=s?s.y/r.y:0;t.coordinateSystem===ys||t.reversedDepth?e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),e.multiply(nc)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return t.intensity=this.intensity,t.bias=this.bias,t.normalBias=this.normalBias,t.radius=this.radius,t.blurSamples=this.blurSamples,t.mapSize=this.mapSize.toArray(),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},Ao=new z,Co=new en,Cn=new z,Rr=class extends Ue{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ne,this.projectionMatrix=new ne,this.projectionMatrixInverse=new ne,this.coordinateSystem=xn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(Ao,Co,Cn),Cn.x===1&&Cn.y===1&&Cn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ao,Co,Cn.set(1,1,1)).invert()}updateWorldMatrix(t,e,n=!1){super.updateWorldMatrix(t,e,n),this.matrixWorld.decompose(Ao,Co,Cn),Cn.x===1&&Cn.y===1&&Cn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ao,Co,Cn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},li=new z,Ru=new Ht,Pu=new Ht,Ze=class extends Rr{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=Ms*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(hr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Ms*2*Math.atan(Math.tan(hr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){li.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(li.x,li.y).multiplyScalar(-t/li.z),li.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(li.x,li.y).multiplyScalar(-t/li.z)}getViewSize(t,e){return this.getViewBounds(t,Ru,Pu),e.subVectors(Pu,Ru)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(hr*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,e-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var gi=class extends Rr{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=n-t,o=n+t,a=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},ac=class extends oa{constructor(){super(new gi(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Pr=class extends Ar{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ue.DEFAULT_UP),this.updateMatrix(),this.target=new Ue,this.shadow=new ac}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}};var fs=-90,ps=1,aa=class extends Ue{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Ze(fs,ps,t,e);s.layers=this.layers,this.add(s);let r=new Ze(fs,ps,t,e);r.layers=this.layers,this.add(r);let o=new Ze(fs,ps,t,e);o.layers=this.layers,this.add(o);let a=new Ze(fs,ps,t,e);a.layers=this.layers,this.add(a);let l=new Ze(fs,ps,t,e);l.layers=this.layers,this.add(l);let c=new Ze(fs,ps,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,l]=e;for(let c of e)this.remove(c);if(t===xn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===ys)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,u]=this.children,f=t.getRenderTarget(),h=t.getActiveCubeFace(),p=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;let _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;t.isWebGLRenderer===!0?m=t.state.buffers.depth.getReversed():m=t.reversedDepthBuffer,t.setRenderTarget(n,0,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(n,1,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(n,2,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(n,3,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(n,4,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,u),t.setRenderTarget(f,h,p),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},la=class extends Ze{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}};var Nc="\\[\\]\\.:\\/",fm=new RegExp("["+Nc+"]","g"),Fc="[^"+Nc+"]",pm="[^"+Nc.replace("\\.","")+"]",mm=/((?:WC+[\/:])*)/.source.replace("WC",Fc),gm=/(WCOD+)?/.source.replace("WCOD",pm),_m=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Fc),xm=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Fc),ym=new RegExp("^"+mm+gm+_m+xm+"$"),vm=["material","materials","bones","map"],lc=class{constructor(t,e,n){let s=n||fe.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let n=this._targetGroup.nCachedObjects_,s=this._bindings[n];s!==void 0&&s.getValue(t,e)}setValue(t,e){let n=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=n.length;s!==r;++s)n[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,n=t.length;e!==n;++e)t[e].unbind()}},fe=class i{constructor(t,e,n){this.path=e,this.parsedPath=n||i.parseTrackName(e),this.node=i.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,n){return t&&t.isAnimationObjectGroup?new i.Composite(t,e,n):new i(t,e,n)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(fm,"")}static parseTrackName(t){let e=ym.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let n={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=n.nodeName&&n.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=n.nodeName.substring(s+1);vm.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,s),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return n}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let n=t.skeleton.getBoneByName(e);if(n!==void 0)return n}if(t.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===e||a.uuid===e)return a;let l=n(a.children);if(l)return l}return null},s=n(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)t[e++]=n[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let n=this.resolvedProperty;for(let s=0,r=n.length;s!==r;++s)n[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,n=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=i.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Lt("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=e.objectIndex;switch(n){case"materials":if(!t.material){Ot("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Ot("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Ot("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let u=0;u<t.length;u++)if(t[u].name===c){c=u;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Ot("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Ot("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[n]===void 0){Ot("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[n]}if(c!==void 0){if(t[c]===void 0){Ot("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let o=t[s];if(o===void 0){let c=e.nodeName;Ot("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let a=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?a=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Ot("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Ot("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};fe.Composite=lc;fe.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};fe.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};fe.prototype.GetterByBindingType=[fe.prototype._getValue_direct,fe.prototype._getValue_array,fe.prototype._getValue_arrayElement,fe.prototype._getValue_toArray];fe.prototype.SetterByBindingTypeAndVersioning=[[fe.prototype._setValue_direct,fe.prototype._setValue_direct_setNeedsUpdate,fe.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[fe.prototype._setValue_array,fe.prototype._setValue_array_setNeedsUpdate,fe.prototype._setValue_array_setMatrixWorldNeedsUpdate],[fe.prototype._setValue_arrayElement,fe.prototype._setValue_arrayElement_setNeedsUpdate,fe.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[fe.prototype._setValue_fromArray,fe.prototype._setValue_fromArray_setNeedsUpdate,fe.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Ov=new Float32Array(1);var Iu=new ne,Ir=class{constructor(t,e,n=0,s=1/0){this.ray=new Es(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new bs,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):Ot("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return Iu.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Iu),this}intersectObject(t,e=!0,n=[]){return cc(t,this,n,e),n.sort(Lu),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)cc(t[s],this,n,e);return n.sort(Lu),n}};function Lu(i,t){return i.distance-t.distance}function cc(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){let r=i.children;for(let o=0,a=r.length;o<a;o++)cc(r[o],t,e,!0)}}var Cs=class{constructor(t=1,e=0,n=0){this.radius=t,this.phi=e,this.theta=n}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Wt(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(Wt(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var hc=class i{static{i.prototype.isMatrix2=!0}constructor(t,e,n,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let n=0;n<4;n++)this.elements[n]=t[n+e];return this}set(t,e,n,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=n,r[3]=s,this}};function Bc(i,t,e,n){let s=Mm(n);switch(e){case Pc:return i*t;case ma:return i*t/s.components*s.byteLength;case ga:return i*t/s.components*s.byteLength;case Mi:return i*t*2/s.components*s.byteLength;case _a:return i*t*2/s.components*s.byteLength;case Ic:return i*t*3/s.components*s.byteLength;case dn:return i*t*4/s.components*s.byteLength;case xa:return i*t*4/s.components*s.byteLength;case Or:case Nr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Fr:case Br:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case va:case Sa:return Math.max(i,16)*Math.max(t,8)/4;case ya:case Ma:return Math.max(i,8)*Math.max(t,8)/2;case ba:case wa:case Ta:case Aa:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Ea:case kr:case Ca:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ra:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Pa:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case Ia:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case La:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case Ua:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case Da:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case Oa:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case Na:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case Fa:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case Ba:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case ka:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case za:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case Va:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case Ha:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case Ga:case Wa:case Xa:return Math.ceil(i/4)*Math.ceil(t/4)*16;case qa:case Ya:return Math.ceil(i/4)*Math.ceil(t/4)*8;case zr:case Za:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Mm(i){switch(i){case Ke:case Tc:return{byteLength:1,components:1};case Is:case Ac:case bn:return{byteLength:2,components:1};case fa:case pa:return{byteLength:2,components:4};case Sn:case da:case un:return{byteLength:4,components:1};case Cc:case Rc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?Lt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function Hd(){let i=null,t=!1,e=null,n=null;function s(r,o){n=i.requestAnimationFrame(s),e(r,o)}return{start:function(){t!==!0&&e!==null&&i!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function bm(i){let t=new WeakMap;function e(a,l){let c=a.array,u=a.usage,f=c.byteLength,h=i.createBuffer();i.bindBuffer(l,h),i.bufferData(l,c,u),a.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=i.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:h,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function n(a,l,c){let u=l.array,f=l.updateRanges;if(i.bindBuffer(c,a),f.length===0)i.bufferSubData(c,0,u);else{f.sort((p,g)=>p.start-g.start);let h=0;for(let p=1;p<f.length;p++){let g=f[h],_=f[p];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++h,f[h]=_)}f.length=h+1;for(let p=0,g=f.length;p<g;p++){let _=f[p];i.bufferSubData(c,_.start*u.BYTES_PER_ELEMENT,u,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=t.get(a);l&&(i.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let u=t.get(a);(!u||u.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var wm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Em=`#ifdef USE_ALPHAHASH
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
#endif`,Tm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Am=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Cm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Rm=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Pm=`#ifdef USE_AOMAP
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
#endif`,Im=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Lm=`#ifdef USE_BATCHING
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
#endif`,Um=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Dm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Om=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Nm=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Fm=`#ifdef USE_IRIDESCENCE
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
#endif`,Bm=`#ifdef USE_BUMPMAP
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
#endif`,km=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,zm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Vm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Hm=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Gm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Wm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Xm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,qm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Ym=`#define PI 3.141592653589793
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
} // validated`,Zm=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,$m=`vec3 transformedNormal = objectNormal;
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
#endif`,Km=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Jm=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,jm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Qm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,tg="gl_FragColor = linearToOutputTexel( gl_FragColor );",eg=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,ng=`#ifdef USE_ENVMAP
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
#endif`,ig=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,sg=`#ifdef USE_ENVMAP
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
#endif`,rg=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,og=`#ifdef USE_ENVMAP
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
#endif`,ag=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,lg=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,cg=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,hg=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,ug=`#ifdef USE_GRADIENTMAP
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
}`,dg=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,fg=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,pg=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,mg=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,gg=`#ifdef USE_ENVMAP
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
#endif`,_g=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,xg=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,yg=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,vg=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Mg=`PhysicalMaterial material;
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
#endif`,Sg=`uniform sampler2D dfgLUT;
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
}`,bg=`
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
#endif`,wg=`#if defined( RE_IndirectDiffuse )
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
#endif`,Eg=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Tg=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,Ag=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Cg=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Rg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Pg=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Ig=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Lg=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Ug=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Dg=`#if defined( USE_POINTS_UV )
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
#endif`,Og=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Ng=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Fg=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Bg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,kg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,zg=`#ifdef USE_MORPHTARGETS
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
#endif`,Vg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Hg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Gg=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Wg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Xg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,qg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Yg=`#ifdef USE_NORMALMAP
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
#endif`,Zg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,$g=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Kg=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Jg=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,jg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Qg=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,t_=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,e_=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,n_=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,i_=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,s_=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,r_=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,o_=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,a_=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,l_=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,c_=`float getShadowMask() {
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
}`,h_=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,u_=`#ifdef USE_SKINNING
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
#endif`,d_=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,f_=`#ifdef USE_SKINNING
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
#endif`,p_=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,m_=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,g_=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,__=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,x_=`#ifdef USE_TRANSMISSION
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
#endif`,y_=`#ifdef USE_TRANSMISSION
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
#endif`,v_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,M_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,S_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,b_=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,w_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,E_=`uniform sampler2D t2D;
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
}`,T_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,A_=`#ifdef ENVMAP_TYPE_CUBE
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
}`,C_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,R_=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,P_=`#include <common>
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
}`,I_=`#if DEPTH_PACKING == 3200
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
}`,L_=`#define DISTANCE
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
}`,U_=`#define DISTANCE
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
}`,D_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,O_=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,N_=`uniform float scale;
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
}`,F_=`uniform vec3 diffuse;
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
}`,B_=`#include <common>
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
}`,k_=`uniform vec3 diffuse;
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
}`,z_=`#define LAMBERT
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
}`,V_=`#define LAMBERT
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
}`,H_=`#define MATCAP
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
}`,G_=`#define MATCAP
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
}`,W_=`#define NORMAL
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
}`,X_=`#define NORMAL
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
}`,q_=`#define PHONG
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
}`,Y_=`#define PHONG
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
}`,Z_=`#define STANDARD
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
}`,$_=`#define STANDARD
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
}`,K_=`#define TOON
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
}`,J_=`#define TOON
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
}`,j_=`uniform float size;
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
}`,Q_=`uniform vec3 diffuse;
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
}`,t0=`#include <common>
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
}`,e0=`uniform vec3 color;
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
}`,n0=`uniform float rotation;
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
}`,i0=`uniform vec3 diffuse;
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
}`,Gt={alphahash_fragment:wm,alphahash_pars_fragment:Em,alphamap_fragment:Tm,alphamap_pars_fragment:Am,alphatest_fragment:Cm,alphatest_pars_fragment:Rm,aomap_fragment:Pm,aomap_pars_fragment:Im,batching_pars_vertex:Lm,batching_vertex:Um,begin_vertex:Dm,beginnormal_vertex:Om,bsdfs:Nm,iridescence_fragment:Fm,bumpmap_pars_fragment:Bm,clipping_planes_fragment:km,clipping_planes_pars_fragment:zm,clipping_planes_pars_vertex:Vm,clipping_planes_vertex:Hm,color_fragment:Gm,color_pars_fragment:Wm,color_pars_vertex:Xm,color_vertex:qm,common:Ym,cube_uv_reflection_fragment:Zm,defaultnormal_vertex:$m,displacementmap_pars_vertex:Km,displacementmap_vertex:Jm,emissivemap_fragment:jm,emissivemap_pars_fragment:Qm,colorspace_fragment:tg,colorspace_pars_fragment:eg,envmap_fragment:ng,envmap_common_pars_fragment:ig,envmap_pars_fragment:sg,envmap_pars_vertex:rg,envmap_physical_pars_fragment:gg,envmap_vertex:og,fog_vertex:ag,fog_pars_vertex:lg,fog_fragment:cg,fog_pars_fragment:hg,gradientmap_pars_fragment:ug,lightmap_pars_fragment:dg,lights_lambert_fragment:fg,lights_lambert_pars_fragment:pg,lights_pars_begin:mg,lights_toon_fragment:_g,lights_toon_pars_fragment:xg,lights_phong_fragment:yg,lights_phong_pars_fragment:vg,lights_physical_fragment:Mg,lights_physical_pars_fragment:Sg,lights_fragment_begin:bg,lights_fragment_maps:wg,lights_fragment_end:Eg,lightprobes_pars_fragment:Tg,logdepthbuf_fragment:Ag,logdepthbuf_pars_fragment:Cg,logdepthbuf_pars_vertex:Rg,logdepthbuf_vertex:Pg,map_fragment:Ig,map_pars_fragment:Lg,map_particle_fragment:Ug,map_particle_pars_fragment:Dg,metalnessmap_fragment:Og,metalnessmap_pars_fragment:Ng,morphinstance_vertex:Fg,morphcolor_vertex:Bg,morphnormal_vertex:kg,morphtarget_pars_vertex:zg,morphtarget_vertex:Vg,normal_fragment_begin:Hg,normal_fragment_maps:Gg,normal_pars_fragment:Wg,normal_pars_vertex:Xg,normal_vertex:qg,normalmap_pars_fragment:Yg,clearcoat_normal_fragment_begin:Zg,clearcoat_normal_fragment_maps:$g,clearcoat_pars_fragment:Kg,iridescence_pars_fragment:Jg,opaque_fragment:jg,packing:Qg,premultiplied_alpha_fragment:t_,project_vertex:e_,dithering_fragment:n_,dithering_pars_fragment:i_,roughnessmap_fragment:s_,roughnessmap_pars_fragment:r_,shadowmap_pars_fragment:o_,shadowmap_pars_vertex:a_,shadowmap_vertex:l_,shadowmask_pars_fragment:c_,skinbase_vertex:h_,skinning_pars_vertex:u_,skinning_vertex:d_,skinnormal_vertex:f_,specularmap_fragment:p_,specularmap_pars_fragment:m_,tonemapping_fragment:g_,tonemapping_pars_fragment:__,transmission_fragment:x_,transmission_pars_fragment:y_,uv_pars_fragment:v_,uv_pars_vertex:M_,uv_vertex:S_,worldpos_vertex:b_,background_vert:w_,background_frag:E_,backgroundCube_vert:T_,backgroundCube_frag:A_,cube_vert:C_,cube_frag:R_,depth_vert:P_,depth_frag:I_,distance_vert:L_,distance_frag:U_,equirect_vert:D_,equirect_frag:O_,linedashed_vert:N_,linedashed_frag:F_,meshbasic_vert:B_,meshbasic_frag:k_,meshlambert_vert:z_,meshlambert_frag:V_,meshmatcap_vert:H_,meshmatcap_frag:G_,meshnormal_vert:W_,meshnormal_frag:X_,meshphong_vert:q_,meshphong_frag:Y_,meshphysical_vert:Z_,meshphysical_frag:$_,meshtoon_vert:K_,meshtoon_frag:J_,points_vert:j_,points_frag:Q_,shadow_vert:t0,shadow_frag:e0,sprite_vert:n0,sprite_frag:i0},gt={common:{diffuse:{value:new Ut(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Ft},alphaMap:{value:null},alphaMapTransform:{value:new Ft},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Ft}},envmap:{envMap:{value:null},envMapRotation:{value:new Ft},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Ft}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Ft}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Ft},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Ft},normalScale:{value:new Ht(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Ft},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Ft}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Ft}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Ft}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ut(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new z},probesMax:{value:new z},probesResolution:{value:new z}},points:{diffuse:{value:new Ut(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Ft},alphaTest:{value:0},uvTransform:{value:new Ft}},sprite:{diffuse:{value:new Ut(16777215)},opacity:{value:1},center:{value:new Ht(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Ft},alphaMap:{value:null},alphaMapTransform:{value:new Ft},alphaTest:{value:0}}},On={basic:{uniforms:Ve([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.fog]),vertexShader:Gt.meshbasic_vert,fragmentShader:Gt.meshbasic_frag},lambert:{uniforms:Ve([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)},envMapIntensity:{value:1}}]),vertexShader:Gt.meshlambert_vert,fragmentShader:Gt.meshlambert_frag},phong:{uniforms:Ve([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)},specular:{value:new Ut(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Gt.meshphong_vert,fragmentShader:Gt.meshphong_frag},standard:{uniforms:Ve([gt.common,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.roughnessmap,gt.metalnessmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag},toon:{uniforms:Ve([gt.common,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.gradientmap,gt.fog,gt.lights,{emissive:{value:new Ut(0)}}]),vertexShader:Gt.meshtoon_vert,fragmentShader:Gt.meshtoon_frag},matcap:{uniforms:Ve([gt.common,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,{matcap:{value:null}}]),vertexShader:Gt.meshmatcap_vert,fragmentShader:Gt.meshmatcap_frag},points:{uniforms:Ve([gt.points,gt.fog]),vertexShader:Gt.points_vert,fragmentShader:Gt.points_frag},dashed:{uniforms:Ve([gt.common,gt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Gt.linedashed_vert,fragmentShader:Gt.linedashed_frag},depth:{uniforms:Ve([gt.common,gt.displacementmap]),vertexShader:Gt.depth_vert,fragmentShader:Gt.depth_frag},normal:{uniforms:Ve([gt.common,gt.bumpmap,gt.normalmap,gt.displacementmap,{opacity:{value:1}}]),vertexShader:Gt.meshnormal_vert,fragmentShader:Gt.meshnormal_frag},sprite:{uniforms:Ve([gt.sprite,gt.fog]),vertexShader:Gt.sprite_vert,fragmentShader:Gt.sprite_frag},background:{uniforms:{uvTransform:{value:new Ft},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Gt.background_vert,fragmentShader:Gt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Ft}},vertexShader:Gt.backgroundCube_vert,fragmentShader:Gt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Gt.cube_vert,fragmentShader:Gt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Gt.equirect_vert,fragmentShader:Gt.equirect_frag},distance:{uniforms:Ve([gt.common,gt.displacementmap,{referencePosition:{value:new z},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Gt.distance_vert,fragmentShader:Gt.distance_frag},shadow:{uniforms:Ve([gt.lights,gt.fog,{color:{value:new Ut(0)},opacity:{value:1}}]),vertexShader:Gt.shadow_vert,fragmentShader:Gt.shadow_frag}};On.physical={uniforms:Ve([On.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Ft},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Ft},clearcoatNormalScale:{value:new Ht(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Ft},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Ft},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Ft},sheen:{value:0},sheenColor:{value:new Ut(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Ft},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Ft},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Ft},transmissionSamplerSize:{value:new Ht},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Ft},attenuationDistance:{value:0},attenuationColor:{value:new Ut(0)},specularColor:{value:new Ut(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Ft},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Ft},anisotropyVector:{value:new Ht},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Ft}}]),vertexShader:Gt.meshphysical_vert,fragmentShader:Gt.meshphysical_frag};var ja={r:0,b:0,g:0},s0=new ne,Gd=new Ft;Gd.set(-1,0,0,0,1,0,0,0,1);function r0(i,t,e,n,s,r){let o=new Ut(0),a=s===!0?0:1,l,c,u=null,f=0,h=null;function p(M){let E=M.isScene===!0?M.background:null;if(E&&E.isTexture){let y=M.backgroundBlurriness>0;E=t.get(E,y)}return E}function g(M){let E=!1,y=p(M);y===null?m(o,a):y&&y.isColor&&(m(y,1),E=!0);let b=i.xr.getEnvironmentBlendMode();b==="additive"?e.buffers.color.setClear(0,0,0,1,r):b==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(i.autoClear||E)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function _(M,E){let y=p(E);y&&(y.isCubeTexture||y.mapping===Ur)?(c===void 0&&(c=new De(new Ln(1,1,1),new Xe({name:"BackgroundCubeMaterial",uniforms:Gi(On.backgroundCube.uniforms),vertexShader:On.backgroundCube.vertexShader,fragmentShader:On.backgroundCube.fragmentShader,side:qe,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(b,S,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=E.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(s0.makeRotationFromEuler(E.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Gd),c.material.toneMapped=Zt.getTransfer(y.colorSpace)!==ee,(u!==y||f!==y.version||h!==i.toneMapping)&&(c.material.needsUpdate=!0,u=y,f=y.version,h=i.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new De(new ki(2,2),new Xe({name:"BackgroundMaterial",uniforms:Gi(On.background.uniforms),vertexShader:On.background.vertexShader,fragmentShader:On.background.fragmentShader,side:_i,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=E.backgroundIntensity,l.material.toneMapped=Zt.getTransfer(y.colorSpace)!==ee,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(u!==y||f!==y.version||h!==i.toneMapping)&&(l.material.needsUpdate=!0,u=y,f=y.version,h=i.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function m(M,E){M.getRGB(ja,Oc(i)),e.buffers.color.setClear(ja.r,ja.g,ja.b,E,r)}function d(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,E=1){o.set(M),a=E,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(M){a=M,m(o,a)},render:g,addToRenderList:_,dispose:d}}function o0(i,t){let e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=h(null),r=s,o=!1;function a(A,P,D,L,F){let U=!1,O=f(A,L,D,P);r!==O&&(r=O,c(r.object)),U=p(A,L,D,F),U&&g(A,L,D,F),F!==null&&t.update(F,i.ELEMENT_ARRAY_BUFFER),(U||o)&&(o=!1,y(A,P,D,L),F!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(F).buffer))}function l(){return i.createVertexArray()}function c(A){return i.bindVertexArray(A)}function u(A){return i.deleteVertexArray(A)}function f(A,P,D,L){let F=L.wireframe===!0,U=n[P.id];U===void 0&&(U={},n[P.id]=U);let O=A.isInstancedMesh===!0?A.id:0,q=U[O];q===void 0&&(q={},U[O]=q);let H=q[D.id];H===void 0&&(H={},q[D.id]=H);let j=H[F];return j===void 0&&(j=h(l()),H[F]=j),j}function h(A){let P=[],D=[],L=[];for(let F=0;F<e;F++)P[F]=0,D[F]=0,L[F]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:P,enabledAttributes:D,attributeDivisors:L,object:A,attributes:{},index:null}}function p(A,P,D,L){let F=r.attributes,U=P.attributes,O=0,q=D.getAttributes();for(let H in q)if(q[H].location>=0){let it=F[H],X=U[H];if(X===void 0&&(H==="instanceMatrix"&&A.instanceMatrix&&(X=A.instanceMatrix),H==="instanceColor"&&A.instanceColor&&(X=A.instanceColor)),it===void 0||it.attribute!==X||X&&it.data!==X.data)return!0;O++}return r.attributesNum!==O||r.index!==L}function g(A,P,D,L){let F={},U=P.attributes,O=0,q=D.getAttributes();for(let H in q)if(q[H].location>=0){let it=U[H];it===void 0&&(H==="instanceMatrix"&&A.instanceMatrix&&(it=A.instanceMatrix),H==="instanceColor"&&A.instanceColor&&(it=A.instanceColor));let X={};X.attribute=it,it&&it.data&&(X.data=it.data),F[H]=X,O++}r.attributes=F,r.attributesNum=O,r.index=L}function _(){let A=r.newAttributes;for(let P=0,D=A.length;P<D;P++)A[P]=0}function m(A){d(A,0)}function d(A,P){let D=r.newAttributes,L=r.enabledAttributes,F=r.attributeDivisors;D[A]=1,L[A]===0&&(i.enableVertexAttribArray(A),L[A]=1),F[A]!==P&&(i.vertexAttribDivisor(A,P),F[A]=P)}function M(){let A=r.newAttributes,P=r.enabledAttributes;for(let D=0,L=P.length;D<L;D++)P[D]!==A[D]&&(i.disableVertexAttribArray(D),P[D]=0)}function E(A,P,D,L,F,U,O){O===!0?i.vertexAttribIPointer(A,P,D,F,U):i.vertexAttribPointer(A,P,D,L,F,U)}function y(A,P,D,L){_();let F=L.attributes,U=D.getAttributes(),O=P.defaultAttributeValues;for(let q in U){let H=U[q];if(H.location>=0){let j=F[q];if(j===void 0&&(q==="instanceMatrix"&&A.instanceMatrix&&(j=A.instanceMatrix),q==="instanceColor"&&A.instanceColor&&(j=A.instanceColor)),j!==void 0){let it=j.normalized,X=j.itemSize,nt=t.get(j);if(nt===void 0)continue;let lt=nt.buffer,ct=nt.type,bt=nt.bytesPerElement,Y=ct===i.INT||ct===i.UNSIGNED_INT||j.gpuType===da;if(j.isInterleavedBufferAttribute){let J=j.data,ot=J.stride,wt=j.offset;if(J.isInstancedInterleavedBuffer){for(let _t=0;_t<H.locationSize;_t++)d(H.location+_t,J.meshPerAttribute);A.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let _t=0;_t<H.locationSize;_t++)m(H.location+_t);i.bindBuffer(i.ARRAY_BUFFER,lt);for(let _t=0;_t<H.locationSize;_t++)E(H.location+_t,X/H.locationSize,ct,it,ot*bt,(wt+X/H.locationSize*_t)*bt,Y)}else{if(j.isInstancedBufferAttribute){for(let J=0;J<H.locationSize;J++)d(H.location+J,j.meshPerAttribute);A.isInstancedMesh!==!0&&L._maxInstanceCount===void 0&&(L._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let J=0;J<H.locationSize;J++)m(H.location+J);i.bindBuffer(i.ARRAY_BUFFER,lt);for(let J=0;J<H.locationSize;J++)E(H.location+J,X/H.locationSize,ct,it,X*bt,X/H.locationSize*J*bt,Y)}}else if(O!==void 0){let it=O[q];if(it!==void 0)switch(it.length){case 2:i.vertexAttrib2fv(H.location,it);break;case 3:i.vertexAttrib3fv(H.location,it);break;case 4:i.vertexAttrib4fv(H.location,it);break;default:i.vertexAttrib1fv(H.location,it)}}}}M()}function b(){T();for(let A in n){let P=n[A];for(let D in P){let L=P[D];for(let F in L){let U=L[F];for(let O in U)u(U[O].object),delete U[O];delete L[F]}}delete n[A]}}function S(A){if(n[A.id]===void 0)return;let P=n[A.id];for(let D in P){let L=P[D];for(let F in L){let U=L[F];for(let O in U)u(U[O].object),delete U[O];delete L[F]}}delete n[A.id]}function C(A){for(let P in n){let D=n[P];for(let L in D){let F=D[L];if(F[A.id]===void 0)continue;let U=F[A.id];for(let O in U)u(U[O].object),delete U[O];delete F[A.id]}}}function v(A){for(let P in n){let D=n[P],L=A.isInstancedMesh===!0?A.id:0,F=D[L];if(F!==void 0){for(let U in F){let O=F[U];for(let q in O)u(O[q].object),delete O[q];delete F[U]}delete D[L],Object.keys(D).length===0&&delete n[P]}}}function T(){R(),o=!0,r!==s&&(r=s,c(r.object))}function R(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:T,resetDefaultState:R,dispose:b,releaseStatesOfGeometry:S,releaseStatesOfObject:v,releaseStatesOfProgram:C,initAttributes:_,enableAttribute:m,disableUnusedAttributes:M}}function a0(i,t,e){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),e.update(c,n,1)}function o(l,c,u){u!==0&&(i.drawArraysInstanced(n,l,c,u),e.update(c,n,u))}function a(l,c,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,u);let h=0;for(let p=0;p<u;p++)h+=c[p];e.update(h,n,1)}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function l0(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let C=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(C){return!(C!==dn&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(C){let v=C===bn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==Ke&&C!==un&&!v&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(C){if(C==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",u=l(c);u!==c&&(Lt("WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);let f=e.logarithmicDepthBuffer===!0,h=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&h===!1&&Lt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),d=i.getParameter(i.MAX_VERTEX_ATTRIBS),M=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),E=i.getParameter(i.MAX_VARYING_VECTORS),y=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),b=i.getParameter(i.MAX_SAMPLES),S=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:h,maxTextures:p,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:d,maxVertexUniforms:M,maxVaryings:E,maxFragmentUniforms:y,maxSamples:b,samples:S}}function c0(i){let t=this,e=null,n=0,s=!1,r=!1,o=new _n,a=new Ft,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,h){let p=f.length!==0||h||n!==0||s;return s=h,n=f.length,p},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,h){e=u(f,h,0)},this.setState=function(f,h,p){let g=f.clippingPlanes,_=f.clipIntersection,m=f.clipShadows,d=i.get(f);if(!s||g===null||g.length===0||r&&!m)r?u(null):c();else{let M=r?0:n,E=M*4,y=d.clippingState||null;l.value=y,y=u(g,h,E,p);for(let b=0;b!==E;++b)y[b]=e[b];d.clippingState=y,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function u(f,h,p,g){let _=f!==null?f.length:0,m=null;if(_!==0){if(m=l.value,g!==!0||m===null){let d=p+_*4,M=h.matrixWorldInverse;a.getNormalMatrix(M),(m===null||m.length<d)&&(m=new Float32Array(d));for(let E=0,y=p;E!==_;++E,y+=4)o.copy(f[E]).applyMatrix4(M,a),o.normal.toArray(m,y),m[y+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}var Os=4,h0=6,u0=20,d0=256,Vr=new gi,Md=new Ut,kc=null,zc=0,Vc=0,Hc=!1,f0=new z,Wi=new z,tl=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,n=.1,s=100,r={}){let{size:o=256,position:a=f0}=r;kc=this._renderer.getRenderTarget(),zc=this._renderer.getActiveCubeFace(),Vc=this._renderer.getActiveMipmapLevel(),Hc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,n,s,l,a),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=wd(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=bd(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(kc,zc,Vc),this._renderer.xr.enabled=Hc,t.scissorTest=!1,Ds(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===xi||t.mapping===Hi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),kc=this._renderer.getRenderTarget(),zc=this._renderer.getActiveCubeFace(),Vc=this._renderer.getActiveMipmapLevel(),Hc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Le,minFilter:Le,generateMipmaps:!1,type:bn,format:dn,colorSpace:fr,depthBuffer:!1},s=Sd(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Sd(t,e,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=p0(r)),this._blurMaterial=g0(r,t,e),this._ggxMaterial=m0(r,t,e)}return s}_compileMaterial(t){let e=new De(new Ee,t);this._renderer.compile(e,Vr)}_sceneToCubeUV(t,e,n,s,r){let l=new Ze(90,1,e,n),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],f=this._renderer,h=f.autoClear,p=f.toneMapping;f.getClearColor(Md),f.toneMapping=Mn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(s),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new De(new Ln,new $n({name:"PMREM.Background",side:qe,depthWrite:!1,depthTest:!1})));let _=this._backgroundBox,m=_.material,d=!1,M=t.background;M?M.isColor&&(m.color.copy(M),t.background=null,d=!0):(m.color.copy(Md),d=!0);for(let E=0;E<6;E++){let y=E%3;y===0?(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+u[E],r.y,r.z)):y===1?(l.up.set(0,0,c[E]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+u[E],r.z)):(l.up.set(0,c[E],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+u[E]));let b=this._cubeSize;Ds(s,y*b,E>2?b:0,b,b),f.setRenderTarget(s),d&&f.render(_,l),f.render(t,l)}f.toneMapping=p,f.autoClear=h,t.background=M}_textureToCubeUV(t,e){let n=this._renderer,s=t.mapping===xi||t.mapping===Hi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=wd()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=bd());let r=s?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=t;let l=this._cubeSize;Ds(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(o,Vr)}_applyPMREM(t){let e=this._renderer,n=e.autoClear;e.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=n}_applyGGXFilter(t,e,n){let s=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[n];a.material=o;let l=o.uniforms,c=n/(this._lodMeshes.length-1),u=e/(this._lodMeshes.length-1),f=Math.sqrt(c*c-u*u),h=c*1.25,p=f*h,{_lodMax:g}=this,_=this._sizeLods[n],m=3*_*(n>g-Os?n-g+Os:0),d=4*(this._cubeSize-_);l.envMap.value=t.texture,l.roughness.value=p,l.mipInt.value=g-e,Ds(r,m,d,3*_,2*_),s.setRenderTarget(r),s.render(a,Vr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=g-n,Ds(t,m,d,3*_,2*_),s.setRenderTarget(t),s.render(a,Vr)}_blur(t,e,n,s){let r=this._pingPongRenderTarget,o=Math.min(s,Math.PI)/Math.SQRT2;this._blurPass(t,r,e,n,o),this._blurPass(r,t,n,n,o)}_blurPass(t,e,n,s,r){let o=this._renderer,a=this._blurMaterial,l=this._lodMeshes[s];l.material=a;let c=a.uniforms;c.envMap.value=t.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-n;let u=this._sizeLods[s],f=3*u*(s>this._lodMax-Os?s-this._lodMax+Os:0),h=4*(this._cubeSize-u);Ds(e,f,h,3*u,2*u),o.setRenderTarget(e),o.render(l,Vr)}};function p0(i){let t=[],e=[],n=i,s=i-Os+1+h0;for(let r=0;r<s;r++){let o=Math.pow(2,n);t.push(o);let a=1/(o-2),l=-a,c=1+a,u=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,h=6,p=3,g=new Float32Array(p*h*f),_=new Float32Array(p*h*f);for(let d=0;d<f;d++){let M=d%3*2/3-1,E=d>2?0:-1,y=[M,E,0,M+2/3,E,0,M+2/3,E+1,0,M,E,0,M+2/3,E+1,0,M,E+1,0];g.set(y,p*h*d);for(let b=0;b<h;b++){let S=u[b*2]*2-1,C=u[b*2+1]*2-1;d===0?Wi.set(1,C,S):d===1?Wi.set(-S,1,-C):d===2?Wi.set(-S,C,1):d===3?Wi.set(-1,C,-S):d===4?Wi.set(-S,-1,C):Wi.set(S,C,-1),Wi.toArray(_,(d*h+b)*p)}}let m=new Ee;m.setAttribute("position",new we(g,p)),m.setAttribute("outputDirection",new we(_,p)),e.push(new De(m,null)),n>Os&&n--}return{lodMeshes:e,sizeLods:t}}function Sd(i,t,e){let n=new $e(i,t,e);return n.texture.mapping=Ur,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ds(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function m0(i,t,e){return new Xe({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:d0,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:nl(),fragmentShader:`

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
		`,blending:Un,depthTest:!1,depthWrite:!1})}function g0(i,t,e){return new Xe({name:"SphericalGaussianBlur",defines:{SAMPLES:u0,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:nl(),fragmentShader:`

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
		`,blending:Un,depthTest:!1,depthWrite:!1})}function bd(){return new Xe({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:nl(),fragmentShader:`

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
		`,blending:Un,depthTest:!1,depthWrite:!1})}function wd(){return new Xe({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:nl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Un,depthTest:!1,depthWrite:!1})}function nl(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var el=class extends $e{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new Sr(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Ln(5,5,5),r=new Xe({name:"CubemapFromEquirect",uniforms:Gi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:qe,blending:Un});r.uniforms.tEquirect.value=e;let o=new De(s,r),a=e.minFilter;return e.minFilter===yi&&(e.minFilter=Le),new aa(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e=!0,n=!0,s=!0){let r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}};function _0(i){let t=new WeakMap,e=new WeakMap,n=null;function s(h,p=!1){return h==null?null:p?o(h):r(h)}function r(h){if(h&&h.isTexture){let p=h.mapping;if(p===ca||p===ha)if(t.has(h)){let g=t.get(h).texture;return a(g,h.mapping)}else{let g=h.image;if(g&&g.height>0){let _=new el(g.height);return _.fromEquirectangularTexture(i,h),t.set(h,_),h.addEventListener("dispose",c),a(_.texture,h.mapping)}else return null}}return h}function o(h){if(h&&h.isTexture){let p=h.mapping,g=p===ca||p===ha,_=p===xi||p===Hi;if(g||_){let m=e.get(h),d=m!==void 0?m.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==d)return n===null&&(n=new tl(i)),m=g?n.fromEquirectangular(h,m):n.fromCubemap(h,m),m.texture.pmremVersion=h.pmremVersion,e.set(h,m),m.texture;if(m!==void 0)return m.texture;{let M=h.image;return g&&M&&M.height>0||_&&M&&l(M)?(n===null&&(n=new tl(i)),m=g?n.fromEquirectangular(h):n.fromCubemap(h),m.texture.pmremVersion=h.pmremVersion,e.set(h,m),h.addEventListener("dispose",u),m.texture):null}}}return h}function a(h,p){return p===ca?h.mapping=xi:p===ha&&(h.mapping=Hi),h}function l(h){let p=0,g=6;for(let _=0;_<g;_++)h[_]!==void 0&&p++;return p===g}function c(h){let p=h.target;p.removeEventListener("dispose",c);let g=t.get(p);g!==void 0&&(t.delete(p),g.dispose())}function u(h){let p=h.target;p.removeEventListener("dispose",u);let g=e.get(p);g!==void 0&&(e.delete(p),g.dispose())}function f(){t=new WeakMap,e=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:f}}function x0(i){let t={};function e(n){if(t[n]!==void 0)return t[n];let s=i.getExtension(n);return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){let s=e(n);return s===null&&Fi("WebGLRenderer: "+n+" extension not supported."),s}}}function y0(i,t,e,n){let s={},r=new WeakMap;function o(f){let h=f.target;h.index!==null&&t.remove(h.index);for(let g in h.attributes)t.remove(h.attributes[g]);h.removeEventListener("dispose",o),delete s[h.id];let p=r.get(h);p&&(t.remove(p),r.delete(h)),n.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,e.memory.geometries--}function a(f,h){return s[h.id]===!0||(h.addEventListener("dispose",o),s[h.id]=!0,e.memory.geometries++),h}function l(f){let h=f.attributes;for(let p in h)t.update(h[p],i.ARRAY_BUFFER)}function c(f){let h=[],p=f.index,g=f.attributes.position,_=0;if(g===void 0)return;if(p!==null){let M=p.array;_=p.version;for(let E=0,y=M.length;E<y;E+=3){let b=M[E+0],S=M[E+1],C=M[E+2];h.push(b,S,S,C,C,b)}}else{let M=g.array;_=g.version;for(let E=0,y=M.length/3-1;E<y;E+=3){let b=E+0,S=E+1,C=E+2;h.push(b,S,S,C,C,b)}}let m=new(g.count>=65535?yr:xr)(h,1);m.version=_;let d=r.get(f);d&&t.remove(d),r.set(f,m)}function u(f){let h=r.get(f);if(h){let p=f.index;p!==null&&h.version<p.version&&c(f)}else c(f);return r.get(f)}return{get:a,update:l,getWireframeAttribute:u}}function v0(i,t,e){let n;function s(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,h){i.drawElements(n,h,r,f*o),e.update(h,n,1)}function c(f,h,p){p!==0&&(i.drawElementsInstanced(n,h,r,f*o,p),e.update(h,n,p))}function u(f,h,p){if(p===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,h,0,r,f,0,p);let _=0;for(let m=0;m<p;m++)_+=h[m];e.update(_,n,1)}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=u}function M0(i){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:Ot("WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function S0(i,t,e){let n=new WeakMap,s=new he;function r(o,a,l){let c=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=u!==void 0?u.length:0,h=n.get(a);if(h===void 0||h.count!==f){let T=function(){C.dispose(),n.delete(a),a.removeEventListener("dispose",T)};h!==void 0&&h.texture.dispose();let p=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],d=a.morphAttributes.normal||[],M=a.morphAttributes.color||[],E=0;p===!0&&(E=1),g===!0&&(E=2),_===!0&&(E=3);let y=a.attributes.position.count*E,b=1;y>t.maxTextureSize&&(b=Math.ceil(y/t.maxTextureSize),y=t.maxTextureSize);let S=new Float32Array(y*b*4*f),C=new gr(S,y,b,f);C.type=un,C.needsUpdate=!0;let v=E*4;for(let R=0;R<f;R++){let A=m[R],P=d[R],D=M[R],L=y*b*4*R;for(let F=0;F<A.count;F++){let U=F*v;p===!0&&(s.fromBufferAttribute(A,F),S[L+U+0]=s.x,S[L+U+1]=s.y,S[L+U+2]=s.z,S[L+U+3]=0),g===!0&&(s.fromBufferAttribute(P,F),S[L+U+4]=s.x,S[L+U+5]=s.y,S[L+U+6]=s.z,S[L+U+7]=0),_===!0&&(s.fromBufferAttribute(D,F),S[L+U+8]=s.x,S[L+U+9]=s.y,S[L+U+10]=s.z,S[L+U+11]=D.itemSize===4?s.w:1)}}h={count:f,texture:C,size:new Ht(y,b)},n.set(a,h),a.addEventListener("dispose",T)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let p=0;for(let _=0;_<c.length;_++)p+=c[_];let g=a.morphTargetsRelative?1:1-p;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",h.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",h.size)}return{update:r}}function b0(i,t,e,n,s){let r=new WeakMap;function o(c){let u=s.render.frame,f=c.geometry,h=t.get(c,f);if(r.get(h)!==u&&(t.update(h),r.set(h,u)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==u&&(e.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,u))),c.isSkinnedMesh){let p=c.skeleton;r.get(p)!==u&&(p.update(),r.set(p,u))}return h}function a(){r=new WeakMap}function l(c){let u=c.target;u.removeEventListener("dispose",l),n.releaseStatesOfObject(u),e.remove(u.instanceMatrix),u.instanceColor!==null&&e.remove(u.instanceColor)}return{update:o,dispose:a}}var w0={[xc]:"LINEAR_TONE_MAPPING",[yc]:"REINHARD_TONE_MAPPING",[vc]:"CINEON_TONE_MAPPING",[Mc]:"ACES_FILMIC_TONE_MAPPING",[bc]:"AGX_TONE_MAPPING",[wc]:"NEUTRAL_TONE_MAPPING",[Sc]:"CUSTOM_TONE_MAPPING"};function E0(i,t,e,n,s,r){let o=new $e(t,e,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new Ee;c.setAttribute("position",new pe([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new pe([0,2,0,0,2,0],2));let u=new Yo({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),f=new De(c,u),h=new gi(-1,1,1,-1,0,1),p=null,g=null,_=!1,m,d=null,M=[],E=!1;this.setSize=function(y,b){o.setSize(y,b),a!==null&&a.setSize(y,b),l!==null&&l.setSize(y,b);for(let S=0;S<M.length;S++){let C=M[S];C.setSize&&C.setSize(y,b)}},this.setEffects=function(y){M=y,E=M.length>0&&M[0].isRenderPass===!0;let b=o.width,S=o.height;M.length>0&&a===null&&(a=new $e(b,S,{type:bn,depthBuffer:!1,stencilBuffer:!1}),l=new $e(b,S,{type:bn,depthBuffer:!1,stencilBuffer:!1}));for(let C=0;C<M.length;C++){let v=M[C];v.setSize&&v.setSize(b,S)}},this.begin=function(y,b){if(_||y.toneMapping===Mn&&M.length===0)return!1;if(d=b,b!==null){let S=b.width,C=b.height;(o.width!==S||o.height!==C)&&this.setSize(S,C)}return E===!1&&y.setRenderTarget(o),m=y.toneMapping,y.toneMapping=Mn,!0},this.hasRenderPass=function(){return E},this.end=function(y,b){y.toneMapping=m,_=!0;let S=o,C=a;for(let v=0;v<M.length;v++){let T=M[v];T.enabled!==!1&&(T.render(y,C,S,b),T.needsSwap!==!1&&(S=C,C=C===a?l:a))}if(p!==y.outputColorSpace||g!==y.toneMapping){p=y.outputColorSpace,g=y.toneMapping,u.defines={},Zt.getTransfer(p)===ee&&(u.defines.SRGB_TRANSFER="");let v=w0[g];v&&(u.defines[v]=""),u.needsUpdate=!0}u.uniforms.tDiffuse.value=S.texture,y.setRenderTarget(d),y.render(f,h),d=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),c.dispose(),u.dispose()}}var Wd=new ze,Xc=new hi(1,1),Xd=new gr,qd=new Ho,Yd=new Sr,Ed=[],Td=[],Ad=new Float32Array(16),Cd=new Float32Array(9),Rd=new Float32Array(4);function Bs(i,t,e){let n=i[0];if(n<=0||n>0)return i;let s=t*e,r=Ed[s];if(r===void 0&&(r=new Float32Array(s),Ed[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function Ae(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Ce(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function il(i,t){let e=Td[t];e===void 0&&(e=new Int32Array(t),Td[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function T0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function A0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ae(e,t))return;i.uniform2fv(this.addr,t),Ce(e,t)}}function C0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Ae(e,t))return;i.uniform3fv(this.addr,t),Ce(e,t)}}function R0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ae(e,t))return;i.uniform4fv(this.addr,t),Ce(e,t)}}function P0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Ae(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Ce(e,t)}else{if(Ae(e,n))return;Rd.set(n),i.uniformMatrix2fv(this.addr,!1,Rd),Ce(e,n)}}function I0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Ae(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Ce(e,t)}else{if(Ae(e,n))return;Cd.set(n),i.uniformMatrix3fv(this.addr,!1,Cd),Ce(e,n)}}function L0(i,t){let e=this.cache,n=t.elements;if(n===void 0){if(Ae(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Ce(e,t)}else{if(Ae(e,n))return;Ad.set(n),i.uniformMatrix4fv(this.addr,!1,Ad),Ce(e,n)}}function U0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function D0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ae(e,t))return;i.uniform2iv(this.addr,t),Ce(e,t)}}function O0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ae(e,t))return;i.uniform3iv(this.addr,t),Ce(e,t)}}function N0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ae(e,t))return;i.uniform4iv(this.addr,t),Ce(e,t)}}function F0(i,t){let e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function B0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ae(e,t))return;i.uniform2uiv(this.addr,t),Ce(e,t)}}function k0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ae(e,t))return;i.uniform3uiv(this.addr,t),Ce(e,t)}}function z0(i,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ae(e,t))return;i.uniform4uiv(this.addr,t),Ce(e,t)}}function V0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Xc.compareFunction=e.isReversedDepthBuffer()?Ja:Ka,r=Xc):r=Wd,e.setTexture2D(t||r,s)}function H0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||qd,s)}function G0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||Yd,s)}function W0(i,t,e){let n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Xd,s)}function X0(i){switch(i){case 5126:return T0;case 35664:return A0;case 35665:return C0;case 35666:return R0;case 35674:return P0;case 35675:return I0;case 35676:return L0;case 5124:case 35670:return U0;case 35667:case 35671:return D0;case 35668:case 35672:return O0;case 35669:case 35673:return N0;case 5125:return F0;case 36294:return B0;case 36295:return k0;case 36296:return z0;case 35678:case 36198:case 36298:case 36306:case 35682:return V0;case 35679:case 36299:case 36307:return H0;case 35680:case 36300:case 36308:case 36293:return G0;case 36289:case 36303:case 36311:case 36292:return W0}}function q0(i,t){i.uniform1fv(this.addr,t)}function Y0(i,t){let e=Bs(t,this.size,2);i.uniform2fv(this.addr,e)}function Z0(i,t){let e=Bs(t,this.size,3);i.uniform3fv(this.addr,e)}function $0(i,t){let e=Bs(t,this.size,4);i.uniform4fv(this.addr,e)}function K0(i,t){let e=Bs(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function J0(i,t){let e=Bs(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function j0(i,t){let e=Bs(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function Q0(i,t){i.uniform1iv(this.addr,t)}function tx(i,t){i.uniform2iv(this.addr,t)}function ex(i,t){i.uniform3iv(this.addr,t)}function nx(i,t){i.uniform4iv(this.addr,t)}function ix(i,t){i.uniform1uiv(this.addr,t)}function sx(i,t){i.uniform2uiv(this.addr,t)}function rx(i,t){i.uniform3uiv(this.addr,t)}function ox(i,t){i.uniform4uiv(this.addr,t)}function ax(i,t,e){let n=this.cache,s=t.length,r=il(e,s);Ae(n,r)||(i.uniform1iv(this.addr,r),Ce(n,r));let o;this.type===i.SAMPLER_2D_SHADOW?o=Xc:o=Wd;for(let a=0;a!==s;++a)e.setTexture2D(t[a]||o,r[a])}function lx(i,t,e){let n=this.cache,s=t.length,r=il(e,s);Ae(n,r)||(i.uniform1iv(this.addr,r),Ce(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||qd,r[o])}function cx(i,t,e){let n=this.cache,s=t.length,r=il(e,s);Ae(n,r)||(i.uniform1iv(this.addr,r),Ce(n,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||Yd,r[o])}function hx(i,t,e){let n=this.cache,s=t.length,r=il(e,s);Ae(n,r)||(i.uniform1iv(this.addr,r),Ce(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||Xd,r[o])}function ux(i){switch(i){case 5126:return q0;case 35664:return Y0;case 35665:return Z0;case 35666:return $0;case 35674:return K0;case 35675:return J0;case 35676:return j0;case 5124:case 35670:return Q0;case 35667:case 35671:return tx;case 35668:case 35672:return ex;case 35669:case 35673:return nx;case 5125:return ix;case 36294:return sx;case 36295:return rx;case 36296:return ox;case 35678:case 36198:case 36298:case 36306:case 35682:return ax;case 35679:case 36299:case 36307:return lx;case 35680:case 36300:case 36308:case 36293:return cx;case 36289:case 36303:case 36311:case 36292:return hx}}var qc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=X0(e.type)}},Yc=class{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=ux(e.type)}},Zc=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){let s=this.seq;for(let r=0,o=s.length;r!==o;++r){let a=s[r];a.setValue(t,e[a.id],n)}}},Gc=/(\w+)(\])?(\[|\.)?/g;function Pd(i,t){i.seq.push(t),i.map[t.id]=t}function dx(i,t,e){let n=i.name,s=n.length;for(Gc.lastIndex=0;;){let r=Gc.exec(n),o=Gc.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){Pd(e,c===void 0?new qc(a,i,t):new Yc(a,i,t));break}else{let f=e.map[a];f===void 0&&(f=new Zc(a),Pd(e,f)),e=f}}}var Ns=class{constructor(t,e){this.seq=[],this.map={};let n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=t.getActiveUniform(e,o),l=t.getUniformLocation(e,a.name);dx(a,l,this)}let s=[],r=[];for(let o of this.seq)o.type===t.SAMPLER_2D_SHADOW||o.type===t.SAMPLER_CUBE_SHADOW||o.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(o):r.push(o);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,n,s){let r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){let s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){let a=e[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,s)}}static seqWithValue(t,e){let n=[];for(let s=0,r=t.length;s!==r;++s){let o=t[s];o.id in e&&n.push(o)}return n}};function Id(i,t,e){let n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}var fx=37297,px=0;function mx(i,t){let e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){let a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}var Ld=new Ft;function gx(i){Zt._getMatrix(Ld,Zt.workingColorSpace,i);let t=`mat3( ${Ld.elements.map(e=>e.toFixed(4))} )`;switch(Zt.getTransfer(i)){case pr:return[t,"LinearTransferOETF"];case ee:return[t,"sRGBTransferOETF"];default:return Lt("WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Ud(i,t,e){let n=i.getShaderParameter(t,i.COMPILE_STATUS),r=(i.getShaderInfoLog(t)||"").trim();if(n&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return e.toUpperCase()+`

`+r+`

`+mx(i.getShaderSource(t),a)}else return r}function _x(i,t){let e=gx(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var xx={[xc]:"Linear",[yc]:"Reinhard",[vc]:"Cineon",[Mc]:"ACESFilmic",[bc]:"AgX",[wc]:"Neutral",[Sc]:"Custom"};function yx(i,t){let e=xx[t];return e===void 0?(Lt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var Qa=new z;function vx(){Zt.getLuminanceCoefficients(Qa);let i=Qa.x.toFixed(4),t=Qa.y.toFixed(4),e=Qa.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Mx(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Gr).join(`
`)}function Sx(i){let t=[];for(let e in i){let n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function bx(i,t){let e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){let r=i.getActiveAttrib(t,s),o=r.name,a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function Gr(i){return i!==""}function Dd(i,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Od(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var wx=/^[ \t]*#include +<([\w\d./]+)>/gm;function $c(i){return i.replace(wx,Tx)}var Ex=new Map;function Tx(i,t){let e=Gt[t];if(e===void 0){let n=Ex.get(t);if(n!==void 0)e=Gt[n],Lt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return $c(e)}var Ax=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Nd(i){return i.replace(Ax,Cx)}function Cx(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Fd(i){let t=`precision ${i.precision} float;
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
#define LOW_PRECISION`),t}var Rx={[Lr]:"SHADOWMAP_TYPE_PCF",[Rs]:"SHADOWMAP_TYPE_VSM"};function Px(i){return Rx[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Ix={[xi]:"ENVMAP_TYPE_CUBE",[Hi]:"ENVMAP_TYPE_CUBE",[Ur]:"ENVMAP_TYPE_CUBE_UV"};function Lx(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Ix[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var Ux={[Hi]:"ENVMAP_MODE_REFRACTION"};function Dx(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":Ux[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Ox={[_c]:"ENVMAP_BLENDING_MULTIPLY",[td]:"ENVMAP_BLENDING_MIX",[ed]:"ENVMAP_BLENDING_ADD"};function Nx(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Ox[i.combine]||"ENVMAP_BLENDING_NONE"}function Fx(i){let t=i.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Bx(i,t,e,n){let s=i.getContext(),r=e.defines,o=e.vertexShader,a=e.fragmentShader,l=Px(e),c=Lx(e),u=Dx(e),f=Nx(e),h=Fx(e),p=Mx(e),g=Sx(r),_=s.createProgram(),m,d,M=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Gr).join(`
`),m.length>0&&(m+=`
`),d=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Gr).join(`
`),d.length>0&&(d+=`
`)):(m=[Fd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+u:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Gr).join(`
`),d=[Fd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+u:"",e.envMap?"#define "+f:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.retroreflection?"#define USE_RETROREFLECTION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Mn?"#define TONE_MAPPING":"",e.toneMapping!==Mn?Gt.tonemapping_pars_fragment:"",e.toneMapping!==Mn?yx("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Gt.colorspace_pars_fragment,_x("linearToOutputTexel",e.outputColorSpace),vx(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Gr).join(`
`)),o=$c(o),o=Dd(o,e),o=Od(o,e),a=$c(a),a=Dd(a,e),a=Od(a,e),o=Nd(o),a=Nd(a),e.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,d=["#define varying in",e.glslVersion===Lc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===Lc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+d);let E=M+m+o,y=M+d+a,b=Id(s,s.VERTEX_SHADER,E),S=Id(s,s.FRAGMENT_SHADER,y);s.attachShader(_,b),s.attachShader(_,S),e.index0AttributeName!==void 0?s.bindAttribLocation(_,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(_,0,"position"),s.linkProgram(_);function C(A){if(i.debug.checkShaderErrors){let P=s.getProgramInfoLog(_)||"",D=s.getShaderInfoLog(b)||"",L=s.getShaderInfoLog(S)||"",F=P.trim(),U=D.trim(),O=L.trim(),q=!0,H=!0;if(s.getProgramParameter(_,s.LINK_STATUS)===!1)if(q=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,_,b,S);else{let j=Ud(s,b,"vertex"),it=Ud(s,S,"fragment");Ot("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(_,s.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+F+`
`+j+`
`+it)}else F!==""?Lt("WebGLProgram: Program Info Log:",F):(U===""||O==="")&&(H=!1);H&&(A.diagnostics={runnable:q,programLog:F,vertexShader:{log:U,prefix:m},fragmentShader:{log:O,prefix:d}})}s.deleteShader(b),s.deleteShader(S),v=new Ns(s,_),T=bx(s,_)}let v;this.getUniforms=function(){return v===void 0&&C(this),v};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let R=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return R===!1&&(R=s.getProgramParameter(_,fx)),R},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=px++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=b,this.fragmentShader=S,this}var kx=0,Kc=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,n){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){let e=this.shaderCache,n=e.get(t);return n===void 0&&(n=new Jc(t),e.set(t,n)),n}},Jc=class{constructor(t){this.id=kx++,this.code=t,this.usedTimes=0}};function zx(i){return i===Mi||i===kr||i===zr}function Vx(i,t,e,n,s,r){let o=new bs,a=new Kc,l=new Set,c=[],u=new Map,f=n.logarithmicDepthBuffer,h=n.precision,p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(v){return l.add(v),v===0?"uv":`uv${v}`}function _(v,T,R,A,P,D){let L=A.fog,F=P.geometry,U=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?A.environment:null,O=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,q=t.get(v.envMap||U,O),H=q&&q.mapping===Ur?q.image.height:null,j=p[v.type];v.precision!==null&&(h=n.getMaxPrecision(v.precision),h!==v.precision&&Lt("WebGLProgram.getParameters:",v.precision,"not supported, using",h,"instead."));let it=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,X=it!==void 0?it.length:0,nt=0;F.morphAttributes.position!==void 0&&(nt=1),F.morphAttributes.normal!==void 0&&(nt=2),F.morphAttributes.color!==void 0&&(nt=3);let lt,ct,bt,Y;if(j){let le=On[j];lt=le.vertexShader,ct=le.fragmentShader}else{lt=v.vertexShader,ct=v.fragmentShader;let le=a.getVertexShaderStage(v),Qt=a.getFragmentShaderStage(v);a.update(v,le,Qt),bt=le.id,Y=Qt.id}let J=i.getRenderTarget(),ot=i.state.buffers.depth.getReversed(),wt=P.isInstancedMesh===!0,_t=P.isBatchedMesh===!0,zt=!!v.map,Te=!!v.matcap,Xt=!!q,Kt=!!v.aoMap,ae=!!v.lightMap,Yt=!!v.bumpMap&&v.wireframe===!1,me=!!v.normalMap,Re=!!v.displacementMap,Ye=!!v.emissiveMap,_e=!!v.metalnessMap,Me=!!v.roughnessMap,k=v.anisotropy>0,Ne=v.clearcoat>0,se=v.dispersion>0,I=v.retroreflectivity>0,x=v.iridescence>0,V=v.sheen>0,Z=v.transmission>0,Q=k&&!!v.anisotropyMap,at=Ne&&!!v.clearcoatMap,ht=Ne&&!!v.clearcoatNormalMap,tt=Ne&&!!v.clearcoatRoughnessMap,st=x&&!!v.iridescenceMap,ut=x&&!!v.iridescenceThicknessMap,Rt=V&&!!v.sheenColorMap,mt=V&&!!v.sheenRoughnessMap,dt=!!v.specularMap,Pt=!!v.specularColorMap,Dt=!!v.specularIntensityMap,Bt=Z&&!!v.transmissionMap,B=Z&&!!v.thicknessMap,ft=!!v.gradientMap,et=!!v.alphaMap,pt=v.alphaTest>0,vt=!!v.alphaHash,rt=!!v.extensions,It=Mn;v.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(It=i.toneMapping);let At={shaderID:j,shaderType:v.type,shaderName:v.name,vertexShader:lt,fragmentShader:ct,defines:v.defines,customVertexShaderID:bt,customFragmentShaderID:Y,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:h,batching:_t,batchingColor:_t&&P._colorsTexture!==null,instancing:wt,instancingColor:wt&&P.instanceColor!==null,instancingMorph:wt&&P.morphTexture!==null,outputColorSpace:J===null?i.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Zt.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:zt,matcap:Te,envMap:Xt,envMapMode:Xt&&q.mapping,envMapCubeUVHeight:H,aoMap:Kt,lightMap:ae,bumpMap:Yt,normalMap:me,displacementMap:Re,emissiveMap:Ye,normalMapObjectSpace:me&&v.normalMapType===sd,normalMapTangentSpace:me&&v.normalMapType===$a,packedNormalMap:me&&v.normalMapType===$a&&zx(v.normalMap.format),metalnessMap:_e,roughnessMap:Me,anisotropy:k,anisotropyMap:Q,clearcoat:Ne,clearcoatMap:at,clearcoatNormalMap:ht,clearcoatRoughnessMap:tt,dispersion:se,retroreflection:I,iridescence:x,iridescenceMap:st,iridescenceThicknessMap:ut,sheen:V,sheenColorMap:Rt,sheenRoughnessMap:mt,specularMap:dt,specularColorMap:Pt,specularIntensityMap:Dt,transmission:Z,transmissionMap:Bt,thicknessMap:B,gradientMap:ft,opaque:v.transparent===!1&&v.blending===Ps&&v.alphaToCoverage===!1,alphaMap:et,alphaTest:pt,alphaHash:vt,combine:v.combine,mapUv:zt&&g(v.map.channel),aoMapUv:Kt&&g(v.aoMap.channel),lightMapUv:ae&&g(v.lightMap.channel),bumpMapUv:Yt&&g(v.bumpMap.channel),normalMapUv:me&&g(v.normalMap.channel),displacementMapUv:Re&&g(v.displacementMap.channel),emissiveMapUv:Ye&&g(v.emissiveMap.channel),metalnessMapUv:_e&&g(v.metalnessMap.channel),roughnessMapUv:Me&&g(v.roughnessMap.channel),anisotropyMapUv:Q&&g(v.anisotropyMap.channel),clearcoatMapUv:at&&g(v.clearcoatMap.channel),clearcoatNormalMapUv:ht&&g(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:tt&&g(v.clearcoatRoughnessMap.channel),iridescenceMapUv:st&&g(v.iridescenceMap.channel),iridescenceThicknessMapUv:ut&&g(v.iridescenceThicknessMap.channel),sheenColorMapUv:Rt&&g(v.sheenColorMap.channel),sheenRoughnessMapUv:mt&&g(v.sheenRoughnessMap.channel),specularMapUv:dt&&g(v.specularMap.channel),specularColorMapUv:Pt&&g(v.specularColorMap.channel),specularIntensityMapUv:Dt&&g(v.specularIntensityMap.channel),transmissionMapUv:Bt&&g(v.transmissionMap.channel),thicknessMapUv:B&&g(v.thicknessMap.channel),alphaMapUv:et&&g(v.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(me||k),vertexNormals:!!F.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,pointsUvs:P.isPoints===!0&&!!F.attributes.uv&&(zt||et),fog:!!L,useFog:v.fog===!0,fogExp2:!!L&&L.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||F.attributes.normal===void 0&&me===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:ot,skinning:P.isSkinnedMesh===!0,hasPositionAttribute:F.attributes.position!==void 0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:X,morphTextureStride:nt,numSunLights:T.sun.length,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numSunLightShadows:T.sunShadowMap.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numLightProbeGrids:D.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:v.dithering,shadowMapEnabled:i.shadowMap.enabled&&R.length>0,shadowMapType:i.shadowMap.type,toneMapping:It,decodeVideoTexture:zt&&v.map.isVideoTexture===!0&&Zt.getTransfer(v.map.colorSpace)===ee,decodeVideoTextureEmissive:Ye&&v.emissiveMap.isVideoTexture===!0&&Zt.getTransfer(v.emissiveMap.colorSpace)===ee,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===hn,flipSided:v.side===qe,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:rt&&v.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(rt&&v.extensions.multiDraw===!0||_t)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return At.vertexUv1s=l.has(1),At.vertexUv2s=l.has(2),At.vertexUv3s=l.has(3),l.clear(),At}function m(v){let T=[];if(v.shaderID?T.push(v.shaderID):(T.push(v.customVertexShaderID),T.push(v.customFragmentShaderID)),v.defines!==void 0)for(let R in v.defines)T.push(R),T.push(v.defines[R]);return v.isRawShaderMaterial===!1&&(d(T,v),M(T,v),T.push(i.outputColorSpace)),T.push(v.customProgramCacheKey),T.join()}function d(v,T){v.push(T.precision),v.push(T.outputColorSpace),v.push(T.envMapMode),v.push(T.envMapCubeUVHeight),v.push(T.mapUv),v.push(T.alphaMapUv),v.push(T.lightMapUv),v.push(T.aoMapUv),v.push(T.bumpMapUv),v.push(T.normalMapUv),v.push(T.displacementMapUv),v.push(T.emissiveMapUv),v.push(T.metalnessMapUv),v.push(T.roughnessMapUv),v.push(T.anisotropyMapUv),v.push(T.clearcoatMapUv),v.push(T.clearcoatNormalMapUv),v.push(T.clearcoatRoughnessMapUv),v.push(T.iridescenceMapUv),v.push(T.iridescenceThicknessMapUv),v.push(T.sheenColorMapUv),v.push(T.sheenRoughnessMapUv),v.push(T.specularMapUv),v.push(T.specularColorMapUv),v.push(T.specularIntensityMapUv),v.push(T.transmissionMapUv),v.push(T.thicknessMapUv),v.push(T.combine),v.push(T.fogExp2),v.push(T.sizeAttenuation),v.push(T.morphTargetsCount),v.push(T.morphAttributeCount),v.push(T.numSunLights),v.push(T.numDirLights),v.push(T.numPointLights),v.push(T.numSpotLights),v.push(T.numSpotLightMaps),v.push(T.numHemiLights),v.push(T.numRectAreaLights),v.push(T.numSunLightShadows),v.push(T.numDirLightShadows),v.push(T.numPointLightShadows),v.push(T.numSpotLightShadows),v.push(T.numSpotLightShadowsWithMaps),v.push(T.numLightProbes),v.push(T.shadowMapType),v.push(T.toneMapping),v.push(T.numClippingPlanes),v.push(T.numClipIntersection),v.push(T.depthPacking)}function M(v,T){o.disableAll(),T.instancing&&o.enable(0),T.instancingColor&&o.enable(1),T.instancingMorph&&o.enable(2),T.matcap&&o.enable(3),T.envMap&&o.enable(4),T.normalMapObjectSpace&&o.enable(5),T.normalMapTangentSpace&&o.enable(6),T.clearcoat&&o.enable(7),T.iridescence&&o.enable(8),T.alphaTest&&o.enable(9),T.vertexColors&&o.enable(10),T.vertexAlphas&&o.enable(11),T.vertexUv1s&&o.enable(12),T.vertexUv2s&&o.enable(13),T.vertexUv3s&&o.enable(14),T.vertexTangents&&o.enable(15),T.anisotropy&&o.enable(16),T.alphaHash&&o.enable(17),T.batching&&o.enable(18),T.dispersion&&o.enable(19),T.retroreflection&&o.enable(24),T.batchingColor&&o.enable(20),T.gradientMap&&o.enable(21),T.packedNormalMap&&o.enable(22),T.vertexNormals&&o.enable(23),v.push(o.mask),o.disableAll(),T.fog&&o.enable(0),T.useFog&&o.enable(1),T.flatShading&&o.enable(2),T.logarithmicDepthBuffer&&o.enable(3),T.reversedDepthBuffer&&o.enable(4),T.skinning&&o.enable(5),T.morphTargets&&o.enable(6),T.morphNormals&&o.enable(7),T.morphColors&&o.enable(8),T.premultipliedAlpha&&o.enable(9),T.shadowMapEnabled&&o.enable(10),T.doubleSided&&o.enable(11),T.flipSided&&o.enable(12),T.useDepthPacking&&o.enable(13),T.dithering&&o.enable(14),T.transmission&&o.enable(15),T.sheen&&o.enable(16),T.opaque&&o.enable(17),T.pointsUvs&&o.enable(18),T.decodeVideoTexture&&o.enable(19),T.decodeVideoTextureEmissive&&o.enable(20),T.alphaToCoverage&&o.enable(21),T.numLightProbeGrids>0&&o.enable(22),T.hasPositionAttribute&&o.enable(23),v.push(o.mask)}function E(v){let T=p[v.type],R;if(T){let A=On[T];R=xd.clone(A.uniforms)}else R=v.uniforms;return R}function y(v,T){let R=u.get(T);return R!==void 0?++R.usedTimes:(R=new Bx(i,T,v,s),c.push(R),u.set(T,R)),R}function b(v){if(--v.usedTimes===0){let T=c.indexOf(v);c[T]=c[c.length-1],c.pop(),u.delete(v.cacheKey),v.destroy()}}function S(v){a.remove(v)}function C(){a.dispose()}return{getParameters:_,getProgramCacheKey:m,getUniforms:E,acquireProgram:y,releaseProgram:b,releaseShaderCache:S,programs:c,dispose:C}}function Hx(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function Gx(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.materialVariant!==t.materialVariant?i.materialVariant-t.materialVariant:i.z!==t.z?i.z-t.z:i.id-t.id}function Bd(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function kd(){let i=[],t=0,e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(h){let p=0;return h.isInstancedMesh&&(p+=2),h.isSkinnedMesh&&(p+=1),p}function a(h,p,g,_,m,d){let M=i[t];return M===void 0?(M={id:h.id,object:h,geometry:p,material:g,materialVariant:o(h),groupOrder:_,renderOrder:h.renderOrder,z:m,group:d},i[t]=M):(M.id=h.id,M.object=h,M.geometry=p,M.material=g,M.materialVariant=o(h),M.groupOrder=_,M.renderOrder=h.renderOrder,M.z=m,M.group=d),t++,M}function l(h,p,g,_,m,d,M){M.reversedDepth===!0&&(m=-m);let E=a(h,p,g,_,m,d);g.transmission>0?n.push(E):g.transparent===!0?s.push(E):e.push(E)}function c(h,p,g,_,m,d){let M=a(h,p,g,_,m,d);g.transmission>0?n.unshift(M):g.transparent===!0?s.unshift(M):e.unshift(M)}function u(h,p){e.length>1&&e.sort(h||Gx),n.length>1&&n.sort(p||Bd),s.length>1&&s.sort(p||Bd)}function f(){for(let h=t,p=i.length;h<p;h++){let g=i[h];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:f,sort:u}}function Wx(){let i=new WeakMap;function t(n,s){let r=i.get(n),o;return r===void 0?(o=new kd,i.set(n,[o])):s>=r.length?(o=new kd,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function Xx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={direction:new z,color:new Ut};break;case"SpotLight":e={position:new z,direction:new z,color:new Ut,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new z,color:new Ut,distance:0,decay:0};break;case"HemisphereLight":e={direction:new z,skyColor:new Ut,groundColor:new Ut};break;case"RectAreaLight":e={color:new Ut,position:new z,halfWidth:new z,halfHeight:new z};break}return i[t.id]=e,e}}}function qx(){let i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ht};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ht};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Ht,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}var Yx=0;function Zx(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function $x(i){let t=new Xx,e=qx(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new z);let s=new z,r=new ne,o=new ne;function a(c){let u=0,f=0,h=0;for(let P=0;P<9;P++)n.probe[P].set(0,0,0);let p=0,g=0,_=0,m=0,d=0,M=0,E=0,y=0,b=0,S=0,C=0,v=0,T=0,R=0;c.sort(Zx);for(let P=0,D=c.length;P<D;P++){let L=c[P],F=L.color,U=L.intensity,O=L.distance,q=null;if(L.shadow&&L.shadow.map&&(L.shadow.map.texture.format===Mi?q=L.shadow.map.texture:q=L.shadow.map.depthTexture||L.shadow.map.texture),L.isAmbientLight)u+=F.r*U,f+=F.g*U,h+=F.b*U;else if(L.isLightProbe){for(let H=0;H<9;H++)n.probe[H].addScaledVector(L.sh.coefficients[H],U);R++}else if(L.isSunLight){let H=t.get(L);if(H.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){let j=L.shadow,it=e.get(L);it.shadowIntensity=j.intensity,it.shadowBias=j.bias,it.shadowNormalBias=j.normalBias,it.shadowRadius=j.radius,it.shadowMapSize.copy(j.mapSize).multiply(j.getFrameExtents()),n.sunShadow[g]=it,n.sunShadowMap[g]=q;let X=j.getViewportCount();for(let nt=0;nt<X;nt++)n.sunShadowMatrix[_+nt]=j.getMatrix(nt),n.sunShadowCascade[_+nt]=j._cascadeData[nt];_+=X,g++}n.sun[p]=H,p++}else if(L.isDirectionalLight){let H=t.get(L);if(H.color.copy(L.color).multiplyScalar(L.intensity),L.castShadow){let j=L.shadow,it=e.get(L);it.shadowIntensity=j.intensity,it.shadowBias=j.bias,it.shadowNormalBias=j.normalBias,it.shadowRadius=j.radius,it.shadowMapSize=j.mapSize,n.directionalShadow[m]=it,n.directionalShadowMap[m]=q,n.directionalShadowMatrix[m]=L.shadow.matrix,b++}n.directional[m]=H,m++}else if(L.isSpotLight){let H=t.get(L);H.position.setFromMatrixPosition(L.matrixWorld),H.color.copy(F).multiplyScalar(U),H.distance=O,H.coneCos=Math.cos(L.angle),H.penumbraCos=Math.cos(L.angle*(1-L.penumbra)),H.decay=L.decay,n.spot[M]=H;let j=L.shadow;if(L.map&&(n.spotLightMap[v]=L.map,v++,j.updateMatrices(L),L.castShadow&&T++),n.spotLightMatrix[M]=j.matrix,L.castShadow){let it=e.get(L);it.shadowIntensity=j.intensity,it.shadowBias=j.bias,it.shadowNormalBias=j.normalBias,it.shadowRadius=j.radius,it.shadowMapSize=j.mapSize,n.spotShadow[M]=it,n.spotShadowMap[M]=q,C++}M++}else if(L.isRectAreaLight){let H=t.get(L);H.color.copy(F).multiplyScalar(U),H.halfWidth.set(L.width*.5,0,0),H.halfHeight.set(0,L.height*.5,0),n.rectArea[E]=H,E++}else if(L.isPointLight){let H=t.get(L);if(H.color.copy(L.color).multiplyScalar(L.intensity),H.distance=L.distance,H.decay=L.decay,L.castShadow){let j=L.shadow,it=e.get(L);it.shadowIntensity=j.intensity,it.shadowBias=j.bias,it.shadowNormalBias=j.normalBias,it.shadowRadius=j.radius,it.shadowMapSize=j.mapSize,it.shadowCameraNear=j.camera.near,it.shadowCameraFar=j.camera.far,n.pointShadow[d]=it,n.pointShadowMap[d]=q,n.pointShadowMatrix[d]=L.shadow.matrix,S++}n.point[d]=H,d++}else if(L.isHemisphereLight){let H=t.get(L);H.skyColor.copy(L.color).multiplyScalar(U),H.groundColor.copy(L.groundColor).multiplyScalar(U),n.hemi[y]=H,y++}}E>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=gt.LTC_FLOAT_1,n.rectAreaLTC2=gt.LTC_FLOAT_2):(n.rectAreaLTC1=gt.LTC_HALF_1,n.rectAreaLTC2=gt.LTC_HALF_2)),n.ambient[0]=u,n.ambient[1]=f,n.ambient[2]=h;let A=n.hash;(A.sunLength!==p||A.directionalLength!==m||A.pointLength!==d||A.spotLength!==M||A.rectAreaLength!==E||A.hemiLength!==y||A.numSunShadows!==g||A.numDirectionalShadows!==b||A.numPointShadows!==S||A.numSpotShadows!==C||A.numSpotMaps!==v||A.numLightProbes!==R)&&(n.sun.length=p,n.directional.length=m,n.spot.length=M,n.rectArea.length=E,n.point.length=d,n.hemi.length=y,n.sunShadow.length=g,n.sunShadowMap.length=g,n.sunShadowMatrix.length=_,n.sunShadowCascade.length=_,n.directionalShadow.length=b,n.directionalShadowMap.length=b,n.directionalShadowMatrix.length=b,n.pointShadow.length=S,n.pointShadowMap.length=S,n.pointShadowMatrix.length=S,n.spotShadow.length=C,n.spotShadowMap.length=C,n.spotLightMatrix.length=C+v-T,n.spotLightMap.length=v,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=R,A.sunLength=p,A.directionalLength=m,A.pointLength=d,A.spotLength=M,A.rectAreaLength=E,A.hemiLength=y,A.numSunShadows=g,A.numDirectionalShadows=b,A.numPointShadows=S,A.numSpotShadows=C,A.numSpotMaps=v,A.numLightProbes=R,n.version=Yx++)}function l(c,u){let f=0,h=0,p=0,g=0,_=0,m=0,d=u.matrixWorldInverse;for(let M=0,E=c.length;M<E;M++){let y=c[M];if(y.isSunLight){let b=n.sun[f];b.direction.setFromMatrixPosition(y.matrixWorld),b.direction.transformDirection(d),f++}else if(y.isDirectionalLight){let b=n.directional[h];b.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(d),h++}else if(y.isSpotLight){let b=n.spot[g];b.position.setFromMatrixPosition(y.matrixWorld),b.position.applyMatrix4(d),b.direction.setFromMatrixPosition(y.matrixWorld),s.setFromMatrixPosition(y.target.matrixWorld),b.direction.sub(s),b.direction.transformDirection(d),g++}else if(y.isRectAreaLight){let b=n.rectArea[_];b.position.setFromMatrixPosition(y.matrixWorld),b.position.applyMatrix4(d),o.identity(),r.copy(y.matrixWorld),r.premultiply(d),o.extractRotation(r),b.halfWidth.set(y.width*.5,0,0),b.halfHeight.set(0,y.height*.5,0),b.halfWidth.applyMatrix4(o),b.halfHeight.applyMatrix4(o),_++}else if(y.isPointLight){let b=n.point[p];b.position.setFromMatrixPosition(y.matrixWorld),b.position.applyMatrix4(d),p++}else if(y.isHemisphereLight){let b=n.hemi[m];b.direction.setFromMatrixPosition(y.matrixWorld),b.direction.transformDirection(d),m++}}}return{setup:a,setupView:l,state:n}}function zd(i){let t=new $x(i),e=[],n=[],s=[];function r(h){f.camera=h,e.length=0,n.length=0,s.length=0}function o(h){e.push(h)}function a(h){n.push(h)}function l(h){s.push(h)}function c(){t.setup(e)}function u(h){t.setupView(e,h)}let f={lightsArray:e,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:u,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function Kx(i){let t=new WeakMap;function e(s,r=0){let o=t.get(s),a;return o===void 0?(a=new zd(i),t.set(s,[a])):r>=o.length?(a=new zd(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}var Jx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,jx=`uniform sampler2D shadow_pass;
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
}`,Qx=[new z(1,0,0),new z(-1,0,0),new z(0,1,0),new z(0,-1,0),new z(0,0,1),new z(0,0,-1)],ty=[new z(0,-1,0),new z(0,-1,0),new z(0,0,1),new z(0,0,-1),new z(0,-1,0),new z(0,-1,0)],Vd=new ne,Hr=new z,Wc=new z;function ey(i,t,e){let n=new Ts,s=new Ht,r=new Ht,o=new he,a=new Zo,l=new $o,c={},u=e.maxTextureSize,f={[_i]:qe,[qe]:_i,[hn]:hn},h=new Xe({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Ht},radius:{value:4}},vertexShader:Jx,fragmentShader:jx}),p=h.clone();p.defines.HORIZONTAL_PASS=1;let g=new Ee;g.setAttribute("position",new we(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new De(g,h),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Lr;let d=this.type;this.render=function(S,C,v){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||S.length===0)return;this.type===Ou&&(Lt("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Lr);let T=i.getRenderTarget(),R=i.getActiveCubeFace(),A=i.getActiveMipmapLevel(),P=i.state;P.setBlending(Un),P.buffers.depth.getReversed()===!0?P.buffers.color.setClear(0,0,0,0):P.buffers.color.setClear(1,1,1,1),P.buffers.depth.setTest(!0),P.setScissorTest(!1);let D=d!==this.type;D&&C.traverse(function(L){L.material&&(Array.isArray(L.material)?L.material.forEach(F=>F.needsUpdate=!0):L.material.needsUpdate=!0)});for(let L=0,F=S.length;L<F;L++){let U=S[L],O=U.shadow;if(O===void 0){Lt("WebGLShadowMap:",U,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;s.copy(O.mapSize);let q=O.getFrameExtents();s.multiply(q),r.copy(O.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/q.x),s.x=r.x*q.x,O.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/q.y),s.y=r.y*q.y,O.mapSize.y=r.y));let H=i.state.buffers.depth.getReversed();if(O.camera._reversedDepth=H,O.map===null||D===!0){if(O.map!==null&&(O.map.depthTexture!==null&&(O.map.depthTexture.dispose(),O.map.depthTexture=null),O.map.dispose()),this.type===Rs){if(U.isPointLight){Lt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}O.map=new $e(s.x,s.y,{format:Mi,type:bn,minFilter:Le,magFilter:Le,generateMipmaps:!1}),O.map.texture.name=U.name+".shadowMap",O.map.depthTexture=new hi(s.x,s.y,un),O.map.depthTexture.name=U.name+".shadowMapDepth",O.map.depthTexture.format=Pn,O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=Ie,O.map.depthTexture.magFilter=Ie}else U.isPointLight?(O.map=new el(s.x),O.map.depthTexture=new qo(s.x,Sn)):(O.map=new $e(s.x,s.y),O.map.depthTexture=new hi(s.x,s.y,Sn)),O.map.depthTexture.name=U.name+".shadowMap",O.map.depthTexture.format=Pn,this.type===Lr?(O.map.depthTexture.compareFunction=H?Ja:Ka,O.map.depthTexture.minFilter=Le,O.map.depthTexture.magFilter=Le):(O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=Ie,O.map.depthTexture.magFilter=Ie);O.camera.updateProjectionMatrix()}O.map.isWebGLCubeRenderTarget!==!0&&(O.map.width!==s.x||O.map.height!==s.y)&&O.map.setSize(s.x,s.y);let j=O.map.isWebGLCubeRenderTarget?6:O.getViewportCount();U.isPointLight!==!0&&O.updateMatrices(U,v);for(let it=0;it<j;it++){let X=O.getCamera(it);if(U.isPointLight){let nt=O.camera,lt=O.matrix,ct=U.distance||nt.far;ct!==nt.far&&(nt.far=ct,nt.updateProjectionMatrix()),Hr.setFromMatrixPosition(U.matrixWorld),nt.position.copy(Hr),Wc.copy(nt.position),Wc.add(Qx[it]),nt.up.copy(ty[it]),nt.lookAt(Wc),nt.updateMatrixWorld(),lt.makeTranslation(-Hr.x,-Hr.y,-Hr.z),Vd.multiplyMatrices(nt.projectionMatrix,nt.matrixWorldInverse),O._frustum.setFromProjectionMatrix(Vd,nt.coordinateSystem,nt.reversedDepth)}if(O.map.isWebGLCubeRenderTarget)i.setRenderTarget(O.map,it),i.clear();else{it===0&&(i.setRenderTarget(O.map),i.clear());let nt=O.getViewport(it);o.set(r.x*nt.x,r.y*nt.y,r.x*nt.z,r.y*nt.w),P.viewport(o)}n=O.getFrustum(it),y(C,v,X,U,this.type)}O.isPointLightShadow!==!0&&this.type===Rs&&M(O,v),O.needsUpdate=!1}d=this.type,m.needsUpdate=!1,i.setRenderTarget(T,R,A)};function M(S,C){let v=t.update(_);h.defines.VSM_SAMPLES!==S.blurSamples&&(h.defines.VSM_SAMPLES=S.blurSamples,p.defines.VSM_SAMPLES=S.blurSamples,h.needsUpdate=!0,p.needsUpdate=!0),S.mapPass===null?S.mapPass=new $e(s.x,s.y,{format:Mi,type:bn}):(S.mapPass.width!==S.map.width||S.mapPass.height!==S.map.height)&&S.mapPass.setSize(S.map.width,S.map.height),h.uniforms.shadow_pass.value=S.map.depthTexture,h.uniforms.resolution.value.set(S.map.width,S.map.height),h.uniforms.radius.value=S.radius,i.setRenderTarget(S.mapPass),i.clear(),i.renderBufferDirect(C,null,v,h,_,null),p.uniforms.shadow_pass.value=S.mapPass.texture,p.uniforms.resolution.value.set(S.map.width,S.map.height),p.uniforms.radius.value=S.radius,i.setRenderTarget(S.map),i.clear(),i.renderBufferDirect(C,null,v,p,_,null)}function E(S,C,v,T){let R=null,A=v.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(A!==void 0)R=A;else if(R=v.isPointLight===!0?l:a,i.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){let P=R.uuid,D=C.uuid,L=c[P];L===void 0&&(L={},c[P]=L);let F=L[D];F===void 0&&(F=R.clone(),L[D]=F,C.addEventListener("dispose",b)),R=F}if(R.visible=C.visible,R.wireframe=C.wireframe,T===Rs?R.side=C.shadowSide!==null?C.shadowSide:C.side:R.side=C.shadowSide!==null?C.shadowSide:f[C.side],R.alphaMap=C.alphaMap,R.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,R.map=C.map,R.clipShadows=C.clipShadows,R.clippingPlanes=C.clippingPlanes,R.clipIntersection=C.clipIntersection,R.displacementMap=C.displacementMap,R.displacementScale=C.displacementScale,R.displacementBias=C.displacementBias,R.wireframeLinewidth=C.wireframeLinewidth,R.linewidth=C.linewidth,v.isPointLight===!0&&R.isMeshDistanceMaterial===!0){let P=i.properties.get(R);P.light=v}return R}function y(S,C,v,T,R){if(S.visible===!1)return;if(S.layers.test(C.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&R===Rs)&&(!S.frustumCulled||S.intersectsFrustum(n))){S.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,S.matrixWorld);let D=t.update(S),L=S.material;if(Array.isArray(L)){let F=D.groups;for(let U=0,O=F.length;U<O;U++){let q=F[U],H=L[q.materialIndex];if(H&&H.visible){let j=E(S,H,T,R);S.onBeforeShadow(i,S,C,v,D,j,q),i.renderBufferDirect(v,null,D,j,S,q),S.onAfterShadow(i,S,C,v,D,j,q)}}}else if(L.visible){let F=E(S,L,T,R);S.onBeforeShadow(i,S,C,v,D,F,null),i.renderBufferDirect(v,null,D,F,S,null),S.onAfterShadow(i,S,C,v,D,F,null)}}let P=S.children;for(let D=0,L=P.length;D<L;D++)y(P[D],C,v,T,R)}function b(S){S.target.removeEventListener("dispose",b);for(let v in c){let T=c[v],R=S.target.uuid;R in T&&(T[R].dispose(),delete T[R])}}}function ny(i,t){function e(){let B=!1,ft=new he,et=null,pt=new he(0,0,0,0);return{setMask:function(vt){et!==vt&&!B&&(i.colorMask(vt,vt,vt,vt),et=vt)},setLocked:function(vt){B=vt},setClear:function(vt,rt,It,At,le){le===!0&&(vt*=At,rt*=At,It*=At),ft.set(vt,rt,It,At),pt.equals(ft)===!1&&(i.clearColor(vt,rt,It,At),pt.copy(ft))},reset:function(){B=!1,et=null,pt.set(-1,0,0,0)}}}function n(){let B=!1,ft=!1,et=null,pt=null,vt=null;return{setReversed:function(rt){if(ft!==rt){let It=t.get("EXT_clip_control");rt?It.clipControlEXT(It.LOWER_LEFT_EXT,It.ZERO_TO_ONE_EXT):It.clipControlEXT(It.LOWER_LEFT_EXT,It.NEGATIVE_ONE_TO_ONE_EXT),ft=rt;let At=vt;vt=null,this.setClear(At)}},getReversed:function(){return ft},setTest:function(rt){rt?J(i.DEPTH_TEST):ot(i.DEPTH_TEST)},setMask:function(rt){et!==rt&&!B&&(i.depthMask(rt),et=rt)},setFunc:function(rt){if(ft&&(rt=gd[rt]),pt!==rt){switch(rt){case Io:i.depthFunc(i.NEVER);break;case Lo:i.depthFunc(i.ALWAYS);break;case Uo:i.depthFunc(i.LESS);break;case _s:i.depthFunc(i.LEQUAL);break;case Do:i.depthFunc(i.EQUAL);break;case Oo:i.depthFunc(i.GEQUAL);break;case No:i.depthFunc(i.GREATER);break;case Fo:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}pt=rt}},setLocked:function(rt){B=rt},setClear:function(rt){vt!==rt&&(vt=rt,ft&&(rt=1-rt),i.clearDepth(rt))},reset:function(){B=!1,et=null,pt=null,vt=null,ft=!1}}}function s(){let B=!1,ft=null,et=null,pt=null,vt=null,rt=null,It=null,At=null,le=null;return{setTest:function(Qt){B||(Qt?J(i.STENCIL_TEST):ot(i.STENCIL_TEST))},setMask:function(Qt){ft!==Qt&&!B&&(i.stencilMask(Qt),ft=Qt)},setFunc:function(Qt,fn,Tn){(et!==Qt||pt!==fn||vt!==Tn)&&(i.stencilFunc(Qt,fn,Tn),et=Qt,pt=fn,vt=Tn)},setOp:function(Qt,fn,Tn){(rt!==Qt||It!==fn||At!==Tn)&&(i.stencilOp(Qt,fn,Tn),rt=Qt,It=fn,At=Tn)},setLocked:function(Qt){B=Qt},setClear:function(Qt){le!==Qt&&(i.clearStencil(Qt),le=Qt)},reset:function(){B=!1,ft=null,et=null,pt=null,vt=null,rt=null,It=null,At=null,le=null}}}let r=new e,o=new n,a=new s,l=new WeakMap,c=new WeakMap,u={},f={},h={},p=new WeakMap,g=[],_=null,m=!1,d=null,M=null,E=null,y=null,b=null,S=null,C=null,v=new Ut(0,0,0),T=0,R=!1,A=null,P=null,D=null,L=null,F=null,U=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),O=!1,q=0,H=i.getParameter(i.VERSION);H.indexOf("WebGL")!==-1?(q=parseFloat(/^WebGL (\d)/.exec(H)[1]),O=q>=1):H.indexOf("OpenGL ES")!==-1&&(q=parseFloat(/^OpenGL ES (\d)/.exec(H)[1]),O=q>=2);let j=null,it={},X=i.getParameter(i.SCISSOR_BOX),nt=i.getParameter(i.VIEWPORT),lt=new he().fromArray(X),ct=new he().fromArray(nt);function bt(B,ft,et,pt){let vt=new Uint8Array(4),rt=i.createTexture();i.bindTexture(B,rt),i.texParameteri(B,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(B,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let It=0;It<et;It++)B===i.TEXTURE_3D||B===i.TEXTURE_2D_ARRAY?i.texImage3D(ft,0,i.RGBA,1,1,pt,0,i.RGBA,i.UNSIGNED_BYTE,vt):i.texImage2D(ft+It,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,vt);return rt}let Y={};Y[i.TEXTURE_2D]=bt(i.TEXTURE_2D,i.TEXTURE_2D,1),Y[i.TEXTURE_CUBE_MAP]=bt(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Y[i.TEXTURE_2D_ARRAY]=bt(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Y[i.TEXTURE_3D]=bt(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),J(i.DEPTH_TEST),o.setFunc(_s),Yt(!1),me(uc),J(i.CULL_FACE),Kt(Un);function J(B){u[B]!==!0&&(i.enable(B),u[B]=!0)}function ot(B){u[B]!==!1&&(i.disable(B),u[B]=!1)}function wt(B,ft){return h[B]!==ft?(i.bindFramebuffer(B,ft),h[B]=ft,B===i.DRAW_FRAMEBUFFER&&(h[i.FRAMEBUFFER]=ft),B===i.FRAMEBUFFER&&(h[i.DRAW_FRAMEBUFFER]=ft),!0):!1}function _t(B,ft){let et=g,pt=!1;if(B){et=p.get(ft),et===void 0&&(et=[],p.set(ft,et));let vt=B.textures;if(et.length!==vt.length||et[0]!==i.COLOR_ATTACHMENT0){for(let rt=0,It=vt.length;rt<It;rt++)et[rt]=i.COLOR_ATTACHMENT0+rt;et.length=vt.length,pt=!0}}else et[0]!==i.BACK&&(et[0]=i.BACK,pt=!0);pt&&i.drawBuffers(et)}function zt(B){return _!==B?(i.useProgram(B),_=B,!0):!1}let Te={[Vi]:i.FUNC_ADD,[Fu]:i.FUNC_SUBTRACT,[Bu]:i.FUNC_REVERSE_SUBTRACT};Te[ku]=i.MIN,Te[zu]=i.MAX;let Xt={[Vu]:i.ZERO,[Hu]:i.ONE,[Gu]:i.SRC_COLOR,[mc]:i.SRC_ALPHA,[$u]:i.SRC_ALPHA_SATURATE,[Yu]:i.DST_COLOR,[Xu]:i.DST_ALPHA,[Wu]:i.ONE_MINUS_SRC_COLOR,[gc]:i.ONE_MINUS_SRC_ALPHA,[Zu]:i.ONE_MINUS_DST_COLOR,[qu]:i.ONE_MINUS_DST_ALPHA,[Ku]:i.CONSTANT_COLOR,[Ju]:i.ONE_MINUS_CONSTANT_COLOR,[ju]:i.CONSTANT_ALPHA,[Qu]:i.ONE_MINUS_CONSTANT_ALPHA};function Kt(B,ft,et,pt,vt,rt,It,At,le,Qt){if(B===Un){m===!0&&(ot(i.BLEND),m=!1);return}if(m===!1&&(J(i.BLEND),m=!0),B!==Nu){if(B!==d||Qt!==R){if((M!==Vi||b!==Vi)&&(i.blendEquation(i.FUNC_ADD),M=Vi,b=Vi),Qt)switch(B){case Ps:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case dc:i.blendFunc(i.ONE,i.ONE);break;case fc:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case pc:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ot("WebGLState: Invalid blending: ",B);break}else switch(B){case Ps:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case dc:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case fc:Ot("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case pc:Ot("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ot("WebGLState: Invalid blending: ",B);break}E=null,y=null,S=null,C=null,v.set(0,0,0),T=0,d=B,R=Qt}return}vt=vt||ft,rt=rt||et,It=It||pt,(ft!==M||vt!==b)&&(i.blendEquationSeparate(Te[ft],Te[vt]),M=ft,b=vt),(et!==E||pt!==y||rt!==S||It!==C)&&(i.blendFuncSeparate(Xt[et],Xt[pt],Xt[rt],Xt[It]),E=et,y=pt,S=rt,C=It),(At.equals(v)===!1||le!==T)&&(i.blendColor(At.r,At.g,At.b,le),v.copy(At),T=le),d=B,R=!1}function ae(B,ft){B.side===hn?ot(i.CULL_FACE):J(i.CULL_FACE);let et=B.side===qe;ft&&(et=!et),Yt(et),B.blending===Ps&&B.transparent===!1?Kt(Un):Kt(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),o.setFunc(B.depthFunc),o.setTest(B.depthTest),o.setMask(B.depthWrite),r.setMask(B.colorWrite);let pt=B.stencilWrite;a.setTest(pt),pt&&(a.setMask(B.stencilWriteMask),a.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),a.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass)),Ye(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?J(i.SAMPLE_ALPHA_TO_COVERAGE):ot(i.SAMPLE_ALPHA_TO_COVERAGE)}function Yt(B){A!==B&&(B?i.frontFace(i.CW):i.frontFace(i.CCW),A=B)}function me(B){B!==Uu?(J(i.CULL_FACE),B!==P&&(B===uc?i.cullFace(i.BACK):B===Du?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):ot(i.CULL_FACE),P=B}function Re(B){B!==D&&(O&&i.lineWidth(B),D=B)}function Ye(B,ft,et){B?(J(i.POLYGON_OFFSET_FILL),(L!==ft||F!==et)&&(L=ft,F=et,o.getReversed()&&(ft=-ft),i.polygonOffset(ft,et))):ot(i.POLYGON_OFFSET_FILL)}function _e(B){B?J(i.SCISSOR_TEST):ot(i.SCISSOR_TEST)}function Me(B){B===void 0&&(B=i.TEXTURE0+U-1),j!==B&&(i.activeTexture(B),j=B)}function k(B,ft,et){et===void 0&&(j===null?et=i.TEXTURE0+U-1:et=j);let pt=it[et];pt===void 0&&(pt={type:void 0,texture:void 0},it[et]=pt),(pt.type!==B||pt.texture!==ft)&&(j!==et&&(i.activeTexture(et),j=et),i.bindTexture(B,ft||Y[B]),pt.type=B,pt.texture=ft)}function Ne(){let B=it[j];B!==void 0&&B.type!==void 0&&(i.bindTexture(B.type,null),B.type=void 0,B.texture=void 0)}function se(){try{i.compressedTexImage2D(...arguments)}catch(B){Ot("WebGLState:",B)}}function I(){try{i.compressedTexImage3D(...arguments)}catch(B){Ot("WebGLState:",B)}}function x(){try{i.texSubImage2D(...arguments)}catch(B){Ot("WebGLState:",B)}}function V(){try{i.texSubImage3D(...arguments)}catch(B){Ot("WebGLState:",B)}}function Z(){try{i.compressedTexSubImage2D(...arguments)}catch(B){Ot("WebGLState:",B)}}function Q(){try{i.compressedTexSubImage3D(...arguments)}catch(B){Ot("WebGLState:",B)}}function at(){try{i.texStorage2D(...arguments)}catch(B){Ot("WebGLState:",B)}}function ht(){try{i.texStorage3D(...arguments)}catch(B){Ot("WebGLState:",B)}}function tt(){try{i.texImage2D(...arguments)}catch(B){Ot("WebGLState:",B)}}function st(){try{i.texImage3D(...arguments)}catch(B){Ot("WebGLState:",B)}}function ut(B){return f[B]!==void 0?f[B]:i.getParameter(B)}function Rt(B,ft){f[B]!==ft&&(i.pixelStorei(B,ft),f[B]=ft)}function mt(B){lt.equals(B)===!1&&(i.scissor(B.x,B.y,B.z,B.w),lt.copy(B))}function dt(B){ct.equals(B)===!1&&(i.viewport(B.x,B.y,B.z,B.w),ct.copy(B))}function Pt(B,ft){let et=c.get(ft);et===void 0&&(et=new WeakMap,c.set(ft,et));let pt=et.get(B);pt===void 0&&(pt=i.getUniformBlockIndex(ft,B.name),et.set(B,pt))}function Dt(B,ft){let pt=c.get(ft).get(B);l.get(ft)!==pt&&(i.uniformBlockBinding(ft,pt,B.__bindingPointIndex),l.set(ft,pt))}function Bt(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),u={},f={},j=null,it={},h={},p=new WeakMap,g=[],_=null,m=!1,d=null,M=null,E=null,y=null,b=null,S=null,C=null,v=new Ut(0,0,0),T=0,R=!1,A=null,P=null,D=null,L=null,F=null,lt.set(0,0,i.canvas.width,i.canvas.height),ct.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:J,disable:ot,bindFramebuffer:wt,drawBuffers:_t,useProgram:zt,setBlending:Kt,setMaterial:ae,setFlipSided:Yt,setCullFace:me,setLineWidth:Re,setPolygonOffset:Ye,setScissorTest:_e,activeTexture:Me,bindTexture:k,unbindTexture:Ne,compressedTexImage2D:se,compressedTexImage3D:I,texImage2D:tt,texImage3D:st,pixelStorei:Rt,getParameter:ut,updateUBOMapping:Pt,uniformBlockBinding:Dt,texStorage2D:at,texStorage3D:ht,texSubImage2D:x,texSubImage3D:V,compressedTexSubImage2D:Z,compressedTexSubImage3D:Q,scissor:mt,viewport:dt,reset:Bt}}function iy(i,t,e,n,s,r,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Ht,u=new WeakMap,f=new Set,h,p=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(I,x){return g?new OffscreenCanvas(I,x):mr("canvas")}function m(I,x,V){let Z=1,Q=se(I);if((Q.width>V||Q.height>V)&&(Z=V/Math.max(Q.width,Q.height)),Z<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){let at=Math.floor(Z*Q.width),ht=Math.floor(Z*Q.height);h===void 0&&(h=_(at,ht));let tt=x?_(at,ht):h;return tt.width=at,tt.height=ht,tt.getContext("2d").drawImage(I,0,0,at,ht),Lt("WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+at+"x"+ht+")."),tt}else return"data"in I&&Lt("WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),I;return I}function d(I){return I.generateMipmaps}function M(I){i.generateMipmap(I)}function E(I){return I.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:I.isWebGL3DRenderTarget?i.TEXTURE_3D:I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function y(I,x,V,Z,Q,at=!1){if(I!==null){if(i[I]!==void 0)return i[I];Lt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let ht;Z&&(ht=t.get("EXT_texture_norm16"),ht||Lt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let tt=x;if(x===i.RED&&(V===i.FLOAT&&(tt=i.R32F),V===i.HALF_FLOAT&&(tt=i.R16F),V===i.UNSIGNED_BYTE&&(tt=i.R8),V===i.UNSIGNED_SHORT&&ht&&(tt=ht.R16_EXT),V===i.SHORT&&ht&&(tt=ht.R16_SNORM_EXT)),x===i.RED_INTEGER&&(V===i.UNSIGNED_BYTE&&(tt=i.R8UI),V===i.UNSIGNED_SHORT&&(tt=i.R16UI),V===i.UNSIGNED_INT&&(tt=i.R32UI),V===i.BYTE&&(tt=i.R8I),V===i.SHORT&&(tt=i.R16I),V===i.INT&&(tt=i.R32I)),x===i.RG&&(V===i.FLOAT&&(tt=i.RG32F),V===i.HALF_FLOAT&&(tt=i.RG16F),V===i.UNSIGNED_BYTE&&(tt=i.RG8),V===i.UNSIGNED_SHORT&&ht&&(tt=ht.RG16_EXT),V===i.SHORT&&ht&&(tt=ht.RG16_SNORM_EXT)),x===i.RG_INTEGER&&(V===i.UNSIGNED_BYTE&&(tt=i.RG8UI),V===i.UNSIGNED_SHORT&&(tt=i.RG16UI),V===i.UNSIGNED_INT&&(tt=i.RG32UI),V===i.BYTE&&(tt=i.RG8I),V===i.SHORT&&(tt=i.RG16I),V===i.INT&&(tt=i.RG32I)),x===i.RGB_INTEGER&&(V===i.UNSIGNED_BYTE&&(tt=i.RGB8UI),V===i.UNSIGNED_SHORT&&(tt=i.RGB16UI),V===i.UNSIGNED_INT&&(tt=i.RGB32UI),V===i.BYTE&&(tt=i.RGB8I),V===i.SHORT&&(tt=i.RGB16I),V===i.INT&&(tt=i.RGB32I)),x===i.RGBA_INTEGER&&(V===i.UNSIGNED_BYTE&&(tt=i.RGBA8UI),V===i.UNSIGNED_SHORT&&(tt=i.RGBA16UI),V===i.UNSIGNED_INT&&(tt=i.RGBA32UI),V===i.BYTE&&(tt=i.RGBA8I),V===i.SHORT&&(tt=i.RGBA16I),V===i.INT&&(tt=i.RGBA32I)),x===i.RGB&&(V===i.UNSIGNED_SHORT&&ht&&(tt=ht.RGB16_EXT),V===i.SHORT&&ht&&(tt=ht.RGB16_SNORM_EXT),V===i.UNSIGNED_INT_5_9_9_9_REV&&(tt=i.RGB9_E5),V===i.UNSIGNED_INT_10F_11F_11F_REV&&(tt=i.R11F_G11F_B10F)),x===i.RGBA){let st=at?pr:Zt.getTransfer(Q);V===i.FLOAT&&(tt=i.RGBA32F),V===i.HALF_FLOAT&&(tt=i.RGBA16F),V===i.UNSIGNED_BYTE&&(tt=st===ee?i.SRGB8_ALPHA8:i.RGBA8),V===i.UNSIGNED_SHORT&&ht&&(tt=ht.RGBA16_EXT),V===i.SHORT&&ht&&(tt=ht.RGBA16_SNORM_EXT),V===i.UNSIGNED_SHORT_4_4_4_4&&(tt=i.RGBA4),V===i.UNSIGNED_SHORT_5_5_5_1&&(tt=i.RGB5_A1)}return(tt===i.R16F||tt===i.R32F||tt===i.RG16F||tt===i.RG32F||tt===i.RGBA16F||tt===i.RGBA32F)&&t.get("EXT_color_buffer_float"),tt}function b(I,x){let V;return I?x===null||x===Sn||x===Ls?V=i.DEPTH24_STENCIL8:x===un?V=i.DEPTH32F_STENCIL8:x===Is&&(V=i.DEPTH24_STENCIL8,Lt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):x===null||x===Sn||x===Ls?V=i.DEPTH_COMPONENT24:x===un?V=i.DEPTH_COMPONENT32F:x===Is&&(V=i.DEPTH_COMPONENT16),V}function S(I,x){return d(I)===!0||I.isFramebufferTexture&&I.minFilter!==Ie&&I.minFilter!==Le?Math.log2(Math.max(x.width,x.height))+1:I.mipmaps!==void 0&&I.mipmaps.length>0?I.mipmaps.length:I.isCompressedTexture&&Array.isArray(I.image)?x.mipmaps.length:1}function C(I){let x=I.target;x.removeEventListener("dispose",C),T(x),x.isVideoTexture&&u.delete(x),x.isHTMLTexture&&f.delete(x)}function v(I){let x=I.target;x.removeEventListener("dispose",v),A(x)}function T(I){let x=n.get(I);if(x.__webglInit===void 0)return;let V=I.source,Z=p.get(V);if(Z){let Q=Z[x.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&R(I),Object.keys(Z).length===0&&p.delete(V)}n.remove(I)}function R(I){let x=n.get(I);i.deleteTexture(x.__webglTexture);let V=I.source,Z=p.get(V);delete Z[x.__cacheKey],o.memory.textures--}function A(I){let x=n.get(I);if(I.depthTexture&&(I.depthTexture.dispose(),n.remove(I.depthTexture)),I.isWebGLCubeRenderTarget)for(let Z=0;Z<6;Z++){if(Array.isArray(x.__webglFramebuffer[Z]))for(let Q=0;Q<x.__webglFramebuffer[Z].length;Q++)i.deleteFramebuffer(x.__webglFramebuffer[Z][Q]);else i.deleteFramebuffer(x.__webglFramebuffer[Z]);x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer[Z])}else{if(Array.isArray(x.__webglFramebuffer))for(let Z=0;Z<x.__webglFramebuffer.length;Z++)i.deleteFramebuffer(x.__webglFramebuffer[Z]);else i.deleteFramebuffer(x.__webglFramebuffer);if(x.__webglDepthbuffer&&i.deleteRenderbuffer(x.__webglDepthbuffer),x.__webglMultisampledFramebuffer&&i.deleteFramebuffer(x.__webglMultisampledFramebuffer),x.__webglColorRenderbuffer)for(let Z=0;Z<x.__webglColorRenderbuffer.length;Z++)x.__webglColorRenderbuffer[Z]&&i.deleteRenderbuffer(x.__webglColorRenderbuffer[Z]);x.__webglDepthRenderbuffer&&i.deleteRenderbuffer(x.__webglDepthRenderbuffer)}let V=I.textures;for(let Z=0,Q=V.length;Z<Q;Z++){let at=n.get(V[Z]);at.__webglTexture&&(i.deleteTexture(at.__webglTexture),o.memory.textures--),n.remove(V[Z])}n.remove(I)}let P=0;function D(){P=0}function L(){return P}function F(I){P=I}function U(){let I=P;return I>=s.maxTextures&&Lt("WebGLTextures: Trying to use "+(I+1)+" texture units while this GPU supports only "+s.maxTextures),P+=1,I}function O(I){let x=[];return x.push(I.wrapS),x.push(I.wrapT),x.push(I.wrapR||0),x.push(I.magFilter),x.push(I.minFilter),x.push(I.anisotropy),x.push(I.internalFormat),x.push(I.format),x.push(I.type),x.push(I.generateMipmaps),x.push(I.premultiplyAlpha),x.push(I.flipY),x.push(I.unpackAlignment),x.push(I.colorSpace),x.join()}function q(I,x){let V=n.get(I);if(I.isVideoTexture&&k(I),I.isRenderTargetTexture===!1&&I.isExternalTexture!==!0&&I.version>0&&V.__version!==I.version){let Z=I.image;if(Z===null)Lt("WebGLRenderer: Texture marked for update but no image data found.");else if(Z.complete===!1)Lt("WebGLRenderer: Texture marked for update but image is incomplete");else{ot(V,I,x);return}}else I.isExternalTexture&&(V.__webglTexture=I.sourceTexture?I.sourceTexture:null);e.bindTexture(i.TEXTURE_2D,V.__webglTexture,i.TEXTURE0+x)}function H(I,x){let V=n.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&V.__version!==I.version){ot(V,I,x);return}else I.isExternalTexture&&(V.__webglTexture=I.sourceTexture?I.sourceTexture:null);e.bindTexture(i.TEXTURE_2D_ARRAY,V.__webglTexture,i.TEXTURE0+x)}function j(I,x){let V=n.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&V.__version!==I.version){ot(V,I,x);return}e.bindTexture(i.TEXTURE_3D,V.__webglTexture,i.TEXTURE0+x)}function it(I,x){let V=n.get(I);if(I.isCubeDepthTexture!==!0&&I.version>0&&V.__version!==I.version){wt(V,I,x);return}e.bindTexture(i.TEXTURE_CUBE_MAP,V.__webglTexture,i.TEXTURE0+x)}let X={[xs]:i.REPEAT,[Rn]:i.CLAMP_TO_EDGE,[Bo]:i.MIRRORED_REPEAT},nt={[Ie]:i.NEAREST,[nd]:i.NEAREST_MIPMAP_NEAREST,[Dr]:i.NEAREST_MIPMAP_LINEAR,[Le]:i.LINEAR,[ua]:i.LINEAR_MIPMAP_NEAREST,[yi]:i.LINEAR_MIPMAP_LINEAR},lt={[od]:i.NEVER,[ud]:i.ALWAYS,[ad]:i.LESS,[Ka]:i.LEQUAL,[ld]:i.EQUAL,[Ja]:i.GEQUAL,[cd]:i.GREATER,[hd]:i.NOTEQUAL};function ct(I,x){if(x.type===un&&t.has("OES_texture_float_linear")===!1&&(x.magFilter===Le||x.magFilter===ua||x.magFilter===Dr||x.magFilter===yi||x.minFilter===Le||x.minFilter===ua||x.minFilter===Dr||x.minFilter===yi)&&Lt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(I,i.TEXTURE_WRAP_S,X[x.wrapS]),i.texParameteri(I,i.TEXTURE_WRAP_T,X[x.wrapT]),(I===i.TEXTURE_3D||I===i.TEXTURE_2D_ARRAY)&&i.texParameteri(I,i.TEXTURE_WRAP_R,X[x.wrapR]),i.texParameteri(I,i.TEXTURE_MAG_FILTER,nt[x.magFilter]),i.texParameteri(I,i.TEXTURE_MIN_FILTER,nt[x.minFilter]),x.compareFunction&&(i.texParameteri(I,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(I,i.TEXTURE_COMPARE_FUNC,lt[x.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(x.magFilter===Ie||x.minFilter!==Dr&&x.minFilter!==yi||x.type===un&&t.has("OES_texture_float_linear")===!1)return;if(x.anisotropy>1||n.get(x).__currentAnisotropy){let V=t.get("EXT_texture_filter_anisotropic");i.texParameterf(I,V.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(x.anisotropy,s.getMaxAnisotropy())),n.get(x).__currentAnisotropy=x.anisotropy}}}function bt(I,x){let V=!1;I.__webglInit===void 0&&(I.__webglInit=!0,x.addEventListener("dispose",C));let Z=x.source,Q=p.get(Z);Q===void 0&&(Q={},p.set(Z,Q));let at=O(x);if(at!==I.__cacheKey){Q[at]===void 0&&(Q[at]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,V=!0),Q[at].usedTimes++;let ht=Q[I.__cacheKey];ht!==void 0&&(Q[I.__cacheKey].usedTimes--,ht.usedTimes===0&&R(x)),I.__cacheKey=at,I.__webglTexture=Q[at].texture}return V}function Y(I,x,V){return Math.floor(Math.floor(I/V)/x)}function J(I,x,V,Z){let at=I.updateRanges;if(at.length===0)e.texSubImage2D(i.TEXTURE_2D,0,0,0,x.width,x.height,V,Z,x.data);else{at.sort((Rt,mt)=>Rt.start-mt.start);let ht=0;for(let Rt=1;Rt<at.length;Rt++){let mt=at[ht],dt=at[Rt],Pt=mt.start+mt.count,Dt=Y(dt.start,x.width,4),Bt=Y(mt.start,x.width,4);dt.start<=Pt+1&&Dt===Bt&&Y(dt.start+dt.count-1,x.width,4)===Dt?mt.count=Math.max(mt.count,dt.start+dt.count-mt.start):(++ht,at[ht]=dt)}at.length=ht+1;let tt=e.getParameter(i.UNPACK_ROW_LENGTH),st=e.getParameter(i.UNPACK_SKIP_PIXELS),ut=e.getParameter(i.UNPACK_SKIP_ROWS);e.pixelStorei(i.UNPACK_ROW_LENGTH,x.width);for(let Rt=0,mt=at.length;Rt<mt;Rt++){let dt=at[Rt],Pt=Math.floor(dt.start/4),Dt=Math.ceil(dt.count/4),Bt=Pt%x.width,B=Math.floor(Pt/x.width),ft=Dt,et=1;e.pixelStorei(i.UNPACK_SKIP_PIXELS,Bt),e.pixelStorei(i.UNPACK_SKIP_ROWS,B),e.texSubImage2D(i.TEXTURE_2D,0,Bt,B,ft,et,V,Z,x.data)}I.clearUpdateRanges(),e.pixelStorei(i.UNPACK_ROW_LENGTH,tt),e.pixelStorei(i.UNPACK_SKIP_PIXELS,st),e.pixelStorei(i.UNPACK_SKIP_ROWS,ut)}}function ot(I,x,V){let Z=i.TEXTURE_2D;(x.isDataArrayTexture||x.isCompressedArrayTexture)&&(Z=i.TEXTURE_2D_ARRAY),x.isData3DTexture&&(Z=i.TEXTURE_3D);let Q=bt(I,x),at=x.source;e.bindTexture(Z,I.__webglTexture,i.TEXTURE0+V);let ht=n.get(at);if(at.version!==ht.__version||Q===!0){if(e.activeTexture(i.TEXTURE0+V),(typeof ImageBitmap<"u"&&x.image instanceof ImageBitmap)===!1){let et=Zt.getPrimaries(Zt.workingColorSpace),pt=x.colorSpace===Kn?null:Zt.getPrimaries(x.colorSpace),vt=x.colorSpace===Kn||et===pt?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,vt)}e.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment);let st=m(x.image,!1,s.maxTextureSize);st=Ne(x,st);let ut=r.convert(x.format,x.colorSpace),Rt=r.convert(x.type),mt=y(x.internalFormat,ut,Rt,x.normalized,x.colorSpace,x.isVideoTexture);ct(Z,x);let dt,Pt=x.mipmaps,Dt=x.isVideoTexture!==!0,Bt=ht.__version===void 0||Q===!0,B=at.dataReady,ft=S(x,st);if(x.isDepthTexture)mt=b(x.format===vi,x.type),Bt&&(Dt?e.texStorage2D(i.TEXTURE_2D,1,mt,st.width,st.height):e.texImage2D(i.TEXTURE_2D,0,mt,st.width,st.height,0,ut,Rt,null));else if(x.isDataTexture)if(Pt.length>0){Dt&&Bt&&e.texStorage2D(i.TEXTURE_2D,ft,mt,Pt[0].width,Pt[0].height);for(let et=0,pt=Pt.length;et<pt;et++)dt=Pt[et],Dt?B&&e.texSubImage2D(i.TEXTURE_2D,et,0,0,dt.width,dt.height,ut,Rt,dt.data):e.texImage2D(i.TEXTURE_2D,et,mt,dt.width,dt.height,0,ut,Rt,dt.data);x.generateMipmaps=!1}else Dt?(Bt&&e.texStorage2D(i.TEXTURE_2D,ft,mt,st.width,st.height),B&&J(x,st,ut,Rt)):e.texImage2D(i.TEXTURE_2D,0,mt,st.width,st.height,0,ut,Rt,st.data);else if(x.isCompressedTexture)if(x.isCompressedArrayTexture){Dt&&Bt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ft,mt,Pt[0].width,Pt[0].height,st.depth);for(let et=0,pt=Pt.length;et<pt;et++)if(dt=Pt[et],x.format!==dn)if(ut!==null)if(Dt){if(B)if(x.layerUpdates.size>0){let vt=Bc(dt.width,dt.height,x.format,x.type);for(let rt of x.layerUpdates){let It=dt.data.subarray(rt*vt/dt.data.BYTES_PER_ELEMENT,(rt+1)*vt/dt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,et,0,0,rt,dt.width,dt.height,1,ut,It)}}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,et,0,0,0,dt.width,dt.height,st.depth,ut,dt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,et,mt,dt.width,dt.height,st.depth,0,dt.data,0,0);else Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Dt?B&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,et,0,0,0,dt.width,dt.height,st.depth,ut,Rt,dt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,et,mt,dt.width,dt.height,st.depth,0,ut,Rt,dt.data);x.layerUpdates.size>0&&x.clearLayerUpdates()}else{Dt&&Bt&&e.texStorage2D(i.TEXTURE_2D,ft,mt,Pt[0].width,Pt[0].height);for(let et=0,pt=Pt.length;et<pt;et++)dt=Pt[et],x.format!==dn?ut!==null?Dt?B&&e.compressedTexSubImage2D(i.TEXTURE_2D,et,0,0,dt.width,dt.height,ut,dt.data):e.compressedTexImage2D(i.TEXTURE_2D,et,mt,dt.width,dt.height,0,dt.data):Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Dt?B&&e.texSubImage2D(i.TEXTURE_2D,et,0,0,dt.width,dt.height,ut,Rt,dt.data):e.texImage2D(i.TEXTURE_2D,et,mt,dt.width,dt.height,0,ut,Rt,dt.data)}else if(x.isDataArrayTexture)if(Dt){if(Bt&&e.texStorage3D(i.TEXTURE_2D_ARRAY,ft,mt,st.width,st.height,st.depth),B)if(x.layerUpdates.size>0){let et=Bc(st.width,st.height,x.format,x.type);for(let pt of x.layerUpdates){let vt=st.data.subarray(pt*et/st.data.BYTES_PER_ELEMENT,(pt+1)*et/st.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,pt,st.width,st.height,1,ut,Rt,vt)}x.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,st.width,st.height,st.depth,ut,Rt,st.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,mt,st.width,st.height,st.depth,0,ut,Rt,st.data);else if(x.isData3DTexture)Dt?(Bt&&e.texStorage3D(i.TEXTURE_3D,ft,mt,st.width,st.height,st.depth),B&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,st.width,st.height,st.depth,ut,Rt,st.data)):e.texImage3D(i.TEXTURE_3D,0,mt,st.width,st.height,st.depth,0,ut,Rt,st.data);else if(x.isFramebufferTexture){if(Bt)if(Dt)e.texStorage2D(i.TEXTURE_2D,ft,mt,st.width,st.height);else{let et=st.width,pt=st.height;for(let vt=0;vt<ft;vt++)e.texImage2D(i.TEXTURE_2D,vt,mt,et,pt,0,ut,Rt,null),et>>=1,pt>>=1}}else if(x.isHTMLTexture){if("texElementImage2D"in i){let et=i.canvas;if(et.hasAttribute("layoutsubtree")||et.setAttribute("layoutsubtree","true"),st.parentNode!==et){et.appendChild(st),f.add(x),et.onpaint=pt=>{let vt=pt.changedElements;for(let rt of f)vt.includes(rt.image)&&(rt.needsUpdate=!0)},et.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,st);else{let vt=i.RGBA,rt=i.RGBA,It=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,vt,rt,It,st)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Pt.length>0){if(Dt&&Bt){let et=se(Pt[0]);e.texStorage2D(i.TEXTURE_2D,ft,mt,et.width,et.height)}for(let et=0,pt=Pt.length;et<pt;et++)dt=Pt[et],Dt?B&&e.texSubImage2D(i.TEXTURE_2D,et,0,0,ut,Rt,dt):e.texImage2D(i.TEXTURE_2D,et,mt,ut,Rt,dt);x.generateMipmaps=!1}else if(Dt){if(Bt){let et=se(st);e.texStorage2D(i.TEXTURE_2D,ft,mt,et.width,et.height)}B&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,ut,Rt,st)}else e.texImage2D(i.TEXTURE_2D,0,mt,ut,Rt,st);d(x)&&M(Z),ht.__version=at.version,x.onUpdate&&x.onUpdate(x)}I.__version=x.version}function wt(I,x,V){if(x.image.length!==6)return;let Z=bt(I,x),Q=x.source;e.bindTexture(i.TEXTURE_CUBE_MAP,I.__webglTexture,i.TEXTURE0+V);let at=n.get(Q);if(Q.version!==at.__version||Z===!0){e.activeTexture(i.TEXTURE0+V);let ht=Zt.getPrimaries(Zt.workingColorSpace),tt=x.colorSpace===Kn?null:Zt.getPrimaries(x.colorSpace),st=x.colorSpace===Kn||ht===tt?i.NONE:i.BROWSER_DEFAULT_WEBGL;e.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,x.flipY),e.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,x.premultiplyAlpha),e.pixelStorei(i.UNPACK_ALIGNMENT,x.unpackAlignment),e.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,st);let ut=x.isCompressedTexture||x.image[0].isCompressedTexture,Rt=x.image[0]&&x.image[0].isDataTexture,mt=[];for(let rt=0;rt<6;rt++)!ut&&!Rt?mt[rt]=m(x.image[rt],!0,s.maxCubemapSize):mt[rt]=Rt?x.image[rt].image:x.image[rt],mt[rt]=Ne(x,mt[rt]);let dt=mt[0],Pt=r.convert(x.format,x.colorSpace),Dt=r.convert(x.type),Bt=y(x.internalFormat,Pt,Dt,x.normalized,x.colorSpace),B=x.isVideoTexture!==!0,ft=at.__version===void 0||Z===!0,et=Q.dataReady,pt=S(x,dt);ct(i.TEXTURE_CUBE_MAP,x);let vt;if(ut){B&&ft&&e.texStorage2D(i.TEXTURE_CUBE_MAP,pt,Bt,dt.width,dt.height);for(let rt=0;rt<6;rt++){vt=mt[rt].mipmaps;for(let It=0;It<vt.length;It++){let At=vt[It];x.format!==dn?Pt!==null?B?et&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,0,0,At.width,At.height,Pt,At.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,Bt,At.width,At.height,0,At.data):Lt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):B?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,0,0,At.width,At.height,Pt,Dt,At.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It,Bt,At.width,At.height,0,Pt,Dt,At.data)}}}else{if(vt=x.mipmaps,B&&ft){vt.length>0&&pt++;let rt=se(mt[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,pt,Bt,rt.width,rt.height)}for(let rt=0;rt<6;rt++)if(Rt){B?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,0,0,mt[rt].width,mt[rt].height,Pt,Dt,mt[rt].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,Bt,mt[rt].width,mt[rt].height,0,Pt,Dt,mt[rt].data);for(let It=0;It<vt.length;It++){let le=vt[It].image[rt].image;B?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,0,0,le.width,le.height,Pt,Dt,le.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,Bt,le.width,le.height,0,Pt,Dt,le.data)}}else{B?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,0,0,Pt,Dt,mt[rt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,0,Bt,Pt,Dt,mt[rt]);for(let It=0;It<vt.length;It++){let At=vt[It];B?et&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,0,0,Pt,Dt,At.image[rt]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+rt,It+1,Bt,Pt,Dt,At.image[rt])}}}d(x)&&M(i.TEXTURE_CUBE_MAP),at.__version=Q.version,x.onUpdate&&x.onUpdate(x)}I.__version=x.version}function _t(I,x,V,Z,Q,at){let ht=r.convert(V.format,V.colorSpace),tt=r.convert(V.type),st=y(V.internalFormat,ht,tt,V.normalized,V.colorSpace),ut=n.get(x),Rt=n.get(V);if(Rt.__renderTarget=x,!ut.__hasExternalTextures){let mt=Math.max(1,x.width>>at),dt=Math.max(1,x.height>>at);Q===i.TEXTURE_3D||Q===i.TEXTURE_2D_ARRAY?e.texImage3D(Q,at,st,mt,dt,x.depth,0,ht,tt,null):e.texImage2D(Q,at,st,mt,dt,0,ht,tt,null)}e.bindFramebuffer(i.FRAMEBUFFER,I),Me(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Z,Q,Rt.__webglTexture,0,_e(x)):(Q===i.TEXTURE_2D||Q>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,Z,Q,Rt.__webglTexture,at),e.bindFramebuffer(i.FRAMEBUFFER,null)}function zt(I,x,V){if(i.bindRenderbuffer(i.RENDERBUFFER,I),x.depthBuffer){let Z=x.depthTexture,Q=Z&&Z.isDepthTexture?Z.type:null,at=b(x.stencilBuffer,Q),ht=x.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;Me(x)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,_e(x),at,x.width,x.height):V?i.renderbufferStorageMultisample(i.RENDERBUFFER,_e(x),at,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,at,x.width,x.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ht,i.RENDERBUFFER,I)}else{let Z=x.textures;for(let Q=0;Q<Z.length;Q++){let at=Z[Q],ht=r.convert(at.format,at.colorSpace),tt=r.convert(at.type),st=y(at.internalFormat,ht,tt,at.normalized,at.colorSpace);Me(x)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,_e(x),st,x.width,x.height):V?i.renderbufferStorageMultisample(i.RENDERBUFFER,_e(x),st,x.width,x.height):i.renderbufferStorage(i.RENDERBUFFER,st,x.width,x.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Te(I,x,V){let Z=x.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(i.FRAMEBUFFER,I),!(x.depthTexture&&x.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Q=n.get(x.depthTexture);if(Q.__renderTarget=x,(!Q.__webglTexture||x.depthTexture.image.width!==x.width||x.depthTexture.image.height!==x.height)&&(x.depthTexture.image.width=x.width,x.depthTexture.image.height=x.height,x.depthTexture.needsUpdate=!0),Z){if(Q.__webglInit===void 0&&(Q.__webglInit=!0,x.depthTexture.addEventListener("dispose",C)),Q.__webglTexture===void 0){Q.__webglTexture=i.createTexture(),e.bindTexture(i.TEXTURE_CUBE_MAP,Q.__webglTexture),ct(i.TEXTURE_CUBE_MAP,x.depthTexture);let ut=r.convert(x.depthTexture.format),Rt=r.convert(x.depthTexture.type),mt;x.depthTexture.format===Pn?mt=i.DEPTH_COMPONENT24:x.depthTexture.format===vi&&(mt=i.DEPTH24_STENCIL8);for(let dt=0;dt<6;dt++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+dt,0,mt,x.width,x.height,0,ut,Rt,null)}}else q(x.depthTexture,0);let at=Q.__webglTexture,ht=_e(x),tt=Z?i.TEXTURE_CUBE_MAP_POSITIVE_X+V:i.TEXTURE_2D,st=x.depthTexture.format===vi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(x.depthTexture.format===Pn)Me(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,st,tt,at,0,ht):i.framebufferTexture2D(i.FRAMEBUFFER,st,tt,at,0);else if(x.depthTexture.format===vi)Me(x)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,st,tt,at,0,ht):i.framebufferTexture2D(i.FRAMEBUFFER,st,tt,at,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Xt(I){let x=n.get(I),V=I.isWebGLCubeRenderTarget===!0;if(x.__boundDepthTexture!==I.depthTexture){let Z=I.depthTexture;if(x.__depthDisposeCallback&&x.__depthDisposeCallback(),Z){let Q=()=>{delete x.__boundDepthTexture,delete x.__depthDisposeCallback,Z.removeEventListener("dispose",Q)};Z.addEventListener("dispose",Q),x.__depthDisposeCallback=Q}x.__boundDepthTexture=Z}if(I.depthTexture&&!x.__autoAllocateDepthBuffer)if(V)for(let Z=0;Z<6;Z++)Te(x.__webglFramebuffer[Z],I,Z);else{let Z=I.texture.mipmaps;Z&&Z.length>0?Te(x.__webglFramebuffer[0],I,0):Te(x.__webglFramebuffer,I,0)}else if(V){x.__webglDepthbuffer=[];for(let Z=0;Z<6;Z++)if(e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[Z]),x.__webglDepthbuffer[Z]===void 0)x.__webglDepthbuffer[Z]=i.createRenderbuffer(),zt(x.__webglDepthbuffer[Z],I,!1);else{let Q=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=x.__webglDepthbuffer[Z];i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,Q,i.RENDERBUFFER,at)}}else{let Z=I.texture.mipmaps;if(Z&&Z.length>0?e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer[0]):e.bindFramebuffer(i.FRAMEBUFFER,x.__webglFramebuffer),x.__webglDepthbuffer===void 0)x.__webglDepthbuffer=i.createRenderbuffer(),zt(x.__webglDepthbuffer,I,!1);else{let Q=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,at=x.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,at),i.framebufferRenderbuffer(i.FRAMEBUFFER,Q,i.RENDERBUFFER,at)}}e.bindFramebuffer(i.FRAMEBUFFER,null)}function Kt(I,x,V){let Z=n.get(I);x!==void 0&&_t(Z.__webglFramebuffer,I,I.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),V!==void 0&&Xt(I)}function ae(I){let x=I.texture,V=n.get(I),Z=n.get(x);I.addEventListener("dispose",v);let Q=I.textures,at=I.isWebGLCubeRenderTarget===!0,ht=Q.length>1;if(ht||(Z.__webglTexture===void 0&&(Z.__webglTexture=i.createTexture()),Z.__version=x.version,o.memory.textures++),at){V.__webglFramebuffer=[];for(let tt=0;tt<6;tt++)if(x.mipmaps&&x.mipmaps.length>0){V.__webglFramebuffer[tt]=[];for(let st=0;st<x.mipmaps.length;st++)V.__webglFramebuffer[tt][st]=i.createFramebuffer()}else V.__webglFramebuffer[tt]=i.createFramebuffer()}else{if(x.mipmaps&&x.mipmaps.length>0){V.__webglFramebuffer=[];for(let tt=0;tt<x.mipmaps.length;tt++)V.__webglFramebuffer[tt]=i.createFramebuffer()}else V.__webglFramebuffer=i.createFramebuffer();if(ht)for(let tt=0,st=Q.length;tt<st;tt++){let ut=n.get(Q[tt]);ut.__webglTexture===void 0&&(ut.__webglTexture=i.createTexture(),o.memory.textures++)}if(I.samples>0&&Me(I)===!1){V.__webglMultisampledFramebuffer=i.createFramebuffer(),V.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,V.__webglMultisampledFramebuffer);for(let tt=0;tt<Q.length;tt++){let st=Q[tt];V.__webglColorRenderbuffer[tt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,V.__webglColorRenderbuffer[tt]);let ut=r.convert(st.format,st.colorSpace),Rt=r.convert(st.type),mt=y(st.internalFormat,ut,Rt,st.normalized,st.colorSpace,I.isXRRenderTarget===!0),dt=_e(I);i.renderbufferStorageMultisample(i.RENDERBUFFER,dt,mt,I.width,I.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+tt,i.RENDERBUFFER,V.__webglColorRenderbuffer[tt])}i.bindRenderbuffer(i.RENDERBUFFER,null),I.depthBuffer&&(V.__webglDepthRenderbuffer=i.createRenderbuffer(),zt(V.__webglDepthRenderbuffer,I,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(at){e.bindTexture(i.TEXTURE_CUBE_MAP,Z.__webglTexture),ct(i.TEXTURE_CUBE_MAP,x);for(let tt=0;tt<6;tt++)if(x.mipmaps&&x.mipmaps.length>0)for(let st=0;st<x.mipmaps.length;st++)_t(V.__webglFramebuffer[tt][st],I,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,st);else _t(V.__webglFramebuffer[tt],I,x,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+tt,0);d(x)&&M(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(ht){for(let tt=0,st=Q.length;tt<st;tt++){let ut=Q[tt],Rt=n.get(ut),mt=i.TEXTURE_2D;(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(mt=I.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(mt,Rt.__webglTexture),ct(mt,ut),_t(V.__webglFramebuffer,I,ut,i.COLOR_ATTACHMENT0+tt,mt,0),d(ut)&&M(mt)}e.unbindTexture()}else{let tt=i.TEXTURE_2D;if((I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(tt=I.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(tt,Z.__webglTexture),ct(tt,x),x.mipmaps&&x.mipmaps.length>0)for(let st=0;st<x.mipmaps.length;st++)_t(V.__webglFramebuffer[st],I,x,i.COLOR_ATTACHMENT0,tt,st);else _t(V.__webglFramebuffer,I,x,i.COLOR_ATTACHMENT0,tt,0);d(x)&&M(tt),e.unbindTexture()}I.depthBuffer&&Xt(I)}function Yt(I){let x=I.textures;for(let V=0,Z=x.length;V<Z;V++){let Q=x[V];if(d(Q)){let at=E(I),ht=n.get(Q).__webglTexture;e.bindTexture(at,ht),M(at),e.unbindTexture()}}}let me=[],Re=[];function Ye(I){if(I.samples>0){if(Me(I)===!1){let x=I.textures,V=I.width,Z=I.height,Q=i.COLOR_BUFFER_BIT,at=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ht=n.get(I),tt=x.length>1;if(tt)for(let ut=0;ut<x.length;ut++)e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,ht.__webglMultisampledFramebuffer);let st=I.texture.mipmaps;st&&st.length>0?e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglFramebuffer[0]):e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglFramebuffer);for(let ut=0;ut<x.length;ut++){if(I.resolveDepthBuffer&&(I.depthBuffer&&(Q|=i.DEPTH_BUFFER_BIT),I.stencilBuffer&&I.resolveStencilBuffer&&(Q|=i.STENCIL_BUFFER_BIT)),tt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ht.__webglColorRenderbuffer[ut]);let Rt=n.get(x[ut]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Rt,0)}i.blitFramebuffer(0,0,V,Z,0,0,V,Z,Q,i.NEAREST),l===!0&&(me.length=0,Re.length=0,me.push(i.COLOR_ATTACHMENT0+ut),I.depthBuffer&&I.storeMultisampledDepthBuffer===!1&&(me.push(at),Re.push(at),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Re)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,me))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),tt)for(let ut=0;ut<x.length;ut++){e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.RENDERBUFFER,ht.__webglColorRenderbuffer[ut]);let Rt=n.get(x[ut]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,ht.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+ut,i.TEXTURE_2D,Rt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,ht.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.storeMultisampledDepthBuffer===!1&&l){let x=I.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[x])}}}function _e(I){return Math.min(s.maxSamples,I.samples)}function Me(I){let x=n.get(I);return I.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&x.__useRenderToTexture!==!1}function k(I){let x=o.render.frame;u.get(I)!==x&&(u.set(I,x),I.update())}function Ne(I,x){let V=I.colorSpace,Z=I.format,Q=I.type;return I.isCompressedTexture===!0||I.isVideoTexture===!0||V!==fr&&V!==Kn&&(Zt.getTransfer(V)===ee?(Z!==dn||Q!==Ke)&&Lt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ot("WebGLTextures: Unsupported texture color space:",V)),x}function se(I){return typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement?(c.width=I.naturalWidth||I.width,c.height=I.naturalHeight||I.height):typeof VideoFrame<"u"&&I instanceof VideoFrame?(c.width=I.displayWidth,c.height=I.displayHeight):(c.width=I.width,c.height=I.height),c}this.allocateTextureUnit=U,this.resetTextureUnits=D,this.getTextureUnits=L,this.setTextureUnits=F,this.setTexture2D=q,this.setTexture2DArray=H,this.setTexture3D=j,this.setTextureCube=it,this.rebindTextures=Kt,this.setupRenderTarget=ae,this.updateRenderTargetMipmap=Yt,this.updateMultisampleRenderTarget=Ye,this.setupDepthRenderbuffer=Xt,this.setupFrameBufferTexture=_t,this.useMultisampledRTT=Me,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function sy(i,t){function e(n,s=Kn){let r,o=Zt.getTransfer(s);if(n===Ke)return i.UNSIGNED_BYTE;if(n===fa)return i.UNSIGNED_SHORT_4_4_4_4;if(n===pa)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Cc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Rc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Tc)return i.BYTE;if(n===Ac)return i.SHORT;if(n===Is)return i.UNSIGNED_SHORT;if(n===da)return i.INT;if(n===Sn)return i.UNSIGNED_INT;if(n===un)return i.FLOAT;if(n===bn)return i.HALF_FLOAT;if(n===Pc)return i.ALPHA;if(n===Ic)return i.RGB;if(n===dn)return i.RGBA;if(n===Pn)return i.DEPTH_COMPONENT;if(n===vi)return i.DEPTH_STENCIL;if(n===ma)return i.RED;if(n===ga)return i.RED_INTEGER;if(n===Mi)return i.RG;if(n===_a)return i.RG_INTEGER;if(n===xa)return i.RGBA_INTEGER;if(n===Or||n===Nr||n===Fr||n===Br)if(o===ee)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Or)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Nr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Fr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Br)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Or)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Nr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Fr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Br)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===ya||n===va||n===Ma||n===Sa)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===ya)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===va)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ma)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Sa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===ba||n===wa||n===Ea||n===Ta||n===Aa||n===kr||n===Ca)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===ba||n===wa)return o===ee?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Ea)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Ta)return r.COMPRESSED_R11_EAC;if(n===Aa)return r.COMPRESSED_SIGNED_R11_EAC;if(n===kr)return r.COMPRESSED_RG11_EAC;if(n===Ca)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Ra||n===Pa||n===Ia||n===La||n===Ua||n===Da||n===Oa||n===Na||n===Fa||n===Ba||n===ka||n===za||n===Va||n===Ha)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Ra)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Pa)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Ia)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===La)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ua)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Da)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Oa)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Na)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Fa)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Ba)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===ka)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===za)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Va)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Ha)return o===ee?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Ga||n===Wa||n===Xa)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===Ga)return o===ee?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Wa)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Xa)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===qa||n===Ya||n===zr||n===Za)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===qa)return r.COMPRESSED_RED_RGTC1_EXT;if(n===Ya)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===zr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Za)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Ls?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}var ry=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,oy=`
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

}`,jc=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let n=new br(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,n=new Xe({vertexShader:ry,fragmentShader:oy,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new De(new ki(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Qc=class extends In{constructor(t,e){super();let n=this,s=null,r=1,o=null,a="local-floor",l=1,c=null,u=null,f=null,h=null,p=null,g=null,_=typeof XRWebGLBinding<"u",m=new jc,d={},M=e.getContextAttributes(),E=null,y=null,b=[],S=[],C=new Ht,v=null,T=null,R=new Ze;R.viewport=new he;let A=new Ze;A.viewport=new he;let P=[R,A],D=new la,L=null,F=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let J=b[Y];return J===void 0&&(J=new ws,b[Y]=J),J.getTargetRaySpace()},this.getControllerGrip=function(Y){let J=b[Y];return J===void 0&&(J=new ws,b[Y]=J),J.getGripSpace()},this.getHand=function(Y){let J=b[Y];return J===void 0&&(J=new ws,b[Y]=J),J.getHandSpace()};function U(Y){let J=S.indexOf(Y.inputSource);if(J===-1)return;let ot=b[J];ot!==void 0&&(ot.update(Y.inputSource,Y.frame,c||o),ot.dispatchEvent({type:Y.type,data:Y.inputSource}))}function O(){s.removeEventListener("select",U),s.removeEventListener("selectstart",U),s.removeEventListener("selectend",U),s.removeEventListener("squeeze",U),s.removeEventListener("squeezestart",U),s.removeEventListener("squeezeend",U),s.removeEventListener("end",O),s.removeEventListener("inputsourceschange",q);for(let Y=0;Y<b.length;Y++){let J=S[Y];J!==null&&(S[Y]=null,b[Y].disconnect(J))}L=null,F=null,m.reset();for(let Y in d)delete d[Y];if(t.setRenderTarget(E),p=null,h=null,f=null,s=null,y=null,bt.stop(),n.isPresenting=!1,t.setPixelRatio(v),t.setSize(C.width,C.height,!1),T!==null){let Y=T.camera;Y.fov=T.fov,Y.zoom=T.zoom,Y.updateProjectionMatrix(),T=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){r=Y,n.isPresenting===!0&&Lt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){a=Y,n.isPresenting===!0&&Lt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return h!==null?h:p},this.getBinding=function(){return f===null&&_&&(f=new XRWebGLBinding(s,e)),f},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Y){if(s=Y,s!==null){if(E=t.getRenderTarget(),s.addEventListener("select",U),s.addEventListener("selectstart",U),s.addEventListener("selectend",U),s.addEventListener("squeeze",U),s.addEventListener("squeezestart",U),s.addEventListener("squeezeend",U),s.addEventListener("end",O),s.addEventListener("inputsourceschange",q),M.xrCompatible!==!0&&await e.makeXRCompatible(),v=t.getPixelRatio(),t.getSize(C),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let ot=null,wt=null,_t=null;M.depth&&(_t=M.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,ot=M.stencil?vi:Pn,wt=M.stencil?Ls:Sn);let zt={colorFormat:e.RGBA8,depthFormat:_t,scaleFactor:r};f=this.getBinding(),h=f.createProjectionLayer(zt),s.updateRenderState({layers:[h]}),t.setPixelRatio(1),t.setSize(h.textureWidth,h.textureHeight,!1),y=new $e(h.textureWidth,h.textureHeight,{format:dn,type:Ke,depthTexture:new hi(h.textureWidth,h.textureHeight,wt,void 0,void 0,void 0,void 0,void 0,void 0,ot),stencilBuffer:M.stencil,colorSpace:t.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1,storeMultisampledDepthBuffer:h.ignoreDepthValues===!1,storeMultisampledStencilBuffer:h.ignoreDepthValues===!1})}else{let ot={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:r};p=new XRWebGLLayer(s,e,ot),s.updateRenderState({baseLayer:p}),t.setPixelRatio(1),t.setSize(p.framebufferWidth,p.framebufferHeight,!1),y=new $e(p.framebufferWidth,p.framebufferHeight,{format:dn,type:Ke,colorSpace:t.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1,storeMultisampledDepthBuffer:p.ignoreDepthValues===!1,storeMultisampledStencilBuffer:p.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),bt.setContext(s),bt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function q(Y){for(let J=0;J<Y.removed.length;J++){let ot=Y.removed[J],wt=S.indexOf(ot);wt>=0&&(S[wt]=null,b[wt].disconnect(ot))}for(let J=0;J<Y.added.length;J++){let ot=Y.added[J],wt=S.indexOf(ot);if(wt===-1){for(let zt=0;zt<b.length;zt++)if(zt>=S.length){S.push(ot),wt=zt;break}else if(S[zt]===null){S[zt]=ot,wt=zt;break}if(wt===-1)break}let _t=b[wt];_t&&_t.connect(ot)}}let H=new z,j=new z;function it(Y,J,ot){H.setFromMatrixPosition(J.matrixWorld),j.setFromMatrixPosition(ot.matrixWorld);let wt=H.distanceTo(j),_t=J.projectionMatrix.elements,zt=ot.projectionMatrix.elements,Te=_t[14]/(_t[10]-1),Xt=_t[14]/(_t[10]+1),Kt=(_t[9]+1)/_t[5],ae=(_t[9]-1)/_t[5],Yt=(_t[8]-1)/_t[0],me=(zt[8]+1)/zt[0],Re=Te*Yt,Ye=Te*me,_e=wt/(-Yt+me),Me=_e*-Yt;if(J.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(Me),Y.translateZ(_e),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),_t[10]===-1)Y.projectionMatrix.copy(J.projectionMatrix),Y.projectionMatrixInverse.copy(J.projectionMatrixInverse);else{let k=Te+_e,Ne=Xt+_e,se=Re-Me,I=Ye+(wt-Me),x=Kt*Xt/Ne*k,V=ae*Xt/Ne*k;Y.projectionMatrix.makePerspective(se,I,x,V,k,Ne),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function X(Y,J){J===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(J.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(s===null)return;let J=Y.near,ot=Y.far;m.texture!==null&&(m.depthNear>0&&(J=m.depthNear),m.depthFar>0&&(ot=m.depthFar)),D.near=A.near=R.near=J,D.far=A.far=R.far=ot,(L!==D.near||F!==D.far)&&(s.updateRenderState({depthNear:D.near,depthFar:D.far}),L=D.near,F=D.far),D.layers.mask=Y.layers.mask|6,R.layers.mask=D.layers.mask&-5,A.layers.mask=D.layers.mask&-3;let wt=Y.parent,_t=D.cameras;X(D,wt);for(let zt=0;zt<_t.length;zt++)X(_t[zt],wt);_t.length===2?it(D,R,A):D.projectionMatrix.copy(R.projectionMatrix),T===null&&Y.isPerspectiveCamera&&(T={camera:Y,fov:Y.fov,zoom:Y.zoom}),nt(Y,D,wt)};function nt(Y,J,ot){ot===null?Y.matrix.copy(J.matrixWorld):(Y.matrix.copy(ot.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(J.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(J.projectionMatrix),Y.projectionMatrixInverse.copy(J.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=Ms*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(h===null&&p===null))return l},this.setFoveation=function(Y){l=Y,h!==null&&(h.fixedFoveation=Y),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=Y)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(D)},this.getCameraTexture=function(Y){return d[Y]};let lt=null;function ct(Y,J){if(u=J.getViewerPose(c||o),g=J,u!==null){let ot=u.views;p!==null&&(t.setRenderTargetFramebuffer(y,p.framebuffer),t.setRenderTarget(y));let wt=!1;ot.length!==D.cameras.length&&(D.cameras.length=0,wt=!0);for(let Xt=0;Xt<ot.length;Xt++){let Kt=ot[Xt],ae=null;if(p!==null)ae=p.getViewport(Kt);else{let me=f.getViewSubImage(h,Kt);ae=me.viewport,Xt===0&&(t.setRenderTargetTextures(y,me.colorTexture,me.depthStencilTexture),t.setRenderTarget(y))}let Yt=P[Xt];Yt===void 0&&(Yt=new Ze,Yt.layers.enable(Xt),Yt.viewport=new he,P[Xt]=Yt),Yt.matrix.fromArray(Kt.transform.matrix),Yt.matrix.decompose(Yt.position,Yt.quaternion,Yt.scale),Yt.projectionMatrix.fromArray(Kt.projectionMatrix),Yt.projectionMatrixInverse.copy(Yt.projectionMatrix).invert(),Yt.viewport.set(ae.x,ae.y,ae.width,ae.height),Xt===0&&(D.matrix.copy(Yt.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),wt===!0&&D.cameras.push(Yt)}let _t=s.enabledFeatures;if(_t&&_t.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&_){f=n.getBinding();let Xt=f.getDepthInformation(ot[0]);Xt&&Xt.isValid&&Xt.texture&&m.init(Xt,s.renderState)}if(_t&&_t.includes("camera-access")&&_){t.state.unbindTexture(),f=n.getBinding();for(let Xt=0;Xt<ot.length;Xt++){let Kt=ot[Xt].camera;if(Kt){let ae=d[Kt];ae||(ae=new br,d[Kt]=ae);let Yt=f.getCameraImage(Kt);ae.sourceTexture=Yt}}}}for(let ot=0;ot<b.length;ot++){let wt=S[ot],_t=b[ot];wt!==null&&_t!==void 0&&_t.update(wt,J,c||o)}lt&&lt(Y,J),J.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:J}),g=null}let bt=new Hd;bt.setAnimationLoop(ct),this.setAnimationLoop=function(Y){lt=Y},this.dispose=function(){}}},ay=new ne,Zd=new Ft;Zd.set(-1,0,0,0,1,0,0,0,1);function ly(i,t){function e(m,d){m.matrixAutoUpdate===!0&&m.updateMatrix(),d.value.copy(m.matrix)}function n(m,d){d.color.getRGB(m.fogColor.value,Oc(i)),d.isFog?(m.fogNear.value=d.near,m.fogFar.value=d.far):d.isFogExp2&&(m.fogDensity.value=d.density)}function s(m,d,M,E,y){d.isNodeMaterial?d.uniformsNeedUpdate=!1:d.isMeshBasicMaterial?r(m,d):d.isMeshLambertMaterial?(r(m,d),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)):d.isMeshToonMaterial?(r(m,d),f(m,d)):d.isMeshPhongMaterial?(r(m,d),u(m,d),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)):d.isMeshStandardMaterial?(r(m,d),h(m,d),d.isMeshPhysicalMaterial&&p(m,d,y)):d.isMeshMatcapMaterial?(r(m,d),g(m,d)):d.isMeshDepthMaterial?r(m,d):d.isMeshDistanceMaterial?(r(m,d),_(m,d)):d.isMeshNormalMaterial?r(m,d):d.isLineBasicMaterial?(o(m,d),d.isLineDashedMaterial&&a(m,d)):d.isPointsMaterial?l(m,d,M,E):d.isSpriteMaterial?c(m,d):d.isShadowMaterial?(m.color.value.copy(d.color),m.opacity.value=d.opacity):d.isShaderMaterial&&(d.uniformsNeedUpdate=!1)}function r(m,d){m.opacity.value=d.opacity,d.color&&m.diffuse.value.copy(d.color),d.emissive&&m.emissive.value.copy(d.emissive).multiplyScalar(d.emissiveIntensity),d.map&&(m.map.value=d.map,e(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.bumpMap&&(m.bumpMap.value=d.bumpMap,e(d.bumpMap,m.bumpMapTransform),m.bumpScale.value=d.bumpScale,d.side===qe&&(m.bumpScale.value*=-1)),d.normalMap&&(m.normalMap.value=d.normalMap,e(d.normalMap,m.normalMapTransform),m.normalScale.value.copy(d.normalScale),d.side===qe&&m.normalScale.value.negate()),d.displacementMap&&(m.displacementMap.value=d.displacementMap,e(d.displacementMap,m.displacementMapTransform),m.displacementScale.value=d.displacementScale,m.displacementBias.value=d.displacementBias),d.emissiveMap&&(m.emissiveMap.value=d.emissiveMap,e(d.emissiveMap,m.emissiveMapTransform)),d.specularMap&&(m.specularMap.value=d.specularMap,e(d.specularMap,m.specularMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest);let M=t.get(d),E=M.envMap,y=M.envMapRotation;E&&(m.envMap.value=E,m.envMapRotation.value.setFromMatrix4(ay.makeRotationFromEuler(y)).transpose(),E.isCubeTexture&&E.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(Zd),m.reflectivity.value=d.reflectivity,m.ior.value=d.ior,m.refractionRatio.value=d.refractionRatio),d.lightMap&&(m.lightMap.value=d.lightMap,m.lightMapIntensity.value=d.lightMapIntensity,e(d.lightMap,m.lightMapTransform)),d.aoMap&&(m.aoMap.value=d.aoMap,m.aoMapIntensity.value=d.aoMapIntensity,e(d.aoMap,m.aoMapTransform))}function o(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,d.map&&(m.map.value=d.map,e(d.map,m.mapTransform))}function a(m,d){m.dashSize.value=d.dashSize,m.totalSize.value=d.dashSize+d.gapSize,m.scale.value=d.scale}function l(m,d,M,E){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.size.value=d.size*M,m.scale.value=E*.5,d.map&&(m.map.value=d.map,e(d.map,m.uvTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function c(m,d){m.diffuse.value.copy(d.color),m.opacity.value=d.opacity,m.rotation.value=d.rotation,d.map&&(m.map.value=d.map,e(d.map,m.mapTransform)),d.alphaMap&&(m.alphaMap.value=d.alphaMap,e(d.alphaMap,m.alphaMapTransform)),d.alphaTest>0&&(m.alphaTest.value=d.alphaTest)}function u(m,d){m.specular.value.copy(d.specular),m.shininess.value=Math.max(d.shininess,1e-4)}function f(m,d){d.gradientMap&&(m.gradientMap.value=d.gradientMap)}function h(m,d){m.metalness.value=d.metalness,d.metalnessMap&&(m.metalnessMap.value=d.metalnessMap,e(d.metalnessMap,m.metalnessMapTransform)),m.roughness.value=d.roughness,d.roughnessMap&&(m.roughnessMap.value=d.roughnessMap,e(d.roughnessMap,m.roughnessMapTransform)),d.envMap&&(m.envMapIntensity.value=d.envMapIntensity)}function p(m,d,M){m.ior.value=d.ior,d.sheen>0&&(m.sheenColor.value.copy(d.sheenColor).multiplyScalar(d.sheen),m.sheenRoughness.value=d.sheenRoughness,d.sheenColorMap&&(m.sheenColorMap.value=d.sheenColorMap,e(d.sheenColorMap,m.sheenColorMapTransform)),d.sheenRoughnessMap&&(m.sheenRoughnessMap.value=d.sheenRoughnessMap,e(d.sheenRoughnessMap,m.sheenRoughnessMapTransform))),d.clearcoat>0&&(m.clearcoat.value=d.clearcoat,m.clearcoatRoughness.value=d.clearcoatRoughness,d.clearcoatMap&&(m.clearcoatMap.value=d.clearcoatMap,e(d.clearcoatMap,m.clearcoatMapTransform)),d.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=d.clearcoatRoughnessMap,e(d.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),d.clearcoatNormalMap&&(m.clearcoatNormalMap.value=d.clearcoatNormalMap,e(d.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(d.clearcoatNormalScale),d.side===qe&&m.clearcoatNormalScale.value.negate())),d.dispersion>0&&(m.dispersion.value=d.dispersion),d.retroreflectivity>0&&(m.retroreflectivity.value=d.retroreflectivity),d.iridescence>0&&(m.iridescence.value=d.iridescence,m.iridescenceIOR.value=d.iridescenceIOR,m.iridescenceThicknessMinimum.value=d.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=d.iridescenceThicknessRange[1],d.iridescenceMap&&(m.iridescenceMap.value=d.iridescenceMap,e(d.iridescenceMap,m.iridescenceMapTransform)),d.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=d.iridescenceThicknessMap,e(d.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),d.transmission>0&&(m.transmission.value=d.transmission,m.transmissionSamplerMap.value=M.texture,m.transmissionSamplerSize.value.set(M.width,M.height),d.transmissionMap&&(m.transmissionMap.value=d.transmissionMap,e(d.transmissionMap,m.transmissionMapTransform)),m.thickness.value=d.thickness,d.thicknessMap&&(m.thicknessMap.value=d.thicknessMap,e(d.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=d.attenuationDistance,m.attenuationColor.value.copy(d.attenuationColor)),d.anisotropy>0&&(m.anisotropyVector.value.set(d.anisotropy*Math.cos(d.anisotropyRotation),d.anisotropy*Math.sin(d.anisotropyRotation)),d.anisotropyMap&&(m.anisotropyMap.value=d.anisotropyMap,e(d.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=d.specularIntensity,m.specularColor.value.copy(d.specularColor),d.specularColorMap&&(m.specularColorMap.value=d.specularColorMap,e(d.specularColorMap,m.specularColorMapTransform)),d.specularIntensityMap&&(m.specularIntensityMap.value=d.specularIntensityMap,e(d.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,d){d.matcap&&(m.matcap.value=d.matcap)}function _(m,d){let M=t.get(d).light;m.referencePosition.value.setFromMatrixPosition(M.matrixWorld),m.nearDistance.value=M.shadow.camera.near,m.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function cy(i,t,e,n){let s={},r={},o=[],a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,b){let S=b.program;n.uniformBlockBinding(y,S)}function c(y,b){let S=s[y.id];S===void 0&&(m(y),S=u(y),s[y.id]=S,y.addEventListener("dispose",M));let C=b.program;n.updateUBOMapping(y,C);let v=t.render.frame;r[y.id]!==v&&(h(y),r[y.id]=v)}function u(y){let b=f();y.__bindingPointIndex=b;let S=i.createBuffer(),C=y.__size,v=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,S),i.bufferData(i.UNIFORM_BUFFER,C,v),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,b,S),S}function f(){for(let y=0;y<a;y++)if(o.indexOf(y)===-1)return o.push(y),y;return Ot("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(y){let b=s[y.id],S=y.uniforms,C=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let v=0,T=S.length;v<T;v++){let R=S[v];if(Array.isArray(R))for(let A=0,P=R.length;A<P;A++)p(R[A],v,A,C);else p(R,v,0,C)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(y,b,S,C){if(_(y,b,S,C)===!0){let v=y.__offset,T=y.value;if(Array.isArray(T)){let R=0;for(let A=0;A<T.length;A++){let P=T[A],D=d(P);g(P,y.__data,R),typeof P!="number"&&typeof P!="boolean"&&!P.isMatrix3&&!ArrayBuffer.isView(P)&&(R+=D.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(T,y.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,v,y.__data)}}function g(y,b,S){typeof y=="number"||typeof y=="boolean"?b[0]=y:y.isMatrix3?(b[0]=y.elements[0],b[1]=y.elements[1],b[2]=y.elements[2],b[3]=0,b[4]=y.elements[3],b[5]=y.elements[4],b[6]=y.elements[5],b[7]=0,b[8]=y.elements[6],b[9]=y.elements[7],b[10]=y.elements[8],b[11]=0):ArrayBuffer.isView(y)?b.set(new y.constructor(y.buffer,y.byteOffset,b.length)):y.toArray(b,S)}function _(y,b,S,C){let v=y.value,T=b+"_"+S;if(C[T]===void 0)return typeof v=="number"||typeof v=="boolean"?C[T]=v:ArrayBuffer.isView(v)?C[T]=v.slice():C[T]=v.clone(),!0;{let R=C[T];if(typeof v=="number"||typeof v=="boolean"){if(R!==v)return C[T]=v,!0}else{if(ArrayBuffer.isView(v))return!0;if(R.equals(v)===!1)return R.copy(v),!0}}return!1}function m(y){let b=y.uniforms,S=0,C=16;for(let T=0,R=b.length;T<R;T++){let A=Array.isArray(b[T])?b[T]:[b[T]];for(let P=0,D=A.length;P<D;P++){let L=A[P],F=Array.isArray(L.value)?L.value:[L.value];for(let U=0,O=F.length;U<O;U++){let q=F[U],H=d(q),j=S%C,it=j%H.boundary,X=j+it;S+=it,X!==0&&C-X<H.storage&&(S+=C-X),L.__data=new Float32Array(H.storage/Float32Array.BYTES_PER_ELEMENT),L.__offset=S,S+=H.storage}}}let v=S%C;return v>0&&(S+=C-v),y.__size=S,y.__cache={},this}function d(y){let b={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(b.boundary=4,b.storage=4):y.isVector2?(b.boundary=8,b.storage=8):y.isVector3||y.isColor?(b.boundary=16,b.storage=12):y.isVector4?(b.boundary=16,b.storage=16):y.isMatrix3?(b.boundary=48,b.storage=48):y.isMatrix4?(b.boundary=64,b.storage=64):y.isTexture?Lt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(b.boundary=16,b.storage=y.byteLength):Lt("WebGLRenderer: Unsupported uniform value type.",y),b}function M(y){let b=y.target;b.removeEventListener("dispose",M);let S=o.indexOf(b.__bindingPointIndex);o.splice(S,1),i.deleteBuffer(s[b.id]),delete s[b.id],delete r[b.id]}function E(){for(let y in s)i.deleteBuffer(s[y]);o=[],s={},r={}}return{bind:l,update:c,dispose:E}}var hy=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Dn=null;function uy(){return Dn===null&&(Dn=new vr(hy,16,16,Mi,bn),Dn.name="DFG_LUT",Dn.minFilter=Le,Dn.magFilter=Le,Dn.wrapS=Rn,Dn.wrapT=Rn,Dn.generateMipmaps=!1,Dn.needsUpdate=!0),Dn}var Fs=class{constructor(t={}){let{canvas:e=fd(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:h=!1,outputBufferType:p=Ke}=t;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=o;let _=p,m=new Set([xa,_a,ga]),d=new Set([Ke,Sn,Is,Ls,fa,pa]),M=new Uint32Array(4),E=new Int32Array(4),y=new z,b=null,S=null,C=[],v=[],T=null;this.domElement=e,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Mn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let R=this,A=!1,P=null,D=null,L=null,F=null;this._outputColorSpace=ge;let U=0,O=0,q=null,H=-1,j=null,it=new he,X=new he,nt=null,lt=new Ut(0),ct=0,bt=e.width,Y=e.height,J=1,ot=null,wt=null,_t=new he(0,0,bt,Y),zt=new he(0,0,bt,Y),Te=!1,Xt=new Ts,Kt=!1,ae=!1,Yt=new ne,me=new z,Re=new he,Ye={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},_e=!1;function Me(){return q===null?J:1}let k=n;function Ne(w,N){return e.getContext(w,N)}let se,I,x,V,Z,Q,at,ht,tt,st,ut,Rt,mt,dt,Pt,Dt,Bt,B,ft,et,pt,vt,rt;try{let w={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:f};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"186"}`),e.addEventListener("webglcontextlost",le,!1),e.addEventListener("webglcontextrestored",Qt,!1),e.addEventListener("webglcontextcreationerror",fn,!1),k===null){let N="webgl2";if(k=Ne(N,w),k===null)throw Ne(N)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}It()}catch(w){throw e.removeEventListener("webglcontextlost",le,!1),e.removeEventListener("webglcontextrestored",Qt,!1),e.removeEventListener("webglcontextcreationerror",fn,!1),Ot("WebGLRenderer: "+w.message),w}function It(){se=new x0(k),se.init(),pt=new sy(k,se),I=new l0(k,se,t,pt),x=new ny(k,se),I.reversedDepthBuffer&&h&&x.buffers.depth.setReversed(!0),D=k.createFramebuffer(),L=k.createFramebuffer(),F=k.createFramebuffer(),V=new M0(k),Z=new Hx,Q=new iy(k,se,x,Z,I,pt,V),at=new _0(R),ht=new bm(k),vt=new o0(k,ht),tt=new y0(k,ht,V,vt),st=new b0(k,tt,ht,vt,V),B=new S0(k,I,Q),Pt=new c0(Z),ut=new Vx(R,at,se,I,vt,Pt),Rt=new ly(R,Z),mt=new Wx,dt=new Kx(se),Bt=new r0(R,at,x,st,g,l),Dt=new ey(R,st,I),rt=new cy(k,V,I,x),ft=new a0(k,se,V),et=new v0(k,se,V),V.programs=ut.programs,R.capabilities=I,R.extensions=se,R.properties=Z,R.renderLists=mt,R.shadowMap=Dt,R.state=x,R.info=V}_!==Ke&&(T=new E0(_,e.width,e.height,a,s,r));let At=new Qc(R,k);this.xr=At,this.getContext=function(){return k},this.getContextAttributes=function(){return k.getContextAttributes()},this.forceContextLoss=function(){let w=se.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){let w=se.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return J},this.setPixelRatio=function(w){w!==void 0&&(J=w,this.setSize(bt,Y,!1))},this.getSize=function(w){return w.set(bt,Y)},this.setSize=function(w,N,K=!0){if(At.isPresenting){Lt("WebGLRenderer: Can't change size while VR device is presenting.");return}bt=w,Y=N,e.width=Math.floor(w*J),e.height=Math.floor(N*J),K===!0&&(e.style.width=w+"px",e.style.height=N+"px"),T!==null&&T.setSize(e.width,e.height),this.setViewport(0,0,w,N)},this.getDrawingBufferSize=function(w){return w.set(bt*J,Y*J).floor()},this.setDrawingBufferSize=function(w,N,K){bt=w,Y=N,J=K,e.width=Math.floor(w*K),e.height=Math.floor(N*K),this.setViewport(0,0,w,N)},this.setEffects=function(w){if(_===Ke){Ot("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(w){for(let N=0;N<w.length;N++)if(w[N].isOutputPass===!0){Lt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}T.setEffects(w||[])},this.getCurrentViewport=function(w){return w.copy(it)},this.getViewport=function(w){return w.copy(_t)},this.setViewport=function(w,N,K,G){w.isVector4?_t.set(w.x,w.y,w.z,w.w):_t.set(w,N,K,G),x.viewport(it.copy(_t).multiplyScalar(J).round())},this.getScissor=function(w){return w.copy(zt)},this.setScissor=function(w,N,K,G){w.isVector4?zt.set(w.x,w.y,w.z,w.w):zt.set(w,N,K,G),x.scissor(X.copy(zt).multiplyScalar(J).round())},this.getScissorTest=function(){return Te},this.setScissorTest=function(w){x.setScissorTest(Te=w)},this.setOpaqueSort=function(w){ot=w},this.setTransparentSort=function(w){wt=w},this.getClearColor=function(w){return w.copy(Bt.getClearColor())},this.setClearColor=function(){Bt.setClearColor(...arguments)},this.getClearAlpha=function(){return Bt.getClearAlpha()},this.setClearAlpha=function(){Bt.setClearAlpha(...arguments)},this.clear=function(w=!0,N=!0,K=!0){let G=0;if(w){let W=!1;if(q!==null){let yt=q.texture.format;W=m.has(yt)}if(W){let yt=q.texture.type,St=d.has(yt),xt=Bt.getClearColor(),Et=Bt.getClearAlpha(),Ct=xt.r,Vt=xt.g,qt=xt.b;St?(M[0]=Ct,M[1]=Vt,M[2]=qt,M[3]=Et,k.clearBufferuiv(k.COLOR,0,M)):(E[0]=Ct,E[1]=Vt,E[2]=qt,E[3]=Et,k.clearBufferiv(k.COLOR,0,E))}else G|=k.COLOR_BUFFER_BIT}N&&(G|=k.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),K&&(G|=k.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),G!==0&&k.clear(G)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(w){w.setRenderer(this),P=w},this.dispose=function(){e.removeEventListener("webglcontextlost",le,!1),e.removeEventListener("webglcontextrestored",Qt,!1),e.removeEventListener("webglcontextcreationerror",fn,!1),Bt.dispose(),mt.dispose(),dt.dispose(),Z.dispose(),at.dispose(),st.dispose(),vt.dispose(),rt.dispose(),ut.dispose(),At.dispose(),At.removeEventListener("sessionstart",Dh),At.removeEventListener("sessionend",Oh),Ri.stop()};function le(w){w.preventDefault(),Uc("WebGLRenderer: Context Lost."),A=!0}function Qt(){Uc("WebGLRenderer: Context Restored."),A=!1;let w=V.autoReset,N=Dt.enabled,K=Dt.autoUpdate,G=Dt.needsUpdate,W=Dt.type;It(),V.autoReset=w,Dt.enabled=N,Dt.autoUpdate=K,Dt.needsUpdate=G,Dt.type=W}function fn(w){Ot("WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Tn(w){let N=w.target;N.removeEventListener("dispose",Tn),rp(N)}function rp(w){op(w),Z.remove(w)}function op(w){let N=Z.get(w).programs;N!==void 0&&(N.forEach(function(K){ut.releaseProgram(K)}),w.isShaderMaterial&&ut.releaseShaderCache(w))}this.renderBufferDirect=function(w,N,K,G,W,yt){N===null&&(N=Ye);let St=W.isMesh&&W.matrixWorld.determinantAffine()<0,xt=cp(w,N,K,G,W);x.setMaterial(G,St);let Et=K.index,Ct=1;if(G.wireframe===!0){if(Et=tt.getWireframeAttribute(K),Et===void 0)return;Ct=2}let Vt=K.drawRange,qt=K.attributes.position,Tt=Vt.start*Ct,te=(Vt.start+Vt.count)*Ct;yt!==null&&(Tt=Math.max(Tt,yt.start*Ct),te=Math.min(te,(yt.start+yt.count)*Ct)),Et!==null?(Tt=Math.max(Tt,0),te=Math.min(te,Et.count)):qt!=null&&(Tt=Math.max(Tt,0),te=Math.min(te,qt.count));let Se=te-Tt;if(Se<0||Se===1/0)return;vt.setup(W,G,xt,K,Et);let de,oe=ft;if(Et!==null&&(de=ht.get(Et),oe=et,oe.setIndex(de)),W.isMesh)G.wireframe===!0?(x.setLineWidth(G.wireframeLinewidth*Me()),oe.setMode(k.LINES)):oe.setMode(k.TRIANGLES);else if(W.isLine){let Fe=G.linewidth;Fe===void 0&&(Fe=1),x.setLineWidth(Fe*Me()),W.isLineSegments?oe.setMode(k.LINES):W.isLineLoop?oe.setMode(k.LINE_LOOP):oe.setMode(k.LINE_STRIP)}else W.isPoints?oe.setMode(k.POINTS):W.isSprite&&oe.setMode(k.TRIANGLES);if(W.isBatchedMesh)if(se.get("WEBGL_multi_draw"))oe.renderMultiDraw(W._multiDrawStarts,W._multiDrawCounts,W._multiDrawCount);else{let Fe=W._multiDrawStarts,Mt=W._multiDrawCounts,Ge=W._multiDrawCount,$t=Et?ht.get(Et).bytesPerElement:1,on=Z.get(G).currentProgram.getUniforms();for(let An=0;An<Ge;An++)on.setValue(k,"_gl_DrawID",An),oe.render(Fe[An]/$t,Mt[An])}else if(W.isInstancedMesh)oe.renderInstances(Tt,Se,W.count);else if(K.isInstancedBufferGeometry){let Fe=K._maxInstanceCount!==void 0?K._maxInstanceCount:1/0,Mt=Math.min(K.instanceCount,Fe);oe.renderInstances(Tt,Se,Mt)}else oe.render(Tt,Se)};function Uh(w,N,K,G){P!==null&&w.isNodeMaterial&&P.setObject(G,w),Kt===!0&&Pt.setState(w,K,!1),w.transparent===!0&&w.side===hn&&w.forceSinglePass===!1?(w.side=qe,w.needsUpdate=!0,Qr(w,N,G),w.side=_i,w.needsUpdate=!0,Qr(w,N,G),w.side=hn):Qr(w,N,G)}this.compile=function(w,N,K=null){K===null&&(K=w),P!==null&&P.renderStart(w,N,K),S=dt.get(K),S.init(N),v.push(S),K.traverseVisible(function(W){W.isLight&&W.layers.test(N.layers)&&(S.pushLight(W),W.castShadow&&S.pushShadow(W))}),w!==K&&w.traverseVisible(function(W){W.isLight&&W.layers.test(N.layers)&&(S.pushLight(W),W.castShadow&&S.pushShadow(W))}),S.setupLights(),P!==null&&P.updateLights(S.state.lightsArray),ae=this.localClippingEnabled,Kt=Pt.init(this.clippingPlanes,ae),Kt===!0&&Pt.setGlobalState(this.clippingPlanes,N),P!==null&&Dt.render(S.state.shadowsArray,K,N);let G=new Set;return w.traverse(function(W){if(!(W.isMesh||W.isPoints||W.isLine||W.isSprite))return;let yt=W.material;if(yt)if(Array.isArray(yt))for(let St=0;St<yt.length;St++){let xt=yt[St];Uh(xt,K,N,W),G.add(xt)}else Uh(yt,K,N,W),G.add(yt)}),S=v.pop(),P!==null&&P.renderEnd(),G},this.compileAsync=function(w,N,K=null){let G=this.compile(w,N,K);return new Promise(W=>{function yt(){if(G.forEach(function(St){let Et=Z.get(St).currentProgram;(Et===void 0||Et.isReady())&&G.delete(St)}),G.size===0){W(w);return}setTimeout(yt,10)}se.get("KHR_parallel_shader_compile")!==null?yt():setTimeout(yt,10)})};let Tl=null;function ap(w){Tl&&Tl(w)}function Dh(){Ri.stop()}function Oh(){Ri.start()}let Ri=new Hd;Ri.setAnimationLoop(ap),typeof self<"u"&&Ri.setContext(self),this.setAnimationLoop=function(w){Tl=w,At.setAnimationLoop(w),w===null?Ri.stop():Ri.start()},At.addEventListener("sessionstart",Dh),At.addEventListener("sessionend",Oh),this.render=function(w,N){if(N!==void 0&&N.isCamera!==!0){Ot("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(A===!0)return;P!==null&&P.renderStart(w,N);let K=At.enabled===!0&&At.isPresenting===!0,G=T!==null&&(q===null||K)&&T.begin(R,q);if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),N.parent===null&&N.matrixWorldAutoUpdate===!0&&N.updateMatrixWorld(),At.enabled===!0&&At.isPresenting===!0&&(T===null||T.isCompositing()===!1)&&(At.cameraAutoUpdate===!0&&At.updateCamera(N),N=At.getCamera()),w.isScene===!0&&w.onBeforeRender(R,w,N,q),S=dt.get(w,v.length),S.init(N),S.state.textureUnits=Q.getTextureUnits(),v.push(S),Yt.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),Xt.setFromProjectionMatrix(Yt,xn,N.reversedDepth),ae=this.localClippingEnabled,Kt=Pt.init(this.clippingPlanes,ae),b=mt.get(w,C.length),b.init(),C.push(b),At.enabled===!0&&At.isPresenting===!0){let St=R.xr.getDepthSensingMesh();St!==null&&Al(St,N,-1/0,R.sortObjects)}Al(w,N,0,R.sortObjects),b.finish(),P!==null&&P.updateLights(S.state.lightsArray),R.sortObjects===!0&&b.sort(ot,wt),_e=At.enabled===!1||At.isPresenting===!1||At.hasDepthSensing()===!1,_e&&Bt.addToRenderList(b,w),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Kt===!0&&Pt.beginShadows();let W=S.state.shadowsArray;if(Dt.render(W,w,N),Kt===!0&&Pt.endShadows(),(G&&T.hasRenderPass())===!1){let St=b.opaque,xt=b.transmissive;if(S.setupLights(),N.isArrayCamera){let Et=N.cameras;if(xt.length>0)for(let Ct=0,Vt=Et.length;Ct<Vt;Ct++){let qt=Et[Ct];Fh(St,xt,w,qt)}_e&&Bt.render(w);for(let Ct=0,Vt=Et.length;Ct<Vt;Ct++){let qt=Et[Ct];Nh(b,w,qt,qt.viewport)}}else xt.length>0&&Fh(St,xt,w,N),_e&&Bt.render(w),Nh(b,w,N)}q!==null&&O===0&&(Q.updateMultisampleRenderTarget(q),Q.updateRenderTargetMipmap(q)),G&&T.end(R),w.isScene===!0&&w.onAfterRender(R,w,N),vt.resetDefaultState(),H=-1,j=null,v.pop(),v.length>0?(S=v[v.length-1],Q.setTextureUnits(S.state.textureUnits),Kt===!0&&Pt.setGlobalState(R.clippingPlanes,S.state.camera)):S=null,C.pop(),C.length>0?b=C[C.length-1]:b=null,P!==null&&P.renderEnd()};function Al(w,N,K,G){if(w.visible===!1)return;if(w.layers.test(N.layers)){if(w.isGroup)K=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(N);else if(w.isLightProbeGrid)S.pushLightProbeGrid(w);else if(w.isLight)S.pushLight(w),w.castShadow&&S.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||w.intersectsFrustum(Xt)){G&&Re.setFromMatrixPosition(w.matrixWorld).applyMatrix4(Yt);let St=st.update(w),xt=w.material;xt.visible&&b.push(w,St,xt,K,Re.z,null,N)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||w.intersectsFrustum(Xt))){let St=st.update(w),xt=w.material;if(G&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Re.copy(w.boundingSphere.center)):(St.boundingSphere===null&&St.computeBoundingSphere(),Re.copy(St.boundingSphere.center)),Re.applyMatrix4(w.matrixWorld).applyMatrix4(Yt)),Array.isArray(xt)){let Et=St.groups;for(let Ct=0,Vt=Et.length;Ct<Vt;Ct++){let qt=Et[Ct],Tt=xt[qt.materialIndex];Tt&&Tt.visible&&b.push(w,St,Tt,K,Re.z,qt,N)}}else xt.visible&&b.push(w,St,xt,K,Re.z,null,N)}}let yt=w.children;for(let St=0,xt=yt.length;St<xt;St++)Al(yt[St],N,K,G)}function Nh(w,N,K,G){let{opaque:W,transmissive:yt,transparent:St}=w;S.setupLightsView(K),Kt===!0&&Pt.setGlobalState(R.clippingPlanes,K),G&&x.viewport(it.copy(G)),W.length>0&&jr(W,N,K),yt.length>0&&jr(yt,N,K),St.length>0&&jr(St,N,K),x.buffers.depth.setTest(!0),x.buffers.depth.setMask(!0),x.buffers.color.setMask(!0),x.setPolygonOffset(!1)}function Fh(w,N,K,G){if((K.isScene===!0?K.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[G.id]===void 0){let Tt=se.has("EXT_color_buffer_half_float")||se.has("EXT_color_buffer_float");S.state.transmissionRenderTarget[G.id]=new $e(1,1,{generateMipmaps:!0,type:Tt?bn:Ke,minFilter:yi,samples:Math.max(4,I.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Zt.workingColorSpace})}let yt=S.state.transmissionRenderTarget[G.id],St=G.viewport||it;yt.setSize(St.z*R.transmissionResolutionScale,St.w*R.transmissionResolutionScale);let xt=R.getRenderTarget(),Et=R.getActiveCubeFace(),Ct=R.getActiveMipmapLevel();R.setRenderTarget(yt),R.getClearColor(lt),ct=R.getClearAlpha(),ct<1&&R.setClearColor(16777215,.5),R.clear(),_e&&Bt.render(K);let Vt=R.toneMapping;R.toneMapping=Mn;let qt=G.viewport;if(G.viewport!==void 0&&(G.viewport=void 0),S.setupLightsView(G),Kt===!0&&Pt.setGlobalState(R.clippingPlanes,G),jr(w,K,G),Q.updateMultisampleRenderTarget(yt),Q.updateRenderTargetMipmap(yt),se.has("WEBGL_multisampled_render_to_texture")===!1){let Tt=!1;for(let te=0,Se=N.length;te<Se;te++){let de=N[te],{object:oe,geometry:Fe,material:Mt,group:Ge}=de;if(Mt.side===hn&&oe.layers.test(G.layers)){let $t=Mt.side;Mt.side=qe,Mt.needsUpdate=!0,Bh(oe,K,G,Fe,Mt,Ge),Mt.side=$t,Mt.needsUpdate=!0,Tt=!0}}Tt===!0&&(Q.updateMultisampleRenderTarget(yt),Q.updateRenderTargetMipmap(yt))}R.setRenderTarget(xt,Et,Ct),R.setClearColor(lt,ct),qt!==void 0&&(G.viewport=qt),R.toneMapping=Vt}function jr(w,N,K){let G=N.isScene===!0?N.overrideMaterial:null;for(let W=0,yt=w.length;W<yt;W++){let St=w[W],{object:xt,geometry:Et,group:Ct}=St,Vt=St.material;Vt.allowOverride===!0&&G!==null&&(Vt=G),xt.layers.test(K.layers)&&Bh(xt,N,K,Et,Vt,Ct)}}function Bh(w,N,K,G,W,yt){P!==null&&W.isNodeMaterial&&P.setObject(w,W),w.onBeforeRender(R,N,K,G,W,yt),w.modelViewMatrix.multiplyMatrices(K.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),W.onBeforeRender(R,N,K,G,w,yt),W.transparent===!0&&W.side===hn&&W.forceSinglePass===!1?(W.side=qe,W.needsUpdate=!0,R.renderBufferDirect(K,N,G,W,w,yt),W.side=_i,W.needsUpdate=!0,R.renderBufferDirect(K,N,G,W,w,yt),W.side=hn):R.renderBufferDirect(K,N,G,W,w,yt),w.onAfterRender(R,N,K,G,W,yt)}function Qr(w,N,K){N.isScene!==!0&&(N=Ye);let G=Z.get(w),W=S.state.lights,yt=S.state.shadowsArray,St=W.state.version,xt=ut.getParameters(w,W.state,yt,N,K,S.state.lightProbeGridArray),Et=ut.getProgramCacheKey(xt),Ct=G.programs;G.environment=w.isMeshStandardMaterial||w.isMeshLambertMaterial||w.isMeshPhongMaterial?N.environment:null,G.fog=N.fog;let Vt=w.isMeshStandardMaterial||w.isMeshLambertMaterial&&!w.envMap||w.isMeshPhongMaterial&&!w.envMap;G.envMap=at.get(w.envMap||G.environment,Vt),G.envMapRotation=G.environment!==null&&w.envMap===null?N.environmentRotation:w.envMapRotation,Ct===void 0&&(w.addEventListener("dispose",Tn),Ct=new Map,G.programs=Ct);let qt=Ct.get(Et);if(qt!==void 0){if(G.currentProgram===qt&&G.lightsStateVersion===St)return zh(w,xt),qt}else xt.uniforms=ut.getUniforms(w),P!==null&&w.isNodeMaterial&&P.build(w,K,xt),w.onBeforeCompile(xt,R),qt=ut.acquireProgram(xt,Et),Ct.set(Et,qt),G.uniforms=xt.uniforms;let Tt=G.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Tt.clippingPlanes=Pt.uniform),zh(w,xt),G.needsLights=up(w),G.lightsStateVersion=St,G.needsLights&&(Tt.ambientLightColor.value=W.state.ambient,Tt.lightProbe.value=W.state.probe,Tt.sunLights.value=W.state.sun,Tt.sunLightShadows.value=W.state.sunShadow,Tt.directionalLights.value=W.state.directional,Tt.directionalLightShadows.value=W.state.directionalShadow,Tt.spotLights.value=W.state.spot,Tt.spotLightShadows.value=W.state.spotShadow,Tt.rectAreaLights.value=W.state.rectArea,Tt.ltc_1.value=W.state.rectAreaLTC1,Tt.ltc_2.value=W.state.rectAreaLTC2,Tt.pointLights.value=W.state.point,Tt.pointLightShadows.value=W.state.pointShadow,Tt.hemisphereLights.value=W.state.hemi,Tt.sunShadowMatrix.value=W.state.sunShadowMatrix,Tt.sunShadowCascade.value=W.state.sunShadowCascade,Tt.directionalShadowMatrix.value=W.state.directionalShadowMatrix,Tt.spotLightMatrix.value=W.state.spotLightMatrix,Tt.spotLightMap.value=W.state.spotLightMap,Tt.pointShadowMatrix.value=W.state.pointShadowMatrix),G.lightProbeGrid=S.state.lightProbeGridArray.length>0,G.currentProgram=qt,G.uniformsList=null,qt}function kh(w){if(w.uniformsList===null){let N=w.currentProgram.getUniforms();w.uniformsList=Ns.seqWithValue(N.seq,w.uniforms)}return w.uniformsList}function zh(w,N){let K=Z.get(w);K.outputColorSpace=N.outputColorSpace,K.batching=N.batching,K.batchingColor=N.batchingColor,K.instancing=N.instancing,K.instancingColor=N.instancingColor,K.instancingMorph=N.instancingMorph,K.skinning=N.skinning,K.morphTargets=N.morphTargets,K.morphNormals=N.morphNormals,K.morphColors=N.morphColors,K.morphTargetsCount=N.morphTargetsCount,K.numClippingPlanes=N.numClippingPlanes,K.numIntersection=N.numClipIntersection,K.vertexAlphas=N.vertexAlphas,K.vertexTangents=N.vertexTangents,K.toneMapping=N.toneMapping}function lp(w,N){if(w.length===0)return null;if(w.length===1)return w[0].texture!==null?w[0]:null;y.setFromMatrixPosition(N.matrixWorld);for(let K=0,G=w.length;K<G;K++){let W=w[K];if(W.texture!==null&&W.boundingBox.containsPoint(y))return W}return null}function cp(w,N,K,G,W){N.isScene!==!0&&(N=Ye),Q.resetTextureUnits();let yt=N.fog,St=G.isMeshStandardMaterial||G.isMeshLambertMaterial||G.isMeshPhongMaterial?N.environment:null,xt=q===null?R.outputColorSpace:q.isXRRenderTarget===!0?q.texture.colorSpace:Zt.workingColorSpace,Et=G.isMeshStandardMaterial||G.isMeshLambertMaterial&&!G.envMap||G.isMeshPhongMaterial&&!G.envMap,Ct=at.get(G.envMap||St,Et),Vt=G.vertexColors===!0&&!!K.attributes.color&&K.attributes.color.itemSize===4,qt=!!K.attributes.tangent&&(!!G.normalMap||G.anisotropy>0),Tt=!!K.morphAttributes.position,te=!!K.morphAttributes.normal,Se=!!K.morphAttributes.color,de=Mn;G.toneMapped&&(q===null||q.isXRRenderTarget===!0)&&(de=R.toneMapping);let oe=K.morphAttributes.position||K.morphAttributes.normal||K.morphAttributes.color,Fe=oe!==void 0?oe.length:0,Mt=Z.get(G),Ge=S.state.lights;if(Kt===!0&&(ae===!0||w!==j)){let ce=w===j&&G.id===H;Pt.setState(G,w,ce)}let $t=!1;G.version===Mt.__version?(Mt.needsLights&&Mt.lightsStateVersion!==Ge.state.version||Mt.outputColorSpace!==xt||W.isBatchedMesh&&Mt.batching===!1||!W.isBatchedMesh&&Mt.batching===!0||W.isBatchedMesh&&Mt.batchingColor===!0&&W._colorsTexture===null||W.isBatchedMesh&&Mt.batchingColor===!1&&W._colorsTexture!==null||W.isInstancedMesh&&Mt.instancing===!1||!W.isInstancedMesh&&Mt.instancing===!0||W.isSkinnedMesh&&Mt.skinning===!1||!W.isSkinnedMesh&&Mt.skinning===!0||W.isInstancedMesh&&Mt.instancingColor===!0&&W.instanceColor===null||W.isInstancedMesh&&Mt.instancingColor===!1&&W.instanceColor!==null||W.isInstancedMesh&&Mt.instancingMorph===!0&&W.morphTexture===null||W.isInstancedMesh&&Mt.instancingMorph===!1&&W.morphTexture!==null||Mt.envMap!==Ct||G.fog===!0&&Mt.fog!==yt||Mt.numClippingPlanes!==void 0&&(Mt.numClippingPlanes!==Pt.numPlanes||Mt.numIntersection!==Pt.numIntersection)||Mt.vertexAlphas!==Vt||Mt.vertexTangents!==qt||Mt.morphTargets!==Tt||Mt.morphNormals!==te||Mt.morphColors!==Se||Mt.toneMapping!==de||Mt.morphTargetsCount!==Fe||!!Mt.lightProbeGrid!=S.state.lightProbeGridArray.length>0)&&($t=!0):($t=!0,Mt.__version=G.version);let on=Mt.currentProgram;$t===!0&&(on=Qr(G,N,W),P&&G.isNodeMaterial&&P.onUpdateProgram(G,on,Mt));let An=!1,Qn=!1,Ji=!1,re=on.getUniforms(),ve=Mt.uniforms;if(x.useProgram(on.program)&&(An=!0,Qn=!0,Ji=!0),G.id!==H&&(H=G.id,Qn=!0),Mt.needsLights){let ce=lp(S.state.lightProbeGridArray,W);Mt.lightProbeGrid!==ce&&(Mt.lightProbeGrid=ce,Qn=!0)}if(An||j!==w){x.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),re.setValue(k,"projectionMatrix",w.projectionMatrix),re.setValue(k,"viewMatrix",w.matrixWorldInverse);let ei=re.map.cameraPosition;ei!==void 0&&ei.setValue(k,me.setFromMatrixPosition(w.matrixWorld)),I.logarithmicDepthBuffer&&re.setValue(k,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(G.isMeshPhongMaterial||G.isMeshToonMaterial||G.isMeshLambertMaterial||G.isMeshBasicMaterial||G.isMeshStandardMaterial||G.isShaderMaterial)&&re.setValue(k,"isOrthographic",w.isOrthographicCamera===!0),j!==w&&(j=w,Qn=!0,Ji=!0)}if(Mt.needsLights&&(Ge.state.sunShadowMap.length>0&&re.setValue(k,"sunShadowMap",Ge.state.sunShadowMap,Q),Ge.state.directionalShadowMap.length>0&&re.setValue(k,"directionalShadowMap",Ge.state.directionalShadowMap,Q),Ge.state.spotShadowMap.length>0&&re.setValue(k,"spotShadowMap",Ge.state.spotShadowMap,Q),Ge.state.pointShadowMap.length>0&&re.setValue(k,"pointShadowMap",Ge.state.pointShadowMap,Q)),W.isSkinnedMesh){re.setOptional(k,W,"bindMatrix"),re.setOptional(k,W,"bindMatrixInverse");let ce=W.skeleton;ce&&(ce.boneTexture===null&&ce.computeBoneTexture(),re.setValue(k,"boneTexture",ce.boneTexture,Q))}W.isBatchedMesh&&(re.setOptional(k,W,"batchingTexture"),re.setValue(k,"batchingTexture",W._matricesTexture,Q),re.setOptional(k,W,"batchingIdTexture"),re.setValue(k,"batchingIdTexture",W._indirectTexture,Q),re.setOptional(k,W,"batchingColorTexture"),W._colorsTexture!==null&&re.setValue(k,"batchingColorTexture",W._colorsTexture,Q));let ti=K.morphAttributes;if((ti.position!==void 0||ti.normal!==void 0||ti.color!==void 0)&&B.update(W,K,on),(Qn||Mt.receiveShadow!==W.receiveShadow)&&(Mt.receiveShadow=W.receiveShadow,re.setValue(k,"receiveShadow",W.receiveShadow)),(G.isMeshStandardMaterial||G.isMeshLambertMaterial||G.isMeshPhongMaterial)&&G.envMap===null&&N.environment!==null&&(ve.envMapIntensity.value=N.environmentIntensity),ve.dfgLUT!==void 0&&(ve.dfgLUT.value=uy()),Qn){if(re.setValue(k,"toneMappingExposure",R.toneMappingExposure),Mt.needsLights&&hp(ve,Ji),yt&&G.fog===!0&&Rt.refreshFogUniforms(ve,yt),Rt.refreshMaterialUniforms(ve,G,J,Y,S.state.transmissionRenderTarget[w.id]),Mt.needsLights&&Mt.lightProbeGrid){let ce=Mt.lightProbeGrid;ve.probesSH.value=ce.texture,ve.probesMin.value.copy(ce.boundingBox.min),ve.probesMax.value.copy(ce.boundingBox.max),ve.probesResolution.value.copy(ce.resolution)}Ns.upload(k,kh(Mt),ve,Q)}if(G.isShaderMaterial&&G.uniformsNeedUpdate===!0&&(Ns.upload(k,kh(Mt),ve,Q),G.uniformsNeedUpdate=!1),G.isSpriteMaterial&&re.setValue(k,"center",W.center),re.setValue(k,"modelViewMatrix",W.modelViewMatrix),re.setValue(k,"normalMatrix",W.normalMatrix),re.setValue(k,"modelMatrix",W.matrixWorld),G.uniformsGroups!==void 0){let ce=G.uniformsGroups;for(let ei=0,ji=ce.length;ei<ji;ei++){let Hh=ce[ei];rt.update(Hh,on),rt.bind(Hh,on)}}return on}function hp(w,N){w.ambientLightColor.needsUpdate=N,w.lightProbe.needsUpdate=N,w.sunLights.needsUpdate=N,w.sunLightShadows.needsUpdate=N,w.directionalLights.needsUpdate=N,w.directionalLightShadows.needsUpdate=N,w.pointLights.needsUpdate=N,w.pointLightShadows.needsUpdate=N,w.spotLights.needsUpdate=N,w.spotLightShadows.needsUpdate=N,w.rectAreaLights.needsUpdate=N,w.hemisphereLights.needsUpdate=N}function up(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return U},this.getActiveMipmapLevel=function(){return O},this.getRenderTarget=function(){return q},this.setRenderTargetTextures=function(w,N,K){let G=Z.get(w);G.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,G.__autoAllocateDepthBuffer===!1&&(G.__useRenderToTexture=!1),Z.get(w.texture).__webglTexture=N,Z.get(w.depthTexture).__webglTexture=G.__autoAllocateDepthBuffer?void 0:K,G.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,N){let K=Z.get(w);K.__webglFramebuffer=N,K.__useDefaultFramebuffer=N===void 0},this.setRenderTarget=function(w,N=0,K=0){q=w,U=N,O=K;let G=null,W=!1,yt=!1;if(w){let xt=Z.get(w);if(xt.__useDefaultFramebuffer!==void 0){x.bindFramebuffer(k.FRAMEBUFFER,xt.__webglFramebuffer),it.copy(w.viewport),X.copy(w.scissor),nt=w.scissorTest,x.viewport(it),x.scissor(X),x.setScissorTest(nt),H=-1;return}else if(xt.__webglFramebuffer===void 0)Q.setupRenderTarget(w);else if(xt.__hasExternalTextures)Q.rebindTextures(w,Z.get(w.texture).__webglTexture,Z.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){let Vt=w.depthTexture;if(xt.__boundDepthTexture!==Vt){if(Vt!==null&&Z.has(Vt)&&(w.width!==Vt.image.width||w.height!==Vt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Q.setupDepthRenderbuffer(w)}}let Et=w.texture;(Et.isData3DTexture||Et.isDataArrayTexture||Et.isCompressedArrayTexture)&&(yt=!0);let Ct=Z.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Ct[N])?G=Ct[N][K]:G=Ct[N],W=!0):w.samples>0&&Q.useMultisampledRTT(w)===!1?G=Z.get(w).__webglMultisampledFramebuffer:Array.isArray(Ct)?G=Ct[K]:G=Ct,it.copy(w.viewport),X.copy(w.scissor),nt=w.scissorTest}else it.copy(_t).multiplyScalar(J).floor(),X.copy(zt).multiplyScalar(J).floor(),nt=Te;if(K!==0&&(G=D),x.bindFramebuffer(k.FRAMEBUFFER,G)&&x.drawBuffers(w,G),x.viewport(it),x.scissor(X),x.setScissorTest(nt),W){let xt=Z.get(w.texture);k.framebufferTexture2D(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_CUBE_MAP_POSITIVE_X+N,xt.__webglTexture,K)}else if(yt){let xt=N;for(let Et=0;Et<w.textures.length;Et++){let Ct=Z.get(w.textures[Et]);k.framebufferTextureLayer(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0+Et,Ct.__webglTexture,K,xt)}}else if(w!==null&&K!==0){let xt=Z.get(w.texture);k.framebufferTexture2D(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,xt.__webglTexture,K)}H=-1};function Vh(w){let N=Z.get(w);return(N.__readFormat!==w.format||N.__readType!==w.type)&&(N.__readFormat=w.format,N.__readType=w.type,N.__formatReadable=I.textureFormatReadable(w.format),N.__typeReadable=I.textureTypeReadable(w.type)),N}this.readRenderTargetPixels=function(w,N,K,G,W,yt,St,xt=0){if(!(w&&w.isWebGLRenderTarget)){Ot("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Et=Z.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&St!==void 0&&(Et=Et[St]),Et){x.bindFramebuffer(k.FRAMEBUFFER,Et);try{let Ct=w.textures[xt],Vt=Ct.format,qt=Ct.type;w.textures.length>1&&k.readBuffer(k.COLOR_ATTACHMENT0+xt);let Tt=Vh(Ct);if(Tt.__formatReadable===!1){Ot("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Tt.__typeReadable===!1){Ot("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}N>=0&&N<=w.width-G&&K>=0&&K<=w.height-W&&k.readPixels(N,K,G,W,pt.convert(Vt),pt.convert(qt),yt)}finally{let Ct=q!==null?Z.get(q).__webglFramebuffer:null;x.bindFramebuffer(k.FRAMEBUFFER,Ct)}}},this.readRenderTargetPixelsAsync=async function(w,N,K,G,W,yt,St,xt=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Et=Z.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&St!==void 0&&(Et=Et[St]),Et)if(N>=0&&N<=w.width-G&&K>=0&&K<=w.height-W){x.bindFramebuffer(k.FRAMEBUFFER,Et);let Ct=w.textures[xt],Vt=Ct.format,qt=Ct.type;w.textures.length>1&&k.readBuffer(k.COLOR_ATTACHMENT0+xt);let Tt=Vh(Ct);if(Tt.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Tt.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let te=k.createBuffer();k.bindBuffer(k.PIXEL_PACK_BUFFER,te),k.bufferData(k.PIXEL_PACK_BUFFER,yt.byteLength,k.STREAM_READ),k.readPixels(N,K,G,W,pt.convert(Vt),pt.convert(qt),0),k.bindBuffer(k.PIXEL_PACK_BUFFER,null);let Se=q!==null?Z.get(q).__webglFramebuffer:null;x.bindFramebuffer(k.FRAMEBUFFER,Se);let de=k.fenceSync(k.SYNC_GPU_COMMANDS_COMPLETE,0);return k.flush(),await md(k,de,4),k.bindBuffer(k.PIXEL_PACK_BUFFER,te),k.getBufferSubData(k.PIXEL_PACK_BUFFER,0,yt),k.bindBuffer(k.PIXEL_PACK_BUFFER,null),k.deleteBuffer(te),k.deleteSync(de),yt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,N=null,K=0){let G=Math.pow(2,-K),W=Math.floor(w.image.width*G),yt=Math.floor(w.image.height*G),St=N!==null?N.x:0,xt=N!==null?N.y:0;Q.setTexture2D(w,0),k.copyTexSubImage2D(k.TEXTURE_2D,K,0,0,St,xt,W,yt),x.unbindTexture()},this.copyTextureToTexture=function(w,N,K=null,G=null,W=0,yt=0){let St,xt,Et,Ct,Vt,qt,Tt,te,Se,de=w.isCompressedTexture?w.mipmaps[yt]:w.image;if(K!==null)St=K.max.x-K.min.x,xt=K.max.y-K.min.y,Et=K.isBox3?K.max.z-K.min.z:1,Ct=K.min.x,Vt=K.min.y,qt=K.isBox3?K.min.z:0;else{let ve=Math.pow(2,-W);St=Math.floor(de.width*ve),xt=Math.floor(de.height*ve),w.isDataArrayTexture?Et=de.depth:w.isData3DTexture?Et=Math.floor(de.depth*ve):Et=1,Ct=0,Vt=0,qt=0}G!==null?(Tt=G.x,te=G.y,Se=G.z):(Tt=0,te=0,Se=0);let oe=pt.convert(N.format),Fe=pt.convert(N.type),Mt;N.isData3DTexture?(Q.setTexture3D(N,0),Mt=k.TEXTURE_3D):N.isDataArrayTexture||N.isCompressedArrayTexture?(Q.setTexture2DArray(N,0),Mt=k.TEXTURE_2D_ARRAY):(Q.setTexture2D(N,0),Mt=k.TEXTURE_2D),x.activeTexture(k.TEXTURE0),x.pixelStorei(k.UNPACK_FLIP_Y_WEBGL,N.flipY),x.pixelStorei(k.UNPACK_PREMULTIPLY_ALPHA_WEBGL,N.premultiplyAlpha),x.pixelStorei(k.UNPACK_ALIGNMENT,N.unpackAlignment);let Ge=x.getParameter(k.UNPACK_ROW_LENGTH),$t=x.getParameter(k.UNPACK_IMAGE_HEIGHT),on=x.getParameter(k.UNPACK_SKIP_PIXELS),An=x.getParameter(k.UNPACK_SKIP_ROWS),Qn=x.getParameter(k.UNPACK_SKIP_IMAGES);x.pixelStorei(k.UNPACK_ROW_LENGTH,de.width),x.pixelStorei(k.UNPACK_IMAGE_HEIGHT,de.height),x.pixelStorei(k.UNPACK_SKIP_PIXELS,Ct),x.pixelStorei(k.UNPACK_SKIP_ROWS,Vt),x.pixelStorei(k.UNPACK_SKIP_IMAGES,qt);let Ji=w.isDataArrayTexture||w.isData3DTexture,re=N.isDataArrayTexture||N.isData3DTexture;if(w.isDepthTexture){let ve=Z.get(w),ti=Z.get(N),ce=Z.get(ve.__renderTarget),ei=Z.get(ti.__renderTarget);x.bindFramebuffer(k.READ_FRAMEBUFFER,ce.__webglFramebuffer),x.bindFramebuffer(k.DRAW_FRAMEBUFFER,ei.__webglFramebuffer);for(let ji=0;ji<Et;ji++)Ji&&(k.framebufferTextureLayer(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,Z.get(w).__webglTexture,W,qt+ji),k.framebufferTextureLayer(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,Z.get(N).__webglTexture,yt,Se+ji)),k.blitFramebuffer(Ct,Vt,St,xt,Tt,te,St,xt,k.DEPTH_BUFFER_BIT,k.NEAREST);x.bindFramebuffer(k.READ_FRAMEBUFFER,null),x.bindFramebuffer(k.DRAW_FRAMEBUFFER,null)}else if(W!==0||w.isRenderTargetTexture||Z.has(w)){let ve=Z.get(w),ti=Z.get(N);x.bindFramebuffer(k.READ_FRAMEBUFFER,L),x.bindFramebuffer(k.DRAW_FRAMEBUFFER,F);for(let ce=0;ce<Et;ce++)Ji?k.framebufferTextureLayer(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,ve.__webglTexture,W,qt+ce):k.framebufferTexture2D(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,ve.__webglTexture,W),re?k.framebufferTextureLayer(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,ti.__webglTexture,yt,Se+ce):k.framebufferTexture2D(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,ti.__webglTexture,yt),W!==0?k.blitFramebuffer(Ct,Vt,St,xt,Tt,te,St,xt,k.COLOR_BUFFER_BIT,k.NEAREST):re?k.copyTexSubImage3D(Mt,yt,Tt,te,Se+ce,Ct,Vt,St,xt):k.copyTexSubImage2D(Mt,yt,Tt,te,Ct,Vt,St,xt);x.bindFramebuffer(k.READ_FRAMEBUFFER,null),x.bindFramebuffer(k.DRAW_FRAMEBUFFER,null)}else re?w.isDataTexture||w.isData3DTexture?k.texSubImage3D(Mt,yt,Tt,te,Se,St,xt,Et,oe,Fe,de.data):N.isCompressedArrayTexture?k.compressedTexSubImage3D(Mt,yt,Tt,te,Se,St,xt,Et,oe,de.data):k.texSubImage3D(Mt,yt,Tt,te,Se,St,xt,Et,oe,Fe,de):w.isDataTexture?k.texSubImage2D(k.TEXTURE_2D,yt,Tt,te,St,xt,oe,Fe,de.data):w.isCompressedTexture?k.compressedTexSubImage2D(k.TEXTURE_2D,yt,Tt,te,de.width,de.height,oe,de.data):k.texSubImage2D(k.TEXTURE_2D,yt,Tt,te,St,xt,oe,Fe,de);x.pixelStorei(k.UNPACK_ROW_LENGTH,Ge),x.pixelStorei(k.UNPACK_IMAGE_HEIGHT,$t),x.pixelStorei(k.UNPACK_SKIP_PIXELS,on),x.pixelStorei(k.UNPACK_SKIP_ROWS,An),x.pixelStorei(k.UNPACK_SKIP_IMAGES,Qn),yt===0&&N.generateMipmaps&&k.generateMipmap(Mt),x.unbindTexture()},this.initRenderTarget=function(w){Z.get(w).__webglFramebuffer===void 0&&Q.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?Q.setTextureCube(w,0):w.isData3DTexture?Q.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?Q.setTexture2DArray(w,0):Q.setTexture2D(w,0),x.unbindTexture()},this.resetState=function(){U=0,O=0,q=null,x.reset(),vt.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return xn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=Zt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Zt._getUnpackColorSpace()}};var th='"use strict";(()=>{var et=new TextDecoder;function m(t){throw new Error(`simscope: ${t}`)}var H=(()=>{let t=new Uint32Array(256);for(let e=0;e<256;e++){let n=e;for(let r=0;r<8;r++)n=n&1?3988292384^n>>>1:n>>>1;t[e]=n>>>0}return t})();function j(t,e=0,n=t.length){let r=4294967295;for(let o=e;o<n;o++)r=H[(r^t[o])&255]^r>>>8;return(r^4294967295)>>>0}function z(t,e){return String.fromCharCode(t[e],t[e+1],t[e+2],t[e+3])}function D(t){return new DataView(t.buffer,t.byteOffset,t.byteLength)}function b(t,e,n){let r=t.byteOffset+e;return e+4*n>t.length&&m("truncated float data"),r%4===0?new Float32Array(t.buffer,r,n):new Float32Array(t.slice(e,e+4*n).buffer)}async function J(t,e="deflate-raw"){let n=new DecompressionStream(e),r=n.writable.getWriter();r.write(t).catch(()=>{}),r.close().catch(()=>{});try{return new Uint8Array(await new Response(n.readable).arrayBuffer())}catch(o){return m(`inflate failed (${o&&o.message?o.message:o})`)}}async function x(t,e,n){let r=await J(t);return r.length!==e&&m(`${n}: inflated ${r.length} bytes, expected ${e}`),r}var K=32,M=1,L=2;function T(t,e){let n=D(t);return{offset:e,env:n.getUint32(e+8,!0),t0:n.getUint32(e+12,!0),n:n.getUint32(e+16,!0),clen:n.getUint32(e+20,!0),ulen:n.getUint32(e+24,!0),codec:t[e+4],crc:n.getUint32(e+28,!0)}}function G(t,e,n){let r=e*n,o=new Uint32Array(r),s=t.subarray(0,r),c=t.subarray(r,2*r),i=t.subarray(2*r,3*r),d=t.subarray(3*r,4*r);for(let a=0;a<e;a++){let f=0,u=a*n;for(let l=0;l<n;l++){let h=u+l;f=f+((s[h]|c[h]<<8|i[h]<<16|d[h]<<24)>>>0)>>>0,o[l*e+a]=f}}return new Float32Array(o.buffer)}function I(t,e,n){let r=b(t,0,e),o=b(t,4*e,e),s=e*n,c=t.subarray(8*e,8*e+s),i=t.subarray(8*e+s,8*e+2*s),d=new Float32Array(s);for(let a=0;a<e;a++){let f=0,u=a*n,l=r[a],h=o[a];for(let w=0;w<n;w++){let y=u+w;f=f+(c[y]|i[y]<<8)&65535,d[w*e+a]=Math.fround(l+Math.fround(f*h))}}return d}function V(t){let e=Math.fround;for(let n=0;n+7<=t.length;n+=7){let r=t[n+3],o=t[n+4],s=t[n+5],c=t[n+6],i=e(Math.sqrt(e(e(e(e(r*r)+e(o*o))+e(s*s))+e(c*c))));i>0&&(t[n+3]=r/i,t[n+4]=o/i,t[n+5]=s/i,t[n+6]=c/i)}}async function A(t,e,n={}){let{bytes:r,itemK:o}=t,s=e.offset;(s+K>r.length||z(r,s)!=="SSBB")&&m(`bad SSBB magic at offset ${s}`);let c=T(r,s);c.codec!==M&&c.codec!==L&&m(`unknown block codec ${c.codec}`);let i=s+K;i+c.clen>r.length&&m(`block at offset ${s} is truncated`);let d=r.subarray(i,i+c.clen);if(j(d)!==c.crc&&m(`block CRC mismatch at offset ${s}`),c.codec===M)return c.ulen!==4*o*c.n&&m(`block ulen ${c.ulen} does not match f32s layout (${4*o*c.n})`),G(await x(d,c.ulen,"block"),o,c.n);let a=8*o+2*o*c.n;c.ulen!==a&&m(`block ulen ${c.ulen} does not match q16d layout (${a})`);let f=await x(d,a,"block"),u=I(f,o,c.n);return n.pose&&V(u),u}function N(t,e){let n=new Float32Array(t.length);for(let r=0;r<e.length;r+=3){let o=e[r]*3,s=e[r+1]*3,c=e[r+2]*3,i=t[s]-t[o],d=t[s+1]-t[o+1],a=t[s+2]-t[o+2],f=t[c]-t[o],u=t[c+1]-t[o+1],l=t[c+2]-t[o+2],h=d*l-a*u,w=a*f-i*l,y=i*u-d*f;for(let g of[o,s,c])n[g]+=h,n[g+1]+=w,n[g+2]+=y}for(let r=0;r<n.length;r+=3){let o=Math.hypot(n[r],n[r+1],n[r+2]);o>0?(n[r]/=o,n[r+1]/=o,n[r+2]/=o):n[r+2]=1}return n}function O(t,e,n,r,o,s){let c=r*n,i=t.subarray(e,e+c),d=t.subarray(e+c,e+2*c),a=new Float32Array(c);for(let f=0;f<r;f++){let u=0;for(let l=0;l<n;l++){let h=f*n+l;u=u+(i[h]|d[h]<<8)&65535,a[l*r+f]=Math.fround(o[f]+Math.fround(u*s[f]))}}return a}async function P(t){(t.length<32||z(t,0)!=="SSMH")&&m("bad SSMH magic in mesh blob");let e=D(t),n=e.getUint16(4,!0);n!==1&&m(`unsupported mesh major version ${n}`);let r=e.getUint32(8,!0),o=e.getUint32(12,!0),s=e.getUint32(16,!0),c=t[20],i=e.getUint32(24,!0),d=t.subarray(32);j(d)!==e.getUint32(28,!0)&&m("mesh CRC mismatch"),c!==0&&c!==1&&m(`unknown mesh codec ${c}`);let a=(s&1)!==0,f=(s&2)!==0,u=await x(d,i,"mesh");if(c===0){let p=0,k=F=>{let W=b(u,p,F);return p+=4*F,W},B=k(3*r),E=new Uint32Array(u.slice(p,p+12*o).buffer);p+=12*o;let R=a?k(3*r):N(B,E),_=f?k(2*r):null;return{verts:B,faces:E,normals:R,uvs:_,nVerts:r,nFaces:o}}a&&m("q16 mesh must not have the normals flag");let l=u,h=b(l,0,3),w=b(l,12,3),y=O(l,24,r,3,h,w),g=24+6*r,U=3*o,S=new Uint32Array(U),$=[0,1,2,3].map(p=>l.subarray(g+p*U,g+(p+1)*U)),v=0;for(let p=0;p<U;p++)v=v+(($[0][p]|$[1][p]<<8|$[2][p]<<16|$[3][p]<<24)>>>0)>>>0,S[p]=v;g+=4*U;let C=null;if(f){let p=b(l,g,2),k=b(l,g+8,2);C=O(l,g+16,r,2,p,k)}return{verts:y,faces:S,normals:N(y,S),uvs:C,nVerts:r,nFaces:o}}async function X(t){let n=(await Promise.all(t.blocks.map(r=>{let o=new Uint8Array(r);return A({bytes:o,itemK:t.itemK},{offset:0},{pose:!!t.pose})}))).map(r=>r.buffer);return{reply:{ok:!0,arrays:n},transfer:n}}var q=256;async function Z(t){let e=t.blocks.length,n=t.itemK,r=null,o=0;for(let s=0;s<e;s+=q){let c=t.blocks.slice(s,s+q),i=await Promise.all(c.map(d=>A({bytes:new Uint8Array(d),itemK:n},{offset:0},{pose:!!t.pose})));r||(o=i[0].length/n,r=new Float32Array(o*e*n)),i.forEach((d,a)=>{if(d.length!==o*n)throw new Error("blocks of one window differ in length");let f=s+a;for(let u=0;u<o;u++)r.set(d.subarray(u*n,(u+1)*n),(u*e+f)*n)})}return{reply:{ok:!0,data:r.buffer,n:o},transfer:[r.buffer]}}async function Y(t){let e=await P(new Uint8Array(t.bytes)),n=[e.verts.buffer,e.faces.buffer,e.normals.buffer];return e.uvs&&n.push(e.uvs.buffer),{reply:{ok:!0,mesh:e},transfer:[...new Set(n)]}}async function tt(t){try{return t.op==="blocks"?await X(t):t.op==="window"?await Z(t):t.op==="mesh"?await Y(t):{reply:{ok:!1,error:`unknown op ${t.op}`},transfer:[]}}catch(e){return{reply:{ok:!1,error:e&&e.message?e.message:String(e)},transfer:[]}}}typeof WorkerGlobalScope<"u"&&typeof self<"u"&&self instanceof WorkerGlobalScope&&(self.onmessage=async t=>{let{id:e}=t.data,{reply:n,transfer:r}=await tt(t.data);self.postMessage({id:e,...n},r)});})();\n';async function dy(i){let e=(await Promise.all(i.blocks.map(n=>{let s=new Uint8Array(n);return Qs({bytes:s,itemK:i.itemK},{offset:0},{pose:!!i.pose})}))).map(n=>n.buffer);return{reply:{ok:!0,arrays:e},transfer:e}}var $d=256;async function fy(i){let t=i.blocks.length,e=i.itemK,n=null,s=0;for(let r=0;r<t;r+=$d){let o=i.blocks.slice(r,r+$d),a=await Promise.all(o.map(l=>Qs({bytes:new Uint8Array(l),itemK:e},{offset:0},{pose:!!i.pose})));n||(s=a[0].length/e,n=new Float32Array(s*t*e)),a.forEach((l,c)=>{if(l.length!==s*e)throw new Error("blocks of one window differ in length");let u=r+c;for(let f=0;f<s;f++)n.set(l.subarray(f*e,(f+1)*e),(f*t+u)*e)})}return{reply:{ok:!0,data:n.buffer,n:s},transfer:[n.buffer]}}async function py(i){let t=await Dl(new Uint8Array(i.bytes)),e=[t.verts.buffer,t.faces.buffer,t.normals.buffer];return t.uvs&&e.push(t.uvs.buffer),{reply:{ok:!0,mesh:t},transfer:[...new Set(e)]}}async function eh(i){try{return i.op==="blocks"?await dy(i):i.op==="window"?await fy(i):i.op==="mesh"?await py(i):{reply:{ok:!1,error:`unknown op ${i.op}`},transfer:[]}}catch(t){return{reply:{ok:!1,error:t&&t.message?t.message:String(t)},transfer:[]}}}typeof WorkerGlobalScope<"u"&&typeof self<"u"&&self instanceof WorkerGlobalScope&&(self.onmessage=async i=>{let{id:t}=i.data,{reply:e,transfer:n}=await eh(i.data);self.postMessage({id:t,...e},n)});var my=8;function gy(){if(typeof Worker>"u"||typeof Blob>"u"||typeof URL>"u"||!URL.createObjectURL||!th)return null;try{let i=URL.createObjectURL(new Blob([th],{type:"text/javascript"})),t=new Worker(i);return URL.revokeObjectURL(i),t}catch{return null}}var nh=class{constructor(){this.worker=null,this.started=!1,this.nextId=1,this.jobs=new Map,this.queue=[],this.inFlight=0,this.onPending=null}_start(){if(this.started)return;this.started=!0;let t=gy();t&&(t.onmessage=e=>this._done(e.data),t.onerror=e=>{e.preventDefault?.(),this.worker=null;let n=[...this.jobs.values()];this.jobs.clear(),this.inFlight=0;for(let s of n)this.queue.unshift(s);this._pump()},this.worker=t)}get threaded(){return this._start(),!!this.worker}get pending(){return this.queue.length+this.inFlight}request(t,e=[]){return this._start(),new Promise((n,s)=>{this.queue.push({id:this.nextId++,msg:t,transfer:e,resolve:n,reject:s}),this._notify(),this._pump()})}_notify(){this.onPending&&this.onPending(this.pending)}_pump(){for(;this.inFlight<my&&this.queue.length;){let t=this.queue.shift();this.inFlight++,this.worker?(this.jobs.set(t.id,t),this.worker.postMessage({id:t.id,...t.msg},t.transfer)):eh(t.msg).then(({reply:e})=>this._finish(t,e))}}_done(t){let e=this.jobs.get(t.id);e&&(this.jobs.delete(t.id),this._finish(e,t))}_finish(t,e){this.inFlight--,e.ok?t.resolve(e):t.reject(new Error(`simscope: ${e.error}`)),this._notify(),this._pump()}},Xi=new nh;async function Kd(i,t,e){let n=i.map(r=>r.byteOffset===0&&r.byteLength===r.buffer.byteLength?r.buffer:r.slice().buffer);return(await Xi.request({op:"blocks",blocks:n,itemK:t,pose:e},n)).arrays.map(r=>new Float32Array(r))}async function Jd(i,t,e){let n=i.map(r=>r.byteOffset===0&&r.byteLength===r.buffer.byteLength?r.buffer:r.slice().buffer),s=await Xi.request({op:"window",blocks:n,itemK:t,pose:e},n);return{data:new Float32Array(s.data),n:s.n}}async function jd(i){let t=i.slice().buffer;return(await Xi.request({op:"mesh",bytes:t},[t])).mesh}var Qd=256*1024*1024,sh=class{constructor(t=Qd){this.maxBytes=t,this.bytes=0,this.map=new Map}get size(){return this.map.size}has(t){return this.map.has(t)}get(t){let e=this.map.get(t);if(e)return this.map.delete(t),this.map.set(t,e),e.value}peek(t){let e=this.map.get(t);return e?e.value:void 0}set(t,e,n){let s=this.map.get(t);s&&(this.bytes-=s.size),this.map.delete(t),this.map.set(t,{value:e,size:n}),this.bytes+=n;for(let[r,o]of this.map){if(this.bytes<=this.maxBytes||r===t)break;this.map.delete(r),this.bytes-=o.size}}delete(t){let e=this.map.get(t);return e?(this.bytes-=e.size,this.map.delete(t)):!1}clear(){this.map.clear(),this.bytes=0}};function rl(i,t,e,n){return{id:i,path:t,pose:n,itemK:e.itemK,blockFrames:e.blockFrames,nEnvs:e.nEnvs,nFrames:e.nFrames,nWindows:Math.ceil(e.nFrames/e.blockFrames)}}var Jn=(i,t,e)=>(i.id*65536+t)*16777216+e,ih=16777215,sl=class{constructor(t,e=Qd){this.source=t,this.lru=new sh(e),this.inflight=new Map,this.epoch=0,this.pending=0,this.onChange=null,this.errors=new Map}get(t,e,n){return this.lru.get(Jn(t,e,n))}has(t,e,n){return this.lru.has(Jn(t,e,n))}ready(t,e,n){for(let s=0;s<n.length;s++)if(!this.lru.has(Jn(t,e,n[s])))return!1;return!0}request(t,e,n){if(e<0||e>=t.nWindows)return Promise.resolve();let s=[],r=[];for(let o=0;o<n.length;o++){let a=n[o],l=Jn(t,e,a);if(this.lru.has(l))continue;let c=this.inflight.get(l);c?r.push(c):s.push(a)}if(s.length){let o=this._fetch(t,e,s);for(let a of s)this.inflight.set(Jn(t,e,a),o);r.push(o)}return r.length?Promise.all(r).then(()=>{}):Promise.resolve()}getWindow(t,e){return this.lru.get(Jn(t,e,ih))}hasWindow(t,e){return this.lru.has(Jn(t,e,ih))}requestWindow(t,e){if(e<0||e>=t.nWindows)return Promise.resolve();let n=Jn(t,e,ih);if(this.lru.has(n))return Promise.resolve();let s=this.inflight.get(n);return s||(s=this._fetchDense(t,e,n),this.inflight.set(n,s)),s}async _fetchDense(t,e,n){this._pending(1);try{let s=Array.from({length:t.nEnvs},(a,l)=>l),r=await this.source.blocks(t.path,e,s),o=await Jd(r,t.itemK,t.pose);this.lru.set(n,o,o.data.byteLength),this.epoch++}finally{this.inflight.delete(n),this._pending(-1)}}async _fetch(t,e,n){this._pending(1);let s=n.map(r=>Jn(t,e,r));try{let r=await this.source.blocks(t.path,e,n),o=await Kd(r,t.itemK,t.pose);for(let a=0;a<n.length;a++)this.lru.set(s[a],o[a],o[a].byteLength);this.epoch++}finally{for(let r of s)this.inflight.delete(r);this._pending(-1)}}_pending(t){this.pending+=t,this.onChange&&this.onChange(this.pending)}forget(t){for(let e of[...this.lru.map.keys()])Math.floor(e/(65536*16777216))===t.id&&this.lru.delete(e);this.epoch++}clear(){this.lru.clear(),this.inflight.clear(),this.epoch++}get bytes(){return this.lru.bytes}};var xe={LEFT:1,RIGHT:2,MIDDLE:4},$=Object.freeze({NONE:0,ROTATE:1,TRUCK:2,SCREEN_PAN:4,OFFSET:8,DOLLY:16,ZOOM:32,TOUCH_ROTATE:64,TOUCH_TRUCK:128,TOUCH_SCREEN_PAN:256,TOUCH_OFFSET:512,TOUCH_DOLLY:1024,TOUCH_ZOOM:2048,TOUCH_DOLLY_TRUCK:4096,TOUCH_DOLLY_SCREEN_PAN:8192,TOUCH_DOLLY_OFFSET:16384,TOUCH_DOLLY_ROTATE:32768,TOUCH_ZOOM_TRUCK:65536,TOUCH_ZOOM_OFFSET:131072,TOUCH_ZOOM_SCREEN_PAN:262144,TOUCH_ZOOM_ROTATE:524288}),ks={NONE:0,IN:1,OUT:-1};function qi(i){return i.isPerspectiveCamera}function Ei(i){return i.isOrthographicCamera}var wi=Math.PI*2,tf=Math.PI/2,cf=1e-5,Wr=Math.PI/180;function wn(i,t,e){return Math.max(t,Math.min(e,i))}function ue(i,t=cf){return Math.abs(i)<t}function ie(i,t,e=cf){return ue(i-t,e)}function ef(i,t){return Math.round(i/t)*t}function Xr(i){return isFinite(i)?i:i<0?-Number.MAX_VALUE:Number.MAX_VALUE}function qr(i){return Math.abs(i)<Number.MAX_VALUE?i:i*(1/0)}function ol(i,t,e,n,s=1/0,r){n=Math.max(1e-4,n);let o=2/n,a=o*r,l=1/(1+a+.48*a*a+.235*a*a*a),c=i-t,u=t,f=s*n;c=wn(c,-f,f),t=i-c;let h=(e.value+o*c)*r;e.value=(e.value-o*h)*l;let p=t+(c+h)*l;return u-i>0==p>u&&(p=u,e.value=(p-u)/r),p}function nf(i,t,e,n,s=1/0,r,o){n=Math.max(1e-4,n);let a=2/n,l=a*r,c=1/(1+l+.48*l*l+.235*l*l*l),u=t.x,f=t.y,h=t.z,p=i.x-u,g=i.y-f,_=i.z-h,m=u,d=f,M=h,E=s*n,y=E*E,b=p*p+g*g+_*_;if(b>y){let F=Math.sqrt(b);p=p/F*E,g=g/F*E,_=_/F*E}u=i.x-p,f=i.y-g,h=i.z-_;let S=(e.x+a*p)*r,C=(e.y+a*g)*r,v=(e.z+a*_)*r;e.x=(e.x-a*S)*c,e.y=(e.y-a*C)*c,e.z=(e.z-a*v)*c,o.x=u+(p+S)*c,o.y=f+(g+C)*c,o.z=h+(_+v)*c;let T=m-i.x,R=d-i.y,A=M-i.z,P=o.x-m,D=o.y-d,L=o.z-M;return T*P+R*D+A*L>0&&(o.x=m,o.y=d,o.z=M,e.x=(o.x-m)/r,e.y=(o.y-d)/r,e.z=(o.z-M)/r),o}function rh(i,t){t.set(0,0),i.forEach(e=>{t.x+=e.clientX,t.y+=e.clientY}),t.x/=i.length,t.y/=i.length}function oh(i,t){return Ei(i)?(console.warn(`${t} is not supported in OrthographicCamera`),!0):!1}var uh=class{_listeners={};addEventListener(t,e){let n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){let n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){let s=this._listeners[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}removeAllEventListeners(t){if(!t){this._listeners={};return}Array.isArray(this._listeners[t])&&(this._listeners[t].length=0)}dispatchEvent(t){let n=this._listeners[t.type];if(n!==void 0){t.target=this;let s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t)}}},_y="3.1.2",al=1/8,xy=/Mac/.test(globalThis?.navigator?.platform),Nt,sf,ll,ah,Je,kt,Jt,zs,Yr,Nn,Fn,Yi,rf,of,sn,Vs,Hs,af,lh,lf,ch,hh,cl,Gs=class i extends uh{static install(t){Nt=t.THREE,sf=Object.freeze(new Nt.Vector3(0,0,0)),ll=Object.freeze(new Nt.Vector3(0,1,0)),ah=Object.freeze(new Nt.Vector3(0,0,1)),Je=new Nt.Vector2,kt=new Nt.Vector3,Jt=new Nt.Vector3,zs=new Nt.Vector3,Yr=new Nt.Vector3,Nn=new Nt.Vector3,Fn=new Nt.Vector3,Yi=new Nt.Vector3,rf=new Nt.Vector3,of=new Nt.Vector3,sn=new Nt.Spherical,Vs=new Nt.Spherical,Hs=new Nt.Box3,af=new Nt.Box3,lh=new Nt.Sphere,lf=new Nt.Quaternion,ch=new Nt.Quaternion,hh=new Nt.Matrix4,cl=new Nt.Raycaster}static get ACTION(){return $}minPolarAngle=0;maxPolarAngle=Math.PI;minAzimuthAngle=-1/0;maxAzimuthAngle=1/0;minDistance=Number.EPSILON;maxDistance=1/0;infinityDolly=!1;minZoom=.01;maxZoom=1/0;smoothTime=.25;draggingSmoothTime=.125;maxSpeed=1/0;azimuthRotateSpeed=1;polarRotateSpeed=1;dollySpeed=1;dollyDragInverted=!1;truckSpeed=2;dollyToCursor=!1;dragToOffset=!1;boundaryFriction=0;restThreshold=.01;colliderMeshes=[];mouseButtons;touches;cancel=()=>{};lockPointer;unlockPointer;_enabled=!0;_camera;_yAxisUpSpace;_yAxisUpSpaceInverse;_state=$.NONE;_domElement;_viewport=null;_target;_targetEnd;_focalOffset;_focalOffsetEnd;_spherical;_sphericalEnd;_lastDistance;_zoom;_zoomEnd;_lastZoom;_cameraUp0;_target0;_position0;_zoom0;_focalOffset0;_dollyControlCoord;_changedDolly=0;_changedZoom=0;_nearPlaneCorners;_hasRested=!0;_boundary;_boundaryEnclosesCamera=!1;_needsUpdate=!0;_updatedLastTime=!1;_elementRect=new DOMRect;_isDragging=!1;_dragNeedsUpdate=!0;_activePointers=[];_lockedPointer=null;_interactiveArea=new DOMRect(0,0,1,1);_isUserControllingRotate=!1;_isUserControllingDolly=!1;_isUserControllingTruck=!1;_isUserControllingOffset=!1;_isUserControllingZoom=!1;_lastDollyDirection=ks.NONE;_thetaVelocity={value:0};_phiVelocity={value:0};_radiusVelocity={value:0};_targetVelocity=new Nt.Vector3;_focalOffsetVelocity=new Nt.Vector3;_zoomVelocity={value:0};set verticalDragToForward(t){console.warn("camera-controls: `verticalDragToForward` was removed. Use `mouseButtons.left = CameraControls.ACTION.SCREEN_PAN` instead.")}constructor(t,e){super(),typeof Nt>"u"&&console.error("camera-controls: `THREE` is undefined. You must first run `CameraControls.install( { THREE: THREE } )`. Check the docs for further information."),this._camera=t,this._yAxisUpSpace=new Nt.Quaternion().setFromUnitVectors(this._camera.up,ll),this._yAxisUpSpaceInverse=this._yAxisUpSpace.clone().invert(),this._state=$.NONE,this._target=new Nt.Vector3,this._targetEnd=this._target.clone(),this._focalOffset=new Nt.Vector3,this._focalOffsetEnd=this._focalOffset.clone(),this._spherical=new Nt.Spherical().setFromVector3(kt.copy(this._camera.position).applyQuaternion(this._yAxisUpSpace)),this._sphericalEnd=this._spherical.clone(),this._lastDistance=this._spherical.radius,this._zoom=this._camera.zoom,this._zoomEnd=this._zoom,this._lastZoom=this._zoom,this._nearPlaneCorners=[new Nt.Vector3,new Nt.Vector3,new Nt.Vector3,new Nt.Vector3],this._updateNearPlaneCorners(),this._boundary=new Nt.Box3(new Nt.Vector3(-1/0,-1/0,-1/0),new Nt.Vector3(1/0,1/0,1/0)),this._cameraUp0=this._camera.up.clone(),this._target0=this._target.clone(),this._position0=this._camera.position.clone(),this._zoom0=this._zoom,this._focalOffset0=this._focalOffset.clone(),this._dollyControlCoord=new Nt.Vector2,this.mouseButtons={left:$.ROTATE,middle:$.DOLLY,right:$.TRUCK,wheel:qi(this._camera)?$.DOLLY:Ei(this._camera)?$.ZOOM:$.NONE},this.touches={one:$.TOUCH_ROTATE,two:qi(this._camera)?$.TOUCH_DOLLY_TRUCK:Ei(this._camera)?$.TOUCH_ZOOM_TRUCK:$.NONE,three:$.TOUCH_TRUCK};let n=new Nt.Vector2,s=new Nt.Vector2,r=new Nt.Vector2,o=d=>{if(!this._enabled||!this._domElement)return;if(this._interactiveArea.left!==0||this._interactiveArea.top!==0||this._interactiveArea.width!==1||this._interactiveArea.height!==1){let y=this._domElement.getBoundingClientRect(),b=d.clientX/y.width,S=d.clientY/y.height;if(b<this._interactiveArea.left||b>this._interactiveArea.right||S<this._interactiveArea.top||S>this._interactiveArea.bottom)return}let M=d.pointerType!=="mouse"?null:(d.buttons&xe.LEFT)===xe.LEFT?xe.LEFT:(d.buttons&xe.MIDDLE)===xe.MIDDLE?xe.MIDDLE:(d.buttons&xe.RIGHT)===xe.RIGHT?xe.RIGHT:null;if(M!==null){let y=this._findPointerByMouseButton(M);y&&this._disposePointer(y)}if((d.buttons&xe.LEFT)===xe.LEFT&&this._lockedPointer)return;let E={pointerId:d.pointerId,clientX:d.clientX,clientY:d.clientY,deltaX:0,deltaY:0,mouseButton:M};this._activePointers.push(E),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this._domElement.ownerDocument.addEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",l),this._isDragging=!0,h(d)},a=d=>{d.cancelable&&d.preventDefault();let M=d.pointerId,E=this._lockedPointer||this._findPointerById(M);if(E){if(E.clientX=d.clientX,E.clientY=d.clientY,E.deltaX=d.movementX,E.deltaY=d.movementY,this._state=0,d.pointerType==="touch")switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else(!this._isDragging&&this._lockedPointer||this._isDragging&&(d.buttons&xe.LEFT)===xe.LEFT)&&(this._state=this._state|this.mouseButtons.left),this._isDragging&&(d.buttons&xe.MIDDLE)===xe.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),this._isDragging&&(d.buttons&xe.RIGHT)===xe.RIGHT&&(this._state=this._state|this.mouseButtons.right);p()}},l=d=>{let M=this._findPointerById(d.pointerId);if(!(M&&M===this._lockedPointer)){if(M&&this._disposePointer(M),d.pointerType==="touch")switch(this._activePointers.length){case 0:this._state=$.NONE;break;case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else this._state=$.NONE;g()}},c=-1,u=d=>{if(!this._domElement||!this._enabled||this.mouseButtons.wheel===$.NONE)return;if(this._interactiveArea.left!==0||this._interactiveArea.top!==0||this._interactiveArea.width!==1||this._interactiveArea.height!==1){let C=this._domElement.getBoundingClientRect(),v=d.clientX/C.width,T=d.clientY/C.height;if(v<this._interactiveArea.left||v>this._interactiveArea.right||T<this._interactiveArea.top||T>this._interactiveArea.bottom)return}if(d.preventDefault(),this.dollyToCursor||this.mouseButtons.wheel===$.ROTATE||this.mouseButtons.wheel===$.TRUCK){let C=performance.now();c-C<1e3&&this._getClientRect(this._elementRect),c=C}let M=xy?-1:-3,E=d.deltaMode===1&&!d.ctrlKey?d.deltaY/M:d.deltaY/(M*10),y=this.dollyToCursor?(d.clientX-this._elementRect.x)/this._elementRect.width*2-1:0,b=this.dollyToCursor?(d.clientY-this._elementRect.y)/this._elementRect.height*-2+1:0;switch(d.ctrlKey?$.ZOOM:this.mouseButtons.wheel){case $.ROTATE:{this._rotateInternal(d.deltaX,d.deltaY),this._isUserControllingRotate=!0;break}case $.TRUCK:{this._truckInternal(d.deltaX,d.deltaY,!1,!1),this._isUserControllingTruck=!0;break}case $.SCREEN_PAN:{this._truckInternal(d.deltaX,d.deltaY,!1,!0),this._isUserControllingTruck=!0;break}case $.OFFSET:{this._truckInternal(d.deltaX,d.deltaY,!0,!1),this._isUserControllingOffset=!0;break}case $.DOLLY:{this._dollyInternal(-E,y,b),this._isUserControllingDolly=!0;break}case $.ZOOM:{this._zoomInternal(-E,y,b),this._isUserControllingZoom=!0;break}}this.dispatchEvent({type:"control"})},f=d=>{if(!(!this._domElement||!this._enabled)){if(this.mouseButtons.right===i.ACTION.NONE){let M=d instanceof PointerEvent?d.pointerId:0,E=this._findPointerById(M);E&&this._disposePointer(E),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l);return}d.preventDefault()}},h=d=>{if(!this._enabled)return;if(rh(this._activePointers,Je),this._getClientRect(this._elementRect),n.copy(Je),s.copy(Je),this._activePointers.length>=2){let E=Je.x-this._activePointers[1].clientX,y=Je.y-this._activePointers[1].clientY,b=Math.sqrt(E*E+y*y);r.set(0,b);let S=(this._activePointers[0].clientX+this._activePointers[1].clientX)*.5,C=(this._activePointers[0].clientY+this._activePointers[1].clientY)*.5;s.set(S,C)}if(this._state=0,!d)this._lockedPointer&&(this._state=this._state|this.mouseButtons.left);else if("pointerType"in d&&d.pointerType==="touch")switch(this._activePointers.length){case 1:this._state=this.touches.one;break;case 2:this._state=this.touches.two;break;case 3:this._state=this.touches.three;break}else!this._lockedPointer&&(d.buttons&xe.LEFT)===xe.LEFT&&(this._state=this._state|this.mouseButtons.left),(d.buttons&xe.MIDDLE)===xe.MIDDLE&&(this._state=this._state|this.mouseButtons.middle),(d.buttons&xe.RIGHT)===xe.RIGHT&&(this._state=this._state|this.mouseButtons.right);((this._state&$.ROTATE)===$.ROTATE||(this._state&$.TOUCH_ROTATE)===$.TOUCH_ROTATE||(this._state&$.TOUCH_DOLLY_ROTATE)===$.TOUCH_DOLLY_ROTATE||(this._state&$.TOUCH_ZOOM_ROTATE)===$.TOUCH_ZOOM_ROTATE)&&(this._sphericalEnd.theta=this._spherical.theta,this._sphericalEnd.phi=this._spherical.phi,this._thetaVelocity.value=0,this._phiVelocity.value=0),((this._state&$.TRUCK)===$.TRUCK||(this._state&$.SCREEN_PAN)===$.SCREEN_PAN||(this._state&$.TOUCH_TRUCK)===$.TOUCH_TRUCK||(this._state&$.TOUCH_SCREEN_PAN)===$.TOUCH_SCREEN_PAN||(this._state&$.TOUCH_DOLLY_TRUCK)===$.TOUCH_DOLLY_TRUCK||(this._state&$.TOUCH_DOLLY_SCREEN_PAN)===$.TOUCH_DOLLY_SCREEN_PAN||(this._state&$.TOUCH_ZOOM_TRUCK)===$.TOUCH_ZOOM_TRUCK||(this._state&$.TOUCH_ZOOM_SCREEN_PAN)===$.TOUCH_DOLLY_SCREEN_PAN)&&(this._targetEnd.copy(this._target),this._targetVelocity.set(0,0,0)),((this._state&$.DOLLY)===$.DOLLY||(this._state&$.TOUCH_DOLLY)===$.TOUCH_DOLLY||(this._state&$.TOUCH_DOLLY_TRUCK)===$.TOUCH_DOLLY_TRUCK||(this._state&$.TOUCH_DOLLY_SCREEN_PAN)===$.TOUCH_DOLLY_SCREEN_PAN||(this._state&$.TOUCH_DOLLY_OFFSET)===$.TOUCH_DOLLY_OFFSET||(this._state&$.TOUCH_DOLLY_ROTATE)===$.TOUCH_DOLLY_ROTATE)&&(this._sphericalEnd.radius=this._spherical.radius,this._radiusVelocity.value=0),((this._state&$.ZOOM)===$.ZOOM||(this._state&$.TOUCH_ZOOM)===$.TOUCH_ZOOM||(this._state&$.TOUCH_ZOOM_TRUCK)===$.TOUCH_ZOOM_TRUCK||(this._state&$.TOUCH_ZOOM_SCREEN_PAN)===$.TOUCH_ZOOM_SCREEN_PAN||(this._state&$.TOUCH_ZOOM_OFFSET)===$.TOUCH_ZOOM_OFFSET||(this._state&$.TOUCH_ZOOM_ROTATE)===$.TOUCH_ZOOM_ROTATE)&&(this._zoomEnd=this._zoom,this._zoomVelocity.value=0),((this._state&$.OFFSET)===$.OFFSET||(this._state&$.TOUCH_OFFSET)===$.TOUCH_OFFSET||(this._state&$.TOUCH_DOLLY_OFFSET)===$.TOUCH_DOLLY_OFFSET||(this._state&$.TOUCH_ZOOM_OFFSET)===$.TOUCH_ZOOM_OFFSET)&&(this._focalOffsetEnd.copy(this._focalOffset),this._focalOffsetVelocity.set(0,0,0)),this.dispatchEvent({type:"controlstart"})},p=()=>{if(!this._enabled||!this._dragNeedsUpdate)return;this._dragNeedsUpdate=!1,rh(this._activePointers,Je);let M=this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement?this._lockedPointer||this._activePointers[0]:null,E=M?-M.deltaX:s.x-Je.x,y=M?-M.deltaY:s.y-Je.y;if(s.copy(Je),((this._state&$.ROTATE)===$.ROTATE||(this._state&$.TOUCH_ROTATE)===$.TOUCH_ROTATE||(this._state&$.TOUCH_DOLLY_ROTATE)===$.TOUCH_DOLLY_ROTATE||(this._state&$.TOUCH_ZOOM_ROTATE)===$.TOUCH_ZOOM_ROTATE)&&(this._rotateInternal(E,y),this._isUserControllingRotate=!0),(this._state&$.DOLLY)===$.DOLLY||(this._state&$.ZOOM)===$.ZOOM){let b=this.dollyToCursor?(n.x-this._elementRect.x)/this._elementRect.width*2-1:0,S=this.dollyToCursor?(n.y-this._elementRect.y)/this._elementRect.height*-2+1:0,C=this.dollyDragInverted?-1:1;(this._state&$.DOLLY)===$.DOLLY?(this._dollyInternal(C*y*al,b,S),this._isUserControllingDolly=!0):(this._zoomInternal(C*y*al,b,S),this._isUserControllingZoom=!0)}if((this._state&$.TOUCH_DOLLY)===$.TOUCH_DOLLY||(this._state&$.TOUCH_ZOOM)===$.TOUCH_ZOOM||(this._state&$.TOUCH_DOLLY_TRUCK)===$.TOUCH_DOLLY_TRUCK||(this._state&$.TOUCH_ZOOM_TRUCK)===$.TOUCH_ZOOM_TRUCK||(this._state&$.TOUCH_DOLLY_SCREEN_PAN)===$.TOUCH_DOLLY_SCREEN_PAN||(this._state&$.TOUCH_ZOOM_SCREEN_PAN)===$.TOUCH_ZOOM_SCREEN_PAN||(this._state&$.TOUCH_DOLLY_OFFSET)===$.TOUCH_DOLLY_OFFSET||(this._state&$.TOUCH_ZOOM_OFFSET)===$.TOUCH_ZOOM_OFFSET||(this._state&$.TOUCH_DOLLY_ROTATE)===$.TOUCH_DOLLY_ROTATE||(this._state&$.TOUCH_ZOOM_ROTATE)===$.TOUCH_ZOOM_ROTATE){let b=Je.x-this._activePointers[1].clientX,S=Je.y-this._activePointers[1].clientY,C=Math.sqrt(b*b+S*S),v=r.y-C;r.set(0,C);let T=this.dollyToCursor?(s.x-this._elementRect.x)/this._elementRect.width*2-1:0,R=this.dollyToCursor?(s.y-this._elementRect.y)/this._elementRect.height*-2+1:0;(this._state&$.TOUCH_DOLLY)===$.TOUCH_DOLLY||(this._state&$.TOUCH_DOLLY_ROTATE)===$.TOUCH_DOLLY_ROTATE||(this._state&$.TOUCH_DOLLY_TRUCK)===$.TOUCH_DOLLY_TRUCK||(this._state&$.TOUCH_DOLLY_SCREEN_PAN)===$.TOUCH_DOLLY_SCREEN_PAN||(this._state&$.TOUCH_DOLLY_OFFSET)===$.TOUCH_DOLLY_OFFSET?(this._dollyInternal(v*al,T,R),this._isUserControllingDolly=!0):(this._zoomInternal(v*al,T,R),this._isUserControllingZoom=!0)}((this._state&$.TRUCK)===$.TRUCK||(this._state&$.TOUCH_TRUCK)===$.TOUCH_TRUCK||(this._state&$.TOUCH_DOLLY_TRUCK)===$.TOUCH_DOLLY_TRUCK||(this._state&$.TOUCH_ZOOM_TRUCK)===$.TOUCH_ZOOM_TRUCK)&&(this._truckInternal(E,y,!1,!1),this._isUserControllingTruck=!0),((this._state&$.SCREEN_PAN)===$.SCREEN_PAN||(this._state&$.TOUCH_SCREEN_PAN)===$.TOUCH_SCREEN_PAN||(this._state&$.TOUCH_DOLLY_SCREEN_PAN)===$.TOUCH_DOLLY_SCREEN_PAN||(this._state&$.TOUCH_ZOOM_SCREEN_PAN)===$.TOUCH_ZOOM_SCREEN_PAN)&&(this._truckInternal(E,y,!1,!0),this._isUserControllingTruck=!0),((this._state&$.OFFSET)===$.OFFSET||(this._state&$.TOUCH_OFFSET)===$.TOUCH_OFFSET||(this._state&$.TOUCH_DOLLY_OFFSET)===$.TOUCH_DOLLY_OFFSET||(this._state&$.TOUCH_ZOOM_OFFSET)===$.TOUCH_ZOOM_OFFSET)&&(this._truckInternal(E,y,!0,!1),this._isUserControllingOffset=!0),this.dispatchEvent({type:"control"})},g=()=>{rh(this._activePointers,Je),s.copy(Je),this._dragNeedsUpdate=!1,(this._activePointers.length===0||this._activePointers.length===1&&this._activePointers[0]===this._lockedPointer)&&(this._isDragging=!1),this._activePointers.length===0&&this._domElement&&(this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this.dispatchEvent({type:"controlend"}))};this.lockPointer=()=>{!this._enabled||!this._domElement||(this.cancel(),this._lockedPointer={pointerId:-1,clientX:0,clientY:0,deltaX:0,deltaY:0,mouseButton:null},this._activePointers.push(this._lockedPointer),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this._domElement.requestPointerLock(),this._domElement.ownerDocument.addEventListener("pointerlockchange",_),this._domElement.ownerDocument.addEventListener("pointerlockerror",m),this._domElement.ownerDocument.addEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.addEventListener("pointerup",l),h())},this.unlockPointer=()=>{this._lockedPointer!==null&&(this._disposePointer(this._lockedPointer),this._lockedPointer=null),this._domElement?.ownerDocument.exitPointerLock(),this._domElement?.ownerDocument.removeEventListener("pointerlockchange",_),this._domElement?.ownerDocument.removeEventListener("pointerlockerror",m),this.cancel()};let _=()=>{this._domElement&&this._domElement.ownerDocument.pointerLockElement===this._domElement||this.unlockPointer()},m=()=>{this.unlockPointer()};this._addAllEventListeners=d=>{this._domElement=d,this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none",this._domElement.addEventListener("pointerdown",o),this._domElement.addEventListener("pointercancel",l),this._domElement.addEventListener("wheel",u,{passive:!1}),this._domElement.addEventListener("contextmenu",f)},this._removeAllEventListeners=()=>{this._domElement&&(this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect="",this._domElement.removeEventListener("pointerdown",o),this._domElement.removeEventListener("pointercancel",l),this._domElement.removeEventListener("wheel",u,{passive:!1}),this._domElement.removeEventListener("contextmenu",f),this._domElement.ownerDocument.removeEventListener("pointermove",a,{passive:!1}),this._domElement.ownerDocument.removeEventListener("pointerup",l),this._domElement.ownerDocument.removeEventListener("pointerlockchange",_),this._domElement.ownerDocument.removeEventListener("pointerlockerror",m))},this.cancel=()=>{this._state!==$.NONE&&(this._state=$.NONE,this._activePointers.length=0,g())},e&&this.connect(e),this.update(0)}get camera(){return this._camera}set camera(t){this._camera=t,this.updateCameraUp(),this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0}get enabled(){return this._enabled}set enabled(t){this._enabled=t,this._domElement&&(t?(this._domElement.style.touchAction="none",this._domElement.style.userSelect="none",this._domElement.style.webkitUserSelect="none"):(this.cancel(),this._domElement.style.touchAction="",this._domElement.style.userSelect="",this._domElement.style.webkitUserSelect=""))}get active(){return!this._hasRested}get currentAction(){return this._state}get distance(){return this._spherical.radius}set distance(t){this._spherical.radius===t&&this._sphericalEnd.radius===t||(this._spherical.radius=t,this._sphericalEnd.radius=t,this._needsUpdate=!0)}get azimuthAngle(){return this._spherical.theta}set azimuthAngle(t){this._spherical.theta===t&&this._sphericalEnd.theta===t||(this._spherical.theta=t,this._sphericalEnd.theta=t,this._needsUpdate=!0)}get polarAngle(){return this._spherical.phi}set polarAngle(t){this._spherical.phi===t&&this._sphericalEnd.phi===t||(this._spherical.phi=t,this._sphericalEnd.phi=t,this._needsUpdate=!0)}get boundaryEnclosesCamera(){return this._boundaryEnclosesCamera}set boundaryEnclosesCamera(t){this._boundaryEnclosesCamera=t,this._needsUpdate=!0}set interactiveArea(t){this._interactiveArea.width=wn(t.width,0,1),this._interactiveArea.height=wn(t.height,0,1),this._interactiveArea.x=wn(t.x,0,1-this._interactiveArea.width),this._interactiveArea.y=wn(t.y,0,1-this._interactiveArea.height)}addEventListener(t,e){super.addEventListener(t,e)}removeEventListener(t,e){super.removeEventListener(t,e)}rotate(t,e,n=!1){return this.rotateTo(this._sphericalEnd.theta+t,this._sphericalEnd.phi+e,n)}rotateAzimuthTo(t,e=!1){return this.rotateTo(t,this._sphericalEnd.phi,e)}rotatePolarTo(t,e=!1){return this.rotateTo(this._sphericalEnd.theta,t,e)}rotateTo(t,e,n=!1){this._isUserControllingRotate=!1;let s=wn(t,this.minAzimuthAngle,this.maxAzimuthAngle),r=wn(e,this.minPolarAngle,this.maxPolarAngle);this._sphericalEnd.theta=s,this._sphericalEnd.phi=r,this._sphericalEnd.makeSafe(),this._needsUpdate=!0,n||(this._spherical.theta=this._sphericalEnd.theta,this._spherical.phi=this._sphericalEnd.phi);let o=!n||ie(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&ie(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold);return this._createOnRestPromise(o)}dolly(t,e=!1){return this.dollyTo(this._sphericalEnd.radius-t,e)}dollyTo(t,e=!1){return this._isUserControllingDolly=!1,this._lastDollyDirection=ks.NONE,this._changedDolly=0,this._dollyToNoClamp(wn(t,this.minDistance,this.maxDistance),e)}_dollyToNoClamp(t,e=!1){let n=this._sphericalEnd.radius;if(this.colliderMeshes.length>=1){let o=this._collisionTest(),a=ie(o,this._spherical.radius);if(!(n>t)&&a)return Promise.resolve();this._sphericalEnd.radius=Math.min(t,o)}else this._sphericalEnd.radius=t;this._needsUpdate=!0,e||(this._spherical.radius=this._sphericalEnd.radius);let r=!e||ie(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(r)}dollyInFixed(t,e=!1){this._targetEnd.add(this._getCameraDirection(Yr).multiplyScalar(t)),e||this._target.copy(this._targetEnd);let n=!e||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(n)}zoom(t,e=!1){return this.zoomTo(this._zoomEnd+t,e)}zoomTo(t,e=!1){this._isUserControllingZoom=!1,this._zoomEnd=wn(t,this.minZoom,this.maxZoom),this._needsUpdate=!0,e||(this._zoom=this._zoomEnd);let n=!e||ie(this._zoom,this._zoomEnd,this.restThreshold);return this._changedZoom=0,this._createOnRestPromise(n)}pan(t,e,n=!1){return console.warn("`pan` has been renamed to `truck`"),this.truck(t,e,n)}truck(t,e,n=!1){this._camera.updateMatrix(),Nn.setFromMatrixColumn(this._camera.matrix,0),Fn.setFromMatrixColumn(this._camera.matrix,1),Nn.multiplyScalar(t),Fn.multiplyScalar(-e);let s=kt.copy(Nn).add(Fn),r=Jt.copy(this._targetEnd).add(s);return this.moveTo(r.x,r.y,r.z,n)}forward(t,e=!1){kt.setFromMatrixColumn(this._camera.matrix,0),kt.crossVectors(this._camera.up,kt),kt.multiplyScalar(t);let n=Jt.copy(this._targetEnd).add(kt);return this.moveTo(n.x,n.y,n.z,e)}elevate(t,e=!1){return kt.copy(this._camera.up).multiplyScalar(t),this.moveTo(this._targetEnd.x+kt.x,this._targetEnd.y+kt.y,this._targetEnd.z+kt.z,e)}moveTo(t,e,n,s=!1){this._isUserControllingTruck=!1;let r=kt.set(t,e,n).sub(this._targetEnd);this._encloseToBoundary(this._targetEnd,r,this.boundaryFriction),this._needsUpdate=!0,s||this._target.copy(this._targetEnd);let o=!s||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold);return this._createOnRestPromise(o)}lookInDirectionOf(t,e,n,s=!1){let a=kt.set(t,e,n).sub(this._targetEnd).normalize().multiplyScalar(-this._sphericalEnd.radius).add(this._targetEnd);return this.setPosition(a.x,a.y,a.z,s)}fitToBox(t,e,{cover:n=!1,paddingLeft:s=0,paddingRight:r=0,paddingBottom:o=0,paddingTop:a=0}={}){let l=[],c=t.isBox3?Hs.copy(t):Hs.setFromObject(t);c.isEmpty()&&(console.warn("camera-controls: fitTo() cannot be used with an empty box. Aborting"),Promise.resolve());let u=ef(this._sphericalEnd.theta,tf),f=ef(this._sphericalEnd.phi,tf);l.push(this.rotateTo(u,f,e));let h=kt.setFromSpherical(this._sphericalEnd).normalize(),p=lf.setFromUnitVectors(h,ah),g=ie(Math.abs(h.y),1);g&&p.multiply(ch.setFromAxisAngle(ll,u)),p.multiply(this._yAxisUpSpaceInverse);let _=af.makeEmpty();Jt.copy(c.min).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.min).setX(c.max.x).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.min).setY(c.max.y).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).setZ(c.min.z).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.min).setZ(c.max.z).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).setY(c.min.y).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).setX(c.min.x).applyQuaternion(p),_.expandByPoint(Jt),Jt.copy(c.max).applyQuaternion(p),_.expandByPoint(Jt),_.min.x-=s,_.min.y-=o,_.max.x+=r,_.max.y+=a,p.setFromUnitVectors(ah,h),g&&p.premultiply(ch.invert()),p.premultiply(this._yAxisUpSpace);let m=_.getSize(kt),d=_.getCenter(Jt).applyQuaternion(p);if(qi(this._camera)){let M=this.getDistanceToFitBox(m.x,m.y,m.z,n);l.push(this.moveTo(d.x,d.y,d.z,e)),l.push(this.dollyTo(M,e)),l.push(this.setFocalOffset(0,0,0,e))}else if(Ei(this._camera)){let M=this._camera,E=M.right-M.left,y=M.top-M.bottom,b=n?Math.max(E/m.x,y/m.y):Math.min(E/m.x,y/m.y);l.push(this.moveTo(d.x,d.y,d.z,e)),l.push(this.zoomTo(b,e)),l.push(this.setFocalOffset(0,0,0,e))}return Promise.all(l)}fitToSphere(t,e){let n=[],r="isObject3D"in t?i.createBoundingSphere(t,lh):lh.copy(t);if(n.push(this.moveTo(r.center.x,r.center.y,r.center.z,e)),qi(this._camera)){let o=this.getDistanceToFitSphere(r.radius);n.push(this.dollyTo(o,e))}else if(Ei(this._camera)){let o=this._camera.right-this._camera.left,a=this._camera.top-this._camera.bottom,l=2*r.radius,c=Math.min(o/l,a/l);n.push(this.zoomTo(c,e))}return n.push(this.setFocalOffset(0,0,0,e)),Promise.all(n)}setLookAt(t,e,n,s,r,o,a=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=ks.NONE,this._changedDolly=0;let l=Jt.set(s,r,o),c=kt.set(t,e,n);this._targetEnd.copy(l),this._sphericalEnd.setFromVector3(c.sub(l).applyQuaternion(this._yAxisUpSpace)),this._needsUpdate=!0,a||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let u=!a||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold)&&ie(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&ie(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&ie(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(u)}lerp(t,e,n,s=!1){this._isUserControllingRotate=!1,this._isUserControllingDolly=!1,this._isUserControllingTruck=!1,this._lastDollyDirection=ks.NONE,this._changedDolly=0;let r=kt.set(...t.target);if("spherical"in t)sn.set(...t.spherical);else{let f=Jt.set(...t.position);sn.setFromVector3(f.sub(r).applyQuaternion(this._yAxisUpSpace))}let o=zs.set(...e.target);if("spherical"in e)Vs.set(...e.spherical);else{let f=Jt.set(...e.position);Vs.setFromVector3(f.sub(o).applyQuaternion(this._yAxisUpSpace))}this._targetEnd.copy(r.lerp(o,n));let a=Vs.theta-sn.theta,l=Vs.phi-sn.phi,c=Vs.radius-sn.radius;this._sphericalEnd.set(sn.radius+c*n,sn.phi+l*n,sn.theta+a*n),this._needsUpdate=!0,s||(this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd));let u=!s||ie(this._target.x,this._targetEnd.x,this.restThreshold)&&ie(this._target.y,this._targetEnd.y,this.restThreshold)&&ie(this._target.z,this._targetEnd.z,this.restThreshold)&&ie(this._spherical.theta,this._sphericalEnd.theta,this.restThreshold)&&ie(this._spherical.phi,this._sphericalEnd.phi,this.restThreshold)&&ie(this._spherical.radius,this._sphericalEnd.radius,this.restThreshold);return this._createOnRestPromise(u)}lerpLookAt(t,e,n,s,r,o,a,l,c,u,f,h,p,g=!1){return this.lerp({position:[t,e,n],target:[s,r,o]},{position:[a,l,c],target:[u,f,h]},p,g)}setPosition(t,e,n,s=!1){return this.setLookAt(t,e,n,this._targetEnd.x,this._targetEnd.y,this._targetEnd.z,s)}setTarget(t,e,n,s=!1){let r=this.getPosition(kt),o=this.setLookAt(r.x,r.y,r.z,t,e,n,s);return this._sphericalEnd.phi=wn(this._sphericalEnd.phi,this.minPolarAngle,this.maxPolarAngle),o}setFocalOffset(t,e,n,s=!1){this._isUserControllingOffset=!1,this._focalOffsetEnd.set(t,e,n),this._needsUpdate=!0,s||this._focalOffset.copy(this._focalOffsetEnd);let r=!s||ie(this._focalOffset.x,this._focalOffsetEnd.x,this.restThreshold)&&ie(this._focalOffset.y,this._focalOffsetEnd.y,this.restThreshold)&&ie(this._focalOffset.z,this._focalOffsetEnd.z,this.restThreshold);return this._createOnRestPromise(r)}setOrbitPoint(t,e,n){this._camera.updateMatrixWorld(),Nn.setFromMatrixColumn(this._camera.matrixWorldInverse,0),Fn.setFromMatrixColumn(this._camera.matrixWorldInverse,1),Yi.setFromMatrixColumn(this._camera.matrixWorldInverse,2);let s=kt.set(t,e,n),r=s.distanceTo(this._camera.position),o=s.sub(this._camera.position);Nn.multiplyScalar(o.x),Fn.multiplyScalar(o.y),Yi.multiplyScalar(o.z),kt.copy(Nn).add(Fn).add(Yi),kt.z=kt.z+r,this.dollyTo(r,!1),this.setFocalOffset(-kt.x,kt.y,-kt.z,!1),this.moveTo(t,e,n,!1)}setBoundary(t){if(!t){this._boundary.min.set(-1/0,-1/0,-1/0),this._boundary.max.set(1/0,1/0,1/0),this._needsUpdate=!0;return}this._boundary.copy(t),this._boundary.clampPoint(this._targetEnd,this._targetEnd),this._needsUpdate=!0}setViewport(t,e,n,s){if(t===null){this._viewport=null;return}this._viewport=this._viewport||new Nt.Vector4,typeof t=="number"?this._viewport.set(t,e,n,s):this._viewport.copy(t)}getDistanceToFitBox(t,e,n,s=!1){if(oh(this._camera,"getDistanceToFitBox"))return this._spherical.radius;let r=t/e,o=this._camera.getEffectiveFOV()*Wr,a=this._camera.aspect;return((s?r>a:r<a)?e:t/a)*.5/Math.tan(o*.5)+n*.5}getDistanceToFitSphere(t){if(oh(this._camera,"getDistanceToFitSphere"))return this._spherical.radius;let e=this._camera.getEffectiveFOV()*Wr,n=Math.atan(Math.tan(e*.5)*this._camera.aspect)*2,s=1<this._camera.aspect?e:n;return t/Math.sin(s*.5)}getTarget(t,e=!0){return(t&&t.isVector3?t:new Nt.Vector3).copy(e?this._targetEnd:this._target)}getPosition(t,e=!0){return(t&&t.isVector3?t:new Nt.Vector3).setFromSpherical(e?this._sphericalEnd:this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(e?this._targetEnd:this._target)}getSpherical(t,e=!0){return(t||new Nt.Spherical).copy(e?this._sphericalEnd:this._spherical)}getFocalOffset(t,e=!0){return(t&&t.isVector3?t:new Nt.Vector3).copy(e?this._focalOffsetEnd:this._focalOffset)}normalizeRotations(){return this._sphericalEnd.theta=(this._sphericalEnd.theta%wi+wi)%wi,this._sphericalEnd.theta>Math.PI&&(this._sphericalEnd.theta-=wi),this._spherical.theta+=wi*Math.round((this._sphericalEnd.theta-this._spherical.theta)/wi),this}stop(){this._focalOffset.copy(this._focalOffsetEnd),this._target.copy(this._targetEnd),this._spherical.copy(this._sphericalEnd),this._zoom=this._zoomEnd}reset(t=!1){if(!ie(this._camera.up.x,this._cameraUp0.x)||!ie(this._camera.up.y,this._cameraUp0.y)||!ie(this._camera.up.z,this._cameraUp0.z)){this._camera.up.copy(this._cameraUp0);let n=this.getPosition(kt);this.updateCameraUp(),this.setPosition(n.x,n.y,n.z)}let e=[this.setLookAt(this._position0.x,this._position0.y,this._position0.z,this._target0.x,this._target0.y,this._target0.z,t),this.setFocalOffset(this._focalOffset0.x,this._focalOffset0.y,this._focalOffset0.z,t),this.zoomTo(this._zoom0,t)];return Promise.all(e)}saveState(){this._cameraUp0.copy(this._camera.up),this.getTarget(this._target0),this.getPosition(this._position0),this._zoom0=this._zoom,this._focalOffset0.copy(this._focalOffset)}updateCameraUp(){this._yAxisUpSpace.setFromUnitVectors(this._camera.up,ll),this._yAxisUpSpaceInverse.copy(this._yAxisUpSpace).invert()}applyCameraUp(){let t=kt.subVectors(this._target,this._camera.position).normalize(),e=Jt.crossVectors(t,this._camera.up);this._camera.up.crossVectors(e,t).normalize(),this._camera.updateMatrixWorld();let n=this.getPosition(kt);this.updateCameraUp(),this.setPosition(n.x,n.y,n.z)}update(t){let e=this._sphericalEnd.theta-this._spherical.theta,n=this._sphericalEnd.phi-this._spherical.phi,s=this._sphericalEnd.radius-this._spherical.radius,r=rf.subVectors(this._targetEnd,this._target),o=of.subVectors(this._focalOffsetEnd,this._focalOffset),a=this._zoomEnd-this._zoom;if(ue(e))this._thetaVelocity.value=0,this._spherical.theta=this._sphericalEnd.theta;else{let f=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.theta=ol(this._spherical.theta,this._sphericalEnd.theta,this._thetaVelocity,f,1/0,t),this._needsUpdate=!0}if(ue(n))this._phiVelocity.value=0,this._spherical.phi=this._sphericalEnd.phi;else{let f=this._isUserControllingRotate?this.draggingSmoothTime:this.smoothTime;this._spherical.phi=ol(this._spherical.phi,this._sphericalEnd.phi,this._phiVelocity,f,1/0,t),this._needsUpdate=!0}if(ue(s))this._radiusVelocity.value=0,this._spherical.radius=this._sphericalEnd.radius;else{let f=this._isUserControllingDolly?this.draggingSmoothTime:this.smoothTime;this._spherical.radius=ol(this._spherical.radius,this._sphericalEnd.radius,this._radiusVelocity,f,this.maxSpeed,t),this._needsUpdate=!0}if(ue(r.x)&&ue(r.y)&&ue(r.z))this._targetVelocity.set(0,0,0),this._target.copy(this._targetEnd);else{let f=this._isUserControllingTruck?this.draggingSmoothTime:this.smoothTime;nf(this._target,this._targetEnd,this._targetVelocity,f,this.maxSpeed,t,this._target),this._needsUpdate=!0}if(ue(o.x)&&ue(o.y)&&ue(o.z))this._focalOffsetVelocity.set(0,0,0),this._focalOffset.copy(this._focalOffsetEnd);else{let f=this._isUserControllingOffset?this.draggingSmoothTime:this.smoothTime;nf(this._focalOffset,this._focalOffsetEnd,this._focalOffsetVelocity,f,this.maxSpeed,t,this._focalOffset),this._needsUpdate=!0}if(ue(a))this._zoomVelocity.value=0,this._zoom=this._zoomEnd;else{let f=this._isUserControllingZoom?this.draggingSmoothTime:this.smoothTime;this._zoom=ol(this._zoom,this._zoomEnd,this._zoomVelocity,f,1/0,t)}if(this.dollyToCursor){if(qi(this._camera)&&this._changedDolly!==0){let f=this._spherical.radius-this._lastDistance,h=this._camera,p=this._getCameraDirection(Yr),g=kt.copy(p).cross(h.up).normalize();g.lengthSq()===0&&(g.x=1);let _=Jt.crossVectors(g,p),m=this._sphericalEnd.radius*Math.tan(h.getEffectiveFOV()*Wr*.5),M=(this._sphericalEnd.radius-f-this._sphericalEnd.radius)/this._sphericalEnd.radius,E=zs.copy(this._targetEnd).add(g.multiplyScalar(this._dollyControlCoord.x*m*h.aspect)).add(_.multiplyScalar(this._dollyControlCoord.y*m)),y=kt.copy(this._targetEnd).lerp(E,M),b=this._lastDollyDirection===ks.IN&&this._spherical.radius<=this.minDistance,S=this._lastDollyDirection===ks.OUT&&this.maxDistance<=this._spherical.radius;if(this.infinityDolly&&(b||S)){this._sphericalEnd.radius-=f,this._spherical.radius-=f;let v=Jt.copy(p).multiplyScalar(-f);y.add(v)}this._boundary.clampPoint(y,y);let C=Jt.subVectors(y,this._targetEnd);this._targetEnd.copy(y),this._target.add(C),this._changedDolly-=f,ue(this._changedDolly)&&(this._changedDolly=0)}else if(Ei(this._camera)&&this._changedZoom!==0){let f=this._zoom-this._lastZoom,h=this._camera,p=kt.set(this._dollyControlCoord.x,this._dollyControlCoord.y,(h.near+h.far)/(h.near-h.far)).unproject(h),g=Jt.set(0,0,-1).applyQuaternion(h.quaternion),_=zs.copy(p).add(g.multiplyScalar(-p.dot(h.up))),d=-(this._zoom-f-this._zoom)/this._zoom,M=this._getCameraDirection(Yr),E=this._targetEnd.dot(M),y=kt.copy(this._targetEnd).lerp(_,d),b=y.dot(M),S=M.multiplyScalar(b-E);y.sub(S),this._boundary.clampPoint(y,y);let C=Jt.subVectors(y,this._targetEnd);this._targetEnd.copy(y),this._target.add(C),this._changedZoom-=f,ue(this._changedZoom)&&(this._changedZoom=0)}}this._camera.zoom!==this._zoom&&(this._camera.zoom=this._zoom,this._camera.updateProjectionMatrix(),this._updateNearPlaneCorners(),this._needsUpdate=!0),this._dragNeedsUpdate=!0;let l=this._collisionTest();this._spherical.radius=Math.min(this._spherical.radius,l),this._spherical.makeSafe(),this._camera.position.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse).add(this._target),this._camera.lookAt(this._target),(!ue(this._focalOffset.x)||!ue(this._focalOffset.y)||!ue(this._focalOffset.z))&&(this._camera.matrix.compose(this._camera.position,this._camera.quaternion,this._camera.scale),Nn.setFromMatrixColumn(this._camera.matrix,0),Fn.setFromMatrixColumn(this._camera.matrix,1),Yi.setFromMatrixColumn(this._camera.matrix,2),Nn.multiplyScalar(this._focalOffset.x),Fn.multiplyScalar(-this._focalOffset.y),Yi.multiplyScalar(this._focalOffset.z),kt.copy(Nn).add(Fn).add(Yi),this._camera.position.add(kt),this._camera.updateMatrixWorld()),this._boundaryEnclosesCamera&&this._encloseToBoundary(this._camera.position.copy(this._target),kt.setFromSpherical(this._spherical).applyQuaternion(this._yAxisUpSpaceInverse),1);let u=this._needsUpdate;return u&&!this._updatedLastTime?(this._hasRested=!1,this.dispatchEvent({type:"wake"}),this.dispatchEvent({type:"update"})):u?(this.dispatchEvent({type:"update"}),ue(e,this.restThreshold)&&ue(n,this.restThreshold)&&ue(s,this.restThreshold)&&ue(r.x,this.restThreshold)&&ue(r.y,this.restThreshold)&&ue(r.z,this.restThreshold)&&ue(o.x,this.restThreshold)&&ue(o.y,this.restThreshold)&&ue(o.z,this.restThreshold)&&ue(a,this.restThreshold)&&!this._hasRested&&(this._hasRested=!0,this.dispatchEvent({type:"rest"}))):!u&&this._updatedLastTime&&this.dispatchEvent({type:"sleep"}),this._lastDistance=this._spherical.radius,this._lastZoom=this._zoom,this._updatedLastTime=u,this._needsUpdate=!1,u}toJSON(){return JSON.stringify({enabled:this._enabled,minDistance:this.minDistance,maxDistance:Xr(this.maxDistance),minZoom:this.minZoom,maxZoom:Xr(this.maxZoom),minPolarAngle:this.minPolarAngle,maxPolarAngle:Xr(this.maxPolarAngle),minAzimuthAngle:Xr(this.minAzimuthAngle),maxAzimuthAngle:Xr(this.maxAzimuthAngle),smoothTime:this.smoothTime,draggingSmoothTime:this.draggingSmoothTime,dollySpeed:this.dollySpeed,truckSpeed:this.truckSpeed,dollyToCursor:this.dollyToCursor,target:this._targetEnd.toArray(),position:kt.setFromSpherical(this._sphericalEnd).add(this._targetEnd).toArray(),zoom:this._zoomEnd,focalOffset:this._focalOffsetEnd.toArray(),target0:this._target0.toArray(),position0:this._position0.toArray(),zoom0:this._zoom0,focalOffset0:this._focalOffset0.toArray()})}fromJSON(t,e=!1){let n=JSON.parse(t);this.enabled=n.enabled,this.minDistance=n.minDistance,this.maxDistance=qr(n.maxDistance),this.minZoom=n.minZoom,this.maxZoom=qr(n.maxZoom),this.minPolarAngle=n.minPolarAngle,this.maxPolarAngle=qr(n.maxPolarAngle),this.minAzimuthAngle=qr(n.minAzimuthAngle),this.maxAzimuthAngle=qr(n.maxAzimuthAngle),this.smoothTime=n.smoothTime,this.draggingSmoothTime=n.draggingSmoothTime,this.dollySpeed=n.dollySpeed,this.truckSpeed=n.truckSpeed,this.dollyToCursor=n.dollyToCursor,this._target0.fromArray(n.target0),this._position0.fromArray(n.position0),this._zoom0=n.zoom0,this._focalOffset0.fromArray(n.focalOffset0),this.moveTo(n.target[0],n.target[1],n.target[2],e),sn.setFromVector3(kt.fromArray(n.position).sub(this._targetEnd).applyQuaternion(this._yAxisUpSpace)),this.rotateTo(sn.theta,sn.phi,e),this.dollyTo(sn.radius,e),this.zoomTo(n.zoom,e),this.setFocalOffset(n.focalOffset[0],n.focalOffset[1],n.focalOffset[2],e),this._needsUpdate=!0}connect(t){if(this._domElement){console.warn("camera-controls is already connected.");return}t.setAttribute("data-camera-controls-version",_y),this._addAllEventListeners(t),this._getClientRect(this._elementRect)}disconnect(){this.cancel(),this._removeAllEventListeners(),this._domElement&&(this._domElement.removeAttribute("data-camera-controls-version"),this._domElement=void 0)}dispose(){this.removeAllEventListeners(),this.disconnect()}_getTargetDirection(t){return t.setFromSpherical(this._spherical).divideScalar(this._spherical.radius).applyQuaternion(this._yAxisUpSpaceInverse)}_getCameraDirection(t){return this._getTargetDirection(t).negate()}_findPointerById(t){return this._activePointers.find(e=>e.pointerId===t)}_findPointerByMouseButton(t){return this._activePointers.find(e=>e.mouseButton===t)}_disposePointer(t){this._activePointers.splice(this._activePointers.indexOf(t),1)}_encloseToBoundary(t,e,n){let s=e.lengthSq();if(s===0)return t;let r=Jt.copy(e).add(t),a=this._boundary.clampPoint(r,zs).sub(r),l=a.lengthSq();if(l===0)return t.add(e);if(l===s)return t;if(n===0)return t.add(e).add(a);{let c=1+n*l/e.dot(a);return t.add(Jt.copy(e).multiplyScalar(c)).add(a.multiplyScalar(1-n))}}_updateNearPlaneCorners(){if(qi(this._camera)){let t=this._camera,e=t.near,n=t.getEffectiveFOV()*Wr,s=Math.tan(n*.5)*e,r=s*t.aspect;this._nearPlaneCorners[0].set(-r,-s,0),this._nearPlaneCorners[1].set(r,-s,0),this._nearPlaneCorners[2].set(r,s,0),this._nearPlaneCorners[3].set(-r,s,0)}else if(Ei(this._camera)){let t=this._camera,e=1/t.zoom,n=t.left*e,s=t.right*e,r=t.top*e,o=t.bottom*e;this._nearPlaneCorners[0].set(n,r,0),this._nearPlaneCorners[1].set(s,r,0),this._nearPlaneCorners[2].set(s,o,0),this._nearPlaneCorners[3].set(n,o,0)}}_truckInternal=(t,e,n,s)=>{let r,o;if(qi(this._camera)){let a=kt.copy(this._camera.position).sub(this._target),l=this._camera.getEffectiveFOV()*Wr,c=a.length()*Math.tan(l*.5);r=this.truckSpeed*t*c/this._elementRect.height,o=this.truckSpeed*e*c/this._elementRect.height}else if(Ei(this._camera)){let a=this._camera;r=this.truckSpeed*t*(a.right-a.left)/a.zoom/this._elementRect.width,o=this.truckSpeed*e*(a.top-a.bottom)/a.zoom/this._elementRect.height}else return;s?(n?this.setFocalOffset(this._focalOffsetEnd.x+r,this._focalOffsetEnd.y,this._focalOffsetEnd.z,!0):this.truck(r,0,!0),this.forward(-o,!0)):n?this.setFocalOffset(this._focalOffsetEnd.x+r,this._focalOffsetEnd.y+o,this._focalOffsetEnd.z,!0):this.truck(r,o,!0)};_rotateInternal=(t,e)=>{let n=wi*this.azimuthRotateSpeed*t/this._elementRect.height,s=wi*this.polarRotateSpeed*e/this._elementRect.height;this.rotate(n,s,!0)};_dollyInternal=(t,e,n)=>{let s=Math.pow(.95,-t*this.dollySpeed),r=this._sphericalEnd.radius,o=this._sphericalEnd.radius*s,a=wn(o,this.minDistance,this.maxDistance),l=a-o;this.infinityDolly&&this.dollyToCursor?this._dollyToNoClamp(o,!0):this.infinityDolly&&!this.dollyToCursor?(this.dollyInFixed(l,!0),this._dollyToNoClamp(a,!0)):this._dollyToNoClamp(a,!0),this.dollyToCursor&&(this._changedDolly+=(this.infinityDolly?o:a)-r,this._dollyControlCoord.set(e,n)),this._lastDollyDirection=Math.sign(-t)};_zoomInternal=(t,e,n)=>{let s=Math.pow(.95,t*this.dollySpeed),r=this._zoom,o=this._zoom*s;this.zoomTo(o,!0),this.dollyToCursor&&(this._changedZoom+=o-r,this._dollyControlCoord.set(e,n))};_collisionTest(){let t=1/0;if(!(this.colliderMeshes.length>=1)||oh(this._camera,"_collisionTest"))return t;let n=this._getTargetDirection(Yr);hh.lookAt(sf,n,this._camera.up);for(let s=0;s<4;s++){let r=Jt.copy(this._nearPlaneCorners[s]);r.applyMatrix4(hh);let o=zs.addVectors(this._target,r);cl.set(o,n),cl.far=this._spherical.radius+1;let a=cl.intersectObjects(this.colliderMeshes);a.length!==0&&a[0].distance<t&&(t=a[0].distance)}return t}_getClientRect(t){if(!this._domElement)return;let e=this._domElement.getBoundingClientRect();return t.x=e.left,t.y=e.top,this._viewport?(t.x+=this._viewport.x,t.y+=e.height-this._viewport.w-this._viewport.y,t.width=this._viewport.z,t.height=this._viewport.w):(t.width=e.width,t.height=e.height),t}_createOnRestPromise(t){return t?Promise.resolve():(this._hasRested=!1,this.dispatchEvent({type:"transitionstart"}),new Promise(e=>{let n=()=>{this.removeEventListener("rest",n),e()};this.addEventListener("rest",n)}))}_addAllEventListeners(t){}_removeAllEventListeners(){}get dampingFactor(){return console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead."),0}set dampingFactor(t){console.warn(".dampingFactor has been deprecated. use smoothTime (in seconds) instead.")}get draggingDampingFactor(){return console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead."),0}set draggingDampingFactor(t){console.warn(".draggingDampingFactor has been deprecated. use draggingSmoothTime (in seconds) instead.")}static createBoundingSphere(t,e=new Nt.Sphere){let n=e,s=n.center;Hs.makeEmpty(),t.traverseVisible(o=>{o.isMesh&&Hs.expandByObject(o)}),Hs.getCenter(s);let r=0;return t.traverseVisible(o=>{if(!o.isMesh)return;let a=o;if(!a.geometry)return;let l=a.geometry.clone();l.applyMatrix4(a.matrixWorld);let u=l.attributes.position;for(let f=0,h=u.count;f<h;f++)kt.fromBufferAttribute(u,f),r=Math.max(r,s.distanceToSquared(kt))}),n.radius=Math.sqrt(r),n}};Gs.install({THREE:{Vector2:Ht,Vector3:z,Vector4:he,Quaternion:en,Matrix4:ne,Spherical:Cs,Box3:cn,Sphere:yn,Raycaster:Ir,MathUtils:bi}});var Zi=["iso","front","side","top"],hf={iso:[1,1,.8],front:[1,0,0],side:[0,1,0],top:[0,-.001,1]},uf=.001,df=Math.PI/2,Ti=.08,je=Gs.ACTION,yy=je.ROTATE|je.TOUCH_ROTATE|je.TOUCH_DOLLY_ROTATE|je.TOUCH_ZOOM_ROTATE,hl=new z,Ai=new Cs,ul=new en,fh=new z(0,0,1),vy=new z,Zr=new z,$r=new z,pf=new z(0,1,0),My={rx:1,ry:0,rz:0,ux:0,uy:0,uz:1};function ff(i){let t=hf[Object.hasOwn(hf,i)?i:"iso"];return ul.setFromUnitVectors(fh,pf),Ai.setFromVector3(hl.set(t[0],t[1],t[2]).normalize().applyQuaternion(ul)),{azimuth:Ai.theta,polar:Ai.phi}}function dh(i,t){let e=2*Math.PI;return i+e*Math.round((t-i)/e)}var dl=class{constructor(t){this.camera=new gi(-1,1,1,-1,.05,500),this.camera.up.set(0,0,1),this.camera.position.set(1,1,.8).normalize().multiplyScalar(50),this.controls=new Gs(this.camera,t||void 0);let e=this.controls;e.smoothTime=Ti,e.draggingSmoothTime=.1,e.minPolarAngle=uf,e.maxPolarAngle=df,e.minZoom=.001,e.maxZoom=1e3,e.dollyToCursor=!1,e.mouseButtons.left=je.ROTATE,e.mouseButtons.middle=je.ZOOM,e.mouseButtons.right=je.TRUCK,e.mouseButtons.wheel=je.ZOOM,e.touches.one=je.TOUCH_ROTATE,e.touches.two=je.TOUCH_ZOOM_TRUCK,e.touches.three=je.TOUCH_TRUCK,this.scale=3,this.aspect=1,this.distance=50,this.dragging=!1,this.dragRotate=!1,this.applied=new z,this.userChanged=!1,this.userZoomed=!1,e.addEventListener("controlstart",()=>{this.dragging=!0,this.dragRotate=(e.currentAction&yy)!==0,e.smoothTime=Ti}),e.addEventListener("controlend",()=>{this.dragging=!1,this.dragRotate=!1}),e.addEventListener("control",()=>{this.userChanged=!0,(!this.dragging||(e.currentAction&(je.ZOOM|je.TOUCH_ZOOM|je.TOUCH_ZOOM_TRUCK))!==0)&&(this.userZoomed=!0)}),this.applyFrustum(),this.setAngles(ff("iso"),!1)}get dom(){return this.controls._domElement}setFrame(t,e){t>0&&(this.scale=t),e>0&&(this.aspect=e),this.applyFrustum()}applyFrustum(){let t=this.scale/2,e=t*this.aspect,n=this.camera;n.left=-e,n.right=e,n.top=t,n.bottom=-t,n.updateProjectionMatrix()}setDepth(t,e){this.distance=t,this.camera.near=.05,this.camera.far=e,this.camera.updateProjectionMatrix(),this.controls.dollyTo(t,!1)}get height(){return this.scale/this.camera.zoom}setAngles({azimuth:t,polar:e},n){let s=this.controls.getSpherical(Ai,!0),r=dh(t,s.theta);this.controls.smoothTime=Ti,this.controls.rotateTo(r,e,n)}setView(t,e){this.setAngles(ff(t),e)}get azimuth(){return this.controls.azimuthAngle}setAzimuthNow(t){let e=this.controls.getSpherical(Ai,!0);this.controls.rotateTo(dh(t,e.theta),e.phi,!1)}getTarget(t){return this.controls.getTarget(t,!1)}setTargetNow(t,e,n){this.applied.set(t,e,n),this.controls.moveTo(t,e,n,!1)}setTarget(t,e,n,s){this.applied.set(t,e,n),this.controls.smoothTime=Ti,this.controls.moveTo(t,e,n,s)}dragDelta(t){let e=this.controls.getTarget(hl,!0),n=e.x-this.applied.x,s=e.y-this.applied.y,r=e.z-this.applied.z;return n===0&&s===0&&r===0?!1:(this.camera.updateMatrix(),Zr.setFromMatrixColumn(this.camera.matrix,0),$r.setFromMatrixColumn(this.camera.matrix,1),t[0]=Zr.x*n+Zr.y*s+Zr.z*r,t[1]=$r.x*n+$r.y*s+$r.z*r,!0)}basis(t=!0){let e=this.controls.getSpherical(Ai,t);ul.setFromUnitVectors(fh,pf).invert();let n=hl.setFromSpherical(e).normalize().applyQuaternion(ul),s=vy.copy(n).negate(),r=Zr.crossVectors(s,fh);r.lengthSq()<1e-8&&r.set(1,0,0),r.normalize();let o=$r.crossVectors(r,s).normalize(),a=My;return a.rx=r.x,a.ry=r.y,a.rz=r.z,a.ux=o.x,a.uy=o.y,a.uz=o.z,a}fitRadius(t,e,n=1.15){let s=2*Math.max(t,.05)*n/Math.min(1,this.aspect);this.controls.smoothTime=Ti,this.controls.zoomTo(bi.clamp(this.scale/s,this.controls.minZoom,this.controls.maxZoom),e),this.userZoomed=!1}fitBox(t,e,n,s,r=1.04){let o=this.basis(!0),a=t*Math.abs(o.rx)+e*Math.abs(o.ry)+n*Math.abs(o.rz),l=t*Math.abs(o.ux)+e*Math.abs(o.uy)+n*Math.abs(o.uz),c=2*r*Math.max(l,a/this.aspect,.05);this.controls.smoothTime=Ti,this.controls.zoomTo(bi.clamp(this.scale/c,this.controls.minZoom,this.controls.maxZoom),s),this.userZoomed=!1}setZoomNow(t){this.controls.zoomTo(t,!1)}get targetHeight(){return this.scale/this.controls._zoomEnd}setHeight(t,e){this.controls.smoothTime=Ti,this.controls.zoomTo(bi.clamp(this.scale/t,this.controls.minZoom,this.controls.maxZoom),e),this.userZoomed=!1}update(t){return this.controls.update(t)}get rotateBusy(){return this.dragRotate}state(t){let e=this.controls.getSpherical(Ai,!0),n=this.controls.getTarget(hl,!0);return{v:1,azimuth:e.theta,polar:e.phi,zoom:this.controls._zoomEnd,scale:this.scale,target:[n.x,n.y,n.z],following:!!t}}apply(t,e,n){if(!t||t.v!==1)return;this.controls.smoothTime=Ti;let s=this.controls.getSpherical(Ai,!0),r=bi.clamp(t.polar,uf,df);this.controls.rotateTo(dh(t.azimuth,s.theta),r,e);let o=t.scale/t.zoom;this.controls.zoomTo(bi.clamp(this.scale/o,this.controls.minZoom,this.controls.maxZoom),e),n&&this.setTarget(t.target[0],t.target[1],t.target[2],e)}dispose(){this.controls.dispose()}};var fl=null,ph="#010203";function mf(i){let t=new Ut;if(typeof document<"u")try{fl??=document.createElement("canvas"),fl.width=fl.height=1;let e=fl.getContext("2d",{willReadFrequently:!0});if(e.clearRect(0,0,1,1),e.fillStyle=ph,e.fillStyle=i,e.fillStyle===ph&&String(i).trim().toLowerCase()!==ph)return null;e.fillRect(0,0,1,1);let[n,s,r]=e.getImageData(0,0,1,1).data;return t.setRGB(n/255,s/255,r/255,ge)}catch{}try{return t.setStyle(i,ge)}catch{return null}}function _f(i,t,e){let n=t*Math.cos(e*Math.PI/180),s=t*Math.sin(e*Math.PI/180),r=(i+.3963377774*n+.2158037573*s)**3,o=(i-.1055613458*n-.0638541728*s)**3,a=(i-.0894841775*n-1.291485548*s)**3;return[4.0767416621*r-3.3077115913*o+.2309699292*a,-1.2684380046*r+2.6097574011*o-.3413193965*a,-.0041960863*r-.7034186147*o+1.707614701*a].map(c=>{let u=Math.min(Math.max(c,0),1);return u<=.0031308?12.92*u:1.055*u**(1/2.4)-.055})}function Sy(i,t=0,e=0){let[n,s,r]=_f(i,t,e);return new Ut().setRGB(n,s,r,ge)}function xf(i,t=0,e=0){return"#"+_f(i,t,e).map(n=>Math.round(n*255).toString(16).padStart(2,"0")).join("")}var gf={light:{viewport:[.97,0,0],checker:[[.955,0,0],[.93,0,0]],grid:{base:[.955,0,0],line:[.86,0,0]},horizon:[.72,0,0],contact:[.578,.206,29],arrow:[.35,0,0],fg:[.145,0,0]},dark:{viewport:[.15,0,0],checker:[[.2,0,0],[.175,0,0]],grid:{base:[.2,0,0],line:[.29,0,0]},horizon:[.5,0,0],contact:[.626,.206,29],arrow:[.8,0,0],fg:[.985,0,0]}},Bn=i=>i==="dark"?gf.dark:gf.light,kn=i=>Sy(i[0],i[1],i[2]);var by="#8d99ae",pl=["#440154","#3b528b","#21918c","#5ec962","#fde725"].map(i=>new Ut().setStyle(i,ge));function wy(i,t){let e=Math.min(Math.max(i,0),1)*(pl.length-1),n=Math.min(Math.floor(e),pl.length-2);return t.copy(pl[n]).lerp(pl[n+1],e-n)}function yf(i,t){let e=new Ln(1,1,1),n=new di({roughness:.75,metalness:0}),s=new vn(e,n,i);s.instanceMatrix.setUsage(Si),s.instanceMatrix.array.fill(0),s.frustumCulled=!1;let r=new Ut().setStyle(by,ge);s.instanceColor=new Bi(new Float32Array(i*3),3);for(let p=0;p<i;p++)r.toArray(s.instanceColor.array,3*p);s.instanceColor.needsUpdate=!0;let o=s.instanceMatrix.array,[a,l,c]=t;function u(p,g,_){for(let m=0,d=0,M=0;m<i;m++,d+=7,M+=16){if(_[m]){o.fill(0,M,M+16);continue}let E=p[d+3],y=p[d+4],b=p[d+5],S=p[d+6],C=E*E,v=y*y,T=b*b,R=E*y,A=E*b,P=y*b,D=S*E,L=S*y,F=S*b;o[M]=(1-2*(v+T))*a,o[M+1]=2*(R+F)*a,o[M+2]=2*(A-L)*a,o[M+3]=0,o[M+4]=2*(R-F)*l,o[M+5]=(1-2*(C+T))*l,o[M+6]=2*(P+D)*l,o[M+7]=0,o[M+8]=2*(A+L)*c,o[M+9]=2*(P-D)*c,o[M+10]=(1-2*(C+v))*c,o[M+11]=0,o[M+12]=p[d]+g[3*m],o[M+13]=p[d+1]+g[3*m+1],o[M+14]=p[d+2]+g[3*m+2],o[M+15]=1}s.instanceMatrix.needsUpdate=!0}function f(p,g="high"){let _=new Ut,m=s.instanceColor.array;if(!p||p.length!==i)for(let d=0;d<i;d++)r.toArray(m,3*d);else{let d=1/0,M=-1/0;for(let y=0;y<i;y++){let b=p[y];Number.isFinite(b)&&(d=Math.min(d,b),M=Math.max(M,b))}let E=M>d?M-d:1;for(let y=0;y<i;y++){let b=p[y];Number.isFinite(b)?wy(g==="low"?1-(b-d)/E:(b-d)/E,_).toArray(m,3*y):r.toArray(m,3*y)}}s.instanceColor.needsUpdate=!0}function h(){e.dispose(),n.dispose(),s.dispose()}return{mesh:s,update:u,setColors:f,dispose:h}}function Ey(i,t,e,n){let s=i*i,r=t*t,o=e*e,a=i*t,l=i*e,c=t*e,u=n*i,f=n*t,h=n*e;return[1-2*(r+o),2*(a-h),2*(l+f),2*(a+h),1-2*(s+o),2*(c-u),2*(l-f),2*(c+u),1-2*(s+r)]}var zn=[0,0,0],Oe=[0,0,0];function vf(i,t,e,n,s=[0,0,0],r=[0,0,0]){let o=Ey(t[e+3],t[e+4],t[e+5],t[e+6]),a=i.axes;for(let l=0;l<3;l++){let c=t[e+l]+n[l]+o[3*l]*i.c[0]+o[3*l+1]*i.c[1]+o[3*l+2]*i.c[2],u=0;for(let f=0;f<3;f++){let h=o[3*l]*a[3*f]+o[3*l+1]*a[3*f+1]+o[3*l+2]*a[3*f+2];u+=Math.abs(h)*i.h[f]}s[l]=c-u,r[l]=c+u}return{lo:s,hi:r}}var Ty=1024;function Mf({poses:i,T:t,B:e,follow:n,origin:s,boxes:r}){let o=e*7,a=new Uint8Array(e);for(let L=1;L<t;L++){let F=L*o;for(let U=0;U<e;U++){if(a[U])continue;let O=F+7*U,q=7*U;if(Math.abs(i[O]-i[q])>1e-4||Math.abs(i[O+1]-i[q+1])>1e-4||Math.abs(i[O+2]-i[q+2])>1e-4){a[U]=1;continue}let H=i[O+3]*i[q+3]+i[O+4]*i[q+4]+i[O+5]*i[q+5]+i[O+6]*i[q+6];1-Math.abs(H)>1e-6&&(a[U]=1)}}let l=new Float32Array(t),c=new Float32Array(t),u=1/0,f=-1/0,h=1/0,p=-1/0,g=1/0,_=-1/0,m=0,d=0;for(let L=0;L<t;L++){let F=L*o+7*n,U=i[F]+s[0],O=i[F+1]+s[1],q=i[F+2]+s[2];l[L]=U,c[L]=O,q<u&&(u=q,m=L),q>f&&(f=q,d=L),U<h&&(h=U),U>p&&(p=U),O<g&&(g=O),O>_&&(_=O)}let M=r.filter(L=>L.body===n||a[L.body]),E=u,y=f,b=.05,S=Math.max(1,Math.floor(t/Ty)),C=L=>{let F=L*o+7*n,U=i[F]+s[0],O=i[F+1]+s[1];for(let q of M){let H=L*o+7*q.body;if(q.body!==n&&Math.hypot(i[H]-i[F],i[H+1]-i[F+1],i[H+2]-i[F+2])>1)continue;vf(q,i,H,s,zn,Oe),zn[2]<E&&(E=zn[2]),Oe[2]>y&&(y=Oe[2]);let j=Math.max(Math.abs(zn[0]-U),Math.abs(Oe[0]-U)),it=Math.max(Math.abs(zn[1]-O),Math.abs(Oe[1]-O)),X=Math.hypot(j,it);X>b&&(b=X)}};for(let L=0;L<t;L+=S)C(L);C(t-1),C(m),C(d),M.length||(E=u-.3,y=f+.3,b=.3);let v=1+b,T=[h-v,g-v],R=[p+v,_+v],A=[],P=-1/0,D=0;for(let L of r){if(a[L.body]||L.body===n)continue;if(++D>256)break;if(vf(L,i,7*L.body,s,zn,Oe),Oe[2]<.05||Oe[0]<T[0]||zn[0]>R[0]||Oe[1]<T[1]||zn[1]>R[1])continue;let F=Math.max(zn[0],T[0]),U=Math.min(Oe[0],R[0]),O=Math.max(zn[1],T[1]),q=Math.min(Oe[1],R[1]);A.push(F,O,Oe[2],U,O,Oe[2],F,q,Oe[2],U,q,Oe[2]),Oe[2]>P&&(P=Oe[2])}return{zlo:Math.min(0,E),zhi:Math.max(y,P),rz:[E,y],Rxy:b,xs:l,ys:c,corners:Float32Array.from(A),T:t}}function Sf(i,t,e,n,s,r,o=1.1){let a=Math.max(Math.abs(s*(i.rz[0]-t)),Math.abs(s*(i.rz[1]-t)))+i.Rxy*Math.hypot(e,n);a=Math.max(a,Math.abs(s*t));let l=i.corners;if(l.length){let f=1/0,h=-1/0;for(let p=0;p<i.T;p++){let g=e*i.xs[p]+n*i.ys[p];g<f&&(f=g),g>h&&(h=g)}for(let p=0;p<l.length;p+=3){let g=e*l[p]+n*l[p+1],_=s*(l[p+2]-t);a=Math.max(a,Math.abs(g-h+_),Math.abs(g-f+_))}}let c=2*a*o,u=2*i.Rxy*o/Math.max(r,.001);return Math.max(c,u,.1)}var bf=["torso","base","trunk","pelvis","chassis"];function wf(i){let t=i.map(n=>String(n).toLowerCase());for(let n of[!0,!1])for(let s of bf){let r=t.findIndex(o=>n?o===s:o.startsWith(s));if(r>=0)return r}let e=t.findIndex(n=>n!=="world");return e>=0?e:0}function Ws(i=0){return{x:i,v:0}}function Xs(i,t,e,n){if(!(n>0))return i.x;let r=2/Math.max(1e-4,e),o=r*n,a=1/(1+o+.48*o*o+.235*o*o*o),l=i.x-t,c=(i.v+r*l)*n;i.v=(i.v-r*c)*a;let u=t+(l+c)*a;return t-i.x>0==u>t&&(u=t,i.v=0),i.x=u,u}function Ay(i,t){let e=(t-i)%(2*Math.PI);return e>Math.PI?e-=2*Math.PI:e<=-Math.PI&&(e+=2*Math.PI),e}function Cy(i,t,e,n){return Xs(i,i.x+Ay(i.x,t),e,n)}function Ef(){return{x:Ws(),y:Ws(),z:Ws(),yaw:Ws(),primed:!1}}function mh(i,t,e,n,s=0){i.x.x=t,i.x.v=0,i.y.x=e,i.y.v=0,i.z.x=n,i.z.v=0,i.yaw.x=s,i.yaw.v=0,i.primed=!0}function Tf(i,t,e,n,s,r,o=.12,a=1/0){return!i.primed||Math.hypot(t-i.x.x,e-i.y.x,n-i.z.x)>a?(mh(i,t,e,n,s),!0):(Xs(i.x,t,o,r),Xs(i.y,e,o,r),Xs(i.z,n,o,r),Cy(i.yaw,s,o,r),!1)}var qs=new Map;function Ry(i){let t=new Ee;return t.setAttribute("position",new we(i.verts,3)),t.setAttribute("normal",new we(i.normals,3)),i.uvs&&t.setAttribute("uv",new we(i.uvs,2)),t.setIndex(new we(i.faces,1)),t}function Af(i,t){let e=qs.get(i);return e||(e={refs:0,geometry:null,promise:null},e.promise=t().then(n=>e.geometry=Ry(n),n=>{throw qs.get(i)===e&&qs.delete(i),n}),qs.set(i,e)),e.refs++,e.promise}function Cf(i){let t=qs.get(i);!t||--t.refs>0||(qs.delete(i),t.geometry?t.geometry.dispose():t.promise.then(e=>e.dispose(),()=>{}))}var ml=(i,t)=>i.copy(kn(t)),Rf=1,Py=`
uniform vec2 uCenter;
uniform float uHalf;
varying vec2 vWorld;
void main() {
  vec2 w = uCenter + position.xy * uHalf;
  vWorld = w;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(w, 0.0, 1.0);
}
`,Iy=`
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
`;function Pf(i="checker",t="light"){let e=new Xe({vertexShader:Py,fragmentShader:Iy,uniforms:{uCenter:{value:[0,0]},uHalf:{value:100},uTile:{value:Rf},uMode:{value:0},uA:{value:new Ut},uB:{value:new Ut},uLine:{value:new Ut}},transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:1,polygonOffsetUnits:1}),n=new ki(2,2),s=new De(n,e);s.frustumCulled=!1,s.renderOrder=-10;let r=new Ee;r.setAttribute("position",new pe([-1,0,-1,1,0,-1,1,0,1,-1,0,-1,1,0,1,-1,0,1,0,-1,-1,0,1,-1,0,1,1,0,-1,-1,0,1,1,0,-1,1],3));let o=new $n({transparent:!0,depthWrite:!1,side:hn}),a=new De(r,o);a.frustumCulled=!1,a.renderOrder=-9,a.visible=!1,s.add(a);let l=e.uniforms,c={style:i,theme:t,z:0};function u(){s.visible=c.style!=="none";let f=Bn(c.theme);o.color.copy(kn(f.horizon)),c.style==="grid"?(l.uMode.value=1,ml(l.uA.value,f.grid.base),ml(l.uLine.value,f.grid.line)):(l.uMode.value=0,ml(l.uA.value,f.checker[0]),ml(l.uB.value,f.checker[1]))}return u(),{mesh:s,get style(){return c.style},setStyle(f){c.style=f==="grid"||f==="none"?f:"checker",u()},setTheme(f){c.theme=f==="dark"?"dark":"light",u()},setPlane(f,h){c.z=f,s.position.z=f,l.uTile.value=h>0?h:Rf},update(f,h,p,g,_=1,m=0){let d=p*Math.max(1,g);l.uCenter.value[0]=f,l.uCenter.value[1]=h,l.uHalf.value=Math.max(40,d*3);let M=Math.min(Math.max((_-.02)/.16,0),1),E=1-M*M*(3-2*M);a.visible=E>.01,o.opacity=E,a.position.set(f,h,0),a.scale.set(l.uHalf.value,l.uHalf.value,Math.max(.75*m,1e-4))},dispose(){n.dispose(),e.dispose(),r.dispose(),o.dispose()}}}function gh(i,t,e,n,s,r,o,a){if(o<=1e-4){for(let c=0,u=7*a;c<u;c++)i[t+c]=e[n+c];return}if(o>=1-1e-4){for(let c=0,u=7*a;c<u;c++)i[t+c]=s[r+c];return}let l=1-o;for(let c=0;c<a;c++,t+=7,n+=7,r+=7){i[t]=e[n]*l+s[r]*o,i[t+1]=e[n+1]*l+s[r+1]*o,i[t+2]=e[n+2]*l+s[r+2]*o;let u=e[n+3],f=e[n+4],h=e[n+5],p=e[n+6],g=s[r+3],_=s[r+4],m=s[r+5],d=s[r+6];u*g+f*_+h*m+p*d<0&&(g=-g,_=-_,m=-m,d=-d);let M=u*l+g*o,E=f*l+_*o,y=h*l+m*o,b=p*l+d*o,S=Math.hypot(M,E,y,b);S>1e-12?(i[t+3]=M/S,i[t+4]=E/S,i[t+5]=y/S,i[t+6]=b/S):(i[t+3]=u,i[t+4]=f,i[t+5]=h,i[t+6]=p)}}function If(i,t,e,n){let s=i/t+1e-6,r=Math.floor(s);r<0&&(r=0);let o=e-1;return r>=o?(n.f0=n.f1=Math.max(o,0),n.t=0,n):(n.f0=r,n.f1=r+1,n.t=Math.min(Math.max(s-1e-6-r,0),1),n)}function Lf(i,t){let e=i[t+3],n=i[t+4],s=i[t+5],r=i[t+6];return Math.atan2(2*(r*s+e*n),1-2*(n*n+s*s))}var Ly=.013,Uy=.034,Dy=.07,Oy=.022,Ny=1.7,Fy=3,gl=(i,t)=>kn(t?Bn(i).contact:Bn(i).arrow);function Uf(i,t,e,n,s={}){let r=Math.max(e,.3)/Ny,o=Fy*e,a=Math.max(i*t,1),l=new $n({color:gl("light",s.points)}),c=new ui(1,1,1,10).rotateX(Math.PI/2).translate(0,0,.5),u=new Er(1,1,14).rotateX(Math.PI/2).translate(0,0,.5),f=new vn(c,l,a),h=new vn(u,l,a),p=new ln,g=[f,h],_=null,m=null,d=null;s.points&&(_=new zi(1,10,8),m=new vn(_,l,a),d=m.instanceMatrix.array,g.push(m));for(let R of g)R.instanceMatrix.array.fill(0),R.instanceMatrix.setUsage(Si),R.frustumCulled=!1,p.add(R);let M=f.instanceMatrix.array,E=h.instanceMatrix.array;function y(R,A,P,D,L,F,U,O,q,H){let j=0,it=0,X=1;Math.abs(L)>.9&&(j=1,X=0);let nt=it*L-X*D,lt=X*P-j*L,ct=j*D-it*P,bt=Math.hypot(nt,lt,ct)||1;nt/=bt,lt/=bt,ct/=bt;let Y=D*ct-L*lt,J=L*nt-P*ct,ot=P*lt-D*nt;R[A]=nt*F,R[A+1]=lt*F,R[A+2]=ct*F,R[A+3]=0,R[A+4]=Y*F,R[A+5]=J*F,R[A+6]=ot*F,R[A+7]=0,R[A+8]=P*U,R[A+9]=D*U,R[A+10]=L*U,R[A+11]=0,R[A+12]=O,R[A+13]=q,R[A+14]=H,R[A+15]=1}function b(R,A,P,D,L,F){for(let U=0,O=R*t;U<t;U++,P+=6,O++){let q=A[P+3],H=A[P+4],j=A[P+5],it=Math.hypot(q,H,j),X=O*16,nt=Math.min(it*n,o);if(!(nt>1e-6)){M.fill(0,X,X+16),E.fill(0,X,X+16),d&&d.fill(0,X,X+16);continue}let lt=q/it,ct=H/it,bt=j/it,Y=A[P]+D,J=A[P+1]+L,ot=A[P+2]+F,wt=Math.min(Dy*r,.4*nt),_t=nt-wt;if(y(M,X,lt,ct,bt,Ly*r,_t,Y,J,ot),y(E,X,lt,ct,bt,Uy*r,wt,Y+lt*_t,J+ct*_t,ot+bt*_t),d){let zt=Oy*r;d.fill(0,X,X+16),d[X]=d[X+5]=d[X+10]=zt,d[X+12]=Y,d[X+13]=J,d[X+14]=ot,d[X+15]=1}}}function S(R){let A=R*t*16,P=A+t*16;M.fill(0,A,P),E.fill(0,A,P),d&&d.fill(0,A,P)}function C(){for(let R of g)R.instanceMatrix.needsUpdate=!0}function v(){c.dispose(),u.dispose(),_&&_.dispose(),l.dispose();for(let R of g)R.dispose()}function T(R){l.color.copy(gl(R,s.points))}return{root:p,update:b,clear:S,commit:C,dispose:v,setTheme:T}}function Df(i,t){let e=new As({color:gl("light",!1)}),n=Math.max(t-1,0),s=new Ee,r=new we(new Float32Array(Math.max(i*n*6,6)),3);r.setUsage(Si),s.setAttribute("position",r);let o=new Mr(s,e);o.frustumCulled=!1;let a=new ln;a.add(o);let l=r.array;function c(g,_,m,d,M,E){let y=g*n*6;for(let b=0;b<n;b++,y+=6,m+=3)l[y]=_[m]+d,l[y+1]=_[m+1]+M,l[y+2]=_[m+2]+E,l[y+3]=_[m+3]+d,l[y+4]=_[m+4]+M,l[y+5]=_[m+5]+E}function u(g){l.fill(0,g*n*6,(g+1)*n*6)}function f(){r.needsUpdate=!0}function h(){s.dispose(),e.dispose()}function p(g){e.color.copy(gl(g,!1))}return{root:a,update:c,clear:u,commit:f,dispose:h,setTheme:p}}function By(i,t,e,n,s,r,o,a,l,c){let u=o-i,f=a-t,h=l-e,p=u*n+f*s+h*r,g=u*u+f*f+h*h-p*p,_=c*c;if(g>_)return null;let m=Math.sqrt(_-g),d=p-m;return d>=0?d:p+m>=0?p+m:null}function Of(i,t,e,n){let s=null,r=1/0,o=typeof n!="number";for(let a=0;a<e;a++){let l=By(i[0],i[1],i[2],i[3],i[4],i[5],t[3*a],t[3*a+1],t[3*a+2],o?n[a]:n);l!==null&&l<r&&(r=l,s=a)}return s}var Kr=null,Nf=i=>[Math.max(1,Math.round(i.cssWidth*i.dpr)),Math.max(1,Math.round(i.cssHeight*i.dpr))],_h=class{constructor(){this.renderer=new Fs({antialias:!0,alpha:!0}),this.renderer.setPixelRatio(1),this.renderer.setScissorTest(!0),this.canvas=this.renderer.domElement,this.width=0,this.height=0,this.players=new Set,this.lost=!1,this.onLost=t=>{t.preventDefault(),this.lost=!0},this.onRestored=()=>{this.lost=!1;for(let t of this.players)t.invalidate();ii()},this.canvas.addEventListener("webglcontextlost",this.onLost),this.canvas.addEventListener("webglcontextrestored",this.onRestored)}attach(t){this.players.add(t)}detach(t){this.players.delete(t),this.players.size===0&&this.destroy()}draw(t){if(this.lost)return;let[e,n]=Nf(t),s=t.canvas;(s.width!==e||s.height!==n)&&(s.width=e,s.height=n),(e>this.width||n>this.height)&&(this.width=Math.max(this.width,e),this.height=Math.max(this.height,n),this.renderer.setSize(this.width,this.height,!1));let r=this.renderer;r.setViewport(0,0,e,n),r.setScissor(0,0,e,n),r.setClearColor(0,t.transparent?0:1),r.render(t.scene,t.camera);let o=s.getContext("2d");o.clearRect(0,0,e,n),o.drawImage(this.canvas,0,this.height-n,e,n,0,0,e,n),t.dirty=!1}get info(){return this.renderer.info}destroy(){this.canvas.removeEventListener("webglcontextlost",this.onLost),this.canvas.removeEventListener("webglcontextrestored",this.onRestored),this.renderer.dispose(),this.renderer.forceContextLoss(),Kr===this&&(Kr=null)}},xh=class{constructor(t){this.renderer=new Fs({canvas:t,antialias:!0,alpha:!0}),this.renderer.setPixelRatio(1),this.canvas=t,this.player=null,this.lost=!1,this.onLost=e=>{e.preventDefault(),this.lost=!0},this.onRestored=()=>{this.lost=!1,this.player&&this.player.invalidate(),ii()},t.addEventListener("webglcontextlost",this.onLost),t.addEventListener("webglcontextrestored",this.onRestored)}attach(t){this.player=t}detach(){this.player=null,this.canvas.removeEventListener("webglcontextlost",this.onLost),this.canvas.removeEventListener("webglcontextrestored",this.onRestored),this.renderer.dispose()}draw(t){if(this.lost)return;let[e,n]=Nf(t),s=this.renderer.getSize(ky),r=this.renderer.getPixelRatio();(s.x!==e||s.y!==n||r!==1)&&this.renderer.setSize(e,n,!1),this.renderer.setClearColor(0,t.transparent?0:1),this.renderer.render(t.scene,t.camera),t.dirty=!1}get info(){return this.renderer.info}},ky=new Ht,yh=class{constructor(){this.canvas=document.createElement("canvas"),this.renderer=new Fs({canvas:this.canvas,antialias:!0,alpha:!0,preserveDrawingBuffer:!0}),this.renderer.setPixelRatio(1);let t=this.renderer.getContext();this.maxSize=Math.min(t.getParameter(t.MAX_RENDERBUFFER_SIZE),t.getParameter(t.MAX_TEXTURE_SIZE),t.getParameter(t.MAX_VIEWPORT_DIMS)[0]),this.copy=null}draw(t,e,n){return this.renderer.setSize(e,n,!1),this.renderer.setClearColor(0,t.transparent?0:1),this.renderer.render(t.scene,t.camera),this.canvas}pixels(t,e,n){let s=this.draw(t,e,n);this.copy||(this.copy=this.canvas.ownerDocument.createElement("canvas").getContext("2d",{willReadFrequently:!0}));let r=this.copy;return(r.canvas.width!==e||r.canvas.height!==n)&&(r.canvas.width=e,r.canvas.height=n),r.clearRect(0,0,e,n),r.drawImage(s,0,0),r.getImageData(0,0,e,n).data}blob(t,e,n,s){let r=this.draw(t,e,n);return new Promise((o,a)=>r.toBlob(l=>l?o(l):a(new Error("simscope: snapshot failed")),s))}dispose(){this.renderer.dispose(),this.renderer.forceContextLoss()}};function Ff(){return new yh}function Bf(){return Kr||(Kr=new _h),Kr}function kf(i){return new xh(i)}function vh(i){return i>64}function zf(i,t,e=5e6){if(!vh(i))return i;let n=Math.floor(e/Math.max(t,1));return Math.min(Math.max(n,1),64,i)}function Vf({nEnvs:i,selected:t,pinned:e=[],origins:n,capacity:s}){let r=Math.max(1,Math.min(s,i)),o=[],a=new Set,l=_=>{o.length<r&&_>=0&&_<i&&Number.isInteger(_)&&!a.has(_)&&(a.add(_),o.push(_))};l(t);let c=e.filter(_=>Number.isInteger(_)&&_>=0&&_<i&&_!==t);for(let _ of[...new Set(c)].slice(0,4))l(_);if(o.length>=r)return o;let u=n?n[3*t]:0,f=n?n[3*t+1]:0,h=n?n[3*t+2]:0,p=new Float64Array(i),g=new Int32Array(i);for(let _=0;_<i;_++)g[_]=_,p[_]=n?(n[3*_]-u)**2+(n[3*_+1]-f)**2+(n[3*_+2]-h)**2:Math.abs(_-t);g.sort((_,m)=>p[_]-p[m]||_-m);for(let _=0;_<i&&o.length<r;_++)l(g[_]);return o}var ye=class extends Error{constructor(t,e){super(t),this.name="SourceError",this.status=e}},_l=64,zy=32;function Vy(i){let{itemShape:t,itemK:e,nEnvs:n,nFrames:s,blockFrames:r,blocks:o}=i;return{itemShape:t,itemK:e,nEnvs:n,nFrames:s,blockFrames:r,blocks:o}}function Hy(i){if(i.length<_l||String.fromCharCode(i[0],i[1],i[2],i[3])!=="SSBK")throw new ye("simscope: /api/blk did not return a block file header",500);let t=new DataView(i.buffer,i.byteOffset,i.byteLength),e=t.getUint16(4,!0);if(e!==1)throw new ye(`simscope: unsupported block file major version ${e}`,500);let n=t.getUint32(12,!0),s=[],r=1;for(let g=0;g<Math.min(n,4);g++)s.push(t.getUint32(16+4*g,!0)),r*=s[g];let o=t.getUint32(32,!0),a=t.getUint32(36,!0),l=t.getUint32(40,!0),c=t.getUint32(44,!0),u=Number(t.getBigUint64(48,!0)),f=t.getUint32(56,!0),h=_l;u>=_l&&u+f<=i.length&&f===32*c?h=u:c=Math.floor((i.length-_l)/32);let p=new Array(c);for(let g=0;g<c;g++){let _=h+32*g;p[g]={offset:Number(t.getBigUint64(_,!0)),env:t.getUint32(_+8,!0),t0:t.getUint32(_+12,!0),n:t.getUint32(_+16,!0),clen:t.getUint32(_+20,!0),ulen:t.getUint32(_+24,!0),codec:i[_+28]}}if(a===0)for(let g of p)a=Math.max(a,g.t0+g.n);return{itemShape:s,itemK:r,nEnvs:o,nFrames:a,blockFrames:l,blocks:p}}function Gy(i){let t=[];for(let e of i.blocks){let n=Math.floor(e.t0/i.blockFrames);(t[n]||(t[n]=new Array(i.nEnvs)))[e.env]=e}return t}var $i=class i{constructor(t){let e=t instanceof Uint8Array?t:new Uint8Array(t);this.pack=no(e),this._index=new Map}static async open(t){let e=t instanceof Uint8Array?t:new Uint8Array(t);return new i(await io(e))}has(t){return this.pack.entries.has(t)}async get(t){let e=this.pack.entries.get(t);if(!e)throw new ye(`simscope: entry missing from pack: ${t}`,404);return e}_blk(t){let e=this._index.get(t);if(!e){let n=this.pack.entries.get(t);if(!n)throw new ye(`simscope: stream missing from pack: ${t}`,404);let s=Ll(n);e={blk:s,windows:Ul(s)},this._index.set(t,e)}return e}async blockIndex(t){return Vy(this._blk(t).blk)}async blocks(t,e,n){let{blk:s,windows:r}=this._blk(t),o=r[e];return n.map(a=>{let l=o&&o[a];if(!l)throw new ye(`simscope: ${t} has no block for window ${e}, env ${a}`,404);return s.bytes.slice(l.offset,l.offset+zy+l.clen)})}async runs(){let t=new Set;for(let e of this.pack.entries.keys()){let n=/^runs\/([^/]+)\/rollout\.json$/.exec(e);n&&t.add(n[1])}return[...t]}},Hf=256,Wy=6e4,Xy=i=>new Promise(t=>setTimeout(t,i)),qy=i=>i.startsWith("scenes/")||i.startsWith("assets/"),xl=class{constructor(t=""){this.base=t.replace(/\/+$/,""),this._files=new Map,this._index=new Map}async _fetch(t,e){let n=Date.now(),s=250;for(;;){let r;try{r=await fetch(t)}catch(o){throw new ye(`simscope: could not fetch ${e} (${o.message})`,0)}if(r.status===202){if(Date.now()-n>Wy)throw new ye(`simscope: ${e} is still being computed`,202);let o=Number(r.headers.get("Retry-After"));await Xy(Math.max(s,Number.isFinite(o)?o*1e3:0)),s=Math.min(s*1.5,2e3);continue}if(r.status===404)throw new ye(`simscope: ${e} not found`,404);if(!r.ok)throw new ye(`simscope: fetching ${e} failed with HTTP ${r.status}`,r.status);return r}}get(t){let e=async()=>new Uint8Array(await(await this._fetch(`${this.base}/files/${t}`,t)).arrayBuffer());if(!qy(t))return e();let n=this._files.get(t);return n||(n=e(),this._files.set(t,n),n.catch(()=>this._files.delete(t))),n}async blockIndex(t,e={}){let n=e.refresh?null:this._index.get(t);return n||(n=(async()=>{let s=await this._fetch(`${this.base}/api/blk?path=${encodeURIComponent(t)}`,t),r=Hy(new Uint8Array(await s.arrayBuffer()));return{index:r,windows:Gy(r)}})(),this._index.set(t,n),n.catch(()=>this._index.delete(t))),(await n).index}async blocks(t,e,n){let s=new Array(n.length),r=[];for(let o=0;o<n.length;o+=Hf){let a=n.slice(o,o+Hf);r.push((async()=>{let l=`${this.base}/api/blocks?path=${encodeURIComponent(t)}&w=${e}&envs=${a.join(",")}`,c=await this._fetch(l,`${t} window ${e}`),u=(c.headers.get("X-Simscope-Block-Lengths")||"").split(",").map(Number);if(u.length!==a.length)throw new ye(`simscope: /api/blocks returned ${u.length} block lengths for ${a.length} envs`,500);let f=new Uint8Array(await c.arrayBuffer()),h=0;u.forEach((p,g)=>{s[o+g]=f.slice(h,h+p),h+=p})})())}return await Promise.all(r),s}async runs(){return((await(await this._fetch(`${this.base}/api/runs`,"the run list")).json()).runs||[]).map(n=>n.name)}};var Mh="body_pose",Sh="contacts";function yl(i){throw new Error(`simscope: ${i}`)}async function Gf(i,t){if(t)return t;let e=await i.runs();return e.length||yl("pack contains no runs"),e[0]}async function bh(i,t){let e;try{e=await i.get(`runs/${t}/rollout.json`)}catch(r){if(!(r instanceof ye)||r.status!==404)throw r;let o=await i.runs().catch(()=>[]),a=o.length>0&&o.length<=20?` (have: ${o.join(", ")})`:"";return yl(`run "${t}" not found${a}`)}let n=Ii(e,"rollout.json");return tr(n,"simscope-rollout","rollout.json"),(!(n.n_envs>=1)||!(n.n_frames>=0)||!(n.dt>0))&&yl("manifest needs n_envs >= 1, n_frames >= 0, dt > 0"),n}async function Wf(i,t,e){let n=new Map,s=Object.entries(e.streams||{}),r=await Promise.all(s.map(async([o,a])=>{let l=`runs/${t}/${a.file}`;try{return await i.blockIndex(l)}catch(c){if(c instanceof ye&&c.status===404&&o!==Mh)return null;throw c}}));return s.forEach(([o,a],l)=>{let c=r[l];if(!c)return;c.nEnvs!==e.n_envs&&yl(`stream ${a.file}: ${c.nEnvs} envs, manifest says ${e.n_envs}`);let u=rl(l+1,`runs/${t}/${a.file}`,c,a.kind==="pose");Object.assign(u,{name:o,kind:a.kind,shape:c.itemShape,info:a}),n.set(o,u)}),n}async function Xf(i,t){let e;try{e=await i.get(`runs/${t}/annotations.json`)}catch(s){if(s instanceof ye&&s.status===404)return[];throw s}let n=Ii(e,"annotations.json");return(Array.isArray(n.events)?n.events:[]).filter(s=>Number.isFinite(s.t0)).map(s=>({t0:s.t0,t1:Number.isFinite(s.t1)?s.t1:s.t0,label:String(s.label??"")}))}async function qf(i,t){try{return Ii(await i.get(t),t)}catch(e){if(e instanceof ye&&(e.status===404||e.status===202))return null;throw e}}function wh(i,t){let e=i.n_frames;for(let n of t)e=Math.min(e,n.nFrames);return e}function Ys(i){throw new Error(`simscope: ${i}`)}function vl(i,t,e){let n=`${t.id}:${e}:${t.nFrames}`,s=i.seriesCache.get(n);return s||(s=(async()=>{let r=t.itemK,o=t.blockFrames,a=new Float32Array(t.nFrames*r);for(let l=0;l<t.nWindows;l++){await i.store.request(t,l,[e]);let c=i.store.get(t,l,e);c&&a.set(c.subarray(0,Math.min(c.length,a.length-l*o*r)),l*o*r)}return a})(),i.seriesCache.set(n,s),s.catch(()=>i.seriesCache.delete(n))),s}async function Zf(i,t,e,n=0){let s=i.streams.get(t);s||Ys(`series(): run has no stream "${t}"`),e>=0&&e<i.nEnvs||Ys(`series(): env ${e} out of range`),n>=0&&n<s.itemK||Ys(`series(): component ${n} out of range (stream has ${s.itemK})`);let r=await vl(i,s,e),o=s.itemK,a=s.nFrames,l=new Float32Array(a);for(let c=0,u=n;c<a;c++,u+=o)l[c]=r[u];return l}async function $f(i,t,e,n){t!=="height"&&t!=="speed"&&Ys(`bodySeries(): unknown kind "${t}"`),n>=0&&n<i.B||Ys(`bodySeries(): body ${n} out of range`),e>=0&&e<i.nEnvs||Ys(`bodySeries(): env ${e} out of range`);let s=await vl(i,i.pose,e),r=i.K,o=i.pose.nFrames,a=i.dt,l=n*7,c=new Float32Array(o);if(t==="height"){let u=i.origins[3*e+2];for(let f=0;f<o;f++)c[f]=s[f*r+l+2]+u;return c}for(let u=0;u<o;u++){let f=Math.max(u-1,0),h=Math.min(u+1,o-1),p=(h-f)*a;c[u]=p>0?Math.hypot(s[h*r+l]-s[f*r+l],s[h*r+l+1]-s[f*r+l+1],s[h*r+l+2]-s[f*r+l+2])/p:0}return c}function Ml(i,t){let e=i.derived.get(t);return e||(e=qf(i.source,`derived/${i.run}/${t}`),i.derived.set(t,e),e.catch(()=>i.derived.delete(t))),e}function Yy(i){if(!i||!Array.isArray(i.highlights))return i;let t=new Map;for(let r of i.signals||[])t.set(r.key,r.label);for(let r of i.kinds||[])t.set(r.key,r.label);let e=i.highlights.map(r=>{let o=r.kind??r.signal;return{t1:null,frame1:null,ratio:null,body:null,also:[],detail:"",...r,kind:o,label:r.label??t.get(o)??o,signal:o}}),n=i.kinds||(i.signals||[]).map(r=>({key:r.key,label:r.label})),s=i.signals||n.map(r=>({key:r.key,label:r.label,unit:""}));return{...i,kinds:n,signals:s,highlights:e}}function Kf(i){let t="highlights.json#2",e=i.derived.get(t);return e||(e=Ml(i,"highlights.json").then(Yy),i.derived.set(t,e),e.catch(()=>i.derived.delete(t))),e}async function Jf(i,t,e=0){let n=await Ml(i,`envelopes/${t}.json`);return!n||!Array.isArray(n.p50)||!n.p50[e]?null:{dt:n.dt,t0:n.t0??0,components:n.components??n.p50.length,component:e,p5:Float32Array.from(n.p5[e]),p50:Float32Array.from(n.p50[e]),p95:Float32Array.from(n.p95[e])}}var Ki=class{constructor(t){this.w=-1,this.epoch=-1,this.ver=-1,this.arrs=new Array(t).fill(null),this.complete=!1}refresh(t,e,n,s,r){if(this.w===n&&this.epoch===t.epoch&&this.ver===r)return;(this.w!==n||this.ver!==r)&&this.arrs.fill(null);let o=!0;for(let a=0;a<s.length;a++){let l=t.get(e,n,s[a])||null;this.arrs[s[a]]=l,l||(o=!1)}this.w=n,this.epoch=t.epoch,this.ver=r,this.complete=o}};function $y(i,t){let e=i.size,n=i.scale||[1,1,1],s=(r,o,a)=>[r*n[0],o*n[1],a*n[2]];switch(i.kind){case"box":return{key:"box",make:()=>new Ln(1,1,1),scale:s(2*e[0],2*e[1],2*e[2])};case"sphere":return{key:"sphere",make:jf,scale:s(e[0],e[0],e[0])};case"ellipsoid":return{key:"sphere",make:jf,scale:s(e[0],e[1],e[2])};case"cylinder":return{key:"cylinder",make:Ky,scale:s(e[0],e[0],e[1])};case"capsule":return{key:`capsule:${e[0]}:${e[1]}`,make:()=>new wr(e[0],2*e[1],8,16).rotateX(Math.PI/2),scale:n.slice()};case"mesh":return i.mesh===null||i.mesh===void 0||!t[i.mesh]?null:{key:`mesh:${i.mesh}`,mesh:i.mesh,scale:n.slice()};default:return null}}function jf(){return new zi(1,24,16)}function Ky(){return new ui(1,1,2,24).rotateX(Math.PI/2)}var Jy=i=>(i.index?i.index.count:i.getAttribute("position").count)/3;function jy(i,t,e){let n=[0,0,0],s;switch(i.kind){case"box":s=[t[0]/2,t[1]/2,t[2]/2];break;case"capsule":{let b=i.size,S=i.scale||[1,1,1];s=[b[0]*S[0],b[0]*S[1],(b[1]+b[0])*S[2]];break}case"mesh":{e.computeBoundingBox();let{min:b,max:S}=e.boundingBox;n=[(b.x+S.x)/2*t[0],(b.y+S.y)/2*t[1],(b.z+S.z)/2*t[2]],s=[(S.x-b.x)/2*Math.abs(t[0]),(S.y-b.y)/2*Math.abs(t[1]),(S.z-b.z)/2*Math.abs(t[2])];break}default:s=[Math.abs(t[0]),Math.abs(t[1]),Math.abs(t[2])]}let[r,o,a,l]=i.quat||[0,0,0,1],c=r*r,u=o*o,f=a*a,h=r*o,p=r*a,g=o*a,_=l*r,m=l*o,d=l*a,M=[1-2*(u+f),2*(h+d),2*(p-m),2*(h-d),1-2*(c+f),2*(g+_),2*(p+m),2*(g-_),1-2*(c+u)],E=i.pos||[0,0,0],y=[0,1,2].map(b=>E[b]+M[b]*n[0]+M[3+b]*n[1]+M[6+b]*n[2]);return{body:i.body,c:y,axes:M,h:s}}function Qy(i,t,e,n,s,r){let o=e[n],a=e[n+1],l=e[n+2],c=e[n+3],u=e[n+4],f=e[n+5],h=e[n+6],p=e[n+7],g=e[n+8];for(let M=0;M<3;M++){let E=s[r+3*M],y=s[r+3*M+1],b=s[r+3*M+2];i[t+4*M]=o*E+c*y+h*b,i[t+4*M+1]=a*E+u*y+p*b,i[t+4*M+2]=l*E+f*y+g*b,i[t+4*M+3]=0}let _=s[r+9],m=s[r+10],d=s[r+11];i[t+12]=o*_+c*m+h*d+e[n+9],i[t+13]=a*_+u*m+p*d+e[n+10],i[t+14]=l*_+f*m+g*d+e[n+11],i[t+15]=1}function tv(i,t,e,n,s){let[r,o,a,l]=n,c=r*r,u=o*o,f=a*a,h=r*o,p=r*a,g=o*a,_=l*r,m=l*o,d=l*a,M=[1-2*(u+f),2*(h+d),2*(p-m),2*(h-d),1-2*(c+f),2*(g+_),2*(p+m),2*(g-_),1-2*(c+u)];for(let E=0;E<3;E++)for(let y=0;y<3;y++)i[t+3*E+y]=M[3*E+y]*s[E];i[t+9]=e[0],i[t+10]=e[1],i[t+11]=e[2]}function ev(i,t,e,n,s,r,o){let a=e[n+3],l=e[n+4],c=e[n+5],u=e[n+6],f=a*a,h=l*l,p=c*c,g=a*l,_=a*c,m=l*c,d=u*a,M=u*l,E=u*c;i[t]=1-2*(h+p),i[t+1]=2*(g+E),i[t+2]=2*(_-M),i[t+3]=2*(g-E),i[t+4]=1-2*(f+p),i[t+5]=2*(m+d),i[t+6]=2*(_+M),i[t+7]=2*(m-d),i[t+8]=1-2*(f+h),i[t+9]=e[n]+s,i[t+10]=e[n+1]+r,i[t+11]=e[n+2]+o}async function Qf(i,t,e){let n=i.bodies||[],s=i.geoms||[],r=i.materials||[],o=i.meshes||[],a=n.length,l=e,c=new Map,u=[],f=new Uint8Array(a),h=new Set,p=new Set;for(let X=0;X<s.length;X++){let nt=s[X];if(!(nt.body>=0&&nt.body<a))throw new Error(`simscope: geom ${X} references missing body ${nt.body}`);let lt=nt.role==="collision";if(nt.kind==="plane"){lt||u.push({z:(nt.pos||[0,0,0])[2],tile:nt.size[2],body:nt.body});continue}let ct=$y(nt,o);if(!ct){console.warn(`simscope: skipping geom ${X} (unsupported kind "${nt.kind}" or missing mesh)`);continue}let bt=lt?-1:nt.material,Y=`${lt?"c":"v"}|${ct.key}|${bt}`,J=c.get(Y);if(J||c.set(Y,J={collision:lt,shape:ct,matIdx:bt,geoms:[],scales:[]}),J.geoms.push(nt),J.scales.push(ct.scale),ct.mesh!==void 0&&h.add(ct.mesh),!lt){f[nt.body]=1;let ot=r[nt.material];ot&&ot.texture!==null&&ot.texture!==void 0&&p.add(ot.texture)}}let g=new Map,_=new Map;await Promise.all([...[...h].map(async X=>g.set(X,await t.mesh(X))),...[...p].map(async X=>_.set(X,await t.texture(X)))]);let m=new ln,d=[],M=new Map,E=new Map,y=[],b=X=>{let nt=M.get(X.key);return nt||(X.mesh!==void 0?nt=g.get(X.mesh):(nt=X.make(),d.push(nt)),M.set(X.key,nt)),nt},S=X=>{let nt=E.get(X.matIdx);if(nt)return nt;let lt;if(X.collision)lt=new di({color:kn(Bn("light").fg),opacity:.35,transparent:!0,roughness:.8}),y.push(lt);else{let ct=r[X.matIdx]||{rgba:[.7,.7,.7,1]},bt=ct.rgba||[.7,.7,.7,1],Y=Math.min(Math.max(bt[3],.05),1),J={color:new Ut().setRGB(bt[0],bt[1],bt[2],ge),opacity:Y,transparent:Y<1,metalness:ct.metallic??0,roughness:ct.roughness??.7},ot=ct.texture!==null&&ct.texture!==void 0?_.get(ct.texture):null;if(ot){let wt=new ze(ot);wt.colorSpace=ge,wt.wrapS=wt.wrapT=xs;let _t=ct.texrepeat||[1,1];wt.repeat.set(_t[0],_t[1]),wt.needsUpdate=!0,d.push(wt),J.map=wt}lt=new di(J)}return E.set(X.matIdx,lt),d.push(lt),lt},C=new Float32Array(a),v=(X,nt)=>{let lt=Math.max(...X.scale||[1,1,1]),ct=X.size;switch(X.kind){case"box":return Math.hypot(ct[0],ct[1],ct[2])*lt;case"sphere":return ct[0]*lt;case"ellipsoid":return Math.max(ct[0],ct[1],ct[2])*lt;case"capsule":return(ct[0]+ct[1])*lt;case"cylinder":return Math.hypot(ct[0],ct[1])*lt;case"mesh":{let bt=g.get(nt.mesh);bt.computeBoundingSphere();let Y=bt.boundingSphere.center;return(Math.hypot(Y.x,Y.y,Y.z)+bt.boundingSphere.radius)*lt}default:return 0}};for(let X of c.values())if(!X.collision)for(let nt of X.geoms){let lt=nt.pos||[0,0,0];C[nt.body]=Math.max(C[nt.body],Math.hypot(lt[0],lt[1],lt[2])+v(nt,X.shape))}let T=[];for(let X of c.values()){if(X.collision)continue;let nt=X.shape.mesh!==void 0?g.get(X.shape.mesh):null;X.geoms.forEach((lt,ct)=>T.push(jy(lt,X.scales[ct],nt)))}let R=[],A=0;for(let X of c.values()){let nt=X.geoms,lt=nt.length,ct=b(X.shape);X.collision||(A+=lt*Jy(ct));let bt=new vn(ct,S(X),l*lt);bt.instanceMatrix.array.fill(0),bt.instanceMatrix.setUsage(Si),bt.frustumCulled=!1,bt.visible=!X.collision;let Y=new Int32Array(lt),J=new Float32Array(12*lt);nt.forEach((ot,wt)=>{Y[wt]=ot.body,tv(J,12*wt,ot.pos||[0,0,0],ot.quat||[0,0,0,1],X.scales[wt])}),m.add(bt),R.push({mesh:bt,n:lt,body:Y,local:J,collision:X.collision})}let P=new Float32Array(Math.max(l,1)*a*12),D=new Float32Array(l*a*7),L=new Float32Array(l*3),F=new Uint8Array(l),U=new Uint8Array(l);function O(){for(let X=0,nt=0,lt=0;X<l;X++,nt+=12*a,lt+=7*a){if(!F[X])continue;let ct=L[3*X],bt=L[3*X+1],Y=L[3*X+2];for(let J=0,ot=lt,wt=nt;J<a;J++,ot+=7,wt+=12)ev(P,wt,D,ot,ct,bt,Y)}for(let X of R){let nt=X.mesh.instanceMatrix.array;for(let lt=0;lt<l;lt++){let ct=lt*X.n*16;if(!F[lt]){U[lt]&&nt.fill(0,ct,ct+X.n*16);continue}let bt=lt*a*12;for(let Y=0,J=ct;Y<X.n;Y++,J+=16)Qy(nt,J,P,bt+12*X.body[Y],X.local,12*Y)}X.mesh.instanceMatrix.needsUpdate=!0}U.set(F)}function q(X){for(let nt of R)nt.mesh.count=Math.min(Math.max(X,0),l)*nt.n}function H(X,nt){for(let lt of R)lt.mesh.visible=lt.collision?nt:X}function j(X){for(let nt of y)nt.color.copy(kn(Bn(X).fg))}function it(){for(let X of d)X.dispose();for(let X of R)X.mesh.dispose();for(let X of h)t.release(X);d.length=0,h.clear()}return{root:m,poses:D,origins:L,slotOn:F,apply:O,limitSlots:q,setRoles:H,setTheme:j,dispose:it,drawnBodies:f,bodyRadius:C,geomBoxes:T,nSlots:l,nBodies:a,bodyNames:n.map(X=>X.name),hasCollision:R.some(X=>X.collision),trianglesPerEnv:A,planes:u}}var Eh=["off","position","pose","heading"],ov=4e3,av=64*1024*1024,lv=8192,cv=15e3;var Th=new z,hv=new z,uv={f0:0,f1:0,t:0},Ah=[0,0];function He(i){throw new Error(`simscope: ${i}`)}var Zs=class extends EventTarget{constructor(t,e={}){super(),this.canvas=t,this._capturing=!1,this.clock=e.clock||new Li,this.theme=e.theme==="dark"?"dark":"light",this.bgExplicit=e.background!==void 0&&e.background!==null,this.cssWidth=300,this.cssHeight=150,this.dpr=1,this.visible=typeof IntersectionObserver!="function",this.dirty=!0,this.transparent=!1,this.opts={budget:e.triangleBudget||5e6,arrowScale:e.arrowScale??1},this.showVisual=!0,this.showCollision=!1,this.contactsOn=!1,this.color=typeof e.color=="string"&&e.color?e.color:null,this.linked=null,this.pan={a:0,b:0},this.rest=new z,this.holdZ=null,this._fitPending=!1,this._fitted=!1,this.r=null,this._token=0,this.followPref=e.follow,this.camMoving=!1,this.poseDirty=!0,this.viewName=Zi.includes(e.view)?e.view:"iso",this.groundForced=!1,this.scene=new _r,this.scene.add(new Cr(16777215,4473924,.5*Math.PI));let n=new Pr(16777215,.8*Math.PI);n.position.set(3,3,6),this.scene.add(n),this.ground=Pf(e.ground||"checker",this.theme),this.scene.add(this.ground.mesh),this._groundStyle=e.ground||"checker",this._applyGroundVisibility(),this._setBackground(this.bgExplicit?e.background:void 0),this.rig=new dl(t),this.camera=this.rig.camera,this.rig.setView(this.viewName,!1);for(let s of["controlstart","control","controlend"])this.rig.controls.addEventListener(s,()=>this.invalidate());this.rig.controls.addEventListener("control",()=>this._onControl()),this.fstate={mode:"off",env:0,body:-1,follower:Ef(),azOff:0,settled:!0,z0:new Map,z0Default:null,hold:Ws(),holdInit:!1},this.followPt={valid:!1,x:0,y:0,z:0,yaw:0},this._offscreen=e.offscreen||Ff,this.renderer=e.renderer||(e.direct?kf(t):Bf()),this.renderer.attach(this),this._onClock=()=>this.invalidate(),this._onClockState=()=>{this.clock.playing||(this.linked?this.linked.flush():this._fitPending&&this._autoFit()),this.invalidate()},this.clock.addEventListener("time",this._onClock),this.clock.addEventListener("state",this._onClockState),this._onEnded=()=>this.emit("ended",{}),this.clock.addEventListener("ended",this._onEnded),typeof IntersectionObserver=="function"&&(this._seen=new IntersectionObserver(s=>{this.visible=s[s.length-1].isIntersecting,this.visible&&this.invalidate()},{rootMargin:"64px"}),this._seen.observe(t)),jh(this)}async load(t,e,n={}){this.unload(),this._frozen=!1;let s=++this._token;try{return await this._load(t,e,n,s)}catch(r){throw this._token===s&&this.unload(),r}}async _load(t,e,n,s){let r=()=>this._token!==s,o=await Gf(t,e),a=await bh(t,o),l=a.n_envs,c=vh(l),u=await Wf(t,o,a),f=u.get(Mh);(!f||f.kind!=="pose")&&He("manifest has no body_pose stream of kind pose"),r()&&He("load superseded");let h=a.status==="recording",p=[...u.values()].filter(U=>U.kind==="pose"||U.kind==="arrows"||U.kind==="polyline"),g=h?wh(a,p):a.n_frames;g>=1||He(h?"the run has no complete window yet":"manifest needs n_frames >= 1"),!h&&f.nFrames<g&&He(`stream ${f.name}: ${f.nFrames} frames, manifest says ${g}`);let _=a.env_scenes||Array.from({length:l},()=>a.scene);_.length!==l&&He("env_scenes length does not match n_envs");let m=new Map;_.forEach((U,O)=>{(!U||!U.sha256)&&He("manifest has no scene reference"),m.has(U.sha256)||m.set(U.sha256,[]),m.get(U.sha256).push(O)});let d=c?[[[...m.keys()][0],null]]:[...m.entries()];c&&m.size>1&&console.warn("simscope: per-env scenes are not supported above 64 envs; drawing every env with the first scene");let M=[];try{for(let[U,O]of d){let q=Ii(await t.get(js("scenes",U,".json")),"scene");tr(q,"simscope-scene","scene");let H=await Qf(q,this._loaders(t,q),c?64:O.length);H.envs=O,M.push(H)}}catch(U){for(let O of M)O.dispose();throw U}if(r()){for(let U of M)U.dispose();He("load superseded")}let E=M[0].nBodies,y=M.some(U=>U.nBodies!==E)?"scenes of one run must have the same number of bodies":f.itemK!==E*7?`body_pose has ${f.itemK/7} bodies but the scene has ${E}`:null;if(y){for(let U of M)U.dispose();He(y)}let b=new sl(t);b.onChange=U=>{this.emit("progress",{pending:U}),this.invalidate()};let S=new Float32Array(3*l);(a.env_origins||[]).slice(0,l).forEach((U,O)=>S.set(U.slice(0,3),3*O));let C={source:t,run:o,manifest:a,live:h,dt:a.dt,nFrames:g,nEnvs:l,B:E,K:E*7,tiered:c,origins:S,parts:M,streams:u,pose:f,store:b,views:{a:new Ki(l),b:new Ki(l)},overlays:[],root:null,crowd:null,crowdState:c?"pending":"none",proxySize:[.5,.5,.5],rootPos:new Float32Array(3*l),rootBuf:null,hidden:null,allEnvs:null,focus:[],selected:0,pinned:[],capacity:l,envSlot:new Int32Array(l).fill(-1),gEnv:null,gBase:[],focusVer:0,derived:new Map,seriesCache:new Map,prefetch:{id:0,w0:-1,ahead:-1,ver:-1,contacts:-1,root:-1},events:[],extents:new Map,extentJobs:new Map,followBody:this._pickFollowBody(M[0]),hasContacts:u.has(Sh)};this.r=C;let v=0;for(let U of M)C.gBase.push(v),v+=U.nSlots;C.gEnv=new Int32Array(v).fill(-1),C.capacity=c?zf(l,M[0].trianglesPerEnv,this.opts.budget):l;let T=(n.envs||[]).filter(U=>Number.isInteger(U)&&U>=0&&U<l);C.selected=T.length?T[0]:0,C.pinned=T.slice(1,5),C.allEnvs=Int32Array.from({length:l},(U,O)=>O),this._assignFocus(),c&&M[0].limitSlots(C.capacity);for(let U of M)this.scene.add(U.root),U.setRoles(this.showVisual,this.showCollision),U.setTheme(this.theme);for(let U of u.values()){if(U.kind!=="arrows"&&U.kind!=="polyline")continue;let O=U.kind==="arrows"?6:3;U.itemK%O!==0&&He(`stream ${U.name}: bad item shape for kind ${U.kind}`);let q=typeof U.info.scale=="number"?U.info.scale:1;C.overlays.push({name:U.name,kind:U.kind,stream:U,k:U.itemK/O,scale:q,contacts:U.name===Sh,layer:null,views:{a:new Ki(l),b:new Ki(l)}})}this._claimClock(),await Promise.all([b.request(f,0,C.focus),...C.overlays.filter(U=>!U.contacts).map(U=>b.request(U.stream,0,C.focus))]),r()&&He("load superseded"),C.events=await Xf(t,o),r()&&He("load superseded"),this._refreshViews(0,0),C.views.a.arrs[C.selected]||He("the first window of body_pose is missing"),this._poseAt(0,0,0);let R=this._bounds(!1),A=this._bounds(!0);C.proxySize=this._proxySize(),this._applyGroundVisibility();for(let U of C.overlays){let O=Math.max(2*R.radius,.3);U.layer=U.kind==="arrows"?Uf(v,U.k,O,this.opts.arrowScale*U.scale,{points:U.contacts}):Df(v,U.k),U.layer.setTheme(this.theme),U.layer.root.visible=U.contacts?this.contactsOn:!0,this.scene.add(U.layer.root)}let P=c?R:A;this.rig.setFrame(Math.max(2*Math.max(P.radius,.3)*1.15/Math.min(1,this.rig.aspect),1.5),this.rig.aspect),this.rig.setZoomNow(1),this.rig.setTarget(P.cx,P.cy,P.cz,!1),this.rest.set(P.cx,P.cy,P.cz),this.pan.a=this.pan.b=0,this.holdZ=null,this._fitPending=!1,this._fitted=!1,this.rig.setView(this.viewName,!1),this.rig.fitBox(P.ex/2,P.ey/2,P.ez/2,!1),this._setDepth(c?A:P),this.rig.userZoomed=!1;let D=this.fstate;D.env=C.selected,D.body=C.followBody,D.z0.set(C.selected,this.followPt.z),D.z0Default=this.followPt.z;let L=this.followPref??(l===1?"position":"off");D.mode=Eh.includes(L)?L:"off",D.holdInit=!1,D.follower.primed=!1,this._primeFollow(),this.poseDirty=!0,this._applyGroundVisibility(),this.invalidate();let F=this.info();return this.emit("loaded",F),c&&this._buildCrowd(s),this._scheduleWhole(s),this._requestExtent(C.selected),F}_loaders(t,e){let n=e.meshes||[],s=e.textures||[],r=new Map,o=(a,l)=>(r.has(a)||r.set(a,l()),r.get(a));return{mesh:a=>Af(n[a].sha256,async()=>jd(await t.get(js("assets",n[a].sha256)))),release:a=>Cf(n[a].sha256),texture:a=>o(`t${a}`,async()=>{let l=s[a];if(!l||typeof createImageBitmap!="function")return null;let c=await t.get(js("assets",l.sha256));return createImageBitmap(new Blob([c],{type:l.media_type||"image/png"}),{imageOrientation:"flipY"})})}}_pickFollowBody(t){return wf(t.bodyNames||[])}_claimClock(){let t=this.r;this.clock.claim(this,Math.max(t.nFrames-1,0)*t.dt,t.dt,t.live)}info(){let t=this.r;return t?{run:t.run,dt:t.dt,frames:t.nFrames,duration:Math.max(t.nFrames-1,0)*t.dt,envs:t.nEnvs,bodies:t.parts[0].bodyNames,followBody:t.followBody,streams:[...t.streams.values()].map(e=>({name:e.name,kind:e.kind,shape:e.shape})),hasCollision:t.parts.some(e=>e.hasCollision),hasContacts:t.hasContacts,live:t.live,tiered:t.tiered,events:t.events,hasGround:t.parts.some(e=>e.planes.length>0),color:this.color}:null}unload(t={}){this._token=(this._token||0)+1,this._frozen=!!t.keepFrame&&!!this.r;let e=this.r;if(e){for(let n of e.parts)this.scene.remove(n.root),n.dispose();for(let n of e.overlays)n.layer&&(this.scene.remove(n.layer.root),n.layer.dispose());e.crowd&&(this.scene.remove(e.crowd.mesh),e.crowd.dispose()),e.store.onChange=null,e.store.clear()}this.r=null,this.clock.release(this),this.followPt.valid=!1,this.fstate.mode="off",this.fstate.follower.primed=!1,this.fstate.holdInit=!1,this.fstate.z0.clear(),this.holdZ=null,this._fitPending=!1,this._fitted=!1,this.pan.a=this.pan.b=0,this.poseDirty=!0,this.invalidate()}destroy(){this.unload(),this.linked=null,this.clock.removeEventListener("time",this._onClock),this.clock.removeEventListener("state",this._onClockState),this.clock.removeEventListener("ended",this._onEnded),this._seen&&this._seen.disconnect(),Qh(this),this.rig.dispose(),this.ground.dispose(),this.renderer.detach(this)}_assignFocus(){let t=this.r,e=t.tiered?Vf({nEnvs:t.nEnvs,selected:t.selected,pinned:t.pinned,origins:t.origins,capacity:t.capacity}):t.allEnvs?Array.from(t.allEnvs):Array.from({length:t.nEnvs},(s,r)=>r);t.focus=e;let n=new Set(e);if(t.tiered){let s=t.gEnv;for(let o=0;o<s.length;o++)s[o]>=0&&!n.has(s[o])&&(t.envSlot[s[o]]=-1,s[o]=-1);let r=0;for(let o of e)if(!(t.envSlot[o]>=0)){for(;r<s.length&&s[r]>=0;)r++;if(r>=s.length)break;s[r]=o,t.envSlot[o]=r}}else t.gEnv.some(s=>s>=0)===!1&&t.parts.forEach((s,r)=>{s.envs.forEach((o,a)=>{t.gEnv[t.gBase[r]+a]=o,t.envSlot[o]=t.gBase[r]+a})});t.focusVer++,t.prefetch.w0=-1}selectEnv(t){let e=this.r;!e||!Number.isInteger(t)||t<0||t>=e.nEnvs||t===e.selected||(e.selected=t,this.fstate.env=t,this._refocus())}pinEnvs(t){let e=this.r;e&&(e.pinned=(t||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<e.nEnvs&&n!==e.selected).slice(0,4),this._refocus())}_refocus(){let t=this.r;this._assignFocus(),this._requestZ0(t.selected),this._requestExtent(t.selected),this.poseDirty=!0,this.emit("focus",{env:t.selected,focus:t.focus.slice()}),this.invalidate()}focusEnvs(){return this.r?this.r.focus.slice():[]}_requestZ0(t){let e=this.r;!e||this.fstate.z0.has(t)||e.store.request(e.pose,0,[t]).then(()=>{let n=e.store.get(e.pose,0,t);n&&this.r===e&&this.fstate.z0.set(t,n[e.followBody*7+2]+e.origins[3*t+2])}).catch(()=>{})}_streamsWanted(){let t=this.r,e=[{stream:t.pose,envs:t.focus}];for(let n of t.overlays)(!n.contacts||this.contactsOn)&&e.push({stream:n.stream,envs:t.focus});return e}_prefetch(t,e){let n=this.r,s=n.prefetch,r=n.root?1:0,o=this.contactsOn?1:0;if(s.w0===t&&s.ahead===e&&s.ver===n.focusVer&&s.contacts===o&&s.root===r)return;let a=++s.id;Object.assign(s,{w0:t,ahead:e,ver:n.focusVer,contacts:o,root:r});let l=n.pose.nWindows,c=n.pose.blockFrames,u=new Set;for(let h=0;h<=e;h++)u.add(Math.min(t+h,l-1));this.clock.loop&&t>=l-1&&u.add(0);let f=h=>{let p=new Set;for(let g of u){let _=Math.floor(g*c/h.blockFrames),m=Math.floor(((g+1)*c-1)/h.blockFrames);for(let d=_;d<=m;d++)d>=0&&d<h.nWindows&&p.add(d)}return p};for(let{stream:h,envs:p}of this._streamsWanted())for(let g of f(h))n.store.request(h,g,p).catch(_=>this._dataError(_,a));if(n.root)for(let h of f(n.root.stream))n.store.requestWindow(n.root.stream,h).catch(p=>this._dataError(p,a))}_dataError(t,e){let n=this.r;if(n){if(t instanceof ye&&t.status===404&&n.live){setTimeout(()=>{this.r===n&&n.prefetch.id===e&&(n.prefetch.w0=-1,this.invalidate())},1e3);return}this.clock.pause(),this.emit("error",{error:t,message:t.message}),this.invalidate()}}_refreshViews(t,e){let n=this.r,s=n.pose.blockFrames,r=Math.floor(t/s),o=Math.floor(e/s);if(n.views.a.refresh(n.store,n.pose,r,n.focus,n.focusVer),n.views.b.refresh(n.store,n.pose,o,n.focus,n.focusVer),n.root){let a=n.root,l=a.stream.blockFrames;a.w0=Math.floor(t/l),a.w1=Math.floor(e/l),a.d0=n.store.getWindow(a.stream,a.w0)||null,a.d1=a.w1===a.w0?a.d0:n.store.getWindow(a.stream,a.w1)||null}return[r,o]}async _scheduleWhole(t){let e=this.r,n=this._streamsWanted().filter(r=>!e.root||r.stream!==e.root.stream),s=0;for(let{stream:r,envs:o}of n)s+=4*r.itemK*r.nFrames*o.length;if(!(e.live||s>av))try{for(let{stream:r,envs:o}of n)for(let a=1;a<r.nWindows;a++){if(this._token!==t||this.r!==e)return;await e.store.request(r,a,o)}}catch{}}async _buildCrowd(t){let e=this.r,n=`derived/${e.run}/root_pose.blk`;try{let s=await e.source.blockIndex(n);if(this._token!==t)return;let r=rl(ov,n,s,!0);if(r.itemK!==7&&He(`${n}: expected one pose per env`),await e.store.requestWindow(r,0),this._token!==t)return;e.root={stream:r,w0:-1,w1:-1,d0:null,d1:null},e.rootBuf=new Float32Array(7*e.nEnvs),e.hidden=new Uint8Array(e.nEnvs),e.crowd=yf(e.nEnvs,e.proxySize),this.scene.add(e.crowd.mesh),e.crowdState="ready",e.prefetch.w0=-1,this.poseDirty=!0,this.invalidate(),this.setCrowdColor("return").catch(()=>{})}catch(s){if(this._token!==t)return;e.crowdState=s instanceof ye&&s.status===404?"unavailable":"failed",console.warn(`simscope: no crowd tier for ${e.run} (${s.message})`)}}async setCrowdColor(t){let e=this.r;if(!e||(e.crowdColumn=t,!e.crowd))return;if(t===null)return e.crowd.setColors(null),this.invalidate();let n=await this.summaries();if(!n||this.r!==e||e.crowdColumn!==t)return;let s=(n.columns||[]).find(o=>o.key===t),r=n.values&&n.values[t];!s||!r||(e.crowd.setColors(r,s.better),this.invalidate())}_proxySize(){let t=this._bounds(!1);return[Math.max(t.ex,.15),Math.max(t.ey,.15),Math.max(t.ez,.15)]}needsFrame(){if(this._capturing)return!1;if(this.dirty||this.camMoving||!this.fstate.settled)return!0;let t=this.r;return t?this.clock.playing||t.store.pending>0:!1}invalidate(){this.dirty=!0,ii()}update(t){return this._capturing?!1:this._update(t)}_update(t){let e=this.r;if(this._frozen&&!e)return this.dirty=!1,!1;let n=!1;e&&(n=this._syncPose(),n=this._followStep(t)||n);let s=this.rig.update(t);this.camMoving=s,s&&(n=!0);let r=this.rig.getTarget(Th);return this.ground.update(r.x,r.y,this.rig.height,this.rig.aspect,Math.abs(this.rig.camera.getWorldDirection(hv).z),this.rig.height/this.cssHeight),this.rig.userChanged&&(this.rig.userChanged=!1,this.emit("camera",this.cameraState())),n}_syncPose(){let t=this.r,e=If(this.clock.time,t.dt,t.nFrames,uv),n=Math.floor(e.f0/t.pose.blockFrames);this._prefetch(n,this.clock.playing&&this.clock.speed>2?2:1),this._refreshViews(e.f0,e.f1);let s=!!t.views.a.arrs[t.selected],r=!t.root||!!t.root.d0;return this.clock.hold(this,!(s&&r)),!s||e.f0===t.f0&&e.f1===t.f1&&e.t===t.t&&t.store.epoch===t.epochSeen&&!this.poseDirty?!1:(this._poseAt(e.f0,e.f1,e.t),!0)}_poseAt(t,e,n){let s=this.r,r=s.K,o=s.B,a=s.pose.blockFrames,l=s.views.a.arrs,c=s.views.b.arrs,u=(t-s.views.a.w*a)*r,f=(e-s.views.b.w*a)*r,h=s.followBody;for(let _=0;_<s.parts.length;_++){let m=s.parts[_],d=s.gBase[_];for(let M=0;M<m.nSlots;M++){let E=s.gEnv[d+M],y=E>=0?l[E]:null;if(!y){m.slotOn[M]=0;continue}let b=c[E]||y;if(gh(m.poses,M*r,y,u,c[E]?b:y,c[E]?f:u,c[E]?n:0,o),m.origins[3*M]=s.origins[3*E],m.origins[3*M+1]=s.origins[3*E+1],m.origins[3*M+2]=s.origins[3*E+2],m.slotOn[M]=1,!s.tiered){let S=M*r+h*7;s.rootPos[3*E]=m.poses[S]+s.origins[3*E],s.rootPos[3*E+1]=m.poses[S+1]+s.origins[3*E+1],s.rootPos[3*E+2]=m.poses[S+2]+s.origins[3*E+2]}}m.apply()}let p=s.envSlot[s.selected];if(p>=0){let _=0;for(;_+1<s.parts.length&&s.gBase[_+1]<=p;)_++;let m=s.parts[_],d=p-s.gBase[_];if(m.slotOn[d]){let M=d*r+(this.fstate.body>=0?this.fstate.body:h)*7,E=this.followPt;E.x=m.poses[M]+s.origins[3*s.selected],E.y=m.poses[M+1]+s.origins[3*s.selected+1],E.z=m.poses[M+2]+s.origins[3*s.selected+2],E.yaw=Lf(m.poses,M),E.valid=!0}}if(s.crowd&&s.root.d0){let _=s.root,m=s.nEnvs,d=_.stream.blockFrames,M=_.d0.data,E=(_.d1||_.d0).data,y=(t-_.w0*d)*m*7,b=_.d1?(e-_.w1*d)*m*7:y,S=_.d1?n:0,C=s.rootBuf,v=s.hidden,T=s.parts[0].slotOn,R=s.envSlot,A=_.d1?E:M;for(let P=0,D=0;P<m;P++,D+=7){gh(C,D,M,y+D,A,b+D,S,1),s.rootPos[3*P]=C[D]+s.origins[3*P],s.rootPos[3*P+1]=C[D+1]+s.origins[3*P+1],s.rootPos[3*P+2]=C[D+2]+s.origins[3*P+2];let L=R[P];v[P]=L>=0&&T[L]?1:0}s.crowd.update(C,s.origins,v)}let g=n>=.5?e:t;for(let _ of s.overlays){if(!_.layer||_.contacts&&!this.contactsOn)continue;let m=_.stream.blockFrames,d=Math.floor(g/m);_.views.a.refresh(s.store,_.stream,d,s.focus,s.focusVer);let M=(g-d*m)*_.stream.itemK,E=_.views.a.arrs;for(let y=0;y<s.gEnv.length;y++){let b=s.gEnv[y],S=b>=0?E[b]:null;S?_.layer.update(y,S,M,s.origins[3*b],s.origins[3*b+1],s.origins[3*b+2]):_.layer.clear(y)}_.layer.commit()}s.f0=t,s.f1=e,s.t=n,s.epochSeen=s.store.epoch,this.poseDirty=!1,this.dirty=!0}_bounds(t){let e=this.r,n=[1/0,1/0,1/0],s=[-1/0,-1/0,-1/0],r=(f,h,p,g)=>{Number.isFinite(f)&&Number.isFinite(h)&&Number.isFinite(p)&&(f-g<n[0]&&(n[0]=f-g),h-g<n[1]&&(n[1]=h-g),p-g<n[2]&&(n[2]=p-g),f+g>s[0]&&(s[0]=f+g),h+g>s[1]&&(s[1]=h+g),p+g>s[2]&&(s[2]=p+g))},o=e.K,a=t?null:new Set([e.selected,...e.pinned]);if(t&&e.tiered){let f=e.crowd?e.rootPos:e.origins,h=Math.max(...e.proxySize)/2;for(let p=0;p<e.nEnvs;p++)r(f[3*p],f[3*p+1],f[3*p+2],h)}else for(let f=0;f<e.parts.length;f++){let h=e.parts[f],p=e.gBase[f],g=!1;for(let _=1;_<h.nBodies;_++)h.drawnBodies[_]&&(g=!0);for(let _=0;_<h.nSlots;_++){let m=e.gEnv[p+_];if(!(m<0||!h.slotOn[_])&&!(a&&!a.has(m)))for(let d=0;d<h.nBodies;d++){if(g&&(d===0||!h.drawnBodies[d]))continue;let M=_*o+d*7;r(h.poses[M]+e.origins[3*m],h.poses[M+1]+e.origins[3*m+1],h.poses[M+2]+e.origins[3*m+2],h.bodyRadius[d])}}}if(!(n[0]<=s[0]))return{cx:0,cy:0,cz:.6,radius:1.5,ex:.5,ey:.5,ez:1};let l=s[0]-n[0],c=s[1]-n[1],u=s[2]-n[2];return{cx:(n[0]+s[0])/2,cy:(n[1]+s[1])/2,cz:(n[2]+s[2])/2,radius:Math.hypot(l,c,u)/2,ex:l,ey:c,ez:u}}_setDepth(t){let e=Math.max(t.radius,5),n=Math.max(60,4*e);this.rig.setDepth(n,n+Math.max(1e3,40*e))}_primeFollow(){let t=this.fstate,e=this.rig.getTarget(Th);mh(t.follower,e.x,e.y,e.z,0),t.follower.primed=!0,t.holdInit=!1,t.settled=!1,t.mode==="heading"&&this.followPt.valid&&(t.azOff=this.rig.azimuth-this.followPt.yaw)}setFollow(t={}){let e=this.r,n=this.fstate,s=`${n.mode}:${n.env}:${n.body}`;t.body!==void 0&&Number.isInteger(t.body)&&e&&t.body>=0&&t.body<e.B&&(n.body=t.body,this.poseDirty=!0,this._requestExtent(e.selected)),t.env!==void 0&&this.selectEnv(t.env),t.mode!==void 0&&Eh.includes(t.mode)&&(this.followPref=t.mode),t.mode!==void 0&&Eh.includes(t.mode)&&t.mode!==n.mode&&(t.mode==="off"&&this.rest.copy(this.rig.getTarget(Th)),n.mode=t.mode,this._clearPan(),this._primeFollow(),n.mode==="heading"&&this.followPt.valid&&(n.azOff=this.rig.azimuth-this.followPt.yaw),this._autoFit()),`${n.mode}:${n.env}:${n.body}`!==s&&(this.emit("follow",this.follow()),this.invalidate())}follow(){let t=this.fstate,e=this.r;return{mode:t.mode,env:e?e.selected:t.env,body:t.body>=0?t.body:e?e.followBody:0}}_heldZ(){return this.linked?this.linked.z():this.fstate.mode==="position"?this.holdZ:null}_followStep(t){let e=this.fstate,n=this.rig,s=this.followPt;if(e.mode==="off"||!s.valid)return e.settled=!0,!1;let r=e.mode,o=this._heldZ(),a=e.follower,l,c=!1;if(o!==null){let h=e.hold;e.holdInit||(h.x=a.z.x,h.v=0,e.holdInit=!0),Xs(h,o,.08,t),l=h.x,c=Math.abs(h.x-o)>1e-4||Math.abs(h.v)>1e-4}else e.holdInit=!1,l=r==="position"?e.z0.get(this.r.selected)??e.z0Default??s.z:s.z;Tf(a,s.x,s.y,l,s.yaw,t,.12,2*n.height),o!==null&&(a.z.x=l,a.z.v=0),r==="heading"&&(n.rotateBusy?e.azOff=n.azimuth-a.yaw.x:n.setAzimuthNow(a.yaw.x+e.azOff)),this._writeFollowTarget();let u=Math.hypot(a.x.x-s.x,a.y.x-s.y,a.z.x-l),f=Math.hypot(a.x.v,a.y.v,a.z.v)+Math.abs(a.yaw.v);return e.settled=this.clock.playing?!1:u<1e-4&&f<1e-4&&!c,!0}_onControl(){this.rig.dragDelta(Ah)&&(this.pan.a+=Ah[0],this.pan.b+=Ah[1],this.fstate.mode!=="off"&&this.followPt.valid&&this.fstate.follower.primed?this._writeFollowTarget():this._writeRestTarget(!1,!1))}_writeFollowTarget(){let t=this.fstate.follower,e=this.rig.basis(!1),n=this.pan.a,s=this.pan.b;this.rig.setTargetNow(t.x.x+n*e.rx+s*e.ux,t.y.x+n*e.ry+s*e.uy,t.z.x+n*e.rz+s*e.uz)}_writeRestTarget(t,e){let n=this.rig.basis(e),s=this.pan.a,r=this.pan.b,o=this.rest;this.rig.setTarget(o.x+s*n.rx+r*n.ux,o.y+s*n.ry+r*n.uy,o.z+s*n.rz+r*n.uz,t)}_zeroPan(t){this.pan.a=this.pan.b=0,this.fstate.mode==="off"&&this.r&&this.rig.setTarget(this.rest.x,this.rest.y,this.rest.z,t)}_clearPan(){this.linked?this.linked.clearPan():this._zeroPan(!1)}_extentKey(t){let e=this.fstate;return`${t}:${e.body>=0?e.body:this.r.followBody}`}_extent(){let t=this.r;if(!t)return;let e=this._extentKey(t.selected);return t.extents.has(e)?t.extents.get(e):void 0}_requestExtent(t){let e=this.r;if(!e)return;let n=this._extentKey(t);if(e.extentJobs.has(n)){this._extentJob=e.extentJobs.get(n);return}if(e.live){e.extents.set(n,null),e.extentJobs.set(n,Promise.resolve());return}let s=this.fstate.body>=0?this.fstate.body:e.followBody,r=vl(e,e.pose,t).then(o=>{if(this.r!==e)return;let a=e.parts.find(l=>!l.envs||l.envs.includes(t))||e.parts[0];e.extents.set(n,Mf({poses:o,T:e.pose.nFrames,B:e.B,follow:s,origin:[e.origins[3*t],e.origins[3*t+1],e.origins[3*t+2]],boxes:a.geomBoxes}))},()=>{this.r===e&&e.extents.set(n,null)}).then(()=>{this.r===e&&t===e.selected&&this._extentArrived()});e.extentJobs.set(n,r),this._extentJob=r}_extentArrived(){this.linked?this.linked.arrived():this._autoFit()}_fitHeight(t){let e=this._extent();if(!e)return null;let n=this.rig.basis(!0);return Sf(e,t,n.ux,n.uy,n.uz,this.rig.aspect)}_fitVertical(t,e,n){this.holdZ=t,this.linked&&this.fstate.mode==="off"&&(this.rest.z=t,this._writeRestTarget(n,!0)),this.rig.setHeight(e,n),this.fstate.settled=!1,this.invalidate()}_trajectoryFit(t){if(this.linked||this.fstate.mode!=="position")return!1;let e=this._extent();if(!e)return!1;let n=(e.zlo+e.zhi)/2;return this._fitVertical(n,this._fitHeight(n),t),this._fitted=!0,!0}_autoFit(){if(!(this.linked||!this.r||this.fstate.mode!=="position"||!this._extent())){if(this.clock.playing&&this._fitted){this._fitPending=!0;return}this._fitPending=!1,this.rig.userZoomed||this._trajectoryFit(!0)}}setView(t,e={}){this.linked?this.linked.setView(t,e):this._setView(t,e)}_setView(t,e){if(!Zi.includes(t))return;this.viewName=t;let n=e.animate!==!1&&!!this.r;if(this.rig.setView(t,n),this._zeroPan(n),!this.linked&&this.r&&this.fstate.mode==="position"&&this.holdZ!==null&&!this.rig.userZoomed){let s=this._fitHeight(this.holdZ);s&&this.rig.setHeight(s,n)}this.invalidate()}frame(t="focus",e={}){this.linked?this.linked.frame(t,e):this._frame(t,e)}_frame(t,e){let n=e.animate!==!1,s=this._frameTarget(t,n);s&&this._fitFrame(t,s,n),this.invalidate()}_frameTarget(t,e){if(!this.r)return null;this._syncPose();let s=this.fstate;if(t==="all"){s.mode!=="off"&&this.setFollow({mode:"off"});let o=this._bounds(!0);return this.pan.a=this.pan.b=0,this.rest.set(o.cx,o.cy,o.cz),this.rig.setTarget(o.cx,o.cy,o.cz,e),o}let r=this._bounds(!1);if(this.pan.a=this.pan.b=0,s.mode==="off"){let o=this.linked&&this.linked.z()!==null?this.linked.z():r.cz;this.rest.set(r.cx,r.cy,o),this.rig.setTarget(r.cx,r.cy,o,e)}return r}_fitFrame(t,e,n){if(t==="all")this.rig.fitBox(e.ex/2,e.ey/2,e.ez/2,n),this._setDepth(e);else if(!this._trajectoryFit(n)){let s=this.fstate.mode,r=s==="pose"||s==="off"&&!this.linked?null:this._heldZ()??this.standingHeight(),o=r===null?0:Math.abs(e.cz-r);this.rig.fitBox(e.ex/2,e.ey/2,e.ez/2+o,n)}}cameraState(){let t=this.rig.state(this.fstate.mode!=="off");return t.pan=[this.pan.a,this.pan.b],t}standingHeight(){let t=this.r;return t?this.fstate.z0.get(t.selected)??this.fstate.z0Default:null}setCameraState(t,e={}){if(!t)return;let n=e.animate===!0;this.rig.apply(t,n,!1),e.keep===!0&&(this.rig.userZoomed=!0);let s=t.pan;Array.isArray(s)&&Number.isFinite(s[0])&&Number.isFinite(s[1])?(this.pan.a=s[0],this.pan.b=s[1],this.fstate.mode==="off"&&this._writeRestTarget(n,!0)):this.fstate.mode==="off"&&Array.isArray(t.target)&&(this.pan.a=this.pan.b=0,this.rest.set(t.target[0],t.target[1],t.target[2]),this.rig.setTarget(t.target[0],t.target[1],t.target[2],n)),this.invalidate()}pickEnv(t,e){let n=this.r;if(!n)return null;let s=this.canvas.getBoundingClientRect();if(!(s.width>0&&s.height>0))return null;let r=(t-s.left)/s.width*2-1,o=-((e-s.top)/s.height*2-1);this.camera.updateMatrixWorld();let a=new z(r,o,-1).unproject(this.camera),l=this.camera.getWorldDirection(new z),c=this.rig.height/s.height,u=Math.max(n.proxySize[0],n.proxySize[1],n.proxySize[2]),f=Math.max(.6*u,6*c);return Of([a.x,a.y,a.z,l.x,l.y,l.z],n.rootPos,n.nEnvs,f)}resize(t,e,n=1){this.cssWidth=Math.max(t,1),this.cssHeight=Math.max(e,1),this.dpr=n;let s=this.rig.aspect;if(this.rig.setFrame(void 0,this.cssWidth/this.cssHeight),this.r&&Math.abs(this.rig.aspect/s-1)>.01&&!this.rig.userZoomed){if(this.linked)this.linked.zc!==null&&!this.linked.zoomed()&&this.linked.trajectory(!1);else if(this.fstate.mode==="position"&&this.holdZ!==null){let r=this._fitHeight(this.holdZ);r&&this.rig.setHeight(r,!1)}}this.invalidate()}_setBackground(t){let e=t===null||t==="transparent"||t==="none";this.transparent=e,this.scene.background=e?null:typeof t=="string"&&mf(t)||kn(Bn(this.theme).viewport)}setTheme(t,e){if(this.theme=t==="dark"?"dark":"light",this.ground.setTheme(this.theme),this.r){for(let n of this.r.parts)n.setTheme(this.theme);for(let n of this.r.overlays)n.layer&&n.layer.setTheme(this.theme)}this.bgExplicit=e!=null,this._setBackground(this.bgExplicit?e:void 0),this.invalidate()}setBackground(t){this.bgExplicit=t!=null,this._setBackground(this.bgExplicit?t:void 0),this.invalidate()}setGround(t){this.groundForced=!0,this._groundStyle=t==="grid"||t==="none"?t:"checker",this.ground.setStyle(this._groundStyle),this._applyGroundVisibility(),this.invalidate()}_applyGroundVisibility(){let t=this.r,e=t?t.parts.some(n=>n.planes.length>0):!1;if(this.ground.mesh.visible=this._groundStyle!=="none"&&(e||this.groundForced||!t),t&&e){let n=t.parts.find(o=>o.planes.length).planes[0],s=t.tiered?2:Math.max(...t.proxySize),r=[.05,.1,.25,.5,1,2,5].reduce((o,a)=>Math.abs(a-s/2)<Math.abs(o-s/2)?a:o);this.ground.setPlane(n.z,r)}}setContacts(t){this.contactsOn=!!t;let e=this.r;if(e){for(let n of e.overlays)n.contacts&&n.layer&&(n.layer.root.visible=this.contactsOn);e.prefetch.w0=-1,this.poseDirty=!0}this.invalidate()}setVisual(t){if(this.showVisual=!!t,this.r)for(let e of this.r.parts)e.setRoles(this.showVisual,this.showCollision);this.invalidate()}setCollision(t){if(this.showCollision=!!t,this.r)for(let e of this.r.parts)e.setRoles(this.showVisual,this.showCollision);this.invalidate()}setColor(t){let e=typeof t=="string"&&t?t:null;e!==this.color&&(this.color=e,this.emit("color",{color:e}))}setRoles(t,e){if(this.showVisual=!!t,this.showCollision=!!e,this.r)for(let n of this.r.parts)n.setRoles(this.showVisual,this.showCollision);this.invalidate()}stats(){let t=this.r,e=this.renderer.info;return{cachedBytes:t?t.store.bytes:0,pending:(t?t.store.pending:0)+Xi.pending,drawCalls:e.render.calls,triangles:e.render.triangles,focusEnvs:t?t.focus.length:0,threaded:Xi.threaded}}async refresh(){let t=this.r;if(!t||!t.live)return;let e=await bh(t.source,t.run),n=[];for(let l of t.streams.values()){let c=await t.source.blockIndex(l.path,{refresh:!0});l.nFrames=c.nFrames,l.nWindows=Math.ceil(c.nFrames/c.blockFrames),n.push(l)}if(this.r!==t)return;let s=e.status==="recording",r=n.filter(l=>l.kind==="pose"||l.kind==="arrows"||l.kind==="polyline"),o=s?wh(e,r):e.n_frames,a=t.live;t.live=s,a!==s&&this._claimClock(),o>t.nFrames&&(t.nFrames=o,this._claimClock(),t.prefetch.w0=-1,this.emit("live",{frames:o}),this.invalidate())}async series(t,e,n=0){return Zf(this._need("series"),t,e,n)}async bodySeries(t,e,n){return $f(this._need("bodySeries"),t,e,n)}highlights(){return this.r?Kf(this.r):Promise.resolve(null)}summaries(){return this.r?Ml(this.r,"summaries.json"):Promise.resolve(null)}envelope(t,e=0){return this.r?Jf(this.r,t,e):Promise.resolve(null)}_need(t){return this.r||He(`${t}(): no run is loaded`),this.r}async snapshot(t="image/png",e){if(e&&(e.scale||e.width)){let{width:n,height:s}=this.captureSize(e);this._update(0);let r=this._offscreen();try{let o=this._fit(n,s,r.maxSize);return await r.blob(this,o.width,o.height,t)}finally{r.dispose()}}return this.update(0),this.renderer.draw(this),new Promise((n,s)=>this.canvas.toBlob(r=>r?n(r):s(new Error("simscope: snapshot failed")),t))}captureSize({scale:t=1,width:e}={}){let n=e||this.cssWidth*this.dpr*t;return this._fit(n,n*this.cssHeight/this.cssWidth,lv)}_fit(t,e,n){let s=Math.min(1,n/Math.max(t,e));return{width:Math.max(1,Math.round(t*s)),height:Math.max(1,Math.round(e*s))}}async*captureFrames({t0:t,t1:e,fps:n=20,width:s=720,signal:r}={}){this._need("captureFrames"),this._capturing&&He("a capture is already running"),(!(e>t)||!(n>0))&&He("captureFrames(): need t1 > t0 and fps > 0");let o=this.clock,a=Math.max(1,Math.round((e-t)*n)),l=this._offscreen(),c=this.captureSize({width:s}),u=this._fit(c.width,c.height,l.maxSize),f={time:o.time,playing:o.playing};this._capturing=!0,o.pause();try{for(let h=0;h<a;h++){if(r&&r.aborted)throw r.reason||new DOMException("Capture cancelled","AbortError");let p=t+h/n;if(o.seek(p),await this._settle(),h===0)for(let _=0;_<60&&(this._update(.05),!(!this.camMoving&&this.fstate.settled));_++);else this._update(1/n);let g=l.pixels(this,u.width,u.height);yield{index:h,count:a,t:p,width:u.width,height:u.height,data:g}}}finally{this._capturing=!1,l.dispose(),o.seek(f.time),f.playing&&o.play(),this.invalidate()}}async _settle(){let t=this.r,e=Date.now()+cv;for(;;){let n=this._syncPose();if(!!t.views.a.arrs[t.selected]&&t.store.pending===0&&Xi.pending===0&&!n||Date.now()>e)return;await new Promise(r=>setTimeout(r,4))}}emit(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e}))}};var dv={play:'<polygon points="6 3 20 12 6 21 6 3"/>',pause:'<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',back:'<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',forward:'<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',box:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',check:'<path d="M20 6 9 17l-5-5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',moon:'<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',video:'<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',contact:'<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>'},fv=new Set(["play","pause","back","forward","video"]);function En(i){return`<svg width="16" height="16" viewBox="0 0 24 24" fill="${fv.has(i)?"currentColor":"none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dv[i]}</svg>`}var rn=xf,pv={viewport:rn(.97),bg:rn(1),fg:rn(.145),muted:rn(.97),mutedFg:rn(.556),border:rn(.922),ring:rn(.708)},mv={viewport:rn(.15),bg:rn(.205),fg:rn(.985),muted:rn(.269),mutedFg:rn(.708),border:"rgb(255 255 255 / 10%)",ring:rn(.556)},tp=i=>`--ss-viewport:${i.viewport};--ss-bg:${i.bg};--ss-fg:${i.fg};--ss-muted:${i.muted};--ss-muted-fg:${i.mutedFg};--ss-border:${i.border};--ss-ring:${i.ring};`,jn={light:tp(pv),dark:tp(mv)},$s='system-ui, -apple-system, "Segoe UI", sans-serif',Sl=`
.ss-bar { container-type: inline-size; display: flex; align-items: center; gap: 4px; box-sizing: border-box; height: 44px; padding: 0 8px;
  background: var(--ss-bg); color: var(--ss-fg); border-top: 1px solid var(--ss-border); font: 12px/16px ${$s}; user-select: none; }
.ss-bar[hidden], .ss-bar [hidden] { display: none; }
.ss-btn { display: inline-flex; align-items: center; justify-content: center; flex: none; box-sizing: border-box; height: 28px; min-width: 28px; padding: 0 6px;
  margin: 0; border: 0; border-radius: 8px; background: transparent; color: var(--ss-fg); font: inherit; cursor: pointer;
  transition: background-color 0.15s, transform 0.1s; }
.ss-btn:active:not([aria-haspopup]) { transform: translateY(1px); }
.ss-btn:hover { background: var(--ss-muted); }
.ss-btn[aria-pressed="true"], .ss-btn[aria-expanded="true"] { background: var(--ss-muted); }
.ss-btn:disabled, .ss-btn[aria-disabled="true"] { opacity: 0.4; cursor: default; background: transparent; }
.ss-btn:focus-visible, .ss-scrub:focus-visible { outline: 2px solid var(--ss-ring); outline-offset: -1px; }
.ss-btn.ss-text { font-variant-numeric: tabular-nums; font-weight: 500; }
/* The play button is the app's: a round 32 px button on the secondary fill, with a solid icon. */
.ss-btn.ss-play { width: 32px; height: 32px; border-radius: 50%; background: var(--ss-muted); color: var(--ss-fg); }
.ss-btn.ss-play:hover { background: color-mix(in srgb, var(--ss-muted), var(--ss-fg) 8%); }
.ss-btn.ss-play:disabled, .ss-btn.ss-play[aria-disabled="true"] { background: var(--ss-muted); }
.ss-scrub { --p: 0%; flex: 1; min-width: 40px; height: 28px; margin: 0 4px; padding: 0; background: transparent; cursor: pointer;
  -webkit-appearance: none; appearance: none; }
.ss-scrub:disabled { cursor: default; opacity: 0.4; }
.ss-scrub::-webkit-slider-runnable-track { height: 3px; border-radius: 2px;
  background: linear-gradient(to right, var(--ss-fg) var(--p), color-mix(in srgb, var(--ss-fg) 14%, transparent) var(--p)); }
.ss-scrub::-moz-range-track { height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--ss-fg) 14%, transparent); }
.ss-scrub::-moz-range-progress { height: 3px; border-radius: 2px; background: var(--ss-fg); }
.ss-scrub::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; margin-top: -4.5px; border: 0; border-radius: 50%;
  background: var(--ss-fg); opacity: 0; transition: opacity 0.12s; }
.ss-scrub::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: var(--ss-fg); opacity: 0; transition: opacity 0.12s; }
.ss-scrub:hover::-webkit-slider-thumb, .ss-scrub:active::-webkit-slider-thumb, .ss-scrub:focus-visible::-webkit-slider-thumb { opacity: 1; }
.ss-scrub:hover::-moz-range-thumb, .ss-scrub:active::-moz-range-thumb, .ss-scrub:focus-visible::-moz-range-thumb { opacity: 1; }
.ss-time { flex: none; min-width: 7.5em; text-align: right; color: var(--ss-muted-fg); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ss-wrap { position: relative; flex: none; }
.ss-menu { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 5; box-sizing: border-box; min-width: 88px; padding: 4px;
  background: var(--ss-bg); border: 0; border-radius: 10px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ss-fg) 10%, transparent), 0 4px 12px rgb(0 0 0 / 12%); }
.ss-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; box-sizing: border-box; height: 32px; padding: 0 8px;
  border: 0; border-radius: 6px; background: transparent; color: var(--ss-fg); font: inherit; font-variant-numeric: tabular-nums; cursor: pointer; text-align: left; }
.ss-item:hover { background: var(--ss-muted); }
.ss-item svg { visibility: hidden; }
.ss-item[aria-checked="true"] svg { visibility: visible; }
.ss-group { padding: 6px 8px; color: var(--ss-muted-fg); }
.ss-row { display: flex; gap: 2px; }
.ss-item.ss-opt { flex: none; width: auto; justify-content: center; padding: 0 8px; height: 28px; }
.ss-opt[aria-checked="true"] { background: var(--ss-muted); font-weight: 500; }
.ss-sep { height: 1px; margin: 4px -4px; background: var(--ss-border); }
@container (max-width: 440px) { .ss-step { display: none; } }
@container (max-width: 320px) { .ss-time { min-width: 0; } .ss-loop { display: none; } }
`,gv=[.25,.5,1,2,4],_v=[["iso","Iso"],["front","Front"],["side","Side"],["top","Top"]],xv=[["off","Off"],["position","Position"],["pose","Pose"],["heading","Heading"]];function yv(i,t){return`${i.toFixed(2)} / ${t.toFixed(2)} s`}var Ch=i=>`${i}×`;function Ks(i,t,e,n){i.setAttribute("aria-disabled",String(!t)),i.title=t?e:n}function vv(){let i=(t,e)=>`<div class="ss-row">${e.map(([n,s])=>`<button type="button" class="ss-item ss-opt ss-cam-item" role="menuitemradio" aria-checked="false" data-${t}="${n}">${s}</button>`).join("")}</div>`;return`<div class="ss-wrap ss-camwrap"><button type="button" class="ss-btn ss-cam" aria-label="Camera" title="Camera" aria-haspopup="menu" aria-expanded="false">${En("video")}</button><div class="ss-menu ss-cam-menu" role="menu" hidden><div class="ss-group">View</div>${i("view",_v)}<button type="button" class="ss-item ss-cam-item" role="menuitem" data-frame="1">Frame</button><div class="ss-sep" role="separator"></div><div class="ss-group">Follow</div>${i("follow",xv)}</div></div>`}function bl(){let i=(t,e,n,s="")=>`<button type="button" class="ss-btn ${t}" aria-label="${e}" title="${e}"${s}>${n}</button>`;return[i("ss-play","Play",En("play")," disabled"),i("ss-step ss-back","Previous frame",En("back")," disabled"),i("ss-step ss-fwd","Next frame",En("forward")," disabled"),'<input class="ss-scrub" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" disabled>','<span class="ss-time">0.00 / 0.00 s</span>',i("ss-loop","Loop",En("repeat"),' aria-pressed="false"'),`<div class="ss-wrap">${i("ss-text ss-speed","Speed",Ch(1),' aria-haspopup="menu" aria-expanded="false"')}<div class="ss-menu" role="menu" hidden>${gv.map(t=>`<button type="button" class="ss-item ss-speed-item" role="menuitemradio" aria-checked="false" data-speed="${t}">${Ch(t)}${En("check")}</button>`).join("")}</div></div>`,vv(),i("ss-col","Collision geometry",En("box"),' aria-pressed="false" aria-disabled="true"'),i("ss-contacts","Contact forces",En("contact"),' aria-pressed="false" aria-disabled="true"'),i("ss-theme","Switch theme",En("sun")," hidden")].join("")}function wl(i){let t=e=>i.querySelector(e);return{root:i,play:t(".ss-play"),back:t(".ss-back"),fwd:t(".ss-fwd"),scrub:t(".ss-scrub"),time:t(".ss-time"),loop:t(".ss-loop"),speed:t(".ss-speed"),menu:t(".ss-menu"),items:[...i.querySelectorAll(".ss-speed-item")],camWrap:t(".ss-camwrap"),cam:t(".ss-cam"),camMenu:t(".ss-cam-menu"),camItems:[...i.querySelectorAll(".ss-cam-item")],col:t(".ss-col"),contacts:t(".ss-contacts"),theme:t(".ss-theme")}}function El(i,t={}){let{play:e,back:n,fwd:s,scrub:r,time:o,loop:a,speed:l,menu:c,items:u,cam:f,camMenu:h,camItems:p,col:g,contacts:_,theme:m}=i,{camera:d,collision:M,contacts:E,theme:y}=t,b=t.stepDt||(()=>.02),S=null,C=!1,v=()=>{let O=S?S.duration:0,q=S?Math.min(S.time,O):0,H=O>0;for(let j of[e,n,s,r])j.disabled=!H;o.textContent=yv(q,O),C||(r.value=H?Math.round(q/O*1e3):0),r.style.setProperty("--p",`${H?q/O*100:0}%`)},T=()=>{let O=!!S&&S.playing;e.innerHTML=En(O?"pause":"play"),e.setAttribute("aria-label",O?"Pause":"Play"),e.title=O?"Pause":"Play";let q=!!S&&S.loop;a.setAttribute("aria-pressed",String(q));let H=S?S.speed:1;l.textContent=Ch(H);for(let j of u)j.setAttribute("aria-checked",String(Number(j.getAttribute("data-speed"))===H));if(d){let j=d.view(),it=d.follow();for(let X of p){let nt=X.getAttribute("data-view"),lt=X.getAttribute("data-follow");nt!==null?X.setAttribute("aria-checked",String(nt===j)):lt!==null&&X.setAttribute("aria-checked",String(lt===it))}}if(E&&_.setAttribute("aria-pressed",String(E.on())),M&&g.setAttribute("aria-pressed",String(M.on())),y){let j=y.dark();m.innerHTML=En(j?"moon":"sun"),m.setAttribute("aria-label",j?"Switch to light theme":"Switch to dark theme"),m.title=j?"Switch to light theme":"Switch to dark theme"}v()},R=[{button:l,panel:c},{button:f,panel:h}],A=O=>{for(let q of R)q!==O&&(q.panel.hidden=!0,q.button.setAttribute("aria-expanded","false"))},P=O=>{let q=O.panel.hidden;A(O),O.panel.hidden=!q,O.button.setAttribute("aria-expanded",String(q))};d||(i.camWrap.hidden=!0);let D=(O,q,H)=>(O.addEventListener(q,H),()=>O.removeEventListener(q,H)),L=[D(e,"click",()=>S&&S.toggle()),D(n,"click",()=>{S&&(S.pause(),S.step(-1,b()))}),D(s,"click",()=>{S&&(S.pause(),S.step(1,b()))}),D(r,"input",()=>S&&S.seek(Number(r.value)/1e3*S.duration)),D(r,"pointerdown",()=>C=!0),D(r,"pointerup",()=>(C=!1,v())),D(r,"pointercancel",()=>(C=!1,v())),D(a,"click",()=>{S&&(t.onLoop?t.onLoop(!S.loop):S.loop=!S.loop,T())}),D(l,"click",()=>P(R[0])),D(f,"click",()=>P(R[1])),D(m,"click",()=>{y&&(y.toggle(),T())}),D(g,"click",()=>{!M||g.getAttribute("aria-disabled")==="true"||(M.set(!M.on()),T())}),D(_,"click",()=>{!E||_.getAttribute("aria-disabled")==="true"||(E.set(!E.on()),T())}),...u.map(O=>D(O,"click",()=>{S&&(S.speed=Number(O.getAttribute("data-speed"))),A(),T()})),...p.map(O=>D(O,"click",()=>{if(!d)return;let q=O.getAttribute("data-view"),H=O.getAttribute("data-follow");q!==null?d.setView(q):H!==null?d.setFollow(H):(d.frame(),A()),T()}))],F=t.outside;F&&L.push(D(F,"pointerdown",O=>{let q=O.composedPath?O.composedPath():[];for(let H of R)!H.panel.hidden&&!q.includes(H.panel)&&!q.includes(H.button)&&A()}),D(F,"keydown",O=>O.key==="Escape"&&A()));let U=null;return{setClock(O){U&&U(),S=O,O?(O.addEventListener("time",v),O.addEventListener("state",T),U=()=>{O.removeEventListener("time",v),O.removeEventListener("state",T)}):U=null,T()},paint:T,dispose(){U&&U(),L.forEach(O=>O())}}}var Mv=["off","position","pose","heading"],Sv=["checker","grid","none"],bv=8,wv=":host { aspect-ratio: auto; height: 100vh; height: 100dvh; min-height: 0; }",ep="ss-figures-style",Ev=`body > figure:has(> simscope-player) { margin: 0; }
body > figure:has(> simscope-player) > figcaption { padding: 6px 12px; font: 12px/16px ${$s}; color: #737373; }`,Tv=`
:host { ${jn.light} display: flex; flex-direction: column; position: relative; aspect-ratio: 16 / 9; min-height: 96px;
  overflow: hidden; background: var(--ss-viewport); color: var(--ss-fg); font: 12px/16px ${$s}; }
:host([theme="dark"]) { ${jn.dark} }
@media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${jn.dark} } }
:host([hidden]) { display: none; }
.stage { position: relative; flex: 1; min-height: 0; }
canvas, img.poster { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
canvas { touch-action: none; }
img.poster { object-fit: contain; }
.msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: 12px; text-align: center; color: #b3261e; pointer-events: none; }
.msg[hidden] { display: none; }
:host([nocontrols]) .ss-bar, :host([controls="none"]) .ss-bar, :host([sync]) .ss-bar { display: none; }
${Sl}
`;function Ph(i){if(typeof Uint8Array.fromBase64=="function")return Uint8Array.fromBase64(i);let t=atob(i),e=new Uint8Array(t.length);for(let n=0;n<t.length;n++)e[n]=t.charCodeAt(n);return e}var Rh=new WeakMap,Ci=[],Jr=class i extends HTMLElement{static get observedAttributes(){return["src","run","loop","speed","view","background","collision","contacts","env","follow","ground","theme","themetoggle","sync"]}constructor(){super();let t=this.attachShadow({mode:"open"});t.innerHTML=`<style>${Tv}</style>
      <div class="stage"><canvas part="canvas"></canvas><div class="msg" hidden></div></div>
      <div class="ss-bar" part="controls">${bl()}</div>`;let e=s=>t.querySelector(s),n=wl(e(".ss-bar"));this._ui={stage:e(".stage"),canvas:e("canvas"),msg:e(".msg"),bar:e(".ss-bar"),col:n.col,contacts:n.contacts,theme:n.theme},this._setData(!1,"Loading the run"),this._view=null,this._bar=El(n,{stepDt:()=>this._info?this._info.dt:.02,onLoop:s=>this.toggleAttribute("loop",s),outside:document,camera:{view:()=>this._view,setView:s=>this.setView(s),frame:()=>this._player&&this._player.frame("focus"),follow:()=>this._player?this._player.follow().mode:"off",setFollow:s=>{this._player&&this._player.setFollow({mode:s}),this.setAttribute("follow",s)}},collision:{on:()=>this.hasAttribute("collision"),set:s=>this.toggleAttribute("collision",s)},contacts:{on:()=>this.hasAttribute("contacts"),set:s=>this.toggleAttribute("contacts",s)},theme:{dark:()=>this._theme()==="dark",toggle:()=>this.setAttribute("theme",this._theme()==="dark"?"light":"dark")}}),this._player=null,this._clock=null,this._loading=null,this._loaded=!1,this._visible=!1,this._autoplayDone=!1,this._failed=!1,this._poster=null,this._info=null,this._onTime=()=>this._time(),this._onEnded=()=>this._emit("ended")}connectedCallback(){this.parentElement===document.body?(this._fill??=Object.assign(document.createElement("style"),{textContent:wv}),this.shadowRoot.appendChild(this._fill)):this._fill&&this._fill.remove();let t=this.parentElement;t&&t.tagName==="FIGURE"&&t.parentElement===document.body&&!document.getElementById(ep)&&document.head.appendChild(Object.assign(document.createElement("style"),{id:ep,textContent:Ev})),this._ensurePlayer(),this._resize=new ResizeObserver(()=>this._measure()),this._resize.observe(this._ui.stage),this._mq=typeof matchMedia=="function"?matchMedia("(prefers-color-scheme: dark)"):null,this._onScheme=()=>this._player&&!this.hasAttribute("theme")&&this._player.setTheme(this._theme(),this._background()),this._mq&&this._mq.addEventListener("change",this._onScheme),this._seen=new IntersectionObserver(e=>{let n=e[e.length-1].isIntersecting;this._setVisible(n)},{rootMargin:"64px"}),this._seen.observe(this),this._measure()}disconnectedCallback(){this._resize.disconnect(),this._seen.disconnect(),this._mq&&this._mq.removeEventListener("change",this._onScheme),this._visible=!1,this._dropLive(),this._player&&(this._unbindClock(),this._bar.setClock(null),this._player.destroy(),this._player=null,this._clock=null,this._loaded=!1,this._loading=null)}attributeChangedCallback(t,e,n){let s=this._player;if(t==="themetoggle"){this._ui.theme.hidden=!this.hasAttribute("themetoggle");return}t==="src"||t==="run"?this.isConnected&&(this._loaded||this._loading)&&e!==n&&(this.unload(),this._visible&&this.load().catch(()=>{})):s&&(t==="loop"?this._clock.loop=this.hasAttribute("loop"):t==="speed"?this.setSpeed(Number(n)):t==="view"?this.setView(n):t==="contacts"?this._applyRoles():t==="background"?s.setBackground(this._background()):t==="collision"?this._applyRoles():t==="env"?this._applyEnv():t==="follow"?(this._applyFollow(),this._bar.paint()):t==="ground"?s.setGround(this._ground()):t==="theme"?(s.setTheme(this._theme(),this._background()),this._bar.paint()):t==="sync"&&this._rebindClock())}_background(){let t=this.getAttribute("background");return t===null||t===""?void 0:t}_theme(){let t=this.getAttribute("theme");return t==="dark"||t==="light"?t:typeof matchMedia=="function"&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}_ground(){let t=this.getAttribute("ground");return Sv.includes(t)?t:"checker"}_followMode(){let t=this.getAttribute("follow");if(t!==null)return t===""||t==="true"?"position":Mv.includes(t)?t:"off"}_env(){let t=Number(this.getAttribute("env"));return Number.isInteger(t)&&t>=0?t:0}_ensurePlayer(){if(this._player)return;let t=this.getAttribute("view");this._clock=this.hasAttribute("sync")?Qi(this.getAttribute("sync")):null;let e;try{e=new Zs(this._ui.canvas,{clock:this._clock||void 0,theme:this._theme(),ground:this._ground(),view:Zi.includes(t)?t:"iso",background:this._background(),follow:this._followMode()})}catch(s){this._fail(new Error(`simscope: WebGL is not available (${s.message})`));return}this._player=e,this._view=Zi.includes(t)?t:"iso",this._clock=e.clock,this._clock.loop=this.hasAttribute("loop")||this._clock.loop;let n=Number(this.getAttribute("speed"));n>0&&(this._clock.speed=n),this._bindClock(),e.addEventListener("error",s=>this._fail(new Error(s.detail.message))),e.addEventListener("live",()=>this._buildUi(this._info)),e.addEventListener("camera",()=>{this._view!==null&&(this._view=null,this._bar.paint())}),e.addEventListener("follow",()=>this._bar.paint()),this._bar.setClock(this._clock),this._measure()}_bindClock(){this._clock.addEventListener("time",this._onTime),this._clock.addEventListener("ended",this._onEnded)}_unbindClock(){this._clock&&(this._clock.removeEventListener("time",this._onTime),this._clock.removeEventListener("ended",this._onEnded))}_rebindClock(){if(!this._player)return;let t=this._loaded||!!this._loading;this.unload(),this._unbindClock(),this._player.destroy(),this._player=null,this._ensurePlayer(),t&&this._visible&&this.load().catch(()=>{})}_measure(){if(!this._player)return;let t=this._ui.stage.getBoundingClientRect();t.width>0&&t.height>0&&this._player.resize(t.width,t.height,Math.min(window.devicePixelRatio||1,2))}_setVisible(t){this._visible=t,this._player&&t&&(this._touchLive(),!this._loaded&&!this._loading&&!this._failed&&this.getAttribute("src")?this.load().catch(()=>{}):this._loaded&&this._maybeAutoplay())}_touchLive(){let t=Ci.indexOf(this);t>=0&&Ci.splice(t,1),Ci.push(this)}_dropLive(){let t=Ci.indexOf(this);t>=0&&Ci.splice(t,1)}static _evict(){for(;Ci.length>bv;){let t=Ci.findIndex(n=>!n._visible);if(t<0)return;let[e]=Ci.splice(t,1);e.unload(!0)}}load(){if(this._loading)return this._loading;if(this._ensurePlayer(),!this._player)return this._loadPosterOnly();this._failed=!1;let t=this._load().catch(n=>{throw this._failed=!0,this._fail(n),n});this._loading=t;let e=()=>{this._loading===t&&(this._loading=null)};return t.then(e,e),t}async _loadPosterOnly(){let t=this.getAttribute("src"),e=new Error("simscope: WebGL is not available");if(t)try{let n=await this._openSource(t),s=this.getAttribute("run")||(await n.runs())[0];this._showPoster(n,s)}catch{}return Promise.reject(e)}async _load(){let t=this.getAttribute("src");if(!t)throw new Error("simscope: <simscope-player> has no src attribute");this._ui.msg.hidden=!0;let e=await this._openSource(t);this._touchLive(),i._evict();let n=this._env(),s=await this._player.load(e,this.getAttribute("run")||void 0,{envs:n?[n]:void 0});return this._loaded=!0,this._info=s,this._source=e,this._showPoster(e,s.run),this._buildUi(s),this._applyRoles(),this._applyFollow(),this._clock.loop=this.hasAttribute("loop")||this._clock.loop,this._emit("ready",{duration:s.duration,frames:s.frames,dt:s.dt,run:s.run,events:s.events}),this._maybeAutoplay(),s}async _openSource(t){if(!t.startsWith("#"))return $i.open(await this._fetchBytes(t));let e=t.slice(1),n=this.getRootNode().getElementById?.(e)??document.getElementById(e);if(!n)throw new Error(`simscope: no element with id "${e}" for src="${t}"`);let s=Rh.get(n);return s||(s=$i.open(Ph(n.textContent.trim())),Rh.set(n,s),s.catch(()=>Rh.delete(n))),s}async _fetchBytes(t){let e;try{e=await fetch(t)}catch(n){throw new Error(`simscope: could not fetch ${t} (${n.message}); file:// pages must use src="#id"`)}if(!e.ok)throw new Error(`simscope: fetching ${t} failed with HTTP ${e.status}`);return new Uint8Array(await e.arrayBuffer())}_showPoster(t,e){this._player||this._poster||!e||t.get(`runs/${e}/poster.png`).then(n=>{this._poster||(this._poster=document.createElement("img"),this._poster.className="poster",this._poster.alt="",this._poster.src=URL.createObjectURL(new Blob([n],{type:"image/png"})),this._ui.stage.insertBefore(this._poster,this._ui.msg))}).catch(()=>{})}unload(t=!1){this._loading=null,this._loaded=!1,this._failed=!1,this._autoplayDone=!1,this._info=null,this._dropLive(),this._player&&this._player.unload({keepFrame:t}),this._poster&&(URL.revokeObjectURL(this._poster.src),this._poster.remove(),this._poster=null),this._setData(!1,"No run loaded"),this._bar.paint()}_fail(t){this._ui.msg.textContent=t.message,this._ui.msg.hidden=!1,this._emit("error",{message:t.message})}_emit(t,e={}){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}_buildUi(t){t&&(this._setData(!0,"",t),this._time(),this._bar.paint())}_setData(t,e,n={}){Ks(this._ui.col,t&&!!n.hasCollision,"Collision geometry",t?"No collision geometry in this run":e),Ks(this._ui.contacts,t&&!!n.hasContacts,"Contact forces",t?"No contact data in this run":e)}_time(){let t=this._clock;t&&this._emit("timeupdate",{t:t.time,duration:t.duration})}_applyRoles(){if(!this._player)return;let t=this.hasAttribute("collision");this._player.setCollision(t),this._player.setContacts(this.hasAttribute("contacts")),this._bar.paint()}_applyEnv(){!this._player||!this._loaded||(this._player.selectEnv(this._env()),this._info&&this._loadHighlights(this._info.run))}_applyFollow(){if(!this._player)return;let t=this._followMode();t!==void 0&&this._player.setFollow({mode:t})}async _maybeAutoplay(){if(this._autoplayDone||!this.hasAttribute("autoplay")||!this._visible||!this._loaded)return;this._autoplayDone=!0;let t=this._player;try{await(t&&t._extentJob)}catch{}this._player===t&&this._loaded&&this.play()}play(){this._clock&&this._clock.play()}pause(){this._clock&&this._clock.pause()}seek(t){this._clock&&this._clock.seek(t)}setSpeed(t){this._clock&&(this._clock.speed=t)}setView(t){!this._player||!Zi.includes(t)||(this._player.setView(t),this._view=t,this._bar.paint())}get player(){return this._player}get clock(){return this._clock}async snapshot(){if(!this._player)throw new Error("simscope: nothing to snapshot (not loaded or no WebGL)");return this._player.snapshot()}get currentTime(){return this._clock?this._clock.time:0}get duration(){return this._clock?this._clock.duration:0}get playing(){return!!this._clock&&this._clock.playing}};function Ih(i="simscope-player"){customElements.get(i)||customElements.define(i,Jr)}var Av=["side","stack","grid"];function Lh(i,t){return Av.includes(i)?i:t<=2?"side":"grid"}function np(i,t){let e=Math.max(i,1),n=Lh(t,e);return n==="stack"?{cols:1,rows:e}:n==="side"||e<=2?{cols:e,rows:1}:{cols:2,rows:Math.ceil(e/2)}}var ip="ss-master-style",Cv=`
#ss-master { ${jn.light} position: fixed; inset: 0; z-index: 1; display: flex; flex-direction: column; background: var(--ss-bg); color: var(--ss-fg); font: 12px/16px ${$s}; }
@media (prefers-color-scheme: dark) { #ss-master { ${jn.dark} } }
#ss-master[data-theme="light"] { ${jn.light} }
#ss-master[data-theme="dark"] { ${jn.dark} }
#ss-master[hidden] { display: none; }
#ss-master .ss-stage { flex: 1; min-height: 0; display: grid; gap: 1px; background: var(--ss-border); }
#ss-master figure { position: relative; margin: 0; min-width: 0; min-height: 0; overflow: hidden; background: var(--ss-viewport); }
#ss-master .ss-empty { background: var(--ss-bg); }
#ss-master figure > simscope-player { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 0; aspect-ratio: auto; border: 0; border-radius: 0; }
#ss-master figcaption { position: absolute; left: 8px; top: 8px; z-index: 2; box-sizing: border-box; max-width: calc(100% - 16px); height: 24px; padding: 0 8px;
  display: flex; align-items: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; background: var(--ss-bg); color: var(--ss-fg);
  border: 1px solid var(--ss-border); border-radius: 6px; font-weight: 500; pointer-events: none; }
${Sl}
`;function sp(i,t="compare"){let e=i.ownerDocument||document,n=[...e.querySelectorAll(`simscope-player[sync="${t}"]`)],s=Qi(t);if(s.loop=i.getAttribute("data-loop")==="1",!e.getElementById(ip)){let A=e.createElement("style");A.id=ip,A.textContent=Cv,e.head.appendChild(A)}let r=n.map(A=>{let P=A.closest("figure");return P||(P=e.createElement("figure"),P.appendChild(A)),A.setAttribute("nocontrols",""),P}),o=Lh(i.getAttribute("data-arrange"),r.length),{cols:a,rows:l}=np(r.length,o),c=e.createElement("div");c.className="ss-stage",c.style.gridTemplateColumns=`repeat(${a}, minmax(0, 1fr))`,c.style.gridTemplateRows=`repeat(${l}, minmax(0, 1fr))`;for(let A of r)c.appendChild(A);for(let A=r.length;A<a*l;A++){let P=e.createElement("div");P.className="ss-empty",c.appendChild(P)}let u=e.createElement("div");u.className="ss-bar",u.innerHTML=bl(),i.replaceChildren(c,u),i.removeAttribute("hidden"),i.setAttribute("data-arrange",o);let f=()=>{let A=n.map(P=>P.player&&P.player.info()&&P.player.info().dt).filter(P=>P>0);return A.length?Math.min(...A):.02},h=()=>n.map(A=>A.player).filter(Boolean),p=n[0]&&n[0].getAttribute("view"),g=["iso","front","side","top"].includes(p)?p:"iso",_=!1,m=!1,d=wl(u),M=()=>typeof matchMedia=="function"&&matchMedia("(prefers-color-scheme: dark)").matches,E=()=>(i.getAttribute("data-theme")||(M()?"dark":"light"))==="dark";d.theme.hidden=!1;let y=El(d,{stepDt:f,outside:e,theme:{dark:E,toggle:()=>{let A=E()?"light":"dark";i.setAttribute("data-theme",A);for(let P of n)P.setAttribute("theme",A)}},camera:{view:()=>g,setView:A=>{let P=h();for(let D of P.length>1?P.slice(0,1):P)D.setView(A);g=A},frame:()=>{let A=h();for(let P of A.length>1?A.slice(0,1):A)P.frame("focus")},follow:()=>{let A=h()[0];return A&&A.follow?A.follow().mode:"off"},setFollow:A=>{for(let P of n)P.player&&P.player.setFollow&&P.player.setFollow({mode:A}),P.setAttribute("follow",A)}},collision:{on:()=>_,set:A=>{_=A;for(let P of n)A?P.setAttribute("collision",""):P.removeAttribute("collision")}},contacts:{on:()=>m,set:A=>{m=A;for(let P of n)A?P.setAttribute("contacts",""):P.removeAttribute("contacts")}}});y.setClock(s);for(let A of h())A.addEventListener("camera",()=>g!==null&&(g=null,y.paint()));let b=()=>{let A=P=>h().some(D=>D.info()&&D.info()[P]);Ks(d.col,A("hasCollision"),"Collision geometry","No collision geometry in these runs"),Ks(d.contacts,A("hasContacts"),"Contact forces","No contact data in these runs")};b();let S=A=>{A.target&&/^(input|button|select)$/i.test(A.target.tagName||"")||(A.key===" "?(A.preventDefault?.(),s.toggle()):(A.key==="ArrowLeft"||A.key==="ArrowRight")&&(s.pause(),s.step(A.key==="ArrowLeft"?-1:1,f())))};e.addEventListener("keydown",S);let C=n.map(A=>A.player).filter(Boolean),v=C.length>1?so(C):()=>{},T=new Set,R=A=>{T.add(A),!(T.size<n.length)&&i.getAttribute("data-autoplay")==="1"&&Promise.all(C.map(P=>P._extentJob)).then(()=>s.duration>0&&s.play(),()=>s.play())};for(let A of n)A.addEventListener("ready",()=>{b(),R(A)}),A.addEventListener("error",()=>R(A));return{clock:s,arrange:o,dispose(){e.removeEventListener("keydown",S),v(),y.dispose()}}}Ih();return gp(Rv);})();
