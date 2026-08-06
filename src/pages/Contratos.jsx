import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const vacio = {
  tipo: 'alquiler', propiedad_id: '', cliente_id: '', propietario_id: '', fecha_inicio: '', fecha_fin: '',
  importe: '', modo_pago: '', dia_vencimiento: '', estado: 'vigente'
}

const garanteVacio = { nombre: '', apellido: '', dni: '', telefono: '', direccion: '' }

const CATEGORIAS_DOC = [
  { value: 'dni_inquilino', label: 'DNI del inquilino' },
  { value: 'recibo_sueldo', label: 'Recibo de sueldo' },
  { value: 'garantia_propietaria', label: 'Garantía propietaria' },
  { value: 'otro', label: 'Otro documento' },
]

export default function Contratos() {
  const [contratos, setContratos] = useState([])
  const [propiedades, setPropiedades] = useState([])
  const [clientes, setClientes] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(vacio)
  const [editandoId, setEditandoId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [modalDocsAbierto, setModalDocsAbierto] = useState(false)
  const [contratoSeleccionado, setContratoSeleccionado] = useState(null)
  const [garantes, setGarantes] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [subiendo, setSubiendo] = useState(false)

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
      propietario_id: form.propietario_id || null,
      importe: form.importe ? Number(form.importe) : null,
      dia_vencimiento: form.dia_vencimiento ? Number(form.dia_vencimiento) : null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
    }
    let error
    if (editandoId) {
      ({ error } = await supabase.from('contratos').update(payload).eq('id', editandoId))
    } else {
      ({ error } = await supabase.from('contratos').insert(payload))
    }
    if (error) {
      alert('No se pudo guardar el contrato: ' + error.message)
      return
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

  // --- Garantes y documentos ---

  async function abrirGarantesYDocs(contrato) {
    setContratoSeleccionado(contrato)
    setModalDocsAbierto(true)
    await cargarGarantesYDocs(contrato.id)
  }

  async function cargarGarantesYDocs(contratoId) {
    const [{ data: gar }, { data: docs }] = await Promise.all([
      supabase.from('garantes').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: true }),
      supabase.from('documentos_contrato').select('*').eq('contrato_id', contratoId).order('created_at', { ascending: false }),
    ])
    setGarantes(gar || [])
    setDocumentos(docs || [])
  }

  async function agregarGarante() {
    if (garantes.length >= 4) return
    await supabase.from('garantes').insert({ ...garanteVacio, contrato_id: contratoSeleccionado.id })
    cargarGarantesYDocs(contratoSeleccionado.id)
  }

  function actualizarGarante(id, campo, valor) {
    setGarantes(prev => prev.map(g => g.id === id ? { ...g, [campo]: valor } : g))
  }

  async function guardarGarante(g) {
    await supabase.from('garantes').update({
      nombre: g.nombre, apellido: g.apellido, dni: g.dni, telefono: g.telefono, direccion: g.direccion
    }).eq('id', g.id)
  }

  async function eliminarGarante(id) {
    if (!confirm('¿Eliminar este garante?')) return
    await supabase.from('garantes').delete().eq('id', id)
    cargarGarantesYDocs(contratoSeleccionado.id)
  }

  async function subirDocumento(e, categoria, garanteId = null) {
    const file = e.target.files[0]
    if (!file) return
    setSubiendo(true)
    const path = `${contratoSeleccionado.id}/${Date.now()}_${file.name}`
    const { error: errorSubida } = await supabase.storage.from('documentos-contratos').upload(path, file)
    if (!errorSubida) {
      await supabase.from('documentos_contrato').insert({
        contrato_id: contratoSeleccionado.id,
        garante_id: garanteId,
        categoria,
        nombre_archivo: file.name,
        url: path,
      })
      await cargarGarantesYDocs(contratoSeleccionado.id)
    } else {
      alert('No se pudo subir el archivo: ' + errorSubida.message)
    }
    setSubiendo(false)
    e.target.value = ''
  }

  async function verDocumento(doc) {
    const { data } = await supabase.storage.from('documentos-contratos').createSignedUrl(doc.url, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('No se pudo abrir el documento')
  }

  async function eliminarDocumento(doc) {
    if (!confirm('¿Eliminar este documento?')) return
    await supabase.storage.from('documentos-contratos').remove([doc.url])
    await supabase.from('documentos_contrato').delete().eq('id', doc.id)
    cargarGarantesYDocs(contratoSeleccionado.id)
  }

  const docsGenerales = documentos.filter(d => !d.garante_id)
  function docsDeGarante(garanteId) { return documentos.filter(d => d.garante_id === garanteId) }

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
              <th>Tipo</th><th>Propiedad</th><th>Inquilino/Comprador</th><th>Propietario</th><th>Importe</th><th>Vence</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {contratos.map(c => (
              <tr key={c.id}>
                <td>{c.tipo}</td>
                <td>{nombreProp(c.propiedad_id)}</td>
                <td>{nombreCliente(c.cliente_id)}</td>
                <td>{nombreCliente(c.propietario_id)}</td>
                <td>{c.importe ? `$${c.importe}` : '—'}</td>
                <td>{c.fecha_fin || '—'}</td>
                <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
                <td>
                  <button className="btn-secondary" onClick={() => abrirEditar(c)}>Editar</button>{' '}
                  <button className="btn-secondary" onClick={() => abrirGarantesYDocs(c)}>Garantes y docs</button>{' '}
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
              <label>Propietario</label>
              <select value={form.propietario_id} onChange={e => setForm({ ...form, propietario_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
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
              {!editandoId && (
                <p style={{ fontSize: 12, color: '#777', marginTop: 12 }}>
                  Los garantes y la documentación se cargan después de guardar el contrato, desde el botón "Garantes y docs".
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {modalDocsAbierto && contratoSeleccionado && (
        <div className="modal-overlay" onClick={() => setModalDocsAbierto(false)}>
          <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
            <h2>Garantes y documentación</h2>
            <p style={{ fontSize: 13, color: '#666' }}>{nombreProp(contratoSeleccionado.propiedad_id)}</p>

            <h3 style={{ fontSize: 15, marginTop: 20 }}>Documentos generales</h3>
            {CATEGORIAS_DOC.map(cat => (
              <div key={cat.value} style={{ marginBottom: 10 }}>
                <label>{cat.label}</label>
                <input type="file" disabled={subiendo} onChange={e => subirDocumento(e, cat.value)} />
                {docsGenerales.filter(d => d.categoria === cat.value).map(d => (
                  <div key={d.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span onClick={() => verDocumento(d)} style={{ cursor: 'pointer', color: '#5b2c8f' }}>{d.nombre_archivo}</span>
                    <button type="button" className="btn-danger" style={{ padding: '2px 8px' }} onClick={() => eliminarDocumento(d)}>x</button>
                  </div>
                ))}
              </div>
            ))}

            <h3 style={{ fontSize: 15, marginTop: 24 }}>Garantes ({garantes.length}/4)</h3>
            {garantes.map((g, i) => (
              <div key={g.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <strong>Garante {i + 1}</strong>
                <label>Nombre</label>
                <input value={g.nombre} onChange={e => actualizarGarante(g.id, 'nombre', e.target.value)} onBlur={() => guardarGarante(g)} />
                <label>Apellido</label>
                <input value={g.apellido} onChange={e => actualizarGarante(g.id, 'apellido', e.target.value)} onBlur={() => guardarGarante(g)} />
                <label>DNI</label>
                <input value={g.dni || ''} onChange={e => actualizarGarante(g.id, 'dni', e.target.value)} onBlur={() => guardarGarante(g)} />
                <label>Teléfono</label>
                <input value={g.telefono || ''} onChange={e => actualizarGarante(g.id, 'telefono', e.target.value)} onBlur={() => guardarGarante(g)} />
                <label>Dirección</label>
                <input value={g.direccion || ''} onChange={e => actualizarGarante(g.id, 'direccion', e.target.value)} onBlur={() => guardarGarante(g)} />

                <label>Documentación del garante</label>
                <input type="file" disabled={subiendo} onChange={e => subirDocumento(e, 'dni_garante', g.id)} />
                {docsDeGarante(g.id).map(d => (
                  <div key={d.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span onClick={() => verDocumento(d)} style={{ cursor: 'pointer', color: '#5b2c8f' }}>{d.nombre_archivo}</span>
                    <button type="button" className="btn-danger" style={{ padding: '2px 8px' }} onClick={() => eliminarDocumento(d)}>x</button>
                  </div>
                ))}

                <div className="modal-actions">
                  <button type="button" className="btn-danger" onClick={() => eliminarGarante(g.id)}>Eliminar garante</button>
                </div>
              </div>
            ))}
            {garantes.length < 4 && (
              <button type="button" className="btn-secondary" onClick={agregarGarante}>+ Agregar garante</button>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={() => setModalDocsAbierto(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}