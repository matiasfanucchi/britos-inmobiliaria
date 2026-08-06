import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const vacio = {
  cliente_id: '', direccion: '', barrio: '', tipo: 'casa', ambientes: '',
  metros_cuadrados: '', operacion: 'alquiler', estado: 'disponible', precio: '', descripcion: ''
}

export default function Propiedades() {
  const [propiedades, setPropiedades] = useState([])
  const [clientes, setClientes] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(vacio)
  const [editandoId, setEditandoId] = useState(null)
  const [loading, setLoading] = useState(true)

  async function cargarDatos() {
    setLoading(true)
    const [{ data: props }, { data: clis }] = await Promise.all([
      supabase.from('propiedades').select('*').order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nombre, apellido')
    ])
    setPropiedades(props || [])
    setClientes(clis || [])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  function abrirNuevo() {
    setForm(vacio)
    setEditandoId(null)
    setModalAbierto(true)
  }

  function abrirEditar(p) {
    setForm({ ...vacio, ...p, cliente_id: p.cliente_id || '' })
    setEditandoId(p.id)
    setModalAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    const payload = {
      ...form,
      cliente_id: form.cliente_id || null,
      ambientes: form.ambientes ? Number(form.ambientes) : null,
      metros_cuadrados: form.metros_cuadrados ? Number(form.metros_cuadrados) : null,
      precio: form.precio ? Number(form.precio) : null,
    }
    if (editandoId) {
      await supabase.from('propiedades').update(payload).eq('id', editandoId)
    } else {
      await supabase.from('propiedades').insert(payload)
    }
    setModalAbierto(false)
    cargarDatos()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta propiedad?')) return
    await supabase.from('propiedades').delete().eq('id', id)
    cargarDatos()
  }

  function nombreCliente(id) {
    const c = clientes.find(c => c.id === id)
    return c ? `${c.nombre} ${c.apellido}` : '—'
  }

  const filtradas = filtroEstado === 'todos' ? propiedades : propiedades.filter(p => p.estado === filtroEstado)

  return (
    <div>
      <h1>Propiedades</h1>
      <div className="toolbar">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="reservada">Reservada</option>
          <option value="alquilada">Alquilada</option>
          <option value="vendida">Vendida</option>
        </select>
        <button className="btn-primary" onClick={abrirNuevo}>+ Nueva propiedad</button>
      </div>

      {loading ? <p>Cargando...</p> : filtradas.length === 0 ? (
        <div className="empty">No hay propiedades cargadas todavía.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Dirección</th><th>Barrio</th><th>Operación</th><th>Propietario</th><th>Precio</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(p => (
              <tr key={p.id}>
                <td>{p.direccion}</td>
                <td>{p.barrio}</td>
                <td>{p.operacion}</td>
                <td>{nombreCliente(p.cliente_id)}</td>
                <td>{p.precio ? `$${p.precio}` : '—'}</td>
                <td><span className={`badge ${p.estado}`}>{p.estado}</span></td>
                <td>
                  <button className="btn-secondary" onClick={() => abrirEditar(p)}>Editar</button>{' '}
                  <button className="btn-danger" onClick={() => eliminar(p.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <div className="modal-overlay" onClick={() => setModalAbierto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editandoId ? 'Editar propiedad' : 'Nueva propiedad'}</h2>
            <form onSubmit={guardar}>
              <label>Dirección</label>
              <input required value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
              <label>Barrio</label>
              <input value={form.barrio} onChange={e => setForm({ ...form, barrio: e.target.value })} />
              <label>Propietario</label>
              <select value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
              </select>
              <label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="casa">Casa</option>
                <option value="departamento">Departamento</option>
                <option value="local">Local</option>
                <option value="terreno">Terreno</option>
              </select>
              <label>Ambientes</label>
              <input type="number" value={form.ambientes} onChange={e => setForm({ ...form, ambientes: e.target.value })} />
              <label>Metros cuadrados</label>
              <input type="number" value={form.metros_cuadrados} onChange={e => setForm({ ...form, metros_cuadrados: e.target.value })} />
              <label>Operación</label>
              <select value={form.operacion} onChange={e => setForm({ ...form, operacion: e.target.value })}>
                <option value="alquiler">Alquiler</option>
                <option value="venta">Venta</option>
                <option value="administracion">Administración</option>
              </select>
              <label>Estado</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                <option value="disponible">Disponible</option>
                <option value="reservada">Reservada</option>
                <option value="alquilada">Alquilada</option>
                <option value="vendida">Vendida</option>
              </select>
              <label>Precio</label>
              <input type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} />
              <label>Descripción</label>
              <textarea rows="3" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}