import { useState, useEffect, useCallback } from "react";

const api = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

function getOdds(bets, n) {
  const t = Array(n).fill(0);
  bets.forEach(b => { t[b.option] += b.amount; });
  const total = t.reduce((a,b)=>a+b,0);
  if (!total) return t.map(()=>Math.round(100/n));
  return t.map(v=>Math.round((v/total)*100));
}
function getPool(bets) { return bets.reduce((s,b)=>s+b.amount,0); }
function deadlineLabel(dl) {
  const d = new Date(dl)-new Date();
  if(d<0) return "Closed";
  const days=Math.floor(d/86400000);
  if(days>0) return `${days}d left`;
  const hrs=Math.floor(d/3600000);
  return hrs>0?`${hrs}h left`:"< 1h";
}
function generateDateOptions() {
  const now=new Date(),months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],opts=[];
  for(let i=1;i<=6;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);opts.push(`Before ${months[d.getMonth()]} ${d.getFullYear()}`);}
  const ny=now.getFullYear()+1;
  opts.push(`Q1 ${ny}`,`Q2 ${ny}`,`Q3 ${ny}`,`Q4 ${ny}`,`${ny+1} or later`,"Never");
  return opts;
}
const PALETTE=["#ADFF4F","#4FC3F7","#FF6B6B","#C084FC","#FB923C","#34D399","#F472B6","#FBBF24"];
const ANON_ALIASES=["🦊 Fox","🐯 Tiger","🐼 Panda","🦁 Lion","🐸 Frog","🐺 Wolf","🦄 Unicorn","🐻 Bear","🦋 Butterfly","🐙 Octopus","🦈 Shark","🦉 Owl","🐬 Dolphin","🦚 Peacock","🦝 Raccoon","🐧 Penguin","🦜 Parrot","🦩 Flamingo","🐳 Whale","🦦 Otter","🐲 Dragon","🦡 Badger","🐝 Bee","🦌 Deer"];
function getAnonAlias(){let a=localStorage.getItem("km_anon_alias");if(!a){a=ANON_ALIASES[Math.floor(Math.random()*ANON_ALIASES.length)];localStorage.setItem("km_anon_alias",a);}return a;}

