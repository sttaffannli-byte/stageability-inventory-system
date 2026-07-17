type InventoryEnv = { DB?: D1Database };

declare global {
  var __STAGE_ABILITY_ENV__: InventoryEnv | undefined;
}

const samples = [
  ["SA-SPK-001", "Active Speaker 15-inch", "Sound"], ["SA-SPK-002", "Active Speaker 15-inch", "Sound"],
  ["SA-SUB-001", "18-inch Subwoofer", "Sound"], ["SA-MIX-001", "Digital Mixing Console", "Sound"],
  ["SA-LGT-001", "Moving Head Beam", "Lighting"], ["SA-LGT-002", "Moving Head Beam", "Lighting"],
  ["SA-PAR-001", "LED PAR Light", "Lighting"], ["SA-PAR-002", "LED PAR Light", "Lighting"],
  ["SA-LED-001", "LED Wall Processor", "LED Wall"], ["SA-TRS-001", "Inverted U Truss Set", "Truss"],
  ["SA-GEN-001", "Generator Set", "Power"], ["SA-DRM-001", "Drum Set", "Band Equipment"],
] as const;

function db() {
  const database = globalThis.__STAGE_ABILITY_ENV__?.DB;
  if (!database) throw new Error("Inventory database is not connected.");
  return database;
}

export async function seedIfEmpty() {
  const database = db();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      asset_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      current_event TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS assets_status_idx ON assets (status)"),
    database.prepare(`CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      asset_id INTEGER NOT NULL REFERENCES assets(id),
      action TEXT NOT NULL,
      event_name TEXT NOT NULL DEFAULT '',
      operator_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS movements_asset_idx ON movements (asset_id)"),
    database.prepare("CREATE INDEX IF NOT EXISTS movements_created_idx ON movements (created_at)"),
  ]);
  const count = await database.prepare("SELECT COUNT(*) AS count FROM assets").first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;
  await database.batch(samples.map(([assetCode, name, category]) => database.prepare("INSERT OR IGNORE INTO assets (asset_code, name, category) VALUES (?, ?, ?)").bind(assetCode, name, category)));
}

export async function getInventory() {
  await seedIfEmpty();
  const database = db();
  const [assetsResult, movementsResult, summaryResult, returnedResult] = await Promise.all([
    database.prepare("SELECT id, asset_code AS assetCode, name, category, status, current_event AS currentEvent, updated_at AS updatedAt FROM assets ORDER BY category, name, asset_code").all(),
    database.prepare("SELECT m.id, a.asset_code AS assetCode, a.name AS assetName, m.action, m.event_name AS eventName, m.operator_name AS operatorName, m.created_at AS createdAt FROM movements m JOIN assets a ON a.id = m.asset_id ORDER BY m.id DESC LIMIT 24").all(),
    database.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) AS available, SUM(CASE WHEN status='pulled_out' THEN 1 ELSE 0 END) AS pulledOut FROM assets").first<{ total: number; available: number; pulledOut: number }>(),
    database.prepare("SELECT COUNT(*) AS count FROM movements WHERE action='return' AND date(created_at)=date('now')").first<{ count: number }>(),
  ]);
  return { items: assetsResult.results, movements: movementsResult.results, summary: { total: summaryResult?.total ?? 0, available: summaryResult?.available ?? 0, pulledOut: summaryResult?.pulledOut ?? 0, returnedToday: returnedResult?.count ?? 0 } };
}

export async function addAsset(input: { assetCode: string; name: string; category: string }) {
  const database = db();
  const result = await database.prepare("INSERT INTO assets (asset_code, name, category) VALUES (?, ?, ?) RETURNING id, asset_code AS assetCode, name, category, status, current_event AS currentEvent, updated_at AS updatedAt").bind(input.assetCode, input.name, input.category).first();
  return result;
}

export async function recordScan(input: { assetCode: string; action: "pullout" | "return"; eventName: string; operatorName: string }) {
  const database = db();
  const asset = await database.prepare("SELECT id, asset_code AS assetCode, name, status, current_event AS currentEvent FROM assets WHERE asset_code = ?").bind(input.assetCode).first<{ id: number; assetCode: string; name: string; status: string; currentEvent: string | null }>();
  if (!asset) throw new Error("Hindi rehistrado ang barcode na ito.");
  if (input.action === "pullout" && asset.status === "pulled_out") throw new Error(`Naka-pullout na ang gamit na ito${asset.currentEvent ? ` para sa ${asset.currentEvent}` : ""}.`);
  if (input.action === "return" && asset.status === "available") throw new Error("Nasa warehouse na ang gamit na ito.");
  const nextStatus = input.action === "pullout" ? "pulled_out" : "available";
  const nextEvent = input.action === "pullout" ? input.eventName : null;
  await database.batch([
    database.prepare("UPDATE assets SET status = ?, current_event = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(nextStatus, nextEvent, asset.id),
    database.prepare("INSERT INTO movements (asset_id, action, event_name, operator_name) VALUES (?, ?, ?, ?)").bind(asset.id, input.action, input.action === "pullout" ? input.eventName : (asset.currentEvent ?? "Warehouse return"), input.operatorName),
  ]);
  return { ...asset, status: nextStatus, currentEvent: nextEvent };
}
