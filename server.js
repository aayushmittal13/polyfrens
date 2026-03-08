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
const masterHash = bcrypt.hashSync(MASTER_PASSWORD, 10);
const isMaster = (pwd) => bcrypt.compareSync(pwd, masterHash);

// ── DB Init + Migration ───────────────────────────────────────────────────────
async function initDB() {

  // 1. Create/migrate rooms table — drop old columns that no longer apply
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      code       TEXT UNIQUE NOT NULL,
      code_hash  TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Drop old auth columns from rooms if they exist (new model has no per-room passwords)
  for (const col of ["admin_hash","creator_hash","min_bet","max_bet","currency","starting_balance"]) {
    await pool.query(`ALTER TABLE rooms DROP COLUMN IF EXISTS ${col}`).catch(()=>{});
  }

  // 2. Ensure default "Khel Mandli" room exists, carrying over old settings
  const roomCheck = await pool.query("SELECT id FROM rooms WHERE code='KHEL' LIMIT 1");
  let defaultRoomId;
  if (roomCheck.rows.length === 0) {
    let roomCode = "KHEL";
    const r = await pool.query(
      `INSERT INTO rooms (name, code, code_hash) VALUES ($1,$2,$3) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      ["Khel Mandli", roomCode, bcrypt.hashSync(roomCode, 10)]
    );
    defaultRoomId = r.rows[0].id;
    console.log("🏠 Default room 'Khel Mandli' created — code: KHEL");
  } else {
    defaultRoomId = roomCheck.rows[0].id;
  }

  // 3. Migrate users table
  //    Old schema: PRIMARY KEY (username), no room_id
  //    New schema: PRIMARY KEY (id SERIAL), UNIQUE(room_id, username)
  const usersPkCols = await pool.query(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
    WHERE tc.table_name='users' AND tc.constraint_type='PRIMARY KEY'
  `);
  const pkIsUsername = usersPkCols.rows.length === 1 && usersPkCols.rows[0].column_name === 'username';

  if (pkIsUsername) {
    // Drop old PK, add id + room_id
    await pool.query(`ALTER TABLE users DROP CONSTRAINT users_pkey`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS room_id INTEGER`);
    await pool.query(`UPDATE users SET room_id = $1 WHERE room_id IS NULL`, [defaultRoomId]);
    await pool.query(`ALTER TABLE users ALTER COLUMN room_id SET NOT NULL`);
    await pool.query(`ALTER TABLE users ADD PRIMARY KEY (id)`).catch(()=>{});
    await pool.query(`ALTER TABLE users ADD CONSTRAINT fk_users_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE`).catch(()=>{});
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_room_username UNIQUE (room_id, username)`).catch(()=>{});
    console.log("✅ Migrated users table");
  } else {
    // Already new schema — just ensure columns exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE`).catch(()=>{});
    await pool.query(`UPDATE users SET room_id = $1 WHERE room_id IS NULL`, [defaultRoomId]);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_room_username UNIQUE (room_id, username)`).catch(()=>{});
  }

  // 4. Migrate events table
  await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE`).catch(()=>{});
  await pool.query(`UPDATE events SET room_id = $1 WHERE room_id IS NULL`, [defaultRoomId]);

  // 5. Create fresh tables (no-op if already exist)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      username   TEXT NOT NULL,
      balance    INTEGER NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(room_id, username)
    );
    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      room_id     INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
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
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 6. Seed global settings (min/max bet, currency, starting balance)
  await pool.query(`
    INSERT INTO settings (key, value) VALUES
      ('min_bet', '1'), ('max_bet', '100'),
      ('currency', 'pts'), ('starting_balance', '100')
    ON CONFLICT (key) DO NOTHING
  `);

  console.log("✅ Database ready");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getSettings() {
  const r = await pool.query("SELECT key, value FROM settings");
  const s = {};
  r.rows.forEach(row => s[row.key] = row.value);
  return s;
}

// ── Admin auth ────────────────────────────────────────────────────────────────
app.post("/api/auth/admin", (req, res) => {
  if (!isMaster(req.body.password)) return res.status(401).json({ error: "Wrong password" });
  res.json({ success: true });
});

// ── Rooms ─────────────────────────────────────────────────────────────────────
// Join by code (any user)
app.post("/api/rooms/join", async (req, res) => {
  const code = (req.body.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Code required" });
  const r = await pool.query("SELECT id, name, code FROM rooms WHERE code=$1", [code]);
  if (!r.rows[0]) return res.status(404).json({ error: "Room not found. Check the code." });
  const s = await getSettings();
  res.json({ ...r.rows[0], ...s });
});

// Admin: list all rooms with stats
app.get("/api/admin/rooms", async (req, res) => {
  if (!isMaster(req.query.password)) return res.status(401).json({ error: "Unauthorized" });
  const rooms = await pool.query(`
    SELECT r.id, r.name, r.code, r.created_at,
      COUNT(DISTINCT u.id) AS user_count,
      COUNT(DISTINCT e.id) AS event_count,
      COALESCE(SUM(b.amount),0) AS volume
    FROM rooms r
    LEFT JOIN users u ON u.room_id = r.id
    LEFT JOIN events e ON e.room_id = r.id
    LEFT JOIN bets b ON b.event_id = e.id
    GROUP BY r.id ORDER BY r.created_at DESC
  `);
  res.json(rooms.rows);
});

// Admin: create room
app.post("/api/admin/rooms", async (req, res) => {
  if (!isMaster(req.body.password)) return res.status(401).json({ error: "Unauthorized" });
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: "name and code required" });
  const c = code.trim().toUpperCase();
  try {
    const r = await pool.query(
      "INSERT INTO rooms (name, code, code_hash) VALUES ($1,$2,$3) RETURNING id, name, code",
      [name.trim(), c, bcrypt.hashSync(c, 10)]
    );
    res.json(r.rows[0]);
  } catch(e) {
    if (e.code === "23505") return res.status(400).json({ error: "Room code already taken" });
    throw e;
  }
});

