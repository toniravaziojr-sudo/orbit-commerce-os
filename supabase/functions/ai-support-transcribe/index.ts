import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface TranscribeRequest {
  queue_item_id?: string;
  attachment_id?: string;
  audio_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[ai-support-transcribe] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured", code: "AI_NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { queue_item_id, attachment_id, audio_url }: TranscribeRequest = await req.json();

    // Determinar o attachment a processar
    let targetAttachmentId = attachment_id;
    let queueItem: any = null;

    if (queue_item_id) {
      // Buscar item da fila
      const { data: qItem, error: qError } = await supabase
        .from("ai_media_queue")
        .select("*")
        .eq("id", queue_item_id)
        .single();

      if (qError || !qItem) {
        return new Response(
          JSON.stringify({ success: false, error: "Queue item not found", code: "QUEUE_ITEM_NOT_FOUND" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      queueItem = qItem;
      targetAttachmentId = qItem.attachment_id;

      // Verificar idempotência - já processado?
      if (qItem.status === "done") {
        console.log(`[ai-support-transcribe] Already processed: ${queue_item_id}`);
        return new Response(
          JSON.stringify({ success: true, already_processed: true, result: qItem.result }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Marcar como processing
      await supabase
        .from("ai_media_queue")
        .update({ 
          status: "processing", 
          last_attempt_at: new Date().toISOString(),
          attempts: (qItem.attempts || 0) + 1
        })
        .eq("id", queue_item_id);
    }

    // Buscar attachment
    let audioUrl = audio_url;
    let tenantId: string | null = null;

    if (targetAttachmentId && !audioUrl) {
      const { data: attachment, error: attError } = await supabase
        .from("message_attachments")
        .select("*, messages!inner(tenant_id)")
        .eq("id", targetAttachmentId)
        .single();

      if (attError || !attachment) {
        if (queueItem) {
          await supabase
            .from("ai_media_queue")
            .update({ status: "failed", error_message: "Attachment not found" })
            .eq("id", queue_item_id);
        }
        return new Response(
          JSON.stringify({ success: false, error: "Attachment not found", code: "ATTACHMENT_NOT_FOUND" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      audioUrl = attachment.file_url;
      tenantId = attachment.messages?.tenant_id;
    }

    if (!audioUrl) {
      if (queueItem) {
        await supabase
          .from("ai_media_queue")
          .update({ status: "failed", error_message: "No audio URL" })
          .eq("id", queue_item_id);
      }
      return new Response(
        JSON.stringify({ success: false, error: "No audio URL provided", code: "NO_AUDIO_URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-support-transcribe] Downloading audio: ${audioUrl?.substring(0, 100)}...`);

    // Baixar o arquivo de áudio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`[ai-support-transcribe] Failed to download audio: ${audioResponse.status}`);
      if (queueItem) {
        const nextRetry = new Date(Date.now() + 30 * Math.pow(2, queueItem.attempts || 0) * 1000);
        await supabase
          .from("ai_media_queue")
          .update({ 
            status: queueItem.attempts >= queueItem.max_attempts ? "failed" : "queued",
            error_message: `Download failed: ${audioResponse.status}`,
            next_retry_at: nextRetry.toISOString()
          })
          .eq("id", queue_item_id);
      }
      return new Response(
        JSON.stringify({ success: false, error: "Failed to download audio", code: "DOWNLOAD_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioSize = audioBuffer.byteLength;
    
    // Estimar duração (aproximado: 16kbps para áudio comprimido)
    const estimatedDurationSeconds = Math.round(audioSize / 2000); // ~2KB por segundo para OGG/Opus
    
    console.log(`[ai-support-transcribe] Audio size: ${audioSize} bytes, estimated duration: ${estimatedDurationSeconds}s`);

    // Determinar extensão do arquivo pela URL ou content-type
    let fileExtension = "ogg";
    const contentType = audioResponse.headers.get("content-type") || "";
    if (contentType.includes("mpeg") || audioUrl.endsWith(".mp3")) {
      fileExtension = "mp3";
    } else if (contentType.includes("wav") || audioUrl.endsWith(".wav")) {
      fileExtension = "wav";
    } else if (contentType.includes("m4a") || audioUrl.endsWith(".m4a")) {
      fileExtension = "m4a";
    }

    // Chamar OpenAI Whisper
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer]), `audio.${fileExtension}`);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${OPENAI_API_KEY}` 
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai-support-transcribe] Whisper API error: ${response.status}`, errorText);
      
      if (queueItem) {
        const nextRetry = new Date(Date.now() + 30 * Math.pow(2, queueItem.attempts || 0) * 1000);
        await supabase
          .from("ai_media_queue")
          .update({ 
            status: queueItem.attempts >= queueItem.max_attempts ? "failed" : "queued",
            error_message: `Whisper error: ${response.status}`,
            next_retry_at: nextRetry.toISOString()
          })
          .eq("id", queue_item_id);
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Transcription failed", code: "TRANSCRIPTION_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const transcription = data.text || "";

    console.log(`[ai-support-transcribe] Transcription complete: ${transcription.substring(0, 100)}...`);

    const result = {
      transcription,
      duration_seconds: estimatedDurationSeconds,
      language: "pt",
      transcribed_at: new Date().toISOString()
    };

    // Atualizar attachment com transcrição
    if (targetAttachmentId) {
      await supabase
        .from("message_attachments")
        .update({
          transcription,
          metadata: {
            transcription_details: result
          }
        })
        .eq("id", targetAttachmentId);
    }

    // Atualizar fila se veio dela
    if (queueItem) {
      await supabase
        .from("ai_media_queue")
        .update({ 
          status: "done", 
          result,
          processed_at: new Date().toISOString()
        })
        .eq("id", queue_item_id);
    }

    // Registrar uso
    if (tenantId) {
      // Custo Whisper: ~$0.006/minuto
      const costCents = Math.max(1, Math.ceil(estimatedDurationSeconds / 60 * 0.6));
      
      await supabase.rpc("record_ai_usage", {
        p_tenant_id: tenantId,
        p_usage_cents: costCents,
      });

      await supabase.rpc("increment_ai_metrics", {
        p_tenant_id: tenantId,
        p_audio_count: 1,
        p_audio_seconds: estimatedDurationSeconds,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        result
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ai-support-transcribe] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
