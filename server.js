const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
let Pool = null;
try {
  ({ Pool } = require("pg"));
} catch {
  Pool = null;
}

const PORT = Number(process.env.PORT || 3009);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const INTEGRATIONS_FILE = path.join(DATA_DIR, "integrations.json");
const ACTIVITIES_FILE = path.join(DATA_DIR, "activities.json");
const ATHLETES_FILE = path.join(DATA_DIR, "athletes.json");
const GOALS_FILE = path.join(DATA_DIR, "goals.json");
const SCHEMA_FILE = path.join(ROOT, "db", "schema.sql");
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG || "default";
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME || "11RUN";
const DATABASE_URL = process.env.DATABASE_URL || "";
const DEFAULT_ADMIN_EMAIL = (process.env.DEFAULT_ADMIN_EMAIL || "seitikatsumi@gmail.com").trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "bs000229";
const SESSION_COOKIE = "onzerun_session";
const APP_VERSION = process.env.APP_VERSION || process.env.CAPROVER_GIT_COMMIT_SHA || "local";
const SECRET_MASK = "********";
const STRAVA_REQUIRED_ACTIVITY_SCOPES = ["activity:read", "activity:read_all"];
const FOCUS_DISTANCES = new Set([800, 1500, 3000, 5000, 10000, 15000, 21000, 42000]);
const USER_ROLES = new Set(["admin", "manager", "coach", "athlete"]);
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const pool = DATABASE_URL && Pool
  ?new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ?{ rejectUnauthorized: false } : undefined
    })
  : null;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function callback(pathname) {
  return `${PUBLIC_BASE_URL}${pathname}`;
}

function defaultIntegrations() {
  return {
    strava: {
      name: "Strava",
      enabled: true,
      connected: false,
      credentials: {
        clientId: "",
        clientSecret: "",
        redirectUri: callback("/api/strava/callback"),
        scopes: "read,activity:read,activity:read_all"
      },
      token: null,
      athlete: null
    },
    garmin: {
      name: "Garmin Connect",
      enabled: false,
      connected: false,
      credentials: {
        clientId: "",
        clientSecret: "",
        redirectUri: callback("/api/garmin/callback"),
        permissions: "ACTIVITY_EXPORT",
        webhookUrl: callback("/api/webhooks/garmin"),
        environment: "evaluation"
      },
      token: null
    },
    coros: {
      name: "COROS",
      enabled: false,
      connected: false,
      credentials: {
        apiApplicationStatus: "not_submitted",
        partnerClientId: "",
        partnerClientSecret: "",
        redirectUri: callback("/api/coros/callback"),
        fallbackProvider: "Strava or Intervals.icu",
        fallbackApiKey: ""
      },
      token: null
    },
    polar: {
      name: "Polar AccessLink",
      enabled: false,
      connected: false,
      credentials: {
        clientId: "",
        clientSecret: "",
        redirectUri: callback("/api/polar/callback"),
        accessToken: "",
        userId: ""
      },
      token: null
    },
    suunto: {
      name: "Suunto",
      enabled: false,
      connected: false,
      credentials: {
        clientId: "",
        clientSecret: "",
        redirectUri: callback("/api/suunto/callback"),
        subscriptionKey: "",
        apiBaseUrl: "https://cloudapi-oauth.suunto.com",
        workoutApiBaseUrl: "https://cloudapi.suunto.com"
      },
      token: null
    }
  };
}

const DEMO_ACTIVITIES = [
  {
    id: "demo-garmin-1",
    providerId: "demo-garmin-1",
    date: "2026-05-03",
    title: "Longo progressivo",
    source: "Garmin",
    type: "Run",
    description: "24 km com final em ritmo de maratona, foco em economia e abastecimento.",
    distance: "24.0 km",
    duration: "1:52:18",
    load: "148",
    pace: "4:41/km",
    externalUrl: ""
  },
  {
    id: "demo-strava-1",
    providerId: "demo-strava-1",
    date: "2026-05-06",
    title: "Intervalado VO2",
    source: "Strava",
    type: "Workout",
    description: "6 x 800 m forte com 2 min trote; sessão demonstrativa até conectar o Strava real.",
    distance: "11.2 km",
    duration: "49:10",
    load: "116",
    pace: "4:23/km",
    externalUrl: ""
  },
  {
    id: "demo-polar-1",
    providerId: "demo-polar-1",
    date: "2026-05-09",
    title: "Regenerativo técnico",
    source: "Polar",
    type: "Run",
    description: "Corrida leve em Z2 com drills curtos de cadência no final.",
    distance: "8.4 km",
    duration: "46:44",
    load: "42",
    pace: "5:34/km",
    externalUrl: ""
  },
  {
    id: "demo-suunto-1",
    providerId: "demo-suunto-1",
    date: "2026-05-12",
    title: "Tempo run limiar",
    source: "Suunto",
    type: "Run",
    description: "3 blocos de 12 min no limiar com recuperação controlada.",
    distance: "15.6 km",
    duration: "1:08:02",
    load: "132",
    pace: "4:22/km",
    externalUrl: ""
  },
  {
    id: "demo-coros-1",
    providerId: "demo-coros-1",
    date: "2026-05-16",
    title: "Subida neuromuscular",
    source: "COROS",
    type: "Hill",
    description: "10 repetições de 45 s em subida, recuperando na descida.",
    distance: "9.7 km",
    duration: "53:29",
    load: "91",
    pace: "5:31/km",
    externalUrl: ""
  }
];

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INTEGRATIONS_FILE)) writeJson(INTEGRATIONS_FILE, defaultIntegrations());
  if (!fs.existsSync(ACTIVITIES_FILE)) writeJson(ACTIVITIES_FILE, DEMO_ACTIVITIES);
  if (!fs.existsSync(ATHLETES_FILE)) writeJson(ATHLETES_FILE, []);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefined(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value !== undefined && value !== SECRET_MASK) target[key] = value;
  }
}

function mergeCredentials(...sources) {
  const merged = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source || {})) {
      if (value !== undefined && value !== null && value !== "" && value !== SECRET_MASK) merged[key] = value;
    }
  }
  return merged;
}

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, hash] = storedHash.split(":");
  const candidate = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...rest] = item.split("=");
        return [key, decodeURIComponent(rest.join("="))];
      })
  );
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function sanitizeIntegrations(integrations) {
  const copy = clone(integrations);
  for (const integration of Object.values(copy)) {
    if (integration.credentials?.clientSecret) integration.credentials.clientSecret = SECRET_MASK;
    if (integration.credentials?.partnerClientSecret) integration.credentials.partnerClientSecret = SECRET_MASK;
    if (integration.credentials?.fallbackApiKey) integration.credentials.fallbackApiKey = SECRET_MASK;
    if (integration.credentials?.accessToken) integration.credentials.accessToken = SECRET_MASK;
    if (integration.credentials?.subscriptionKey) integration.credentials.subscriptionKey = SECRET_MASK;
    if (integration.token?.access_token) integration.token.access_token = "stored";
    if (integration.token?.refresh_token) integration.token.refresh_token = "stored";
  }
  return copy;
}

function sanitizeSettings(settings = {}) {
  return {
    openaiEnabled: Boolean(settings.openai_enabled || settings.openaiEnabled),
    openaiModel: settings.openai_model || settings.openaiModel || DEFAULT_OPENAI_MODEL,
    hasOpenaiApiKey: Boolean(settings.openai_api_key || settings.openaiApiKey),
    openaiApiKey: settings.openai_api_key || settings.openaiApiKey ?SECRET_MASK : ""
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ?404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.code === "ENOENT" ?"Arquivo não encontrado." : "Erro interno.");
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

async function query(text, params = []) {
  if (!pool) throw new Error("DATABASE_URL não configurado.");
  return pool.query(text, params);
}

async function initDatabase() {
  if (!pool) {
    ensureDataFiles();
    if (DATABASE_URL && !Pool) {
      console.log("DATABASE_URL foi definido, mas o pacote pg não está instalado neste ambiente local.");
    }
    console.log("11RUN usando armazenamento local JSON. Configure DATABASE_URL para Postgres.");
    return;
  }
  const schema = fs.readFileSync(SCHEMA_FILE, "utf8");
  await query(schema);
  await query(
    `INSERT INTO tenants (slug, name)
     VALUES ($1, $2)
     ON CONFLICT (slug) DO NOTHING`,
    [DEFAULT_TENANT_SLUG, DEFAULT_TENANT_NAME]
  );
  const tenant = await getTenant(DEFAULT_TENANT_SLUG);
  await ensureDefaultAdmin(tenant.id);
  await ensureTenantIntegrations(tenant.id);
}

async function getTenant(slug = DEFAULT_TENANT_SLUG) {
  if (!pool) return { id: "local-default", slug: DEFAULT_TENANT_SLUG, name: DEFAULT_TENANT_NAME };
  const result = await query("SELECT * FROM tenants WHERE slug = $1", [slug]);
  if (result.rows[0]) return result.rows[0];
  const created = await query(
    "INSERT INTO tenants (slug, name) VALUES ($1, $2) RETURNING *",
    [slug, slug]
  );
  return created.rows[0];
}

async function getAppSettings(tenantId) {
  if (!pool) {
    const settings = readJson(path.join(DATA_DIR, "settings.json"), {});
    return sanitizeSettings(settings);
  }
  const result = await query("SELECT * FROM app_settings WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  const row = result.rows[0] || {
    openai_enabled: false,
    openai_model: DEFAULT_OPENAI_MODEL,
    openai_api_key: ""
  };
  return sanitizeSettings(row);
}

async function getRawAppSettings(tenantId) {
  if (!pool) return readJson(path.join(DATA_DIR, "settings.json"), {});
  const result = await query("SELECT * FROM app_settings WHERE tenant_id = $1 LIMIT 1", [tenantId]);
  return result.rows[0] || {};
}

async function saveAppSettings(tenantId, input = {}) {
  const existing = await getRawAppSettings(tenantId);
  const openaiEnabled = Boolean(input.openaiEnabled);
  const openaiModel = String(input.openaiModel || existing.openai_model || existing.openaiModel || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;
  const incomingKey = String(input.openaiApiKey || "").trim();
  const openaiApiKey = incomingKey && incomingKey !== SECRET_MASK
    ?incomingKey
    : existing.openai_api_key || existing.openaiApiKey || "";

  if (!pool) {
    const settings = { openaiEnabled, openaiModel, openaiApiKey };
    writeJson(path.join(DATA_DIR, "settings.json"), settings);
    return sanitizeSettings(settings);
  }

  const result = await query(
    `INSERT INTO app_settings (tenant_id, openai_enabled, openai_model, openai_api_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id)
     DO UPDATE SET openai_enabled = EXCLUDED.openai_enabled,
                   openai_model = EXCLUDED.openai_model,
                   openai_api_key = EXCLUDED.openai_api_key,
                   updated_at = now()
     RETURNING *`,
    [tenantId, openaiEnabled, openaiModel, openaiApiKey || null]
  );
  return sanitizeSettings(result.rows[0]);
}

async function ensureDefaultAdmin(tenantId) {
  if (!pool || !DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) return;
  const adminResult = await query(
    `INSERT INTO users (tenant_id, role, name, email, password_hash)
     VALUES ($1, 'admin', 'Seiti Katsumi', $2, $3)
     ON CONFLICT (tenant_id, email)
     DO UPDATE SET role = 'admin',
                   name = COALESCE(NULLIF(users.name, 'Super Admin'), EXCLUDED.name),
                   password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)
     RETURNING id`,
    [tenantId, DEFAULT_ADMIN_EMAIL, hashPassword(DEFAULT_ADMIN_PASSWORD)]
  );
  const adminId = adminResult.rows[0].id;
  await query(
    `INSERT INTO athlete_profiles (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [adminId]
  );
  await ensureTenantIntegrations(tenantId, adminId);
  await migrateGlobalStravaTokenToAthlete(tenantId, adminId);
}

async function ensureTenantIntegrations(tenantId, athleteUserId = null) {
  if (!pool) return;
  const integrations = defaultIntegrations();
  for (const [provider, integration] of Object.entries(integrations)) {
    const existing = await query(
      `SELECT id FROM integrations
        WHERE tenant_id = $1
          AND athlete_user_id IS NOT DISTINCT FROM $2
          AND provider = $3
        LIMIT 1`,
      [tenantId, athleteUserId, provider]
    );
    if (!existing.rows[0]) {
      await query(
        `INSERT INTO integrations (tenant_id, athlete_user_id, provider, enabled, connected, credentials, token, athlete)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          athleteUserId,
          provider,
          integration.enabled,
          integration.connected,
          JSON.stringify(integration.credentials),
          integration.token ?JSON.stringify(integration.token) : null,
          integration.athlete ?JSON.stringify(integration.athlete) : null
        ]
      );
    }
  }
}

