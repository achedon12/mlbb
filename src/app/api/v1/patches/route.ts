import { patches } from "@/lib/data";
import { responseApi } from "@/lib/api";

/** Recorded versions, from the most recent to the oldest. */
export const dynamic = "force-static";

export function GET() {
  return responseApi(patches, { total: patches.length });
}
