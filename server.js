require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "client/dist")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const MASTER_PASSWORD = process.env.MASTER_PASSWORD || "Khel Mandli";

async function initDB() {
  // ── Step 1: Create rooms table if missing ──────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      code             TEXT UNIQUE NOT NULL,
      code_hash        TEXT NOT NULL,
      admin_hash       TEXT NOT NULL,
      creator_hash     TEXT NOT NULL,
      min_bet          INTEGER DEFAULT 1,
      max_bet          INTEGER DEFAULT 100,
      currency         TEXT DEFAULT 'pts',
      starting_balance INTEGER DEFAULT 100,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Step 2: Seed default room if none exists ───────────────────────────
  const roomCheck = await pool.query("SELECT id FROM rooms LIMIT 1");
  let defaultRoomId;
  if (roomCheck.rows.length === 0) {
    const defaultCode = "POLYFRENS";
    // Pull settings from old settings table if it exists
    let adminPwd = "admin123", creatorPwd = "create123", minBet = 1, maxBet = 100, currency = "pts", startBal = 100;
    try {
      const oldSettings = await pool.query("SELECT key, value FROM settings");
      const s = {};
      oldSettings.rows.forEach(r => s[r.key] = r.value);
      if (s.password_hash)         adminPwd   = s.password_hash;   // already hashed
      if (s.creator_password_hash) creatorPwd = s.creator_password_hash;
      if (s.min_bet)         minBet   = parseInt(s.min_bet);
      if (s.max_bet)         maxBet   = parseInt(s.max_bet);
      if (s.currency)        currency = s.currency;
      if (s.starting_balance) startBal = parseInt(s.starting_balance);
    } catch(_) {}

    // If passwords came from old table they're already bcrypt hashes — detect by $2 prefix
    const aHash = adminPwd.startsWith("$2")   ? adminPwd   : bcrypt.hashSync(adminPwd, 10);
    const cHash = creatorPwd.startsWith("$2") ? creatorPwd : bcrypt.hashSync(creatorPwd, 10);

    const r = await pool.query(
      `INSERT INTO rooms (name, code, code_hash, admin_hash, creator_hash, min_bet, max_bet, currency, starting_balance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      ["Polyfrens HQ", defaultCode, bcrypt.hashSync(defaultCode, 10), aHash, cHash, minBet, maxBet, currency, startBal]
    );
    defaultRoomId = r.rows[0].id;
    console.log("🏠 Default room created — code: POLYFRENS");
  } else {
    defaultRoomId = roomCheck.rows[0].id;
  }

  // ── Step 3: Migrate old tables to room-aware schema ────────────────────

  // users: add room_id column if missing, migrate orphan rows
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL`).catch(()=>{});
  await pool.query(`UPDATE users SET room_id = $1 WHERE room_id IS NULL`, [defaultRoomId]);
  // Add unique constraint if not exists
  try {
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_room_username UNIQUE (room_id, username)`);
  } catch(_) {} // already exists

  // events: add room_id column if missing, migrate orphan rows
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE`);
  await pool.query(`UPDATE events SET room_id = $1 WHERE room_id IS NULL`, [defaultRoomId]);

  // bets: no room_id needed (scoped via event_id → events.room_id)

  // ── Step 4: Create tables fresh if they don't exist at all ─────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id       SERIAL PRIMARY KEY,
      room_id  INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      balance  INTEGER NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(room_id, username)
    );
    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      room_id     INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT,
      creator     TEXT NOT NULL,
      options     JSONB NOT NULL,
      deadline    DATE NOT NULL,
      resolved    BOOLEAN DEFAULT FALSE,
      winner      INTEGER DEFAULT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bets (
      id           SERIAL PRIMARY KEY,
      event_id     INTEGER REFERENCES events(id) ON DELETE CASCADE,
      username     TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      amount       INTEGER NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("✅ Database ready");
}

// ── Master admin auth helper ───────────────────────────────────────────────
const masterHash = bcrypt.hashSync(MASTER_PASSWORD, 10);
function isMaster(password) { return bcrypt.compareSync(password, masterHash); }

// ── Rooms ──────────────────────────────────────────────────────────────────

// Master: list all rooms
app.get("/api/master/rooms", async (req, res) => {
  const { password } = req.query;
  if (!isMaster(password)) return res.status(401).json({ error: "Unauthorized" });
  const result = await pool.query("SELECT id, name, code, created_at FROM rooms ORDER BY created_at DESC");
  res.json(result.rows);
});

// Master: create a room
app.post("/api/master/rooms", async (req, res) => {
  const { password, name, code, admin_password, creator_password } = req.body;
  if (!isMaster(password)) return res.status(401).json({ error: "Unauthorized" });
  if (!name || !code || !admin_password || !creator_password)
    return res.status(400).json({ error: "name, code, admin_password, creator_password required" });

  const codeUpper = code.trim().toUpperCase();
  try {
    const result = await pool.query(
      `INSERT INTO rooms (name, code, code_hash, admin_hash, creator_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, code`,
      [name.trim(), codeUpper, bcrypt.hashSync(codeUpper, 10),
       bcrypt.hashSync(admin_password, 10), bcrypt.hashSync(creator_password, 10)]
    );
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ error: "Room code already exists" });
    throw e;
  }
});

