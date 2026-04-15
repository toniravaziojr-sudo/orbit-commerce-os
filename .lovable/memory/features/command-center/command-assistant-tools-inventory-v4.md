---
name: Command Assistant Tools Inventory v4.0.0
description: Inventário completo de ~150 ferramentas do Auxiliar de Comando cobrindo todos os módulos do sistema
type: feature
---

# Auxiliar de Comando v4.0.0 — Inventário Completo de Tools

## Arquitetura
- **Chat (leitura):** `command-assistant-chat/index.ts` — Tool definitions em `OPENAI_READ_TOOLS`, execução via `executeReadTool()` que delega para `command-assistant-execute`
- **Execute (escrita + leitura):** `command-assistant-execute/index.ts` — Switch central `executeTool()` com todos os cases
- **IA Primária:** Gemini 2.5 Flash via rota nativa (`ai-router.ts` → `GEMINI_API_KEY` via `platform_credentials`)
- **Fallback:** Lovable AI Gateway (`LOVABLE_API_KEY`)

## Tools de Leitura (~55 total)

### Produtos (7)
searchProducts, listProducts, getProductDetails, listProductComponents, findKitsContainingProduct, listKitsSummary, listProductVariants

### Pedidos (2)
searchOrders, getOrderDetails

### Clientes (2)
searchCustomers, listCustomerTags

### Catálogo (3)
listDiscounts, listCategories, listOffers

### Conteúdo (3)
listBlogPosts, listReviews, listPages

### Dashboard/Relatórios (6)
getDashboardStats, getTopProducts, getFinancialSummary, inventoryReport, customersReport, salesReport

### Operacional (4)
listShippingMethods, listNotifications, listFiles, getStorageUsage

### Email Marketing (5)
listEmailLists, listSubscribers, listCampaigns, getCampaignDetails, listEmailTemplates, getCampaignStats

### Agenda (1)
listAgendaTasks

### Fiscal (4) — v4.0.0
listFiscalDrafts, getFiscalDraftDetails, listFiscalInvoices, getFiscalInvoiceDetails

### Logística (2) — v4.0.0
listShipments, getShipmentDetails

### Financeiro (2) — v4.0.0
listPurchases, getPurchaseDetails

### Equipe (2) — v4.0.0
listTeamMembers, getTeamMemberDetails

### Integrações (1) — v4.0.0
listIntegrations

### Suporte (2) — v4.0.0
listSupportTickets, getSupportTicketDetails

### Automações (2) — v4.0.0
listAutomations, getAutomationDetails

### Checkout Links (2) — v4.0.0
listCheckoutLinks, getCheckoutLinkDetails

### Afiliados (3) — v4.0.0
listAffiliates, getAffiliateDetails, listAffiliatePayouts

### Mídia Social (2) — v4.0.0
listSocialPosts, getSocialPostDetails

### Domínios/Loja (2) — v4.0.0
listDomains, getStoreDetails

### Clientes Potenciais (2) — v4.0.0
listPotentialCustomers, getPotentialCustomerDetails

## Tools de Escrita (~95 total)

### Produtos (12)
bulkUpdateProductsNCM, bulkUpdateProductsCEST, bulkUpdateProductsPrice, bulkUpdateProductsStock, bulkUpdateProductsFreeShipping, bulkActivateProducts, createProduct, updateProduct, deleteProduct, applyKitDiscount, createProductVariant, updateProductVariant, deleteProductVariant

### Pedidos (5)
updateOrderStatus, addOrderNote, updateOrderTracking, cancelOrder, createManualOrder

### Clientes (4)
createCustomer, updateCustomer, addCustomerTag, removeCustomerTag

### Categorias (3)
createCategory, updateCategory, deleteCategory

### Cupons (3)
createDiscount, updateDiscount, deleteDiscount

### Blog (3)
createBlogPost, updateBlogPost, deleteBlogPost

### Ofertas (3)
createOffer, updateOffer, deleteOffer

### Avaliações (2)
approveReview, deleteReview

### Páginas (3)
createPage, updatePage, deletePage

### Email Marketing (8)
createEmailList, addSubscriber, removeSubscriber, moveSubscriber, createCampaign, updateCampaign, deleteCampaign, duplicateCampaign, pauseCampaign

### Agenda (2)
createAgendaTask, updateAgendaTask

### Fiscal (4) — v4.0.0
createFiscalDraft, updateFiscalDraft, emitFiscalNote, cancelFiscalNote

### Logística (2) — v4.0.0
createShipment, updateShipmentStatus

### Financeiro (3) — v4.0.0
createPurchase, updatePurchase, deletePurchase

### Equipe (3) — v4.0.0
inviteTeamMember, updateTeamMemberRole, removeTeamMember

### Suporte (3) — v4.0.0
updateTicketStatus, replyToTicket, assignTicket

### Automações (1) — v4.0.0
toggleAutomation

### Checkout Links (3) — v4.0.0
createCheckoutLink, updateCheckoutLink, deleteCheckoutLink

### Afiliados (3) — v4.0.0
createAffiliate, updateAffiliate, toggleAffiliate

### Mídia Social (2) — v4.0.0
createSocialPost, scheduleSocialPost

### Clientes Potenciais (2) — v4.0.0
convertPotentialCustomer, updatePotentialCustomerStatus

## Módulos Somente Leitura (por segurança)
- **Integrações:** Apenas consulta de status, sem alteração via chat
- **Domínios:** Apenas consulta, configuração via UI
- **Marketplaces:** Operações via fluxos dedicados

## Validação Técnica (2026-04-15)
- ✅ listFiscalDrafts — 20 rascunhos retornados
- ✅ listShipments — 20 remessas retornadas
- ✅ listTeamMembers — 3 membros retornados
- ✅ listCheckoutLinks — 1 link retornado
- ✅ listAffiliates — OK (vazio)
- ✅ listAutomations — OK (vazio)
- ✅ listProductVariants — OK (validação de UUID)
- ✅ listPotentialCustomers — Fix aplicado (total→total_estimated)
- ⏳ Demais tools pendentes de re-teste (sessão auth expirou)
