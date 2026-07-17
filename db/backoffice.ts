function db() {
  const runtime = globalThis as typeof globalThis & { __STAGE_ABILITY_ENV__?: { DB?: D1Database } };
  const database = runtime.__STAGE_ABILITY_ENV__?.DB;
  if (!database) throw new Error("Back-office database is not connected.");
  return database;
}

export async function ensureBackOfficeSchema() {
  const database = db();
  await database.batch([
    database.prepare("CREATE TABLE IF NOT EXISTS staff (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL, position TEXT NOT NULL, role TEXT NOT NULL, contact_number TEXT NOT NULL DEFAULT '', username TEXT NOT NULL UNIQUE, account_status TEXT NOT NULL DEFAULT 'active', attendance_status TEXT NOT NULL DEFAULT 'present', two_factor_enabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, client_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', contact TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', balance INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, client_name TEXT NOT NULL, venue TEXT NOT NULL, event_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', crew_count INTEGER NOT NULL DEFAULT 0, equipment_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE INDEX IF NOT EXISTS events_date_idx ON events (event_date)"),
    database.prepare("CREATE TABLE IF NOT EXISTS quotations (id INTEGER PRIMARY KEY AUTOINCREMENT, quote_no TEXT NOT NULL UNIQUE, client_name TEXT NOT NULL, event_name TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS finance_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, amount INTEGER NOT NULL, event_name TEXT NOT NULL DEFAULT '', entry_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE INDEX IF NOT EXISTS finance_date_idx ON finance_entries (entry_date)"),
    database.prepare("CREATE TABLE IF NOT EXISTS warehouse_items (id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, category TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0, min_stock INTEGER NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'pcs', supplier TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', is_read INTEGER NOT NULL DEFAULT 0, due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_code TEXT NOT NULL, issue TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', due_date TEXT NOT NULL, technician TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    database.prepare("CREATE INDEX IF NOT EXISTS maintenance_asset_idx ON maintenance (asset_code)"),
  ]);

  const seeded = await database.prepare("SELECT COUNT(*) AS count FROM staff").first<{ count: number }>();
  if ((seeded?.count ?? 0) > 0) return;
  await database.batch([
    database.prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,attendance_status,two_factor_enabled) VALUES ('SA-EMP-001','Stefan Alim','Operations Director','Super Admin','0917 857 5757','stefan','present',1)"),
    database.prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,attendance_status,two_factor_enabled) VALUES ('SA-EMP-002','Angela Reyes','Office Manager','Admin','0917 100 2201','angela','present',1)"),
    database.prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,attendance_status) VALUES ('SA-EMP-003','Mark Santos','Warehouse Lead','Warehouse Staff','0918 200 3302','mark.s','present')"),
    database.prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,attendance_status) VALUES ('SA-EMP-004','Carlo Mendoza','Senior Technician','Technician','0919 300 4403','carlo.m','on-site')"),
    database.prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,attendance_status) VALUES ('SA-EMP-005','Jessa Lim','Accounts Officer','Office Staff','0920 400 5504','jessa.l','present')"),
    database.prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,attendance_status) VALUES ('SA-EMP-006','Rico Dela Cruz','Event Crew','Crew','0921 500 6605','rico.d','on-site')"),
    database.prepare("INSERT INTO clients (client_code,name,company,contact,email,balance) VALUES ('CL-001','Maria Dela Cruz','Dela Cruz Family','0917 321 8890','maria@example.com',25000)"),
    database.prepare("INSERT INTO clients (client_code,name,company,contact,email,balance) VALUES ('CL-002','Paolo Garcia','Vertex Solutions Inc.','0918 671 2201','paolo@vertex.example',0)"),
    database.prepare("INSERT INTO clients (client_code,name,company,contact,email,balance) VALUES ('CL-003','Lea Ramos','St. Anne Academy','0919 881 5320','events@stanne.example',45000)"),
    database.prepare("INSERT INTO clients (client_code,name,company,contact,email,balance) VALUES ('CL-004','Arvin Chua','Northline Events','0920 117 4482','arvin@northline.example',18500)"),
    database.prepare("INSERT INTO events (event_code,title,client_name,venue,event_date,status,crew_count,equipment_count) VALUES ('EV-2607-01','Dela Cruz Wedding','Maria Dela Cruz','The Grand Pavilion, Antipolo','2026-07-20','confirmed',8,34)"),
    database.prepare("INSERT INTO events (event_code,title,client_name,venue,event_date,status,crew_count,equipment_count) VALUES ('EV-2607-02','Vertex Annual Conference','Vertex Solutions Inc.','SMX Convention Center','2026-07-23','preparation',12,58)"),
    database.prepare("INSERT INTO events (event_code,title,client_name,venue,event_date,status,crew_count,equipment_count) VALUES ('EV-2607-03','St. Anne Graduation','St. Anne Academy','School Quadrangle','2026-07-25','confirmed',7,29)"),
    database.prepare("INSERT INTO events (event_code,title,client_name,venue,event_date,status,crew_count,equipment_count) VALUES ('EV-2607-04','City Fiesta Concert','Northline Events','Municipal Grounds','2026-07-28','quotation',15,76)"),
    database.prepare("INSERT INTO quotations (quote_no,client_name,event_name,amount,status) VALUES ('QT-2026-071','Northline Events','City Fiesta Concert',185000,'pending')"),
    database.prepare("INSERT INTO quotations (quote_no,client_name,event_name,amount,status) VALUES ('QT-2026-072','Garcia Family','18th Birthday Celebration',78000,'sent')"),
    database.prepare("INSERT INTO quotations (quote_no,client_name,event_name,amount,status) VALUES ('QT-2026-073','Redwood College','Foundation Day',135000,'pending')"),
    database.prepare("INSERT INTO finance_entries (type,category,description,amount,event_name,entry_date) VALUES ('income','Event Payment','Vertex Conference down payment',120000,'Vertex Annual Conference','2026-07-15')"),
    database.prepare("INSERT INTO finance_entries (type,category,description,amount,event_name,entry_date) VALUES ('income','Event Payment','Dela Cruz Wedding progress billing',85000,'Dela Cruz Wedding','2026-07-12')"),
    database.prepare("INSERT INTO finance_entries (type,category,description,amount,event_name,entry_date) VALUES ('expense','Equipment Repair','Moving head motor replacement',12500,'','2026-07-14')"),
    database.prepare("INSERT INTO finance_entries (type,category,description,amount,event_name,entry_date) VALUES ('expense','Fuel & Logistics','Truck fuel and toll fees',8400,'St. Anne Graduation','2026-07-16')"),
    database.prepare("INSERT INTO finance_entries (type,category,description,amount,event_name,entry_date) VALUES ('income','Equipment Rental','LED wall rental balance',65000,'Corporate Product Launch','2026-07-08')"),
    database.prepare("INSERT INTO warehouse_items (item_code,name,category,stock,min_stock,unit,supplier) VALUES ('CON-XLR-001','XLR Connector Male','Consumables',18,20,'pcs','AudioParts PH')"),
    database.prepare("INSERT INTO warehouse_items (item_code,name,category,stock,min_stock,unit,supplier) VALUES ('CAB-XLR-010','XLR Cable 10m','Cables',42,15,'pcs','Pro Audio Supply')"),
    database.prepare("INSERT INTO warehouse_items (item_code,name,category,stock,min_stock,unit,supplier) VALUES ('TAP-GAF-001','Black Gaffer Tape','Consumables',7,10,'rolls','Event Essentials')"),
    database.prepare("INSERT INTO warehouse_items (item_code,name,category,stock,min_stock,unit,supplier) VALUES ('BAT-AA-001','AA Battery Pack','Consumables',34,12,'packs','PowerCell Trading')"),
    database.prepare("INSERT INTO warehouse_items (item_code,name,category,stock,min_stock,unit,supplier) VALUES ('CAB-DMX-005','DMX Cable 5m','Cables',28,10,'pcs','LightWorks Supply')"),
    database.prepare("INSERT INTO notifications (type,title,message,severity,due_date) VALUES ('stock','Low stock: XLR Connector','18 pieces remaining; minimum level is 20.','high','2026-07-18')"),
    database.prepare("INSERT INTO notifications (type,title,message,severity,due_date) VALUES ('maintenance','Maintenance due','SA-LGT-002 requires lens cleaning and calibration.','medium','2026-07-19')"),
    database.prepare("INSERT INTO notifications (type,title,message,severity,due_date) VALUES ('event','Upcoming event','Dela Cruz Wedding setup begins in 3 days.','info','2026-07-20')"),
    database.prepare("INSERT INTO notifications (type,title,message,severity,due_date) VALUES ('balance','Outstanding balance','St. Anne Academy has an outstanding balance of PHP 45,000.','high','2026-07-22')"),
    database.prepare("INSERT INTO maintenance (asset_code,issue,status,due_date,technician) VALUES ('SA-LGT-002','Lens cleaning and beam calibration','scheduled','2026-07-19','Carlo Mendoza')"),
    database.prepare("INSERT INTO maintenance (asset_code,issue,status,due_date,technician) VALUES ('SA-SPK-002','HF driver intermittent signal','in-progress','2026-07-21','Carlo Mendoza')"),
  ]);
}