async function migrateGlobalStravaTokenToAthlete(tenantId, athleteUserId) {
  if (!pool || !athleteUserId) return;
  const result = await query(
    `SELECT credentials, token, athlete, connected
       FROM integrations
      WHERE tenant_id = $1
        AND athlete_user_id IS NULL
        AND provider = 'strava'
        AND token IS NOT NULL
      LIMIT 1`,
    [tenantId]
  );
  const globalIntegration = result.rows[0];
  if (!globalIntegration) return;
  const athleteIntegration = await query(
    `SELECT id, credentials, token, connected
       FROM integrations
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND provider = 'strava'
      LIMIT 1`,
    [tenantId, athleteUserId]
  );
  const row = athleteIntegration.rows[0];
  if (!row || row.token || row.connected) return;
  await query(
    `UPDATE integrations
        SET connected = $1,
            credentials = $2,
            token = $3,
            athlete = $4,
            updated_at = now()
      WHERE id = $5`,
    [
      Boolean(globalIntegration.connected),
      JSON.stringify(mergeCredentials(globalIntegration.credentials, row.credentials)),
      JSON.stringify(globalIntegration.token),
      globalIntegration.athlete ?JSON.stringify(globalIntegration.athlete) : null,
      row.id
    ]
  );
}

function tenantSlugFromReq(req) {
  return req.headers["x-tenant-slug"] || DEFAULT_TENANT_SLUG;
}

async function getPrimaryAthleteId(tenantId) {
  if (!pool) {
    const athletes = readJson(ATHLETES_FILE, []);
    return athletes[0]?.id || null;
  }
  const result = await query(
    `SELECT u.id
       FROM users u
       JOIN athlete_profiles ap ON ap.user_id = u.id
      WHERE u.tenant_id = $1
      ORDER BY u.created_at ASC
      LIMIT 1`,
    [tenantId]
  );
  return result.rows[0]?.id || null;
}

function formatAthlete(row) {
  const tests3000 = Array.isArray(row.tests_3000)
    ?row.tests_3000
    : parseJsonObject(row.tests_3000);
  const historyTimeline = Array.isArray(row.history_timeline)
    ?row.history_timeline
    : parseJsonObject(row.history_timeline);
  return {
    id: row.id,
    tenantId: row.tenant_id,
    role: row.role,
    roleLabel: {
      admin: "Super admin",
      manager: "Equipe",
      coach: "Treinador",
      athlete: "Atleta"
    }[row.role] || row.role,
    profileData: parseJsonObject(row.profile_data),
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp || "",
    teamId: row.team_id || "",
    teamName: row.team_name || "",
    coachId: row.coach_user_id || "",
    coachName: row.coach_name || "",
    coachEmail: row.coach_email || "",
    age: row.age == null ?"" : Number(row.age),
    weightKg: row.weight_kg == null ?"" : Number(row.weight_kg),
    heightCm: row.height_cm == null ?"" : Number(row.height_cm),
    focusDistanceM: row.focus_distance_m == null ?"" : Number(row.focus_distance_m),
    targetTimeSeconds: row.target_time_seconds == null ?"" : Number(row.target_time_seconds),
    targetTime: row.target_time_seconds == null ?"" : formatDuration(row.target_time_seconds),
    targetDate: row.target_date ?formatDateOnly(row.target_date) : "",
    bestTimeSeconds: row.best_time_seconds == null ?"" : Number(row.best_time_seconds),
    bestTime: row.best_time_seconds == null ?"" : formatDuration(row.best_time_seconds),
    historyNotes: row.history_notes || "",
    historyTimeline: Array.isArray(historyTimeline) ?historyTimeline.map((entry) => ({
      id: entry.id || "",
      type: entry.type || "context",
      startDate: entry.startDate || "",
      endDate: entry.endDate || "",
      time: entry.time || "",
      title: entry.title || "",
      description: entry.description || "",
      originalContent: entry.originalContent || entry.description || "",
      vo2: entry.vo2 || "",
      weightKg: entry.weightKg || "",
      heartRate: entry.heartRate || "",
      power: entry.power || "",
      pace: entry.pace || "",
      sleepHours: entry.sleepHours || "",
      perceivedEffort: entry.perceivedEffort || "",
      painScore: entry.painScore === 0 ?0 : entry.painScore || "",
      tags: Array.isArray(entry.tags) ?entry.tags : [],
      importance: entry.importance || "",
      relation: entry.relation || "",
      possibleImpact: entry.possibleImpact || "",
      createdAt: entry.createdAt || ""
    })) : [],
    tests3000: Array.isArray(tests3000) ?tests3000.map((test) => ({
      date: test.date || "",
      timeSeconds: test.timeSeconds == null ?"" : Number(test.timeSeconds),
      time: test.timeSeconds == null ?"" : formatDuration(test.timeSeconds),
      notes: test.notes || ""
    })) : [],
    createdAt: row.created_at
  };
}

function validateTests3000(value) {
  const input = Array.isArray(value) ?value : [];
  return input.slice(0, 20).map((item) => {
    const date = String(item.date || "").trim();
    const seconds = parseTimeToSeconds(item.time || item.timeSeconds);
    const notes = String(item.notes || "").trim().slice(0, 220);
    if (!date && !seconds && !notes) return null;
    if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) throw new Error("Informe uma data valida para cada teste de 3000 m.");
    if (!seconds) throw new Error("Informe o tempo de cada teste de 3000 m.");
    return { date, timeSeconds: seconds, notes };
  }).filter(Boolean);
}

function validateHistoryTimeline(value) {
  const input = Array.isArray(value) ?value : [];
  return input
    .slice(0, 30)
    .map((item) => {
      const startDate = String(item.startDate || "").trim();
      const endDate = String(item.endDate || "").trim();
      const type = ["context", "vo2"].includes(String(item.type || "")) ?String(item.type) : "context";
      const title = String(item.title || "").trim().slice(0, 120);
      const description = String(item.description || "").trim().slice(0, 1200);
      const vo2 = item.vo2 === "" || item.vo2 == null ?"" : Number(item.vo2);
      if (!startDate && !endDate && !title && !description && !vo2) return null;
      if (!startDate || Number.isNaN(new Date(`${startDate}T00:00:00`).getTime())) {
        throw new Error("Informe a data de início em cada item do histórico.");
      }
      if (vo2 && (!Number.isFinite(vo2) || vo2 < 1 || vo2 > 100)) {
        throw new Error("Informe um VO2 válido no histórico.");
      }
      if (endDate && Number.isNaN(new Date(`${endDate}T00:00:00`).getTime())) {
        throw new Error("Informe uma data de fim válida no histórico.");
      }
      if (endDate && endDate < startDate) {
        throw new Error("A data de fim não pode ser menor que a data de início.");
      }
      return { type, startDate, endDate, title, description, vo2: vo2 || "" };
    })
    .filter(Boolean);
}

function validateHistoryTimelineV2(value) {
  const input = Array.isArray(value) ?value : [];
  return input.slice(0, 500).map((item) => {
    const startDate = String(item.startDate || "").trim();
    const endDate = String(item.endDate || "").trim();
    const allowedTypes = new Set(["context", "training", "sensation", "pain", "recovery", "nutrition", "competition", "test", "vo2", "weight", "routine"]);
    const type = allowedTypes.has(String(item.type || "")) ?String(item.type) : "context";
    const title = String(item.title || "").trim().slice(0, 140);
    const description = String(item.description || "").trim().slice(0, 2400);
    const originalContent = String(item.originalContent || description || title).trim().slice(0, 2600);
    const time = String(item.time || "").trim().slice(0, 5);
    const vo2 = item.vo2 === "" || item.vo2 == null ?"" : Number(item.vo2);
    const weightKg = item.weightKg === "" || item.weightKg == null ?"" : Number(item.weightKg);
    const heartRate = item.heartRate === "" || item.heartRate == null ?"" : Number(item.heartRate);
    const power = item.power === "" || item.power == null ?"" : Number(item.power);
    const sleepHours = item.sleepHours === "" || item.sleepHours == null ?"" : Number(item.sleepHours);
    const perceivedEffort = item.perceivedEffort === "" || item.perceivedEffort == null ?"" : Number(item.perceivedEffort);
    const painScore = item.painScore === "" || item.painScore == null ?"" : Number(item.painScore);
    if (!startDate && !endDate && !title && !description && !vo2 && !weightKg && !heartRate && !power) return null;
    if (!startDate || Number.isNaN(new Date(`${startDate}T00:00:00`).getTime())) throw new Error("Informe a data de início em cada item do histórico.");
    if (time && !/^\d{2}:\d{2}$/.test(time)) throw new Error("Informe o horário no formato HH:mm.");
    if (vo2 && (!Number.isFinite(vo2) || vo2 < 1 || vo2 > 100)) throw new Error("Informe um VO2 válido no histórico.");
    if (weightKg && (!Number.isFinite(weightKg) || weightKg <= 0)) throw new Error("Informe um peso válido no histórico.");
    if (heartRate && (!Number.isFinite(heartRate) || heartRate <= 0)) throw new Error("Informe uma FC válida no histórico.");
    if (power && (!Number.isFinite(power) || power <= 0)) throw new Error("Informe uma potência válida no histórico.");
    if (sleepHours !== "" && (!Number.isFinite(sleepHours) || sleepHours < 0 || sleepHours > 24)) throw new Error("Informe sono entre 0 e 24 horas.");
    if (perceivedEffort !== "" && (!Number.isFinite(perceivedEffort) || perceivedEffort < 1 || perceivedEffort > 10)) throw new Error("Informe esforço de 1 a 10.");
    if (painScore !== "" && (!Number.isFinite(painScore) || painScore < 0 || painScore > 10)) throw new Error("Informe dor de 0 a 10.");
    if (endDate && Number.isNaN(new Date(`${endDate}T00:00:00`).getTime())) throw new Error("Informe uma data de fim válida no histórico.");
    if (endDate && endDate < startDate) throw new Error("A data de fim não pode ser menor que a data de início.");
    return {
      id: String(item.id || crypto.randomUUID()).slice(0, 80),
      type,
      startDate,
      endDate,
      time,
      title,
      description,
      originalContent,
      vo2: vo2 || "",
      weightKg: weightKg || "",
      heartRate: heartRate || "",
      power: power || "",
      pace: String(item.pace || "").trim().slice(0, 16),
      sleepHours: sleepHours === 0 ?0 : sleepHours || "",
      perceivedEffort: perceivedEffort || "",
      painScore: painScore === 0 ?0 : painScore || "",
      tags: Array.isArray(item.tags) ?item.tags.map((tag) => String(tag).slice(0, 32)).slice(0, 16) : [],
      importance: String(item.importance || "").trim().slice(0, 24),
      relation: String(item.relation || "").trim().slice(0, 120),
      possibleImpact: String(item.possibleImpact || "").trim().slice(0, 260),
      createdAt: String(item.createdAt || new Date().toISOString()).slice(0, 40)
    };
  }).filter(Boolean);
}

function parseTimeToSeconds(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.max(1, Math.round(Number(text)));
  const parts = text.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) {
    throw new Error("Informe o tempo no formato mm:ss ou hh:mm:ss.");
  }
  if (parts.length === 2) return Math.max(1, Math.round((parts[0] * 60) + parts[1]));
  if (parts.length === 3) return Math.max(1, Math.round((parts[0] * 3600) + (parts[1] * 60) + parts[2]));
  throw new Error("Informe o tempo no formato mm:ss ou hh:mm:ss.");
}

function formatUser(row) {
  if (!row) return null;
  const role = String(row.email || "").toLowerCase() === DEFAULT_ADMIN_EMAIL ?"admin" : row.role;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    role,
    roleLabel: {
      admin: "Super admin",
      manager: "Equipe",
      coach: "Treinador",
      athlete: "Atleta"
    }[role] || role,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp || ""
  };
}

async function getSessionUser(req, tenantId) {
  if (!pool) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const result = await query(
    `SELECT u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
        AND s.tenant_id = $2
        AND s.expires_at > now()
      LIMIT 1`,
    [token, tenantId]
  );
  return formatUser(result.rows[0]);
}

