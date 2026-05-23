# Plano — Universalização Total da IA (Reg #2.18)

> **Decisão de negócio:** a pipeline da IA é multi-segmento por contrato. A "cara do segmento" (cosmético, pet, moda, eletrônico, suplemento, serviços, etc.) só pode vir de **dois lugares já existentes**: (1) Configurações da IA do tenant (persona, tom, prompt-base, conhecimento adicional, regras, dicionário do negócio, claims proibidas) e (2) catálogo real do tenant (categorias, tags, descrição, Visão da IA do produto, mapa de dor, relações). Nenhum vocabulário de segmento pode estar travado no código.

## Diagnóstico curto
Auditoria global encontrou ~12 pontos com vocabulário fixo de cosmético/cabelo/barba (shampoo, balm, loção, calvície, queda, caspa, coroa, couro cabeludo, pós-barba). Isso entrega bem para o Respeite o Homem hoje, mas falha silenciosamente em qualquer outro segmento.

Camadas já universais (**não mexer**, só preservar paridade): veto comercial, motor de handoff, reflexos determinísticos (CEP/frete/pós-venda/turno curto), output gates, Turn Orchestrator, máquina de estados, working memory, anti-repetição, loader de contexto do negócio, loader de payload comercial.

## O que muda para o cliente final
**Nada visualmente.** A IA passa a:
- Reconhecer família/categoria de qualquer segmento lendo do catálogo do próprio tenant.
- Reconhecer dor/objetivo do cliente de forma semântica (LLM), sem listas de palavras específicas.
- Tratar o que o lojista já escreve em Configurações da IA + Catálogo como única fonte do "sotaque" do negócio.

## Fontes de verdade (todas já existem — só consumir)
| Tipo de informação | Fonte oficial | Quem mantém |
|---|---|---|
| Famílias/linhas que o tenant vende | Categorias + tags + `product_type` | Lojista, no cadastro |
| Dores que o catálogo resolve | Mapa de dor por produto + descrição comercial da categoria + Visão da IA do produto | Lojista + IA com aprovação |
| Papel comercial do produto (base/pack/kit/complemento) | Payload comercial do produto (já lido pelo loader em runtime) | Lojista (Visão da IA) |
| Produto-base de um pack | Campo `base_product_id` no payload comercial | Lojista (Visão da IA) |
| Composição real de kit/combo | Tabela de componentes do produto | Lojista |
| Sinônimos, apelidos, frases preferidas, termos proibidos do negócio | Dicionário de linguagem do tenant | Lojista (sub-aba de Configurações) |
| Persona, tom, prompt-base, regras, claims proibidas, palavras de handoff, conhecimento adicional | Configurações Gerais da IA + Marca | Lojista |
| Contexto do negócio (visão do dono) | Contexto do negócio + snapshot regenerável | Lojista + IA |

Fallback obrigatório: se o tenant ainda não cadastrou alguma das fontes acima, a IA **pergunta ao cliente** em vez de chutar com vocabulário fixo de qualquer segmento.

## Princípios invioláveis da pipeline
1. Zero lista fechada de famílias, dores ou sintomas no código da pipeline.
2. Detecção de família vem do catálogo do tenant em runtime (com cache).
3. Detecção de dor consultiva é **semântica** (já há classificador de turno via LLM) — sem regex de keywords de segmento.
4. Exemplos dentro de prompts são **abstratos** (placeholders tipo "família citada pelo cliente", "dor declarada"). Nomes reais entram por composição em runtime.
5. Descrição de tools (busca, recomendação, etc.) usa linguagem neutra. Nada de "ex.: calvície, caspa, balm".

## Ondas de execução (com flag por onda; liga primeiro só no Respeite o Homem para validar paridade)

### Onda 1 — Camada universal de vocabulário do tenant (fundação)
Criar uma camada interna que, dado um tenant, devolva em runtime:
- Famílias do catálogo (a partir de categorias/tags/`product_type`, normalizadas).
- Sinônimos e variações (do dicionário do tenant).
- Dores que o catálogo resolve (do mapa de dor + Visão da IA).
- Cache em memória por tenant, invalidado por mudança de catálogo/configuração.

Reaproveita os loaders já existentes (contexto do negócio e payload comercial) — sem duplicar.

