# Mapa de Fontes da IA — Diagnóstico Definitivo (Onda 0)

**Status:** Diagnóstico. Nenhuma migration ou alteração de pipeline foi feita a partir deste documento. Onda 1 só após aprovação explícita.
**Substitui:** `docs/especificacoes/ia/context-health.md` (revertido).
**Relacionado:** `docs/especificacoes/ia/motor-contexto-comercial.md` (visão geral macro).

---

## 1. Modelo de 4 camadas (contrato oficial)

```
Pipeline base
  < Configurações Gerais da IA
    < Configurações por Canal
      < Estado da conversa
        < Resultado de tools do turno
```

- **Pipeline base** — funciona sem o usuário configurar nada. Lê tenant, produtos, categorias, payload comercial, mapa de dor, políticas, contexto inferido, aprendizados aprovados.
- **Configurações Gerais da IA** — visão do usuário sobre o negócio + regras de atendimento. Sobrepõe a pipeline base.
- **Configurações por Canal** — overrides por WhatsApp, Instagram, web, e-mail. Sobrepõe pipeline + geral. Sempre opcional.
- **Estado da conversa** — memórias do contato, foco de família, anti-repetição.
- **Resultado de tools** — payloads de `search_products`, busca em KB etc., produzidos no turno.

Insights/Cérebro **não é uma camada**: é um canal de aprendizado regenerativo que alimenta a Pipeline base depois de aprovação humana (vira `ai_brain_insights.status='ativo'`, lido pela view `ai_brain_active_view`).

---

## 2. Confirmação de zero impacto (Onda A revertida)

| Verificação | Resultado |
|---|---|
| `ai-support-chat` alterado pela Onda A? | Não. Nenhum diff em `supabase/functions/ai-support-chat/index.ts` foi parte da Onda A. |
| `search_products` alterado? | Não. |
| Sales pipeline alterado? | Não. `_shared/sales-pipeline/*` intacto. |
| Orchestrator religado? | Não. `turn_orchestrator_enabled` permanece `false`. |
| Escrita em `ai_product_commercial_payload`? | Não. A edge `ai-context-product-preview` apenas retornava JSON, sem persistir. |
| Inferência aplicada em produção? | Não. |
| Aba "Saúde do Contexto" visível? | Não. Removida de `CommandCenter.tsx`, mapa-ui atualizado. |
| Artefatos órfãos no banco? | Não. View `ai_context_health_view` e tabela `ai_segment_playbooks` removidas via migration. Edge function `ai-context-product-preview` deletada. |
| Memória da Onda A? | `mem://features/ai/motor-contexto-comercial-v1` removida. `motor-contexto-comercial.md` mantido como visão macro de roadmap. |

---

## 3. Mapa por grupo

### Grupo A — Negócio / Tenant

| Fonte | O que fornece | Preenchimento | Usada hoje pela IA? | Camada | Classificação | Onde editar | Lacuna |
|---|---|---|---|---|---|---|---|
| `tenants` | Identidade básica (nome, segmento) | Sistema/Usuário | Sim (id, nome) | Pipeline base | Obrigatório operacional | Configurações | — |
| `tenant_business_context` | Árvore rica de contexto do negócio (modelo antigo) | Usuário (parcial), IA | **Sim — fonte primária** em `business-context-loader.ts` | Pipeline base | Obrigatório para IA | Sem UI clara hoje | UI ausente |
| `ai_business_snapshot` | Resumo regenerável: nicho, audiência, business_summary, tom sugerido | IA com regen | Sim — fallback quando 1 vazia | Pipeline base | Recomendado | Botão "regenerar" disperso | UI dispersa |
| `tenant_brand_context` | Marca: tom, claims proibidas, do_not_do, foco | Usuário | Parcial | Pipeline base | Recomendado | Tela de Marca | OK |
| `ai_context_tree` | Árvore hierárquica de contexto inferido (ramos) | IA | Parcial | Pipeline base | Informativo | Não editável diretamente | Não interativo |
| `tenant_ai_context_snapshot` | Snapshot consolidado/cache | Sistema | Sim (frescor) | Pipeline base | Informativo | — | OK |

**Conclusão A:** existem **três fontes potenciais** de contexto do negócio (`tenant_business_context`, `ai_business_snapshot`, e o futuro campo de Configurações Gerais). A IA já tem precedência interna (`business-context-loader`), mas o usuário não tem **um lugar único e claro** para escrever "o que minha empresa vende e como". Esta é a maior lacuna de UI.

