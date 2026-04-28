create extension if not exists pgcrypto;

create table if not exists public.invoice_counter (
  invoice_year int primary key,
  last_sequence int not null default 0
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_year int not null,
  invoice_sequence int not null,
  invoice_number text not null unique,
  company_name text,
  company_address text,
  company_email text,
  company_phone text,
  vat_number text,
  client_name text,
  client_address text,
  client_email text,
  client_phone text,
  job_title text,
  job_description text,
  job_status text default 'Draft',
  start_time timestamptz,
  stop_time timestamptz,
  start_location jsonb,
  stop_location jsonb,
  site_hours numeric default 0,
  workers int default 1,
  billable_hours numeric default 0,
  hourly_rate numeric default 0,
  callout_fee numeric default 0,
  expenses jsonb default '[]'::jsonb,
  subtotal numeric default 0,
  vat numeric default 0,
  total numeric default 0,
  deposit numeric default 0,
  payments jsonb default '[]'::jsonb,
  total_paid numeric default 0,
  balance numeric default 0,
  payment_status text default 'Unpaid',
  terms_accepted boolean default false,
  final_locked boolean default false,
  created_at timestamptz default now(),
  issued_at timestamptz
);

create or replace function public.create_invoice(payload jsonb)
returns public.invoices
language plpgsql
security definer
as $$
declare
  y int := extract(year from now());
  seq int;
  inv text;
  row public.invoices;
begin
  insert into public.invoice_counter(invoice_year, last_sequence)
  values (y, 1)
  on conflict (invoice_year)
  do update set last_sequence = public.invoice_counter.last_sequence + 1
  returning last_sequence into seq;

  inv := 'INV-' || y || '-' || lpad(seq::text, 4, '0');

  insert into public.invoices (
    invoice_year, invoice_sequence, invoice_number,
    company_name, company_address, company_email, company_phone, vat_number,
    client_name, client_address, client_email, client_phone,
    job_title, job_description, job_status,
    start_time, stop_time, start_location, stop_location,
    site_hours, workers, billable_hours, hourly_rate, callout_fee,
    expenses, subtotal, vat, total, deposit, payments, total_paid, balance,
    payment_status, terms_accepted, final_locked, issued_at
  ) values (
    y, seq, inv,
    payload->>'company_name', payload->>'company_address', payload->>'company_email', payload->>'company_phone', payload->>'vat_number',
    payload->>'client_name', payload->>'client_address', payload->>'client_email', payload->>'client_phone',
    payload->>'job_title', payload->>'job_description', coalesce(payload->>'job_status', 'Issued'),
    nullif(payload->>'start_time','')::timestamptz, nullif(payload->>'stop_time','')::timestamptz,
    coalesce(payload->'start_location','null'::jsonb), coalesce(payload->'stop_location','null'::jsonb),
    coalesce((payload->>'site_hours')::numeric,0), coalesce((payload->>'workers')::int,1), coalesce((payload->>'billable_hours')::numeric,0),
    coalesce((payload->>'hourly_rate')::numeric,0), coalesce((payload->>'callout_fee')::numeric,0),
    coalesce(payload->'expenses','[]'::jsonb), coalesce((payload->>'subtotal')::numeric,0), coalesce((payload->>'vat')::numeric,0),
    coalesce((payload->>'total')::numeric,0), coalesce((payload->>'deposit')::numeric,0), coalesce(payload->'payments','[]'::jsonb),
    coalesce((payload->>'total_paid')::numeric,0), coalesce((payload->>'balance')::numeric,0),
    coalesce(payload->>'payment_status','Unpaid'), coalesce((payload->>'terms_accepted')::boolean,false), coalesce((payload->>'final_locked')::boolean,false), now()
  ) returning * into row;

  return row;
end;
$$;

-- Demo policy: enable insert/select for anon during prototype.
-- For production, replace with real Supabase Auth policies.
alter table public.invoices enable row level security;
alter table public.invoice_counter enable row level security;

drop policy if exists "demo invoices read" on public.invoices;
drop policy if exists "demo invoices insert" on public.invoices;
create policy "demo invoices read" on public.invoices for select using (true);
create policy "demo invoices insert" on public.invoices for insert with check (true);