### Onda 2 — Detectores universais
Substituir, em sequência e protegidos por flag:
- Detector de família mencionada pelo cliente.
- Detector de referência anafórica ("esse produto", "essa linha").
- Aliases de família para a sonda de catálogo.
- Lexer de "intenção comercial" (gate de mídia e de turno completo).
- Detector de turno consultivo (passa a ser semântico via classificador, sem regex de cabelo/barba).

Cada detector consulta o resolver da Onda 1.

### Onda 3 — Sonda de catálogo e tool de busca universais
- Sonda de catálogo deixa de mapear `%calv%/%caspa%`. Passa a usar categorias e Visão da IA do tenant para encontrar "tratamento inteiro" da dor citada, em qualquer segmento.
- Descrição da tool de busca de produto e seus parâmetros vira texto neutro com placeholders.

### Onda 4 — Classificador de turno (TPR) universal
- Prompt do classificador perde a lista cosmética. Recebe as famílias do tenant via resolver dinamicamente.
- O campo "família mencionada" deixa de ser enum fechado.

### Onda 5 — Prompts dos estados universais
Reescrever os prompts dos estados (descoberta, recomendação, detalhe, frete grátis, decisão, checkout) com exemplos abstratos. A "voz do segmento" passa a entrar 100% por composição: persona + dicionário do tenant + nomes reais do catálogo carregados em runtime.

### Onda 6 — Outros agentes de IA (criativos, landing, content creator)
- Strategic Analyzer: exemplos abstratos.
- Detector de segmento de landing: usar segmento declarado pelo tenant + classificação semântica, não regex de "cabelo".
- Stock de imagens: mapear via categoria do tenant.
- Templates de copy do content creator: neutros, com tokens preenchidos pelo contexto do tenant.

### Onda 7 — Governança e validação
- Bateria de validação multi-segmento (cosmético, pet, moda, eletrônico, suplemento) rodando contra o ambiente de testes da IA em todas as ondas.
- Verificação automatizada que falha se aparecer no código da pipeline qualquer um destes termos: shampoo, calvície, caspa, coroa, couro cabeludo, balm, loção, pomada, óleo, hidratante, perfume, sabonete, condicionador, sérum, tônico, máscara, pós-barba, after-shave (e variantes acentuadas).
- Memória de governança: "Pipeline de IA é segment-agnostic. Personalização só por Configurações da IA + Catálogo do tenant."
- Doc novo: `docs/especificacoes/ia/pipeline-universal-multi-segmento.md`. Atualizar `motor-contexto-comercial.md`, `modo-vendas-whatsapp.md`, `pipeline-f2-vendas-ia.md` e abrir Reg #2.18 no changelog da IA.

