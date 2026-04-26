---
name: recent-topics
description: Cache rotativo dos 2 últimos assuntos tratados — atual e anterior. Toda regra técnica aqui DEVE existir também nos docs formais.
type: preference
---

# Assuntos Recentes (rotação obrigatória, máx 2)

## Slot 1 — Assunto ATUAL

**Tema:** Bloco D6–D10 — Estabilização do Atendimento e Cérebro de IA (validado e documentado em 2026-04-26)

**Resumo:**
- 5 estabilizações entregues e validadas tecnicamente fim a fim:
  - **D6** — Gate Universal de Canal: `ai-support-chat` consulta `channel_accounts.is_active` antes de qualquer LLM.
  - **D7** — Pipeline de Mídia: 4 mecanismos obrigatórios (`pending_media_processing`, `media_wait_reply_sent`, reprocesso único, `consumed_at`). Validado pelo harness `d7-media-harness` nos 6 pontos.
  - **D8** — Cérebro Regenerativo: insights aprovados em `ai_brain_active_view` injetados nos 4 agentes (`vendas`, `auxiliar`, `landing`, `trafego`) via `_shared/brain-context.ts`. Validado pelo harness `d8-brain-harness` (injeção positiva + isolamento por escopo).
  - **D9** — Status WhatsApp: decisão usa `link_status` + `operational_status`, nunca só `connection_status`.
  - **D10** — Auditoria de Recepção: cross-check obrigatório entre `whatsapp_audit`, `conversations` e `messages`.
- 2 Edge Functions de auditoria criadas: `d7-media-harness` e `d8-brain-harness` — não devem ser removidas sem substituto equivalente.

**Docs formais relacionados:**
- `docs/especificacoes/crm/crm-atendimento.md` §14.1, §14.1.6, §17.1 (D7)
- `docs/especificacoes/sistema/central-comando.md` §4 (D8 — já existia, mantido)
- `docs/especificacoes/sistema/edge-functions.md` — nova seção "Edge Functions de Auditoria e Harness"
- `docs/tecnico/base-de-conhecimento-tecnico.md` §9 — registro completo dos 5 blocos com problema/causa/solução/validação

---

## Slot 2 — Assunto ANTERIOR

**Tema:** Diagnóstico do webhook do WhatsApp Meta — evidências já confirmadas pelo usuário

**Resumo:**
- O usuário já enviou repetidas vezes prints da tela oficial de configuração do webhook no painel de developers da Meta e não deve ser solicitado novamente a reenviar a mesma evidência sem fato novo.
- Evidência visual já confirmada em `developers.facebook.com/.../whatsapp-business/.../wa-settings/`: URL de callback configurada para o webhook, verify token preenchido, campo `messages` assinado/ativado.
- Próximos diagnósticos não devem voltar para a etapa de pedir URL/token/messages por print, a menos que haja mudança declarada pelo usuário.

**Docs formais relacionados:**
- `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` v1.1 (regra de diagnóstico cross-source)
- `mem://constraints/whatsapp-reception-source-of-truth-cross-check`

---

## Regra de rotação

Quando um terceiro assunto entrar em pauta:
1. Auditar Slot 2 contra os docs (atualizar docs se houver lacuna).
2. Descartar Slot 2.
3. Slot 1 vira Slot 2.
4. Novo assunto entra como Slot 1.
