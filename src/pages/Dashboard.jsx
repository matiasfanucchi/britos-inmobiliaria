import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, propiedades: 0, contratosVigentes: 0, pagosPendientes: 0 })

  useEffect(() => {
    async function cargar() {
      const [clientes, propiedades, contratos, pagos] = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('propiedades').select('id', { count: 'exact', head: true }),
        supabase.from('contratos').select('id', { count: 'exact', head: true }).eq('estado', 'vigente'),
        supabase.from('pagos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      ])
      setStats({
        clientes: clientes.count || 0,
        propiedades: propiedades.count || 0,
        contratosVigentes: contratos.count || 0,
        pagosPendientes: pagos.count || 0,
      })
    }
    cargar()
  }, [])

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="dashboard-cards">
        <div className="card"><div className="num">{stats.clientes}</div><div className="label">Clientes</div></div>
        <div className="card"><div className="num">{stats.propiedades}</div><div className="label">Propiedades</div></div>
        <div className="card"><div className="num">{stats.contratosVigentes}</div><div className="label">Contratos vigentes</div></div>
        <div className="card"><div className="num">{stats.pagosPendientes}</div><div className="label">Pagos pendientes</div></div>
      </div>
    </div>
  )
}