// Admin: delete room
app.delete("/api/admin/rooms/:id", async (req, res) => {
  if (!isMaster(req.body.password)) return res.status(401).json({ error: "Unauthorized" });
  await pool.query("DELETE FROM rooms WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// Admin: all events across all rooms
app.get("/api/admin/events", async (req, res) => {
  if (!isMaster(req.query.password)) return res.status(401).json({ error: "Unauthorized" });
  const evts = await pool.query(`
    SELECT e.*, r.name AS room_name, r.code AS room_code
    FROM events e JOIN rooms r ON r.id = e.room_id
    ORDER BY e.created_at DESC
  `);
  const bets = await pool.query("SELECT * FROM bets ORDER BY created_at ASC");
  const events = evts.rows.map(e => ({
    ...e,
    bets: bets.rows.filter(b => b.event_id === e.id).map(b => ({
      id: b.id, user: b.username, option: b.option_index, amount: b.amount, time: b.created_at,
    })),
  }));
  res.json(events);
});

// Admin: global settings
app.get("/api/admin/settings", async (req, res) => {
  if (!isMaster(req.query.password)) return res.status(401).json({ error: "Unauthorized" });
  res.json(await getSettings());
});

app.post("/api/admin/settings", async (req, res) => {
  if (!isMaster(req.body.password)) return res.status(401).json({ error: "Unauthorized" });
  const { min_bet, max_bet, currency, starting_balance } = req.body;
  for (const [k, v] of Object.entries({ min_bet, max_bet, currency, starting_balance })) {
    if (v !== undefined)
      await pool.query("INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2", [k, String(v)]);
  }
  res.json({ success: true });
});

// ── Users ─────────────────────────────────────────────────────────────────────
app.post("/api/rooms/:roomId/users/register", async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) return res.status(400).json({ error: "Name too short" });
  const s = await getSettings();
  const r = await pool.query(
    "INSERT INTO users(room_id,username,balance) VALUES($1,$2,$3) ON CONFLICT(room_id,username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [req.params.roomId, username.trim(), parseInt(s.starting_balance||100)]
  );
  res.json(r.rows[0]);
});

app.get("/api/rooms/:roomId/users/:username/balance", async (req, res) => {
  const s = await getSettings();
  const r = await pool.query(
    "INSERT INTO users(room_id,username,balance) VALUES($1,$2,$3) ON CONFLICT(room_id,username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [req.params.roomId, req.params.username, parseInt(s.starting_balance||100)]
  );
  res.json({ balance: r.rows[0].balance });
});

// ── Settings (global, read-only for clients) ──────────────────────────────────
app.get("/api/settings", async (req, res) => res.json(await getSettings()));

// ── Events ────────────────────────────────────────────────────────────────────
app.get("/api/rooms/:roomId/events", async (req, res) => {
  const evts = await pool.query("SELECT * FROM events WHERE room_id=$1 ORDER BY created_at DESC", [req.params.roomId]);
  const ids = evts.rows.map(e => e.id);
  const bets = ids.length ? await pool.query("SELECT * FROM bets WHERE event_id=ANY($1) ORDER BY created_at ASC", [ids]) : { rows: [] };
  res.json(evts.rows.map(e => ({
    ...e,
    bets: bets.rows.filter(b => b.event_id === e.id).map(b => ({
      id: b.id, user: b.username, option: b.option_index, amount: b.amount, time: b.created_at,
    })),
  })));
});

// Create event — room member OR admin
app.post("/api/rooms/:roomId/events", async (req, res) => {
  const { title, description, creator, options, deadline, roomCode, adminPassword } = req.body;
  // Verify access: either valid room code or admin password
  if (adminPassword && isMaster(adminPassword)) {
    // admin ok
  } else if (roomCode) {
    const room = await pool.query("SELECT code FROM rooms WHERE id=$1", [req.params.roomId]);
    if (!room.rows[0] || room.rows[0].code !== roomCode.trim().toUpperCase())
      return res.status(401).json({ error: "Invalid room code" });
  } else {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const r = await pool.query(
    "INSERT INTO events(room_id,title,description,creator,options,deadline) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
    [req.params.roomId, title, description||"", creator, JSON.stringify(options), deadline]
  );
  res.json({ ...r.rows[0], bets: [] });
});

// Resolve — admin OR market creator
app.post("/api/rooms/:roomId/events/:id/resolve", async (req, res) => {
  const { winner, password, username } = req.body;
  const evtRow = await pool.query("SELECT * FROM events WHERE id=$1 AND room_id=$2", [req.params.id, req.params.roomId]);
  const event = evtRow.rows[0];
  if (!event) return res.status(404).json({ error: "Event not found" });

  const isAdmin = isMaster(password);
  const isCreator = event.creator === username;
  if (!isAdmin && !isCreator) return res.status(401).json({ error: "Only the market creator or admin can resolve" });

  const bets = (await pool.query("SELECT * FROM bets WHERE event_id=$1", [req.params.id])).rows;
  const totalPool = bets.reduce((s,b) => s+b.amount, 0);
  const winBets   = bets.filter(b => b.option_index === winner);
  const winPool   = winBets.reduce((s,b) => s+b.amount, 0);

  if (winPool > 0) {
    for (const b of winBets) {
      const payout = Math.round((b.amount / winPool) * totalPool);
      await pool.query("UPDATE users SET balance=balance+$1 WHERE room_id=$2 AND username=$3", [payout, req.params.roomId, b.username]);
    }
  }
  await pool.query("UPDATE events SET resolved=TRUE,winner=$1 WHERE id=$2", [winner, req.params.id]);
  res.json({ success: true });
});

// Admin resolve across any room
app.post("/api/admin/events/:id/resolve", async (req, res) => {
  const { winner, password } = req.body;
  if (!isMaster(password)) return res.status(401).json({ error: "Unauthorized" });
  const evtRow = await pool.query("SELECT * FROM events WHERE id=$1", [req.params.id]);
  const event = evtRow.rows[0];
  if (!event) return res.status(404).json({ error: "Event not found" });
  const bets = (await pool.query("SELECT * FROM bets WHERE event_id=$1", [req.params.id])).rows;
  const totalPool = bets.reduce((s,b)=>s+b.amount,0);
  const winBets   = bets.filter(b=>b.option_index===winner);
  const winPool   = winBets.reduce((s,b)=>s+b.amount,0);
  if (winPool > 0) {
    for (const b of winBets) {
      const payout = Math.round((b.amount/winPool)*totalPool);
      await pool.query("UPDATE users SET balance=balance+$1 WHERE room_id=$2 AND username=$3", [payout, event.room_id, b.username]);
    }
  }
  await pool.query("UPDATE events SET resolved=TRUE,winner=$1 WHERE id=$2", [winner, req.params.id]);
  res.json({ success: true });
});

// ── Bets ──────────────────────────────────────────────────────────────────────
app.post("/api/rooms/:roomId/events/:id/bets", async (req, res) => {
  const { username, option_index, amount } = req.body;
  const s = await getSettings();
  const min = parseInt(s.min_bet||1), max = parseInt(s.max_bet||100);
  if (amount < min || amount > max) return res.status(400).json({ error: `Bet must be ${min}–${max}` });

  const userRes = await pool.query(
    "INSERT INTO users(room_id,username,balance) VALUES($1,$2,$3) ON CONFLICT(room_id,username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [req.params.roomId, username.trim(), parseInt(s.starting_balance||100)]
  );
  const user = userRes.rows[0];
  if (user.balance < amount) return res.status(400).json({ error: `Not enough pts (you have ${user.balance})` });

  const evtRow = await pool.query("SELECT * FROM events WHERE id=$1 AND room_id=$2", [req.params.id, req.params.roomId]);
  const event = evtRow.rows[0];
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.resolved) return res.status(400).json({ error: "Already resolved" });
  if (new Date(event.deadline) < new Date()) return res.status(400).json({ error: "Deadline passed" });

  await pool.query("UPDATE users SET balance=balance-$1 WHERE room_id=$2 AND username=$3", [amount, req.params.roomId, username.trim()]);
  const bet = await pool.query(
    "INSERT INTO bets(event_id,username,option_index,amount) VALUES($1,$2,$3,$4) RETURNING *",
    [req.params.id, username.trim(), option_index, amount]
  );
  res.json({
    bet: { id: bet.rows[0].id, user: bet.rows[0].username, option: bet.rows[0].option_index, amount: bet.rows[0].amount, time: bet.rows[0].created_at },
    newBalance: user.balance - amount,
  });
});

// ── Wipe room (admin only) ────────────────────────────────────────────────────
app.post("/api/admin/rooms/:id/wipe", async (req, res) => {
  if (!isMaster(req.body.password)) return res.status(401).json({ error: "Unauthorized" });
  const evts = await pool.query("SELECT id FROM events WHERE room_id=$1", [req.params.id]);
  if (evts.rows.length) await pool.query("DELETE FROM bets WHERE event_id=ANY($1)", [evts.rows.map(e=>e.id)]);
  await pool.query("DELETE FROM events WHERE room_id=$1", [req.params.id]);
  await pool.query("DELETE FROM users WHERE room_id=$1", [req.params.id]);
  res.json({ success: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "client/dist/index.html")));

const PORT = process.env.PORT || 3001;
initDB().then(() => app.listen(PORT, () => console.log(`🎲 Polyfrens on port ${PORT}`))).catch(err => { console.error(err); process.exit(1); });
