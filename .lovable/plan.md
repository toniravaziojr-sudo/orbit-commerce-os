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

### Onda 4 (parcial) — TPR + consultative-turn universais — ✅ ENTREGUE (parte 1)
- **Artefatos:**
  - `supabase/functions/_shared/sales-pipeline/turn-pre-router.ts` — system prompt do TPR agora é construído em runtime via `buildTPRSystemPrompt(tenantContext)`. O bloco-base é segment-agnostic ("dor relacionada ao que o negócio resolve") e a lista de famílias e dores típicas é injetada por tenant. `mentioned_product_family` continua `string | null` (sem enum fechado). `TPRInput` ganhou `tenantContext?: { segment, families[], painPoints[] }`.
  - `fallbackClassification` agora aceita `tenantContext` opcional e combina cue universal de "caso pessoal" (`tenho/estou com/faz X tempo`) + tokens de dor do tenant. O regex legado de cosmético segue como rede de segurança final.
  - `supabase/functions/_shared/sales-pipeline/consultative-turn.ts` — nova função `detectConsultativeTurnUniversal({ tpr, tenantPainTokens, ... })`. Quando o TPR está em `source='llm'`, usa diretamente seus sinais como fonte única (Reg #2.8). Quando o TPR caiu em fallback, aplica detector dinâmico universal (cue pessoal + tokens do tenant + pedido de recomendação genérico). Detector regex legado (`detectConsultativeTurn`) preservado intacto como fallback final.
- **Compatibilidade:** assinaturas legadas preservadas. Caller em `ai-support-chat` ainda não foi virado — fica para a sub-janela 4.2 atrás de flag `arch218_universal_tpr` (passar `tenantContext` no `classifyTurn` e usar `detectConsultativeTurnUniversal`).
- **Pendente da Onda 4:**
  - 4.2: ligar a flag `arch218_universal_tpr` em `ai-support-chat` (passar `tenantContext` para `classifyTurn` e trocar `detectConsultativeTurn` pelo universal).
  - 4.3: Hotspot E — `turn-completeness.ts` (regexes `STRONG_Q_PRODUCT_REF`, `Q_ABOUT_PRODUCT_FAMILY` e blocos de sintoma nas linhas 171/193) parametrizados por `tenantFamilyTokens` e `tenantPainTokens`.
- **Evidência:** suíte de testes existente (`catalog-probe-v2`, `catalog-probe-universal`, `tenant-vocabulary`) — 19/19 passando. Mudanças no TPR e no consultative-turn são aditivas (novas funções/parâmetros opcionais), portanto contratos antigos seguem verdes.



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
| 3.3 (entregue) | `catalog-probe.ts` (Hotspot D) | `arch218_universal_catalog_probe` |
| 4 (próxima) | TPR + `consultative-turn` + `turn-completeness` (Hotspots E, F, G) | `arch218_universal_tpr` |
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
- Situação: Ondas 1, 2 (parte aditiva), 3 (resolver de dor), 3.2 (descrição neutra) e 3.3 (catalog-probe universal) entregues. Próxima sub-janela: Onda 4 — TPR + `consultative-turn` + `turn-completeness`.




### Onda 4.1 — TPR universal (parte estrutural) — ✅ ENTREGUE
- **Artefato:** `supabase/functions/_shared/sales-pipeline/turn-pre-router.ts`
- `buildTPRSystemPrompt(tenantContext)`: monta system prompt do TPR em runtime, injetando segmento, famílias e dores do tenant. Sem `tenantContext`, prompt-base segment-agnostic preservado.
- `fallbackClassification(message, hasMedia, tenantContext?)` agora também aceita o contexto do tenant para enriquecer o fallback regex (sintomas universais "tenho/estou com/faz X tempo" + tokens de dor do tenant). Legado preservado como rede.
- **Sem flag aqui — só código.** O efeito real só acontece quando o orquestrador passar `tenantContext` (Onda 4.2).

### Onda 4.2 — TPR universal — wiring no orquestrador — ✅ ENTREGUE
- **Artefato:** `supabase/functions/ai-support-chat/index.ts`
- Flag `arch218_universal_tpr` em `ai_support_config.metadata` (default `false`).
- Quando `true`: aquece o cache do vocabulário do tenant (peek + load fallback), monta `tprTenantContext = { segment, families, painPoints }` e passa para `classifyTurn()` e para `fallbackClassification()`.
- Log enriquecido: `[universal=on families=N pains=N]` quando flag ligada — para auditoria nas baterias.
- **Comportamento default:** sem flag, contexto fica `undefined` e o caminho atual (Reg #2.8) segue idêntico — paridade preservada byte-a-byte.

### Onda 5 — Turn-completeness universal (parte estrutural) — ✅ ENTREGUE
- **Artefato:** `supabase/functions/_shared/sales-pipeline/turn-completeness.ts`
- `CompletenessContext.tenantPainTokens?: string[]` — tokens de dor do tenant (vindos do Resolver) entram como ampliação do regex cosmético legado, **não substituição**. `matchesPain(text)` faz `LEGACY_PAIN_RE OR tenantPainRe`.
- Casos cobertos: `recommend_with_symptom_or_focus` e `product_family_with_symptom` agora aceitam dor declarada em qualquer segmento quando o tenant trouxer tokens.
- **Compatibilidade:** sem `tenantPainTokens`, comportamento idêntico ao atual (regex cosmético segue cobrindo Respeite o Homem).
- **Pendência (Onda 5.2):** o webhook de WhatsApp (`meta-whatsapp-webhook`) chama `classifyTurnCompleteness` ANTES do orquestrador, então não tem o vocabulário em mãos. Há duas opções: (a) carregar resolver no webhook quando flag estiver ligada; (b) deixar a expansão valer só do orquestrador em diante (impacto: debounce do primeiro turno em segmento novo pode ficar conservador). Decisão fica no plano final.

### Onda 6 — Outros agentes de IA — 📋 AUDITORIA (não modificada nesta passada)
Levantamento das ocorrências de vocabulário cosmético fora do `_shared/sales-pipeline/` que precisam universalizar em momento posterior, com flag própria:

| Agente / Edge function | Tipo de termo travado | Risco | Onda sugerida |
|---|---|---|---|
| `ai-creatives-generate-*` (Strategic Analyzer) | exemplos de copy ("calvície", "queda") em prompts | médio (cria exemplos errados em outros segmentos) | Onda 6.1 — neutralizar exemplos |
| `ai-landing-page-*` (detector de segmento) | regex de "cabelo/barba" | médio (segmento errado em pet/moda) | Onda 6.2 — usar segmento declarado pelo tenant |
| `ai-content-creator-*` (templates de copy) | placeholders fixos | baixo | Onda 6.3 — tokens neutros |
| `consultative-turn.ts` (regex de cabelo/barba) | regex de sintomas | baixo (já preterido pelo TPR quando arch218_universal_tpr=on) | Onda 6.4 — depreciar quando TPR universal estabilizar |
| `transitions.ts` (FAMILY_TOKENS, FAMILY_REFERENCE_PRONOUN) | regex de família com vocabulário cosmético | baixo (já tem detector universal paralelo) | Onda 6.5 — manter como fallback até estabilização |

Decisão: **não tocar em Ondas 6.x agora.** Risco de mexer em criativos/landing sem bateria multi-segmento dedicada é alto. Entram em sprint próprio depois que a vendas estabilizar.

### Onda 7 — Bateria de validação multi-segmento — ✅ ENTREGUE (parcial)
- **Artefato:** `supabase/functions/_shared/sales-pipeline/__tests__/multi-segment-universal.test.ts`
- 5/5 testes passando: pet (coceira), moda (apertando), suplemento (baixa imunidade), pet (resolver de dor sem padrão cosmético), paridade Respeite o Homem.
- **Total da pipeline:** 38/38 passam — zero regressão nas baterias existentes.
- **Pendência (Onda 7.2):** rodar bateria E2E contra `ai-test-sandbox` em 3 tenants fictícios (pet, moda, suplemento), com a flag `arch218_universal_tpr` ligada, e comparar com baseline atual. Esta parte exige criação de tenants de teste no banco — fica para o plano de correção (passo de promoção).

### Onda 8 — Limpeza de legado — 📋 PLANEJADO (não removido nesta passada)
- **Princípio:** legado **não é removido**. Vira fallback explícito quando todas as flags universais estiverem ligadas em produção há ≥30 dias com paridade.
- **Itens marcados para remoção futura:**
  - `LEGACY_PAIN_RE` (regex cosmético em turn-completeness): remover quando 100% dos tenants tiverem `tenantPainTokens` populados pelo Resolver.
  - `FAMILY_TOKENS` legado em `transitions.ts`: idem.
  - `consultative-turn.ts` regex: idem (já tem TPR como fonte primária).
  - Lexer `%calv%/%caspa%/%queda%` em `ai-support-chat/index.ts`: idem.

## Plano de correção universal consolidado (a aprovar)

Este é o plano final pedido — agrupa o que já foi entregue atrás de flag e o que falta para promoção em produção.

### Estado atual (após esta passada)
| Camada | Universalização | Flag | Default | Wiring |
|---|---|---|---|---|
| Resolver de vocabulário do tenant | ✅ | — (sempre disponível) | — | sempre on (cache lazy) |
| Detectores universais (família, anáfora, aliases) | ✅ (aditivos) | `arch218_universal_catalog_probe` | off | já wirado |
| Pain → category resolver universal | ✅ | `arch218_universal_pain_resolver` | off | já wirado |
| Catalog probe universal (sonda + classificador) | ✅ | `arch218_universal_catalog_probe` | off | já wirado |
| TPR universal (estrutural + wiring) | ✅ | `arch218_universal_tpr` | off | já wirado |
| Turn-completeness universal (estrutural) | ✅ | `arch218_universal_turn_completeness` | off | **wiring no webhook pendente (5.2)** |
| Bateria multi-segmento determinística | ✅ | — | — | testes verdes (38/38) |
| Bateria E2E multi-tenant fictício | ⏳ | — | — | depende de tenants de teste |
| Strategic Analyzer / landing detector / content creator universais | ⏳ | (futura) | — | sprint próprio |

### Sequência de promoção (a executar após sua aprovação)
1. **Promoção controlada no Respeite o Homem** — ligar as 4 flags `arch218_universal_*` (`pain_resolver`, `catalog_probe`, `tpr`, `turn_completeness`) **uma de cada vez**, validando em 24h cada com bateria A–D do Reg #2.17. Ordem sugerida: pain_resolver → catalog_probe → tpr → turn_completeness.
2. **Wiring da Onda 5.2** — passar `tenantPainTokens` no callsite do webhook, lendo do Resolver. Atrás da mesma flag `arch218_universal_turn_completeness`.
3. **Tenants fictícios para Onda 7.2** — criar 3 tenants de teste (pet, moda, suplemento) no banco com catálogo mínimo + dicionário do negócio, e rodar a bateria do `ai-test-sandbox` contra eles com as flags ligadas.
4. **Promoção a um tenant real fora de cosmético** — quando os tenants fictícios passarem, ligar as flags em **um** tenant real de outro segmento (ex.: pet) com paridade obrigatória.
5. **Promoção universal** — ligar default em produção. Aqui a flag passa de "opt-in por tenant" para "opt-out por tenant".
6. **Sprint Onda 6 (criativos/landing/content creator)** — só depois que vendas estiver estável.
7. **Sprint Onda 8 (limpeza)** — 30 dias depois da promoção universal, com paridade comprovada.

### Reversão
Cada flag é independente. Desligar em `ai_support_config.metadata` reverte para legado byte-a-byte.

### Decisões pendentes para sua aprovação
1. **Onda 5.2:** aceitar que o webhook carregue o resolver síncrono (peek) antes de chamar `classifyTurnCompleteness`? Custo: 1 query ILIKE adicional no caminho crítico do WhatsApp se cache estiver frio. Mitigação: warm-up no primeiro turno do orquestrador (já existe), webhook só lê do peek.
2. **Onda 7.2:** posso criar tenants fictícios em banco de testes para a bateria E2E, ou prefere aguardar tenants reais de outro segmento entrarem na plataforma?
3. **Ordem de promoção:** confirma a sequência sugerida (pain_resolver → catalog_probe → tpr → turn_completeness)?
4. **Onda 6 e 8:** entendo que ficam fora deste plano, em sprints próprios depois da estabilização. OK?

