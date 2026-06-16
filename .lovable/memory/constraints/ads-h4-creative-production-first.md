---
name: Ads H.4 Creative Production-First
description: Geração de criativos só roda com creative_readiness=ready. Nenhum creative_job sem gate aprovado, custo calculável e claims/promessa/categoria declaradas.
type: constraint
---

Onda H.4.0 (Production-First). Aprovação estrutural (H.3) NÃO autoriza geração de criativos.

## Regras invioláveis

1. Nenhum `creative_job` pode ser inserido sem `creative_readiness.status === "ready"` calculado pelo motor puro em `supabase/functions/_shared/ads-autopilot/creativeReadinessGate.ts` (contract_version `h4_readiness_v1`).
2. `creative_jobs` disparam IA/processamento real. São proibidos sem confirmação final explícita do lojista no diálogo de geração.
3. Custo precisa ser calculável via `service_pricing` ativo. "Custo a apurar" é proibido — se a tabela não cobrir o formato, bloquear.
4. Briefing completo é obrigatório: produto/oferta com descrição + diferenciais + categoria regulatória.
5. Claims e promessa: fonte de verdade dedicada em `tenant_brand_context` (`allowed_claims`, `approved_main_promise`, `banned_claims`, `do_not_do`). IA não pode inventar nem inferir.
6. Identidade visual mínima: logo + paleta + **imagem principal válida do produto/kit usado na campanha**. Packshot da marca sozinho NÃO satisfaz — a imagem precisa estar relacionada ao produto/kit/oferta. UI deve usar a expressão "imagem principal do produto" (nunca "packshot").
7. Categorias sensíveis (`cosmetic_hair`, `supplement`): exigem `commercial_restrictions` ou `no_additional_restrictions_confirmed=true` no produto.
8. H.4.1 NÃO publica nem fala com Meta. Apenas insere `creative_jobs` controlados e mostra criativos para revisão.
9. Diálogo de geração precisa ser final, não provisório. Só aparece com status=ready. Sempre mostra custo numérico + frases "Isso iniciará processamento de IA" e "Nada será enviado ao Meta".
10. Regeneração individual é H.4.2: tem confirmação própria, custo próprio, limite de 3 por criativo, idempotência. Botão fake é proibido.
11. Estados oficiais do funil: estrutura aprovada–configurações pendentes / pronta para gerar / gerando / criativos prontos para revisão / publicação bloqueada / pronta para publicação.
12. Card de bloqueios na UI: mostrar os **3 primeiros** bloqueadores; quando houver mais de 3, exibir botão "Ver todos". Nunca listar tudo de uma vez.
13. Linguagem da UI: "imagem principal do produto" (não "packshot"), "promessas permitidas/proibidas" (não "claims" quando possível), "regras comerciais e de anúncios" (não "compliance"). Termos técnicos só no código/contrato interno.
14. Configurações Meta básicas (Página do Facebook, Pixel, evento de conversão, janela de atribuição, UTM, conexão/conta válida) são **bloqueadores**, nunca apenas avisos. Sem qualquer um deles, status = "Estrutura aprovada — configurações pendentes" e botão "Gerar criativos" não aparece.
15. Mudanças visíveis na seção de propostas aprovadas (botão de gerar, diálogo, card de bloqueio) precisam de aprovação explícita do usuário antes de virar código.

## Anti-regressão

- Qualquer endpoint futuro que crie creative_jobs DEVE chamar `evaluateCreativeReadiness` no servidor antes de inserir. UI nunca decide prontidão.
- Idempotência por `(proposal_id, planned_creative_index)` para impedir duplo clique gerar custo dobrado.
- Lifecycle de proposta só avança via gatilho de banco quando todos os jobs da proposta terminam.
