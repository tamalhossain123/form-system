-- ============================================================================
-- Migration: per-user ownership isolation (run once in the SQL Editor).
-- Before this, any signed-in user could see and edit every form.
-- After this, each user sees and manages ONLY their own forms and their
-- responses / access requests. The public can still open published form
-- links and submit responses / access requests.
-- ============================================================================

-- forms ---------------------------------------------------------------------
drop policy if exists "forms_select_published" on public.forms;
drop policy if exists "forms_auth_all" on public.forms;

create policy "forms_select" on public.forms
  for select using (published = true or owner_id = auth.uid());

create policy "forms_insert_owner" on public.forms
  for insert to authenticated with check (owner_id = auth.uid());

create policy "forms_update_owner" on public.forms
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "forms_delete_owner" on public.forms
  for delete to authenticated using (owner_id = auth.uid());

-- responses -----------------------------------------------------------------
drop policy if exists "responses_auth_all" on public.responses;
-- (responses_insert_anon stays: anyone can submit to a form they can open)

create policy "responses_select_owner" on public.responses
  for select to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));

create policy "responses_delete_owner" on public.responses
  for delete to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));

-- access_requests -------------------------------------------------------------
drop policy if exists "access_requests_auth_all" on public.access_requests;
-- (insert_anon and select_anon stay: the responder page needs to create a
-- request and to look up its own approval status by email / token link)

create policy "access_requests_update_owner" on public.access_requests
  for update to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()))
  with check (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));

create policy "access_requests_delete_owner" on public.access_requests
  for delete to authenticated using (
    exists (select 1 from public.forms f
            where f.id = form_id and f.owner_id = auth.uid()));
