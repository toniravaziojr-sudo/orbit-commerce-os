import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const VISION_PROMPT = `Analise esta imagem no contexto de atendimento ao cliente de e-commerce.
Descreva:
1. O que você vê (produto, embalagem, documento, comprovante, erro, defeito)
2. Detalhes relevantes para atendimento (defeitos visíveis, códigos, valores, texto legível)
3. Sugestão de ação para o atendente

Responda em JSON:
{
  "category": "product|damage|tracking|receipt|error|package|screenshot|document|other",
  "description": "descrição objetiva do que está na imagem",
  "extracted_text": "qualquer texto visível na imagem",
  "visible_issues": ["lista de problemas visíveis, se houver"],
  "action_suggestion": "o que o atendente deve fazer com base nesta imagem"
}`;

interface VisionRequest {
  queue_item_id?: string;
  attachment_id?: string;
  image_url?: string;
}

interface VisionResult {
  category: string;
  description: string;
  extracted_text: string;
  visible_issues: string[];
  action_suggestion: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[ai-support-vision] OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured", code: "AI_NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { queue_item_id, attachment_id, image_url }: VisionRequest = await req.json();

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
        console.log(`[ai-support-vision] Already processed: ${queue_item_id}`);
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
    let imageUrl = image_url;
    let tenantId: string | null = null;

    if (targetAttachmentId && !imageUrl) {
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

      imageUrl = attachment.file_url;
      tenantId = attachment.messages?.tenant_id;
    }

    if (!imageUrl) {
      if (queueItem) {
        await supabase
          .from("ai_media_queue")
          .update({ status: "failed", error_message: "No image URL" })
          .eq("id", queue_item_id);
      }
      return new Response(
        JSON.stringify({ success: false, error: "No image URL provided", code: "NO_IMAGE_URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ai-support-vision] Analyzing image: ${imageUrl?.substring(0, 100)}...`);

    // Chamar GPT-5.2 Vision
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o", // GPT-5.2 Vision equivalent
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: VISION_PROMPT },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ai-support-vision] OpenAI API error: ${response.status}`, errorText);
      
      if (queueItem) {
        const nextRetry = new Date(Date.now() + 30 * Math.pow(2, queueItem.attempts || 0) * 1000);
        await supabase
          .from("ai_media_queue")
          .update({ 
            status: queueItem.attempts >= queueItem.max_attempts ? "failed" : "queued",
            error_message: `OpenAI error: ${response.status}`,
            next_retry_at: nextRetry.toISOString()
          })
          .eq("id", queue_item_id);
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Vision analysis failed", code: "VISION_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const tokensUsed = data.usage?.total_tokens || 0;

    // Parsear resultado JSON
    let visionResult: VisionResult;
    try {
      // Extrair JSON do conteúdo (pode ter markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        visionResult = JSON.parse(jsonMatch[0]);
      } else {
        visionResult = {
          category: "other",
          description: content,
          extracted_text: "",
          visible_issues: [],
          action_suggestion: "Verificar imagem manualmente"
        };
      }
    } catch (parseError) {
      console.error("[ai-support-vision] Failed to parse JSON:", parseError);
      visionResult = {
        category: "other",
        description: content,
        extracted_text: "",
        visible_issues: [],
        action_suggestion: "Verificar imagem manualmente"
      };
    }

    console.log(`[ai-support-vision] Analysis complete. Category: ${visionResult.category}`);

    // Atualizar attachment com resultado
    if (targetAttachmentId) {
      const { data: currentAttachment } = await supabase
        .from("message_attachments")
        .select("metadata")
        .eq("id", targetAttachmentId)
        .single();

      await supabase
        .from("message_attachments")
        .update({
          metadata: {
            ...(currentAttachment?.metadata || {}),
            vision_analysis: visionResult,
            vision_analyzed_at: new Date().toISOString()
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
          result: visionResult,
          processed_at: new Date().toISOString()
        })
        .eq("id", queue_item_id);
    }

    // Registrar uso
    if (tenantId) {
      // Custo aproximado: ~$0.00765/imagem (high detail)
      const costCents = 1; // 1 centavo por análise
      
      await supabase.rpc("record_ai_usage", {
        p_tenant_id: tenantId,
        p_usage_cents: costCents,
      });

      await supabase.rpc("increment_ai_metrics", {
        p_tenant_id: tenantId,
        p_images: 1,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: visionResult,
        tokens_used: tokensUsed
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ai-support-vision] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
