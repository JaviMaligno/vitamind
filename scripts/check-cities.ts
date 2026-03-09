import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  const { data, error } = await supabase.from("cities").select("geoname_id").limit(1);

  if (error) {
    console.log("Table status:", error.message);
  } else {
    const { count } = await supabase.from("cities").select("*", { count: "exact", head: true });
    console.log("Cities table exists. Total rows:", count);
  }
}

main().catch(console.error);