async function ensureUserAthleteProfile(tenantId, user) {
  if (!pool || !user) return;
  if (String(user.email || "").toLowerCase() === DEFAULT_ADMIN_EMAIL) {
    await query(
      `UPDATE users
          SET role = 'admin',
              name = COALESCE(NULLIF(name, ''), 'Seiti Katsumi')
        WHERE id = $1`,
      [user.id]
    );
  }
  if (user.role !== "admin" && user.role !== "athlete" && String(user.email || "").toLowerCase() !== DEFAULT_ADMIN_EMAIL) return;
  await query(
    `INSERT INTO athlete_profiles (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [user.id]
  );
  await ensureTenantIntegrations(tenantId, user.id);
}

async function createSession(tenantId, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await query(
    `INSERT INTO sessions (token, tenant_id, user_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '7 days')`,
    [token, tenantId, userId]
  );
  return token;
}

async function listAthletes(tenantId, user = null) {
  if (!pool) return readJson(ATHLETES_FILE, []);
  const isAdmin = user?.role === "admin" || String(user?.email || "").toLowerCase() === DEFAULT_ADMIN_EMAIL;
  const filters = ["u.tenant_id = $1", "ap.user_id IS NOT NULL"];
  const params = [tenantId];
  if (!isAdmin && user?.role === "athlete") {
    params.push(user.id);
    filters.push(`u.id = $${params.length}`);
  }
  if (!isAdmin && user?.role === "coach") {
    params.push(user.id);
    filters.push(`ap.coach_user_id = $${params.length}`);
  }
  if (!isAdmin && user?.role === "manager") {
    params.push(user.id);
    filters.push(`t.manager_user_id = $${params.length}`);
  }
  const result = await query(
      `SELECT u.id, u.tenant_id, u.role, u.name, u.email, u.whatsapp, u.profile_data, u.created_at,
            ap.age, ap.weight_kg, ap.height_cm, ap.team_id, ap.coach_user_id,
            ap.focus_distance_m, ap.target_time_seconds, ap.target_date, ap.best_time_seconds,
            ap.history_notes, ap.history_timeline, ap.tests_3000,
            t.name AS team_name,
            c.name AS coach_name,
            c.email AS coach_email
       FROM users u
       LEFT JOIN athlete_profiles ap ON ap.user_id = u.id
       LEFT JOIN teams t ON t.id = ap.team_id
       LEFT JOIN users c ON c.id = ap.coach_user_id
      WHERE ${filters.join(" AND ")}
      ORDER BY u.created_at DESC`,
    params
  );
  return result.rows.map(formatAthlete);
}

async function listDirectory(tenantId, user = null) {
  if (!pool) {
    const athletes = readJson(ATHLETES_FILE, []);
    const teams = [...new Set(athletes.map((athlete) => athlete.teamName).filter(Boolean))]
      .map((name) => ({ name }));
    const coaches = athletes
      .filter((athlete) => athlete.role === "coach" || athlete.coachEmail)
      .map((athlete) => ({
        name: athlete.role === "coach" ?athlete.name : athlete.coachName,
        email: athlete.role === "coach" ?athlete.email : athlete.coachEmail
      }))
      .filter((coach) => coach.email);
    return { teams, coaches };
  }
  const teamParams = [tenantId];
  const teamFilters = ["tenant_id = $1"];
  if (user?.role === "manager") {
    teamParams.push(user.id);
    teamFilters.push(`(manager_user_id = $${teamParams.length} OR manager_user_id IS NULL)`);
  }
  const [teamResult, coachResult] = await Promise.all([
    query(
      `SELECT id, name, profile_data
         FROM teams
        WHERE ${teamFilters.join(" AND ")}
        ORDER BY name ASC`,
      teamParams
    ),
    query(
      `SELECT id, name, email
         FROM users
        WHERE tenant_id = $1
          AND role = 'coach'
        ORDER BY name ASC`,
      [tenantId]
    )
  ]);
  return { teams: teamResult.rows, coaches: coachResult.rows };
}

async function createTeam(tenantId, input, user) {
  const name = String(input.name || "").trim();
  if (!name) throw httpError("Informe o nome da equipe.", 400);
  const profileData = {
    email: String(input.email || "").trim().toLowerCase(),
    whatsapp: String(input.whatsapp || "").trim(),
    location: String(input.location || "").trim(),
    managerName: String(input.managerName || "").trim(),
    website: String(input.website || "").trim(),
    institutionalNotes: String(input.institutionalNotes || "").trim()
  };
  if (!pool) {
    return { id: crypto.randomUUID(), name, profileData };
  }
  const managerUserId = user?.role === "manager" ?user.id : null;
  const result = await query(
    `INSERT INTO teams (tenant_id, name, manager_user_id, profile_data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, name)
     DO UPDATE SET name = EXCLUDED.name,
                   manager_user_id = COALESCE(teams.manager_user_id, EXCLUDED.manager_user_id),
                   profile_data = EXCLUDED.profile_data
     RETURNING id, name, profile_data`,
    [tenantId, name, managerUserId, JSON.stringify(profileData)]
  );
  return result.rows[0];
}

async function canAccessAthlete(tenantId, user, athleteUserId) {
  if (!user || !athleteUserId || user.role === "admin") return true;
  if (user.role === "athlete") return String(user.id) === String(athleteUserId);
  const visible = await listAthletes(tenantId, user);
  return visible.some((athlete) => String(athlete.id) === String(athleteUserId));
}

function validateAthlete(input, actorUser = null) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const whatsapp = String(input.whatsapp || "").trim();
  const age = input.age === "" || input.age == null ?null : Number(input.age);
  const weightKg = input.weightKg === "" || input.weightKg == null ?null : Number(input.weightKg);
  const heightCm = input.heightCm === "" || input.heightCm == null ?null : Number(input.heightCm);
  const teamName = String(input.teamName || "").trim();
  const coachName = String(input.coachName || "").trim();
  const coachEmail = String(input.coachEmail || "").trim().toLowerCase();
  const password = String(input.password || "").trim();
  const focusDistanceM = input.focusDistanceM === "" || input.focusDistanceM == null ?null : Number(input.focusDistanceM);
  const targetTimeSeconds = parseTimeToSeconds(input.targetTime || input.targetTimeSeconds);
  const bestTimeSeconds = parseTimeToSeconds(input.bestTime || input.bestTimeSeconds);
  const targetDate = String(input.targetDate || "").trim();
  const historyNotes = String(input.historyNotes || "").trim().slice(0, 4000);
  const historyTimeline = validateHistoryTimelineV2(input.historyTimeline);
  const tests3000 = validateTests3000(input.tests3000);
  const profileData = parseJsonObject(input.profileData);
  const requestedRole = String(input.role || "athlete").trim();
  const role = actorUser?.role === "admin" && USER_ROLES.has(requestedRole) ?requestedRole : "athlete";

  if (!name) throw new Error("Informe o nome do atleta.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  if (age != null && (!Number.isFinite(age) || age < 1 || age > 120)) throw new Error("Informe uma idade válida.");
  if (weightKg != null && (!Number.isFinite(weightKg) || weightKg <= 0)) throw new Error("Informe um peso válido.");
  if (heightCm != null && (!Number.isFinite(heightCm) || heightCm <= 0)) throw new Error("Informe uma altura válida.");
  if (focusDistanceM != null && !FOCUS_DISTANCES.has(focusDistanceM)) throw new Error("Selecione uma prova foco válida.");
  if (targetDate && Number.isNaN(new Date(`${targetDate}T00:00:00`).getTime())) throw new Error("Informe uma data alvo válida.");

  return {
    name,
    email,
    whatsapp,
    age,
    weightKg,
    heightCm,
    teamName,
    coachName,
    coachEmail,
    password,
    focusDistanceM,
    targetTimeSeconds,
    targetDate: targetDate || null,
    bestTimeSeconds,
    historyNotes,
    historyTimeline,
    tests3000,
    profileData,
    role
  };
}

async function ensureTeam(tenantId, name) {
  const cleanName = String(name || "").trim();
  if (!pool || !cleanName) return null;
  const result = await query(
    `INSERT INTO teams (tenant_id, name)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id, name)
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [tenantId, cleanName]
  );
  return result.rows[0].id;
}

async function ensureCoach(tenantId, name, email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!pool || !cleanEmail) return null;
  const cleanName = String(name || "").trim() || cleanEmail;
  const result = await query(
    `INSERT INTO users (tenant_id, role, name, email)
     VALUES ($1, 'coach', $2, $3)
     ON CONFLICT (tenant_id, email)
     DO UPDATE SET name = EXCLUDED.name,
                   role = CASE WHEN users.role = 'athlete' THEN users.role ELSE 'coach' END
     RETURNING id`,
    [tenantId, cleanName, cleanEmail]
  );
  return result.rows[0].id;
}

