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

function getOdds(bets, numOptions) {
  const totals = Array(numOptions).fill(0);
  bets.forEach((b) => { totals[b.option] += b.amount; });
  const total = totals.reduce((a, b) => a + b, 0);
  if (total === 0) return totals.map(() => Math.round(100 / numOptions));
  return totals.map((t) => Math.round((t / total) * 100));
}
function getPool(bets) { return bets.reduce((s, b) => s + b.amount, 0); }
function deadlineLabel(dl) {
  const d = new Date(dl) - new Date();
  if (d < 0) return "Closed";
  const days = Math.floor(d / 86400000);
  if (days > 0) return `${days}d left`;
  const hrs = Math.floor(d / 3600000);
  return hrs > 0 ? `${hrs}h left` : "< 1h";
}
function generateDateOptions() {
  const now = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const opts = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    opts.push(`Before ${months[d.getMonth()]} ${d.getFullYear()}`);
  }
  const ny = now.getFullYear() + 1;
  opts.push(`Q1 ${ny}`, `Q2 ${ny}`, `Q3 ${ny}`, `Q4 ${ny}`, `${ny + 1} or later`, "Never");
  return opts;
}

function Spinner({ size = 14, color = "#fff" }) {
  return <span style={{ display: "inline-block", width: size, height: size, border: `2px solid rgba(255,255,255,0.15)`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.55s linear infinite" }} />;
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? "#ff5f57" : "#c8f135",
      color: toast.type === "error" ? "#fff" : "#0a0b14",
      padding: "11px 24px", borderRadius: 50, fontSize: 14, fontWeight: 700,
      zIndex: 9999, boxShadow: toast.type === "error" ? "0 0 24px rgba(255,95,87,0.5)" : "0 0 24px rgba(200,241,53,0.5)",
      animation: "fadeUp 0.2s ease", whiteSpace: "nowrap",
      fontFamily: "'Syne', sans-serif",
    }}>{toast.msg}</div>
  );
}

// ── Name Gate ────────────────────────────────────────────────────────────────
function NameGate({ onSave }) {
  const [name, setName] = useState("");
  const [shake, setShake] = useState(false);
  const submit = () => {
    if (!name.trim() || name.trim().length < 2) { setShake(true); setTimeout(() => setShake(false), 400); return; }
    onSave(name.trim());
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0b14", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20, overflow: "hidden" }}>
      {/* BG blobs */}
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,241,53,0.12) 0%, transparent 70%)", top: "-10%", right: "-5%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,95,87,0.1) 0%, transparent 70%)", bottom: "5%", left: "-5%", pointerEvents: "none" }} />

      <div style={{ maxWidth: 420, width: "100%", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🎲</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 38, fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 8 }}>
            Khel Mandli
          </div>
          <div style={{ color: "#4a5568", fontSize: 15 }}>Bets just between your friends</div>
        </div>

        <div style={{ background: "#11131f", border: "1.5px solid #1e2440", borderRadius: 20, padding: 28 }}>
          <label style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: "#c8f135", fontWeight: 700, letterSpacing: "0.12em", display: "block", marginBottom: 10 }}>
            WHAT DO YOUR FRIENDS CALL YOU?
          </label>
          <input
            autoFocus placeholder="e.g. Rahul" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            className={shake ? "shake" : ""}
            style={{
              width: "100%", background: "#0a0b14", border: "1.5px solid #1e2440",
              color: "#fff", borderRadius: 12, padding: "13px 16px",
              fontFamily: "'Syne', sans-serif", fontSize: 16, outline: "none", marginBottom: 16,
            }}
          />
          <button onClick={submit} style={{
            width: "100%", background: "#c8f135", color: "#0a0b14",
            border: "none", borderRadius: 12, padding: "14px 0",
            fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 0 20px rgba(200,241,53,0.3)", transition: "all 0.15s",
          }}>
            Let's Go 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Login Modal ───────────────────────────────────────────────────────────────
