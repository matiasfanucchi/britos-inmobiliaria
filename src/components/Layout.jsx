import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>Britos Inmobiliaria</h2>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/clientes">Clientes</NavLink>
        <NavLink to="/propiedades">Propiedades</NavLink>
        <NavLink to="/contratos">Contratos</NavLink>
        <NavLink to="/pagos">Pagos</NavLink>
        <button className="logout" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}