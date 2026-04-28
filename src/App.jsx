import React, { useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'

const COMPANY = {
  name: 'Phoenix MGM Ltd',
  address: '202 Battersea Park Road, SW11 4ND, London',
  email: 'phoenix.mgm@protonmail.com',
  phone: '07835208209',
  vatNumber: 'GB 307833893',
  hourlyRate: 27,
  callOutFee: 135,
  vatRate: 20,
}

function money(value) {
  return `£${Number(value || 0).toFixed(2)}`
}

function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function locationText(loc) {
  if (!loc) return 'Location not captured'
  return `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)} · accuracy ${Math.round(loc.accuracy)}m`
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [login, setLogin] = useState({ email: '', password: '' })

  const [client, setClient] = useState({ name: '', address: '', email: '', phone: '' })
  const [job, setJob] = useState({
    title: '',
    description: '',
    workers: 1,
    startTime: null,
    stopTime: null,
    startLocation: null,
    stopLocation: null,
    status: 'not started',
    startSignature: '',
    endSignature: '',
    termsAccepted: false,
  })

  const [expenses, setExpenses] = useState([
    { id: crypto.randomUUID(), category: 'Parking', description: '', amount: 0 },
  ])
  const [photos, setPhotos] = useState([])
  const [payment, setPayment] = useState({
    deposit: 0,
    method: 'Bank Transfer',
    payments: [],
    reminderDate: '',
    reminderNote: '',
  })

  const [signatureMode, setSignatureMode] = useState(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)

  const actualHours = useMemo(() => {
    if (!job.startTime || !job.stopTime) return 0
    const ms = new Date(job.stopTime) - new Date(job.startTime)
    return Math.max(0, Math.round((ms / 3600000) * 100) / 100)
  }, [job.startTime, job.stopTime])

  const billableHours = actualHours * Number(job.workers || 1)
  const labourTotal = billableHours * COMPANY.hourlyRate
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const subtotal = COMPANY.callOutFee + labourTotal + expenseTotal
  const vat = subtotal * (COMPANY.vatRate / 100)
  const total = subtotal + vat
  const extraPayments = payment.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const paidTotal = Number(payment.deposit || 0) + extraPayments
  const balance = Math.max(0, total - paidTotal)
  const invoiceStatus = balance <= 0 ? 'Paid' : paidTotal > 0 ? 'Partially Paid' : 'Unpaid'

  async function captureLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
        }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  async function startJob() {
    const loc = await captureLocation()
    setJob((j) => ({ ...j, startTime: new Date().toISOString(), startLocation: loc, status: 'running' }))
  }

  async function stopJob() {
    const loc = await captureLocation()
    setJob((j) => ({ ...j, stopTime: new Date().toISOString(), stopLocation: loc, status: 'stopped' }))
  }

  function addExpense() {
    setExpenses((items) => [...items, { id: crypto.randomUUID(), category: 'Materials', description: '', amount: 0 }])
  }

  function updateExpense(id, key, value) {
    setExpenses((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item))
  }

  function removeExpense(id) {
    setExpenses((items) => items.filter((item) => item.id !== id))
  }

  function preparePhotoUpload(type) {
    fileRef.current.dataset.type = type
    fileRef.current.click()
  }

  function addPhotos(event) {
    const type = event.currentTarget.dataset.type || 'during'
    const files = Array.from(event.target.files || [])
    setPhotos((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        type,
        name: file.name,
        url: URL.createObjectURL(file),
        capturedAt: new Date().toISOString(),
      })),
    ])
  }

  function draw(event) {
    const canvas = canvasRef.current
    if (!canvas || event.buttons !== 1) return
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top)
  }

  function saveSignature() {
    const canvas = canvasRef.current
    if (!canvas || !signatureMode) return
    const data = canvas.toDataURL('image/png')
    setJob((j) => ({ ...j, [signatureMode === 'start' ? 'startSignature' : 'endSignature']: data }))
    setSignatureMode(null)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  function addPaymentRecord() {
    setPayment((p) => ({
      ...p,
      payments: [...p.payments, { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), method: p.method, amount: 0, note: '' }],
    }))
  }

  function updatePaymentRecord(id, key, value) {
    setPayment((p) => ({ ...p, payments: p.payments.map((item) => item.id === id ? { ...item, [key]: value } : item) }))
  }

  function removePaymentRecord(id) {
    setPayment((p) => ({ ...p, payments: p.payments.filter((item) => item.id !== id) }))
  }

  function generatePDF() {
    const doc = new jsPDF()
    let y = 18
    doc.setFontSize(18)
    doc.text(`${COMPANY.name} - Invoice`, 18, y)
    y += 8
    doc.setFontSize(10)
    doc.text(COMPANY.address, 18, y); y += 5
    doc.text(`${COMPANY.email} · ${COMPANY.phone}`, 18, y); y += 5
    doc.text(`VAT No: ${COMPANY.vatNumber}`, 18, y); y += 10

    doc.setFontSize(12)
    doc.text(`Invoice No: INV-${new Date().getFullYear()}-001`, 18, y); y += 6
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 18, y); y += 9

    doc.text(`Client: ${client.name || '—'}`, 18, y); y += 6
    doc.text(`Job Address: ${client.address || '—'}`, 18, y); y += 6
    doc.text(`Job: ${job.title || '—'}`, 18, y); y += 8

    doc.text(`Call-out: ${money(COMPANY.callOutFee)}`, 18, y); y += 6
    doc.text(`Labour: ${actualHours} site hours x ${job.workers || 1} worker(s) = ${billableHours} billable hours x ${money(COMPANY.hourlyRate)} = ${money(labourTotal)}`, 18, y); y += 6
    doc.text(`Expenses: ${money(expenseTotal)}`, 18, y); y += 6
    doc.text(`Subtotal: ${money(subtotal)}`, 18, y); y += 6
    doc.text(`VAT ${COMPANY.vatRate}%: ${money(vat)}`, 18, y); y += 6
    doc.text(`Total: ${money(total)}`, 18, y); y += 6
    doc.text(`Paid: ${money(paidTotal)}`, 18, y); y += 6
    doc.text(`Balance Due: ${money(balance)}`, 18, y); y += 10

    doc.setFontSize(10)
    doc.text('Terms: payment due within 7 days. Deposits are non-refundable once work has commenced.', 18, y); y += 5
    doc.text('Additional work/materials/parking/congestion/ULEZ are charged separately unless agreed.', 18, y); y += 5
    doc.text('Customer signature confirms attendance, work progress/completion and recorded labour hours.', 18, y)

    doc.save('phoenix-mgm-invoice.pdf')
  }

  const invoiceMessage = encodeURIComponent(
    `Hello ${client.name || ''},\n\nPhoenix MGM Ltd invoice summary:\nJob: ${job.title || 'Job'}\nTotal: ${money(total)}\nPaid: ${money(paidTotal)}\nBalance due: ${money(balance)}\n\nPayment due within 7 days.\n\nKind regards,\nPhoenix MGM Ltd`
  )

  function emailInvoice() {
    const subject = encodeURIComponent(`Phoenix MGM Ltd Invoice - ${job.title || 'Job'}`)
    window.location.href = `mailto:${client.email || ''}?subject=${subject}&body=${invoiceMessage}`
  }

  function whatsappInvoice() {
    window.open(`https://wa.me/?text=${invoiceMessage}`, '_blank')
  }

  if (!loggedIn) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={(e) => { e.preventDefault(); if (login.email && login.password) setLoggedIn(true) }}>
          <img src="/logo-phoenix.bmp" alt="Phoenix MGM logo" className="login-logo" />
          <h1>Phoenix MGM Ltd</h1>
          <p>Job invoice system</p>
          <input type="email" placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
          <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          <button>Login</button>
          <small>Demo login: enter any email and password. Production version needs secure auth/database.</small>
        </form>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo-phoenix.bmp" alt="Phoenix MGM logo" />
          <div>
            <h1>Daily Job Invoice App</h1>
            <p>{COMPANY.name} · VAT {COMPANY.vatNumber}</p>
          </div>
        </div>
        <span className="status">{job.status}</span>
      </header>

      <section className="grid two">
        <div className="card">
          <h2>Client</h2>
          <input placeholder="Client name" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
          <input placeholder="Job address" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} />
          <input placeholder="Client email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          <input placeholder="Client phone" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
        </div>

        <div className="card">
          <h2>Job</h2>
          <input placeholder="Job title" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
          <input type="number" min="1" placeholder="Number of workers" value={job.workers} onChange={(e) => setJob({ ...job, workers: e.target.value })} />
          <textarea placeholder="Job description" value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} />
        </div>
      </section>

      <section className="card">
        <h2>Time & Location</h2>
        <div className="grid two">
          <div className="info"><b>Start</b><br />{dateTime(job.startTime)}<br /><small>{locationText(job.startLocation)}</small></div>
          <div className="info"><b>Stop</b><br />{dateTime(job.stopTime)}<br /><small>{locationText(job.stopLocation)}</small></div>
        </div>
        <div className="actions">
          <button onClick={startJob}>Start Job</button>
          <button className="secondary" onClick={stopJob}>Stop Job</button>
        </div>
        <div className="summary-row">
          <span>Site hours: <b>{actualHours}</b></span>
          <span>Workers: <b>{job.workers || 1}</b></span>
          <span>Billable hours: <b>{billableHours}</b></span>
          <span>Labour: <b>{money(labourTotal)}</b></span>
        </div>
      </section>

      <section className="card">
        <h2>Photos</h2>
        <input ref={fileRef} type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={addPhotos} />
        <div className="actions">
          <button className="secondary" onClick={() => preparePhotoUpload('before')}>Before</button>
          <button className="secondary" onClick={() => preparePhotoUpload('during')}>During</button>
          <button className="secondary" onClick={() => preparePhotoUpload('after')}>After</button>
        </div>
        <div className="photos">
          {photos.map((p) => <div key={p.id}><img src={p.url} alt={p.name} /><b>{p.type}</b><small>{dateTime(p.capturedAt)}</small></div>)}
        </div>
      </section>

      <section className="card">
        <h2>Expenses</h2>
        {expenses.map((e) => (
          <div className="expense" key={e.id}>
            <select value={e.category} onChange={(event) => updateExpense(e.id, 'category', event.target.value)}>
              <option>Parking</option><option>Congestion Charge</option><option>ULEZ</option><option>Materials</option><option>Tool rental</option><option>Subcontractor</option><option>Other</option>
            </select>
            <input placeholder="Description" value={e.description} onChange={(event) => updateExpense(e.id, 'description', event.target.value)} />
            <input type="number" placeholder="Amount" value={e.amount} onChange={(event) => updateExpense(e.id, 'amount', event.target.value)} />
            <button className="danger" onClick={() => removeExpense(e.id)}>Remove</button>
          </div>
        ))}
        <button className="secondary" onClick={addExpense}>Add expense</button>
      </section>

      <section className="card">
        <h2>Payment</h2>
        <div className="grid two">
          <input type="number" placeholder="Deposit" value={payment.deposit} onChange={(e) => setPayment({ ...payment, deposit: e.target.value })} />
          <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
            <option>Bank Transfer</option><option>Cash</option><option>Card</option>
          </select>
        </div>
        <div className="summary-row">
          <span>Status: <b>{invoiceStatus}</b></span>
          <span>Paid: <b>{money(paidTotal)}</b></span>
          <span>Balance: <b>{money(balance)}</b></span>
        </div>
        <h3>Payment history</h3>
        {payment.payments.map((item) => (
          <div className="expense" key={item.id}>
            <input type="date" value={item.date} onChange={(e) => updatePaymentRecord(item.id, 'date', e.target.value)} />
            <select value={item.method} onChange={(e) => updatePaymentRecord(item.id, 'method', e.target.value)}><option>Bank Transfer</option><option>Cash</option><option>Card</option></select>
            <input type="number" placeholder="Amount" value={item.amount} onChange={(e) => updatePaymentRecord(item.id, 'amount', e.target.value)} />
            <input placeholder="Note" value={item.note} onChange={(e) => updatePaymentRecord(item.id, 'note', e.target.value)} />
            <button className="danger" onClick={() => removePaymentRecord(item.id)}>Remove</button>
          </div>
        ))}
        <button className="secondary" onClick={addPaymentRecord}>Add payment</button>
        <div className="grid two reminder">
          <input type="date" value={payment.reminderDate} onChange={(e) => setPayment({ ...payment, reminderDate: e.target.value })} />
          <input placeholder="Reminder note" value={payment.reminderNote} onChange={(e) => setPayment({ ...payment, reminderNote: e.target.value })} />
        </div>
      </section>

      <section className="card">
        <h2>Customer Signatures</h2>
        <div className="grid two">
          <div className="signature-box">
            <b>Start signature</b>
            {job.startSignature && <img src={job.startSignature} alt="Start signature" />}
            <button className="secondary" onClick={() => setSignatureMode('start')}>Sign start</button>
          </div>
          <div className="signature-box">
            <b>Completion signature</b>
            {job.endSignature && <img src={job.endSignature} alt="Completion signature" />}
            <button className="secondary" onClick={() => setSignatureMode('end')}>Sign completion</button>
          </div>
        </div>
      </section>

      <section className="invoice">
        <div className="invoice-head">
          <div className="brand"><img src="/logo-phoenix.bmp" alt="Phoenix MGM logo" /><div><h2>{COMPANY.name}</h2><p>{COMPANY.address}<br />{COMPANY.email} · {COMPANY.phone}<br />VAT No: {COMPANY.vatNumber}</p></div></div>
          <div><h1>INVOICE</h1><p>INV-{new Date().getFullYear()}-001<br />{new Date().toLocaleDateString('en-GB')}</p></div>
        </div>
        <div className="grid two"><div><b>Bill to</b><p>{client.name || 'Client name'}<br />{client.address || 'Client address'}<br />{client.email}</p></div><div><b>Job details</b><p>{job.title || 'Job title'}<br />{job.description || 'Job description'}<br />Start: {dateTime(job.startTime)}<br />Stop: {dateTime(job.stopTime)}</p></div></div>
        <table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>Call-out fee</td><td>1</td><td>{money(COMPANY.callOutFee)}</td><td>{money(COMPANY.callOutFee)}</td></tr><tr><td>Labour ({actualHours} site hours × {job.workers || 1} worker(s))</td><td>{billableHours} h</td><td>{money(COMPANY.hourlyRate)}</td><td>{money(labourTotal)}</td></tr>{expenses.map((e) => <tr key={e.id}><td>{e.category} {e.description && `- ${e.description}`}</td><td>1</td><td>{money(e.amount)}</td><td>{money(e.amount)}</td></tr>)}</tbody></table>
        <div className="totals"><p>Subtotal: <b>{money(subtotal)}</b></p><p>VAT {COMPANY.vatRate}%: <b>{money(vat)}</b></p><p>Total: <b>{money(total)}</b></p><p>Paid: <b>{money(paidTotal)}</b></p><h2>Balance Due: {money(balance)}</h2></div>
        <div className="terms"><b>Terms & Conditions</b><ul><li>Payment due within 7 days from invoice date.</li><li>Deposits are non-refundable once work has commenced.</li><li>This invoice covers only agreed work. Additional work will be charged separately.</li><li>Materials, parking, congestion and other expenses are charged separately.</li><li>Late payments may incur statutory interest under UK law.</li><li>Customer signature confirms attendance, work and recorded labour hours.</li><li>No liability for pre-existing or hidden defects.</li><li>30-day workmanship guarantee, labour only unless stated.</li></ul><label><input type="checkbox" checked={job.termsAccepted} onChange={(e) => setJob({ ...job, termsAccepted: e.target.checked })} /> Customer agrees to Terms & Conditions</label></div>
        <div className="actions"><button onClick={generatePDF}>Download PDF</button><button className="secondary" onClick={emailInvoice}>Email invoice</button><button className="secondary" onClick={whatsappInvoice}>Send WhatsApp</button></div>
      </section>

      {signatureMode && (
        <div className="modal">
          <div className="modal-card">
            <h2>Customer signature - {signatureMode}</h2>
            <canvas ref={canvasRef} width="520" height="240" onMouseMove={draw} onMouseUp={() => canvasRef.current?.getContext('2d').beginPath()} onMouseLeave={() => canvasRef.current?.getContext('2d').beginPath()} />
            <div className="actions"><button className="secondary" onClick={clearSignature}>Clear</button><button className="secondary" onClick={() => setSignatureMode(null)}>Cancel</button><button onClick={saveSignature}>Save signature</button></div>
          </div>
        </div>
      )}
    </main>
  )
}
