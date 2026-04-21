-- Create security_audit_log table
-- This table was previously created manually; this migration ensures it exists in all environments

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_level TEXT NOT NULL DEFAULT 'INFO',
  event_details JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
