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
import UsuariosPorClinica from './pages/AdminTenants/UsuariosPorClinica'
import Bitacora from './pages/Auditoria/Bitacora'
import ConsultaSOAP from './pages/consulta/ConsultaSOAP'
import './pages/Estudios.css' 

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
          <Route path="/personal"           element={<PersonalList />} />
          <Route path="/personal/nuevo"     element={<PersonalForm />} />
          <Route path="/personal/:id/editar" element={<PersonalForm />} />
          <Route path="/urgencias"                    element={<UrgenciasPage />} />
          <Route path="/urgencias/:fichaId/triaje"  element={<TriajeForm />} />
          <Route path="/fichas/cola-dia"             element={<AperturaFichaColaDia />} />
          <Route path="/consulta"                    element={<ConsultaSOAP />} />
          <Route path="/consulta/:id"                element={<ConsultaSOAP />} />
          <Route path="/historial"  element={<EnConstruccion titulo="Historial Clínico" />} />
          <Route path="/documentos" element={<EnConstruccion titulo="Documentos" />} />
          <Route path="/agenda"     element={<EnConstruccion titulo="Agenda" />} />
          <Route path="/estudios/solicitud" element={<SolicitudEstudios />} />
          <Route path="/estudios/cola-laboratorio" element={<ColaLaboratorio />} />
          <Route path="/reportes/produccion" element={<ReportesProduccion />} />
          <Route path="/recetas" element={<Recetas />} />
          <Route path="/configuracion"          element={<Configuracion />} />
          <Route path="/admin/tenants"             element={<AdminTenants />} />
          <Route path="/admin/tenants/:id"        element={<TenantDetalle />} />
          <Route path="/admin/usuarios-clinica"   element={<UsuariosPorClinica />} />
          <Route path="/auditoria/bitacora"        element={<Bitacora />} />
        </Route>
        
        {/* Redirige la raíz al dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
