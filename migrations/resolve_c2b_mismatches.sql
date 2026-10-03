ALTER TABLE public.c2b_mismatches
  ADD COLUMN IF NOT EXISTS resolved_user_id UUID,
  ADD COLUMN IF NOT EXISTS resolved_user_phone TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_transaction_id TEXT;

CREATE OR REPLACE FUNCTION public.resolve_c2b_mismatch(
  p_mismatch_id UUID,
  p_user_id UUID,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mismatch public.c2b_mismatches%ROWTYPE;
  v_user RECORD;
  v_existing RECORD;
  v_external_reference TEXT;
  v_phone_number TEXT;
  v_balance_before NUMERIC(15, 2);
  v_balance_after NUMERIC(15, 2);
  v_stakeable_before NUMERIC(15, 2);
  v_now TIMESTAMPTZ := NOW();
  v_description TEXT;
BEGIN
  SELECT *
  INTO v_mismatch
  FROM public.c2b_mismatches
  WHERE id = p_mismatch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'C2B payment not found';
  END IF;

  IF v_mismatch.resolved_at IS NOT NULL THEN
    IF v_mismatch.resolved_user_id = p_user_id THEN
      SELECT id, username, phone_number, account_balance
      INTO v_user
      FROM public.users
      WHERE id = p_user_id;

      RETURN jsonb_build_object(
        'already_resolved', TRUE,
        'credited', FALSE,
        'resolved_user_id', v_mismatch.resolved_user_id,
        'username', v_user.username,
        'phone_number', COALESCE(v_mismatch.resolved_user_phone, v_user.phone_number),
        'new_balance', v_user.account_balance
      );
    END IF;

    RAISE EXCEPTION 'C2B payment has already been resolved to another account'
      USING ERRCODE = '23505';
  END IF;

  IF v_mismatch.amount IS NULL OR v_mismatch.amount <= 0 THEN
    RAISE EXCEPTION 'C2B payment amount must be greater than zero';
  END IF;

  SELECT id, username, phone_number, account_balance, stakeable_balance
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected user not found';
  END IF;

  IF COALESCE(v_user.phone_number, '') !~ '^\+?[0-9]{7,15}$' THEN
    RAISE EXCEPTION 'Selected user does not have a valid phone number for deposit SMS';
  END IF;

  v_external_reference := 'C2B-' || COALESCE(
    NULLIF(v_mismatch.mpesa_receipt, ''),
    v_mismatch.transaction_id
  );

  SELECT id, user_id, status
  INTO v_existing
  FROM public.transactions
  WHERE external_reference = v_external_reference
     OR (NULLIF(v_mismatch.mpesa_receipt, '') IS NOT NULL
         AND mpesa_receipt = v_mismatch.mpesa_receipt)
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'completed' AND v_existing.user_id = p_user_id THEN
      UPDATE public.c2b_mismatches
      SET resolved_user_id = p_user_id,
          resolved_user_phone = v_user.phone_number,
          resolved_by = p_admin_id,
          resolved_at = v_now,
          resolution_transaction_id = v_external_reference
      WHERE id = p_mismatch_id;

      RETURN jsonb_build_object(
        'already_resolved', TRUE,
        'credited', FALSE,
        'resolved_user_id', p_user_id,
        'username', v_user.username,
        'phone_number', v_user.phone_number,
        'new_balance', v_user.account_balance
      );
    END IF;

    RAISE EXCEPTION 'This M-Pesa receipt already has a transaction record'
      USING ERRCODE = '23505';
  END IF;

  v_phone_number := CASE
    WHEN COALESCE(v_mismatch.phone_number, '') ~ '^\+?[0-9]{7,15}$'
      THEN v_mismatch.phone_number
    ELSE v_user.phone_number
  END;

  v_balance_before := COALESCE(v_user.account_balance, 0);
  v_stakeable_before := COALESCE(v_user.stakeable_balance, 0);
  v_balance_after := v_balance_before + v_mismatch.amount;
  v_description := format(
    'Manually resolved M-Pesa C2B Paybill payment (account: %s, payer: %s)',
    COALESCE(v_mismatch.account_reference, 'not provided'),
    COALESCE(v_mismatch.payer_name, 'not provided')
  );

  UPDATE public.users
  SET account_balance = v_balance_after,
      stakeable_balance = v_stakeable_before + v_mismatch.amount,
      updated_at = v_now
  WHERE id = p_user_id;

  INSERT INTO public.transactions (
    transaction_id,
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    status,
    method,
    phone_number,
    mpesa_receipt,
    external_reference,
    description,
    created_at,
    completed_at
  ) VALUES (
    v_external_reference,
    p_user_id,
    'deposit',
    v_mismatch.amount,
    v_balance_before,
    v_balance_after,
    'completed',
    'M-Pesa C2B Paybill',
    v_phone_number,
    NULLIF(v_mismatch.mpesa_receipt, ''),
    v_external_reference,
    v_description,
    v_now,
    v_now
  );

  INSERT INTO public.deposits (
    user_id,
    amount,
    phone_number,
    external_reference,
    mpesa_receipt,
    status,
    method,
    description,
    completed_at,
    created_at,
    updated_at
  ) VALUES (
    p_user_id::TEXT,
    v_mismatch.amount,
    v_phone_number,
    v_external_reference,
    NULLIF(v_mismatch.mpesa_receipt, ''),
    'completed',
    'M-Pesa C2B Paybill',
    v_description,
    v_now,
    v_now,
    v_now
  );

  UPDATE public.c2b_mismatches
  SET resolved_user_id = p_user_id,
      resolved_user_phone = v_user.phone_number,
      resolved_by = p_admin_id,
      resolved_at = v_now,
      resolution_transaction_id = v_external_reference
  WHERE id = p_mismatch_id;

  RETURN jsonb_build_object(
    'already_resolved', FALSE,
    'credited', TRUE,
    'resolved_user_id', p_user_id,
    'username', v_user.username,
    'phone_number', v_user.phone_number,
    'amount', v_mismatch.amount,
    'new_balance', v_balance_after,
    'transaction_id', v_external_reference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_c2b_mismatch(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_c2b_mismatch(UUID, UUID, UUID) TO service_role;
