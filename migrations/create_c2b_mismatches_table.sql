CREATE TABLE IF NOT EXISTS public.c2b_mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  mpesa_receipt TEXT UNIQUE,
  account_reference TEXT,
  phone_number TEXT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payer_name TEXT,
  transaction_type TEXT,
  business_short_code TEXT,
  transaction_time TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_c2b_mismatches_created_at
  ON public.c2b_mismatches (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_c2b_mismatches_account_reference
  ON public.c2b_mismatches (account_reference);

ALTER TABLE public.c2b_mismatches ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.c2b_mismatches TO service_role;
