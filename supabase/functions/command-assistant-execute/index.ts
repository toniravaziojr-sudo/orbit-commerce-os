import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

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
  bulkUpdateProductsFreeShipping: ["owner", "admin", "manager", "editor"],
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
  findKitsContainingProduct: ["owner", "admin", "manager", "editor", "viewer"],
  bulkSetCompositionType: ["owner", "admin", "manager"],
  autoCreateKitCompositions: ["owner", "admin", "manager"],
  
  // Relatórios
  inventoryReport: ["owner", "admin", "manager", "editor", "viewer"],
  customersReport: ["owner", "admin", "manager", "viewer"],
  
  // Configurações
  updateStoreSettings: ["owner", "admin"],

  // === FASE 1: LEITURA UNIVERSAL ===
  searchProducts: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  listProducts: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  getProductDetails: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  searchOrders: ["owner", "admin", "manager", "attendant", "viewer"],
  getOrderDetails: ["owner", "admin", "manager", "attendant", "viewer"],
  listDiscounts: ["owner", "admin", "manager", "viewer"],
  listCategories: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  getDashboardStats: ["owner", "admin", "manager", "viewer"],
  getTopProducts: ["owner", "admin", "manager", "viewer"],
  listCustomerTags: ["owner", "admin", "manager", "attendant", "viewer"],

  // === FASE 2: CRUD COMPLETO ===
  updateProduct: ["owner", "admin", "manager", "editor"],
  duplicateProduct: ["owner", "admin", "manager", "editor"],
  deleteCustomer: ["owner", "admin", "manager"],
  addTrackingCode: ["owner", "admin", "manager", "attendant"],
  cancelOrder: ["owner", "admin", "manager"],
  createManualOrder: ["owner", "admin", "manager"],
  createCustomerTag: ["owner", "admin", "manager"],
  removeCustomerTag: ["owner", "admin", "manager"],

  // === FASE 3: MARKETING E CRM ===
  createBlogPost: ["owner", "admin", "manager", "editor"],
  updateBlogPost: ["owner", "admin", "manager", "editor"],
  deleteBlogPost: ["owner", "admin", "manager"],
  listBlogPosts: ["owner", "admin", "manager", "editor", "viewer"],
  createOffer: ["owner", "admin", "manager"],
  updateOffer: ["owner", "admin", "manager"],
  deleteOffer: ["owner", "admin", "manager"],
  listOffers: ["owner", "admin", "manager", "viewer"],
  listReviews: ["owner", "admin", "manager", "attendant", "viewer"],
  approveReview: ["owner", "admin", "manager"],
  rejectReview: ["owner", "admin", "manager"],
  respondToReview: ["owner", "admin", "manager", "attendant"],

  // === FASE 4: OPERACIONAL ===
  listPages: ["owner", "admin", "manager", "editor", "viewer"],
  createPage: ["owner", "admin", "manager", "editor"],
  updatePage: ["owner", "admin", "manager", "editor"],
  getFinancialSummary: ["owner", "admin", "manager", "viewer"],
  listShippingMethods: ["owner", "admin", "manager", "viewer"],
  listNotifications: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
  markNotificationRead: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
  listFiles: ["owner", "admin", "manager", "editor", "viewer"],
  getStorageUsage: ["owner", "admin", "manager", "viewer"],

  // === FASE 5: EMAIL MARKETING ===
  listEmailLists: ["owner", "admin", "manager"],
  listSubscribers: ["owner", "admin", "manager"],
  addSubscriber: ["owner", "admin", "manager"],
  createEmailCampaign: ["owner", "admin", "manager"],
  listCampaigns: ["owner", "admin", "manager", "viewer"],
  recalculateKitPrices: ["owner", "admin", "manager"],
  listKitsSummary: ["owner", "admin", "manager", "editor", "viewer"],
  applyKitDiscount: ["owner", "admin", "manager"],
  // v4.0.0: New tool permissions
  listFiscalDrafts: ["owner", "admin", "manager"],
  getFiscalDraftDetails: ["owner", "admin", "manager"],
  listFiscalInvoices: ["owner", "admin", "manager"],
  getFiscalInvoiceDetails: ["owner", "admin", "manager"],
  updateFiscalDraft: ["owner", "admin", "manager"],
  listShipments: ["owner", "admin", "manager", "attendant"],
  getShipmentDetails: ["owner", "admin", "manager", "attendant"],
  updateShipmentStatus: ["owner", "admin", "manager"],
  listPurchases: ["owner", "admin", "manager"],
  getPurchaseDetails: ["owner", "admin", "manager"],
  createPurchase: ["owner", "admin", "manager"],
  updatePurchase: ["owner", "admin", "manager"],
  deletePurchase: ["owner", "admin", "manager"],
  listTeamMembers: ["owner"],
  getTeamMemberDetails: ["owner"],
  listIntegrations: ["owner", "admin", "manager"],
  listSupportTickets: ["owner", "admin", "manager", "attendant"],
  getSupportTicketDetails: ["owner", "admin", "manager", "attendant"],
  updateTicketStatus: ["owner", "admin", "manager", "attendant"],
  replyToTicket: ["owner", "admin", "manager", "attendant"],
  listAutomations: ["owner", "admin", "manager"],
  getAutomationDetails: ["owner", "admin", "manager"],
  toggleAutomation: ["owner", "admin", "manager"],
  getCampaignDetails: ["owner", "admin", "manager"],
  listEmailTemplates: ["owner", "admin", "manager", "editor"],
  getCampaignStats: ["owner", "admin", "manager"],
  updateCampaign: ["owner", "admin", "manager"],
  deleteCampaign: ["owner", "admin", "manager"],
  duplicateCampaign: ["owner", "admin", "manager"],
  pauseCampaign: ["owner", "admin", "manager"],
  removeSubscriber: ["owner", "admin", "manager"],
  moveSubscriber: ["owner", "admin", "manager"],
  listCheckoutLinks: ["owner", "admin", "manager"],
  getCheckoutLinkDetails: ["owner", "admin", "manager"],
  createCheckoutLink: ["owner", "admin", "manager"],
  updateCheckoutLink: ["owner", "admin", "manager"],
  deleteCheckoutLink: ["owner", "admin", "manager"],
  listAffiliates: ["owner", "admin", "manager"],
  getAffiliateDetails: ["owner", "admin", "manager"],
  listAffiliatePayouts: ["owner", "admin", "manager"],
  createAffiliate: ["owner", "admin", "manager"],
  updateAffiliate: ["owner", "admin", "manager"],
  toggleAffiliate: ["owner", "admin", "manager"],
  listSocialPosts: ["owner", "admin", "manager", "editor"],
  getSocialPostDetails: ["owner", "admin", "manager", "editor"],
  listDomains: ["owner", "admin"],
  getStoreDetails: ["owner", "admin", "manager", "viewer"],
  listPotentialCustomers: ["owner", "admin", "manager", "attendant"],
  getPotentialCustomerDetails: ["owner", "admin", "manager", "attendant"],
  updatePotentialCustomerStatus: ["owner", "admin", "manager", "attendant"],
  listProductVariants: ["owner", "admin", "manager", "editor", "viewer"],
  createProductVariant: ["owner", "admin", "manager", "editor"],
  updateProductVariant: ["owner", "admin", "manager", "editor"],
  deleteProductVariant: ["owner", "admin", "manager"],
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

    const body = await req.json();
    const { conversation_id, action_id, tool_name, tool_args, tenant_id, _internal_user_id } = body;

    let userId: string;
    let userRole: any;

    // Internal call from command-assistant-chat (uses service role key)
    if (_internal_user_id && authHeader.includes(supabaseKey)) {
      userId = _internal_user_id;
      
      // Lookup user role directly
      const { data: role, error: roleError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", tenant_id)
        .single();
      
      if (roleError || !role) {
        return new Response(
          JSON.stringify({ success: false, error: "Acesso negado ao tenant (internal)" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userRole = role;
    } else {
      // Normal external call - verify user token
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = user.id;

      // Rate limit check
      if (!checkRateLimit(userId)) {
        return new Response(
          JSON.stringify({ success: false, error: "Muitas requisições. Aguarde um momento." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user has access to tenant
      const { data: role, error: roleError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", tenant_id)
        .single();

      if (roleError || !role) {
        return new Response(
          JSON.stringify({ success: false, error: "Acesso negado ao tenant" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userRole = role;
    }

    if (!tenant_id || !tool_name || !conversation_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
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
      
      // Log the failed attempt (skip for internal calls)
      if (!_internal_user_id) {
        await supabase
          .from("command_messages")
          .insert({
            conversation_id,
            tenant_id,
            user_id: userId,
            role: "tool",
            content: `Ação "${tool_name}" negada por falta de permissão.`,
            metadata: { action_id, tool_name, tool_args, tool_result: result },
          });
      }
      
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute the tool
    let result: { success: boolean; message?: string; error?: string; data?: any };

    try {
      result = await executeTool(supabase, tenant_id, userId, tool_name, tool_args);
    } catch (execError) {
      console.error("Tool execution error:", execError);
      result = { success: false, error: `Erro ao executar ação: ${execError instanceof Error ? execError.message : "Erro desconhecido"}` };
    }

    // Log the execution as "user" role with is_tool_result marker so it's NOT filtered
    // from AI history. Previously saved as "tool" which was filtered at line 1138 of
    // command-assistant-chat, causing AI to never see action results.
    if (!_internal_user_id) {
      const resultContent = result.success
        ? `[AÇÃO_CONCLUÍDA]: ${result.message || "Executado com sucesso"}`
        : `[AÇÃO_FALHOU]: ${result.error || "Erro ao executar"}`;
      await supabase
        .from("command_messages")
        .insert({
          conversation_id,
          tenant_id,
          user_id: userId,
          role: "user",
          content: resultContent,
          metadata: { is_tool_result: true, action_id, tool_name, tool_args, tool_result: result },
        });
    }

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
    return errorResponse(error, corsHeaders, { module: 'system', action: 'command-assistant-execute' });
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
      let { type, value, productIds, categoryId, prices, productFormat, excludeKits } = tool_args;
      
      // Auto-infer type when prices array is provided
      if (!type && prices && Array.isArray(prices)) {
        type = "fixed";
      }
      
      // Validate required args
      if (!type) {
        return { success: false, error: "Parâmetro 'type' é obrigatório (percent_increase, percent_decrease, fixed)." };
      }
      
      // Support individual prices per product: prices = [{ productId, price }]
      if (type === "fixed" && prices && Array.isArray(prices)) {
        const removeCompareAtPrice = tool_args.removeCompareAtPrice === true;
        let updateCount = 0;
        for (const item of prices) {
          const newPrice = parseFloat(item.price);
          if (isNaN(newPrice) || !item.productId) continue;
          
          const updateData: any = { price: Math.round(newPrice * 100) / 100, updated_at: new Date().toISOString() };
          if (removeCompareAtPrice) {
            updateData.compare_at_price = null;
          }
          
          const { error: updateError } = await supabase
            .from("products")
            .update(updateData)
            .eq("id", item.productId)
            .eq("tenant_id", tenant_id);
          
          if (!updateError) updateCount++;
        }
        
        if (updateCount === 0) {
          return {
            success: false,
            error: `❌ Nenhum produto foi atualizado. Os IDs fornecidos não foram encontrados no banco de dados. Verifique se os IDs são UUIDs válidos obtidos de uma busca anterior.`,
            data: { affected: 0, type: "fixed_individual", prices, removeCompareAtPrice },
          };
        }
        return {
          success: true,
          message: `✅ Preços atualizados individualmente em ${updateCount} produto(s)!` + 
            (removeCompareAtPrice ? ` Preços de desconto removidos.` : ''),
          data: { affected: updateCount, type: "fixed_individual", prices, removeCompareAtPrice },
        };
      }
      
      if (type !== "fixed" && (value === undefined || value === null)) {
        return { success: false, error: "Parâmetro 'value' é obrigatório para alterações percentuais." };
      }
      
      // First, get the products to update (include compare_at_price)
      let selectQuery = supabase
        .from("products")
        .select("id, price, compare_at_price")
        .eq("tenant_id", tenant_id)
        .is("deleted_at", null);
      
      if (productIds && productIds.length > 0) {
        selectQuery = selectQuery.in("id", productIds);
      }
      
      // Apply product format filters
      if (productFormat) {
        selectQuery = selectQuery.eq("product_format", productFormat);
      } else if (excludeKits) {
        selectQuery = selectQuery.neq("product_format", "with_composition");
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
      
      // Calculate new prices and update (both price and compare_at_price)
      // Note: price and compare_at_price are stored as numeric (reais, e.g. 322.00)
      let updateCount = 0;
      for (const product of filteredProducts) {
        const currentPrice = parseFloat(product.price) || 0;
        const currentCompare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
        let newPrice = currentPrice;
        let newCompareAtPrice = currentCompare;
        
        switch (type) {
          case "percent_increase":
            newPrice = Math.round(currentPrice * (1 + value / 100) * 100) / 100;
            if (newCompareAtPrice !== null) {
              newCompareAtPrice = Math.round(newCompareAtPrice * (1 + value / 100) * 100) / 100;
            }
            break;
          case "percent_decrease":
            newPrice = Math.round(currentPrice * (1 - value / 100) * 100) / 100;
            if (newCompareAtPrice !== null) {
              newCompareAtPrice = Math.round(newCompareAtPrice * (1 - value / 100) * 100) / 100;
            }
            break;
          case "fixed":
            newPrice = value != null ? value : currentPrice;
            newCompareAtPrice = null;
            break;
          case "apply_discount":
            // Sets compare_at_price = current price ("preço de") and price = discounted ("preço por")
            newCompareAtPrice = currentPrice;
            newPrice = Math.round(currentPrice * (1 - value / 100) * 100) / 100;
            break;
        }
        
        const updateData: any = { price: newPrice, updated_at: new Date().toISOString() };
        if (newCompareAtPrice !== null) {
          updateData.compare_at_price = newCompareAtPrice;
        }
        
        const { error: updateError } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", product.id);
        
        if (!updateError) updateCount++;
      }
      
      const typeLabel = type === "percent_increase" ? `aumentados em ${value}%` :
                       type === "percent_decrease" ? `reduzidos em ${value}%` :
                       type === "apply_discount" ? `com ${value}% de desconto promocional (preço de/por)` :
                       value != null ? `definidos para R$ ${Number(value).toFixed(2)}` : `atualizados`;
      
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
        .update({ status: isActive ? "active" : "inactive", updated_at: new Date().toISOString() })
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

    case "bulkUpdateProductsFreeShipping": {
      const { freeShipping, productIds, categoryId, productFormat, minComponents } = tool_args;
      
      // If filtering by minComponents, we need to find kits with N+ components first
      let targetProductIds: string[] | null = productIds && productIds.length > 0 ? productIds : null;
      
      if (minComponents && minComponents > 0) {
        // Find kits with at least N total items (sum of quantities, not row count)
        const { data: kitsWithComponents, error: kitsError } = await supabase
          .from("products")
          .select("id, product_components!product_components_parent_product_id_fkey(id, quantity)")
          .eq("tenant_id", tenant_id)
          .eq("product_format", "with_composition")
          .eq("status", "active");
        
        if (kitsError) throw new Error(kitsError.message);
        
        const qualifyingKitIds = (kitsWithComponents || [])
          .filter((kit: any) => {
            const totalQty = (kit.product_components || []).reduce(
              (sum: number, comp: any) => sum + (Number(comp.quantity) || 0), 0
            );
            return totalQty >= minComponents;
          })
          .map((kit: any) => kit.id);
        
        if (qualifyingKitIds.length === 0) {
          return {
            success: true,
            message: `⚠️ Nenhum kit encontrado com ${minComponents} ou mais produtos na composição.`,
            data: { affected: 0 },
          };
        }
        
        // If productIds was also provided, intersect
        if (targetProductIds) {
          targetProductIds = targetProductIds.filter((id: string) => qualifyingKitIds.includes(id));
        } else {
          targetProductIds = qualifyingKitIds;
        }
      }
      
      let query = supabase
        .from("products")
        .update({ free_shipping: freeShipping, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id);
      
      if (targetProductIds && targetProductIds.length > 0) {
        query = query.in("id", targetProductIds);
      }
      
      if (productFormat) {
        query = query.eq("product_format", productFormat);
      }
      
      if (categoryId) {
        // Get product IDs from category first
        const { data: catProducts } = await supabase
          .from("product_categories")
          .select("product_id")
          .eq("category_id", categoryId);
        
        if (catProducts && catProducts.length > 0) {
          const catProductIds = catProducts.map((cp: any) => cp.product_id);
          query = query.in("id", catProductIds);
        } else {
          return {
            success: true,
            message: `⚠️ Nenhum produto encontrado nesta categoria.`,
            data: { affected: 0 },
          };
        }
      }
      
      const { data, error } = await query.select("id");
      
      if (error) throw new Error(error.message);
      
      const affectedCount = data?.length || 0;
      const statusLabel = freeShipping ? "ativado" : "desativado";
      
      return {
        success: true,
        message: `✅ Frete grátis ${statusLabel} em ${affectedCount} produto(s)!`,
        data: { affected: affectedCount, freeShipping },
      };
    }

    case "createProduct": {
      const { name, price, sku, description, shortDescription, categoryId, stockQuantity, brand, vendor, barcode, gtin, costPrice, weight, width, height, length: prodLen, depth, freeShipping, requiresShipping, isFeatured, tags, warrantyType, warrantyDuration, ncmCode, cestCode, originCode, taxable, manageStock, allowBackorder, seoTitle, seoDescription, metaKeywords } = tool_args;
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      const insertData: any = {
        tenant_id,
        name,
        slug,
        price,
        sku: sku || null,
        description: description || null,
        short_description: shortDescription || null,
        stock_quantity: stockQuantity || 0,
        status: "active",
      };
      
      // Optional fields
      if (brand) insertData.brand = brand;
      if (vendor) insertData.vendor = vendor;
      if (barcode) insertData.barcode = barcode;
      if (gtin) insertData.gtin = gtin;
      if (costPrice !== undefined) insertData.cost_price = costPrice;
      if (weight !== undefined) insertData.weight = weight;
      if (width !== undefined) insertData.width = width;
      if (height !== undefined) insertData.height = height;
      if (prodLen !== undefined) insertData.length = prodLen;
      if (depth !== undefined) insertData.depth = depth;
      if (freeShipping !== undefined) insertData.free_shipping = freeShipping;
      if (requiresShipping !== undefined) insertData.requires_shipping = requiresShipping;
      if (isFeatured !== undefined) insertData.is_featured = isFeatured;
      if (tags) insertData.tags = tags;
      if (warrantyType) insertData.warranty_type = warrantyType;
      if (warrantyDuration) insertData.warranty_duration = warrantyDuration;
      if (ncmCode) insertData.ncm = ncmCode;
      if (cestCode) insertData.cest = cestCode;
      if (originCode) insertData.origin_code = originCode;
      if (taxable !== undefined) insertData.taxable = taxable;
      if (manageStock !== undefined) insertData.manage_stock = manageStock;
      if (allowBackorder !== undefined) insertData.allow_backorder = allowBackorder;
      if (seoTitle) insertData.seo_title = seoTitle;
      if (seoDescription) insertData.seo_description = seoDescription;
      if (metaKeywords) insertData.meta_keywords = metaKeywords;
      
      const { data, error } = await supabase
        .from("products")
        .insert(insertData)
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
      
      const timestamp = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
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
        const dueDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(t.due_at));
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
        .eq("status", "active");
      
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

    // ==================== BUSCA INVERSA: KITS QUE CONTÊM UM COMPONENTE ====================
    case "findKitsContainingProduct": {
      const { componentProductId } = tool_args;
      if (!componentProductId) {
        return { success: false, error: "componentProductId é obrigatório." };
      }

      // Find all kits containing this product as component
      const { data: parentComps, error: parentErr } = await supabase
        .from("product_components")
        .select(`
          parent_product_id,
          quantity,
          parent:products!parent_product_id(id, name, sku, price, product_format)
        `)
        .eq("component_product_id", componentProductId);

      if (parentErr) throw new Error(parentErr.message);

      // Filter to this tenant's kits
      const tenantKits = (parentComps || []).filter(
        (c: any) => c.parent && c.parent.id
      );

      // Validate tenant ownership
      const kitIds = tenantKits.map((c: any) => c.parent.id);
      const { data: validKits } = await supabase
        .from("products")
        .select("id")
        .in("id", kitIds)
        .eq("tenant_id", tenant_id);

      const validIds = new Set((validKits || []).map((k: any) => k.id));
      const filtered = tenantKits.filter((c: any) => validIds.has(c.parent.id));

      if (filtered.length === 0) {
        // Also get the component product name for a better message
        const { data: compProd } = await supabase.from("products").select("name").eq("id", componentProductId).single();
        return { 
          success: true, 
          message: `Nenhum kit encontrado contendo "${compProd?.name || componentProductId}" como componente.`, 
          data: [] 
        };
      }

      const { data: compProd } = await supabase.from("products").select("name, sku").eq("id", componentProductId).single();

      const lines = filtered.map((c: any, i: number) =>
        `${i + 1}. **${c.parent.name}** (SKU: ${c.parent.sku}) — Qtd do componente: ${c.quantity}, Preço kit: R$ ${Number(c.parent.price).toFixed(2)}`
      ).join("\n");

      return {
        success: true,
        message: `🔍 **Kits que contêm "${compProd?.name}" (${compProd?.sku}):**\n\n${lines}`,
        data: filtered.map((c: any) => ({
          kitId: c.parent.id,
          kitName: c.parent.name,
          kitSku: c.parent.sku,
          kitPrice: c.parent.price,
          componentQuantity: c.quantity,
        })),
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

    // ==================== FASE 1: LEITURA UNIVERSAL ====================
    case "searchProducts": {
      const { query, categoryId, limit, excludeKits = true, exactMatch = true } = tool_args;
      const maxResults = limit || 20;
      
      const selectFields = "id, name, sku, price, compare_at_price, stock_quantity, status, product_format, created_at";
      
      // Strategy 1: Try exact SKU match first (if query looks like a SKU)
      const isSkuLike = /^[0-9]{1,10}$/.test(query?.trim()) || /^[A-Z0-9-]{2,20}$/i.test(query?.trim());
      if (isSkuLike) {
        const { data: skuMatch } = await supabase
          .from("products")
          .select(selectFields)
          .eq("tenant_id", tenant_id)
          .is("deleted_at", null)
          .eq("sku", query.trim())
          .limit(1);
        
        if (skuMatch && skuMatch.length > 0) {
          const p = skuMatch[0];
          return {
            success: true,
            message: `🔍 **1 produto encontrado por SKU "${query}":**\n\n• ${p.name} (SKU: ${p.sku || "—"}) — R$ ${(p.price || 0).toFixed(2)} — Estoque: ${p.stock_quantity ?? 0} — ${p.status === "active" ? "Ativo" : "Inativo"}`,
            data: skuMatch,
          };
        }
      }
      
      // Strategy 2: Exact name match (prioritized)
      if (exactMatch) {
        let exactQ = supabase
          .from("products")
          .select(selectFields)
          .eq("tenant_id", tenant_id)
          .is("deleted_at", null)
          .eq("name", query)
          .limit(maxResults);
        
        if (excludeKits) {
          exactQ = exactQ.neq("product_format", "with_composition");
        }
        
        const { data: exactData } = await exactQ;
        if (exactData && exactData.length > 0) {
          const list = exactData.map((p: any) => 
            `• ${p.name} (SKU: ${p.sku || "—"}) — R$ ${(p.price || 0).toFixed(2)} — Estoque: ${p.stock_quantity ?? 0} — ${p.status === "active" ? "Ativo" : "Inativo"}`
          ).join("\n");
          return {
            success: true,
            message: `🔍 **${exactData.length} produto(s) encontrado(s) para "${query}":**\n\n${list}`,
            data: exactData,
          };
        }
      }
      
      // Strategy 3: ilike search (fallback)
      let q = supabase
        .from("products")
        .select(selectFields)
        .eq("tenant_id", tenant_id)
        .is("deleted_at", null)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(maxResults);
      
      if (excludeKits) {
        q = q.neq("product_format", "with_composition");
      }
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        // Strategy 4: Accent-insensitive search using unaccent RPC
        const { data: fuzzyData } = await supabase.rpc("search_products_fuzzy", {
          p_tenant_id: tenant_id,
          p_query: query,
          p_limit: maxResults,
          p_exclude_kits: excludeKits,
        });
        
        if (fuzzyData && fuzzyData.length > 0) {
          const list = fuzzyData.map((p: any) => 
            `• ${p.name} (SKU: ${p.sku || "—"}) — R$ ${(p.price || 0).toFixed(2)} — Estoque: ${p.stock_quantity ?? 0} — ${p.status === "active" ? "Ativo" : "Inativo"}`
          ).join("\n");
          return {
            success: true,
            message: `🔍 **${fuzzyData.length} produto(s) encontrado(s) para "${query}":**\n\n${list}`,
            data: fuzzyData,
          };
        }
        
        // If excludeKits was on and no results, try including kits (also with unaccent)
        if (excludeKits) {
          const { data: withKitsFuzzy } = await supabase.rpc("search_products_fuzzy", {
            p_tenant_id: tenant_id,
            p_query: query,
            p_limit: maxResults,
            p_exclude_kits: false,
          });
          
          if (withKitsFuzzy && withKitsFuzzy.length > 0) {
            const list = withKitsFuzzy.map((p: any) => 
              `• ${p.name} (SKU: ${p.sku || "—"}) — R$ ${(p.price || 0).toFixed(2)} — ${p.product_format === "with_composition" ? "Kit" : "Produto"} — ${p.status === "active" ? "Ativo" : "Inativo"}`
            ).join("\n");
            return {
              success: true,
              message: `🔍 **${withKitsFuzzy.length} produto(s) encontrado(s) para "${query}" (incluindo kits):**\n\n${list}`,
              data: withKitsFuzzy,
            };
          }
        }
        return { success: true, message: `Nenhum produto encontrado para "${query}".`, data: [] };
      }
      
      const list = data.map((p: any) => 
        `• ${p.name} (SKU: ${p.sku || "—"}) — R$ ${(p.price || 0).toFixed(2)} — Estoque: ${p.stock_quantity ?? 0} — ${p.status === "active" ? "Ativo" : "Inativo"}`
      ).join("\n");
      
      return {
        success: true,
        message: `🔍 **${data.length} produto(s) encontrado(s) para "${query}":**\n\n${list}`,
        data,
      };
    }

    case "listProducts": {
      const { status, categoryId, minPrice, maxPrice, limit, orderBy, productFormat, excludeKits } = tool_args;
      const maxResults = Math.min(limit || 20, 100);
      
      let q = supabase
        .from("products")
        .select("id, name, sku, price, compare_at_price, stock_quantity, status, product_format, free_shipping, created_at")
        .eq("tenant_id", tenant_id)
        .is("deleted_at", null)
        .limit(maxResults);
      
      if (status === "active") q = q.eq("status", "active");
      else if (status === "inactive") q = q.eq("status", "inactive");
      
      // Filter by product format
      if (productFormat) {
        q = q.eq("product_format", productFormat);
      } else if (excludeKits) {
        q = q.neq("product_format", "with_composition");
      }
      
      if (categoryId) {
        // Get product IDs from category junction table
        const { data: catProducts } = await supabase
          .from("product_categories")
          .select("product_id")
          .eq("category_id", categoryId);
        if (catProducts && catProducts.length > 0) {
          q = q.in("id", catProducts.map((cp: any) => cp.product_id));
        } else {
          return { success: true, message: "Nenhum produto encontrado nesta categoria.", data: [] };
        }
      }
      
      if (minPrice) q = q.gte("price", minPrice);
      if (maxPrice) q = q.lte("price", maxPrice);
      
      const sortField = orderBy || "created_at";
      q = q.order(sortField, { ascending: sortField === "name" });
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhum produto encontrado com os filtros aplicados.", data: [] };
      }
      
      const list = data.map((p: any) => {
        const format = p.product_format === "with_composition" ? " [Kit]" : p.product_format === "with_variants" ? " [Variantes]" : "";
        return `• ${p.name}${format} (SKU: ${p.sku || "—"}) — R$ ${(p.price || 0).toFixed(2)} — Estoque: ${p.stock_quantity ?? 0} — ${p.status === "active" ? "Ativo" : "Inativo"} — Frete grátis: ${p.free_shipping ? '✅' : '❌'}`;
      }).join("\n");
      
      return {
        success: true,
        message: `📦 **${data.length} produto(s):**\n\n${list}`,
        data,
      };
    }

    case "getProductDetails": {
      const { productId } = tool_args;
      
      const { data: p, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("tenant_id", tenant_id)
        .single();
      
      if (error) throw new Error(error.message);
      if (!p) return { success: false, error: "Produto não encontrado." };
      
      // Get categories
      const { data: cats } = await supabase
        .from("product_categories")
        .select("categories(name)")
        .eq("product_id", productId);
      
      const catNames = (cats || []).map((c: any) => c.categories?.name).filter(Boolean).join(", ");
      
      const warrantyLabel = p.warranty_type === 'seller' ? 'Vendedor' : p.warranty_type === 'manufacturer' ? 'Fábrica' : p.warranty_type === 'none' ? 'Sem Garantia' : p.warranty_type || '—';
      
      return {
        success: true,
        message: `📦 **${p.name}**\n\n` +
          `**Identificação:**\n` +
          `• SKU: ${p.sku || "—"}\n` +
          `• Barcode: ${p.barcode || "—"}\n` +
          `• GTIN/EAN: ${p.gtin || "—"}\n` +
          `• Marca: ${p.brand || "—"}\n` +
          `• Fornecedor: ${p.vendor || "—"}\n` +
          `• Formato: ${p.product_format || "simple"}\n` +
          `• Tipo: ${p.product_type || "—"}\n` +
          `• Tags: ${p.tags?.length ? p.tags.join(", ") : "—"}\n` +
          `• Destaque: ${p.is_featured ? "✅" : "❌"}\n\n` +
          `**Preços:**\n` +
          `• Preço: R$ ${(p.price || 0).toFixed(2)}\n` +
          `• Preço original: ${p.compare_at_price ? `R$ ${p.compare_at_price.toFixed(2)}` : "—"}\n` +
          `• Custo: ${p.cost_price ? `R$ ${p.cost_price.toFixed(2)}` : "—"}\n` +
          `• Promoção: ${p.promotion_start_date ? `${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(p.promotion_start_date))} até ${p.promotion_end_date ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(p.promotion_end_date)) : "—"}` : "—"}\n\n` +
          `**Estoque:**\n` +
          `• Quantidade: ${p.stock_quantity ?? 0}\n` +
          `• Controle de estoque: ${p.manage_stock ? "✅" : "❌"}\n` +
          `• Estoque baixo (alerta): ${p.low_stock_threshold ?? "—"}\n` +
          `• Permite backorder: ${p.allow_backorder ? "✅" : "❌"}\n` +
          `• Status: ${p.status === "active" ? "Ativo" : "Inativo"}\n\n` +
          `**Logística:**\n` +
          `• Peso: ${p.weight ? `${p.weight}g` : "—"}\n` +
          `• Dimensões (L×A×C): ${p.width || "—"}×${p.height || "—"}×${p.depth || p.length || "—"} cm\n` +
          `• Requer envio: ${p.requires_shipping !== false ? "✅" : "❌"}\n` +
          `• Frete grátis: ${p.free_shipping ? "✅" : "❌"}\n\n` +
          `**Fiscal:**\n` +
          `• NCM: ${p.ncm || "—"}\n` +
          `• CEST: ${p.cest || "—"}\n` +
          `• Código de origem: ${p.origin_code || "—"}\n` +
          `• Tributável: ${p.taxable !== false ? "✅" : "❌"}\n` +
          `• Código fiscal: ${p.tax_code || "—"}\n` +
          `• ANVISA/Regulatório: ${p.regulatory_info ? JSON.stringify(p.regulatory_info) : "—"}\n\n` +
          `**Garantia:**\n` +
          `• Tipo: ${warrantyLabel}\n` +
          `• Duração: ${p.warranty_duration || "—"}\n\n` +
          `**Conteúdo:**\n` +
          `• Categorias: ${catNames || "Nenhuma"}\n` +
          `• Descrição curta: ${p.short_description ? p.short_description.substring(0, 150) : "—"}\n` +
          `• Descrição: ${p.description ? p.description.substring(0, 200) + (p.description.length > 200 ? "..." : "") : "—"}\n\n` +
          `**SEO:**\n` +
          `• Title: ${p.seo_title || "—"}\n` +
          `• Description: ${p.seo_description || "—"}\n` +
          `• Keywords: ${p.meta_keywords || "—"}\n\n` +
          `• Criado em: ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(p.created_at))}`,
        data: p,
      };
    }

    case "searchOrders": {
      const { query, status, startDate, endDate, limit } = tool_args;
      const maxResults = limit || 20;
      
      let q = supabase
        .from("orders")
        .select("id, order_number, status, payment_status, total, customer_name, customer_email, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(maxResults);
      
      if (query) {
        q = q.or(`order_number.ilike.%${query}%,customer_name.ilike.%${query}%,customer_email.ilike.%${query}%`);
      }
      if (status) q = q.eq("status", status);
      if (startDate) q = q.gte("created_at", startDate);
      if (endDate) q = q.lte("created_at", endDate);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhum pedido encontrado.", data: [] };
      }
      
      const list = data.map((o: any) => 
        `• #${o.order_number} — ${o.customer_name || "—"} — R$ ${(o.total || 0).toFixed(2)} — ${o.status} — ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(o.created_at))}`
      ).join("\n");
      
      return {
        success: true,
        message: `📋 **${data.length} pedido(s):**\n\n${list}`,
        data,
      };
    }

    case "getOrderDetails": {
      const { orderId } = tool_args;
      
      const { data: o, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("tenant_id", tenant_id)
        .single();
      
      if (error) throw new Error(error.message);
      if (!o) return { success: false, error: "Pedido não encontrado." };
      
      // Get items
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, quantity, unit_price, total_price, sku")
        .eq("order_id", orderId);
      
      const itemsList = (items || []).map((i: any) => 
        `  • ${i.product_name} (x${i.quantity}) — R$ ${(i.total_price || 0).toFixed(2)}`
      ).join("\n");
      
      return {
        success: true,
        message: `📋 **Pedido #${o.order_number}**\n\n` +
          `• Status: ${o.status}\n` +
          `• Pagamento: ${o.payment_status} (${o.payment_method || "—"})\n` +
          `• Total: R$ ${(o.total || 0).toFixed(2)}\n` +
          `• Subtotal: R$ ${(o.subtotal || 0).toFixed(2)}\n` +
          `• Frete: R$ ${(o.shipping_total || 0).toFixed(2)}\n` +
          `• Desconto: R$ ${(o.discount_total || 0).toFixed(2)}\n` +
          `• Cliente: ${o.customer_name || "—"} (${o.customer_email || "—"})\n` +
          `• Telefone: ${o.customer_phone || "—"}\n` +
          `• Rastreio: ${o.tracking_code || "—"}\n` +
          `• Transportadora: ${o.shipping_carrier || "—"}\n` +
          `• Endereço: ${[o.shipping_street, o.shipping_number, o.shipping_complement, o.shipping_neighborhood, o.shipping_city, o.shipping_state, o.shipping_postal_code].filter(Boolean).join(", ") || "—"}\n` +
          `• Notas: ${o.notes || "—"}\n` +
          `• Data: ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(o.created_at))}\n\n` +
          `**Itens:**\n${itemsList || "  Nenhum item"}`,
        data: { ...o, items },
      };
    }

    case "listDiscounts": {
      const { status, limit } = tool_args;
      const maxResults = limit || 20;
      
      let q = supabase
        .from("discounts")
        .select("id, name, code, type, value, is_active, usage_limit_total, starts_at, ends_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(maxResults);
      
      if (status === "active") q = q.eq("is_active", true);
      else if (status === "inactive") q = q.eq("is_active", false);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhum cupom encontrado.", data: [] };
      }
      
      const list = data.map((d: any) => {
        const valueStr = d.type === "percentage" ? `${d.value}%` : `R$ ${(d.value / 100).toFixed(2)}`;
        return `• ${d.code} — ${valueStr} off — ${d.is_active ? "Ativo" : "Inativo"} — Limite: ${d.usage_limit_total || "∞"}`;
      }).join("\n");
      
      return {
        success: true,
        message: `🏷️ **${data.length} cupom(ns):**\n\n${list}`,
        data,
      };
    }

    case "listCategories": {
      const { status } = tool_args;
      
      let q = supabase
        .from("categories")
        .select("id, name, slug, is_active, parent_id, created_at")
        .eq("tenant_id", tenant_id)
        .order("name");
      
      if (status === "active") q = q.eq("is_active", true);
      else if (status === "inactive") q = q.eq("is_active", false);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhuma categoria encontrada.", data: [] };
      }
      
      const list = data.map((c: any) => 
        `• ${c.name} (${c.slug}) — ${c.is_active ? "Ativa" : "Inativa"}${c.parent_id ? " (subcategoria)" : ""}`
      ).join("\n");
      
      return {
        success: true,
        message: `📂 **${data.length} categoria(s):**\n\n${list}`,
        data,
      };
    }

    case "getDashboardStats": {
      const { period } = tool_args;
      const p = period || "month";
      
      let start = new Date();
      switch (p) {
        case "today": start.setHours(0, 0, 0, 0); break;
        case "week": start.setDate(start.getDate() - 7); break;
        case "month": start.setMonth(start.getMonth() - 1); break;
        case "year": start.setFullYear(start.getFullYear() - 1); break;
      }
      
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, status, payment_status")
        .eq("tenant_id", tenant_id)
        .gte("created_at", start.toISOString());
      
      const { data: customers } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .is("deleted_at", null)
        .gte("created_at", start.toISOString());
      
      const { data: products } = await supabase
        .from("products")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .is("deleted_at", null);
      
      const totalOrders = orders?.length || 0;
      const paidOrders = orders?.filter((o: any) => o.payment_status === "approved") || [];
      const revenue = paidOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
      const avgTicket = paidOrders.length > 0 ? revenue / paidOrders.length : 0;
      
      return {
        success: true,
        message: `📊 **Dashboard (${p})**\n\n` +
          `• Pedidos: ${totalOrders}\n` +
          `• Pedidos pagos: ${paidOrders.length}\n` +
          `• Receita: R$ ${revenue.toFixed(2)}\n` +
          `• Ticket médio: R$ ${avgTicket.toFixed(2)}\n` +
          `• Novos clientes: ${customers?.length || 0}\n` +
          `• Produtos ativos: ${products?.length || 0}`,
        data: { totalOrders, paidOrders: paidOrders.length, revenue, avgTicket, newCustomers: customers?.length || 0, activeProducts: products?.length || 0 },
      };
    }

    case "getTopProducts": {
      const { period, limit } = tool_args;
      const p = period || "month";
      const maxResults = limit || 10;
      
      let start = new Date();
      switch (p) {
        case "week": start.setDate(start.getDate() - 7); break;
        case "month": start.setMonth(start.getMonth() - 1); break;
        case "year": start.setFullYear(start.getFullYear() - 1); break;
      }
      
      const { data: items, error } = await supabase
        .from("order_items")
        .select("product_name, product_id, quantity, total_price, orders!inner(tenant_id, created_at, payment_status)")
        .eq("orders.tenant_id", tenant_id)
        .eq("orders.payment_status", "approved")
        .gte("orders.created_at", start.toISOString());
      
      if (error) throw new Error(error.message);
      
      // Aggregate by product
      const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const item of items || []) {
        const key = item.product_id || item.product_name;
        const existing = productMap.get(key) || { name: item.product_name, qty: 0, revenue: 0 };
        existing.qty += item.quantity || 0;
        existing.revenue += item.total_price || 0;
        productMap.set(key, existing);
      }
      
      const sorted = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, maxResults);
      
      if (sorted.length === 0) {
        return { success: true, message: "Nenhuma venda encontrada no período.", data: [] };
      }
      
      const list = sorted.map((p, i) => 
        `${i + 1}. ${p.name} — ${p.qty} vendidos — R$ ${p.revenue.toFixed(2)}`
      ).join("\n");
      
      return {
        success: true,
        message: `🏆 **Top ${sorted.length} Produtos (${p}):**\n\n${list}`,
        data: sorted,
      };
    }

    case "listCustomerTags": {
      const { data, error } = await supabase
        .from("customer_tags")
        .select("id, name, color, description")
        .eq("tenant_id", tenant_id)
        .order("name");
      
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhuma tag de cliente encontrada.", data: [] };
      }
      
      const list = data.map((t: any) => `• ${t.name}${t.description ? ` — ${t.description}` : ""}`).join("\n");
      
      return {
        success: true,
        message: `🏷️ **${data.length} tag(s) de clientes:**\n\n${list}`,
        data,
      };
    }

    // ==================== FASE 2: CRUD COMPLETO ====================
    case "updateProduct": {
      const { productId, name, description, shortDescription, price, compareAtPrice, costPrice, sku, barcode, gtin, brand, vendor, weight, width, height, length: prodLength, depth, seoTitle, seoDescription, metaKeywords, isActive, isFeatured, stockQuantity, manageStock, lowStockThreshold, allowBackorder, freeShipping, requiresShipping, tags, warrantyType, warrantyDuration, ncmCode, cestCode, originCode, taxable, taxCode, promotionStartDate, promotionEndDate, regulatoryInfo } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (shortDescription !== undefined) updateData.short_description = shortDescription;
      if (price !== undefined) updateData.price = price;
      if (compareAtPrice !== undefined) updateData.compare_at_price = compareAtPrice;
      if (costPrice !== undefined) updateData.cost_price = costPrice;
      if (sku !== undefined) updateData.sku = sku;
      if (barcode !== undefined) updateData.barcode = barcode;
      if (gtin !== undefined) updateData.gtin = gtin;
      if (brand !== undefined) updateData.brand = brand;
      if (vendor !== undefined) updateData.vendor = vendor;
      if (weight !== undefined) updateData.weight = weight;
      if (width !== undefined) updateData.width = width;
      if (height !== undefined) updateData.height = height;
      if (prodLength !== undefined) updateData.length = prodLength;
      if (depth !== undefined) updateData.depth = depth;
      if (seoTitle !== undefined) updateData.seo_title = seoTitle;
      if (seoDescription !== undefined) updateData.seo_description = seoDescription;
      if (metaKeywords !== undefined) updateData.meta_keywords = metaKeywords;
      if (isActive !== undefined) updateData.status = isActive ? "active" : "inactive";
      if (isFeatured !== undefined) updateData.is_featured = isFeatured;
      if (stockQuantity !== undefined) updateData.stock_quantity = stockQuantity;
      if (manageStock !== undefined) updateData.manage_stock = manageStock;
      if (lowStockThreshold !== undefined) updateData.low_stock_threshold = lowStockThreshold;
      if (allowBackorder !== undefined) updateData.allow_backorder = allowBackorder;
      if (freeShipping !== undefined) updateData.free_shipping = freeShipping;
      if (requiresShipping !== undefined) updateData.requires_shipping = requiresShipping;
      if (tags !== undefined) updateData.tags = tags;
      if (warrantyType !== undefined) updateData.warranty_type = warrantyType;
      if (warrantyDuration !== undefined) updateData.warranty_duration = warrantyDuration;
      if (ncmCode !== undefined) updateData.ncm = ncmCode;
      if (cestCode !== undefined) updateData.cest = cestCode;
      if (originCode !== undefined) updateData.origin_code = originCode;
      if (taxable !== undefined) updateData.taxable = taxable;
      if (taxCode !== undefined) updateData.tax_code = taxCode;
      if (promotionStartDate !== undefined) updateData.promotion_start_date = promotionStartDate;
      if (promotionEndDate !== undefined) updateData.promotion_end_date = promotionEndDate;
      if (regulatoryInfo !== undefined) updateData.regulatory_info = regulatoryInfo;
      
      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", productId)
        .eq("tenant_id", tenant_id)
        .select("id, name")
        .single();
      
      if (error) throw new Error(error.message);
      
      const fields = Object.keys(updateData).filter(k => k !== "updated_at").join(", ");
      return {
        success: true,
        message: `✅ Produto "${data.name}" atualizado! Campos: ${fields}`,
        data,
      };
    }

    case "duplicateProduct": {
      const { productId } = tool_args;
      
      const { data: original, error: fetchError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("tenant_id", tenant_id)
        .single();
      
      if (fetchError || !original) throw new Error("Produto não encontrado.");
      
      const { id, created_at, updated_at, deleted_at, slug, ...productData } = original;
      const newName = `${original.name} (Cópia)`;
      const newSlug = `${original.slug}-copia-${Date.now()}`;
      
      const { data: newProduct, error: insertError } = await supabase
        .from("products")
        .insert({
          ...productData,
          name: newName,
          slug: newSlug,
          is_active: false, // starts as inactive
        })
        .select()
        .single();
      
      if (insertError) throw new Error(insertError.message);
      
      // Copy categories
      const { data: cats } = await supabase
        .from("product_categories")
        .select("category_id")
        .eq("product_id", productId);
      
      if (cats && cats.length > 0) {
        await supabase.from("product_categories").insert(
          cats.map((c: any) => ({ product_id: newProduct.id, category_id: c.category_id }))
        );
      }
      
      return {
        success: true,
        message: `✅ Produto "${original.name}" duplicado como "${newName}" (inativo por padrão).`,
        data: newProduct,
      };
    }

    case "deleteCustomer": {
      const { customerId } = tool_args;
      
      const { data, error } = await supabase
        .from("customers")
        .update({ deleted_at: new Date().toISOString(), status: "inactive" })
        .eq("id", customerId)
        .eq("tenant_id", tenant_id)
        .select("id, full_name")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Cliente "${data.full_name}" excluído com sucesso.`,
        data,
      };
    }

    case "addTrackingCode": {
      const { orderId, trackingCode, shippingCarrier } = tool_args;
      
      const updateData: any = {
        tracking_code: trackingCode,
        shipping_status: "shipped",
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (shippingCarrier) updateData.shipping_carrier = shippingCarrier;
      
      const { data, error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
        .eq("tenant_id", tenant_id)
        .select("id, order_number")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Código de rastreio "${trackingCode}" adicionado ao pedido #${data.order_number}!${shippingCarrier ? ` (${shippingCarrier})` : ""}`,
        data,
      };
    }

    case "cancelOrder": {
      const { orderId, reason } = tool_args;
      
      const updateData: any = {
        status: "cancelled",
        updated_at: new Date().toISOString(),
      };
      
      // Append cancellation reason to notes
      if (reason) {
        const { data: order } = await supabase
          .from("orders")
          .select("notes")
          .eq("id", orderId)
          .eq("tenant_id", tenant_id)
          .single();
        
        const timestamp = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
        const cancelNote = `[${timestamp}] ❌ CANCELADO: ${reason}`;
        updateData.notes = order?.notes ? `${order.notes}\n${cancelNote}` : cancelNote;
      }
      
      const { data, error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId)
        .eq("tenant_id", tenant_id)
        .select("id, order_number")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Pedido #${data.order_number} cancelado!${reason ? ` Motivo: ${reason}` : ""}`,
        data,
      };
    }

    case "createManualOrder": {
      const { customerEmail, customerName, items: orderItems, notes } = tool_args;
      
      if (!orderItems || orderItems.length === 0) {
        return { success: false, error: "É necessário pelo menos um item no pedido." };
      }
      
      // Fetch products
      const productIds = orderItems.map((i: any) => i.productId);
      const { data: products, error: prodError } = await supabase
        .from("products")
        .select("id, name, price, sku")
        .eq("tenant_id", tenant_id)
        .in("id", productIds);
      
      if (prodError) throw new Error(prodError.message);
      
      // Find or create customer
      let customerId: string | null = null;
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("email", customerEmail.toLowerCase())
        .is("deleted_at", null)
        .single();
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer } = await supabase
          .from("customers")
          .insert({ tenant_id, email: customerEmail.toLowerCase(), full_name: customerName, status: "active" })
          .select("id")
          .single();
        customerId = newCustomer?.id || null;
      }
      
      // Calculate totals
      let subtotal = 0;
      const itemsData: any[] = [];
      for (const item of orderItems) {
        const product = products?.find((p: any) => p.id === item.productId);
        if (!product) continue;
        const qty = item.quantity || 1;
        const totalPrice = product.price * qty;
        subtotal += totalPrice;
        itemsData.push({
          product_id: product.id,
          product_name: product.name,
          sku: product.sku || "",
          quantity: qty,
          unit_price: product.price,
          total_price: totalPrice,
        });
      }
      
      // Generate order number
      const orderNumber = `M${Date.now().toString().slice(-8)}`;
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          tenant_id,
          customer_id: customerId,
          customer_name: customerName,
          customer_email: customerEmail.toLowerCase(),
          order_number: orderNumber,
          status: "pending",
          payment_status: "pending",
          shipping_status: "pending",
          subtotal,
          total: subtotal,
          shipping_total: 0,
          discount_total: 0,
          notes: notes || null,
          source: "manual",
        })
        .select("id, order_number")
        .single();
      
      if (orderError) throw new Error(orderError.message);
      
      // Create order items
      for (const item of itemsData) {
        await supabase.from("order_items").insert({
          order_id: order.id,
          tenant_id,
          ...item,
        });
      }
      
      return {
        success: true,
        message: `✅ Pedido manual #${order.order_number} criado!\n• Cliente: ${customerName}\n• Itens: ${itemsData.length}\n• Total: R$ ${subtotal.toFixed(2)}`,
        data: order,
      };
    }

    case "createCustomerTag": {
      const { name, color, description } = tool_args;
      
      const { data, error } = await supabase
        .from("customer_tags")
        .insert({
          tenant_id,
          name,
          color: color || "#6B7280",
          description: description || null,
        })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Tag "${name}" criada com sucesso!`,
        data,
      };
    }

    case "removeCustomerTag": {
      const { customerIds, tagId } = tool_args;
      
      let deleteCount = 0;
      for (const customerId of customerIds) {
        const { error } = await supabase
          .from("customer_tag_assignments")
          .delete()
          .eq("customer_id", customerId)
          .eq("tag_id", tagId);
        
        if (!error) deleteCount++;
      }
      
      return {
        success: true,
        message: `✅ Tag removida de ${deleteCount} cliente(s)!`,
        data: { affected: deleteCount },
      };
    }

    // ==================== FASE 3: MARKETING E CRM ====================
    case "createBlogPost": {
      const { title, content, excerpt, status, seoTitle, seoDescription } = tool_args;
      const slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").substring(0, 100);
      
      const { data, error } = await supabase
        .from("blog_posts")
        .insert({
          tenant_id,
          title,
          slug,
          content: content || "",
          excerpt: excerpt || null,
          status: status || "draft",
          seo_title: seoTitle || title,
          seo_description: seoDescription || excerpt || null,
          author_id: user_id,
        })
        .select("id, title, slug, status")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Post "${title}" criado como ${data.status === "published" ? "publicado" : "rascunho"}!`,
        data,
      };
    }

    case "updateBlogPost": {
      const { postId, title, content, excerpt, status } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (excerpt !== undefined) updateData.excerpt = excerpt;
      if (status !== undefined) {
        updateData.status = status;
        if (status === "published") updateData.published_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from("blog_posts")
        .update(updateData)
        .eq("id", postId)
        .eq("tenant_id", tenant_id)
        .select("id, title, status")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Post "${data.title}" atualizado!`,
        data,
      };
    }

    case "deleteBlogPost": {
      const { postId } = tool_args;
      
      const { data, error } = await supabase
        .from("blog_posts")
        .delete()
        .eq("id", postId)
        .eq("tenant_id", tenant_id)
        .select("id, title")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Post "${data.title}" excluído!`,
        data,
      };
    }

    case "listBlogPosts": {
      const { status, limit } = tool_args;
      const maxResults = limit || 20;
      
      let q = supabase
        .from("blog_posts")
        .select("id, title, slug, status, view_count, published_at, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(maxResults);
      
      if (status && status !== "all") q = q.eq("status", status);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhum post encontrado.", data: [] };
      }
      
      const list = data.map((p: any) => 
        `• ${p.title} — ${p.status === "published" ? "Publicado" : "Rascunho"} — ${p.view_count || 0} visualizações`
      ).join("\n");
      
      return {
        success: true,
        message: `📝 **${data.length} post(s):**\n\n${list}`,
        data,
      };
    }

    case "createOffer": {
      const { name, type, triggerProductId, offerProductId, discountPercent, isActive } = tool_args;
      
      const { data, error } = await supabase
        .from("offers")
        .insert({
          tenant_id,
          name,
          type: type || "bump",
          trigger_product_id: triggerProductId || null,
          offer_product_id: offerProductId,
          discount_percent: discountPercent || 0,
          is_active: isActive !== false,
        })
        .select("id, name, type")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Oferta "${name}" (${data.type}) criada!`,
        data,
      };
    }

    case "updateOffer": {
      const { offerId, name, discountPercent, isActive } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (discountPercent !== undefined) updateData.discount_percent = discountPercent;
      if (isActive !== undefined) updateData.is_active = isActive;
      
      const { data, error } = await supabase
        .from("offers")
        .update(updateData)
        .eq("id", offerId)
        .eq("tenant_id", tenant_id)
        .select("id, name")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Oferta "${data.name}" atualizada!`,
        data,
      };
    }

    case "deleteOffer": {
      const { offerId } = tool_args;
      
      const { data, error } = await supabase
        .from("offers")
        .delete()
        .eq("id", offerId)
        .eq("tenant_id", tenant_id)
        .select("id, name")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Oferta "${data.name}" excluída!`,
        data,
      };
    }

    case "listOffers": {
      const { type, status } = tool_args;
      
      let q = supabase
        .from("offers")
        .select("id, name, type, discount_percent, is_active, offer_product_id, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      
      if (type && type !== "all") q = q.eq("type", type);
      if (status === "active") q = q.eq("is_active", true);
      else if (status === "inactive") q = q.eq("is_active", false);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhuma oferta encontrada.", data: [] };
      }
      
      const list = data.map((o: any) => 
        `• ${o.name} (${o.type}) — ${o.discount_percent}% off — ${o.is_active ? "Ativa" : "Inativa"}`
      ).join("\n");
      
      return {
        success: true,
        message: `🎯 **${data.length} oferta(s):**\n\n${list}`,
        data,
      };
    }

    case "listReviews": {
      const { status, limit } = tool_args;
      const maxResults = limit || 20;
      
      let q = supabase
        .from("product_reviews")
        .select("id, rating, title, comment, customer_name, status, product_id, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(maxResults);
      
      if (status && status !== "all") q = q.eq("status", status);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhuma avaliação encontrada.", data: [] };
      }
      
      const list = data.map((r: any) => 
        `• ${"⭐".repeat(r.rating || 0)} — ${r.customer_name || "Anônimo"} — "${r.title || r.comment?.substring(0, 50) || "—"}" — ${r.status}`
      ).join("\n");
      
      return {
        success: true,
        message: `⭐ **${data.length} avaliação(ões):**\n\n${list}`,
        data,
      };
    }

    case "approveReview": {
      const { reviewId } = tool_args;
      
      const { data, error } = await supabase
        .from("product_reviews")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", reviewId)
        .eq("tenant_id", tenant_id)
        .select("id, title, customer_name")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Avaliação de "${data.customer_name || "Anônimo"}" aprovada!`,
        data,
      };
    }

    case "rejectReview": {
      const { reviewId } = tool_args;
      
      const { data, error } = await supabase
        .from("product_reviews")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", reviewId)
        .eq("tenant_id", tenant_id)
        .select("id, title, customer_name")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `❌ Avaliação de "${data.customer_name || "Anônimo"}" rejeitada.`,
        data,
      };
    }

    case "respondToReview": {
      const { reviewId, response } = tool_args;
      
      const { data, error } = await supabase
        .from("product_reviews")
        .update({ store_response: response, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", reviewId)
        .eq("tenant_id", tenant_id)
        .select("id, customer_name")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Resposta enviada para avaliação de "${data.customer_name || "Anônimo"}"!`,
        data,
      };
    }

    // ==================== FASE 4: OPERACIONAL ====================
    case "listPages": {
      const { status } = tool_args;
      
      let q = supabase
        .from("store_pages")
        .select("id, title, slug, status, is_published, is_system, type, created_at")
        .eq("tenant_id", tenant_id)
        .order("title");
      
      if (status === "published") q = q.eq("is_published", true);
      else if (status === "draft") q = q.eq("is_published", false);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhuma página encontrada.", data: [] };
      }
      
      const list = data.map((p: any) => 
        `• ${p.title} (/${p.slug}) — ${p.is_published ? "Publicada" : "Rascunho"}${p.is_system ? " [Sistema]" : ""}`
      ).join("\n");
      
      return {
        success: true,
        message: `📄 **${data.length} página(s):**\n\n${list}`,
        data,
      };
    }

    case "createPage": {
      const { title, slug, content, seoTitle, seoDescription, status } = tool_args;
      const finalSlug = slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const isPublished = status === "published";
      
      const { data, error } = await supabase
        .from("store_pages")
        .insert({
          tenant_id,
          title,
          slug: finalSlug,
          type: "custom",
          status: isPublished ? "published" : "draft",
          is_published: isPublished,
          seo_title: seoTitle || title,
          seo_description: seoDescription || null,
        })
        .select("id, title, slug")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Página "${title}" criada!`,
        data,
      };
    }

    case "updatePage": {
      const { pageId, title, content, seoTitle, seoDescription, status } = tool_args;
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updateData.title = title;
      if (seoTitle !== undefined) updateData.seo_title = seoTitle;
      if (seoDescription !== undefined) updateData.seo_description = seoDescription;
      if (status !== undefined) {
        updateData.status = status;
        updateData.is_published = status === "published";
      }
      
      const { data, error } = await supabase
        .from("store_pages")
        .update(updateData)
        .eq("id", pageId)
        .eq("tenant_id", tenant_id)
        .select("id, title")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Página "${data.title}" atualizada!`,
        data,
      };
    }

    case "getFinancialSummary": {
      const { period } = tool_args;
      const p = period || "month";
      
      let start = new Date();
      switch (p) {
        case "today": start.setHours(0, 0, 0, 0); break;
        case "week": start.setDate(start.getDate() - 7); break;
        case "month": start.setMonth(start.getMonth() - 1); break;
        case "year": start.setFullYear(start.getFullYear() - 1); break;
      }
      
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, subtotal, shipping_total, discount_total, status, payment_status")
        .eq("tenant_id", tenant_id)
        .gte("created_at", start.toISOString());
      
      const paidOrders = (orders || []).filter((o: any) => o.payment_status === "approved");
      const revenue = paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      const shippingTotal = paidOrders.reduce((s: number, o: any) => s + (o.shipping_total || 0), 0);
      const discountTotal = paidOrders.reduce((s: number, o: any) => s + (o.discount_total || 0), 0);
      const subtotal = paidOrders.reduce((s: number, o: any) => s + (o.subtotal || 0), 0);
      
      return {
        success: true,
        message: `💰 **Resumo Financeiro (${p})**\n\n` +
          `• Receita total: R$ ${revenue.toFixed(2)}\n` +
          `• Subtotal produtos: R$ ${subtotal.toFixed(2)}\n` +
          `• Frete cobrado: R$ ${shippingTotal.toFixed(2)}\n` +
          `• Descontos concedidos: R$ ${discountTotal.toFixed(2)}\n` +
          `• Pedidos pagos: ${paidOrders.length}\n` +
          `• Ticket médio: R$ ${paidOrders.length > 0 ? (revenue / paidOrders.length).toFixed(2) : "0.00"}`,
        data: { revenue, subtotal, shippingTotal, discountTotal, paidOrders: paidOrders.length },
      };
    }

    case "listShippingMethods": {
      const { data, error } = await supabase
        .from("shipping_methods")
        .select("id, name, type, is_active, price, min_days, max_days")
        .eq("tenant_id", tenant_id)
        .order("name");
      
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhum método de frete configurado.", data: [] };
      }
      
      const list = data.map((m: any) => 
        `• ${m.name} (${m.type || "—"}) — ${m.is_active ? "Ativo" : "Inativo"} — R$ ${(m.price || 0).toFixed(2)}${m.min_days ? ` — ${m.min_days}-${m.max_days} dias` : ""}`
      ).join("\n");
      
      return {
        success: true,
        message: `🚚 **${data.length} método(s) de frete:**\n\n${list}`,
        data,
      };
    }

    case "listNotifications": {
      const { limit, unreadOnly } = tool_args;
      const maxResults = limit || 20;
      
      let q = supabase
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(maxResults);
      
      if (unreadOnly) q = q.eq("is_read", false);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: unreadOnly ? "Nenhuma notificação não lida." : "Nenhuma notificação encontrada.", data: [] };
      }
      
      const list = data.map((n: any) => 
        `${n.is_read ? "📭" : "📬"} ${n.title || n.message?.substring(0, 60) || "—"} — ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(n.created_at))}`
      ).join("\n");
      
      return {
        success: true,
        message: `🔔 **${data.length} notificação(ões):**\n\n${list}`,
        data,
      };
    }

    case "markNotificationRead": {
      const { notificationId } = tool_args;
      
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("tenant_id", tenant_id);
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Notificação marcada como lida.`,
      };
    }

    case "listFiles": {
      const { folder, limit } = tool_args;
      const maxResults = limit || 20;
      
      let q = supabase
        .from("media_files")
        .select("id, file_name, file_size, mime_type, folder, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(maxResults);
      
      if (folder) q = q.eq("folder", folder);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhum arquivo encontrado.", data: [] };
      }
      
      const list = data.map((f: any) => {
        const size = f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : "—";
        return `• ${f.file_name} (${size}) — ${f.folder || "raiz"} — ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(f.created_at))}`;
      }).join("\n");
      
      return {
        success: true,
        message: `📁 **${data.length} arquivo(s):**\n\n${list}`,
        data,
      };
    }

    case "getStorageUsage": {
      const { data, error } = await supabase
        .from("media_files")
        .select("file_size")
        .eq("tenant_id", tenant_id);
      
      if (error) throw new Error(error.message);
      
      const totalFiles = data?.length || 0;
      const totalBytes = (data || []).reduce((s: number, f: any) => s + (f.file_size || 0), 0);
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
      
      return {
        success: true,
        message: `💾 **Uso de Armazenamento**\n\n• Arquivos: ${totalFiles}\n• Espaço usado: ${totalMB} MB`,
        data: { totalFiles, totalBytes, totalMB },
      };
    }

    // ==================== FASE 5: EMAIL MARKETING ====================
    case "listEmailLists": {
      const { data, error } = await supabase
        .from("email_marketing_lists")
        .select("id, name, description, tag_id, created_at")
        .eq("tenant_id", tenant_id)
        .order("name");
      
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhuma lista de email encontrada.", data: [] };
      }
      
      // Get member counts
      const listsWithCounts = await Promise.all(data.map(async (l: any) => {
        const { count } = await supabase
          .from("email_marketing_list_members")
          .select("id", { count: "exact", head: true })
          .eq("list_id", l.id);
        return { ...l, member_count: count || 0 };
      }));
      
      const list = listsWithCounts.map((l: any) => 
        `• ${l.name} — ${l.member_count} inscrito(s)${l.description ? ` — ${l.description}` : ""}`
      ).join("\n");
      
      return {
        success: true,
        message: `📧 **${data.length} lista(s) de email:**\n\n${list}`,
        data: listsWithCounts,
      };
    }

    case "listSubscribers": {
      const { listId, status, limit } = tool_args;
      const maxResults = limit || 20;
      const filterStatus = status || "active";
      
      const { data: members, error } = await supabase
        .from("email_marketing_list_members")
        .select("subscriber_id, email_marketing_subscribers(id, email, name, status, created_at)")
        .eq("list_id", listId)
        .eq("tenant_id", tenant_id)
        .limit(maxResults);
      
      if (error) throw new Error(error.message);
      
      let subscribers = (members || [])
        .map((m: any) => m.email_marketing_subscribers)
        .filter(Boolean);
      
      if (filterStatus !== "all") {
        subscribers = subscribers.filter((s: any) => s.status === filterStatus);
      }
      
      if (subscribers.length === 0) {
        return { success: true, message: "Nenhum inscrito encontrado.", data: [] };
      }
      
      const list = subscribers.map((s: any) => 
        `• ${s.name || "—"} (${s.email}) — ${s.status}`
      ).join("\n");
      
      return {
        success: true,
        message: `👥 **${subscribers.length} inscrito(s):**\n\n${list}`,
        data: subscribers,
      };
    }

    case "addSubscriber": {
      const { listId, email, name } = tool_args;
      
      // Use upsert_subscriber_only — adding subscriber NEVER creates customer
      const { data, error } = await supabase.rpc("upsert_subscriber_only", {
        p_tenant_id: tenant_id,
        p_email: email.toLowerCase().trim(),
        p_name: name || null,
        p_source: "command_assistant",
        p_list_id: listId,
      });
      
      if (error) throw new Error(error.message);
      
      const result = data?.[0] || data;
      return {
        success: true,
        message: `✅ Inscrito "${email}" adicionado à lista!${result?.is_new_subscriber ? " (novo)" : " (já existia)"}`,
        data: result,
      };
    }

    case "createEmailCampaign": {
      const { name, subject, listId, templateId } = tool_args;
      
      const { data, error } = await supabase
        .from("email_marketing_campaigns")
        .insert({
          tenant_id,
          name,
          subject: subject || name,
          list_id: listId,
          template_id: templateId || null,
          type: "broadcast",
          status: "draft",
        })
        .select("id, name, status")
        .single();
      
      if (error) throw new Error(error.message);
      
      return {
        success: true,
        message: `✅ Campanha "${name}" criada como rascunho!`,
        data,
      };
    }

    case "listCampaigns": {
      const { status, limit } = tool_args;
      const maxResults = limit || 20;
      
      let q = supabase
        .from("email_marketing_campaigns")
        .select("id, name, status, type, sent_count, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(maxResults);
      
      if (status && status !== "all") q = q.eq("status", status);
      
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      
      if (!data || data.length === 0) {
        return { success: true, message: "Nenhuma campanha encontrada.", data: [] };
      }
      
      const list = data.map((c: any) => 
        `• ${c.name} (${c.type}) — ${c.status} — ${c.sent_count || 0} enviados`
      ).join("\n");
      
      return {
        success: true,
        message: `📨 **${data.length} campanha(s):**\n\n${list}`,
        data,
      };
    }

    // ==================== RECALCULAR PREÇOS DE KITS ====================
    case "recalculateKitPrices": {
      const { productIds, removeCompareAtPrice } = tool_args;
      
      // Find all kits that contain any of the given products as components
      // NOTE: product_components does NOT have tenant_id — tenant isolation is via products table
      
      // First, get kit IDs scoped to this tenant
      let kitIds: Set<string>;
      // Treat empty array same as no productIds — recalculate ALL kits
      if (productIds && Array.isArray(productIds) && productIds.length > 0) {
        // Find kits containing the specified products
        const { data: affectedComponents } = await supabase
          .from("product_components")
          .select("parent_product_id")
          .in("component_product_id", productIds);
        
        const candidateKitIds = [...new Set((affectedComponents || []).map((c: any) => c.parent_product_id))];
        
        if (candidateKitIds.length === 0) {
          return { success: true, message: "Nenhum kit encontrado com esses produtos como componentes.", data: { affected: 0 } };
        }
        
        // Validate these kits belong to this tenant
        const { data: tenantKits } = await supabase
          .from("products")
          .select("id")
          .in("id", candidateKitIds)
          .eq("tenant_id", tenant_id);
        
        kitIds = new Set((tenantKits || []).map((k: any) => k.id));
        if (kitIds.size === 0) {
          return { success: true, message: "Nenhum kit encontrado com esses produtos como componentes.", data: { affected: 0 } };
        }
      } else {
        // Get all kits for this tenant
        const { data: tenantKits } = await supabase
          .from("products")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("product_format", "with_composition");
        
        kitIds = new Set((tenantKits || []).map((k: any) => k.id));
        if (kitIds.size === 0) {
          return { success: true, message: "Nenhum kit para recalcular.", data: { affected: 0 } };
        }
      }
      
      // Fetch all components for the identified kits
      const { data: allComponents, error: compError } = await supabase
        .from("product_components")
        .select(`
          parent_product_id,
          quantity,
          sale_price,
          component:products!component_product_id(
            id, name, sku, price
          )
        `)
        .in("parent_product_id", Array.from(kitIds))
        .order("sort_order");
      if (compError) throw new Error(compError.message);
      
      // Group components by parent kit
      const componentsByKit = new Map<string, any[]>();
      for (const comp of (allComponents || [])) {
        const list = componentsByKit.get(comp.parent_product_id) || [];
        list.push(comp);
        componentsByKit.set(comp.parent_product_id, list);
      }
      
      if (componentsByKit.size === 0) {
        return { success: true, message: "Nenhum kit para recalcular.", data: { affected: 0 } };
      }
      
      // Get current kit product info
      const kitProductIds = Array.from(componentsByKit.keys());
      const { data: kitProducts } = await supabase
        .from("products")
        .select("id, name, sku, price, compare_at_price")
        .in("id", kitProductIds)
        .eq("tenant_id", tenant_id);
      
      const kitProductMap = new Map((kitProducts || []).map((p: any) => [p.id, p]));
      
      // Calculate new prices and update
      const report: any[] = [];
      let updateCount = 0;
      
      for (const [kitId, components] of componentsByKit) {
        const kit = kitProductMap.get(kitId);
        if (!kit) continue;
        
        // Sum: component_price × quantity
        const newPrice = components.reduce((sum: number, c: any) => {
          const compPrice = c.sale_price ?? c.component?.price ?? 0;
          return sum + (parseFloat(compPrice) * c.quantity);
        }, 0);
        
        const roundedPrice = Math.round(newPrice * 100) / 100;
        const oldPrice = parseFloat(kit.price) || 0;
        
        const updateData: any = { price: roundedPrice, updated_at: new Date().toISOString() };
        if (removeCompareAtPrice) {
          updateData.compare_at_price = null;
        }
        
        const { error: updateError } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", kitId)
          .eq("tenant_id", tenant_id);
        
        if (!updateError) {
          updateCount++;
          report.push({
            name: kit.name,
            sku: kit.sku,
            oldPrice,
            newPrice: roundedPrice,
            components: components.length,
          });
        }
      }
      
      const reportLines = report.map((r: any) => 
        `• **${r.name}** (${r.sku}): R$ ${r.oldPrice.toFixed(2)} → R$ ${r.newPrice.toFixed(2)} (${r.components} componentes)`
      ).join("\n");
      
      return {
        success: true,
        message: `✅ **${updateCount} kit(s) recalculado(s):**\n\n${reportLines}` +
          (removeCompareAtPrice ? `\n\n🏷️ Preços de desconto removidos dos kits.` : ''),
        data: { affected: updateCount, report },
      };
    }

    // ==================== LISTAR KITS COM RESUMO ====================
    case "listKitsSummary": {
      const { minUnits, maxUnits } = tool_args;
      
      // Get all kits for this tenant
      const { data: kits, error: kitsErr } = await supabase
        .from("products")
        .select("id, name, sku, price, compare_at_price, status, free_shipping")
        .eq("tenant_id", tenant_id)
        .eq("product_format", "with_composition")
        .is("deleted_at", null)
        .order("name");
      
      if (kitsErr) throw new Error(kitsErr.message);
      if (!kits || kits.length === 0) {
        return { success: true, message: "Nenhum kit encontrado.", data: [] };
      }
      
      // Get all components for all kits
      const kitIds = kits.map((k: any) => k.id);
      const { data: allComps, error: compsErr } = await supabase
        .from("product_components")
        .select("parent_product_id, quantity")
        .in("parent_product_id", kitIds);
      
      if (compsErr) throw new Error(compsErr.message);
      
      // Sum total units per kit
      const unitsByKit = new Map<string, number>();
      for (const comp of (allComps || [])) {
        const current = unitsByKit.get(comp.parent_product_id) || 0;
        unitsByKit.set(comp.parent_product_id, current + comp.quantity);
      }
      
      // Build results with optional filtering
      let results = kits.map((k: any) => ({
        kitId: k.id,
        name: k.name,
        sku: k.sku,
        price: k.price,
        compareAtPrice: k.compare_at_price,
        status: k.status,
        freeShipping: k.free_shipping || false,
        totalUnits: unitsByKit.get(k.id) || 0,
      }));
      
      if (minUnits !== undefined && minUnits !== null) {
        results = results.filter((r: any) => r.totalUnits >= minUnits);
      }
      if (maxUnits !== undefined && maxUnits !== null) {
        results = results.filter((r: any) => r.totalUnits <= maxUnits);
      }
      
      // Sort by totalUnits
      results.sort((a: any, b: any) => a.totalUnits - b.totalUnits);
      
      const lines = results.map((r: any, i: number) =>
        `${i + 1}. **${r.name}** (SKU: ${r.sku}) — ${r.totalUnits} unidades, Preço: R$ ${Number(r.price).toFixed(2)}${r.compareAtPrice ? ` (de R$ ${Number(r.compareAtPrice).toFixed(2)})` : ''} — Frete grátis: ${r.freeShipping ? '✅' : '❌'}`
      ).join("\n");
      
      return {
        success: true,
        message: `📦 **${results.length} kit(s) encontrado(s):**\n\n${lines}`,
        data: results,
      };
    }

    // ==================== APLICAR DESCONTO PERCENTUAL EM KITS ====================
    case "applyKitDiscount": {
      const { discounts } = tool_args;
      
      if (!discounts || !Array.isArray(discounts) || discounts.length === 0) {
        return { success: false, error: "Parâmetro 'discounts' é obrigatório: array de {kitId, discountPercent}" };
      }
      
      // Validate all entries
      for (const d of discounts) {
        if (!d.kitId || !d.discountPercent) {
          return { success: false, error: "Cada item deve ter kitId (UUID) e discountPercent (1-99)" };
        }
        if (d.discountPercent < 1 || d.discountPercent > 99) {
          return { success: false, error: `Desconto inválido: ${d.discountPercent}%. Deve ser entre 1 e 99.` };
        }
      }
      
      const kitIds = discounts.map((d: any) => d.kitId);
      
      // Validate kits belong to tenant
      const { data: validKits, error: vErr } = await supabase
        .from("products")
        .select("id, name, sku, product_format")
        .in("id", kitIds)
        .eq("tenant_id", tenant_id)
        .eq("product_format", "with_composition");
      
      if (vErr) throw new Error(vErr.message);
      
      const validKitMap = new Map((validKits || []).map((k: any) => [k.id, k]));
      
      // Get components to calculate full price
      const { data: allComps2, error: compErr2 } = await supabase
        .from("product_components")
        .select(`
          parent_product_id,
          quantity,
          sale_price,
          component:products!component_product_id(price)
        `)
        .in("parent_product_id", kitIds);
      
      if (compErr2) throw new Error(compErr2.message);
      
      // Calculate full price (sum of components) per kit
      const fullPriceByKit = new Map<string, number>();
      for (const comp of (allComps2 || [])) {
        const compPrice = comp.sale_price ?? comp.component?.price ?? 0;
        const current = fullPriceByKit.get(comp.parent_product_id) || 0;
        fullPriceByKit.set(comp.parent_product_id, current + (parseFloat(compPrice) * comp.quantity));
      }
      
      const report: any[] = [];
      let updateCount = 0;
      
      for (const d of discounts) {
        const kit = validKitMap.get(d.kitId);
        if (!kit) continue;
        
        const fullPrice = fullPriceByKit.get(d.kitId) || 0;
        if (fullPrice <= 0) continue;
        
        const discountedPrice = Math.round(fullPrice * (1 - d.discountPercent / 100) * 100) / 100;
        const roundedFullPrice = Math.round(fullPrice * 100) / 100;
        
        const { error: updateErr } = await supabase
          .from("products")
          .update({
            price: discountedPrice,
            compare_at_price: roundedFullPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", d.kitId)
          .eq("tenant_id", tenant_id);
        
        if (!updateErr) {
          updateCount++;
          report.push({
            name: kit.name,
            sku: kit.sku,
            fullPrice: roundedFullPrice,
            discountPercent: d.discountPercent,
            finalPrice: discountedPrice,
          });
        }
      }
      
      const reportLines = report.map((r: any) =>
        `• **${r.name}** (${r.sku}): De R$ ${r.fullPrice.toFixed(2)} → R$ ${r.finalPrice.toFixed(2)} (-${r.discountPercent}%)`
      ).join("\n");
      
      return {
        success: true,
        message: `✅ **${updateCount} kit(s) com desconto aplicado:**\n\n${reportLines}`,
        data: { affected: updateCount, report },
      };
    }

    // ==================== v4.0.0: NEW TOOLS ====================
    // --- Fiscal ---
    case "listFiscalDrafts": {
      const { status, limit } = tool_args;
      let q = supabase.from("fiscal_draft_queue").select("id, order_id, status, attempts, error_message, created_at, processed_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum rascunho fiscal encontrado.", data: [] };
      const list = data.map((d: any) => `• ${d.id.slice(0,8)}... — Pedido: ${d.order_id.slice(0,8)}... — ${d.status} — Tentativas: ${d.attempts}`).join("\n");
      return { success: true, message: `📋 **${data.length} rascunho(s) fiscal(is):**\n\n${list}`, data };
    }
    case "getFiscalDraftDetails": {
      const { draftId } = tool_args;
      const { data, error } = await supabase.from("fiscal_draft_queue").select("*").eq("id", draftId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `📋 **Rascunho Fiscal**\n• Status: ${data.status}\n• Pedido: ${data.order_id}\n• Tentativas: ${data.attempts}\n• Erro: ${data.error_message || "—"}`, data };
    }
    case "listFiscalInvoices": {
      const { status, limit } = tool_args;
      let q = supabase.from("fiscal_invoices").select("id, numero, serie, status, valor_total, dest_nome, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhuma nota fiscal encontrada.", data: [] };
      const list = data.map((n: any) => `• NF ${n.numero || "—"}/${n.serie || "—"} — ${n.dest_nome || "—"} — R$ ${(n.valor_total || 0).toFixed(2)} — ${n.status}`).join("\n");
      return { success: true, message: `🧾 **${data.length} nota(s) fiscal(is):**\n\n${list}`, data };
    }
    case "getFiscalInvoiceDetails": {
      const { invoiceId } = tool_args;
      const { data, error } = await supabase.from("fiscal_invoices").select("*").eq("id", invoiceId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `🧾 **NF ${data.numero || "—"}/${data.serie || "—"}**\n• Status: ${data.status}\n• Destinatário: ${data.dest_nome || "—"}\n• CNPJ/CPF: ${data.dest_cpf_cnpj || "—"}\n• Valor: R$ ${(data.valor_total || 0).toFixed(2)}\n• Chave: ${data.chave_acesso || "—"}`, data };
    }
    case "updateFiscalDraft": {
      const { draftId, status: newStatus } = tool_args;
      const updateData: any = {};
      if (newStatus) updateData.status = newStatus;
      const { data, error } = await supabase.from("fiscal_draft_queue").update(updateData).eq("id", draftId).eq("tenant_id", tenant_id).select().single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Rascunho fiscal atualizado para "${newStatus}"!`, data };
    }
    // --- Logística ---
    case "listShipments": {
      const { status, limit } = tool_args;
      let q = supabase.from("shipments").select("id, order_id, carrier, tracking_code, delivery_status, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status && status !== "all") q = q.eq("delivery_status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhuma remessa encontrada.", data: [] };
      const list = data.map((s: any) => `• ${s.carrier} — Rastreio: ${s.tracking_code || "—"} — ${s.delivery_status}`).join("\n");
      return { success: true, message: `🚚 **${data.length} remessa(s):**\n\n${list}`, data };
    }
    case "getShipmentDetails": {
      const { shipmentId } = tool_args;
      const { data, error } = await supabase.from("shipments").select("*").eq("id", shipmentId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      const { data: events } = await supabase.from("shipment_events").select("status, description, location, occurred_at").eq("shipment_id", shipmentId).order("occurred_at", { ascending: false }).limit(10);
      const eventList = (events || []).map((e: any) => `  • ${e.status} — ${e.description || "—"} — ${e.location || "—"}`).join("\n");
      return { success: true, message: `🚚 **Remessa ${data.carrier}**\n• Rastreio: ${data.tracking_code || "—"}\n• Status: ${data.delivery_status}\n• Pedido: ${data.order_id}\n\n**Eventos:**\n${eventList || "Sem eventos"}`, data: { ...data, events } };
    }
    case "updateShipmentStatus": {
      const { shipmentId, status: newStatus, trackingCode } = tool_args;
      const updateData: any = { delivery_status: newStatus, updated_at: new Date().toISOString() };
      if (trackingCode) updateData.tracking_code = trackingCode;
      if (newStatus === "delivered") updateData.delivered_at = new Date().toISOString();
      const { data, error } = await supabase.from("shipments").update(updateData).eq("id", shipmentId).eq("tenant_id", tenant_id).select("id, carrier, delivery_status").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Remessa atualizada para "${newStatus}"!`, data };
    }
    // --- Financeiro/Compras ---
    case "listPurchases": {
      const { status, limit } = tool_args;
      let q = supabase.from("purchases").select("id, order_number, total_value, status, description, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhuma compra encontrada.", data: [] };
      const list = data.map((p: any) => `• #${p.order_number} — R$ ${(p.total_value || 0).toFixed(2)} — ${p.status}${p.description ? ` — ${p.description}` : ""}`).join("\n");
      return { success: true, message: `💰 **${data.length} compra(s):**\n\n${list}`, data };
    }
    case "getPurchaseDetails": {
      const { purchaseId } = tool_args;
      const { data, error } = await supabase.from("purchases").select("*").eq("id", purchaseId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `💰 **Compra #${data.order_number}**\n• Valor: R$ ${(data.total_value || 0).toFixed(2)}\n• Status: ${data.status}\n• Descrição: ${data.description || "—"}\n• Notas: ${data.notes || "—"}`, data };
    }
    case "createPurchase": {
      const { orderNumber, totalValue, description, notes } = tool_args;
      const { data, error } = await supabase.from("purchases").insert({ tenant_id, order_number: orderNumber, total_value: totalValue, description: description || null, notes: notes || null, status: "pending" }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Compra #${orderNumber} criada — R$ ${totalValue.toFixed(2)}!`, data };
    }
    case "updatePurchase": {
      const { purchaseId, status: newStatus, notes } = tool_args;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (newStatus) updateData.status = newStatus;
      if (notes !== undefined) updateData.notes = notes;
      const { data, error } = await supabase.from("purchases").update(updateData).eq("id", purchaseId).eq("tenant_id", tenant_id).select("id, order_number").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Compra #${data.order_number} atualizada!`, data };
    }
    case "deletePurchase": {
      const { purchaseId } = tool_args;
      const { error } = await supabase.from("purchases").delete().eq("id", purchaseId).eq("tenant_id", tenant_id);
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Compra excluída!`, data: { deleted: purchaseId } };
    }
    // --- Equipe ---
    case "listTeamMembers": {
      const { data, error } = await supabase.from("user_roles").select("id, user_id, role, user_type, permissions, created_at").eq("tenant_id", tenant_id).order("created_at");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum membro encontrado.", data: [] };
      const list = data.map((m: any) => `• ${m.role} (${m.user_type || "—"}) — ID: ${m.user_id.slice(0,8)}...`).join("\n");
      return { success: true, message: `👥 **${data.length} membro(s) da equipe:**\n\n${list}`, data };
    }
    case "getTeamMemberDetails": {
      const { memberId } = tool_args;
      const { data, error } = await supabase.from("user_roles").select("*").eq("id", memberId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `👤 **Membro**\n• Role: ${data.role}\n• Tipo: ${data.user_type || "—"}\n• Permissões: ${data.permissions ? JSON.stringify(data.permissions).slice(0,200) : "Todas"}`, data };
    }
    // --- Integrações ---
    case "listIntegrations": {
      const { data, error } = await supabase.from("marketing_integrations").select("id, tenant_id, meta_enabled, meta_status, google_enabled, google_status, tiktok_enabled, tiktok_status, created_at").eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      if (!data) return { success: true, message: "Nenhuma integração configurada.", data: [] };
      const integrations = [];
      if (data.meta_enabled) integrations.push(`• Meta Pixel — ${data.meta_status || "configurado"}`);
      if (data.google_enabled) integrations.push(`• Google Analytics — ${data.google_status || "configurado"}`);
      if (data.tiktok_enabled) integrations.push(`• TikTok Pixel — ${data.tiktok_status || "configurado"}`);
      if (integrations.length === 0) return { success: true, message: "Nenhuma integração ativa.", data };
      return { success: true, message: `🔗 **${integrations.length} integração(ões) ativa(s):**\n\n${integrations.join("\n")}`, data };
    }
    // --- Suporte ---
    case "listSupportTickets": {
      const { status, limit } = tool_args;
      let q = supabase.from("support_tickets").select("id, subject, status, priority, category, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum ticket encontrado.", data: [] };
      const list = data.map((t: any) => `• ${t.subject} — ${t.status} — ${t.priority} — ${t.category}`).join("\n");
      return { success: true, message: `🎫 **${data.length} ticket(s):**\n\n${list}`, data };
    }
    case "getSupportTicketDetails": {
      const { ticketId } = tool_args;
      const { data, error } = await supabase.from("support_tickets").select("*").eq("id", ticketId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      const { data: msgs } = await supabase.from("support_ticket_messages").select("content, sender_type, created_at").eq("ticket_id", ticketId).order("created_at").limit(10);
      const msgList = (msgs || []).map((m: any) => `  [${m.sender_type}]: ${m.content.slice(0,100)}`).join("\n");
      return { success: true, message: `🎫 **${data.subject}**\n• Status: ${data.status}\n• Prioridade: ${data.priority}\n• Categoria: ${data.category}\n\n**Mensagens:**\n${msgList || "Sem mensagens"}`, data: { ...data, messages: msgs } };
    }
    case "updateTicketStatus": {
      const { ticketId, status: newStatus } = tool_args;
      const { data, error } = await supabase.from("support_tickets").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", ticketId).eq("tenant_id", tenant_id).select("id, subject").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Ticket "${data.subject}" atualizado para "${newStatus}"!`, data };
    }
    case "replyToTicket": {
      const { ticketId, content } = tool_args;
      const { data, error } = await supabase.from("support_ticket_messages").insert({ ticket_id: ticketId, tenant_id, content, sender_type: "agent", sender_user_id: user_id }).select().single();
      if (error) throw new Error(error.message);
      await supabase.from("support_tickets").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", ticketId).eq("tenant_id", tenant_id);
      return { success: true, message: `✅ Resposta enviada ao ticket!`, data };
    }
    // --- Automações ---
    case "listAutomations": {
      const { status } = tool_args;
      let q = supabase.from("email_automation_flows").select("id, name, status, trigger_type, stats, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false });
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhuma automação encontrada.", data: [] };
      const list = data.map((a: any) => `• ${a.name} — ${a.status} — Trigger: ${a.trigger_type}`).join("\n");
      return { success: true, message: `⚡ **${data.length} automação(ões):**\n\n${list}`, data };
    }
    case "getAutomationDetails": {
      const { automationId } = tool_args;
      const { data, error } = await supabase.from("email_automation_flows").select("*").eq("id", automationId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      const { data: nodes } = await supabase.from("email_automation_nodes").select("id, type, config, position").eq("flow_id", automationId);
      return { success: true, message: `⚡ **${data.name}**\n• Status: ${data.status}\n• Trigger: ${data.trigger_type}\n• Nós: ${(nodes || []).length}\n• Stats: ${JSON.stringify(data.stats || {}).slice(0,200)}`, data: { ...data, nodes } };
    }
    case "toggleAutomation": {
      const { automationId, isActive } = tool_args;
      const newStatus = isActive ? "active" : "inactive";
      const { data, error } = await supabase.from("email_automation_flows").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", automationId).eq("tenant_id", tenant_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Automação "${data.name}" ${isActive ? "ativada" : "desativada"}!`, data };
    }
    // --- Email Marketing Expandido ---
    case "getCampaignDetails": {
      const { campaignId } = tool_args;
      const { data, error } = await supabase.from("email_marketing_campaigns").select("*").eq("id", campaignId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `📨 **${data.name}**\n• Assunto: ${data.subject || "—"}\n• Status: ${data.status}\n• Tipo: ${data.type}\n• Enviados: ${data.sent_count || 0}\n• Aberturas: ${data.open_count || 0}\n• Cliques: ${data.click_count || 0}`, data };
    }
    case "listEmailTemplates": {
      const { limit } = tool_args;
      const { data, error } = await supabase.from("email_marketing_templates").select("id, name, subject, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum template encontrado.", data: [] };
      const list = data.map((t: any) => `• ${t.name} — Assunto: ${t.subject || "—"}`).join("\n");
      return { success: true, message: `📧 **${data.length} template(s):**\n\n${list}`, data };
    }
    case "getCampaignStats": {
      const { campaignId } = tool_args;
      const { data, error } = await supabase.from("email_marketing_campaigns").select("id, name, sent_count, open_count, unique_open_count, click_count, unique_click_count, conversion_count, conversion_value_cents").eq("id", campaignId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      const openRate = data.sent_count > 0 ? ((data.open_count || 0) / data.sent_count * 100).toFixed(1) : "0";
      const clickRate = data.sent_count > 0 ? ((data.click_count || 0) / data.sent_count * 100).toFixed(1) : "0";
      return { success: true, message: `📊 **Estatísticas — ${data.name}**\n• Enviados: ${data.sent_count || 0}\n• Abertos: ${data.open_count || 0} (${openRate}%)\n• Abertos únicos: ${data.unique_open_count || 0}\n• Cliques: ${data.click_count || 0} (${clickRate}%)\n• Cliques únicos: ${data.unique_click_count || 0}\n• Conversões: ${data.conversion_count || 0}`, data };
    }
    case "updateCampaign": {
      const { campaignId, name, subject, status: newStatus } = tool_args;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (subject !== undefined) updateData.subject = subject;
      if (newStatus !== undefined) updateData.status = newStatus;
      const { data, error } = await supabase.from("email_marketing_campaigns").update(updateData).eq("id", campaignId).eq("tenant_id", tenant_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Campanha "${data.name}" atualizada!`, data };
    }
    case "deleteCampaign": {
      const { campaignId } = tool_args;
      const { data, error } = await supabase.from("email_marketing_campaigns").delete().eq("id", campaignId).eq("tenant_id", tenant_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Campanha "${data.name}" excluída!`, data };
    }
    case "duplicateCampaign": {
      const { campaignId } = tool_args;
      const { data: original, error: fetchError } = await supabase.from("email_marketing_campaigns").select("*").eq("id", campaignId).eq("tenant_id", tenant_id).single();
      if (fetchError) throw new Error(fetchError.message);
      const { id, created_at, updated_at, sent_count, open_count, click_count, bounce_count, unsubscribe_count, sent_at, ...campaignData } = original;
      const { data, error } = await supabase.from("email_marketing_campaigns").insert({ ...campaignData, name: `${original.name} (Cópia)`, status: "draft", sent_count: 0, open_count: 0, click_count: 0 }).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Campanha duplicada como "${data.name}"!`, data };
    }
    case "pauseCampaign": {
      const { campaignId, pause } = tool_args;
      const newStatus = pause ? "paused" : "active";
      const { data, error } = await supabase.from("email_marketing_campaigns").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", campaignId).eq("tenant_id", tenant_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Campanha "${data.name}" ${pause ? "pausada" : "retomada"}!`, data };
    }
    case "removeSubscriber": {
      const { listId, subscriberId } = tool_args;
      const { error } = await supabase.from("email_marketing_list_members").delete().eq("list_id", listId).eq("subscriber_id", subscriberId).eq("tenant_id", tenant_id);
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Inscrito removido da lista!` };
    }
    case "moveSubscriber": {
      const { fromListId, toListId, subscriberId } = tool_args;
      const { error: delError } = await supabase.from("email_marketing_list_members").delete().eq("list_id", fromListId).eq("subscriber_id", subscriberId).eq("tenant_id", tenant_id);
      if (delError) throw new Error(delError.message);
      const { error: insError } = await supabase.from("email_marketing_list_members").insert({ list_id: toListId, subscriber_id: subscriberId, tenant_id }).select().single();
      if (insError) throw new Error(insError.message);
      return { success: true, message: `✅ Inscrito movido para a nova lista!` };
    }
    // --- Checkout Links ---
    case "listCheckoutLinks": {
      const { status, limit } = tool_args;
      let q = supabase.from("checkout_links").select("id, name, slug, is_active, product_id, quantity, price_override, click_count, conversion_count, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status === "active") q = q.eq("is_active", true);
      else if (status === "inactive") q = q.eq("is_active", false);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum link de checkout encontrado.", data: [] };
      const list = data.map((l: any) => `• ${l.name} (/${l.slug}) — ${l.is_active ? "Ativo" : "Inativo"} — ${l.click_count} cliques — ${l.conversion_count} conversões`).join("\n");
      return { success: true, message: `🔗 **${data.length} link(s) de checkout:**\n\n${list}`, data };
    }
    case "getCheckoutLinkDetails": {
      const { linkId } = tool_args;
      const { data, error } = await supabase.from("checkout_links").select("*").eq("id", linkId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `🔗 **${data.name}**\n• Slug: /${data.slug}\n• Produto: ${data.product_id}\n• Qtd: ${data.quantity}\n• Preço override: ${data.price_override ? `R$ ${data.price_override.toFixed(2)}` : "—"}\n• Cupom: ${data.coupon_code || "—"}\n• Cliques: ${data.click_count}\n• Conversões: ${data.conversion_count}\n• Ativo: ${data.is_active ? "✅" : "❌"}`, data };
    }
    case "createCheckoutLink": {
      const { name, productId, slug, quantity, priceOverride, couponCode } = tool_args;
      const { data, error } = await supabase.from("checkout_links").insert({ tenant_id, name, product_id: productId, slug, quantity: quantity || 1, price_override: priceOverride || null, coupon_code: couponCode || null, is_active: true }).select("id, name, slug").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Link de checkout "${name}" criado (/${slug})!`, data };
    }
    case "updateCheckoutLink": {
      const { linkId, name, isActive, priceOverride } = tool_args;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.is_active = isActive;
      if (priceOverride !== undefined) updateData.price_override = priceOverride;
      const { data, error } = await supabase.from("checkout_links").update(updateData).eq("id", linkId).eq("tenant_id", tenant_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Link "${data.name}" atualizado!`, data };
    }
    case "deleteCheckoutLink": {
      const { linkId } = tool_args;
      const { error } = await supabase.from("checkout_links").delete().eq("id", linkId).eq("tenant_id", tenant_id);
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Link de checkout excluído!`, data: { deleted: linkId } };
    }
    // --- Afiliados ---
    case "listAffiliates": {
      const { status, limit } = tool_args;
      let q = supabase.from("affiliates").select("id, name, email, phone, status, created_at").eq("tenant_id", tenant_id).order("name").limit(limit || 20);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum afiliado encontrado.", data: [] };
      const list = data.map((a: any) => `• ${a.name} (${a.email}) — ${a.status}`).join("\n");
      return { success: true, message: `🤝 **${data.length} afiliado(s):**\n\n${list}`, data };
    }
    case "getAffiliateDetails": {
      const { affiliateId } = tool_args;
      const { data, error } = await supabase.from("affiliates").select("*").eq("id", affiliateId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      const { data: links } = await supabase.from("affiliate_links").select("id, code, target_url").eq("affiliate_id", affiliateId).limit(5);
      const { count: conversions } = await supabase.from("affiliate_conversions").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliateId);
      return { success: true, message: `🤝 **${data.name}**\n• Email: ${data.email}\n• Status: ${data.status}\n• Links: ${(links || []).length}\n• Conversões: ${conversions || 0}`, data: { ...data, links, totalConversions: conversions } };
    }
    case "listAffiliatePayouts": {
      const { status, limit } = tool_args;
      let q = supabase.from("affiliate_payouts").select("id, affiliate_id, amount_cents, status, paid_at, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum pagamento encontrado.", data: [] };
      const list = data.map((p: any) => `• R$ ${(p.amount_cents / 100).toFixed(2)} — ${p.status}${p.paid_at ? ` — Pago em ${new Date(p.paid_at).toLocaleDateString("pt-BR")}` : ""}`).join("\n");
      return { success: true, message: `💸 **${data.length} pagamento(s):**\n\n${list}`, data };
    }
    case "createAffiliate": {
      const { name, email, phone } = tool_args;
      const { data, error } = await supabase.from("affiliates").insert({ tenant_id, name, email, phone: phone || null, status: "active" }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Afiliado "${name}" criado!`, data };
    }
    case "updateAffiliate": {
      const { affiliateId, name, status: newStatus } = tool_args;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (newStatus !== undefined) updateData.status = newStatus;
      const { data, error } = await supabase.from("affiliates").update(updateData).eq("id", affiliateId).eq("tenant_id", tenant_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Afiliado "${data.name}" atualizado!`, data };
    }
    case "toggleAffiliate": {
      const { affiliateId, isActive } = tool_args;
      const newStatus = isActive ? "active" : "inactive";
      const { data, error } = await supabase.from("affiliates").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", affiliateId).eq("tenant_id", tenant_id).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Afiliado "${data.name}" ${isActive ? "ativado" : "desativado"}!`, data };
    }
    // --- Mídia Social ---
    case "listSocialPosts": {
      const { status, platform, limit } = tool_args;
      let q = supabase.from("social_posts").select("id, platform, post_type, status, caption, scheduled_at, published_at, created_at").eq("tenant_id", tenant_id).order("created_at", { ascending: false }).limit(limit || 20);
      if (status && status !== "all") q = q.eq("status", status);
      if (platform && platform !== "all") q = q.eq("platform", platform);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhuma publicação encontrada.", data: [] };
      const list = data.map((p: any) => `• ${p.platform} (${p.post_type}) — ${p.status} — "${(p.caption || "").slice(0,50)}..."`).join("\n");
      return { success: true, message: `📱 **${data.length} publicação(ões):**\n\n${list}`, data };
    }
    case "getSocialPostDetails": {
      const { postId } = tool_args;
      const { data, error } = await supabase.from("social_posts").select("*").eq("id", postId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `📱 **Publicação ${data.platform}**\n• Tipo: ${data.post_type}\n• Status: ${data.status}\n• Legenda: ${(data.caption || "").slice(0,200)}\n• Agendado: ${data.scheduled_at || "—"}\n• Publicado: ${data.published_at || "—"}\n• Erro: ${data.error_message || "—"}`, data };
    }
    // --- Domínios e Loja ---
    case "listDomains": {
      const { data, error } = await supabase.from("tenant_domains").select("id, domain, type, status, is_primary, ssl_status, verified_at").eq("tenant_id", tenant_id).order("is_primary", { ascending: false });
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum domínio configurado.", data: [] };
      const list = data.map((d: any) => `• ${d.domain} — ${d.type} — ${d.status}${d.is_primary ? " ⭐ Principal" : ""} — SSL: ${d.ssl_status || "—"}`).join("\n");
      return { success: true, message: `🌐 **${data.length} domínio(s):**\n\n${list}`, data };
    }
    case "getStoreDetails": {
      const { data, error } = await supabase.from("tenants").select("id, name, slug, logo_url, settings, created_at").eq("id", tenant_id).single();
      if (error) throw new Error(error.message);
      const { data: sub } = await supabase.from("tenant_subscriptions").select("plan_key, status, current_period_end").eq("tenant_id", tenant_id).eq("status", "active").single();
      const { data: domain } = await supabase.from("tenant_domains").select("domain, is_primary").eq("tenant_id", tenant_id).eq("is_primary", true).single();
      return { success: true, message: `🏪 **${data.name}**\n• Slug: ${data.slug}\n• Domínio: ${domain?.domain || "—"}\n• Plano: ${sub?.plan_key || "—"} (${sub?.status || "—"})`, data: { ...data, subscription: sub, domain: domain?.domain } };
    }
    // --- Clientes Potenciais ---
    case "listPotentialCustomers": {
      const { limit } = tool_args;
      const { data, error } = await supabase.from("checkout_sessions").select("id, customer_email, customer_name, total_estimated, status, contact_captured_at, abandoned_at, created_at").eq("tenant_id", tenant_id).not("customer_email", "is", null).eq("status", "abandoned").order("created_at", { ascending: false }).limit(limit || 20);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhum cliente potencial encontrado.", data: [] };
      const list = data.map((c: any) => `• ${c.customer_name || "—"} (${c.customer_email}) — R$ ${(c.total_estimated || 0).toFixed(2)}`).join("\n");
      return { success: true, message: `🎯 **${data.length} cliente(s) potencial(is):**\n\n${list}`, data };
    }
    case "getPotentialCustomerDetails": {
      const { sessionId } = tool_args;
      const { data, error } = await supabase.from("checkout_sessions").select("*").eq("id", sessionId).eq("tenant_id", tenant_id).single();
      if (error) throw new Error(error.message);
      return { success: true, message: `🎯 **${data.customer_name || "—"}**\n• Email: ${data.customer_email || "—"}\n• Telefone: ${data.customer_phone || "—"}\n• Valor: R$ ${(data.total_estimated || 0).toFixed(2)}\n• Status: ${data.status}\n• Capturado em: ${data.contact_captured_at || "—"}\n• Abandonado em: ${data.abandoned_at || "—"}`, data };
    }
    case "updatePotentialCustomerStatus": {
      const { sessionId, status: newStatus } = tool_args;
      const { data, error } = await supabase.from("checkout_sessions").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("tenant_id", tenant_id).select("id, customer_email").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Status do cliente potencial atualizado para "${newStatus}"!`, data };
    }
    // --- Variantes ---
    case "listProductVariants": {
      const productId = tool_args.productId || tool_args.product_id;
      if (!productId) return { success: false, error: "Parâmetro product_id é obrigatório." };
      const { data, error } = await supabase.from("product_variants").select("id, name, sku, price, stock_quantity, is_active, option1_name, option1_value, option2_name, option2_value").eq("product_id", productId).order("position");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return { success: true, message: "Nenhuma variante encontrada para este produto.", data: [] };
      const list = data.map((v: any) => `• ${v.name} (SKU: ${v.sku}) — R$ ${(v.price || 0).toFixed(2)} — Estoque: ${v.stock_quantity} — ${v.is_active ? "Ativa" : "Inativa"}`).join("\n");
      return { success: true, message: `🎨 **${data.length} variante(s):**\n\n${list}`, data };
    }
    case "createProductVariant": {
      const { productId, name, sku, price, stockQuantity, option1Name, option1Value, option2Name, option2Value } = tool_args;
      await supabase.from("products").update({ product_format: "with_variants", updated_at: new Date().toISOString() }).eq("id", productId).eq("tenant_id", tenant_id);
      const { data, error } = await supabase.from("product_variants").insert({ product_id: productId, name, sku, price: price || null, stock_quantity: stockQuantity || 0, option1_name: option1Name || null, option1_value: option1Value || null, option2_name: option2Name || null, option2_value: option2Value || null, is_active: true }).select().single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Variante "${name}" criada!`, data };
    }
    case "updateProductVariant": {
      const { variantId, name, sku, price, stockQuantity, isActive } = tool_args;
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (sku !== undefined) updateData.sku = sku;
      if (price !== undefined) updateData.price = price;
      if (stockQuantity !== undefined) updateData.stock_quantity = stockQuantity;
      if (isActive !== undefined) updateData.is_active = isActive;
      const { data, error } = await supabase.from("product_variants").update(updateData).eq("id", variantId).select("id, name").single();
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Variante "${data.name}" atualizada!`, data };
    }
    case "deleteProductVariant": {
      const { variantId } = tool_args;
      const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
      if (error) throw new Error(error.message);
      return { success: true, message: `✅ Variante excluída!`, data: { deleted: variantId } };
    }

    default:
      return { success: false, error: `Ação "${tool_name}" não reconhecida.` };
  }
}
