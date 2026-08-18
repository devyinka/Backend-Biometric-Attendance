import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import "dotenv/config";

const supabaseUrl = process.env.SUPA_BASE_URL as string;

const publishableKey = process.env.PUBLISHABLE_SUPA_BASE_API_KEY as string;

const adminKey = process.env.SUPA_BASE_API_KEY as string;

const transport = WebSocket as unknown as any;

export const Database = createClient(supabaseUrl, publishableKey, {
  realtime: {
    transport,
  },
});

export const AdminDatabase = createClient(supabaseUrl, adminKey, {
  realtime: {
    transport,
  },
});
