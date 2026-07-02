# Logística (Shipping) — Regras e Especificações

> **STATUS:** ✅ Produção (Correios, Frenet e Loggi operacionais via `shipping-quote`)

> **Camada:** Layer 3 — Especificações / Erp  
> **Migrado de:** `docs/regras/logistica.md`  
> **Última atualização:** 2026-06-02


## Visão Geral

Módulo de gestão de envios, transportadoras, regras de frete grátis e frete personalizado.
O cálculo de frete é centralizado na Edge Function `shipping-quote`, que consulta todos os providers ativos em paralelo e retorna opções unificadas com deduplicação inteligente.

---

## Vínculo canônico da remessa

**Regra inegociável:** toda lógica de remessa (rascunho, busca de NF/DC, atualização pós-etiqueta, unicidade) gira em torno do **Pedido de Venda** (`source_pedido_venda_id`). O pedido real (`order_id`) é apenas referência histórica/fallback.

Fluxo canônico:

```
Pedido real (loja ou manual)  ─►  cria Pedido de Venda (módulo Fiscal)
Pedido de Venda (qualquer origem) ─►  cria Rascunho de Remessa
Rascunho de Remessa  ─►  Declaração de Conteúdo ou NF-e  ─►  Etiqueta dos Correios
```

A "regra de pedido real" só serve para **criar o PV automaticamente** quando um pagamento aprova. A partir do PV, **nada mais depende de pedido real existir** — PV manual ou duplicado segue o mesmo caminho.

Garantias no banco:

- Restrição de unicidade primária: `(source_pedido_venda_id, tracking_code)`.
- Restrição legada: `(order_id, tracking_code)` apenas para registros antigos sem PV.
- FK `shipments.order_id` e `shipping_draft_queue.order_id` são `ON DELETE SET NULL` — apagar pedido real **nunca apaga remessa**.
- FK `shipments.source_pedido_venda_id` é `ON DELETE SET NULL` (preserva etiqueta postada) e `shipping_draft_queue.source_pedido_venda_id` é `ON DELETE CASCADE` (rascunho some com o PV).

Garantias no código:

- `shipping-create-shipment` busca NF, DC e rascunho **prioritariamente por PV**, e só recorre a `order_id` quando o PV não está disponível.
- UI de Pendentes, Emitidas e Rastreamento usa join opcional com `orders`; quando o pedido real não existe, exibe `PV {numero}` e dados do destinatário do PV.
- O confirm de "Despacho" no admin atualiza o pedido real apenas quando ele existe; a remessa é marcada como postada independentemente.

Memória anti-regressão: `mem://constraints/shipping-canonical-link-is-pv-not-order`.

---

## Emissão = despachado · Primeiro evento Correios = enviado (2026-06-02)

Decisão de produto: a própria emissão da remessa **já é o despacho**. Não existe
mais botão intermediário "Despachar".

Fluxo no momento da emissão (Correios):

1. Pré-postagem é criada nos Correios e devolve o código de rastreio.
2. O PDF da etiqueta é baixado imediatamente usando o **fluxo assíncrono oficial
   dos Correios em 2 passos** e armazenado no bucket privado `shipping-labels`
   em `<tenantId>/<shipmentId>.pdf`:
   - **Passo 1:** `POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf` com
     `{ codigosObjeto: [trackingCode], tipoRotulo: "P", formatoRotulo: "ET",
        imprimeRemetente: "S", layoutImpressao: "PADRAO" }` → devolve `{ idRecibo }`.
   - **Passo 2:** `GET /prepostagem/v1/prepostagens/rotulo/download/assincrono/{idRecibo}`
     com `Accept: application/json` → devolve JSON com o PDF em base64
     (`dados`/`arquivo`/`rotulo`). Sistema faz polling com backoff (até 6 tentativas)
     até o Correios terminar de gerar.
   - **Endpoint legado proibido:** `/prepostagens/{id}/etiqueta` **não existe** na
     API atual dos Correios (retorna 404 "No static resource"). Não voltar a usá-lo.
   O campo `shipments.label_url` guarda apenas o **path interno** do bucket — nunca
   URL externa. A leitura sempre cria signed URL fresca (1h) na hora do clique.
3. `shipments.delivery_status = 'label_created'` — emissão da etiqueta significa
   "Etiqueta gerada". O status `'posted'` é reservado para o 1º evento real dos
   Correios detectado pelo `tracking-poll`. Não confundir com o status do pedido,
   que vai direto para `'dispatched'` na emissão.
4. Pedido real (quando existe): `orders.status = 'dispatched'`,
   `orders.shipped_at = now()`, `orders.tracking_code = ...`,
   `orders.shipping_carrier = ...`. PVs manuais/duplicados sem pedido real:
   apenas a remessa é marcada — nenhum pedido é tocado.
5. Histórico do pedido recebe ação `dispatched`.
6. Evento canônico `shipment.dispatched` é inserido em `events_inbox` —
   consumido por `process-events` → regras de notificação com
   `rule_type='shipping'` e `trigger_condition='dispatched'`.
7. WMS Pratika é notificado fire-and-forget (`update_tracking`) quando há NF-e
   autorizada vinculada e o tenant tem `auto_send_label=true`.

Transição para "Postado" é responsabilidade exclusiva do polling. Quando
`tracking-poll` detecta o primeiro evento real dos Correios
(`PO/POI/Postado` → `delivery_status='posted'`), o objeto passa de
`label_created` para `posted`, atualiza `orders.status='shipped'` e emite
`shipment.status_changed` (consumido pela regra `trigger_condition='posted'`).
Estados terminais nunca são rebaixados. **O gatilho `posted` em
`process-events` aceita exclusivamente `new_status='posted'`** — `label_created`
e `shipped` não satisfazem mais (correção 2026-06-03 para que a notificação de
"Postado" só dispare quando o objeto realmente sai).

### Documento fiscal vinculado à pré-postagem (NF · DC · ambos) — 2026-06-05

`shipping-create-shipment` (Correios) decide qual documento fiscal vincula
à pré-postagem nesta ordem:

1. **Hint explícito do lojista** (`preferred_doc` no request OU em
   `shipment.metadata.preferred_doc`): `'nfe'`, `'dc'` ou `'both'` — sempre
   respeitado, com fallback de segurança quando o documento pedido não existe.
2. **Default sem hint:**
   - Há NF-e autorizada vinculada → `'both'` (NF estruturada **+** observação
     de DC **+** `itensDeclaracaoConteudo[]`).
   - Não há NF-e → `'dc'`.

