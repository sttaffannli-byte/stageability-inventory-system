import {
  adjustWarehouseStock,
  approvePayroll,
  approveTrip,
  createAttendance,
  createClient,
  createEvent,
  createFinanceEntry,
  createPayroll,
  createQuotation,
  createStaff,
  createTrip,
  deleteRecord,
  getBackOffice,
  markNotificationsRead,
  timeOutAttendance,
  updateRecord,
  updateStaffStatus,
} from "../../../../db/backoffice";
import {
  authError,
  isAdmin,
  passwordPolicy,
  requireUser,
  resetCredentialForStaff,
  setPassword,
} from "../../../../db/auth";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const data = await getBackOffice();

    if (await isAdmin(user)) return Response.json(data);

    return Response.json({
      ...data,
      staff: data.staff.filter((s) => Number((s as { id: number }).id) === user.id),
      clients: [],
      quotations: [],
      finance: [],
      notifications: [],
      maintenance: [],
      attendanceRecords: data.attendanceRecords.filter(
        (r) => Number((r as { staffId: number }).staffId) === user.id,
      ),
      trips: data.trips.filter(
        (r) => Number((r as { staffId: number }).staffId) === user.id,
      ),
      payroll: data.payroll.filter(
        (r) => Number((r as { staffId: number }).staffId) === user.id,
      ),
      metrics: {
        attendancePresent: 1,
        attendanceTotal: 1,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
      },
    });
  } catch (error) {
    return authError(error);
  }
}

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const required = (body: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => text(body[key]));

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const resource = text(body.resource);
    await requireUser(request, resource === "stock" ? undefined : "admin");

    if (resource === "client") {
      if (!required(body, ["clientCode", "name", "contact"])) {
        return Response.json(
          { error: "Complete the client code, name, and contact number." },
          { status: 400 },
        );
      }
      return Response.json({
        record: await createClient({
          clientCode: text(body.clientCode).toUpperCase(),
          name: text(body.name),
          company: text(body.company),
          contact: text(body.contact),
          email: text(body.email),
          balance: num(body.balance),
        }),
      });
    }

    if (resource === "event") {
      if (!required(body, ["eventCode", "title", "clientName", "venue", "eventDate"])) {
        return Response.json({ error: "Complete all event fields." }, { status: 400 });
      }
      return Response.json({
        record: await createEvent({
          eventCode: text(body.eventCode).toUpperCase(),
          title: text(body.title),
          clientName: text(body.clientName),
          venue: text(body.venue),
          eventDate: text(body.eventDate),
          status: text(body.status) || "confirmed",
          crewCount: num(body.crewCount),
          equipmentCount: num(body.equipmentCount),
        }),
      });
    }

    if (resource === "staff") {
      if (
        !required(body, [
          "employeeId",
          "fullName",
          "position",
          "role",
          "contactNumber",
          "username",
          "temporaryPassword",
        ])
      ) {
        return Response.json(
          { error: "Complete all staff fields, including a temporary password." },
          { status: 400 },
        );
      }

      const policy = passwordPolicy(text(body.temporaryPassword));
      if (policy) return Response.json({ error: policy }, { status: 400 });

      const record = await createStaff({
        employeeId: text(body.employeeId).toUpperCase(),
        fullName: text(body.fullName),
        position: text(body.position),
        role: text(body.role),
        contactNumber: text(body.contactNumber),
        username: text(body.username),
        accountStatus: text(body.accountStatus) || "active",
        attendanceStatus: text(body.attendanceStatus) || "present",
        twoFactorEnabled: num(body.twoFactorEnabled),
        tripRate: num(body.tripRate),
      });

      if (!record) throw new Error("Staff account could not be created.");
      await setPassword(Number((record as { id: number }).id), text(body.temporaryPassword));

      return Response.json({ record });
    }

    if (resource === "quotation") {
      if (!required(body, ["quoteNo", "clientName", "eventName"])) {
        return Response.json({ error: "Complete all quotation fields." }, { status: 400 });
      }
      return Response.json({
        record: await createQuotation({
          quoteNo: text(body.quoteNo).toUpperCase(),
          clientName: text(body.clientName),
          eventName: text(body.eventName),
          amount: num(body.amount),
          status: text(body.status) || "pending",
        }),
      });
    }

    if (resource === "finance") {
      if (!required(body, ["type", "category", "description", "entryDate"])) {
        return Response.json({ error: "Complete all finance fields." }, { status: 400 });
      }
      return Response.json({
        record: await createFinanceEntry({
          type: text(body.type),
          category: text(body.category),
          description: text(body.description),
          amount: num(body.amount),
          eventName: text(body.eventName),
          entryDate: text(body.entryDate),
        }),
      });
    }

    if (resource === "stock") {
      if (!required(body, ["itemCode"])) {
        return Response.json({ error: "Item code is required." }, { status: 400 });
      }
      const record = await adjustWarehouseStock(text(body.itemCode).toUpperCase(), num(body.delta));
      if (!record) return Response.json({ error: "Warehouse item not found." }, { status: 404 });
      return Response.json({ record });
    }

    if (resource === "attendance") {
      if (!required(body, ["staffId", "timeIn"])) {
        return Response.json({ error: "Staff and time in are required." }, { status: 400 });
      }
      return Response.json({
        record: await createAttendance({
          staffId: num(body.staffId),
          eventName: text(body.eventName),
          timeIn: text(body.timeIn),
          lat: body.lat == null ? undefined : num(body.lat),
          lng: body.lng == null ? undefined : num(body.lng),
        }),
      });
    }

    if (resource === "trip") {
      if (!required(body, ["staffId", "eventName", "tripDate"])) {
        return Response.json({ error: "Staff, event, and trip date are required." }, { status: 400 });
      }
      return Response.json({
        record: await createTrip({
          staffId: num(body.staffId),
          eventName: text(body.eventName),
          tripDate: text(body.tripDate),
          allowance: num(body.allowance),
          overtimePay: num(body.overtimePay),
        }),
      });
    }

    if (resource === "payroll") {
      if (!required(body, ["staffId", "periodStart", "periodEnd"])) {
        return Response.json({ error: "Staff and payroll period are required." }, { status: 400 });
      }
      return Response.json({
        record: await createPayroll({
          staffId: num(body.staffId),
          periodStart: text(body.periodStart),
          periodEnd: text(body.periodEnd),
        }),
      });
    }

    return Response.json({ error: "Unsupported resource." }, { status: 400 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const resource = text(body.resource);
    await requireUser(request, "admin");

    if (resource === "notification") {
      return Response.json(await markNotificationsRead(body.id ? num(body.id) : undefined));
    }

    if (resource === "staff-status") {
      return Response.json({
        record: await updateStaffStatus(
          num(body.id),
          text(body.attendanceStatus),
          text(body.accountStatus),
          num(body.twoFactorEnabled),
          body.tripRate == null ? undefined : num(body.tripRate),
        ),
      });
    }

    if (resource === "attendance-timeout") {
      return Response.json({
        record: await timeOutAttendance({
          id: num(body.id),
          timeOut: text(body.timeOut),
          lat: body.lat == null ? undefined : num(body.lat),
          lng: body.lng == null ? undefined : num(body.lng),
        }),
      });
    }

    if (resource === "trip-approve") {
      return Response.json({
        record: await approveTrip(num(body.id), text(body.approvedBy) || "Admin"),
      });
    }

    if (resource === "payroll-approve") {
      return Response.json({
        record: await approvePayroll(num(body.id), text(body.approvedBy) || "Admin"),
      });
    }

    if (resource === "reset-password") {
      const policy = passwordPolicy(text(body.temporaryPassword));
      if (policy) return Response.json({ error: policy }, { status: 400 });
      await resetCredentialForStaff(num(body.id), text(body.temporaryPassword));
      return Response.json({ success: true });
    }

    if (["client", "event", "quotation", "finance", "warehouse"].includes(resource)) {
      return Response.json({
        record: await updateRecord(resource, num(body.id), body),
      });
    }

    return Response.json({ error: "Unsupported update." }, { status: 400 });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await requireUser(request, "admin");

    const resource = text(body.resource);
    const id = num(body.id);

    if (!resource || !id) {
      return Response.json({ error: "Resource and ID are required." }, { status: 400 });
    }

    return Response.json(await deleteRecord(resource, id));
  } catch (error) {
    return authError(error);
  }
}
