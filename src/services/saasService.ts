import { api } from '../api/axiosConfig'

export interface SuscripcionTenant {
  id:                number
  tenant:            number
  tenant_nombre:     string
  tenant_slug:       string
  tenant_activo:     boolean
  plan:              'BASICO' | 'PROFESIONAL' | 'ENTERPRISE'
  estado:            'ACTIVA' | 'PENDIENTE' | 'EXPIRADA' | 'SUSPENDIDA'
  monto_mensual:     string
  fecha_inicio:      string | null
  fecha_vencimiento: string | null
  fecha_ultimo_pago: string | null
  creado_en:         string
  actualizado_en:    string
}

export const PLAN_LABELS: Record<SuscripcionTenant['plan'], string> = {
  BASICO:      'Básico',
  PROFESIONAL: 'Profesional',
  ENTERPRISE:  'Enterprise',
}

export const ESTADO_LABELS: Record<SuscripcionTenant['estado'], string> = {
  ACTIVA:     'Activa',
  PENDIENTE:  'Pendiente de pago',
  EXPIRADA:   'Expirada',
  SUSPENDIDA: 'Suspendida',
}

export const ESTADO_COLOR: Record<SuscripcionTenant['estado'], string> = {
  ACTIVA:     '#15803D',
  PENDIENTE:  '#B45309',
  EXPIRADA:   '#DC2626',
  SUSPENDIDA: '#64748B',
}

export async function listarSuscripciones(): Promise<SuscripcionTenant[]> {
  const { data } = await api.get<SuscripcionTenant[]>('saas/suscripciones/')
  return data
}

export async function getSuscripcion(tenantId: number): Promise<SuscripcionTenant> {
  const { data } = await api.get<SuscripcionTenant>(`saas/suscripciones/${tenantId}/`)
  return data
}

export async function patchSuscripcion(
  tenantId: number,
  payload: Partial<Pick<SuscripcionTenant, 'plan' | 'estado' | 'monto_mensual'>>,
): Promise<SuscripcionTenant> {
  const { data } = await api.patch<SuscripcionTenant>(`saas/suscripciones/${tenantId}/`, payload)
  return data
}

export async function crearPagoSaaS(tenantId: number): Promise<{ checkout_url: string; session_id: string }> {
  const { data } = await api.post(`saas/suscripciones/${tenantId}/crear-pago/`)
  return data
}

export async function miSuscripcion(): Promise<SuscripcionTenant> {
  const { data } = await api.get<SuscripcionTenant>('saas/mi-suscripcion/')
  return data
}