async function createAthlete(tenantId, input, actorUser = null) {
  const athlete = validateAthlete(input, actorUser);
  if (!pool) {
    const athletes = readJson(ATHLETES_FILE, []);
    const existingIndex = athletes.findIndex((item) => item.email === athlete.email);
    if (existingIndex >= 0) throw httpError("Não foi possível cadastrar: já existe um atleta com este e-mail.", 409);
    const record = {
      id: crypto.randomUUID(),
      tenantId,
      role: athlete.role,
      ...athlete,
      teamName: athlete.teamName || "",
      coachName: athlete.coachName || "",
      coachEmail: athlete.coachEmail || "",
      profileData: athlete.profileData || {},
      createdAt: new Date().toISOString()
    };
    athletes.unshift(record);
    writeJson(ATHLETES_FILE, athletes);
    return record;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingUser = await client.query(
      `SELECT u.id, u.role, ap.user_id AS athlete_profile_id
         FROM users u
         LEFT JOIN athlete_profiles ap ON ap.user_id = u.id
        WHERE u.tenant_id = $1 AND u.email = $2
        LIMIT 1`,
      [tenantId, athlete.email]
    );
    if (existingUser.rows[0]?.athlete_profile_id) {
      throw httpError("Não foi possível cadastrar: já existe um atleta com este e-mail.", 409);
    }
    let teamId = null;
    let coachId = null;
    if (athlete.teamName) {
      const teamResult = await client.query(
        `INSERT INTO teams (tenant_id, name)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id, name)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tenantId, athlete.teamName]
      );
      teamId = teamResult.rows[0].id;
    }
    if (athlete.coachEmail) {
      const coachResult = await client.query(
        `INSERT INTO users (tenant_id, role, name, email)
         VALUES ($1, 'coach', $2, $3)
         ON CONFLICT (tenant_id, email)
         DO UPDATE SET name = EXCLUDED.name,
                       role = CASE WHEN users.role = 'athlete' THEN users.role ELSE 'coach' END
         RETURNING id`,
        [tenantId, athlete.coachName || athlete.coachEmail, athlete.coachEmail]
      );
      coachId = coachResult.rows[0].id;
    }
    const passwordHash = athlete.password ?hashPassword(athlete.password) : null;
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, role, name, email, whatsapp, password_hash, profile_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET name = EXCLUDED.name,
                     whatsapp = EXCLUDED.whatsapp,
                     role = EXCLUDED.role,
                     password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
                     profile_data = EXCLUDED.profile_data
       RETURNING *`,
      [tenantId, athlete.role, athlete.name, athlete.email, athlete.whatsapp, passwordHash, JSON.stringify(athlete.profileData)]
    );
    const user = userResult.rows[0];
    await client.query(
      `INSERT INTO athlete_profiles (
         user_id, team_id, coach_user_id, age, weight_kg, height_cm,
         focus_distance_m, target_time_seconds, target_date, best_time_seconds,
         history_notes, history_timeline, tests_3000
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id)
       DO UPDATE SET team_id = EXCLUDED.team_id,
                     coach_user_id = EXCLUDED.coach_user_id,
                     age = EXCLUDED.age,
                     weight_kg = EXCLUDED.weight_kg,
                     height_cm = EXCLUDED.height_cm,
                     focus_distance_m = EXCLUDED.focus_distance_m,
                     target_time_seconds = EXCLUDED.target_time_seconds,
                     target_date = EXCLUDED.target_date,
                     best_time_seconds = EXCLUDED.best_time_seconds,
                     history_notes = EXCLUDED.history_notes,
                     history_timeline = EXCLUDED.history_timeline,
                     tests_3000 = EXCLUDED.tests_3000,
                     updated_at = now()`,
      [
        user.id,
        teamId,
        coachId,
        athlete.age,
        athlete.weightKg,
        athlete.heightCm,
        athlete.focusDistanceM,
        athlete.targetTimeSeconds,
        athlete.targetDate,
        athlete.bestTimeSeconds,
        athlete.historyNotes,
        JSON.stringify(athlete.historyTimeline),
        JSON.stringify(athlete.tests3000)
      ]
    );
    await client.query("COMMIT");
    await ensureTenantIntegrations(tenantId, user.id);
    return (await listAthletes(tenantId)).find((item) => item.id === user.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateAthlete(tenantId, athleteUserId, input, actorUser = null) {
  const athlete = validateAthlete(input, actorUser);
  if (!pool) {
    const athletes = readJson(ATHLETES_FILE, []);
    const index = athletes.findIndex((item) => String(item.id) === String(athleteUserId));
    if (index < 0) throw httpError("Atleta não encontrado.", 404);
    const duplicated = athletes.some((item) => String(item.id) !== String(athleteUserId) && item.email === athlete.email);
    if (duplicated) throw httpError("Não foi possível atualizar: já existe um atleta com este e-mail.", 409);
    athletes[index] = {
      ...athletes[index],
      ...athlete,
      role: athlete.role || athletes[index].role,
      teamName: athlete.teamName || "",
      coachName: athlete.coachName || "",
      coachEmail: athlete.coachEmail || "",
      profileData: athlete.profileData || {}
    };
    writeJson(ATHLETES_FILE, athletes);
    return athletes[index];
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT u.id, u.email, u.role, u.profile_data, ap.team_id, ap.coach_user_id
         FROM users u
         JOIN athlete_profiles ap ON ap.user_id = u.id
        WHERE u.tenant_id = $1 AND u.id = $2
        LIMIT 1`,
      [tenantId, athleteUserId]
    );
    if (!existing.rows[0]) throw httpError("Atleta não encontrado.", 404);
    const duplicate = await client.query(
      `SELECT id FROM users
        WHERE tenant_id = $1
          AND email = $2
          AND id <> $3
        LIMIT 1`,
      [tenantId, athlete.email, athleteUserId]
    );
    if (duplicate.rows[0]) throw httpError("Não foi possível atualizar: já existe um atleta com este e-mail.", 409);

    let teamId = null;
    let coachId = null;
    if (athlete.teamName) {
      const teamResult = await client.query(
        `INSERT INTO teams (tenant_id, name)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id, name)
         DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tenantId, athlete.teamName]
      );
      teamId = teamResult.rows[0].id;
    }
    if (athlete.coachEmail) {
      const coachResult = await client.query(
        `INSERT INTO users (tenant_id, role, name, email)
         VALUES ($1, 'coach', $2, $3)
         ON CONFLICT (tenant_id, email)
         DO UPDATE SET name = EXCLUDED.name,
                       role = CASE WHEN users.role = 'athlete' THEN users.role ELSE 'coach' END
         RETURNING id`,
        [tenantId, athlete.coachName || athlete.coachEmail, athlete.coachEmail]
      );
      coachId = coachResult.rows[0].id;
    }
    const isSelfAthleteUpdate = actorUser?.role === "athlete" && String(actorUser.id) === String(athleteUserId);
    if (isSelfAthleteUpdate) {
      teamId = existing.rows[0].team_id || null;
      coachId = existing.rows[0].coach_user_id || null;
      athlete.profileData = {
        ...parseJsonObject(existing.rows[0].profile_data),
        ...athlete.profileData
      };
    }
    const passwordHash = athlete.password ?hashPassword(athlete.password) : null;
    await client.query(
      `UPDATE users
          SET name = $1,
              email = $2,
              whatsapp = $3,
              role = CASE WHEN $4 THEN $5 ELSE role END,
              password_hash = COALESCE($6, password_hash),
              profile_data = $7
        WHERE tenant_id = $8 AND id = $9`,
      [athlete.name, athlete.email, athlete.whatsapp, actorUser?.role === "admin", athlete.role, passwordHash, JSON.stringify(athlete.profileData), tenantId, athleteUserId]
    );
    await client.query(
      `UPDATE athlete_profiles
          SET team_id = $1,
              coach_user_id = $2,
              age = $3,
              weight_kg = $4,
              height_cm = $5,
              focus_distance_m = $6,
              target_time_seconds = $7,
              target_date = $8,
              best_time_seconds = $9,
              history_notes = $10,
              history_timeline = $11,
              tests_3000 = $12,
              updated_at = now()
        WHERE user_id = $13`,
      [
        teamId,
        coachId,
        athlete.age,
        athlete.weightKg,
        athlete.heightCm,
        athlete.focusDistanceM,
        athlete.targetTimeSeconds,
        athlete.targetDate,
        athlete.bestTimeSeconds,
        athlete.historyNotes,
        JSON.stringify(athlete.historyTimeline),
        JSON.stringify(athlete.tests3000),
        athleteUserId
      ]
    );
    await client.query("COMMIT");
    await ensureTenantIntegrations(tenantId, athleteUserId);
    return (await listAthletes(tenantId)).find((item) => String(item.id) === String(athleteUserId));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteAthlete(tenantId, athleteUserId, actorUser) {
  if (!pool) {
    const athletes = readJson(ATHLETES_FILE, []);
    const target = athletes.find((item) => String(item.id) === String(athleteUserId));
    if (!target) throw httpError("Atleta não encontrado.", 404);
    writeJson(ATHLETES_FILE, athletes.filter((item) => String(item.id) !== String(athleteUserId)));
    return;
  }
  const existing = await query(
    `SELECT u.id, u.email, u.role
       FROM users u
       JOIN athlete_profiles ap ON ap.user_id = u.id
      WHERE u.tenant_id = $1 AND u.id = $2
      LIMIT 1`,
    [tenantId, athleteUserId]
  );
  const athlete = existing.rows[0];
  if (!athlete) throw httpError("Atleta não encontrado.", 404);
  if (String(athlete.email || "").toLowerCase() === DEFAULT_ADMIN_EMAIL || String(actorUser?.id) === String(athleteUserId)) {
    throw httpError("Não é possível excluir o usuário super admin ou o usuário logado.", 400);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM activities WHERE tenant_id = $1 AND athlete_user_id = $2", [tenantId, athleteUserId]);
    await client.query("DELETE FROM users WHERE tenant_id = $1 AND id = $2", [tenantId, athleteUserId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function formatGoal(row) {
  return {
    id: row.id,
    athleteUserId: row.athlete_user_id || row.athleteUserId,
    title: row.title || "",
    distanceM: Number(row.distance_m || row.distanceM || 0),
    targetTimeSeconds: Number(row.target_time_seconds || row.targetTimeSeconds || 0),
    targetTime: formatDuration(row.target_time_seconds || row.targetTimeSeconds || 0),
    raceDate: formatDateOnly(row.race_date || row.raceDate),
    notes: row.notes || "",
    actualTimeSeconds: row.actual_time_seconds || row.actualTimeSeconds || null,
    actualTime: row.actual_time_seconds || row.actualTimeSeconds ? formatDuration(row.actual_time_seconds || row.actualTimeSeconds) : "",
    resultNotes: row.result_notes || row.resultNotes || "",
    createdAt: row.created_at || row.createdAt || "",
    updatedAt: row.updated_at || row.updatedAt || ""
  };
}

function validateGoal(input) {
  const distanceM = Number(input.distanceM || input.distance_m || 0);
  const targetTimeSeconds = parseTimeToSeconds(input.targetTime || input.target_time || input.targetTimeSeconds);
  const raceDate = formatDateOnly(input.raceDate || input.race_date);
  const title = String(input.title || "").trim();
  if (!title) throw httpError("Informe o nome do objetivo.", 400);
  if (!distanceM) throw httpError("Selecione a prova do objetivo.", 400);
  if (!targetTimeSeconds) throw httpError("Informe um tempo alvo valido.", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) throw httpError("Informe a data da prova.", 400);
  return {
    title,
    distanceM,
    targetTimeSeconds,
    raceDate,
    notes: String(input.notes || "").trim(),
    actualTimeSeconds: parseTimeToSeconds(input.actualTime || input.actualTimeSeconds) || null,
    resultNotes: String(input.resultNotes || "").trim()
  };
}

async function listGoals(tenantId, athleteUserId) {
  if (!athleteUserId) return [];
  if (!pool) {
    return readJson(GOALS_FILE, [])
      .filter((goal) => String(goal.tenantId) === String(tenantId) && String(goal.athleteUserId) === String(athleteUserId))
      .map(formatGoal)
      .sort((a, b) => String(a.raceDate).localeCompare(String(b.raceDate)));
  }
  const result = await query(
    `SELECT *
       FROM athlete_goals
      WHERE tenant_id = $1 AND athlete_user_id = $2
      ORDER BY race_date ASC, created_at ASC`,
    [tenantId, athleteUserId]
  );
  return result.rows.map(formatGoal);
}

async function createGoal(tenantId, athleteUserId, input) {
  if (!athleteUserId) throw httpError("Selecione um atleta antes de criar objetivos.", 400);
  const goal = validateGoal(input);
  if (!pool) {
    const goals = readJson(GOALS_FILE, []);
    const record = {
      id: crypto.randomUUID(),
      tenantId,
      athleteUserId,
      title: goal.title,
      distanceM: goal.distanceM,
      targetTimeSeconds: goal.targetTimeSeconds,
      raceDate: goal.raceDate,
      notes: goal.notes,
      actualTimeSeconds: goal.actualTimeSeconds,
      resultNotes: goal.resultNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    goals.push(record);
    writeJson(GOALS_FILE, goals);
    return formatGoal(record);
  }
  const result = await query(
    `INSERT INTO athlete_goals
      (tenant_id, athlete_user_id, title, distance_m, target_time_seconds, race_date, notes, actual_time_seconds, result_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tenantId,
      athleteUserId,
      goal.title,
      goal.distanceM,
      goal.targetTimeSeconds,
      goal.raceDate,
      goal.notes,
      goal.actualTimeSeconds,
      goal.resultNotes
    ]
  );
  return formatGoal(result.rows[0]);
}

async function updateGoal(tenantId, athleteUserId, goalId, input) {
  if (!athleteUserId) throw httpError("Selecione um atleta antes de editar objetivos.", 400);
  const cleanGoalId = String(goalId || "").trim();
  if (!cleanGoalId) throw httpError("Objetivo invalido.", 400);
  const goal = validateGoal(input);
  if (!pool) {
    const goals = readJson(GOALS_FILE, []);
    const index = goals.findIndex((item) =>
      String(item.id) === cleanGoalId &&
      String(item.tenantId) === String(tenantId) &&
      String(item.athleteUserId) === String(athleteUserId)
    );
    if (index < 0) throw httpError("Objetivo nao encontrado.", 404);
    goals[index] = {
      ...goals[index],
      title: goal.title,
      distanceM: goal.distanceM,
      targetTimeSeconds: goal.targetTimeSeconds,
      raceDate: goal.raceDate,
      notes: goal.notes,
      actualTimeSeconds: goal.actualTimeSeconds,
      resultNotes: goal.resultNotes,
      updatedAt: new Date().toISOString()
    };
    writeJson(GOALS_FILE, goals);
    return formatGoal(goals[index]);
  }
  const result = await query(
    `UPDATE athlete_goals
        SET title = $4,
            distance_m = $5,
            target_time_seconds = $6,
            race_date = $7,
            notes = $8,
            actual_time_seconds = $9,
            result_notes = $10,
            updated_at = now()
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND id = $3
      RETURNING *`,
    [
      tenantId,
      athleteUserId,
      cleanGoalId,
      goal.title,
      goal.distanceM,
      goal.targetTimeSeconds,
      goal.raceDate,
      goal.notes,
      goal.actualTimeSeconds,
      goal.resultNotes
    ]
  );
  if (!result.rows[0]) throw httpError("Objetivo nao encontrado.", 404);
  return formatGoal(result.rows[0]);
}

async function deleteGoal(tenantId, athleteUserId, goalId) {
  if (!athleteUserId) throw httpError("Selecione um atleta antes de excluir objetivos.", 400);
  const cleanGoalId = String(goalId || "").trim();
  if (!cleanGoalId) throw httpError("Objetivo invalido.", 400);
  if (!pool) {
    const goals = readJson(GOALS_FILE, []);
    const next = goals.filter((item) =>
      !(String(item.id) === cleanGoalId &&
        String(item.tenantId) === String(tenantId) &&
        String(item.athleteUserId) === String(athleteUserId))
    );
    if (next.length === goals.length) throw httpError("Objetivo nao encontrado.", 404);
    writeJson(GOALS_FILE, next);
    return;
  }
  const result = await query(
    `DELETE FROM athlete_goals
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND id = $3
      RETURNING id`,
    [tenantId, athleteUserId, cleanGoalId]
  );
  if (!result.rows[0]) throw httpError("Objetivo nao encontrado.", 404);
}

async function getIntegrations(tenantId, athleteUserId = null) {
  if (!pool) return readJson(INTEGRATIONS_FILE, defaultIntegrations());
  await ensureTenantIntegrations(tenantId, athleteUserId);
  const globalRows = athleteUserId
    ?await query(
        `SELECT provider, credentials
           FROM integrations
          WHERE tenant_id = $1 AND athlete_user_id IS NULL`,
        [tenantId]
      )
    : { rows: [] };
  const result = await query(
    `SELECT provider, enabled, connected, credentials, token, athlete, oauth_state
       FROM integrations
      WHERE tenant_id = $1 AND athlete_user_id IS NOT DISTINCT FROM $2`,
    [tenantId, athleteUserId]
  );
  const defaults = defaultIntegrations();
  for (const row of globalRows.rows) {
    if (!defaults[row.provider]) continue;
    defaults[row.provider].credentials = mergeCredentials(defaults[row.provider].credentials, row.credentials || {});
  }
  for (const row of result.rows) {
    defaults[row.provider] = {
      ...defaults[row.provider],
      enabled: row.enabled,
      connected: row.connected,
      credentials: mergeCredentials(defaults[row.provider].credentials, row.credentials || {}),
      token: row.token,
      athlete: row.athlete,
      oauthState: row.oauth_state
    };
  }
  return defaults;
}

async function saveIntegration(tenantId, athleteUserId, provider, patch) {
  const integrations = await getIntegrations(tenantId, athleteUserId);
  if (!integrations[provider]) throw new Error("Fonte desconhecida.");
  const next = integrations[provider];
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  mergeDefined(next.credentials, patch.credentials || {});
  if (patch.connected !== undefined) next.connected = Boolean(patch.connected);
  if (patch.token !== undefined) next.token = patch.token;
  if (patch.athlete !== undefined) next.athlete = patch.athlete;
  if (patch.oauthState !== undefined) next.oauthState = patch.oauthState;

  if (!pool) {
    integrations[provider] = next;
    writeJson(INTEGRATIONS_FILE, integrations);
    return next;
  }

  const existing = await query(
    `SELECT id FROM integrations
      WHERE tenant_id = $1
        AND athlete_user_id IS NOT DISTINCT FROM $2
        AND provider = $3
      LIMIT 1`,
    [tenantId, athleteUserId, provider]
  );

  if (existing.rows[0]) {
    await query(
      `UPDATE integrations
          SET enabled = $1,
              connected = $2,
              credentials = $3,
              token = $4,
              athlete = $5,
              oauth_state = $6,
              updated_at = now()
        WHERE id = $7`,
      [
        next.enabled,
        next.connected,
        JSON.stringify(next.credentials || {}),
        next.token ?JSON.stringify(next.token) : null,
        next.athlete ?JSON.stringify(next.athlete) : null,
        next.oauthState || null,
        existing.rows[0].id
      ]
    );
    return next;
  }

  await query(
    `INSERT INTO integrations (tenant_id, athlete_user_id, provider, enabled, connected, credentials, token, athlete, oauth_state, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
    [
      tenantId,
      athleteUserId,
      provider,
      next.enabled,
      next.connected,
      JSON.stringify(next.credentials || {}),
      next.token ?JSON.stringify(next.token) : null,
      next.athlete ?JSON.stringify(next.athlete) : null,
      next.oauthState || null
    ]
  );
  return next;
}

function activityRowToApi(row) {
  const raw = parseJsonObject(row.raw);
  const analysis = calculateRunAnalysis(raw, row);
  const feedback = raw.feedback || {};
  const trainingType = normalizeTrainingType(raw.trainingType || feedback.trainingType || inferTrainingTypeFromActivity(raw));
  const perceivedExertion = raw.perceivedExertion ?? raw.perceived_exertion ?? feedback.perceivedExertion ?? "";
  const movingTimeSeconds = safeNumber(raw.moving_time, raw.elapsed_time);
  const distanceMeters = safeNumber(raw.distance);
  const bestEfforts = Array.isArray(raw.best_efforts)
    ?raw.best_efforts.map((effort) => ({
        name: effort.name || "",
        distanceMeters: safeNumber(effort.distance),
        elapsedTimeSeconds: safeNumber(effort.elapsed_time, effort.moving_time),
        movingTimeSeconds: safeNumber(effort.moving_time, effort.elapsed_time),
        startDate: effort.start_date || raw.start_date || ""
      })).filter((effort) => effort.distanceMeters && effort.elapsedTimeSeconds)
    : [];
  return {
    id: `${row.provider}-${row.provider_activity_id}`,
    providerId: row.provider_activity_id,
    date: row.activity_date_key || formatDateOnly(row.activity_date),
    title: row.title,
    source: row.provider,
    type: row.type || "",
    description: row.description || "",
    distance: row.distance || "",
    duration: row.duration || "",
    pace: row.pace || "",
    load: row.load || "",
    externalUrl: row.external_url || "",
    distanceMeters,
    movingTimeSeconds,
    elapsedTimeSeconds: safeNumber(raw.elapsed_time, raw.moving_time),
    averageSpeed: safeNumber(raw.average_speed),
    bestEfforts,
    analysis,
    feedback,
    trainingType,
    perceivedExertion,
    is3000Test: Boolean(raw?.flags?.is3000Test)
  };
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ?parsed : {};
  } catch {
    return {};
  }
}

function safeNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

const TRAINING_TYPE_OPTIONS = ["Treino", "Longo", "Recuperação", "Prova", "Teste"];

function normalizeTrainingType(value, fallback = "Treino") {
  const text = String(value || "").trim();
  return TRAINING_TYPE_OPTIONS.includes(text) ?text : fallback;
}

function normalizeOptionalNumber(value, min, max) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return clamp(number, min, max);
}

function inferTrainingTypeFromActivity(activity = {}) {
  const text = `${activity.name || ""} ${activity.title || ""} ${activity.description || ""}`.toLowerCase();
  const type = String(activity.sport_type || activity.type || "").toLowerCase();
  const distanceKm = safeNumber(activity.distance) / 1000;
  if (text.includes("prova") || text.includes("race") || activity.workout_type === 1) return "Prova";
  if (text.includes("teste") || text.includes("test") || text.includes("3000") || text.includes("3km")) return "Teste";
  if (text.includes("recuper") || text.includes("regener") || text.includes("leve")) return "Recuperação";
  if (text.includes("longo") || distanceKm >= 14) return "Longo";
  if (/run|corrida/i.test(type)) return "Treino";
  return "Treino";
}

function splitRunSignals(activity) {
  const streamSpeeds = activity.streams?.velocity_smooth?.data;
  if (Array.isArray(streamSpeeds) && streamSpeeds.length >= 8) {
    const speeds = streamSpeeds
      .map((speed) => safeNumber(speed))
      .filter((speed) => speed > 0);
    const mean = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
    const variance = speeds.reduce((sum, speed) => sum + ((speed - mean) ** 2), 0) / speeds.length;
    const fastest = Math.max(...speeds);
    return {
      splitCount: speeds.length,
      variability: mean ?Math.sqrt(variance) / mean : 0,
      fastestRatio: mean ?fastest / mean : 1,
      fastestPace: formatPace(1000, 1000 / fastest)
    };
  }

  const splits = Array.isArray(activity.splits_metric) ?activity.splits_metric : [];
  const speeds = splits
    .map((split) => safeNumber(split.average_speed) || (safeNumber(split.distance) / safeNumber(split.moving_time)))
    .filter((speed) => Number.isFinite(speed) && speed > 0);

  if (speeds.length < 2) {
    return { splitCount: speeds.length, variability: 0, fastestRatio: 1, fastestPace: "" };
  }

  const mean = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
  const variance = speeds.reduce((sum, speed) => sum + ((speed - mean) ** 2), 0) / speeds.length;
  const fastest = Math.max(...speeds);
  return {
    splitCount: speeds.length,
    variability: mean ?Math.sqrt(variance) / mean : 0,
    fastestRatio: mean ?fastest / mean : 1,
    fastestPace: formatPace(1000, 1000 / fastest)
  };
}

function classifyRunAnalysis({ durationMinutes, distanceKm, elevationPerKm, variability, fastestRatio, hrIntensity, aggressionScore }) {
  if (distanceKm >= 14 || durationMinutes >= 75) {
    if (fastestRatio >= 1.25 || variability >= 0.16) return "Longo com variação forte";
    return "Longo de resistencia";
  }
  if (elevationPerKm >= 18) return "Subida e forca especifica";
  if (fastestRatio >= 1.35 || variability >= 0.22) return "Intervalado / picos intensos";
  if (hrIntensity >= 0.92 || aggressionScore >= 85) return "Tempo / limiar";
  if (durationMinutes <= 45 && aggressionScore <= 45) return "Regenerativo / leve";
  return "Rodagem controlada";
}

function calculateRunAnalysis(activity = {}, row = {}) {
  const type = String(activity.sport_type || activity.type || row.type || "Run");
  const isRun = /run/i.test(type);
  const movingTime = safeNumber(activity.moving_time, activity.elapsed_time);
  const distanceMeters = safeNumber(activity.distance);
  const durationMinutes = movingTime ?movingTime / 60 : 0;
  const durationHours = durationMinutes / 60;
  const distanceKm = distanceMeters ?distanceMeters / 1000 : 0;
  const elevationGain = safeNumber(activity.total_elevation_gain);
  const elevationPerKm = distanceKm ?elevationGain / distanceKm : 0;
  const avgHr = safeNumber(activity.average_heartrate);
  const maxHr = safeNumber(activity.max_heartrate);
  const relativeEffort = safeNumber(activity.suffer_score, activity.relative_effort);
  const thresholdHr = safeNumber(process.env.RUN_THRESHOLD_HR, process.env.DEFAULT_THRESHOLD_HR, 170);
  const { splitCount, variability, fastestRatio, fastestPace } = splitRunSignals(activity);

  const hrIntensity = avgHr ?clamp(avgHr / thresholdHr, 0.45, 1.28) : 0;
  const hrTss = durationHours && hrIntensity ?durationHours * (hrIntensity ** 2) * 100 : 0;
  const durationTss = durationHours ?durationHours * 62 : 0;
  const stravaTss = relativeEffort ?relativeEffort * 1.08 : 0;
  const spikeBonus = clamp(((fastestRatio - 1.12) * 38) + (variability * 72), 0, 42);
  const elevationBonus = clamp(elevationPerKm * 0.16, 0, 18);
  const maxHrBonus = maxHr && thresholdHr ?clamp(((maxHr / thresholdHr) - 1) * 45, 0, 24) : 0;
  const baseTss = Math.max(hrTss, stravaTss, durationTss);
  const tss = Math.round(clamp(baseTss + spikeBonus + elevationBonus + maxHrBonus, 1, 320));
  const aggressionScore = Math.round(clamp(
    (tss * 0.72) + (spikeBonus * 1.2) + (relativeEffort ?relativeEffort * 0.18 : 0) + elevationBonus,
    1,
    100
  ));
  const characteristic = classifyRunAnalysis({
    durationMinutes,
    distanceKm,
    elevationPerKm,
    variability,
    fastestRatio,
    hrIntensity,
    aggressionScore
  });

  return {
    standard: "11TSS Advance",
    isRun,
    tss,
    aggressionScore,
    characteristic,
    intensityFactor: hrIntensity ?hrIntensity.toFixed(2) : "",
    relativeEffort: relativeEffort ?Math.round(relativeEffort) : "",
    splitCount,
    splitVariability: `${Math.round(variability * 100)}%`,
    fastestRatio: fastestRatio ?fastestRatio.toFixed(2) : "",
    fastestPace,
    elevationPerKm: distanceKm ?`${Math.round(elevationPerKm)} m/km` : "",
    note: isRun
      ?"Estimativa proprietária para corrida baseada em Strava, FC, duração, elevação e variação dos splits."
      : "Atividade fora do escopo principal de corrida."
  };
}

function formatDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const text = String(value || "").trim();
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brDate) {
    return `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
}

async function listActivities(tenantId, athleteUserId = null) {
  if (!pool) {
    return readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES).map((activity) => ({
      ...activity,
      is3000Test: Boolean(activity?.is3000Test || activity?.raw?.flags?.is3000Test)
    }));
  }
  const params = athleteUserId ?[tenantId, athleteUserId] : [tenantId];
  const result = await query(
    `SELECT provider,
            provider_activity_id,
            activity_date,
            to_char(activity_date, 'YYYY-MM-DD') AS activity_date_key,
            title,
            type,
            description,
            distance,
            duration,
            pace,
            load,
            external_url,
            raw
       FROM activities
      WHERE tenant_id = $1
        ${athleteUserId ?"AND athlete_user_id = $2" : ""}
      ORDER BY activity_date ASC`,
    params
  );
  return result.rows.map(activityRowToApi);
}

async function flagActivityAs3000Test(tenantId, athleteUserId, activityId, enabled) {
  const cleanActivityId = String(activityId || "").trim();
  if (!cleanActivityId) throw httpError("Atividade inválida.", 400);
  const cleanEnabled = Boolean(enabled);

  if (!pool) {
    const activities = readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES);
    const index = activities.findIndex((item) => String(item.id) === cleanActivityId);
    if (index < 0) throw httpError("Atividade não encontrada para este atleta.", 404);
    const item = activities[index];
    if (athleteUserId && String(item.athleteUserId || "") !== String(athleteUserId)) {
      throw httpError("Atividade não encontrada para este atleta.", 404);
    }
    activities[index] = {
      ...item,
      is3000Test: cleanEnabled,
      raw: {
        ...(item.raw || {}),
        flags: {
          ...((item.raw || {}).flags || {}),
          is3000Test: cleanEnabled
        }
      }
    };
    writeJson(ACTIVITIES_FILE, activities);
    return listActivities(tenantId, athleteUserId);
  }

  const separator = cleanActivityId.indexOf("-");
  if (separator < 0) throw httpError("Identificador de atividade inválido.", 400);
  const provider = cleanActivityId.slice(0, separator);
  const providerActivityId = cleanActivityId.slice(separator + 1);
  if (!provider || !providerActivityId) throw httpError("Identificador de atividade inválido.", 400);

  const updated = await query(
    `UPDATE activities
        SET raw = jsonb_set(
                  COALESCE(raw, '{}'::jsonb),
                  '{flags,is3000Test}',
                  to_jsonb($5::boolean),
                  true
                ),
            updated_at = now()
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND lower(provider) = lower($3)
        AND provider_activity_id = $4
      RETURNING provider_activity_id`,
    [tenantId, athleteUserId, provider, providerActivityId, cleanEnabled]
  );
  if (!updated.rows[0]) throw httpError("Atividade não encontrada para este atleta.", 404);
  return listActivities(tenantId, athleteUserId);
}

async function updateActivityFeedback(tenantId, athleteUserId, activityId, feedback) {
  const cleanActivityId = String(activityId || "").trim();
  if (!cleanActivityId) throw httpError("Atividade inválida.", 400);
  const performancePercent = normalizeOptionalNumber(feedback.performancePercent, 0, 100);
  const painScore = normalizeOptionalNumber(feedback.painScore, 0, 10);
  const perceivedExertion = normalizeOptionalNumber(feedback.perceivedExertion, 0, 10);
  const trainingType = normalizeTrainingType(feedback.trainingType);
  const description = String(feedback.description || "").trim();
  if ((feedback.performancePercent !== "" && feedback.performancePercent != null && performancePercent == null)
    || (feedback.painScore !== "" && feedback.painScore != null && painScore == null)
    || (feedback.perceivedExertion !== "" && feedback.perceivedExertion != null && perceivedExertion == null)) {
    throw httpError("Percepção inválida.", 400);
  }

  if (!pool) {
    const activities = readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES);
    const index = activities.findIndex((item) => String(item.id) === cleanActivityId);
    if (index < 0) throw httpError("Atividade não encontrada para este atleta.", 404);
    const item = activities[index];
    if (athleteUserId && String(item.athleteUserId || "") !== String(athleteUserId)) {
      throw httpError("Atividade não encontrada para este atleta.", 404);
    }
    activities[index] = {
      ...item,
      description: description || item.description || "",
      trainingType,
      perceivedExertion,
      feedback: { performancePercent, painScore, perceivedExertion, trainingType },
      raw: {
        ...(item.raw || {}),
        description: description || (item.raw || {}).description,
        trainingType,
        perceivedExertion,
        feedback: { performancePercent, painScore, perceivedExertion, trainingType }
      }
    };
    writeJson(ACTIVITIES_FILE, activities);
    return listActivities(tenantId, athleteUserId);
  }

  const separator = cleanActivityId.indexOf("-");
  if (separator < 0) throw httpError("Identificador de atividade inválido.", 400);
  const provider = cleanActivityId.slice(0, separator);
  const providerActivityId = cleanActivityId.slice(separator + 1);
  if (!provider || !providerActivityId) throw httpError("Identificador de atividade inválido.", 400);

  const updated = await query(
    `UPDATE activities
        SET description = CASE WHEN $9::text <> '' THEN $9::text ELSE description END,
            raw = jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        COALESCE(raw, '{}'::jsonb),
                        '{feedback}',
                        jsonb_build_object(
                          'performancePercent', $5::int,
                          'painScore', $6::int,
                          'perceivedExertion', $7::numeric,
                          'trainingType', $8::text
                        ),
                        true
                      ),
                      '{trainingType}',
                      to_jsonb($8::text),
                      true
                    ),
                    '{perceivedExertion}',
                    COALESCE(to_jsonb($7::numeric), 'null'::jsonb),
                    true
                  ),
            updated_at = now()
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND lower(provider) = lower($3)
        AND provider_activity_id = $4
      RETURNING provider_activity_id`,
    [tenantId, athleteUserId, provider, providerActivityId, performancePercent, painScore, perceivedExertion, trainingType, description]
  );
  if (!updated.rows[0]) throw httpError("Atividade não encontrada para este atleta.", 404);
  return listActivities(tenantId, athleteUserId);
}

async function resolveAthleteIdFromActivity(tenantId, activityId) {
  const cleanActivityId = String(activityId || "").trim();
  if (!cleanActivityId) return "";
  if (!pool) {
    const activities = readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES);
    const found = activities.find((item) => String(item.id) === cleanActivityId);
    return String(found?.athleteUserId || "");
  }
  const separator = cleanActivityId.indexOf("-");
  if (separator < 0) return "";
  const provider = cleanActivityId.slice(0, separator);
  const providerActivityId = cleanActivityId.slice(separator + 1);
  if (!provider || !providerActivityId) return "";
  const result = await query(
    `SELECT athlete_user_id
       FROM activities
      WHERE tenant_id = $1
        AND lower(provider) = lower($2)
        AND provider_activity_id = $3
      LIMIT 1`,
    [tenantId, provider, providerActivityId]
  );
  return String(result.rows[0]?.athlete_user_id || "");
}

async function upsertActivities(tenantId, athleteUserId, importedActivities) {
  if (!pool) {
    const existing = readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES);
    const byId = new Map(existing.map((activity) => [String(activity.id), activity]));
    for (const activity of importedActivities) {
      const current = byId.get(String(activity.id));
      const is3000Test = Boolean(current?.is3000Test || current?.raw?.flags?.is3000Test);
      byId.set(String(activity.id), {
        ...activity,
        is3000Test,
        feedback: current?.feedback || current?.raw?.feedback || activity.feedback || {},
        raw: {
          ...(activity.raw || {}),
          feedback: current?.raw?.feedback || current?.feedback || activity.feedback || {},
          flags: {
            ...((activity.raw || {}).flags || {}),
            ...(is3000Test ?{ is3000Test: true } : {})
          }
        }
      });
    }
    const next = [...byId.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    writeJson(ACTIVITIES_FILE, next);
    return next;
  }

  for (const activity of importedActivities) {
    await query(
      `INSERT INTO activities (
         tenant_id, athlete_user_id, provider, provider_activity_id, activity_date, title, type,
         description, distance, duration, pace, load, external_url, raw, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
       ON CONFLICT (tenant_id, provider, provider_activity_id)
       DO UPDATE SET athlete_user_id = EXCLUDED.athlete_user_id,
                     activity_date = EXCLUDED.activity_date,
                     title = EXCLUDED.title,
                     type = EXCLUDED.type,
                     description = CASE
                       WHEN activities.raw->>'resource_state' = '3'
                        AND COALESCE(EXCLUDED.raw->>'resource_state', '') <> '3'
                       THEN activities.description
                       ELSE EXCLUDED.description
                     END,
                     distance = EXCLUDED.distance,
                     duration = EXCLUDED.duration,
                     pace = EXCLUDED.pace,
                     load = EXCLUDED.load,
                     external_url = EXCLUDED.external_url,
                     raw = CASE
                       WHEN activities.raw->>'resource_state' = '3'
                        AND COALESCE(EXCLUDED.raw->>'resource_state', '') <> '3'
                       THEN activities.raw
                       ELSE jsonb_set(
                         jsonb_set(
                           EXCLUDED.raw,
                           '{flags}',
                           COALESCE(activities.raw->'flags', '{}'::jsonb) || COALESCE(EXCLUDED.raw->'flags', '{}'::jsonb),
                           true
                         ),
                         '{feedback}',
                         COALESCE(activities.raw->'feedback', EXCLUDED.raw->'feedback', '{}'::jsonb),
                         true
                       )
                     END,
                     updated_at = now()`,
      [
        tenantId,
        athleteUserId,
        activity.source,
        activity.providerId || activity.id,
        activity.date,
        activity.title,
        activity.type,
        activity.description,
        activity.distance,
        activity.duration,
        activity.pace,
        activity.load,
        activity.externalUrl,
        JSON.stringify(activity.raw || activity)
      ]
    );
  }
  return listActivities(tenantId, athleteUserId);
}

function parseDistanceToMeters(value) {
  const text = String(value || "").replace(",", ".").trim();
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return 0;
  return /m\b/i.test(text) && !/km/i.test(text) ?Math.round(number) : Math.round(number * 1000);
}

async function createManualActivities(tenantId, athleteUserId, mode, activities) {
  if (!athleteUserId) throw httpError("Selecione um atleta antes de cadastrar treinos.", 400);
  const sourceMode = String(mode || "single").trim() || "single";
  const rows = Array.isArray(activities) ?activities : [];
  const now = Date.now();
  const mapped = rows.map((activity, index) => {
    const date = formatDateOnly(activity.date || new Date());
    if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      throw httpError("Informe uma data válida para todos os treinos.", 400);
    }
    const distanceMeters = parseDistanceToMeters(activity.distance);
    const durationSeconds = parseTimeToSeconds(activity.duration || activity.time || "") || 0;
    const raw = {
      manual: true,
      mode: sourceMode,
      distance: distanceMeters,
      moving_time: durationSeconds,
      elapsed_time: durationSeconds,
      description: String(activity.description || "").trim(),
      trainingType: normalizeTrainingType(activity.trainingType),
      perceivedExertion: normalizeOptionalNumber(activity.perceivedExertion, 0, 10)
    };
    const analysis = calculateRunAnalysis(raw);
    return {
      id: `manual-${now}-${index}`,
      providerId: `${now}-${index}`,
      date,
      title: String(activity.title || `Treino ${index + 1}`).trim(),
      source: "Manual",
      type: "Run",
      description: raw.description || "Treino cadastrado manualmente.",
      distance: activity.distance || formatDistance(distanceMeters),
      duration: durationSeconds ?formatDuration(durationSeconds) : "",
      pace: durationSeconds && distanceMeters ?formatPace(distanceMeters, durationSeconds) : "",
      load: String(analysis.aggressionScore || ""),
      externalUrl: "",
      raw,
      analysis
    };
  }).filter((activity) => activity.title || activity.description);

  if (!mapped.length) throw httpError("Informe pelo menos um treino.", 400);
  return upsertActivities(tenantId, athleteUserId, mapped);
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatDistance(meters) {
  return `${(Number(meters || 0) / 1000).toFixed(1)} km`;
}

function formatPace(meters, seconds) {
  if (!meters || !seconds) return "--";
  const pace = Number(seconds) / (Number(meters) / 1000);
  const minutes = Math.floor(pace / 60);
  const secs = Math.round(pace % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}/km`;
}

function estimateLoad(activity) {
  const analysis = calculateRunAnalysis(activity);
  return String(analysis.aggressionScore || Math.max(1, Math.round(Number(activity.moving_time || activity.elapsed_time || 0) / 60)));
}

function normalizeScopes(scopeValue) {
  return String(scopeValue || "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function hasStravaActivityScope(scopeValue) {
  const scopes = normalizeScopes(scopeValue);
  return STRAVA_REQUIRED_ACTIVITY_SCOPES.some((scope) => scopes.includes(scope));
}

function encodeStravaState(tenantSlug, athleteUserId, nonce) {
  return Buffer.from(JSON.stringify({ tenant: tenantSlug, athlete: athleteUserId, nonce })).toString("base64url");
}

function decodeStravaState(value) {
  try {
    const parsed = JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
    if (parsed && parsed.nonce) return parsed;
  } catch {
    // Older OAuth attempts used the raw nonce as the state value.
  }
  return { nonce: value || "" };
}

function mapStravaActivity(activity) {
  const date = new Date(activity.start_date_local || activity.start_date);
  const analysis = calculateRunAnalysis(activity);
  const stravaDescription = String(activity.description || "").trim();
  const trainingType = inferTrainingTypeFromActivity(activity);
  const perceivedExertion = activity.perceived_exertion ?? activity.perceivedExertion ?? "";
  return {
    id: `strava-${activity.id}`,
    providerId: String(activity.id),
    date: Number.isNaN(date.getTime()) ?new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10),
    title: activity.name || "Atividade Strava",
    source: "Strava",
    type: activity.sport_type || activity.type || "Run",
    description: [
      stravaDescription,
      activity.total_elevation_gain ?`Elevação ${Math.round(activity.total_elevation_gain)} m` : "",
      activity.average_heartrate ?`FC média ${Math.round(activity.average_heartrate)} bpm` : ""
    ].filter(Boolean).join(" | ") || "Atividade importada do Strava.",
    distance: formatDistance(activity.distance),
    duration: formatDuration(activity.moving_time || activity.elapsed_time),
    load: String(analysis.aggressionScore),
    pace: formatPace(activity.distance, activity.moving_time || activity.elapsed_time),
    externalUrl: `https://www.strava.com/activities/${activity.id}`,
    raw: { ...activity, trainingType, perceivedExertion },
    analysis
  };
}

async function getValidStravaToken(tenantId, athleteUserId, integration) {
  if (!integration.token?.access_token) {
    throw new Error("Strava ainda não foi conectado. Salve as credenciais e clique em Conectar Strava.");
  }

  const expiresAt = Number(integration.token.expires_at || 0);
  if (expiresAt > Math.floor(Date.now() / 1000) + 60) return integration.token.access_token;

  const credentials = integration.credentials || {};
  if (!credentials.clientId || !credentials.clientSecret || !integration.token.refresh_token) {
    throw new Error("Credenciais ou refresh token do Strava ausentes.");
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    refresh_token: integration.token.refresh_token,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Falha ao renovar token Strava: HTTP ${response.status}.`);

  integration.token = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || integration.token.refresh_token,
    expires_at: payload.expires_at,
    scope: integration.token.scope
  };
  await saveIntegration(tenantId, athleteUserId, "strava", { token: integration.token });
  return payload.access_token;
}

async function stravaFetchJson(pathname, tenantId, athleteUserId, integration) {
  const token = await getValidStravaToken(tenantId, athleteUserId, integration);
  const response = await fetch(`https://www.strava.com/api/v3${pathname}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Strava respondeu HTTP ${response.status}.`);
  return payload;
}

async function syncStrava(tenantId, athleteUserId, days) {
  const integrations = await getIntegrations(tenantId, athleteUserId);
  const integration = integrations.strava;
  if (!integration.token?.access_token) {
    throw new Error(`Strava ainda não foi conectado para este atleta. Selecione o atleta correto ou clique em Conectar Strava novamente.`);
  }
  if (!hasStravaActivityScope(integration.token.scope)) {
    throw new Error("O token Strava deste atleta não possui activity:read/activity:read_all. Clique em Conectar Strava e aprove os escopos solicitados.");
  }
  const now = Math.floor(Date.now() / 1000);
  const after = now - Number(days || 30) * 24 * 60 * 60;
  const activities = [];

  for (let page = 1; page <= 5; page += 1) {
    const queryParams = new URLSearchParams({
      after: String(after),
      before: String(now),
      page: String(page),
      per_page: "100"
    });
    const batch = await stravaFetchJson(`/athlete/activities?${queryParams}`, tenantId, athleteUserId, integration);
    activities.push(...batch.map(mapStravaActivity));
    if (batch.length < 100) break;
  }

  await upsertActivities(tenantId, athleteUserId, activities);
  return activities;
}

async function enrichStravaActivityDetails(tenantId, athleteUserId, limit = 8) {
  if (!pool) return { updated: 0, remaining: 0, activities: readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES) };
  const integrations = await getIntegrations(tenantId, athleteUserId);
  const integration = integrations.strava;
  if (!integration.token?.access_token) {
    throw new Error("Strava ainda não foi conectado para este atleta.");
  }
  if (!hasStravaActivityScope(integration.token.scope)) {
    throw new Error("O token Strava deste atleta não possui activity:read/activity:read_all.");
  }

  const remainingBefore = await query(
    `SELECT COUNT(*)::int AS total
       FROM activities
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND provider = 'Strava'
        AND (
          COALESCE(raw->>'resource_state', '') <> '3'
          OR raw->'streams' IS NULL
        )`,
    [tenantId, athleteUserId]
  );
  const remaining = Number(remainingBefore.rows[0]?.total || 0);
  if (!remaining) {
    return { updated: 0, remaining: 0, activities: await listActivities(tenantId, athleteUserId) };
  }

  const rows = await query(
    `SELECT provider_activity_id
       FROM activities
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND provider = 'Strava'
        AND (
          COALESCE(raw->>'resource_state', '') <> '3'
          OR raw->'streams' IS NULL
        )
      ORDER BY activity_date DESC
      LIMIT $3`,
    [tenantId, athleteUserId, Math.max(1, Math.min(Number(limit) || 8, 12))]
  );

  const detailed = [];
  for (const row of rows.rows) {
    try {
      const detail = await stravaFetchJson(`/activities/${row.provider_activity_id}?include_all_efforts=false`, tenantId, athleteUserId, integration);
      if (/run/i.test(String(detail.sport_type || detail.type || ""))) {
        try {
          detail.streams = await stravaFetchJson(`/activities/${row.provider_activity_id}/streams?keys=time,distance,velocity_smooth,heartrate&key_by_type=true`, tenantId, athleteUserId, integration);
        } catch (streamError) {
          console.warn(`Não foi possível buscar streams Strava ${row.provider_activity_id}: ${streamError.message}`);
        }
      }
      detailed.push(mapStravaActivity(detail));
    } catch (error) {
      console.warn(`Não foi possível detalhar atividade Strava ${row.provider_activity_id}: ${error.message}`);
    }
  }
  if (detailed.length) await upsertActivities(tenantId, athleteUserId, detailed);

  const remainingAfter = await query(
    `SELECT COUNT(*)::int AS total
       FROM activities
      WHERE tenant_id = $1
        AND athlete_user_id = $2
        AND provider = 'Strava'
        AND (
          COALESCE(raw->>'resource_state', '') <> '3'
          OR raw->'streams' IS NULL
        )`,
    [tenantId, athleteUserId]
  );
  return {
    updated: detailed.length,
    remaining: Number(remainingAfter.rows[0]?.total || 0),
    activities: await listActivities(tenantId, athleteUserId)
  };
}

async function testStravaConnection(tenantId, athleteUserId) {
  const integrations = await getIntegrations(tenantId, athleteUserId);
  const integration = integrations.strava;
  if (!integration.enabled) throw new Error("Ative a fonte Strava antes de testar.");
  if (!integration.credentials?.clientId || !integration.credentials?.clientSecret) {
    throw new Error("Client ID e Client Secret do Strava não foram salvos para este atleta.");
  }
  if (!integration.token?.access_token) {
    throw new Error("Este atleta ainda não concluiu o OAuth do Strava.");
  }
  if (!hasStravaActivityScope(integration.token.scope)) {
    throw new Error("OAuth Strava conectado sem escopo de atividades. Reconecte aprovando activity:read ou activity:read_all.");
  }
  const athlete = await stravaFetchJson("/athlete", tenantId, athleteUserId, integration);
  return {
    ok: true,
    athlete,
    scope: integration.token.scope || "",
    connected: true
  };
}

function openaiTextFromResponse(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks = [];
  const visit = (value, parentKey = "") => {
    if (value == null) return;
    if (typeof value === "string") {
      const key = String(parentKey || "").toLowerCase();
      if (["text", "output_text", "content"].includes(key) && value.trim()) chunks.push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, parentKey));
      return;
    }
    if (typeof value !== "object") return;
    if (typeof value.text === "string" && value.text.trim()) chunks.push(value.text.trim());
    if (value.text && typeof value.text === "object" && typeof value.text.value === "string" && value.text.value.trim()) {
      chunks.push(value.text.value.trim());
    }
    if (typeof value.output_text === "string" && value.output_text.trim()) chunks.push(value.output_text.trim());
    Object.entries(value).forEach(([key, nested]) => {
      if (["id", "object", "model", "status", "role", "type"].includes(key)) return;
      visit(nested, key);
    });
  };
  visit(payload);
  return [...new Set(chunks)].join("\n").trim();
}

async function callOpenAiResponse(apiKey, model, prompt, maxOutputTokens = 420) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: maxOutputTokens
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(payload.error?.message || `OpenAI respondeu HTTP ${response.status}.`, response.status);
  }
  return {
    payload,
    text: openaiTextFromResponse(payload)
  };
}

