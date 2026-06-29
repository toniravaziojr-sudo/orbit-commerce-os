## Objetivo

Fazer os pedidos do Mercado Livre percorrerem **o mesmo fluxo** dos pedidos da loja virtual em Cliente → Fiscal → Logística, respeitando 3 limitações reais do ML: e-mail/telefone podem não vir, etiqueta é gerada pelo ML (não pelos Correios) e a entrada do pedido vem por webhook/sync. Sem gambiarra, sem auto-cura silenciosa, sem regra exclusiva por tenant.

## 1. Cliente do ML reaproveita cadastro existente (Onda 4 rev.)

**Como funciona hoje:** o `meli-sync-orders` já procura cliente por `last_external_id → CPF → CNPJ → e-mail real`. Quando não acha, cria com e-mail sintético `meli-{id}@marketplace.local`. Esse sintético dispara duplicidade no fluxo de leads e some o cliente real.

**O que muda:**
- **Match ampliado:** quando ML não envia e-mail, mas envia CPF/CNPJ e/ou telefone, casar também por `phone` (normalizado em dígitos, com variantes 55) — mesma regra do `lookup_customer` da IA. Reaproveita cliente da loja sem criar registro novo.
- **Nunca sobrescrever dado real:** se o cliente encontrado já tem e-mail/telefone reais cadastrados, o pedido do ML **usa esses dados** (inclusive em `customer_email` no pedido, para notificações funcionarem). Só preenche campo do cliente quando estiver vazio (política já existente em `profile-enrichment-policy-standard`).
- **E-mail sintético segue existindo como último recurso** (a coluna `customers.email` é NOT NULL), mas marcado em `customer_notes` e em `marketplace_data.data_pending` como “e-mail pendente”. UI mostra “Sem e-mail informado” quando o e-mail for sintético — sem alterar layout, só o texto do campo.
- **Bloqueio anti-lead duplicado:** `sync_subscriber_on_tag_assignment` já ignora `@marketplace.local` (Onda 4 anterior) — mantém.

## 2. Backfill dos pedidos #662 e #663

Comparar com pedidos da loja e reexecutar o pipeline canônico:
1. Rodar `meli-sync-orders` apontando para esses 2 `marketplace_order_id` (re-sync atualiza, não duplica).
2. Reassociar ao cliente real (João Carlos) caso o match novo encontre, recalculando métricas via `customer-metrics-sync`.
3. Reemitir `order_history` se ficou incompleto.
4. Disparar `enqueue_fiscal_draft` para criar Pedido de Venda Fiscal (hoje não foram criados — esse é o gap real).
5. Validar que o pedido aparece em `/fiscal?tab=pedidos` e em `/external-shipping` como “Aguardando NF”.

## 3. Avisos de problema de envio na UI

Mantém o visual padrão (badge/cartão atual do sistema). Apenas garante que:
- Lista `/orders` → clique no aviso da coluna Envio → deep-link já existente (`resolveShippingDeepLink`) abre a aba certa.
- Central de Execuções → clique em “Problemas com envio” → mesma aba “Problemas de envio/entrega”.
- **Texto do motivo** passa a vir do `tracking-poll` (Correios “Aguardando retirada”, “Tentativa frustrada”, etc.), em PT-BR, conforme Onda 1 já planejada.

Sem cor/formato novo. Só conteúdo correto.

## 4. Automação fiscal + logística unificada

**Regra única (vale para loja e marketplaces):**
- Se `fiscal_settings.emissao_automatica = TRUE` → **toda NF é emitida sozinha**, inclusive marketplace.
- Se `emissao_automatica = FALSE` → **toda NF é manual**, inclusive marketplace.
- **Logística externa é sempre automática** quando a NF é autorizada (não tem opção manual — é resposta ao evento).

**Pipeline marketplace (igual ao da loja):**

```text
Webhook ML → meli-sync-orders
   ↓
INSERT em orders (sales_channel='marketplace')
   ↓
Trigger atomic-order-draft (já existe)
   ↓
fiscal_draft_queue → cria Pedido de Venda Fiscal (sempre, igual loja)
   ↓
SE emissao_automatica=TRUE  →  fiscal-auto-create-drafts processa e dispara fiscal-submit (modo sistema)
SE emissao_automatica=FALSE →  fica aguardando ação manual em /fiscal?tab=notas (igual loja)
   ↓
NF autorizada → trigger fire_authorized_side_effects
   ↓ (canal marketplace?)
meli-send-invoice (envia chave ao ML)
   ↓
ML libera etiqueta → webhook shipments
   ↓
meli-fetch-shipment baixa PDF + tracking → marketplace_shipments
   ↓
external-shipping-sync-cron → wms-pratika-send
```

**Mudanças concretas:**
- **`fiscal-auto-create-drafts`** hoje só olha pedidos com `sales_channel='storefront'` em alguns trechos. Remover essa restrição: passa a processar pedidos de marketplace pela mesma regra (`emissao_automatica = TRUE` + pedido pago + dados completos).
- **`fiscal-submit` em modo sistema:** refatorar para aceitar contexto `service_role` (sem `auth.uid()`), reusando o mesmo handler que o usuário aciona manualmente. Sem fork de lógica.
- **Pré-flight bloqueia automaticamente** se faltar CPF/endereço (regra `sistema-nunca-preenche-dado-faltante-do-cliente`): pedido fica visível com pendência, não fabrica dado.
- **`meli-send-invoice`** já dispara via fila quando NF fica `authorized` — manter.
- **`meli-fetch-shipment`** já baixa etiqueta automaticamente via webhook + cron — manter.
- **Cron de cura fiscal** das 8h–16h continua como rede de segurança para casos como o #658.

## 5. Validação técnica obrigatória

Antes de declarar concluído:
1. Re-sync dos pedidos #662 e #663 → confirmar cliente único, PV criado, NF autorizada (se `emissao_automatica=TRUE`) ou pendente (se `FALSE`), e remessa em `marketplace_shipments`.
2. Consultar `customers` no tenant Respeite o Homem → sem duplicados sintéticos para o mesmo CPF.
3. Verificar `order_history` dos pedidos ML → eventos completos.
4. Logs de `fiscal-auto-create-drafts` e `meli-send-invoice` → sem erros.

## 6. Documentação

Atualizar ao final:
- `docs/especificacoes/marketplaces/mercado-livre.md` → seção “Identidade do cliente” (regra de match + e-mail sintético) e seção “Fluxo Fiscal Marketplace”.
- `docs/especificacoes/fiscal/preflight-fiscal-logistico.md` → marketplace usa o mesmo pré-flight.
- `docs/especificacoes/logistica/logistica-externa.md` → fluxo NF→Etiqueta automatizado.
- `docs/especificacoes/transversais/assuntos-em-andamento.md` → fechar Ondas 1–4.
- Memory: atualizar `mem://features/marketplaces/canonical-flow-standard.md` com a regra “marketplace usa a mesma flag `emissao_automatica` da loja”.

## 7. Ordem de execução

1. **Cliente ML** (match por telefone + UI “Sem e-mail informado”).
2. **Backfill #662/#663** (reusa fluxo canônico que será corrigido nos passos 3–4).
3. **Fiscal marketplace** (`fiscal-auto-create-drafts` + `fiscal-submit` modo sistema).
4. **Tracking Correios “Aguardando retirada”** (texto do motivo na UI).
5. **Validação técnica** + **docs**.

Sem mudanças de UI além do texto do e-mail sintético e do motivo de envio. Sem flags novas por tenant. Sem cron adicional.
