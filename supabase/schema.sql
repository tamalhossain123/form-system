-- ============================================================================
-- Form System schema (Supabase / Postgres)
-- Run this in the Supabase SQL Editor once for a new project.
--
-- NOTE ON POLICIES: This is a SINGLE-OWNER app (one admin builds forms,
-- the public only fills them in). The RLS policies below are therefore
-- deliberately permissive: anonymous visitors can read published forms and
-- submit responses / access requests, and the authenticated owner can do
-- everything. Do not reuse these policies for a multi-tenant product.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- forms
-- ---------------------------------------------------------------------------
create table if not exists public.forms (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  title       text not null default 'Untitled form',
  description text default '',
  structure   jsonb not null default '{"sections":[]}'::jsonb,
  settings    jsonb not null default '{"access":"public","acceptingResponses":true,"confirmationMessage":"Your response has been recorded."}'::jsonb,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- responses
-- ---------------------------------------------------------------------------
create table if not exists public.responses (
  id               uuid primary key default gen_random_uuid(),
  form_id          uuid not null references public.forms(id) on delete cascade,
  answers          jsonb not null default '{}'::jsonb,
  respondent_email text,
  submitted_at     timestamptz not null default now()
);

create index if not exists responses_form_id_idx on public.responses(form_id);

-- ---------------------------------------------------------------------------
-- access_requests (used when a form's access setting is "private")
-- ---------------------------------------------------------------------------
create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.forms(id) on delete cascade,
  name         text,
  email        text not null,
  message      text,
  status       text not null default 'pending', -- pending | approved | denied
  access_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

create index if not exists access_requests_form_id_idx on public.access_requests(form_id);

-- ---------------------------------------------------------------------------
-- storage: public bucket "uploads" for file-upload answers and question images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security (single-owner permissive, see note at top)
-- ---------------------------------------------------------------------------
alter table public.forms enable row level security;
alter table public.responses enable row level security;
alter table public.access_requests enable row level security;

-- forms: anyone can read a published form (needed by the public fill page);
-- the authenticated owner can do everything.
drop policy if exists "forms_select_published" on public.forms;
create policy "forms_select_published" on public.forms
  for select using (published = true);

drop policy if exists "forms_auth_all" on public.forms;
create policy "forms_auth_all" on public.forms
  for all to authenticated using (true) with check (true);

-- responses: anyone can submit a response; the owner can read/delete them.
drop policy if exists "responses_insert_anon" on public.responses;
create policy "responses_insert_anon" on public.responses
  for insert with check (true);

drop policy if exists "responses_auth_all" on public.responses;
create policy "responses_auth_all" on public.responses
  for all to authenticated using (true) with check (true);

-- access_requests: anyone can create a request and look up their own request
-- status by email/token (the responder page needs this); owner manages all.
drop policy if exists "access_requests_insert_anon" on public.access_requests;
create policy "access_requests_insert_anon" on public.access_requests
  for insert with check (true);

drop policy if exists "access_requests_select_anon" on public.access_requests;
create policy "access_requests_select_anon" on public.access_requests
  for select using (true);

drop policy if exists "access_requests_auth_all" on public.access_requests;
create policy "access_requests_auth_all" on public.access_requests
  for all to authenticated using (true) with check (true);

-- storage policies for the uploads bucket: public read, anyone can upload.
drop policy if exists "uploads_public_read" on storage.objects;
create policy "uploads_public_read" on storage.objects
  for select using (bucket_id = 'uploads');

drop policy if exists "uploads_insert" on storage.objects;
create policy "uploads_insert" on storage.objects
  for insert with check (bucket_id = 'uploads');

drop policy if exists "uploads_auth_all" on storage.objects;
create policy "uploads_auth_all" on storage.objects
  for all to authenticated using (bucket_id = 'uploads') with check (bucket_id = 'uploads');