async function generateAiProjection(tenantId, input = {}) {
  const settings = await getRawAppSettings(tenantId);
  const apiKey = settings.openai_api_key || settings.openaiApiKey || process.env.OPENAI_API_KEY || "";
  const model = settings.openai_model || settings.openaiModel || DEFAULT_OPENAI_MODEL;
  const enabled = Boolean(settings.openai_enabled || settings.openaiEnabled || process.env.OPENAI_API_KEY);
  if (!enabled || !apiKey) {
    return {
      ok: false,
      model,
      text: "IA externa não configurada. A probabilidade exibida usa o modelo local 11RUN com volume, 11TSS, consistência, testes de 3000 m, histórico e distância até a prova."
    };
  }

  const prompt = [
    "Voce e um cientista de performance em corrida. Analise apenas corrida, nunca ciclismo.",
    "Responda em portugues do Brasil, com tom tecnico, curto e acionavel.",
    "Não invente dados. Use a probabilidade local como âncora e ajuste apenas se os sinais justificarem.",
    "Inclua: probabilidade em %, principais fatores, riscos e uma recomendacao objetiva.",
    "Dados estruturados:",
    JSON.stringify(input, null, 2)
  ].join("\n");

  const aiResult = await callOpenAiResponse(apiKey, model, prompt, 520);
  return {
    ok: true,
    model,
    text: aiResult.text || "A IA respondeu sem texto extraível. Verifique se o modelo configurado suporta saída textual na Responses API."
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 420
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(payload.error?.message || `OpenAI respondeu HTTP ${response.status}.`, response.status);
  }
  return {
    ok: true,
    model,
    text: openaiTextFromResponse(payload) || "A IA não retornou texto para esta análise."
  };
}

