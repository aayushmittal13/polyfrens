import { useState, useEffect, useRef } from "react";

const DEFAULT_PASSWORD = "Khel Mandli";
const DEFAULT_SETTINGS = { minBet: 50, maxBet: 1000, currency: "pts" };

const CATEGORIES = ["🎯 General", "💪 Habits", "🏏 Sports", "👀 Social Drama", "💼 Work/Career", "🎮 Games", "🍕 Food", "✈️ Travel"];

const SEED_EVENTS = [
  {
    id: 1,
    title: "Will Rohan actually wake up before 9am this week?",
    description: "He's been saying he'll fix his sleep schedule for 2 months.",
    creator: "Aayush",
    options: ["Yes, early bird 🐦", "No chance 😴"],
    bets: [
      { user: "Priya", option: 1, amount: 200, time: Date.now() - 7200000 },
      { user: "Karan", option: 1, amount: 150, time: Date.now() - 3600000 },
      { user: "Dev", option: 0, amount: 100, time: Date.now() - 1800000 },
    ],
    deadline: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
    resolved: false,
    winner: null,
    category: "💪 Habits",
    createdAt: Date.now() - 86400000,
  },
  {
    id: 2,
    title: "Does Priya finish her Duolingo streak this month?",
    description: "Currently at 12 days. Will she break her personal record?",
    creator: "Karan",
    options: ["Streak queen 🔥", "Streak broken 💀"],
    bets: [
      { user: "Aayush", option: 0, amount: 300, time: Date.now() - 10000000 },
      { user: "Sneha", option: 1, amount: 200, time: Date.now() - 9000000 },
    ],
    deadline: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    resolved: true,
    winner: 0,
    category: "🎯 General",
    createdAt: Date.now() - 10000000,
  },
];

function getOdds(bets, numOptions) {
  const totals = Array(numOptions).fill(0);
  bets.forEach((b) => { totals[b.option] += b.amount; });
  const total = totals.reduce((a, b) => a + b, 0);
  if (total === 0) return totals.map(() => Math.round(100 / numOptions));
  return totals.map((t) => Math.round((t / total) * 100));
}

function getPool(bets) {
  return bets.reduce((s, b) => s + b.amount, 0);
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function deadlineLabel(dl) {
  const d = new Date(dl) - new Date();
  if (d < 0) return "Ended";
  const days = Math.floor(d / 86400000);
  if (days > 0) return `${days}d left`;
  return `${Math.floor(d / 3600000)}h left`;
}

function useStorage(key, init) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [val, key]);
  return [val, setVal];
}

const Toast = ({ toast }) =>
  toast ? (
    <div style={{
      position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
      background: toast.type === "error" ? "#c0392b" : "#1a6b3c",
      color: "#fff", padding: "12px 28px", borderRadius: 40,
      fontFamily: "'Tiro Devanagari Hindi', serif", fontSize: 15,
      zIndex: 9999, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      border: "1.5px solid rgba(255,255,255,0.15)",
      animation: "fadeUp 0.3s ease",
    }}>{toast.msg}</div>
  ) : null;

