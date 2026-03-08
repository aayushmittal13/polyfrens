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
  return hrs > 0 ? `${hrs}h left` : "< 1h left";
}
function fmtDate(dl) {
  return new Date(dl).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const C = {
  bg: "#0d0f14", surface: "#161b27", border: "#1e2a3a",
  text: "#f1f5f9", muted: "#64748b", subtle: "#94a3b8",
  blue: "#3b82f6", green: "#22c55e", red: "#ef4444", yellow: "#f59e0b",
};

function Spinner({ size = 14 }) {
  return <span style={{ display: "inline-block", width: size, height: size, border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.55s linear infinite" }} />;
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? C.red : C.green,
      color: "#fff", padding: "10px 22px", borderRadius: 6, fontSize: 14, fontWeight: 500,
      zIndex: 9999, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", animation: "fadeUp 0.2s ease", whiteSpace: "nowrap",
    }}>{toast.msg}</div>
  );
}

// ── Name Gate ─────────────────────────────────────────────────────────────────
function NameGate({ onSave }) {
  const [name, setName] = useState("");
  const [shake, setShake] = useState(false);
  const submit = () => {
    if (!name.trim() || name.trim().length < 2) { setShake(true); setTimeout(() => setShake(false), 400); return; }
    onSave(name.trim());
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ maxWidth: 380, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Khel Mandli</div>
          <div style={{ color: C.muted, fontSize: 14 }}>Bets just between your friends</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>YOUR NAME</label>
          <input
            autoFocus placeholder="e.g. Rahul" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            className={shake ? "shake" : ""}
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "11px 14px", fontSize: 15, outline: "none", marginBottom: 14 }}
          />
          <button onClick={submit} style={{ width: "100%", background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Enter →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Login Modal ───────────────────────────────────────────────────────────────
function LoginModal({ title, subtitle, onLogin, onClose }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const attempt = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await onLogin(input.trim());
    } catch {
      setError(true); setTimeout(() => setError(false), 600);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 360, width: "100%" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{subtitle}</div>
        <input
          autoFocus type="password" placeholder="Password"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && attempt()}
          className={error ? "shake" : ""}
          style={{ width: "100%", background: C.bg, border: `1px solid ${error ? C.red : C.border}`, color: C.text, borderRadius: 6, padding: "11px 14px", fontSize: 14, outline: "none", marginBottom: error ? 8 : 14 }}
        />
        {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>Incorrect password</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={attempt} disabled={loading}
            style={{ flex: 2, background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><Spinner /> Checking...</> : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Date options generator ────────────────────────────────────────────────────
function generateDateOptions() {
  const now = new Date();
  const options = [];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Next 6 individual months
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(`Before ${months[d.getMonth()]} ${d.getFullYear()}`);
  }
  // Quarters
  const year = now.getFullYear();
  const nextYear = year + 1;
  options.push(`Q1 ${nextYear}`, `Q2 ${nextYear}`, `Q3 ${nextYear}`, `Q4 ${nextYear}`);
  options.push(`${nextYear + 1} or later`, "Never");
  return options;
}

// ── Create Market Form ────────────────────────────────────────────────────────
function CreateForm({ username, password, onCreated, showToast }) {
  const [marketType, setMarketType] = useState("binary"); // binary | multi
  const BLANK = { title: "", description: "", options: ["Yes", "No"], deadline: "" };
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const dateRef = useState(null);

  const setOptions = (opts) => setForm(p => ({ ...p, options: opts }));

  const switchType = (t) => {
    setMarketType(t);
    if (t === "binary") setOptions(["Yes", "No"]);
    else setOptions(["", ""]);
  };

  const insertDateOptions = () => setOptions(generateDateOptions());

  const submit = async () => {
    const opts = form.options.filter(o => o.trim());
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    if (opts.length < 2) { showToast("Need at least 2 options", "error"); return; }
    if (!form.deadline) { showToast("Deadline is required", "error"); return; }
    setLoading(true);
    try {
      const ev = await api("/api/events", {
        method: "POST",
        body: { ...form, options: opts, creator: username, password },
      });
      onCreated({ ...ev, bets: [] });
      setForm(BLANK);
      setMarketType("binary");
      showToast("Market created");
    } catch (e) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  const inp = { width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "10px 13px", fontSize: 14, outline: "none" };
  const lbl = { fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", display: "block", marginBottom: 8 };

  return (
    <div style={{ maxWidth: 540 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Create Market</div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Market type toggle */}
        <div>
          <label style={lbl}>MARKET TYPE</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["binary", "Yes / No"], ["multi", "Multiple Options"]].map(([t, label]) => (
              <button key={t} onClick={() => switchType(t)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
                  background: marketType === t ? "rgba(59,130,246,0.12)" : "transparent",
                  border: `1px solid ${marketType === t ? C.blue : C.border}`,
                  color: marketType === t ? C.blue : C.subtle,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={lbl}>QUESTION *</label>
          <input placeholder={marketType === "binary" ? "Will Rohan wake up before 9am this week?" : "By when will Saumya enter AI?"} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={inp} />
        </div>

        {/* Description */}
        <div>
          <label style={lbl}>DESCRIPTION</label>
          <textarea rows={2} placeholder="Optional context..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        {/* Options */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ ...lbl, marginBottom: 0 }}>OPTIONS *</label>
            {marketType === "multi" && (
              <button onClick={insertDateOptions}
                style={{ background: "rgba(59,130,246,0.1)", border: `1px solid rgba(59,130,246,0.2)`, color: C.blue, borderRadius: 5, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                📅 Insert date options
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {form.options.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  placeholder={marketType === "binary" ? (i === 0 ? "Yes" : "No") : `Option ${i + 1}`}
                  value={opt}
                  readOnly={marketType === "binary"}
                  onChange={e => { const opts = [...form.options]; opts[i] = e.target.value; setOptions(opts); }}
                  style={{ ...inp, opacity: marketType === "binary" ? 0.6 : 1, cursor: marketType === "binary" ? "default" : "text" }}
                />
                {marketType === "multi" && form.options.length > 2 && (
                  <button onClick={() => setOptions(form.options.filter((_, j) => j !== i))}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "8px 11px", cursor: "pointer", flexShrink: 0, fontSize: 14, lineHeight: 1 }}>✕</button>
                )}
              </div>
            ))}
            {marketType === "multi" && (
              <button onClick={() => setOptions([...form.options, ""])}
                style={{ background: "transparent", border: `1px dashed ${C.border}`, color: C.muted, borderRadius: 6, padding: "9px 0", fontSize: 13, cursor: "pointer" }}>
                + Add option
              </button>
            )}
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label style={lbl}>DEADLINE *</label>
          <input
            type="date"
            value={form.deadline}
            min={new Date().toISOString().split("T")[0]}
            onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
            onClick={e => e.target.showPicker && e.target.showPicker()}
            style={{ ...inp, colorScheme: "dark", cursor: "pointer" }}
          />
        </div>

        <button onClick={submit} disabled={loading}
          style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading ? <><Spinner /> Creating...</> : "Create Market"}
        </button>
      </div>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel({ settings, adminPassword, creatorPassword, showToast, onSaved }) {
  const [draft, setDraft] = useState(settings);
  const [newAdminPwd, setNewAdminPwd] = useState("");
  const [newCreatorPwd, setNewCreatorPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (Number(draft.min_bet) >= Number(draft.max_bet)) { showToast("Min must be less than max", "error"); return; }
    setLoading(true);
    try {
      await api("/api/settings", {
        method: "POST",
        body: {
          ...draft,
          password: adminPassword,
          new_password: newAdminPwd || undefined,
          new_creator_password: newCreatorPwd || undefined,
        },
      });
      setNewAdminPwd(""); setNewCreatorPwd("");
      onSaved(draft);
      showToast("Settings saved");
    } catch (e) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  const inp = { width: "100%", background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "10px 13px", fontSize: 14, outline: "none" };
  const lbl = { fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", display: "block", marginBottom: 8 };

  return (
    <div style={{ maxWidth: 460 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Settings</div>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={lbl}>CURRENCY LABEL</label>
          <input value={draft.currency || ""} onChange={e => setDraft(p => ({ ...p, currency: e.target.value }))} placeholder="pts" style={inp} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>MIN BET</label>
            <input type="number" value={draft.min_bet || ""} onChange={e => setDraft(p => ({ ...p, min_bet: e.target.value }))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>MAX BET</label>
            <input type="number" value={draft.max_bet || ""} onChange={e => setDraft(p => ({ ...p, max_bet: e.target.value }))} style={inp} />
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.subtle, marginBottom: 2 }}>Passwords</div>
          <div>
            <label style={lbl}>NEW ADMIN PASSWORD</label>
            <input type="password" placeholder="Leave blank to keep current" value={newAdminPwd} onChange={e => setNewAdminPwd(e.target.value)} style={inp} />
            <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>Full access: resolve markets, change settings</div>
          </div>
          <div>
            <label style={lbl}>NEW CREATOR PASSWORD</label>
            <input type="password" placeholder="Leave blank to keep current" value={newCreatorPwd} onChange={e => setNewCreatorPwd(e.target.value)} style={inp} />
            <div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>Can create markets, cannot resolve or change settings</div>
          </div>
        </div>
        <button onClick={save} disabled={loading}
          style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {loading ? <><Spinner /> Saving...</> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem("km_username") || "");
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({ min_bet: 50, max_bet: 1000, currency: "pts" });
  const [loading, setLoading] = useState(true);

  // Role state: null | "admin" | "creator"
  const [role, setRole] = useState(null);
  const [rolePassword, setRolePassword] = useState(""); // password in memory for admin actions

  // Which login modal is open
  const [loginModal, setLoginModal] = useState(null); // null | "admin" | "creator"

  const [view, setView] = useState("markets");
  const [filter, setFilter] = useState("live");
  const [toast, setToast] = useState(null);

  const [betModal, setBetModal] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [betLoading, setBetLoading] = useState(false);

  const [resolveModal, setResolveModal] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const loadData = useCallback(async () => {
    try {
      const [evts, sett] = await Promise.all([api("/api/events"), api("/api/settings")]);
      setEvents(evts);
      setSettings(sett);
    } catch { showToast("Failed to load data", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const t = setInterval(loadData, 15000); return () => clearInterval(t); }, [loadData]);

  const saveUsername = (name) => { localStorage.setItem("km_username", name); setUsername(name); };

  const handleLogin = async (roleType, password) => {
    const endpoint = roleType === "admin" ? "/api/auth/login" : "/api/auth/creator-login";
    await api(endpoint, { method: "POST", body: { password } });
    setRole(roleType);
    setRolePassword(password);
    setLoginModal(null);
    showToast(roleType === "admin" ? "Logged in as Admin" : "Logged in as Creator");
  };

  const logout = () => { setRole(null); setRolePassword(""); if (view === "settings") setView("markets"); };

  const placeBet = async () => {
    const amt = Number(betAmount);
    const min = Number(settings.min_bet), max = Number(settings.max_bet);
    if (!amt || amt < min || amt > max) { showToast(`Bet must be ${min}–${max} ${settings.currency}`, "error"); return; }
    setBetLoading(true);
    try {
      const newBet = await api(`/api/events/${betModal.eventId}/bets`, { method: "POST", body: { username, option_index: betModal.option, amount: amt } });
      setEvents(prev => prev.map(e => e.id === betModal.eventId ? { ...e, bets: [...e.bets, newBet] } : e));
      setBetModal(null); setBetAmount("");
      showToast(`${amt} ${settings.currency} placed on "${betModal.optionLabel}"`);
    } catch (e) { showToast(e.message, "error"); }
    finally { setBetLoading(false); }
  };

  const resolveEvent = async () => {
    try {
      await api(`/api/events/${resolveModal.eventId}/resolve`, { method: "POST", body: { winner: resolveModal.option, password: rolePassword } });
      setEvents(prev => prev.map(e => e.id === resolveModal.eventId ? { ...e, resolved: true, winner: resolveModal.option } : e));
      setResolveModal(null); showToast("Market resolved");
    } catch (e) { showToast(e.message, "error"); }
  };

  const leaderboard = () => {
    const scores = {};
    events.forEach(e => {
      e.bets.forEach(b => {
        if (!scores[b.user]) scores[b.user] = { wagered: 0, won: 0, bets: 0, correct: 0 };
        scores[b.user].wagered += b.amount; scores[b.user].bets += 1;
        if (e.resolved) {
          const pool = getPool(e.bets);
          const winPool = e.bets.filter(x => x.option === e.winner).reduce((s, x) => s + x.amount, 0);
          if (b.option === e.winner && winPool > 0) { scores[b.user].won += Math.round((b.amount / winPool) * pool); scores[b.user].correct += 1; }
        }
      });
    });
    return Object.entries(scores).map(([name, s]) => ({ name, ...s, pnl: s.won - s.wagered })).sort((a, b) => b.pnl - a.pnl);
  };

  const filteredEvents = events.filter(e => filter === "live" ? !e.resolved : filter === "resolved" ? e.resolved : true);
  const canCreate = role === "admin" || role === "creator";

  const inp = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "10px 13px", fontSize: 14, outline: "none" };

  if (!username) return <NameGate onSave={saveUsername} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0d0f14; } ::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 4px; }
        @keyframes fadeUp { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .shake { animation: shake 0.3s ease; }
        input, textarea { transition: border-color 0.15s; }
        input:focus, textarea:focus { border-color: #3b82f6 !important; }
        input::placeholder, textarea::placeholder { color: #334155; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
        .trow:hover { background: rgba(255,255,255,0.02); }
        .card:hover { border-color: #2a3a52 !important; }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: C.bg, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Khel Mandli</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.muted }}>
              {username}
              <button onClick={() => { localStorage.removeItem("km_username"); setUsername(""); }} style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 11, marginLeft: 5 }}>✕</button>
            </span>

            {role ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, letterSpacing: "0.05em", color: role === "admin" ? C.yellow : C.green, background: role === "admin" ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${role === "admin" ? "rgba(245,158,11,0.2)" : "rgba(34,197,94,0.2)"}` }}>
                  {role === "admin" ? "ADMIN" : "CREATOR"}
                </span>
                <button onClick={logout} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>Logout</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setLoginModal("creator")} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "6px 13px", fontSize: 13, cursor: "pointer" }}>
                  Creator
                </button>
                <button onClick={() => setLoginModal("admin")} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "6px 13px", fontSize: 13, cursor: "pointer" }}>
                  Admin
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px", display: "flex" }}>
          {["markets", "leaderboard", ...(canCreate ? ["create"] : []), ...(role === "admin" ? ["settings"] : [])].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: "transparent", border: "none", borderBottom: `2px solid ${view === v ? C.blue : "transparent"}`,
              color: view === v ? C.text : C.muted, padding: "11px 16px", fontSize: 14,
              fontWeight: view === v ? 500 : 400, cursor: "pointer", transition: "all 0.15s",
            }}>
              {v === "create" ? "+ Create" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: C.muted, fontSize: 14 }}>
            <div style={{ marginBottom: 12 }}><Spinner size={28} /></div>Loading...
          </div>
        ) : (
          <>
            {/* ══ MARKETS ══ */}
            {view === "markets" && (
              <div>
                {/* Stats */}
                <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                  {[
                    ["Live Markets", events.filter(e => !e.resolved).length],
                    ["Total Volume", `${events.reduce((s, e) => s + getPool(e.bets), 0).toLocaleString()} ${settings.currency}`],
                    ["Settled", events.filter(e => e.resolved).length],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 18px", flex: "1 1 140px" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px" }}>{val}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                  {[["live", "Live"], ["resolved", "Settled"], ["all", "All"]].map(([f, label]) => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                      background: filter === f ? "rgba(59,130,246,0.1)" : "transparent",
                      border: `1px solid ${filter === f ? C.blue : C.border}`,
                      color: filter === f ? C.blue : C.muted,
                      borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer",
                    }}>{label}</button>
                  ))}
                </div>

                {filteredEvents.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 0", color: C.muted }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 15 }}>{filter === "live" ? "No active markets" : "Nothing here"}</div>
                    {canCreate && filter === "live" && <div style={{ fontSize: 13, color: "#334155", marginTop: 6 }}>Create one from the + Create tab</div>}
                    {!canCreate && filter === "live" && <div style={{ fontSize: 13, color: "#334155", marginTop: 6 }}>Log in as Creator or Admin to create markets</div>}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredEvents.map(event => {
                      const odds = getOdds(event.bets, event.options.length);
                      const pool = getPool(event.bets);
                      const expired = new Date(event.deadline) < new Date();
                      const canBet = !event.resolved && !expired;

                      return (
                        <div key={event.id} className="card" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px 20px", transition: "border-color 0.15s" }}>
                          {/* Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                {canBet && (
                                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.green, fontWeight: 500 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                                    LIVE · {deadlineLabel(event.deadline)}
                                  </span>
                                )}
                                {event.resolved && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: 4 }}>SETTLED</span>
                                )}
                                {expired && !event.resolved && (
                                  <span style={{ fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, padding: "2px 8px", borderRadius: 4 }}>CLOSED · {fmtDate(event.deadline)}</span>
                                )}
                                <span style={{ fontSize: 11, color: C.muted }}>by {event.creator}</span>
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{event.title}</div>
                              {event.description && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{event.description}</div>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pool.toLocaleString()}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{settings.currency} · {event.bets.length} bets</div>
                            </div>
                          </div>

                          {/* Options */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {event.options.map((opt, i) => {
                              const isWinner = event.resolved && event.winner === i;
                              const isLoser = event.resolved && event.winner !== null && event.winner !== i;
                              const optPool = event.bets.filter(b => b.option === i).reduce((s, b) => s + b.amount, 0);
                              const myAmt = event.bets.filter(b => b.user === username && b.option === i).reduce((s, b) => s + b.amount, 0);

                              return (
                                <div key={i} style={{
                                  display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", borderRadius: 7,
                                  background: isWinner ? "rgba(34,197,94,0.07)" : C.bg,
                                  border: `1px solid ${isWinner ? "rgba(34,197,94,0.25)" : C.border}`,
                                  opacity: isLoser ? 0.4 : 1,
                                }}>
                                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600, minWidth: 46, color: isWinner ? C.green : C.text }}>
                                    {odds[i]}%
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                      <span style={{ fontSize: 14, color: isWinner ? C.green : C.text, fontWeight: isWinner ? 600 : 400 }}>
                                        {isWinner && "✓ "}{opt}
                                      </span>
                                      <span style={{ fontSize: 12, color: C.muted, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginLeft: 8 }}>
                                        {optPool.toLocaleString()} {settings.currency}
                                        {myAmt > 0 && <span style={{ color: C.blue, marginLeft: 8 }}>· you: {myAmt}</span>}
                                      </span>
                                    </div>
                                    <div style={{ height: 4, background: "#1e2a3a", borderRadius: 2, overflow: "hidden" }}>
                                      <div style={{ height: "100%", width: `${odds[i]}%`, background: isWinner ? C.green : C.blue, borderRadius: 2, transition: "width 0.4s ease" }} />
                                    </div>
                                  </div>
                                  {canBet && (
                                    <button onClick={() => { setBetModal({ eventId: event.id, option: i, optionLabel: opt, eventTitle: event.title }); setBetAmount(""); }}
                                      style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 5, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                                      Bet
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Resolve row (admin only) */}
                          {role === "admin" && !event.resolved && (
                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, color: C.muted }}>Resolve as:</span>
                              {event.options.map((opt, i) => (
                                <button key={i} onClick={() => setResolveModal({ eventId: event.id, option: i, optionLabel: opt, eventTitle: event.title })}
                                  style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 5, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Recent bets */}
                          {event.bets.length > 0 && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 11, color: "#334155", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 6 }}>RECENT BETS</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {[...event.bets].reverse().slice(0, 8).map((b, idx) => (
                                  <span key={idx} style={{ fontSize: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", color: b.user === username ? C.blue : C.subtle }}>
                                    {b.user} · {b.amount} {settings.currency}
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
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Leaderboard</div>
                  <div style={{ fontSize: 13, color: C.muted }}>Points across settled markets</div>
                </div>
                {leaderboard().length === 0 ? (
                  <div style={{ textAlign: "center", padding: 80, color: C.muted, fontSize: 14 }}>No settled markets yet</div>
                ) : (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {["#", "Name", "Bets", "Correct", "Wagered", "P&L"].map((h, i) => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: i <= 1 ? "left" : "right", fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard().map((p, i) => (
                          <tr key={p.name} className="trow" style={{ borderBottom: i < leaderboard().length - 1 ? `1px solid ${C.border}` : "none", background: p.name === username ? "rgba(59,130,246,0.04)" : "transparent" }}>
                            <td style={{ padding: "13px 16px", fontSize: 13, color: i === 0 ? C.yellow : C.muted, fontWeight: 600 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                            <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: p.name === username ? 600 : 400, color: p.name === username ? C.blue : C.text }}>{p.name}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13, color: C.muted }}>{p.bets}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13, color: C.muted }}>{p.correct || 0}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.muted }}>{p.wagered.toLocaleString()}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: p.pnl >= 0 ? C.green : C.red }}>
                              {p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══ CREATE ══ */}
            {view === "create" && canCreate && (
              <CreateForm
                username={username}
                password={rolePassword}
                onCreated={(ev) => { setEvents(prev => [ev, ...prev]); setView("markets"); }}
                showToast={showToast}
              />
            )}

            {/* ══ SETTINGS ══ */}
            {view === "settings" && role === "admin" && (
              <SettingsPanel
                settings={settings}
                adminPassword={rolePassword}
                showToast={showToast}
                onSaved={(s) => setSettings(s)}
              />
            )}
          </>
        )}
      </div>

      {/* ══ BET MODAL ══ */}
      {betModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(4px)" }} onClick={() => setBetModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 4 }}>PLACE BET</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{betModal.eventTitle}</div>
            <div style={{ display: "inline-block", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 5, padding: "5px 12px", fontSize: 13, color: C.blue, marginBottom: 20, fontWeight: 500 }}>
              → {betModal.optionLabel}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                AMOUNT ({settings.min_bet}–{settings.max_bet} {settings.currency})
              </label>
              <input autoFocus type="number" placeholder={`e.g. ${settings.min_bet}`} value={betAmount}
                onChange={e => setBetAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && placeBet()}
                style={{ ...inp, width: "100%", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 6 }}>
                {[Number(settings.min_bet), Math.round((Number(settings.min_bet) + Number(settings.max_bet)) / 2), Number(settings.max_bet)].map(v => (
                  <button key={v} onClick={() => setBetAmount(String(v))}
                    style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 5, padding: "7px 0", fontSize: 13, cursor: "pointer" }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBetModal(null)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={placeBet} disabled={betLoading}
                style={{ flex: 2, background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: betLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {betLoading ? <><Spinner /> Placing...</> : "Confirm Bet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ RESOLVE MODAL ══ */}
      {resolveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(4px)" }} onClick={() => setResolveModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 380, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Resolve Market</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{resolveModal.eventTitle}</div>
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 7, padding: "12px 16px", fontSize: 15, color: C.green, marginBottom: 12, fontWeight: 500 }}>✓ {resolveModal.optionLabel}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Points will be distributed to winners. Cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setResolveModal(null)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={resolveEvent} style={{ flex: 2, background: C.green, color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOGIN MODALS ══ */}
      {loginModal === "admin" && (
        <LoginModal
          title="Admin Login"
          subtitle="Full access — resolve markets, change settings and passwords"
          onLogin={(pwd) => handleLogin("admin", pwd)}
          onClose={() => setLoginModal(null)}
        />
      )}
      {loginModal === "creator" && (
        <LoginModal
          title="Creator Login"
          subtitle="Create markets and place bets — cannot resolve or change settings"
          onLogin={(pwd) => handleLogin("creator", pwd)}
          onClose={() => setLoginModal(null)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
