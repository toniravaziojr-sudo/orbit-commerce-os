import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre Sync Questions
 * 
 * Sincroniza perguntas e mensagens do ML para marketplace_messages.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { tenantId, questionId, fullSync } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão ativa
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão ML não encontrada ou inativa" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenExpired = connection.expires_at && new Date(connection.expires_at) < new Date();
    if (tokenExpired) {
      return new Response(
        JSON.stringify({ success: false, error: "Token ML expirado", code: "token_expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = connection.access_token;
    const sellerId = connection.external_user_id;

    let questions: any[] = [];

    if (questionId) {
      // Buscar pergunta específica
      const qUrl = `https://api.mercadolibre.com/questions/${questionId}`;
      const qRes = await fetch(qUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (qRes.ok) {
        questions = [await qRes.json()];
      }
    } else {
      // Buscar perguntas recentes
      const limit = fullSync ? 50 : 20;
      const status = fullSync ? "" : "&status=UNANSWERED";
      const qUrl = `https://api.mercadolibre.com/questions/search?seller_id=${sellerId}&sort_fields=date_created&sort_types=DESC&limit=${limit}${status}`;
      
      const qRes = await fetch(qUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!qRes.ok) {
        const errorText = await qRes.text();
        console.error("[meli-sync-questions] Search error:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar perguntas do ML" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await qRes.json();
      questions = data.questions || [];
    }

    console.log(`[meli-sync-questions] Syncing ${questions.length} questions for tenant ${tenantId}`);

    let synced = 0;
    let errors = 0;

    for (const q of questions) {
      try {
        // Mapear status
        const statusMap: Record<string, string> = {
          UNANSWERED: "unanswered",
          ANSWERED: "answered",
          CLOSED_UNANSWERED: "closed",
          UNDER_REVIEW: "unanswered",
          DELETED: "deleted",
        };

        // Buscar info do item se disponível
        let itemTitle = "";
        let itemThumbnail = "";
        if (q.item_id) {
          try {
            const itemRes = await fetch(`https://api.mercadolibre.com/items/${q.item_id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (itemRes.ok) {
              const item = await itemRes.json();
              itemTitle = item.title || "";
              itemThumbnail = item.thumbnail || "";
            }
          } catch {
            // Ignore item fetch errors
          }
        }

        const messageData = {
          tenant_id: tenantId,
          connection_id: connection.id,
          marketplace: "mercadolivre",
          external_message_id: q.id.toString(),
          external_item_id: q.item_id?.toString() || null,
          message_type: "question",
          status: statusMap[q.status] || "unanswered",
          buyer_id: q.from?.id?.toString() || null,
          buyer_nickname: null, // ML não retorna nickname na pergunta
          question_text: q.text || "",
          answer_text: q.answer?.text || null,
          answered_at: q.answer?.date_created ? new Date(q.answer.date_created).toISOString() : null,
          item_title: itemTitle,
          item_thumbnail: itemThumbnail,
          received_at: q.date_created ? new Date(q.date_created).toISOString() : new Date().toISOString(),
          metadata: {
            meli_question_id: q.id,
            meli_item_id: q.item_id,
            meli_status: q.status,
            meli_date_created: q.date_created,
          },
        };

        // Upsert mensagem
        const { error: upsertError } = await supabase
          .from("marketplace_messages")
          .upsert(messageData, {
            onConflict: "tenant_id,marketplace,external_message_id",
          });

        if (upsertError) {
          console.error(`[meli-sync-questions] Upsert error for question ${q.id}:`, upsertError);
          errors++;
        } else {
          synced++;
        }

      } catch (qError) {
        console.error(`[meli-sync-questions] Error processing question:`, qError);
        errors++;
      }
    }

    // Atualizar last_sync_at
    await supabase
      .from("marketplace_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);

    // Log
    await supabase
      .from("marketplace_sync_logs")
      .insert({
        connection_id: connection.id,
        tenant_id: tenantId,
        sync_type: "questions",
        status: errors === 0 ? "completed" : (synced > 0 ? "partial" : "failed"),
        processed_count: questions.length,
        created_count: synced,
        failed_count: errors,
      });

    return new Response(
      JSON.stringify({ success: true, synced, errors, total: questions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meli-sync-questions] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