function LoginModal({ title, subtitle, accent, onLogin, onClose }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const attempt = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try { await onLogin(input.trim()); }
    catch { setError(true); setTimeout(() => setError(false), 600); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div style={{ background: "#11131f", border: `1.5px solid ${accent}40`, borderRadius: 20, padding: 28, maxWidth: 380, width: "100%", boxShadow: `0 0 40px ${accent}20` }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 4, color: "#fff" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#4a5568", marginBottom: 24 }}>{subtitle}</div>
        <input autoFocus type="password" placeholder="Password"
          value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()}
          className={error ? "shake" : ""}
          style={{ width: "100%", background: "#0a0b14", border: `1.5px solid ${error ? "#ff5f57" : "#1e2440"}`, color: "#fff", borderRadius: 12, padding: "12px 16px", fontFamily: "'Syne', sans-serif", fontSize: 15, outline: "none", marginBottom: error ? 8 : 16 }}
        />
        {error && <div style={{ color: "#ff5f57", fontSize: 13, marginBottom: 14, fontWeight: 600 }}>Wrong password 🙅</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1.5px solid #1e2440", color: "#4a5568", borderRadius: 10, padding: "11px 0", fontSize: 14, cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>Cancel</button>
          <button onClick={attempt} disabled={loading}
            style={{ flex: 2, background: accent, color: "#0a0b14", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <Spinner color="#0a0b14" /> : "Login →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Form ───────────────────────────────────────────────────────────────
function CreateForm({ username, password, onCreated, showToast }) {
  const [marketType, setMarketType] = useState("binary");
  const BLANK = { title: "", description: "", options: ["Yes", "No"], deadline: "" };
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(false);

  const setOptions = (opts) => setForm(p => ({ ...p, options: opts }));
  const switchType = (t) => { setMarketType(t); setOptions(t === "binary" ? ["Yes", "No"] : ["", ""]); };

  const submit = async () => {
    const opts = form.options.filter(o => o.trim());
    if (!form.title.trim()) { showToast("Question is required", "error"); return; }
    if (opts.length < 2) { showToast("Need at least 2 options", "error"); return; }
    if (!form.deadline) { showToast("Pick a deadline", "error"); return; }
    setLoading(true);
    try {
      const ev = await api("/api/events", { method: "POST", body: { ...form, options: opts, creator: username, password } });
      onCreated({ ...ev, bets: [] });
      setForm(BLANK); setMarketType("binary");
      showToast("Market is live! 🔥");
    } catch (e) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  const fieldStyle = { width: "100%", background: "#0a0b14", border: "1.5px solid #1e2440", color: "#fff", borderRadius: 12, padding: "12px 16px", fontFamily: "'Syne', sans-serif", fontSize: 14, outline: "none" };
  const labelStyle = { fontFamily: "'Syne', sans-serif", fontSize: 11, color: "#c8f135", fontWeight: 700, letterSpacing: "0.1em", display: "block", marginBottom: 8 };

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6, color: "#fff" }}>Create a Market</div>
      <div style={{ fontSize: 14, color: "#4a5568", marginBottom: 28 }}>Start a prediction. Let the chaos begin.</div>

      <div style={{ background: "#11131f", border: "1.5px solid #1e2440", borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Type toggle */}
        <div>
          <label style={labelStyle}>MARKET TYPE</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["binary", "🎯 Yes / No", "#c8f135"], ["multi", "📊 Multiple Options", "#38bdf8"]].map(([t, label, ac]) => (
              <button key={t} onClick={() => switchType(t)} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
                fontFamily: "'Syne', sans-serif", cursor: "pointer",
                background: marketType === t ? `${ac}18` : "transparent",
                border: `1.5px solid ${marketType === t ? ac : "#1e2440"}`,
                color: marketType === t ? ac : "#4a5568",
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Question */}
        <div>
          <label style={labelStyle}>THE QUESTION</label>
          <input placeholder={marketType === "binary" ? "Will Rohan actually wake up before 9am?" : "By when will Saumya enter AI?"}
            value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={fieldStyle} />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>CONTEXT (OPTIONAL)</label>
          <textarea rows={2} placeholder="Add some spicy context..." value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            style={{ ...fieldStyle, resize: "vertical" }} />
        </div>

        {/* Options */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>OPTIONS</label>
            {marketType === "multi" && (
              <button onClick={() => setOptions(generateDateOptions())}
                style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8", borderRadius: 8, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                📅 Use date ranges
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {form.options.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#4a5568", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <input placeholder={marketType === "binary" ? (i === 0 ? "Yes" : "No") : `Option ${i + 1}`}
                    value={opt} readOnly={marketType === "binary"}
                    onChange={e => { const o = [...form.options]; o[i] = e.target.value; setOptions(o); }}
                    style={{ ...fieldStyle, paddingLeft: 36, opacity: marketType === "binary" ? 0.65 : 1 }} />
                </div>
                {marketType === "multi" && form.options.length > 2 && (
                  <button onClick={() => setOptions(form.options.filter((_, j) => j !== i))}
                    style={{ background: "rgba(255,95,87,0.1)", border: "1px solid rgba(255,95,87,0.3)", color: "#ff5f57", borderRadius: 8, padding: "10px 12px", cursor: "pointer", flexShrink: 0, fontSize: 14, lineHeight: 1 }}>✕</button>
                )}
              </div>
            ))}
            {marketType === "multi" && (
              <button onClick={() => setOptions([...form.options, ""])}
                style={{ background: "transparent", border: "1.5px dashed #1e2440", color: "#4a5568", borderRadius: 12, padding: "10px 0", fontSize: 13, cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>
                + Add another option
              </button>
            )}
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label style={labelStyle}>DEADLINE</label>
          <input type="date" value={form.deadline} min={new Date().toISOString().split("T")[0]}
            onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
            onClick={e => e.target.showPicker && e.target.showPicker()}
            style={{ ...fieldStyle, colorScheme: "dark", cursor: "pointer" }} />
        </div>

        <button onClick={submit} disabled={loading} style={{
          background: "linear-gradient(135deg, #c8f135, #a8d420)",
          color: "#0a0b14", border: "none", borderRadius: 12, padding: "14px 0",
          fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 0 24px rgba(200,241,53,0.25)",
        }}>
          {loading ? <><Spinner color="#0a0b14" /> Creating...</> : "Launch Market 🚀"}
        </button>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPanel({ settings, adminPassword, showToast, onSaved }) {
  const [draft, setDraft] = useState(settings);
  const [newAdmin, setNewAdmin] = useState("");
  const [newCreator, setNewCreator] = useState("");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try {
      await api("/api/settings", { method: "POST", body: { ...draft, password: adminPassword, new_password: newAdmin || undefined, new_creator_password: newCreator || undefined } });
      setNewAdmin(""); setNewCreator(""); onSaved(draft); showToast("Settings saved ✓");
    } catch (e) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };
  const fieldStyle = { width: "100%", background: "#0a0b14", border: "1.5px solid #1e2440", color: "#fff", borderRadius: 12, padding: "12px 16px", fontFamily: "'Syne', sans-serif", fontSize: 14, outline: "none" };
  const labelStyle = { fontFamily: "'Syne', sans-serif", fontSize: 11, color: "#c8f135", fontWeight: 700, letterSpacing: "0.1em", display: "block", marginBottom: 8 };

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6, color: "#fff" }}>Settings</div>
      <div style={{ fontSize: 14, color: "#4a5568", marginBottom: 28 }}>Configure your prediction market</div>
      <div style={{ background: "#11131f", border: "1.5px solid #1e2440", borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label style={labelStyle}>CURRENCY LABEL</label>
          <input value={draft.currency || ""} onChange={e => setDraft(p => ({ ...p, currency: e.target.value }))} placeholder="pts" style={fieldStyle} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}><label style={labelStyle}>MIN BET</label><input type="number" value={draft.min_bet || ""} onChange={e => setDraft(p => ({ ...p, min_bet: e.target.value }))} style={fieldStyle} /></div>
          <div style={{ flex: 1 }}><label style={labelStyle}>MAX BET</label><input type="number" value={draft.max_bet || ""} onChange={e => setDraft(p => ({ ...p, max_bet: e.target.value }))} style={fieldStyle} /></div>
        </div>
        <div style={{ borderTop: "1.5px solid #1e2440", paddingTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff" }}>🔐 Passwords</div>
          <div><label style={labelStyle}>NEW ADMIN PASSWORD</label><input type="password" placeholder="Leave blank to keep current" value={newAdmin} onChange={e => setNewAdmin(e.target.value)} style={fieldStyle} /><div style={{ fontSize: 12, color: "#4a5568", marginTop: 5 }}>Full access — resolve, settings, everything</div></div>
          <div><label style={labelStyle}>NEW CREATOR PASSWORD</label><input type="password" placeholder="Leave blank to keep current" value={newCreator} onChange={e => setNewCreator(e.target.value)} style={fieldStyle} /><div style={{ fontSize: 12, color: "#4a5568", marginTop: 5 }}>Can create markets, can't resolve or change settings</div></div>
        </div>
        <button onClick={save} disabled={loading} style={{ background: "linear-gradient(135deg, #c8f135, #a8d420)", color: "#0a0b14", border: "none", borderRadius: 12, padding: "13px 0", fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Spinner color="#0a0b14" /> Saving...</> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── OPTION ROW COLORS ─────────────────────────────────────────────────────────
const OPTION_COLORS = ["#c8f135", "#38bdf8", "#ff5f57", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#facc15"];

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem("km_username") || "");
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({ min_bet: 50, max_bet: 1000, currency: "pts" });
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [rolePassword, setRolePassword] = useState("");
  const [loginModal, setLoginModal] = useState(null);
  const [view, setView] = useState("markets");
  const [filter, setFilter] = useState("live");
  const [toast, setToast] = useState(null);
  const [betModal, setBetModal] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [betLoading, setBetLoading] = useState(false);
  const [resolveModal, setResolveModal] = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2600); };

  const loadData = useCallback(async () => {
    try {
      const [evts, sett] = await Promise.all([api("/api/events"), api("/api/settings")]);
      setEvents(evts); setSettings(sett);
    } catch { showToast("Connection error", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const t = setInterval(loadData, 15000); return () => clearInterval(t); }, [loadData]);

  const saveUsername = (name) => { localStorage.setItem("km_username", name); setUsername(name); };

  const handleLogin = async (roleType, pwd) => {
    await api(roleType === "admin" ? "/api/auth/login" : "/api/auth/creator-login", { method: "POST", body: { password: pwd } });
    setRole(roleType); setRolePassword(pwd); setLoginModal(null);
    showToast(roleType === "admin" ? "Admin mode activated 👑" : "Creator mode activated ✏️");
  };

  const placeBet = async () => {
    const amt = Number(betAmount);
    const min = Number(settings.min_bet), max = Number(settings.max_bet);
    if (!amt || amt < min || amt > max) { showToast(`Bet must be ${min}–${max} ${settings.currency}`, "error"); return; }
    setBetLoading(true);
    try {
      const nb = await api(`/api/events/${betModal.eventId}/bets`, { method: "POST", body: { username, option_index: betModal.option, amount: amt } });
      setEvents(prev => prev.map(e => e.id === betModal.eventId ? { ...e, bets: [...e.bets, nb] } : e));
      setBetModal(null); setBetAmount("");
      showToast(`${amt} ${settings.currency} locked in! 🔒`);
    } catch (e) { showToast(e.message, "error"); }
    finally { setBetLoading(false); }
  };

  const resolveEvent = async () => {
    try {
      await api(`/api/events/${resolveModal.eventId}/resolve`, { method: "POST", body: { winner: resolveModal.option, password: rolePassword } });
      setEvents(prev => prev.map(e => e.id === resolveModal.eventId ? { ...e, resolved: true, winner: resolveModal.option } : e));
      setResolveModal(null); showToast("Market resolved! 🏆");
    } catch (e) { showToast(e.message, "error"); }
  };

  const leaderboard = () => {
    const scores = {};
    events.forEach(e => {
      e.bets.forEach(b => {
        if (!scores[b.user]) scores[b.user] = { wagered: 0, won: 0, bets: 0, correct: 0 };
        scores[b.user].wagered += b.amount; scores[b.user].bets += 1;
        if (e.resolved) {
          const pool = getPool(e.bets); const winPool = e.bets.filter(x => x.option === e.winner).reduce((s, x) => s + x.amount, 0);
          if (b.option === e.winner && winPool > 0) { scores[b.user].won += Math.round((b.amount / winPool) * pool); scores[b.user].correct += 1; }
        }
      });
    });
    return Object.entries(scores).map(([name, s]) => ({ name, ...s, pnl: s.won - s.wagered })).sort((a, b) => b.pnl - a.pnl);
  };

  const filteredEvents = events.filter(e => filter === "live" ? !e.resolved : filter === "resolved" ? e.resolved : true);
  const canCreate = role === "admin" || role === "creator";

  if (!username) return <NameGate onSave={saveUsername} />;

  const NAV_TABS = ["markets", "leaderboard", ...(canCreate ? ["create"] : []), ...(role === "admin" ? ["settings"] : [])];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b14", color: "#fff", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Syne', sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0b14; } ::-webkit-scrollbar-thumb { background: #1e2440; border-radius: 4px; }
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:0.5; transform:scale(0.85)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .shake { animation: shake 0.3s ease; }
        input, textarea { transition: border-color 0.15s, box-shadow 0.15s; font-family: 'Syne', sans-serif; }
        input:focus, textarea:focus { border-color: #c8f135 !important; box-shadow: 0 0 0 3px rgba(200,241,53,0.1) !important; outline: none; }
        input::placeholder, textarea::placeholder { color: #2d3352; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4) sepia(1) saturate(3) hue-rotate(60deg); cursor: pointer; }
        .market-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .market-card:hover { transform: translateY(-3px); }
        .bet-btn { transition: all 0.15s ease; }
        .bet-btn:hover { transform: scale(1.04); filter: brightness(1.1); }
        .trow { transition: background 0.12s; }
        .trow:hover { background: rgba(200,241,53,0.04) !important; }
        .tab-btn { transition: all 0.15s; }
        .tab-btn:hover { color: #fff !important; }
        select option { background: #11131f; }
      `}</style>

      {/* ── Background blobs ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,241,53,0.06) 0%, transparent 65%)", top: "-15%", right: "-10%" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.06) 0%, transparent 65%)", bottom: "10%", left: "-8%" }} />
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,95,87,0.05) 0%, transparent 65%)", top: "40%", left: "40%" }} />
      </div>

      {/* ── Navbar ── */}
      <nav style={{ borderBottom: "1px solid #1a1e30", background: "rgba(10,11,20,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, animation: "float 3s ease-in-out infinite" }}>🎲</span>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.5px" }}>
              Khel <span style={{ color: "#c8f135" }}>Mandli</span>
            </span>
          </div>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "#11131f", border: "1px solid #1e2440", borderRadius: 50, padding: "5px 14px 5px 10px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #c8f135, #38bdf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#0a0b14" }}>
                {username.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{username}</span>
              <button onClick={() => { localStorage.removeItem("km_username"); setUsername(""); }} style={{ background: "none", border: "none", color: "#2d3352", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            {role ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 50, letterSpacing: "0.08em",
                  background: role === "admin" ? "rgba(200,241,53,0.12)" : "rgba(56,189,248,0.12)",
                  border: `1px solid ${role === "admin" ? "rgba(200,241,53,0.3)" : "rgba(56,189,248,0.3)"}`,
                  color: role === "admin" ? "#c8f135" : "#38bdf8",
                }}>
                  {role === "admin" ? "👑 ADMIN" : "✏️ CREATOR"}
                </span>
                <button onClick={() => { setRole(null); setRolePassword(""); if (view === "settings") setView("markets"); }}
                  style={{ background: "transparent", border: "1px solid #1e2440", color: "#4a5568", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                  Logout
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setLoginModal("creator")}
                  style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8", borderRadius: 8, padding: "6px 13px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                  Creator
                </button>
                <button onClick={() => setLoginModal("admin")}
                  style={{ background: "rgba(200,241,53,0.08)", border: "1px solid rgba(200,241,53,0.2)", color: "#c8f135", borderRadius: 8, padding: "6px 13px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                  Admin
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px", display: "flex", gap: 0 }}>
          {NAV_TABS.map(v => (
            <button key={v} className="tab-btn" onClick={() => setView(v)} style={{
              background: "transparent", border: "none", borderBottom: `2px solid ${view === v ? "#c8f135" : "transparent"}`,
              color: view === v ? "#c8f135" : "#4a5568", padding: "11px 16px", fontSize: 14,
              fontWeight: 700, cursor: "pointer", fontFamily: "'Syne', sans-serif",
            }}>
              {v === "markets" ? "🏪 Markets" : v === "leaderboard" ? "🏆 Board" : v === "create" ? "➕ Create" : "⚙️ Settings"}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px", position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 100, color: "#4a5568" }}>
            <div style={{ marginBottom: 16 }}><Spinner size={32} color="#c8f135" /></div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Loading markets...</div>
          </div>
        ) : (
          <>
            {/* ══ MARKETS ══ */}
            {view === "markets" && (
              <div>
                {/* Stats row */}
                <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
                  {[
                    ["🟢", "Live Markets", events.filter(e => !e.resolved).length, "#c8f135"],
                    ["💰", "Total Volume", `${events.reduce((s, e) => s + getPool(e.bets), 0).toLocaleString()} ${settings.currency}`, "#38bdf8"],
                    ["✅", "Settled", events.filter(e => e.resolved).length, "#a78bfa"],
                  ].map(([icon, label, val, color]) => (
                    <div key={label} style={{ background: "#11131f", border: `1.5px solid #1e2440`, borderRadius: 16, padding: "16px 20px", flex: "1 1 150px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06 }}>{icon}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: 12, color: "#4a5568", marginTop: 4, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Filter pills */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                  {[["live", "🔥 Live", "#c8f135"], ["resolved", "✅ Settled", "#a78bfa"], ["all", "📋 All", "#94a3b8"]].map(([f, label, color]) => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                      background: filter === f ? `${color}18` : "transparent",
                      border: `1.5px solid ${filter === f ? color : "#1e2440"}`,
                      color: filter === f ? color : "#4a5568",
                      borderRadius: 50, padding: "7px 18px", fontSize: 13, cursor: "pointer",
                      fontWeight: 700, fontFamily: "'Syne', sans-serif", transition: "all 0.15s",
                    }}>{label}</button>
                  ))}
                </div>

                {filteredEvents.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 0" }}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                      {filter === "live" ? "No active markets yet" : "Nothing here"}
                    </div>
                    <div style={{ fontSize: 14, color: "#4a5568" }}>
                      {canCreate ? "Go to + Create to start one" : "Ask an admin or creator to start a market"}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {filteredEvents.map((event, eventIdx) => {
                      const odds = getOdds(event.bets, event.options.length);
                      const pool = getPool(event.bets);
                      const expired = new Date(event.deadline) < new Date();
                      const canBet = !event.resolved && !expired;
                      const cardAccent = OPTION_COLORS[eventIdx % OPTION_COLORS.length];

                      return (
                        <div key={event.id} className="market-card" style={{
                          background: "#11131f",
                          border: `1.5px solid #1e2440`,
                          borderRadius: 20, padding: "22px 24px",
                          boxShadow: canBet ? `0 4px 30px ${cardAccent}10` : "none",
                          position: "relative", overflow: "hidden",
                        }}>
                          {/* Accent top bar */}
                          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: canBet ? `linear-gradient(90deg, ${cardAccent}80, transparent)` : "transparent", borderRadius: "20px 20px 0 0" }} />

                          {/* Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                {canBet && (
                                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#22c55e", fontWeight: 800, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 50, padding: "3px 10px" }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                                    LIVE · {deadlineLabel(event.deadline)}
                                  </span>
                                )}
                                {event.resolved && (
                                  <span style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 50, padding: "3px 10px" }}>✅ SETTLED</span>
                                )}
                                {expired && !event.resolved && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#4a5568", background: "#11131f", border: "1px solid #1e2440", borderRadius: 50, padding: "3px 10px" }}>⏰ CLOSED</span>
                                )}
                                <span style={{ fontSize: 11, color: "#2d3352", fontWeight: 600 }}>by {event.creator}</span>
                              </div>
                              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, lineHeight: 1.35, color: "#fff" }}>{event.title}</div>
                              {event.description && <div style={{ fontSize: 13, color: "#4a5568", marginTop: 5 }}>{event.description}</div>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, background: "#0a0b14", border: "1px solid #1e2440", borderRadius: 12, padding: "10px 14px" }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: cardAccent }}>{pool.toLocaleString()}</div>
                              <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2, fontWeight: 600 }}>{settings.currency} pool</div>
                              <div style={{ fontSize: 11, color: "#2d3352", marginTop: 1 }}>{event.bets.length} bets</div>
                            </div>
                          </div>

                          {/* Options */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {event.options.map((opt, i) => {
                              const isWinner = event.resolved && event.winner === i;
                              const isLoser = event.resolved && event.winner !== null && event.winner !== i;
                              const optPool = event.bets.filter(b => b.option === i).reduce((s, b) => s + b.amount, 0);
                              const myAmt = event.bets.filter(b => b.user === username && b.option === i).reduce((s, b) => s + b.amount, 0);
                              const color = OPTION_COLORS[i % OPTION_COLORS.length];

                              return (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12,
                                  background: isWinner ? "rgba(200,241,53,0.06)" : "#0a0b14",
                                  border: `1.5px solid ${isWinner ? "rgba(200,241,53,0.3)" : "#1e2440"}`,
                                  opacity: isLoser ? 0.35 : 1,
                                  transition: "all 0.15s",
                                }}>
                                  {/* % badge */}
                                  <div style={{
                                    fontFamily: "'DM Mono', monospace", fontSize: 17, fontWeight: 700, minWidth: 52,
                                    color: isWinner ? "#c8f135" : color,
                                  }}>
                                    {odds[i]}%
                                  </div>

                                  {/* Bar + label */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                      <span style={{ fontSize: 14, fontWeight: isWinner ? 800 : 600, color: isWinner ? "#c8f135" : "#fff" }}>
                                        {isWinner && "✓ "}{opt}
                                      </span>
                                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#4a5568", flexShrink: 0, marginLeft: 8 }}>
                                        {optPool.toLocaleString()} {settings.currency}
                                        {myAmt > 0 && <span style={{ color: "#38bdf8", marginLeft: 8 }}>· you: {myAmt}</span>}
                                      </span>
                                    </div>
                                    <div style={{ height: 5, background: "#1a1e30", borderRadius: 3, overflow: "hidden" }}>
                                      <div style={{
                                        height: "100%", width: `${odds[i]}%`,
                                        background: isWinner ? "linear-gradient(90deg, #c8f135, #a8d420)" : `linear-gradient(90deg, ${color}99, ${color}44)`,
                                        borderRadius: 3, transition: "width 0.5s ease",
                                        boxShadow: isWinner ? `0 0 8px rgba(200,241,53,0.5)` : `0 0 6px ${color}44`,
                                      }} />
                                    </div>
                                  </div>

                                  {/* Bet button */}
                                  {canBet && (
                                    <button className="bet-btn"
                                      onClick={() => { setBetModal({ eventId: event.id, option: i, optionLabel: opt, eventTitle: event.title, color }); setBetAmount(""); }}
                                      style={{
                                        background: `${color}18`, color, border: `1.5px solid ${color}40`,
                                        borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 800,
                                        cursor: "pointer", flexShrink: 0, fontFamily: "'Syne', sans-serif",
                                      }}>
                                      Bet
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Admin resolve row */}
                          {role === "admin" && !event.resolved && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1a1e30", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, color: "#4a5568", fontWeight: 700 }}>Resolve as:</span>
                              {event.options.map((opt, i) => (
                                <button key={i} onClick={() => setResolveModal({ eventId: event.id, option: i, optionLabel: opt, eventTitle: event.title })}
                                  style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Recent bets ticker */}
                          {event.bets.length > 0 && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1a1e30" }}>
                              <div style={{ fontSize: 10, color: "#2d3352", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>RECENT BETS</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {[...event.bets].reverse().slice(0, 8).map((b, idx) => (
                                  <span key={idx} style={{
                                    fontSize: 12, background: "#0a0b14", border: `1px solid ${b.user === username ? "rgba(56,189,248,0.3)" : "#1e2440"}`,
                                    borderRadius: 50, padding: "3px 11px", color: b.user === username ? "#38bdf8" : "#4a5568", fontWeight: 600,
                                  }}>
                                    {b.user} · {b.amount}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ LEADERBOARD ══ */}
            {view === "leaderboard" && (
              <div>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>🏆 Leaderboard</div>
                  <div style={{ fontSize: 14, color: "#4a5568" }}>Who's actually good at predictions?</div>
                </div>
                {leaderboard().length === 0 ? (
                  <div style={{ textAlign: "center", padding: 80, color: "#4a5568" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🤷</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>No settled markets yet</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {leaderboard().map((p, i) => {
                      const medals = ["🥇", "🥈", "🥉"];
                      const isMe = p.name === username;
                      return (
                        <div key={p.name} className="trow" style={{
                          background: isMe ? "rgba(56,189,248,0.05)" : "#11131f",
                          border: `1.5px solid ${isMe ? "rgba(56,189,248,0.25)" : "#1e2440"}`,
                          borderRadius: 14, padding: "16px 20px",
                          display: "flex", alignItems: "center", gap: 16,
                        }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, minWidth: 36, textAlign: "center", color: i < 3 ? "#c8f135" : "#2d3352" }}>
                            {medals[i] || i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15, color: isMe ? "#38bdf8" : "#fff" }}>{p.name}{isMe && " (you)"}</div>
                            <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>{p.bets} bets · {p.correct || 0} correct</div>
                          </div>
                          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#4a5568" }}>{p.wagered.toLocaleString()}</div>
                              <div style={{ fontSize: 10, color: "#2d3352", fontWeight: 700, letterSpacing: "0.05em" }}>WAGERED</div>
                            </div>
                            <div style={{ textAlign: "right", minWidth: 80 }}>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: p.pnl >= 0 ? "#c8f135" : "#ff5f57" }}>
                                {p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString()}
                              </div>
                              <div style={{ fontSize: 10, color: "#2d3352", fontWeight: 700, letterSpacing: "0.05em" }}>P&L</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ CREATE ══ */}
            {view === "create" && canCreate && (
              <CreateForm
                username={username} password={rolePassword}
                onCreated={(ev) => { setEvents(prev => [ev, ...prev]); setView("markets"); }}
                showToast={showToast}
              />
            )}

            {/* ══ SETTINGS ══ */}
            {view === "settings" && role === "admin" && (
              <SettingsPanel settings={settings} adminPassword={rolePassword} showToast={showToast} onSaved={s => setSettings(s)} />
            )}
          </>
        )}
      </div>

      {/* ══ BET MODAL ══ */}
      {betModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(8px)" }} onClick={() => setBetModal(null)}>
          <div style={{ background: "#11131f", border: `1.5px solid ${betModal.color}40`, borderRadius: 20, padding: 28, maxWidth: 400, width: "100%", boxShadow: `0 0 40px ${betModal.color}15` }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, color: betModal.color, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 4 }}>PLACE BET</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 800, marginBottom: 10, color: "#fff" }}>{betModal.eventTitle}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${betModal.color}18`, border: `1.5px solid ${betModal.color}40`, borderRadius: 8, padding: "7px 14px", fontSize: 14, color: betModal.color, marginBottom: 22, fontWeight: 800 }}>
              → {betModal.optionLabel}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#4a5568", fontWeight: 800, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
                AMOUNT ({settings.min_bet}–{settings.max_bet} {settings.currency})
              </label>
              <input autoFocus type="number" placeholder={`e.g. ${settings.min_bet}`} value={betAmount}
                onChange={e => setBetAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && placeBet()}
                style={{ width: "100%", background: "#0a0b14", border: "1.5px solid #1e2440", color: "#fff", borderRadius: 12, padding: "12px 16px", fontFamily: "'DM Mono', monospace", fontSize: 16, outline: "none", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 6 }}>
                {[Number(settings.min_bet), Math.round((Number(settings.min_bet) + Number(settings.max_bet)) / 2), Number(settings.max_bet)].map(v => (
                  <button key={v} onClick={() => setBetAmount(String(v))}
                    style={{ flex: 1, background: "#0a0b14", border: "1.5px solid #1e2440", color: "#4a5568", borderRadius: 8, padding: "8px 0", fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono', monospace", fontWeight: 700, transition: "all 0.1s" }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBetModal(null)} style={{ flex: 1, background: "transparent", border: "1.5px solid #1e2440", color: "#4a5568", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer", fontWeight: 700 }}>Cancel</button>
              <button onClick={placeBet} disabled={betLoading}
                style={{ flex: 2, background: betModal.color, color: "#0a0b14", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", opacity: betLoading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'Syne', sans-serif" }}>
                {betLoading ? <><Spinner color="#0a0b14" /> Locking in...</> : "Confirm Bet 🔒"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RESOLVE MODAL ══ */}
      {resolveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(8px)" }} onClick={() => setResolveModal(null)}>
          <div style={{ background: "#11131f", border: "1.5px solid rgba(167,139,250,0.3)", borderRadius: 20, padding: 28, maxWidth: 380, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Resolve Market</div>
            <div style={{ fontSize: 13, color: "#4a5568", marginBottom: 18 }}>{resolveModal.eventTitle}</div>
            <div style={{ background: "rgba(200,241,53,0.08)", border: "1.5px solid rgba(200,241,53,0.3)", borderRadius: 12, padding: "14px 18px", fontSize: 15, color: "#c8f135", marginBottom: 12, fontWeight: 800 }}>
              🏆 Winner: {resolveModal.optionLabel}
            </div>
            <div style={{ fontSize: 13, color: "#4a5568", marginBottom: 22 }}>Points distributed to winners. Can't be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setResolveModal(null)} style={{ flex: 1, background: "transparent", border: "1.5px solid #1e2440", color: "#4a5568", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer", fontWeight: 700 }}>Cancel</button>
              <button onClick={resolveEvent} style={{ flex: 2, background: "linear-gradient(135deg, #c8f135, #a8d420)", color: "#0a0b14", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
                Confirm ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOGIN MODALS ══ */}
      {loginModal === "admin" && (
        <LoginModal title="Admin Login 👑" subtitle="Full access — resolve markets, change settings and passwords" accent="#c8f135"
          onLogin={(pwd) => handleLogin("admin", pwd)} onClose={() => setLoginModal(null)} />
      )}
      {loginModal === "creator" && (
        <LoginModal title="Creator Login ✏️" subtitle="Create markets and place bets — can't resolve or change settings" accent="#38bdf8"
          onLogin={(pwd) => handleLogin("creator", pwd)} onClose={() => setLoginModal(null)} />
      )}

      <Toast toast={toast} />
    </div>
  );
}
