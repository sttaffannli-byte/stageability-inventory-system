"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

type Asset = { id:number; assetCode:string; name:string; category:string; status:"available"|"pulled_out"; currentEvent:string|null; updatedAt:string };
type Movement = { id:number; assetCode:string; assetName:string; action:"pullout"|"return"; eventName:string; operatorName:string; createdAt:string };
type InventoryData = { items:Asset[]; movements:Movement[]; summary:{ total:number; available:number; pulledOut:number; returnedToday:number } };
type Staff = { id:number; employeeId:string; fullName:string; position:string; role:string; contactNumber:string; username:string; accountStatus:string; attendanceStatus:string; twoFactorEnabled:number; tripRate:number };
type Client = { id:number; clientCode:string; name:string; company:string; contact:string; email:string; balance:number };
type EventRow = { id:number; eventCode:string; title:string; clientName:string; venue:string; eventDate:string; status:string; crewCount:number; equipmentCount:number };
type Quote = { id:number; quoteNo:string; clientName:string; eventName:string; amount:number; status:string; createdAt:string };
type FinanceRow = { id:number; type:string; category:string; description:string; amount:number; eventName:string; entryDate:string };
type StockRow = { id:number; itemCode:string; name:string; category:string; stock:number; minStock:number; unit:string; supplier:string };
type AlertRow = { id:number; type:string; title:string; message:string; severity:string; isRead:number; dueDate:string; createdAt:string };
type MaintenanceRow = { id:number; assetCode:string; issue:string; status:string; dueDate:string; technician:string };
type AttendanceRow = { id:number; staffId:number; staffName:string; eventName:string; timeIn:string; timeOut:string|null; timeInLat:number|null; timeInLng:number|null; timeOutLat:number|null; timeOutLng:number|null; status:string };
type TripRow = { id:number; staffId:number; staffName:string; eventName:string; tripDate:string; tripRate:number; allowance:number; overtimePay:number; totalPay:number; status:string; approvedBy:string; approvedAt:string|null };
type PayrollRow = { id:number; staffId:number; staffName:string; periodStart:string; periodEnd:string; completedTrips:number; tripPay:number; allowance:number; overtimePay:number; totalPay:number; status:string; approvedBy:string; approvedAt:string|null };
type BackOfficeData = { staff:Staff[]; clients:Client[]; events:EventRow[]; quotations:Quote[]; finance:FinanceRow[]; warehouse:StockRow[]; notifications:AlertRow[]; maintenance:MaintenanceRow[]; attendanceRecords:AttendanceRow[]; trips:TripRow[]; payroll:PayrollRow[]; metrics:{ attendancePresent:number; attendanceTotal:number; monthlyRevenue:number; monthlyExpenses:number } };
type View = "dashboard"|"equipment"|"pullout"|"events"|"clients"|"staff"|"finance"|"warehouse"|"reports"|"notifications"|"security";
type ModalKind = "client"|"event"|"staff"|"quotation"|"finance"|"stock"|"staff-edit";
type AuthUser = { id:number;employeeId:string;fullName:string;position:string;role:string;username:string };

const peso = new Intl.NumberFormat("en-PH", { style:"currency", currency:"PHP", maximumFractionDigits:0 });
const nav: Array<{id:View;label:string;icon:string;group:string}> = [
  {id:"dashboard",label:"Dashboard",icon:"grid",group:"OPERATIONS"},{id:"equipment",label:"Equipment Inventory",icon:"box",group:"OPERATIONS"},
  {id:"pullout",label:"Pull-Out & Return",icon:"scan",group:"OPERATIONS"},{id:"events",label:"Events & Calendar",icon:"calendar",group:"OPERATIONS"},
  {id:"clients",label:"Clients & Quotations",icon:"users",group:"BUSINESS"},{id:"staff",label:"Staff & Attendance",icon:"badge",group:"BUSINESS"},
  {id:"finance",label:"Finance",icon:"wallet",group:"BUSINESS"},{id:"warehouse",label:"Warehouse",icon:"warehouse",group:"BUSINESS"},
  {id:"reports",label:"Reports",icon:"report",group:"CONTROL"},{id:"notifications",label:"Notifications",icon:"bell",group:"CONTROL"},
  {id:"security",label:"Security Center",icon:"shield",group:"CONTROL"},
];

