import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Total count
  const { count } = await sb.from("cities").select("*", { count: "exact", head: true });
  console.log("Total cities:", count);

  // Search Écija
  const { data: ecija } = await sb.from("cities").select("*").ilike("ascii_name", "%ecija%").limit(5);
  console.log("\nÉcija search:", JSON.stringify(ecija, null, 2));

  // Proximity search near Écija (37.54, -5.08)
  const { data: nearby } = await sb.rpc("search_cities_nearby", { p_lat: 37.54, p_lon: -5.08, p_limit: 3 });
  console.log("\nNearest to 37.54, -5.08:", JSON.stringify(nearby, null, 2));
}

main().catch(console.error);
