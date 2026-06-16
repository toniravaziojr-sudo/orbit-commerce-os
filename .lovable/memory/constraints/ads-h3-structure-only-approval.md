---
name: Ads H.3 — Aprovação ESTRUTURAL da Proposta de Campanha (structure-only)
description: H.3 aprova somente estrutura. Zero IA, zero Meta, zero creative_jobs, zero publicação. Geração de criativos é um segundo gesto explícito (H.4.1).
type: constraint
---

# Regra (Onda H.3 — 2026-06-16)

Aprovar uma proposta `campaign_proposal_v1_1` significa **aprovar APENAS sua estrutura**. Nada mais.

## O que H.3 FAZ
- `ads_autopilot_actions.status`: `pending_approval` → `approved`.
- `approved_at` carimbado.
- `action_data.lifecycle.status` = **`structure_approved_awaiting_creatives`** (novo, único de H.3).
- `action_data.lifecycle.proposal_approved_at` carimbado.
- `action_data.lifecycle.pending_account_config` = lista das pendências `account_config` (não bloqueantes).
- 1 insight informativo, idempotente por `metadata.idempotency_key = "h3_structure_approved:<action_id>"`.
- Snapshot `campaign` / `adsets` / `planned_creatives` / `campaign_plan` preservado, sem mutação destrutiva.

## O que H.3 NÃO FAZ (proibido)
- **NÃO** insere em `creative_jobs`.
- **NÃO** chama IA (texto, imagem, vídeo).
- **NÃO** chama Meta (nenhuma mutação remota, nenhuma leitura mutável).
- **NÃO** cria campanha/conjunto/anúncio no Meta (rascunho ou ativo).
- **NÃO** sincroniza públicos, catálogo, lookalike.
- **NÃO** publica.
- **NÃO** abre Revisão Final automaticamente.
- **NÃO** avança para H.4 / H.4.1 / H.4.2 / H.5 sem segundo gesto explícito do usuário.

## Idempotência obrigatória
- Re-aprovar uma proposta já em `approved` + lifecycle `structure_approved_awaiting_creatives` retorna sucesso sem efeitos: não duplica insight, não muda `approved_at`, não toca `creative_jobs`.
- Proposta em `rejected` → erro claro (`proposal_already_rejected`); reabertura não é tratada nesta onda.
- Qualquer outro status (≠ `pending_approval`) → erro `proposal_status_not_approvable`.

## Classificação dos bloqueadores (fonte: `objectiveFieldContract.ts` + defesa em profundidade)
- **Bloqueia H.3** (phase = `h2_structural`): nome, objetivo, orçamento (ABO/CBO), conjuntos, anúncios planejados, vínculo anúncio↔conjunto, link de destino quando aplicável, CTA quando aplicável, formato em campanhas não-[Teste], catálogo obrigatório, `contract_validation_status=blocked`, schema diferente de `campaign_proposal_v1_1`.
- **NÃO bloqueia H.3** (phase = `account_config`): página do Facebook, pixel, evento de conversão padrão, janela de atribuição, UTM template, configurações de publicação. Vão para `lifecycle.pending_account_config` e **serão exigidas em H.4.2/H.5**.
- **Fora de H.3** (phase = `h4_future`): título, texto principal, descrição, asset final, preview, prompt visual — são da geração de criativos.
- **Fase desconhecida** → tratada como bloqueio por segurança (`ambiguous`).

## UI
- Botão "Aprovar proposta de campanha" habilitado apenas sem bloqueadores estruturais.
- Confirmação explícita (`window.confirm`) antes de aprovar: "Aprovar a estrutura desta proposta de campanha? Nenhum criativo será gerado e nada será publicado."
- Aviso amarelo quando há `pending_account_config`: "Existem pendências de configuração da conta Meta. Elas não bloqueiam esta aprovação, mas bloquearão a revisão final/publicação."
- Aviso de rodapé sempre que aprovável: "Aprovar estrutura não gera criativos e não publica."
- Seção "Propostas aprovadas em andamento" mostra status `structure_approved_awaiting_creatives` como **informativo** (badge "Estrutura aprovada — aguardando criativos") com botão **desabilitado** "Aguardando próxima etapa". **Sem botão funcional "Gerar criativos" nesta onda.**

## Backend (`ads-autopilot-execute-approved`, ramo `campaign_proposal`)
- Versão `v4.5.0-h3`.
- Usa `classifyH3Approval` (`_shared/ads-autopilot/h3StructureGate.ts`) — função pura.
- Trava H.2 (`H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED`) **removida**.
- O ramo legado que enfileirava `creative_jobs` após aprovar (lifecycle `campaign_creatives_generating` / `h41_v1`) foi **substituído**. Qualquer reintrodução desse comportamento dentro do ramo `campaign_proposal` é proibida — deve viver em uma função/etapa H.4.1 separada acionada por segundo gesto.

## Recusar e Ajustar
- **Recusar**: mantém comportamento existente (status → rejected). Sem motivo obrigatório nesta onda.
- **Ajustar**: fora de H.3. Sem edição manual nesta onda.

## Regressões proibidas
- H.2.4 link de destino, H.2.5 formato ("Imagem única" em [Criação]; variável H.4 em [Teste]), CTA "Comprar agora", separação URL × UTM, contrato `campaign_proposal_v1_1`, falha-fechada para plataformas/objetivos fora do escopo.

## Como avançar para H.4.1 (próxima onda — fora do escopo)
- Próxima onda implementa botão funcional "Gerar criativos" na seção de propostas aprovadas, lendo `structure_approved_awaiting_creatives` e enfileirando `creative_jobs` em endpoint próprio. **NÃO** dentro de `ads-autopilot-execute-approved`.