function Icon({ name, size=19 }: {name:string;size?:number}) {
  const p:Record<string,React.ReactNode> = {
    grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    box:<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 21v-9"/></>,
    scan:<><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M7 12h10M8 9v6M11 9v6M14 9v6M17 9v6"/></>,
    calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6"/></>,
    badge:<><circle cx="12" cy="8" r="5"/><path d="M8.5 12 7 22l5-3 5 3-1.5-10"/></>,
    wallet:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M16 12h5M3 9h14"/></>,
    warehouse:<><path d="m3 10 9-7 9 7v11H3z"/><path d="M7 14h10M7 18h10"/></>,
    report:<><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6M9 9h2"/></>,
    bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    shield:<><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus:<path d="M12 5v14M5 12h14"/>,menu:<path d="M4 6h16M4 12h16M4 18h16"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,
    out:<><path d="M9 11 4 6l5-5M4 6h11a5 5 0 0 1 5 5v2"/><path d="M5 14v5a2 2 0 0 0 2 2h9"/></>,
    back:<><path d="m15 11 5-5-5-5M20 6H9a5 5 0 0 0-5 5v2"/><path d="M19 14v5a2 2 0 0 1-2 2H8"/></>,
    print:<><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></>,
    download:<><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/></>,eye:<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    trash:<><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p[name] ?? <circle cx="12" cy="12" r="8"/>}</svg>;
}

function Status({ value }: {value:string}) { return <span className={`pill ${value.toLowerCase().replaceAll(" ","-")}`}>{value.replaceAll("_"," ")}</span>; }
function Avatar({ name }: {name:string}) { return <span className="avatar">{name.split(" ").slice(0,2).map(x=>x[0]).join("")}</span>; }
function Barcode({ value }: {value:string}) { const ref=useRef<SVGSVGElement>(null); useEffect(()=>{ if(ref.current) JsBarcode(ref.current,value,{format:"CODE128",height:42,width:1.45,margin:4,displayValue:true,fontSize:11}); },[value]); return <svg ref={ref} aria-label={`Barcode ${value}`}/>; }

function Scanner({ onCode,onClose }: {onCode:(code:string)=>void;onClose:()=>void}) {
  const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const frameRef=useRef<number|null>(null); const [manual,setManual]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{ let active=true; (async()=>{ try { if(!("BarcodeDetector" in window)) throw new Error("Camera auto-scan is not supported by this browser."); const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false}); streamRef.current=stream; if(!videoRef.current||!active)return; videoRef.current.srcObject=stream; await videoRef.current.play(); const D=(window as unknown as {BarcodeDetector:new(o:{formats:string[]})=>{detect:(v:HTMLVideoElement)=>Promise<Array<{rawValue:string}>>}}).BarcodeDetector; const detector=new D({formats:["code_128","code_39","qr_code"]}); const tick=async()=>{if(!active||!videoRef.current)return;try{const r=await detector.detect(videoRef.current);if(r[0]?.rawValue){onCode(r[0].rawValue);return;}}catch{} frameRef.current=requestAnimationFrame(tick)}; tick(); } catch(e){setError(e instanceof Error?e.message:"Camera unavailable.");} })(); return()=>{active=false;if(frameRef.current)cancelAnimationFrame(frameRef.current);streamRef.current?.getTracks().forEach(t=>t.stop());}; },[onCode]);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Barcode scanner"><div className="scanner-card"><div className="modal-head"><div><span className="kicker">BARCODE / QR SCANNER</span><h2>Scan equipment label</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close"/></button></div><div className="camera-frame"><video ref={videoRef} muted playsInline/><div className="scan-line"/><div className="scan-corners"/></div>{error&&<p className="camera-error">{error} Use manual code below.</p>}<form className="manual-row" onSubmit={e=>{e.preventDefault();if(manual.trim())onCode(manual.trim().toUpperCase())}}><input aria-label="Manual barcode" value={manual} onChange={e=>setManual(e.target.value)} placeholder="e.g. SA-SPK-001"/><button className="btn primary">Process</button></form></div></div>;
}

