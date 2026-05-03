---
name: motor-contexto-comercial-v1
description: Onda A do Motor de Contexto Comercial — view ai_context_health_view (9 dimensões + overall), tabela ai_segment_playbooks (seed cosmeticos/eletronicos/moda/pet), edge ai-context-product-preview (sob demanda, sem persistência), aba "Saúde do Contexto" na Central de Comando. NÃO altera ai-support-chat, search_products, sales pipeline, Orchestrator. NÃO escreve em ai_product_commercial_payload. Botões de ação são placeholders. Contrato de precedência futuro: Pipeline base < Config geral < Config canal < Estado da conversa.
type: feature
---

# Motor de Contexto Comercial v1 — Onda A

## Entregues
- View `ai_context_health_view` (security_invoker) com 9 scores + overall_score
- Tabela `ai_segment_playbooks` com seed dos 4 segmentos base
- Edge function `ai-context-product-preview` (Gemini 2.5 Flash, sob demanda, ≤10 produtos por chamada)
- Hook `useAiContextHealth` + componente `ContextHealthTab`
- Nova aba na Central de Comando: `?tab=context-health`

## Restrições absolutas (não violar)
- Sem alteração em `ai-support-chat`, `search_products`, pipeline de vendas, Turn Orchestrator
- Sem escrita em `ai_product_commercial_payload`
- Sem religar `turn_orchestrator_enabled`
- Prévia comercial NUNCA é chamada pelo atendimento real
- Sem hardcode por tenant; segmento vem de `ai_business_snapshot.niche_primary`

## Próximas ondas
B — persistir Product Intelligence com `approval_status='pendente_revisao'`.
C — Approval Center funcional.
D — Context Compiler com precedência oficial.
