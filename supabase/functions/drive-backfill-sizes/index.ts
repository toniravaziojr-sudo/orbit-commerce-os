import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { tenant_id, batch_size = 100 } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get files with NULL size_bytes that have a URL in metadata
    const { data: files, error } = await supabase
      .from("files")
      .select("id, metadata, storage_path, original_name")
      .eq("tenant_id", tenant_id)
      .eq("is_folder", false)
      .is("size_bytes", null)
      .limit(batch_size);

    if (error) throw error;

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const file of files || []) {
      try {
        const meta = file.metadata as Record<string, any> | null;
        const url = meta?.url;

        if (!url) {
          // Try to build URL from bucket + storage_path
          const bucket = meta?.bucket;
          if (!bucket || !file.storage_path) {
            errors.push(`${file.id}: no url or bucket info`);
            failed++;
            continue;
          }
        }

        const targetUrl = meta?.url || 
          `${supabaseUrl}/storage/v1/object/public/${meta?.bucket}/${file.storage_path}`;

        const headRes = await fetch(targetUrl, { method: "HEAD" });

        if (!headRes.ok) {
          errors.push(`${file.id}: HEAD ${headRes.status}`);
          failed++;
          continue;
        }

        const contentLength = headRes.headers.get("content-length");
        if (!contentLength) {
          errors.push(`${file.id}: no content-length header`);
          failed++;
          continue;
        }

        const sizeBytes = parseInt(contentLength, 10);
        if (isNaN(sizeBytes)) {
          failed++;
          continue;
        }

        const { error: updateErr } = await supabase
          .from("files")
          .update({ size_bytes: sizeBytes })
          .eq("id", file.id);

        if (updateErr) {
          errors.push(`${file.id}: update error: ${updateErr.message}`);
          failed++;
        } else {
          updated++;
        }
      } catch (e) {
        errors.push(`${file.id}: ${e.message}`);
        failed++;
      }
    }

    // Get updated totals
    const { data: totals } = await supabase
      .from("files")
      .select("size_bytes")
      .eq("tenant_id", tenant_id)
      .eq("is_folder", false);

    const totalBytes = (totals || []).reduce((sum, f) => sum + (f.size_bytes || 0), 0);
    const stillMissing = (totals || []).filter(f => !f.size_bytes).length;

    return new Response(JSON.stringify({
      processed: (files || []).length,
      updated,
      failed,
      still_missing: stillMissing,
      total_size_mb: Math.round(totalBytes / 1024 / 1024 * 100) / 100,
      total_size_gb: Math.round(totalBytes / 1024 / 1024 / 1024 * 1000) / 1000,
      errors: errors.slice(0, 20),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