function BackOfficeModal({kind,data,staff,onClose,onSubmit,submitting}:{kind:ModalKind;data:BackOfficeData;staff:Staff|null;onClose:()=>void;onSubmit:(e:FormEvent<HTMLFormElement>,kind:ModalKind)=>void;submitting:boolean}) {
  const title={client:"Add New Client",event:"Create New Event",staff:"Add Staff Account",quotation:"Create Quotation",finance:"Record Transaction",stock:"Adjust Warehouse Stock","staff-edit":"Update Staff Status"}[kind];
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}><form className="form-card form-wide" onSubmit={e=>onSubmit(e,kind)}><div className="modal-head"><div><span className="kicker">CLOUD DATABASE</span><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close"/></button></div>
    {kind==="client"&&<div className="form-grid"><label>Client Code<input name="clientCode" required placeholder="CL-005"/></label><label>Client / Contact Name<input name="name" required placeholder="Juan Dela Cruz"/></label><label>Company<input name="company" placeholder="Company or family name"/></label><label>Contact Number<input name="contact" required inputMode="tel" placeholder="0917 000 0000"/></label><label>Email<input name="email" type="email" placeholder="client@example.com"/></label><label>Opening Balance<input name="balance" type="number" min="0" defaultValue="0"/></label></div>}
    {kind==="event"&&<div className="form-grid"><label>Event Code<input name="eventCode" required placeholder="EV-2607-05"/></label><label>Event Title<input name="title" required placeholder="Corporate Launch"/></label><label>Client<select name="clientName" required defaultValue=""><option value="">Select client</option>{data.clients.map(c=><option key={c.id} value={c.name}>{c.name} — {c.company}</option>)}</select></label><label>Venue<input name="venue" required placeholder="Event venue"/></label><label>Event Date<input name="eventDate" type="date" required/></label><label>Status<select name="status" defaultValue="confirmed"><option value="quotation">Quotation</option><option value="confirmed">Confirmed</option><option value="preparation">Preparation</option><option value="completed">Completed</option></select></label><label>Crew Count<input name="crewCount" type="number" min="0" defaultValue="0"/></label><label>Equipment Count<input name="equipmentCount" type="number" min="0" defaultValue="0"/></label></div>}
    {kind==="staff"&&<div className="form-grid"><label>Employee ID<input name="employeeId" required placeholder="SA-EMP-007"/></label><label>Full Name<input name="fullName" required placeholder="Full name"/></label><label>Position<input name="position" required placeholder="Job position"/></label><label>Role<select name="role" required defaultValue="Crew"><option>Super Admin</option><option>Admin</option><option>Office Staff</option><option>Warehouse Staff</option><option>Technician</option><option>Crew</option></select></label><label>Contact Number<input name="contactNumber" required inputMode="tel"/></label><label>Username<input name="username" required autoComplete="off"/></label><label className="span-2">Temporary Password<input name="temporaryPassword" required type="password" minLength={10} autoComplete="new-password" placeholder="At least 10 characters"/></label><label>Pay Per Trip<input name="tripRate" type="number" min="0" defaultValue="0"/></label><label>Attendance<select name="attendanceStatus" defaultValue="present"><option value="present">Present</option><option value="on-site">On-site</option><option value="absent">Absent</option><option value="leave">On leave</option></select></label><label className="check-label"><input name="twoFactorEnabled" type="checkbox"/> 2FA enrolled</label></div>}
    {kind==="quotation"&&<div className="form-grid"><label>Quotation Number<input name="quoteNo" required placeholder="QT-2026-074"/></label><label>Client<select name="clientName" required defaultValue=""><option value="">Select client</option>{data.clients.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label>Event / Project<input name="eventName" required placeholder="Event title"/></label><label>Amount<input name="amount" required type="number" min="1"/></label><label>Status<select name="status" defaultValue="pending"><option value="pending">Pending</option><option value="sent">Sent</option><option value="approved">Approved</option><option value="declined">Declined</option><option value="paid">Paid</option></select></label></div>}
    {kind==="finance"&&<div className="form-grid"><label>Transaction Type<select name="type" defaultValue="income"><option value="income">Income</option><option value="expense">Expense</option></select></label><label>Category<input name="category" required placeholder="Event Payment"/></label><label className="span-2">Description<input name="description" required placeholder="Transaction description"/></label><label>Amount<input name="amount" required type="number" min="1"/></label><label>Date<input name="entryDate" required type="date" defaultValue={new Date().toISOString().slice(0,10)}/></label><label className="span-2">Event<select name="eventName" defaultValue=""><option value="">Not event-related</option>{data.events.map(e=><option key={e.id} value={e.title}>{e.title}</option>)}</select></label></div>}
    {kind==="stock"&&<div className="form-grid"><label className="span-2">Warehouse Item<select name="itemCode" required defaultValue=""><option value="">Select item</option>{data.warehouse.map(w=><option key={w.id} value={w.itemCode}>{w.itemCode} — {w.name} ({w.stock} {w.unit})</option>)}</select></label><label>Adjustment<input name="delta" required type="number" placeholder="Use - for stock out"/></label><label>Reason<input name="reason" required placeholder="Received / Used / Correction"/></label></div>}
    {kind==="staff-edit"&&staff&&<div className="form-grid"><input type="hidden" name="id" value={staff.id}/><div className="form-readonly span-2"><Avatar name={staff.fullName}/><div><b>{staff.fullName}</b><small>{staff.employeeId} • {staff.role}</small></div></div><label>Pay Per Trip<input name="tripRate" type="number" min="0" defaultValue="0"/></label><label>Pay Per Trip<input name="tripRate" type="number" min="0" defaultValue={staff.tripRate||0}/></label><label>Attendance<select name="attendanceStatus" defaultValue={staff.attendanceStatus}><option value="present">Present</option><option value="on-site">On-site</option><option value="absent">Absent</option><option value="leave">On leave</option></select></label><label>Account Status<select name="accountStatus" defaultValue={staff.accountStatus}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>{staff.role==="Super Admin"&&staff.username==="stefan"?<label className="span-2">Reset 6-Digit Admin PIN (optional)<input name="temporaryPassword" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" placeholder="Leave blank to keep current PIN"/></label>:<label className="span-2">Reset Password (optional)<input name="temporaryPassword" type="password" minLength={10} autoComplete="new-password" placeholder="Leave blank to keep current password"/></label>}<label className="check-label span-2"><input name="twoFactorEnabled" type="checkbox" defaultChecked={Boolean(staff.twoFactorEnabled)}/> 2FA enrolled</label></div>}
    <div className="form-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={submitting}>{submitting?"Saving…":"Save to Cloud"}</button></div>
  </form></div>;
}

function AuthScreen({setupRequired,onAuth}:{setupRequired:boolean;onAuth:(user:AuthUser)=>void}){
  const [mode,setMode]=useState<"login"|"setup">(setupRequired?"setup":"login");
  const [loginType,setLoginType]=useState<"admin"|"staff">(setupRequired?"staff":"admin");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function authRequest(payload:Record<string,unknown>){
    for(let attempt=0;attempt<2;attempt++){
      const r=await fetch(`/api/auth?attempt=${Date.now()}`,{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload)});
      const raw=await r.text(),contentType=r.headers.get("content-type")??"";
      if(contentType.includes("application/json")){const body=JSON.parse(raw);if(!r.ok)throw new Error(body.error||"Unable to sign in.");return body}
      if(attempt===0){await new Promise(resolve=>window.setTimeout(resolve,450));continue}
      throw new Error("Login service did not respond correctly. Please tap Login again.");
    }
    throw new Error("Unable to reach the login service.");
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");
    const values=Object.fromEntries(new FormData(e.currentTarget));
    try{const body=await authRequest({action:mode,...values});onAuth(body.user)}
    catch(err){setError(err instanceof Error?err.message:"Unable to sign in.")}finally{setBusy(false)}
  }
  const adminAccess=mode==="setup"||loginType==="admin";
  return <main className="auth-shell"><section className="auth-brand"><img className="auth-logo" src="/stageability-logo.jpg" alt="Stageability Lights and Sounds logo"/><span>STAGEABILITY LIGHTS &amp; SOUNDS</span><h1>Equipment Operations Portal</h1><p>Secure pull-out, warehouse return, inventory accountability, and back-office control.</p><div className="auth-features"><span><Icon name="scan"/>Barcode accountability</span><span><Icon name="warehouse"/>Warehouse control</span><span><Icon name="shield"/>Role-based access</span></div></section><section className="auth-card"><span className="kicker">SECURE ACCESS</span><h2>{mode==="setup"?"Create Admin PIN":loginType==="admin"?"Super Admin PIN":"Staff Login"}</h2><p>{mode==="setup"?"One-time activation: create your own 6-digit Super Admin PIN.":loginType==="admin"?"Enter your private 6-digit PIN.":"Enter the username and password created by your administrator."}</p>{mode==="login"&&<div className="auth-tabs">{setupRequired?<button type="button" onClick={()=>{setMode("setup");setError("")}}>Create Admin PIN First</button>:<button type="button" className={loginType==="admin"?"active":""} onClick={()=>{setLoginType("admin");setError("")}}>Admin PIN</button>}<button type="button" className={loginType==="staff"?"active":""} onClick={()=>{setLoginType("staff");setError("")}}>Staff Login</button></div>}{error&&<div className="auth-error">{error}</div>}<form onSubmit={submit}>
    {adminAccess?<input name="username" type="hidden" value="stefan" readOnly/>:<label>Username<input name="username" required autoComplete="username" placeholder="Staff username"/></label>}
    {mode==="setup"&&<label>One-Time Activation Code<input name="activationCode" required autoComplete="one-time-code" placeholder="Activation code"/></label>}
    {mode==="setup"?<label>Create 6-Digit PIN<input name="pin" required type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="new-password" placeholder="••••••"/></label>:adminAccess?<label>6-Digit Admin PIN<input name="password" required type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="current-password" placeholder="••••••"/></label>:<label>Password<input name="password" required type="password" minLength={10} autoComplete="current-password" placeholder="••••••••••"/></label>}
    {mode==="setup"&&<small className="password-help">Choose six numbers that only the Super Admin knows.</small>}
    <button className="btn primary full" disabled={busy}>{busy?"Please wait…":mode==="setup"?"Activate Admin PIN":loginType==="admin"?"Login with PIN":"Staff Login"}</button>
  </form>{setupRequired&&<button className="auth-switch" onClick={()=>{setError("");setMode(mode==="setup"?"login":"setup");setLoginType("staff")}}>{mode==="setup"?"Go to staff login":"Create Super Admin PIN"}</button>}<footer><Icon name="shield"/> Session expires automatically after 8 hours</footer></section></main>;
}

function MetricCard({label,value,detail,tone="silver",icon}:{label:string;value:string|number;detail:string;tone?:string;icon:string}) { return <article className={`metric ${tone}`}><span className="metric-icon"><Icon name={icon}/></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>; }
function PageHead({kicker,title,sub,actions}:{kicker:string;title:string;sub:string;actions?:React.ReactNode}) { return <div className="page-head"><div><span className="kicker">{kicker}</span><h1>{title}</h1><p>{sub}</p></div>{actions&&<div className="page-actions">{actions}</div>}</div>; }

function OperationalEquipment({inventory,filtered,search,setSearch,status,setStatus,category,setCategory,setShowAdd,print,preview,remove,submitting}:{inventory:InventoryData;filtered:Asset[];search:string;setSearch:(s:string)=>void;status:string;setStatus:(s:string)=>void;category:string;setCategory:(s:string)=>void;setShowAdd:(b:boolean)=>void;print:()=>void;preview:(a:Asset)=>void;remove:(a:Asset)=>void;submitting:boolean}) {
  const categories=[...new Set(inventory.items.map(a=>a.category))];
  return <><PageHead kicker="ASSET MANAGEMENT" title="Equipment Inventory" sub="Search, filter, label, and manage every registered equipment unit." actions={<><button className="btn secondary" onClick={print}><Icon name="print"/>Print Labels</button><button className="btn primary" onClick={()=>setShowAdd(true)}><Icon name="plus"/>Add Equipment</button></>}/>
    <div className="submetrics"><span><b>{inventory.summary.total}</b>Total units</span><span><b>{inventory.summary.available}</b>Warehouse</span><span><b>{inventory.summary.pulledOut}</b>Deployed</span><span><b>{inventory.summary.returnedToday}</b>Returned today</span></div>
    <article className="panel data-panel"><div className="table-tools"><div className="search-box"><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ID, equipment, category, event…"/></div><select value={status} onChange={e=>setStatus(e.target.value)} aria-label="Equipment status"><option value="all">All status</option><option value="available">Available</option><option value="pulled_out">Pulled out</option></select><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Equipment category"><option value="all">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
      <div className="table-scroll"><table><thead><tr><th>Equipment ID</th><th>Equipment</th><th>Category</th><th>Storage</th><th>Condition</th><th>Status</th><th>Assigned Event</th><th>Actions</th></tr></thead><tbody>{filtered.map((a,i)=><tr key={a.id}><td><code>{a.assetCode}</code></td><td><div className="equipment-cell"><span className="equip-thumb"><Icon name="box"/></span><div><b>{a.name}</b><small>Stageability Asset</small></div></div></td><td>{a.category}</td><td>{["Rack A-01","Lighting Bay","LED Storage","Truss Zone"][i%4]}</td><td><Status value="Good"/></td><td><Status value={a.status==="available"?"Available":"Pulled Out"}/></td><td>{a.currentEvent||<span className="muted">—</span>}</td><td><div className="row-actions"><button onClick={()=>preview(a)} title="Generate barcode"><Icon name="scan"/>Barcode</button><button onClick={()=>{preview(a);window.setTimeout(()=>{document.body.classList.add("print-one-label");window.print();window.setTimeout(()=>document.body.classList.remove("print-one-label"),200)},120)}} title="Print this barcode"><Icon name="print"/>Print</button><button className="danger" disabled={submitting||a.status==="pulled_out"} onClick={()=>remove(a)} title={a.status==="pulled_out"?"Return this item before deleting":"Delete equipment"}><Icon name="trash"/>Delete</button></div></td></tr>)}{!filtered.length&&<tr><td colSpan={8} className="empty-cell">No equipment matches the selected filters.</td></tr>}</tbody></table></div>
    </article></>;
}


function OperationalEvents({data,open,edit,remove}:{data:BackOfficeData;open:()=>void;edit:(resource:string,row:EventRow)=>void;remove:(resource:string,id:number,label:string)=>void}) {
  return <><PageHead kicker="EVENT OPERATIONS" title="Event Calendar & Bookings" sub="Plan schedules, venues, crew assignments, equipment reservations, and event status." actions={<button className="btn primary" onClick={open}><Icon name="plus"/>New Event</button>}/><div className="event-board">{data.events.map(e=><article className="event-card" key={e.id}><div className="event-date"><b>{new Date(e.eventDate+"T00:00:00").getDate()}</b><span>{new Date(e.eventDate+"T00:00:00").toLocaleDateString("en-PH",{month:"short"}).toUpperCase()}</span><small>{new Date(e.eventDate+"T00:00:00").getFullYear()}</small></div><div className="event-info"><div><code>{e.eventCode}</code><Status value={e.status}/></div><h3>{e.title}</h3><p>{e.clientName}</p><span><Icon name="warehouse"/> {e.venue}</span><footer><small><Icon name="users"/> {e.crewCount} crew</small><small><Icon name="box"/> {e.equipmentCount} equipment</small></footer><div className="row-actions"><button onClick={()=>edit("event",e)}>Edit</button><button className="danger" onClick={()=>remove("event",e.id,e.title)}>Delete</button></div></div></article>)}</div></>;
}

function OperationalClients({data,openClient,openQuote,edit,remove}:{data:BackOfficeData;openClient:()=>void;openQuote:()=>void;edit:(resource:string,row:Client|Quote)=>void;remove:(resource:string,id:number,label:string)=>void}) {
  return <><PageHead kicker="CLIENT RELATIONSHIP MANAGEMENT" title="Clients, Quotations & Billing" sub="Add, edit, delete, and update quotation sales status." actions={<><button className="btn secondary" onClick={openQuote}><Icon name="report"/>New Quotation</button><button className="btn primary" onClick={openClient}><Icon name="plus"/>New Client</button></>}/><div className="client-stats"><MetricCard label="ACTIVE CLIENTS" value={data.clients.length} detail="in current database" icon="users"/><MetricCard label="PENDING QUOTATIONS" value={data.quotations.filter(q=>q.status==="pending").length} detail="requires follow-up" icon="report" tone="amber"/><MetricCard label="ACCOUNTS RECEIVABLE" value={peso.format(data.clients.reduce((s,c)=>s+c.balance,0))} detail="outstanding balances" icon="wallet" tone="red"/></div><div className="two-cols"><article className="panel data-panel"><div className="panel-title"><div><span className="kicker">CLIENT DATABASE</span><h2>Client Accounts</h2></div></div><div className="table-scroll"><table><thead><tr><th>Client</th><th>Client ID</th><th>Contact</th><th>Balance</th><th>Actions</th></tr></thead><tbody>{data.clients.map(c=><tr key={c.id}><td><div className="person-cell"><Avatar name={c.name}/><div><b>{c.name}</b><small>{c.company||"Individual client"}</small></div></div></td><td><code>{c.clientCode}</code></td><td>{c.contact}<small className="block">{c.email||"No email"}</small></td><td>{peso.format(c.balance)}</td><td><div className="row-actions"><button onClick={()=>edit("client",c)}>Edit</button><button className="danger" onClick={()=>remove("client",c.id,c.name)}>Delete</button></div></td></tr>)}</tbody></table></div></article><article className="panel quote-panel"><div className="panel-title"><div><span className="kicker">SALES PIPELINE</span><h2>Quotations</h2></div><button className="text-btn" onClick={openQuote}>+ Add</button></div>{data.quotations.map(q=><div className="quote-row" key={q.id}><div><code>{q.quoteNo}</code><b>{q.eventName}</b><small>{q.clientName}</small></div><div><strong>{peso.format(q.amount)}</strong><Status value={q.status}/><div className="row-actions"><button onClick={()=>edit("quotation",q)}>Edit / Status</button><button className="danger" onClick={()=>remove("quotation",q.id,q.quoteNo)}>Delete</button></div></div></div>)}</article></div></>;
function OperationalStaff({data,open,openStaff,remove,timeIn,timeOut,addTrip,generatePayroll,approve,removeRecord}:{data:BackOfficeData;open:()=>void;openStaff:(staff:Staff)=>void;remove:(resource:string,id:number,label:string)=>void;timeIn:(staff:Staff)=>void;timeOut:(row:AttendanceRow)=>void;addTrip:(staff:Staff)=>void;generatePayroll:(staff:Staff)=>void;approve:(resource:"trip-approve"|"payroll-approve",id:number)=>void;removeRecord:(resource:string,id:number,label:string)=>void}) {
  const printPayslip=(p:PayrollRow)=>{
    const staff=data.staff.find(s=>s.id===p.staffId);
    const win=window.open("","_blank","width=850,height=900");
    if(!win){window.alert("Please allow pop-ups to print the payslip.");return;}
    const esc=(value:unknown)=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]??ch));
    win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Payslip - ${esc(p.staffName)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#111;background:#eee}
  .sheet{max-width:760px;margin:auto;background:#fff;border:1px solid #bbb;padding:34px}
  .head{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #b8202a;padding-bottom:18px;margin-bottom:22px}
  h1{margin:0;font-size:24px;letter-spacing:.04em}
  .brand{color:#b8202a;font-size:12px;font-weight:800;letter-spacing:.12em}
  .meta{text-align:right;font-size:12px;line-height:1.6}
  .employee{display:grid;grid-template-columns:1fr 1fr;gap:10px 30px;margin-bottom:24px}
  .employee div,.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:9px 0}
  .label{color:#666;font-size:12px}
  .value{font-weight:700;font-size:13px}
  .paybox{border:1px solid #bbb;padding:18px;margin-top:12px}
  .row.total{border-top:2px solid #111;border-bottom:0;margin-top:8px;padding-top:15px;font-size:18px}
  .status{text-transform:uppercase;font-weight:800;color:${p.status==="approved"?"#147a42":"#a05a00"}}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:55px;text-align:center}
  .signature{border-top:1px solid #111;padding-top:7px;font-size:11px}
  .actions{text-align:center;margin-top:25px}
  button{padding:11px 20px;border:0;background:#b8202a;color:#fff;border-radius:6px;font-weight:700;cursor:pointer}
  @media print{body{background:#fff;padding:0}.sheet{border:0;max-width:none}.actions{display:none}}
</style>
</head>
<body>
<div class="sheet">
  <div class="head">
    <div>
      <div class="brand">STAGEABILITY LIGHTS &amp; SOUNDS</div>
      <h1>EMPLOYEE PAYSLIP</h1>
    </div>
    <div class="meta">
      Payroll No.: PAY-${String(p.id).padStart(5,"0")}<br>
      Period: ${esc(p.periodStart)} to ${esc(p.periodEnd)}
    </div>
  </div>

  <div class="employee">
    <div><span class="label">Employee Name</span><span class="value">${esc(p.staffName)}</span></div>
    <div><span class="label">Employee ID</span><span class="value">${esc(staff?.employeeId||p.staffId)}</span></div>
    <div><span class="label">Position</span><span class="value">${esc(staff?.position||"—")}</span></div>
    <div><span class="label">Status</span><span class="value status">${esc(p.status)}</span></div>
  </div>

  <div class="paybox">
    <div class="row"><span>Completed Trips</span><strong>${p.completedTrips}</strong></div>
    <div class="row"><span>Trip Pay</span><strong>${esc(peso.format(p.tripPay))}</strong></div>
    <div class="row"><span>Allowance</span><strong>${esc(peso.format(p.allowance))}</strong></div>
    <div class="row"><span>Overtime Pay</span><strong>${esc(peso.format(p.overtimePay))}</strong></div>
    <div class="row total"><span>TOTAL PAY</span><strong>${esc(peso.format(p.totalPay))}</strong></div>
  </div>

  <p style="font-size:11px;color:#555;margin-top:18px">
    Approved by: <b>${esc(p.approvedBy||"Pending approval")}</b>
    ${p.approvedAt?` on ${esc(new Date(p.approvedAt).toLocaleString("en-PH"))}`:""}
  </p>

  <div class="signatures">
    <div class="signature">Employee Signature</div>
    <div class="signature">Authorized Signature</div>
  </div>

  <div class="actions"><button onclick="window.print()">Print Payslip</button></div>
</div>
</body>
</html>`);
    win.document.close();
    win.focus();
  };

  return <><PageHead kicker="PEOPLE, ATTENDANCE & PAYROLL" title="Staff Payroll & Attendance" sub="Per-trip rates, GPS time in/out, trip assignments, allowances, overtime, payroll history, and printable payslips." actions={<button className="btn primary" onClick={open}><Icon name="plus"/>Add Staff</button>}/>
  <div className="staff-grid">{data.staff.map(s=><article className="staff-card" key={s.id}><div className="staff-top"><Avatar name={s.fullName}/><Status value={s.attendanceStatus}/></div><h3>{s.fullName}</h3><p>{s.position}</p><code>{s.employeeId}</code><dl><div><dt>Role</dt><dd>{s.role}</dd></div><div><dt>Trip Rate</dt><dd>{peso.format(s.tripRate||0)}</dd></div><div><dt>Account</dt><dd>{s.accountStatus}</dd></div></dl><footer><button onClick={()=>openStaff(s)}>Edit</button><button onClick={()=>timeIn(s)}>Time In</button><button onClick={()=>addTrip(s)}>Add Trip</button><button onClick={()=>generatePayroll(s)}>Generate Payroll</button><button className="danger" onClick={()=>remove("staff",s.id,s.fullName)}>Delete</button></footer></article>)}</div>

  <article className="panel data-panel"><div className="panel-title"><h2>Attendance & GPS</h2></div><div className="table-scroll"><table><thead><tr><th>Staff</th><th>Event</th><th>Time In</th><th>Time Out</th><th>GPS In</th><th>GPS Out</th><th>Actions</th></tr></thead><tbody>{data.attendanceRecords.map(a=><tr key={a.id}><td>{a.staffName}</td><td>{a.eventName||"—"}</td><td>{new Date(a.timeIn).toLocaleString()}</td><td>{a.timeOut?new Date(a.timeOut).toLocaleString():"Open"}</td><td>{a.timeInLat!=null?`${a.timeInLat.toFixed(5)}, ${a.timeInLng?.toFixed(5)}`:"Unavailable"}</td><td>{a.timeOutLat!=null?`${a.timeOutLat.toFixed(5)}, ${a.timeOutLng?.toFixed(5)}`:"—"}</td><td><div className="row-actions">{!a.timeOut&&<button onClick={()=>timeOut(a)}>Time Out</button>}<button className="danger" onClick={()=>removeRecord("attendance",a.id,`attendance of ${a.staffName}`)}>Delete</button></div></td></tr>)}</tbody></table></div></article>

  <article className="panel data-panel"><div className="panel-title"><h2>Trips & Pay Snapshots</h2></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Staff</th><th>Event</th><th>Trip Rate</th><th>Allowance</th><th>Overtime</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.trips.map(t=><tr key={t.id}><td>{t.tripDate}</td><td>{t.staffName}</td><td>{t.eventName}</td><td>{peso.format(t.tripRate)}</td><td>{peso.format(t.allowance)}</td><td>{peso.format(t.overtimePay)}</td><td><b>{peso.format(t.totalPay)}</b></td><td><Status value={t.status}/></td><td><div className="row-actions">{t.status!=="approved"&&<button onClick={()=>approve("trip-approve",t.id)}>Approve</button>}<button className="danger" onClick={()=>removeRecord("trip",t.id,`trip ${t.eventName}`)}>Delete</button></div></td></tr>)}</tbody></table></div></article>

  <article className="panel data-panel"><div className="panel-title"><h2>Payroll History & Payslips</h2></div><div className="table-scroll"><table><thead><tr><th>Period</th><th>Staff</th><th>Trips</th><th>Trip Pay</th><th>Allowance</th><th>Overtime</th><th>Total Pay</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.payroll.map(p=><tr key={p.id}><td>{p.periodStart} — {p.periodEnd}</td><td>{p.staffName}</td><td>{p.completedTrips}</td><td>{peso.format(p.tripPay)}</td><td>{peso.format(p.allowance)}</td><td>{peso.format(p.overtimePay)}</td><td><b>{peso.format(p.totalPay)}</b></td><td><Status value={p.status}/></td><td><div className="row-actions"><button onClick={()=>printPayslip(p)}><Icon name="print"/>Payslip</button>{p.status!=="approved"&&<button onClick={()=>approve("payroll-approve",p.id)}>Approve</button>}<button className="danger" onClick={()=>removeRecord("payroll",p.id,`payroll of ${p.staffName}`)}>Delete</button></div></td></tr>)}</tbody></table></div></article></>;
}
