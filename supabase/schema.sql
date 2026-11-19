-- Lixyte — Comprehensive PostgreSQL Schema (Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Enums (เพิ่ม 'admin' สำหรับบทบาทแอดมิน)
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user', 'creator', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE license_type AS ENUM ('CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE purchase_status AS ENUM ('pending', 'paid'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Users Table (เพิ่ม is_seller และ suspended_at ตาม README)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    is_seller BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_hash CHAR(64),
    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_hash CHAR(64);

-- 3. Models Table (เพิ่ม hidden_at สำหรับแอดมินซ่อนโมเดล)
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    license license_type NOT NULL DEFAULT 'CC0',
    file_hash CHAR(64) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    preview_hash CHAR(64),
    poster_hash CHAR(64),
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    view_count BIGINT NOT NULL DEFAULT 0,
    download_count BIGINT NOT NULL DEFAULT 0,
    hidden_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_models_tags ON models USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_models_owner ON models (owner_id);
CREATE INDEX IF NOT EXISTS idx_models_active ON models (created_at DESC) WHERE deleted_at IS NULL AND hidden_at IS NULL;

-- 4. Purchases Table (Single-Item Purchase + License & Watermark Tracking)
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
    status purchase_status NOT NULL DEFAULT 'pending',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    license_type VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL',
    watermark_hash VARCHAR(128),
    paid_at TIMESTAMPTZ,
    provider_session_id VARCHAR(255) UNIQUE,
    embed_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, model_id)
);

-- Safe migration for existing databases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_hash VARCHAR(128);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_purchases_embed_key ON purchases (embed_key);

-- 5. Likes Table / Favorites
CREATE TABLE IF NOT EXISTS likes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, model_id)
);

-- 6. Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_model_id ON comments (model_id);

-- 6.1 Complaints Table (คำร้องเรียนจากผู้ใช้ — แอดมินดูและปิดเรื่องที่ /admin/complaints)
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL CHECK (category IN ('model', 'account', 'purchase', 'other')),
    model_id UUID REFERENCES models(id) ON DELETE SET NULL,
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
    admin_note TEXT,
    handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_reporter ON complaints (reporter_id, created_at DESC);

-- 7. Seed Initial Accounts (Admin must be set in DB, cannot register via UI)
INSERT INTO users (email, password_hash, display_name, role, is_seller)
VALUES (
    'admin@brokendesign.com',
    '$2b$10$NTrckoyeBuWvh0BdeqForOSS1zaDO/W4olcjACKVrtUbSBp9dshgS',
    'Platform Admin',
    'admin',
    false
) ON CONFLICT (email) DO UPDATE
SET role = 'admin', suspended_at = NULL;

INSERT INTO users (email, password_hash, display_name, role, is_seller)
VALUES (
    'creator@brokendesign.com',
    '$2b$10$jQ6UMGcwnEje.2C3/QLsjuz6b8vLWFRPuJCxsWmGvnQlcZ/UJyWqq',
    'Demo Creator',
    'creator',
    true
) ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash, role = 'creator', is_seller = true, suspended_at = NULL;

-- 8. Supabase Storage Bucket ('models') & RLS Policies
-- Stored object keys follow `<model_id>/{model,preview,poster}.<sha256>.<ext>` (with flat legacy key fallback).
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
    CREATE POLICY "Public Read Access for models bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'models');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow Uploads to models bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'models');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow Updates on models bucket"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'models')
    WITH CHECK (bucket_id = 'models');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow Deletes from models bucket"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'models');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8.1 Supabase Storage Bucket ('profile_logo') & RLS Policies
-- Stored object keys follow `<user_id>/avatar.<sha256>.webp`.
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_logo', 'profile_logo', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
    CREATE POLICY "Public Read Access for profile_logo bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile_logo');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow Uploads to profile_logo bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'profile_logo');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow Updates on profile_logo bucket"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'profile_logo')
    WITH CHECK (bucket_id = 'profile_logo');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Allow Deletes from profile_logo bucket"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'profile_logo');
EXCEPTION WHEN duplicate_object THEN null; END $$;
