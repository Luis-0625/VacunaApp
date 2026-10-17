# Guía de prueba completa de VacunaApp

Recorrido paso a paso para probar todo el sistema en https://vacunaapp.vercel.app **con datos ficticios** antes de
entregárselo a un centro real. Cada paso dice qué hacer y qué debería pasar. Marca ✅ si pasó y anota lo que no.

> **Regla de oro:** usa solo datos inventados y tus propios números y correos. No cargues pacientes reales ni escribas a
> terceros durante la prueba.

Tiempo estimado: 1 hora y media. Las partes 6 y 7 (mensajes) se pueden hacer otro día.

---

## Parte 0 · Preparación (una sola vez)

### 0.1 Supabase

1. Haz un **respaldo**: en Supabase (Project Settings → Database → Backups, si tu plan lo incluye) o, como mínimo, entra a la
   app como ADMIN y descarga el Excel completo de datos (función de exportar).
2. En **SQL Editor**, ejecuta estos archivos de la carpeta `supabase/` en este orden. Todos se pueden repetir sin riesgo:

   | Orden | Archivo | Para qué |
   |---|---|---|
   | 1 | `vacunaapp_esquema_completo.sql` | Tablas, permisos y reglas (solo si la base es nueva o quieres actualizarla) |
   | 2 | `recuperacion.sql` | Recuperar contraseña |
   | 3 | `rate_limit.sql` | Límite de peticiones |
   | 4 | `auditoria.sql` | Auditoría y anonimización de pacientes |

   ✅ Cada uno termina con **Success**, sin errores en rojo.
3. **Authentication → Sign In / Providers →** desactiva **Allow new users to sign up**.
4. Comprueba que existe tu usuario superadministrador (el que entra a `/plataforma`).

### 0.2 Vercel

1. El último despliegue debe estar en **Ready** y corresponder al último commit de `main`.
2. En **Settings → Environment Variables** deben existir, como mínimo: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `CRON_SECRET`, `DEFAULT_COUNTRY_CODE`, `APP_TIMEZONE`.
   Si cambias una variable, haz un nuevo despliegue (Redeploy).

### 0.3 WhatsApp (sandbox de Twilio)

1. En Twilio → **Messaging → Try it out → Send a WhatsApp message**, anota el número del sandbox y la frase `join xxxx-xxxx`.
2. Desde **tu** WhatsApp, envía esa frase al número del sandbox. Responde "You are all set".
3. En **Sandbox settings → When a message comes in**, pon `https://vacunaapp.vercel.app/api/whatsapp/webhook` con método
   **POST** y guarda.
4. Recuerda: el sandbox solo entrega a quien escribió en las **últimas 24 horas**. Si pasa más tiempo, vuelve a enviar
   cualquier mensaje al número del sandbox.

### 0.4 Correo (Resend)

Sin dominio verificado, Resend **solo entrega a la cuenta dueña**. Para la prueba, usa como correo del paciente de prueba
el mismo correo con el que abriste tu cuenta de Resend.

---

## Parte 1 · Crear el centro de prueba

1. Entra a https://vacunaapp.vercel.app/login con tu usuario superadministrador y ve a **Plataforma**.
2. **Nuevo centro de vacunación**: nombre `Centro de Prueba`, ciudad, y los datos del administrador (nombre, un correo
   tuyo y una contraseña de 8 o más caracteres).
   ✅ El centro aparece en la lista y trae 4 vacunas: Hepatitis B, Influenza, COVID-19 y Tétanos/Difteria.
3. Cierra sesión y entra con el **administrador del centro de prueba**.
   ✅ Ves el menú completo (Resumen, Agenda, Atrasados, Vacunación, Pacientes, Inventario, Recordatorios, Vacunas,
   Reportes, Usuarios, Auditoría, Carga inicial, Establecimiento, Suscripción).

## Parte 2 · Establecimiento

1. Ve a **Establecimiento** y completa nombre, dirección, teléfono, horario y color.
2. Marca los **días de atención** y pon cupos por día en `2`.
   ✅ Se guarda sin error y el nombre/color se ven en el menú.

---

## Parte 3 · Carga inicial desde Excel

1. Ve a **Carga inicial** → **Descargar plantilla (.xlsx)**.
   ✅ Abre con una hoja *Inicio* y cuatro hojas de colores (1. Vacunas, 2. Pacientes, 3. Dosis aplicadas, 4. Inventario actual).
