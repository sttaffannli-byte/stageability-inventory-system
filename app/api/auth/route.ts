import { authError, currentUser, firstTimeSetup, login, logout, setupRequired } from "../../../db/auth";

export async function GET(request:Request){
  try{return Response.json({user:await currentUser(request),setupRequired:await setupRequired()});}
  catch(error){return authError(error)}
}

export async function POST(request:Request){
  try{
    const body=await request.json() as {action?:string;username?:string;password?:string;pin?:string;activationCode?:string};
    const result=body.action==="setup"
      ?await firstTimeSetup(request,body.username??"",body.activationCode??"",body.pin??"")
      :await login(request,body.username??"",body.password??"");
    return Response.json({user:result.user,expiresAt:result.expiresAt},{headers:{"Set-Cookie":result.cookie,"Cache-Control":"no-store"}});
  }catch(error){return authError(error)}
}

export async function DELETE(request:Request){
  try{return Response.json({success:true},{headers:{"Set-Cookie":await logout(request),"Cache-Control":"no-store"}});}
  catch(error){return authError(error)}
}
