# WhatsApp directo con Meta (Cloud API)

VacunaApp puede enviar WhatsApp por **Twilio** o **directamente por la API de Meta**. Se elige con la
variable `WHATSAPP_PROVIDER` (`meta` o vacío para Twilio). Esta guía activa Meta.

## 1. Conectar el número a la API

En [WhatsApp Manager](https://business.facebook.com/wa/manage/) → **Números de teléfono → Agregar número**:

- **Coexistencia (recomendado):** si Meta lo ofrece para tu número, elige usar el número de la app
  **WhatsApp Business** y escanea el código QR desde la app (Configuración → herramientas de empresa).
  Sigues usando la app en el celular y la API envía los mensajes automáticos.
- Si no aparece la opción, las alternativas son: eliminar la cuenta de la app y registrar el número solo en
  la API (deja de funcionar en la app), o usar un número nuevo solo para VacunaApp.

## 2. Crear la app de Meta

1. [Meta for Developers](https://developers.facebook.com/apps) → **Crear app** → tipo **Empresa** → agrega el
   producto **WhatsApp** y vincúlalo a tu portafolio comercial.
2. **WhatsApp → Configuración de la API**: copia el **Identificador del número de teléfono** → `META_WA_PHONE_NUMBER_ID`.
3. **Configuración → Básica**: copia la **Clave secreta de la app** → `META_APP_SECRET`.
   Agrega la URL de la política de privacidad: `https://vacunaapp.vercel.app/privacidad`.
4. Publica la app (modo **Activo / Live**): sin esto Meta no entrega los mensajes de los pacientes al webhook.

## 3. Token permanente

[Configuración del negocio](https://business.facebook.com/settings) → **Usuarios del sistema** → agregar
(rol administrador) → **Asignar activos**: la app (control total) y la cuenta de WhatsApp → **Generar token**
con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`, caducidad **Nunca**
→ `META_WA_TOKEN`.

## 4. Variables en Vercel

| Variable | Valor |
| --- | --- |
| `WHATSAPP_PROVIDER` | `meta` |
| `META_WA_TOKEN` | token del paso 3 |
| `META_WA_PHONE_NUMBER_ID` | identificador del paso 2 |
| `META_APP_SECRET` | clave secreta del paso 2 |
| `META_WEBHOOK_VERIFY_TOKEN` | un texto largo que inventas (lo pegas también en Meta) |
| `META_PLANTILLA_RECORDATORIO` | `recordatorio_cita` |
| `META_PLANTILLA_CAMPANA` | `dosis_pendiente` |
| `META_PLANTILLA_CARNE` | `carne_vacunacion` |
| `META_PLANTILLAS_IDIOMA` | `es` |

Después de guardarlas, vuelve a desplegar.

## 5. Webhook

App de Meta → **WhatsApp → Configuración → Webhook**:

- URL de devolución de llamada: `https://vacunaapp.vercel.app/api/whatsapp/meta`
- Token de verificación: el mismo `META_WEBHOOK_VERIFY_TOKEN`
- **Administrar** → suscribirse al campo **messages**

## 6. Plantillas (WhatsApp Manager → Plantillas de mensajes → Crear)

Categoría **Utilidad**, idioma **Español**. Los nombres y el orden de las variables deben ser exactamente estos.
En los ejemplos de variables usa datos ficticios.

### `recordatorio_cita`

```
Hola {{1}}, te recordamos que mañana {{2}} tienes tu cita para la dosis {{3}} de {{4}} en {{5}}.

Toca un botón o responde 1 para confirmar o 2 para reprogramar.
```
- Pie de página: `Responde SALIR si no deseas recibir más mensajes`
- Botones de respuesta rápida: `Confirmar`, `Reprogramar`
- Ejemplos: María · jueves 15 de octubre · 2 · Hepatitis B · Centro de Vacunación Vida Plena

### `dosis_pendiente`

```
Hola {{1}}, en {{2}} tenemos registrado que tienes pendiente la dosis {{3}} de {{4}}, que te correspondía el {{5}}.

¿Quieres agendar tu cita? Toca un botón o responde 1 para agendar o 2 si ya te la aplicaste.
```
- Pie de página: `Responde SALIR si no deseas recibir más mensajes`
- Botones de respuesta rápida: `Agendar`, `Ya me vacuné`
- Ejemplos: María · Centro de Vacunación Vida Plena · 2 · Hepatitis B · jueves 10 de septiembre
- Meta puede reclasificarla como **Marketing** (tarifa mayor). Si pasa, se puede usar igual.

### `carne_vacunacion`

```
Hola {{1}}, tu carné de vacunación de {{2}} está actualizado.

Consúltalo y muestra su código QR desde este enlace: {{3}}

Guárdalo para cuando te lo soliciten.
```
- Pie de página: `Responde SALIR si no deseas recibir más mensajes`
- Ejemplos: María · Centro de Vacunación Vida Plena · https://vacunaapp.vercel.app/carne/EjemploToken123

## Cómo funcionan las respuestas

- Los botones envían su texto (`Confirmar`, `Reprogramar`, `Agendar`, `Ya me vacuné`); el bot los entiende
  igual que si el paciente escribiera 1 o 2. `SALIR` y `ALTA` gestionan la autorización (Ley 1581).
- Las respuestas del bot son texto libre: Meta lo permite durante 24 h después del último mensaje del paciente.
- Meta cobra por las plantillas que inicia el centro, no por las respuestas dentro de esa ventana; configura
  un método de pago en WhatsApp Manager.
