import { adjustWarehouseStock, createClient, createEvent, createFinanceEntry, createQuotation, createStaff, getBackOffice, markNotificationsRead, updateStaffStatus } from "../../../db/backoffice";
import { authError, isAdmin, passwordPolicy, requireUser, resetCredentialForStaff, setPassword } from "../../../db/auth";

export async function GET(request:Request) {
  try {
    const user=await requireUser(request),data=await getBackOffice();
    if(await isAdmin(user))return Response.json(data);
    return Response.json({...data,staff:data.staff.filter((s)=>Number((s as {id:number}).id)===user.id),clients:[],quotations:[],finance:[],notifications:[],maintenance:[],metrics:{attendancePresent:1,attendanceTotal:1,monthlyRevenue:0,monthlyExpenses:0}});
  }
  catch (error) { return authError(error); }
}

const text=(value:unknown)=>String(value??"").trim();
const num=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
const required=(body:Record<string,unknown>,keys:string[])=>keys.every(key=>text(body[key]));

export async function POST(request:Request) {
  try {
    const body=await request.json() as Record<string,unknown>;
    const resource=text(body.resource);
    await requireUser(request,resource!=="stock");
    if(resource==="client") {
      if(!required(body,["clientCode","name","contact"])) return Response.json({error:"Complete the client code, name, and contact number."},{status:400});
      return Response.json({record:await createClient({clientCode:text(body.clientCode).toUpperCase(),name:text(body.name),company:text(body.company),contact:text(body.contact),email:text(body.email),balance:num(body.balance)})},{status:201});
    }
    if(resource==="event") {
      if(!required(body,["eventCode","title","clientName","venue","eventDate"])) return Response.json({error:"Complete the event code, title, client, venue, and date."},{status:400});
      return Response.json({record:await createEvent({eventCode:text(body.eventCode).toUpperCase(),title:text(body.title),clientName:text(body.clientName),venue:text(body.venue),eventDate:text(body.eventDate),status:text(body.status)||"confirmed",crewCount:num(body.crewCount),equipmentCount:num(body.equipmentCount)})},{status:201});
    }
    if(resource==="staff") {
      if(!required(body,["employeeId","fullName","position","role","contactNumber","username","temporaryPassword"])) return Response.json({error:"Complete all staff fields, including a temporary password."},{status:400});
      const policy=passwordPolicy(text(body.temporaryPassword));
      if(policy)return Response.json({error:policy},{status:400});
      const record=await createStaff({employeeId:text(body.employeeId).toUpperCase(),fullName:text(body.fullName),position:text(body.position),role:text(body.role),contactNumber:text(body.contactNumber),username:text(body.username),accountStatus:text(body.accountStatus)||"active",attendanceStatus:text(body.attendanceStatus)||"present",twoFactorEnabled:body.twoFactorEnabled?1:0});
      if(!record||typeof (record as {id?:unknown}).id!=="number")throw new Error("Staff account could not be created.");
      await setPassword((record as {id:number}).id,text(body.temporaryPassword));
      return Response.json({record},{status:201});
    }
    if(resource==="quotation") {
      if(!required(body,["quoteNo","clientName","eventName","amount"])) return Response.json({error:"Complete the quotation number, client, event, and amount."},{status:400});
      return Response.json({record:await createQuotation({quoteNo:text(body.quoteNo).toUpperCase(),clientName:text(body.clientName),eventName:text(body.eventName),amount:num(body.amount),status:text(body.status)||"pending"})},{status:201});
    }
    if(resource==="finance") {
      if(!required(body,["type","category","description","amount","entryDate"])) return Response.json({error:"Complete all required transaction fields."},{status:400});
      return Response.json({record:await createFinanceEntry({type:text(body.type),category:text(body.category),description:text(body.description),amount:num(body.amount),eventName:text(body.eventName),entryDate:text(body.entryDate)})},{status:201});
    }
    if(resource==="stock") {
      if(!required(body,["itemCode","delta"])||num(body.delta)===0) return Response.json({error:"Select an item and enter a non-zero adjustment."},{status:400});
      return Response.json({record:await adjustWarehouseStock(text(body.itemCode).toUpperCase(),num(body.delta))});
    }
    return Response.json({error:"Unsupported back-office action."},{status:400});
  } catch(error) {
    const message=error instanceof Error?error.message:"Back-office error";
    if(message==="AUTH_REQUIRED"||message==="ACCESS_DENIED")return authError(error);
    return Response.json({error:message.includes("UNIQUE")?"That ID or username is already in use.":message},{status:400});
  }
}

export async function PATCH(request:Request) {
  try {
    await requireUser(request,true);
    const body=await request.json() as Record<string,unknown>;
    const resource=text(body.resource);
    if(resource==="notification") return Response.json(await markNotificationsRead(body.id?num(body.id):undefined));
    if(resource==="staff") {
      if(!num(body.id)) return Response.json({error:"Staff record not found."},{status:400});
      const record=await updateStaffStatus(num(body.id),text(body.attendanceStatus)||"present",text(body.accountStatus)||"active",body.twoFactorEnabled?1:0);
      if(text(body.temporaryPassword))await resetCredentialForStaff(num(body.id),text(body.temporaryPassword));
      return Response.json({record});
    }
    return Response.json({error:"Unsupported update action."},{status:400});
  } catch(error) { return authError(error); }
}