### Grupo B — Configurações Gerais da IA (`ai_support_config`)

Campos atuais auditados no banco:

| Campo | Existe? | Camada | Classificação | Observação |
|---|---|---|---|---|
| `is_enabled` | sim | Geral | Obrigatório operacional | toggle |
| `personality_name` | sim | Geral | Recomendado | nome da IA |
| `personality_tone` | sim | Geral | Recomendado | formal/friendly/casual |
| `greeting_style` | sim | Geral | Recomendado | — |
| `use_emojis` | sim | Geral | Informativo | — |
| `system_prompt` | sim | Geral | Recomendado, **perigoso vazio** | livre, sem rótulo claro |
| `custom_knowledge` | sim | Geral | **Obrigatório para IA, mas mal rotulado** | livre, hoje serve de "tudo que não cabe em outro lugar" |
| `rules` | sim (jsonb) | Geral | Recomendado | regras estruturadas |
| `forbidden_topics` | sim (array) | Geral | Recomendado | tópicos vetados |
| `handoff_keywords` | sim (array) | Geral | Recomendado | palavras que disparam handoff |
| `operating_hours` / `out_of_hours_message` | sim | Geral | Recomendado | — |
| `sales_mode_enabled` | sim | Geral | Toggle | ativa modo vendas |
| `approval_mode` | sim | Geral | Toggle | aprovação humana |
| `max_response_length` | sim | Geral | Informativo | limite de tokens |
| `handle_images/audio/files` | sim | Geral | Informativo | multimídia |
| `rag_*` (similarity, top_k, etc.) | sim | Geral | Informativo | tunning de RAG |
| `data_retention_days` / `redact_pii_in_logs` | sim | Geral | Informativo | LGPD |
| `target_first_response_seconds` / `target_resolution_minutes` | sim | Geral | Métricas | SLA |

**Lacunas/sobreposições reais:**

1. **Não existe campo dedicado para "Contexto do negócio na visão do usuário"**. Hoje cai em `custom_knowledge` ou `system_prompt` por improviso.
2. **Não existe campo dedicado para "Regras gerais de atendimento"** separado do prompt técnico. Cai em `system_prompt` ou `rules`.
3. **Não existe campo dedicado para "Claims/promessas proibidas"** específico de produto/operacional (separado de `forbidden_topics`, que é de tema). `tenant_brand_context.claims_proibidas` existe, mas em outra tabela e UI.
4. `system_prompt` e `custom_knowledge` são dois campos livres para a mesma necessidade, sem orientação. Causa do "onde escrevo o quê?" hoje.

**Comparação de alternativas (sem implementar):**

| Alternativa | Prós | Contras | Recomendação |
|---|---|---|---|
| **A) Campo único `business_context`** | Simples, baixo atrito | Mistura "o que vendo" com "como atender" — IA fica confusa | ❌ |
| **B) Dois campos: contexto + regras** | Separa fato de instrução; IA pode pesar diferente | Ainda agrupa claims com regras | ⚠️ aceitável |
| **C) Quatro campos: contexto + regras + claims proibidas + conhecimento adicional** | Cada campo tem propósito claro; alertas direcionados; reaproveita `tenant_brand_context.do_not_do` para claims | Mais campos = mais atrito; precisa migração suave de `custom_knowledge`/`system_prompt` | ✅ **recomendado** (alinha com sua preferência) |

Recomendação técnica: **Alternativa C**, com migração não destrutiva — manter `system_prompt` e `custom_knowledge` como legados (ler se novos campos vazios) e marcá-los como deprecated nos labels.

### Grupo C — Configurações por Canal (`ai_channel_config`)

| Campo | Existe? | Classificação | Observação |
|---|---|---|---|
| `is_enabled` | sim | Toggle | — |
| `system_prompt_override` | sim | Recomendado | sobrepõe geral |
| `custom_instructions` | sim | Recomendado | overlay textual |
| `forbidden_topics` | sim (array) | Recomendado | overlay |
| `max_response_length` | sim | Informativo | overlay |
| `use_emojis` | sim | Informativo | overlay |

**Conclusão C:** estrutura suficiente. Nenhum campo deve virar obrigatório. Alerta deve ser **informativo**: "Este canal está herdando a configuração geral. Personalize se quiser comportamento diferente neste canal."

