# VacunaApp

Plataforma multi-centro (SaaS) para centros de vacunación: pacientes, aplicación de dosis, agenda, inventario por lote,
recordatorios por WhatsApp y correo, campañas para pacientes atrasados y carné digital con QR.

- **Aplicación:** Next.js 16 (App Router) + React 19 + Tailwind, desplegada en Vercel.
- **Datos, login y logos:** Supabase (Postgres con RLS, Auth, Storage, Realtime).
- **Mensajería:** Twilio (WhatsApp / SMS) y Resend (correo).
- **Cobro de suscripciones:** Mercado Pago.

> Esta versión de Next.js tiene cambios respecto a lo habitual (por ejemplo `proxy.ts` en lugar de `middleware.ts`).
> Ante la duda, consulta `node_modules/next/dist/docs/` (ver `AGENTS.md`).

## Módulos

| Ruta | Qué hace | Rol |
|---|---|---|
| `/` | Página comercial (precios, calculadora de ROI, solicitud de prueba) | público |
| `/login`, `/recuperar` | Acceso y recuperación de contraseña con código por correo | público |
| `/carne/[token]` | Carné de vacunación del paciente (enlace secreto + QR) | público |
| `/dashboard` | Resumen y estado de recordatorios | ADMIN, VACUNADOR |
| `/dashboard/pacientes`, `vacunacion`, `agenda` | Pacientes, registro de dosis y agenda | ADMIN, VACUNADOR |
| `/dashboard/recordatorios`, `atrasados` | Monitor de envíos y campañas de pacientes atrasados | ADMIN, VACUNADOR |
| `/dashboard/vacunas`, `inventario`, `reportes` | Catálogo, lotes y existencias, reportes | según módulo |
| `/dashboard/establecimiento`, `usuarios`, `suscripcion` | Datos del centro, equipo y plan | ADMIN |
| `/plataforma` | Alta y suspensión de centros, confirmación de pagos | superadministrador |

## Puesta en marcha en local

Requisitos: Node.js 20 o superior y un proyecto de Supabase.

```bash
npm install
cp .env.local.example .env.local     # y completa los valores (ver la tabla de abajo)
npm run dev                           # http://localhost:3000
```

### Base de datos

Ejecuta en el **Editor SQL** de Supabase, en este orden:

1. `supabase/vacunaapp_esquema_completo.sql`: esquema completo (tablas, funciones, RLS, storage). Es idempotente: sirve
   para una base nueva o para actualizar una existente sin perder datos. Haz un respaldo antes.
2. `supabase/recuperacion.sql`: tabla y funciones de la recuperación de contraseña. También es idempotente; **se debe
   volver a ejecutar cada vez que cambie** (agrega, por ejemplo, el conteo atómico de intentos).
3. `supabase/seed.sql` (opcional): datos de demostración. No lo uses en producción.

Los demás `.sql` de la carpeta son los archivos históricos que el esquema completo reemplaza.

Para crear el primer superadministrador, registra su usuario en Authentication y agrégalo a la tabla `plataforma_admins`
(`insert into plataforma_admins (user_id) values ('<uuid del usuario>');`). Los centros y sus usuarios se crean desde `/plataforma`.

### Variables de entorno

Plantilla completa y comentada en `.env.local.example`. Nunca subas `.env.local` a Git.

| Variable | Para qué | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión desde el navegador | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servidor (ignora RLS). **Nunca exponerla.** También firma los códigos de recuperación | Sí |
| `RESEND_API_KEY`, `RESEND_FROM` | Correos (recordatorios, recuperación, alertas) | Sí |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | WhatsApp vía Twilio | Sí |
| `TWILIO_USE_SMS`, `TWILIO_SMS_FROM` | Usar SMS en lugar de WhatsApp | No |
| `TWILIO_WHATSAPP_CONTENT_SID`, `TWILIO_CAMPANA_CONTENT_SID`, `TWILIO_CARNE_CONTENT_SID` | Plantillas aprobadas por Meta. Vacío = texto libre (solo sandbox) | Para producción |
| `APP_URL`, `TWILIO_WEBHOOK_URL` | URL pública (enlaces del carné y validación de firma de Twilio). En Vercel se detecta sola | En local con ngrok |
| `CRON_SECRET` | Protege `/api/cron/reminders` | Sí |
| `REPROGRAMAR_OPCIONES` | Fechas que se ofrecen al reprogramar por WhatsApp (4 por defecto) | No |
| `DEFAULT_COUNTRY_CODE`, `NEXT_PUBLIC_DEFAULT_COUNTRY_CODE`, `APP_TIMEZONE` | País y zona horaria (57, `America/Bogota`) | Sí |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Cobro automático de suscripciones. Sin ellos se usan los links fijos y el superadmin confirma cada pago | No |

