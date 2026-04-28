import React, { useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';

const logo = '/logo-phoenix.bmp';
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [company, setCompany] = useState({
    name: 'Phoenix MGM Ltd',
    address: '202 Battersea Park Road, SW11 4ND, London',
    email: 'phoenix.mgm@protonmail.com',
    phone: '07835208209',
    vatNumber: 'GB 307833893',
    hourlyRate: 27,
    callOutFee: 135,
    vatRate: 20,
    vatRegistered: true,
  });

  const [client, setClient] = useState({ name: '', address: '', email: '', phone: '' });
  const [job, setJob] = useState({
    title: '',
    description: '',
    workers: 1,
    startTime: null,
    stopTime: null,
    startLocation: null,
    stopLocation: null,
    status: 'draft',
    customerStartSignature: '',
    customerEndSignature: '',
    customerName: '',
    termsAccepted: false,
    locked: false,
  });

  const [expenses, setExpenses] = useState([{ id: uid(), category: 'Parking', description: '', amount: 0 }]);
  const [photos, setPhotos] = useState([]);
  const [payment, setPayment] = useState({ deposit: 0, payments: [], method: 'bank', reminderDate: '', reminderNote: '' });
  const [signatureMode, setSignatureMode] = useState(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  const isLocked = job.locked;
  const inputDisabled = isLocked;

  const dt = (v) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const money = (n) => `£${Number(n || 0).toFixed(2)}`;
  const locText = (l) => l ? `${l.lat.toFixed(6)}, ${l.lng.toFixed(6)} · accuracy ${Math.round(l.accuracy)}m` : 'Location not captured';
  const mapsUrl = (l) => l ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : '';

  const getLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, capturedAt: new Date().toISOString() }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  const startJob = async () => {
    if (!job.termsAccepted) return alert('Customer must accept Terms & Conditions before starting the job.');
    const loc = await getLocation();
    setJob((j) => ({ ...j, startTime: new Date().toISOString(), startLocation: loc, status: 'started' }));
  };

  const stopJob = async () => {
    const loc = await getLocation();
    setJob((j) => ({ ...j, stopTime: new Date().toISOString(), stopLocation: loc, status: 'completed' }));
  };

  const siteHours = useMemo(() => {
    if (!job.startTime || !job.stopTime) return 0;
    return Math.max(0, Math.round(((new Date(job.stopTime) - new Date(job.startTime)) / 36e5) * 100) / 100);
  }, [job.startTime, job.stopTime]);

  const billableHours = useMemo(() => siteHours * Number(job.workers || 1), [siteHours, job.workers]);
  const labour = billableHours * Number(company.hourlyRate || 0);
  const callOut = Number(company.callOutFee || 0);
  const expTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const subtotal = callOut + labour + expTotal;
  const vat = company.vatRegistered ? subtotal * (Number(company.vatRate || 0) / 100) : 0;
  const total = subtotal + vat;
  const deposit = Number(payment.deposit || 0);
  const paymentsTotal = payment.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = deposit + paymentsTotal;
  const balance = Math.max(0, total - totalPaid);
  const invoiceStatus = balance <= 0 ? 'Paid' : totalPaid > 0 ? 'Partially Paid' : 'Unpaid';

  const addExpense = () => setExpenses((x) => [...x, { id: uid(), category: 'Materials', description: '', amount: 0 }]);
  const updateExpense = (id, k, v) => setExpenses((xs) => xs.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const removeExpense = (id) => setExpenses((xs) => xs.filter((x) => x.id !== id));

  const addPayment = () => setPayment((p) => ({ ...p, payments: [...p.payments, { id: uid(), date: new Date().toISOString().slice(0, 10), method: p.method, amount: 0, note: '' }] }));
  const updatePayment = (id, k, v) => setPayment((p) => ({ ...p, payments: p.payments.map((x) => (x.id === id ? { ...x, [k]: v } : x)) }));
  const removePayment = (id) => setPayment((p) => ({ ...p, payments: p.payments.filter((x) => x.id !== id) }));

  const addPhotos = (e) => {
    const type = e.currentTarget.dataset.type || 'during';
    const files = Array.from(e.target.files || []);
    setPhotos((p) => [...p, ...files.map((f) => ({ id: uid(), type, name: f.name, url: URL.createObjectURL(f), capturedAt: new Date().toISOString() }))]);
  };
  const uploadPhoto = (type) => { fileRef.current.dataset.type = type; fileRef.current.click(); };

  const draw = (e) => {
    const c = canvasRef.current;
    if (!c || e.buttons !== 1) return;
    const r = c.getBoundingClientRect();
    const ctx = c.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const resetPath = () => canvasRef.current?.getContext('2d').beginPath();
  const clearSig = () => {
    const c = canvasRef.current;
    c?.getContext('2d').clearRect(0, 0, c.width, c.height);
  };
  const saveSig = () => {
    const data = canvasRef.current.toDataURL('image/png');
    setJob((j) => ({ ...j, [signatureMode === 'start' ? 'customerStartSignature' : 'customerEndSignature']: data, status: signatureMode === 'start' ? 'signed_start' : j.status }));
    setSignatureMode(null);
  };

  const finalConfirm = () => {
    if (!job.termsAccepted) return alert('Customer must accept Terms & Conditions first.');
    if (!job.customerName.trim()) return alert('Enter customer name before final confirmation.');
    if (!job.customerEndSignature) return alert('Completion signature is required before locking the job.');
    setJob((j) => ({ ...j, status: 'signed_end_locked', locked: true }));
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    let y = 18;
    doc.setFontSize(17); doc.text('Phoenix MGM Ltd - Invoice', 18, y); y += 8;
    doc.setFontSize(10);
    doc.text(company.address, 18, y); y += 5;
    doc.text(`${company.email} · ${company.phone} · VAT ${company.vatNumber}`, 18, y); y += 9;
    doc.text(`Invoice No: INV-${new Date().getFullYear()}-001`, 18, y); y += 5;
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 18, y); y += 8;
    doc.text(`Client: ${client.name || job.customerName || '-'}`, 18, y); y += 5;
    doc.text(`Job address: ${client.address || '-'}`, 18, y); y += 5;
    doc.text(`Job: ${job.title || '-'}`, 18, y); y += 8;
    doc.text(`Call-out: ${money(callOut)}`, 18, y); y += 5;
    doc.text(`Labour: ${siteHours} site hours × ${job.workers || 1} worker(s) = ${billableHours} billable hours × ${money(company.hourlyRate)} = ${money(labour)}`, 18, y); y += 5;
    doc.text(`Expenses: ${money(expTotal)}`, 18, y); y += 5;
    doc.text(`Subtotal: ${money(subtotal)}`, 18, y); y += 5;
    doc.text(`VAT: ${money(vat)}`, 18, y); y += 5;
    doc.text(`Total: ${money(total)}`, 18, y); y += 5;
    doc.text(`Deposit/payments: ${money(totalPaid)}`, 18, y); y += 5;
    doc.text(`Balance due: ${money(balance)} · Status: ${invoiceStatus}`, 18, y); y += 9;
    doc.text('Location Proof', 18, y); y += 5;
    doc.text(`Start GPS: ${locText(job.startLocation)}`, 18, y); y += 5;
    if (job.startLocation) { doc.text(`Start map: ${mapsUrl(job.startLocation)}`, 18, y); y += 5; }
    doc.text(`Stop GPS: ${locText(job.stopLocation)}`, 18, y); y += 5;
    if (job.stopLocation) { doc.text(`Stop map: ${mapsUrl(job.stopLocation)}`, 18, y); y += 8; }
    doc.text('Legal Confirmation', 18, y); y += 5;
    doc.text(`Customer: ${job.customerName || '-'}`, 18, y); y += 5;
    doc.text(`Terms accepted: ${job.termsAccepted ? 'Yes' : 'No'} · Job status: ${job.status}`, 18, y); y += 5;
    doc.text('Customer confirms work carried out as agreed, recorded labour time, materials, expenses, location record and final charges.', 18, y, { maxWidth: 175 }); y += 12;
    doc.text('Location data is recorded as supporting evidence of attendance and work carried out on site. After final confirmation this job record is treated as locked.', 18, y, { maxWidth: 175 }); y += 12;
    doc.text('Terms: Payment due within 7 days. Deposits are non-refundable once work has commenced. Additional work/materials/parking/congestion/ULEZ are charged separately. Late payments may incur statutory interest under UK law. 30-day workmanship guarantee on labour only unless stated.', 18, y, { maxWidth: 175 });
    doc.save(`phoenix-mgm-invoice-${Date.now()}.pdf`);
  };

  const invoiceMessage = encodeURIComponent(`Hello ${client.name || ''},\n\nPhoenix MGM Ltd invoice summary:\nJob: ${job.title || 'Job'}\nTotal: ${money(total)}\nPaid: ${money(totalPaid)}\nBalance due: ${money(balance)}\nStatus: ${invoiceStatus}\n\nPayment due within 7 days.\n\nKind regards,\nPhoenix MGM Ltd`);
  const sendEmail = () => window.location.href = `mailto:${client.email || ''}?subject=${encodeURIComponent('Phoenix MGM Ltd Invoice')}&body=${invoiceMessage}`;
  const sendWhatsApp = () => window.open(`https://wa.me/?text=${invoiceMessage}`, '_blank');

  if (!isLoggedIn) return (
    <div className="loginPage">
      <form className="loginCard" onSubmit={(e) => { e.preventDefault(); if (login.email && login.password) setIsLoggedIn(true); }}>
        <img src={logo} className="loginLogo" alt="Phoenix MGM Ltd" />
        <h1>Phoenix MGM Ltd</h1>
        <p className="small">Job invoice system. Demo login: enter any email and password.</p>
        <input type="email" placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
        <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
        <button>Login</button>
      </form>
    </div>
  );

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand"><img src={logo} alt="Phoenix MGM Ltd" /><div><h1>Daily Job Invoice App</h1><p className="small">Timer, GPS map, photos, expenses, signatures, payments and legal PDF.</p></div></div>
        <div className={`status ${invoiceStatus.toLowerCase().replace(' ', '-')}`}>{invoiceStatus}</div>
      </header>

      <section className="grid">
        <div className="card">
          <h2>Company</h2>
          <input disabled={inputDisabled} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          <input disabled={inputDisabled} value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
          <div className="twoCols"><input disabled={inputDisabled} value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} /><input disabled={inputDisabled} value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></div>
          <div className="twoCols"><input disabled={inputDisabled} type="number" value={company.hourlyRate} onChange={(e) => setCompany({ ...company, hourlyRate: e.target.value })} placeholder="Hourly rate" /><input disabled={inputDisabled} type="number" value={company.callOutFee} onChange={(e) => setCompany({ ...company, callOutFee: e.target.value })} placeholder="Call-out fee" /></div>
          <input disabled={inputDisabled} value={company.vatNumber} onChange={(e) => setCompany({ ...company, vatNumber: e.target.value })} />
        </div>

        <div className="card">
          <h2>Client & Job</h2>
          <input disabled={inputDisabled} placeholder="Customer name for legal confirmation" value={job.customerName} onChange={(e) => setJob({ ...job, customerName: e.target.value })} />
          <input disabled={inputDisabled} placeholder="Client name / company" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
          <input disabled={inputDisabled} placeholder="Job address" value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} />
          <div className="twoCols"><input disabled={inputDisabled} placeholder="Client email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /><input disabled={inputDisabled} placeholder="Client phone" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /></div>
          <input disabled={inputDisabled} placeholder="Job title" value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} />
          <textarea disabled={inputDisabled} placeholder="Job description" value={job.description} onChange={(e) => setJob({ ...job, description: e.target.value })} />
        </div>
      </section>

      <section className="card terms">
        <h2>Legal Protection</h2>
        <p className="small">Job status: <strong>{job.status}</strong>{isLocked && <span className="locked"> · Locked after customer confirmation</span>}</p>
        <label className="checkbox"><input disabled={inputDisabled} type="checkbox" checked={job.termsAccepted} onChange={(e) => setJob({ ...job, termsAccepted: e.target.checked })} /> <span>Customer accepts Terms & Conditions, GPS location record, labour time, materials, expenses, payment terms and final charges.</span></label>
        <ul>
          <li>Payment due within 7 days from invoice date.</li>
          <li>Deposits are non-refundable once work has commenced.</li>
          <li>Additional work, materials, parking, congestion charge and ULEZ are charged separately.</li>
          <li>Late payments may incur statutory interest under UK law.</li>
          <li>Location data is recorded as supporting evidence of attendance and work carried out on site.</li>
          <li>30-day workmanship guarantee on labour only unless stated.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Time, Workers & Location</h2>
        <div className="twoCols"><input disabled={inputDisabled} type="number" min="1" value={job.workers} onChange={(e) => setJob({ ...job, workers: e.target.value })} placeholder="Number of workers" /><input disabled value={`${siteHours} site h × ${job.workers || 1} = ${billableHours} billable h`} /></div>
        <div className="actions"><button disabled={inputDisabled} onClick={startJob}>Start Job + GPS</button><button disabled={inputDisabled} className="secondary" onClick={stopJob}>Stop Job + GPS</button><button disabled={inputDisabled} className="secondary" onClick={finalConfirm}>Final Customer Confirmation / Lock Job</button></div>
        <div className="grid mapGrid">
          <LocationBox title="Start location" loc={job.startLocation} dt={dt} locText={locText} mapsUrl={mapsUrl} time={job.startTime} />
          <LocationBox title="Stop location" loc={job.stopLocation} dt={dt} locText={locText} mapsUrl={mapsUrl} time={job.stopTime} />
        </div>
      </section>

      <section className="card">
        <h2>Job Photos</h2>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={addPhotos} />
        <div className="actions"><button disabled={inputDisabled} className="secondary" onClick={() => uploadPhoto('before')}>Before</button><button disabled={inputDisabled} className="secondary" onClick={() => uploadPhoto('during')}>During</button><button disabled={inputDisabled} className="secondary" onClick={() => uploadPhoto('after')}>After</button></div>
        <div className="photoGrid">{photos.map((p) => <div key={p.id} className="photoCard"><img src={p.url} /><strong>{p.type}</strong><span>{dt(p.capturedAt)}</span></div>)}</div>
      </section>

      <section className="card">
        <div className="sectionHead"><h2>Expenses</h2><button disabled={inputDisabled} className="secondary" onClick={addExpense}>Add expense</button></div>
        {expenses.map((e) => <div className="expenseRow" key={e.id}><select disabled={inputDisabled} value={e.category} onChange={(ev) => updateExpense(e.id, 'category', ev.target.value)}><option>Parking</option><option>Congestion Charge</option><option>ULEZ</option><option>Materials</option><option>Tool rental</option><option>Subcontractor</option><option>Other</option></select><input disabled={inputDisabled} placeholder="Description" value={e.description} onChange={(ev) => updateExpense(e.id, 'description', ev.target.value)} /><input disabled={inputDisabled} type="number" value={e.amount} onChange={(ev) => updateExpense(e.id, 'amount', ev.target.value)} /><button disabled={inputDisabled} className="ghost" onClick={() => removeExpense(e.id)}>Remove</button></div>)}
      </section>

      <section className="card">
        <h2>Payments</h2>
        <div className="twoCols"><input disabled={inputDisabled} type="number" value={payment.deposit} onChange={(e) => setPayment({ ...payment, deposit: e.target.value })} placeholder="Deposit £" /><select disabled={inputDisabled} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}><option value="bank">Bank Transfer</option><option value="cash">Cash</option><option value="card">Card</option></select></div>
        <div className="actions"><button disabled={inputDisabled} className="secondary" onClick={addPayment}>Add payment</button></div>
        {payment.payments.map((p) => <div className="paymentRow" key={p.id}><input disabled={inputDisabled} type="date" value={p.date} onChange={(e) => updatePayment(p.id, 'date', e.target.value)} /><select disabled={inputDisabled} value={p.method} onChange={(e) => updatePayment(p.id, 'method', e.target.value)}><option value="bank">Bank Transfer</option><option value="cash">Cash</option><option value="card">Card</option></select><input disabled={inputDisabled} type="number" value={p.amount} onChange={(e) => updatePayment(p.id, 'amount', e.target.value)} placeholder="Amount" /><input disabled={inputDisabled} value={p.note} onChange={(e) => updatePayment(p.id, 'note', e.target.value)} placeholder="Note" /><button disabled={inputDisabled} className="ghost" onClick={() => removePayment(p.id)}>Remove</button></div>)}
        <div className="twoCols"><input disabled={inputDisabled} type="date" value={payment.reminderDate} onChange={(e) => setPayment({ ...payment, reminderDate: e.target.value })} /><input disabled={inputDisabled} value={payment.reminderNote} onChange={(e) => setPayment({ ...payment, reminderNote: e.target.value })} placeholder="Reminder note" /></div>
      </section>

      <section className="card">
        <h2>Customer Signatures</h2>
        <div className="twoCols">
          <div className="smallBox"><strong>Start signature</strong><p className="small">Customer authorises job start and attendance record.</p>{job.customerStartSignature && <img src={job.customerStartSignature} className="signatureImg" />}<button disabled={inputDisabled} className="secondary" onClick={() => setSignatureMode('start')}>Sign start</button></div>
          <div className="smallBox"><strong>Completion signature</strong><p className="small">Customer confirms work/time/charges.</p>{job.customerEndSignature && <img src={job.customerEndSignature} className="signatureImg" />}<button disabled={inputDisabled} className="secondary" onClick={() => setSignatureMode('end')}>Sign completion</button></div>
        </div>
      </section>

      <section className="card">
        <h2>Invoice Summary</h2>
        <div className="summaryGrid"><Summary label="Call-out" value={money(callOut)} /><Summary label="Labour" value={money(labour)} detail={`${siteHours}h × ${job.workers || 1} worker(s)`} /><Summary label="Expenses" value={money(expTotal)} /><Summary label="Balance" value={money(balance)} dark /></div>
        <p className="small">Subtotal {money(subtotal)} · VAT {money(vat)} · Total {money(total)} · Paid {money(totalPaid)} · Status {invoiceStatus}</p>
        <div className="actions"><button onClick={generatePDF}>Download Legal PDF</button><button className="secondary" onClick={sendEmail}>Email invoice</button><button className="secondary" onClick={sendWhatsApp}>Send WhatsApp</button></div>
      </section>

      <section className="card invoice">
        <InvoicePreview company={company} client={client} job={job} expenses={expenses} callOut={callOut} labour={labour} siteHours={siteHours} billableHours={billableHours} subtotal={subtotal} vat={vat} total={total} totalPaid={totalPaid} balance={balance} invoiceStatus={invoiceStatus} money={money} dt={dt} locText={locText} mapsUrl={mapsUrl} />
      </section>

      {signatureMode && <SignatureModal mode={signatureMode} canvasRef={canvasRef} draw={draw} resetPath={resetPath} clearSig={clearSig} saveSig={saveSig} close={() => setSignatureMode(null)} />}
    </main>
  );
}

