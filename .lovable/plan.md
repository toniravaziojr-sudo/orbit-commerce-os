

# Plano: Expansão Total do Auxiliar de Comando — Cobertura 100% dos Módulos

## Problema

O Auxiliar de Comando hoje cobre apenas **~30%** das funcionalidades do sistema. Quando o usuário pede algo que não está mapeado como tool, a IA não consegue executar e o pedido "não acontece". 

## Diagnóstico: O que EXISTE vs. O que FALTA

### Tools que JÁ existem (30 tools):

| Área | Tools |
|------|-------|
| Produtos | bulkUpdateNCM, bulkUpdateCEST, bulkUpdatePrice, bulkUpdateStock, bulkActivate, create, delete |
| Categorias | create, update, delete |
| Descontos | create, update, delete |
| Pedidos | updateStatus, bulkUpdateStatus, addNote, salesReport |
| Clientes | create, update, addTag, search |
| Agenda | create, list, complete |
| Configurações | updateStore, updateShipping |
| Relatórios | inventory, customers |
| Kits | add/remove/list components, bulkSetType, autoCreate |

### Tools que FALTAM (mapeados por módulo):

| Módulo | Ações que o usuário faz manualmente mas a IA NÃO consegue |
|--------|----------------------------------------------------------|
| **Produtos** | updateProduct (editar campos individuais: descrição, peso, dimensões, SEO), duplicateProduct, searchProducts (buscar por nome/SKU), listProducts (listar com filtros), bulkUpdateProductsWeight, updateProductImages, updateProductVariants |
| **Pedidos** | searchOrders (buscar pedidos), getOrderDetails (ver detalhes), addTrackingCode (adicionar rastreio), cancelOrder, refundOrder, createManualOrder |
| **Descontos** | listDiscounts, searchDiscounts |
| **Clientes** | deleteCustomer, listCustomerTags, createCustomerTag, removeCustomerTag, mergeCustomers, exportCustomers |
| **Blog** | createBlogPost, updateBlogPost, deleteBlogPost, listBlogPosts |
| **Email Marketing** | createEmailList, sendCampaign, listSubscribers, addSubscriber, removeSubscriber, listCampaigns |
| **Ofertas (Bump/Upsell)** | createOffer, updateOffer, deleteOffer, listOffers |
| **Avaliações** | listReviews, approveReview, rejectReview, respondToReview |
| **Loja Online** | updateStorefrontTheme, publishStore, unpublishStore, updateMenus |
| **Páginas** | createPage, updatePage, deletePage, listPages |
| **Logística/Frete** | listShippingMethods, updateShippingMethod, createShippingZone, getShippingQuote |
| **Fiscal** | listInvoices, createInvoice |
| **Financeiro** | getFinancialSummary, listTransactions |
| **Notificações** | listNotifications, markAsRead |
| **Suporte/Atendimento** | listTickets, respondTicket, closeTicket |
| **Mídia/Drive** | listFiles, deleteFile, getStorageUsage |
| **Afiliados** | listAffiliates, createAffiliateLink |
| **Influencers** | listInfluencers, createInfluencer |
| **Importação** | startImport, getImportStatus |
| **Integrações** | listIntegrations, getIntegrationStatus |
| **Dados de Leitura** | getTenantInfo, getDashboardStats, getTopProducts, getRevenueByPeriod |

## Plano de Implementação (Faseado)

### Fase 1 — Leitura Universal (PRIORIDADE MÁXIMA)
**Impacto: resolve ~60% dos pedidos que falham hoje**

A maioria dos pedidos do usuário envolve **consultar dados** antes de agir. Sem tools de leitura, a IA não consegue nem ver o que existe.

**Adicionar ao TOOL_REGISTRY + execute:**