export async function getBackOffice() {
  await ensureBackOfficeSchema();
  const database = db();
  const [staff, clients, events, quotations, finance, warehouse, notifications, maintenance, attendance, financial] = await Promise.all([
    database.prepare("SELECT id,employee_id AS employeeId,full_name AS fullName,position,role,contact_number AS contactNumber,username,account_status AS accountStatus,attendance_status AS attendanceStatus,two_factor_enabled AS twoFactorEnabled FROM staff ORDER BY id").all(),
    database.prepare("SELECT id,client_code AS clientCode,name,company,contact,email,balance FROM clients ORDER BY id").all(),
    database.prepare("SELECT id,event_code AS eventCode,title,client_name AS clientName,venue,event_date AS eventDate,status,crew_count AS crewCount,equipment_count AS equipmentCount FROM events ORDER BY event_date").all(),
    database.prepare("SELECT id,quote_no AS quoteNo,client_name AS clientName,event_name AS eventName,amount,status,created_at AS createdAt FROM quotations ORDER BY id DESC").all(),
    database.prepare("SELECT id,type,category,description,amount,event_name AS eventName,entry_date AS entryDate FROM finance_entries ORDER BY entry_date DESC,id DESC").all(),
    database.prepare("SELECT id,item_code AS itemCode,name,category,stock,min_stock AS minStock,unit,supplier FROM warehouse_items ORDER BY category,name").all(),
    database.prepare("SELECT id,type,title,message,severity,is_read AS isRead,due_date AS dueDate,created_at AS createdAt FROM notifications ORDER BY is_read,id DESC").all(),
    database.prepare("SELECT id,asset_code AS assetCode,issue,status,due_date AS dueDate,technician FROM maintenance ORDER BY due_date").all(),
    database.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN attendance_status IN ('present','on-site') THEN 1 ELSE 0 END) AS present FROM staff WHERE account_status='active'").first<{ total:number; present:number }>(),
    database.prepare("SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expenses FROM finance_entries WHERE substr(entry_date,1,7)='2026-07'").first<{ income:number; expenses:number }>(),
  ]);
  return {
    staff: staff.results, clients: clients.results, events: events.results, quotations: quotations.results,
    finance: finance.results, warehouse: warehouse.results, notifications: notifications.results, maintenance: maintenance.results,
    metrics: { attendancePresent: attendance?.present ?? 0, attendanceTotal: attendance?.total ?? 0, monthlyRevenue: financial?.income ?? 0, monthlyExpenses: financial?.expenses ?? 0 },
  };
}

