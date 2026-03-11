# Pacotes IA — Regras e Especificações

> **Status:** 🟢 Implementado  
> **Última atualização:** 2025-01-27

---

## Visão Geral

Sistema de créditos de IA para lojistas. Os créditos permitem acesso a funcionalidades de inteligência artificial como atendimento automatizado, geração de conteúdo, imagens, vídeos e análise de dados.

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/AIPackages.tsx` | Página principal de créditos |
| `src/hooks/useCredits.ts` | Hook de créditos, wallet e ledger |
| `src/components/ai-packages/CreditBalance.tsx` | Card de saldo |
| `src/components/ai-packages/CreditPackageCard.tsx` | Card de pacote |
| `src/components/ai-packages/CreditLedgerTable.tsx` | Histórico de transações |
| `src/components/ai-packages/AIPricingTable.tsx` | Tabela de preços |
| `supabase/functions/credits-purchase-checkout/` | Edge Function: checkout MP para compra de créditos |

---

## Constantes do Sistema

```typescript
CREDIT_USD = 0.01      // 1 crédito = US$ 0,01
CREDIT_MARKUP = 1.5    // 50% markup sobre custo do provedor
```

---

## Tabelas

### credit_packages (Pacotes para Compra)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `sku` | TEXT | Identificador único (CC_CREDITS_1K, etc) |
| `name` | TEXT | Nome do pacote |
| `description` | TEXT | Descrição |
| `credits` | INTEGER | Quantidade de créditos |
| `bonus_credits` | INTEGER | Bônus adicional |
| `price_cents` | INTEGER | Preço em centavos (BRL) |
| `is_active` | BOOLEAN | Se está disponível para compra |
| `sort_order` | INTEGER | Ordem de exibição |

### credit_wallet (Carteira do Tenant)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK para tenants |
| `balance_credits` | INTEGER | Saldo atual |
| `reserved_credits` | INTEGER | Créditos reservados para jobs |
| `lifetime_purchased` | INTEGER | Total já comprado |
| `lifetime_consumed` | INTEGER | Total já consumido |

### credit_ledger (Histórico de Transações)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK para tenants |
| `user_id` | UUID | Usuário que executou (opcional) |
| `transaction_type` | TEXT | purchase, consume, reserve, refund, bonus, adjust |
| `provider` | TEXT | openai, fal, gemini |
| `model` | TEXT | Modelo utilizado |
| `feature` | TEXT | chat, vision, image, video, seo, embedding |
| `units_json` | JSONB | Unidades consumidas |
| `cost_usd` | DECIMAL | Custo real do provedor |
| `sell_usd` | DECIMAL | Custo com markup 50% |
| `credits_delta` | INTEGER | Variação de créditos |
| `idempotency_key` | TEXT | Controle de duplicação |
| `job_id` | UUID | Referência a job (vídeos/avatares) |

### ai_pricing (Tabela de Preços)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `provider` | TEXT | openai, fal, gemini |
| `model` | TEXT | Nome do modelo |
| `pricing_type` | TEXT | per_1m_tokens_in, per_second, per_image, etc |
| `cost_usd` | DECIMAL | Custo base (provedor) |
| `resolution` | TEXT | low_1024, medium_1024x1536, etc |
| `quality` | TEXT | standard, pro, fast |
| `has_audio` | BOOLEAN | Se inclui áudio (vídeos) |

---

## Pacotes Disponíveis

| SKU | Créditos | Bônus | Preço (BRL) |
|-----|----------|-------|-------------|
| CC_CREDITS_1K | 1.000 | 0 | R$ 60,00 |
| CC_CREDITS_5K | 5.000 | 0 | R$ 280,00 |
| CC_CREDITS_15K | 15.000 | 500 | R$ 790,00 |
| CC_CREDITS_50K | 50.000 | 2.500 | R$ 2.290,00 |

---

## Custos por Funcionalidade (Estimativas)

| Funcionalidade | Provedor | Modelo | ~Créditos |
|----------------|----------|--------|-----------|
| Chat/Atendimento IA | OpenAI | GPT-5.2 | 3/msg |
| Análise de Imagem | OpenAI | GPT-4o | 5/img |
| Transcrição de Áudio | OpenAI | Whisper | 1/min |
| SEO/Texto | Gemini | 2.5 Flash | 2/geração |
| Geração de Imagem | Fal.AI | GPT Image 1.5 | 8/img |
| Vídeo 10s (standard) | Fal.AI | Sora 2 | 150 |
| Avatar 10s | Fal.AI | Kling Avatar | 175 |
| Embedding RAG | OpenAI | text-3-small | 1/1k tokens |

---

## Funções RPC

### check_credit_balance
```sql
SELECT * FROM check_credit_balance(tenant_id, credits_needed);
-- Retorna: has_balance, current_balance, credits_missing
```

### reserve_credits
```sql
SELECT * FROM reserve_credits(tenant_id, credits, idempotency_key, job_id);
-- Reserva créditos antes de job longo
```

### consume_credits
```sql
SELECT * FROM consume_credits(
  tenant_id, user_id, credits, idempotency_key,
  provider, model, feature, units_json, cost_usd,
  job_id, from_reserve
);
-- Debita créditos após uso real
```

### add_credits
```sql
SELECT add_credits(tenant_id, credits, bonus, idempotency_key, description);
-- Adiciona créditos após compra
```

---

## Fluxo de Consumo

```
1. Antes da operação:
   - check_credit_balance() para verificar saldo
   - Se saldo insuficiente: bloquear e informar

2. Para jobs curtos (chat, SEO, imagem):
   - Executar operação
   - Calcular custo com usage retornado
   - consume_credits() direto

3. Para jobs longos (vídeo, avatar):
   - reserve_credits() antes de iniciar
   - Executar operação
   - Ao finalizar: consume_credits(from_reserve=true)
   - Se diferença: ajustar com refund ou consume adicional
```

---

## Layout da Página

### Abas

| Aba | Conteúdo |
|-----|----------|
| Créditos | Saldo atual + Grid de pacotes para compra |
| Consumo | Histórico de consumo filtrado |
| Histórico | Todas as transações (compras, consumos, etc) |
| Tabela de Preços | Custos por funcionalidade |

### Card de Saldo
- Créditos disponíveis (balance - reserved)
- Créditos reservados (badge)
- Progresso de uso (lifetime)
- Stats: comprados / consumidos
- Botão "Comprar Créditos"
- Aviso de saldo baixo (< 100)

---

## Avisos Obrigatórios

1. Na página de pacotes:
   - "Todos os planos requerem cartão de crédito"
   - "Custos de IA podem variar. Veja a aba Tabela de Preços"
   - "Não tem cartão? Fale conosco"

2. Nos locais com IA:
   - Exibir custo médio estimado em créditos
   - Badge com consumo (ex: "~5 créditos")

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| Saldo mínimo | Operação bloqueada se saldo < créditos necessários |
| Idempotency | Toda transação requer idempotency_key único |
| Reserva | Jobs > 30s devem reservar antes de executar |
| Markup | 50% sobre custo do provedor |
| Audit trail | Todas as transações no ledger |

---

## Proibições

| Proibido | Motivo |
|----------|--------|
| Créditos negativos | Constraint CHECK no banco |
| Dupla cobrança | idempotency_key evita |
| Executar sem saldo | Validação antes de iniciar |
| Mostrar custo USD | Sempre usar créditos/BRL |
| Deletar histórico | Auditoria obrigatória |
