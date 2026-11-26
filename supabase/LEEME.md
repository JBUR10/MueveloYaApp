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
4. [`004_corregir_estado_servicios.sql`](migraciones/004_corregir_estado_servicios.sql): corrige el estado por defecto de los servicios.
5. [`005_aprobacion_transportista.sql`](migraciones/005_aprobacion_transportista.sql): aprobación de conductores y panel de administrador.
6. [`006_admin_temporal.sql`](migraciones/006_admin_temporal.sql): cuenta de administrador de prueba.
7. [`007_notificaciones_push.sql`](migraciones/007_notificaciones_push.sql): notificaciones push, interruptor «Disponible», motivo de cancelación y recordatorios. Ver la sección 6.
8. [`008_estadisticas_admin.sql`](migraciones/008_estadisticas_admin.sql): estadísticas de pedidos (por tipo y por zona) para la sección «Estadísticas» del panel de administrador.
9. [`009_tarifas_y_consultas.sql`](migraciones/009_tarifas_y_consultas.sql): tarifa de los servicios (120.000 por los primeros 5 km + 20.000 por km adicional + 20.000 por ayudante + 10.000 por piso), calculada en la base de datos, y las consultas Q01–Q10 de la sección «Consultas SQL» del panel de administrador. Los servicios que ya existían quedan con una distancia estimada en línea recta.
10. [`010_rechazos_conductor.sql`](migraciones/010_rechazos_conductor.sql): el conductor puede rechazar solicitudes (dejan de aparecerle solo a él), y en ruta recibe push de las programadas nuevas.
11. [`011_analisis_datos_admin.sql`](migraciones/011_analisis_datos_admin.sql): análisis de pedidos para la pestaña «Análisis» del panel de administrador (KPIs, series por día y hora, motivos de cancelación).
12. [`012_analisis_negocio_admin.sql`](migraciones/012_analisis_negocio_admin.sql): análisis de negocio: mezcla de servicios y clientes (nuevos, recurrentes, inactivos).
13. [`013_cupones_y_promociones.sql`](migraciones/013_cupones_y_promociones.sql): cupones de descuento y campañas de promoción por push; el descuento se aplica sobre la tarifa.
14. [`014_ayudantes_conductor.sql`](migraciones/014_ayudantes_conductor.sql): el conductor indica si cuenta con ayudantes; sin ayudantes no le aparecen, no le llegan por push y no puede aceptar solicitudes que los piden.
15. [`015_subtotal_descuento_reportes.sql`](migraciones/015_subtotal_descuento_reportes.sql): reportes de descuentos y tarifas.
16. [`016_tipo_carga_y_recargo.sql`](migraciones/016_tipo_carga_y_recargo.sql): tipo de carga y recargos.
17. [`017_promociones_multiples_y_baja.sql`](migraciones/017_promociones_multiples_y_baja.sql): permite tener campañas simultáneas, consultar las vigentes y darlas de baja; invalida inmediatamente los cupones no usados de una campaña dada de baja.
18. [`018_pagos_stripe.sql`](migraciones/018_pagos_stripe.sql): pagos con Stripe, reembolsos, visibilidad pagada y limpieza.
19. [`019_evidencias_y_sanciones.sql`](migraciones/019_evidencias_y_sanciones.sql): fotos de evidencia (bucket privado `evidencias` en Storage). El cliente adjunta fotos a sus quejas y el transportista toma fotos de los artículos al recoger; sin ellas no puede marcar «Recogido». También crea la revisión de quejas del administrador y las sanciones: advertencia (3 = 5 días), 1 semana, 2 semanas o definitiva, más la cuenta condicionada (30 días y 15 viajes sin quejas). Requiere un APK nuevo, porque agrega `expo-image-picker`.
20. [`020_efectivo_y_webhook_stripe.sql`](migraciones/020_efectivo_y_webhook_stripe.sql): método efectivo, permisos/reintentos del webhook y retiro definitivo de Wompi. **Elimina los registros de pago sin un PaymentIntent de Stripe y las columnas heredadas de Wompi; conserva los servicios antiguos, pero deja sin método de pago los que tenían un método desconocido.**
21. [`021_retirar_trigger_pago_legacy.sql`](migraciones/021_retirar_trigger_pago_legacy.sql): elimina el trigger heredado que rechazaba Stripe al crear un servicio.
22. [`022_control_limite_promociones.sql`](migraciones/022_control_limite_promociones.sql): permite al administrador omitir el límite de una promoción por cliente en los últimos 7 días.
23. [`023_control_periodos_promociones.sql`](migraciones/023_control_periodos_promociones.sql): permite elegir los días de inactividad para reactivación y el intervalo entre promociones (incluido cero para permitir repetir).

El detalle de lo que crea la 001 está abajo.

Si ya ejecutaste hasta la 016, ejecuta la 017 y después la 022 en el SQL Editor. Si ya ejecutaste esas dos y quieres controlar los plazos, ejecuta solo la 023; no edites ni vuelvas a ejecutar las migraciones anteriores.

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

## 6. Notificaciones push (Android)

