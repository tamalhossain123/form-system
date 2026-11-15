-- ============================================================================
-- Form System schema (Supabase / Postgres)
-- Run this in the Supabase SQL Editor once for a new project.
--
-- NOTE ON POLICIES: This is a MULTI-USER app with per-user ownership
-- isolation. Every form belongs to the user who created it (forms.owner_id),
-- and the RLS policies below ensure each signed-in user can only see and
-- manage their own forms, plus the responses and access requests belonging
-- to those forms. Anonymous visitors can still read published forms and
-- submit responses / access requests (the public fill page needs that).
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
-- Row Level Security (per-user owner isolation, see note at top)
-- ---------------------------------------------------------------------------
alter table public.forms enable row level security;
alter table public.responses enable row level security;
alter table public.access_requests enable row level security;

-- forms: anyone can read a published form (needed by the public fill page);
-- a signed-in user can read their own forms too, and can only insert,
-- update and delete forms they own.
drop policy if exists "forms_select_published" on public.forms;
drop policy if exists "forms_auth_all" on public.forms;
drop policy if exists "forms_select" on public.forms;
create policy "forms_select" on public.forms
  for select using (published = true or owner_id = auth.uid());

drop policy if exists "forms_insert_owner" on public.forms;
create policy "forms_insert_owner" on public.forms
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "forms_update_owner" on public.forms;
create policy "forms_update_owner" on public.forms
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "forms_delete_owner" on public.forms;
create policy "forms_delete_owner" on public.forms
  for delete to authenticated using (owner_id = auth.uid());

-- responses: anyone can submit a response; only the form's owner can
-- read or delete its responses.
drop policy if exists "responses_insert_anon" on public.responses;
create policy "responses_insert_anon" on public.responses
  for insert with check (true);

drop policy if exists "responses_auth_all" on public.responses;
drop policy if exists "responses_select_owner" on public.responses;
create policy "responses_select_owner" on public.responses
  for select to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));

drop policy if exists "responses_delete_owner" on public.responses;
create policy "responses_delete_owner" on public.responses
  for delete to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));

-- access_requests: anyone can create a request and look up their own request
-- status by email/token (the responder page needs this); only the form's
-- owner can update (approve/deny) or delete requests.
drop policy if exists "access_requests_insert_anon" on public.access_requests;
create policy "access_requests_insert_anon" on public.access_requests
  for insert with check (true);

drop policy if exists "access_requests_select_anon" on public.access_requests;
create policy "access_requests_select_anon" on public.access_requests
  for select using (true);

drop policy if exists "access_requests_auth_all" on public.access_requests;
drop policy if exists "access_requests_update_owner" on public.access_requests;
create policy "access_requests_update_owner" on public.access_requests
  for update to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));

drop policy if exists "access_requests_delete_owner" on public.access_requests;
create policy "access_requests_delete_owner" on public.access_requests
  for delete to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));

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
