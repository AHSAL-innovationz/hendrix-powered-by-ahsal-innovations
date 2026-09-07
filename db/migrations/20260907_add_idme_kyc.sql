-- DB migration: add KYC fields and credits ledger

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS kyc_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS idme_payload jsonb NULL,
  ADD COLUMN IF NOT EXISTS idme_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS credits integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS credits_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamptz DEFAULT now()
);
