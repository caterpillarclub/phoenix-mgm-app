import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import jsPDF from 'jspdf'
import './style.css'

const COMPANY = {
  name: 'Phoenix MGM Ltd',
  address: '202 Battersea Park Road, SW11 4ND, London',
  email: 'phoenix.mgm@protonmail.com',
  phone: '07835208209',
  vat: 'GB 307833893',
  hourlyRate: 27,
  callOut: 135,
  vatRate: 0.2,
}

function money(value) { return `£${Number(value || 0).toFixed(2)}` }

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [job, setJob] = useState({ title: '', description: '', workers: 1, hours: 0 })
  const [expenses, setExpenses] = useState([{ id: crypto.randomUUID(), category: 'Parking', description: '', amount: 0 }])
  const [deposit, setDeposit] = useState(0)
  const [payments, setPayments] = useState([])
  const [location, setLocation] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [jobStatus, setJobStatus] = useState('draft')
  const [reminder, setReminder] = useState({ date: '', note: '' })
  const isLocked = jobStatus === 'signed_end'

  const labour = useMemo(() => Number(job.hours || 0) * Number(job.workers || 1) * COMPANY.hourlyRate, [job.hours, job.workers])
  const expensesTotal = useMemo(() => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0), [expenses])
  const subtotal = COMPANY.callOut + labour + expensesTotal
  const vat = subtotal * COMPANY.vatRate
  const total = subtotal + vat
  const paidTotal = Number(deposit || 0) + payments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const balance = Math.max(0, total - paidTotal)
  const invoiceStatus = balance <= 0 ? 'Paid' : paidTotal > 0 ? 'Partially Paid' : 'Unpaid'

  const handleLogin = (e) => { e.preventDefault(); if (login.email && login.password) setLoggedIn(true) }

  const getLocation = () => {
    if (!termsAccepted) { alert('Customer must accept Terms & Conditions before location/job confirmation.'); return }
    if (!navigator.geolocation) { alert('Geolocation is not supported on this device/browser.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocation({ lat, lng, accuracy: pos.coords.accuracy, capturedAt: new Date().toLocaleString('en-GB') })
        if (jobStatus === 'draft') setJobStatus('started')
      },
      () => alert('Location permission denied or unavailable.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const confirmFinalSignature = () => {
    if (!termsAccepted) { alert('Customer must accept Terms & Conditions first.'); return }
    if (!customer.name.trim()) { alert('Please enter customer name before final confirmation.'); return }
    setJobStatus('signed_end')
  }

  const addExpense = () => setExpenses([...expenses, { id: crypto.randomUUID(), category: 'Materials', description: '', amount: 0 }])
  const updateExpense = (id, key, value) => setExpenses(expenses.map((e) => (e.id === id ? { ...e, [key]: value } : e)))
  const deleteExpense = (id) => setExpenses(expenses.filter((e) => e.id !== id))
  const addPayment = () => setPayments([...payments, { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer', amount: 0, note: '' }])
  const updatePayment = (id, key, value) => setPayments(payments.map((p) => (p.id === id ? { ...p, [key]: value } : p)))
  const deletePayment = (id) => setPayments(payments.filter((p) => p.id !== id))

  const invoiceMessage = encodeURIComponent(`Hello ${customer.name || ''},\n\nPhoenix MGM Ltd invoice summary:\nJob: ${job.title || 'Job'}\nTotal: ${money(total)}\nPaid: ${money(paidTotal)}\nBalance due: ${money(balance)}\nStatus: ${invoiceStatus}\n\nPayment due within 7 days.\n\nKind regards,\nPhoenix MGM Ltd`)

  const generatePDF = () => {
    const doc = new jsPDF()
    let y = 18
    doc.setFontSize(18); doc.text('Phoenix MGM Ltd - Invoice', 20, y); y += 8
    doc.setFontSize(9); doc.text(COMPANY.address, 20, y); y += 5
    doc.text(`${COMPANY.email} | ${COMPANY.phone} | VAT: ${COMPANY.vat}`, 20, y); y += 12
    doc.setFontSize(11)
    doc.text(`Customer: ${customer.name || 'Not entered'}`, 20, y); y += 6
    doc.text(`Customer address: ${customer.address || 'Not entered'}`, 20, y); y += 6
    doc.text(`Job: ${job.title || 'Not entered'}`, 20, y); y += 6
    doc.text(`Description: ${job.description || 'Not entered'}`, 20, y, { maxWidth: 170 }); y += 12
    doc.text(`Call-out: ${money(COMPANY.callOut)}`, 20, y); y += 6
    doc.text(`Labour: ${job.hours || 0} site hours x ${job.workers || 1} worker(s) x ${money(COMPANY.hourlyRate)} = ${money(labour)}`, 20, y); y += 6
    doc.text(`Expenses: ${money(expensesTotal)}`, 20, y); y += 6
    doc.text(`VAT 20%: ${money(vat)}`, 20, y); y += 6
    doc.text(`Total: ${money(total)}`, 20, y); y += 6
    doc.text(`Paid / Deposit: ${money(paidTotal)}`, 20, y); y += 6
    doc.text(`Balance due: ${money(balance)}`, 20, y); y += 6
    doc.text(`Invoice status: ${invoiceStatus}`, 20, y); y += 10
    if (location) {
      doc.text('Location Proof', 20, y); y += 6
      doc.text(`GPS: ${location.lat}, ${location.lng}`, 20, y); y += 6
      doc.text(`Accuracy: ${Math.round(location.accuracy || 0)} metres`, 20, y); y += 6
      doc.text(`Captured: ${location.capturedAt}`, 20, y); y += 6
      doc.text(`Google Maps: https://www.google.com/maps?q=${location.lat},${location.lng}`, 20, y); y += 10
    }
    doc.text('Legal Confirmation', 20, y); y += 6
    doc.setFontSize(8)
    const legal = [
      `Customer: ${customer.name || 'Not entered'}`,
      `Terms accepted: ${termsAccepted ? 'Yes' : 'No'}`,
      `Job status: ${jobStatus}`,
      'Customer confirms work has been carried out as agreed and accepts the recorded labour time, materials, expenses and charges.',
      'Location data is recorded at job start/end as supporting evidence of attendance and work carried out on site.',
      'After final customer confirmation, this job record is treated as locked.',
      'Payment due within 7 days from invoice date. Deposits are non-refundable once work has commenced.',
      'Additional work, parking, congestion charge, ULEZ and materials are charged separately unless agreed in writing.',
      'Late payments may incur statutory interest under UK law.',
      'Phoenix MGM Ltd is not liable for pre-existing conditions, hidden defects or unforeseen structural issues.',
      '30-day workmanship guarantee applies to labour only unless otherwise stated.'
    ]
    legal.forEach((line) => { doc.text(line, 20, y, { maxWidth: 170 }); y += 6 })
    doc.save('phoenix-mgm-invoice.pdf')
  }

  const sendEmail = () => { const subject = encodeURIComponent(`Phoenix MGM Ltd Invoice - ${job.title || 'Job'}`); window.location.href = `mailto:${customer.email || ''}?subject=${subject}&body=${invoiceMessage}` }
  const sendWhatsApp = () => window.open(`https://wa.me/?text=${invoiceMessage}`, '_blank')

  if (!loggedIn) return (
    <main className="loginPage"><form className="loginCard" onSubmit={handleLogin}>
      <img src="/logo-phoenix.bmp" className="logo" alt="Phoenix MGM Ltd" /><h1>Phoenix MGM Ltd</h1><p>Job proof and invoice system</p>
      <input type="email" placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
      <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
      <button>Login</button><small>Demo login: enter any email and password. Production needs Supabase/Firebase/Auth0.</small>
    </form></main>
  )

  return <main className="app">
    <header className="topbar"><div className="brand"><img src="/logo-phoenix.bmp" alt="Phoenix MGM Ltd" /><div><h1>Phoenix MGM App</h1><p>{COMPANY.address}</p></div></div><div className={`status ${invoiceStatus.toLowerCase().replace(' ', '-')}`}>{invoiceStatus}</div></header>
    <section className="grid"><div className="card"><h2>Customer</h2><input disabled={isLocked} placeholder="Customer name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /><input disabled={isLocked} placeholder="Customer email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /><input disabled={isLocked} placeholder="Customer phone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /><input disabled={isLocked} placeholder="Job address" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /></div>
    <div className="card"><h2>Job</h2><input disabled={isLocked} placeholder="Job title" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} /><textarea disabled={isLocked} placeholder="Job description" value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} /><div className="twoCols"><input disabled={isLocked} type="number" min="1" placeholder="Workers" value={job.workers} onChange={(e) => setJob({ ...job, workers: e.target.value })} /><input disabled={isLocked} type="number" min="0" step="0.25" placeholder="Site hours" value={job.hours} onChange={(e) => setJob({ ...job, hours: e.target.value })} /></div></div></section>
    <section className="card legal"><h2>Legal Protection</h2><p><strong>Job status:</strong> {jobStatus}</p><label className="checkbox"><input disabled={isLocked} type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />Customer accepts Terms & Conditions, GPS location record, labour time, materials, expenses and final charges.</label><p className="small">Location data is recorded at job start/end as supporting evidence of attendance and work carried out on site.</p><button disabled={isLocked} onClick={confirmFinalSignature}>Final Customer Confirmation / Lock Job</button>{isLocked && <p className="locked">This job is locked after customer confirmation.</p>}</section>
    <section className="card"><h2>Geolocation Proof</h2><button disabled={isLocked} onClick={getLocation}>Get Location</button>{location && <div className="mapBox"><p>Lat: {location.lat} | Lng: {location.lng}</p><p>Accuracy: {Math.round(location.accuracy || 0)}m | Captured: {location.capturedAt}</p><a href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noreferrer">Open in Google Maps</a><iframe title="Google Maps location" width="100%" height="260" loading="lazy" allowFullScreen src={`https://www.google.com/maps?q=${location.lat},${location.lng}&output=embed`} /></div>}</section>
    <section className="card"><h2>Expenses</h2>{expenses.map((item) => <div className="expenseRow" key={item.id}><select disabled={isLocked} value={item.category} onChange={(e) => updateExpense(item.id, 'category', e.target.value)}><option>Parking</option><option>Congestion Charge</option><option>ULEZ</option><option>Materials</option><option>Tool rental</option><option>Subcontractor</option><option>Other</option></select><input disabled={isLocked} placeholder="Description" value={item.description} onChange={(e) => updateExpense(item.id, 'description', e.target.value)} /><input disabled={isLocked} type="number" placeholder="Amount" value={item.amount} onChange={(e) => updateExpense(item.id, 'amount', e.target.value)} /><button disabled={isLocked} onClick={() => deleteExpense(item.id)}>Delete</button></div>)}<button disabled={isLocked} onClick={addExpense}>Add expense</button></section>
    <section className="grid"><div className="card"><h2>Payments</h2><input disabled={isLocked} type="number" placeholder="Deposit" value={deposit} onChange={(e) => setDeposit(e.target.value)} />{payments.map((p) => <div className="expenseRow" key={p.id}><input disabled={isLocked} type="date" value={p.date} onChange={(e) => updatePayment(p.id, 'date', e.target.value)} /><select disabled={isLocked} value={p.method} onChange={(e) => updatePayment(p.id, 'method', e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Card</option></select><input disabled={isLocked} type="number" placeholder="Amount" value={p.amount} onChange={(e) => updatePayment(p.id, 'amount', e.target.value)} /><button disabled={isLocked} onClick={() => deletePayment(p.id)}>Delete</button></div>)}<button disabled={isLocked} onClick={addPayment}>Add payment</button></div><div className="card"><h2>Reminder</h2><input disabled={isLocked} type="date" value={reminder.date} onChange={(e) => setReminder({ ...reminder, date: e.target.value })} /><input disabled={isLocked} placeholder="Reminder note" value={reminder.note} onChange={(e) => setReminder({ ...reminder, note: e.target.value })} /></div></section>
    <section className="card invoice"><h2>Invoice Preview</h2><div className="summaryGrid"><div><span>Call-out</span><strong>{money(COMPANY.callOut)}</strong></div><div><span>Labour</span><strong>{money(labour)}</strong><small>{job.hours || 0}h x {job.workers || 1} worker(s) x {money(COMPANY.hourlyRate)}</small></div><div><span>Expenses</span><strong>{money(expensesTotal)}</strong></div><div><span>VAT 20%</span><strong>{money(vat)}</strong></div><div><span>Total</span><strong>{money(total)}</strong></div><div><span>Paid</span><strong>{money(paidTotal)}</strong></div><div className="balance"><span>Balance</span><strong>{money(balance)}</strong></div></div><div className="actions"><button onClick={generatePDF}>Download PDF</button><button onClick={sendEmail}>Email invoice</button><button onClick={sendWhatsApp}>Send WhatsApp</button></div></section>
    <section className="card terms"><h2>Terms & Conditions</h2><ul><li>Payment due within 7 days from invoice date.</li><li>Deposits are non-refundable once work has commenced.</li><li>This invoice covers only agreed work. Additional work will be charged separately.</li><li>Materials, parking, congestion charges, ULEZ and other expenses are charged separately unless agreed in writing.</li><li>Late payments may incur statutory interest under UK law.</li><li>Customer confirmation accepts attendance, recorded labour time, materials, expenses and final charges.</li><li>Phoenix MGM Ltd is not liable for pre-existing conditions, hidden defects or unforeseen structural issues.</li><li>30-day workmanship guarantee applies to labour only unless otherwise stated.</li></ul></section>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