2. Llena la plantilla con estos datos de prueba. Escribe desde la **fila 3** (debajo de la fila gris de ejemplo, o encima de
   ella, como prefieras). Las fechas son relativas a **hoy**; escríbelas como día/mes/año.

**1. Vacunas** (agrega una nueva; las otras 4 ya existen)

| Vacuna | Dosis totales | Intervalo en días | Existencias mínimas |
|---|---|---|---|
| Polio | 3 | 60 | 5 |

**2. Pacientes**

| Nombre completo | Documento | Teléfono | Correo | Autoriza mensajes |
|---|---|---|---|---|
| Prueba Uno | 90000001 | **tu celular con WhatsApp** | **correo de tu cuenta Resend** | SI |
| Prueba Dos | 90000002 | 3000000002 | | NO |
| Prueba Tres | 90000003 | 3000000003 | | *(vacío)* |
| Prueba Cuatro | 90000004 | 12 | | SI |

La última fila tiene un teléfono inválido **a propósito**.

> Usa **tu celular solo en Prueba Uno**. Si dos pacientes comparten el mismo número, el bot los agrupa en un solo mensaje y
> la prueba se confunde (Prueba Dos y Tres llevan números inventados que no existen).

**3. Dosis aplicadas**

| Documento | Vacuna | Fecha de aplicación | Número de dosis | Fecha próxima dosis |
|---|---|---|---|---|
| 90000001 | Hepatitis B | hace 30 días | | **mañana** |
| 90000002 | Hepatitis B | hace 40 días | | |
| 90000003 | Influenza | hace 20 días | | |
| 90000001 | COVID-19 | hace 60 días | | |
| 90000001 | COVID-19 | hace 30 días | | |
| 99999999 | Hepatitis B | hace 10 días | | |

La última fila usa un documento que no existe, **a propósito**.

**4. Inventario actual**

| Vacuna | Número de lote | Fecha de vencimiento | Existencias actuales |
|---|---|---|---|
| Hepatitis B | HB-TEST-1 | dentro de 1 año | 20 |
| Polio | PO-TEST-1 | dentro de 6 meses | 3 |

3. Sube el archivo en **Carga inicial** y pulsa **Cargar datos**.

**Qué debe pasar**

- ✅ Se cargan en orden: Vacunas → Pacientes → Dosis aplicadas → Inventario.
- ✅ Vacunas: 1 cargada. Pacientes: 3 cargados y **1 con error** (fila 6, teléfono inválido). Dosis: 5 cargadas y **1 con
  error** (fila 8, "El paciente no existe"). Los números de fila son los de tu Excel si empezaste en la fila 3. Inventario: 2 cargados.
- ✅ Los errores indican la **fila real del Excel**.
- ✅ Las dos filas de COVID-19 del paciente 90000001 quedan como **dosis 1 y dosis 2** (esquema completo) y sin próxima dosis.
- ✅ Vuelve a subir **el mismo archivo**: no duplica nada; dice que las filas ya existían (omitidas).
- ✅ Corrige las filas con error, vuelve a subir y carga solo esas.

### Verificación

- **Pacientes:** aparecen Prueba Uno, Dos y Tres, con su etiqueta de autorización.
- **Atrasados:** aparece Prueba Dos (Hepatitis B, hace 40 días + 30 de intervalo = atrasada 10 días), marcada "No autoriza mensajes".
- **Inventario:** Hepatitis B con 20 dosis; Polio con 3, y una **alerta** de "bajo el mínimo" (mínimo 5).
- **Recordatorios:** hay uno **pendiente** para Prueba Uno (dosis de mañana).
- **Reportes / Resumen:** muestran las dosis cargadas.

> Las dosis históricas **no descuentan** el inventario: Hepatitis B sigue en 20.

---

## Parte 4 · Registrar una vacunación a mano

1. **Vacunación** → paciente `Prueba Tres`, vacuna `Hepatitis B`, fecha de aplicación hoy.
   ✅ El sistema **exige elegir un lote** (HB-TEST-1) porque esa vacuna ya lleva inventario.
2. Elige el lote. La próxima dosis aparece sugerida con el intervalo (30 días); déjala.
3. Guarda.
   ✅ Dice que es la dosis 1 de 3, programa el recordatorio para el día anterior a la próxima dosis y **el inventario baja a 19**.
