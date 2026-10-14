/** Select de PostgREST para recordatorios con cita, paciente y vacuna. Seguro para el cliente. */
export const REMINDER_SELECT = `
  id, cita_id, estado_envio, canal, fecha_programada, intentos, ultimo_error,
  confirmacion, opciones_fecha, reprogramaciones, enviado_at, respondido_at,
  cita:citas_vacunacion!inner (
    id, paciente_id, vacuna_id, numero_dosis, fecha_aplicacion, fecha_proxima_dosis, estado,
    paciente:pacientes!inner (id, nombre_completo, documento_identidad, email, telefono, fecha_nacimiento, created_at, autoriza_mensajes, autorizacion_fecha, autorizacion_medio),
    vacuna:vacunas!inner (nombre, intervalo_dias_recom_dosis)
  )`;
