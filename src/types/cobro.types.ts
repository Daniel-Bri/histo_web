export type EstadoCobro = 'PENDIENTE' | 'PAGADO' | 'ANULADO' | 'EXPIRADO'

export interface Cobro {
  id: number
  ficha: number
  paciente: number
  concepto: string
  monto: string
  estado: EstadoCobro
  stripe_session_id: string | null
  fecha_pago: string | null
  creado_en: string
  actualizado_en: string
}

export interface CrearSesionCobroPayload {
  ficha_id: number
  concepto: string
  monto: number
}

export interface CrearSesionCobroResponse {
  cobro_id: number
  checkout_url: string
}