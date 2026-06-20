-- ================================================================
-- SpeakPay — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────────
create table if not exists public.users (
  id            uuid primary key default uuid_generate_v4(),
  phone         text unique not null,          -- e.g. 9841234567
  full_name     text not null,
  pin_hash      text not null,                 -- bcrypt hash of 6-digit PIN
  created_at    timestamptz default now()
);

-- ── Wallets ──────────────────────────────────────────────────────
create table if not exists public.wallets (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid unique not null references public.users(id) on delete cascade,
  balance       numeric(12,2) not null default 0.00,
  updated_at    timestamptz default now()
);

-- ── Transactions ─────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_type') THEN
        CREATE TYPE public.tx_type AS ENUM ('load', 'send', 'receive');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tx_status') THEN
        CREATE TYPE public.tx_status AS ENUM ('pending', 'completed', 'failed');
    END IF;
END$$;

create table if not exists public.transactions (
  id              uuid primary key default uuid_generate_v4(),
  wallet_id       uuid not null references public.wallets(id),
  type            public.tx_type not null,
  amount          numeric(12,2) not null,
  balance_after   numeric(12,2) not null,
  counterparty_id uuid references public.wallets(id),  -- null for load
  note            text,
  voice_command   text,     -- raw transcript that triggered this tx
  status          public.tx_status default 'completed',
  created_at      timestamptz default now()
);

-- ── ASR Logs (for research / demo page) ──────────────────────────
create table if not exists public.asr_logs (
  id              uuid primary key default uuid_generate_v4(),
  transcript      text not null,
  model_used      text not null,   -- 'base' | 'general' | 'domain'
  wer_estimate    numeric(5,2),
  intent          text,            -- 'send' | 'load' | 'balance' | 'unknown'
  created_at      timestamptz default now()
);

-- ── Indexes ───────────────────────────────────────────────────────
create index if not exists idx_transactions_wallet   on public.transactions(wallet_id);
create index if not exists idx_transactions_created  on public.transactions(created_at desc);
create index if not exists idx_asr_logs_model        on public.asr_logs(model_used);

-- ── Row Level Security ────────────────────────────────────────────
alter table public.users         enable row level security;
alter table public.wallets       enable row level security;
alter table public.transactions  enable row level security;
alter table public.asr_logs      enable row level security;

-- Service role bypasses RLS (used by our API routes)
-- Anon / authenticated policies (API routes use service key so RLS won't block)
drop policy if exists "service_all_users" on public.users;
create policy "service_all_users"        on public.users        using (true) with check (true);
drop policy if exists "service_all_wallets" on public.wallets;
create policy "service_all_wallets"      on public.wallets      using (true) with check (true);
drop policy if exists "service_all_transactions" on public.transactions;
create policy "service_all_transactions" on public.transactions using (true) with check (true);
drop policy if exists "service_all_asr_logs" on public.asr_logs;
create policy "service_all_asr_logs"     on public.asr_logs     using (true) with check (true);

-- ── Helper function: atomic transfer ─────────────────────────────
create or replace function public.transfer_funds(
  p_from_wallet_id  uuid,
  p_to_wallet_id    uuid,
  p_amount          numeric,
  p_voice_command   text default null
) returns json
language plpgsql security definer as $$
declare
  v_from_balance  numeric;
  v_to_balance    numeric;
  v_tx_from_id    uuid;
  v_tx_to_id      uuid;
begin
  -- Lock both rows in consistent order to prevent deadlocks
  select balance into v_from_balance
    from public.wallets
    where id = p_from_wallet_id for update;

  if v_from_balance < p_amount then
    return json_build_object('success', false, 'error', 'insufficient_funds');
  end if;

  -- Debit sender
  update public.wallets
    set balance = balance - p_amount, updated_at = now()
    where id = p_from_wallet_id
    returning balance into v_from_balance;

  -- Credit receiver
  update public.wallets
    set balance = balance + p_amount, updated_at = now()
    where id = p_to_wallet_id
    returning balance into v_to_balance;

  -- Log send transaction
  insert into public.transactions
    (wallet_id, type, amount, balance_after, counterparty_id, voice_command)
    values (p_from_wallet_id, 'send', p_amount, v_from_balance, p_to_wallet_id, p_voice_command)
    returning id into v_tx_from_id;

  -- Log receive transaction
  insert into public.transactions
    (wallet_id, type, amount, balance_after, counterparty_id, voice_command)
    values (p_to_wallet_id, 'receive', p_amount, v_to_balance, p_from_wallet_id, p_voice_command)
    returning id into v_tx_to_id;

  return json_build_object(
    'success', true,
    'from_balance', v_from_balance,
    'to_balance', v_to_balance,
    'tx_id', v_tx_from_id
  );
end;
$$;
