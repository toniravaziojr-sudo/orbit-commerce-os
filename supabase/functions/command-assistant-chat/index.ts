import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool registry - defines available actions
const TOOL_REGISTRY = {
  createCategory: {
    description: "Criar uma nova categoria de produtos",
    parameters: {
      name: { type: "string", required: true, description: "Nome da categoria" },
      slug: { type: "string", required: false, description: "Slug para URL" },
      description: { type: "string", required: false, description: "Descrição da categoria" },
    },
    requiredPermission: "products",
  },
  createDiscount: {
    description: "Criar um novo cupom de desconto",
    parameters: {
      name: { type: "string", required: true, description: "Nome do cupom" },
      code: { type: "string", required: true, description: "Código do cupom" },
      type: { type: "string", required: true, description: "percent ou amount" },
      value: { type: "number", required: true, description: "Valor do desconto" },
    },
    requiredPermission: "discounts",
  },
  salesReport: {
    description: "Gerar relatório de vendas",
    parameters: {
      period: { type: "string", required: true, description: "Período: today, week, month, custom" },
      startDate: { type: "string", required: false, description: "Data início (para custom)" },
      endDate: { type: "string", required: false, description: "Data fim (para custom)" },
    },
    requiredPermission: "orders",
  },
  createAgendaTask: {
    description: "Criar uma tarefa na Agenda",
    parameters: {
      title: { type: "string", required: true, description: "Título da tarefa" },
      dueAt: { type: "string", required: true, description: "Data/hora de vencimento" },
      description: { type: "string", required: false, description: "Descrição" },
      reminderOffsets: { type: "array", required: false, description: "Offsets de lembretes em minutos" },
    },
    requiredPermission: null, // Anyone can create tasks
  },
};

// System prompt for the assistant
const SYSTEM_PROMPT = `Você é o Auxiliar de Comando, um assistente inteligente para e-commerce.
Você pode ajudar o usuário a executar ações como:
- Criar categorias de produtos
- Criar cupons de desconto
- Gerar relatórios de vendas
- Criar tarefas na Agenda

Quando o usuário pedir para executar uma ação, você deve:
1. Entender claramente o que ele quer
2. Propor a ação com os parâmetros corretos
3. Aguardar a confirmação antes de executar

IMPORTANTE: Você NÃO executa ações diretamente. Você apenas propõe ações que o usuário pode confirmar.

Para propor uma ação, use o formato JSON no final da sua resposta:
\`\`\`action
{
  "tool_name": "createCategory",
  "tool_args": {"name": "Natal", "slug": "natal"},
  "description": "Criar a categoria 'Natal'"
}
\`\`\`

Responda sempre em português brasileiro de forma amigável e profissional.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { conversation_id, message, tenant_id } = await req.json();

    if (!tenant_id || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado ao tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save user message
    const { error: msgError } = await supabase
      .from("command_messages")
      .insert({
        conversation_id,
        tenant_id,
        user_id: user.id,
        role: "user",
        content: message,
        metadata: {},
      });

    if (msgError) {
      console.error("Error saving message:", msgError);
    }

    // Get conversation history
    const { data: history } = await supabase
      .from("command_messages")
      .select("role, content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []).map((m) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: m.content || "",
      })),
    ];

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos de IA esgotados. Adicione mais créditos." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao processar resposta da IA" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process streaming response and extract actions
    const reader = aiResponse.body!.getReader();
    const decoder = new TextDecoder();
    
    // Create a TransformStream to process and forward the stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    
    let fullContent = "";

    (async () => {
      try {
        let buffer = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Forward raw chunks to client
          await writer.write(value);
          
          // Also accumulate content for action extraction
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            
            if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
            
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullContent += content;
            } catch {}
          }
        }
        
        // Extract proposed actions from content
        const actionMatch = fullContent.match(/```action\s*([\s\S]*?)```/);
        let proposedActions: any[] = [];
        
        if (actionMatch) {
          try {
            const actionData = JSON.parse(actionMatch[1]);
            proposedActions = [{
              id: crypto.randomUUID(),
              tool_name: actionData.tool_name,
              tool_args: actionData.tool_args,
              description: actionData.description,
            }];
          } catch (e) {
            console.error("Error parsing action:", e);
          }
        }
        
        // Save assistant message with proposed actions
        const cleanContent = fullContent.replace(/```action[\s\S]*?```/g, "").trim();
        
        await supabase
          .from("command_messages")
          .insert({
            conversation_id,
            tenant_id,
            user_id: user.id,
            role: "assistant",
            content: cleanContent,
            metadata: proposedActions.length > 0 ? { proposed_actions: proposedActions } : {},
          });
        
        // Update conversation
        await supabase
          .from("command_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversation_id);
        
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
