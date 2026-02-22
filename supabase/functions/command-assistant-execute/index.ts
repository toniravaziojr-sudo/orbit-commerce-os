import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Permission mapping - which user_types can execute which tools
const PERMISSION_MAP: Record<string, string[]> = {
  // Produtos
  bulkUpdateProductsNCM: ["owner", "admin", "manager", "editor"],
  bulkUpdateProductsCEST: ["owner", "admin", "manager", "editor"],
  bulkUpdateProductsPrice: ["owner", "admin", "manager"],
  bulkUpdateProductsStock: ["owner", "admin", "manager", "editor"],
  bulkActivateProducts: ["owner", "admin", "manager", "editor"],
  createProduct: ["owner", "admin", "manager", "editor"],
  deleteProducts: ["owner", "admin", "manager"],
  
  // Categorias
  createCategory: ["owner", "admin", "manager", "editor"],
  updateCategory: ["owner", "admin", "manager", "editor"],
  deleteCategory: ["owner", "admin", "manager"],
  
  // Descontos
  createDiscount: ["owner", "admin", "manager"],
  updateDiscount: ["owner", "admin", "manager"],
  deleteDiscount: ["owner", "admin", "manager"],
  
  // Pedidos
  updateOrderStatus: ["owner", "admin", "manager", "attendant"],
  bulkUpdateOrderStatus: ["owner", "admin", "manager"],
  addOrderNote: ["owner", "admin", "manager", "attendant"],
  salesReport: ["owner", "admin", "manager", "editor", "viewer"],
  
  // Clientes
  createCustomer: ["owner", "admin", "manager", "attendant"],
  updateCustomer: ["owner", "admin", "manager", "attendant"],
  addCustomerTag: ["owner", "admin", "manager"],
  searchCustomers: ["owner", "admin", "manager", "attendant", "viewer"],
  
  // Agenda (todos podem)
  createAgendaTask: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
  listAgendaTasks: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
  completeTask: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
  
  // Frete
  updateShippingSettings: ["owner", "admin", "manager"],
  
  // Composição de Kits
  addProductComponent: ["owner", "admin", "manager", "editor"],
  removeProductComponent: ["owner", "admin", "manager", "editor"],
  listProductComponents: ["owner", "admin", "manager", "editor", "viewer"],
  bulkSetCompositionType: ["owner", "admin", "manager"],
  autoCreateKitCompositions: ["owner", "admin", "manager"],
  
  // Relatórios
  inventoryReport: ["owner", "admin", "manager", "editor", "viewer"],
  customersReport: ["owner", "admin", "manager", "viewer"],
  
  // Configurações
  updateStoreSettings: ["owner", "admin"],
};