### Grupo D — Produtos

Campos atuais auditados em `products`:

| Campo | Camada | Classificação | Usado pela IA? |
|---|---|---|---|
| `name` | Pipeline base | Obrigatório operacional | sim |
| `slug` | base | Obrigatório operacional | sim (link) |
| `description` | base | Obrigatório para IA | sim |
| `short_description` | base | **Obrigatório para IA — alerta hoje ausente** | sim (resumo) |
| `price` / `compare_at_price` | base | Obrigatório operacional | sim |
| `stock_quantity` / `manage_stock` | base | Obrigatório operacional | sim |
| `status` | base | Obrigatório operacional | sim (filtro) |
| `product_type` / `product_format` | base | Recomendado | parcial |
| `tags` | base | Recomendado | sim (filtros) |
| `brand` / `vendor` | base | Informativo | parcial |
| `gtin` / `ncm` / `cest` / `origin_code` | base | Operacional fiscal | não pela IA |
| `weight/width/height/depth` | base | Operacional logístico | não pela IA |
| `seo_*` | base | Informativo | não pela IA |
| `has_variants` / `product_variants` | base | Operacional | sim (variant-gate) |
| `product_images.alt_text` | base | Recomendado | parcial |
| `categories` (via M2M) | base | Recomendado | sim |

Em `ai_product_commercial_payload` (tabela paralela, gerada por IA com `manual_overrides`):

| Campo | Significado | Editável hoje? |
|---|---|---|
| `commercial_name` | nome de venda | só via override JSON |
| `commercial_role` | enum: principal/base/complemento/pack/kit/variante/acessorio | só via override JSON |
| `product_kind` | tipo comercial | idem |
| `main_pain_id` / `secondary_pain_ids` | ligação com `ai_product_pain_map` | idem |
| `target_audience` | para quem é | idem |
| `when_not_to_indicate` | quando NÃO recomendar | idem |
| `differentials` / `short_pitch` / `medium_pitch` / `comparison_arguments` | argumentos de venda | idem |
| `variants_summary` / `variant_ask_rule` | regras de variante | idem |
| `social_proof_snippet` | prova social | idem |

**Lacuna real:** **não existe `base_product_id` (FK) em lugar nenhum** ligando explicitamente um pack/kit ao produto-base. O caso Balm 2x/3x/6x → Balm 1x hoje só pode ser inferido via heurística da IA, sem ancoragem manual.

`ai_product_pain_map` existe e mapeia produto ↔ dor; usado pela IA via `commercial-payload-loader.ts`. Sem UI direta de edição.

### Grupo E — Linguagem, Objeções, Conhecimento

| Fonte | Camada | Classificação | Quem preenche | UI hoje | Onde aparece |
|---|---|---|---|---|---|
| `ai_language_dictionary` (tom, vocabulário, aliases, termos proibidos, frases preferidas) | Pipeline base | Recomendado | IA + usuário (manual_overrides) | Parcial/ausente | Configurações Gerais (sub-aba sugerida) |
| `ai_intent_objection_map` (intenção, gatilhos, resposta padrão) | Pipeline base | Recomendado | IA + usuário | Parcial/ausente | Configurações Gerais (sub-aba sugerida) |
| `ai_product_pain_map` | Pipeline base | Recomendado | IA + usuário | Ausente direta | Cadastro de Produto (lateral) |
| `knowledge_base_docs` + `knowledge_base_chunks` | Pipeline base | Recomendado | Usuário/import | UI existe | Módulo KB |
| `tenant_learning_memory` | Pipeline base | Informativo | Sistema (cron) | Ausente | (não exibir) |
| `ai_brain_insights` | Insights | Recomendado (após aprovação vira base) | IA + aprovação humana | UI existe (Insights) | Central de Comando → Insights |
| `ai_memories` | Estado conversa | Informativo | Sistema | Ausente | (não exibir) |
| `ai_conversation_summaries` | Estado conversa | Informativo | Sistema | Ausente | (não exibir) |

**Conclusão E:** as fontes existem. Faltam **UIs simples de edição** para `ai_language_dictionary`, `ai_intent_objection_map` e `ai_product_pain_map`. Insights já tem UI e deve continuar como está.

---

## 4. Inteligência comercial do produto — análise de alternativas

