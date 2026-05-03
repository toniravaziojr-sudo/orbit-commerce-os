# Motor de Contexto Comercial da IA — Visão Geral

**Status:** Onda A entregue (somente leitura). Ondas B–F planejadas.

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
- **B — Product Intelligence persistida:** novas colunas em `ai_product_commercial_payload` (`customer_needs`, `use_cases`, `complementary_product_ids`, `base_product_id`, `is_pack_or_bundle`, `approval_status`) + cron de inferência → status `pendente_revisao`.
- **C — Approval Center:** UI para aprovar/rejeitar inferências em massa, integrado a `ai_brain_insights` com novos `insight_type`.
- **D — Context Compiler:** módulo `_shared/context-compiler/` aplicado primeiro em `ai-support-chat` e depois propagado.
- **E — Playbooks completos:** vocabulário e regras detalhadas por segmento; override manual por tenant.
- **F — Aprendizado regenerativo:** crons que monitoram lacunas e abrem insights automáticos.
