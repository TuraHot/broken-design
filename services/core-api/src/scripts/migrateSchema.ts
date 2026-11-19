import { db } from "../config/db";

async function runMigration() {
  console.log("--- Running database migration for Lixyte PostgreSQL schema ---");
  try {
    // 1. Alter purchases table to ensure all required columns exist
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

    // 2. Complaints table
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

    // 3. Verify users & models
    console.log("Migrating users & models tables...");
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
      ALTER TABLE models ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
      ALTER TABLE models ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    `);
    console.log("✅ Users & models columns verified!");

    console.log("🎉 All migrations completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
