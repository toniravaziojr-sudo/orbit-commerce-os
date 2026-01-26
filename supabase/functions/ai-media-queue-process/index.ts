import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const BATCH_SIZE = 10;
const BACKOFF_BASE_SECONDS = 30;

interface QueueItem {
  id: string;
  tenant_id: string;
  message_id: string;
  attachment_id: string;
  process_type: "vision" | "transcription";
  status: string;
  attempts: number;
  max_attempts: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || BATCH_SIZE;

    console.log(`[ai-media-queue-process] Starting with limit=${limit}`);

    // Buscar itens pendentes (queued ou failed com retry due)
    const { data: pendingItems, error: fetchError } = await supabase
      .from("ai_media_queue")
      .select("*")
      .or("status.eq.queued,status.eq.failed")
      .lte("next_retry_at", new Date().toISOString())
      .lt("attempts", 3) // Menos que max_attempts
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchError) {
      console.error("[ai-media-queue-process] Error fetching queue:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log("[ai-media-queue-process] No pending items");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending items",
          stats: { processed: 0, succeeded: 0, failed: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-media-queue-process] Found ${pendingItems.length} pending items`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Processar cada item
    for (const item of pendingItems as QueueItem[]) {
      try {
        console.log(`[ai-media-queue-process] Processing ${item.process_type} for attachment ${item.attachment_id}`);

        // Chamar a função apropriada
        const functionName = item.process_type === "vision" 
          ? "ai-support-vision" 
          : "ai-support-transcribe";

        const { data: funcResult, error: funcError } = await supabase.functions.invoke(functionName, {
          body: { queue_item_id: item.id }
        });

        if (funcError) {
          console.error(`[ai-media-queue-process] Function error for ${item.id}:`, funcError);
          results.errors.push(`${item.id}: ${funcError.message}`);
          results.failed++;
        } else if (funcResult?.success) {
          console.log(`[ai-media-queue-process] Success for ${item.id}`);
          results.succeeded++;
        } else if (funcResult?.already_processed) {
          console.log(`[ai-media-queue-process] Already processed: ${item.id}`);
          results.skipped++;
        } else {
          console.error(`[ai-media-queue-process] Processing failed for ${item.id}:`, funcResult?.error);
          results.errors.push(`${item.id}: ${funcResult?.error || "Unknown error"}`);
          results.failed++;
        }

        results.processed++;

      } catch (itemError) {
        console.error(`[ai-media-queue-process] Error processing ${item.id}:`, itemError);
        results.errors.push(`${item.id}: ${itemError instanceof Error ? itemError.message : "Unknown error"}`);
        results.failed++;
        results.processed++;

        // Atualizar item com erro e retry
        const nextRetry = new Date(Date.now() + BACKOFF_BASE_SECONDS * Math.pow(2, item.attempts) * 1000);
        await supabase
          .from("ai_media_queue")
          .update({ 
            status: item.attempts + 1 >= item.max_attempts ? "failed" : "queued",
            error_message: itemError instanceof Error ? itemError.message : "Unknown error",
            next_retry_at: nextRetry.toISOString(),
            attempts: item.attempts + 1,
            last_attempt_at: new Date().toISOString()
          })
          .eq("id", item.id);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[ai-media-queue-process] Completed in ${duration}ms:`, results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats: results,
        duration_ms: duration
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ai-media-queue-process] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
