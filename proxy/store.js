/* FL0W3R Store + 20 mini games. Self-contained: window.FLStore */
(function(){
const rnd=n=>Math.floor(Math.random()*n), pick=a=>a[rnd(a.length)];
const acc=()=>getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()||"#ff8fc0";
const bk=k=>{try{return JSON.parse(localStorage.getItem("fl-best-"+k))}catch(e){return null}};
const sb=(k,v)=>{try{localStorage.setItem("fl-best-"+k,JSON.stringify(v))}catch(e){}};

/* ---- helpers ---- */
function G(){const c=[];return{
  on(t,e,f){t.addEventListener(e,f);c.push(()=>t.removeEventListener(e,f))},
  iv(f,ms){const i=setInterval(f,ms);c.push(()=>clearInterval(i));return i},
  to(f,ms){const i=setTimeout(f,ms);c.push(()=>clearTimeout(i));return i},
  raf(f){let a,on=1,p=0;const l=t=>{if(!on)return;f(Math.min(3,(t-(p||t))/16.67));p=t;a=requestAnimationFrame(l)};a=requestAnimationFrame(l);c.push(()=>{on=0;cancelAnimationFrame(a)})},
  end(){c.forEach(f=>f())}}}
function swipe(g,el,f){let s;el.style.touchAction="none";g.on(el,"pointerdown",e=>{s=[e.clientX,e.clientY]});g.on(el,"pointerup",e=>{if(!s)return;const dx=e.clientX-s[0],dy=e.clientY-s[1];s=0;if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;f(Math.abs(dx)>Math.abs(dy)?(dx>0?"r":"l"):(dy>0?"d":"u"))})}
function keys(g,f){g.on(document,"keydown",e=>{const m={ArrowLeft:"l",ArrowRight:"r",ArrowUp:"u",ArrowDown:"d",a:"l",d:"r",w:"u",s:"d"}[e.key];if(m){e.preventDefault();f(m)}})}
function cv(ga,w,h){const c=document.createElement("canvas");c.width=w;c.height=h;c.className="gc";c.style.aspectRatio=w+"/"+h;ga.appendChild(c);return c}
function drag(g,c,f){const m=e=>{const r=c.getBoundingClientRect();f((e.clientX-r.left)/r.width*c.width)};c.style.touchAction="none";g.on(c,"pointermove",m);g.on(c,"pointerdown",m)}
function timer(g,ui,sec,done){let t=sec;ui.msg("⏱ "+t+"s");const i=g.iv(()=>{t--;ui.msg("⏱ "+t+"s");if(t<=0){clearInterval(i);done()}},1000)}
function grid(ga,cls,n,fn){const d=document.createElement("div");d.className="gg "+cls;d.style.gridTemplateColumns="repeat("+n+",1fr)";ga.appendChild(d);return d}

/* ---- games ---- */
const GAMES=[
{id:"g-snake",name:"Snake",e:"🐍",d:"Eat, grow, don't crash. Swipe or arrow keys.",run(ga,g,ui){
  const c=cv(ga,300,300),x=c.getContext("2d");let s=[[7,7],[6,7],[5,7]],d="r",nd="r",f,sc=0,dead=0;
  const food=()=>{do f=[rnd(15),rnd(15)];while(s.some(p=>p[0]==f[0]&&p[1]==f[1]))};food();ui.score(0);
  const turn=k=>{if(k!=({l:"r",r:"l",u:"d",d:"u"})[d])nd=k};keys(g,turn);swipe(g,c,turn);
  const draw=()=>{x.fillStyle="#14141c";x.fillRect(0,0,300,300);x.fillStyle="#ff5a7a";x.fillRect(f[0]*20+3,f[1]*20+3,14,14);x.fillStyle=acc();s.forEach(p=>x.fillRect(p[0]*20+1,p[1]*20+1,18,18));if(dead){x.fillStyle="#fff";x.font="20px sans-serif";x.textAlign="center";x.fillText("Game over — press ↻",150,150)}};
  g.iv(()=>{if(dead)return;d=nd;const h=[s[0][0]+(d=="r")-(d=="l"),s[0][1]+(d=="d")-(d=="u")];
    if(h[0]<0||h[1]<0||h[0]>14||h[1]>14||s.some(p=>p[0]==h[0]&&p[1]==h[1])){dead=1;draw();return}
    s.unshift(h);if(h[0]==f[0]&&h[1]==f[1]){ui.score(++sc);food()}else s.pop();draw()},120);draw()}},

{id:"g-ttt",name:"Tic-Tac-Toe",e:"❌",d:"You are X. Beat the computer.",run(ga,g,ui){
  let b=Array(9).fill(""),over=0;const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const win=b=>{for(const[a,c,d]of L)if(b[a]&&b[a]==b[c]&&b[a]==b[d])return b[a];return b.includes("")?null:"T"};
  const mm=(b,p)=>{const r=win(b);if(r)return r=="O"?1:r=="X"?-1:0;let m=p=="O"?-2:2;for(let i=0;i<9;i++)if(!b[i]){b[i]=p;const v=mm(b,p=="O"?"X":"O");b[i]="";m=p=="O"?Math.max(m,v):Math.min(m,v)}return m};
  const B=grid(ga,"s3",3),btn=[];for(let i=0;i<9;i++){const k=document.createElement("button");k.className="cell";B.appendChild(k);btn.push(k);k.onclick=()=>{if(over||b[i])return;b[i]="X";fin()||ai();}}
  const show=()=>btn.forEach((k,i)=>k.textContent=b[i]);
  const fin=()=>{show();const r=win(b);if(!r)return 0;over=1;ui.msg(r=="X"?"You win! 🎉":r=="O"?"Computer wins":"Draw");if(r=="X")ui.score(1);return 1};
  const ai=()=>{const e=b.map((v,i)=>v?-1:i).filter(i=>i>=0);let bi=pick(e);if(Math.random()<.8){let bv=-3;e.forEach(i=>{b[i]="O";const v=mm(b,"X");b[i]="";if(v>bv){bv=v;bi=i}})}b[bi]="O";fin()};ui.msg("Your move");}},

{id:"g-mem",name:"Memory Match",e:"🧠",d:"Find all the pairs in the fewest moves.",run(ga,g,ui){
  const em=["🍎","🐱","🚀","🌸","⚽","🎧","🍕","🌙"],cs=[...em,...em].sort(()=>Math.random()-.5);let a=null,lock=0,mv=0,got=0;
  const B=grid(ga,"s4",4);cs.forEach((v,i)=>{const k=document.createElement("button");k.className="cell";k.textContent="❔";B.appendChild(k);k.onclick=()=>{if(lock||k.dataset.o)return;k.textContent=v;k.dataset.o=1;if(a==null){a=i;return}
    mv++;ui.msg("Moves: "+mv);const pa=B.children[a];if(cs[a]==v){got++;a=null;if(got==8){ui.msg("Cleared in "+mv+" moves!");ui.score(mv,1)}}else{lock=1;g.to(()=>{k.textContent=pa.textContent="❔";delete k.dataset.o;delete pa.dataset.o;a=null;lock=0},700)}}});ui.msg("Moves: 0")}},

{id:"g-2048",name:"2048",e:"🔢",d:"Slide and merge tiles. Swipe or arrows.",run(ga,g,ui){
  const T=Array.from({length:4},()=>[0,0,0,0]);let sc=0;const B=grid(ga,"s4 t",4);
  const add=()=>{const e=[];T.forEach((r,i)=>r.forEach((v,j)=>v||e.push([i,j])));if(e.length){const[i,j]=pick(e);T[i][j]=Math.random()<.9?2:4}};
  const slide=r=>{r=r.filter(v=>v);for(let i=0;i<r.length-1;i++)if(r[i]==r[i+1]){r[i]*=2;sc+=r[i];r.splice(i+1,1)}while(r.length<4)r.push(0);return r};
  const draw=()=>{B.innerHTML="";T.flat().forEach(v=>{const k=document.createElement("div");k.className="cell";k.textContent=v||"";if(v)k.style.background="hsl("+(Math.log2(v)*38+300)%360+",60%,"+(v>64?42:50)+"%)";B.appendChild(k)});ui.score(sc)};
  const mv=k=>{let ch=0;for(let i=0;i<4;i++){const co=[0,1,2,3].map(j=>k=="l"?[i,j]:k=="r"?[i,3-j]:k=="u"?[j,i]:[3-j,i]),o=co.map(([r,c])=>T[r][c]),n=slide(o.slice());if(n.join()!=o.join())ch=1;co.forEach(([r,c],j)=>T[r][c]=n[j])}
    if(ch)add();draw();if(!T.flat().includes(0)&&!T.some((r,i)=>r.some((v,j)=>v==(r[j+1]||-1)||v==(T[i+1]&&T[i+1][j]))))ui.msg("Game over — press ↻")};
  keys(g,mv);swipe(g,B,mv);add();add();draw()}},

{id:"g-flap",name:"Flappy",e:"🐤",d:"Tap or press space to flap through the gaps.",run(ga,g,ui){
  const c=cv(ga,300,400),x=c.getContext("2d");let y=200,v=0,p=[],t=0,sc=0,dead=0;ui.score(0);
  const fl=()=>{if(dead)return;v=-6.2};g.on(c,"pointerdown",fl);g.on(document,"keydown",e=>{if(e.key==" "){e.preventDefault();fl()}});
  g.raf(d=>{if(!dead){v+=.38*d;y+=v*d;t+=d;if(t>90){t=0;p.push({x:300,g:90+rnd(180),s:0})}
    p.forEach(o=>{o.x-=2.4*d;if(!o.s&&o.x<4){o.s=1;ui.score(++sc)}if(o.x<72&&o.x>4&&(y<o.g-48||y>o.g+48))dead=1});p=p.filter(o=>o.x>-50);if(y>392||y<0)dead=1}
    x.fillStyle="#14141c";x.fillRect(0,0,300,400);x.fillStyle="#3ec97a";p.forEach(o=>{x.fillRect(o.x,0,44,o.g-48);x.fillRect(o.x,o.g+48,44,400)});
    x.fillStyle=acc();x.beginPath();x.arc(60,y,12,0,7);x.fill();if(dead){x.fillStyle="#fff";x.font="20px sans-serif";x.textAlign="center";x.fillText("Game over — press ↻",150,200)}})}},

{id:"g-mole",name:"Whack-a-Mole",e:"🔨",d:"30 seconds. Smack every mole you see.",run(ga,g,ui){
  let sc=0,m=-1,on=1;const B=grid(ga,"s3",3),k=[];for(let i=0;i<9;i++){const b=document.createElement("button");b.className="cell";b.onclick=()=>{if(on&&i==m){ui.score(++sc);b.textContent="💥";m=-1}};B.appendChild(b);k.push(b)}
  const up=()=>{k.forEach(b=>b.textContent="🕳️");if(on){m=rnd(9);k[m].textContent="🐹"}};g.iv(up,750);ui.score(0);timer(g,ui,30,()=>{on=0;m=-1;up();ui.msg("Time! Press ↻")})}},

{id:"g-react",name:"Reaction Test",e:"⚡",d:"Tap the instant it turns green.",run(ga,g,ui){
  const b=document.createElement("button");b.className="big";ga.appendChild(b);let st=0,t0=0,h;
  const arm=()=>{st=1;b.style.background="#c0392b";b.textContent="Wait for green…";h=g.to(()=>{st=2;t0=performance.now();b.style.background="#27ae60";b.textContent="TAP!"},1500+rnd(2500))};
  b.onclick=()=>{if(st==1){clearTimeout(h);st=0;b.style.background="#555";b.textContent="Too soon! Tap to retry"}else if(st==2){const ms=Math.round(performance.now()-t0);st=0;b.style.background="#555";b.textContent=ms+" ms — tap to retry";ui.score(ms,1)}else arm()};
  b.style.background="#555";b.textContent="Tap to start"}},

{id:"g-simon",name:"Simon",e:"🎹",d:"Repeat the growing pattern.",run(ga,g,ui){
  const cols=["#e74c3c","#3498db","#f1c40f","#2ecc71"],B=grid(ga,"s2",2),k=[];let seq=[],i=0,lock=1;
  const fl=n=>{k[n].style.opacity=1;g.to(()=>k[n].style.opacity=.4,300)};
  cols.forEach((c,n)=>{const b=document.createElement("button");b.className="cell simon";b.style.background=c;b.style.opacity=.4;b.onclick=()=>{if(lock)return;fl(n);if(seq[i]!=n){lock=1;ui.msg("Wrong! Press ↻");return}i++;if(i==seq.length)g.to(next,600)};B.appendChild(b);k.push(b)});
  const next=()=>{seq.push(rnd(4));i=0;lock=1;ui.score(seq.length-1);ui.msg("Watch…");seq.forEach((n,j)=>g.to(()=>fl(n),j*600+300));g.to(()=>{lock=0;ui.msg("Your turn")},seq.length*600+300)};g.to(next,500)}},

{id:"g-mine",name:"Minesweeper",e:"💣",d:"Clear the board. Tap 🚩 to switch to flag mode.",run(ga,g,ui){
  const N=8,M=10;let mines=null,rev=Array(64).fill(0),fg=Array(64).fill(0),over=0,flag=0,left=64-M;
  const nb=i=>{const r=[],y=i>>3,x=i&7;for(let a=-1;a<2;a++)for(let b=-1;b<2;b++){const yy=y+a,xx=x+b;if((a||b)&&yy>=0&&yy<N&&xx>=0&&xx<N)r.push(yy*8+xx)}return r};
  const cnt=i=>nb(i).filter(j=>mines[j]).length;
  const tg=document.createElement("button");tg.className="btn2";tg.textContent="⛏ Dig mode";tg.onclick=()=>{flag=!flag;tg.textContent=flag?"🚩 Flag mode":"⛏ Dig mode"};ga.appendChild(tg);
  const B=grid(ga,"s8",8),k=[];
  const draw=()=>k.forEach((b,i)=>{b.className="cell sm"+(rev[i]?" open":"");b.textContent=rev[i]?(mines[i]?"💣":cnt(i)||""):fg[i]?"🚩":""});
  const open=i=>{if(rev[i]||fg[i])return;rev[i]=1;left--;if(!mines[i]&&!cnt(i))nb(i).forEach(open)};
  for(let i=0;i<64;i++){const b=document.createElement("button");b.className="cell sm";B.appendChild(b);k.push(b);
    b.oncontextmenu=e=>{e.preventDefault();if(!rev[i]&&!over){fg[i]=!fg[i];draw()}};
    b.onclick=()=>{if(over||rev[i])return;if(flag){fg[i]=!fg[i];draw();return}
      if(!mines){mines=Array(64).fill(0);let n=0;while(n<M){const j=rnd(64);if(!mines[j]&&j!=i&&!nb(i).includes(j)){mines[j]=1;n++}}}
      if(fg[i])return;if(mines[i]){over=1;rev=rev.map(()=>1);ui.msg("Boom! Press ↻")}else{open(i);if(left==0){over=1;ui.msg("You cleared it! 🎉");ui.score(1)}}draw()}}
  ui.msg("10 mines")}},

{id:"g-pong",name:"Pong",e:"🏓",d:"Move the bottom paddle. Don't miss.",run(ga,g,ui){
  const c=cv(ga,300,400),x=c.getContext("2d");let px=150,ax=150,bx=150,by=200,vx=2,vy=3,sc=0,dead=0;ui.score(0);drag(g,c,v=>px=v);
  g.on(document,"keydown",e=>{if(e.key=="ArrowLeft")px-=24;if(e.key=="ArrowRight")px+=24});
  g.raf(d=>{if(!dead){bx+=vx*d;by+=vy*d;if(bx<5||bx>295)vx=-vx;ax+=Math.max(-2.2,Math.min(2.2,bx-ax))*d;
    if(vy>0&&by>376&&by<390&&Math.abs(bx-px)<34){vy=-Math.abs(vy)*1.04;vx+=(bx-px)/14;ui.score(++sc)}
    if(vy<0&&by<24&&Math.abs(bx-ax)<34)vy=Math.abs(vy);if(by<0){sc+=3;ui.score(sc);by=200;bx=150;vy=3}if(by>410)dead=1}
    x.fillStyle="#14141c";x.fillRect(0,0,300,400);x.fillStyle="#999";x.fillRect(ax-30,12,60,8);x.fillStyle=acc();x.fillRect(px-30,380,60,8);x.beginPath();x.arc(bx,by,6,0,7);x.fill();
    if(dead){x.fillStyle="#fff";x.font="20px sans-serif";x.textAlign="center";x.fillText("Game over — press ↻",150,200)}})}},

{id:"g-break",name:"Breakout",e:"🧱",d:"Bounce the ball to smash every brick.",run(ga,g,ui){
  const c=cv(ga,300,400),x=c.getContext("2d");let px=150,bx=150,by=300,vx=2.2,vy=-3.2,sc=0,dead=0;const br=[];for(let r=0;r<5;r++)for(let q=0;q<7;q++)br.push({x:q*42+4,y:r*18+30,a:1});ui.score(0);drag(g,c,v=>px=v);
  g.on(document,"keydown",e=>{if(e.key=="ArrowLeft")px-=24;if(e.key=="ArrowRight")px+=24});
  g.raf(d=>{if(!dead){bx+=vx*d;by+=vy*d;if(bx<5||bx>295)vx=-vx;if(by<5)vy=Math.abs(vy);if(vy>0&&by>372&&by<388&&Math.abs(bx-px)<36){vy=-Math.abs(vy);vx+=(bx-px)/16}
    br.forEach(o=>{if(o.a&&bx>o.x&&bx<o.x+38&&by>o.y&&by<o.y+14){o.a=0;vy=-vy;ui.score(++sc)}});if(by>410)dead=1;if(sc==35){dead=2}}
    x.fillStyle="#14141c";x.fillRect(0,0,300,400);br.forEach((o,i)=>{if(o.a){x.fillStyle="hsl("+(i/7|0)*55+",70%,55%)";x.fillRect(o.x,o.y,38,14)}});
    x.fillStyle=acc();x.fillRect(px-36,380,72,8);x.beginPath();x.arc(bx,by,6,0,7);x.fill();
    if(dead){x.fillStyle="#fff";x.font="20px sans-serif";x.textAlign="center";x.fillText(dead==2?"You win! 🎉":"Game over — press ↻",150,250)}})}},

{id:"g-guess",name:"Number Guess",e:"🎯",d:"Find the secret number from 1 to 100.",run(ga,g,ui){
  const n=1+rnd(100);let t=0;ga.innerHTML='<div class="gtxt" id="gh">I’m thinking of a number 1–100</div><input class="inp" type="number" min="1" max="100" placeholder="Your guess"><button class="btn2">Guess</button>';
  const i=ga.querySelector("input"),h=ga.querySelector("#gh"),go=()=>{const v=+i.value;if(!v)return;t++;i.value="";if(v==n){h.textContent="🎉 "+v+" is right! "+t+" tries";ui.score(t,1)}else h.textContent=(v<n?"⬆ Higher":"⬇ Lower")+" than "+v+" ("+t+" tries)"};
  ga.querySelector("button").onclick=go;i.onkeydown=e=>{if(e.key=="Enter")go()}}},

{id:"g-rps",name:"Rock Paper Scissors",e:"✌️",d:"Best streak wins.",run(ga,g,ui){
  const o=["✊","✋","✌️"];let st=0;ga.innerHTML='<div class="gtxt" id="gh" style="font-size:40px">❔ vs ❔</div><div class="row2"></div>';const r=ga.querySelector(".row2"),h=ga.querySelector("#gh");
  o.forEach((e,i)=>{const b=document.createElement("button");b.className="cell";b.textContent=e;b.onclick=()=>{const c=rnd(3),w=(i-c+3)%3;h.textContent=e+" vs "+o[c];if(w==0)ui.msg("Draw");else if(w==1){st++;ui.msg("You win! 🎉");ui.score(st)}else{st=0;ui.msg("You lose — streak reset")}};r.appendChild(b)});ui.score(0)}},

{id:"g-tap",name:"Tap Speed",e:"👆",d:"How many taps in 10 seconds?",run(ga,g,ui){
  let n=0,on=0;const b=document.createElement("button");b.className="big";b.textContent="Tap to start!";ga.appendChild(b);
  b.onclick=()=>{if(on==2)return;if(!on){on=1;n=0;timer(g,ui,10,()=>{on=2;b.textContent="Done: "+n+" taps";ui.score(n)})}if(on==1){n++;b.textContent=n}}}},

{id:"g-color",name:"Color Clash",e:"🎨",d:"Does the word match its ink color? 30 seconds.",run(ga,g,ui){
  const C={RED:"#e74c3c",BLUE:"#3498db",GREEN:"#2ecc71",YELLOW:"#f1c40f"},K=Object.keys(C);let sc=0,ok=0,on=1;
  ga.innerHTML='<div class="gtxt" id="gw" style="font-size:44px;font-weight:800"></div><div class="row2"><button class="btn2" data-v="1">✔ Match</button><button class="btn2" data-v="0">✖ No match</button></div>';
  const w=ga.querySelector("#gw"),nx=()=>{const t=pick(K),i=Math.random()<.5?t:pick(K.filter(k=>k!=t));w.textContent=t;w.style.color=C[i];ok=t==i};nx();
  ga.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{if(!on)return;sc=Math.max(0,sc+(+b.dataset.v==ok?1:-1));ui.score(sc);nx()});ui.score(0);
  timer(g,ui,30,()=>{on=0;ui.msg("Time! Press ↻")})}},

{id:"g-lights",name:"Lights Out",e:"💡",d:"Turn every light off. Taps flip neighbors too.",run(ga,g,ui){
  const L=Array(25).fill(0);let mv=0;const tg=i=>{[i,i-5,i+5,i%5?i-1:-1,i%5<4?i+1:-1].forEach(j=>{if(j>=0&&j<25)L[j]^=1})};for(let i=0;i<25;i++)if(Math.random()<.5)tg(i);if(!L.includes(1))tg(12);
  const B=grid(ga,"s5",5),k=[];const draw=()=>k.forEach((b,i)=>b.style.background=L[i]?acc():"#2a2a36");
  for(let i=0;i<25;i++){const b=document.createElement("button");b.className="cell";B.appendChild(b);k.push(b);b.onclick=()=>{if(!L.includes(1))return;tg(i);mv++;draw();ui.msg("Moves: "+mv);if(!L.includes(1)){ui.msg("Solved in "+mv+"! 🎉");ui.score(mv,1)}}}draw();ui.msg("Moves: 0")}},

{id:"g-dodge",name:"Dodge",e:"☄️",d:"Drag left and right. Survive as long as you can.",run(ga,g,ui){
  const c=cv(ga,300,400),x=c.getContext("2d");let px=150,o=[],t=0,s=0,dead=0;drag(g,c,v=>px=v);
  g.on(document,"keydown",e=>{if(e.key=="ArrowLeft")px-=26;if(e.key=="ArrowRight")px+=26});ui.score(0);
  g.raf(d=>{if(!dead){s+=d/60;t+=d;if(t>Math.max(12,40-s)){t=0;o.push({x:rnd(280),y:-20,v:2+rnd(3)+s/15})}o.forEach(b=>{b.y+=b.v*d;if(b.y>370&&b.y<398&&px>b.x-10&&px<b.x+30)dead=1});o=o.filter(b=>b.y<420);ui.score(Math.floor(s))}
    x.fillStyle="#14141c";x.fillRect(0,0,300,400);x.fillStyle="#ff5a3c";o.forEach(b=>x.fillRect(b.x,b.y,20,20));x.fillStyle=acc();x.fillRect(px-10,380,20,14);
    if(dead){x.fillStyle="#fff";x.font="20px sans-serif";x.textAlign="center";x.fillText("Game over — press ↻",150,200)}})}},

{id:"g-math",name:"Math Sprint",e:"➕",d:"Pick the right answer. 30 seconds.",run(ga,g,ui){
  let sc=0,ans=0,on=1;ga.innerHTML='<div class="gtxt" id="gq" style="font-size:36px;font-weight:800"></div><div class="row2" id="go"></div>';const q=ga.querySelector("#gq"),o=ga.querySelector("#go");
  const nx=()=>{const a=2+rnd(12),b=2+rnd(12),m=rnd(3);ans=m==0?a+b:m==1?a*b:a-b;q.textContent=a+(m==0?" + ":m==1?" × ":" − ")+b;const s=new Set([ans]);while(s.size<4)s.add(ans+rnd(11)-5);o.innerHTML="";[...s].sort(()=>Math.random()-.5).forEach(v=>{const bt=document.createElement("button");bt.className="btn2";bt.textContent=v;bt.onclick=()=>{if(!on)return;if(v==ans)ui.score(++sc);nx()};o.appendChild(bt)})};nx();ui.score(0);
  timer(g,ui,30,()=>{on=0;ui.msg("Time! Press ↻")})}},

{id:"g-slide",name:"Slide Puzzle",e:"🧩",d:"Put the tiles in order 1–8.",run(ga,g,ui){
  const T=[1,2,3,4,5,6,7,8,0];let mv=0,z=8;const sw=(i,j)=>{[T[i],T[j]]=[T[j],T[i]];z=j};const adj=i=>[i-3,i+3,i%3?i-1:-1,i%3<2?i+1:-1].filter(j=>j>=0&&j<9);
  for(let n=0;n<120;n++)sw(z,pick(adj(z)));const B=grid(ga,"s3",3),k=[];
  const draw=()=>k.forEach((b,i)=>{b.textContent=T[i]||"";b.style.visibility=T[i]?"visible":"hidden"});
  for(let i=0;i<9;i++){const b=document.createElement("button");b.className="cell";B.appendChild(b);k.push(b);b.onclick=()=>{if(adj(i).includes(z)){sw(i,z);mv++;draw();ui.msg("Moves: "+mv);if(T.slice(0,8).every((v,j)=>v==j+1)){ui.msg("Solved in "+mv+"! 🎉");ui.score(mv,1)}}}}draw();ui.msg("Moves: 0")}},

{id:"g-c4",name:"Connect Four",e:"🔴",d:"Get four in a row before the computer does.",run(ga,g,ui){
  const R=6,C=7,b=Array(R*C).fill(0);let over=0,w=0;const B=grid(ga,"s7",7),k=[];
  const line=(p)=>{for(let r=0;r<R;r++)for(let c=0;c<C;c++)for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]]){let n=0;for(let i=0;i<4;i++){const y=r+dr*i,x=c+dc*i;if(y<R&&x>=0&&x<C&&b[y*C+x]==p)n++}if(n==4)return 1}return 0};
  const drop=(c,p)=>{for(let r=R-1;r>=0;r--)if(!b[r*C+c]){b[r*C+c]=p;return 1}return 0};
  const draw=()=>k.forEach((e,i)=>e.style.background=b[i]==1?"#e74c3c":b[i]==2?"#f1c40f":"#2a2a36");
  const ai=()=>{const cols=[...Array(C).keys()].filter(c=>!b[c]);if(!cols.length)return;for(const p of[2,1])for(const c of cols){drop(c,p);const hit=line(p);for(let r=0;r<R;r++)if(b[r*C+c]){b[r*C+c]=0;break}if(hit){drop(c,2);return}}
    drop(pick([3,3,2,4,1,5,0,6].filter(c=>cols.includes(c))),2)};
  for(let i=0;i<R*C;i++){const e=document.createElement("button");e.className="cell sm round";B.appendChild(e);k.push(e);e.onclick=()=>{const c=i%C;if(over||!drop(c,1))return;draw();if(line(1)){over=1;ui.msg("You win! 🎉");ui.score(1);return}ai();draw();if(line(2)){over=1;ui.msg("Computer wins — press ↻")}else if(!b.includes(0)){over=1;ui.msg("Draw")}}}
  ui.msg("You are red")}}
];

