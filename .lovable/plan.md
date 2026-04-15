

# Plano: Auxiliar de Comando com Cobertura Total de Ferramentas + Gemini Nativa como Primária

## Situacao Atual

O Auxiliar de Comando (v3.16.0) opera em 5 fases com ~70 ferramentas cobrindo:
- **Produtos:** CRUD completo, kits, composicao, precos em massa, estoque, NCM/CEST
- **Pedidos:** Status, notas, rastreio, cancelamento, criacao manual, relatorios
- **Clientes:** CRUD, tags, busca
- **Categorias e Cupons:** CRUD completo
- **Blog, Ofertas, Avaliacoes, Paginas:** CRUD completo
- **Email Marketing:** Listas, inscritos, campanhas (basico)
- **Agenda:** Tarefas e lembretes
- **Operacional:** Notificacoes, arquivos, armazenamento, frete, configuracoes

**IA Atual:** Gemini 2.5 Flash via rota nativa (ai-router.ts) como primaria, com fallback para Lovable Gateway. Ja funciona conforme solicitado.

## Modulos Faltantes (Mapeamento Completo)

| # | Modulo | Tools de Leitura | Tools de Escrita |
|---|--------|-----------------|------------------|
| 1 | **Fiscal/NF-e** | listFiscalDrafts, getFiscalDraftDetails | createFiscalDraft, updateFiscalDraft, emitFiscalNote, cancelFiscalNote |
| 2 | **Logistica/Remessas** | listShipments, getShipmentDetails, listShippingLabels | createShipment, updateShipmentStatus |
| 3 | **Financeiro (Escrita)** | listFinancialEntries | createFinancialEntry, updateFinancialEntry, deleteFinancialEntry |
| 4 | **Equipe/Permissoes** | listTeamMembers, getTeamMemberDetails | inviteTeamMember, updateTeamMemberRole, removeTeamMember |
| 5 | **Integracoes (Status)** | listIntegrations, getIntegrationStatus | — (sem escrita via chat por seguranca) |
| 6 | **Suporte/Tickets** | listSupportTickets, getSupportTicketDetails | updateTicketStatus, replyToTicket, assignTicket |
| 7 | **Automacoes** | listAutomations, getAutomationDetails | toggleAutomation (ativar/desativar) |
| 8 | **Email Marketing (Expandido)** | getCampaignDetails, listEmailTemplates, getCampaignStats | updateCampaign, deleteCampaign, duplicateCampaign, pauseCampaign, removeSubscriber, moveSubscriber |
| 9 | **Checkout Links** | listCheckoutLinks, getCheckoutLinkDetails | createCheckoutLink, updateCheckoutLink, deleteCheckoutLink |
| 10 | **Afiliados** | listAffiliates, getAffiliateDetails | createAffiliate, updateAffiliate, toggleAffiliate |
| 11 | **Marketplaces** | listMarketplaceListings, getMarketplaceStatus | — (operacoes via fluxos dedicados) |
| 12 | **Midia Social** | listSocialPosts, getSocialPostDetails | createSocialPost, scheduleSocialPost |
| 13 | **Dominos e Loja** | listDomains, getDomainStatus, getStoreDetails | — (operacoes sensíveis via UI) |
| 14 | **Clientes Potenciais** | listPotentialCustomers, getPotentialCustomerDetails | convertPotentialCustomer, updatePotentialCustomerStatus |
| 15 | **Variantes de Produto** | listProductVariants | createProductVariant, updateProductVariant, deleteProductVariant |

**Total estimado:** ~45 novas tools de leitura + ~35 novas tools de escrita = ~80 ferramentas novas.

## Estrategia de IA (Gemini Nativa Primaria)

O ai-router.ts **ja implementa** a hierarquia correta:
1. **Gemini Nativa** (GEMINI_API_KEY via platform_credentials) — primaria
2. **OpenAI Nativa** (OPENAI_API_KEY) — secundaria
3. **Lovable AI Gateway** (LOVABLE_API_KEY) — fallback final

Nenhuma mudanca necessaria na hierarquia de provedores. O modelo `gemini-2.5-flash` via endpoint OpenAI-compat do Google ja e usado para tool calling.

## O que sera feito

### Etapa 1 — Novas Tools de Leitura (command-assistant-chat)
- Adicionar ~45 novas tool definitions no array `OPENAI_READ_TOOLS`
- Adicionar entradas correspondentes em `READ_TOOLS` (Set) e `READ_PERMISSION_MAP`
- Cada tool com parameters tipados e descriptions claras em portugues

### Etapa 2 — Novas Tools de Escrita (command-assistant-execute)
- Adicionar ~35 novos cases no `switch(tool_name)` do `executeTool()`
- Adicionar entradas no `PERMISSION_MAP` e no `TOOL_REGISTRY` (system prompt)
- Cada tool com validacao de tenant_id e permissoes adequadas

### Etapa 3 — System Prompt Atualizado
- Expandir exemplos de uso para novos modulos no prompt do `buildSystemPrompt()`
- Adicionar secao de "modulos disponiveis" para orientar a IA

### Etapa 4 — Validacao Tecnica
- Teste de chamada para cada ferramenta nova via `curl_edge_functions`
- Verificar que leituras retornam dados validos
- Verificar que escritas executam corretamente com tenant isolation

### Etapa 5 — Documentacao
- Atualizar memoria do projeto com inventario completo de tools
- Atualizar version para v4.0.0
- Registrar na base de conhecimento tecnico

## Detalhes Tecnicos

| Item | Impacto |
|------|---------|
| `command-assistant-chat/index.ts` | +45 read tool definitions, permission maps, system prompt |
| `command-assistant-execute/index.ts` | +35 write tool cases, permission map, tool registry |
| Banco de dados | Nenhuma migracao — todas as tabelas ja existem |
| AI Router | Nenhuma mudanca — hierarquia ja correta |

## Resultado Final

- Auxiliar de Comando com **~150 ferramentas** cobrindo todos os modulos do sistema
- Gemini nativa como provedor primario (ja configurado)
- Lovable Gateway como fallback (ja configurado)
- Teste de validacao tecnica por ferramenta
- Documentacao completa atualizada

