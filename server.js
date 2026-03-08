require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
app.use(express.json());

// Serve React build
app.use(express.static(path.join(__dirname, "client/dist")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── Init DB ──────────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      creator TEXT NOT NULL,
      options JSONB NOT NULL,
      category TEXT DEFAULT '🎯 General',
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

  // Seed default settings if not present
  await pool.query(`
    INSERT INTO settings (key, value) VALUES
      ('password_hash', $1),
      ('min_bet', '50'),
      ('max_bet', '1000'),
      ('currency', 'pts')
    ON CONFLICT (key) DO NOTHING
  `, [bcrypt.hashSync("Khel Mandli", 10)]);

  console.log("✅ Database ready");
}

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { password } = req.body;
  const result = await pool.query("SELECT value FROM settings WHERE key = 'password_hash'");
  const hash = result.rows[0]?.value;
  const valid = bcrypt.compareSync(password, hash);
  if (valid) res.json({ success: true });
  else res.status(401).json({ success: false, error: "Wrong password" });
});

// ── Settings ─────────────────────────────────────────────────────────────────
app.get("/api/settings", async (req, res) => {
  const result = await pool.query("SELECT key, value FROM settings WHERE key != 'password_hash'");
  const settings = {};
  result.rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.post("/api/settings", async (req, res) => {
  const { password, min_bet, max_bet, currency, new_password } = req.body;

  // Verify admin password
  const hashRow = await pool.query("SELECT value FROM settings WHERE key = 'password_hash'");
  const valid = bcrypt.compareSync(password, hashRow.rows[0]?.value);
  if (!valid) return res.status(401).json({ error: "Unauthorized" });

  const updates = { min_bet, max_bet, currency };
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, String(value)]);
    }
  }

  if (new_password) {
    const newHash = bcrypt.hashSync(new_password, 10);
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'password_hash'", [newHash]);
  }

  res.json({ success: true });
});

// ── Events ────────────────────────────────────────────────────────────────────
app.get("/api/events", async (req, res) => {
  const eventsResult = await pool.query("SELECT * FROM events ORDER BY created_at DESC");
  const betsResult = await pool.query("SELECT * FROM bets ORDER BY created_at ASC");

  const events = eventsResult.rows.map(e => ({
    ...e,
    bets: betsResult.rows.filter(b => b.event_id === e.id).map(b => ({
      id: b.id,
      user: b.username,
      option: b.option_index,
      amount: b.amount,
      time: b.created_at,
    })),
  }));

  res.json(events);
});

app.post("/api/events", async (req, res) => {
  const { title, description, creator, options, category, deadline, password } = req.body;

  // Verify admin password
  const hashRow = await pool.query("SELECT value FROM settings WHERE key = 'password_hash'");
  const valid = bcrypt.compareSync(password, hashRow.rows[0]?.value);
  if (!valid) return res.status(401).json({ error: "Unauthorized" });

  const result = await pool.query(
    "INSERT INTO events (title, description, creator, options, category, deadline) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [title, description || "", creator, JSON.stringify(options), category, deadline]
  );
  res.json({ ...result.rows[0], bets: [] });
});

app.post("/api/events/:id/resolve", async (req, res) => {
  const { winner, password } = req.body;
  const { id } = req.params;

  const hashRow = await pool.query("SELECT value FROM settings WHERE key = 'password_hash'");
  const valid = bcrypt.compareSync(password, hashRow.rows[0]?.value);
  if (!valid) return res.status(401).json({ error: "Unauthorized" });

  await pool.query("UPDATE events SET resolved = TRUE, winner = $1 WHERE id = $2", [winner, id]);
  res.json({ success: true });
});

// ── Bets ──────────────────────────────────────────────────────────────────────
app.post("/api/events/:id/bets", async (req, res) => {
  const { username, option_index, amount } = req.body;
  const { id } = req.params;

  // Validate amount against settings
  const minRow = await pool.query("SELECT value FROM settings WHERE key = 'min_bet'");
  const maxRow = await pool.query("SELECT value FROM settings WHERE key = 'max_bet'");
  const min = parseInt(minRow.rows[0]?.value || 50);
  const max = parseInt(maxRow.rows[0]?.value || 1000);

  if (amount < min || amount > max) {
    return res.status(400).json({ error: `Bet must be between ${min} and ${max}` });
  }

  // Check event is still open
  const eventRow = await pool.query("SELECT * FROM events WHERE id = $1", [id]);
  const event = eventRow.rows[0];
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.resolved) return res.status(400).json({ error: "Event already resolved" });
  if (new Date(event.deadline) < new Date()) return res.status(400).json({ error: "Deadline passed" });

  const result = await pool.query(
    "INSERT INTO bets (event_id, username, option_index, amount) VALUES ($1, $2, $3, $4) RETURNING *",
    [id, username.trim(), option_index, amount]
  );

  res.json({
    id: result.rows[0].id,
    user: result.rows[0].username,
    option: result.rows[0].option_index,
    amount: result.rows[0].amount,
    time: result.rows[0].created_at,
  });
});

// ── Catch-all: serve React ────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist/index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDB().then(() => {
  app.listen(PORT, () => console.log(`🎲 Khel Mandli running on port ${PORT}`));
}).catch(err => {
  console.error("DB init failed:", err);
  process.exit(1);
});
