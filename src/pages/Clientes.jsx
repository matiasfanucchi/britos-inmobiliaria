import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const vacio = { nombre: '', apellido: '', tipo_documento: 'DNI', dni: '', telefono: '', email: '', direccion: '', tipo: 'inquilino', fecha_nacimiento: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(vacio)
  const [editandoId, setEditandoId] = useState(null)
  const [loading, setLoading] = useState(true)

  async function cargarClientes() {
    setLoading(true)
    const { data, error } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    if (!error) setClientes(data)
    setLoading(false)
  }

  useEffect(() => { cargarClientes() }, [])

  function abrirNuevo() {
    setForm(vacio)
    setEditandoId(null)
    setModalAbierto(true)
  }

  function abrirEditar(c) {
    setForm({ ...vacio, ...c, fecha_nacimiento: c.fecha_nacimiento || '', tipo_documento: c.tipo_documento || 'DNI' })
    setEditandoId(c.id)
    setModalAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()

    const dniLimpio = (form.dni || '').trim()
    if (dniLimpio) {
      const duplicado = clientes.find(c =>
        (c.dni || '').trim() === dniLimpio && c.id !== editandoId
      )
      if (duplicado) {
        const seguir = confirm(
          `Ya hay un cliente cargado con ${duplicado.tipo_documento || 'DNI'} ${dniLimpio}: ${duplicado.nombre} ${duplicado.apellido}.\n\n¿Querés guardarlo igual?`
        )
        if (!seguir) return
      }
    }

    const payload = { ...form, fecha_nacimiento: form.fecha_nacimiento || null }
    if (editandoId) {
      await supabase.from('clientes').update(payload).eq('id', editandoId)
    } else {
      await supabase.from('clientes').insert(payload)
    }
    setModalAbierto(false)
    cargarClientes()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarClientes()
  }

  const filtrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido} ${c.dni || ''}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <h1>Clientes</h1>
      <div className="toolbar">
        <input placeholder="Buscar por nombre o documento..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <button className="btn-primary" onClick={abrirNuevo}>+ Nuevo cliente</button>
      </div>

      {loading ? <p>Cargando...</p> : filtrados.length === 0 ? (
        <div className="empty">No hay clientes cargados todavía.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th><th>Documento</th><th>Tipo</th><th>Teléfono</th><th>Email</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(c => (
              <tr key={c.id}>
                <td>{c.nombre} {c.apellido}</td>
                <td>{c.dni ? `${c.tipo_documento || 'DNI'} ${c.dni}` : '—'}</td>
                <td>{c.tipo}</td>
                <td>{c.telefono}</td>
                <td>{c.email}</td>
                <td>
                  <button className="btn-secondary" onClick={() => abrirEditar(c)}>Editar</button>{' '}
                  <button className="btn-danger" onClick={() => eliminar(c.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <div className="modal-overlay" onClick={() => setModalAbierto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <form onSubmit={guardar}>
              <label>Nombre</label>
              <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <label>Apellido</label>
              <input required value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} />
              <label>Tipo de documento</label>
              <select value={form.tipo_documento} onChange={e => setForm({ ...form, tipo_documento: e.target.value })}>
                <option value="DNI">DNI</option>
                <option value="CUIT">CUIT</option>
                <option value="CUIL">CUIL</option>
              </select>
              <label>Número de documento</label>
              <input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
              <label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="inquilino">Inquilino</option>
                <option value="propietario">Propietario</option>
                <option value="comprador">Comprador</option>
                <option value="vendedor">Vendedor</option>
              </select>
              <label>Teléfono</label>
              <input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
              <label>Fecha de nacimiento</label>
              <input type="date" value={form.fecha_nacimiento} onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })} />
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