async function testOpenAiSettings(tenantId) {
  const settings = await getRawAppSettings(tenantId);
  const apiKey = settings.openai_api_key || settings.openaiApiKey || process.env.OPENAI_API_KEY || "";
  const model = settings.openai_model || settings.openaiModel || DEFAULT_OPENAI_MODEL;
  const enabled = Boolean(settings.openai_enabled || settings.openaiEnabled || process.env.OPENAI_API_KEY);
  if (!enabled || !apiKey) throw httpError("IA externa não configurada ou desativada.", 400);
  const result = await callOpenAiResponse(apiKey, model, "Responda exatamente com uma frase curta em português confirmando: IA 11RUN operacional.", 80);
  return {
    ok: Boolean(result.text),
    model,
    text: result.text || "Chamada aceita, mas sem texto extraível."
  };
}

async function handleStravaCallback(url, res) {
  const decodedState = decodeStravaState(url.searchParams.get("state"));
  const tenantSlug = decodedState.tenant || url.searchParams.get("tenant") || DEFAULT_TENANT_SLUG;
  const athleteUserId = decodedState.athlete || url.searchParams.get("athlete") || null;
  const tenant = await getTenant(tenantSlug);
  const error = url.searchParams.get("error");
  if (error) {
    redirect(res, `/#configuracao?strava=error&message=${encodeURIComponent(error)}`);
    return;
  }

  const code = url.searchParams.get("code");
  const nonce = decodedState.nonce;
  const integrations = await getIntegrations(tenant.id, athleteUserId);
  const integration = integrations.strava;

  if (!code || !nonce || nonce !== integration.oauthState) {
    redirect(res, "/#configuracao?strava=state_error");
    return;
  }

  const credentials = integration.credentials || {};
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
    grant_type: "authorization_code"
  });

  try {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
    const grantedScope = url.searchParams.get("scope") || payload.scope || "";
    if (!hasStravaActivityScope(grantedScope)) {
      throw new Error("O Strava autorizou apenas leitura basica. Refaca a conexao aprovando activity:read ou activity:read_all.");
    }

    await saveIntegration(tenant.id, athleteUserId, "strava", {
      connected: true,
      token: {
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at: payload.expires_at,
        scope: grantedScope
      },
      athlete: payload.athlete || null,
      oauthState: null
    });
    const athleteParam = athleteUserId ?`&athlete=${encodeURIComponent(athleteUserId)}` : "";
    redirect(res, `/#configuracao?strava=connected${athleteParam}`);
  } catch (exchangeError) {
    redirect(res, `/#configuracao?strava=error&message=${encodeURIComponent(exchangeError.message)}`);
  }
}

