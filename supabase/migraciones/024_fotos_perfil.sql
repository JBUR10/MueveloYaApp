-- Muévelo Ya · 024: fotos de perfil en Supabase Storage
-- Ejecutar en Supabase > SQL Editor. Se puede volver a ejecutar sin duplicar nada.
--
-- Las fotos quedan bajo foto_perfil/<id del usuario>/<archivo>.jpg.
-- El bucket perfil puede ser público o privado; la app usa enlaces firmados.

alter table public.perfiles
  add column if not exists foto_perfil text;

drop policy if exists "perfil: subir foto propia" on storage.objects;
create policy "perfil: subir foto propia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'perfil'
    and (storage.foldername(name))[1] = 'foto_perfil'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "perfil: ver foto propia" on storage.objects;
create policy "perfil: ver foto propia" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'perfil'
    and (storage.foldername(name))[1] = 'foto_perfil'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "perfil: borrar foto propia" on storage.objects;
create policy "perfil: borrar foto propia" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'perfil'
    and (storage.foldername(name))[1] = 'foto_perfil'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
