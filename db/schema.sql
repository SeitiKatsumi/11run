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
  profile_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_data JSONB NOT NULL DEFAULT '{}',
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
  status TEXT NOT NULL DEFAULT 'executed',
  planned_activity_id TEXT,
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

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  main_event TEXT NOT NULL,
  personal_best TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'approved', 'rejected')),
  source TEXT NOT NULL DEFAULT 'login_teaser',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS athlete_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  athlete_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  target_time_seconds INTEGER NOT NULL,
  race_date DATE NOT NULL,
  notes TEXT,
  actual_time_seconds INTEGER,
  result_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breathing_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  objective TEXT NOT NULL,
  description TEXT NOT NULL,
  inhale_seconds INTEGER NOT NULL DEFAULT 4,
  hold_in_seconds INTEGER NOT NULL DEFAULT 0,
  exhale_seconds INTEGER NOT NULL DEFAULT 6,
  hold_out_seconds INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 5,
  difficulty_level TEXT NOT NULL DEFAULT 'iniciante',
  age_group TEXT NOT NULL DEFAULT 'adulto',
  safety_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS breathing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES breathing_protocols(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  context TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breathing_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES breathing_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anxiety_before INTEGER CHECK (anxiety_before BETWEEN 0 AND 10),
  tension_before INTEGER CHECK (tension_before BETWEEN 0 AND 10),
  pain_before BOOLEAN NOT NULL DEFAULT false,
  pain_location JSONB NOT NULL DEFAULT '[]',
  breathing_state_before TEXT,
  goal TEXT,
  sleep_quality INTEGER CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 0 AND 10),
  recovery_perception INTEGER CHECK (recovery_perception IS NULL OR recovery_perception BETWEEN 0 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breathing_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES breathing_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anxiety_after INTEGER CHECK (anxiety_after BETWEEN 0 AND 10),
  tension_after INTEGER CHECK (tension_after BETWEEN 0 AND 10),
  pain_after BOOLEAN NOT NULL DEFAULT false,
  breathing_state_after TEXT,
  body_state_after TEXT,
  perceived_effect TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breathing_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES breathing_sessions(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  recommendation TEXT,
  risk_level TEXT NOT NULL DEFAULT 'baixo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS breathing_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_audio BOOLEAN NOT NULL DEFAULT true,
  preferred_vibration BOOLEAN NOT NULL DEFAULT false,
  preferred_protocol_duration INTEGER NOT NULL DEFAULT 5,
  preferred_voice_style TEXT NOT NULL DEFAULT 'coach',
  visual_mode TEXT NOT NULL DEFAULT 'dark',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}';
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS coach_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS focus_distance_m INTEGER;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS target_time_seconds INTEGER;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS best_time_seconds INTEGER;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS history_notes TEXT;
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS history_timeline JSONB NOT NULL DEFAULT '[]';
ALTER TABLE athlete_profiles ADD COLUMN IF NOT EXISTS tests_3000 JSONB NOT NULL DEFAULT '[]';
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS actual_time_seconds INTEGER;
ALTER TABLE athlete_goals ADD COLUMN IF NOT EXISTS result_notes TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'executed';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS planned_activity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_team ON athlete_profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_athlete_profiles_coach ON athlete_profiles(coach_user_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_date ON activities(tenant_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(tenant_id, athlete_user_id, status, activity_date);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_created ON waitlist_signups(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_status ON waitlist_signups(tenant_id, status, main_event);
CREATE INDEX IF NOT EXISTS idx_athlete_goals_athlete_date ON athlete_goals(tenant_id, athlete_user_id, race_date);
CREATE INDEX IF NOT EXISTS idx_breathing_protocols_tenant ON breathing_protocols(tenant_id, category, age_group, is_active);
CREATE INDEX IF NOT EXISTS idx_breathing_sessions_user ON breathing_sessions(tenant_id, user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_breathing_checkins_user ON breathing_checkins(tenant_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_breathing_insights_user ON breathing_ai_insights(tenant_id, user_id, created_at);