1. **searchProducts** — Buscar produtos por nome/SKU/categoria
2. **listProducts** — Listar produtos com filtros (ativos, inativos, por categoria, faixa de preço)
3. **getProductDetails** — Detalhes completos de um produto
4. **searchOrders** — Buscar pedidos por número, cliente, status, período
5. **getOrderDetails** — Detalhes completos de um pedido (itens, pagamento, frete)
6. **listDiscounts** — Listar cupons ativos/inativos
7. **listCategories** — Listar todas as categorias
8. **getDashboardStats** — Resumo do dashboard (receita, pedidos, ticket médio)
9. **getTopProducts** — Produtos mais vendidos
10. **listCustomerTags** — Listar tags disponíveis

### Fase 2 — CRUD Completo dos Módulos Core
**Impacto: completa os módulos que já existem parcialmente**

11. **updateProduct** — Editar qualquer campo de um produto
12. **duplicateProduct** — Duplicar produto
13. **deleteCustomer** — Excluir cliente (soft delete)
14. **addTrackingCode** — Adicionar código de rastreio a pedido
15. **cancelOrder** — Cancelar pedido
16. **createManualOrder** — Criar pedido manual
17. **createCustomerTag** — Criar nova tag de cliente
18. **removeCustomerTag** — Remover tag de clientes

### Fase 3 — Módulos de Marketing e CRM
**Impacto: cobre marketing, blog, ofertas, avaliações**

19. **createBlogPost** — Criar post do blog
20. **updateBlogPost** — Editar post
21. **deleteBlogPost** — Excluir post
22. **listBlogPosts** — Listar posts
23. **createOffer** — Criar regra de bump/upsell
24. **updateOffer** — Editar oferta
25. **deleteOffer** — Excluir oferta
26. **listReviews** — Listar avaliações
27. **approveReview** / **rejectReview** — Moderar avaliações
28. **respondToReview** — Responder avaliação

### Fase 4 — Módulos Operacionais (ERP, Logística, Suporte)
**Impacto: cobre os módulos mais avançados**

29. **listPages** — Listar páginas institucionais
30. **createPage** / **updatePage** — Gerenciar páginas
31. **getFinancialSummary** — Resumo financeiro
32. **listShippingMethods** — Listar métodos de frete
33. **listNotifications** — Listar notificações
34. **listFiles** — Listar arquivos do drive
35. **getStorageUsage** — Uso de armazenamento

### Fase 5 — Email Marketing e Automações

36. **listEmailLists** — Listar listas de email
37. **listSubscribers** — Listar inscritos
38. **addSubscriber** — Adicionar inscrito
39. **createEmailCampaign** — Criar campanha de email
40. **listCampaigns** — Listar campanhas

## Detalhes Técnicos

### Arquivos afetados:
- `supabase/functions/command-assistant-chat/index.ts` — Adicionar tools ao `TOOL_REGISTRY` + atualizar system prompt
- `supabase/functions/command-assistant-execute/index.ts` — Adicionar `case` handlers para cada nova tool
- `docs/regras/auxiliar-comando.md` — Documentar novas tools

### Padrão por tool:
1. Entrada no `TOOL_REGISTRY` (chat) com description + parameters + requiredPermission
2. Mapeamento na linguagem UI no system prompt
3. `case` handler no execute com lógica de banco
4. Todas as queries filtram por `tenant_id` (segurança multi-tenant)

### Estimativa de tamanho:
- Fase 1: ~10 tools de leitura → ~300 linhas no execute + ~150 no chat
- Fase 2: ~8 tools CRUD → ~400 linhas no execute + ~120 no chat
- Fase 3: ~10 tools marketing → ~500 linhas no execute + ~150 no chat
- Fase 4: ~7 tools operacionais → ~350 linhas no execute + ~100 no chat
- Fase 5: ~5 tools email → ~250 linhas no execute + ~80 no chat

**Total: ~40 novas tools, ~1800 linhas no execute, ~600 no chat**

### Recomendação de execução:
Implementar **Fase 1 + Fase 2** primeiro (18 tools), pois resolve a vasta maioria dos pedidos. Depois iterar nas fases seguintes.

