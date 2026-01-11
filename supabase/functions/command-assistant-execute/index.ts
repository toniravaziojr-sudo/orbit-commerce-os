import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Permission mapping - which user_types can execute which tools
const PERMISSION_MAP: Record<string, string[]> = {
  createCategory: ["owner", "admin", "manager", "editor"],
  createDiscount: ["owner", "admin", "manager"],
  salesReport: ["owner", "admin", "manager", "editor", "viewer"],
  createAgendaTask: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
};

// Rate limiting - simple in-memory (resets on function restart)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

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

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ success: false, error: "Muitas requisições. Aguarde um momento." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { conversation_id, action_id, tool_name, tool_args, tenant_id } = await req.json();

    if (!tenant_id || !tool_name || !conversation_id) {
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

    // Check permission for the tool
    const allowedTypes = PERMISSION_MAP[tool_name];
    if (allowedTypes && !allowedTypes.includes(userRole.user_type)) {
      const result = {
        success: false,
        error: `Você não tem permissão para executar esta ação. Necessário: ${allowedTypes.join(", ")}`,
      };
      
      // Log the failed attempt
      await supabase
        .from("command_messages")
        .insert({
          conversation_id,
          tenant_id,
          user_id: user.id,
          role: "tool",
          content: `Ação "${tool_name}" negada por falta de permissão.`,
          metadata: { action_id, tool_name, tool_args, tool_result: result },
        });
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute the tool
    let result: { success: boolean; message?: string; error?: string; data?: any };

    switch (tool_name) {
      case "createCategory": {
        const { name, slug, description } = tool_args;
        const finalSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        
        const { data, error } = await supabase
          .from("categories")
          .insert({
            tenant_id,
            name,
            slug: finalSlug,
            description: description || null,
            is_active: true,
          })
          .select()
          .single();
        
        if (error) {
          result = { success: false, error: `Erro ao criar categoria: ${error.message}` };
        } else {
          result = { success: true, message: `Categoria "${name}" criada com sucesso!`, data };
        }
        break;
      }

      case "createDiscount": {
        const { name, code, type, value, minSubtotal, startsAt, endsAt } = tool_args;
        
        const { data, error } = await supabase
          .from("discounts")
          .insert({
            tenant_id,
            name,
            code: code.toUpperCase(),
            type: type === "percent" ? "percentage" : "fixed",
            value: type === "percent" ? value : value * 100, // cents for fixed
            min_subtotal: minSubtotal ? minSubtotal * 100 : null,
            starts_at: startsAt || null,
            ends_at: endsAt || null,
            is_active: true,
          })
          .select()
          .single();
        
        if (error) {
          result = { success: false, error: `Erro ao criar cupom: ${error.message}` };
        } else {
          result = { success: true, message: `Cupom "${code.toUpperCase()}" criado com sucesso!`, data };
        }
        break;
      }

      case "salesReport": {
        const { period, startDate, endDate } = tool_args;
        
        let start: Date;
        let end = new Date();
        
        switch (period) {
          case "today":
            start = new Date();
            start.setHours(0, 0, 0, 0);
            break;
          case "week":
            start = new Date();
            start.setDate(start.getDate() - 7);
            break;
          case "month":
            start = new Date();
            start.setMonth(start.getMonth() - 1);
            break;
          case "custom":
            start = new Date(startDate);
            end = new Date(endDate);
            break;
          default:
            start = new Date();
            start.setMonth(start.getMonth() - 1);
        }
        
        const { data: orders, error } = await supabase
          .from("orders")
          .select("id, total, status, created_at")
          .eq("tenant_id", tenant_id)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());
        
        if (error) {
          result = { success: false, error: `Erro ao gerar relatório: ${error.message}` };
        } else {
          const totalOrders = orders?.length || 0;
          const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
          const paidOrders = orders?.filter(o => o.status === "paid" || o.status === "completed") || [];
          
          result = {
            success: true,
            message: `📊 Relatório de Vendas (${period})\n\n` +
              `• Total de pedidos: ${totalOrders}\n` +
              `• Pedidos pagos: ${paidOrders.length}\n` +
              `• Receita total: R$ ${(totalRevenue / 100).toFixed(2)}\n` +
              `• Ticket médio: R$ ${totalOrders > 0 ? ((totalRevenue / 100) / totalOrders).toFixed(2) : "0.00"}`,
            data: { totalOrders, paidOrders: paidOrders.length, totalRevenue },
          };
        }
        break;
      }

      case "createAgendaTask": {
        const { title, dueAt, description, reminderOffsets } = tool_args;
        
        // Create task
        const { data: task, error: taskError } = await supabase
          .from("agenda_tasks")
          .insert({
            tenant_id,
            created_by: user.id,
            title,
            description: description || null,
            due_at: dueAt,
            reminder_offsets: reminderOffsets || [60], // default 1 hour before
          })
          .select()
          .single();
        
        if (taskError) {
          result = { success: false, error: `Erro ao criar tarefa: ${taskError.message}` };
          break;
        }
        
        // Create reminders
        const offsets = reminderOffsets || [60];
        const dueDate = new Date(dueAt);
        
        for (const offsetMinutes of offsets) {
          const remindAt = new Date(dueDate.getTime() - offsetMinutes * 60 * 1000);
          
          await supabase
            .from("agenda_reminders")
            .insert({
              tenant_id,
              task_id: task.id,
              channel: "whatsapp",
              remind_at: remindAt.toISOString(),
              status: "pending",
            });
        }
        
        result = {
          success: true,
          message: `Tarefa "${title}" criada com sucesso! ${offsets.length} lembrete(s) configurado(s).`,
          data: task,
        };
        break;
      }

      default:
        result = { success: false, error: `Ação "${tool_name}" não reconhecida.` };
    }

    // Log the execution
    await supabase
      .from("command_messages")
      .insert({
        conversation_id,
        tenant_id,
        user_id: user.id,
        role: "tool",
        content: result.success ? result.message : result.error,
        metadata: { action_id, tool_name, tool_args, tool_result: result },
      });

    // Update conversation
    await supabase
      .from("command_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