async function contextFromReq(req) {
  const tenant = await getTenant(tenantSlugFromReq(req));
  const user = await getSessionUser(req, tenant.id);
  const athleteIdFromHeader = req.headers["x-athlete-id"] || null;
  const athleteUserId = user?.role === "athlete"
    ?user.id
    : athleteIdFromHeader || await getPrimaryAthleteId(tenant.id);
  if (user && athleteUserId && !(await canAccessAthlete(tenant.id, user, athleteUserId))) {
    const error = new Error("Usuário sem permissão para acessar este atleta.");
    error.statusCode = 403;
    throw error;
  }
  return {
    tenant,
    user,
    athleteUserId
  };
}

function requireUser(user) {
  if (user) return;
  const error = new Error("Login obrigatório.");
  error.statusCode = 401;
  throw error;
}

function requireRole(user, roles) {
  requireUser(user);
  if (roles.includes(user.role)) return;
  const error = new Error("Usuário sem permissão para esta ação.");
  error.statusCode = 403;
  throw error;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, database: pool ?"postgres" : "json", publicBaseUrl: PUBLIC_BASE_URL, version: APP_VERSION });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/version") {
      sendJson(res, 200, { version: APP_VERSION, publicBaseUrl: PUBLIC_BASE_URL });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      sendJson(res, 200, { user: await getSessionUser(req, tenant.id) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      if (!pool) throw new Error("Login exige Postgres configurado.");
      const tenant = await getTenant(tenantSlugFromReq(req));
      const body = await readRequestBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const result = await query(
        "SELECT * FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1",
        [tenant.id, email]
      );
      const row = result.rows[0];
      if (!row || !verifyPassword(password, row.password_hash)) {
        const error = new Error("E-mail ou senha inválidos.");
        error.statusCode = 401;
        throw error;
      }
      const token = await createSession(tenant.id, row.id);
      setSessionCookie(res, token);
      sendJson(res, 200, { user: formatUser(row) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/logout") {
      if (pool) {
        const token = parseCookies(req)[SESSION_COOKIE];
        if (token) await query("DELETE FROM sessions WHERE token = $1", [token]);
      }
      clearSessionCookie(res);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/athletes") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireUser(user);
      await ensureUserAthleteProfile(tenant.id, user);
      sendJson(res, 200, await listAthletes(tenant.id, user));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/directory") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireUser(user);
      sendJson(res, 200, await listDirectory(tenant.id, user));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/teams") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireRole(user, ["admin", "manager", "coach"]);
      const body = await readRequestBody(req);
      const team = await createTeam(tenant.id, body, user);
      sendJson(res, 201, { team, directory: await listDirectory(tenant.id, user) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/athletes") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireRole(user, ["admin", "manager", "coach"]);
      await ensureUserAthleteProfile(tenant.id, user);
      const body = await readRequestBody(req);
      const athlete = await createAthlete(tenant.id, body, user);
      sendJson(res, 201, { athlete, athletes: await listAthletes(tenant.id, user) });
      return;
    }

    const athleteRoute = url.pathname.match(/^\/api\/athletes\/([^/]+)$/);
    if (athleteRoute && req.method === "PUT") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireUser(user);
      const athleteUserId = decodeURIComponent(athleteRoute[1]);
      const canEdit = ["admin", "manager", "coach"].includes(user.role) || String(user.id) === String(athleteUserId);
      if (!canEdit || !(await canAccessAthlete(tenant.id, user, athleteUserId))) {
        throw httpError("Usuário sem permissão para editar este atleta.", 403);
      }
      const body = await readRequestBody(req);
      const athlete = await updateAthlete(tenant.id, athleteUserId, body, user);
      sendJson(res, 200, { athlete, athletes: await listAthletes(tenant.id, user) });
      return;
    }

    if (athleteRoute && req.method === "DELETE") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireRole(user, ["admin", "manager", "coach"]);
      const athleteUserId = decodeURIComponent(athleteRoute[1]);
      if (!(await canAccessAthlete(tenant.id, user, athleteUserId))) {
        throw httpError("Usuário sem permissão para excluir este atleta.", 403);
      }
      await deleteAthlete(tenant.id, athleteUserId, user);
      sendJson(res, 200, { ok: true, athletes: await listAthletes(tenant.id, user) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/integrations") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      sendJson(res, 200, sanitizeIntegrations(await getIntegrations(tenant.id, athleteUserId)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/settings") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireRole(user, ["admin"]);
      sendJson(res, 200, await getAppSettings(tenant.id));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/settings") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireRole(user, ["admin"]);
      const body = await readRequestBody(req);
      sendJson(res, 200, await saveAppSettings(tenant.id, body));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/activities") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      sendJson(res, 200, await listActivities(tenant.id, athleteUserId));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/activities/manual") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      if (!athleteUserId || !(await canAccessAthlete(tenant.id, user, athleteUserId))) {
        throw httpError("Usuário sem permissão para cadastrar treino deste atleta.", 403);
      }
      const body = await readRequestBody(req);
      const activities = await createManualActivities(tenant.id, athleteUserId, body.mode, body.activities);
      sendJson(res, 201, { ok: true, activities });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/goals") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      sendJson(res, 200, await listGoals(tenant.id, athleteUserId));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/goals") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
      const goal = await createGoal(tenant.id, athleteUserId, body);
      sendJson(res, 201, { goal, goals: await listGoals(tenant.id, athleteUserId) });
      return;
    }

    const goalItemMatch = url.pathname.match(/^\/api\/goals\/([^/]+)$/);
    if (goalItemMatch && req.method === "PUT") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
      const goal = await updateGoal(tenant.id, athleteUserId, decodeURIComponent(goalItemMatch[1]), body);
      sendJson(res, 200, { goal, goals: await listGoals(tenant.id, athleteUserId) });
      return;
    }

    if (goalItemMatch && req.method === "DELETE") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      await deleteGoal(tenant.id, athleteUserId, decodeURIComponent(goalItemMatch[1]));
      sendJson(res, 200, { ok: true, goals: await listGoals(tenant.id, athleteUserId) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/activities/flag-3000-test") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
        const targetAthleteId = athleteUserId || await resolveAthleteIdFromActivity(tenant.id, body.activityId);
        if (!targetAthleteId || !(await canAccessAthlete(tenant.id, user, targetAthleteId))) {
          throw httpError("Usuário sem permissão para alterar esta atividade.", 403);
        }
        const activities = await flagActivityAs3000Test(tenant.id, targetAthleteId, body.activityId, body.enabled);
        sendJson(res, 200, { ok: true, activities });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/activities/feedback") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
        const targetAthleteId = athleteUserId || await resolveAthleteIdFromActivity(tenant.id, body.activityId);
        if (!targetAthleteId || !(await canAccessAthlete(tenant.id, user, targetAthleteId))) {
          throw httpError("Usuário sem permissão para alterar esta atividade.", 403);
        }
        const activities = await updateActivityFeedback(tenant.id, targetAthleteId, body.activityId, {
          performancePercent: body.performancePercent,
          painScore: body.painScore,
          perceivedExertion: body.perceivedExertion,
          trainingType: body.trainingType,
          description: body.description
        });
      sendJson(res, 200, { ok: true, activities });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/integrations") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireRole(user, ["admin", "manager", "coach", "athlete"]);
      const body = await readRequestBody(req);
      const provider = String(body.provider || "").toLowerCase();
      await saveIntegration(tenant.id, athleteUserId, provider, {
        enabled: body.enabled,
        credentials: body.credentials || {}
      });
      sendJson(res, 200, sanitizeIntegrations(await getIntegrations(tenant.id, athleteUserId)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/strava/auth") {
      const { tenant, user } = await contextFromReq(req);
      requireUser(user);
      const athleteUserId = user.role === "athlete"
        ?user.id
        : url.searchParams.get("athlete") || await getPrimaryAthleteId(tenant.id);
      if (!(await canAccessAthlete(tenant.id, user, athleteUserId))) {
        const error = new Error("Usuário sem permissão para conectar este atleta.");
        error.statusCode = 403;
        throw error;
      }
      const integrations = await getIntegrations(tenant.id, athleteUserId);
      const integration = integrations.strava;
      const credentials = integration.credentials || {};
      if (!credentials.clientId || !credentials.clientSecret || !credentials.redirectUri) {
        sendJson(res, 400, { error: "Preencha Client ID, Client Secret e Redirect URI do Strava." });
        return;
      }
      const nonce = crypto.randomBytes(16).toString("hex");
      await saveIntegration(tenant.id, athleteUserId, "strava", { oauthState: nonce });
      const state = encodeStravaState(tenant.slug, athleteUserId, nonce);
      const redirectUri = new URL(credentials.redirectUri);
      const authUrl = new URL("https://www.strava.com/oauth/authorize");
      authUrl.searchParams.set("client_id", credentials.clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri.toString());
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("approval_prompt", "force");
      authUrl.searchParams.set("scope", credentials.scopes || "read,activity:read,activity:read_all");
      authUrl.searchParams.set("state", state);
      redirect(res, authUrl.toString());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/strava/callback") {
      await handleStravaCallback(url, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/strava/test") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      sendJson(res, 200, await testStravaConnection(tenant.id, athleteUserId));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/strava/enrich") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
      sendJson(res, 200, await enrichStravaActivityDetails(tenant.id, athleteUserId, body.limit || 8));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/projection") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
      if (body.athleteId && !(await canAccessAthlete(tenant.id, user, body.athleteId))) {
        throw httpError("Usuario sem permissao para analisar este atleta.", 403);
      }
      sendJson(res, 200, await generateAiProjection(tenant.id, { ...body, athleteUserId }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/test") {
      const { tenant, user } = await contextFromReq(req);
      requireRole(user, ["admin"]);
      sendJson(res, 200, await testOpenAiSettings(tenant.id));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/sync") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
      const days = Number(body.days || 30);
      const providers = Array.isArray(body.providers) ?body.providers.map((item) => String(item).toLowerCase()) : [];
      const result = [];
      const warnings = [];
      if (providers.includes("strava")) result.push(...await syncStrava(tenant.id, athleteUserId, days));
      for (const provider of providers.filter((item) => item !== "strava")) {
        warnings.push(`${provider}: credenciais salvas, mas a sincronização automática ainda depende de aprovação/API específica.`);
      }
      sendJson(res, 200, {
        imported: result.length,
        activities: await listActivities(tenant.id, athleteUserId),
        warnings
      });
      return;
    }

    sendJson(res, 404, { error: "Endpoint não encontrado." });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.message || "Erro interno." });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `${PUBLIC_BASE_URL}`);

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ?"/index.html" : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acesso negado.");
    return;
  }

  sendFile(res, filePath);
});

initDatabase()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`11RUN em http://${HOST}:${PORT}/`);
      console.log(`Base pública OAuth: ${PUBLIC_BASE_URL}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao iniciar banco de dados:", error);
    process.exit(1);
  });
