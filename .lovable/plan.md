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
- **Onda 1 — Resolver de Vocabulário do Tenant: ENTREGUE.** Arquivo `_shared/sales-pipeline/tenant-vocabulary-resolver.ts`. Lê catálogo + dicionário + snapshot do contexto comercial. Cache 5 min. Sem schema novo.
- **Onda 2 — Detectores universais: PARCIAL (aditivo).** `detectFamilyMentionedUniversal` e `getCatalogFamilyAliasesUniversal` adicionados em `transitions.ts`. Comportamento legado preservado. Wiring em `ai-support-chat` e ativação por flag pendentes — entram na próxima janela quando o Resolver for usado em runtime.
- **Ondas 3 a 7:** pendentes, na ordem do plano.

## Checklist de conformidade
- Doc de Regras do Sistema lido ✓
- Docs formais lidos: `mapa-fontes-ia.md`, `motor-contexto-comercial.md`, `visao-ia-produto.md`, `modo-vendas-whatsapp.md`, `pipeline-f2-vendas-ia.md`, `turn-orchestrator.md`, `ia-atendimento-changelog.md` ✓
- Fluxo afetado: IA de Atendimento (modo vendas e informativo) + agentes auxiliares (criativos, landing, content)
- Fonte de verdade: Configurações da IA + Catálogo do tenant (sem fontes novas)
- Módulos impactados: pipeline de vendas inteira, agente de atendimento, agentes auxiliares de marketing
- UI impactada: nenhuma
- Situação: Ondas 1 e 2 (parte aditiva) aplicadas e validadas com testes próprios. Próximo passo: ligar o Resolver dentro de `ai-support-chat` atrás de flag e seguir para Onda 3.

