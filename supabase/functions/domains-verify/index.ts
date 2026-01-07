import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// DNS-over-HTTPS endpoint (Cloudflare)
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

interface VerifyRequest {
  tenant_id: string;
  domain_id: string;
}

interface TXTRecord {
  data: string;
}

interface DNSResponse {
  Answer?: TXTRecord[];
  Status: number;
}

async function lookupTXTRecords(domain: string): Promise<string[]> {
  const txtHost = `_cc-verify.${domain}`;
  
  console.log(`[domains-verify] Looking up TXT records for: ${txtHost}`);
  
  try {
    const response = await fetch(
      `${DOH_ENDPOINT}?name=${encodeURIComponent(txtHost)}&type=TXT`,
      {
        headers: {
          Accept: "application/dns-json",
        },
      }
    );

    if (!response.ok) {
      console.error(`[domains-verify] DoH request failed: ${response.status}`);
      return [];
    }

    const data: DNSResponse = await response.json();
    console.log(`[domains-verify] DNS response status: ${data.Status}`);
    
    if (!data.Answer || data.Answer.length === 0) {
      console.log(`[domains-verify] No TXT records found for ${txtHost}`);
      return [];
    }

    // Extract TXT record values (remove quotes if present)
    const records = data.Answer.map((record) => 
      record.data.replace(/^"|"$/g, "").trim()
    );
    
    console.log(`[domains-verify] Found TXT records:`, records);
    return records;
  } catch (error) {
    console.error(`[domains-verify] DNS lookup error:`, error);
    return [];
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, domain_id }: VerifyRequest = await req.json();

    if (!tenant_id || !domain_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id and domain_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[domains-verify] Verifying domain ${domain_id} for tenant ${tenant_id}`);

    // Fetch domain record
    const { data: domainRecord, error: fetchError } = await supabase
      .from("tenant_domains")
      .select("*")
      .eq("id", domain_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (fetchError || !domainRecord) {
      console.error(`[domains-verify] Domain not found:`, fetchError);
      return new Response(
        JSON.stringify({ error: "Domain not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { domain, verification_token } = domainRecord;
    const expectedValue = `cc-verify=${verification_token}`;

    console.log(`[domains-verify] Looking for TXT value: ${expectedValue}`);

    // Lookup TXT records
    const txtRecords = await lookupTXTRecords(domain);
    const found = txtRecords.some((record) => record === expectedValue);

    let newStatus: "pending" | "verified" | "failed";
    let lastError: string | null = null;

    if (found) {
      newStatus = "verified";
      console.log(`[domains-verify] Verification SUCCESS for ${domain}`);
    } else if (txtRecords.length === 0) {
      newStatus = "pending";
      lastError = "TXT record not found. DNS may still be propagating.";
      console.log(`[domains-verify] No TXT records found for ${domain}`);
    } else {
      newStatus = "failed";
      lastError = `TXT record found but value mismatch. Expected: ${expectedValue}`;
      console.log(`[domains-verify] Verification FAILED for ${domain}: wrong value`);
    }

    // Update domain record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      last_checked_at: new Date().toISOString(),
      last_error: lastError,
    };

    if (newStatus === "verified") {
      updateData.verified_at = new Date().toISOString();
      updateData.last_error = null;
    }

    const { error: updateError } = await supabase
      .from("tenant_domains")
      .update(updateData)
      .eq("id", domain_id);

    if (updateError) {
      console.error(`[domains-verify] Update error:`, updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update domain status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        verified: newStatus === "verified",
        error: lastError,
        checked_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[domains-verify] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
