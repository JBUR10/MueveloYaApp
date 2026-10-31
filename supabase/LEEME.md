# Configuración de Supabase — Muévelo Ya

Pasos para dejar listo el proyecto de Supabase después de traer la rama con login y modo transportista.

## 1. Revisar la tabla actual (solo lectura)

En **SQL Editor**, ejecutar y guardar el resultado:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public';
```

La migración supone que `public.servicios` tiene `id uuid`, `user_id` (con default `auth.uid()`) y políticas RLS para el dueño. Si algo no coincide, avisar antes de seguir.

## 2. Ejecutar las migraciones (en orden)

Pegar y ejecutar cada archivo en el SQL Editor. Todos se pueden volver a correr sin duplicar nada.

1. [`001_login_y_transportista.sql`](migraciones/001_login_y_transportista.sql): perfiles, vehículos, estados y flujo del transportista.
2. [`002_vigencia_maxima_un_anio.sql`](migraciones/002_vigencia_maxima_un_anio.sql): SOAT y técnico-mecánica con vigencia máxima de un año.
3. [`003_avisos_calificaciones_programados.sql`](migraciones/003_avisos_calificaciones_programados.sql): avisos, calificaciones, quejas, inicio de programados, cancelación del cliente y margen entre servicios.

El detalle de lo que crea la 001 está abajo.

Crea lo siguiente:

- las tablas `perfiles`, `vehiculos` y `cancelaciones`;
- en `servicios`, las columnas `estado` y `transportista_id`;
- las políticas RLS;
- las funciones `aceptar_servicio`, `cancelar_servicio`, `marcar_recogido` y `completar_servicio`;
- la activación de Realtime en `servicios`.

## 3. Autenticación (Authentication)

1. **Sign In / Providers → Email**: activo.
2. **Anonymous sign-ins**: desactivar. La app ya no los usa.
3. **Email Templates**: la app pide un **código** en vez de un enlace.
   - *Confirm signup*: el cuerpo debe incluir `{{ .Token }}`. Ejemplo: `Tu código de Muévelo Ya es: <b>{{ .Token }}</b>`.
   - *Reset password*: lo mismo, con `{{ .Token }}`.

## 4. Límites del correo gratuito

El servicio de correo incluido en Supabase:

- envía **2 correos por hora** para todo el proyecto;
- **solo entrega a correos de los miembros del equipo** de la organización. A cualquier otro correo responde `email_address_not_authorized`.

Cómo probar sin gastar esos envíos:

| Situación | Qué hacer |
|---|---|
| Desarrollo diario | Desactivar **Confirm email** (Providers → Email). El registro entra directo, sin código, y la app lo maneja sola. |
| Probar varias cuentas | **Authentication → Users → Add user → Create new user**, marcando *Auto Confirm User*. No envía correo. Luego se completa el nombre en la tabla `perfiles`. |
| Probar el flujo con código | Usar los correos del equipo y reactivar **Confirm email**. |
| Demo con el profesor (correos externos) | Configurar SMTP propio en **Project Settings → Authentication → SMTP** (por ejemplo Gmail con contraseña de aplicación o Brevo). Así se permiten correos de cualquier persona y el límite se ajusta en **Rate Limits**. |

## 5. Variables de entorno

Copiar `.env.example` a `.env` con la URL del proyecto y la clave **publishable**, que están en **Project Settings → API Keys**. Después reiniciar con `npx expo start -c`.
