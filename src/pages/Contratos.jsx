import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

const vacio = {
  tipo: 'alquiler', propiedad_id: '', cliente_id: '', propietario_id: '', fecha_inicio: '', fecha_fin: '',
  importe: '', modo_pago: '', dia_vencimiento: '', porcentaje_aumento: '', periodo_aumento: 'semestral', estado: 'vigente'
}

const garanteVacio = { nombre: '', apellido: '', dni: '', telefono: '', direccion: '' }

const CATEGORIAS_DOC = [
  { value: 'dni_inquilino', label: 'DNI del inquilino' },
  { value: 'recibo_sueldo', label: 'Recibo de sueldo' },
  { value: 'garantia_propietaria', label: 'Garantía propietaria' },
  { value: 'otro', label: 'Otro documento' },
]

function BuscadorCliente({ label, clientes, valor, onSeleccionar, requerido }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)

  const seleccionado = clientes.find(c => c.id === valor)

  const coincidencias = texto.length >= 2
    ? clientes.filter(c => `${c.nombre} ${c.apellido}`.toLowerCase().includes(texto.toLowerCase())).slice(0, 8)
    : []

  return (
    <div style={{ position: 'relative' }}>
      <label>{label}</label>
      <input
        type="text"
        required={requerido && !valor}
        placeholder={seleccionado ? `${seleccionado.nombre} ${seleccionado.apellido}` : 'Escribí para buscar...'}
        value={texto}
        onChange={e => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
      />
      {seleccionado && !texto && (
        <div style={{ fontSize: 12, color: '#5b2c8f', marginTop: 2 }}>
          Seleccionado: {seleccionado.nombre} {seleccionado.apellido}{' '}
          <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onSeleccionar('')}>quitar</span>
        </div>
      )}
      {abierto && coincidencias.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #ccc', borderRadius: 6, width: '100%', maxHeight: 160, overflowY: 'auto' }}>
          {coincidencias.map(c => (
            <div
              key={c.id}
              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 14 }}
              onClick={() => { onSeleccionar(c.id); setTexto(''); setAbierto(false) }}
            >
              {c.nombre} {c.apellido}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Contratos() {
  const [contratos, setContratos] = useState([])
  const [propiedades, setPropiedades] = useState([])
  const [clientes, setClientes] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(vacio)
  const [editandoId, setEditandoId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [modalDocsAbierto, setModalDocsAbierto] = useState(false)
  const [contratoSeleccionado, setContratoSeleccionado] = useState(null)
  const [garantes, setGarantes] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [subiendo, setSubiendo] = useState(false)

  const [modalTextoAbierto, setModalTextoAbierto] = useState(false)
  const [contratoEditor, setContratoEditor] = useState(null)
  const editorRef = useRef(null)

  async function cargarDatos() {
    setLoading(true)
    const [{ data: cont }, { data: props }, { data: clis }] = await Promise.all([
      supabase.from('contratos').select('*').order('created_at', { ascending: false }),
      supabase.from('propiedades').select('id, direccion, barrio, tipo, ambientes'),
      supabase.from('clientes').select('id, nombre, apellido, dni, direccion, telefono')
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

    if (form.estado === 'vigente' && form.propiedad_id) {
      const otroVigente = contratos.find(c =>
        c.propiedad_id === form.propiedad_id && c.estado === 'vigente' && c.id !== editandoId
      )
      if (otroVigente) {
        const seguir = confirm(
          `Esta propiedad ya tiene un contrato vigente cargado (${nombreCliente(otroVigente.cliente_id)}).\n\n¿Querés guardar este contrato igual?`
        )
        if (!seguir) return
      }
    }

    const payload = {
      ...form,
      propietario_id: form.propietario_id || null,
      importe: form.importe ? Number(form.importe) : null,
      porcentaje_aumento: form.porcentaje_aumento ? Number(form.porcentaje_aumento) : null,
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

  // --- Editor de contrato ---

  function fechaEnPalabras(fechaStr) {
    if (!fechaStr) return { dia: '______', mes: '______', anio: '______' }
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const [anio, mes, dia] = fechaStr.split('-')
    return { dia: String(Number(dia)), mes: meses[Number(mes) - 1], anio }
  }

  function mesesEntre(inicio, fin) {
    if (!inicio || !fin) return null
    const a = new Date(inicio), b = new Date(fin)
    return Math.round((b - a) / (1000 * 60 * 60 * 24 * 30))
  }

  function generarClausulasHtml(contrato, propiedad, inquilino, propietario, gar) {
    const hoy = fechaEnPalabras(new Date().toISOString().slice(0, 10))
    const finicio = fechaEnPalabras(contrato.fecha_inicio)
    const ffin = fechaEnPalabras(contrato.fecha_fin)
    const duracion = mesesEntre(contrato.fecha_inicio, contrato.fecha_fin)

    const htmlFiadores = (gar && gar.length > 0)
      ? gar.map(g => `El Señor/a <strong>${g.nombre || ''} ${g.apellido || ''}</strong>, Documento Nacional de Identidad Número ${g.dni || '________'}, con domicilio en calle ${g.direccion || '________'}, TE: ${g.telefono || '________'}`).join(', y ') + ', se constituyen en fiadores PERSONALES, CODEUDORES, SOLIDARIOS, LISOS, LLANOS Y PRINCIPALES PAGADORES por las obligaciones que toma a su cargo el LOCATARIO.'
      : 'No se registran fiadores para este contrato.'

    return `
      <div class="encabezado">
        <strong>Inmobiliaria "BRITOS"</strong><br/>
        Maestro Vidal 1160<br/>
        Barrio Los Platanos
      </div>
      <h1>CONTRATO DE LOCACIÓN</h1>
      <p>
        En la Ciudad de Córdoba a los ${hoy.dia} días del mes de ${hoy.mes} de ${hoy.anio}, se reúnen
        ${propietario ? `la Señor/a <strong>${propietario.nombre} ${propietario.apellido}</strong>, Documento Nacional de Identidad Número ${propietario.dni || '________'}, con domicilio en ${propietario.direccion || '________'}` : '________'},
        en su carácter de <strong>LOCADOR</strong> y ${inquilino ? `el Señor/a <strong>${inquilino.nombre} ${inquilino.apellido}</strong>, Documento Nacional de Identidad Número ${inquilino.dni || '________'}, TE: ${inquilino.telefono || '________'}, con domicilio en ${inquilino.direccion || '________'}` : '________'},
        en adelante <strong>LOCATARIO</strong>, por otra parte, convienen de mutuo acuerdo en celebrar este contrato que se regirá de acuerdo a lo estipulado en el Código Civil y Comercial, disposiciones vigentes y por las siguientes cláusulas:
      </p>

      <p><span class="clausula-titulo">PRIMERA: INMUEBLE LOCADO:</span> El LOCADOR cede al LOCATARIO en Locación un inmueble de su propiedad ubicado en
        ${propiedad?.direccion || '________'}${propiedad?.barrio ? `, de Barrio ${propiedad.barrio}` : ''} de la provincia de CORDOBA.</p>

      <p><span class="clausula-titulo">SEGUNDA: PLAZO:</span> La vigencia del presente contrato se fija por el término de
        ${duracion ? duracion + ' (' + duracion + ')' : '____'} meses a contar del día ${finicio.dia} de ${finicio.mes} de ${finicio.anio},
        o sea que el mismo vence indefectiblemente el ${ffin.dia} de ${ffin.mes} de ${ffin.anio} sin necesidad de notificación o requerimiento alguno por parte del LOCADOR.</p>

      <p><span class="clausula-titulo">TERCERA: PRECIO Y LUGAR DE PAGO:</span> 1) Se establece de común acuerdo entre las partes y absoluta fe, que el precio de Locación
        debe fijarse como valor único, en moneda nacional y por períodos mensuales y será de $${contrato.importe || '________'} (pesos),
        ${contrato.porcentaje_aumento ? `con aumentos ${contrato.periodo_aumento || 'periódicos'}es de un ${contrato.porcentaje_aumento}%.` : 'sin aumentos pactados.'}
        2) El alquiler será pagado por mes adelantado, ${contrato.dia_vencimiento ? `con vencimiento el día ${contrato.dia_vencimiento} de cada mes` : 'según lo acordado'},
        dejándose pactado que si el último día de plazo establecido para el pago fuera inhábil, este vencerá el día hábil inmediato posterior, a partir del cual se producirá la mora.
        3) El alquiler se pacta por período de mes entero, y aunque el LOCATARIO se mudara antes de finalizar el mes, pagará íntegramente el alquiler correspondiente a ese mes.
        4) El lugar de pago se fija en calle MAESTRO VIDAL número 1160-local 1 de Barrio LOS PLATANOS o donde el LOCADOR lo indique a futuro, en el horario de lunes a viernes de 9 a 12:30 y de 16 a 18:30,
        emitiéndose el correspondiente recibo de pago. El LOCADOR autoriza expresamente a la Señora MARCELA VIVIANA BRITOS MP 04-2828/02-2826 para actuar como GESTOR conforme al Art. 1781 y correlativos del Código Civil y Comercial
        a realizar cobranzas de alquileres, recargos por mora y todos los rubros accesorios de la locación, pago de servicios cuando corresponda, realizar intimaciones de pago, emplazamientos para la desocupación y recibir la propiedad conjuntamente con la presencia del LOCADOR.</p>

      <p><span class="clausula-titulo">CUARTA: DESTINO:</span> 1) El inmueble locado solo podrá destinarse a uso FAMILIAR quedando prohibido al LOCATARIO darle otro destino.
        2) Están prohibidas cualesquiera sublocación o transmisiones, parciales o totales, transitorias o permanentes, gratuitas u onerosas y en general, a todo título y el cambio de destino, total o parcial, permanentes o temporario.
        3) La falta de cumplimiento de las obligaciones contenidas en esta Cláusula por el LOCATARIO, ocasionará la resolución de pleno derecho de este contrato debiendo pagar al LOCADOR, como Cláusula Penal,
        una suma equivalente al monto de un mes y medio (1 ½) de alquiler más los alquileres adeudados hasta la efectiva entrega del bien locado al LOCADOR.</p>

      <p><span class="clausula-titulo">QUINTA: MEJORAS, MODIFICACIONES Y COSAS RIESGOSAS:</span> 1) No podrá el LOCATARIO hacer modificaciones de ninguna naturaleza en la propiedad sin consentimiento previo por escrito del LOCADOR.
        Este podrá exigir la demolición de las que se efectúen sin su permiso, lo que correrá por cuenta y cargo del inquilino, o bien mantenerlas. Las mejoras que el LOCATARIO hiciere, de cualquier naturaleza que fueren, quedarán a beneficio de la propiedad sin remuneración alguna.
        2) Tampoco podrá el LOCATARIO tener en la propiedad cosas que pudieran afectar la seguridad de las personas, objetos e instalaciones, ni realizar actos que contraríen las normas municipales vigentes.
        3) La basura debe ser sacada y puesta en su respectivo cesto en el horario que disponga el ente recolector. 4) No se permite la tenencia de mascotas sin autorización del LOCADOR.</p>

      <p><span class="clausula-titulo">SEXTA: DEMÁS CARGAS DEL LOCATARIO:</span> 1) El LOCATARIO se compromete a abonar directamente a la compañía que le suministre el cien por ciento (100%) de la energía eléctrica,
        el 25% del servicio de agua, el 100% del servicio de gas natural y el 100% de cualquier otro servicio que contrate para uso particular. En caso que la empresa prestataria del servicio de agua proceda a la instalación de medidores independientes,
        el LOCADOR, a partir de dicho momento, deberá abonar el ciento por ciento (100%) de dicho servicio y correspondiente a la porción del inmueble locado.
        2) Será obligación del LOCATARIO, cancelar (pagar) y entregar al LOCADOR o su representante los comprobantes pagos de dichos servicios, cancelados por pagos dentro de los plazos del primer vencimiento, contra entrega de recibo por el LOCADOR o su representante.
        3) Queda establecido que los cargos por servicios deben ser abonados por el LOCATARIO en los plazos respectivos, bajo apercibimiento de considerarse que el incumplimiento de pagos de cualquiera de estos importes autorizará al LOCADOR a negarse a recibir el valor del alquiler, sino acredita estar al día en los demás conceptos.
        En virtud de ello la falta de pago del mismo, tendrá igual consecuencia que el impago de los alquileres y podrá demandarse por la vía ejecutiva.
        4) El LOCATARIO se compromete expresamente a poner a su nombre el medidor de luz instalado en el inmueble locado o solicitar uno nuevo en caso de que este haya sido removido por la empresa prestataria del servicio, en el término de diez (10) días corridos de la firma del presente,
        quedando el LOCADOR facultado a solicitar la recisión del contrato y la devolución del inmueble en caso de incumplimiento. Asimismo, se compromete a demostrar su cumplimiento en el pago del presente suministro, en cada oportunidad que el LOCADOR se lo solicite.
        Si al finalizar el presente contrato, el medidor suministrado por la empresa prestataria del servicio a nombre del LOCATARIO mantuviera alguna deuda que imposibilite al LOCADOR la posterior locación del inmueble se cobrará daños y perjuicios por los daños que ello le hubiere ocasionado.
        5) El LOCATARIO no podrá realizar actos ilícitos y/o fraudulentos con el fin de proveerse de suministros y/o servicios, tener animales de cualquier naturaleza que resulten molestos al vecindario y/o cosas que pudieran afectar la estructura del inmueble y la seguridad de las personas,
        ni realizar actos que contraríen disposiciones provinciales o municipales. 6) Los impuestos Municipales y Provinciales que gravan el inmueble son a cargo del LOCADOR. Al momento de la finalización de la locación el LOCATARIO deberá abonar un depósito en concepto de facturas de los servicios que no se encuentran aún emitidos.</p>

      <p><span class="clausula-titulo">SEPTIMA: RESOLUCIÓN ANTICIPADA:</span> 1) El LOCATARIO puede resolver el contrato en cualquier momento, abonando una suma equivalente al 10% de todos los alquileres que faltan, para que termine el plazo estipulado en el contrato.
        2) El LOCADOR podrá resolver el contrato en cualquier momento, sin abonar indemnización alguna y deberá dar un aviso previo de por lo menos 30 días.</p>

      <p><span class="clausula-titulo">OCTAVA: CONDICIÓN EN QUE SE RECIBE EL INMUEBLE:</span> El inmueble. El LOCATARIO recibe el inmueble en buenas condiciones de seguridad, conservación, higiene, habitabilidad y uso que declara conocer,
        se entrega totalmente pintado, con todos los vidrios sanos, herrajes, llaves y demás accesorios sanos, y se obliga a restituirlos en iguales condiciones, a efectuar las reparaciones necesarias y a poner los faltantes sin cargo para el LOCADOR,
        todo ello sin perjuicio del desgaste natural causado por el buen uso y el transcurso del tiempo. Deberá limpiar regularmente los techos para evitar que se tapen los desagües. El LOCADOR debe conservar el inmueble en estado de servir al uso y goce convenido
        y efectuar a su cargo la reparación que exija el deterioro en su calidad o defecto, originado por cualquier causa, que no sea imputable al LOCATARIO. Si el LOCATARIO no tuvo respuesta, podrá realizar por su cuenta la reparación, con cargo al LOCADOR,
        una vez transcurridas las 72 horas de aviso. Si las reparaciones no son urgentes, el LOCATARIO, podrá intimar al LOCADOR, para que las realice dentro de un plazo que no podrá ser inferior a 10 días corridos.
        La notificación deberá realizarse al domicilio denunciado por el LOCADOR en el contrato, aún si existiera negativa de recepción. El inventario se realizará transcurrido los 45 días de ingreso del LOCATARIO a la vivienda con presencia del LOCADOR o su representante y el LOCATARIO.</p>

      <p><span class="clausula-titulo">NOVENA: INSPECCIONES:</span> 1) El LOCADOR conjunta o individualmente o por medio de quien designe, podrá inspeccionar el inmueble en los días hábiles, durante el horario de 08:00 a 21:00 horas, notificando al LOCATARIO 48 horas antes.
        2) El LOCATARIO permitirá visitar la propiedad a Martilleros y terceros en el caso de disponer el propietario su venta dándole prioridad al Locatario, teniendo en cuenta la inversión realizada. El LOCADOR se obliga a que la autorización que se confiere sea usada con la mayor prudencia y dentro de los horarios establecidos en el primer párrafo de la presente cláusula.
        En caso que se produzca la venta de la propiedad estando activo el contrato de locación, se le dará al LOCATARIO un plazo de seis meses para dejar el inmueble, debiendo cumplir con todo lo estipulado en el contrato.</p>

      <p><span class="clausula-titulo">DECIMA:</span> El LOCADOR no será responsable por los daños y perjuicios que sufriera el LOCATARIO en su persona y/o en sus bienes, terceros y/o en los bienes de los mismos, por causas de roturas, desperfectos, cortocircuitos, filtraciones, derrumbes, incendios, inundaciones,
        averías y/o accidentes de cualquier causa, incluyendo las enunciadas en el Art. 1517 del Código Civil, desde que el LOCATARIO toma a su cargo como riesgo propio incluso el caso fortuito y la fuerza mayor.</p>

      <p><span class="clausula-titulo">DECIMA PRIMERA: INCUMPLIMIENTO:</span> 1) La mora en el cumplimiento de las obligaciones del LOCATARIO, será automática e innecesaria de pre-interpelación o intimación para su constitución.
        2) Todo incumplimiento del LOCATARIO, autoriza al LOCADOR rescindir del presente contrato por culpa del LOCATARIO y lo habilitará al cobro de las cláusulas penales y/o daños y perjuicios.
        3) La falta de pago en término del alquiler por el LOCATARIO, lo obligará a pagar al LOCADOR un interés punitorio equivalente al 1% diario desde el primer día del mes hasta el pago total del alquiler adeudado.
        4) Si vencido el término convenido de la locación, o el previsto para la desocupación del inmueble en caso de optar el LOCATARIO por la resolución anticipada, este no restituyere el inmueble en las condiciones convenidas en el presente, y que sin ello lo implique reconducción locativa, nuevo contrato o prórroga alguna,
        subsistirá la obligación del mismo, mientras dure la ocupación, de abonar el alquiler mensual con más una multa diaria del 10% por cada día de demora en la restitución del inmueble. Ello sin perjuicio de las acciones que le correspondan al LOCADOR para exigir el desalojo del inmueble y la indemnización por los daños y perjuicios que la mora del LOCATARIO en la restitución le ocasionara.</p>

      <p><span class="clausula-titulo">DECIMA SEGUNDA: ABANDONO Y/O DEPÓSITO DE LLAVES:</span> 1) El único instrumento válido con el cual el LOCATARIO podrá acreditar fehacientemente la restitución del inmueble locado, será el emanado exclusivamente del LOCADOR.
        2) Quedan facultados los fiadores para hacer entrega del inmueble al LOCADOR, en caso de abandono o desalojo del mismo por parte del LOCATARIO.</p>

      <p><span class="clausula-titulo">DECIMA TERCERA: INTANGIBILIDAD DEL ALQUILER:</span> El LOCADOR deberá percibir del LOCATARIO los alquileres sin ningún tipo de retención por impuestos a las Ganancias o cualquier otro creado o a crearse, incluido el IVA, sea de emergencia o no.</p>

      <p><span class="clausula-titulo">DECIMA CUARTA: PROHIBICIÓN DE VERBALIDAD:</span> Queda establecido en forma irrevocable que todas las cláusulas de este contrato han sido elaboradas por escrito y no se admitirá la forma verbal para cualquier modificación y/o prolongación que pudiese haber.</p>

      <p><span class="clausula-titulo">DECIMA QUINTA: RESPONSABILIDAD POR EVENTOS DAÑOSOS:</span> El LOCATARIO asume la plena y absoluta responsabilidad por los daños que el inmueble reciba en locación, personas o inmuebles o cosas muebles de terceros, pudieran derivarse de incendio, explosión u otros eventos dañosos, originados en casos depositadas en el inmueble, o del hecho del LOCATARIO o de las personas que de él dependen.</p>

      <p><span class="clausula-titulo">DECIMA SEXTA: FIADORES:</span> ${htmlFiadores}
        Los fiadores renuncian a los beneficios de excusión y división, perdurando su garantía hasta el momento del efectivo reintegro de la tenencia del bien locado al LOCADOR, el que debe constar por escrito emanado de éste.
        Si el LOCATARIO se atrasa en el pago del alquiler, el hecho de no dar aviso a los fiadores ni demandarlos no importa prórroga de plazo al LOCATARIO ni a los fiadores, ni extingue la fianza.
        La responsabilidad de los fiadores abarcará también la responsabilidad civil hacia tercero, que pueda surgir para el LOCATARIO, por causas de esta Locación. El LOCADOR podrá exigir el cambio o reemplazo de fiadores en caso de insolvencia, fallecimiento, desaparición o quiebra de los mismos.</p>

      <p><span class="clausula-titulo">DECIMA SEPTIMA: RENUNCIA A LA INEMBARGABILIDAD DE HABERES:</span> El LOCATARIO y los Garantes renuncian expresamente a la inembargabilidad de sus haberes dispuesta por Leyes Nacionales y/o Provinciales, disposiciones y/o convenios colectivos de trabajo,
        de que gocen en sus actuales actividades y/o en las que desarrollen en el futuro, a favor del eventual crédito de los locadores por todas las obligaciones emergentes del presente a cargo del LOCATARIO. En caso de que el inquilino y/o algún Garante fuera jubilado o pensionado (en la actualidad o en el futuro),
        ya sea jubilado o pensionado del orden Provincial o Nacionales de manera expresa renuncia al beneficio de inembargabilidad de su haber jubilatorio o de pensión, consintiendo expresamente que en caso de incumplimiento se trabe embargo sobre el veinte por ciento 20% de dicho haber neto, hasta cubrir el total de la suma que se adeude,
        renunciando a peticionar levantamientos de cautelares y/o embargo, como asimismo renunciando a plantear inconstitucionalidad alguna.</p>

      <p><span class="clausula-titulo">DECIMA OCTAVA: LISTADO DE MOROSOS:</span> Se deja expresamente convenido por la presente, que el LOCADOR o quien administre el presente alquiler, se reserva el derecho de remitir los datos personales del LOCATARIO y fiadores,
        en el supuesto de falta de pago de los alquileres o cualquier otro incumplimiento de las obligaciones contraída en el presente contrato, a bancos de datos de deudores morosos al que se encuentre adherido (Ej. Seven, Veraz, Riesgooline, etc.).
        Dado el supuesto y, una vez regularizada la deuda o el incumplimiento a que diera lugar dicha remisión, el LOCADOR se compromete a comunicarlo fehacientemente a la empresa correspondiente a los fines de la eliminación de dichos datos personales del registro de deudores morosos.</p>

      <p><span class="clausula-titulo">DECIMA NOVENA: NOTIFICACIONES:</span> Cuando el instrumento representativo de cualquier comunicación (telegrama, carta documento, etc.) dirigida del LOCADOR al LOCATARIO y a los fiadores, no fuere recibida por estos, por cualquier causa que fuere,
        se tendrá por notificado al destinatario, en la fecha de devolución que figure en el recibo o en la carta restituida, cuando la misma hubiera sido remitida al domicilio legal y contractualmente convenido.</p>

      <p><span class="clausula-titulo">VIGESIMA: SELLADO FISCAL, GASTOS Y HONORARIOS:</span> El sellado que corresponde en este instrumento, así como también los gastos por informes solicitados y los honorarios del profesional interviniente en la confección del presente, deberá ser abonado por el LOCATARIO.</p>

      <p><span class="clausula-titulo">VIGESIMA PRIMERA: CONSTITUCIÓN DE DOMICILIO:</span> 1) A los efectos judiciales y extrajudiciales del presente, se constituyen los siguientes domicilios: El LOCADOR, LOCATARIO y FIADORES en el indicado en el presente contrato y además podrán constituir un domicilio electrónico en el que se tengan por eficaces todas las notificaciones.
        2) Las partes acuerdan someterse a la competencia judicial de los Tribunales Ordinarios de la Ciudad de Córdoba Capital, Provincia de Córdoba, República Argentina, renunciando a todo otro fuero o jurisdicción que les pudiera corresponder.</p>

      <p>Previa lectura y ratificación, firman las partes de conformidad tres ejemplares de un mismo tenor y a un solo efecto quedando el original para el LOCADOR, siendo la copia fiel del original para el LOCATARIO.</p>

      <div class="firmas">
        <div>LOCADOR<br/>${propietario ? propietario.nombre + ' ' + propietario.apellido : ''}<br/>DNI Nº ${propietario?.dni || ''}</div>
        <div>LOCATARIO<br/>${inquilino ? inquilino.nombre + ' ' + inquilino.apellido : ''}<br/>DNI Nº ${inquilino?.dni || ''}</div>
      </div>
    `
  }

  const [contenidoInicial, setContenidoInicial] = useState('')

  async function abrirEditorContrato(contrato) {
    const propiedad = propiedades.find(p => p.id === contrato.propiedad_id)
    const inquilino = clientes.find(c => c.id === contrato.cliente_id)
    const propietario = clientes.find(c => c.id === contrato.propietario_id)
    const { data: gar } = await supabase.from('garantes').select('*').eq('contrato_id', contrato.id)

    const html = contrato.texto_contrato || generarClausulasHtml(contrato, propiedad, inquilino, propietario, gar)
    setContenidoInicial(html)
    setContratoEditor(contrato)
    setModalTextoAbierto(true)
  }

  useEffect(() => {
    if (modalTextoAbierto && editorRef.current) {
      editorRef.current.innerHTML = contenidoInicial
    }
  }, [modalTextoAbierto, contenidoInicial])

  function aplicarFormato(comando, valor = null) {
    document.execCommand(comando, false, valor)
    if (editorRef.current) editorRef.current.focus()
  }
async function guardarTextoContrato() {
    const html = editorRef.current.innerHTML
    const { error } = await supabase.from('contratos').update({ texto_contrato: html }).eq('id', contratoEditor.id)
    if (error) alert('No se pudo guardar: ' + error.message)
    else alert('Contrato guardado.')
  }

  function imprimirDesdeEditor() {
    const html = editorRef.current.innerHTML
    const ventana = window.open('', '_blank')
    ventana.document.write(`
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Contrato</title>
        <style>
          body { font-family: 'Times New Roman', serif; max-width: 780px; margin: 40px auto; line-height: 1.6; color: #111; font-size: 14px; }
          h1 { text-align: center; font-size: 20px; font-style: italic; }
          .encabezado { margin-bottom: 30px; }
          p { text-align: justify; }
          .clausula-titulo { font-weight: bold; text-decoration: underline; }
          .firmas { margin-top: 90px; display: flex; justify-content: space-between; }
          .firmas div { width: 45%; text-align: center; border-top: 1px solid #000; padding-top: 6px; }
          @media print { body { margin: 15px; } }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 300)
  }

  const contratosFiltrados = contratos.filter(c => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return true
    const numero = c.numero_contrato ? String(c.numero_contrato) : ''
    const direccion = nombreProp(c.propiedad_id).toLowerCase()
    return numero.includes(texto) || direccion.includes(texto)
  })

  return (
    <div>
      <h1>Contratos</h1>
      <div className="toolbar">
        <input placeholder="Buscar por N° de contrato o dirección..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <button className="btn-primary" onClick={abrirNuevo}>+ Nuevo contrato</button>
      </div>

      {loading ? <p>Cargando...</p> : contratosFiltrados.length === 0 ? (
        <div className="empty">No hay contratos que coincidan con la búsqueda.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>N°</th><th>Tipo</th><th>Propiedad</th><th>Inquilino/Comprador</th><th>Propietario</th><th>Importe</th><th>Vence</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {contratosFiltrados.map(c => (
              <tr key={c.id}>
                <td>{c.numero_contrato ? `#${c.numero_contrato}` : '—'}</td>
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
                  <button className="btn-secondary" onClick={() => abrirEditorContrato(c)}>Contrato</button>{' '}
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
              <BuscadorCliente
                label="Propietario"
                clientes={clientes}
                valor={form.propietario_id}
                onSeleccionar={id => setForm({ ...form, propietario_id: id })}
              />
              <BuscadorCliente
                label="Cliente (inquilino / comprador)"
                clientes={clientes}
                valor={form.cliente_id}
                onSeleccionar={id => setForm({ ...form, cliente_id: id })}
                requerido
              />
              <label>Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
              <label>Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} />
              <label>Importe</label>
              <input type="number" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} />
              <label>Modo de pago</label>
              <select value={form.modo_pago} onChange={e => setForm({ ...form, modo_pago: e.target.value })}>
                <option value="">Seleccionar...</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia bancaria">Transferencia bancaria</option>
                <option value="Débito automático">Débito automático</option>
                <option value="Cheque">Cheque</option>
                <option value="Mercado Pago">Mercado Pago</option>
              </select>
              <label>Día de vencimiento mensual</label>
              <input type="number" min="1" max="31" value={form.dia_vencimiento} onChange={e => setForm({ ...form, dia_vencimiento: e.target.value })} />
              <label>Porcentaje de aumento</label>
              <input type="number" placeholder="Ej: 50" value={form.porcentaje_aumento} onChange={e => setForm({ ...form, porcentaje_aumento: e.target.value })} />
              <label>Cada cuánto se aplica el aumento</label>
              <select value={form.periodo_aumento} onChange={e => setForm({ ...form, periodo_aumento: e.target.value })}>
                <option value="semestral">Semestral</option>
                <option value="trimestral">Trimestral</option>
                <option value="cuatrimestral">Cuatrimestral</option>
                <option value="anual">Anual</option>
              </select>
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
                ))}<div className="modal-actions">
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

      {modalTextoAbierto && contratoEditor && (
        <div className="modal-overlay" onClick={() => setModalTextoAbierto(false)}>
          <div className="modal" style={{ width: '95vw', maxWidth: 1100, height: '99vh', maxHeight: 'none', margin: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <h2>Contrato — {nombreProp(contratoEditor.propiedad_id)}</h2>
            <p style={{ fontSize: 12, color: '#777' }}>Podés hacer clic en cualquier parte del texto y editarlo directamente.</p>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, padding: 8, background: '#f4f4f4', borderRadius: 6 }}>
              <button type="button" className="btn-secondary" style={{ fontWeight: 'bold' }} onMouseDown={e => { e.preventDefault(); aplicarFormato('bold') }}>N</button>
              <button type="button" className="btn-secondary" style={{ fontStyle: 'italic' }} onMouseDown={e => { e.preventDefault(); aplicarFormato('italic') }}>K</button>
              <button type="button" className="btn-secondary" style={{ textDecoration: 'underline' }} onMouseDown={e => { e.preventDefault(); aplicarFormato('underline') }}>S</button>
              <select onMouseDown={e => e.stopPropagation()} onChange={e => aplicarFormato('fontName', e.target.value)} defaultValue="">
                <option value="" disabled>Tipo de letra</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
              </select>
              <select onMouseDown={e => e.stopPropagation()} onChange={e => aplicarFormato('fontSize', e.target.value)} defaultValue="">
                <option value="" disabled>Tamaño</option>
                <option value="2">Chico</option>
                <option value="3">Normal</option>
                <option value="4">Mediano</option>
                <option value="5">Grande</option>
                <option value="6">Muy grande</option>
              </select>
              <button type="button" className="btn-secondary" onMouseDown={e => { e.preventDefault(); aplicarFormato('justifyLeft') }}>Izq</button>
              <button type="button" className="btn-secondary" onMouseDown={e => { e.preventDefault(); aplicarFormato('justifyCenter') }}>Centro</button>
              <button type="button" className="btn-secondary" onMouseDown={e => { e.preventDefault(); aplicarFormato('justifyFull') }}>Justificar</button>
            </div>

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              style={{
                border: '1px solid #ccc', borderRadius: 8, padding: 24, flex: 1, overflowY: 'auto',
                fontFamily: "'Times New Roman', serif", fontSize: 14, lineHeight: 1.6, background: '#fff'
              }}
            />
            <style>{`.clausula-titulo { font-weight: bold; text-decoration: underline; } .encabezado { margin-bottom: 20px; } .firmas { margin-top: 60px; display: flex; justify-content: space-between; } .firmas div { width: 45%; text-align: center; border-top: 1px solid #000; padding-top: 6px; }`}</style>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalTextoAbierto(false)}>Cerrar</button>
              <button type="button" className="btn-secondary" onClick={guardarTextoContrato}>Guardar cambios</button>
              <button type="button" className="btn-primary" onClick={imprimirDesdeEditor}>Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}