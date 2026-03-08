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

function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: "2px solid rgba(255,255,255,0.2)",
      borderTopColor: "white", borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
    }} />
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? "#ef4444" : "#22c55e",
      color: "#fff", padding: "10px 22px", borderRadius: 6,
      fontSize: 14, fontWeight: 500, zIndex: 9999,
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      animation: "fadeUp 0.2s ease", whiteSpace: "nowrap",
    }}>{toast.msg}</div>
  );
}

function NameGate({ onSave }) {
  const [name, setName] = useState("");
  const [shake, setShake] = useState(false);

  const submit = () => {
    if (!name.trim() || name.trim().length < 2) {
      setShake(true); setTimeout(() => setShake(false), 400); return;
    }
    onSave(name.trim());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0d0f14", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ maxWidth: 380, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Khel Mandli</div>
          <div style={{ color: "#64748b", fontSize: 14 }}>A prediction market for your friend group</div>
        </div>
        <div style={{ background: "#161b27", border: "1px solid #1e2a3a", borderRadius: 10, padding: 24 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>YOUR NAME</label>
          <input
            autoFocus
            placeholder="e.g. Rahul"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            className={shake ? "shake" : ""}
            style={{
              width: "100%", background: "#0d0f14", border: "1px solid #1e2a3a",
              color: "#f1f5f9", borderRadius: 6, padding: "11px 14px",
              fontSize: 15, outline: "none", marginBottom: 14,
            }}
          />
          <button onClick={submit} style={{ width: "100%", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
            Enter →
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#334155" }}>Saved locally to track your bets</div>
      </div>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem("km_username") || "");
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState({ min_bet: 50, max_bet: 1000, currency: "pts" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [view, setView] = useState("markets");
  const [filter, setFilter] = useState("live");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const [betModal, setBetModal] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [betLoading, setBetLoading] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [resolveModal, setResolveModal] = useState(null);

  const BLANK = { title: "", description: "", options: ["", ""], deadline: "" };
  const [newEvent, setNewEvent] = useState(BLANK);
  const [createLoading, setCreateLoading] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState({});
  const [newPwd, setNewPwd] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const loadData = useCallback(async () => {
    try {
      const [evts, sett] = await Promise.all([api("/api/events"), api("/api/settings")]);
      setEvents(evts);
      setSettings(sett);
      setSettingsDraft(sett);
    } catch { showToast("Failed to load data", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const t = setInterval(loadData, 15000); return () => clearInterval(t); }, [loadData]);

  const saveUsername = (name) => { localStorage.setItem("km_username", name); setUsername(name); };

  const tryLogin = async () => {
    setLoginLoading(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { password: loginInput } });
      setAdminPassword(loginInput); setIsAdmin(true); setShowLogin(false); setLoginInput("");
      showToast("Logged in as admin");
    } catch { setLoginError(true); setTimeout(() => setLoginError(false), 600); }
    finally { setLoginLoading(false); }
  };

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
      await api(`/api/events/${resolveModal.eventId}/resolve`, { method: "POST", body: { winner: resolveModal.option, password: adminPassword } });
      setEvents(prev => prev.map(e => e.id === resolveModal.eventId ? { ...e, resolved: true, winner: resolveModal.option } : e));
      setResolveModal(null); showToast("Market resolved");
    } catch (e) { showToast(e.message, "error"); }
  };

  const createEvent = async () => {
    const opts = newEvent.options.filter(o => o.trim());
    if (!newEvent.title.trim()) { showToast("Title is required", "error"); return; }
    if (opts.length < 2) { showToast("Add at least 2 options", "error"); return; }
    if (!newEvent.deadline) { showToast("Deadline is required", "error"); return; }
    setCreateLoading(true);
    try {
      const ev = await api("/api/events", { method: "POST", body: { ...newEvent, options: opts, creator: username || "Admin", password: adminPassword } });
      setEvents(prev => [{ ...ev, bets: [] }, ...prev]);
      setNewEvent(BLANK); setView("markets");
      showToast("Market created");
    } catch (e) { showToast(e.message, "error"); }
    finally { setCreateLoading(false); }
  };

  const saveSettings = async () => {
    if (Number(settingsDraft.min_bet) >= Number(settingsDraft.max_bet)) { showToast("Min must be less than max", "error"); return; }
    setSettingsLoading(true);
    try {
      await api("/api/settings", { method: "POST", body: { ...settingsDraft, password: adminPassword, new_password: newPwd || undefined } });
      if (newPwd) { setAdminPassword(newPwd); setNewPwd(""); }
      setSettings(settingsDraft); showToast("Settings saved");
    } catch (e) { showToast(e.message, "error"); }
    finally { setSettingsLoading(false); }
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

  const C = { bg: "#0d0f14", surface: "#161b27", border: "#1e2a3a", text: "#f1f5f9", muted: "#64748b", subtle: "#94a3b8", blue: "#3b82f6", green: "#22c55e", red: "#ef4444", yellow: "#f59e0b" };

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
        input, textarea { background: #0d0f14; border: 1px solid #1e2a3a; color: #f1f5f9; border-radius: 6px; padding: 10px 13px; font-size: 14px; width: 100%; outline: none; transition: border-color 0.15s; font-family: 'Inter', sans-serif; }
        input:focus, textarea:focus { border-color: #3b82f6; }
        input::placeholder, textarea::placeholder { color: #334155; }
        .trow:hover { background: rgba(255,255,255,0.02); }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: C.bg, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.3px" }}>Khel Mandli</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: C.muted }}>
              {username}
              <button onClick={() => { localStorage.removeItem("km_username"); setUsername(""); }}
                style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 11, marginLeft: 5 }}>✕</button>
            </span>
            {isAdmin ? (
              <>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.yellow, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: "3px 9px", borderRadius: 20 }}>ADMIN</span>
                <button onClick={() => { setIsAdmin(false); setAdminPassword(""); }}
                  style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>Logout</button>
              </>
            ) : (
              <button onClick={() => setShowLogin(true)}
                style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "6px 13px", fontSize: 13, cursor: "pointer" }}>Admin</button>
            )}
          </div>
        </div>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px", display: "flex" }}>
          {["markets", "leaderboard", ...(isAdmin ? ["create", "settings"] : [])].map(v => (
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

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: C.muted, fontSize: 14 }}>
            <div style={{ marginBottom: 12 }}><Spinner size={28} /></div>Loading...
          </div>
        ) : (
          <>
            {/* ── MARKETS ── */}
            {view === "markets" && (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                  {[["Live Markets", events.filter(e => !e.resolved).length], ["Total Volume", `${events.reduce((s, e) => s + getPool(e.bets), 0).toLocaleString()} ${settings.currency}`], ["Settled", events.filter(e => e.resolved).length]].map(([label, val]) => (
                    <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 18px", flex: "1 1 140px" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px" }}>{val}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{label}</div>
                    </div>
                  ))}
                </div>
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
                    <div style={{ fontSize: 15 }}>{filter === "live" ? "No active markets" : "Nothing here yet"}</div>
                    {isAdmin && filter === "live" && <div style={{ fontSize: 13, color: "#334155", marginTop: 6 }}>Create one from the + Create tab</div>}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredEvents.map(event => {
                      const odds = getOdds(event.bets, event.options.length);
                      const pool = getPool(event.bets);
                      const expired = new Date(event.deadline) < new Date();
                      const canBet = !event.resolved && !expired;
                      return (
                        <div key={event.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "18px 20px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                {canBet && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.green, fontWeight: 500 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                                  LIVE · {deadlineLabel(event.deadline)}
                                </span>}
                                {event.resolved && <span style={{ fontSize: 11, fontWeight: 600, color: C.green, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: 4 }}>SETTLED</span>}
                                {expired && !event.resolved && <span style={{ fontSize: 11, color: C.muted, background: C.bg, border: `1px solid ${C.border}`, padding: "2px 8px", borderRadius: 4 }}>CLOSED</span>}
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.4 }}>{event.title}</div>
                              {event.description && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{event.description}</div>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pool.toLocaleString()}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{settings.currency} · {event.bets.length} bets</div>
                            </div>
                          </div>

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
                                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 600, minWidth: 46, color: isWinner ? C.green : C.text }}>{odds[i]}%</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                      <span style={{ fontSize: 14, color: isWinner ? C.green : C.text, fontWeight: isWinner ? 600 : 400 }}>{isWinner && "✓ "}{opt}</span>
                                      <span style={{ fontSize: 12, color: C.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                                        {optPool.toLocaleString()} {settings.currency}
                                        {myAmt > 0 && <span style={{ color: C.blue, marginLeft: 8 }}>you: {myAmt}</span>}
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

                          {isAdmin && !event.resolved && (
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

            {/* ── LEADERBOARD ── */}
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
                            <td style={{ padding: "13px 16px", textAlign: "left", fontSize: 13, color: i === 0 ? C.yellow : C.muted, fontWeight: 600 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                            <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: p.name === username ? 600 : 400, color: p.name === username ? C.blue : C.text }}>{p.name}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13, color: C.muted }}>{p.bets}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontSize: 13, color: C.muted }}>{p.correct || 0}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: C.muted }}>{p.wagered.toLocaleString()}</td>
                            <td style={{ padding: "13px 16px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: p.pnl >= 0 ? C.green : C.red }}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── CREATE ── */}
            {view === "create" && isAdmin && (
              <div style={{ maxWidth: 540 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Create Market</div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>QUESTION *</label>
                    <input placeholder="Will Rohan wake up before 9am this week?" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>DESCRIPTION</label>
                    <textarea rows={2} placeholder="Optional context..." value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} style={{ resize: "vertical" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>OPTIONS *</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {newEvent.options.map((opt, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            placeholder={`Option ${i + 1}`}
                            value={opt}
                            onChange={e => setNewEvent(p => { const opts = [...p.options]; opts[i] = e.target.value; return { ...p, options: opts }; })}
                          />
                          {newEvent.options.length > 2 && (
                            <button onClick={() => setNewEvent(p => ({ ...p, options: p.options.filter((_, j) => j !== i) }))}
                              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: "8px 11px", cursor: "pointer", flexShrink: 0, fontSize: 14, lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setNewEvent(p => ({ ...p, options: [...p.options, ""] }))}
                        style={{ background: "transparent", border: `1px dashed ${C.border}`, color: C.muted, borderRadius: 6, padding: "9px 0", fontSize: 13, cursor: "pointer" }}>
                        + Add option
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>DEADLINE *</label>
                    <input type="date" value={newEvent.deadline} min={new Date().toISOString().split("T")[0]} onChange={e => setNewEvent(p => ({ ...p, deadline: e.target.value }))} />
                  </div>
                  <button onClick={createEvent} disabled={createLoading}
                    style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: createLoading ? "not-allowed" : "pointer", opacity: createLoading ? 0.6 : 1, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {createLoading ? <><Spinner /> Creating...</> : "Create Market"}
                  </button>
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {view === "settings" && isAdmin && (
              <div style={{ maxWidth: 460 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Settings</div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>CURRENCY LABEL</label>
                    <input value={settingsDraft.currency || ""} onChange={e => setSettingsDraft(p => ({ ...p, currency: e.target.value }))} placeholder="pts" />
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>MIN BET</label>
                      <input type="number" value={settingsDraft.min_bet || ""} onChange={e => setSettingsDraft(p => ({ ...p, min_bet: e.target.value }))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>MAX BET</label>
                      <input type="number" value={settingsDraft.max_bet || ""} onChange={e => setSettingsDraft(p => ({ ...p, max_bet: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
                    <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>CHANGE PASSWORD</label>
                    <input type="password" placeholder="New password (blank = keep current)" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                  </div>
                  <button onClick={saveSettings} disabled={settingsLoading}
                    style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "12px 0", fontSize: 15, fontWeight: 600, cursor: settingsLoading ? "not-allowed" : "pointer", opacity: settingsLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {settingsLoading ? <><Spinner /> Saving...</> : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* BET MODAL */}
      {betModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(4px)" }} onClick={() => setBetModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", marginBottom: 4 }}>PLACE BET</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{betModal.eventTitle}</div>
            <div style={{ display: "inline-block", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 5, padding: "5px 12px", fontSize: 13, color: C.blue, marginBottom: 20, fontWeight: 500 }}>
              → {betModal.optionLabel}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                AMOUNT ({settings.min_bet}–{settings.max_bet} {settings.currency})
              </label>
              <input autoFocus type="number" placeholder={`e.g. ${settings.min_bet}`} value={betAmount} onChange={e => setBetAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && placeBet()} />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
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
                style={{ flex: 2, background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: betLoading ? "not-allowed" : "pointer", opacity: betLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {betLoading ? <><Spinner /> Placing...</> : "Confirm Bet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(4px)" }} onClick={() => { setShowLogin(false); setLoginInput(""); }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 360, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Admin Login</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Enter the admin password to manage markets</div>
            <input autoFocus type="password" placeholder="Password" value={loginInput} onChange={e => setLoginInput(e.target.value)} onKeyDown={e => e.key === "Enter" && tryLogin()} className={loginError ? "shake" : ""} style={{ marginBottom: 8, borderColor: loginError ? C.red : undefined }} />
            {loginError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>Incorrect password</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={() => { setShowLogin(false); setLoginInput(""); }} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={tryLogin} disabled={loginLoading}
                style={{ flex: 2, background: C.blue, color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: loginLoading ? "not-allowed" : "pointer", opacity: loginLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loginLoading ? <><Spinner /> Checking...</> : "Login"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLVE MODAL */}
      {resolveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16, backdropFilter: "blur(4px)" }} onClick={() => setResolveModal(null)}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 380, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Resolve Market</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{resolveModal.eventTitle}</div>
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 7, padding: "12px 16px", fontSize: 15, color: C.green, marginBottom: 12, fontWeight: 500 }}>✓ {resolveModal.optionLabel}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Points will be distributed to winners. This cannot be undone.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setResolveModal(null)} style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.subtle, borderRadius: 6, padding: "11px 0", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              <button onClick={resolveEvent} style={{ flex: 2, background: C.green, color: "#fff", border: "none", borderRadius: 6, padding: "11px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