4. Intenta registrar la **misma dosis otra vez** y llegar a más dosis de las del esquema.
   ✅ Rechaza lo que supere las dosis totales ("ya completó el esquema").
5. Intenta una próxima dosis para **mañana**.
   ✅ Dice que debe ser en 2 días o más.
6. En **Inventario**, abre el lote HB-TEST-1.
   ✅ El kárdex muestra la entrada de 20 y la aplicación de −1.

## Parte 5 · Pacientes y carné digital

1. En **Pacientes**, crea uno a mano (`Prueba Cinco`, documento 90000005) y luego edítalo.
   ✅ Se guarda; si repites el documento, avisa que ya existe.
2. Abre el **Carné digital** de Prueba Uno (ícono de tarjeta).
   ✅ Muestra el enlace y un código QR. Ábrelo desde tu celular (otra sesión, sin iniciar sesión).
   ✅ El carné lista las dosis, la próxima dosis y los datos del centro, con el documento **enmascarado**.
3. Regenera el enlace del carné.
   ✅ El enlace anterior ya no funciona ("Carné no disponible").

---

## Parte 6 · Recordatorios y respuesta por WhatsApp

Los recordatorios se envían el día **anterior** a la dosis. Para no esperar al cron de las 8:00 a. m., lo lanzamos a mano.

1. Revisa que Prueba Uno tenga la dosis de **mañana** (la cargaste en la Parte 3) y que tu celular se haya unido al sandbox
   hace menos de 24 horas.
2. Dispara el cron (en una terminal; cambia `TU_CRON_SECRET` por el valor de `CRON_SECRET` de Vercel):

   ```bash
   curl -H "Authorization: Bearer TU_CRON_SECRET" https://vacunaapp.vercel.app/api/cron/reminders
   ```

   ✅ Responde con un resumen JSON (cuántos enviados). Con un secreto equivocado responde `No autorizado`.
3. Ve a **Recordatorios**.
   ✅ El de Prueba Uno pasa a **Enviado** (WhatsApp y correo). Si algo falla, el motivo aparece en el detalle.
   ✅ Te llegó el WhatsApp con el nombre, la vacuna, la dosis, la fecha y el nombre del centro. Y el correo, si usaste el
   correo de tu cuenta Resend.
   ✅ A Prueba Dos y Tres **no** les llega nada (no autoriza / no hay recordatorio de mañana).
4. **Responde `1`** al WhatsApp.
   ✅ El bot confirma la cita; en **Recordatorios** queda "Confirmada".
5. Sin esperar nada, responde ahora **`2`** (el paciente puede cambiar de opinión en cualquier momento).
   ✅ Ofrece una lista numerada de fechas (respetando los días de atención y los cupos). Responde con el **número** de la
   opción que quieras.
   ✅ La cita se mueve a esa fecha y se ve en **Agenda**. Escribir `0` en vez de un número conserva la fecha original.
6. Responde **`SALIR`**.
   ✅ Confirma la baja. En **Pacientes**, Prueba Uno pasa a "No autoriza mensajes" y ya no recibirá recordatorios.
7. En **Recordatorios**, usa **Reintentar** sobre uno fallido (si lo hay).
   ✅ Reenvía y actualiza el estado.

## Parte 7 · Campaña de pacientes atrasados

1. Prueba Dos está atrasado pero no autoriza mensajes. Para probar el envío real, edítalo: autoriza = SI y pon **tu**
   celular, y a Prueba Uno cámbiale el teléfono a uno inventado (así dos pacientes no comparten tu número).
2. **Atrasados** → selecciona a los atrasados → crea la campaña y envía.
   ✅ Los que no autorizan quedan **omitidos** y se explica por qué.
   ✅ Te llega el WhatsApp de la campaña; responde `1` (agendar) y elige una fecha.
   ✅ La campaña muestra enviados, respuestas y recuperados.
3. Repite la campaña y esta vez responde `2` ("ya me la apliqué").
   ✅ En **Atrasados** ese paciente queda marcado "Dijo que ya se vacunó: regístrala como dosis externa".

---

## Parte 8 · Usuarios y permisos

1. **Usuarios** → crea un `VACUNADOR` (otro correo tuyo, contraseña de 8 o más caracteres).
2. Entra con él en una ventana privada.
   ✅ Ve Agenda, Atrasados, Vacunación, Pacientes, Inventario y Recordatorios.
   ✅ **No** ve Vacunas, Reportes, Usuarios, Auditoría, Carga inicial, Establecimiento ni Suscripción.
   ✅ Si escribe a mano `/dashboard/auditoria` o `/dashboard/usuarios`, lo devuelve al panel.
   ✅ No puede eliminar pacientes ni anonimizarlos (no ve esos botones).