A IA precisa saber, no mínimo, por produto: papel comercial, produto-base, quando recomendar, quando não recomendar, complementares, packs/kits.

| Alternativa | Prós | Contras | Risco fonte de verdade | Impacto IA | Importação | Caso Balm |
|---|---|---|---|---|---|---|
| **A) Usar `ai_product_commercial_payload` como fonte oficial editável pela UI** | Tabela já existe, IA já lê via `commercial-payload-loader`. Zero migration. | UI nova precisa abrir form complexo; campo `manual_overrides` jsonb é frágil; sem `base_product_id` ainda. | Baixo — fonte única, manual override sobrepõe IA. | Nenhum — IA já lê. | OK | Resolve se adicionarmos `base_product_id` aqui. |
| **B) Criar campos de override em `products`** (`commercial_role`, `base_product_id`) | Visível direto no cadastro, sem ir a outra tela. | Duplica fonte com `ai_product_commercial_payload`. Exige merge de precedência (`products` > payload). Inflará o cadastro. | **Alto** — duas tabelas com mesmo dado. Você já vetou inflar cadastro. | Pequeno (loader precisa olhar produto primeiro). | Importador precisa novos campos. | Resolve, mas com custo arquitetural. |
| **C) Nova tabela `product_ai_profile`** | Limpa, dedicada à visão da IA, separada da operacional e da gerada por IA. UI pode ser dedicada. | Cria 3ª fonte concorrente com `ai_product_commercial_payload`. Tem que decidir: fundir ou deprecar a antiga. | **Alto** se conviver com payload; baixo se substituir. | Médio — refatorar loader. | Importador precisa nova rota. | Resolve com `base_product_id` aqui. |

**Recomendação técnica:** **Alternativa A**.
- `ai_product_commercial_payload` é a fonte oficial **editável pelo usuário** via UI nova (acessada do cadastro de produto, aba "Visão da IA").
- IA continua escrevendo lá com `source='ia'` e `confidence_score`. Edição humana grava `has_manual_overrides=true`, `source='manual'` — precedência: manual > IA.
- **Único campo novo proposto** (Onda 1 a aprovar): `ai_product_commercial_payload.base_product_id uuid` (FK opcional para `products.id`) + `ai_product_commercial_payload.complementary_product_ids uuid[]`. Resolve Balm 2x→Balm 1x sem inflar `products` e sem nova tabela.
- **Não criar `products.commercial_role`**, alinhado com sua preferência de manter `products` como dados operacionais.

**Como impedir kits/packs de substituírem produto-base na vitrine de venda da IA** (já parcialmente resolvido pela `arch18_catalog_base_forced` no Respeite o Homem): com `commercial_role IN ('pack','kit')` + `base_product_id` preenchido, a regra fica determinística e não dependente de heurística.

---

## 5. Classificação consolidada (obrigatoriedade)

### A) Obrigatório operacional (sistema não funciona sem)
- `tenants.id/name`, `products.name/slug/price/stock_quantity/status`, `ai_support_config.is_enabled`.

### B) Obrigatório para IA (atende/vende mal sem; **não bloquear tenant antigo**, mostrar alerta)
- Contexto do negócio (campo novo proposto em `ai_support_config`).
- Regras gerais de atendimento (campo novo proposto).
- `products.short_description`.
- `ai_product_commercial_payload.commercial_role`.
- `ai_product_commercial_payload.base_product_id` (proposto) **se** `commercial_role IN (pack, kit, complemento)`.

### C) Recomendado (qualidade)
- `tenant_brand_context` completo (tom, claims proibidas, do_not_do).
- `ai_intent_objection_map` (objeções comuns).
- `knowledge_base_docs` (FAQ/políticas).
- `ai_language_dictionary` (vocabulário, apelidos, termos proibidos).
- `ai_product_commercial_payload.when_not_to_indicate` / `differentials` / `short_pitch`.
- `ai_product_pain_map`.
- `products.tags`, `categories`, `product_type`.
- `ai_channel_config.system_prompt_override` por canal crítico.

### D) Informativo / Opcional
- `seo_*`, `brand`, `vendor`, `meta_*`, `personality_name`, `use_emojis`, `max_response_length`, métricas SLA, `rag_*`.

