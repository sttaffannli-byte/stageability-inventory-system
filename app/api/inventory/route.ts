import { addAsset, deleteAsset, getInventory } from "../../../db/inventory";
import { authError, requireUser } from "../../../db/auth";

export async function GET(request:Request) {
  try { await requireUser(request); return Response.json(await getInventory()); }
  catch (error) { return authError(error); }
}

export async function POST(request: Request) {
  try {
    await requireUser(request,true);
    const body = await request.json() as { assetCode?: string; name?: string; category?: string };
    const assetCode = body.assetCode?.trim().toUpperCase() ?? "";
    const name = body.name?.trim() ?? "";
    const category = body.category?.trim() ?? "";
    if (!assetCode || !name || !category) return Response.json({ error: "Kumpletuhin ang asset code, pangalan, at category." }, { status: 400 });
    const asset = await addAsset({ assetCode, name, category });
    return Response.json({ asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory error";
    if(message==="AUTH_REQUIRED"||message==="ACCESS_DENIED")return authError(error);
    return Response.json({ error: message.includes("UNIQUE") ? "May equipment nang gumagamit ng asset code na ito." : message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireUser(request,true);
    const body = await request.json() as { id?: number };
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error:"Invalid equipment ID." }, { status:400 });
    return Response.json({ asset:await deleteAsset(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory error";
    if(message==="AUTH_REQUIRED"||message==="ACCESS_DENIED")return authError(error);
    return Response.json({ error:message }, { status:400 });
  }
}
