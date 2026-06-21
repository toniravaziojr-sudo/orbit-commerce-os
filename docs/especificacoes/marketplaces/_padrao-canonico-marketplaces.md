# Padrão Canônico de Marketplaces — Pré-registro

> **Status:** 🟡 Pré-registro (vigente como contrato; implementação plena por marketplace acontece em ondas)
> **Camada:** Layer 3 — Especificações / Marketplaces (transversal)
> **Última atualização:** 2026-06-10

## Finalidade

Garantir que, quando avançarmos com **Shopee**, **TikTok Shop** e qualquer marketplace novo, o sistema reaproveite **o mesmo fluxo já consolidado no Mercado Livre** — sem reinventar contratos, sem divergir de UI/UX, sem criar exceções por marketplace.

Mercado Livre é o **modelo de referência (golden path)**. Toda decisão estrutural para outro marketplace deve responder primeiro: *"como o Mercado Livre faz isso hoje?"*. Divergir só com justificativa documentada e aprovação explícita do usuário.

---

## Escopo do padrão (o que TODO marketplace deve seguir)

### 1. Conexão e credenciais
- Conexão **OAuth por tenant** registrada em `marketplace_connections` (uma linha por par `tenant_id + marketplace`).
- Credenciais de aplicação ficam em `platform_credentials` (admin/plataforma), nunca no tenant.
- Critério único de "integração ativa": `marketplace_connections.is_active = true` + token válido. Mesmo critério usado pelo Dashboard da Central de Comando (ver `dashboard-by-channel-standard`).
- Refresh automático de token via cron dedicado, com `last_error` registrado na linha de conexão.
- Desconexão limpa: revoga token no marketplace e zera `is_active` (não apaga histórico de pedidos).

### 2. Sincronização de pedidos
- Edge Function dedicada `{marketplace}-sync-orders` (cabeçalho + itens, sempre).
- Pedidos gravados em `orders` com:
  - `sales_channel` ≠ `'storefront'`
  - `marketplace_source = '{marketplace}'`
  - `marketplace_order_id` preenchido
  - `marketplace_data` com payload bruto relevante
- Itens em `order_items` com tentativa de vínculo automático via SKU (`products.sku` escopado por tenant). Se não encontrar, `product_id = NULL` (pendente de vínculo manual).
- Vínculo manual posterior dispara `enqueue_fiscal_on_item_link` (mesmo gatilho do ML).
- Webhook do marketplace é o caminho principal; cron de reconciliação é fallback (regra do Knowledge: trigger primário + cron de retentativa).

### 3. Status e ciclo de vida
- Mapear status nativo do marketplace para os status canônicos do sistema (`pending`, `approved`, `processing`, `ready_to_invoice`, `shipped`, `delivered`, `cancelled`, `refunded`).
- "Venda realizada" = mesma definição global: `status IN ('paid','processing','ready_to_invoice','shipped','delivered')` AND `payment_gateway_id IS NOT NULL` OU pedido com `marketplace_source` aprovado pelo marketplace (Ghost Order Rule aplicada por canal).
- `payment_gateway_id` em pedido de marketplace pode ser nulo (pagamento é do próprio marketplace) — não bloqueia reconhecimento de venda.

### 4. Pedidos de Venda (PVs) e Fiscal
- PVs de marketplace **convivem na mesma tela** dos PVs da Loja Virtual (`/orders`), diferenciados por **ícone de origem** (`OrderSourceBadge`) e **filtro "Origem"**.
- Esteira fiscal é a mesma: completude de item (SKU vinculado + peso + NCM + origem) é pré-requisito; itens incompletos bloqueiam entrada na fila de Notas Fiscais.
- Enriquecimento de cadastro de cliente segue `profile-enrichment-policy-standard` (preenche campos nulos quando o marketplace devolver dados reais).
- **Proibido fabricar dados do cliente**: se o marketplace não entregar e-mail/telefone/CPF/endereço reais, gravar vazio e marcar `marketplace_data.data_pending = [campos]`. Pré-Flight Fiscal/Logístico bloqueia naturalmente.

### 5. Logística
- Roteamento decidido por `resolve_order_shipping_provider`. Marketplaces com logística própria (ML Full, ML Flex, Envios Shopee, Shipped by TikTok) retornam `reason = 'marketplace'` e **não entram em `shipping_draft_queue`**.
- Pedidos com etiqueta própria do lojista (raro em marketplace) seguem o fluxo gateway/local já documentado em `gateway-vs-local-shipping-routing`.

### 6. Atendimento
- Mensagens do marketplace vão **sempre** para o módulo Atendimento (`channel_type = '{marketplace}'`). Proibido criar aba de chat dentro do hub do marketplace.

### 7. Dashboard e Central de Comando
- Cada marketplace ativo ganha **sub-aba própria** no Dashboard (ver `dashboard-by-channel-standard`).
- Receita do marketplace entra na aba **Geral** e na sub-aba específica. Nunca soma na sub-aba "Loja Virtual".
- Investimento em Ads do marketplace permanece como **"Em breve"** até existir coleta oficial (ML Ads, Shopee Ads, TikTok Shop Ads). Não estimar.