### Regras de obrigatoriedade
- **Produto novo**: campos do grupo B podem ser obrigatórios no formulário (com defaults sensatos: `commercial_role='principal'`).
- **Produto antigo (edição)**: salvar **sempre permitido**. Banner amarelo no topo e ícone de pendência na lista.
- **Tenant existente**: **checklist persistente** em Configurações Gerais da IA (sem nova rota). Sem bloqueio.
- **Tenant novo**: onboarding mínimo (Onda futura, fora de escopo agora).
- **Canal novo**: nenhum campo obrigatório — sempre herda do geral.

---

## 6. Plano de alertas/checklist na UI (proposta — não implementar)

**Configurações Gerais da IA** — card de checklist no topo da tela:
- "Falta descrever o contexto do seu negócio" → link para o campo.
- "Falta definir regras gerais de atendimento" → idem.
- "Falta informar claims/promessas proibidas" → idem.
- "Falta cadastrar pelo menos 3 objeções comuns" → link para sub-aba.
- "Falta criar pelo menos 1 documento de FAQ/políticas" → link para Knowledge Base.

**Cadastro de Produto** — alertas inline + banner em produtos antigos:
- Sem `short_description`: "Sem isso, a IA improvisa ao explicar o produto."
- Aba "Visão da IA" (a criar futuro) — campos do payload comercial, com:
  - "Falta papel comercial."
  - Se pack/kit/complemento sem `base_product_id`: "Selecione o produto-base."
  - "Falta orientação de quando recomendar e quando NÃO recomendar."

**Configurações por Canal** — banner informativo, **nunca bloqueante**:
- "Este canal está herdando a configuração geral. Personalize se quiser comportamento diferente."

**Insights** — manter exatamente como está. Não criar tela nova.

---

## 7. Fonte de verdade e precedência por tipo de dado

| Tipo de dado | Fonte oficial recomendada | Fallback | Camada |
|---|---|---|---|
| Contexto do negócio (visão usuário) | `ai_support_config.business_context` (novo, Onda 1) | `tenant_business_context` → `ai_business_snapshot.business_summary` | Geral |
| Regras gerais de atendimento | `ai_support_config.attendance_rules` (novo, Onda 1) | `system_prompt` legado | Geral |
| Tom de marca, claims proibidas, do_not_do | `tenant_brand_context` | — | Pipeline base |
| Conhecimento adicional / cola técnica | `ai_support_config.additional_knowledge` (novo, Onda 1) | `custom_knowledge` legado | Geral |
| Papel comercial do produto | `ai_product_commercial_payload.commercial_role` | inferência IA com confiança | Pipeline base |
| Produto-base relacionado (pack/kit) | `ai_product_commercial_payload.base_product_id` (novo, Onda 1) | nenhum | Pipeline base |
| Complementares | `ai_product_commercial_payload.complementary_product_ids` (novo, Onda 1) | nenhum | Pipeline base |
| Objeções | `ai_intent_objection_map` | — | Pipeline base |
| FAQ/Políticas | `knowledge_base_docs` | — | Pipeline base (RAG) |
| Insights aprovados | `ai_brain_insights` (status='ativo') via `ai_brain_active_view` | — | Pipeline base |
| Overrides por canal | `ai_channel_config.*` | — | Canal |
| Estado de conversa | `ai_memories` + buffers | — | Conversa |

**Precedência final do Context Compiler (futuro):**
```
Pipeline base
  < Configurações Gerais da IA (ai_support_config + tenant_brand_context)
    < Configurações por Canal (ai_channel_config)
      < Estado da conversa (ai_memories, focus, anti-repetition)
        < Resultado de tools do turno (search_products, KB hits)
```

---

## 8. Lacunas reais (justificadas)

1. **Campo `business_context` em `ai_support_config`** — não existe. Hoje cai em `custom_knowledge`/`system_prompt` sem rótulo.
2. **Campo `attendance_rules` em `ai_support_config`** — não existe separado.
3. **Campo `additional_knowledge` em `ai_support_config`** — formalizar (substitui uso confuso atual de `custom_knowledge`).
4. **`ai_product_commercial_payload.base_product_id`** — não existe; é o que falta para resolver pack→base sem heurística.
5. **`ai_product_commercial_payload.complementary_product_ids`** — não existe formalmente (vive no `manual_overrides` jsonb).
6. **UIs faltantes**: editor de `ai_language_dictionary`, editor de `ai_intent_objection_map`, editor de `ai_product_pain_map`, aba "Visão da IA" no cadastro de produto.
7. **Checklist de pendências** em Configurações Gerais da IA.

