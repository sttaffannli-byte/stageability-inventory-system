import { recordScan } from "../../../db/inventory";
import { authError, requireUser } from "../../../db/auth";

export async function POST(request: Request) {
  try {
    const user=await requireUser(request);
    const body = await request.json() as { assetCode?: string; action?: string; eventName?: string; operatorName?: string };
    const assetCode = body.assetCode?.trim().toUpperCase() ?? "";
    const action = body.action;
    const eventName = body.eventName?.trim() ?? "";
    const operatorName = user.fullName;
    if (!assetCode || (action !== "pullout" && action !== "return")) return Response.json({ error: "Invalid barcode o action." }, { status: 400 });
    if (action === "pullout" && !eventName) return Response.json({ error: "Ilagay muna ang event o project name bago mag-pullout." }, { status: 400 });
    const asset = await recordScan({ assetCode, action, eventName, operatorName });
    return Response.json({ asset });
  } catch (error) {
    const message=error instanceof Error?error.message:"Scan error";
    if(message==="AUTH_REQUIRED"||message==="ACCESS_DENIED")return authError(error);
    return Response.json({error:message},{status:400});
  }
}
