// =============================================
// BIRTHDAY DAILY TRIGGER
// Cron 08:00 BRT (11:00 UTC). For each tenant, find customers whose birthday is today
// and enqueue events_inbox with event_type='customer.birthday'. process-events then
// matches notification_rules with rule_type='customer_birthday' and email automation
// flows with trigger_type='customer_birthday'.
// =============================================
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1.0.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // BRT date today (America/Sao_Paulo = UTC-3 fixed for our purposes)
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 3600 * 1000);
  const mm = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(brt.getUTCDate()).padStart(2, "0");
  const todayKey = `${mm}-${dd}`;
  const isoDate = brt.toISOString().substring(0, 10);

  console.log(`[birthday-daily-trigger][${VERSION}] Today MM-DD = ${todayKey}`);

  let enqueued = 0;
  let errors = 0;

  try {
    // Paginated scan of customers whose birth_date matches today's MM-DD
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: rows, error } = await supabase
        .from("customers")
        .select("id, tenant_id, email, full_name, phone, birth_date")
        .not("birth_date", "is", null)
        .is("deleted_at", null)
        .range(from, from + PAGE - 1);

      if (error) { console.error(error); break; }
      if (!rows || rows.length === 0) break;

      for (const c of rows) {
        const bd = String(c.birth_date);
        if (bd.length < 10) continue;
        const cmm = bd.substring(5, 7);
        const cdd = bd.substring(8, 10);
        if (`${cmm}-${cdd}` !== todayKey) continue;

        const idem = `birthday:${c.tenant_id}:${c.id}:${isoDate}`;
        const { error: insErr } = await supabase
          .from("events_inbox")
          .insert({
            tenant_id: c.tenant_id,
            provider: "internal",
            event_type: "customer.birthday",
            idempotency_key: idem,
            occurred_at: new Date().toISOString(),
            payload_normalized: {
              customer_id: c.id,
              customer_email: c.email,
              customer_phone: c.phone,
              customer_name: c.full_name,
              customer_first_name: (c.full_name || "").split(" ")[0] || c.full_name,
              birth_date: c.birth_date,
              event_date: isoDate,
            },
          });
        if (insErr) {
          // Unique violation = already enqueued today (idempotent)
          if (!String(insErr.message || "").includes("duplicate")) {
            console.error(`[birthday] insert failed for ${c.id}:`, insErr.message);
            errors++;
          }
        } else {
          enqueued++;
        }
      }

      if (rows.length < PAGE) break;
      from += PAGE;
      if (from > 200000) break;
    }

    return new Response(JSON.stringify({ success: true, version: VERSION, enqueued, errors, date: isoDate }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