// Rate limiting - simple in-memory (resets on function restart)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per minute
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

    try {
      result = await executeTool(supabase, tenant_id, user.id, tool_name, tool_args);
    } catch (execError) {
      console.error("Tool execution error:", execError);
      result = { success: false, error: `Erro ao executar ação: ${execError instanceof Error ? execError.message : "Erro desconhecido"}` };
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

// Main tool executor
async function executeTool(
  supabase: any,
  tenant_id: string,
  user_id: string,
  tool_name: string,
  tool_args: any
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  
  switch (tool_name) {
    // ==================== PRODUTOS ====================
    case "bulkUpdateProductsNCM": {
      const { ncm, productIds } = tool_args;
      
      // Primeiro, buscar produtos antes da atualização para relatório
      let selectQuery = supabase
        .from("products")
        .select("id, name, sku, ncm_code")
        .eq("tenant_id", tenant_id);
      
      if (productIds && productIds.length > 0 && !productIds.includes("all")) {
        selectQuery = selectQuery.in("id", productIds);
      }
      
      const { data: productsBefore, error: selectError } = await selectQuery;
      if (selectError) throw new Error(selectError.message);
      
      const totalProducts = productsBefore?.length || 0;
      const alreadyWithNCM = productsBefore?.filter((p: any) => p.ncm_code === ncm).length || 0;
      const toUpdate = totalProducts - alreadyWithNCM;
      
      // Atualizar produtos
      let updateQuery = supabase
        .from("products")
        .update({ ncm_code: ncm, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id);
      
      if (productIds && productIds.length > 0 && !productIds.includes("all")) {
        updateQuery = updateQuery.in("id", productIds);
      }
      
      const { data: updatedProducts, error } = await updateQuery.select("id, name, sku");
      
      if (error) throw new Error(error.message);
      
      const affectedCount = updatedProducts?.length || 0;
      
      // Gerar relatório detalhado
      const report = {
        ncm,
        summary: {
          total_products: totalProducts,
          updated: affectedCount,
          already_had_ncm: alreadyWithNCM,
        },
        products_updated: updatedProducts?.slice(0, 10).map((p: any) => ({
          name: p.name,
          sku: p.sku,
        })),
        has_more: affectedCount > 10,
      };
      
      return {
        success: true,
        message: `✅ **Relatório de Atualização NCM**\n\n` +
          `📦 **NCM aplicado:** ${ncm}\n` +
          `📊 **Total de produtos:** ${totalProducts}\n` +
          `✏️ **Atualizados:** ${affectedCount}\n` +
          `⏭️ **Já possuíam este NCM:** ${alreadyWithNCM}\n\n` +
          (affectedCount > 0 ? `📋 **Exemplos atualizados:**\n${updatedProducts?.slice(0, 5).map((p: any) => `• ${p.name}`).join('\n')}` : '') +
          (affectedCount > 5 ? `\n... e mais ${affectedCount - 5} produtos` : ''),
        data: report,
      };
    }

    case "bulkUpdateProductsCEST": {
      const { cest, productIds } = tool_args;
      
      let query = supabase
        .from("products")
        .update({ cest_code: cest, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id);
      
      if (productIds && productIds.length > 0) {
        query = query.in("id", productIds);
      }
      
      const { data, error } = await query.select("id");
      
      if (error) throw new Error(error.message);
      
      const affectedCount = data?.length || 0;
      return {
        success: true,
        message: `✅ CEST atualizado para "${cest}" em ${affectedCount} produto(s)!`,
        data: { affected: affectedCount, cest },
      };
    }

    case "bulkUpdateProductsPrice": {
      const { type, value, productIds, categoryId } = tool_args;
      
      // First, get the products to update
      let selectQuery = supabase
        .from("products")
        .select("id, price")
        .eq("tenant_id", tenant_id);
      
      if (productIds && productIds.length > 0) {
        selectQuery = selectQuery.in("id", productIds);
      }
      
      const { data: products, error: selectError } = await selectQuery;
      
      if (selectError) throw new Error(selectError.message);
      if (!products || products.length === 0) {
        return { success: false, error: "Nenhum produto encontrado para atualizar." };
      }
      
      // If categoryId filter, get products from that category
      let filteredProducts = products;
      if (categoryId) {
        const { data: catProducts } = await supabase
          .from("product_categories")
          .select("product_id")
          .eq("category_id", categoryId);
        
        const catProductIds = (catProducts || []).map((cp: any) => cp.product_id);
        filteredProducts = products.filter((p: any) => catProductIds.includes(p.id));
      }
      
      // Calculate new prices and update
      let updateCount = 0;
      for (const product of filteredProducts) {
        let newPrice = product.price;
        
        switch (type) {
          case "percent_increase":
            newPrice = Math.round(product.price * (1 + value / 100));
            break;
          case "percent_decrease":
            newPrice = Math.round(product.price * (1 - value / 100));
            break;
          case "fixed":
            newPrice = Math.round(value * 100); // Convert reais to cents
            break;
        }
        
        const { error: updateError } = await supabase
          .from("products")
          .update({ price: newPrice, updated_at: new Date().toISOString() })
          .eq("id", product.id);
        
        if (!updateError) updateCount++;
      }
      
      const typeLabel = type === "percent_increase" ? `aumentados em ${value}%` :
                       type === "percent_decrease" ? `reduzidos em ${value}%` :
                       `definidos para R$ ${value.toFixed(2)}`;
      
      return {
        success: true,
        message: `✅ Preços ${typeLabel} em ${updateCount} produto(s)!`,
        data: { affected: updateCount, type, value },
      };
    }

    case "bulkUpdateProductsStock": {
      const { operation, quantity, productIds } = tool_args;
      
      let selectQuery = supabase
        .from("products")
        .select("id, stock_quantity")
        .eq("tenant_id", tenant_id);
      
      if (productIds && productIds.length > 0) {
        selectQuery = selectQuery.in("id", productIds);
      }
      
      const { data: products, error: selectError } = await selectQuery;
      
      if (selectError) throw new Error(selectError.message);
      if (!products || products.length === 0) {
        return { success: false, error: "Nenhum produto encontrado para atualizar." };
      }
      
      let updateCount = 0;
      for (const product of products) {
        let newStock = product.stock_quantity || 0;
        
        switch (operation) {
          case "set":
            newStock = quantity;
            break;
          case "add":
            newStock = (product.stock_quantity || 0) + quantity;
            break;
          case "subtract":
            newStock = Math.max(0, (product.stock_quantity || 0) - quantity);
            break;
        }
        
        const { error: updateError } = await supabase
          .from("products")
          .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
          .eq("id", product.id);
        
        if (!updateError) updateCount++;
      }
      
      const opLabel = operation === "set" ? `definido para ${quantity}` :
                     operation === "add" ? `aumentado em ${quantity}` :
                     `reduzido em ${quantity}`;
      
      return {
        success: true,
        message: `✅ Estoque ${opLabel} em ${updateCount} produto(s)!`,
        data: { affected: updateCount, operation, quantity },
      };
    }

    case "bulkActivateProducts": {
      const { isActive, productIds, categoryId } = tool_args;
      
      let query = supabase
        .from("products")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id);
      
      if (productIds && productIds.length > 0) {
        query = query.in("id", productIds);
      }
      
      // Note: category filtering would need additional logic
      
      const { data, error } = await query.select("id");
      
      if (error) throw new Error(error.message);
      
      const affectedCount = data?.length || 0;
      const statusLabel = isActive ? "ativados" : "desativados";
      
      return {
        success: true,
        message: `✅ ${affectedCount} produto(s) ${statusLabel}!`,
        data: { affected: affectedCount, isActive },
      };
    }

    case "createProduct": {
      const { name, price, sku, description, categoryId, stockQuantity } = tool_args;
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      const { data, error } = await supabase
        .from("products")
        .insert({
          tenant_id,
          name,
          slug,
          price: Math.round(price * 100), // cents
          sku: sku || null,
          description: description || null,
          stock_quantity: stockQuantity || 0,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      // Add to category if specified
      if (categoryId && data) {
        await supabase
          .from("product_categories")
          .insert({ product_id: data.id, category_id: categoryId });
      }
      
      return {
        success: true,
        message: `✅ Produto "${name}" criado com sucesso!`,
        data,
      };
    }

    case "deleteProducts": {
      const { productIds } = tool_args;
      
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("tenant_id", tenant_id)
        .in("id", productIds);
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ ${productIds.length} produto(s) excluído(s)!`,
        data: { deleted: productIds.length },
      };
    }

    // ==================== CATEGORIAS ====================
    case "createCategory": {
      const { name, slug, description, parentId } = tool_args;
      const finalSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      const { data, error } = await supabase
        .from("categories")
        .insert({
          tenant_id,
          name,
          slug: finalSlug,
          description: description || null,
          parent_id: parentId || null,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Categoria "${name}" criada com sucesso!`,
        data,
      };
    }

    case "updateCategory": {
      const { categoryId, name, description, isActive } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.is_active = isActive;
      
      const { data, error } = await supabase
        .from("categories")
        .update(updateData)
        .eq("id", categoryId)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Categoria atualizada com sucesso!`,
        data,
      };
    }

    case "deleteCategory": {
      const { categoryId } = tool_args;
      
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId)
        .eq("tenant_id", tenant_id);
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Categoria excluída com sucesso!`,
        data: { deleted: categoryId },
      };
    }

    // ==================== DESCONTOS ====================
    case "createDiscount": {
      const { name, code, type, value, minSubtotal, startsAt, endsAt, usageLimit } = tool_args;
      
      const { data, error } = await supabase
        .from("discounts")
        .insert({
          tenant_id,
          name,
          code: code.toUpperCase(),
          type: type === "percent" ? "percentage" : "fixed",
          value: type === "percent" ? value : value * 100,
          min_subtotal: minSubtotal ? minSubtotal * 100 : null,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
          usage_limit: usageLimit || null,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Cupom "${code.toUpperCase()}" criado com sucesso!`,
        data,
      };
    }

    case "updateDiscount": {
      const { discountId, isActive, value, endsAt } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (isActive !== undefined) updateData.is_active = isActive;
      if (value !== undefined) updateData.value = value;
      if (endsAt !== undefined) updateData.ends_at = endsAt;
      
      const { data, error } = await supabase
        .from("discounts")
        .update(updateData)
        .eq("id", discountId)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Cupom atualizado com sucesso!`,
        data,
      };
    }

    case "deleteDiscount": {
      const { discountId } = tool_args;
      
      const { error } = await supabase
        .from("discounts")
        .delete()
        .eq("id", discountId)
        .eq("tenant_id", tenant_id);
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Cupom excluído com sucesso!`,
        data: { deleted: discountId },
      };
    }

    // ==================== PEDIDOS ====================
    case "updateOrderStatus": {
      const { orderId, status } = tool_args;
      
      const { data, error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", orderId)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Status do pedido atualizado para "${status}"!`,
        data,
      };
    }

    case "bulkUpdateOrderStatus": {
      const { orderIds, status } = tool_args;
      
      const { data, error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id)
        .in("id", orderIds)
        .select("id");
      
      if (error) throw new Error(error.message);
      
      const affectedCount = data?.length || 0;
      
      return {
        success: true,
        message: `✅ ${affectedCount} pedido(s) atualizado(s) para "${status}"!`,
        data: { affected: affectedCount, status },
      };
    }

    case "addOrderNote": {
      const { orderId, note } = tool_args;
      
      // Get current notes
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("notes")
        .eq("id", orderId)
        .eq("tenant_id", tenant_id)
        .single();
      
      if (fetchError) throw new Error(fetchError.message);
      
      const timestamp = new Date().toLocaleString("pt-BR");
      const newNote = `[${timestamp}] ${note}`;
      const updatedNotes = order.notes ? `${order.notes}\n${newNote}` : newNote;
      
      const { error } = await supabase
        .from("orders")
        .update({ notes: updatedNotes, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Observação adicionada ao pedido!`,
        data: { orderId, note },
      };
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
      
      if (error) throw new Error(error.message);
      
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
      const paidOrders = orders?.filter((o: any) => ["paid", "completed", "shipped", "delivered"].includes(o.status)) || [];
      const pendingOrders = orders?.filter((o: any) => o.status === "pending") || [];
      const cancelledOrders = orders?.filter((o: any) => o.status === "cancelled") || [];
      
      return {
        success: true,
        message: `📊 **Relatório de Vendas (${period})**\n\n` +
          `• Total de pedidos: ${totalOrders}\n` +
          `• Pedidos pagos: ${paidOrders.length}\n` +
          `• Pedidos pendentes: ${pendingOrders.length}\n` +
          `• Pedidos cancelados: ${cancelledOrders.length}\n` +
          `• Receita total: R$ ${(totalRevenue / 100).toFixed(2)}\n` +
          `• Ticket médio: R$ ${totalOrders > 0 ? ((totalRevenue / 100) / totalOrders).toFixed(2) : "0.00"}`,
        data: { totalOrders, paidOrders: paidOrders.length, pendingOrders: pendingOrders.length, totalRevenue },
      };
    }

    // ==================== CLIENTES ====================
    case "createCustomer": {
      const { name, email, phone, cpf } = tool_args;
      
      const { data, error } = await supabase
        .from("customers")
        .insert({
          tenant_id,
          name,
          email,
          phone: phone || null,
          cpf: cpf || null,
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Cliente "${name}" criado com sucesso!`,
        data,
      };
    }

    case "updateCustomer": {
      const { customerId, name, email, phone } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      
      const { data, error } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", customerId)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Cliente atualizado com sucesso!`,
        data,
      };
    }

    case "addCustomerTag": {
      const { customerIds, tagId } = tool_args;
      
      const inserts = customerIds.map((customerId: string) => ({
        customer_id: customerId,
        tag_id: tagId,
        tenant_id,
      }));
      
      const { error } = await supabase
        .from("customer_tag_assignments")
        .upsert(inserts, { onConflict: "customer_id,tag_id" });
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Tag adicionada a ${customerIds.length} cliente(s)!`,
        data: { affected: customerIds.length },
      };
    }

    case "searchCustomers": {
      const { query } = tool_args;
      
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("tenant_id", tenant_id)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(10);
      
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return {
          success: true,
          message: `Nenhum cliente encontrado para "${query}".`,
          data: [],
        };
      }
      
      const list = data.map((c: any) => `• ${c.name} (${c.email})`).join("\n");
      
      return {
        success: true,
        message: `🔍 **${data.length} cliente(s) encontrado(s):**\n\n${list}`,
        data,
      };
    }

    // ==================== AGENDA ====================
    case "createAgendaTask": {
      const { title, dueAt, description, reminderOffsets } = tool_args;
      
      const { data: task, error: taskError } = await supabase
        .from("agenda_tasks")
        .insert({
          tenant_id,
          created_by: user_id,
          title,
          description: description || null,
          due_at: dueAt,
          reminder_offsets: reminderOffsets || [60],
        })
        .select()
        .single();
      
      if (taskError) throw new Error(taskError.message);
      
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
      
      return {
        success: true,
        message: `✅ Tarefa "${title}" criada com ${offsets.length} lembrete(s)!`,
        data: task,
      };
    }

    case "listAgendaTasks": {
      const { status, limit } = tool_args;
      
      let query = supabase
        .from("agenda_tasks")
        .select("id, title, due_at, status")
        .eq("tenant_id", tenant_id)
        .order("due_at", { ascending: true })
        .limit(limit || 10);
      
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      
      const { data, error } = await query;
      
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return {
          success: true,
          message: "Nenhuma tarefa encontrada.",
          data: [],
        };
      }
      
      const list = data.map((t: any) => {
        const dueDate = new Date(t.due_at).toLocaleString("pt-BR");
        const statusIcon = t.status === "done" ? "✅" : "⏳";
        return `${statusIcon} ${t.title} - ${dueDate}`;
      }).join("\n");
      
      return {
        success: true,
        message: `📋 **Tarefas:**\n\n${list}`,
        data,
      };
    }

    case "completeTask": {
      const { taskId } = tool_args;
      
      const { data, error } = await supabase
        .from("agenda_tasks")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("tenant_id", tenant_id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Tarefa marcada como concluída!`,
        data,
      };
    }

    // ==================== RELATÓRIOS ====================
    case "inventoryReport": {
      const { lowStockThreshold } = tool_args;
      const threshold = lowStockThreshold || 5;
      
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, stock_quantity, sku")
        .eq("tenant_id", tenant_id)
        .eq("is_active", true);
      
      if (error) throw new Error(error.message);
      
      const totalProducts = products?.length || 0;
      const lowStock = products?.filter((p: any) => (p.stock_quantity || 0) <= threshold) || [];
      const outOfStock = products?.filter((p: any) => (p.stock_quantity || 0) === 0) || [];
      const totalStock = products?.reduce((sum: number, p: any) => sum + (p.stock_quantity || 0), 0) || 0;
      
      const lowStockList = lowStock.slice(0, 5).map((p: any) => 
        `• ${p.name}: ${p.stock_quantity || 0} un.`
      ).join("\n");
      
      return {
        success: true,
        message: `📦 **Relatório de Estoque**\n\n` +
          `• Total de produtos: ${totalProducts}\n` +
          `• Estoque total: ${totalStock} unidades\n` +
          `• Estoque baixo (≤${threshold}): ${lowStock.length}\n` +
          `• Sem estoque: ${outOfStock.length}\n\n` +
          (lowStockList ? `**Produtos com estoque baixo:**\n${lowStockList}` : ""),
        data: { totalProducts, totalStock, lowStock: lowStock.length, outOfStock: outOfStock.length },
      };
    }

    case "customersReport": {
      const { period } = tool_args;
      
      let start = new Date();
      switch (period) {
        case "week":
          start.setDate(start.getDate() - 7);
          break;
        case "month":
          start.setMonth(start.getMonth() - 1);
          break;
        case "year":
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
      
      const { data: allCustomers, error: allError } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant_id);
      
      const { data: newCustomers, error: newError } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .gte("created_at", start.toISOString());
      
      if (allError || newError) throw new Error("Erro ao gerar relatório");
      
      return {
        success: true,
        message: `👥 **Relatório de Clientes (${period})**\n\n` +
          `• Total de clientes: ${allCustomers?.length || 0}\n` +
          `• Novos no período: ${newCustomers?.length || 0}`,
        data: { total: allCustomers?.length || 0, newInPeriod: newCustomers?.length || 0 },
      };
    }

    // ==================== CONFIGURAÇÕES ====================
    case "updateStoreSettings": {
      const { storeName, storeEmail, storePhone } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (storeName !== undefined) updateData.name = storeName;
      if (storeEmail !== undefined) updateData.email = storeEmail;
      if (storePhone !== undefined) updateData.phone = storePhone;
      
      const { data, error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", tenant_id)
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Configurações da loja atualizadas!`,
        data,
      };
    }

    case "updateShippingSettings": {
      const { freeShippingThreshold, defaultShippingPrice } = tool_args;
      
      // This would update shipping settings in a shipping_settings table
      // For now, we'll update the tenant's settings metadata
      const { data: tenant, error: fetchError } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenant_id)
        .single();
      
      if (fetchError) throw new Error(fetchError.message);
      
      const currentSettings = tenant?.settings || {};
      const newSettings = {
        ...currentSettings,
        shipping: {
          ...(currentSettings.shipping || {}),
          ...(freeShippingThreshold !== undefined && { freeShippingThreshold: freeShippingThreshold * 100 }),
          ...(defaultShippingPrice !== undefined && { defaultShippingPrice: defaultShippingPrice * 100 }),
        },
      };
      
      const { error } = await supabase
        .from("tenants")
        .update({ settings: newSettings, updated_at: new Date().toISOString() })
        .eq("id", tenant_id);
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Configurações de frete atualizadas!`,
        data: newSettings.shipping,
      };
    }

    // ==================== COMPOSIÇÃO DE KITS ====================
    case "addProductComponent": {
      const { parentProductId, componentProductId, quantity } = tool_args;
      
      // Ensure parent is with_composition format
      await supabase
        .from("products")
        .update({ product_format: "with_composition", stock_type: "virtual", updated_at: new Date().toISOString() })
        .eq("id", parentProductId)
        .eq("tenant_id", tenant_id);
      
      // Check self-reference
      if (parentProductId === componentProductId) {
        return { success: false, error: "Um produto não pode ser componente dele mesmo." };
      }
      
      // Check if component is also a kit
      const { data: compProduct } = await supabase
        .from("products")
        .select("product_format, name")
        .eq("id", componentProductId)
        .single();
      
      if (compProduct?.product_format === "with_composition") {
        return { success: false, error: `"${compProduct.name}" já é um kit. Não é permitido adicionar um kit como componente.` };
      }
      
      const { error: insertErr } = await supabase
        .from("product_components")
        .insert({
          parent_product_id: parentProductId,
          component_product_id: componentProductId,
          quantity,
          sort_order: 0,
        });
      
      if (insertErr) {
        if (insertErr.code === "23505") {
          return { success: false, error: "Este componente já foi adicionado ao kit." };
        }
        throw new Error(insertErr.message);
      }
      
      // Get names for message
      const { data: parentProd } = await supabase.from("products").select("name").eq("id", parentProductId).single();
      
      return {
        success: true,
        message: `✅ Componente "${compProduct?.name}" adicionado ao kit "${parentProd?.name}" (qty: ${quantity})`,
      };
    }

    case "removeProductComponent": {
      const { parentProductId, componentProductId } = tool_args;
      
      const { error: delErr, count } = await supabase
        .from("product_components")
        .delete()
        .eq("parent_product_id", parentProductId)
        .eq("component_product_id", componentProductId);
      
      if (delErr) throw new Error(delErr.message);
      
      return {
        success: true,
        message: `✅ Componente removido do kit.`,
      };
    }

    case "listProductComponents": {
      const { parentProductId } = tool_args;
      
      const { data: comps, error: listErr } = await supabase
        .from("product_components")
        .select(`
          quantity, sort_order,
          component:products!component_product_id(id, name, sku, price, stock_quantity)
        `)
        .eq("parent_product_id", parentProductId)
        .order("sort_order");
      
      if (listErr) throw new Error(listErr.message);
      
      const { data: parentProd } = await supabase.from("products").select("name, stock_type").eq("id", parentProductId).single();
      
      if (!comps || comps.length === 0) {
        return { success: true, message: `📦 Kit "${parentProd?.name}" não possui componentes cadastrados.`, data: [] };
      }
      
      const lines = comps.map((c: any, i: number) => 
        `${i+1}. ${c.component?.name} (SKU: ${c.component?.sku}) — Qtd: ${c.quantity}`
      ).join("\n");
      
      return {
        success: true,
        message: `📦 **Composição do kit "${parentProd?.name}"** (Tipo: ${parentProd?.stock_type === 'virtual' ? 'Virtual' : 'Físico'})\n\n${lines}`,
        data: comps,
      };
    }

    case "bulkSetCompositionType": {
      const { stockType, productIds } = tool_args;
      
      if (!["physical", "virtual"].includes(stockType)) {
        return { success: false, error: "Tipo deve ser 'physical' ou 'virtual'." };
      }
      
      let query = supabase
        .from("products")
        .update({ stock_type: stockType, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id)
        .eq("product_format", "with_composition");
      
      if (productIds && productIds.length > 0) {
        query = query.in("id", productIds);
      }
      
      const { data, error: updErr } = await query.select("id");
      
      if (updErr) throw new Error(updErr.message);
      
      const label = stockType === "virtual" ? "Virtual" : "Físico";
      return {
        success: true,
        message: `✅ Tipo de composição alterado para **${label}** em ${data?.length || 0} kit(s)!`,
        data: { affected: data?.length || 0 },
      };
    }

    case "autoCreateKitCompositions": {
      // Find kits with_composition but no components
      const { data: kitsWithout } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("tenant_id", tenant_id)
        .eq("product_format", "with_composition")
        .is("deleted_at", null);
      
      if (!kitsWithout || kitsWithout.length === 0) {
        return { success: true, message: "Nenhum kit encontrado." };
      }
      
      // Check which have no components
      const missing: any[] = [];
      for (const kit of kitsWithout) {
        const { count } = await supabase
          .from("product_components")
          .select("id", { count: "exact", head: true })
          .eq("parent_product_id", kit.id);
        
        if (count === 0) {
          missing.push(kit);
        }
      }
      
      if (missing.length === 0) {
        return { success: true, message: "✅ Todos os kits já possuem composição!" };
      }
      
      const lines = missing.map((k: any) => `• ${k.name} (SKU: ${k.sku})`).join("\n");
      return {
        success: true,
        message: `⚠️ **${missing.length} kit(s) sem composição encontrados:**\n\n${lines}\n\nPara cada kit, me diga quais produtos devem compor e em qual quantidade.`,
        data: { kitsWithoutComposition: missing },
      };
    }

    default:
      return { success: false, error: `Ação "${tool_name}" não reconhecida.` };
  }
}