## Anti-conflito (lógicas vivas que NÃO podem regredir)
- **Reg #2.13 — Turn Orchestrator**: nenhuma onda pode trocar a fonte do texto consolidado do turno; todos os detectores continuam consumindo o turno orchestrado.
- **Reg #2.17 v2 — Veto comercial e motor de handoff**: continuam universais como já estão. A universalização do detector de dor consultiva só amplia, não substitui.
- **Reg #2.8 — Classificador de turno (TPR) + output gates**: o TPR continua sendo a fonte única de classificação. A onda 4 só remove o viés cosmético do prompt e abre o campo "família" para o vocabulário do tenant.
- **Onda 18 Fase A — priorização de base vs kit**: depende de "família detectada". A nova detecção universal precisa devolver um identificador de família compatível com o que essa fase já consome (chave estável por tenant, não enum global).
- **Onda 1C dry_run — builder de contexto de recomendação**: nenhuma onda pode alterar o shape de saída do `search_products` enquanto o builder estiver em dry_run. Universalização entra antes ou depois, não em paralelo a uma promoção do builder.
- **Loader de contexto do negócio e loader de payload comercial**: reusar, não duplicar. Resolver da Onda 1 lê desses loaders quando aplicável.
- **Modo Vendas (Reg #2.X — sales-mode)**: as 12 tools comerciais continuam idênticas; só a descrição textual delas (parâmetros e exemplos) fica neutra.

## Validação e rollout
- Cada onda atrás de flag em `ai_support_config.metadata` (`arch218_universal_<onda>`).
- Liga primeiro só no Respeite o Homem com paridade obrigatória nas baterias atuais (A–D do Reg #2.17).
- Depois liga em **um** tenant de outro segmento (ex.: pet ou moda) com bateria multi-segmento dedicada.
- Promove para todos os tenants só após paridade estável nos dois primeiros.
- Reversão = desligar a flag. Cada onda é independente.

## Fora de escopo
- Latência de turnos longos.
- Aprofundamento do Approval Center da Visão da IA (já tem ondas próprias).
- Playbooks "presets" por segmento no onboarding (pode vir depois; pipeline não pode depender disso).
- Qualquer mudança de UI/UX ou de regra de negócio.

## Decisões que precisam da sua aprovação antes de seguir
Nenhuma decisão técnica pendente — escopo é universalização do que já existe.

Decisões de negócio/UI a confirmar (você pediu para passar por aprovação):
1. **Confirmar que personalização do segmento permanece restrita às telas atuais** (Configurações da IA, Marca, Cadastro de Produto / Visão da IA, Categorias, Dicionário do tenant). Se sim, a Onda 1 já tem todas as fontes que precisa e não criamos campo novo.
2. **Confirmar a bateria de validação multi-segmento como gate de promoção** (Onda 7). Posso montar com 3 tenants fictícios (pet, moda, suplemento) no ambiente de testes da IA, sem tocar em tenant real.

## Status de execução

### Onda 1 — Resolver de Vocabulário do Tenant — ✅ ENTREGUE
- **Artefato:** `supabase/functions/_shared/sales-pipeline/tenant-vocabulary-resolver.ts`
- **O que faz:** dado um `tenant_id`, devolve em runtime um objeto `TenantVocabulary` com:
  - `families[]` — chaves estáveis derivadas de `categories` (raízes) + `products.product_type`, com contagem de produtos por família.
  - `synonyms` / `aliases` / `preferredPhrases` / `forbiddenTerms` — vindos de `ai_language_dictionary` do tenant.
  - `painPoints[]` — agregados a partir de Visão da IA do produto + descrição comercial da categoria.
  - `segment`, `audience`, `catalogIncomplete` — vindos do `business-context-loader` e `ai_business_snapshot`.
  - Cada item carrega `source` (categories | product_type | dictionary | snapshot) para auditoria.
- **Cache:** TTL de 5 minutos por tenant; helper `invalidateTenantVocabularyCache(tenantId)` para invalidação manual; `peekTenantVocabularyFromCache(tenantId)` síncrono para detectores que não podem `await`.
- **Reuso:** consome loaders existentes (`business-context-loader`, `commercial-payload-loader`). **Zero duplicação. Zero schema novo.**
- **Evidência:** 6 testes em `_shared/sales-pipeline/__tests__/tenant-vocabulary.test.ts` — pet shop (ração/petisco), moda (calça/camiseta), longest-match (kit barba > kit), merge de aliases legado + tenant. ✅ Todos passam.

### Onda 2 — Detectores universais (parte aditiva) — ✅ ENTREGUE
- **Artefato:** `supabase/functions/_shared/sales-pipeline/transitions.ts` — adicionadas:
  - `detectFamilyMentionedUniversal(text, tenantId)` — constrói `Map<token, family_key>` a partir do Resolver e aplica regex com **longest-match** (garante que "kit barba completo" não seja engolido por "kit").
  - `getCatalogFamilyAliasesUniversal(tenantId)` — funde aliases legados (loção/balm/pós-barba) com aliases declarados pelo tenant no dicionário.
- **Compatibilidade:** funções legadas preservadas como fallback. Nada do comportamento atual mudou para o cliente final.
- **Pendências da Onda 2** (entram em sequência, atrás da flag `arch218_universal_onda2`):
  1. Wiring em `ai-support-chat/index.ts` — substituir chamada do detector legado pelo universal quando flag ligada.
  2. Detector de referência anafórica universal ("essa linha", "esse produto").
  3. Lexer de intenção comercial (gate de mídia/turno completo).
  4. Detector de turno consultivo passa a depender 100% do TPR (sem regex de cabelo/barba).
- **Evidência:** testes universais passam; testes legados de pipeline mantidos sem regressão (falhas pré-existentes em `pipeline.test.ts` confirmadas como anteriores à entrega).

### Onda 3 — Sonda de catálogo + tool de busca universais — ✅ ENTREGUE (parte do resolver de dor)
- **Artefato:** `supabase/functions/_shared/sales-pipeline/pain-category-resolver.ts`
- **O que faz:** dado o `painSource` (texto que o cliente declarou) + `TenantVocabulary`, deriva padrões `%token%` para `categories.name ILIKE` **sem nenhum termo travado de segmento**. Tokens ≥4 chars, stopwords PT-BR removidas; sinônimos do dicionário do tenant entram quando bate alguma dor declarada.
- **Wiring atrás de flag:** `ai-support-chat/index.ts` lê `ai_support_config.metadata.arch218_universal_pain_resolver`; quando `true`, substitui o léxico legado de cosmético/cabelo (`%calv%`, `%caspa%`, `%queda%`...) pelo resolver universal. Quando `false` (default), comportamento legado preservado byte-a-byte.
- **Evidência:** 5 testes em `__tests__/pain-category-resolver.test.ts` — pet shop ("cachorro coça"), moda ("calça apertando"), sinônimos do tenant, stopwords. ✅ Todos passam (5/5).
- **Pendências da Onda 3:**
  1. ✅ Descrição da tool `search_products` neutralizada (sem exemplos de calvície/caspa/balm/Calvície Zero). Texto agora cita "qualquer segmento: cosmético, pet, moda, suplemento, eletrônico, serviços". Aplicado direto (sem flag) — exemplos travados em descrição de tool não afetam comportamento determinístico, só ancoravam o LLM no segmento cosmético.
  2. Bateria multi-segmento dedicada (pet, moda, suplemento) — pendente.

### Onda 3.2 — Neutralização das descrições de tools — ✅ ENTREGUE
- **Artefato:** `supabase/functions/ai-support-chat/index.ts` linhas 447–454.
- **Auditoria das 16 tools comerciais:** apenas `search_products` tinha exemplos travados de cosmético. As outras 15 (`get_product_details`, `check_coupon`, `add_to_cart`, `view_cart`, `remove_from_cart`, `apply_coupon`, `check_upsell_offers`, `generate_checkout_link`, `lookup_customer`, `calculate_shipping`, `save_customer_data`, `update_customer_record`, `get_product_variants`, `recommend_related_products`, `check_customer_coupon_eligibility`) já estavam neutras.

### Onda 3.3 — Catalog-probe universal — ✅ ENTREGUE
- **Artefatos:**
  - `supabase/functions/_shared/sales-pipeline/catalog-probe.ts` — novas funções `classifyProductFamilyUniversal(name, tenantId)` e `detectFamilyInTextUniversal(text, tenantId)` que consomem o `TenantVocabulary` da Onda 1 via `peekTenantVocabularyFromCache` (longest-match, com fallback automático para o regex legado quando o cache está frio ou não há match).
  - `broadenCatalogForPain` e `enforceFamilyBaseFirst` agora aceitam um `classifier?` opcional. Quando o caller passa o universal, a vitrine de "uma representante por família" e a partição base/kit usam famílias derivadas do catálogo do tenant — sem regex de cosmético.
  - `supabase/functions/ai-support-chat/index.ts` — flag `arch218_universal_catalog_probe` em `ai_support_config.metadata`. Quando ligada: (i) aquece o cache do vocabulário no início do handler `search_products`; (ii) substitui as 3 chamadas de `detectFamilyInText` pelo universal; (iii) injeta o `classifier` universal em `broadenCatalogForPain` e `enforceFamilyBaseFirst`. Quando desligada (default), comportamento legado byte-a-byte.
- **Compatibilidade com Onda 18 Fase A:** o universal devolve `family.key` estável por tenant. Como a Fase A já consome a saída do detector como string opaca (não enum global), a integração é direta.
- **Trace:** `ai_turn_traces` ganhou o campo `family_detector: 'universal' | 'legacy'` no stage `turn_input` para auditar paridade.
- **Evidência:** 4 testes novos em `_shared/sales-pipeline/__tests__/catalog-probe-universal.test.ts` confirmando fallback determinístico (sem cache → legado, `tenantId=null` → legado). Os 9 testes de `catalog-probe-v2.test.ts` (Onda 18 Fase A) seguem passando — paridade preservada. ✅ 13/13.
- **Rollout:** flag desligada por padrão; ligar primeiro no Respeite o Homem com bateria A–D do Reg #2.17.


## 📋 Auditoria detalhada — pontos restantes com vocabulário travado de segmento

Inventário completo do que ainda precisa ser universalizado nas próximas ondas. Cada item lista arquivo, linhas, natureza do acoplamento e estratégia.

### Hotspot A — `_shared/sales-pipeline/prompts/discovery.ts` (Onda 5)
- **Linhas 15–25, 29–39:** prompt do estado de descoberta lista pain_hints fixos ("calvície", "queda", "caspa", "oleosidade", "couro cabeludo") e exemplos de diálogo com "shampoo / Anticaspa Pro".
- **Estratégia:** reescrever como template com placeholders `{{tenant.familias_principais}}`, `{{tenant.dores_declaradas_no_dicionario}}` e `{{tenant.exemplo_produto}}`, preenchidos em runtime pelo Resolver da Onda 1.
- **Risco:** prompt é fonte do estilo "vendedora de farmácia". Trocar exige paridade A/B no Respeite o Homem.

### Hotspot B — `_shared/sales-pipeline/prompts/recommendation.ts` (Onda 5)
- **Linhas 15–95:** múltiplas frases-modelo travadas em cosmético ("Como vendedora de farmácia: cliente pede shampoo → você mostra o SHAMPOO", "Pra calvície a gente tem o Shampoo Calvície Zero…", "Nossa loção pra esse caso é a [nome]").
- **Estratégia:** mesma da Onda 5. Trocar por placeholders neutros + 1 exemplo abstrato com `<FAMÍLIA>` / `<PRODUTO>`.

### Hotspot C — `_shared/sales-pipeline/prompts/free-shipping-rule.ts`
- **Linha 43:** comentário interno sobre "loção e balm não são a mesma linha".
- **Estratégia:** trocar comentário por explicação genérica ("variações de tamanho/quantidade do MESMO produto-base contam como mesma linha; produtos de famílias diferentes não contam"). Sem efeito runtime.

### Hotspot D — `_shared/sales-pipeline/catalog-probe.ts` (Onda 3 — sub-janela 3.3)
- **Linhas 4–28:** comentário e `FAMILY_TOKENS` com regex hard-coded para `shampoo|condicionador|creme|locao|balm|...`.
- **Estratégia:** o `pain-category-resolver.ts` já cobre detecção de dor → categorias. Falta substituir `FAMILY_TOKENS` pela leitura do Resolver. Já temos `getCatalogFamilyAliasesUniversal` em `transitions.ts`; precisa ser consumido aqui também.
- **Risco:** este módulo é a "sonda" que evita cegueira de família. Mudança exige flag dedicada e paridade na bateria do Respeite o Homem.

### Hotspot E — `_shared/sales-pipeline/turn-completeness.ts` (Onda 4)
- **Linhas 57, 60, 171, 193:** regex `STRONG_Q_PRODUCT_REF` e `Q_ABOUT_PRODUCT_FAMILY` listam "loção|pomada|shampoo|creme|balm|óleo|gel|cápsula|kit"; contexto de recomendação verifica `entradas?|calv|queda|cresc|caspa|seborr|oleos|ressec|fios?|cabel`.
- **Estratégia:** o detector de "turno completo" passa a aceitar QUALQUER família do Resolver + sintaxe genérica de pergunta-de-recomendação ("tem X pra Y?", "qual o melhor pra Y?"). A lista de dores some — basta haver "pra/para/contra + substantivo" depois da família.

### Hotspot F — `_shared/sales-pipeline/consultative-turn.ts` (Onda 4)
- **Linhas 28–37:** `CONSULTATIVE_PATTERNS` é um array de 4 regexes 100% cosméticas ("tenho calvície", "estou com queda", "minha coroa tá ralinha", "qual shampoo/loção indicado").
- **Estratégia:** substituir por classificação semântica via TPR (Reg #2.8). O TPR já tem campo `described_symptom`; basta passar a confiar nele e remover os regex. Detector legado some quando flag `arch218_universal_consultative` ligar.

### Hotspot G — `_shared/sales-pipeline/turn-pre-router.ts` (Onda 4)
- **Linha 84:** prompt do TPR cita "tenho calvície, tô com queda, minha coroa tá ralinha, tenho bastante entrada" como exemplos.
- **Linha 87:** descrição do `should_broaden_catalog_for_pain` ancora em "calvície, queda, caspa".
- **Linha 88:** `mentioned_product_family` ainda é enum fechado de 13 famílias cosméticas ("shampoo, condicionador, creme, locao, balm, serum, tonico, mascara, gel, sabonete, kit, combo, perfume").
- **Linhas 298–299:** fallback `hasSymptom` / `askedRec` com regex de cabelo.
- **Estratégia:** (i) prompt do TPR recebe `{{tenant.familias_principais}}` e `{{tenant.dicionario_dores}}` injetados pelo Resolver; (ii) `mentioned_product_family` vira string livre validada contra as famílias do tenant; (iii) fallback regex sai (TPR é fonte única — ver Reg #2.8). 
- **Risco:** mexer no TPR é o ponto mais sensível. Flag dedicada `arch218_universal_tpr` + bateria A–D obrigatória antes de promover.

### Hotspot H — `_shared/sales-pipeline/transitions.ts`
- **`FAMILY_TOKENS` legado** (linhas ~80–100, mantidas como fallback): `shampoo`, `condicionador`, `creme`, `locao` (cobre pós-barba/after-shave), `balm`, `serum`, `tonico`, `mascara`, `gel`, `sabonete`, `pomada`, `oleo`, `hidratante`, `barba`, `desodorante`, `kit`, `combo`, `perfume`.
- **Status:** já existe versão universal (`detectFamilyMentionedUniversal`) em paralelo. O legado fica como fallback enquanto flag `arch218_universal_onda2` não estiver ligada por tenant. Remoção do legado entra em onda final de cleanup (Onda 8).

### Hotspot I — Outros agentes (Onda 6)
- **Strategic Analyzer / Detector de segmento de landing / Stock de imagens / Content Creator templates:** ainda não auditados em profundidade. Próxima sub-janela da Onda 6 vai fazer varredura equivalente nessas funções (`creative-strategist`, `landing-page-*`, `content-*`).

### Hotspot J — Memória de governança que ainda cita exemplos de cosmético
- **`mem://constraints/ai-family-vocabulary-must-cover-tenant-variations.md`** descreve a lista atual do `FAMILY_TOKENS` cosmético como exemplo. Após remoção do fallback (Onda 8), essa memória deve ser reescrita: a regra continua válida ("cobrir variações comuns que o tenant vende"), mas os exemplos fixos saem.
- **`mem://constraints/sales-pipeline-pain-vs-complaint-and-handoff-motor.md`** já está universal — só preservar.

## Resumo da auditoria (para o plano final de correção universal)
| Onda | Hotspots cobertos | Flag |
|---|---|---|
| 1 (entregue) | Resolver de vocabulário | — |
| 2 (parcial) | Detector de família universal + aliases (ainda como aditivo) | `arch218_universal_onda2` |
| 3 (entregue) | Resolver de dor → categorias + descrição neutra de `search_products` | `arch218_universal_pain_resolver` |
| 3.3 (próxima) | `catalog-probe.ts` (Hotspot D) | `arch218_universal_catalog_probe` |
| 4 | TPR + `consultative-turn` + `turn-completeness` (Hotspots E, F, G) | `arch218_universal_tpr` |
| 5 | Prompts dos estados (Hotspots A, B, C) | `arch218_universal_state_prompts` |
| 6 | Outros agentes IA (Hotspot I) | `arch218_universal_other_agents` |
| 7 | Bateria multi-segmento + linter anti-regressão | gate de promoção |
| 8 (cleanup) | Remoção de fallbacks legados (Hotspots H, J) | sem flag — só após paridade total |

## Checklist de conformidade
- Doc de Regras do Sistema lido ✓
- Docs formais lidos: `mapa-fontes-ia.md`, `motor-contexto-comercial.md`, `visao-ia-produto.md`, `modo-vendas-whatsapp.md`, `pipeline-f2-vendas-ia.md`, `turn-orchestrator.md`, `ia-atendimento-changelog.md` ✓
- Fluxo afetado: IA de Atendimento (modo vendas e informativo) + agentes auxiliares
- Fonte de verdade: Configurações da IA + Catálogo do tenant
- UI impactada: nenhuma
- Situação: Ondas 1, 2 (parte aditiva), 3 (resolver de dor) e 3.2 (descrição neutra da tool de busca) entregues. Auditoria completa dos hotspots restantes documentada acima. Próxima sub-janela: Onda 3.3 (`catalog-probe.ts`) ou pular direto para Onda 4 (TPR), conforme prioridade do usuário.


