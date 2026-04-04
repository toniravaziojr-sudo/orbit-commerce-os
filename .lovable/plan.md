

# Plano: Substituir trigger fiscal frágil por fila interna + documentar padrões de automação

## Contexto

O trigger `trg_fiscal_draft_on_payment_approved` usa `pg_net` para chamar uma Edge Function diretamente — o único lugar do sistema com esse padrão. Isso causa falhas silenciosas por timeout de 5 segundos e cold starts. O cron já existe como fallback, mas pedidos podem ficar minutos sem rascunho, e o problema só é percebido depois.

## Por que NÃO Pure SQL (Opção B original)

Ao investigar a função `fiscal-auto-create-drafts`, identifiquei que ela faz:
- Busca de configurações fiscais do tenant
- Busca de itens do pedido com dados fiscais de cada produto
- **Desmembramento de kits** em componentes (consulta `products` + `product_components` com cálculo proporcional)
- Busca de código IBGE do município (com fallback em 4 níveis de busca)
- Lógica de retry para numeração fiscal (até 20 tentativas em caso de conflito)
- Inserção da NF + itens + evento de log + sincronização de cursor

Reescrever tudo isso em PL/pgSQL seria ~400 linhas de SQL procedural, difícil de manter e testar. A lógica de kit unbundling sozinha tem tratamento de proporção de preços, arredondamento e ajuste de centavos.

## Solução escolhida: Fila + Cron (máxima confiabilidade com mínima mudança)

A ideia é simples: o trigger, em vez de tentar chamar uma Edge Function com timeout de 5 segundos, apenas **anota o pedido numa fila**. O cron (que já roda a cada minuto) processa essa fila.

### O que muda para o usuário
- Rascunhos fiscais serão criados de forma **100% confiável** — nenhum pedido será perdido
- O tempo máximo entre aprovação do pagamento e criação do rascunho será de ~1 minuto (hoje pode nunca acontecer se o trigger falha)

### Etapas de implementação

**1. Criar tabela `fiscal_draft_queue`**
- Campos: `id`, `tenant_id`, `order_id`, `status` (pending/processing/done/failed), `created_at`, `processed_at`, `error_message`
- RLS habilitado com política para service_role
- Constraint unique em `(order_id)` com status pending para evitar duplicatas

**2. Substituir o trigger atual**
- Remover a função que usa `pg_net`
- Criar novo trigger que faz apenas: `INSERT INTO fiscal_draft_queue (tenant_id, order_id) VALUES (NEW.tenant_id, NEW.id) ON CONFLICT DO NOTHING`
- Mesmo critério de disparo: `payment_status` muda para `approved`
- Execução: ~1ms, zero risco de falha

**3. Atualizar o scheduler-tick**
- Antes de chamar `fiscal-auto-create-drafts`, consultar a fila por itens pendentes
- Para cada item pendente, chamar a Edge Function no modo TRIGGER (com `order_id` + `tenant_id`)
- Marcar como `done` ou `failed` após processamento
- Manter o fallback CRON existente (modo batch) como reconciliação adicional

**4. Criar documento de padrões de automação**
- Arquivo: `docs/AUTOMATION-PATTERNS.md`
- Conteúdo: mapa dos 4 padrões do sistema com critérios de quando usar cada um:

```text
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

REGRA DE OURO: pg_net direto de trigger → PROIBIDO.
Se a lógica é complexa ou faz queries, usar Fila + Cron.
Se a lógica é simples e local, usar Pure SQL Trigger.
```

### Detalhes técnicos

- A tabela `fiscal_draft_queue` terá cleanup automático (itens `done` com mais de 7 dias removidos pelo cron)
- O trigger antigo será removido na mesma migração que cria o novo
- A Edge Function `fiscal-auto-create-drafts` continua existindo sem mudanças — apenas muda quem a chama (cron em vez de pg_net)
- O modo CRON batch existente permanece como camada extra de reconciliação

