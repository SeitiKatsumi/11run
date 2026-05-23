CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('athlete', 'coach', 'manager', 'admin')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS athlete_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  coach_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  age INTEGER CHECK (age IS NULL OR age BETWEEN 1 AND 120),
  weight_kg NUMERIC(5,2) CHECK (weight_kg IS NULL OR weight_kg > 0),
  height_cm NUMERIC(5,2) CHECK (height_cm IS NULL OR height_cm > 0),
  focus_distance_m INTEGER,
  target_time_seconds INTEGER,
  target_date DATE,
  best_time_seconds INTEGER,
  history_notes TEXT,
  history_timeline JSONB NOT NULL DEFAULT '[]',
  tests_3000 JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  athlete_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  connected BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB NOT NULL DEFAULT '{}',
  token JSONB,
  athlete JSONB,
  oauth_state TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, athlete_user_id, provider)
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  athlete_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_activity_id TEXT NOT NULL,
  activity_date DATE NOT NULL,
  title TEXT NOT NULL,
  type TEXT,
  description TEXT,
  distance TEXT,
  duration TEXT,
  pace TEXT,
  load TEXT,
  external_url TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider, provider_activity_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  openai_api_key TEXT,
  openai_model TEXT,
  openai_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS coach_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS focus_distance_m INTEGER;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS target_time_seconds INTEGER;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS best_time_seconds INTEGER;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS history_notes TEXT;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS history_timeline JSONB NOT NULL DEFAULT '[]';
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS tests_3000 JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_team ON athlete_profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_coach ON athlete_profiles(coach_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_date ON activities(tenant_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