type NewClient = { clientCode:string; name:string; company:string; contact:string; email:string; balance:number };
type NewEvent = { eventCode:string; title:string; clientName:string; venue:string; eventDate:string; status:string; crewCount:number; equipmentCount:number };
type NewStaff = { employeeId:string; fullName:string; position:string; role:string; contactNumber:string; username:string; accountStatus:string; attendanceStatus:string; twoFactorEnabled:number };
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
  return db().prepare("INSERT INTO staff (employee_id,full_name,position,role,contact_number,username,account_status,attendance_status,two_factor_enabled) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id,employee_id AS employeeId,full_name AS fullName,position,role,contact_number AS contactNumber,username,account_status AS accountStatus,attendance_status AS attendanceStatus,two_factor_enabled AS twoFactorEnabled")
    .bind(input.employeeId,input.fullName,input.position,input.role,input.contactNumber,input.username,input.accountStatus,input.attendanceStatus,input.twoFactorEnabled).first();
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
  const item=await db().prepare("SELECT id,stock FROM warehouse_items WHERE item_code=?").bind(itemCode).first<{id:number;stock:number}>();
  if(!item) throw new Error("Warehouse item not found.");
  if(item.stock+delta<0) throw new Error("Stock cannot be below zero.");
  return db().prepare("UPDATE warehouse_items SET stock=stock+? WHERE id=? RETURNING id,item_code AS itemCode,name,category,stock,min_stock AS minStock,unit,supplier")
    .bind(delta,item.id).first();
}

export async function markNotificationsRead(id?:number) {
  await ensureBackOfficeSchema();
  if(id) await db().prepare("UPDATE notifications SET is_read=1 WHERE id=?").bind(id).run();
  else await db().prepare("UPDATE notifications SET is_read=1").run();
  return {success:true};
}

export async function updateStaffStatus(id:number,attendanceStatus:string,accountStatus:string,twoFactorEnabled:number) {
  await ensureBackOfficeSchema();
  return db().prepare("UPDATE staff SET attendance_status=?,account_status=?,two_factor_enabled=? WHERE id=? RETURNING id,employee_id AS employeeId,full_name AS fullName,position,role,contact_number AS contactNumber,username,account_status AS accountStatus,attendance_status AS attendanceStatus,two_factor_enabled AS twoFactorEnabled")
    .bind(attendanceStatus,accountStatus,twoFactorEnabled,id).first();
}