// Master: delete a room
app.delete("/api/master/rooms/:id", async (req, res) => {
  const { password } = req.body;
  if (!isMaster(password)) return res.status(401).json({ error: "Unauthorized" });
  await pool.query("DELETE FROM rooms WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// Join a room by code — returns room info (no sensitive data)
app.post("/api/rooms/join", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code required" });
  const result = await pool.query("SELECT id, name, code, min_bet, max_bet, currency, starting_balance FROM rooms WHERE code=$1", [code.trim().toUpperCase()]);
  if (!result.rows[0]) return res.status(404).json({ error: "Room not found. Check the code." });
  res.json(result.rows[0]);
});

// Room-level auth
app.post("/api/rooms/:roomId/auth/admin", async (req, res) => {
  const { password } = req.body;
  const room = await pool.query("SELECT admin_hash FROM rooms WHERE id=$1", [req.params.roomId]);
  if (!room.rows[0]) return res.status(404).json({ error: "Room not found" });
  if (!bcrypt.compareSync(password, room.rows[0].admin_hash)) return res.status(401).json({ error: "Wrong password" });
  res.json({ success: true });
});

app.post("/api/rooms/:roomId/auth/creator", async (req, res) => {
  const { password } = req.body;
  const room = await pool.query("SELECT creator_hash, admin_hash FROM rooms WHERE id=$1", [req.params.roomId]);
  if (!room.rows[0]) return res.status(404).json({ error: "Room not found" });
  const ok = bcrypt.compareSync(password, room.rows[0].creator_hash) ||
             bcrypt.compareSync(password, room.rows[0].admin_hash);
  if (!ok) return res.status(401).json({ error: "Wrong password" });
  res.json({ success: true });
});

// ── Room settings ─────────────────────────────────────────────────────────
app.get("/api/rooms/:roomId/settings", async (req, res) => {
  const result = await pool.query(
    "SELECT min_bet, max_bet, currency, starting_balance FROM rooms WHERE id=$1",
    [req.params.roomId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Room not found" });
  res.json(result.rows[0]);
});

app.post("/api/rooms/:roomId/settings", async (req, res) => {
  const { password, min_bet, max_bet, currency, starting_balance, new_admin_password, new_creator_password } = req.body;
  const room = await pool.query("SELECT admin_hash FROM rooms WHERE id=$1", [req.params.roomId]);
  if (!room.rows[0] || !bcrypt.compareSync(password, room.rows[0].admin_hash))
    return res.status(401).json({ error: "Unauthorized" });

  const updates = [];
  const vals = [];
  let i = 1;
  for (const [col, val] of Object.entries({ min_bet, max_bet, currency, starting_balance })) {
    if (val !== undefined) { updates.push(`${col}=$${i++}`); vals.push(val); }
  }
  if (new_admin_password)   { updates.push(`admin_hash=$${i++}`);   vals.push(bcrypt.hashSync(new_admin_password, 10)); }
  if (new_creator_password) { updates.push(`creator_hash=$${i++}`); vals.push(bcrypt.hashSync(new_creator_password, 10)); }
  if (updates.length) {
    vals.push(req.params.roomId);
    await pool.query(`UPDATE rooms SET ${updates.join(",")} WHERE id=$${i}`, vals);
  }
  res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────
app.post("/api/rooms/:roomId/users/register", async (req, res) => {
  const { username } = req.body;
  const { roomId } = req.params;
  if (!username || username.trim().length < 2) return res.status(400).json({ error: "Invalid name" });

  const room = await pool.query("SELECT starting_balance FROM rooms WHERE id=$1", [roomId]);
  if (!room.rows[0]) return res.status(404).json({ error: "Room not found" });
  const startBal = room.rows[0].starting_balance;

  const result = await pool.query(
    "INSERT INTO users (room_id, username, balance) VALUES ($1,$2,$3) ON CONFLICT (room_id, username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [roomId, username.trim(), startBal]
  );
  res.json(result.rows[0]);
});

app.get("/api/rooms/:roomId/users/:username/balance", async (req, res) => {
  const { roomId, username } = req.params;
  const room = await pool.query("SELECT starting_balance FROM rooms WHERE id=$1", [roomId]);
  if (!room.rows[0]) return res.status(404).json({ error: "Room not found" });
  const result = await pool.query(
    "INSERT INTO users (room_id, username, balance) VALUES ($1,$2,$3) ON CONFLICT (room_id, username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [roomId, username, room.rows[0].starting_balance]
  );
  res.json({ balance: result.rows[0].balance });
});

// ── Events ────────────────────────────────────────────────────────────────
app.get("/api/rooms/:roomId/events", async (req, res) => {
  const { roomId } = req.params;
  const eventsResult = await pool.query("SELECT * FROM events WHERE room_id=$1 ORDER BY created_at DESC", [roomId]);
  const ids = eventsResult.rows.map(e => e.id);
  const betsResult = ids.length
    ? await pool.query("SELECT * FROM bets WHERE event_id = ANY($1) ORDER BY created_at ASC", [ids])
    : { rows: [] };
  const events = eventsResult.rows.map(e => ({
    ...e,
    bets: betsResult.rows.filter(b => b.event_id === e.id).map(b => ({
      id: b.id, user: b.username, option: b.option_index, amount: b.amount, time: b.created_at,
    })),
  }));
  res.json(events);
});

app.post("/api/rooms/:roomId/events", async (req, res) => {
  const { title, description, creator, options, deadline, password } = req.body;
  const { roomId } = req.params;

  const room = await pool.query("SELECT admin_hash, creator_hash FROM rooms WHERE id=$1", [roomId]);
  if (!room.rows[0]) return res.status(404).json({ error: "Room not found" });
  const isAdmin   = bcrypt.compareSync(password, room.rows[0].admin_hash);
  const isCreator = bcrypt.compareSync(password, room.rows[0].creator_hash);
  if (!isAdmin && !isCreator) return res.status(401).json({ error: "Unauthorized" });

  const result = await pool.query(
    "INSERT INTO events (room_id, title, description, creator, options, deadline) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [roomId, title, description || "", creator, JSON.stringify(options), deadline]
  );
  res.json({ ...result.rows[0], bets: [] });
});

app.post("/api/rooms/:roomId/events/:id/resolve", async (req, res) => {
  const { winner, password } = req.body;
  const { roomId, id } = req.params;

  const room = await pool.query("SELECT admin_hash FROM rooms WHERE id=$1", [roomId]);
  if (!room.rows[0] || !bcrypt.compareSync(password, room.rows[0].admin_hash))
    return res.status(401).json({ error: "Unauthorized" });

  const betsResult = await pool.query("SELECT * FROM bets WHERE event_id=$1", [id]);
  const bets = betsResult.rows;
  const totalPool = bets.reduce((s, b) => s + b.amount, 0);
  const winBets   = bets.filter(b => b.option_index === winner);
  const winPool   = winBets.reduce((s, b) => s + b.amount, 0);

  if (winPool > 0) {
    for (const b of winBets) {
      const payout = Math.round((b.amount / winPool) * totalPool);
      await pool.query("UPDATE users SET balance=balance+$1 WHERE room_id=$2 AND username=$3", [payout, roomId, b.username]);
    }
  }
  await pool.query("UPDATE events SET resolved=TRUE, winner=$1 WHERE id=$2", [winner, id]);
  res.json({ success: true });
});

// ── Bets ──────────────────────────────────────────────────────────────────
app.post("/api/rooms/:roomId/events/:id/bets", async (req, res) => {
  const { username, option_index, amount } = req.body;
  const { roomId, id } = req.params;

  const room = await pool.query("SELECT min_bet, max_bet, starting_balance FROM rooms WHERE id=$1", [roomId]);
  if (!room.rows[0]) return res.status(404).json({ error: "Room not found" });
  const { min_bet, max_bet, starting_balance } = room.rows[0];

  if (amount < min_bet || amount > max_bet)
    return res.status(400).json({ error: `Bet must be ${min_bet}–${max_bet}` });

  const userResult = await pool.query(
    "INSERT INTO users (room_id, username, balance) VALUES ($1,$2,$3) ON CONFLICT (room_id, username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [roomId, username.trim(), starting_balance]
  );
  const user = userResult.rows[0];
  if (user.balance < amount) return res.status(400).json({ error: `Not enough pts (you have ${user.balance})` });

  const eventRow = await pool.query("SELECT * FROM events WHERE id=$1 AND room_id=$2", [id, roomId]);
  const event = eventRow.rows[0];
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.resolved) return res.status(400).json({ error: "Already resolved" });
  if (new Date(event.deadline) < new Date()) return res.status(400).json({ error: "Deadline passed" });

  await pool.query("UPDATE users SET balance=balance-$1 WHERE room_id=$2 AND username=$3", [amount, roomId, username.trim()]);
  const result = await pool.query(
    "INSERT INTO bets (event_id, username, option_index, amount) VALUES ($1,$2,$3,$4) RETURNING *",
    [id, username.trim(), option_index, amount]
  );
  res.json({
    bet: { id: result.rows[0].id, user: result.rows[0].username, option: result.rows[0].option_index, amount: result.rows[0].amount, time: result.rows[0].created_at },
    newBalance: user.balance - amount,
  });
});

// ── Wipe room data ────────────────────────────────────────────────────────
app.post("/api/rooms/:roomId/wipe", async (req, res) => {
  const { password } = req.body;
  const { roomId } = req.params;
  const room = await pool.query("SELECT admin_hash FROM rooms WHERE id=$1", [roomId]);
  if (!room.rows[0] || !bcrypt.compareSync(password, room.rows[0].admin_hash))
    return res.status(401).json({ error: "Unauthorized" });
  const evts = await pool.query("SELECT id FROM events WHERE room_id=$1", [roomId]);
  if (evts.rows.length) await pool.query("DELETE FROM bets WHERE event_id=ANY($1)", [evts.rows.map(e=>e.id)]);
  await pool.query("DELETE FROM events WHERE room_id=$1", [roomId]);
  await pool.query("DELETE FROM users WHERE room_id=$1", [roomId]);
  res.json({ success: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "client/dist/index.html")));

const PORT = process.env.PORT || 3001;
initDB().then(() => app.listen(PORT, () => console.log(`🎲 Polyfrens on port ${PORT}`))).catch(err => { console.error(err); process.exit(1); });