/* ---- styles ---- */
const css=document.createElement("style");css.textContent=`
.gm{display:flex;flex-direction:column;align-items:center;gap:12px;max-width:420px;margin:0 auto}
.gh{display:flex;width:100%;align-items:center;gap:8px;font-size:13px}.gh .gl{flex:1;color:var(--muted)}.gh .gr{font-weight:600}
.gh button{padding:5px 11px;border-radius:6px;border:1px solid var(--win-border);background:var(--chrome);cursor:pointer}
.ga{width:100%;display:flex;flex-direction:column;align-items:center;gap:12px}
.gc{width:100%;max-width:340px;border-radius:10px;border:1px solid var(--win-border);touch-action:none}
.gg{display:grid;gap:6px;width:100%;max-width:340px}.gg.s7,.gg.s8{gap:3px}.gg.s2{max-width:240px}
.cell{aspect-ratio:1;border:0;border-radius:10px;background:#2a2a36;color:#fff;font-size:26px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.cell.sm{font-size:16px;border-radius:5px}.cell.round{border-radius:50%}.cell.open{background:#444}
.gg.t .cell{cursor:default;font-size:22px}
.big{width:100%;max-width:340px;height:200px;border:0;border-radius:14px;color:#fff;font-size:26px;font-weight:700;cursor:pointer}
.btn2{padding:10px 18px;border-radius:8px;border:1px solid var(--win-border);background:var(--accent);color:var(--on-accent);font-weight:600;cursor:pointer;font-size:15px}
.row2{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.row2 .cell{width:72px}
.gtxt{text-align:center;min-height:30px}
.inp{padding:10px 14px;border-radius:8px;border:1px solid var(--win-border);background:var(--win);color:inherit;font-size:16px;width:160px;text-align:center}
.st{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-top:14px}
.sc{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--win-border);border-radius:10px;padding:12px}
.sc .ic{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:28px;flex:0 0 auto}
.sc .tx{flex:1;min-width:0}.sc b{display:block}.sc small{color:var(--muted);font-size:12px;line-height:1.3;display:block}
.sc .bt{display:flex;flex-direction:column;gap:4px}.sc .bt button{padding:6px 12px;border-radius:6px;border:1px solid var(--win-border);background:var(--chrome);cursor:pointer;font-size:12px}
.sc .bt .in{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:600}
`;document.head.appendChild(css);

