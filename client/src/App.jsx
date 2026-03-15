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
  if(days>0) return `${days}d`;
  const hrs=Math.floor(d/3600000);
  return hrs>0?`${hrs}h`:"< 1h";
}
function generateDateOptions() {
  const now=new Date(),months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],opts=[];
  for(let i=1;i<=6;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);opts.push(`Before ${months[d.getMonth()]} ${d.getFullYear()}`);}
  const ny=now.getFullYear()+1;
  opts.push(`Q1 ${ny}`,`Q2 ${ny}`,`Q3 ${ny}`,`Q4 ${ny}`,`${ny+1} or later`,"Never");
  return opts;
}
const OPTION_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];
const ANON_ALIASES=["Fox","Tiger","Panda","Lion","Frog","Wolf","Unicorn","Bear","Butterfly","Octopus","Shark","Owl","Dolphin","Peacock","Raccoon","Penguin","Parrot","Flamingo","Whale","Otter","Dragon","Badger","Bee","Deer"];
function getAnonAlias(){let a=localStorage.getItem("km_anon_alias");if(!a){a=ANON_ALIASES[Math.floor(Math.random()*ANON_ALIASES.length)];localStorage.setItem("km_anon_alias",a);}return a;}

function Spinner({size=14,color="currentColor"}){
  return <span style={{display:"inline-block",width:size,height:size,border:`1.5px solid transparent`,borderTopColor:color,borderRightColor:color,borderRadius:"50%",animation:"spin .6s linear infinite",flexShrink:0}}/>;
}
function Toast({toast}){
  if(!toast)return null;
  return(
    <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:toast.type==="error"?"#1a0a0a":"#0a1a0a",color:toast.type==="error"?"#fca5a5":"#86efac",padding:"10px 18px",borderRadius:6,fontSize:13,fontWeight:500,zIndex:9999,border:`1px solid ${toast.type==="error"?"#7f1d1d":"#14532d"}`,whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
      {toast.msg}
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body { font-family: 'DM Sans', sans-serif; background: #0a0a0a; color: #e5e5e5; }
  ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  input, textarea, button, select { font-family: 'DM Sans', sans-serif; }
  input::placeholder, textarea::placeholder { color: #404040; }
  input:focus, textarea:focus { outline: none; }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
  .mono { font-family: 'DM Mono', monospace; }
  .fade-in { animation: fadeIn 0.2s ease both; }
`;

// ── Shared input style ────────────────────────────────────────────────────────
const inp = (override={}) => ({
  width:"100%", background:"#111", border:"1px solid #222",
  color:"#e5e5e5", borderRadius:6, padding:"10px 12px",
  fontSize:14, lineHeight:"1.5", transition:"border-color .15s",
  ...override,
});

// ── Onboarding ────────────────────────────────────────────────────────────────
function OnboardingGate({onDone, prefillCode}) {
  const [step, setStep] = useState(prefillCode ? "code" : "name");
  const [name, setName] = useState("");
  const [code, setCode] = useState(prefillCode||"");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitName = () => { if(name.trim().length<2){setError("Need at least 2 characters");return;} setError(""); setStep("code"); };
  const submitCode = async () => {
    if(!code.trim()){setError("Enter a room code");return;}
    setLoading(true); setError("");
    try {
      const room = await api("/api/rooms/join",{method:"POST",body:{code}});
      localStorage.setItem("km_username", name.trim());
      localStorage.setItem("km_room", JSON.stringify(room));
      onDone(name.trim(), room);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{CSS}</style>
      <div style={{width:"100%",maxWidth:360,animation:"fadeIn .3s ease"}}>
        <div style={{marginBottom:40}}>
          <div style={{fontSize:13,fontWeight:600,color:"#404040",letterSpacing:"0.08em",marginBottom:8}}>POLYFRENS</div>
          <h1 style={{fontSize:28,fontWeight:700,color:"#fff",letterSpacing:"-0.5px",lineHeight:1.2}}>
            {step==="name" ? "What's your name?" : `Hey ${name}, enter your room code`}
          </h1>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {step==="name" ? (
            <>
              <input autoFocus value={name} onChange={e=>{setName(e.target.value);setError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitName()} placeholder="Your name"
                style={{...inp(), fontSize:16, padding:"12px 14px", background:"#111", border:`1px solid ${error?"#7f1d1d":"#222"}`}}
                onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor=error?"#7f1d1d":"#222"}
              />
              {error && <p style={{fontSize:13,color:"#f87171"}}>{error}</p>}
              <button onClick={submitName}
                style={{background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"11px 0",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:4}}>
                Continue
              </button>
            </>
          ) : (
            <>
              <input autoFocus value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setError("");}}
                onKeyDown={e=>e.key==="Enter"&&submitCode()} placeholder="e.g. CRICKET24"
                style={{...inp(), fontSize:16, padding:"12px 14px", letterSpacing:"0.1em", fontFamily:"'DM Mono',monospace", background:"#111", border:`1px solid ${error?"#7f1d1d":"#222"}`}}
                onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor=error?"#7f1d1d":"#222"}
              />
              {error && <p style={{fontSize:13,color:"#f87171"}}>{error}</p>}
              <button onClick={submitCode} disabled={loading}
                style={{background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"11px 0",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4}}>
                {loading?<><Spinner color="#0a0a0a" size={13}/>Joining...</>:"Join room"}
              </button>
              <button onClick={()=>{setStep("name");setError("");}}
                style={{background:"transparent",border:"none",color:"#555",fontSize:13,cursor:"pointer",padding:"6px 0"}}>
                Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({adminPassword, onClose, showToast, onSwitchRoom, currentRoomId}) {
  const [tab, setTab] = useState("rooms");
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState({name:"",code:""});
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});

  useEffect(()=>{ loadRooms(); loadSettings(); },[]);

  const loadRooms = async () => { try { setRooms(await api(`/api/admin/rooms?password=${encodeURIComponent(adminPassword)}`)); } catch{} };
  const loadAllEvents = async () => { try { setEvents(await api(`/api/admin/events?password=${encodeURIComponent(adminPassword)}`)); } catch{} };
  const loadSettings = async () => { try { const s=await api(`/api/admin/settings?password=${encodeURIComponent(adminPassword)}`); setSettings(s); setDraft(s); } catch{} };

  const createRoom = async () => {
    if(!form.name||!form.code){showToast("Name and code required","error");return;}
    setCreating(true);
    try { const r=await api("/api/admin/rooms",{method:"POST",body:{...form,password:adminPassword}}); setRooms(p=>[r,...p]); setForm({name:"",code:""}); showToast(`Room "${r.name}" created`); }
    catch(e){showToast(e.message,"error");}
    finally{setCreating(false);}
  };
  const deleteRoom = async (id,name) => {
    if(!confirm(`Delete "${name}" and all its data?`))return;
    await api(`/api/admin/rooms/${id}`,{method:"DELETE",body:{password:adminPassword}});
    setRooms(p=>p.filter(r=>r.id!==id)); showToast("Room deleted");
  };
  const saveSettings = async () => {
    setSaving(true);
    try { await api("/api/admin/settings",{method:"POST",body:{...draft,password:adminPassword}}); showToast("Saved"); }
    catch(e){showToast(e.message,"error");}
    finally{setSaving(false);}
  };

  const tabs = [["rooms","Rooms"],["events","All Bets"],["settings","Settings"]];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:"#111",border:"1px solid #222",borderRadius:10,padding:24,width:"100%",maxWidth:500,maxHeight:"88vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontSize:14,fontWeight:600,color:"#fff"}}>Admin</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#555",fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        <div style={{display:"flex",gap:0,marginBottom:20,border:"1px solid #222",borderRadius:6,overflow:"hidden"}}>
          {tabs.map(([t,lbl])=>(
            <button key={t} onClick={()=>{setTab(t);if(t==="events")loadAllEvents();}}
              style={{flex:1,padding:"8px 0",background:tab===t?"#1a1a1a":"transparent",border:"none",borderRight:"1px solid #222",color:tab===t?"#fff":"#555",fontSize:13,fontWeight:500,cursor:"pointer"}}>
              {lbl}
            </button>
          ))}
        </div>

        {tab==="rooms"&&(
          <>
            <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:16,marginBottom:20}}>
              <p style={{fontSize:12,fontWeight:600,color:"#555",letterSpacing:"0.06em",marginBottom:12}}>NEW ROOM</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <input placeholder="Room name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
                  style={inp()} onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>
                <input placeholder="Room code (e.g. CRICKET24)" value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value.toUpperCase()}))}
                  style={{...inp(),fontFamily:"'DM Mono',monospace",letterSpacing:"0.06em"}} onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>
                <button onClick={createRoom} disabled={creating}
                  style={{background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"9px 0",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:4}}>
                  {creating?<><Spinner color="#0a0a0a"/>Creating...</>:"Create room"}
                </button>
              </div>
            </div>
            <p style={{fontSize:12,fontWeight:600,color:"#555",letterSpacing:"0.06em",marginBottom:10}}>ROOMS ({rooms.length})</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {rooms.map(r=>(
                <div key={r.id} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontSize:14,fontWeight:600,color:"#e5e5e5"}}>{r.name}</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#555",background:"#1a1a1a",border:"1px solid #222",borderRadius:4,padding:"1px 6px"}}>{r.code}</span>
                    </div>
                    <p style={{fontSize:12,color:"#404040"}}>{r.user_count} members · {r.event_count} markets · {r.volume} pts</p>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{onSwitchRoom(r);onClose();}}
                      style={{background:currentRoomId===r.id?"#1a2a1a":"transparent",border:`1px solid ${currentRoomId===r.id?"#2a4a2a":"#222"}`,color:currentRoomId===r.id?"#86efac":"#555",borderRadius:5,padding:"5px 10px",fontSize:12,fontWeight:500,cursor:"pointer"}}>
                      {currentRoomId===r.id?"Active":"Switch"}
                    </button>
                    <button onClick={()=>deleteRoom(r.id,r.name)}
                      style={{background:"transparent",border:"1px solid #222",color:"#555",borderRadius:5,padding:"5px 10px",fontSize:12,cursor:"pointer"}}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab==="events"&&(
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {events.length===0?<p style={{color:"#404040",fontSize:13,textAlign:"center",padding:24}}>No markets yet</p>:
            events.map(e=>(
              <div key={e.id} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,padding:"12px 14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}>
                  <p style={{fontSize:13,fontWeight:500,color:"#e5e5e5",flex:1,lineHeight:1.4}}>{e.title}</p>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",background:"#1a1a1a",borderRadius:4,padding:"2px 6px"}}>{e.room_code}</span>
                    <span style={{fontSize:10,color:e.resolved?"#86efac":"#fbbf24",background:e.resolved?"#0a1a0a":"#1a1200",borderRadius:4,padding:"2px 6px",fontWeight:500}}>{e.resolved?"Settled":"Live"}</span>
                  </div>
                </div>
                <p style={{fontSize:12,color:"#404040"}}>by {e.creator} · {e.bets.length} bets · {getPool(e.bets)} pts</p>
              </div>
            ))}
          </div>
        )}

        {tab==="settings"&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[["currency","Currency"],["starting_balance","Starting balance"],["min_bet","Min bet"],["max_bet","Max bet"]].map(([k,lbl])=>(
              <div key={k}>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",letterSpacing:"0.04em",marginBottom:6}}>{lbl.toUpperCase()}</label>
                <input value={draft[k]||""} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))} style={inp()}
                  onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>
              </div>
            ))}
            <button onClick={saveSettings} disabled={saving}
              style={{background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"10px 0",fontSize:13,fontWeight:600,cursor:"pointer",marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {saving?<><Spinner color="#0a0a0a"/>Saving...</>:"Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoginModal({onLogin, onClose}){
  const [pwd,setPwd]=useState(""); const [err,setErr]=useState(false); const [loading,setLoading]=useState(false);
  const attempt=async()=>{if(!pwd.trim())return;setLoading(true);try{await onLogin(pwd.trim());setErr(false);}catch{setErr(true);setTimeout(()=>setErr(false),1200);}finally{setLoading(false);}};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:"#111",border:"1px solid #222",borderRadius:"10px 10px 0 0",padding:"24px 24px max(24px,env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp .2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:32,height:3,background:"#222",borderRadius:2,margin:"0 auto 20px"}}/>
        <p style={{fontSize:14,fontWeight:600,color:"#fff",marginBottom:4}}>Admin login</p>
        <p style={{fontSize:13,color:"#555",marginBottom:16}}>Enter your admin password</p>
        <input autoFocus type="password" placeholder="Password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}
          style={{...inp(),border:`1px solid ${err?"#7f1d1d":"#222"}`,marginBottom:err?8:12}}
          onFocus={e=>e.target.style.borderColor=err?"#7f1d1d":"#404040"} onBlur={e=>e.target.style.borderColor=err?"#7f1d1d":"#222"}/>
        {err&&<p style={{fontSize:13,color:"#f87171",marginBottom:12}}>Incorrect password</p>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,background:"transparent",border:"1px solid #222",color:"#555",borderRadius:6,padding:"10px 0",fontSize:13,fontWeight:500,cursor:"pointer"}}>Cancel</button>
          <button onClick={attempt} disabled={loading} style={{flex:2,background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"10px 0",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            {loading?<><Spinner color="#0a0a0a"/>Verifying...</>:"Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomSheet({onClose, children, borderColor="#222"}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div style={{background:"#111",border:`1px solid ${borderColor}`,borderRadius:"10px 10px 0 0",padding:"20px 20px max(20px,env(safe-area-inset-bottom))",width:"100%",maxWidth:480,animation:"slideUp .2s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:32,height:3,background:"#222",borderRadius:2,margin:"0 auto 20px"}}/>
        {children}
      </div>
    </div>
  );
}

function CreateForm({username,roomId,roomCode,settings,onCreated,showToast}){
  const [mtype,setMtype]=useState("binary");
  const BLANK={title:"",description:"",options:["Yes","No"],deadline:""};
  const [form,setForm]=useState(BLANK); const [loading,setLoading]=useState(false);
  const setOpts=opts=>setForm(p=>({...p,options:opts}));
  const submit=async()=>{
    const opts=form.options.filter(o=>o.trim());
    if(!form.title.trim()){showToast("Question is required","error");return;}
    if(opts.length<2){showToast("Need at least 2 options","error");return;}
    if(!form.deadline){showToast("Pick a deadline","error");return;}
    setLoading(true);
    try{
      const ev=await api(`/api/rooms/${roomId}/events`,{method:"POST",body:{...form,options:opts,creator:username,roomCode}});
      onCreated({...ev,bets:[]}); setForm(BLANK); setMtype("binary"); showToast("Market created");
    }catch(e){showToast(e.message,"error");}finally{setLoading(false);}
  };

  return(
    <div style={{animation:"fadeIn .2s ease"}}>
      <h2 style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:20,letterSpacing:"-0.3px"}}>New market</h2>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",border:"1px solid #1a1a1a",borderRadius:6,overflow:"hidden"}}>
          {[["binary","Yes / No"],["multi","Multiple choice"]].map(([t,lbl])=>(
            <button key={t} onClick={()=>{setMtype(t);setOpts(t==="binary"?["Yes","No"]:["",""]);}}
              style={{flex:1,padding:"8px 0",background:mtype===t?"#1a1a1a":"transparent",border:"none",color:mtype===t?"#e5e5e5":"#555",fontSize:13,fontWeight:500,cursor:"pointer"}}>
              {lbl}
            </button>
          ))}
        </div>

        <div>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",letterSpacing:"0.04em",marginBottom:6}}>QUESTION</label>
          <textarea rows={2} placeholder="Will we ship this by Friday?" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            style={{...inp(),resize:"none",lineHeight:1.5}}
            onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>
        </div>

        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <label style={{fontSize:12,fontWeight:600,color:"#555",letterSpacing:"0.04em"}}>OPTIONS</label>
            {mtype==="multi"&&<button onClick={()=>setOpts(generateDateOptions())} style={{background:"transparent",border:"1px solid #222",color:"#555",borderRadius:4,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>Date ranges</button>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {form.options.map((opt,i)=>(
              <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:OPTION_COLORS[i%OPTION_COLORS.length]+"22",border:`1px solid ${OPTION_COLORS[i%OPTION_COLORS.length]}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:9,fontWeight:700,color:OPTION_COLORS[i%OPTION_COLORS.length],fontFamily:"'DM Mono',monospace"}}>{String.fromCharCode(65+i)}</span>
                </div>
                <input placeholder={mtype==="binary"?(i===0?"Yes":"No"):`Option ${i+1}`} value={opt} readOnly={mtype==="binary"}
                  onChange={e=>{const o=[...form.options];o[i]=e.target.value;setOpts(o);}}
                  style={{...inp(),opacity:mtype==="binary"?0.5:1}}
                  onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>
                {mtype==="multi"&&form.options.length>2&&(
                  <button onClick={()=>setOpts(form.options.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",color:"#404040",cursor:"pointer",fontSize:16,lineHeight:1,flexShrink:0,padding:"0 2px"}}>×</button>
                )}
              </div>
            ))}
            {mtype==="multi"&&(
              <button onClick={()=>setOpts([...form.options,""])} style={{background:"transparent",border:"1px dashed #222",color:"#404040",borderRadius:6,padding:"8px 0",fontSize:13,cursor:"pointer"}}>Add option</button>
            )}
          </div>
        </div>

        <div>
          <label style={{display:"block",fontSize:12,fontWeight:600,color:"#555",letterSpacing:"0.04em",marginBottom:6}}>DEADLINE</label>
          <input type="date" value={form.deadline} min={new Date().toISOString().split("T")[0]}
            onChange={e=>setForm(p=>({...p,deadline:e.target.value}))}
            onClick={e=>e.target.showPicker&&e.target.showPicker()}
            style={{...inp(),colorScheme:"dark"}}
            onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>
        </div>

        <button onClick={submit} disabled={loading}
          style={{background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"11px 0",fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:4}}>
          {loading?<><Spinner color="#0a0a0a"/>Creating...</>:"Create market"}
        </button>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const sharedRoomCode = urlParams.get("room");
  const sharedMarketId = urlParams.get("market") ? Number(urlParams.get("market")) : null;

  const savedUser = localStorage.getItem("km_username");
  const savedRoom = (() => { try { return JSON.parse(localStorage.getItem("km_room")); } catch { return null; } })();

  const [username, setUsername] = useState(savedUser||"");
  const [room, setRoom]         = useState(savedRoom);
  const [balance, setBalance]   = useState(null);
  const [events, setEvents]     = useState([]);
  const [settings, setSettings] = useState({min_bet:1,max_bet:100,currency:"pts",starting_balance:100});
  const [loading, setLoading]   = useState(true);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminLogin, setShowAdminLogin]   = useState(false);
  const [showAdminPanel, setShowAdminPanel]   = useState(false);
  const [view, setView]         = useState("markets");
  const [filter, setFilter]     = useState("live");
  const [toast, setToast]       = useState(null);
  const [betModal, setBetModal] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [betLoading, setBetLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);
  const [shareModal, setShareModal]     = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [isAnon, setIsAnon] = useState(()=>localStorage.getItem("km_anon")==="1");
  const anonAlias = getAnonAlias();
  const displayName = isAnon ? anonAlias : username;

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),2600); };
  const toggleAnon = () => { const n=!isAnon; setIsAnon(n); localStorage.setItem("km_anon",n?"1":"0"); };

  const loadData = useCallback(async () => {
    if(!room) return;
    try {
      const [evts,sett] = await Promise.all([api(`/api/rooms/${room.id}/events`), api("/api/settings")]);
      setEvents(evts); setSettings(sett);
    } catch{}
    finally { setLoading(false); }
  },[room]);

  const loadBalance = useCallback(async () => {
    if(!room||!username) return;
    try { const {balance:b}=await api(`/api/rooms/${room.id}/users/${encodeURIComponent(username)}/balance`); setBalance(b); } catch{}
  },[room,username]);

  useEffect(()=>{ loadData(); loadBalance(); },[loadData,loadBalance]);
  useEffect(()=>{
    const t=setInterval(()=>{ loadData(); loadBalance(); },15000);
    return()=>clearInterval(t);
  },[loadData,loadBalance]);

  useEffect(()=>{
    if(sharedMarketId && events.length>0) {
      const ev=events.find(e=>e.id===sharedMarketId);
      if(ev) { window.history.replaceState({},"",window.location.pathname); }
    }
  },[events,sharedMarketId]);

  const handleOnboard = async (name,roomData) => {
    setUsername(name); setRoom(roomData); setSettings(roomData);
    try { await api(`/api/rooms/${roomData.id}/users/register`,{method:"POST",body:{username:name}}); } catch{}
  };

  const switchRoom = async (newRoom) => {
    setRoom(newRoom); localStorage.setItem("km_room",JSON.stringify(newRoom));
    setEvents([]); setBalance(null); setLoading(true); setView("markets");
    try { await api(`/api/rooms/${newRoom.id}/users/register`,{method:"POST",body:{username}}); } catch{}
  };

  const handleAdminLogin = async (pwd) => {
    await api("/api/auth/admin",{method:"POST",body:{password:pwd}});
    setIsAdmin(true); setAdminPassword(pwd); setShowAdminLogin(false);
    showToast("Admin access granted");
  };

  const placeBet = async () => {
    const amt=Number(betAmount);
    const min=Number(settings.min_bet), max=Number(settings.max_bet);
    if(!amt||amt<min||amt>max){showToast(`Bet must be ${min}–${max}`, "error");return;}
    setBetLoading(true);
    try {
      const {bet,newBalance}=await api(`/api/rooms/${room.id}/events/${betModal.eventId}/bets`,{method:"POST",body:{username:displayName,option_index:betModal.option,amount:amt}});
      setEvents(prev=>prev.map(e=>e.id===betModal.eventId?{...e,bets:[...e.bets,bet]}:e));
      setBalance(newBalance); setBetModal(null); setBetAmount(""); showToast("Bet placed");
    }catch(e){showToast(e.message,"error");}
    finally{setBetLoading(false);}
  };

  const resolveEvent = async () => {
    const endpoint=isAdmin?`/api/admin/events/${resolveModal.eventId}/resolve`:`/api/rooms/${room.id}/events/${resolveModal.eventId}/resolve`;
    try {
      await api(endpoint,{method:"POST",body:{winner:resolveModal.option,password:isAdmin?adminPassword:undefined,username:displayName}});
      setEvents(prev=>prev.map(e=>e.id===resolveModal.eventId?{...e,resolved:true,winner:resolveModal.option}:e));
      setResolveModal(null); await loadBalance(); showToast("Market settled");
    }catch(e){showToast(e.message,"error");}
  };

  const leaderboard = () => {
    const scores={};
    events.forEach(e=>{
      e.bets.forEach(b=>{
        if(!scores[b.user])scores[b.user]={wagered:0,won:0,bets:0,correct:0};
        scores[b.user].wagered+=b.amount; scores[b.user].bets+=1;
        if(e.resolved){
          const pool=getPool(e.bets), winPool=e.bets.filter(x=>x.option===e.winner).reduce((s,x)=>s+x.amount,0);
          if(b.option===e.winner&&winPool>0){scores[b.user].won+=Math.round((b.amount/winPool)*pool);scores[b.user].correct+=1;}
        }
      });
    });
    return Object.entries(scores).map(([name,s])=>({name,...s,pnl:s.won-s.wagered})).sort((a,b)=>b.pnl-a.pnl);
  };

  const canResolve=(event)=>isAdmin||event.creator===username||event.creator===anonAlias;
  const filteredEvents=events.filter(e=>filter==="live"?!e.resolved:filter==="resolved"?e.resolved:true);

  if(!username||!room) return <OnboardingGate onDone={handleOnboard} prefillCode={sharedRoomCode}/>;

  const NAV=[{id:"markets",label:"Markets"},{id:"leaderboard",label:"Standings"},{id:"create",label:"Create"},{id:"profile",label:"Profile"},...(isAdmin?[{id:"settings",label:"Settings"}]:[])];

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0a",color:"#e5e5e5",paddingBottom:72}}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header style={{position:"sticky",top:0,zIndex:50,background:"rgba(10,10,10,0.9)",backdropFilter:"blur(8px)",borderBottom:"1px solid #161616",padding:"0 20px"}}>
        <div style={{maxWidth:900,margin:"0 auto",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,fontWeight:700,color:"#fff",letterSpacing:"-0.2px"}}>Polyfrens</span>
            <span style={{fontSize:11,color:"#2a2a2a"}}>·</span>
            <span style={{fontSize:12,color:"#404040",fontFamily:"'DM Mono',monospace"}}>{room.name}</span>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {balance!==null&&(
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:"#e5e5e5",background:"#111",border:"1px solid #1a1a1a",borderRadius:5,padding:"4px 10px"}}>
                {balance} <span style={{color:"#404040"}}>{settings.currency}</span>
              </div>
            )}

            {/* Anon toggle */}
            <button onClick={toggleAnon} style={{display:"flex",alignItems:"center",gap:6,background:isAnon?"#1a1200":"transparent",border:`1px solid ${isAnon?"#2a2000":"#1a1a1a"}`,borderRadius:5,padding:"4px 10px",cursor:"pointer",transition:"all .15s"}}>
              <div style={{width:24,height:14,borderRadius:7,background:isAnon?"#854d0e":"#1a1a1a",position:"relative",transition:"background .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:isAnon?12:2,width:10,height:10,borderRadius:"50%",background:isAnon?"#fbbf24":"#404040",transition:"left .15s"}}/>
              </div>
              <span style={{fontSize:12,color:isAnon?"#fbbf24":"#404040",fontWeight:500}}>Anon</span>
            </button>

            {isAdmin?(
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setShowAdminPanel(true)}
                  style={{background:"#1a1a0a",border:"1px solid #2a2a00",color:"#fbbf24",borderRadius:5,padding:"4px 10px",fontSize:12,fontWeight:500,cursor:"pointer"}}>
                  Admin
                </button>
                <button onClick={()=>{setIsAdmin(false);setAdminPassword("");if(view==="settings")setView("markets");}}
                  style={{background:"transparent",border:"1px solid #1a1a1a",color:"#404040",borderRadius:5,padding:"4px 8px",fontSize:12,cursor:"pointer"}}>
                  ×
                </button>
              </div>
            ):(
              <button onClick={()=>setShowAdminLogin(true)}
                style={{background:"transparent",border:"1px solid #1a1a1a",color:"#404040",borderRadius:5,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Anon banner */}
      {isAnon&&(
        <div style={{background:"#110e00",borderBottom:"1px solid #2a2000",padding:"8px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          <span style={{fontSize:12,color:"#78350f",fontWeight:500}}>Anonymous mode</span>
          <span style={{fontSize:12,color:"#555"}}>·</span>
          <span style={{fontSize:12,color:"#92400e"}}>You appear as <span style={{color:"#fbbf24",fontWeight:600,fontFamily:"'DM Mono',monospace"}}>{anonAlias}</span></span>
          <button onClick={toggleAnon} style={{background:"transparent",border:"none",color:"#555",fontSize:11,cursor:"pointer",marginLeft:4}}>Turn off</button>
        </div>
      )}

      {/* ── Main ── */}
      <main style={{maxWidth:900,margin:"0 auto",padding:"24px 20px"}}>
        {loading?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:80,gap:10,color:"#404040"}}>
            <Spinner size={16} color="#404040"/><span style={{fontSize:14}}>Loading...</span>
          </div>
        ):(
          <>
            {/* ══ MARKETS ══ */}
            {view==="markets"&&(
              <div className="fade-in">
                {/* Stats row */}
                <div style={{display:"flex",gap:6,marginBottom:20}}>
                  {[
                    [events.filter(e=>!e.resolved).length, "Live"],
                    [events.reduce((s,e)=>s+getPool(e.bets),0), "Vol."],
                    [events.filter(e=>e.resolved).length, "Settled"],
                  ].map(([val,label])=>(
                    <div key={label} style={{flex:1,background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:6,padding:"10px 12px"}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:500,color:"#e5e5e5",marginBottom:2}}>{val}</div>
                      <div style={{fontSize:11,color:"#404040"}}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Filter */}
                <div style={{display:"flex",gap:6,marginBottom:16}}>
                  {[["live","Live"],["resolved","Settled"],["all","All"]].map(([f,lbl])=>(
                    <button key={f} onClick={()=>setFilter(f)}
                      style={{padding:"5px 14px",borderRadius:5,fontSize:13,fontWeight:500,cursor:"pointer",background:filter===f?"#1a1a1a":"transparent",border:`1px solid ${filter===f?"#2a2a2a":"#1a1a1a"}`,color:filter===f?"#e5e5e5":"#404040",transition:"all .1s"}}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {filteredEvents.length===0?(
                  <div style={{textAlign:"center",padding:"60px 0",color:"#2a2a2a"}}>
                    <p style={{fontSize:15,fontWeight:500,color:"#333",marginBottom:6}}>No {filter==="live"?"active":""} markets</p>
                    <p style={{fontSize:13,color:"#2a2a2a"}}>Create one from the Create tab</p>
                  </div>
                ):(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:8}}>
                    {filteredEvents.map((event)=>{
                      const odds=getOdds(event.bets,event.options.length);
                      const pool=getPool(event.bets);
                      const expired=new Date(event.deadline)<new Date();
                      const canBet=!event.resolved&&!expired;
                      const expanded=expandedCards[event.id];
                      const visibleOptions=expanded?event.options:event.options.slice(0,3);

                      return(
                        <div key={event.id} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                          <div style={{padding:"14px 14px 12px",flex:1,display:"flex",flexDirection:"column",gap:10}}>
                            {/* Header row */}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <span style={{fontSize:11,fontWeight:500,color:event.resolved?"#888":expired?"#666":"#4ade80",background:event.resolved?"#161616":expired?"#161616":"#0a1a0a",border:`1px solid ${event.resolved?"#2a2a2a":expired?"#222":"#166534"}`,borderRadius:4,padding:"2px 7px"}}>
                                  {event.resolved?"Settled":expired?"Closed":`${deadlineLabel(event.deadline)} left`}
                                </span>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <span style={{fontSize:11,color:"#555"}}>by {event.creator}</span>
                                <button onClick={()=>setShareModal({event})}
                                  style={{background:"transparent",border:"none",color:"#2a2a2a",cursor:"pointer",padding:"2px",fontSize:13,lineHeight:1,transition:"color .1s"}}
                                  onMouseOver={e=>e.target.style.color="#555"} onMouseOut={e=>e.target.style.color="#2a2a2a"}>
                                  ↗
                                </button>
                              </div>
                            </div>

                            {/* Title */}
                            <p style={{fontSize:14,fontWeight:500,lineHeight:1.5,color:"#d4d4d4"}}>{event.title}</p>

                            {/* Options */}
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {visibleOptions.map((opt,i)=>{
                                const isWinner=event.resolved&&event.winner===i;
                                const isLoser=event.resolved&&event.winner!==null&&event.winner!==i;
                                const optPool=event.bets.filter(b=>b.option===i).reduce((s,b)=>s+b.amount,0);
                                const myAmt=event.bets.filter(b=>(b.user===username||b.user===anonAlias)&&b.option===i).reduce((s,b)=>s+b.amount,0);
                                const col=OPTION_COLORS[i%OPTION_COLORS.length];
                                const mult=optPool===0?null:(pool/optPool);

                                return(
                                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:5,background:isWinner?"#0a1a0a":isLoser?"transparent":"#111",border:`1px solid ${isWinner?"#14532d":"#1a1a1a"}`,opacity:isLoser?0.35:1,transition:"opacity .2s"}}>
                                    {/* Progress bar */}
                                    <div style={{width:3,height:28,background:"#1a1a1a",borderRadius:2,flexShrink:0,overflow:"hidden"}}>
                                      <div style={{height:`${odds[i]}%`,background:isWinner?"#22c55e":col,borderRadius:2,transition:"height .4s ease"}}/>
                                    </div>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:4}}>
                                        <span style={{fontSize:13,fontWeight:500,color:isWinner?"#86efac":"#e5e5e5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                          {opt}
                                        </span>
                                        <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                                          {myAmt>0&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#3b82f6",background:"#0a1020",border:"1px solid #1a2a40",borderRadius:3,padding:"1px 5px"}}>↑{myAmt}</span>}
                                          {!event.resolved&&mult&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:mult>=3?"#f59e0b":"#404040"}}>{mult>=10?`${Math.round(mult)}x`:`${mult.toFixed(1)}x`}</span>}
                                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:500,color:isWinner?"#86efac":col}}>{odds[i]}%</span>
                                        </div>
                                      </div>
                                    </div>
                                    {canBet&&(
                                      <button onClick={()=>{setBetModal({eventId:event.id,option:i,optionLabel:opt,eventTitle:event.title,color:col,pool,optPool});setBetAmount("");}}
                                        style={{background:"#1a1a1a",border:"1px solid #222",color:"#a3a3a3",borderRadius:4,padding:"4px 10px",fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0,transition:"all .1s"}}
                                        onMouseOver={e=>{e.currentTarget.style.background="#222";e.currentTarget.style.color="#e5e5e5";}}
                                        onMouseOut={e=>{e.currentTarget.style.background="#1a1a1a";e.currentTarget.style.color="#a3a3a3";}}>
                                        Bet
                                      </button>
                                    )}
                                  </div>
                                );
                              })}

                              {event.options.length>3&&!expanded&&(
                                <button onClick={()=>setExpandedCards(p=>({...p,[event.id]:true}))}
                                  style={{background:"transparent",border:"1px dashed #1a1a1a",color:"#333",borderRadius:5,padding:"6px 0",fontSize:12,cursor:"pointer",transition:"all .1s"}}
                                  onMouseOver={e=>{e.currentTarget.style.borderColor="#2a2a2a";e.currentTarget.style.color="#555";}}
                                  onMouseOut={e=>{e.currentTarget.style.borderColor="#1a1a1a";e.currentTarget.style.color="#333";}}>
                                  +{event.options.length-3} more options
                                </button>
                              )}
                              {expanded&&event.options.length>3&&(
                                <button onClick={()=>setExpandedCards(p=>({...p,[event.id]:false}))}
                                  style={{background:"transparent",border:"none",color:"#333",fontSize:11,cursor:"pointer",padding:"2px 0",textAlign:"left"}}>
                                  Show less
                                </button>
                              )}
                            </div>

                            {/* Footer */}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid #141414"}}>
                              <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#555"}}>
                                {pool} {settings.currency} · {event.bets.length} bets
                              </span>
                              {canResolve(event)&&!event.resolved&&(
                                <div style={{display:"flex",alignItems:"center",gap:4}}>
                                  <span style={{fontSize:10,color:"#2a2a2a",marginRight:2}}>Settle:</span>
                                  {event.options.slice(0,4).map((opt,i)=>(
                                    <button key={i} onClick={()=>setResolveModal({eventId:event.id,option:i,optionLabel:opt,eventTitle:event.title})}
                                      style={{background:"#111",border:"1px solid #1a1a1a",color:"#555",borderRadius:4,padding:"3px 8px",fontSize:11,cursor:"pointer",fontWeight:500,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                                      onMouseOver={e=>{e.currentTarget.style.borderColor="#2a2a2a";e.currentTarget.style.color="#e5e5e5";}}
                                      onMouseOut={e=>{e.currentTarget.style.borderColor="#1a1a1a";e.currentTarget.style.color="#555";}}>
                                      {opt.length>7?opt.slice(0,7)+"…":opt}
                                    </button>
                                  ))}
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
              <div className="fade-in">
                <h2 style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:4,letterSpacing:"-0.3px"}}>Standings</h2>
                <p style={{fontSize:13,color:"#404040",marginBottom:20}}>Ranked by realized P&L</p>
                {leaderboard().length===0?(
                  <div style={{textAlign:"center",padding:60,color:"#2a2a2a"}}>
                    <p style={{fontSize:14,color:"#333"}}>No settled markets yet</p>
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:1}}>
                    {leaderboard().map((p,i)=>{
                      const isMe=p.name===username||p.name===anonAlias;
                      return(
                        <div key={p.name} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 14px",background:isMe?"#0d1a0d":"#0d0d0d",border:"1px solid",borderColor:isMe?"#14532d":"#1a1a1a",borderRadius:6,marginBottom:1}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#333",minWidth:20,textAlign:"right"}}>{i+1}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:14,fontWeight:500,color:isMe?"#86efac":"#e5e5e5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {p.name}{isMe&&" (you)"}
                            </p>
                            <p style={{fontSize:12,color:"#404040",marginTop:1}}>{p.bets} bets · {p.correct||0} correct</p>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <p style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:p.pnl>=0?"#86efac":"#f87171"}}>{p.pnl>=0?"+":""}{p.pnl}</p>
                            <p style={{fontSize:10,color:"#2a2a2a",marginTop:1}}>P&L</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ CREATE ══ */}
            {view==="create"&&(
              <div className="fade-in" style={{maxWidth:480}}>
                <CreateForm username={displayName} roomId={room.id} roomCode={room.code} settings={settings}
                  onCreated={ev=>{setEvents(prev=>[ev,...prev]);setView("markets");}} showToast={showToast}/>
              </div>
            )}

            {/* ══ PROFILE ══ */}
            {view==="profile"&&(()=>{
              const myNames=[username,anonAlias];
              const open=[], closed=[];
              events.forEach(event=>{
                const myBets=event.bets.filter(b=>myNames.includes(b.user));
                if(!myBets.length)return;
                const pool=getPool(event.bets);
                const byOpt={};
                myBets.forEach(b=>{ if(!byOpt[b.option])byOpt[b.option]={amount:0,option:b.option}; byOpt[b.option].amount+=b.amount; });
                Object.values(byOpt).forEach(pos=>{
                  const optPool=event.bets.filter(b=>b.option===pos.option).reduce((s,b)=>s+b.amount,0);
                  const payout=optPool>0?Math.round((pos.amount/optPool)*pool):pos.amount;
                  const mult=optPool>0?(pool/optPool):null;
                  const odds=getOdds(event.bets,event.options.length);
                  const entry={event,option:pos.option,optionLabel:event.options[pos.option],amount:pos.amount,payout,mult,odds,optPool,pool};
                  if(event.resolved){ const won=event.winner===pos.option; closed.push({...entry,won,pnl:won?payout-pos.amount:-pos.amount}); }
                  else { open.push(entry); }
                });
              });

              const realizedPnl=closed.reduce((s,p)=>s+p.pnl,0);
              const atRisk=open.reduce((s,p)=>s+p.amount,0);
              const upside=open.reduce((s,p)=>s+p.payout,0);

              return(
                <div className="fade-in">
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                    <div style={{width:40,height:40,borderRadius:6,background:"#1a1a1a",border:"1px solid #222",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:500,color:"#e5e5e5",flexShrink:0}}>
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{fontSize:16,fontWeight:600,color:"#fff"}}>{username}</p>
                      <p style={{fontSize:12,color:"#404040"}}>{room.name}</p>
                    </div>
                  </div>

                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:24}}>
                    {[["Balance",`${balance??"-"} ${settings.currency}`, balance>50?"#86efac":balance>20?"#fbbf24":"#f87171"],
                      ["Realized P&L",`${realizedPnl>=0?"+":""}${realizedPnl}`,realizedPnl>=0?"#86efac":"#f87171"],
                      ["At risk",`${atRisk} ${settings.currency}`,"#e5e5e5"],
                      ["If all win",`+${upside} ${settings.currency}`,"#e5e5e5"],
                    ].map(([label,val,color])=>(
                      <div key={label} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:6,padding:"12px 14px"}}>
                        <p style={{fontSize:11,color:"#333",marginBottom:4,letterSpacing:"0.03em"}}>{label.toUpperCase()}</p>
                        <p style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:500,color}}>{val}</p>
                      </div>
                    ))}
                  </div>

                  <p style={{fontSize:12,fontWeight:600,color:"#333",letterSpacing:"0.04em",marginBottom:10}}>OPEN POSITIONS ({open.length})</p>
                  {open.length===0?<div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:6,padding:"20px",textAlign:"center",marginBottom:20}}><p style={{color:"#2a2a2a",fontSize:13}}>No open bets</p></div>:(
                    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
                      {open.map((pos,i)=>{
                        const col=OPTION_COLORS[pos.option%OPTION_COLORS.length];
                        const closing=new Date(pos.event.deadline)-new Date()<86400000*2;
                        return(
                          <div key={i} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:6,padding:"12px 14px"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                              <p style={{fontSize:13,fontWeight:500,color:"#d4d4d4",flex:1,lineHeight:1.4}}>{pos.event.title}</p>
                              {closing&&<span style={{fontSize:10,color:"#78350f",background:"#1a0e00",border:"1px solid #2a1800",borderRadius:3,padding:"2px 6px",flexShrink:0,fontWeight:500}}>Closing soon</span>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                              <span style={{fontSize:12,fontWeight:500,color:col,fontFamily:"'DM Mono',monospace"}}>{pos.optionLabel}</span>
                              <span style={{fontSize:11,color:"#333"}}>·</span>
                              <span style={{fontSize:12,color:"#404040"}}>{pos.odds[pos.option]}% · {deadlineLabel(pos.event.deadline)} left</span>
                            </div>
                            <div style={{display:"flex",gap:20}}>
                              {[["Wagered",pos.amount,"#a3a3a3"],["If win",`+${pos.payout}`,"#86efac"],["Mult",pos.mult?`${pos.mult.toFixed(1)}x`:"∞x",pos.mult>=3?"#f59e0b":"#a3a3a3"]].map(([l,v,c])=>(
                                <div key={l}><p style={{fontSize:10,color:"#2a2a2a",marginBottom:2}}>{l.toUpperCase()}</p><p style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:500,color:c}}>{v}</p></div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p style={{fontSize:12,fontWeight:600,color:"#333",letterSpacing:"0.04em",marginBottom:10}}>SETTLED ({closed.length})</p>
                  {closed.length===0?<div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:6,padding:"20px",textAlign:"center"}}><p style={{color:"#2a2a2a",fontSize:13}}>No settled bets</p></div>:(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {closed.map((pos,i)=>(
                        <div key={i} style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:6,padding:"12px 14px",opacity:0.8}}>
                          <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}>
                            <p style={{fontSize:13,fontWeight:500,color:"#a3a3a3",flex:1,lineHeight:1.4}}>{pos.event.title}</p>
                            <span style={{fontSize:11,fontWeight:600,color:pos.won?"#86efac":"#f87171",background:pos.won?"#0a1a0a":"#1a0a0a",border:`1px solid ${pos.won?"#14532d":"#7f1d1d"}`,borderRadius:4,padding:"2px 7px",flexShrink:0}}>{pos.won?"Won":"Lost"}</span>
                          </div>
                          <div style={{display:"flex",gap:20}}>
                            {[["Bet",pos.amount,"#555"],["Result",pos.won?`+${pos.payout}`:`-${pos.amount}`,pos.won?"#86efac":"#f87171"],["P&L",`${pos.pnl>=0?"+":""}${pos.pnl}`,pos.pnl>=0?"#86efac":"#f87171"]].map(([l,v,c])=>(
                              <div key={l}><p style={{fontSize:10,color:"#2a2a2a",marginBottom:2}}>{l.toUpperCase()}</p><p style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:500,color:c}}>{v}</p></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ══ SETTINGS ══ */}
            {view==="settings"&&isAdmin&&(
              <div className="fade-in" style={{maxWidth:400}}>
                <h2 style={{fontSize:18,fontWeight:700,color:"#fff",marginBottom:20,letterSpacing:"-0.3px"}}>Settings</h2>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {[["currency","Currency"],["starting_balance","Starting balance"],["min_bet","Min bet"],["max_bet","Max bet"]].map(([k,lbl])=>(
                    <div key={k}>
                      <label style={{display:"block",fontSize:12,fontWeight:600,color:"#404040",letterSpacing:"0.04em",marginBottom:6}}>{lbl.toUpperCase()}</label>
                      <input value={settings[k]||""} onChange={e=>setSettings(p=>({...p,[k]:e.target.value}))}
                        style={inp()} onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>
                    </div>
                  ))}
                  <button onClick={async()=>{try{await api("/api/admin/settings",{method:"POST",body:{...settings,password:adminPassword}});showToast("Saved");}catch(e){showToast(e.message,"error");}}}
                    style={{background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"10px 0",fontSize:13,fontWeight:600,cursor:"pointer",marginTop:4}}>
                    Save settings
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Bottom nav ── */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,10,0.95)",backdropFilter:"blur(8px)",borderTop:"1px solid #161616",zIndex:50}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",padding:"0 4px 0"}}>
          {NAV.map(({id,label})=>(
            <button key={id} onClick={()=>setView(id)}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"transparent",border:"none",cursor:"pointer",padding:"10px 0 max(10px,env(safe-area-inset-bottom))",transition:"color .1s",color:view===id?"#e5e5e5":"#333"}}>
              <span style={{fontSize:11,fontWeight:view===id?600:400,letterSpacing:"0.02em"}}>{label}</span>
              {view===id&&<div style={{width:16,height:1.5,background:"#e5e5e5",borderRadius:1}}/>}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Bet modal ── */}
      {betModal&&(
        <BottomSheet onClose={()=>setBetModal(null)}>
          <p style={{fontSize:12,fontWeight:600,color:"#404040",letterSpacing:"0.04em",marginBottom:4}}>PLACE BET</p>
          <p style={{fontSize:15,fontWeight:600,color:"#fff",marginBottom:8,lineHeight:1.4}}>{betModal.eventTitle}</p>
          <div style={{display:"inline-flex",alignItems:"center",background:"#111",border:"1px solid #1a1a1a",borderRadius:5,padding:"5px 12px",fontSize:13,color:betModal.color,fontWeight:500,marginBottom:16}}>
            {betModal.optionLabel}
          </div>

          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <div style={{flex:1,background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:5,padding:"8px 12px"}}>
              <p style={{fontSize:10,color:"#333",marginBottom:2}}>POSTING AS</p>
              <p style={{fontSize:13,fontWeight:500,color:isAnon?"#fbbf24":"#e5e5e5",fontFamily:"'DM Mono',monospace"}}>{displayName}</p>
            </div>
            {balance!==null&&(
              <div style={{flex:1,background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:5,padding:"8px 12px"}}>
                <p style={{fontSize:10,color:"#333",marginBottom:2}}>BALANCE</p>
                <p style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,color:"#e5e5e5"}}>{balance} {settings.currency}</p>
              </div>
            )}
          </div>

          <input autoFocus type="number" placeholder={`Amount (${settings.min_bet}–${Math.min(Number(settings.max_bet),balance||100)})`}
            value={betAmount} onChange={e=>setBetAmount(e.target.value)} onKeyDown={e=>e.key==="Enter"&&placeBet()}
            style={{...inp(),fontFamily:"'DM Mono',monospace",fontSize:18,padding:"12px 14px",marginBottom:8}}
            onFocus={e=>e.target.style.borderColor="#404040"} onBlur={e=>e.target.style.borderColor="#222"}/>

          {betAmount>0&&(()=>{
            const amt=Number(betAmount);
            const newOptPool=(betModal.optPool||0)+amt;
            const newPool=(betModal.pool||0)+amt;
            const payout=Math.round((amt/newOptPool)*newPool);
            const mult=(payout/amt).toFixed(2);
            return(
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <div style={{flex:1,background:"#0a1a0a",border:"1px solid #14532d",borderRadius:5,padding:"8px 12px"}}>
                  <p style={{fontSize:10,color:"#2a4a2a",marginBottom:2}}>IF YOU WIN</p>
                  <p style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:500,color:"#86efac"}}>+{payout}</p>
                </div>
                <div style={{flex:1,background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:5,padding:"8px 12px"}}>
                  <p style={{fontSize:10,color:"#333",marginBottom:2}}>MULTIPLIER</p>
                  <p style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:500,color:Number(mult)>=3?"#f59e0b":"#e5e5e5"}}>{mult}x</p>
                </div>
              </div>
            );
          })()}

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
            {[Number(settings.min_bet),Math.round((balance||100)*0.25),Math.round((balance||100)*0.5),Math.min(Number(settings.max_bet),balance||100)]
              .filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(v=>(
                <button key={v} onClick={()=>setBetAmount(String(v))}
                  style={{background:betAmount===String(v)?"#1a1a1a":"#0d0d0d",border:`1px solid ${betAmount===String(v)?"#2a2a2a":"#1a1a1a"}`,color:betAmount===String(v)?"#e5e5e5":"#404040",borderRadius:5,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:500}}>
                  {v}
                </button>
              ))
            }
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setBetModal(null)} style={{flex:1,background:"transparent",border:"1px solid #1a1a1a",color:"#404040",borderRadius:6,padding:"11px 0",fontSize:13,fontWeight:500,cursor:"pointer"}}>Cancel</button>
            <button onClick={placeBet} disabled={betLoading}
              style={{flex:2,background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"11px 0",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:betLoading?0.6:1}}>
              {betLoading?<><Spinner color="#0a0a0a"/>Placing...</>:"Confirm bet"}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* ── Resolve modal ── */}
      {resolveModal&&(
        <BottomSheet onClose={()=>setResolveModal(null)}>
          <p style={{fontSize:13,fontWeight:600,color:"#fff",marginBottom:4}}>Settle market</p>
          <p style={{fontSize:13,color:"#404040",marginBottom:14,lineHeight:1.5}}>{resolveModal.eventTitle}</p>
          <div style={{background:"#0a1a0a",border:"1px solid #14532d",borderRadius:6,padding:"12px 14px",marginBottom:12}}>
            <p style={{fontSize:12,color:"#2a4a2a",marginBottom:2}}>WINNER</p>
            <p style={{fontSize:15,fontWeight:600,color:"#86efac"}}>{resolveModal.optionLabel}</p>
          </div>
          <p style={{fontSize:12,color:"#333",marginBottom:18}}>Points will be distributed proportionally. This cannot be undone.</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setResolveModal(null)} style={{flex:1,background:"transparent",border:"1px solid #1a1a1a",color:"#404040",borderRadius:6,padding:"11px 0",fontSize:13,fontWeight:500,cursor:"pointer"}}>Cancel</button>
            <button onClick={resolveEvent} style={{flex:2,background:"#fff",color:"#0a0a0a",border:"none",borderRadius:6,padding:"11px 0",fontSize:13,fontWeight:600,cursor:"pointer"}}>Confirm</button>
          </div>
        </BottomSheet>
      )}

      {/* ── Share modal ── */}
      {shareModal&&(()=>{
        const url=`${window.location.origin}${window.location.pathname}?room=${room.code}&market=${shareModal.event.id}`;
        const pool=getPool(shareModal.event.bets);
        const odds=getOdds(shareModal.event.bets,shareModal.event.options.length);
        const waText=encodeURIComponent(`${shareModal.event.title}\n\n${url}`);
        return(
          <BottomSheet onClose={()=>setShareModal(null)}>
            <p style={{fontSize:13,fontWeight:600,color:"#fff",marginBottom:14}}>Share market</p>
            <div style={{background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:6,padding:"12px 14px",marginBottom:14}}>
              <p style={{fontSize:13,fontWeight:500,color:"#d4d4d4",marginBottom:8,lineHeight:1.4}}>{shareModal.event.title}</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {shareModal.event.options.map((opt,i)=>(
                  <span key={i} style={{fontSize:12,color:OPTION_COLORS[i%OPTION_COLORS.length],background:"#111",border:`1px solid ${OPTION_COLORS[i%OPTION_COLORS.length]}33`,borderRadius:4,padding:"2px 8px",fontFamily:"'DM Mono',monospace"}}>
                    {opt} {odds[i]}%
                  </span>
                ))}
              </div>
              <p style={{fontSize:11,color:"#333"}}>{pool} {settings.currency} · {shareModal.event.bets.length} bets</p>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div style={{flex:1,background:"#0d0d0d",border:"1px solid #1a1a1a",borderRadius:5,padding:"9px 12px",fontSize:11,color:"#333",fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</div>
              <button onClick={()=>navigator.clipboard?.writeText(url).then(()=>showToast("Copied"))}
                style={{background:"#1a1a1a",border:"1px solid #222",color:"#e5e5e5",borderRadius:5,padding:"9px 14px",fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0}}>
                Copy
              </button>
            </div>
            <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#0a1a12",border:"1px solid #14532d",color:"#86efac",borderRadius:6,padding:"11px 0",fontSize:13,fontWeight:500,textDecoration:"none",marginBottom:8}}>
              Share on WhatsApp
            </a>
            <button onClick={()=>setShareModal(null)} style={{width:"100%",background:"transparent",border:"1px solid #1a1a1a",color:"#404040",borderRadius:6,padding:"10px 0",fontSize:13,cursor:"pointer"}}>Close</button>
          </BottomSheet>
        );
      })()}

      {showAdminLogin&&<LoginModal onLogin={handleAdminLogin} onClose={()=>setShowAdminLogin(false)}/>}
      {showAdminPanel&&<AdminPanel adminPassword={adminPassword} onClose={()=>setShowAdminPanel(false)} showToast={showToast} onSwitchRoom={switchRoom} currentRoomId={room?.id}/>}
      <Toast toast={toast}/>
    </div>
  );
}