### 8. Hub do marketplace (`/marketplaces/{nome}`)
- Hub mantém apenas: status de conexão, listings/anúncios do marketplace, sincronizações manuais e diagnóstico.
- **Não duplicar** gestão de pedidos, mensagens, fiscal ou logística — esses módulos têm tela própria, com o filtro "Origem".

### 9. Segurança e isolamento
- Tudo tenant-scoped via `tenant_id`.
- Tokens nunca expostos ao frontend; toda chamada passa por Edge Function.
- Validação de assinatura obrigatória em webhooks (HMAC ou equivalente).
- RLS em `marketplace_connections` e nas tabelas derivadas.

---

## O que muda por marketplace (e o que NÃO muda)

| Aspecto | Pode variar | Tem que ser igual ao ML |
|---|---|---|
| Endpoint da API, formato de assinatura, paginação | ✅ | — |
| Mapeamento de status nativo → canônico | ✅ (tabela por marketplace) | Status canônicos do sistema |
| Estrutura de listings/anúncios | ✅ | — |
| Tabela onde grava pedido | — | ✅ `orders` + `order_items` |
| Critério de "ativo" / sub-aba do Dashboard | — | ✅ `marketplace_connections.is_active` |
| Local dos PVs | — | ✅ `/orders` com filtro origem |
| Esteira fiscal | — | ✅ mesmo bloqueio por completude |
| Mensagens | — | ✅ módulo Atendimento |
| Política de dados do cliente | — | ✅ nunca fabricar |

---

## Checklist de habilitação de novo marketplace

Antes de declarar um marketplace "pronto para produção":

- [ ] Conexão OAuth funcional + refresh automático
- [ ] `marketplace_connections.is_active` reflete realidade da integração
- [ ] Sync de pedidos grava cabeçalho + itens com `marketplace_source` correto
- [ ] Vínculo automático por SKU + fallback manual
- [ ] Mapeamento de status documentado neste mesmo doc do marketplace
- [ ] Sub-aba aparece no Dashboard quando ativo
- [ ] Filtro "Origem" em Pedidos lista o marketplace e funciona
- [ ] Ícone do marketplace registrado em `OrderSourceBadge`
- [ ] Hub `/marketplaces/{nome}` sem duplicação de pedidos/mensagens
- [ ] Mensagens chegam em Atendimento
- [ ] Roteamento logístico decidido por `resolve_order_shipping_provider`
- [ ] Política "nunca fabricar dados do cliente" aplicada
- [ ] Doc do marketplace declara explicitamente "segue padrão canônico (este doc)" e lista apenas as **diferenças**

---

## Classificação Universal (base v2026-06-21)

Toda integração com marketplace usa, como contrato comum:

1. **Taxonomia Universal de Categorias** (`system_universal_categories`) — árvore única do sistema com 15 grupos macro (Beleza/Cosméticos, Saúde, Alimentos, Moda, Eletrônicos, Eletrodomésticos, Casa, Infantil, Ferramentas, Automotivo, Pet, Esporte, Livros, Industrial, Outros). Cada categoria declara seu regime regulatório (ANVISA cosmético, ANVISA saúde, MAPA, INMETRO, ANATEL ou não regulado) e os atributos típicos que os marketplaces pedem.

2. **Dicionário Universal de Atributos** (`system_marketplace_attribute_dictionary`) — tabela que liga cada atributo nosso (marca, linha, modelo, fragrância, volume, gênero, etc.) ao código equivalente em cada marketplace (ML, Shopee, TikTok). Marketplace novo entra como nova coluna no dicionário, sem mexer no cadastro do produto.

3. **IA Classificadora** (Gemini 2.5 Flash via roteador padrão `_shared/ai-router.ts`) — cruza dados do cadastro + derivações automáticas + dicionário + atributos exigidos pela categoria do marketplace e devolve valores com confiança. Atua no dialog de envio (automaticamente) e no cadastro (sob demanda).

Ambas as tabelas são **system-wide** (sem `tenant_id`), leitura pública para autenticados, escrita só pelo sistema. Seed inicial em 2026-06-21: 37 categorias, 50 atributos.

---

## Docs relacionados
- `docs/especificacoes/marketplaces/mercado-livre.md` — referência viva
- `docs/especificacoes/marketplaces/shopee.md` — pendente de alinhamento pleno (ver checklist)
- `docs/especificacoes/marketplaces/tiktok-shop.md` — pendente de alinhamento pleno (ver checklist)
- `docs/especificacoes/sistema/central-comando.md` §1.0 — sub-abas por canal
- `docs/especificacoes/ecommerce/pedidos.md` — filtro "Origem" e badges
- `docs/especificacoes/fiscal/preflight-fiscal-logistico.md` — bloqueios de completude
- `.lovable/memory/features/command-center/dashboard-by-channel-standard.md`
- `.lovable/memory/features/logistics/gateway-vs-local-shipping-routing.md`
- `.lovable/memory/features/customers/profile-enrichment-policy-standard.md`