3. Como ADMIN, desactiva ese usuario.
   ✅ Ya no puede entrar.
4. Intenta cambiarte el rol o desactivarte a ti mismo.
   ✅ Lo impide.

## Parte 9 · Auditoría

1. Entra a **Auditoría** como ADMIN.
   ✅ Aparecen los cambios de las partes anteriores: vacunaciones creadas, pacientes creados y editados, etc.
2. Prueba los filtros: por tipo, acción, usuario ("Procesos automáticos" muestra lo que hizo el sistema, como la carga masiva o
   las respuestas de WhatsApp), y por fechas. Abre un registro.
   ✅ Una edición muestra solo los campos que cambiaron. Documento, teléfono y correo aparecen como **(oculto)**.
3. Elimina el paciente `Prueba Cinco`.
   ✅ Queda un registro "Eliminó" con tu nombre.

## Parte 10 · Anonimizar un paciente (derecho de supresión)

1. En **Pacientes**, busca `Prueba Tres` y pulsa el ícono del **ojo tachado**.
2. Lee el aviso. El botón no se activa hasta que escribas `ANONIMIZAR`. Confírmalo.
   ✅ La fila pasa a "Paciente anonimizado", con la etiqueta violeta y sin botones de editar ni de carné.
   ✅ Su documento ahora es `ANON-…`, y ya no tiene teléfono, correo ni fecha de nacimiento.
   ✅ **Atrasados** y **Recordatorios** ya no lo muestran.
   ✅ El enlace de su carné ya no funciona.
   ✅ Sus dosis siguen existiendo en **Reportes** (sin nombre).
3. Ve a **Auditoría** y filtra por acción "Anonimizó".
   ✅ Hay un registro con tu nombre y la fecha. En los demás registros de ese paciente ya no aparece su nombre.
4. Intenta anonimizarlo otra vez o editarlo.
   ✅ No se puede.

---

## Parte 11 · Seguridad rápida

1. **Recuperar contraseña** (cierra sesión y usa el enlace de recuperar contraseña de la pantalla de ingreso), con el correo del
   administrador de prueba.
   ✅ Llega un código de **6 dígitos**. Un código equivocado 5 veces lo invalida ("pide uno nuevo").
   ✅ Con el código correcto puedes poner una contraseña nueva, y las sesiones abiertas se cierran.
2. Pide el código **más de 10 veces en una hora** con el mismo correo, o desde la misma red.
   ✅ Termina respondiendo "Demasiados intentos".
3. En la página principal, envía el formulario de **solicitud de prueba** 4 veces seguidas.
   ✅ La cuarta responde que hay demasiadas solicitudes (límite: 3 por hora por conexión). Las primeras te llegan por
   correo/WhatsApp a ti.
4. Cierra la pestaña con el panel abierto, espera **más de 10 minutos** y vuelve.
   ✅ Te pide iniciar sesión de nuevo.

## Parte 12 · Suscripción

1. Como superadministrador, en **Plataforma** abre el plan del centro de prueba y cambia **Pagado hasta** a **ayer**.
   ✅ El centro entra en **gracia** (1 día): todo funciona y se avisa que vence.
2. Cámbialo a **hace 3 días**.
   ✅ El panel del centro queda **bloqueado** (solo se puede renovar) y no salen recordatorios.
3. Restablece la fecha a un mes adelante.
   ✅ Todo vuelve a funcionar.

## Parte 13 · Cerrar la prueba

1. Cuando termines, en **Plataforma** **suspende** el centro de prueba (o déjalo para futuras pruebas).
2. Revisa los registros de Vercel (Logs) por si hubo errores en rojo durante la prueba.
3. Anota todo lo que no salió como se esperaba. Con esa lista seguimos puliendo.

---

## Resumen: ¿qué quedaría listo para un cliente real?

| Ya probado con esta guía | Falta tuyo antes de vender |
|---|---|
| Carga inicial, inventario, vacunación, carné, auditoría, anonimización, roles, suscripción, seguridad | Número de WhatsApp de la plataforma y plantillas aprobadas por Meta; dominio verificado en Resend; planes Pro de Supabase y Vercel; Mercado Pago |