function Summary({ label, value, detail, dark }) {
  return <div className={dark ? 'balance' : ''}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function LocationBox({ title, loc, time, dt, locText, mapsUrl }) {
  return <div className="mapBox"><strong>{title}</strong><p className="small">Time: {dt(time)}</p><p className="small">{locText(loc)}</p>{loc && <><iframe width="100%" height="220" loading="lazy" allowFullScreen src={`https://www.google.com/maps?q=${loc.lat},${loc.lng}&output=embed`} /><a href={mapsUrl(loc)} target="_blank" rel="noreferrer">Open in Google Maps</a></>}</div>;
}

function SignatureModal({ mode, canvasRef, draw, resetPath, clearSig, saveSig, close }) {
  const touchDraw = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    draw(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, buttons: 1 }));
  };
  return <div className="modal"><div className="modalBox"><h2>Customer signature - {mode}</h2><canvas ref={canvasRef} width="500" height="220" className="sigCanvas" onMouseMove={draw} onMouseUp={resetPath} onMouseLeave={resetPath} onTouchMove={touchDraw} onTouchEnd={resetPath} /><div className="actions end"><button className="ghost" onClick={clearSig}>Clear</button><button className="secondary" onClick={close}>Cancel</button><button onClick={saveSig}>Save signature</button></div></div></div>;
}

