import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const vacio = { contrato_id: '', mes_correspondiente: '', fecha_pago: '', importe: '', estado: 'pendiente' }

export default function Pagos() {
  const [pagos, setPagos] = useState([])
  const [contratos, setContratos] = useState([])
  const [propiedades, setPropiedades] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(vacio)
  const [loading, setLoading] = useState(true)

  async function cargarDatos() {
    setLoading(true)
    const [{ data: pgs }, { data: conts }, { data: props }] = await Promise.all([
      supabase.from('pagos').select('*').order('created_at', { ascending: false }),
      supabase.from('contratos').select('id, propiedad_id, tipo'),
      supabase.from('propiedades').select('id, direccion')
    ])
    setPagos(pgs || [])
    setContratos(conts || [])
    setPropiedades(props || [])
    setLoading(false)
  }

  useEffect(() => { cargarDatos() }, [])

  function abrirNuevo() {
    setForm(vacio)
    setModalAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    const payload = {
      ...form,
      importe: form.importe ? Number(form.importe) : null,
      fecha_pago: form.fecha_pago || null,
    }
    await supabase.from('pagos').insert(payload)
    setModalAbierto(false)
    cargarDatos()
  }

  async function marcarPagado(id) {
    await supabase.from('pagos').update({ estado: 'pagado', fecha_pago: new Date().toISOString().slice(0, 10) }).eq('id', id)
    cargarDatos()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este pago?')) return
    await supabase.from('pagos').delete().eq('id', id)
    cargarDatos()
  }

  function direccionDeContrato(contratoId) {
    const c = contratos.find(c => c.id === contratoId)
    if (!c) return '—'
    return propiedades.find(p => p.id === c.propiedad_id)?.direccion || '—'
  }

  return (
    <div>
      <h1>Pagos</h1>
      <div className="toolbar">
        <div />
        <button className="btn-primary" onClick={abrirNuevo}>+ Registrar pago</button>
      </div>

      {loading ? <p>Cargando...</p> : pagos.length === 0 ? (
        <div className="empty">No hay pagos registrados todavía.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Propiedad</th><th>Mes</th><th>Importe</th><th>Fecha de pago</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pagos.map(p => (
              <tr key={p.id}>
                <td>{direccionDeContrato(p.contrato_id)}</td>
                <td>{p.mes_correspondiente}</td>
                <td>{p.importe ? `$${p.importe}` : '—'}</td>
                <td>{p.fecha_pago || '—'}</td>
                <td><span className={`badge ${p.estado}`}>{p.estado}</span></td>
                <td>
                  {p.estado === 'pendiente' && (
                    <button className="btn-secondary" onClick={() => marcarPagado(p.id)}>Marcar pagado</button>
                  )}{' '}
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
            <h2>Registrar pago</h2>
            <form onSubmit={guardar}>
              <label>Contrato</label>
              <select required value={form.contrato_id} onChange={e => setForm({ ...form, contrato_id: e.target.value })}>
                <option value="">Seleccionar...</option>
                {contratos.map(c => <option key={c.id} value={c.id}>{direccionDeContrato(c.id)}</option>)}
              </select>
              <label>Mes correspondiente</label>
              <input placeholder="Ej: Agosto 2026" value={form.mes_correspondiente} onChange={e => setForm({ ...form, mes_correspondiente: e.target.value })} />
              <label>Importe</label>
              <input type="number" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} />
              <label>Fecha de pago</label>
              <input type="date" value={form.fecha_pago} onChange={e => setForm({ ...form, fecha_pago: e.target.value })} />
              <label>Estado</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
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