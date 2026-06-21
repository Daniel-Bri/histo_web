import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import OlvidarPassword from './pages/OlvidarPassword'
import Dashboard from './pages/Dashboard'
import CambiarPassword from './pages/CambiarPassword'
import EnConstruccion from './pages/EnConstruccion'
import Pacientes from './pages/Pacientes'
import ExpedientePaciente from './pages/ExpedientePaciente'
import EditarAntecedentes from './pages/EditarAntecedentes'
import EditarPaciente from './pages/EditarPaciente'
import PersonalList from './pages/GestionPersonal/PersonalList'
import PersonalForm from './pages/GestionPersonal/PersonalForm'
import RegistroPaciente from './pages/Pacientes/RegistroPaciente'
import UrgenciasPage from './pages/Urgencias'
import TriajeForm from './pages/Urgencias/TriajeForm'
import AperturaFichaColaDia from './pages/AperturaFichaColaDia'
import SolicitudEstudios from './pages/SolicitudEstudios'
import ColaLaboratorio from './pages/ColaLaboratorio'
import ReportesProduccion from './pages/ReportesProduccion'
import Recetas from './pages/Recetas'
import Configuracion from './pages/Configuracion'
import AccesoDenegado from './pages/AccesoDenegado'
import AdminTenants from './pages/AdminTenants'
import TenantDetalle from './pages/AdminTenants/TenantDetalle'
import Suscripciones from './pages/AdminTenants/Suscripciones'
import UsuariosPorClinica from './pages/AdminTenants/UsuariosPorClinica'
import Bitacora from './pages/Auditoria/Bitacora'
import ConsultaSOAP from './pages/consulta/ConsultaSOAP'
import FichasDelDia from './pages/FichasDelDia'
import Consentimientos from './pages/Consentimientos'
import IdentidadBlockchain from './pages/IdentidadBlockchain'
import RiesgosClinicosPanel from './pages/RiesgosClinicosPanel'
import RiesgosGlobal from './pages/RiesgosGlobal'
import AprobacionBreakGlass from './pages/BreakGlass/AprobacionBreakGlass'
import './pages/Estudios.css'
import CobroServicios from './pages/Cobros/CobroServicios'
import CobroExito from './pages/Cobros/CobroExito'
import CobroCancelado from './pages/Cobros/CobroCancelado'
import SaasPagoExito from './pages/SaaS/PagoExito'
import SaasPagoCancelado from './pages/SaaS/PagoCancelado'
import ReportesSNIS from './pages/ReportesSNIS'
import GestionPermisos from './pages/GestionPermisos'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/olvidar-password" element={<OlvidarPassword />} />
        <Route path="/acceso-denegado" element={<AccesoDenegado code={403} />} />
        <Route path="/no-autorizado"   element={<AccesoDenegado code={401} />} />

        {/* Rutas protegidas con sidebar (Layout) */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard"          element={<Dashboard />} />
          <Route path="/cambiar-password"   element={<CambiarPassword />} />
          <Route path="/pacientes"          element={<Pacientes />} />
          <Route path="/pacientes/registro" element={<RegistroPaciente />} />
          <Route path="/pacientes/:id/expediente"           element={<ExpedientePaciente />} />
          <Route path="/pacientes/:id/editar"               element={<EditarPaciente />} />
          <Route path="/pacientes/:id/antecedentes/editar"  element={<EditarAntecedentes />} />
          <Route path="/pacientes/:id/riesgos"             element={<RiesgosClinicosPanel />} />
          <Route path="/riesgos"                           element={<RiesgosGlobal />} />
          <Route path="/personal"           element={<PersonalList />} />
          <Route path="/personal/nuevo"     element={<PersonalForm />} />
          <Route path="/personal/:id/editar" element={<PersonalForm />} />
          <Route path="/urgencias"                    element={<UrgenciasPage />} />
          <Route path="/urgencias/:fichaId/triaje"  element={<TriajeForm />} />
          <Route path="/fichas/cola-dia"             element={<AperturaFichaColaDia />} />
          <Route path="/consulta"                    element={<ConsultaSOAP />} />
          <Route path="/consulta/ficha/:fichaId"     element={<ConsultaSOAP />} />
          <Route path="/consulta/:id"                element={<ConsultaSOAP />} />
          <Route path="/fichas/dia"                  element={<FichasDelDia />} />
          <Route path="/consentimientos"             element={<Consentimientos />} />
          <Route path="/historial"  element={<EnConstruccion titulo="Historial Clínico" />} />
          <Route path="/documentos" element={<EnConstruccion titulo="Documentos" />} />
          <Route path="/agenda"     element={<EnConstruccion titulo="Agenda" />} />
          <Route path="/estudios/solicitud" element={<SolicitudEstudios />} />
          <Route path="/estudios/cola-laboratorio" element={<ColaLaboratorio />} />
          <Route path="/reportes/produccion" element={<ReportesProduccion />} />
          <Route path="/reportes/snis"      element={<ReportesSNIS />} />
          <Route path="/recetas" element={<Recetas />} />
          <Route path="/configuracion"          element={<Configuracion />} />
          <Route path="/admin/tenants"             element={<AdminTenants />} />
          <Route path="/admin/tenants/:id"        element={<TenantDetalle />} />
          <Route path="/admin/suscripciones"      element={<Suscripciones />} />
          <Route path="/admin/usuarios-clinica"   element={<UsuariosPorClinica />} />
          <Route path="/auditoria/bitacora"        element={<Bitacora />} />
          <Route path="/break-glass/aprobaciones"  element={<AprobacionBreakGlass />} />
          <Route path="/permisos"                  element={<GestionPermisos />} />
          <Route path="/blockchain/identidad" element={<IdentidadBlockchain />} />
          <Route path="/cobros"           element={<CobroServicios />} />
          <Route path="/cobros/exito"     element={<CobroExito />} />
          <Route path="/cobros/cancelado" element={<CobroCancelado />} />
          <Route path="/saas/pago/exito"     element={<SaasPagoExito />} />
          <Route path="/saas/pago/cancelado" element={<SaasPagoCancelado />} />
        </Route>
        
        {/* Redirige la raíz al dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
