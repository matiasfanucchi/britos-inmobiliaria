import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const vacio = {
  tipo: 'alquiler', propiedad_id: '', cliente_id: '', fecha_inicio: '', fecha_fin: '',
  importe: '', modo_pago: '', dia_vencimiento: '', estado: 'vigente'
}

export default function Contratos() {
  const [contratos, setContratos] = useState([])
  const [propiedades, setPropiedades] = useState([])
  const [clientes, setClientes] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(vacio)
  const [editandoId, setEditandoId] = useState(null)
  const [loading, setLoading] = useState(true)

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cont }, { data: props }, { data: clis }] = await Promise.all([
      supabase.from('contratos').select('*').order('created_at', { ascending: false }),
      supabase.from('propiedades').select('id, direccion'),
      supabase.from('clientes').select('id, nombre, apellido')
    ])
    setContratos(cont || [])
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

  function abrirEditar(c) {
    setForm({ ...vacio, ...c })
    setEditandoId(c.id)
    setModalAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    const payload = {
      ...form,
      importe: form.importe ? Number(form.importe) : null,
      dia_vencimiento: form.dia_vencimiento ? Number(form.dia_vencimiento) : null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
    }
    if (editandoId) {
      await supabase.from('contratos').update(payload).eq('id', editandoId)
    } else {
      await supabase.from('contratos').insert(payload)
    }
    setModalAbierto(false)
    cargarDatos()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este contrato?')) return
    await supabase.from('contratos').delete().eq('id', id)
    cargarDatos()
  }

  function nombreProp(id) { return propiedades.find(p => p.id === id)?.direccion || '—' }
  function nombreCliente(id) {
    const c = clientes.find(c => c.id === id)
    return c ? `${c.nombre} ${c.apellido}` : '—'
  }

  return (
    <div>
      <h1>Contratos</h1>
      <div className="toolbar">
        <div />
        <button className="btn-primary" onClick={abrirNuevo}>+ Nuevo contrato</button>
      </div>

      {loading ? <p>Cargando...</p> : contratos.length === 0 ? (
        <div className="empty">No hay contratos cargados todavía.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th><th>Propiedad</th><th>Cliente</th><th>Importe</th><th>Vence</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {contratos.map(c => (
              <tr key={c.id}>
                <td>{c.tipo}</td>
                <td>{nombreProp(c.propiedad_id)}</td>
                <td>{nombreCliente(c.cliente_id)}</td>
                <td>{c.importe ? `$${c.importe}` : '—'}</td>
                <td>{c.fecha_fin || '—'}</td>
                <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
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
            <h2>{editandoId ? 'Editar contrato' : 'Nuevo contrato'}</h2>
            <form onSubmit={guardar}>
              <label>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="alquiler">Alquiler</option>
                <option value="venta">Venta</option>
              </select>
              <label>Propiedad</label>
              <select required value={form.propiedad_id} onChange={e => setForm({ ...form, propiedad_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {propiedades.map(p => <option key={p.id} value={p.id}>{p.direccion}</option>)}
              </select>
              <label>Cliente (inquilino / comprador)</label>
              <select required value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
              </select>
              <label>Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
              <label>Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} />
              <label>Importe</label>
              <input type="number" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} />
              <label>Modo de pago</label>
              <input value={form.modo_pago} onChange={e => setForm({ ...form, modo_pago: e.target.value })} />
              <label>Día de vencimiento mensual</label>
              <input type="number" min="1" max="31" value={form.dia_vencimiento} onChange={e => setForm({ ...form, dia_vencimiento: e.target.value })} />
              <label>Estado</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                <option value="vigente">Vigente</option>
                <option value="finalizado">Finalizado</option>
                <option value="rescindido">Rescindido</option>
              </select>
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