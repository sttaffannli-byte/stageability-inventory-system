type AuthEnv = { DB?: D1Database; BOOTSTRAP_CODE?: string };

import { ensureBackOfficeSchema } from "./backoffice";

declare global {
  var __STAGE_ABILITY_ENV__: AuthEnv | undefined;
}

export type AuthUser = {
  id:number;
  employeeId:string;
  fullName:string;
  position:string;
  role:string;
  username:string;
};

const encoder=new TextEncoder();
const ADMIN_ROLES=["Super Admin","Admin"];

function database(){
  const db=globalThis.__STAGE_ABILITY_ENV__?.DB;
  if(!db) throw new Error("Authentication database is not connected.");
  return db;
}

function bytesToHex(bytes:Uint8Array){return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join("")}
function hexToBytes(hex:string){const bytes=new Uint8Array(hex.length/2);for(let i=0;i<bytes.length;i++)bytes[i]=Number.parseInt(hex.slice(i*2,i*2+2),16);return bytes}
function randomHex(length=32){const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return bytesToHex(bytes)}

async function sha256(value:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value))))}
async function derivePassword(password:string,saltHex:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:hexToBytes(saltHex),iterations:100000},key,256);
  return bytesToHex(new Uint8Array(bits));
}

function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
function cookieValue(request:Request,name:string){const cookie=request.headers.get("cookie")??"";for(const part of cookie.split(";")){const [key,...rest]=part.trim().split("=");if(key===name)return decodeURIComponent(rest.join("="))}return ""}
function sessionCookie(request:Request,token:string,maxAge:number){const secure=new URL(request.url).protocol==="https:"?"; Secure":"";return `sa_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`}

export async function ensureAuthSchema(){
  await ensureBackOfficeSchema();
  const db=database();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS auth_credentials (staff_id INTEGER PRIMARY KEY REFERENCES staff(id),password_hash TEXT,password_salt TEXT,password_updated_at TEXT,failed_attempts INTEGER NOT NULL DEFAULT 0,locked_until TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY,staff_id INTEGER NOT NULL REFERENCES staff(id),expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS auth_sessions_staff_idx ON auth_sessions(staff_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at)"),
  ]);
}

export function passwordPolicy(password:string){
  if(password.length<10)return "Password must contain at least 10 characters.";
  if(!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password))return "Password must include uppercase, lowercase, and a number.";
  return "";
}

export function pinPolicy(pin:string){return /^\d{6}$/.test(pin)?"":"Admin PIN must be exactly 6 numbers."}

export async function setupRequired(){
  await ensureAuthSchema();
  const row=await database().prepare("SELECT c.password_hash AS passwordHash FROM staff s LEFT JOIN auth_credentials c ON c.staff_id=s.id WHERE s.username='stefan'").first<{passwordHash:string|null}>();
  return !row?.passwordHash;
}

async function storeCredential(staffId:number,secret:string,onlyIfEmpty=false){
  await ensureAuthSchema();
  if(onlyIfEmpty){const existing=await database().prepare("SELECT password_hash AS passwordHash FROM auth_credentials WHERE staff_id=?").bind(staffId).first<{passwordHash:string|null}>();if(existing?.passwordHash)throw new Error("This account has already been activated.")}
  const salt=randomHex(16),hash=await derivePassword(secret,salt);
  await database().prepare("INSERT INTO auth_credentials (staff_id,password_hash,password_salt,password_updated_at,failed_attempts,locked_until) VALUES (?,?,?,CURRENT_TIMESTAMP,0,NULL) ON CONFLICT(staff_id) DO UPDATE SET password_hash=excluded.password_hash,password_salt=excluded.password_salt,password_updated_at=CURRENT_TIMESTAMP,failed_attempts=0,locked_until=NULL").bind(staffId,hash,salt).run();
}

export async function setPassword(staffId:number,password:string,onlyIfEmpty=false){const policy=passwordPolicy(password);if(policy)throw new Error(policy);await storeCredential(staffId,password,onlyIfEmpty)}
export async function setAdminPin(staffId:number,pin:string,onlyIfEmpty=false){const policy=pinPolicy(pin);if(policy)throw new Error(policy);await storeCredential(staffId,pin,onlyIfEmpty)}
export async function resetCredentialForStaff(staffId:number,secret:string){
  await ensureAuthSchema();
  const staff=await database().prepare("SELECT role,username FROM staff WHERE id=?").bind(staffId).first<{role:string;username:string}>();
  if(!staff)throw new Error("Staff account was not found.");
  if(staff.role==="Super Admin"&&staff.username==="stefan")return setAdminPin(staffId,secret);
  return setPassword(staffId,secret);
}

