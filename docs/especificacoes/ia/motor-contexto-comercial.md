# Motor de Contexto Comercial da IA — Visão Geral

**Status:** Onda A entregue (somente leitura). **Onda 1B parcialmente entregue** — camada manual editável de "Visão da IA" no Cadastro de Produto (ver `visao-ia-produto.md`). Cron de inferência e Approval Center ainda planejados.

## Objetivo
Construir, de forma multi-tenant e sem hardcode por segmento, a base de inteligência que a IA de atendimento/vendas precisa para:
- entender o negócio do tenant,
- conhecer o catálogo com semântica comercial (papéis, packs, complementaridades),
- aplicar tom, vocabulário e claims permitidas,
- responder objeções e políticas formais,
- aprender continuamente com curadoria humana.

## 6 Frentes
1. **AI Context Health** — diagnóstico contínuo da saúde do contexto por tenant. *(Onda A — entregue)*
2. **AI Product Intelligence** — semântica comercial dos produtos (papel, necessidades, packs, base, complementares).
3. **Segment Playbooks** — vocabulário e regras genéricas por segmento (cosméticos, eletrônicos, moda, pet, …).
4. **Approval Center** — curadoria humana de inferências antes de virarem fonte de verdade.
5. **Context Compiler** — montagem unificada do prompt com precedência clara.
6. **Aprendizado Regenerativo** — crons que detectam lacunas e propõem melhorias para aprovação.

## Contrato de Precedência (futuro Context Compiler)
```
Pipeline base  <  Configuração geral da IA  <  Configuração por canal  <  Estado da conversa
```
- **Pipeline base:** snapshot do tenant, marca, dicionário, objeções, knowledge base, payload comercial dos produtos, playbook do segmento.
- **Configuração geral da IA:** `ai_support_config` (prompt-base, persona, tom, modo vendas, RAG).
- **Configuração por canal:** `ai_channel_config` (overrides por WhatsApp / e-mail / web).
- **Estado da conversa:** memórias do contato, foco de família, histórico recente, anti-repetição.

## Onda A entregue
Ver `docs/especificacoes/ia/context-health.md`.

## Roadmap (Ondas B–F)
- **B — Product Intelligence persistida:** Onda 1B entregue (estrutura de dados + UI). Cron de inferência ainda não.
- **1C — Recommendation Context Builder (dry_run, entregue):** módulos `_shared/product-ai-vision-reader.ts` e `_shared/product-recommendation-context-builder.ts`. Acionados em `search_products` apenas quando flag `arch1c_recommendation_context_builder_enabled=true` e mode `dry_run`. Não muta runtime — só grava trace `arch1c_dry_run` em `ai_turn_traces`. Ligado **apenas** no tenant Respeite o Homem. Detalhes em `visao-ia-produto.md` e `mem://features/ai/recommendation-context-builder-v1`.
- **C — Approval Center:** UI para aprovar/rejeitar inferências em massa.
- **D — Context Compiler:** consome o ProductRecommendationContextBuilder e funde com persona/canal/estado.
- **E — Playbooks completos:** vocabulário e regras por segmento.
- **F — Aprendizado regenerativo:** crons que monitoram lacunas.
