/**
 * ERCOT data client
 *
 * Auth: Azure AD B2C ROPC flow
 *   Token URL: https://ercotb2c.b2clogin.com/ercotb2c.onmicrosoft.com/B2C_1_PUBAPI-ROPC-FLOW/oauth2/v2.0/token
 *   Required env vars: ERCOT_API_KEY, ERCOT_USERNAME, ERCOT_PASSWORD
 *
 * Falls back to realistic seed data if credentials are missing or API fails.
 *
 * Price endpoint:
 *   GET /api/public-reports/np4-190-cd/dam_stlmnt_pnt_prices
 *   Headers: Ocp-Apim-Subscription-Key, Authorization: Bearer <id_token>
 */

export const ERCOT_NODES = ["HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_HOUSTON"] as const;
export type ErcotNode = (typeof ERCOT_NODES)[number];

export interface LmpRecord {
  node: string;
  intervalStart: Date;
  pricePerMwh: number;
  priceType: "DAM" | "RTM";
}

// ─── ERCOT OAuth (ROPC flow) ──────────────────────────────────────────────

const ERCOT_CLIENT_ID = "fec253ea-0d06-4272-a5e6-b478baeecd70";
const ERCOT_TOKEN_BASE =
  "https://ercotb2c.b2clogin.com/ercotb2c.onmicrosoft.com/B2C_1_PUBAPI-ROPC-FLOW/oauth2/v2.0/token";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getErcotIdToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  // ERCOT expects credentials as query params on a POST (per their docs)
  const url =
    ERCOT_TOKEN_BASE +
    "?username=" + encodeURIComponent(process.env.ERCOT_USERNAME!) +
    "&password=" + encodeURIComponent(process.env.ERCOT_PASSWORD!) +
    "&grant_type=password" +
    "&scope=" + encodeURIComponent(`openid ${ERCOT_CLIENT_ID} offline_access`) +
    "&client_id=" + ERCOT_CLIENT_ID +
    "&response_type=id_token";

  const res = await fetch(url, { method: "POST" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ERCOT auth failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.id_token) {
    throw new Error(`ERCOT auth: no id_token in response — ${JSON.stringify(json)}`);
  }

  cachedToken = { value: json.id_token, expiresAt: now + 55 * 60 * 1000 };
  return json.id_token;
}

// ─── Real ERCOT API ───────────────────────────────────────────────────────

const ERCOT_BASE = "https://api.ercot.com/api/public-reports";

async function fetchFromErcot(node: string, date: string): Promise<LmpRecord[]> {
  const idToken = await getErcotIdToken();

  const url = new URL(`${ERCOT_BASE}/np4-190-cd/dam_stlmnt_pnt_prices`);
  url.searchParams.set("deliveryDateFrom", date);
  url.searchParams.set("deliveryDateTo", date);
  url.searchParams.set("settlementPoint", node);
  url.searchParams.set("size", "25");
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Ocp-Apim-Subscription-Key": process.env.ERCOT_API_KEY!,
      "Accept": "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`ERCOT data error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();

  // ERCOT returns rows as arrays: [deliveryDate, hourEnding, settlementPoint, price, DSTFlag]
  return (json.data ?? []).map((row: unknown[]) => {
    const hourEnding = row[1] as string; // e.g. "01:00"
    const hour = parseInt(hourEnding.split(":")[0], 10);
    const intervalStart = new Date(
      `${date}T${String(hour - 1).padStart(2, "0")}:00:00Z`
    );
    return {
      node,
      intervalStart,
      pricePerMwh: Number(row[3]),
      priceType: "DAM" as const,
    };
  });
}

// ─── Seed data fallback ───────────────────────────────────────────────────

function generateSeedPrices(node: string, date: string): LmpRecord[] {
  const nodeOffset: Record<string, number> = {
    HB_NORTH: 0,
    HB_SOUTH: -3,
    HB_WEST: -8,
    HB_HOUSTON: 2,
  };
  const offset = nodeOffset[node] ?? 0;

  const shape = [
    0.45, 0.40, 0.38, 0.37, 0.38, 0.45,
    0.70, 0.90, 1.00, 0.95, 0.88, 0.85,
    0.80, 0.82, 0.85, 0.90, 1.00, 1.20,
    1.50, 1.60, 1.40, 1.10, 0.80, 0.60,
  ];

  const baseMwh = 42 + offset;
  const peakMwh = 160 + offset;

  return shape.map((multiplier, hour) => {
    const price =
      baseMwh + ((peakMwh - baseMwh) * (multiplier - 0.37)) / (1.6 - 0.37);
    const noise = price * (Math.random() * 0.1 - 0.05);
    const intervalStart = new Date(
      `${date}T${String(hour).padStart(2, "0")}:00:00Z`
    );
    return {
      node,
      intervalStart,
      pricePerMwh: Math.round((price + noise) * 100) / 100,
      priceType: "DAM" as const,
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function fetchDamPrices(
  nodes: string[],
  date: string
): Promise<{ records: LmpRecord[]; source: "ercot_api" | "seed" }> {
  const hasCredentials =
    process.env.ERCOT_API_KEY &&
    process.env.ERCOT_USERNAME &&
    process.env.ERCOT_PASSWORD;

  if (hasCredentials) {
    try {
      const results = await Promise.all(
        nodes.map((node) => fetchFromErcot(node, date))
      );
      return { records: results.flat(), source: "ercot_api" };
    } catch (err) {
      console.warn("[ercot] API failed, falling back to seed:", err);
    }
  }

  return {
    records: nodes.flatMap((node) => generateSeedPrices(node, date)),
    source: "seed",
  };
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
