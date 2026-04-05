# Padrões de Automação do Sistema

> Referência obrigatória para qualquer implementação que envolva reação a eventos, processamento assíncrono ou integração externa.

## Visão Geral

O sistema utiliza **4 padrões** de automação, cada um otimizado para um tipo de cenário. A escolha do padrão correto é crítica para a confiabilidade.

```
┌─────────────────────────────────────────────────────────┐
│              PADRÕES DE AUTOMAÇÃO DO SISTEMA            │
├──────────────────┬──────────────────────────────────────┤
│ 1. Pure SQL      │ Dados internos simples               │
│   Trigger        │ (updated_at, contadores, flags)      │
│                  │ Confiabilidade: 100%                  │
│                  │ Latência: 0ms                         │
├──────────────────┼──────────────────────────────────────┤
│ 2. Fila +        │ Lógica complexa interna que reage    │
│   Cron           │ a mudança de estado (rascunhos,      │
│                  │ sincronizações internas pesadas)      │
│                  │ Confiabilidade: 100% (captura)        │
│                  │ Latência: até 1 minuto                │
├──────────────────┼──────────────────────────────────────┤
│ 3. Edge Function │ Ação do usuário que precisa de        │
│   Direta         │ resposta imediata ou integração       │
│                  │ externa (emitir NF, IA, pagamento)    │
│                  │ Confiabilidade: alta                   │
│                  │ Latência: variável                     │
├──────────────────┼──────────────────────────────────────┤
│ 4. Webhook +     │ Serviço externo notifica o sistema    │
│   Polling        │ (gateway, rastreio, marketplace)      │
│                  │ Webhook = tempo real                   │
│                  │ Polling/Cron = reconciliação           │
└──────────────────┴──────────────────────────────────────┘
```

---

## Regra de Ouro

> **pg_net direto de trigger SQL → PROIBIDO.**
>
> Nunca usar `net.http_post()` ou `net.http_get()` dentro de triggers ou funções PL/pgSQL para chamar Edge Functions. O timeout fixo de 5 segundos, combinado com cold starts e latência de rede, torna esse padrão intrinsecamente frágil e causa falhas silenciosas.

---

## Padrão 1: Pure SQL Trigger

**Quando usar:**
- Atualizar `updated_at` automaticamente
- Incrementar/decrementar contadores
- Definir flags derivados (ex: `is_active` baseado em data)
- Qualquer lógica que opera apenas em colunas da mesma tabela ou faz INSERT simples em outra tabela

**Características:**
- Execução atômica (dentro da mesma transação)
- Zero latência adicional
- 100% confiável
- Sem dependência de rede

**Exemplo no sistema:**
- ~30 triggers de `updated_at`
- Trigger `enqueue_fiscal_draft` (insere na fila quando pagamento é aprovado)

**Limite:** Se a lógica precisa de queries complexas, joins, chamadas externas ou tem mais de ~20 linhas de PL/pgSQL, usar Padrão 2.

---

## Padrão 2: Fila + Cron

**Quando usar:**
- Lógica complexa que reage a mudança de estado
- Processamento que envolve múltiplas tabelas, cálculos ou queries
- Situações onde a confiabilidade da captura é mais importante que a latência
- Qualquer cenário onde um trigger precisaria chamar uma Edge Function

**Como funciona:**
1. Um **trigger Pure SQL** (Padrão 1) insere um registro numa tabela de fila (`*_queue`)
2. O **scheduler-tick** (cron, roda a cada minuto) processa os itens pendentes
3. Cada item é processado chamando a Edge Function correspondente
4. O resultado é registrado na fila (done/failed + error_message)
5. Itens com falha são retentados até o limite de tentativas
6. Itens processados com sucesso são limpos após 7 dias

**Características:**
- Captura 100% confiável (INSERT atômico)
- Latência máxima de ~1 minuto
- Retry automático com controle de tentativas
- Rastreabilidade completa (log de erros na fila)
- A Edge Function existente não precisa mudar

**Exemplo no sistema:**
- `fiscal_draft_queue` → processa rascunhos fiscais via `fiscal-auto-create-drafts`

**Estrutura da tabela de fila:**
```sql
CREATE TABLE public.<module>_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  <entity>_id UUID NOT NULL REFERENCES <entity_table>(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT <module>_queue_entity_unique UNIQUE (<entity>_id)
);
```

---

## Padrão 3: Edge Function Direta

**Quando usar:**
- Ação do usuário que precisa de resposta imediata (ex: emitir NF, gerar IA)
- Integração externa síncrona (ex: criar cobrança no gateway)
- O frontend chama via `supabase.functions.invoke()` ou `fetch()`

**Características:**
- Sem limite de 5 segundos (Edge Functions podem rodar por minutos)
- Resposta direta ao usuário
- Falha é visível (o usuário vê o erro)

**Exemplo no sistema:**
- Emissão de NF (Nuvem Fiscal)
- Geração de criativos (IA)
- Criação de cobrança (Pagar.me / Mercado Pago)

---

## Padrão 4: Webhook + Polling/Cron

**Quando usar:**
- Serviço externo notifica o sistema sobre mudanças de estado
- O sistema precisa consultar periodicamente um serviço externo

**Como funciona:**
- **Webhook:** O serviço externo faz POST para uma Edge Function do sistema
- **Polling:** O scheduler-tick chama periodicamente uma Edge Function que consulta o serviço externo
- Os dois mecanismos coexistem: webhook para tempo real, polling para reconciliação

**Exemplo no sistema:**
- Gateway de pagamento: webhook para status em tempo real + `verify-payment-status` como reconciliação
- Rastreamento: `tracking-poll` consulta APIs de transportadoras
- Meta Ads: webhook para eventos + cron para métricas

---

## Árvore de Decisão

```
Preciso reagir a uma mudança de estado no banco?
├── É simples (update de flag, counter, timestamp)?
│   └── → Padrão 1: Pure SQL Trigger
├── É complexo (queries, cálculos, múltiplas tabelas)?
│   └── → Padrão 2: Fila + Cron
│       (trigger insere na fila, cron processa)
└── Não é reação a estado, é ação do usuário?
    ├── Precisa de resposta imediata?
    │   └── → Padrão 3: Edge Function Direta
    └── Serviço externo avisa o sistema?
        └── → Padrão 4: Webhook + Polling
```

---

## Histórico

| Data       | Mudança                                                                 |
|------------|-------------------------------------------------------------------------|
| 2026-04-04 | Criação do documento. Substituição do trigger pg_net fiscal por Fila+Cron |