Motivo do default `'both'`: contratos PAC comerciais dos Correios rejeitam
pré-postagem só com chave de NF e exigem DC junto (PPN-347 *"Para envio de
produtos é necessário incluir Declaração de Conteúdo"*). Declaração de
Conteúdo é gratuita, sempre aceita pelos Correios e não atrapalha contratos
que aceitam só NF — mandar as duas é o único default seguro multi-contrato.
Lojistas cujo contrato aceita apenas a chave da NF podem forçar `'nfe'`
puro via `preferred_doc`.

Anti-regressão: `mem://constraints/correios-default-nfe-plus-dc-and-pratika-key-sanitize`.

### Impressão de etiqueta, NF-e e Declaração de Conteúdo

A UI da aba **Remessas emitidas** segue a regra: **só fica habilitado o botão
do documento que o pedido realmente possui**. Isso elimina a UX confusa do
botão único "DANFE" que misturava NF-e e DC.

**Ações por linha (cada remessa):**

- **Etiqueta (Printer)** — botão único. Sempre habilitado. Chama
  `shipping-get-label` com `force_refresh=true`, que busca o PDF armazenado ou
  refaz o fluxo assíncrono nos Correios e atualiza o bucket. Não há mais botão
  duplicado de "Reimprimir".
- **DANFE / NF-e (FileText)** — habilitado **somente** se a remessa tem NF-e
  autorizada vinculada (`shipments.invoice_id != null`). Abre o `danfe_url` do
  provedor fiscal. Desabilitado e com tooltip explicativo caso contrário.
- **Declaração de Conteúdo (ScrollText)** — habilitado **somente** se existe
  uma Declaração de Conteúdo `status='issued'` vinculada ao PV ou ao pedido.
  Renderiza o PDF via `reprintExistingDeclaration` a partir do snapshot — nunca
  reemitindo. Desabilitado com tooltip caso contrário.

**Ações em lote (header, com remessas selecionadas):**

- **Etiquetas (N)** — N = total de remessas selecionadas (toda remessa emitida
  tem etiqueta).
- **NFs (N)** — N = quantas das selecionadas têm NF-e vinculada. Desabilitado
  quando N=0.
- **DCs (N)** — N = quantas das selecionadas têm Declaração de Conteúdo.
  Desabilitado quando N=0.
- **Tudo (N)** — N = soma dos 3 anteriores. Imprime, por remessa, apenas o que
  ela efetivamente possui.

Memória anti-regressão:
`mem://constraints/shipping-emit-equals-dispatched-tracking-equals-shipped`.

---

## Objeto de Postagem × Remessa agrupadora (modelo Bling) — 2026-06-02

A camada de **Remessa agrupadora** é adicionada por cima dos objetos de
postagem existentes, sem migração destrutiva. Vale **apenas para o fluxo
local (Correios)**; pedidos via gateway (Frenet) permanecem fora desta
camada e seguem o fluxo gateway atual.

**Conceitos:**

- **Objeto de postagem** — unidade individual. 1 pedido = 1 objeto, com
  rastreio próprio, etiqueta, NF e/ou DC, e status de entrega. É o que
  hoje chamamos de "remessa" no sistema; permanece como registro principal
  e nada do código atual muda.
- **Remessa** — agrupador. Tem número único por loja, transportadora,
  descrição, status, protocolo PLP e a lista de objetos que pertencem
  a ela.

**Regra:** todo objeto emitido pelo fluxo local pertence a uma remessa,
mesmo de 1 objeto. Objetos antigos (anteriores à entrega 2026-06-02)
permanecem sem remessa vinculada — operam normalmente.

**Numeração:** `Remessa_DDMMAAAA.HHMMSS` em horário de São Paulo (BRT),
única por loja. Em colisão (mesmo segundo) recebe sufixo `-N`.

**Status da remessa:**
`rascunho → emitida → parcial → despachada → finalizada` (ou
`cancelada`, apenas a partir de `rascunho`).

**Camada de dados (Fase 1 — entregue 2026-06-02):**

- Tabela `public.shipping_remessas` com RLS por `user_belongs_to_tenant`.
- Coluna opcional `shipments.remessa_id` com `ON DELETE SET NULL`
  (apagar a remessa nunca apaga o objeto já postado).
- Função `public.allocate_remessa_numero(p_tenant_id)` aloca o próximo
  número por data/hora.
- Função `public.recalc_remessa_counters(p_remessa_id)` + trigger
  `shipments_sync_remessa_counters` mantém `total_objetos`,
  `total_emitidos`, `total_falhas` em dia automaticamente.

**Anti-regressão obrigatória:**

1. Emissão individual continua funcionando exatamente como hoje.
2. Objetos sem `remessa_id` permanecem visíveis e operáveis (impressão,
   rastreio, NF/DC).
3. Pratika, notificações e espelho PV ↔ objeto não são tocados.
4. Apagar PV em aberto continua removendo o rascunho do objeto. Se a
   remessa em rascunho ficar vazia, deve ser cancelada (Fase 2).
5. Pedidos via gateway (Frenet) não entram em remessa.
6. URLs e rotas atuais continuam respondendo.
7. **(Fase 2.1 — 03/06/2026)** Todo caminho de despacho local Correios
   (bulk em "Emitir objetos", retry individual em "Remessas pendentes",
   ou qualquer entrada futura) DEVE passar pelo guard
   `ensureRemessaForShipment` antes de chamar `dispatch-shipment`. O
   guard reusa a remessa em rascunho vinculada ao objeto ou aloca uma
   nova de 1 objeto e grava `shipments.remessa_id` antes do despacho.
   Em falha do vínculo, a remessa criada é removida na hora para não
   gerar lote órfão.
8. **(Fase 2.1 — 03/06/2026)** Os botões de impressão por linha
   (Etiqueta, DANFE, Declaração de Conteúdo) na aba "Objetos emitidos"
   exibem spinner e ficam `disabled` enquanto o documento é
    gerado/aberto, impedindo cliques múltiplos.
9. **(Fase 2.1 — 03/06/2026)** A função `recalc_remessa_counters`, chamada pelo
   trigger `shipments_sync_remessa_counters` em todo INSERT/UPDATE/DELETE de
   `shipments`, só pode filtrar por valores reais do enum `delivery_status`
   (`draft`, `label_created`, `posted`, `in_transit`, `out_for_delivery`,
   `delivered`, `failed`, `returned`, `canceled`, `unknown`). Qualquer valor
   inexistente (ex.: `'pending'`) faz o PostgreSQL lançar
   `22P02 invalid input value for enum delivery_status` e reverte
   silenciosamente o UPDATE original — inclusive o vínculo `remessa_id`,
   deixando o objeto órfão e a remessa eternamente em rascunho com
   contadores 0/0/0. Convenção operacional: "não emitido" =
   `delivery_status IN ('draft','label_created')`; "emitido" = qualquer
   outro valor; "falha" = `requires_action = true`.

Memória anti-regressão:
`mem://constraints/shipping-objeto-vs-remessa-agrupadora`,
`mem://constraints/remessa-counters-enum-alignment`.

---

## Espelho PV → Objeto: preservação em conclusão (2026-06-03)

O objeto de postagem é mantido enquanto o Pedido de Venda estiver em
qualquer status **ativo do ciclo de despacho**: `em_aberto`, `pendente`,
`nf_criada` e `concluido`. Nesses status o gatilho
`sync_shipment_with_pv_status` **garante** que o objeto exista (cria se
faltar) e **costura** o vínculo `source_pedido_venda_id` quando o objeto
veio do `scheduler-tick` apenas com `order_id`.

O objeto só é **removido** quando o PV entra num status **terminal de
cancelamento**: `cancelado`, `cancelled`, `cancelled_by_user`,
`expirado`, `expired`, `payment_expired`, `estornado`, `refunded`,
`devolvido`, `returned`, `returning`, `chargeback_em_andamento`,
`chargeback_detected`, `chargeback_perdido`, `chargeback_lost`. E mesmo
nesses casos só remove objetos **sem `tracking_code`** e que não foram
ajustados manualmente. Objeto postado nunca é apagado por mudança de
status do PV.

A função `reconcile_orphan_pv_shipments` (cron a cada 15 min) cobre
também PVs **manuais/duplicados sem `order_id`** — cria o objeto direto
em `shipments` quando o PV ativo não tem objeto nem item ativo na fila.

Memória anti-regressão:
`mem://constraints/pv-status-shipment-mirror-preserves-active`.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Shipping.tsx` | Página principal |
| `src/hooks/useShipments.ts` | Hook de envios |
| `src/components/shipping/ShippingCarrierSettings.tsx` | Config transportadoras |
| `src/components/shipping/CarrierConfigDialog.tsx` | Diálogo de configuração |
| `src/components/shipping/FreeShippingRulesTab.tsx` | Regras frete grátis |
| `src/components/shipping/CustomShippingRulesTab.tsx` | Frete personalizado |
| `supabase/functions/shipping-quote/index.ts` | Edge Function agregadora multi-provider |
| `supabase/functions/frenet-quote/index.ts` | Edge Function legada (Frenet direto) |

---

## Funcionalidades

| Feature | Status | Descrição |
|---------|--------|-----------|
| Lista de envios | ✅ Ready | Com filtros por status |
| Rastreamento | ✅ Ready | Código de rastreio + polling automático |
| Transportadoras | ✅ Ready | Correios (API Code), Frenet, Loggi |
| Frete grátis | ✅ Ready | Regras condicionais |
| Frete personalizado | ✅ Ready | Tabelas por região |
| Cálculo automático | ✅ Ready | Via APIs (Correios, Frenet) |
| Etiquetas | ✅ Ready | PDF e ZPL via Correios |
| Pré-postagem | ✅ Ready | PLP via Correios |

---

## Status de Envio

| Status | Label | Descrição |
|--------|-------|-----------|
| `pending` | Pendente | Aguardando envio |
| `processing` | Processando | Em preparação |
| `shipped` | Enviado | Postado |
| `in_transit` | Em Trânsito | A caminho |
| `out_for_delivery` | Saiu para Entrega | Último mile |
| `delivered` | Entregue | Concluído |
| `returned` | Devolvido | Retornou |
| `failed` | Falhou | Problema na entrega |

---

## Métricas do Dashboard

| Métrica | Descrição |
|---------|-----------|
| Aguardando Envio | Pedidos pendentes |
| Em Trânsito | Pedidos a caminho |
| Entregues (Mês) | Entregas do mês |
| Taxa de Entrega | % de sucesso |

---

## Hierarquia de Frete Grátis

O sistema aplica frete grátis se **qualquer** uma das 3 fontes for verdadeira:

| Prioridade | Fonte | Descrição |
|------------|-------|-----------|
| 1 (Máxima) | **Produto** | Campo `free_shipping` no cadastro do produto. Opcionalmente restrito a um método específico via `free_shipping_method`. |
| 2 | **Cupom** | Cupom de desconto do tipo `free_shipping`. Substitui regras de logística. |
| 3 | **Regras de Logística** | Regras condicionais por região, valor mínimo, categoria, etc. |

> Se um produto atingir qualquer uma dessas 3 regras, terá frete grátis.

### Frete Grátis por Método Específico (v1.1)

O frete grátis pode ser vinculado a um **método de envio específico** (ex: PAC), mantendo os demais (ex: SEDEX) com preço integral como upgrades pagos.

| Configuração | Tabela/Coluna | Descrição |
|---|---|---|
| Global (padrão) | `store_settings.default_free_shipping_method` | Método padrão para frete grátis de todos os produtos |
| Por produto (override) | `products.free_shipping_method` | Sobrescreve o global para um produto específico |

**Hierarquia de resolução:** `products.free_shipping_method` → `store_settings.default_free_shipping_method` → frete grátis em TODOS os métodos (se ambos NULL).

**Comportamento na UI:**
- O método gratuito é **pré-selecionado** automaticamente no calculador de frete e checkout
- Badge verde **"FRETE GRÁTIS"** com valor R$ 0,00 e preço original riscado
- Demais métodos exibem preço integral normalmente

**Comportamento na Edge Function (`shipping-quote`):**
- Identifica o método por `service_name` ou `carrier` (case-insensitive, `includes`)
- Zera o `price` apenas da opção correspondente
- Preserva `original_price` para exibição de "de/por"
- Marca com `is_free: true`

**Select dinâmico no ProductForm:**
- As opções do select de `free_shipping_method` vêm dos `shipping_providers` ativos do tenant (hook `useAvailableShippingMethods`)
- Para Correios, filtra pelos `service_codes` configurados no provider
- Opção "Usar padrão da logística" = `null` (herda global)

**UI de configuração global:**
- Componente `DefaultFreeShippingMethodConfig` em `src/components/shipping/DefaultFreeShippingMethodConfig.tsx`
- Renderizado no topo da aba Frete Grátis (`FreeShippingSubTabs`), acima das sub-tabs de regras e conversão
- Persiste em `store_settings.default_free_shipping_method`
- Select dinâmico com as mesmas opções dos providers ativos (`useAvailableShippingMethods`)
- Opção "Todos os métodos (sem restrição)" = `null`

> **Integração com Barra de Conversão:** Quando `applyToExternalRules` está ativo na `BenefitConfig` (`store_settings.benefit_config`), a barra de progresso do carrinho também reconhece frete grátis vindo dessas 3 fontes, não apenas do valor mínimo configurado na barra. Ver `docs/regras/carrinho.md` → Barra de Conversão.

## Regras de Frete Grátis (Logística)

```typescript
interface FreeShippingRule {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  min_order_value: number;      // Valor mínimo do pedido
  min_order_cents: number;      // Valor mínimo em centavos (usado pelo motor central)
  regions: string[];            // Estados/regiões aplicáveis
  categories: string[];         // Categorias de produto
  valid_from: string;           // Início da vigência
  valid_until: string;          // Fim da vigência
  priority: number;             // Ordem de aplicação
}
```

### Motor Central de Frete Grátis (v2.0)

O sistema utiliza um motor centralizado que é a única fonte de verdade para elegibilidade de frete grátis. A barra de conversão **não possui regras próprias** — ela apenas reflete o estado do motor.

**Fonte do threshold:** O `StorefrontConfigContext` busca regras ativas da tabela `free_shipping_rules` e deriva o `logisticsThreshold` pelo menor `min_order_cents` entre as regras ativas. Este valor substitui qualquer `thresholdValue` legado da `benefit_config`.

**Precedência de fontes:**

| Prioridade | Fonte | Comportamento na barra |
|------------|-------|----------------------|
| 1 | Produto (`free_shipping`) | Estado: `granted_by_product` |
| 2 | Cupom (`free_shipping`) | Estado: `granted_by_coupon` |
| 3 | Regra de Logística (`min_order_cents`) | Estado: `progress` ou `achieved` |

**Consumidores do motor:**
- `BenefitProgressBar` (mini-cart e carrinho normal, via prop `compact`)
- Cotação de frete (`shipping-quote`)
- Checkout
- Criação do pedido

**Regra crítica:** A barra pode ser ativada/desativada sem afetar a aplicação real do benefício. Quando desativada, as regras continuam funcionando na cotação e no pedido.

### Navegação — Frete Grátis (rev 2026-05-29)

As configurações de frete grátis **não estão mais no módulo Logística**. Foram movidas para **Sistema → Configurações → Meios de Envio**, sub-aba **Regras de Frete Grátis** (`/system/settings?tab=shipping&aba=regras-frete-gratis`). A sub-aba contém o card "Método Padrão de Frete Grátis" + a lista de regras (`FreeShippingRulesTab`).

A antiga sub-aba "Conversão de Carrinho" foi movida para **Aumentar Ticket → Conversão de Carrinho** (`/offers` → aba `cart_conversion`). É controle visual da barra de conversão e pertence ao motor de aumento de ticket.

A aba **Meios de Transporte** (credenciais de Frenet/Correios/Loggi do lojista) foi movida para **Integrações → Meios de Envio** (`/integrations?tab=shipping`).

A aba **Frete Personalizado** foi movida para **Sistema → Configurações → Meios de Envio**, sub-aba **Frete Personalizado** (`/system/settings?tab=shipping&aba=frete-personalizado`).

URLs antigas (`/shipping?tab=meios-transporte|frete-gratis|frete-personalizado`) redirecionam automaticamente.

---

## Frete Personalizado

```typescript
interface CustomShippingRule {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  calculation_type: 'fixed' | 'per_kg' | 'percentage';
  base_value: number;
  per_kg_value: number;
  min_value: number;
  max_value: number;
  regions: string[];
  delivery_time_days: number;
  priority: number;
}
```

---

## Integrações de Transportadora

### Arquitetura de Níveis

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ADMIN PLATAFORMA                               │
│                /integrations → tab "logistics"                       │
│  ┌─────────────────────────┐   ┌─────────────────────────────────┐   │
│  │ Loggi OAuth             │   │ Correios                        │   │
│  │ - LOGGI_CLIENT_ID       │   │ (não tem nível plataforma -     │   │
│  │ - LOGGI_CLIENT_SECRET   │   │ cada lojista tem contrato)      │   │
│  └─────────────────────────┘   └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PAINEL DO LOJISTA                               │
│                   /shipping/settings                                 │
│  ┌─────────────────────────┐   ┌─────────────────────────────────┐   │
│  │ Loggi                   │   │ Correios (Código de Acesso)     │   │
│  │ - Company ID            │   │ - Usuário (CNPJ)                │   │
│  │ - Endereço origem       │   │ - Código de Acesso às APIs      │   │
│  │                         │   │ - Número do Contrato            │   │
│  │                         │   │ - Cartão de Postagem            │   │
│  └─────────────────────────┘   └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Loggi — Modelo Híbrido

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Plataforma** | OAuth2 global (`LOGGI_CLIENT_ID`, `LOGGI_CLIENT_SECRET`) | Admin → Integrações → Logística |
| **Tenant** | `company_id` (ID do Embarcador) + endereço de origem completo | Loja → Envios → Configurações |

**Fluxo:** Plataforma obtém token OAuth → Tenant só informa seu embarcador e endereço.

**Campos obrigatórios do tenant:**
- `company_id` — ID do Embarcador fornecido pela Loggi
- `origin_cep`, `origin_street`, `origin_number`, `origin_neighborhood`, `origin_city`, `origin_state`

---

### Correios — Modelo 100% Tenant (Código de Acesso às APIs)

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Tenant** | CNPJ + Código de Acesso às APIs + Contrato + Cartão de Postagem | Loja → Envios → Configurações |

**Fluxo:** Cada lojista tem seu próprio contrato (Meu Correios Empresas) e configura credenciais diretamente usando o método do Código de Acesso.

**Método de autenticação (ÚNICO):**
- **Código de Acesso às APIs** — Usa um código permanente gerado no portal CWS em vez da senha do portal. Mais estável e não quebra se o lojista trocar a senha. **UI (rev 2026-05-29):** a tela de Integrações → Meios de Envio → Correios exibe apenas esta opção (a opção legada "OAuth2 com Senha" foi removida) e não exibe mais a tag "Recomendado" nem menções a outros sistemas (ex.: Bling). O link para `cws.correios.com.br → Gestão de acesso a API's` é mantido.

**Campos obrigatórios:**
- `usuario` — CNPJ do contrato (sem pontuação)
- `codigo_acesso` — Código permanente gerado em cws.correios.com.br → Gestão de acesso a API's
- `contrato` — Número do contrato (ex: 9912689847)
- `cartao_postagem` — Cartão de postagem vinculado (ex: 0079102786)

**Endpoints utilizados:**
- `POST /token/v1/autentica/cartaopostagem` — Autenticação via Código de Acesso
- `GET /cep/v2/enderecos/{cep}` — Consulta de CEP
- `POST /preco/v1/nacional` — Cotação de frete (PAC, SEDEX)
- `GET /rastro/v1/objetos/{codigo}` — Rastreamento SRO
- `POST /prepostagem/v1/prepostagens` — Criação de pré-postagem (PLP)
- `GET /prepostagem/v1/prepostagens/{codigo}/etiqueta` — Geração de etiquetas PDF/ZPL

---

### Frenet — Modelo Tenant (Gateway)

| Nível | Configuração | Local |
|-------|--------------|-------|
| **Tenant** | Token de API + CEP de origem | Loja → Envios → Configurações |

**Fluxo:** Gateway que agrega múltiplas transportadoras. Cada tenant tem seu token Frenet.

### Roteamento de Despacho — Local vs Gateway

Cada integração de envio tem um campo `kind` em `shipping_integrations`:
- `kind = 'local'` (Correios): emissão de etiqueta e despacho ocorrem dentro do sistema, na tela de **Remessas** (`/shipping/shipments`).
- `kind = 'gateway'` (Frenet, Loggi via Frenet): a própria transportadora cuida do despacho. O sistema apenas **sincroniza o pedido** com o gateway via Edge Function `gateway-sync-order` e **anexa o documento fiscal** (DC-e ou NFe) via `gateway-attach-fiscal-doc`.

Cada pedido carrega `orders.resolved_shipping_provider_kind` (preenchido por trigger no momento da escolha do frete). A tela de Remessas filtra automaticamente os pedidos `kind = 'gateway'` — eles **não aparecem** na fila local de etiquetas, evitando despacho duplicado.

Adicionalmente, a Central de Execuções emite o badge **"Rastreamento desativado"** quando uma transportadora ativa tem `supports_quote = true` mas `supports_tracking = false` (gera link direto para `/shipping?tab=settings`).

---

### Fluxo automático de despacho gateway (Frenet) — v2026-05-29

Quando o pedido entra em estado pago e o provedor resolvido é `kind = 'gateway'`, o sistema executa o despacho automaticamente, sem ação do lojista:

1. **Enfileiramento (gatilho `trg_enqueue_fiscal_draft` em `orders`):** o mesmo gatilho que cria o rascunho fiscal insere uma linha em `gateway_sync_queue` com `action = 'sync_order'`, `status = 'pending'`, vinculada ao `provider_id`. Índice único `(order_id, action) WHERE status IN ('pending','processing')` garante idempotência se o pedido oscilar de status.
2. **Consumo (cron `gateway-sync-order-every-2min`):** a cada 2 minutos chama a edge `gateway-sync-order`, que carrega o adapter da transportadora (hoje só Frenet), monta o payload do pedido (endereço, itens, dimensões, transportadora escolhida) e faz POST na API da Frenet. Em caso de erro, aplica backoff exponencial até 5 tentativas; depois marca `failed`.
3. **Gate de recursos:** o cron usa `cron_call_edge_if_active(['shipping_gateway'])`. Se nenhum tenant tem transportadora gateway habilitada, o cron pula a execução. O módulo `shipping_gateway` é registrado em `system_resource_usage` e atualizado por trigger em `shipping_providers` (qualquer ativação habilita o módulo imediatamente, sem esperar o refresh diário).
4. **Anexo da NF-e (`gateway-attach-fiscal-doc`):** quando a NF-e é autorizada, a chave e o XML são anexados ao mesmo pedido Frenet via `external_ref` gravado na fila.

**Pré-requisito único para o lojista:** ativar a Frenet em Integrações → Meios de Envio. Não precisa cotação nem rastreamento ativos — esses controles são independentes (ver seção abaixo).

### Funções independentes por transportadora — v2026-05-29

Cada transportadora tem **três chaves independentes** em `shipping_providers`, e cada uma controla uma função distinta:

| Chave | Controla | Se desligar |
|-------|----------|-------------|
| `is_enabled` | Despacho do pedido (Correios via fila local de Remessas; Frenet via fluxo gateway automático descrito acima). | Pedidos com essa transportadora **não são enviados nem listados em Remessas**. |
| `supports_quote` | Cotação em tempo real para o cliente final no checkout. | Cliente não enxerga essa transportadora nas opções de frete na loja. |
| `supports_tracking` | Atualização automática de status de rastreio (SRO/gateway). | Pedido segue rastreável manualmente, mas sem updates automáticos. |

**Implicação prática (caso comum):** um lojista com Correios e Frenet `is_enabled = true` e cotação/rastreamento desligados ainda recebe e despacha pedidos normalmente — manuais ou por marketplace — porque despacho não depende de cotação nem de rastreamento. O que ele perde é só a vitrine de cotação no checkout e o auto-update de status.

---


### Status das Integrações

| Transportadora | Cotação | Rastreamento | Etiquetas | Pré-postagem | Status |
|----------------|---------|--------------|-----------|--------------|--------|
| Frenet | ✅ | ✅ (via gateway) | ✅ (via gateway) | ✅ | **Produção** |
| Correios (API Code) | ✅ | ✅ SRO | ✅ PDF/ZPL | ✅ PLP | **Produção** |
| Loggi | ✅ (via Frenet) | 🟧 | 🟧 | 🟧 | **Parcial** — cotação direta depende de confirmação do `externalServiceId` |
| Melhor Envio | 🟧 | 🟧 | 🟧 | 🟧 | **Pendente** |
| Jadlog | 🟧 | 🟧 | 🟧 | 🟧 | **Pendente** |

---

## Edge Function `shipping-quote` — Agregador Multi-Provider

### Arquitetura

```
Cliente → shipping-quote (Edge Function)
                │
                ├─── Regras de Frete Grátis (DB)
                ├─── Regras de Frete Personalizado (DB)
                ├─── Frenet API (token do tenant)
                ├─── Correios API REST v1 (credenciais do tenant)
                └─── Loggi API v2 (OAuth plataforma + company_id tenant)
```

### Fluxo de Execução

1. Resolve tenant pelo host (domain-aware)
2. Busca em paralelo: regras (free/custom), providers ativos, store_settings
3. Para cada provider ativo com `supports_quote = true`, chama adapter específico
4. Aplica timeout de 10s por provider
5. Deduplica opções por `source_provider|carrier|service_code|estimated_days`
6. Retorna regras primeiro (frete grátis no topo), depois opções de transportadoras

### Deduplicação (REGRA CRÍTICA)

A chave de deduplicação **DEVE incluir `source_provider`** para que opções iguais vindas de providers diferentes NÃO sejam mescladas:

```typescript
const key = `${opt.source_provider}|${carrierNorm}|${codeNorm}|${opt.estimated_days}`;
```

**Justificativa:** Se Frenet retorna PAC e Correios direto também retorna PAC, ambas devem aparecer porque os preços podem diferir.

### Correios — Notas Técnicas

- **Autenticação:** Usa `POST /token/v1/autentica/cartaopostagem` com Basic Auth (usuario:codigo_acesso)
- **Cotação:** `POST /preco/v1/nacional` com batch de serviços (SEDEX 03220 + PAC 03298)
- **PROIBIDO:** Enviar `nuContrato` e `nuDR` no payload de preço — causa erro **PRC-124** pois já estão embutidos no token do cartão de postagem
- **Valor Declarado:** Só enviar `servicosAdicionais` com VD se `require_declared_value = true` nas settings do provider
- **Prazo:** Usar campo `prazoEntrega` com fallback para `prazo`, default 5 dias

### Loggi — Notas Técnicas

- **Auth:** OAuth2 com secrets da plataforma (`LOGGI_CLIENT_ID`, `LOGGI_CLIENT_SECRET`)
- **Cotação direta:** Endpoint `POST /v1/companies/{companyId}/quotations` — requer endereço completo (não aceita apenas CEP)
- **Formatos tentados:** `correiosAddress` → fallback `addressLines` — API ainda rejeita com "Address field required"
- **Status atual:** Cotação Loggi funciona via **Frenet gateway** (Frenet retorna opção Loggi)
- **Pendência:** Confirmar formato correto de endereço ou `externalServiceId` com equipe Loggi

---

## Fluxo de Cálculo de Frete

```
1. Cliente informa CEP no checkout
2. Sistema chama shipping-quote com CEP + itens do carrinho
3. Edge Function verifica regras de frete grátis (primeira match)
4. Verifica regras de frete personalizado (todas que match)
5. Consulta transportadoras ativas em paralelo (Frenet, Correios, Loggi)
6. Deduplica opções (por provider + carrier + serviço + prazo)
7. Retorna opções ordenadas: grátis primeiro, depois por preço
8. Cliente seleciona opção
9. Valor adicionado ao pedido
```

---

## Regra Crítica: Filtro de Preço (REGRA FIXA)

| Regra | Descrição |
|-------|-----------|
| **Filtro de preço** | `ShippingPrice >= 0` (inclui frete grátis) |
| **Proibido** | Filtrar com `> 0` pois exclui opções grátis |

Todas as Edge Functions de cotação (frenet-quote, shipping-quote) DEVEM usar `>= 0` para não excluir opções de frete grátis promocional.

---

## Campos de Envio no Pedido

| Campo | Descrição |
|-------|-----------|
| `shipping_carrier` | Transportadora selecionada |
| `shipping_method` | Método (PAC, SEDEX, etc) |
| `tracking_code` | Código de rastreio |
| `shipped_at` | Data de envio |
| `delivered_at` | Data de entrega |
| `shipping_status` | Status atual |
| `estimated_delivery` | Previsão de entrega |

---

## Rascunhos Logísticos (Automação)

O sistema cria rascunhos logísticos automaticamente quando um pagamento é aprovado — no mesmo gatilho que cria os rascunhos fiscais. Isso garante que as remessas estejam prontas para envio imediato ao emitir a NF-e.

**Especificação completa:** `docs/especificacoes/erp/rascunhos-logisticos.md`

| Aspecto | Descrição |
|---------|-----------|
| **Gatilho** | Trigger SQL `enqueue_fiscal_draft()` — insere em `shipping_draft_queue` |
| **Processamento sob demanda** | Após criar/duplicar um PV manual, a edge `fiscal-create-manual` dispara (fire-and-forget) a edge `shipping-draft-process`, que consome a fila imediatamente. O operador vê o objeto em "Prontos para emitir" em segundos, sem aguardar o cron. |
| **Rede de segurança (cron)** | `scheduler-tick` fase 1.6 continua rodando a cada 10 min como fallback para itens que escaparem do disparo direto (ex.: gatilhos de webhook de pagamento, falhas transitórias). |
| **Separação** | Por transportadora baseada em `orders.shipping_carrier` ou `fiscal_invoices.transportadora_nome` (PV manual). |
| **Modos** | Automático (envia ao emitir NF) ou Manual (rascunho para revisão). |

> **Decisão de arquitetura (2026-06-03):** mantemos o cron de 10 min como rede de segurança em vez de reduzi-lo para 1–2 min. O disparo sob demanda resolve a latência percebida pelo operador sem multiplicar invocações ociosas (custo extra ≈ zero).

---

## Sincronia com Pedidos em Regressão (v2026-05-01)

Quando um pedido entra em estado regressivo (`cancelled`, `returned`, `chargeback_detected`, `chargeback_lost`, `payment_expired`, `invoice_cancelled`), o módulo Logística reage automaticamente:

- **Etiqueta em rascunho/pendente:** linhas correspondentes em `shipping_draft_queue` com status `pending`/`processing` recebem `status = 'cancelled'`, `cancelled_at` e `cancel_reason = 'order_regression:<motivo>'` via trigger `cancel_pending_drafts_on_regression`. Não há geração de etiqueta nem despacho.
- **Etiqueta já gerada e não entregue:** o `shipments` correspondente recebe `requires_action = true` e `action_reason = <motivo>` via trigger `handle_order_shipping_alert`. Aparece no banner em `OrderDetail` e no card "Pedidos" da Central de Execuções como "Etiquetas a reverter". O cancelamento/devolução é manual (exige processo logístico).
- **Reforço idempotente:** a edge function `order-regression-handler` reaplica as marcações em transições que não passam pelo `core-orders` (webhooks de chargeback, cron de expiração).

Detalhe completo do pipeline: `docs/especificacoes/ecommerce/pedidos.md` §4.6.

---

## Reemissão após cancelamento pelos Correios (2026-07-02)

Quando o rastreio dos Correios registra que a pré-postagem foi cancelada
("Etiqueta cancelada pelo sistema de captação", "objeto cancelado",
"postagem cancelada" ou variantes), o sistema:

1. **Detecta automaticamente** no `tracking-poll` — atualiza
   `shipments.delivery_status='canceled'`, `requires_action=true` e
   `action_reason='correios_prepost_canceled'`.
2. **Move o objeto** para a aba **"Problemas de envio/entrega"** com
   mensagem PT-BR: "Etiqueta cancelada pelos Correios. Reemita para
   gerar um novo código de rastreio."
3. **Oferece o botão "Reemitir etiqueta"** na linha do objeto —
   habilitado apenas quando `delivery_status='canceled'`, transportadora
   é Correios e ainda não há reemissão registrada em
   `metadata.reissued_to_shipment_id`.

O botão chama a edge `shipping-reissue-label`, que:

- Bloqueia se o objeto tem evento pós-despacho real
  (`posted/in_transit/out_for_delivery/delivered/returned`) — nesse caso
  a única saída é abrir chamado nos Correios.
- Cria **novo Objeto de Postagem** com numero próprio alocado pelo
  trigger `trg_shipments_set_numero`, herdando `source_pedido_venda_id`,
  `order_id`, `invoice_id`, `remessa_id`, `carrier`, `service_code/name`,
  `nfe_key` e dimensões/peso do objeto antigo. `source='reissue'`.
- Grava referência cruzada: `metadata.reissued_from_shipment_id` no
  novo, `metadata.reissued_to_shipment_id` no antigo (idempotência).
- Invoca `shipping-create-shipment` internamente para efetivar a
  pré-postagem CWS e obter novo AP.
- Ressincroniza WMS Pratika via `wms-pratika-send` (`update_tracking`,
  `force=true`) com o novo `tracking_code`.
- Se o pedido é marketplace (`marketplace_source ∈ {mercado_livre}`),
  enfileira novo envio em `meli_invoice_send_queue`.
- Registra `core_audit_log` com `action='shipment.reissue_label'`.

O objeto antigo **permanece** com `delivery_status='canceled'` para
auditoria — nunca é excluído. A UI mostra "Reemitida no objeto #N ·
{novo_rastreio}" no card do antigo.

**O que NUNCA pode acontecer:**

- Atualizar o `tracking_code` do objeto antigo com o novo código — quebra
  a numeração monotônica (`mem://constraints/shipment-own-numero-and-no-manual-create`).
- Reemitir objetos gateway (Frenet, ML full/flex) por esta edge — só
  transportadora Correios (`carrier='correios'`).
- Deixar Pratika desatualizada após reemissão bem-sucedida — falha na
  ressincronização deve ficar logada em `wms_pratika_logs` para
  reconciliação manual.

Memória anti-regressão: `mem://constraints/shipment-reissue-after-correios-cancel`.

### Critério de inclusão na aba "Problemas de envio/entrega"

A aba lista apenas objetos com pendência logística real. O split é:

- `delivery_status IN ('failed','returned','unknown')` — sempre entram.
- `delivery_status = 'canceled'` — entra **somente** quando
  `action_reason = 'correios_prepost_canceled'` (cancelamento real dos
  Correios exigindo reemissão).

Cancelamentos com outros motivos **não aparecem** aqui, pois o fluxo
que os originou já se resolveu em outro módulo:

| `action_reason`         | Origem                                     | Onde é tratado                    |
| ----------------------- | ------------------------------------------ | --------------------------------- |
| `invoice_cancelled`     | NF autorizada e depois cancelada           | Fiscal — PV volta a "pronto p/ NF"|
| `pv_deleted`            | PV excluído (cascata no trigger)           | Fiscal — Pedido de Venda          |
| `cancelled` / `expired` | Regressão do pedido (pagamento/estorno)    | Pedidos                           |

Esses objetos permanecem no banco para auditoria; apenas não geram
alarme na Logística Interna.

### Cancelamento total de um envio já com etiqueta emitida

Quando o operador decide não enviar mais um pedido cuja NF já foi
emitida e o objeto logístico já existe:

1. **Cancelar a NF** na aba "Notas Fiscais". Isso dispara os gatilhos
   que devolvem o PV ao estado "pronto p/ NF" e marcam o objeto com
   `action_reason='invoice_cancelled'`.
2. **Excluir o PV** na aba "Pedidos de Venda". O gatilho
   `cascade_delete_shipments_on_pv_delete`:
   - **Exclui** o objeto se ele era o único da remessa;
   - **Marca como `canceled` com `action_reason='pv_deleted'`** se
     houver outros objetos na mesma remessa (para não corromper vizinhos).
3. Guarda de segurança: o gatilho **bloqueia** exclusão do PV se algum
   objeto vinculado estiver em
   `posted/in_transit/out_for_delivery/delivered/returned/failed`
   (já despachado de verdade). Nesse caso o operador deve tratar como
   ocorrência real de logística (chamado Correios, devolução, etc.).

Após esse fluxo, o objeto residual não aparece mais na aba "Problemas
de envio/entrega" — o critério de inclusão acima filtra
`invoice_cancelled` e `pv_deleted`.

---





## Pendências

- [ ] Integração Melhor Envio
- [ ] Integração Jadlog
- [ ] Cotação direta Loggi (formato de endereço pendente)
- [ ] Rastreamento Loggi
- [ ] Etiquetas Loggi
- [ ] Notificações de status automáticas
- [ ] UI de rascunhos logísticos no módulo logístico
- [ ] UI de etiquetas para impressão em lote

---

## Origem do Rascunho Logístico (2026-05-27)

A criação automática de rascunhos de remessa **passou a nascer do Pedido de Venda Fiscal**, não mais do pedido pago.

- Quando um Pedido de Venda raiz é criado (vindo de um pedido aprovado, manual ou duplicado), o sistema gera automaticamente o rascunho logístico vinculado a ele.
- Pedidos via gateway (ex.: Frenet) e marketplaces continuam fora da fila local, seguindo seus próprios fluxos.
- A remessa carrega um vínculo direto com o Pedido de Venda de origem. O vínculo histórico com o pedido permanece apenas para rastreabilidade.
- **Pedidos de Venda manuais e duplicados agora também geram rascunho de remessa automaticamente** — antes só pedidos reais geravam.
- Excluir um Pedido de Venda em rascunho remove junto a remessa-rascunho vinculada. Remessas já despachadas (com etiqueta válida) são preservadas.
- **Fiscal e Logística nunca alteram o pedido original.** Cancelamento ou exclusão de Pedido de Venda nunca cascateia para o pedido.

**Independência do pedido real (2026-05-27):** o processador da fila lê endereço, peso, dimensões e transportadora diretamente do Pedido de Venda quando não há pedido vinculado (caso de PV manual ou duplicado). Na duplicação, o serviço da transportadora (PAC/SEDEX/etc.) também é preservado. Excluir um PV em aberto remove o rascunho de remessa correspondente, exceto se já houver código de rastreio postado.

**PV manual/duplicado nasce "em aberto" (2026-05-28):** todo Pedido de Venda criado manualmente ou por duplicação (sem pedido real vinculado) já nasce com status "Pedido em aberto". Isso aciona o espelho na hora e a remessa-rascunho aparece automaticamente em "Prontos para emitir remessa", com destinatário, endereço, transportadora, serviço, peso e dimensões herdados do PV de origem. Caso real corrigido: PV 353 do Respeite o Homem (duplicado do 352) — entrava sem status e por isso não gerava remessa.

**Exclusão em cascata — respeita agrupamento por remessa (rev 2026-06-08):**

Ao excluir um Pedido de Venda raiz, o gatilho
`trg_cascade_delete_shipments_on_pv_delete` percorre cada objeto de postagem
vinculado e decide individualmente:

| Situação do objeto | O que acontece |
|---|---|
| Objeto sem remessa (`remessa_id IS NULL`) | Objeto excluído. |
| Objeto sozinho na sua remessa | Objeto excluído. A remessa-agrupadora fica vazia e é removida pelo gatilho `trg_cleanup_empty_remessa_after_shipment_delete` (apenas em `rascunho` ou `emitida`). |
| Objeto acompanhado por outros na mesma remessa | Objeto **marcado como cancelado dentro da remessa** (`delivery_status = 'cancelled'`, `action_reason = 'pv_deleted'`). Não exclui nem o objeto nem a remessa — preserva o histórico do agrupador despachado. |

A regra anterior (2026-06-03), que apagava todo objeto sem exceção,
provocava buracos em remessas agrupadas com múltiplos objetos. A revisão
2026-06-08 alinha a cascata ao modelo "objeto é despachado dentro de uma
remessa": o agrupador sempre sobrevive enquanto tiver objetos vivos.

**Bloqueio de exclusão de PV de pedido pago (2026-06-03):** a tela Fiscal
não permite mais excluir um Pedido de Venda vinculado a um pedido pago e
ativo. O gatilho `trg_guard_pv_deletion_from_paid_order` aplica a mesma
proteção no banco. Para descartar, o operador precisa **cancelar o pedido na
tela de Pedidos** — a cascata existente apaga o PV e o objeto em seguida.
PV manual (sem pedido vinculado) e PV de pedido não pago (expirado,
cancelado, aguardando pagamento) continuam excluíveis normalmente.

**Auditoria de exclusão (2026-06-03):** toda exclusão de Pedido de Venda
grava um snapshot em `pv_deletion_audit` (número, série, pedido de origem,
cliente, total, itens, quem excluiu, quando) via gatilho
`trg_audit_pv_deletion`. Registro permanente para recuperação manual em caso
de exclusão por engano.

Anti-regressão: `mem://constraints/shipping-pv-delete-cascade-by-shipment-state`,
`mem://constraints/pv-from-paid-order-deletion-protected` e
`mem://constraints/shipping-draft-mirrors-pedido-venda`.


---

## Reconciliação de objeto logístico órfão (2026-06-08, atualizado)

A criação do objeto de postagem acontece automaticamente quando o Pedido de
Venda é inserido (gatilho `trg_enqueue_shipping_draft_from_pv`). Se o objeto
sumir depois (cancelamento de NF, limpeza, falha pontual), o PV ficaria
órfão e nenhuma nova tentativa seria criada. Foi a causa do gap do PV 395
(Maria da Glória, Respeite o Homem, 2026-06-08) e dos PVs 563/565
(2026-06-03).

**Rede de segurança permanente — 3 camadas:**

1. **Índice único parcial na fila de rascunhos.** A regra de "1 entrada
   aberta por Pedido de Venda" passa a valer apenas enquanto a entrada está
   `pending` ou `processing`. Entradas `done`, `cancelled` e `failed`
   ficam preservadas para histórico mas não bloqueiam a reconciliação de
   abrir uma nova tentativa.

2. **Dedup do processador considera só objeto ativo.** O `scheduler-tick`
   (PHASE 1.6) só pula a criação se já existir um shipment com
   `delivery_status <> 'canceled'`. Objeto cancelado é tratado como
   inexistente — evita marcar a fila como concluída por engano.

3. **Função `public.reconcile_orphan_pv_shipments(p_tenant_id uuid DEFAULT NULL)`** +
   **cron `reconcile-orphan-pv-shipments-15m`**. Varre todos os Pedidos de
   Venda ativos sem objeto e sem item aberto na fila, e enfileira uma nova
   tentativa (que o scheduler-tick consome normalmente).
   - Pula pedidos `cancelled`/`refunded`/`expired`/`chargeback_lost`/
     `chargeback_detected`/`returning`/`returned`.
   - Pula marketplace (`marketplace_source` fora de
     storefront/checkout/manual/link/admin) e pedidos via gateway
     (`provider_kind='gateway'`, ex.: Frenet).
   - Para PV manual/duplicado sem pedido real, cria o objeto direto.

**Resultado:** qualquer objeto que sumir por qualquer motivo volta a
aparecer na fila de Logística na próxima rodada (no máximo 15 minutos).
O gap "PVs ativos > objetos logísticos" nunca persiste.

Anti-regressão: ver `mem://constraints/orphan-pv-shipment-reconciliation`.

---

## Integridade Objeto × Agrupador × NF (2026-06-05)

Três proteções estruturais garantem que **Objetos de Postagem**, **Remessas agrupadoras** e **Notas Fiscais** nunca fiquem fora de sincronia.

**1. Todo objeto despachado tem agrupador (auto-cura).**
Qualquer objeto de postagem que ganhe código de rastreio passa a ter, obrigatoriamente, uma Remessa agrupadora válida. Se por qualquer motivo o objeto for criado/atualizado sem agrupador (ou apontando para um agrupador que não existe mais), o sistema cria automaticamente uma Remessa nova ("Agrupador recuperado automaticamente") já no status "Despachada", na mesma transação. Resultado: as abas **Objetos** e **Remessas** ficam sempre 1:1, sem objetos invisíveis na lista de Remessas.

**2. Remessa com objetos ativos não pode ser apagada.**
Tentar excluir uma Remessa agrupadora que ainda tem objetos ativos vinculados (com rastreio e não cancelados) é bloqueado com a mensagem: *"Não é possível excluir esta remessa: existem N objeto(s) de postagem ativo(s) vinculado(s)."* Para excluir, é preciso primeiro cancelar/desvincular os objetos.

**3. Cancelar a NF respeita o estado do objeto vinculado (rev 2026-06-08).**
O cancelamento de NF é **bloqueado** quando o objeto logístico vinculado está
em andamento (`postado`, `em trânsito`, `saindo para entrega`), `entregue` ou
`devolvido`. Só é permitido quando o objeto está em `etiqueta gerada` /
`cancelado` ou quando não existe objeto. Ao cancelar com sucesso:
- O objeto vinculado é marcado como `cancelado` (motivo "NF cancelada") e
  desvinculado da nota.
- O Pedido de Venda pai volta para **"Pedido em aberto"** sem nenhuma
  observação herdada (sem "NF cancelada", sem "Pedido sem itens"), com as
  pendências antigas zeradas.
- A NF cancelada fica liberada para exclusão (vínculo com o objeto é
  desfeito).

**Regra geral (resumo das 3 perguntas do operador):**
1. **Objeto logístico só é excluído** como consequência da exclusão do PV,
   e mesmo assim a exclusão do PV é **bloqueada pelo banco** (não só pela
   tela) se o objeto estiver em andamento (`postado`, `em trânsito`,
   `saindo para entrega`) ou já entregue/devolvido. A trava é a regra
   `PV_SHIPMENT_IN_PROGRESS` aplicada por gatilho de banco; a tela
   mostra a mensagem: *"Este Pedido de Venda tem um objeto de postagem
   em andamento ou já entregue ao cliente. Cancele o envio no módulo de
   Logística antes de excluir."*
2. **NF só pode ser cancelada** se o objeto vinculado estiver em "etiqueta
   gerada", "cancelado" ou inexistente — nunca com objeto em andamento ou
   entregue.
3. **Ao cancelar uma NF** com objeto em "etiqueta gerada" / "cancelado" /
   inexistente, o PV volta para "Pedido em aberto" limpo, pronto para
   gerar nova NF.

> ⚠️ **Grafia oficial do status do objeto (rev 2026-06-08b):** o valor
> canônico de cancelamento em `shipments.delivery_status` é **`canceled`**
> (um L, padrão americano). Triggers, edge functions e validações na UI
> devem usar exatamente essa grafia — `cancelled` (dois L) não existe no
> enum e gera erro de cast em produção. Mensagem na tela ao tentar
> excluir PV/NF diferencia explicitamente "Pedido de Venda" de "Nota
> Fiscal" (sem texto genérico "Erro ao excluir nota").

**Caso de origem:** pedido #583 da Maria (Respeite o Homem, 2026-06-05) e
PV 403 / NF 404 (2026-06-08) — testes E2E que motivaram as proteções
acima e a padronização da grafia do enum.

Anti-regressão: ver `mem://constraints/shipping-remessa-self-heal-and-cancel-cascade`,
`mem://constraints/nf-cancel-blocked-by-shipment-state`,
`mem://constraints/nf-cancel-reopens-pv-clean` e
`mem://constraints/shipping-delivery-status-enum-spelling-canonical`.


---

## Espelho vivo: Remessa ↔ Pedido de Venda em aberto (2026-05-27)

A fila de **Remessas** é espelho automático dos **Pedidos de Venda com status "Pedido em aberto"**.

**Regra:**
- Pedido de Venda passa para "em aberto" → remessa em rascunho aparece automaticamente.
- Pedido de Venda sai de "em aberto" (cancelado, chargeback, NF criada, concluído, etc.) → remessa em rascunho some automaticamente **E itens ainda pendentes na fila de processamento são cancelados** (impede recriação por retry tardio).
- Pedido de Venda volta para "em aberto" → remessa em rascunho retorna.
- **Remessas com etiqueta já postada (com código de rastreio) nunca são tocadas.**
- Pedidos via gateway (Frenet etc.) seguem fluxo próprio, fora da fila local.

**Trava anti-corrida no processador da fila (2026-05-27):** antes de criar a remessa, o worker revalida o estado do Pedido de Venda. Se o PV já saiu de "em aberto" (NF emitida, cancelado, chargeback) entre o enfileiramento e o processamento, o item da fila é cancelado com motivo `pv_not_em_aberto:<status>` e nenhuma remessa órfã é gerada. Caso encontrado: PV 347 (Lesinete duplicado) — remessa órfã removida em 2026-05-27.

**Resultado:** quantidade de Pedidos de Venda em aberto = quantidade de remessas locais em rascunho + remessas via gateway. Sem órfãs, sem faltantes, sem manutenção manual, sem janela de corrida.

**Acerto de carga (2026-05-27):** removidas 2 remessas órfãs (PVs em chargeback) + 1 remessa órfã do PV 347 (criada fora da janela do espelho); reconciliado 1 PV em aberto sem remessa local (era gateway, fluxo correto).

**Status interno da remessa-rascunho:** ao nascer pelo espelho do Pedido de Venda, a remessa é criada com status interno **"rascunho"** (não "etiqueta criada"). Esse é o valor que a aba "Prontos para emitir remessa" filtra. Criar com qualquer outro status torna a remessa invisível na tela, mesmo existindo no banco. Incidente 2026-05-27 (PVs 348 e 349 da Respeite o Homem): gatilho estava marcando como "etiqueta criada" e as remessas não apareciam — corrigido e 2 registros regularizados.

**Peso e dimensões na criação automática (2026-05-27):** o gatilho de espelhamento agora calcula peso (gramas), altura, largura, profundidade e valor declarado a partir dos itens do pedido (ou dos itens do PV, quando manual), usando o cadastro do produto e fallback de 300 g por item quando não houver peso cadastrado. Transportadora e serviço (PAC/SEDEX/etc.) também são propagados do pedido para a remessa. Incidente 2026-05-27 (pedidos 536 e 537 da Respeite o Homem): remessas nasceram sem peso/serviço porque foram criadas antes desse ajuste — backfill aplicado.

**Ações manuais no rascunho (2026-05-27):** na aba "Prontos para emitir remessa" o operador pode **criar novo rascunho**, **editar** (peso, dimensões, transportadora, serviço, destinatário, endereço completo, telefone, valor declarado) e **excluir** rascunhos. Qualquer edição ou criação manual marca a remessa como **ajustada manualmente** e, a partir daí, o sistema não recalcula nem apaga esse registro automaticamente — a responsabilidade passa a ser do operador. O espelhamento automático continua valendo apenas para rascunhos que nunca foram tocados manualmente.

**Posicionamento do botão "Emitir Remessa" (2026-05-28):** o botão de emissão fica no topo da aba "Prontos para emitir remessa", ao lado de "Criar novo rascunho", junto ao contador de pedidos e ao indicador de seleção. Fica desabilitado quando nenhum rascunho está selecionado e mostra a quantidade selecionada entre parênteses quando há seleção. Não existe mais barra inferior duplicada — a ação principal acompanha o cabeçalho e fica sempre visível sem precisar rolar a lista.

**Despacho do rascunho (2026-05-28):** o botão "Emitir Remessa" passa a operar **sobre o próprio rascunho selecionado**, não sobre o pedido. Isso resolve dois casos que antes falhavam silenciosamente: (1) rascunhos de Pedido de Venda manual/duplicado sem pedido real vinculado — agora o sistema lê destinatário, peso, dimensões, transportadora e serviço diretamente do rascunho e do PV; (2) pedidos com mais de um rascunho, em que só um era contemplado. Mensagens de erro passam a ser **por linha**, identificando o rascunho e o motivo (sem CEP, recusa da transportadora, etc.), no lugar do antigo aviso genérico "X falharam".

**Vínculo fiscal obrigatório para Correios (revisado 2026-06-02):** a emissão de remessa pelos Correios exige **NF-e autorizada** OU **Declaração de Conteúdo emitida** vinculada ao pedido (ou ao Pedido de Venda, quando for PV manual/duplicado). Sem nenhum dos dois, a emissão é **bloqueada** com a mensagem em PT-BR: *"Este pedido não tem Nota Fiscal autorizada nem Declaração de Conteúdo. Emita uma das duas em Fiscal antes de despachar pelos Correios."*

- **Com NF-e autorizada:** o sistema anexa automaticamente número, série, chave de acesso e valor da NF no envio (campos `numeroNotaFiscal`, `serieNotaFiscal`, `chaveAcessoNotaFiscal`, `valorNotaFiscal` do CWS).
- **Com Declaração de Conteúdo emitida:** o sistema anexa automaticamente o número da Declaração na observação do envio (`observacao: "Declaracao de Conteudo no DC-XXXXX"`). Isso satisfaz a exigência **PPN-347** dos Correios. Não há geração silenciosa de Declaração — ela continua sendo emitida pelo operador no módulo Fiscal, conforme o motor único documentado em `docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md`.
- **Emissão automática** (gatilho disparado quando a NF-e é autorizada): permanece como antes — só dispara após a autorização da NF, então o vínculo fiscal já está garantido.
- **Pedidos via gateway** (Frenet, Loggi via Frenet) seguem o caminho próprio (`gateway-attach-fiscal-doc`), que pode gerar Declaração automaticamente para o gateway. O bloqueio descrito aqui vale apenas para o despacho local Correios.

**Campos obrigatórios no payload da pré-postagem (revisão 2026-06-02):** além do peso, dimensões, remetente e destinatário, o payload passou a incluir obrigatoriamente:

- `codigoFormatoObjeto: 2` (caixa, padrão; envelope = 1, cilindro = 3).
- `cienteObjetoNaoProibido: 1` — declaração obrigatória de ausência de itens proibidos (resolve **PPN-330**).
- Telefones (remetente e destinatário) enviados na estrutura separada esperada pelo CWS: **DDD** + **telefone fixo** ou **DDD** + **celular**, ambos só com dígitos. Cadastros com máscara `(11) 91955-5920` são quebrados automaticamente em DDD `11` + celular `919555920` antes do envio.
- Documento (CPF/CNPJ) do remetente também sanitizado para apenas dígitos.
- O peso do objeto também é enviado no campo textual compatível com o schema do CWS, além do valor numérico interno já calculado no rascunho, para evitar rejeição por payload incompatível.
- Quando a remessa segue com **Declaração de Conteúdo** em vez de NF-e, o envio também leva a lista estruturada dos itens declarados no payload, além da observação com o número da declaração, para cumprir a validação mais estrita do endpoint de pré-postagem.

**Leitura de erro dos Correios (revisão 2026-06-02):** a resposta de erro do CWS hoje vem como lista de strings em `msgs`. O sistema lê esse formato e cai para o formato legado (`{texto: ...}[]`) quando necessário. As mensagens são concatenadas com ` • ` e exibidas na tela em PT-BR — o problema antigo de aparecer "PV 371: , , , , ," foi resolvido.




**Diálogo de rascunho — comportamento (2026-05-28):**

- **Editar** pré-carrega automaticamente os dados reais: vindos do pedido (`orders`) quando há vínculo de pedido, ou do Pedido de Venda Fiscal (`fiscal_invoices`) quando o rascunho nasceu de um PV manual/duplicado. O operador edita só o que precisa ajustar — nenhum campo nasce em branco quando há fonte de verdade disponível.
- **Criar novo** oferece dois modos: **A partir de um pedido** (busca pelo número do pedido e pré-preenche destinatário, endereço, peso, dimensões e serviço) ou **Avulso** (sem vínculo com pedido, preenchimento 100% manual — útil para envios pontuais).
- **Campos obrigatórios** (a UI bloqueia salvar com mensagem clara em PT-BR): transportadora, serviço, peso, altura, largura, comprimento, nome do destinatário, CPF ou CNPJ, telefone com DDD, CEP (8 dígitos), rua, número, bairro, cidade e UF. Esses são exatamente os campos que os Correios exigem para autorizar a etiqueta e devolver o código de rastreio.
- **Busca por CEP**: ao sair do campo CEP, o sistema consulta o ViaCEP e preenche rua, bairro, cidade e UF quando estiverem vazios. Não sobrescreve o que o operador já digitou.
- **Painel "Remetente (loja)"** aparece em somente leitura e mostra os dados da loja vindos das configurações de transportadora. Se faltar algum dado obrigatório do remetente (nome, CPF/CNPJ, telefone, CEP, endereço completo), um alerta amarelo aparece pedindo para completar em **Configurações → Transportadoras → Correios** antes de emitir.
- **Override na emissão**: quando a remessa está marcada como ajustada manualmente, a função de emissão dos Correios usa os dados do rascunho (destinatário, endereço, peso, dimensões) em vez de buscar no pedido. Isso garante que o ajuste do operador realmente chega na etiqueta — antes de 2026-05-28, edições no rascunho eram silenciosamente ignoradas na hora de emitir.
- **CPF/CNPJ do destinatário** passou a ser obrigatório no payload dos Correios (antes era enviado vazio). Contas Correios com validação estrita rejeitavam etiquetas sem documento — corrigido em 2026-05-28.



Anti-regressão: ver `mem://constraints/shipment-mirrors-pedido-venda-em-aberto`.


---

## Integração WMS Pratika

A integração com o WMS Pratika (DDS Informática) opera de forma **reativa e combinada**: a Pratika só considera um documento "recebido" quando a NF-e **e** o código de rastreio chegam **juntos**, sob o **mesmo CNPJ de 14 dígitos puros (sem máscara)**. Por isso, o sistema unifica os dois envios em uma única operação.

### Quando o sistema envia para o Pratika

1. O gatilho dispara nos dois eventos: autorização da NF-e (webhook ou checagem de status) e registro do código de rastreio (manual ou automático).
2. Cada gatilho chama a **ação combinada** (NF + rastreio juntos). A função verifica os dois lados:
   - Se **um** dos lados ainda não está pronto, responde "aguardando" e **não envia nada**. Quando o segundo lado fica pronto, o gatilho desse evento dispara a operação completa.
   - Se **ambos** estão prontos, a operação executa em sequência na mesma invocação: primeiro o XML da NF-e (`RecepcaoDocNfe`), depois o rastreio (`AtualizarCodRastreioNfe`).
3. Se a segunda etapa falhar, a NF é marcada como pendente de reconciliação — nunca fica "meio-enviada".

### Sanitização obrigatória

- **CNPJ:** sempre reduzido aos 14 dígitos numéricos antes de qualquer chamada (inclusive teste de conexão). CNPJ fora desse formato aborta a operação com mensagem clara.
- **Chave de acesso da NF-e:** sempre reduzida aos 44 dígitos numéricos antes do envio do rastreio.

### Bloqueios defensivos

- Tentativa de enviar **só a NF** (sem rastreio) ou **só a etiqueta** (sem NF autorizada) é bloqueada por padrão. As ações isoladas existem apenas para reenvio administrativo manual e exigem `force=true` explícito.

### Travas e idempotência

- Configuração do tenant: interruptores `auto_send_nfe` e `auto_send_label`. Desligado = nenhum envio.
- **Trava de claim por NF (2026-06-11):** antes de qualquer chamada à Pratika, a função reserva o envio inserindo uma linha "em andamento" no histórico, protegida por índice único parcial. Isso impede que dois gatilhos quase simultâneos (autorização da NF e criação do objeto logístico) disparem o mesmo envio em paralelo. Se houver concorrência, a segunda chamada retorna imediatamente sem chamar a Pratika de novo. Ao final, a linha reservada é **atualizada** com o resultado (sucesso ou erro), sem duplicar registros.
- Idempotência rápida por pedido: se já houve sucesso anterior para a mesma NF, a função pula imediatamente.
- Idempotência por sub-etapa: se a NF já foi enviada com sucesso antes (numa tentativa parcial), a operação combinada pula direto para o rastreio.
- Reenvio administrativo (`force=true`) ignora a trava e gera linha nova de histórico — caso documentado de uso humano.

### Reconciliação automática

A cada 30 minutos, uma rotina varre pedidos das últimas 24h com NF autorizada **e** rastreio registrado que ainda não tiveram envio combinado bem-sucedido, e reenfileira a operação. Reconciliação é rede de segurança, não fluxo primário.

### Validação E2E

- Validado em 2026-06-11 com o pedido #616 (ciclo completo: pedido → PV → NF autorizada → etiqueta → remessa → Pratika).
- Trava de claim validada em 2026-06-11 via teste de concorrência em banco (segundo INSERT bloqueado pelo índice único parcial).

Anti-regressão: ver `mem://features/external-apps/wms-pratika-integration`, `mem://constraints/wms-pratika-combined-send-and-cnpj-raw` e `mem://constraints/wms-pratika-combined-claim-lock`.


---

## Numeração própria do Objeto de Postagem (2026-06-08)

**Decisão de produto.** Cada Objeto de Postagem (`public.shipments`) tem
**número próprio sequencial por loja**, no mesmo padrão de Pedido, Pedido de
Venda, Nota Fiscal e Remessa.

- Coluna `shipments.numero bigint NOT NULL`, único por `(tenant_id, numero)`.
- Alocação automática em `BEFORE INSERT` via trigger
  `trg_shipments_set_numero` → função
  `public.allocate_shipment_numero(p_tenant_id)` (SECURITY DEFINER,
  advisory lock por tenant).
- Vale para qualquer origem de criação: PV manual, PV duplicado, pedido
  pago (auto), reconciliação de PV órfão, retentativa. Nenhum chamador
  passa `numero` explicitamente.
- Objetos antigos receberam número retroativo único por loja, ordenados
  por `created_at ASC`, na própria migração.
- Reemissão, auto-cura ou reabertura **não reusam** número de objeto
  cancelado — a sequência é monotonicamente crescente.

### Exibição
- Coluna "Pedido" das listas de Objetos passou a se chamar **"Objeto"** e
  mostra `#{shipments.numero}` em destaque, com o Pedido (`Pedido #X`) ou
  PV (`PV X`) como referência secundária na mesma célula.
- Aba "Rastreios" e tabela interna da Remessa seguem o mesmo padrão.

### Criação manual proibida
- Foi removido do sistema o botão **"Criar novo objeto"** da aba "Prontos
  para emitir". Edição de rascunho existente (destinatário, serviço)
  continua disponível pelo ícone de lápis na linha.
- Todo Objeto de Postagem nasce a partir de um Pedido de Venda — não
  existe mais caminho para criar objeto "do nada" pelo módulo de
  Logística.

Memória anti-regressão: `mem://constraints/shipment-own-numero-and-no-manual-create`.

---

## Ordenação das Listagens (Objetos, Remessas, Rastreios)

**Atualizado em 2026-06-08.** Todas as listagens do módulo seguem o **Padrão de Ordenação de Listagens Operacionais** (ver `transversais/padroes-operacionais.md`):

| Lista | Chave primária | Desempate |
|---|---|---|
| Objetos de Postagem — Prontos para Emitir | `shipments.numero` (próprio) | data desc |
| Objetos de Postagem — Objetos Emitidos | `shipments.numero` (próprio) | data desc |
| Objetos de Postagem — Pendentes | `shipments.numero` (próprio) | data desc |
| Remessas | nº da remessa (`shipping_remessas.numero`) | data desc |
| Objetos dentro de uma Remessa | `shipments.numero` (próprio) | data desc |
| Rastreios | `shipments.numero` (próprio) | data desc |

**Por quê:** evita que objetos recriados por reconciliação (ex.: após cancelamento de NF) apareçam no topo só por terem data nova. O objeto recuperado volta para o lugar numérico correto pela própria sequência do Objeto de Postagem.

