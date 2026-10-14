export type EstadoCita = "PENDIENTE" | "COMPLETADA" | "CANCELADA";
export type EstadoEnvio = "PENDIENTE" | "ENVIADO" | "FALLIDO";
export type CanalEnvio = "EMAIL" | "WHATSAPP" | "AMBOS";
/** Autorización del paciente para recibir mensajes (Ley 1581). null = sin registrar. */
export type AutorizaMensajes = "AUTORIZADO" | "NO_AUTORIZADO";
export type MedioAutorizacion = "FORMULARIO" | "WHATSAPP" | "IMPORTACION";
/** Respuesta del paciente al recordatorio por WhatsApp (null = sin respuesta). */
export type Confirmacion = "CONFIRMADA" | "REPROGRAMANDO" | "REPROGRAMADA";

export interface Paciente {
  id: string;
  nombre_completo: string;
  documento_identidad: string;
  email: string | null;
  telefono: string;
  fecha_nacimiento: string | null;
  created_at: string;
  autoriza_mensajes: AutorizaMensajes | null;
  autorizacion_fecha: string | null;
  autorizacion_medio: MedioAutorizacion | null;
  /** Enlace secreto del carné digital: /carne/<carne_token>. */
  carne_token: string;
}

export interface Vacuna {
  id: string;
  nombre: string;
  dosis_totales: number;
  intervalo_dias_recom_dosis: number | null;
  descripcion: string | null;
}

export interface CitaVacunacion {
  id: string;
  paciente_id: string;
  vacuna_id: string;
  numero_dosis: number;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string | null;
  estado: EstadoCita;
}

export interface Recordatorio {
  id: string;
  cita_id: string;
  centro_id: string;
  estado_envio: EstadoEnvio;
  canal: CanalEnvio;
  fecha_programada: string;
  intentos: number;
  ultimo_error: string | null;
  confirmacion: Confirmacion | null;
  opciones_fecha: string[] | null;
  reprogramaciones: number;
  enviado_at: string | null;
  respondido_at: string | null;
}

/** Recordatorio con la cita, paciente y vacuna relacionados. */
export interface RecordatorioDetalle extends Recordatorio {
  cita: (CitaVacunacion & {
    paciente: Paciente;
    vacuna: Pick<Vacuna, "nombre" | "intervalo_dias_recom_dosis">;
  }) | null;
}

export type Rol = "ADMIN" | "VACUNADOR";

export interface Perfil {
  user_id: string;
  centro_id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
}
