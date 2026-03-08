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

const STARTING_BALANCE = 100;

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      creator TEXT NOT NULL,
      options JSONB NOT NULL,
      deadline DATE NOT NULL,
      resolved BOOLEAN DEFAULT FALSE,
      winner INTEGER DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      option_index INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO settings (key, value) VALUES
      ('password_hash', $1),
      ('creator_password_hash', $2),
      ('min_bet', '1'),
      ('max_bet', '100'),
      ('currency', 'pts'),
      ('starting_balance', '100')
    ON CONFLICT (key) DO NOTHING
  `, [bcrypt.hashSync("Khel Mandli", 10), bcrypt.hashSync("create123", 10)]);

  console.log("✅ Database ready");
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { password } = req.body;
  const result = await pool.query("SELECT value FROM settings WHERE key='password_hash'");
  const valid = bcrypt.compareSync(password, result.rows[0]?.value);
  if (valid) res.json({ success: true });
  else res.status(401).json({ error: "Wrong password" });
});

app.post("/api/auth/creator-login", async (req, res) => {
  const { password } = req.body;
  const result = await pool.query("SELECT value FROM settings WHERE key='creator_password_hash'");
  const valid = bcrypt.compareSync(password, result.rows[0]?.value);
  if (valid) res.json({ success: true });
  else res.status(401).json({ error: "Wrong password" });
});

// ── Users / Balances ──────────────────────────────────────────────────────────
// Register or get user
app.post("/api/users/register", async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) return res.status(400).json({ error: "Invalid name" });

  const startRow = await pool.query("SELECT value FROM settings WHERE key='starting_balance'");
  const startBal = parseInt(startRow.rows[0]?.value || STARTING_BALANCE);

  const result = await pool.query(
    "INSERT INTO users (username, balance) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [username.trim(), startBal]
  );
  res.json(result.rows[0]);
});

app.get("/api/users/:username/balance", async (req, res) => {
  const { username } = req.params;
  const startRow = await pool.query("SELECT value FROM settings WHERE key='starting_balance'");
  const startBal = parseInt(startRow.rows[0]?.value || STARTING_BALANCE);

  // upsert in case they haven't registered yet
  const result = await pool.query(
    "INSERT INTO users (username, balance) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [username, startBal]
  );
  res.json({ balance: result.rows[0].balance });
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get("/api/settings", async (req, res) => {
  const result = await pool.query("SELECT key, value FROM settings WHERE key NOT LIKE '%password%'");
  const settings = {};
  result.rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.post("/api/settings", async (req, res) => {
  const { password, min_bet, max_bet, currency, starting_balance, new_password, new_creator_password } = req.body;
  const hashRow = await pool.query("SELECT value FROM settings WHERE key='password_hash'");
  if (!bcrypt.compareSync(password, hashRow.rows[0]?.value)) return res.status(401).json({ error: "Unauthorized" });

  for (const [key, value] of Object.entries({ min_bet, max_bet, currency, starting_balance })) {
    if (value !== undefined)
      await pool.query("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2", [key, String(value)]);
  }
  if (new_password)
    await pool.query("UPDATE settings SET value=$1 WHERE key='password_hash'", [bcrypt.hashSync(new_password, 10)]);
  if (new_creator_password)
    await pool.query("INSERT INTO settings (key,value) VALUES ('creator_password_hash',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [bcrypt.hashSync(new_creator_password, 10)]);

  res.json({ success: true });
});

// ── Events ────────────────────────────────────────────────────────────────────
app.get("/api/events", async (req, res) => {
  const eventsResult = await pool.query("SELECT * FROM events ORDER BY created_at DESC");
  const betsResult = await pool.query("SELECT * FROM bets ORDER BY created_at ASC");
  const events = eventsResult.rows.map(e => ({
    ...e,
    bets: betsResult.rows.filter(b => b.event_id === e.id).map(b => ({
      id: b.id, user: b.username, option: b.option_index, amount: b.amount, time: b.created_at,
    })),
  }));
  res.json(events);
});

app.post("/api/events", async (req, res) => {
  const { title, description, creator, options, deadline, password } = req.body;
  const [adminRow, creatorRow] = await Promise.all([
    pool.query("SELECT value FROM settings WHERE key='password_hash'"),
    pool.query("SELECT value FROM settings WHERE key='creator_password_hash'"),
  ]);
  const isAdmin = bcrypt.compareSync(password, adminRow.rows[0]?.value);
  const isCreator = bcrypt.compareSync(password, creatorRow.rows[0]?.value);
  if (!isAdmin && !isCreator) return res.status(401).json({ error: "Unauthorized" });

  const result = await pool.query(
    "INSERT INTO events (title, description, creator, options, deadline) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [title, description || "", creator, JSON.stringify(options), deadline]
  );
  res.json({ ...result.rows[0], bets: [] });
});

app.post("/api/events/:id/resolve", async (req, res) => {
  const { winner, password } = req.body;
  const { id } = req.params;
  const hashRow = await pool.query("SELECT value FROM settings WHERE key='password_hash'");
  if (!bcrypt.compareSync(password, hashRow.rows[0]?.value)) return res.status(401).json({ error: "Unauthorized" });

  // Get all bets for this event
  const betsResult = await pool.query("SELECT * FROM bets WHERE event_id=$1", [id]);
  const bets = betsResult.rows;
  const totalPool = bets.reduce((s, b) => s + b.amount, 0);
  const winBets = bets.filter(b => b.option_index === winner);
  const winPool = winBets.reduce((s, b) => s + b.amount, 0);

  // Pay out winners
  if (winPool > 0) {
    for (const b of winBets) {
      const payout = Math.round((b.amount / winPool) * totalPool);
      await pool.query("UPDATE users SET balance = balance + $1 WHERE username = $2", [payout, b.username]);
    }
  }

  await pool.query("UPDATE events SET resolved=TRUE, winner=$1 WHERE id=$2", [winner, id]);
  res.json({ success: true });
});

// ── Bets ──────────────────────────────────────────────────────────────────────
app.post("/api/events/:id/bets", async (req, res) => {
  const { username, option_index, amount } = req.body;
  const { id } = req.params;

  const [minRow, maxRow, startRow] = await Promise.all([
    pool.query("SELECT value FROM settings WHERE key='min_bet'"),
    pool.query("SELECT value FROM settings WHERE key='max_bet'"),
    pool.query("SELECT value FROM settings WHERE key='starting_balance'"),
  ]);
  const min = parseInt(minRow.rows[0]?.value || 1);
  const max = parseInt(maxRow.rows[0]?.value || 100);
  const startBal = parseInt(startRow.rows[0]?.value || STARTING_BALANCE);

  if (amount < min || amount > max) return res.status(400).json({ error: `Bet must be ${min}–${max}` });

  // Get or create user
  const userResult = await pool.query(
    "INSERT INTO users (username, balance) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET username=EXCLUDED.username RETURNING *",
    [username.trim(), startBal]
  );
  const user = userResult.rows[0];
  if (user.balance < amount) return res.status(400).json({ error: `Not enough pts (you have ${user.balance})` });

  const eventRow = await pool.query("SELECT * FROM events WHERE id=$1", [id]);
  const event = eventRow.rows[0];
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.resolved) return res.status(400).json({ error: "Already resolved" });
  if (new Date(event.deadline) < new Date()) return res.status(400).json({ error: "Deadline passed" });

  // Deduct balance
  await pool.query("UPDATE users SET balance = balance - $1 WHERE username = $2", [amount, username.trim()]);

  const result = await pool.query(
    "INSERT INTO bets (event_id, username, option_index, amount) VALUES ($1,$2,$3,$4) RETURNING *",
    [id, username.trim(), option_index, amount]
  );
  const newBalance = user.balance - amount;
  res.json({
    bet: { id: result.rows[0].id, user: result.rows[0].username, option: result.rows[0].option_index, amount: result.rows[0].amount, time: result.rows[0].created_at },
    newBalance,
  });
});

// ── Wipe all data (admin only) ────────────────────────────────────────────────
app.post("/api/admin/wipe", async (req, res) => {
  const { password } = req.body;
  const hashRow = await pool.query("SELECT value FROM settings WHERE key='password_hash'");
  if (!bcrypt.compareSync(password, hashRow.rows[0]?.value)) return res.status(401).json({ error: "Unauthorized" });
  await pool.query("DELETE FROM bets");
  await pool.query("DELETE FROM events");
  await pool.query("DELETE FROM users");
  res.json({ success: true });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "client/dist/index.html")));

const PORT = process.env.PORT || 3001;
initDB().then(() => app.listen(PORT, () => console.log(`🎲 Khel Mandli on port ${PORT}`))).catch(err => { console.error(err); process.exit(1); });
