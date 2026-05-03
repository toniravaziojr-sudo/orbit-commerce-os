# Saúde do Contexto da IA (Onda A)

**Status:** Entregue como diagnóstico somente leitura. Não altera comportamento da IA em produção.

## O que é
Tela e contrato de dados que diagnosticam, por tenant, quão preparada está a base de contexto da IA. Mostra score geral, score por dimensão, lacunas priorizadas, impacto e ação recomendada. Inclui prévia sob demanda de inteligência comercial dos produtos.

## Onde fica
Central de Comando → aba **"Saúde do Contexto"**.

## Dimensões e fórmulas
Calculadas pela view `ai_context_health_view` (security invoker; respeita RLS das tabelas-fonte).

| Dimensão | Fonte | Fórmula resumida |
|---|---|---|
| brand_context_score | `tenant_brand_context` | 25 (resumo) + 20 (tom) + 20 (claims proibidas) + 15 (do_not_do) + 10 (foco produtos) + 10 (estilo visual) |
| language_score | `ai_language_dictionary` | 20 tom + 30 vocabulário + 20 aliases + 15 termos proibidos + 15 frases preferidas (cap 100) |
| objections_score | `ai_intent_objection_map` | qtd_ativas × 10 (cap 100) |
| knowledge_base_score | `knowledge_base_docs` (active) | qtd × 15 (cap 100) |
| products_semantics_score | `products` × `ai_product_commercial_payload` | % de produtos ativos com `short_pitch` e `commercial_role` |
| approved_insights_score | `ai_brain_insights` (status=ativo, 90d) | qtd × 5 (cap 100) |
| snapshot_freshness_score | `tenant_ai_context_snapshot.updated_at` | 100 ≤7d, 60 ≤30d, 30 ≤90d, 10 acima |
| channel_config_score | `ai_channel_config` (is_enabled) | qtd × 25 (cap 100) |
| general_ai_config_score | `ai_support_config` | 30 enabled + 25 prompt + 20 custom_knowledge + 10 persona + 15 sales_mode |
| **overall_score** | — | média aritmética das 9 dimensões |

## Playbooks de Segmento
Tabela `ai_segment_playbooks` (referência global, leitura para autenticados). Seed mínimo:
- `cosmeticos` — papéis: base, limpeza, tratamento_dia, tratamento_noite, hidratacao, protecao, finalizador, kit
- `eletronicos` — principal, acessorio, compativel, cabo, fonte, protecao, kit
- `moda` — peca_principal, look_complementar, acessorio, tamanho_variante, colecao
- `pet` — alimentacao, higiene, saude, brinquedo, acessorio, kit

Detecção do segmento: `ai_business_snapshot.niche_primary` → heurística regex no edge `ai-context-product-preview`. Sem hardcode por tenant.

## Prévia de Inteligência Comercial (sob demanda)
Edge function `ai-context-product-preview`:
- requer JWT do usuário; valida acesso ao tenant via RLS;
- recebe `{ tenant_id, limit≤10, filter: all|no_semantics|low_confidence }`;
- detecta segmento → carrega playbook → envia prompt para Lovable AI Gateway (Gemini 2.5 Flash);
- retorna por produto: `product_role`, `customer_needs`, `use_cases`, `is_pack_or_bundle`, `base_product_id`, `complementary_product_ids`, `confidence_score`, `reasoning`, `gap?`;
- **não persiste** em `ai_product_commercial_payload`;
- **não é chamada pelo atendimento real**.

## Cache
Sem cache persistido nesta Onda. React Query `staleTime=60s` apenas no front. Limitação documentada: prévia regera a cada chamada.

## Botões de ação
Placeholders nesta Onda. Serão ativados na Onda B.

## O que NÃO foi alterado
- `ai-support-chat` — sem mudanças
- `search_products` — sem mudanças
- pipeline de vendas / Orchestrator — sem mudanças
- `turn_orchestrator_enabled` — permanece desligado por decisão do usuário
- `ai_product_commercial_payload` — zero escritas

## Caso "Respeite o Homem" (validação)
Antes da Onda A: 33 produtos com payload, mas sem visão de role/pack/base. Health view diagnostica:
- brand_context_score: 0 (vazio)
- language_score: 0 (vazio)
- objections_score: 0 (vazio)
- knowledge_base_score: 0 (vazio)
- products_semantics_score: 100 (payload existe; falta riqueza)
- snapshot_freshness_score: 100
- overall_score: ~31

Prévia sob demanda mostra: Balm 1x classificado como `tratamento_dia`, Balm 2x/3x/6x como `pack` apontando para Balm 1x, Loção Noite como `tratamento_noite`, Shampoo como `base/limpeza`, kits como `bundle`. Quando confiança <60, item recebe lacuna explícita.

## Limitações conhecidas
- Prévia depende de IA Gateway online (fallback heurístico se ausente).
- Sem cache: regeneração custa tokens a cada execução.
- Health view não pondera dimensões — média simples.
- Score só considera presença/quantidade, não qualidade do conteúdo.
