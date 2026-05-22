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

const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const INTEGRATIONS_FILE = path.join(DATA_DIR, "integrations.json");
const ACTIVITIES_FILE = path.join(DATA_DIR, "activities.json");
const ATHLETES_FILE = path.join(DATA_DIR, "athletes.json");
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

const pool = DATABASE_URL && Pool
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
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
      res.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.code === "ENOENT" ? "Arquivo não encontrado." : "Erro interno.");
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
          integration.token ? JSON.stringify(integration.token) : null,
          integration.athlete ? JSON.stringify(integration.athlete) : null
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
      globalIntegration.athlete ? JSON.stringify(globalIntegration.athlete) : null,
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
  return {
    id: row.id,
    tenantId: row.tenant_id,
    role: row.role,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp || "",
    teamId: row.team_id || "",
    teamName: row.team_name || "",
    coachId: row.coach_user_id || "",
    coachName: row.coach_name || "",
    coachEmail: row.coach_email || "",
    age: row.age == null ? "" : Number(row.age),
    weightKg: row.weight_kg == null ? "" : Number(row.weight_kg),
    heightCm: row.height_cm == null ? "" : Number(row.height_cm),
    focusDistanceM: row.focus_distance_m == null ? "" : Number(row.focus_distance_m),
    targetTimeSeconds: row.target_time_seconds == null ? "" : Number(row.target_time_seconds),
    targetTime: row.target_time_seconds == null ? "" : formatDuration(row.target_time_seconds),
    targetDate: row.target_date ? formatDateOnly(row.target_date) : "",
    bestTimeSeconds: row.best_time_seconds == null ? "" : Number(row.best_time_seconds),
    bestTime: row.best_time_seconds == null ? "" : formatDuration(row.best_time_seconds),
    createdAt: row.created_at
  };
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
  const role = String(row.email || "").toLowerCase() === DEFAULT_ADMIN_EMAIL ? "admin" : row.role;
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
    `SELECT u.id, u.tenant_id, u.role, u.name, u.email, u.whatsapp, u.created_at,
            ap.age, ap.weight_kg, ap.height_cm, ap.team_id, ap.coach_user_id,
            ap.focus_distance_m, ap.target_time_seconds, ap.target_date, ap.best_time_seconds,
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

async function canAccessAthlete(tenantId, user, athleteUserId) {
  if (!user || !athleteUserId || user.role === "admin") return true;
  if (user.role === "athlete") return String(user.id) === String(athleteUserId);
  const visible = await listAthletes(tenantId, user);
  return visible.some((athlete) => String(athlete.id) === String(athleteUserId));
}

function validateAthlete(input) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const whatsapp = String(input.whatsapp || "").trim();
  const age = input.age === "" || input.age == null ? null : Number(input.age);
  const weightKg = input.weightKg === "" || input.weightKg == null ? null : Number(input.weightKg);
  const heightCm = input.heightCm === "" || input.heightCm == null ? null : Number(input.heightCm);
  const teamName = String(input.teamName || "").trim();
  const coachName = String(input.coachName || "").trim();
  const coachEmail = String(input.coachEmail || "").trim().toLowerCase();
  const password = String(input.password || "").trim();
  const focusDistanceM = input.focusDistanceM === "" || input.focusDistanceM == null ? null : Number(input.focusDistanceM);
  const targetTimeSeconds = parseTimeToSeconds(input.targetTime || input.targetTimeSeconds);
  const bestTimeSeconds = parseTimeToSeconds(input.bestTime || input.bestTimeSeconds);
  const targetDate = String(input.targetDate || "").trim();

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
    bestTimeSeconds
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

async function createAthlete(tenantId, input) {
  const athlete = validateAthlete(input);
  if (!pool) {
    const athletes = readJson(ATHLETES_FILE, []);
    const existingIndex = athletes.findIndex((item) => item.email === athlete.email);
    if (existingIndex >= 0) throw httpError("Não foi possível cadastrar: já existe um atleta com este e-mail.", 409);
    const record = {
      id: crypto.randomUUID(),
      tenantId,
      role: "athlete",
      ...athlete,
      teamName: athlete.teamName || "",
      coachName: athlete.coachName || "",
      coachEmail: athlete.coachEmail || "",
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
    const passwordHash = athlete.password ? hashPassword(athlete.password) : null;
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, role, name, email, whatsapp, password_hash)
       VALUES ($1, 'athlete', $2, $3, $4, $5)
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET name = EXCLUDED.name,
                     whatsapp = EXCLUDED.whatsapp,
                     password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)
       RETURNING *`,
      [tenantId, athlete.name, athlete.email, athlete.whatsapp, passwordHash]
    );
    const user = userResult.rows[0];
    await client.query(
      `INSERT INTO athlete_profiles (
         user_id, team_id, coach_user_id, age, weight_kg, height_cm,
         focus_distance_m, target_time_seconds, target_date, best_time_seconds
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        athlete.bestTimeSeconds
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

async function updateAthlete(tenantId, athleteUserId, input) {
  const athlete = validateAthlete(input);
  if (!pool) {
    const athletes = readJson(ATHLETES_FILE, []);
    const index = athletes.findIndex((item) => String(item.id) === String(athleteUserId));
    if (index < 0) throw httpError("Atleta não encontrado.", 404);
    const duplicated = athletes.some((item) => String(item.id) !== String(athleteUserId) && item.email === athlete.email);
    if (duplicated) throw httpError("Não foi possível atualizar: já existe um atleta com este e-mail.", 409);
    athletes[index] = {
      ...athletes[index],
      ...athlete,
      teamName: athlete.teamName || "",
      coachName: athlete.coachName || "",
      coachEmail: athlete.coachEmail || ""
    };
    writeJson(ATHLETES_FILE, athletes);
    return athletes[index];
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT u.id, u.email, u.role
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
    const passwordHash = athlete.password ? hashPassword(athlete.password) : null;
    await client.query(
      `UPDATE users
          SET name = $1,
              email = $2,
              whatsapp = $3,
              password_hash = COALESCE($4, password_hash)
        WHERE tenant_id = $5 AND id = $6`,
      [athlete.name, athlete.email, athlete.whatsapp, passwordHash, tenantId, athleteUserId]
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
              updated_at = now()
        WHERE user_id = $10`,
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

async function getIntegrations(tenantId, athleteUserId = null) {
  if (!pool) return readJson(INTEGRATIONS_FILE, defaultIntegrations());
  await ensureTenantIntegrations(tenantId, athleteUserId);
  const globalRows = athleteUserId
    ? await query(
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
        next.token ? JSON.stringify(next.token) : null,
        next.athlete ? JSON.stringify(next.athlete) : null,
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
      next.token ? JSON.stringify(next.token) : null,
      next.athlete ? JSON.stringify(next.athlete) : null,
      next.oauthState || null
    ]
  );
  return next;
}