export default function KhelMandli() {
  const [events, setEvents] = useStorage("km_events", SEED_EVENTS);
  const [settings, setSettings] = useStorage("km_settings", DEFAULT_SETTINGS);
  const [password, setPassword] = useStorage("km_password", DEFAULT_PASSWORD);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("market");
  const [toast, setToast] = useState(null);
  const [betModal, setBetModal] = useState(null);
  const [betAmount, setBetAmount] = useState("");
  const [betUser, setBetUser] = useState("");
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [filter, setFilter] = useState("active");
  const [newEvent, setNewEvent] = useState({ title: "", description: "", options: ["", ""], deadline: "", category: "🎯 General" });
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [newPassword, setNewPassword] = useState("");
  const [resolveConfirm, setResolveConfirm] = useState(null); // { eventId, option }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const tryLogin = () => {
    if (loginInput === password) {
      setIsAdmin(true);
      setShowLogin(false);
      setLoginInput("");
      setLoginError(false);
      showToast("Welcome back, boss 👑");
    } else {
      setLoginError(true);
      setTimeout(() => setLoginError(false), 1000);
    }
  };

  const placeBet = () => {
    if (!betUser.trim()) { showToast("Enter your name!", "error"); return; }
    const amt = Number(betAmount);
    if (!amt || amt < settings.minBet || amt > settings.maxBet) {
      showToast(`Bet must be ${settings.minBet}–${settings.maxBet} ${settings.currency}`, "error");
      return;
    }
    setEvents(prev => prev.map(e => e.id === betModal.eventId
      ? { ...e, bets: [...e.bets, { user: betUser.trim(), option: betModal.option, amount: amt, time: Date.now() }] }
      : e
    ));
    setBetModal(null); setBetAmount(""); 
    showToast(`Bet locked! ${amt} ${settings.currency} on the line 🎲`);
  };

  const resolveEvent = (eventId, winnerIdx) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, resolved: true, winner: winnerIdx } : e));
    setResolveConfirm(null);
    showToast("Event resolved! Winners take all 🏆");
  };

  const createEvent = () => {
    if (!newEvent.title || !newEvent.options[0] || !newEvent.options[1] || !newEvent.deadline) {
      showToast("Fill all fields!", "error"); return;
    }
    const ev = { id: Date.now(), ...newEvent, creator: "Admin", bets: [], resolved: false, winner: null, createdAt: Date.now() };
    setEvents(prev => [ev, ...prev]);
    setNewEvent({ title: "", description: "", options: ["", ""], deadline: "", category: "🎯 General" });
    setView("market");
    showToast("New event is live! Let the chaos begin 🎉");
  };

  const saveSettings = () => {
    if (Number(settingsDraft.minBet) >= Number(settingsDraft.maxBet)) {
      showToast("Min must be less than max!", "error"); return;
    }
    setSettings(settingsDraft);
    if (newPassword.trim()) { setPassword(newPassword.trim()); setNewPassword(""); showToast("Password updated! 🔐"); }
    else showToast("Settings saved!");
  };

  const leaderboard = () => {
    const scores = {};
    events.forEach(e => {
      e.bets.forEach(b => {
        if (!scores[b.user]) scores[b.user] = { wagered: 0, won: 0, bets: 0, correct: 0 };
        scores[b.user].wagered += b.amount;
        scores[b.user].bets += 1;
        if (e.resolved) {
          const pool = getPool(e.bets);
          const winPool = e.bets.filter(x => x.option === e.winner).reduce((s, x) => s + x.amount, 0);
          if (b.option === e.winner && winPool > 0) {
            scores[b.user].won += Math.round((b.amount / winPool) * pool);
            scores[b.user].correct += 1;
          }
        }
      });
    });
    return Object.entries(scores)
      .map(([name, s]) => ({ name, ...s, pnl: s.won - s.wagered }))
      .sort((a, b) => b.pnl - a.pnl);
  };

  const filtered = events.filter(e =>
    filter === "all" ? true : filter === "active" ? !e.resolved : e.resolved
  );

  const S = {
    bg: "#0f0e0c",
    card: "#1a1814",
    border: "#2e2a22",
    saffron: "#f4831f",
    green: "#2ecc71",
    red: "#e74c3c",
    cream: "#f5ead0",
    muted: "#7a7060",
    highlight: "#ffd700",
  };

  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.cream, fontFamily: "'Crimson Pro', Georgia, serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Tiro+Devanagari+Hindi&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1814; } ::-webkit-scrollbar-thumb { background: #2e2a22; border-radius: 4px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        .shake { animation: shake 0.3s ease; }
        .event-card { transition: transform 0.15s ease, box-shadow 0.15s ease; cursor: pointer; }
        .event-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(244,131,31,0.15); }
        .btn-saffron { background: #f4831f; color: #0f0e0c; border: none; border-radius: 8px; padding: 10px 24px; font-family: 'Crimson Pro', Georgia, serif; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .btn-saffron:hover { background: #e07310; transform: translateY(-1px); }
        .btn-ghost { background: transparent; color: #f5ead0; border: 1.5px solid #2e2a22; border-radius: 8px; padding: 9px 20px; font-family: 'Crimson Pro', Georgia, serif; font-size: 15px; cursor: pointer; transition: all 0.15s; }
        .btn-ghost:hover { border-color: #f4831f; color: #f4831f; }
        .tab { background: transparent; border: none; padding: 10px 20px; font-family: 'Crimson Pro', Georgia, serif; font-size: 15px; cursor: pointer; border-bottom: 2px solid transparent; color: #7a7060; transition: all 0.15s; }
        .tab.active { color: #f4831f; border-bottom-color: #f4831f; }
        input, select, textarea { background: #252018; border: 1.5px solid #2e2a22; color: #f5ead0; border-radius: 8px; padding: 10px 14px; font-family: 'Crimson Pro', Georgia, serif; font-size: 15px; width: 100%; outline: none; transition: border-color 0.15s; }
        input:focus, select:focus, textarea:focus { border-color: #f4831f; }
        input::placeholder, textarea::placeholder { color: #4a4438; }
        .odds-bar { height: 6px; border-radius: 3px; background: #2e2a22; overflow: hidden; margin: 6px 0; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; backdrop-filter: blur(4px); }
        .modal { background: #1a1814; border: 1.5px solid #2e2a22; border-radius: 16px; padding: 28px; max-width: 440px; width: 100%; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; display: inline-block; animation: pulse 1.5s infinite; }
        .grain { position: fixed; inset: 0; pointer-events: none; opacity: 0.03; z-index: 1000; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
      `}</style>

      <div className="grain" />

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${S.border}`, padding: "0 24px", position: "sticky", top: 0, background: S.bg, zIndex: 50 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🎲</span>
            <span style={{ fontFamily: "'Tiro Devanagari Hindi', serif", fontSize: 22, color: S.saffron, letterSpacing: 1 }}>खेल मंडली</span>
            <span style={{ color: S.muted, fontSize: 13, marginLeft: 4 }}>/ Khel Mandli</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: S.highlight, fontSize: 14 }}>
                <span>👑</span> Admin
                <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 13, marginLeft: 4 }} onClick={() => setIsAdmin(false)}>Logout</button>
              </span>
            ) : (
              <button className="btn-ghost" style={{ padding: "7px 16px", fontSize: 14 }} onClick={() => setShowLogin(true)}>🔐 Admin</button>
            )}
          </div>
        </div>
        {/* Nav tabs */}
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", gap: 0 }}>
          {["market", "leaderboard", ...(isAdmin ? ["create", "settings"] : [])].map(v => (
            <button key={v} className={`tab ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
              {v === "market" ? "🏪 Market" : v === "leaderboard" ? "🏆 Board" : v === "create" ? "➕ Create" : "⚙️ Settings"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px" }}>

        {/* MARKET */}
        {view === "market" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: S.cream }}>Open Markets</div>
                <div style={{ color: S.muted, fontSize: 14 }}>{events.filter(e => !e.resolved).length} active · {events.filter(e => e.resolved).length} settled</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["active", "resolved", "all"].map(f => (
                  <button key={f} className="btn-ghost" style={{ padding: "6px 14px", fontSize: 13, ...(filter === f ? { borderColor: S.saffron, color: S.saffron } : {}) }} onClick={() => setFilter(f)}>
                    {f === "active" ? "Live" : f === "resolved" ? "Settled" : "All"}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 0", color: S.muted }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎲</div>
                <div style={{ fontSize: 18 }}>No events here yet</div>
                {isAdmin && <div style={{ fontSize: 14, marginTop: 8 }}>Go create some drama →</div>}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {filtered.map(event => {
                const odds = getOdds(event.bets, event.options.length);
                const pool = getPool(event.bets);
                const expired = new Date(event.deadline) < new Date();
                return (
                  <div key={event.id} className="event-card" style={{ background: S.card, border: `1.5px solid ${event.resolved ? "#2e2a22" : S.border}`, borderRadius: 14, padding: 20, opacity: event.resolved ? 0.85 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: S.muted }}>{event.category}</span>
                          {!event.resolved && !expired && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: S.green }}><span className="live-dot" /> LIVE</span>}
                          {event.resolved && <span className="badge" style={{ background: "#1a3a2a", color: S.green }}>✓ Settled</span>}
                          {expired && !event.resolved && <span className="badge" style={{ background: "#3a1a1a", color: S.red }}>Expired</span>}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: S.cream, lineHeight: 1.3 }}>{event.title}</div>
                        {event.description && <div style={{ fontSize: 14, color: S.muted, marginTop: 4 }}>{event.description}</div>}
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 16, flexShrink: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: S.saffron }}>{pool.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{settings.currency} in pool</div>
                        <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{deadlineLabel(event.deadline)}</div>
                      </div>
                    </div>

                    {/* Options */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {event.options.map((opt, i) => {
                        const isWinner = event.resolved && event.winner === i;
                        const isLoser = event.resolved && event.winner !== i;
                        return (
                          <div key={i} style={{ background: isWinner ? "#0d2b1a" : isLoser ? "#1a0d0d" : "#252018", borderRadius: 10, padding: "10px 14px", border: `1px solid ${isWinner ? "#2ecc71" : isLoser ? "#3a1a1a" : "#2e2a22"}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 15, color: isWinner ? S.green : isLoser ? S.muted : S.cream }}>
                                {isWinner && "✓ "}{opt}
                              </span>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: isWinner ? S.green : S.saffron }}>{odds[i]}%</span>
                                {!event.resolved && !expired && (
                                  <button className="btn-saffron" style={{ padding: "5px 14px", fontSize: 13 }}
                                    onClick={() => { setBetModal({ eventId: event.id, option: i, optionLabel: opt, eventTitle: event.title }); setBetAmount(""); setBetUser(""); }}>
                                    Bet
                                  </button>
                                )}
                                {event.resolved && isAdmin && !event.resolved && null}
                              </div>
                            </div>
                            <div className="odds-bar">
                              <div style={{ height: "100%", width: `${odds[i]}%`, background: isWinner ? S.green : S.saffron, borderRadius: 3, transition: "width 0.5s ease" }} />
                            </div>
                            <div style={{ fontSize: 12, color: S.muted }}>
                              {event.bets.filter(b => b.option === i).length} bets · {event.bets.filter(b => b.option === i).reduce((s, b) => s + b.amount, 0).toLocaleString()} {settings.currency}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Resolve button for admin/creator or resolve confirm */}
                    {!event.resolved && isAdmin && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: S.muted }}>Resolve:</span>
                        {event.options.map((opt, i) => (
                          <button key={i} className="btn-ghost" style={{ padding: "4px 12px", fontSize: 13 }}
                            onClick={() => setResolveConfirm({ eventId: event.id, option: i, optionLabel: opt, eventTitle: event.title })}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Recent bets */}
                    {event.bets.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
                        <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>Recent bets</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {event.bets.slice(-5).reverse().map((b, idx) => (
                            <span key={idx} style={{ fontSize: 12, background: "#252018", border: `1px solid ${S.border}`, borderRadius: 20, padding: "3px 10px", color: S.cream }}>
                              {b.user} · {b.amount.toLocaleString()} {settings.currency} on "{event.options[b.option]}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {view === "leaderboard" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 26, fontWeight: 700 }}>🏆 Leaderboard</div>
              <div style={{ color: S.muted, fontSize: 14 }}>Based on settled events only</div>
            </div>
            {leaderboard().length === 0 ? (
              <div style={{ textAlign: "center", padding: 80, color: S.muted }}>No settled bets yet. Get predicting!</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {leaderboard().map((p, i) => (
                  <div key={p.name} style={{ background: S.card, border: `1.5px solid ${i === 0 ? "#ffd700" : S.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: i === 0 ? S.highlight : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : S.muted, minWidth: 36, textAlign: "center" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: S.muted }}>{p.bets} bets · {p.correct || 0} correct</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: p.pnl >= 0 ? S.green : S.red }}>
                        {p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString()} {settings.currency}
                      </div>
                      <div style={{ fontSize: 12, color: S.muted }}>{p.wagered.toLocaleString()} wagered</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CREATE (admin only) */}
        {view === "create" && isAdmin && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>➕ Create Event</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Event question *</label>
                <input placeholder="Will Rohan actually show up on time?" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Description (optional)</label>
                <textarea rows={2} placeholder="Add some context..." value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Option A *</label>
                <input placeholder="Yes, totally 🎉" value={newEvent.options[0]} onChange={e => setNewEvent(p => ({ ...p, options: [e.target.value, p.options[1]] }))} />
              </div>
              <div>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Option B *</label>
                <input placeholder="No way 😂" value={newEvent.options[1]} onChange={e => setNewEvent(p => ({ ...p, options: [p.options[0], e.target.value] }))} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Category</label>
                  <select value={newEvent.category} onChange={e => setNewEvent(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Deadline *</label>
                  <input type="date" value={newEvent.deadline} min={new Date().toISOString().split("T")[0]} onChange={e => setNewEvent(p => ({ ...p, deadline: e.target.value }))} />
                </div>
              </div>
              <button className="btn-saffron" style={{ marginTop: 8, padding: "14px", fontSize: 17 }} onClick={createEvent}>Launch Event 🚀</button>
            </div>
          </div>
        )}

        {/* SETTINGS (admin only) */}
        {view === "settings" && isAdmin && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>⚙️ Settings</div>
            <div style={{ background: S.card, border: `1.5px solid ${S.border}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Currency label (e.g. pts, coins, ₹)</label>
                <input value={settingsDraft.currency} onChange={e => setSettingsDraft(p => ({ ...p, currency: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Min bet</label>
                  <input type="number" value={settingsDraft.minBet} onChange={e => setSettingsDraft(p => ({ ...p, minBet: Number(e.target.value) }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Max bet</label>
                  <input type="number" value={settingsDraft.maxBet} onChange={e => setSettingsDraft(p => ({ ...p, maxBet: Number(e.target.value) }))} />
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 18 }}>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>🔐 Change admin password</label>
                <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <div style={{ fontSize: 12, color: S.muted, marginTop: 6 }}>Leave blank to keep current password</div>
              </div>
              <button className="btn-saffron" style={{ padding: "13px", fontSize: 16 }} onClick={saveSettings}>Save Changes</button>
            </div>
          </div>
        )}
      </div>

      {/* BET MODAL */}
      {betModal && (
        <div className="modal-overlay" onClick={() => setBetModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>Placing bet on</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{betModal.eventTitle}</div>
            <div style={{ display: "inline-block", background: "#252018", border: `1.5px solid ${S.saffron}`, borderRadius: 8, padding: "6px 16px", fontSize: 15, color: S.saffron, marginBottom: 20 }}>
              → {betModal.optionLabel}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>Your name</label>
                <input placeholder="Enter your name" value={betUser} onChange={e => setBetUser(e.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 13, color: S.muted, display: "block", marginBottom: 6 }}>
                  Bet amount ({settings.minBet}–{settings.maxBet} {settings.currency})
                </label>
                <input type="number" placeholder={`e.g. ${settings.minBet}`} value={betAmount} onChange={e => setBetAmount(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && placeBet()} />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {[settings.minBet, Math.round((settings.minBet + settings.maxBet) / 2), settings.maxBet].map(v => (
                    <button key={v} className="btn-ghost" style={{ flex: 1, padding: "5px 0", fontSize: 13 }} onClick={() => setBetAmount(String(v))}>{v}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setBetModal(null)}>Cancel</button>
                <button className="btn-saffron" style={{ flex: 2 }} onClick={placeBet}>Lock it in 🔒</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>Admin Login</div>
              <div style={{ fontSize: 14, color: S.muted }}>Enter the Khel Mandli password</div>
            </div>
            <div className={loginError ? "shake" : ""}>
              <input type="password" placeholder="Password" value={loginInput} onChange={e => setLoginInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && tryLogin()}
                style={{ border: loginError ? `1.5px solid ${S.red}` : undefined, textAlign: "center", fontSize: 18, letterSpacing: 4 }} />
            </div>
            {loginError && <div style={{ color: S.red, fontSize: 13, textAlign: "center", marginTop: 8 }}>Wrong password 🙅</div>}
            <button className="btn-saffron" style={{ width: "100%", marginTop: 16, padding: 13, fontSize: 16 }} onClick={tryLogin}>Enter</button>
          </div>
        </div>
      )}

      {/* RESOLVE CONFIRM MODAL */}
      {resolveConfirm && (
        <div className="modal-overlay" onClick={() => setResolveConfirm(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Confirm resolution?</div>
            <div style={{ fontSize: 14, color: S.muted, marginBottom: 16 }}>{resolveConfirm.eventTitle}</div>
            <div style={{ background: "#0d2b1a", border: `1.5px solid ${S.green}`, borderRadius: 10, padding: "12px 16px", fontSize: 16, color: S.green, marginBottom: 20 }}>
              🏆 Winner: {resolveConfirm.optionLabel}
            </div>
            <div style={{ fontSize: 13, color: S.muted, marginBottom: 20 }}>This cannot be undone. Points will be distributed to winners.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setResolveConfirm(null)}>Cancel</button>
              <button className="btn-saffron" style={{ flex: 2, background: S.green }} onClick={() => resolveEvent(resolveConfirm.eventId, resolveConfirm.option)}>Confirm ✓</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
