import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses Row Level Security, so this must never be imported into a client
// component. It exists for one job: serving a public gallery by slug to a
// visitor who is not signed in and owns nothing.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
