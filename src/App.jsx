import React, { useMemo, useRef, useState } from 'react';
import { Camera, Clock, FileText, MapPin, PenLine, Plus, Square, Play, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import { supabase, supabaseConfigured } from './supabaseClient';

const logo = '/logo-phoenix.bmp';

export default function App(){
  const [isLoggedIn,setIsLoggedIn]=useState(false);
  const [login,setLogin]=useState({email:'',password:''});
  const [company,setCompany]=useState({name:'Phoenix MGM Ltd',address:'202 Battersea Park Road, SW11 4ND, London',email:'phoenix.mgm@protonmail.com',phone:'07835208209',vatNumber:'GB 307833893',hourlyRate:27,callOutFee:135,vatRate:20,vatRegistered:true});
  const [client,setClient]=useState({name:'',address:'',email:'',phone:''});
  const [job,setJob]=useState({title:'',description:'',workers:1,startTime:null,stopTime:null,startLocation:null,stopLocation:null,status:'draft',termsAccepted:false,finalLocked:false,customerStartSignature:'',customerEndSignature:''});
  const [expenses,setExpenses]=useState([{id:crypto.randomUUID(),category:'Parking',description:'',amount:0}]);
  const [payment,setPayment]=useState({deposit:0,payments:[]});
  const [photos,setPhotos]=useState([]);
  const [signatureMode,setSignatureMode]=useState(null);
  const [invoice,setInvoice]=useState({number:null,saved:false,error:null,loading:false});
  const canvasRef=useRef(null); const fileRef=useRef(null);
  const locked = job.finalLocked || invoice.saved;

  const dt=v=>v?new Date(v).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'—';
  const locText=l=>l?`${Number(l.lat).toFixed(6)}, ${Number(l.lng).toFixed(6)} · accuracy ${Math.round(l.accuracy||0)}m`:'Location not captured';
  const mapsUrl=l=>l?`https://www.google.com/maps?q=${l.lat},${l.lng}`:'';
  const getLocation=()=>new Promise(resolve=>{ if(!navigator.geolocation) return resolve(null); navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,capturedAt:new Date().toISOString()}),()=>resolve(null),{enableHighAccuracy:true,timeout:10000}); });

  const startJob=async()=>{ if(!job.termsAccepted){ alert('Customer must accept Terms & Conditions before starting.'); return; } const loc=await getLocation(); setJob(j=>({...j,startTime:new Date().toISOString(),startLocation:loc,status:'started'})); };
  const stopJob=async()=>{ const loc=await getLocation(); setJob(j=>({...j,stopTime:new Date().toISOString(),stopLocation:loc,status:'completed'})); };
  const finalConfirm=()=>{ if(!job.termsAccepted){ alert('Terms must be accepted first.'); return; } if(!client.name.trim()){ alert('Enter customer name first.'); return; } setJob(j=>({...j,finalLocked:true,status:'signed_end'})); };

  const siteHours=useMemo(()=>job.startTime&&job.stopTime?Math.max(0,Math.round(((new Date(job.stopTime)-new Date(job.startTime))/36e5)*100)/100):0,[job.startTime,job.stopTime]);
  const workers=Number(job.workers||1);
  const billableHours=siteHours*workers;
  const labour=billableHours*Number(company.hourlyRate||0);
  const callOut=Number(company.callOutFee||0);
  const expTotal=expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const subtotal=callOut+labour+expTotal;
  const vat=company.vatRegistered?subtotal*(Number(company.vatRate||0)/100):0;
  const total=subtotal+vat;
  const deposit=Number(payment.deposit||0);
  const paymentsTotal=payment.payments.reduce((s,p)=>s+Number(p.amount||0),0);
  const totalPaid=deposit+paymentsTotal;
  const balance=Math.max(0,total-totalPaid);
  const paymentStatus=balance<=0?'Paid':totalPaid>0?'Partially Paid':'Unpaid';

  const updateExpense=(id,k,v)=>setExpenses(xs=>xs.map(x=>x.id===id?{...x,[k]:v}:x));
  const addPayment=()=>setPayment(p=>({...p,payments:[...p.payments,{id:crypto.randomUUID(),date:new Date().toISOString().slice(0,10),method:'bank',amount:0,note:''}]}));
  const updatePayment=(id,k,v)=>setPayment(p=>({...p,payments:p.payments.map(x=>x.id===id?{...x,[k]:v}:x)}));
  const addPhotos=e=>{ const type=e.currentTarget.dataset.type||'during'; const files=Array.from(e.target.files||[]); setPhotos(p=>[...p,...files.map(f=>({id:crypto.randomUUID(),type,name:f.name,url:URL.createObjectURL(f),capturedAt:new Date().toISOString()}))]); };
  const uploadPhoto=type=>{fileRef.current.dataset.type=type;fileRef.current.click();};

  const draw=e=>{const c=canvasRef.current;if(!c||e.buttons!==1)return;const r=c.getBoundingClientRect(),ctx=c.getContext('2d');ctx.lineWidth=2;ctx.lineCap='round';ctx.lineTo(e.clientX-r.left,e.clientY-r.top);ctx.stroke();ctx.beginPath();ctx.moveTo(e.clientX-r.left,e.clientY-r.top);};
  const touchDraw=e=>{e.preventDefault();const t=e.touches[0];draw({clientX:t.clientX,clientY:t.clientY,buttons:1});};
  const reset=()=>canvasRef.current?.getContext('2d').beginPath();
  const clearSig=()=>{const c=canvasRef.current;c?.getContext('2d').clearRect(0,0,c.width,c.height)};
  const saveSig=()=>{const data=canvasRef.current.toDataURL('image/png');setJob(j=>({...j,[signatureMode==='start'?'customerStartSignature':'customerEndSignature']:data}));setSignatureMode(null);};

  const buildPayload=()=>({
    company_name:company.name, company_address:company.address, company_email:company.email, company_phone:company.phone, vat_number:company.vatNumber,
    client_name:client.name, client_address:client.address, client_email:client.email, client_phone:client.phone,
    job_title:job.title, job_description:job.description, job_status:job.status,
    start_time:job.startTime||'', stop_time:job.stopTime||'', start_location:job.startLocation, stop_location:job.stopLocation,
    site_hours:siteHours, workers, billable_hours:billableHours, hourly_rate:Number(company.hourlyRate||0), callout_fee:callOut,
    expenses, subtotal, vat, total, deposit, payments:payment.payments, total_paid:totalPaid, balance, payment_status:paymentStatus,
    terms_accepted:job.termsAccepted, final_locked:job.finalLocked
  });

  const createInvoice=async()=>{
    if(!supabaseConfigured){ setInvoice(i=>({...i,error:'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.'})); return; }
    if(!job.termsAccepted){ alert('Terms must be accepted before creating invoice.'); return; }
    setInvoice({number:null,saved:false,error:null,loading:true});
    const { data, error } = await supabase.rpc('create_invoice', { payload: buildPayload() });
    if(error){ setInvoice({number:null,saved:false,error:error.message,loading:false}); return; }
    setInvoice({number:data.invoice_number,saved:true,error:null,loading:false});
    setJob(j=>({...j,finalLocked:true,status:'issued'}));
  };

  const generatePDF=()=>{
    const doc = new jsPDF();
    const invoiceNo = invoice.number || 'DRAFT';
    doc.setFontSize(18); doc.text(`${company.name} - Invoice ${invoiceNo}`,20,20);
    doc.setFontSize(10);
    doc.text(company.address,20,28); doc.text(`${company.email} · ${company.phone}`,20,34); doc.text(`VAT No: ${company.vatNumber}`,20,40);
    doc.text(`Bill To: ${client.name || '-'}`,20,54); doc.text(`Job Address: ${client.address || '-'}`,20,60); doc.text(`Job: ${job.title || '-'}`,20,66);
    doc.text(`Site hours: ${siteHours} · Workers: ${workers} · Billable hours: ${billableHours}`,20,78);
    doc.text(`Call-out: £${callOut.toFixed(2)}`,20,88); doc.text(`Labour: £${labour.toFixed(2)}`,20,94); doc.text(`Expenses: £${expTotal.toFixed(2)}`,20,100); doc.text(`VAT: £${vat.toFixed(2)}`,20,106); doc.text(`Total: £${total.toFixed(2)}`,20,112); doc.text(`Paid: £${totalPaid.toFixed(2)}`,20,118); doc.text(`Balance: £${balance.toFixed(2)} (${paymentStatus})`,20,124);
    doc.text('Location Proof',20,138); doc.text(`Start GPS: ${locText(job.startLocation)}`,20,146); doc.text(`Stop GPS: ${locText(job.stopLocation)}`,20,154);
    if(job.startLocation) doc.text(`Start Map: ${mapsUrl(job.startLocation)}`,20,162);
    if(job.stopLocation) doc.text(`Stop Map: ${mapsUrl(job.stopLocation)}`,20,170);
    doc.text('Legal Confirmation',20,186); doc.text('Customer accepts Terms & Conditions, recorded GPS location, labour time, materials, expenses and final charges.',20,194,{maxWidth:170});
    doc.text('Customer confirms work carried out as agreed. After final confirmation / issued invoice, this record is locked.',20,206,{maxWidth:170});
    doc.save(`${invoiceNo}-phoenix-mgm-invoice.pdf`);
  };

  const sendWhatsApp=()=>{ const msg=encodeURIComponent(`Phoenix MGM Ltd Invoice ${invoice.number||'DRAFT'}\nTotal: £${total.toFixed(2)}\nPaid: £${totalPaid.toFixed(2)}\nBalance: £${balance.toFixed(2)}`); window.open(`https://wa.me/?text=${msg}`,'_blank'); };
  const emailInvoice=()=>{ const body=encodeURIComponent(`Hello ${client.name},\n\nPlease find the Phoenix MGM invoice summary.\nInvoice: ${invoice.number||'DRAFT'}\nTotal: £${total.toFixed(2)}\nBalance: £${balance.toFixed(2)}\n\nKind regards,\nPhoenix MGM Ltd`); window.location.href=`mailto:${client.email||''}?subject=${encodeURIComponent(`Phoenix MGM Invoice ${invoice.number||''}`)}&body=${body}`; };

  if(!isLoggedIn) return <div className="login"><motion.form initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="loginBox" onSubmit={e=>{e.preventDefault(); if(login.email&&login.password) setIsLoggedIn(true)}}><div className="companyBlock"><img src={logo} className="logo"/><div><h1 className="title">Phoenix MGM Ltd</h1><p className="muted">Job invoice system</p></div></div><br/><input type="email" placeholder="Email" value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/><br/><br/><input type="password" placeholder="Password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/><br/><br/><button style={{width:'100%'}}>Login</button><p className="muted">Demo login: enter any email and password. Production Auth can be enabled next.</p></motion.form></div>;

  return <div className="app"><div className="wrap">
    <header className="card topbar"><div className="companyBlock"><img src={logo} className="logo"/><div><h1 className="title">Daily Job Invoice App</h1><p className="muted">Timer, GPS, photos, expenses, signatures, PDF and progressive invoices.</p></div></div><div className={`pill ${paymentStatus==='Paid'?'ok':paymentStatus==='Partially Paid'?'warn':'bad'}`}>{invoice.number || 'Draft'} · {paymentStatus}</div></header>
    {!supabaseConfigured && <div className="notice">Supabase not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel to enable progressive invoices.</div>}
    {invoice.error && <div className="error">{invoice.error}</div>}
    {invoice.saved && <div className="success">Invoice saved with progressive number: {invoice.number}</div>}

    <div className="grid grid2"><section className="card"><h2 className="sectionTitle"><FileText size={18}/> Company</h2><input disabled={locked} value={company.name} onChange={e=>setCompany({...company,name:e.target.value})}/><br/><br/><input disabled={locked} value={company.address} onChange={e=>setCompany({...company,address:e.target.value})}/><br/><br/><div className="grid grid2"><input disabled={locked} value={company.email} onChange={e=>setCompany({...company,email:e.target.value})}/><input disabled={locked} value={company.phone} onChange={e=>setCompany({...company,phone:e.target.value})}/></div><br/><div className="grid grid2"><input disabled={locked} type="number" value={company.hourlyRate} onChange={e=>setCompany({...company,hourlyRate:e.target.value})} placeholder="Hourly rate"/><input disabled={locked} type="number" value={company.callOutFee} onChange={e=>setCompany({...company,callOutFee:e.target.value})} placeholder="Call-out fee"/></div><br/><input disabled={locked} value={company.vatNumber} onChange={e=>setCompany({...company,vatNumber:e.target.value})}/></section>
    <section className="card"><h2 className="sectionTitle">Client & Job</h2><input disabled={locked} placeholder="Client name" value={client.name} onChange={e=>setClient({...client,name:e.target.value})}/><br/><br/><input disabled={locked} placeholder="Client address" value={client.address} onChange={e=>setClient({...client,address:e.target.value})}/><br/><br/><div className="grid grid2"><input disabled={locked} placeholder="Client email" value={client.email} onChange={e=>setClient({...client,email:e.target.value})}/><input disabled={locked} placeholder="Client phone" value={client.phone} onChange={e=>setClient({...client,phone:e.target.value})}/></div><br/><input disabled={locked} placeholder="Job title" value={job.title} onChange={e=>setJob({...job,title:e.target.value})}/><br/><br/><input disabled={locked} type="number" min="1" placeholder="Number of workers" value={job.workers} onChange={e=>setJob({...job,workers:e.target.value})}/><br/><br/><textarea disabled={locked} rows="4" placeholder="Job description" value={job.description} onChange={e=>setJob({...job,description:e.target.value})}/></section></div>

    <section className="card"><h2 className="sectionTitle">Legal Protection</h2><label className="row"><input disabled={locked} style={{width:'auto'}} type="checkbox" checked={job.termsAccepted} onChange={e=>setJob({...job,termsAccepted:e.target.checked})}/> Customer accepts Terms & Conditions, recorded GPS location, labour time, materials, expenses and final charges.</label><p className="muted">Location data is recorded at job start/end as supporting evidence of attendance and work carried out on site.</p><button disabled={locked} onClick={finalConfirm}>Final Customer Confirmation / Lock Job</button>{locked && <p className="success">This job/invoice is locked after confirmation or issue.</p>}</section>

    <section className="card"><h2 className="sectionTitle"><Clock size={18}/> Time & Location</h2><div className="grid grid2"><div className="smallBox"><b>Start</b><p>{dt(job.startTime)}</p><p className="muted"><MapPin size={14}/> {locText(job.startLocation)}</p>{job.startLocation && <iframe className="map" src={`https://www.google.com/maps?q=${job.startLocation.lat},${job.startLocation.lng}&output=embed`}/>}</div><div className="smallBox"><b>Stop</b><p>{dt(job.stopTime)}</p><p className="muted"><MapPin size={14}/> {locText(job.stopLocation)}</p>{job.stopLocation && <iframe className="map" src={`https://www.google.com/maps?q=${job.stopLocation.lat},${job.stopLocation.lng}&output=embed`}/>}</div></div><br/><div className="row"><button disabled={locked} onClick={startJob}><Play size={15}/> Start Job</button><button disabled={locked} className="secondary" onClick={stopJob}><Square size={15}/> Stop Job</button><div className="pill">Site hours: {siteHours}</div><div className="pill">Workers: {workers}</div><div className="pill">Billable: {billableHours}</div></div></section>

    <section className="card"><h2 className="sectionTitle"><Camera size={18}/> Job Photos</h2><input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{display:'none'}} onChange={addPhotos}/><div className="row"><button disabled={locked} className="secondary" onClick={()=>uploadPhoto('before')}>Before</button><button disabled={locked} className="secondary" onClick={()=>uploadPhoto('during')}>During</button><button disabled={locked} className="secondary" onClick={()=>uploadPhoto('after')}>After</button></div><br/><div className="grid grid4">{photos.map(p=><div key={p.id}><img src={p.url} className="photo"/><b>{p.type}</b><p className="muted">{dt(p.capturedAt)}</p></div>)}</div></section>

    <section className="card"><div className="topbar"><h2 className="sectionTitle"><Plus size={18}/> Expenses</h2><button disabled={locked} className="secondary" onClick={()=>setExpenses(x=>[...x,{id:crypto.randomUUID(),category:'Materials',description:'',amount:0}])}>Add expense</button></div>{expenses.map(e=><div className="grid grid4" key={e.id} style={{marginBottom:10}}><select disabled={locked} value={e.category} onChange={ev=>updateExpense(e.id,'category',ev.target.value)}><option>Parking</option><option>Congestion Charge</option><option>ULEZ</option><option>Materials</option><option>Tool rental</option><option>Subcontractor</option><option>Other</option></select><input disabled={locked} placeholder="Description" value={e.description} onChange={ev=>updateExpense(e.id,'description',ev.target.value)}/><input disabled={locked} type="number" value={e.amount} onChange={ev=>updateExpense(e.id,'amount',ev.target.value)}/><button disabled={locked} className="ghost" onClick={()=>setExpenses(xs=>xs.filter(x=>x.id!==e.id))}><Trash2 size={16}/></button></div>)}</section>

    <section className="card"><h2 className="sectionTitle">Deposits & Payments</h2><div className="grid grid3"><input disabled={locked} type="number" value={payment.deposit} onChange={e=>setPayment({...payment,deposit:e.target.value})} placeholder="Deposit £"/><div className="pill">Paid: £{totalPaid.toFixed(2)}</div><div className="pill">Balance: £{balance.toFixed(2)}</div></div><br/><button disabled={locked} className="secondary" onClick={addPayment}>Add payment</button>{payment.payments.map(p=><div className="grid grid4" key={p.id} style={{marginTop:10}}><input disabled={locked} type="date" value={p.date} onChange={e=>updatePayment(p.id,'date',e.target.value)}/><select disabled={locked} value={p.method} onChange={e=>updatePayment(p.id,'method',e.target.value)}><option value="bank">Bank Transfer</option><option value="cash">Cash</option><option value="card">Card</option></select><input disabled={locked} type="number" value={p.amount} onChange={e=>updatePayment(p.id,'amount',e.target.value)} placeholder="Amount £"/><input disabled={locked} value={p.note} onChange={e=>updatePayment(p.id,'note',e.target.value)} placeholder="Note"/></div>)}</section>

    <section className="card"><h2 className="sectionTitle"><PenLine size={18}/> Customer Signatures</h2><div className="grid grid2"><div className="smallBox"><b>Start signature</b><p className="muted">Customer authorises job start.</p>{job.customerStartSignature&&<img src={job.customerStartSignature} className="signatureImg"/>}<br/><button disabled={locked} className="secondary" onClick={()=>setSignatureMode('start')}>Sign start</button></div><div className="smallBox"><b>Completion signature</b><p className="muted">Customer confirms work/time.</p>{job.customerEndSignature&&<img src={job.customerEndSignature} className="signatureImg"/>}<br/><button disabled={locked} className="secondary" onClick={()=>setSignatureMode('end')}>Sign completion</button></div></div></section>

    <section className="card"><h2 className="sectionTitle">Invoice Preview</h2><div className="invoice"><div className="invoiceHead"><div className="companyBlock"><img src={logo} className="logo"/><div><h2>Phoenix MGM Ltd</h2><p className="muted">{company.address}</p><p className="muted">{company.email} · {company.phone}</p><p className="muted">VAT No: {company.vatNumber}</p></div></div><div><div className="invoiceTitle">INVOICE</div><p className="muted">Invoice No: {invoice.number || 'DRAFT'}</p><p className="muted">Date: {new Date().toLocaleDateString('en-GB')}</p></div></div><div className="grid grid2" style={{padding:'18px 0',borderBottom:'1px solid #e2e8f0'}}><div><b>Bill to</b><p>{client.name||'Client name'}</p><p className="muted">{client.address||'Client / job address'}</p></div><div><b>Job details</b><p>{job.title||'Job title'}</p><p className="muted">{job.description||'Job description'}</p><p className="muted">Start: {dt(job.startTime)}</p><p className="muted">Stop: {dt(job.stopTime)}</p></div></div><table><thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead><tbody><tr><td>Call-out fee</td><td className="right">1</td><td className="right">£{callOut.toFixed(2)}</td><td className="right">£{callOut.toFixed(2)}</td></tr><tr><td>Labour ({siteHours} site hours × {workers} worker(s))</td><td className="right">{billableHours} h</td><td className="right">£{Number(company.hourlyRate).toFixed(2)}</td><td className="right">£{labour.toFixed(2)}</td></tr>{expenses.map(e=><tr key={e.id}><td>{e.category}{e.description?` - ${e.description}`:''}</td><td className="right">1</td><td className="right">£{Number(e.amount||0).toFixed(2)}</td><td className="right">£{Number(e.amount||0).toFixed(2)}</td></tr>)}</tbody></table><div className="totals"><div className="totalLine"><span>Subtotal</span><b>£{subtotal.toFixed(2)}</b></div><div className="totalLine"><span>VAT {company.vatRate}%</span><b>£{vat.toFixed(2)}</b></div><div className="totalLine"><span>Total paid</span><b>£{totalPaid.toFixed(2)}</b></div><div className="totalLine big"><span>Balance due</span><b>£{balance.toFixed(2)}</b></div></div><br/><div className="terms"><b>Terms & Conditions</b><ul><li>Payment due within 7 days from invoice date.</li><li>Deposits are non-refundable once work has commenced.</li><li>Additional work, materials, parking, congestion and related expenses are charged separately.</li><li>Late payments may incur statutory interest under UK law.</li><li>Customer signature confirms attendance, work carried out, GPS record, labour hours and charges.</li><li>Phoenix MGM Ltd is not responsible for pre-existing issues or hidden defects.</li></ul></div></div><br/><div className="row"><button onClick={createInvoice} disabled={invoice.loading || invoice.saved}>{invoice.loading?'Saving...':'Create Invoice Number'}</button><button className="secondary" onClick={generatePDF}>Download PDF</button><button className="secondary" onClick={emailInvoice}>Email Invoice</button><button className="secondary" onClick={sendWhatsApp}>WhatsApp</button></div></section>
  </div>{signatureMode&&<div className="modal"><div className="modalBox"><h2>Customer signature - {signatureMode}</h2><canvas ref={canvasRef} width="500" height="220" className="sigCanvas" onMouseMove={draw} onMouseUp={reset} onMouseLeave={reset} onTouchMove={touchDraw} onTouchEnd={reset}/><div className="row" style={{justifyContent:'flex-end',marginTop:12}}><button className="ghost" onClick={clearSig}>Clear</button><button className="secondary" onClick={()=>setSignatureMode(null)}>Cancel</button><button onClick={saveSig}>Save signature</button></div></div></div>}</div>;
}
