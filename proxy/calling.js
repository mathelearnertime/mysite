/* Calling: accounts via Supabase Auth, voice/video calls via WebRTC, signaling via Supabase Realtime broadcast. */
(function(){
  if(document.documentElement.classList.contains("launcher")) return; // the launcher tab never runs the app
  var cfg = window.CALLING_CONFIG || {};
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR-/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY));
  var ICE = {iceServers:[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]}].concat(cfg.TURN_SERVERS || [])};
  var sb=null, me=null, myName="", myChan=null, outChans={}, ready=null;
  var pc=null, local=null, peer=null, peerName="", wantVideo=false, pendingIce=[], remoteSet=false, ringTimer=null, tickTimer=null, startedAt=0, incoming=null, ringer=null;
  var mounts=[];
  var screenStream=null, screenSender=null, remoteScreenId=null, makingOffer=false, connectedOnce=false, remoteStreams={};
  var msgs={}, views={}, unread={}, idByName={};

  /* ---------- helpers ---------- */
  function say(m){ try{ window.toast ? window.toast(m) : console.log(m) }catch(e){} }
  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]}) }
  function store(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)||"null"); localStorage.setItem(k,JSON.stringify(v)) }catch(e){ return null } }
  function emailFor(u){ return u+"@gmail.com" }
  function cleanName(u){ return String(u||"").trim().toLowerCase().replace(/^@/,"") }
  function validName(u){ return /^[a-z0-9_]{3,20}$/.test(u) }

  function loadLib(){
    if(window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function(res,rej){
      var s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.min.js";
      s.onload=res; s.onerror=function(){ rej(new Error("Couldn't load Supabase (network blocked?)")) };
      document.head.appendChild(s);
    });
  }
  function init(){
    if(!configured) return Promise.resolve(false);
    if(ready) return ready;
    ready = loadLib().then(function(){
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      sb.auth.onAuthStateChange(function(ev,session){
        if(session && session.user){ if(me!==session.user.id) setUser(session.user) }
        else if(me){ clearUser() }
      });
      return sb.auth.getSession().then(function(r){
        var s=r.data && r.data.session; if(s && s.user) return setUser(s.user);
      });
    }).then(function(){ return true }).catch(function(e){ ready=null; say(e.message); return false });
    return ready;
  }
  function setUser(user){
    me=user.id;
    return sb.from("call_profiles").select("username").eq("id",me).maybeSingle().then(function(r){
      myName = (r.data && r.data.username) || (user.email||"").split("@")[0];
      subscribeMine(); renderAll(true);
    });
  }
  function clearUser(){
    if(myChan){ try{ sb.removeChannel(myChan) }catch(e){} myChan=null }
    Object.keys(outChans).forEach(function(k){ outChans[k].then(function(c){ try{ sb.removeChannel(c) }catch(e){} }) }); outChans={};
    if(pc||incoming) endCall(false); me=null; myName=""; msgs={}; views={}; unread={}; mounts.forEach(function(m){ delete m.dataset.chat }); renderAll(true);
  }

  /* ---------- signaling ---------- */
  function subscribeMine(){
    if(myChan){ try{ sb.removeChannel(myChan) }catch(e){} }
    myChan = sb.channel("calls:"+me,{config:{broadcast:{self:false}}});
    myChan.on("broadcast",{event:"signal"},function(m){ onSignal(m.payload||{}) }).subscribe();
  }
  function send(toId, payload){
    if(!outChans[toId]){
      var c = sb.channel("calls:"+toId,{config:{broadcast:{self:false}}});
      outChans[toId] = new Promise(function(res,rej){
        c.subscribe(function(st){ if(st==="SUBSCRIBED") res(c); else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT") { delete outChans[toId]; rej(new Error("Realtime failed")) } });
      });
    }
    payload.from=me; payload.fromName=myName;
    return outChans[toId].then(function(c){ return c.send({type:"broadcast",event:"signal",payload:payload}) });
  }
  function onSignal(p){
    if(!p || !p.from || p.from===me) return;
    if(p.type==="msg"){ onMsg(p); return }
    if(p.type==="offer"){
      if(pc || incoming){ send(p.from,{type:"busy"}).catch(function(){}); return }
      incoming={from:p.from,name:p.fromName||"Someone",sdp:p.sdp,video:!!p.video};
      pendingIce=pendingIce.filter(function(x){return x.from===p.from});
      showIncoming(); ring(true);
      clearTimeout(ringTimer); ringTimer=setTimeout(function(){ if(incoming){ dismissIncoming("Missed call from "+incoming.name) } },45000);
    } else if(p.type==="answer"){
      if(pc && peer===p.from && !remoteSet){
        pc.setRemoteDescription(p.sdp).then(function(){ remoteSet=true; clearTimeout(ringTimer); ring(false); setStatus("Connecting…"); return flushIce() }).catch(function(e){ endCall(true,"Call failed") });
      }
    } else if(p.type==="roffer"){
      if(!pc || peer!==p.from || !connectedOnce) return;
      var collision = makingOffer || pc.signalingState!=="stable";
      if(collision && me<peer) return; // impolite side ignores the clash, polite side yields
      pc.setRemoteDescription(p.sdp).then(function(){ return pc.createAnswer() })
        .then(function(a){ return pc.setLocalDescription(a) })
        .then(function(){ return send(peer,{type:"ranswer",sdp:pc.localDescription}) }).catch(function(){});
    } else if(p.type==="screen"){
      if(!pc || peer!==p.from) return;
      remoteScreenId=p.id||null;
      if(remoteScreenId && remoteStreams[remoteScreenId]) q("cu-screen").srcObject=remoteStreams[remoteScreenId];
      updateScreenView();
    } else if(p.type==="ranswer"){
      if(pc && peer===p.from) pc.setRemoteDescription(p.sdp).catch(function(){});
    } else if(p.type==="ice"){
      if(pc && peer===p.from && remoteSet) pc.addIceCandidate(p.candidate).catch(function(){});
      else pendingIce.push({from:p.from,candidate:p.candidate});
    } else if(p.type==="hangup"){
      if(incoming && incoming.from===p.from) dismissIncoming("Missed call from "+incoming.name);
      else if(peer===p.from) endCall(false,"Call ended");
    } else if(p.type==="decline"){ if(peer===p.from) endCall(false,"Call declined") }
    else if(p.type==="busy"){ if(peer===p.from) endCall(false,"They're on another call") }
  }
  function flushIce(){
    var list=pendingIce.filter(function(x){return x.from===peer}); pendingIce=pendingIce.filter(function(x){return x.from!==peer});
    return Promise.all(list.map(function(x){ return pc.addIceCandidate(x.candidate).catch(function(){}) }));
  }

  /* ---------- call UI ---------- */
  var ui=null;
  function css(){
    if(document.getElementById("calling-css")) return;
    var st=document.createElement("style"); st.id="calling-css";
    st.textContent=
    '#call-ui{position:fixed;inset:0;z-index:3000;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 30% 20%,#3a1030,#120a1c 70%);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-user-select:none;user-select:none}'+
    '#call-ui.show{display:flex}'+
    '#call-ui video#cu-remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;display:none}'+
    '#call-ui.hasvideo video#cu-remote{display:block}'+
    '#call-ui video#cu-screen{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;display:none}'+
    '#call-ui.hasscreen video#cu-screen{display:block}'+
    '#call-ui.hasscreen video#cu-remote{inset:auto;right:16px;bottom:calc(120px + env(safe-area-inset-bottom,0px));width:min(28vw,160px);height:auto;aspect-ratio:3/4;object-fit:cover;border-radius:14px;border:2px solid rgba(255,255,255,.35);z-index:2}'+
    '#call-ui.hasscreen .cu-avatar{display:none}'+
    '#call-ui.hasscreen .cu-info{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));left:16px;text-align:left;padding:0}'+
    '#cu-banner{position:absolute;bottom:calc(116px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:20px;background:#ff3b5c;font-size:14px;font-weight:600;z-index:3;display:none;white-space:nowrap}'+
    '#call-ui.sharing #cu-banner{display:block}'+
    '@media(max-width:480px){#call-ui .cu-btns{gap:10px}#call-ui button.cu{width:56px;height:56px;font-size:23px}}'+
    '#call-ui video#cu-local{position:absolute;right:16px;top:calc(16px + env(safe-area-inset-top,0px));width:min(28vw,160px);aspect-ratio:3/4;object-fit:cover;border-radius:14px;border:2px solid rgba(255,255,255,.35);background:#222;display:none;transform:scaleX(-1);z-index:2}'+
    '#call-ui.localvideo video#cu-local{display:block}'+
    '#call-ui .cu-info{position:relative;z-index:2;text-align:center;padding:24px;text-shadow:0 2px 14px rgba(0,0,0,.6)}'+
    '#call-ui .cu-avatar{width:110px;height:110px;border-radius:50%;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:46px;font-weight:700;background:linear-gradient(135deg,#ff8fc0,#a78bfa);box-shadow:0 10px 40px rgba(255,143,192,.4)}'+
    '#call-ui.hasvideo .cu-avatar{display:none}'+
    '#call-ui.hasvideo .cu-info{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));left:16px;text-align:left;padding:0}'+
    '#call-ui .cu-name{font-size:28px;font-weight:700}'+
    '#call-ui .cu-status{margin-top:6px;font-size:16px;opacity:.85;font-variant-numeric:tabular-nums}'+
    '#call-ui .cu-btns{position:absolute;bottom:calc(36px + env(safe-area-inset-bottom,0px));left:0;right:0;display:flex;justify-content:center;gap:18px;z-index:2}'+
    '#call-ui button.cu{width:64px;height:64px;border-radius:50%;border:0;color:#fff;font-size:26px;cursor:pointer;background:rgba(255,255,255,.2);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}'+
    '#call-ui button.cu.on{background:#fff;color:#222}'+
    '#call-ui button.cu.red{background:#ff3b5c}#call-ui button.cu.green{background:#2fd06b}'+
    '#call-ui button.cu[hidden]{display:none}'+
    '.cl{max-width:520px;margin:0 auto}.cl h2{margin:0 0 4px}.cl .sub{color:var(--muted);margin:0 0 18px}'+
    '.cl .tabs{display:flex;gap:8px;margin:0 0 14px}.cl .tabs button{flex:1}'+
    '.cl input{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:12px;border:1px solid var(--win-border);background:transparent;color:inherit;font-size:16px;margin:0 0 10px;-webkit-user-select:text;user-select:text}'+
    '.cl button.b{padding:12px 16px;border-radius:12px;border:1px solid var(--win-border);background:transparent;color:inherit;font-size:15px;font-weight:600;cursor:pointer}'+
    '.cl button.b.sel,.cl button.b.pri{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#2a0a1c)}'+
    '.cl button.b.full{width:100%}.cl .row{display:flex;gap:10px}.cl .row>*{flex:1}'+
    '.cl .err{color:#ff5a7a;min-height:20px;margin:6px 0;font-size:14px}'+
    '.cl .me{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid var(--win-border);border-radius:14px;margin:0 0 18px}'+
    '.cl .contact{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--win-border)}.cl .contact .av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;background:linear-gradient(135deg,#ff8fc0,#a78bfa);color:#fff}'+
    '.cl .contact .nm{flex:1;font-weight:600}.cl .contact button{padding:8px 12px}.cl code{background:rgba(127,127,127,.18);padding:2px 6px;border-radius:6px}.cl ol{padding-left:20px;line-height:1.7}'+
    '.th{display:flex;flex-direction:column;min-height:0;flex:1;height:100%}.cl .th{height:min(58vh,520px)}'+
    '.th-list{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;padding:4px 2px;-webkit-user-select:text;user-select:text}'+
    '.msg{max-width:78%;padding:8px 12px;border-radius:16px;word-break:break-word;font-size:15px;line-height:1.35;text-align:left}'+
    '.msg.me{align-self:flex-end;background:var(--accent,#ff8fc0);color:var(--on-accent,#2a0a1c);border-bottom-right-radius:5px}.msg.them{align-self:flex-start;background:rgba(127,127,127,.25);border-bottom-left-radius:5px}'+
    '.msg time{display:block;font-size:10px;opacity:.6;margin-top:2px}'+
    '.th-form{display:flex;gap:8px;margin-top:8px}.th-form input{flex:1;width:auto !important;margin:0 !important;padding:11px 14px;border-radius:12px;border:1px solid rgba(127,127,127,.45);background:transparent;color:inherit;font-size:16px;-webkit-user-select:text;user-select:text}'+
    '.th-form button{padding:0 18px;border-radius:12px;border:0;background:var(--accent,#ff8fc0);color:var(--on-accent,#2a0a1c);font-weight:700;font-size:15px;cursor:pointer}'+
    '#call-ui #cu-chat{position:relative}#cu-badge{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;border-radius:10px;background:#ff3b5c;color:#fff;font:700 12px/20px sans-serif;font-style:normal;display:none}#cu-badge.on{display:block}'+
    '#cu-chatpanel{position:absolute;left:12px;right:12px;bottom:calc(116px + env(safe-area-inset-bottom,0px));height:min(46%,340px);display:none;flex-direction:column;background:rgba(18,10,28,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:10px;z-index:3;color:#fff;max-width:520px;margin:0 auto}#cu-chatpanel.show{display:flex}';
    document.head.appendChild(st);
  }
  function buildUI(){
    if(ui) return; css();
    ui=document.createElement("div"); ui.id="call-ui";
    ui.innerHTML='<video id="cu-screen" autoplay playsinline muted></video><video id="cu-remote" autoplay playsinline></video><video id="cu-local" autoplay playsinline muted></video>'+
      '<div class="cu-info"><div class="cu-avatar" id="cu-av"></div><div class="cu-name" id="cu-name"></div><div class="cu-status" id="cu-status"></div></div>'+
      '<div id="cu-banner">You\u2019re sharing your screen</div><div id="cu-chatpanel"></div><div class="cu-btns"><button class="cu green" id="cu-accept" title="Accept">&#128222;</button><button class="cu" id="cu-mute" title="Mute">&#127908;</button><button class="cu" id="cu-cam" title="Camera">&#127909;</button><button class="cu" id="cu-share" title="Share screen">&#128421;</button><button class="cu" id="cu-chat" title="Chat">&#128172;<i id="cu-badge"></i></button><button class="cu red" id="cu-end" title="Hang up">&#10006;</button></div>';
    document.body.appendChild(ui);
    ui.querySelector("#cu-accept").onclick=accept;
    ui.querySelector("#cu-chat").onclick=function(){
      var pn=q("cu-chatpanel"); if(!peer) return;
      if(pn.classList.contains("show")){ pn.classList.remove("show"); return }
      pn.innerHTML=""; pn.appendChild(makeThread(peer,peerName)); pn.classList.add("show"); unread[peer]=0; updateBadges();
    };
    ui.querySelector("#cu-share").onclick=function(){ if(screenStream) stopShare(); else startShare() };
    ui.querySelector("#cu-end").onclick=function(){ if(incoming) decline(); else endCall(true,"Call ended") };
    ui.querySelector("#cu-mute").onclick=function(e){ if(!local) return; var t=local.getAudioTracks()[0]; if(!t) return; t.enabled=!t.enabled; e.currentTarget.classList.toggle("on",!t.enabled) };
    ui.querySelector("#cu-cam").onclick=function(e){ if(!local) return; var t=local.getVideoTracks()[0]; if(!t) return; t.enabled=!t.enabled; e.currentTarget.classList.toggle("on",!t.enabled); ui.classList.toggle("localvideo",t.enabled) };
  }
  function q(id){ return ui.querySelector("#"+id) }
  function setStatus(t){ if(ui) q("cu-status").textContent=t }
  function showScreen(name,status,mode){
    buildUI();
    q("cu-name").textContent=name; q("cu-av").textContent=(name||"?").charAt(0).toUpperCase(); setStatus(status);
    q("cu-accept").hidden = mode!=="incoming";
    q("cu-mute").hidden = q("cu-cam").hidden = mode==="incoming";
    q("cu-mute").classList.remove("on"); q("cu-cam").classList.remove("on");
    q("cu-cam").hidden = mode==="incoming" || !wantVideo;
    q("cu-share").hidden = mode==="incoming" || !(navigator.mediaDevices&&navigator.mediaDevices.getDisplayMedia); q("cu-share").classList.remove("on");
    q("cu-chat").hidden = mode==="incoming"; q("cu-chatpanel").classList.remove("show"); updateBadges();
    ui.classList.remove("hasvideo","localvideo","hasscreen","sharing"); ui.classList.add("show");
  }
  function showIncoming(){ wantVideo=incoming.video; showScreen(incoming.name,"Incoming "+(incoming.video?"video":"voice")+" call…","incoming") }
  function hideUI(){ if(ui){ q("cu-chatpanel").classList.remove("show"); q("cu-chatpanel").innerHTML=""; ui.classList.remove("show","hasvideo","localvideo","hasscreen","sharing"); q("cu-screen").srcObject=null; q("cu-remote").srcObject=null; q("cu-local").srcObject=null } }

  var actx=null;
  function ring(on){
    clearInterval(ringer); ringer=null; if(!on) return;
    function beep(){ try{
      actx = actx || new (window.AudioContext||window.webkitAudioContext)();
      [0,.35].forEach(function(d){ var o=actx.createOscillator(), g=actx.createGain(); o.frequency.value=d?520:440; o.connect(g); g.connect(actx.destination);
        var t=actx.currentTime+d; g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.15,t+.03); g.gain.exponentialRampToValueAtTime(.0001,t+.3); o.start(t); o.stop(t+.32) });
      if(navigator.vibrate) navigator.vibrate(300);
    }catch(e){} }
    beep(); ringer=setInterval(beep,2200);
  }

  /* ---------- WebRTC ---------- */
  function media(video){
    return navigator.mediaDevices.getUserMedia({audio:true,video:video?{facingMode:"user"}:false}).catch(function(){
      throw new Error("Allow the microphone"+(video?" and camera":"")+" to make calls");
    });
  }
  function makePC(){
    pc=new RTCPeerConnection(ICE); remoteSet=false; connectedOnce=false; makingOffer=false; remoteScreenId=null; remoteStreams={}; screenStream=null; screenSender=null;
    local.getTracks().forEach(function(t){ pc.addTrack(t,local) });
    q("cu-local").srcObject=local; ui.classList.toggle("localvideo",!!local.getVideoTracks().length);
    pc.onicecandidate=function(e){ if(e.candidate && peer) send(peer,{type:"ice",candidate:e.candidate}).catch(function(){}) };
    pc.onnegotiationneeded=function(){
      if(!connectedOnce || !peer) return;
      makingOffer=true;
      pc.createOffer().then(function(o){ return pc.setLocalDescription(o) })
        .then(function(){ return send(peer,{type:"roffer",sdp:pc.localDescription}) })
        .catch(function(){}).then(function(){ makingOffer=false });
    };
    pc.ontrack=function(e){
      var st=e.streams[0]; if(st) remoteStreams[st.id]=st;
      if(remoteScreenId && st && st.id===remoteScreenId){ q("cu-screen").srcObject=st; updateScreenView(); return }
      q("cu-remote").srcObject=st;
      if(e.track.kind==="video") ui.classList.add("hasvideo");
    };
    pc.onconnectionstatechange=function(){
      if(!pc) return;
      if(pc.connectionState==="connected"){ connectedOnce=true; ring(false); clearTimeout(ringTimer); startedAt=Date.now(); clearInterval(tickTimer);
        tickTimer=setInterval(function(){ var s=Math.floor((Date.now()-startedAt)/1000); setStatus(("0"+Math.floor(s/60)).slice(-2)+":"+("0"+s%60).slice(-2)) },500); setStatus("00:00") }
      else if(pc.connectionState==="failed") endCall(true,"Couldn't connect (this network may block calls)");
    };
  }
  function updateScreenView(){
    if(!ui) return;
    var on=!!remoteScreenId && !!q("cu-screen").srcObject; ui.classList.toggle("hasscreen",on);
    if(!on) q("cu-screen").srcObject=null;
  }
  function setShareUI(){ if(!ui) return; q("cu-share").classList.toggle("on",!!screenStream); ui.classList.toggle("sharing",!!screenStream) }
  function startShare(){
    if(!pc || screenStream) return;
    if(!connectedOnce){ say("Wait until the call connects"); return }
    if(!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)){ say("Screen sharing isn't supported on this device"); return }
    navigator.mediaDevices.getDisplayMedia({video:true,audio:false}).then(function(s){
      if(!pc){ s.getTracks().forEach(function(t){ t.stop() }); return }
      screenStream=s; var t=s.getVideoTracks()[0]; t.onended=stopShare;
      setShareUI();
      send(peer,{type:"screen",id:s.id}).catch(function(){}).then(function(){ if(pc && screenStream===s) screenSender=pc.addTrack(t,s) });
    }).catch(function(e){ if(!e || e.name!=="NotAllowedError") say("Couldn't share your screen") });
  }
  function stopShare(){
    if(!screenStream) return;
    var s=screenStream; screenStream=null;
    s.getTracks().forEach(function(t){ t.onended=null; t.stop() });
    try{ if(pc && screenSender) pc.removeTrack(screenSender) }catch(e){}
    screenSender=null; setShareUI();
    if(peer) send(peer,{type:"screen",id:null}).catch(function(){});
  }
  function startCall(username,video){
    username=cleanName(username);
    if(!me) return Promise.reject(new Error("Sign in first"));
    if(pc||incoming) return Promise.reject(new Error("You're already in a call"));
    if(!validName(username)) return Promise.reject(new Error("Enter a valid username"));
    if(username===myName) return Promise.reject(new Error("That's you!"));
    return sb.from("call_profiles").select("id,username").eq("username",username).maybeSingle().then(function(r){
      if(!r.data) throw new Error("No user named @"+username);
      peer=r.data.id; peerName=r.data.username; wantVideo=!!video;
      showScreen("@"+peerName,"Calling…","outgoing"); ring(true);
      return media(video).then(function(s){ local=s; makePC(); return pc.createOffer() })
        .then(function(o){ return pc.setLocalDescription(o) })
        .then(function(){ return send(peer,{type:"offer",sdp:pc.localDescription,video:!!video}) })
        .then(function(){ rememberContact(peerName); clearTimeout(ringTimer); ringTimer=setTimeout(function(){ if(pc && !remoteSet) endCall(true,"No answer") },45000) })
        .catch(function(e){ endCall(false); throw e });
    });
  }
  function accept(){
    if(!incoming) return; var inc=incoming; incoming=null; ring(false); clearTimeout(ringTimer);
    peer=inc.from; peerName=inc.name; wantVideo=inc.video; showScreen("@"+peerName,"Connecting…","active");
    media(inc.video).then(function(s){ local=s; makePC(); return pc.setRemoteDescription(inc.sdp) })
      .then(function(){ remoteSet=true; return flushIce() })
      .then(function(){ return pc.createAnswer() }).then(function(a){ return pc.setLocalDescription(a) })
      .then(function(){ rememberContact(peerName); return send(peer,{type:"answer",sdp:pc.localDescription}) })
      .catch(function(e){ var m=e.message; send(inc.from,{type:"decline"}).catch(function(){}); endCall(false,m) });
  }
  function decline(){ if(!incoming) return; var f=incoming.from; incoming=null; ring(false); clearTimeout(ringTimer); send(f,{type:"decline"}).catch(function(){}); pendingIce=[]; hideUI() }
  function dismissIncoming(msg){ incoming=null; ring(false); clearTimeout(ringTimer); pendingIce=[]; hideUI(); if(msg) say(msg) }
  function endCall(notify,msg){
    ring(false); clearTimeout(ringTimer); clearInterval(tickTimer);
    if(notify && peer) send(peer,{type:"hangup"}).catch(function(){});
    if(screenStream){ screenStream.getTracks().forEach(function(t){ t.onended=null; t.stop() }); screenStream=null; screenSender=null }
    remoteScreenId=null; remoteStreams={}; connectedOnce=false;
    if(local){ local.getTracks().forEach(function(t){ t.stop() }); local=null }
    if(pc){ try{ pc.close() }catch(e){} pc=null }
    incoming=null; peer=null; peerName=""; remoteSet=false; pendingIce=[]; hideUI(); if(msg) say(msg);
  }

  /* ---------- accounts ---------- */
  function signUp(username,password){
    username=cleanName(username);
    if(!validName(username)) return Promise.reject(new Error("Username: 3-20 letters, numbers or _"));
    if(!password || password.length<6) return Promise.reject(new Error("Password must be at least 6 characters"));
    return init().then(function(ok){ if(!ok) throw new Error("Couldn't reach Supabase") })
      .then(function(){ return sb.from("call_profiles").select("id").eq("username",username).maybeSingle() })
      .then(function(r){ if(r.error) throw new Error("Database not set up yet - run setup-calling.sql"); if(r.data) throw new Error("That username is taken");
        return sb.auth.signUp({email:emailFor(username),password:password}) })
      .then(function(r){
        if(r.error) throw new Error(/registered/i.test(r.error.message) ? "That username is taken" : r.error.message);
        if(!r.data.session) throw new Error("In Supabase turn OFF Authentication > Providers > Email > Confirm email, then try again");
        return sb.from("call_profiles").insert({id:r.data.user.id,username:username});
      }).then(function(r){ if(r && r.error) throw new Error(/duplicate|unique/i.test(r.error.message)?"That username is taken":r.error.message) });
  }
  function signIn(username,password){
    username=cleanName(username);
    return init().then(function(ok){ if(!ok) throw new Error("Couldn't reach Supabase") })
      .then(function(){ return sb.auth.signInWithPassword({email:emailFor(username),password:password}) })
      .then(function(r){ if(r.error) throw new Error("Wrong username or password") });
  }
  function signOut(){ return sb ? sb.auth.signOut() : Promise.resolve() }

  /* ---------- messages ---------- */
  var NOSETUP="Messages aren't set up yet - run the updated setup-calling.sql";
  function fmtTime(t){ try{ return new Date(t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}) }catch(e){ return "" } }
  function loadHistory(pid){
    if(msgs[pid]) return Promise.resolve(msgs[pid]);
    return sb.from("call_messages").select("id,sender,recipient,body,created_at")
      .or("and(sender.eq."+me+",recipient.eq."+pid+"),and(sender.eq."+pid+",recipient.eq."+me+")")
      .order("created_at",{ascending:false}).limit(100).then(function(r){
        if(r.error) throw new Error(NOSETUP);
        msgs[pid]=(r.data||[]).slice().reverse(); return msgs[pid];
      });
  }
  function addMsg(pid,m){
    var l=msgs[pid]; if(!l) return;
    if(m.id!=null && l.some(function(x){return x.id===m.id})) return;
    l.push(m); (views[pid]||[]).forEach(function(v){ v.add(m) });
  }
  function isViewing(pid){ return (views[pid]||[]).some(function(v){ return document.body.contains(v.el) && v.el.getClientRects().length>0 }) }
  function updateBadges(){ if(!ui) return; var n=peer?(unread[peer]||0):0, b=q("cu-badge"); b.textContent=n; b.classList.toggle("on",n>0) }
  function onMsg(p){
    var m=p.msg; if(!m || !m.body) return;
    if(p.fromName){ idByName[p.fromName]=p.from; rememberContact(p.fromName) }
    addMsg(p.from,m);
    if(!isViewing(p.from)){
      unread[p.from]=(unread[p.from]||0)+1;
      if(!(pc && peer===p.from)) say("@"+(p.fromName||"someone")+": "+String(m.body).slice(0,60));
      updateBadges(); renderAll();
    }
  }
  function sendMsg(pid,body){
    return sb.from("call_messages").insert({sender:me,recipient:pid,body:body}).select("id,sender,recipient,body,created_at").single().then(function(r){
      if(r.error) throw new Error(/relation|exist|schema|cache/i.test(r.error.message)?NOSETUP:r.error.message);
      addMsg(pid,r.data); send(pid,{type:"msg",msg:r.data}).catch(function(){});
    });
  }
  function makeThread(pid,pname){
    var el=document.createElement("div"); el.className="th";
    el.innerHTML='<div class="th-list"></div><form class="th-form"><input placeholder="Message @'+esc(pname)+'" maxlength="1000" autocomplete="off"><button type="submit">Send</button></form>';
    var list=el.querySelector(".th-list"), input=el.querySelector("input");
    function add(m){
      var d=document.createElement("div"); d.className="msg "+(m.sender===me?"me":"them");
      var t=document.createElement("span"); t.textContent=m.body; var tm=document.createElement("time"); tm.textContent=fmtTime(m.created_at);
      d.appendChild(t); d.appendChild(tm); list.appendChild(d); list.scrollTop=list.scrollHeight;
    }
    views[pid]=(views[pid]||[]).filter(function(v){ return document.body.contains(v.el) }); views[pid].push({el:el,add:add});
    loadHistory(pid).then(function(l){ list.innerHTML=""; l.forEach(add); unread[pid]=0; updateBadges() }).catch(function(e){ list.textContent=e.message });
    input.addEventListener("focus",function(){ if(unread[pid]){ unread[pid]=0; updateBadges() } });
    el.querySelector("form").onsubmit=function(e){ e.preventDefault(); var t=input.value.trim(); if(!t) return; input.value="";
      sendMsg(pid,t).catch(function(err){ say(err.message); input.value=t }) };
    return el;
  }
  function resolveId(name){
    name=cleanName(name);
    if(!validName(name)) return Promise.reject(new Error("Enter a valid username"));
    if(name===myName) return Promise.reject(new Error("That's you!"));
    if(idByName[name]) return Promise.resolve(idByName[name]);
    return sb.from("call_profiles").select("id").eq("username",name).maybeSingle().then(function(r){
      if(!r.data) throw new Error("No user named @"+name); idByName[name]=r.data.id; return r.data.id });
  }

  /* ---------- the Calling app window ---------- */
  function ckey(){ return "calling-contacts:"+(me||"") }
  function rememberContact(n){ var l=(store(ckey())||[]).filter(function(x){return x!==n}); l.unshift(n); store(ckey(),l.slice(0,50)) }
  function mount(el){ if(!el) return; mounts=mounts.filter(function(m){return document.body.contains(m)}); mounts.push(el); render(el); init().then(function(){ render(el) }) }
  function renderAll(force){ mounts=mounts.filter(function(m){return document.body.contains(m)}); mounts.forEach(function(m){ if(!force && m.dataset.chat) return; render(m) }) }
  function render(el){
    css(); var h;
    if(!configured){
      h='<div class="cl"><h2>Calling</h2><p class="sub">One-time setup needed:</p><ol>'+
        '<li>Make a free project at supabase.com</li>'+
        '<li>Open <b>SQL Editor</b>, paste the contents of <code>setup-calling.sql</code> and run it</li>'+
        '<li>Go to <b>Authentication &rarr; Providers &rarr; Email</b> and turn <b>Confirm email</b> OFF</li>'+
        '<li>Go to <b>Project Settings &rarr; API</b>, copy the Project URL and anon key into <code>config.js</code></li>'+
        '<li>Re-upload the site</li></ol></div>';
    } else if(!me){
      var mode=el.dataset.mode||"in";
      h='<div class="cl"><h2>Calling</h2><p class="sub">'+(mode==="in"?"Sign in to make and get calls.":"Make an account - just a username and password.")+'</p>'+
        '<div class="tabs"><button class="b '+(mode==="in"?"sel":"")+'" data-a="tab-in">Sign in</button><button class="b '+(mode==="up"?"sel":"")+'" data-a="tab-up">Create account</button></div>'+
        '<input id="cl-u" placeholder="Username" autocapitalize="none" autocomplete="username" maxlength="20">'+
        '<input id="cl-p" type="password" placeholder="Password" autocomplete="'+(mode==="in"?"current-password":"new-password")+'">'+
        '<div class="err" id="cl-err"></div><button class="b pri full" data-a="'+(mode==="in"?"signin":"signup")+'">'+(mode==="in"?"Sign in":"Create account")+'</button></div>';
    } else if(el.dataset.chat){
      h='<div class="cl"><div class="me"><button class="b" data-a="back">&larr; Back</button><b>@'+esc(el.dataset.chatName)+'</b><span><button class="b" data-a="voice" data-n="'+esc(el.dataset.chatName)+'">Voice</button> <button class="b" data-a="video" data-n="'+esc(el.dataset.chatName)+'">Video</button></span></div></div>';
    } else {
      var cs=(store(ckey())||[]).map(function(n){ return '<div class="contact"><div class="av">'+esc(n.charAt(0).toUpperCase())+'</div><div class="nm">@'+esc(n)+'</div><button class="b" data-a="chat" data-n="'+esc(n)+'">Chat'+(unread[idByName[n]]?' ('+unread[idByName[n]]+')':'')+'</button><button class="b" data-a="voice" data-n="'+esc(n)+'">Voice</button><button class="b" data-a="video" data-n="'+esc(n)+'">Video</button><button class="b" data-a="rm" data-n="'+esc(n)+'" title="Remove">&times;</button></div>' }).join("");
      h='<div class="cl"><h2>Calling</h2><div class="me"><div>Signed in as <b>@'+esc(myName)+'</b></div><button class="b" data-a="signout">Sign out</button></div>'+
        '<input id="cl-call" placeholder="Username" autocapitalize="none" maxlength="20"><div class="err" id="cl-err"></div>'+
        '<button class="b full" data-a="add" style="margin:0 0 10px">+ Add to contacts</button><div class="row"><button class="b pri" data-a="chat">Message</button><button class="b pri" data-a="voice">Voice</button><button class="b pri" data-a="video">Video</button></div>'+
        (cs?'<h3 style="margin:22px 0 4px">Contacts</h3>'+cs:'<p class="sub" style="margin-top:18px">Add friends by their username. Tell them yours (@'+esc(myName)+') so they can add you. Keep this site open to get calls.</p>')+'</div>';
    }
    el.innerHTML=h;
    if(me && el.dataset.chat){ el.querySelector(".cl").appendChild(makeThread(el.dataset.chat,el.dataset.chatName)) }
    el.onclick=function(e){
      var b=e.target.closest("[data-a]"); if(!b) return; var a=b.dataset.a, err=el.querySelector("#cl-err");
      function fail(x){ if(err) err.textContent=x.message||String(x); else say(x.message||String(x)) }
      if(a==="tab-in"||a==="tab-up"){ el.dataset.mode=a==="tab-up"?"up":"in"; render(el) }
      else if(a==="signin"||a==="signup"){
        var u=el.querySelector("#cl-u").value, p=el.querySelector("#cl-p").value; b.disabled=true; if(err) err.textContent="";
        (a==="signin"?signIn(u,p):signUp(u,p)).catch(fail).then(function(){ b.disabled=false });
      } else if(a==="signout"){ signOut() }
      else if(a==="add"){
        var an=(el.querySelector("#cl-call")||{}).value; if(err) err.textContent="";
        resolveId(an).then(function(){ rememberContact(cleanName(an)); render(el); var e2=el.querySelector("#cl-err"); if(e2) e2.textContent="Added @"+cleanName(an) }).catch(fail);
      }
      else if(a==="rm"){ var rn=b.dataset.n; store(ckey(),(store(ckey())||[]).filter(function(x){return x!==rn})); render(el) }
      else if(a==="back"){ delete el.dataset.chat; render(el) }
      else if(a==="chat"){
        var cn=b.dataset.n||(el.querySelector("#cl-call")||{}).value; if(err) err.textContent="";
        resolveId(cn).then(function(id){ el.dataset.chat=id; el.dataset.chatName=cleanName(cn); render(el) }).catch(fail);
      }
      else if(a==="voice"||a==="video"){
        var n=b.dataset.n||(el.querySelector("#cl-call")||{}).value; if(err) err.textContent="";
        startCall(n,a==="video").catch(fail);
      }
    };
    el.onkeydown=function(e){ if(e.key!=="Enter" || e.target.closest(".th")) return; var b=el.querySelector('[data-a="signin"],[data-a="signup"]')||el.querySelector('[data-a="voice"]'); if(b) b.click() };
  }

  window.Calling={mount:mount,init:init,startCall:startCall,_state:function(){return {me:me,myName:myName,pc:pc&&pc.connectionState,incoming:!!incoming}}};
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){ init() }); else init();
})();