Tudo o mais já tem fonte. O resto é UI + alerta.

---

## 9. Riscos

- **Migração de `custom_knowledge`/`system_prompt`** para os 4 campos novos: precisa estratégia não destrutiva — manter legados como leitura, novos campos sobrepõem se preenchidos.
- **`base_product_id`** vai exigir UI de seleção de produto — risco de circularidade (pack apontando para outro pack). Validar com check trigger.
- **Obrigar `commercial_role` em produto novo** afeta importações em massa — usar default `'principal'` para não bloquear.
- **Alerta excessivo** pode irritar tenant antigo — agrupar em UM checklist colapsável, não espalhar 10 banners.

---

## 10. Recomendação objetiva para Onda 1

Escopo mínimo da Onda 1 (a aprovar separadamente):

1. **Migration aditiva**:
   - `ai_support_config`: adicionar `business_context text`, `attendance_rules text`, `forbidden_claims text`, `additional_knowledge text`. Não remover `custom_knowledge`/`system_prompt`.
   - `ai_product_commercial_payload`: adicionar `base_product_id uuid REFERENCES products(id) ON DELETE SET NULL`, `complementary_product_ids uuid[] DEFAULT '{}'`.
   - Trigger anti-circularidade em `base_product_id`.

2. **UI Configurações Gerais da IA**: 4 campos novos rotulados + checklist de pendências no topo. Sem nova rota, sem nova aba.

3. **Loader**: `business-context-loader.ts` passa a ler `ai_support_config.business_context` antes de `tenant_business_context`. Fallback intacto.

4. **Sem mexer ainda em**: cadastro de produto (fica para Onda 2), config por canal (fica para Onda 3), editores de dicionário/objeções/dor (Onda 4).

---

## 11. Critérios de aceite da Onda 0 (esta entrega)

- [x] Aba "Saúde do Contexto" removida da Central de Comando.
- [x] `ContextHealthTab.tsx`, `useAiContextHealth.ts`, edge `ai-context-product-preview` deletados.
- [x] View `ai_context_health_view` e tabela `ai_segment_playbooks` removidas via migration reversa.
- [x] Doc `context-health.md` removido; memória `motor-contexto-comercial-v1` removida.
- [x] `mapa-ui.md` atualizado.
- [x] `ai-support-chat`, `search_products`, sales pipeline, Orchestrator, `ai_product_commercial_payload`: zero alteração.
- [x] Este documento publicado.

---

## 12. Onda 1A — Entregue

**Escopo executado** (subset da Onda 1, restante adiado para 1B):

- Migration aditiva em `ai_support_config`: criados `business_context text` e `attendance_rules text`. Nenhum campo antigo alterado.
- Não criados nesta onda: `forbidden_claims`, `additional_knowledge`, `base_product_id`, `complementary_product_ids`.
- **Claims/promessas proibidas**: continuam em `tenant_brand_context.banned_claims` e `tenant_brand_context.do_not_do`. A nova UI edita diretamente nessas colunas (sem duplicar fonte).
- **Conhecimento adicional**: continua em `ai_support_config.custom_knowledge`. Apenas o rótulo da UI muda.
- **Prompt do sistema legado**: preservado, agora mostrado em "campo avançado/legado" colapsável dentro da nova aba Negócio.
- **UI**: nova aba "Negócio" como primeira em Configurações Gerais da IA, com 4 blocos (Contexto do negócio, Regras gerais, Claims, Conhecimento adicional). Card de checklist diagnóstico no topo da tela. Sem nova rota, sem nova aba na Central de Comando.
- **Cadastro de Produto**: não alterado (Onda 1B).
- **Configurações por Canal**: não alterada (etapa posterior).
- **Atendimento real**: nenhum dos novos campos é lido em runtime ainda. `ai-support-chat`, `search_products`, sales pipeline e Orchestrator: zero diff. Leitura entrará na Onda 2 (Context Compiler).

**Itens do checklist implementados** (diagnóstico, não bloqueia):
contexto do negócio, regras de atendimento, claims proibidas, conhecimento adicional, FAQ/base de conhecimento, objeções comuns, produtos sem visão da IA (informativo), packs/kits sem produto-base (informativo, ativo na 1B).

