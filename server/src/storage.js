import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DATABASE_URL = process.env.DATABASE_URL || "";

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    })
  : null;

const DEFAULT_PROMPT = {
  id: "default-mimo",
  title: "Default MiMo",
  content: "You are MiMo, an AI assistant developed by Xiaomi. You are helpful, harmless, and honest.",
  isDefault: true,
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file) {
  ensureDir(DATA_DIR);
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function writeJSON(file, data) {
  ensureDir(DATA_DIR);
  const fp = path.join(DATA_DIR, file);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

function promptFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    isDefault: row.is_default,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function sessionFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    model: row.model,
    systemPromptId: row.system_prompt_id,
    messages: row.messages || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function stripAttachmentDataUrls(messages = []) {
  return messages.map((message) => ({
    ...message,
    attachments: (message.attachments || []).map(({ dataUrl: _dataUrl, ...attachment }) => attachment),
  }));
}

function normalizeSession(session) {
  return {
    ...session,
    messages: stripAttachmentDataUrls(session.messages || []),
  };
}

export async function initStorage() {
  if (!pool) {
    await seedDefaults();
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt_id TEXT,
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS prompts_single_default
    ON prompts (is_default)
    WHERE is_default = TRUE;
  `);

  await seedDefaults();
}

// --- Prompts ---

export async function getPrompts() {
  if (!pool) return readJSON("prompts.json") || [];

  const result = await pool.query("SELECT * FROM prompts ORDER BY is_default DESC, updated_at DESC");
  return result.rows.map(promptFromRow);
}

export async function savePrompts(prompts) {
  if (!pool) {
    writeJSON("prompts.json", prompts);
    return;
  }

  await pool.query("DELETE FROM prompts");
  for (const prompt of prompts) {
    await createPrompt(prompt);
  }
}

export async function getPromptById(id) {
  if (!pool) return (readJSON("prompts.json") || []).find((p) => p.id === id) || null;

  const result = await pool.query("SELECT * FROM prompts WHERE id = $1", [id]);
  return result.rows[0] ? promptFromRow(result.rows[0]) : null;
}

export async function createPrompt(prompt) {
  const now = new Date().toISOString();
  const createdAt = prompt.createdAt || now;
  const updatedAt = prompt.updatedAt || now;

  if (!pool) {
    const prompts = readJSON("prompts.json") || [];
    if (prompt.isDefault) {
      for (const existing of prompts) {
        existing.isDefault = false;
      }
    }
    prompts.push({ ...prompt, createdAt, updatedAt });
    writeJSON("prompts.json", prompts);
    return prompts[prompts.length - 1];
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (prompt.isDefault) {
      await client.query("UPDATE prompts SET is_default = FALSE WHERE is_default = TRUE");
    }
    const result = await client.query(
      `INSERT INTO prompts (id, title, content, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [prompt.id, prompt.title, prompt.content, Boolean(prompt.isDefault), createdAt, updatedAt]
    );
    await client.query("COMMIT");
    return promptFromRow(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePrompt(id, updates) {
  if (!pool) {
    const prompts = readJSON("prompts.json") || [];
    const idx = prompts.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    if (updates.isDefault) {
      for (const prompt of prompts) {
        prompt.isDefault = false;
      }
    }
    prompts[idx] = { ...prompts[idx], ...updates, updatedAt: new Date().toISOString() };
    writeJSON("prompts.json", prompts);
    return prompts[idx];
  }

  const existing = await getPromptById(id);
  if (!existing) return null;

  const next = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (updates.isDefault) {
      await client.query("UPDATE prompts SET is_default = FALSE WHERE is_default = TRUE AND id <> $1", [id]);
    }
    const result = await client.query(
      `UPDATE prompts
       SET title = $2, content = $3, is_default = $4, updated_at = $5
       WHERE id = $1
       RETURNING *`,
      [id, next.title, next.content, Boolean(next.isDefault), next.updatedAt]
    );
    await client.query("COMMIT");
    return promptFromRow(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePrompt(id) {
  if (!pool) {
    const prompts = readJSON("prompts.json") || [];
    const deleted = prompts.find((p) => p.id === id);
    const filtered = prompts.filter((p) => p.id !== id);
    if (filtered.length === prompts.length) return false;
    if (deleted?.isDefault && filtered.length > 0) {
      filtered[0] = { ...filtered[0], isDefault: true, updatedAt: new Date().toISOString() };
    }
    writeJSON("prompts.json", filtered);
    return true;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM prompts WHERE id = $1", [id]);
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return false;
    }
    const deletedWasDefault = existing.rows[0].is_default;
    await client.query("DELETE FROM prompts WHERE id = $1", [id]);
    if (deletedWasDefault) {
      await client.query(`
        UPDATE prompts
        SET is_default = TRUE, updated_at = NOW()
        WHERE id = (
          SELECT id FROM prompts ORDER BY updated_at DESC LIMIT 1
        )
      `);
    }
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// --- Sessions ---

export async function getSessions() {
  if (!pool) return (readJSON("sessions.json") || []).map(normalizeSession);

  const result = await pool.query("SELECT * FROM sessions ORDER BY updated_at DESC");
  return result.rows.map(sessionFromRow);
}

export async function saveSessions(sessions) {
  if (!pool) {
    writeJSON("sessions.json", sessions.map(normalizeSession));
    return;
  }

  await pool.query("DELETE FROM sessions");
  for (const session of sessions) {
    await createSession(session);
  }
}

export async function getSessionById(id) {
  if (!pool) {
    const session = (readJSON("sessions.json") || []).find((s) => s.id === id) || null;
    return session ? normalizeSession(session) : null;
  }

  const result = await pool.query("SELECT * FROM sessions WHERE id = $1", [id]);
  return result.rows[0] ? sessionFromRow(result.rows[0]) : null;
}

export async function createSession(session) {
  const now = new Date().toISOString();
  const createdAt = session.createdAt || now;
  const updatedAt = session.updatedAt || now;
  const next = normalizeSession({ ...session, createdAt, updatedAt });

  if (!pool) {
    const sessions = readJSON("sessions.json") || [];
    sessions.push(next);
    writeJSON("sessions.json", sessions);
    return next;
  }

  const result = await pool.query(
    `INSERT INTO sessions (id, title, model, system_prompt_id, messages, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING *`,
    [
      next.id,
      next.title,
      next.model,
      next.systemPromptId || null,
      JSON.stringify(next.messages || []),
      next.createdAt,
      next.updatedAt,
    ]
  );
  return sessionFromRow(result.rows[0]);
}

export async function updateSession(id, updates) {
  if (!pool) {
    const sessions = readJSON("sessions.json") || [];
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = normalizeSession({
      ...sessions[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    writeJSON("sessions.json", sessions);
    return sessions[idx];
  }

  const existing = await getSessionById(id);
  if (!existing) return null;

  const next = normalizeSession({ ...existing, ...updates, updatedAt: new Date().toISOString() });
  const result = await pool.query(
    `UPDATE sessions
     SET title = $2,
         model = $3,
         system_prompt_id = $4,
         messages = $5::jsonb,
         updated_at = $6
     WHERE id = $1
     RETURNING *`,
    [
      id,
      next.title,
      next.model,
      next.systemPromptId || null,
      JSON.stringify(next.messages || []),
      next.updatedAt,
    ]
  );
  return sessionFromRow(result.rows[0]);
}

export async function deleteSession(id) {
  if (!pool) {
    const sessions = readJSON("sessions.json") || [];
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === sessions.length) return false;
    writeJSON("sessions.json", filtered);
    return true;
  }

  const result = await pool.query("DELETE FROM sessions WHERE id = $1", [id]);
  return result.rowCount > 0;
}

// --- Default seed ---

export async function seedDefaults() {
  const prompts = await getPrompts();
  if (prompts.length > 0) return;

  await createPrompt({
    ...DEFAULT_PROMPT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("Seeded default system prompt");
}