async function createSession(request:Request,staffId:number){
  await ensureAuthSchema();
  const token=randomHex(32),tokenHash=await sha256(token),expiresAt=new Date(Date.now()+8*60*60*1000).toISOString();
  await database().batch([
    database().prepare("DELETE FROM auth_sessions WHERE expires_at<=?").bind(new Date().toISOString()),
    database().prepare("INSERT INTO auth_sessions (token_hash,staff_id,expires_at) VALUES (?,?,?)").bind(tokenHash,staffId,expiresAt),
  ]);
  return {cookie:sessionCookie(request,token,8*60*60),expiresAt};
}

export async function firstTimeSetup(request:Request,username:string,activationCode:string,pin:string){
  await ensureAuthSchema();
  const expected=globalThis.__STAGE_ABILITY_ENV__?.BOOTSTRAP_CODE??"";
  if(!expected||!safeEqual(activationCode.trim(),expected))throw new Error("Invalid activation code.");
  if(username.trim().toLowerCase()!=="stefan")throw new Error("Only the first Super Admin can activate the system.");
  const staff=await database().prepare("SELECT id,employee_id AS employeeId,full_name AS fullName,position,role,username FROM staff WHERE username='stefan' AND role='Super Admin' AND account_status='active'").first<AuthUser>();
  if(!staff)throw new Error("Super Admin account was not found.");
  await setAdminPin(staff.id,pin,true);
  const session=await createSession(request,staff.id);
  return {user:staff,...session};
}

export async function login(request:Request,username:string,password:string){
  await ensureAuthSchema();
  const row=await database().prepare("SELECT s.id,s.employee_id AS employeeId,s.full_name AS fullName,s.position,s.role,s.username,s.account_status AS accountStatus,c.password_hash AS passwordHash,c.password_salt AS passwordSalt,c.failed_attempts AS failedAttempts,c.locked_until AS lockedUntil FROM staff s LEFT JOIN auth_credentials c ON c.staff_id=s.id WHERE lower(s.username)=lower(?)").bind(username.trim()).first<AuthUser&{accountStatus:string;passwordHash:string|null;passwordSalt:string|null;failedAttempts:number;lockedUntil:string|null}>();
  if(!row||row.accountStatus!=="active"||!row.passwordHash||!row.passwordSalt)throw new Error("Invalid username, PIN, or password.");
  if(row.lockedUntil&&new Date(row.lockedUntil).getTime()>Date.now())throw new Error("Account temporarily locked. Try again later.");
  const hash=await derivePassword(password,row.passwordSalt);
  if(!safeEqual(hash,row.passwordHash)){
    const attempts=(row.failedAttempts??0)+1,locked=attempts>=5?new Date(Date.now()+15*60*1000).toISOString():null;
    await database().prepare("UPDATE auth_credentials SET failed_attempts=?,locked_until=? WHERE staff_id=?").bind(attempts,locked,row.id).run();
    throw new Error(attempts>=5?"Account locked for 15 minutes after repeated failed attempts.":"Invalid username, PIN, or password.");
  }
  await database().prepare("UPDATE auth_credentials SET failed_attempts=0,locked_until=NULL WHERE staff_id=?").bind(row.id).run();
  const session=await createSession(request,row.id);
  const user:AuthUser={id:row.id,employeeId:row.employeeId,fullName:row.fullName,position:row.position,role:row.role,username:row.username};
  return {user,...session};
}

export async function currentUser(request:Request):Promise<AuthUser|null>{
  await ensureAuthSchema();
  const token=cookieValue(request,"sa_session");if(!token)return null;
  const tokenHash=await sha256(token),now=new Date().toISOString();
  const user=await database().prepare("SELECT s.id,s.employee_id AS employeeId,s.full_name AS fullName,s.position,s.role,s.username FROM auth_sessions x JOIN staff s ON s.id=x.staff_id WHERE x.token_hash=? AND x.expires_at>? AND s.account_status='active'").bind(tokenHash,now).first<AuthUser>();
  if(!user)return null;
  await database().prepare("UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?").bind(tokenHash).run();
  return user;
}

export async function requireUser(request:Request,adminOnly=false){
  const user=await currentUser(request);
  if(!user)throw new Error("AUTH_REQUIRED");
  if(adminOnly&&!ADMIN_ROLES.includes(user.role))throw new Error("ACCESS_DENIED");
  return user;
}

export function authError(error:unknown){
  const message=error instanceof Error?error.message:"Authentication error";
  if(message==="AUTH_REQUIRED")return Response.json({error:"Please log in to continue."},{status:401});
  if(message==="ACCESS_DENIED")return Response.json({error:"Your staff role cannot access this function."},{status:403});
  return Response.json({error:message},{status:400});
}

export async function logout(request:Request){
  await ensureAuthSchema();
  const token=cookieValue(request,"sa_session");if(token)await database().prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return sessionCookie(request,"",0);
}

export async function isAdmin(user:AuthUser){return ADMIN_ROLES.includes(user.role)}
