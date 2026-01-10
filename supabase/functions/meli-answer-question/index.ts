import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre Answer Question
 * 
 * Responde uma pergunta no Mercado Livre.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tenantId, messageId, answer } = body;

    if (!tenantId || !messageId || !answer) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId, messageId e answer são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso ao tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso a este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar mensagem
    const { data: message, error: msgError } = await supabase
      .from("marketplace_messages")
      .select("*")
      .eq("id", messageId)
      .eq("tenant_id", tenantId)
      .single();

    if (msgError || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Mensagem não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.status === "answered") {
      return new Response(
        JSON.stringify({ success: false, error: "Esta pergunta já foi respondida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão ML não encontrada" }),
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

    // Enviar resposta para o ML
    const questionId = message.external_message_id;
    const answerUrl = `https://api.mercadolibre.com/answers`;
    
    const answerRes = await fetch(answerUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: parseInt(questionId),
        text: answer,
      }),
    });

    if (!answerRes.ok) {
      const errorData = await answerRes.json().catch(() => ({}));
      console.error("[meli-answer-question] ML API error:", errorData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorData.message || "Erro ao enviar resposta para o Mercado Livre",
          code: errorData.error,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const answerData = await answerRes.json();

    // Atualizar mensagem local
    await supabase
      .from("marketplace_messages")
      .update({
        status: "answered",
        answer_text: answer,
        answered_at: new Date().toISOString(),
        metadata: {
          ...message.metadata,
          answered_by: user.id,
          meli_answer_date: answerData.date_created,
        },
      })
      .eq("id", messageId);

    return new Response(
      JSON.stringify({ success: true, message: "Resposta enviada com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meli-answer-question] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
