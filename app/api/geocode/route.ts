import { NextResponse, type NextRequest } from "next/server";

import { allowAnonymousAction } from "@/lib/anon-rate-limit";
import { isSupabaseConfigured } from "@/lib/env";
import { ExternalApiError } from "@/lib/errors";
import { searchPlaces, type PlaceType } from "@/lib/geocoding/geocode";
import { logger } from "@/lib/logger";
import { allowAction } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const TYPES: readonly PlaceType[] = ["municipality", "housenumber", "street", "locality"];

/**
 * Address autocomplete of the questionnaire, open to visitors since the account comes at
 * the end (docs/QUESTIONS.md C91). Visitors are limited by a hash of their address, signed-in
 * users by their account. The typed address is never logged.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ places: [], error: "not_configured" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const allowed = data?.claims
    ? await allowAction(supabase, "geocode")
    : await allowAnonymousAction("geocode", request.headers);
  if (!allowed) {
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