Llegan al celular aunque la app esté cerrada: aceptada, iniciada, recogida, finalizada, cancelada (con motivo), recordatorios (24 h, 1 h y «ya es la hora»), cuenta de conductor aprobada o rechazada y, a los conductores **disponibles**, solicitudes nuevas.

Funcionan **solo en el APK de Android**. No funcionan en Expo Go (desde el SDK 53) ni en web. En esos casos siguen funcionando los avisos dentro de la app.

### 6.1 Supabase

1. Ejecutar [`007_notificaciones_push.sql`](migraciones/007_notificaciones_push.sql) en el SQL Editor.
   - Si sale un error con `pg_net` o `pg_cron`, activarlas en **Database → Extensions** y volver a ejecutar.
2. Comprobar que quedó programada la tarea de recordatorios:
   ```sql
   select jobname, schedule from cron.job;   -- debe salir mueveloya-recordatorios
   ```

### 6.2 Firebase (lo hace quien administra la cuenta de Expo `mueveloyaapp`)

Android entrega las push a través de Firebase. Es gratis.

1. En [console.firebase.google.com](https://console.firebase.google.com) crear un proyecto, por ejemplo «MueveloYa». Google Analytics no es necesario.
2. **Agregar app → Android** con el paquete exacto `com.joelbur.MueveloYa`.
3. Descargar **`google-services.json`** y guardarlo en la **raíz del proyecto**, al lado de `app.json`, y subirlo al repositorio. No es secreto. `app.config.js` lo detecta solo.
4. En Firebase: **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Se descarga un JSON.
   - ⚠️ Este archivo **sí es secreto**: no va al repositorio (el `.gitignore` ya lo excluye) y no se comparte por chat.
5. Subir esa clave privada a Expo, por cualquiera de estas dos vías:
   - **Web:** [expo.dev](https://expo.dev) → proyecto *mueveloya* → **Credentials → Android → com.joelbur.MueveloYa → FCM V1 service account key → Add a service account key** → subir el JSON.
   - **Terminal:** `npx eas-cli@latest credentials` → Android → elegir el perfil → *Google Service Account* → *Manage your Google Service Account Key for Push Notifications (FCM V1)* → *Upload a new service account key*.
6. Volver a compilar el APK: GitHub → **Actions → Android APK → Run workflow**, o `npx eas-cli@latest build -p android --profile preview`.

### 6.3 Probar

1. Instalar el APK nuevo, iniciar sesión y **aceptar el permiso de notificaciones**.
2. En Supabase, revisar que el celular quedó registrado:
   ```sql
   select token, usuario_id, activo, actualizado_el from dispositivos_push;
   ```
3. Prueba rápida sin usar la app: copiar el `token` de esa tabla y enviar un mensaje desde [expo.dev/notifications](https://expo.dev/notifications).
4. Prueba real: con el celular bloqueado, desde otra cuenta en otro dispositivo, aceptar o cancelar un servicio de ese usuario.

Si en el paso 2 no aparece ninguna fila, casi siempre es porque falta `google-services.json` o la clave de Firebase en Expo, o porque el APK se compiló antes de agregarlos.

## 7. Pagos con Stripe

### Supabase

1. Ejecuta [`018_pagos_stripe.sql`](migraciones/018_pagos_stripe.sql), [`020_efectivo_y_webhook_stripe.sql`](migraciones/020_efectivo_y_webhook_stripe.sql) y [`021_retirar_trigger_pago_legacy.sql`](migraciones/021_retirar_trigger_pago_legacy.sql) en el SQL Editor.
2. Configura los secretos:
   ```sh
   supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... APP_WEB_URL=https://tu-dominio.expo.app
   ```
3. En Supabase, elimina los secretos antiguos de Wompi desde **Project Settings → Edge Functions → Secrets**. La migración no puede borrar secretos ni funciones desplegadas. Elimina también desde **Edge Functions** las funciones antiguas de esa pasarela.
4. Implementa y despliega las funciones:
   ```sh
   supabase functions deploy crear-pago reembolsar-servicio
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

### Webhook de Stripe

En Stripe Dashboard, Developers → Webhooks, crea el endpoint:

```text
https://<ref>.supabase.co/functions/v1/stripe-webhook
```

Suscríbete a:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `refund.updated`
- `charge.dispute.created`

Copia el `whsec_...` generado al secreto `STRIPE_WEBHOOK_SECRET`.

### App y compilación

1. Copia `.env.example` a `.env` y agrega `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`.
2. Agrega el mismo secreto público a GitHub Actions y a los entornos EAS `preview`/`production`.
3. Compila un desarrollo o preview nuevo:
   ```sh
   npx eas-cli@latest build -p android --profile preview
   ```
4. Los pagos nativos requieren development build; Expo Go no incluye el módulo nativo configurado.
5. Stripe debe tener habilitado el cobro en COP. Si el Dashboard no permite COP, no cambies la moneda desde el código: reporta la cuenta como pendiente de configuración.

Los montos se leen de `servicios.tarifa_acordada`. Las tarifas en COP se convierten a la unidad mínima multiplicando por 100. Stripe cobra COP desde una cuenta habilitada y el mínimo de prueba usado por esta integración es 500 COP.
