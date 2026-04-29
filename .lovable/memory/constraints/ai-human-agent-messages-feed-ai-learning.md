---
name: Human Agent Messages Feed AI Learning
description: Toda mensagem outbound real do atendente humano (sender_type=agent, !is_internal, !is_note, !is_ai_generated, len>=10) é capturada via trigger trg_capture_human_agent_learning como human_correction_positive (peso 10).
type: constraint
---
# Aprendizado a partir do atendente humano (Eixo 4)

## Regra
Toda mensagem outbound real do atendente humano é capturada automaticamente como evento de aprendizado. NÃO depende de o humano marcar nada — é silencioso e contínuo.

## Filtros aplicados pelo trigger `trg_capture_human_agent_learning` (em messages AFTER INSERT)
- `sender_type = 'agent'`
- `direction = 'outbound'`
- `is_internal = false`
- `is_note = false`
- `is_ai_generated = false`
- `length(content) >= 10`

## Contrato
- Insere em `tenant_learning_events` com `event_type='human_correction_positive'`, `weight=10`.
- `customer_message` recebe a última mensagem inbound do cliente nesta conversa (contexto do "porque").
- `ai_response` recebe o conteúdo enviado pelo humano (tratado como resposta-padrão a aprender).
- `metadata.source='human_agent_message'`, `metadata.message_id`, `metadata.agent_user_id`.
- O aggregator (`ai-learning-aggregator`) promove para `tenant_learning_memory` como `winning_response`.

## Por que
Os maiores insights vêm do estilo do atendente humano do próprio tenant. Esse loop é o que torna a IA progressivamente personalizada por negócio.

## Como aplicar
- NUNCA filtrar/desativar este trigger sem documentar o motivo.
- Se adicionar novos campos a `messages` que devam alterar a captura (ex.: novo flag tipo `is_draft`), atualizar o trigger E esta memória.
- Erros do trigger são WARNING (não bloqueiam INSERT) — checar logs do Postgres se desconfiar de captura faltante.
