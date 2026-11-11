-- =====================================================================
-- Muévelo Ya · 006: usuario administrador TEMPORAL (de prueba)
-- ---------------------------------------------------------------------
-- Requiere la 005. Crea la cuenta:
--     correo:     admin@mueveloya.com
--     contraseña: admin12345
-- y la registra en public.administradores, para que entre al panel de
-- administración (Perfil > "Panel de administración").
--
-- ⚠ TEMPORAL: la contraseña está escrita aquí, así que cualquiera con este
--   repositorio la conoce. Antes de publicar la app, borra la cuenta con
--   la última sentencia de este archivo (o cámbiale la contraseña desde
--   Authentication > Users).
--
-- Idempotente: si la cuenta ya existe no la duplica.
-- Si este INSERT falla por alguna columna de auth.users (cambia entre
-- versiones de Supabase), crea el usuario a mano en Authentication > Users
-- ("Add user" con Auto Confirm) y ejecuta solo el último bloque.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_id    uuid;
  v_email text := 'admin@mueveloya.com';
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt('admin12345', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}',
      '{"nombre":"Administrador","telefono":""}',
      now(), now(),
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  -- Lo marca como administrador (con o sin la inserción de arriba).
  insert into public.administradores (user_id) values (v_id)
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------
-- PARA QUITAR EL ADMINISTRADOR TEMPORAL (antes de publicar):
--   delete from auth.users where email = 'admin@mueveloya.com';
-- ---------------------------------------------------------------------
