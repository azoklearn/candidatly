import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { ExternalApiError } from "@/lib/errors";
import { searchPlaces, type PlaceType } from "@/lib/geocoding/geocode";
import { logger } from "@/lib/logger";
import { allowAction } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const TYPES: readonly PlaceType[] = ["municipality", "housenumber", "street", "locality"];

/** Address autocomplete for signed-in users. The typed address is never logged. */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ places: [], error: "not_configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims)
    return NextResponse.json({ places: [], error: "unauthorized" }, { status: 401 });

  if (!(await allowAction(supabase, "geocode"))) {
    return NextResponse.json({ places: [], error: "rate_limited" }, { status: 429 });
  }
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const requestedType = request.nextUrl.searchParams.get("type");
  const type = TYPES.find((value) => value === requestedType);
  try {
    const places = await searchPlaces(query, { limit: 5, type, signal: request.signal });
    return NextResponse.json({ places }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    logger.warn("geocode_failed", {
      status: error instanceof ExternalApiError ? error.status : null,
    });
    return NextResponse.json({ places: [], error: "unavailable" }, { status: 502 });
  }
}