function InvoicePreview({ company, client, job, expenses, callOut, labour, siteHours, billableHours, subtotal, vat, total, totalPaid, balance, invoiceStatus, money, dt, locText, mapsUrl }) {
  return <div>
    <div className="invoiceHead"><div className="brand"><img src={logo} alt="Phoenix MGM Ltd" /><div><h2>Phoenix MGM Ltd</h2><p className="small">{company.address}</p><p className="small">{company.email} · {company.phone}</p><p className="small">VAT No: {company.vatNumber}</p></div></div><div><div className="invoiceTitle">INVOICE</div><p className="small">Invoice No: INV-{new Date().getFullYear()}-001</p><p className="small">Date: {new Date().toLocaleDateString('en-GB')}</p></div></div>
    <div className="invoiceSplit"><div><strong>Bill to</strong><p>{client.name || job.customerName || 'Client name'}</p><p className="small">{client.address || 'Client / job address'}</p></div><div><strong>Job details</strong><p>{job.title || 'Job title'}</p><p className="small">{job.description || 'Job description'}</p><p className="small">Start: {dt(job.startTime)}</p><p className="small">Stop: {dt(job.stopTime)}</p></div></div>
    <table><thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead><tbody><tr><td>Call-out fee</td><td className="right">1</td><td className="right">{money(callOut)}</td><td className="right">{money(callOut)}</td></tr><tr><td>Labour ({siteHours} site hours × {job.workers || 1} worker(s))</td><td className="right">{billableHours} h</td><td className="right">{money(company.hourlyRate)}</td><td className="right">{money(labour)}</td></tr>{expenses.map((e) => <tr key={e.id}><td>{e.category}{e.description ? ` - ${e.description}` : ''}</td><td className="right">1</td><td className="right">{money(e.amount)}</td><td className="right">{money(e.amount)}</td></tr>)}</tbody></table>
    <div className="totals"><div className="totalLine"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="totalLine"><span>VAT</span><b>{money(vat)}</b></div><div className="totalLine"><span>Total</span><b>{money(total)}</b></div><div className="totalLine"><span>Paid</span><b>{money(totalPaid)}</b></div><div className="totalLine big"><span>Balance</span><b>{money(balance)}</b></div><div className={`status ${invoiceStatus.toLowerCase().replace(' ', '-')}`}>{invoiceStatus}</div></div>
    <div className="invoiceSplit"><div className="smallBox"><strong>Proof of attendance</strong><p className="small">Start GPS: {locText(job.startLocation)}</p>{job.startLocation && <a href={mapsUrl(job.startLocation)} target="_blank" rel="noreferrer">Start map</a>}<p className="small">Stop GPS: {locText(job.stopLocation)}</p>{job.stopLocation && <a href={mapsUrl(job.stopLocation)} target="_blank" rel="noreferrer">Stop map</a>}</div><div className="smallBox"><strong>Customer confirmation</strong><p className="small">Customer confirms attendance, work/progress/completion, recorded labour time, materials, expenses, location record and charges.</p></div></div>
    <div className="invoiceSplit"><div><strong>Start signature</strong>{job.customerStartSignature ? <img src={job.customerStartSignature} className="signatureImg" /> : <div className="signatureEmpty" />}</div><div><strong>Completion signature</strong>{job.customerEndSignature ? <img src={job.customerEndSignature} className="signatureImg" /> : <div className="signatureEmpty" />}</div></div>
    <div className="termsBox"><strong>Terms & Conditions</strong><p>Payment due within 7 days. Deposits are non-refundable once work has commenced. Additional work, materials, parking, congestion charge and ULEZ are charged separately. Late payments may incur statutory interest under UK law. Location data is recorded as evidence of attendance and work carried out on site. 30-day workmanship guarantee on labour only unless stated.</p></div>
  </div>;
}