function activityRowToApi(row) {
  const raw = parseJsonObject(row.raw);
  const analysis = calculateRunAnalysis(raw, row);
  const movingTimeSeconds = safeNumber(raw.moving_time, raw.elapsed_time);
  const distanceMeters = safeNumber(raw.distance);
  const bestEfforts = Array.isArray(raw.best_efforts)
    ? raw.best_efforts.map((effort) => ({
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
    analysis
  };
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
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
      variability: mean ? Math.sqrt(variance) / mean : 0,
      fastestRatio: mean ? fastest / mean : 1,
      fastestPace: formatPace(1000, 1000 / fastest)
    };
  }

  const splits = Array.isArray(activity.splits_metric) ? activity.splits_metric : [];
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
    variability: mean ? Math.sqrt(variance) / mean : 0,
    fastestRatio: mean ? fastest / mean : 1,
    fastestPace: formatPace(1000, 1000 / fastest)
  };
}

function classifyRunAnalysis({ durationMinutes, distanceKm, elevationPerKm, variability, fastestRatio, hrIntensity, aggressionScore }) {
  if (distanceKm >= 14 || durationMinutes >= 75) {
    if (fastestRatio >= 1.25 || variability >= 0.16) return "Longo com variacao forte";
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
  const durationMinutes = movingTime ? movingTime / 60 : 0;
  const durationHours = durationMinutes / 60;
  const distanceKm = distanceMeters ? distanceMeters / 1000 : 0;
  const elevationGain = safeNumber(activity.total_elevation_gain);
  const elevationPerKm = distanceKm ? elevationGain / distanceKm : 0;
  const avgHr = safeNumber(activity.average_heartrate);
  const maxHr = safeNumber(activity.max_heartrate);
  const relativeEffort = safeNumber(activity.suffer_score, activity.relative_effort);
  const thresholdHr = safeNumber(process.env.RUN_THRESHOLD_HR, process.env.DEFAULT_THRESHOLD_HR, 170);
  const { splitCount, variability, fastestRatio, fastestPace } = splitRunSignals(activity);

  const hrIntensity = avgHr ? clamp(avgHr / thresholdHr, 0.45, 1.28) : 0;
  const hrTss = durationHours && hrIntensity ? durationHours * (hrIntensity ** 2) * 100 : 0;
  const durationTss = durationHours ? durationHours * 62 : 0;
  const stravaTss = relativeEffort ? relativeEffort * 1.08 : 0;
  const spikeBonus = clamp(((fastestRatio - 1.12) * 38) + (variability * 72), 0, 42);
  const elevationBonus = clamp(elevationPerKm * 0.16, 0, 18);
  const maxHrBonus = maxHr && thresholdHr ? clamp(((maxHr / thresholdHr) - 1) * 45, 0, 24) : 0;
  const baseTss = Math.max(hrTss, stravaTss, durationTss);
  const tss = Math.round(clamp(baseTss + spikeBonus + elevationBonus + maxHrBonus, 1, 320));
  const aggressionScore = Math.round(clamp(
    (tss * 0.72) + (spikeBonus * 1.2) + (relativeEffort ? relativeEffort * 0.18 : 0) + elevationBonus,
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
    intensityFactor: hrIntensity ? hrIntensity.toFixed(2) : "",
    relativeEffort: relativeEffort ? Math.round(relativeEffort) : "",
    splitCount,
    splitVariability: `${Math.round(variability * 100)}%`,
    fastestRatio: fastestRatio ? fastestRatio.toFixed(2) : "",
    fastestPace,
    elevationPerKm: distanceKm ? `${Math.round(elevationPerKm)} m/km` : "",
    note: isRun
      ? "Estimativa proprietaria para corrida baseada em Strava, FC, duracao, elevacao e variacao dos splits."
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
  return String(value || "").slice(0, 10);
}

async function listActivities(tenantId, athleteUserId = null) {
  if (!pool) return readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES);
  const params = athleteUserId ? [tenantId, athleteUserId] : [tenantId];
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
        ${athleteUserId ? "AND athlete_user_id = $2" : ""}
      ORDER BY activity_date ASC`,
    params
  );
  return result.rows.map(activityRowToApi);
}

async function upsertActivities(tenantId, athleteUserId, importedActivities) {
  if (!pool) {
    const existing = readJson(ACTIVITIES_FILE, DEMO_ACTIVITIES);
    const byId = new Map(existing.map((activity) => [String(activity.id), activity]));
    for (const activity of importedActivities) byId.set(String(activity.id), activity);
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
                       ELSE EXCLUDED.raw
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
  return listActivities(tenantId);
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
  return {
    id: `strava-${activity.id}`,
    providerId: String(activity.id),
    date: Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10),
    title: activity.name || "Atividade Strava",
    source: "Strava",
    type: activity.sport_type || activity.type || "Run",
    description: [
      activity.description,
      activity.total_elevation_gain ? `Elevação ${Math.round(activity.total_elevation_gain)} m` : "",
      activity.average_heartrate ? `FC média ${Math.round(activity.average_heartrate)} bpm` : ""
    ].filter(Boolean).join(" | ") || "Atividade importada do Strava.",
    distance: formatDistance(activity.distance),
    duration: formatDuration(activity.moving_time || activity.elapsed_time),
    load: String(analysis.aggressionScore),
    pace: formatPace(activity.distance, activity.moving_time || activity.elapsed_time),
    externalUrl: `https://www.strava.com/activities/${activity.id}`,
    raw: activity,
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
          console.warn(`Nao foi possivel buscar streams Strava ${row.provider_activity_id}: ${streamError.message}`);
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
    const athleteParam = athleteUserId ? `&athlete=${encodeURIComponent(athleteUserId)}` : "";
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
    ? user.id
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
      sendJson(res, 200, { ok: true, database: pool ? "postgres" : "json", publicBaseUrl: PUBLIC_BASE_URL, version: APP_VERSION });
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

    if (req.method === "POST" && url.pathname === "/api/athletes") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireRole(user, ["admin", "manager", "coach"]);
      await ensureUserAthleteProfile(tenant.id, user);
      const body = await readRequestBody(req);
      const athlete = await createAthlete(tenant.id, body);
      sendJson(res, 201, { athlete, athletes: await listAthletes(tenant.id, user) });
      return;
    }

    const athleteRoute = url.pathname.match(/^\/api\/athletes\/([^/]+)$/);
    if (athleteRoute && req.method === "PUT") {
      const tenant = await getTenant(tenantSlugFromReq(req));
      const user = await getSessionUser(req, tenant.id);
      requireRole(user, ["admin", "manager", "coach"]);
      const athleteUserId = decodeURIComponent(athleteRoute[1]);
      if (!(await canAccessAthlete(tenant.id, user, athleteUserId))) {
        throw httpError("Usuário sem permissão para editar este atleta.", 403);
      }
      const body = await readRequestBody(req);
      const athlete = await updateAthlete(tenant.id, athleteUserId, body);
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

    if (req.method === "GET" && url.pathname === "/api/activities") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      sendJson(res, 200, await listActivities(tenant.id, athleteUserId));
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
        ? user.id
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

    if (req.method === "POST" && url.pathname === "/api/sync") {
      const { tenant, user, athleteUserId } = await contextFromReq(req);
      requireUser(user);
      const body = await readRequestBody(req);
      const days = Number(body.days || 30);
      const providers = Array.isArray(body.providers) ? body.providers.map((item) => String(item).toLowerCase()) : [];
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
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
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