/* ---- public API ---- */
const EXT=[{"id":"x-capuchinsfremake","name":"Capuchin's Remake","e":"🐒","d":"Full game — opens in its own window.","src":"/games/capuchinsfremake.html"},{"id":"x-clfnac1remake","name":"Five Nights at Candy's 1","e":"🍬","d":"Full game — opens in its own window.","src":"/games/clfnac1remake.html"},{"id":"x-clfnac2remake","name":"Five Nights at Candy's 2","e":"🍭","d":"Full game — opens in its own window.","src":"/games/clfnac2remake.html"},{"id":"x-clfnaf2remake","name":"Five Nights at Freddy's 2","e":"🧸","d":"Full game — opens in its own window.","src":"/games/clFNAF2remake%27.html"},{"id":"x-clfnaf3remake","name":"Five Nights at Freddy's 3","e":"🐰","d":"Full game — opens in its own window.","src":"/games/clFNAF3remake.html"},{"id":"x-clfnaf3remasteredemake","name":"Five Nights at Freddy's 3 Remastered","e":"🐰","d":"Full game — opens in its own window.","src":"/games/clfnaf3remasteredemake.html"},{"id":"x-clfnaf4halloweenremake","name":"Five Nights at Freddy's 4: Halloween","e":"🎃","d":"Full game — opens in its own window.","src":"/games/clfnaf4halloweenremake.html"},{"id":"x-clfnaf4remake","name":"Five Nights at Freddy's 4","e":"🌙","d":"Full game — opens in its own window.","src":"/games/clFNAF4remake.html"},{"id":"x-clfnafpsremake","name":"Five Nights at Freddy's: Pizzeria Simulator","e":"🍕","d":"Full game — opens in its own window.","src":"/games/clfnafpsremake.html"},{"id":"x-clfnafremake","name":"Five Nights at Freddy's","e":"🐻","d":"Full game — opens in its own window.","src":"/games/clFNAFremake.html"},{"id":"x-clfnafshooterremake","name":"FNAF Shooter","e":"🔫","d":"Full game — opens in its own window.","src":"/games/clfnafshooterremake.html"},{"id":"x-clfnafslremake","name":"Five Nights at Freddy's: Sister Location","e":"🤡","d":"Full game — opens in its own window.","src":"/games/clfnafslremake.html"},{"id":"x-clfnafucnremake","name":"Five Nights at Freddy's: Ultimate Custom Night","e":"👾","d":"Full game — opens in its own window.","src":"/games/clfnafucnremake.html"},{"id":"x-clfnafworlddremake","name":"Five Nights at Freddy's: World","e":"🌍","d":"Full game — opens in its own window.","src":"/games/clfnafworlddremake.html"},{"id":"x-clgorillatagremake","name":"Gorilla Tag","e":"🦍","d":"Full game — opens in its own window.","src":"/games/clgorillatagremake.html"},{"id":"x-clgrannyyremake","name":"Granny","e":"👵","d":"Full game — opens in its own window.","src":"/games/clgrannyyremake.html"},{"id":"x-clsuperkidadventure","name":"Super Kid Adventure","e":"🦸","d":"Full game — opens in its own window.","src":"/games/clsuperkidadventure.html"}];
GAMES.unshift(...EXT);
const byId={},emoji={};GAMES.forEach(x=>{byId[x.id]=x;emoji[x.id]=x.e});