### WhatsApp en local

Los webhooks de Twilio necesitan una URL pública: ejecuta `ngrok http 3000` y usa esa URL en `APP_URL` y
`TWILIO_WEBHOOK_URL`. En Twilio configura:

- **Mensajes entrantes:** `POST https://<tu-dominio>/api/whatsapp/webhook`
- El estado de entrega (`/api/whatsapp/estado`) se registra solo al enviar cada mensaje.

**Números de WhatsApp.** Los centros no necesitan número propio ni verificación de Meta: todos envían desde el número
compartido de VacunaApp (`TWILIO_WHATSAPP_FROM`), que se registra una sola vez en Twilio/Meta, y cada mensaje lleva el
nombre del centro. Si un centro necesita su propio remitente, el superadmin puede asignarle un número comprado en la
cuenta de Twilio de la plataforma desde `/plataforma` (campo `whatsapp_from`). Un número que ya tiene WhatsApp no puede
usarse en Twilio.

El sandbox de Twilio solo entrega a quien escribió al número en las últimas 24 horas. Para pacientes reales hace falta
un número aprobado y las plantillas aprobadas por Meta.

## Pruebas y calidad

```bash
npm test          # pruebas unitarias (Vitest), carpeta tests/
npm run test:watch
npm run lint
npx tsc --noEmit  # revisión de tipos
```

Las pruebas cubren: normalización de teléfonos, agenda y cupos, estado de la suscripción, validaciones de pacientes,
vacunas y lotes, mensajes y campañas, el flujo de envío de recordatorios (con servicios externos simulados), y las piezas
de seguridad (códigos de recuperación y firma del webhook de Mercado Pago). No tocan Supabase ni envían mensajes reales.
Aún no hay pruebas de las rutas `/api` ni de las reglas RLS contra una base real.

## Despliegue (Vercel)

1. Importa el repositorio en Vercel y define las variables de entorno de la tabla anterior.
2. `vercel.json` programa el cron diario `/api/cron/reminders` (13:00 UTC = 8:00 a. m. en Colombia). Vercel lo llama con
   `Authorization: Bearer <CRON_SECRET>`. El cron envía los recordatorios de las dosis de mañana y los avisos de
   inventario y suscripción.
3. Configura los webhooks externos: Twilio (arriba) y, si usas cobro automático, Mercado Pago
   (`POST /api/suscripcion/webhook`, evento *Pagos*).
4. En producción usa Supabase Pro (el plan gratis se pausa y no tiene respaldos) y Vercel Pro (Hobby no permite uso
   comercial). Costos y alternativas de migración en [`docs/MIGRACION_Y_COSTOS.md`](docs/MIGRACION_Y_COSTOS.md).

### Lista de verificación antes de vender a un centro real

- [ ] Registro abierto desactivado en Supabase (Authentication > Sign In / Providers).
- [ ] Dominio verificado en Resend (si no, los correos solo llegan al dueño de la cuenta).
- [ ] Número de WhatsApp y plantillas aprobadas por Meta (los tres `*_CONTENT_SID`).
- [ ] `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` definidas solo en Vercel.
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` si se activa el cobro automático.
- [ ] Respaldos de Supabase activos (plan Pro).

## Seguridad

- Cada centro solo ve sus datos: RLS en todas las tablas con `centro_actual()` y `rol_actual()`. El `service_role` se usa
  solo en el servidor, siempre tras validar sesión, rol y centro (`src/lib/auth.ts`).
- Los webhooks de Twilio se validan por firma; el cron, por `CRON_SECRET`; los pagos se consultan siempre a Mercado Pago.
- Recuperación de contraseña: código de 6 dígitos, 5 intentos contados de forma atómica en la base, máximo 5 códigos por
  hora por correo, respuesta que no delata qué correos tienen cuenta, y cierre de las sesiones abiertas al cambiar la clave.
- Cabeceras de seguridad (CSP, `X-Frame-Options`, etc.) en `next.config.mjs`.
- Los mensajes respetan la autorización del paciente (Ley 1581 de 2012) y toda campaña incluye cómo darse de baja.

## Estructura

```
src/app/          páginas y rutas API (App Router)
src/components/   componentes de interfaz
src/lib/          lógica de negocio sin interfaz (teléfonos, agenda, recordatorios, suscripción, notificaciones…)
src/proxy.ts      protege /dashboard y /plataforma
supabase/         esquema SQL y scripts
tests/            pruebas unitarias
docs/             migración y costos
```
