import { createClient } from "@supabase/supabase-js";
import "dotenv/config";


export const Database = createClient(
  process.env.SUPA_BASE_URL as string,
  process.env.PUBLISHABLE_SUPA_BASE_API_KEY as string,
);
