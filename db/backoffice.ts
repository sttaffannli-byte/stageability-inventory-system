function db() {
  const runtime = globalThis as typeof globalThis & {
    __STAGE_ABILITY_ENV__?: { DB?: D1Database };
  };
  const database = runtime.__STAGE_ABILITY_ENV__?.DB;
  if (!database) throw new Error("Back-office database is not connected.");
  return database;
}

async function hasColumn(table: string, column: string) {
  const result = await db().prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return result.results.some((row) => row.name === column);
}

async function addColumn(table: string, definition: string, column: string) {
  if (!(await hasColumn(table, column))) {
    await db().prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
  }
}

export async function ensureBackOfficeSchema() {
  const database = db();

  await database.batch([
    database.prepare("CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, position TEXT NOT NULL, role TEXT NOT NULL, contact_number TEXT NOT NULL DEFAULT '', username TEXT NOT NULL UNIQUE, account_status TEXT NOT NULL DEFAULT 'active', attendance_status TEXT NOT NULL DEFAULT 'present', two_factor_enabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, client_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', balance INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, client_name TEXT NOT NULL, venue TEXT NOT NULL, event_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', crew_count INTEGER NOT NULL DEFAULT 0, equipment_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS quotations (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_no TEXT NOT NULL UNIQUE, client_name TEXT NOT NULL, event_name TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS finance_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, event_name TEXT NOT NULL DEFAULT '', entry_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS warehouse_items (id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0, min_stock INTEGER NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'pcs', supplier TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', is_read INTEGER NOT NULL DEFAULT 0, due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_code TEXT NOT NULL, issue TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', due_date TEXT NOT NULL, technician TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),

    database.prepare("CREATE TABLE IF NOT EXISTS staff_attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE, event_name TEXT NOT NULL DEFAULT '', time_in TEXT NOT NULL, time_out TEXT, time_in_lat REAL, time_in_lng REAL, time_out_lat REAL, time_out_lng REAL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),

    database.prepare("CREATE TABLE IF NOT EXISTS staff_trips (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE, event_name TEXT NOT NULL, trip_date TEXT NOT NULL, trip_rate INTEGER NOT NULL DEFAULT 0, allowance INTEGER NOT NULL DEFAULT 0, overtime_pay INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', approved_by TEXT NOT NULL DEFAULT '', approved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),

    database.prepare("CREATE TABLE IF NOT EXISTS payroll_records (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE, period_start TEXT NOT NULL, period_end TEXT NOT NULL, completed_trips INTEGER NOT NULL DEFAULT 0, trip_pay INTEGER NOT NULL DEFAULT 0, allowance INTEGER NOT NULL DEFAULT 0, overtime_pay INTEGER NOT NULL DEFAULT 0, total_pay INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', approved_by TEXT NOT NULL DEFAULT '', approved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),

    database.prepare("CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date)"),
    database.prepare("CREATE INDEX IF NOT EXISTS finance_date_idx ON finance_entries(entry_date)"),
    database.prepare("CREATE INDEX IF NOT EXISTS attendance_staff_idx ON staff_attendance(staff_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS trips_staff_idx ON staff_trips(staff_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS payroll_staff_idx ON payroll_records(staff_id)")
  ]);

  await addColumn("staff", "trip_rate INTEGER NOT NULL DEFAULT 0", "trip_rate");
}

export async function getBackOffice() {
  await ensureBackOfficeSchema();
  const database = db();

  const [
    staff,
    clients,
    events,
    quotations,
    finance,
    warehouse,
    notifications,
    maintenance,
    attendanceRecords,
    trips,
    payroll,
    attendance,
    financial
  ] = await Promise.all([
    database.prepare("SELECT id,employee_id AS employeeId,full_name AS fullName,position,role,contact_number AS contactNumber,username,account_status AS accountStatus,attendance_status AS attendanceStatus,two_factor_enabled AS twoFactorEnabled,trip_rate AS tripRate FROM staff ORDER BY id").all(),
    database.prepare("SELECT id,client_code AS clientCode,name,company,contact,email,balance FROM clients ORDER BY id").all(),
    database.prepare("SELECT id,event_code AS eventCode,title,client_name AS clientName,venue,event_date AS eventDate,status,crew_count AS crewCount,equipment_count AS equipmentCount FROM events ORDER BY event_date").all(),
    database.prepare("SELECT id,quote_no AS quoteNo,client_name AS clientName,event_name AS eventName,amount,status,created_at AS createdAt FROM quotations ORDER BY id DESC").all(),
    database.prepare("SELECT id,type,category,description,amount,event_name AS eventName,entry_date AS entryDate FROM finance_entries ORDER BY entry_date DESC,id DESC").all(),
    database.prepare("SELECT id,item_code AS itemCode,name,category,stock,min_stock AS minStock,unit,supplier FROM warehouse_items ORDER BY category,name").all(),
    database.prepare("SELECT id,type,title,message,severity,is_read AS isRead,due_date AS dueDate,created_at AS createdAt FROM notifications ORDER BY is_read,id DESC").all(),
    database.prepare("SELECT id,asset_code AS assetCode,issue,status,due_date AS dueDate,technician FROM maintenance ORDER BY due_date").all(),
    database.prepare("SELECT a.id,a.staff_id AS staffId,s.full_name AS staffName,a.event_name AS eventName,a.time_in AS timeIn,a.time_out AS timeOut,a.time_in_lat AS timeInLat,a.time_in_lng AS timeInLng,a.time_out_lat AS timeOutLat,a.time_out_lng AS timeOutLng,a.status FROM staff_attendance a JOIN staff s ON s.id=a.staff_id ORDER BY a.id DESC").all(),
    database.prepare("SELECT t.id,t.staff_id AS staffId,s.full_name AS staffName,t.event_name AS eventName,t.trip_date AS tripDate,t.trip_rate AS tripRate,t.allowance,t.overtime_pay AS overtimePay,(t.trip_rate+t.allowance+t.overtime_pay) AS totalPay,t.status,t.approved_by AS approvedBy,t.approved_at AS approvedAt FROM staff_trips t JOIN staff s ON s.id=t.staff_id ORDER BY t.trip_date DESC,t.id DESC").all(),
    database.prepare("SELECT p.id,p.staff_id AS staffId,s.full_name AS staffName,p.period_start AS periodStart,p.period_end AS periodEnd,p.completed_trips AS completedTrips,p.trip_pay AS tripPay,p.allowance,p.overtime_pay AS overtimePay,p.total_pay AS totalPay,p.status,p.approved_by AS approvedBy,p.approved_at AS approvedAt FROM payroll_records p JOIN staff s ON s.id=p.staff_id ORDER BY p.period_end DESC,p.id DESC").all(),
    database.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN attendance_status IN ('present','on-site') THEN 1 ELSE 0 END) AS present FROM staff WHERE account_status='active'").first<{ total:number; present:number }>(),
    database.prepare("SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expenses FROM finance_entries WHERE substr(entry_date,1,7)=substr(date('now'),1,7)").first<{ income:number; expenses:number }>()
  ]);

  return {
    staff: staff.results,
    clients: clients.results,
    events: events.results,
    quotations: quotations.results,
    finance: finance.results,
    warehouse: warehouse.results,
    notifications: notifications.results,
    maintenance: maintenance.results,
    attendanceRecords: attendanceRecords.results,
    trips: trips.results,
    payroll: payroll.results,
    metrics: {
      attendancePresent: attendance?.present ?? 0,
      attendanceTotal: attendance?.total ?? 0,
      monthlyRevenue: financial?.income ?? 0,
      monthlyExpenses: financial?.expenses ?? 0
    }
  };
}

type NewClient = { clientCode:string; name:string; company:string; contact:string; email:string; balance:number };
type NewEvent = { eventCode:string; title:string; clientName:string; venue:string; eventDate:string; status:string; crewCount:number; equipmentCount:number };
type NewStaff = { employeeId:string; fullName:string; position:string; role:string; contactNumber:string; username:string; accountStatus:string; attendanceStatus:string; twoFactorEnabled:number; tripRate?:number };
type NewQuotation = { quoteNo:string; clientName:string; eventName:string; amount:number; status:string };
type NewFinance = { type:string; category:string; description:string; amount:number; eventName:string; entryDate:string };

export async function createClient(input:NewClient) {
  await ensureBackOfficeSchema();
  return db().prepare("INSERT INTO clients (client_code,name,company,contact,email,balance) VALUES (?,?,?,?,?,?) RETURNING id,client_code AS clientCode,name,company,contact,email,balance")
    .bind(input.clientCode,input.name,input.company,input.contact,input.email,input.balance).first();
}

export async function createEvent(input:NewEvent) {
  await ensureBackOfficeSchema();
  return db().prepare("INSERT INTO events (event_code,title,client_name,venue,event_date,status,crew_count,equipment_count) VALUES (?,?,?,?,?,?,?,?) RETURNING id,event_code AS eventCode,title,client_name AS clientName,venue,event_date AS eventDate,status,crew_count AS crewCount,equipment_count AS equipmentCount")
    .bind(input.eventCode,input.title,input.clientName,input.venue,input.eventDate,input.status,input.crewCount,input.equipmentCount).first();
}

export async function createStaff(input:NewStaff) {
  await ensureBackOfficeSchema();
  return db().prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,account_status,attendance_status,two_factor_enabled,trip_rate) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id,employee_id AS employeeId,full_name AS fullName,position,role,contact_number AS contactNumber,username,account_status AS accountStatus,attendance_status AS attendanceStatus,two_factor_enabled AS twoFactorEnabled,trip_rate AS tripRate")
    .bind(input.employeeId,input.fullName,input.position,input.role,input.contactNumber,input.username,input.accountStatus,input.attendanceStatus,input.twoFactorEnabled,input.tripRate??0).first();
}

export async function createQuotation(input:NewQuotation) {
  await ensureBackOfficeSchema();
  return db().prepare("INSERT INTO quotations (quote_no,client_name,event_name,amount,status) VALUES (?,?,?,?,?) RETURNING id,quote_no AS quoteNo,client_name AS clientName,event_name AS eventName,amount,status,created_at AS createdAt")
    .bind(input.quoteNo,input.clientName,input.eventName,input.amount,input.status).first();
}

export async function createFinanceEntry(input:NewFinance) {
  await ensureBackOfficeSchema();
  return db().prepare("INSERT INTO finance_entries (type,category,description,amount,event_name,entry_date) VALUES (?,?,?,?,?,?) RETURNING id,type,category,description,amount,event_name AS eventName,entry_date AS entryDate")
    .bind(input.type,input.category,input.description,input.amount,input.eventName,input.entryDate).first();
}

export async function adjustWarehouseStock(itemCode:string,delta:number) {
  await ensureBackOfficeSchema();
  return db().prepare("UPDATE warehouse_items SET stock=MAX(0,stock+?) WHERE item_code=? RETURNING id,item_code AS itemCode,name,category,stock,min_stock AS minStock,unit,supplier")
    .bind(delta,itemCode).first();
}

export async function updateStaffStatus(id:number,attendanceStatus:string,accountStatus:string,twoFactorEnabled:number,tripRate?:number) {
  await ensureBackOfficeSchema();
  return db().prepare("UPDATE staff SET attendance_status=?,account_status=?,two_factor_enabled=?,trip_rate=COALESCE(?,trip_rate) WHERE id=? RETURNING id,employee_id AS employeeId,full_name AS fullName,position,role,contact_number AS contactNumber,username,account_status AS accountStatus,attendance_status AS attendanceStatus,two_factor_enabled AS twoFactorEnabled,trip_rate AS tripRate")
    .bind(attendanceStatus,accountStatus,twoFactorEnabled,tripRate??null,id).first();
}

export async function markNotificationsRead(id?:number) {
  await ensureBackOfficeSchema();
  if (id) await db().prepare("UPDATE notifications SET is_read=1 WHERE id=?").bind(id).run();
  else await db().prepare("UPDATE notifications SET is_read=1").run();
  return { success:true };
}

export async function updateRecord(resource:string,id:number,values:Record<string,unknown>) {
  await ensureBackOfficeSchema();

  if(resource==="client") {
    return db().prepare("UPDATE clients SET client_code=?,name=?,company=?,contact=?,email=?,balance=? WHERE id=? RETURNING id")
      .bind(values.clientCode,values.name,values.company??"",values.contact??"",values.email??"",Number(values.balance??0),id).first();
  }
  if(resource==="event") {
    return db().prepare("UPDATE events SET event_code=?,title=?,client_name=?,venue=?,event_date=?,status=?,crew_count=?,equipment_count=? WHERE id=? RETURNING id")
      .bind(values.eventCode,values.title,values.clientName,values.venue,values.eventDate,values.status,Number(values.crewCount??0),Number(values.equipmentCount??0),id).first();
  }
  if(resource==="quotation") {
    return db().prepare("UPDATE quotations SET quote_no=?,client_name=?,event_name=?,amount=?,status=? WHERE id=? RETURNING id")
      .bind(values.quoteNo,values.clientName,values.eventName,Number(values.amount??0),values.status,id).first();
  }
  if(resource==="finance") {
    return db().prepare("UPDATE finance_entries SET type=?,category=?,description=?,amount=?,event_name=?,entry_date=? WHERE id=? RETURNING id")
      .bind(values.type,values.category,values.description,Number(values.amount??0),values.eventName??"",values.entryDate,id).first();
  }
  if(resource==="warehouse") {
    return db().prepare("UPDATE warehouse_items SET item_code=?,name=?,category=?,stock=?,min_stock=?,unit=?,supplier=? WHERE id=? RETURNING id")
      .bind(values.itemCode,values.name,values.category,Number(values.stock??0),Number(values.minStock??0),values.unit??"pcs",values.supplier??"",id).first();
  }
  throw new Error("Unsupported update resource.");
}

export async function deleteRecord(resource:string,id:number) {
  await ensureBackOfficeSchema();
  const tables:Record<string,string> = {
    client:"clients",
    event:"events",
    quotation:"quotations",
    finance:"finance_entries",
    warehouse:"warehouse_items",
    attendance:"staff_attendance",
    trip:"staff_trips",
    payroll:"payroll_records"
  };
  const table=tables[resource];
  if(!table)throw new Error("Unsupported delete resource.");
  await db().prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
  return {success:true};
}

export async function createAttendance(input:{staffId:number;eventName:string;timeIn:string;lat?:number;lng?:number}) {
  await ensureBackOfficeSchema();
  return db().prepare("INSERT INTO staff_attendance (staff_id,event_name,time_in,time_in_lat,time_in_lng,status) VALUES (?,?,?,?,?,'open') RETURNING id")
    .bind(input.staffId,input.eventName,input.timeIn,input.lat??null,input.lng??null).first();
}

export async function timeOutAttendance(input:{id:number;timeOut:string;lat?:number;lng?:number}) {
  await ensureBackOfficeSchema();
  return db().prepare("UPDATE staff_attendance SET time_out=?,time_out_lat=?,time_out_lng=?,status='completed' WHERE id=? RETURNING id")
    .bind(input.timeOut,input.lat??null,input.lng??null,input.id).first();
}

export async function createTrip(input:{staffId:number;eventName:string;tripDate:string;allowance:number;overtimePay:number}) {
  await ensureBackOfficeSchema();
  const staff=await db().prepare("SELECT trip_rate AS tripRate FROM staff WHERE id=?").bind(input.staffId).first<{tripRate:number}>();
  if(!staff)throw new Error("Staff record not found.");
  return db().prepare("INSERT INTO staff_trips (staff_id,event_name,trip_date,trip_rate,allowance,overtime_pay,status) VALUES (?,?,?,?,?,?,'pending') RETURNING id")
    .bind(input.staffId,input.eventName,input.tripDate,staff.tripRate,input.allowance,input.overtimePay).first();
}

export async function approveTrip(id:number,approvedBy:string) {
  await ensureBackOfficeSchema();
  return db().prepare("UPDATE staff_trips SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=? RETURNING id")
    .bind(approvedBy,id).first();
}

export async function createPayroll(input:{staffId:number;periodStart:string;periodEnd:string}) {
  await ensureBackOfficeSchema();
  const totals=await db().prepare("SELECT COUNT(*) AS completedTrips,COALESCE(SUM(trip_rate),0) AS tripPay,COALESCE(SUM(allowance),0) AS allowance,COALESCE(SUM(overtime_pay),0) AS overtimePay FROM staff_trips WHERE staff_id=? AND status='approved' AND trip_date BETWEEN ? AND ?")
    .bind(input.staffId,input.periodStart,input.periodEnd)
    .first<{completedTrips:number;tripPay:number;allowance:number;overtimePay:number}>();

  const completedTrips=totals?.completedTrips??0;
  const tripPay=totals?.tripPay??0;
  const allowance=totals?.allowance??0;
  const overtimePay=totals?.overtimePay??0;
  const totalPay=tripPay+allowance+overtimePay;

  return db().prepare("INSERT INTO payroll_records (staff_id,period_start,period_end,completed_trips,trip_pay,allowance,overtime_pay,total_pay,status) VALUES (?,?,?,?,?,?,?,?,'draft') RETURNING id")
    .bind(input.staffId,input.periodStart,input.periodEnd,completedTrips,tripPay,allowance,overtimePay,totalPay).first();
}

export async function approvePayroll(id:number,approvedBy:string) {
  await ensureBackOfficeSchema();
  return db().prepare("UPDATE payroll_records SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=? RETURNING id")
    .bind(approvedBy,id).first();
}