function run(id,root){
  const gm=byId[id];if(!root||!gm)return()=>{};
  if(gm.src){
    root.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;font-size:13px"><button class="fl-save" type="button" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;cursor:pointer">⬇ Save for offline</button><span class="fl-st" style="opacity:.75"></span></div><iframe src="'+gm.src+'" allow="fullscreen; autoplay; gamepad" allowfullscreen style="width:100%;height:calc(100vh - 160px);min-height:440px;border:0;background:#000;display:block"></iframe>';
    const btn=root.querySelector(".fl-save"),st=root.querySelector(".fl-st");
    let inBlank=false;try{inBlank=window.top!==window&&(window.top.location.href==="about:blank"||/[?&]blank\b/.test(location.search))}catch(e){}
    if(inBlank){const w=document.createElement("div");w.style.cssText="margin:0 10px 6px;padding:8px 12px;border-radius:6px;background:rgba(245,197,66,.18);border:1px solid rgba(245,197,66,.6);font-size:12.5px";w.textContent="⚠ Offline saving doesn't work in an about:blank tab. Open the site in a normal tab (add ?direct to the address, or turn off Auto-open in about:blank in Settings) to save games for offline.";root.insertBefore(w,root.firstChild)}
    btn.onclick=async()=>{
      if(!navigator.onLine){st.textContent="Connect to the internet to save this game.";return}
      const reg=navigator.serviceWorker&&await navigator.serviceWorker.ready.catch(()=>null);
      if(!reg||!reg.active){st.textContent="Offline mode isn't ready yet. Reload the site once and try again.";return}
      btn.disabled=true;st.textContent="Starting…";
      if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
      const ch=new MessageChannel();
      ch.port1.onmessage=async e=>{const m=e.data;
        if(m.type==="progress")st.textContent="Saving… "+m.done+" / "+m.total+" files";
        else if(m.type==="done"){
          const q=navigator.storage&&navigator.storage.estimate?await navigator.storage.estimate().catch(()=>null):null;
          const mb=q?" Storage used: "+Math.round(q.usage/1048576)+" MB of "+Math.round(q.quota/1048576)+" MB.":"";
          if(m.total===0)st.textContent="Found no files to save (the file list didn't load)."+mb;
          else if(m.failed)st.textContent="Saved "+m.ok+" of "+m.total+" files; "+m.failed+" failed ("+m.err+"). Not fully offline yet."+mb;
          else st.textContent="✓ Saved all "+m.ok+" files."+mb;
          btn.disabled=false;btn.textContent="↻ Re-check";}
        else{st.textContent="Couldn't finish: "+m.message+". Playing it once online also saves it.";btn.disabled=false}};
      reg.active.postMessage({type:"save-game",src:gm.src},[ch.port2]);
    };
    return()=>{root.innerHTML=""}}
  root.innerHTML='<div class="gm"><div class="gh"><span class="gl"></span><span class="gr"></span><button title="Restart">↻</button></div><div class="ga"></div></div>';
  const gl=root.querySelector(".gl"),gr=root.querySelector(".gr"),ga=root.querySelector(".ga");let g;
  const start=()=>{if(g)g.end();g=G();ga.innerHTML="";gl.textContent="";let cur=0;
    const b0=bk(id),show=()=>{gr.textContent=(cur!=null?"Score "+cur:"")+(b0!=null?" · Best "+b0:"")};
    let best=b0;const ui={msg:t=>gl.textContent=t,score:(v,low)=>{cur=v;if(best==null||(low?v<best:v>best)){best=v;sb(id,v)}gr.textContent="Score "+v+" · Best "+best}};
    gr.textContent=best!=null?"Best "+best:"";gm.run(ga,g,ui)};
  root.querySelector(".gh button").onclick=start;start();return()=>g&&g.end();
}

function mountStore(root,h){
  const draw=q=>{q=(q||"").toLowerCase();const ins=h.installed();
    root.querySelector(".st").innerHTML=GAMES.filter(x=>!q||x.name.toLowerCase().includes(q)).map(x=>`<div class="sc"><div class="ic">${x.e}</div><div class="tx"><b>${x.name}</b><small>${x.d}</small></div><div class="bt">${ins.has(x.id)?`<button class="in" data-o="${x.id}">Open</button><button data-u="${x.id}">Remove</button>`:`<button class="in" data-i="${x.id}">Install</button>`}</div></div>`).join("")||'<p>No games found.</p>'};
  root.innerHTML='<h2>Store</h2><p style="margin:0">Free games. Install one to add it to your Home Screen.</p><input class="inp" style="width:100%;margin-top:12px;text-align:left" placeholder="Search games"><div class="st"></div>';
  const s=root.querySelector("input");s.oninput=()=>draw(s.value);
  root.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.i)h.install(b.dataset.i);else if(b.dataset.u)h.uninstall(b.dataset.u);else if(b.dataset.o)h.open(b.dataset.o);draw(s.value)});
  draw("");
}

window.FLStore={games:GAMES,byId,emoji,run,mountStore};
})();
