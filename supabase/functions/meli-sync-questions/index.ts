import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre Sync Questions
 * 
 * Sincroniza perguntas e mensagens do ML para o sistema de atendimento unificado.
 * Cria conversas e mensagens no módulo de Atendimento (não em tabela separada).
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

    // Buscar ou criar channel_account para mercadolivre
    let channelAccount = await getOrCreateChannelAccount(supabase, tenantId, connection);

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
        // Buscar info do item se disponível
        let itemTitle = "";
        if (q.item_id) {
          try {
            const itemRes = await fetch(`https://api.mercadolibre.com/items/${q.item_id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (itemRes.ok) {
              const item = await itemRes.json();
              itemTitle = item.title || "";
            }
          } catch {
            // Ignore item fetch errors
          }
        }

        // Criar ou atualizar conversa no sistema de atendimento
        const externalConversationId = `meli_question_${q.id}`;
        
        // Verificar se já existe
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("external_conversation_id", externalConversationId)
          .single();

        let conversationId: string;

        if (existingConv) {
          conversationId = existingConv.id;
          
          // Atualizar status se necessário
          const newStatus = q.status === "UNANSWERED" ? "new" : "resolved";
          await supabase
            .from("conversations")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
        } else {
          // Criar nova conversa
          const status = q.status === "UNANSWERED" ? "new" : "resolved";
          
          const { data: newConv, error: convError } = await supabase
            .from("conversations")
            .insert({
              tenant_id: tenantId,
              channel_type: "mercadolivre",
              channel_account_id: channelAccount.id,
              external_conversation_id: externalConversationId,
              customer_name: q.from?.nickname || `Comprador ${q.from?.id}`,
              subject: itemTitle ? `Pergunta sobre: ${itemTitle.substring(0, 50)}` : "Pergunta do Mercado Livre",
              status,
              priority: q.status === "UNANSWERED" ? 2 : 0,
              unread_count: q.status === "UNANSWERED" ? 1 : 0,
              metadata: {
                meli_question_id: q.id,
                meli_item_id: q.item_id,
                meli_buyer_id: q.from?.id,
                item_title: itemTitle,
              },
            })
            .select("id")
            .single();

          if (convError) {
            console.error(`[meli-sync-questions] Conv create error:`, convError);
            errors++;
            continue;
          }

          conversationId = newConv.id;
        }

        // Verificar se a mensagem da pergunta já existe
        const questionMsgId = `meli_q_${q.id}`;
        const { data: existingMsg } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .limit(1)
          .single();

        // Se não existe mensagem, criar
        if (!existingMsg) {
          // Mensagem da pergunta (inbound do cliente)
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            tenant_id: tenantId,
            direction: "inbound",
            sender_type: "customer",
            sender_name: q.from?.nickname || `Comprador ${q.from?.id}`,
            content: q.text,
            content_type: "text",
            delivery_status: "delivered",
            is_ai_generated: false,
            is_internal: false,
            is_note: false,
            created_at: q.date_created ? new Date(q.date_created).toISOString() : new Date().toISOString(),
          });

          // Se tem resposta, criar mensagem da resposta (outbound)
          if (q.answer?.text) {
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              tenant_id: tenantId,
              direction: "outbound",
              sender_type: "agent",
              sender_name: "Vendedor",
              content: q.answer.text,
              content_type: "text",
              delivery_status: "delivered",
              is_ai_generated: false,
              is_internal: false,
              is_note: false,
              created_at: q.answer.date_created ? new Date(q.answer.date_created).toISOString() : new Date().toISOString(),
            });
          }

          // Atualizar contadores da conversa
          await supabase
            .from("conversations")
            .update({
              message_count: q.answer?.text ? 2 : 1,
              last_message_at: q.answer?.date_created 
                ? new Date(q.answer.date_created).toISOString() 
                : (q.date_created ? new Date(q.date_created).toISOString() : new Date().toISOString()),
              last_customer_message_at: q.date_created ? new Date(q.date_created).toISOString() : new Date().toISOString(),
              last_agent_message_at: q.answer?.date_created ? new Date(q.answer.date_created).toISOString() : null,
            })
            .eq("id", conversationId);
        }

        synced++;

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

async function getOrCreateChannelAccount(supabase: any, tenantId: string, connection: any) {
  // Buscar channel_account existente para mercadolivre
  const { data: existing } = await supabase
    .from("channel_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("channel_type", "mercadolivre")
    .single();

  if (existing) {
    return existing;
  }

  // Criar novo
  const { data: newAccount, error } = await supabase
    .from("channel_accounts")
    .insert({
      tenant_id: tenantId,
      channel_type: "mercadolivre",
      account_name: connection.external_username || "Mercado Livre",
      external_account_id: connection.external_user_id,
      is_active: true,
      metadata: {
        marketplace_connection_id: connection.id,
      },
    })
    .select()
    .single();

  if (error) {
    console.error("[meli-sync-questions] Error creating channel_account:", error);
    throw error;
  }

  return newAccount;
}