function Spinner({size=16,color="#000"}){return <span style={{display:"inline-block",width:size,height:size,border:`2.5px solid ${color}33`,borderTopColor:color,borderRadius:"50%",animation:"spin .5s linear infinite",flexShrink:0}}/>;}
function Toast({toast}){if(!toast)return null;return(<div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#FF6B6B":"#ADFF4F",color:"#0D0F1A",padding:"10px 20px",borderRadius:50,fontSize:14,fontWeight:700,zIndex:9999,boxShadow:toast.type==="error"?"0 4px 20px #FF6B6B55":"0 4px 20px #ADFF4F55",animation:"fadeUp .2s ease",whiteSpace:"nowrap"}}>{toast.msg}</div>);}

// ── Onboarding Gate (name → room code → in) ───────────────────────────────
function OnboardingGate({onDone}) {
  const [step, setStep] = useState("name");
  const [name, setName]         = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);
  const doShake = () => { setShake(true); setTimeout(()=>setShake(false),400); };

  const submitName = () => {
    if(name.trim().length<2){doShake();return;}
    setStep("code");
  };
  const submitCode = async () => {
    if(!code.trim()){doShake();return;}
    setLoading(true); setError("");
    try {
      const room = await api("/api/rooms/join",{method:"POST",body:{code:code.trim()}});
      localStorage.setItem("km_username", name.trim());
      localStorage.setItem("km_room", JSON.stringify(room));
      onDone(name.trim(), room);
    } catch(e) { setError(e.message); doShake(); }
    finally { setLoading(false); }
  };

  const steps = ["name","code"];
  const F = {width:"100%",background:"#0D0F1A",border:"1.5px solid #252A3D",color:"#fff",borderRadius:12,padding:"14px 16px",fontSize:16,outline:"none"};

  return (
    <div style={{position:"fixed",inset:0,background:"#0D0F1A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,zIndex:200}}>
      <div style={{position:"absolute",top:"-20%",right:"-10%",width:320,height:320,borderRadius:"50%",background:"radial-gradient(circle,#ADFF4F22 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-10%",left:"-10%",width:260,height:260,borderRadius:"50%",background:"radial-gradient(circle,#4FC3F722 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:380,position:"relative"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,lineHeight:1,marginBottom:12}}>🎲</div>
          <h1 style={{fontSize:34,fontWeight:800,color:"#fff",letterSpacing:"-1px",marginBottom:6}}>
            Poly<span style={{color:"#ADFF4F"}}>frens</span>
          </h1>
          <p style={{color:"#5A6478",fontSize:14}}>Bets just between your friends</p>
        </div>

        {/* Step dots */}
        <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:22}}>
          {steps.map((s,i)=>(
            <div key={s} style={{width:steps.indexOf(step)>=i?20:6,height:6,borderRadius:3,background:steps.indexOf(step)>=i?"#ADFF4F":"#252A3D",transition:"all .25s ease"}}/>
          ))}
        </div>

        <div style={{background:"#161929",border:"1.5px solid #252A3D",borderRadius:20,padding:24}}>
          {step==="name" ? (
            <>
              <label style={{display:"block",fontSize:11,fontWeight:700,letterSpacing:"0.04em",color:"#ADFF4F",marginBottom:10}}>YOUR NAME</label>
              <input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitName()} placeholder="e.g. Rahul" className={shake?"shake":""}
                style={F}/>
              <div style={{height:14}}/>
              <button onClick={submitName} style={{width:"100%",background:"#ADFF4F",color:"#0D0F1A",border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer"}}>
                Next →
              </button>
            </>
          ) : (
            <>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#ADFF4F,#4FC3F7)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#0D0F1A",flexShrink:0}}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{fontSize:15,fontWeight:700,color:"#fff"}}>Hey, {name}!</p>
                  <p style={{fontSize:12,color:"#5A6478"}}>Enter your room code to get in</p>
                </div>
              </div>
              <label style={{display:"block",fontSize:11,fontWeight:700,letterSpacing:"0.04em",color:"#ADFF4F",marginBottom:10}}>ROOM CODE</label>
              <input autoFocus value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitCode()} placeholder="e.g. CRICKET24"
                className={shake?"shake":""} style={{...F,letterSpacing:"0.12em",fontFamily:"'JetBrains Mono',monospace",
                  border:`1.5px solid ${error?"#FF6B6B":"#252A3D"}`}}/>
              {error&&<p style={{color:"#FF6B6B",fontSize:13,fontWeight:600,marginTop:8}}>{error}</p>}
              <div style={{height:14}}/>
              <button onClick={submitCode} disabled={loading}
                style={{width:"100%",background:"#ADFF4F",color:"#0D0F1A",border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {loading?<><Spinner color="#0D0F1A"/>Joining...</>:"Let's Go 🚀"}
              </button>
              <button onClick={()=>{setStep("name");setError("");}} style={{width:"100%",background:"transparent",border:"none",color:"#3A4155",fontSize:13,cursor:"pointer",marginTop:10,padding:"6px 0"}}>← Change name</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Master admin panel (create/delete rooms) ─────────────────────────────
function MasterPanel({onClose}) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed]     = useState(false);
  const [rooms, setRooms]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState({name:"",code:"",admin_password:"",creator_password:""});
  const [error, setError]       = useState("");
  const [creating, setCreating] = useState(false);

  const login = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/master/rooms?password=${encodeURIComponent(password)}`);
      setRooms(data); setAuthed(true);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };
  const createRoom = async () => {
    setCreating(true); setError("");
    try {
      const r = await api("/api/master/rooms",{method:"POST",body:{...form,password}});
      setRooms(prev=>[r,...prev]);
      setForm({name:"",code:"",admin_password:"",creator_password:""});
    } catch(e) { setError(e.message); }
    finally { setCreating(false); }
  };
  const deleteRoom = async (id) => {
    if(!confirm("Delete this room and all its data?")) return;
    await api(`/api/master/rooms/${id}`,{method:"DELETE",body:{password}});
    setRooms(prev=>prev.filter(r=>r.id!==id));
  };

  const F={width:"100%",background:"#0D0F1A",border:"1.5px solid #252A3D",color:"#fff",borderRadius:10,padding:"11px 14px",fontSize:14,outline:"none",fontFamily:"'Inter',sans-serif"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16,backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div style={{background:"#161929",border:"1.5px solid #252A3D",borderRadius:20,padding:24,width:"100%",maxWidth:480,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:"#fff"}}>🎛️ Master Panel</h2>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#5A6478",fontSize:20,cursor:"pointer"}}>×</button>
        </div>
        {!authed ? (
          <>
            <p style={{fontSize:13,color:"#5A6478",marginBottom:16}}>Enter master password to manage rooms</p>
            <input type="password" autoFocus placeholder="Master password" value={password} onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&login()} style={F}/>
            {error&&<p style={{color:"#FF6B6B",fontSize:13,marginTop:8}}>{error}</p>}
            <div style={{height:12}}/>
            <button onClick={login} disabled={loading}
              style={{width:"100%",background:"#ADFF4F",color:"#0D0F1A",border:"none",borderRadius:10,padding:"12px 0",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loading?<><Spinner color="#0D0F1A"/>Logging in...</>:"Login →"}
            </button>
          </>
        ) : (
          <>
            {/* Create room form */}
            <div style={{background:"#0D0F1A",border:"1.5px solid #252A3D",borderRadius:14,padding:16,marginBottom:20}}>
              <p style={{fontSize:12,fontWeight:700,color:"#ADFF4F",letterSpacing:"0.04em",marginBottom:12}}>CREATE ROOM</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <input placeholder="Room name (e.g. Cricket Gang)" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={F}/>
                <input placeholder="Room code (e.g. CRICKET24)" value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value.toUpperCase()}))}
                  style={{...F,letterSpacing:"0.08em",fontFamily:"'JetBrains Mono',monospace"}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <input type="password" placeholder="Admin password" value={form.admin_password} onChange={e=>setForm(p=>({...p,admin_password:e.target.value}))} style={F}/>
                  <input type="password" placeholder="Member password" value={form.creator_password} onChange={e=>setForm(p=>({...p,creator_password:e.target.value}))} style={F}/>
                </div>
                <p style={{fontSize:11,color:"#3A4155"}}>Members use the room code to join. Member password = creator access. Admin password = resolve + settings.</p>
                {error&&<p style={{color:"#FF6B6B",fontSize:13}}>{error}</p>}
                <button onClick={createRoom} disabled={creating}
                  style={{background:"#ADFF4F",color:"#0D0F1A",border:"none",borderRadius:10,padding:"11px 0",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {creating?<><Spinner color="#0D0F1A"/>Creating...</>:"Create Room →"}
                </button>
              </div>
            </div>

            {/* Room list */}
            <p style={{fontSize:12,fontWeight:700,color:"#5A6478",letterSpacing:"0.04em",marginBottom:10}}>EXISTING ROOMS ({rooms.length})</p>
            {rooms.length===0&&<p style={{color:"#3A4155",fontSize:13,textAlign:"center",padding:"20px 0"}}>No rooms yet</p>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {rooms.map(r=>(
                <div key={r.id} style={{background:"#0D0F1A",border:"1.5px solid #1E2438",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                  <div>
                    <p style={{fontWeight:700,color:"#fff",fontSize:14}}>{r.name}</p>
                    <p style={{fontSize:12,color:"#5A6478",fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.08em",marginTop:2}}>Code: {r.code}</p>
                  </div>
                  <button onClick={()=>deleteRoom(r.id)}
                    style={{background:"#FF6B6B18",border:"1px solid #FF6B6B44",color:"#FF6B6B",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoginModal({title,subtitle,accent,onLogin,onClose}){
  const [input,setInput]=useState("");const [error,setError]=useState(false);const [loading,setLoading]=useState(false);
  const attempt=async()=>{if(!input.trim())return;setLoading(true);try{await onLogin(input.trim());}catch{setError(true);setTimeout(()=>setError(false),600);}finally{setLoading(false);}};
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,backdropFilter:"blur(6px)"}}onClick={onClose}><div style={{background:"#161929",border:`1.5px solid ${accent}44`,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:500,boxShadow:`0 -8px 40px ${accent}22`,paddingBottom:"max(24px,env(safe-area-inset-bottom)"}}onClick={e=>e.stopPropagation()}><div style={{width:40,height:4,background:"#252A3D",borderRadius:2,margin:"0 auto 20px"}}/><h3 style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:4}}>{title}</h3><p style={{fontSize:13,color:"#5A6478",marginBottom:20}}>{subtitle}</p><input autoFocus type="password" placeholder="Password" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()} className={error?"shake":""} style={{width:"100%",background:"#0D0F1A",border:`1.5px solid ${error?"#FF6B6B":"#252A3D"}`,color:"#fff",borderRadius:12,padding:"13px 16px",fontSize:15,outline:"none",marginBottom:error?8:16}}/>{error&&<p style={{color:"#FF6B6B",fontSize:13,fontWeight:600,marginBottom:14}}>Wrong password 🙅</p>}<div style={{display:"flex",gap:10}}><button onClick={onClose} style={{flex:1,background:"transparent",border:"1.5px solid #252A3D",color:"#5A6478",borderRadius:12,padding:"13px 0",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button><button onClick={attempt} disabled={loading} style={{flex:2,background:accent,color:"#0D0F1A",border:"none",borderRadius:12,padding:"13px 0",fontSize:15,fontWeight:700,cursor:"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{loading?<Spinner color="#0D0F1A"/>:"Login →"}</button></div></div></div>);
}

function BalancePill({balance,currency,accent}){
  const pct=Math.max(0,Math.min(100,balance));
  const color=balance>60?"#ADFF4F":balance>30?"#FBBF24":"#FF6B6B";
  const r=11,circ=2*Math.PI*r;
  return(<div style={{background:"#161929",border:`1.5px solid ${color}44`,borderRadius:50,padding:"5px 12px 5px 8px",display:"flex",alignItems:"center",gap:7}}><div style={{position:"relative",width:28,height:28,flexShrink:0}}><svg width={28} height={28} style={{transform:"rotate(-90deg)"}}><circle cx={14} cy={14} r={r} fill="none" stroke="#252A3D" strokeWidth={3}/><circle cx={14} cy={14} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round" style={{transition:"stroke-dashoffset .4s ease"}}/></svg><span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color}}>{balance}</span></div><span style={{fontSize:13,fontWeight:700,color}}>{balance} <span style={{color:"#5A6478",fontWeight:400}}>{currency}</span></span></div>);
}

function CreateForm({username,isAnon,roomId,password,settings,onCreated,showToast}){
  const [mtype,setMtype]=useState("binary");
  const BLANK={title:"",description:"",options:["Yes","No"],deadline:""};
  const [form,setForm]=useState(BLANK);const [loading,setLoading]=useState(false);
  const setOpts=opts=>setForm(p=>({...p,options:opts}));
  const switchType=t=>{setMtype(t);setOpts(t==="binary"?["Yes","No"]:["",""]);};
  const submit=async()=>{
    const opts=form.options.filter(o=>o.trim());
    if(!form.title.trim()){showToast("Question is required","error");return;}
    if(opts.length<2){showToast("Need at least 2 options","error");return;}
    if(!form.deadline){showToast("Pick a deadline","error");return;}
    setLoading(true);
    try{const ev=await api(`/api/rooms/${roomId}/events`,{method:"POST",body:{...form,options:opts,creator:username,password}});onCreated({...ev,bets:[]});setForm(BLANK);setMtype("binary");showToast("Market is live! 🔥");}
    catch(e){showToast(e.message,"error");}finally{setLoading(false);}
  };
  const F={width:"100%",background:"#0D0F1A",border:"1.5px solid #252A3D",color:"#fff",borderRadius:12,padding:"13px 16px",fontSize:15,outline:"none"};
  const L={display:"block",fontSize:11,fontWeight:700,letterSpacing:"0.04em",color:"#ADFF4F",marginBottom:8};
  return(<div><h2 style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>Create a Market</h2><p style={{color:"#5A6478",fontSize:14,marginBottom:16}}>Start a prediction. Let chaos begin.</p>
    <div style={{display:"inline-flex",alignItems:"center",gap:8,background:isAnon?"rgba(192,132,252,0.08)":"#161929",border:`1px solid ${isAnon?"rgba(192,132,252,0.3)":"#1E2438"}`,borderRadius:8,padding:"7px 14px",marginBottom:20}}>
      <span style={{fontSize:13,fontWeight:600,color:isAnon?"#C084FC":"#5A6478"}}>Creating as: <span style={{color:isAnon?"#C084FC":"#F0F4FF"}}>{username}</span></span>
      {isAnon&&<span style={{fontSize:10,fontWeight:700,color:"#C084FC",background:"rgba(192,132,252,0.12)",border:"1px solid rgba(192,132,252,0.3)",borderRadius:4,padding:"2px 6px"}}>ANON</span>}
    </div>
    <div style={{background:"#161929",border:"1.5px solid #252A3D",borderRadius:20,padding:20,display:"flex",flexDirection:"column",gap:18}}>
      <div><label style={L}>MARKET TYPE</label><div style={{display:"flex",gap:8}}>{[["binary","🎯 Yes / No","#ADFF4F"],["multi","📊 Multi-option","#4FC3F7"]].map(([t,label,ac])=>(<button key={t} onClick={()=>switchType(t)} style={{flex:1,padding:"11px 0",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",background:mtype===t?`${ac}18`:"transparent",border:`1.5px solid ${mtype===t?ac:"#252A3D"}`,color:mtype===t?ac:"#5A6478",transition:"all .15s"}}>{label}</button>))}</div></div>
      <div><label style={L}>THE QUESTION</label><input placeholder={mtype==="binary"?"Will we actually finish this sprint?":"Who will get promoted first?"} value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={F}/></div>
      <div><label style={L}>CONTEXT (OPTIONAL)</label><textarea rows={2} placeholder="Add some spicy context..." value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={{...F,resize:"vertical"}}/></div>
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><label style={{...L,marginBottom:0}}>OPTIONS</label>{mtype==="multi"&&(<button onClick={()=>setOpts(generateDateOptions())} style={{background:"#4FC3F718",border:"1px solid #4FC3F744",color:"#4FC3F7",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📅 Date ranges</button>)}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {form.options.map((opt,i)=>(<div key={i} style={{display:"flex",gap:8}}><div style={{position:"relative",flex:1}}><span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:12,fontWeight:700,color:"#ADFF4F99"}}>{String.fromCharCode(65+i)}.</span><input placeholder={mtype==="binary"?(i===0?"Yes":"No"):`Option ${i+1}`} value={opt} readOnly={mtype==="binary"} onChange={e=>{const o=[...form.options];o[i]=e.target.value;setOpts(o);}} style={{...F,paddingLeft:34,opacity:mtype==="binary"?0.6:1}}/></div>{mtype==="multi"&&form.options.length>2&&(<button onClick={()=>setOpts(form.options.filter((_,j)=>j!==i))} style={{background:"#FF6B6B18",border:"1px solid #FF6B6B44",color:"#FF6B6B",borderRadius:10,padding:"0 14px",fontSize:18,cursor:"pointer",flexShrink:0,fontWeight:900}}>×</button>)}</div>))}
          {mtype==="multi"&&(<button onClick={()=>setOpts([...form.options,""])} style={{background:"transparent",border:"1.5px dashed #252A3D",color:"#5A6478",borderRadius:12,padding:"11px 0",fontSize:14,cursor:"pointer"}}>+ Add option</button>)}
        </div>
      </div>
      <div><label style={L}>DEADLINE</label><input type="date" value={form.deadline} min={new Date().toISOString().split("T")[0]} onChange={e=>setForm(p=>({...p,deadline:e.target.value}))} onClick={e=>e.target.showPicker&&e.target.showPicker()} style={{...F,colorScheme:"dark",cursor:"pointer"}}/></div>
      <button onClick={submit} disabled={loading} style={{background:"#ADFF4F",color:"#0D0F1A",border:"none",borderRadius:12,padding:"15px 0",fontSize:16,fontWeight:700,cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {loading?<><Spinner color="#0D0F1A"/>Creating...</>:"Launch Market 🚀"}
      </button>
    </div>
  </div>);
}

function SettingsPanel({settings,roomId,adminPassword,showToast,onSaved}){
  const [draft,setDraft]=useState(settings);const [newAdmin,setNewAdmin]=useState("");const [newCreator,setNewCreator]=useState("");const [loading,setLoading]=useState(false);
  const save=async()=>{setLoading(true);try{await api(`/api/rooms/${roomId}/settings`,{method:"POST",body:{...draft,password:adminPassword,new_admin_password:newAdmin||undefined,new_creator_password:newCreator||undefined}});setNewAdmin("");setNewCreator("");onSaved(draft);showToast("Saved ✓");}catch(e){showToast(e.message,"error");}finally{setLoading(false);}};
  const F={width:"100%",background:"#0D0F1A",border:"1.5px solid #252A3D",color:"#fff",borderRadius:12,padding:"13px 16px",fontSize:15,outline:"none"};
  const L={display:"block",fontSize:11,fontWeight:700,letterSpacing:"0.04em",color:"#ADFF4F",marginBottom:8};
  return(<div><h2 style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>Settings</h2><p style={{color:"#5A6478",fontSize:14,marginBottom:24}}>Room configuration</p>
    <div style={{background:"#161929",border:"1.5px solid #252A3D",borderRadius:20,padding:20,display:"flex",flexDirection:"column",gap:18}}>
      <div><label style={L}>CURRENCY</label><input value={draft.currency||""} onChange={e=>setDraft(p=>({...p,currency:e.target.value}))} placeholder="pts" style={F}/></div>
      <div><label style={L}>STARTING BALANCE</label><input type="number" value={draft.starting_balance||100} onChange={e=>setDraft(p=>({...p,starting_balance:e.target.value}))} style={F}/><p style={{fontSize:12,color:"#3A4155",marginTop:5}}>Points new players start with</p></div>
      <div style={{display:"flex",gap:12}}><div style={{flex:1}}><label style={L}>MIN BET</label><input type="number" value={draft.min_bet||""} onChange={e=>setDraft(p=>({...p,min_bet:e.target.value}))} style={F}/></div><div style={{flex:1}}><label style={L}>MAX BET</label><input type="number" value={draft.max_bet||""} onChange={e=>setDraft(p=>({...p,max_bet:e.target.value}))} style={F}/></div></div>
      <div style={{borderTop:"1.5px solid #252A3D",paddingTop:18}}><p style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:14}}>🔐 Passwords</p>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={L}>NEW ADMIN PASSWORD</label><input type="password" placeholder="Leave blank to keep" value={newAdmin} onChange={e=>setNewAdmin(e.target.value)} style={F}/></div>
          <div><label style={L}>NEW MEMBER PASSWORD</label><input type="password" placeholder="Leave blank to keep" value={newCreator} onChange={e=>setNewCreator(e.target.value)} style={F}/></div>
        </div>
      </div>
      <button onClick={save} disabled={loading} style={{background:"#ADFF4F",color:"#0D0F1A",border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?0.7:1}}>
        {loading?<><Spinner color="#0D0F1A"/>Saving...</>:"Save Changes"}
      </button>
    </div>
  </div>);
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const savedUser = localStorage.getItem("km_username");
  const savedRoom = (() => { try { return JSON.parse(localStorage.getItem("km_room")); } catch { return null; } })();

  const [username, setUsername] = useState(savedUser || "");
  const [room, setRoom]         = useState(savedRoom);
  const [balance, setBalance]   = useState(null);
  const [events, setEvents]     = useState([]);
  const [settings, setSettings] = useState(savedRoom || { min_bet:1, max_bet:100, currency:"pts", starting_balance:100 });
  const [loading, setLoading]   = useState(true);
  const [role, setRole]         = useState(null);
  const [rolePassword, setRolePassword] = useState("");
  const [loginModal, setLoginModal]     = useState(null);
  const [view, setView]     = useState("markets");
  const [filter, setFilter] = useState("live");
  const [toast, setToast]   = useState(null);
  const [betModal, setBetModal]   = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [betLoading, setBetLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [showMaster, setShowMaster] = useState(false);
  const [isAnon, setIsAnon] = useState(()=>localStorage.getItem("km_anon")==="1");
  const anonAlias = getAnonAlias();
  const displayName = isAnon ? anonAlias : username;

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),2600); };
  const toggleAnon = () => { const n=!isAnon; setIsAnon(n); localStorage.setItem("km_anon",n?"1":"0"); };

  const T = isAnon ? {
    accent:"#C084FC", accent2:"#9333EA", accentBg:"rgba(192,132,252,0.12)", accentBd:"rgba(192,132,252,0.3)",
    surface:"#17101F", surfaceB:"#1E1530", border:"#2D1F3D", border2:"#3D2A55", bg:"#0E0812",
    dot:"#C084FC", glow:"rgba(192,132,252,0.15)",
  } : {
    accent:"#ADFF4F", accent2:"#7FD420", accentBg:"rgba(173,255,79,0.12)", accentBd:"rgba(173,255,79,0.3)",
    surface:"#161929", surfaceB:"#11131f", border:"#1E2438", border2:"#252A3D", bg:"#0D0F1A",
    dot:"#22c55e", glow:"rgba(173,255,79,0.1)",
  };

  const loadData = useCallback(async () => {
    if (!room) return;
    try {
      const [evts, sett] = await Promise.all([
        api(`/api/rooms/${room.id}/events`),
        api(`/api/rooms/${room.id}/settings`),
      ]);
      setEvents(evts); setSettings(sett);
    } catch {}
    finally { setLoading(false); }
  }, [room]);

  const loadBalance = useCallback(async () => {
    if (!room || !username) return;
    try {
      const { balance: b } = await api(`/api/rooms/${room.id}/users/${encodeURIComponent(username)}/balance`);
      setBalance(b);
    } catch {}
  }, [room, username]);

  useEffect(() => { loadData(); loadBalance(); }, [loadData, loadBalance]);
  useEffect(() => {
    const t = setInterval(() => { loadData(); loadBalance(); }, 15000);
    return () => clearInterval(t);
  }, [loadData, loadBalance]);

  const handleOnboard = async (name, roomData) => {
    setUsername(name); setRoom(roomData); setSettings(roomData);
    try { await api(`/api/rooms/${roomData.id}/users/register`,{method:"POST",body:{username:name}}); } catch {}
  };

  const handleLogin = async (roleType, pwd) => {
    await api(`/api/rooms/${room.id}/auth/${roleType}`,{method:"POST",body:{password:pwd}});
    setRole(roleType); setRolePassword(pwd); setLoginModal(null);
    showToast(roleType==="admin"?"Admin mode 👑":"Creator mode ✏️");
  };

  const placeBet = async () => {
    const amt = Number(betAmount);
    const min = Number(settings.min_bet), max = Number(settings.max_bet);
    if(!amt||amt<min||amt>max){showToast(`Bet must be ${min}–${max} ${settings.currency}`,"error");return;}
    setBetLoading(true);
    try {
      const {bet,newBalance} = await api(`/api/rooms/${room.id}/events/${betModal.eventId}/bets`,{method:"POST",body:{username:displayName,option_index:betModal.option,amount:amt}});
      setEvents(prev=>prev.map(e=>e.id===betModal.eventId?{...e,bets:[...e.bets,bet]}:e));
      setBalance(newBalance); setBetModal(null); setBetAmount("");
      showToast(`${amt} ${settings.currency} locked in! 🔒`);
    } catch(e) { showToast(e.message,"error"); }
    finally { setBetLoading(false); }
  };

  const resolveEvent = async () => {
    try {
      await api(`/api/rooms/${room.id}/events/${resolveModal.eventId}/resolve`,{method:"POST",body:{winner:resolveModal.option,password:rolePassword}});
      setEvents(prev=>prev.map(e=>e.id===resolveModal.eventId?{...e,resolved:true,winner:resolveModal.option}:e));
      setResolveModal(null); await loadBalance(); showToast("Market resolved! 🏆");
    } catch(e) { showToast(e.message,"error"); }
  };

  const leaderboard = () => {
    const scores = {};
    events.forEach(e => {
      e.bets.forEach(b => {
        if(!scores[b.user])scores[b.user]={wagered:0,won:0,bets:0,correct:0};
        scores[b.user].wagered+=b.amount; scores[b.user].bets+=1;
        if(e.resolved){
          const pool=getPool(e.bets);
          const winPool=e.bets.filter(x=>x.option===e.winner).reduce((s,x)=>s+x.amount,0);
          if(b.option===e.winner&&winPool>0){scores[b.user].won+=Math.round((b.amount/winPool)*pool);scores[b.user].correct+=1;}
        }
      });
    });
    return Object.entries(scores).map(([name,s])=>({name,...s,pnl:s.won-s.wagered})).sort((a,b)=>b.pnl-a.pnl);
  };

  const filteredEvents = events.filter(e=>filter==="live"?!e.resolved:filter==="resolved"?e.resolved:true);
  const canCreate = role==="admin"||role==="creator";

  if (!username || !room) return <OnboardingGate onDone={handleOnboard} />;

  const NAV = ["markets","leaderboard",...(canCreate?["create"]:[]),...(role==="admin"?["settings"]:[])];
  const ICONS = { markets:"🏪", leaderboard:"🏆", create:"✏️", settings:"⚙️" };

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:"#fff",paddingBottom:80,transition:"background .4s ease"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        body{font-family:'Inter',sans-serif;background:#0D0F1A;-webkit-font-smoothing:antialiased;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#0D0F1A;}::-webkit-scrollbar-thumb{background:#252A3D;border-radius:3px;}
        @keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .shake{animation:shake .3s ease;}
        input,textarea,button{font-family:'Inter',sans-serif;}
        input:focus,textarea:focus{border-color:#ADFF4F!important;outline:none;}
        input::placeholder,textarea::placeholder{color:#2A3048;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.3) sepia(1) saturate(3) hue-rotate(60deg);cursor:pointer;}
        .bp:active{transform:scale(.96);}
      `}</style>

      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:`radial-gradient(circle,${T.accent}0A 0%,transparent 70%)`,top:"-10%",right:"-10%"}}/>
        <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,#4FC3F70A 0%,transparent 70%)",bottom:"20%",left:"-8%"}}/>
      </div>

      {/* ── Header ── */}
      <header style={{position:"sticky",top:0,zIndex:50,background:`rgba(${isAnon?"14,8,18":"13,15,26"},0.95)`,backdropFilter:"blur(12px)",borderBottom:`1px solid ${T.border}`,padding:"10px 16px",transition:"background .4s ease"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <span style={{fontSize:22,animation:"float 3s ease-in-out infinite",display:"block"}}>🎲</span>
            <div>
              <span style={{fontSize:17,fontWeight:800,letterSpacing:"-0.5px"}}>Poly<span style={{color:T.accent,transition:"color .3s ease"}}>frens</span></span>
              <span style={{fontSize:11,color:T.border2,marginLeft:8,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.06em"}}>{room.name}</span>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {balance!==null&&<BalancePill balance={balance} currency={settings.currency} accent={T.accent}/>}

            {/* Anon toggle */}
            <button onClick={toggleAnon} style={{display:"flex",alignItems:"center",gap:8,background:isAnon?T.accentBg:T.surface,border:`1.5px solid ${isAnon?T.accentBd:T.border2}`,borderRadius:50,padding:"6px 12px 6px 8px",cursor:"pointer",transition:"all .25s ease",flexShrink:0}}>
              <div style={{width:34,height:19,borderRadius:10,background:isAnon?T.accent:T.border2,position:"relative",transition:"background .25s ease",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:isAnon?16:3,width:13,height:13,borderRadius:"50%",background:"#fff",transition:"left .2s ease",boxShadow:"0 1px 4px rgba(0,0,0,0.5)"}}/>
              </div>
              <span style={{fontSize:12,fontWeight:600,color:isAnon?T.accent:"#6B7280",transition:"color .25s ease",userSelect:"none"}}>Anon mode</span>
            </button>

            {role?(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.04em",padding:"4px 9px",borderRadius:50,color:role==="admin"?T.accent:"#4FC3F7",background:role==="admin"?`${T.accent}18`:"#4FC3F718",border:`1px solid ${role==="admin"?T.accentBd:"#4FC3F744"}`}}>
                  {role==="admin"?"👑":"✏️"} {role.toUpperCase()}
                </span>
                <button onClick={()=>{setRole(null);setRolePassword("");if(view==="settings")setView("markets");}} style={{background:"transparent",border:`1px solid ${T.border2}`,color:"#5A6478",borderRadius:8,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Out</button>
              </div>
            ):(
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setLoginModal("creator")} style={{background:"#4FC3F718",border:"1px solid #4FC3F744",color:"#4FC3F7",borderRadius:8,padding:"6px 11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Creator</button>
                <button onClick={()=>setLoginModal("admin")} style={{background:`${T.accent}18`,border:`1px solid ${T.accentBd}`,color:T.accent,borderRadius:8,padding:"6px 11px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Admin</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Anon banner */}
      {isAnon&&(
        <div style={{background:`linear-gradient(90deg,${T.accent}18,${T.accent}08,${T.accent}18)`,borderBottom:`1px solid ${T.accentBd}`,padding:"9px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:15}}>🕵️</span>
          <span style={{fontSize:12,fontWeight:700,color:T.accent,letterSpacing:"0.04em"}}>ANONYMOUS MODE</span>
          <span style={{fontSize:12,color:"#888"}}>— You appear as</span>
          <span style={{fontSize:13,fontWeight:700,color:"#fff",background:T.accentBg,border:`1px solid ${T.accentBd}`,borderRadius:6,padding:"2px 10px"}}>{anonAlias}</span>
          <button onClick={toggleAnon} style={{background:"transparent",border:`1px solid ${T.accentBd}`,color:T.accent,borderRadius:6,padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕ Turn off</button>
        </div>
      )}

      {/* ── Main ── */}
      <main style={{maxWidth:900,margin:"0 auto",padding:"20px 16px",position:"relative",zIndex:1}}>
        {loading?(
          <div style={{textAlign:"center",padding:80,color:"#5A6478"}}>
            <div style={{marginBottom:14}}><Spinner size={32} color={T.accent}/></div>
            <p style={{fontWeight:600}}>Loading markets...</p>
          </div>
        ):(
          <>
            {/* ══ MARKETS ══ */}
            {view==="markets"&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
                  {[["🟢",events.filter(e=>!e.resolved).length,"Live"],["💰",events.reduce((s,e)=>s+getPool(e.bets),0),"Volume"],["✅",events.filter(e=>e.resolved).length,"Done"]].map(([icon,val,label])=>(
                    <div key={label} style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"10px 12px"}}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,color:"#fff",letterSpacing:"-0.5px"}}>{val}</div>
                      <div style={{fontSize:12,fontWeight:500,color:"#5A6478",marginTop:4}}>{icon} {label}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,marginBottom:16}}>
                  {[["live","🔥 Live",T.accent],["resolved","✅ Done","#C084FC"],["all","All","#94A3B8"]].map(([f,lbl,c])=>(
                    <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?`${c}18`:"transparent",border:`1.5px solid ${filter===f?c:T.border}`,color:filter===f?c:"#5A6478",borderRadius:50,padding:"6px 0",fontSize:13,fontWeight:600,cursor:"pointer",flex:1,transition:"all .15s"}}>{lbl}</button>
                  ))}
                </div>
                {filteredEvents.length===0?(
                  <div style={{textAlign:"center",padding:"60px 0"}}>
                    <div style={{fontSize:48,marginBottom:12}}>📭</div>
                    <p style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:6}}>{filter==="live"?"No active markets":"Nothing here"}</p>
                    <p style={{color:"#3A4155",fontSize:13}}>{canCreate?"Create one from the ✏️ tab":"Ask a creator or admin to start one"}</p>
                  </div>
                ):(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
                    {filteredEvents.map((event,ei)=>{
                      const odds=getOdds(event.bets,event.options.length);
                      const pool=getPool(event.bets);
                      const expired=new Date(event.deadline)<new Date();
                      const canBet=!event.resolved&&!expired;
                      const accent=PALETTE[ei%PALETTE.length];
                      return(
                        <div key={event.id} style={{background:T.surface,borderRadius:16,border:`1.5px solid ${canBet?accent+"33":T.border}`,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:canBet?`0 2px 16px ${accent}0D`:"none"}}>
                          {canBet&&<div style={{height:3,background:`linear-gradient(90deg,${accent}bb,transparent)`,flexShrink:0}}/>}
                          <div style={{padding:"14px 14px 12px",flex:1,display:"flex",flexDirection:"column",gap:10}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                {canBet&&(<span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#22c55e18",border:"1px solid #22c55e33",borderRadius:50,padding:"2px 8px",fontSize:11,color:"#22c55e",fontWeight:600,whiteSpace:"nowrap"}}>
                                  <span style={{width:5,height:5,borderRadius:"50%",background:T.dot,animation:"pulse 1.5s infinite",flexShrink:0}}/>{deadlineLabel(event.deadline)}</span>)}
                                {event.resolved&&<span style={{background:"#C084FC18",border:"1px solid #C084FC33",borderRadius:50,padding:"2px 8px",fontSize:11,color:"#C084FC",fontWeight:600}}>✅ Settled</span>}
                                {expired&&!event.resolved&&<span style={{background:T.border,borderRadius:50,padding:"2px 8px",fontSize:11,color:"#5A6478",fontWeight:500}}>⏰ Closed</span>}
                              </div>
                              <span style={{fontSize:12,color:"#4A5568",fontWeight:400,flexShrink:0}}>by {event.creator}</span>
                            </div>
                            <p style={{fontSize:14,fontWeight:600,lineHeight:1.5,color:"#E8EDF5",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{event.title}</p>
                            <div style={{display:"flex",flexDirection:"column",gap:5,flex:1}}>
                              {event.options.slice(0,3).map((opt,i)=>{
                                const isWinner=event.resolved&&event.winner===i;
                                const isLoser=event.resolved&&event.winner!==null&&event.winner!==i;
                                const optPool=event.bets.filter(b=>b.option===i).reduce((s,b)=>s+b.amount,0);
                                const myAmt=event.bets.filter(b=>(b.user===username||b.user===anonAlias)&&b.option===i).reduce((s,b)=>s+b.amount,0);
                                const col=PALETTE[i%PALETTE.length];
                                const mult=optPool===0?null:(pool/optPool);
                                const multLabel=optPool===0?"∞x":mult>=10?`${Math.round(mult)}x`:`${mult.toFixed(1)}x`;
                                const isHot=mult!==null&&mult>=3;
                                return(
                                  <div key={i} style={{background:isWinner?`${T.accent}0A`:T.bg,border:`1px solid ${isWinner?T.accentBd:"#1a1f35"}`,borderRadius:9,padding:"7px 10px",opacity:isLoser?0.3:1,display:"flex",alignItems:"center",gap:8}}>
                                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:isWinner?T.accent:col,minWidth:36,flexShrink:0}}>{odds[i]}%</span>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4,marginBottom:4}}>
                                        <span style={{fontSize:13,fontWeight:500,color:isWinner?T.accent:"#C8D3E0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isWinner&&"✓ "}{opt}</span>
                                        <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                                          {!event.resolved&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,color:isHot?"#FB923C":"#4A5568",background:isHot?"#FB923C18":"transparent",border:isHot?"1px solid #FB923C44":"none",borderRadius:4,padding:isHot?"1px 5px":"0"}}>{multLabel}</span>}
                                          {myAmt>0&&<span style={{fontSize:10,color:"#4FC3F7",fontWeight:600}}>↑{myAmt}</span>}
                                        </div>
                                      </div>
                                      <div style={{height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
                                        <div style={{height:"100%",width:`${odds[i]}%`,background:isWinner?`linear-gradient(90deg,${T.accent},${T.accent2})`:`linear-gradient(90deg,${col}99,${col}44)`,borderRadius:2,transition:"width .5s ease"}}/>
                                      </div>
                                    </div>
                                    {canBet&&(<button className="bp" onClick={()=>{setBetModal({eventId:event.id,option:i,optionLabel:opt,eventTitle:event.title,color:col,pool,optPool});setBetAmount("");}} style={{background:`${col}22`,color:col,border:`1px solid ${col}44`,borderRadius:6,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>Bet</button>)}
                                  </div>
                                );
                              })}
                              {event.options.length>3&&<p style={{fontSize:11,color:"#4A5568",fontWeight:500,paddingLeft:4}}>+{event.options.length-3} more options</p>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:6,borderTop:`1px solid ${T.border}`}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:accent}}>{pool}</span>
                                <span style={{fontSize:12,color:"#5A6478"}}>{settings.currency} · {event.bets.length} bets</span>
                              </div>
                              {role==="admin"&&!event.resolved&&(
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:10,color:"#4A5568",fontWeight:600}}>Resolve:</span>
                                  {event.options.slice(0,3).map((opt,i)=>(<button key={i} onClick={()=>setResolveModal({eventId:event.id,option:i,optionLabel:opt,eventTitle:event.title})} style={{background:"#C084FC18",border:"1px solid #C084FC33",color:"#C084FC",borderRadius:5,padding:"3px 7px",fontSize:10,cursor:"pointer",fontWeight:700}}>{opt.length>6?opt.slice(0,6)+"…":opt}</button>))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ LEADERBOARD ══ */}
            {view==="leaderboard"&&(
              <div>
                <h2 style={{fontSize:22,fontWeight:800,marginBottom:4}}>🏆 Leaderboard</h2>
                <p style={{color:"#5A6478",fontSize:14,marginBottom:24}}>Who's actually good at this?</p>
                {leaderboard().length===0?(
                  <div style={{textAlign:"center",padding:60}}><div style={{fontSize:40,marginBottom:12}}>🤷</div><p style={{fontWeight:700,fontSize:16,color:"#5A6478"}}>No settled markets yet</p></div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {leaderboard().map((p,i)=>{
                      const medals=["🥇","🥈","🥉"];const isMe=p.name===username||p.name===anonAlias;
                      return(<div key={p.name} style={{background:isMe?`${T.accent}08`:T.surface,border:`1.5px solid ${isMe?T.accentBd:T.border}`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
                        <span style={{fontSize:20,minWidth:30,textAlign:"center"}}>{medals[i]||i+1}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontWeight:600,fontSize:15,color:isMe?T.accent:"#F0F4FF",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}{isMe&&" (you)"}</p>
                          <p style={{fontSize:13,color:"#5A6478",marginTop:3}}>{p.bets} bets · {p.correct||0} correct</p>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:700,color:p.pnl>=0?T.accent:"#FF6B6B"}}>{p.pnl>=0?"+":""}{p.pnl}</p>
                          <p style={{fontSize:10,fontWeight:600,color:"#3A4155",letterSpacing:"0.04em"}}>P&L</p>
                        </div>
                      </div>);
                    })}
                  </div>
                )}
              </div>
            )}

            {view==="create"&&canCreate&&<CreateForm username={displayName} isAnon={isAnon} roomId={room.id} password={rolePassword} settings={settings} onCreated={ev=>{setEvents(prev=>[ev,...prev]);setView("markets");}} showToast={showToast}/>}
            {view==="settings"&&role==="admin"&&<SettingsPanel settings={settings} roomId={room.id} adminPassword={rolePassword} showToast={showToast} onSaved={s=>setSettings(s)}/>}
          </>
        )}
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:`rgba(${isAnon?"14,8,18":"13,15,26"},0.96)`,backdropFilter:"blur(12px)",borderTop:`1px solid ${T.border}`,padding:"8px 0 max(10px,env(safe-area-inset-bottom))",zIndex:50,transition:"background .4s ease"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",padding:"0 8px"}}>
          {NAV.map(v=>(<button key={v} onClick={()=>setView(v)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",padding:"4px 0"}}>
            <span style={{fontSize:21,lineHeight:1}}>{ICONS[v]}</span>
            <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.04em",color:view===v?T.accent:"#3A4155"}}>{v==="create"?"CREATE":v.toUpperCase()}</span>
            {view===v&&<div style={{width:16,height:2,background:T.accent,borderRadius:1,transition:"background .3s"}}/>}
          </button>))}
        </div>
      </nav>

      {/* ══ BET MODAL ══ */}
      {betModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,backdropFilter:"blur(8px)"}} onClick={()=>setBetModal(null)}>
          <div style={{background:T.surface,border:`1.5px solid ${betModal.color}44`,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:500,boxShadow:`0 -8px 40px ${betModal.color}22`,paddingBottom:"max(24px,env(safe-area-inset-bottom))"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:40,height:4,background:T.border2,borderRadius:2,margin:"0 auto 18px"}}/>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:"0.06em",color:betModal.color,marginBottom:4}}>PLACE BET</p>
            <p style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:8,lineHeight:1.3}}>{betModal.eventTitle}</p>
            <div style={{display:"inline-flex",alignItems:"center",background:`${betModal.color}18`,border:`1.5px solid ${betModal.color}44`,borderRadius:8,padding:"7px 14px",fontSize:14,color:betModal.color,fontWeight:700,marginBottom:16}}>→ {betModal.optionLabel}</div>
            {/* Posting as */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,border:`1px solid ${isAnon?T.accentBd:T.border}`,borderRadius:10,padding:"9px 14px",marginBottom:10}}>
              <span style={{fontSize:12,color:"#5A6478",fontWeight:500}}>Posting as</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,fontWeight:700,color:isAnon?T.accent:"#F0F4FF"}}>{displayName}</span>
                <button onClick={toggleAnon} style={{background:isAnon?T.accentBg:T.surface,border:`1px solid ${isAnon?T.accentBd:T.border2}`,color:isAnon?T.accent:"#5A6478",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                  {isAnon?"ANON ON":"GO ANON"}
                </button>
              </div>
            </div>
            {balance!==null&&(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 14px",marginBottom:14}}>
              <span style={{fontSize:13,color:"#5A6478",fontWeight:500}}>Your balance</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:balance>0?T.accent:"#FF6B6B",fontSize:15}}>{balance} {settings.currency}</span>
            </div>)}
            <p style={{fontSize:11,fontWeight:600,color:"#4A5568",marginBottom:8}}>AMOUNT ({settings.min_bet}–{Math.min(Number(settings.max_bet),balance||100)} {settings.currency})</p>
            <input autoFocus type="number" placeholder={`Min ${settings.min_bet}`} value={betAmount} onChange={e=>setBetAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&placeBet()}
              style={{width:"100%",background:T.bg,border:`1.5px solid ${T.border2}`,color:"#fff",borderRadius:12,padding:"13px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:18,outline:"none",marginBottom:10}}/>
            {betAmount>0&&(()=>{
              const amt=Number(betAmount);
              const newOptPool=(betModal.optPool||0)+amt;
              const newTotalPool=(betModal.pool||0)+amt;
              const payout=Math.round((amt/newOptPool)*newTotalPool);
              const mult=(payout/amt).toFixed(2);
              return(<div style={{background:T.bg,border:`1.5px solid ${betModal.color}44`,borderRadius:12,padding:"12px 14px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><p style={{fontSize:11,fontWeight:600,color:"#4A5568",marginBottom:3}}>IF YOU WIN</p><p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,color:T.accent}}>+{payout} <span style={{fontSize:13,color:"#5A6478"}}>{settings.currency}</span></p></div>
                <div style={{textAlign:"right"}}><p style={{fontSize:11,fontWeight:600,color:"#4A5568",marginBottom:3}}>MULTIPLIER</p><p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,color:Number(mult)>=3?"#FB923C":betModal.color}}>{mult}x</p></div>
              </div>);
            })()}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:18}}>
              {[Number(settings.min_bet),Math.round((balance||100)*0.25),Math.round((balance||100)*0.5),Math.min(Number(settings.max_bet),balance||100)].filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(v=>(
                <button key={v} onClick={()=>setBetAmount(String(v))} className="bp"
                  style={{background:betAmount===String(v)?`${betModal.color}22`:T.bg,border:`1.5px solid ${betAmount===String(v)?betModal.color:T.border}`,color:betAmount===String(v)?betModal.color:"#5A6478",borderRadius:10,padding:"10px 0",fontSize:13,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{v}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setBetModal(null)} style={{flex:1,background:"transparent",border:`1.5px solid ${T.border2}`,color:"#5A6478",borderRadius:12,padding:"14px 0",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={placeBet} disabled={betLoading} className="bp" style={{flex:2,background:betModal.color,color:"#0D0F1A",border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer",opacity:betLoading?0.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                {betLoading?<><Spinner color="#0D0F1A"/>Locking...</>:"Confirm 🔒"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RESOLVE MODAL ══ */}
      {resolveModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,backdropFilter:"blur(8px)"}} onClick={()=>setResolveModal(null)}>
          <div style={{background:T.surface,border:"1.5px solid #C084FC44",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:500,paddingBottom:"max(24px,env(safe-area-inset-bottom))"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:40,height:4,background:T.border2,borderRadius:2,margin:"0 auto 18px"}}/>
            <h3 style={{fontWeight:800,fontSize:20,marginBottom:4}}>Resolve Market</h3>
            <p style={{color:"#5A6478",fontSize:13,marginBottom:16}}>{resolveModal.eventTitle}</p>
            <div style={{background:`${T.accent}0C`,border:`1.5px solid ${T.accentBd}`,borderRadius:12,padding:"14px 16px",fontSize:16,color:T.accent,fontWeight:700,marginBottom:12}}>🏆 Winner: {resolveModal.optionLabel}</div>
            <p style={{color:"#4A5568",fontSize:13,marginBottom:22}}>Points distributed to winners. Cannot be undone.</p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setResolveModal(null)} style={{flex:1,background:"transparent",border:`1.5px solid ${T.border2}`,color:"#5A6478",borderRadius:12,padding:"14px 0",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={resolveEvent} className="bp" style={{flex:2,background:T.accent,color:"#0D0F1A",border:"none",borderRadius:12,padding:"14px 0",fontSize:16,fontWeight:700,cursor:"pointer"}}>Confirm ✓</button>
            </div>
          </div>
        </div>
      )}

      {loginModal==="admin"&&<LoginModal title="Admin Login 👑" subtitle="Resolve markets, change settings" accent={T.accent} onLogin={pwd=>handleLogin("admin",pwd)} onClose={()=>setLoginModal(null)}/>}
      {loginModal==="creator"&&<LoginModal title="Creator Login ✏️" subtitle="Create markets and place bets" accent="#4FC3F7" onLogin={pwd=>handleLogin("creator",pwd)} onClose={()=>setLoginModal(null)}/>}
      {showMaster&&<MasterPanel onClose={()=>setShowMaster(false)}/>}

      {/* Rooms button — only visible to admin */}
      {role==="admin" && (
        <div style={{position:"fixed",bottom:100,right:16,zIndex:49}}>
          <button onClick={()=>setShowMaster(true)} style={{background:T.surface,border:`1px solid ${T.accentBd}`,color:T.accent,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:700}}>
            🎛️ Rooms
          </button>
        </div>
      )}

      <Toast toast={toast}/>
    </div>
  );
}
