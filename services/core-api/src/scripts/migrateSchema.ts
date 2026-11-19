import bcrypt from "bcrypt";
import { db } from "../config/db";

async function runMigration() {
  console.log("--- Running database migration for Lixyte PostgreSQL schema ---");
  try {
    // 1. Add avatar_url and avatar_hash to users table
    console.log("Adding avatar_url and avatar_hash to users table...");
    await db.query(`
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_hash CHAR(64);
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
    `);
    console.log("✅ users.avatar_url and users.avatar_hash columns verified!");

    // 2. Ensure purchases table
    console.log("Migrating purchases table...");
    await db.query(`
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS amount_cents INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'USD';
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL';
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS watermark_hash VARCHAR(128);
      ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_purchases_embed_key ON purchases (embed_key);
    `);
    console.log("✅ Purchases table columns & index verified!");

    // 3. Complaints table
    console.log("Migrating complaints table...");
    await db.query(`
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
    `);
    console.log("✅ Complaints table & indexes verified!");

    // 4. Seed/Ensure standard demo accounts for all 3 roles:
    // Password for all demo accounts: Admin@BrokenDesign2026!
    const defaultPassword = "Admin@BrokenDesign2026!";
    const defaultHash = await bcrypt.hash(defaultPassword, 10);

    // Admin Account
    await db.query(
      `INSERT INTO users (email, password_hash, display_name, role, is_seller)
       VALUES ('admin@brokendesign.com', $1, 'Platform Admin', 'admin', false)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = $1, role = 'admin', suspended_at = NULL;`,
      [defaultHash],
    );

    // Creator Account
    await db.query(
      `INSERT INTO users (email, password_hash, display_name, role, is_seller)
       VALUES ('creator@brokendesign.com', $1, 'Demo Creator', 'creator', true)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = $1, role = 'creator', is_seller = true, suspended_at = NULL;`,
      [defaultHash],
    );

    // Regular User Account
    await db.query(
      `INSERT INTO users (email, password_hash, display_name, role, is_seller)
       VALUES ('user@brokendesign.com', $1, 'Demo Buyer', 'user', false)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = $1, role = 'user', suspended_at = NULL;`,
      [defaultHash],
    );

    console.log("✅ Seeded demo accounts for all 3 roles (admin, creator, user) with password: Admin@BrokenDesign2026!");

    console.log("🎉 All migrations and seed accounts completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
