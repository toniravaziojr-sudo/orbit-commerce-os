---
name: Ads — Ajuste de proposta sempre gera nova versão
description: Modo "revision" do Estrategista de Tráfego deve obrigatoriamente devolver nova versão da proposta. tool_choice=required no round 1 + retentativa interna + aprendizado síncrono. Banner de progresso anti-flicker rastreia sessões já exibidas.
type: constraint
---

Quando o usuário clica em "Ajustar proposta" no Gestor de Tráfego, a IA é obrigada a devolver uma nova versão considerando integralmente o feedback. Não existe o caso "a IA não conseguiu gerar".

Mecanismos obrigatórios (todos devem coexistir):

1. **`tool_choice = required` no trigger `revision` (round 1)** do `ads-autopilot-strategist`. Reverter para `auto` reabre o bug.
2. **Retentativa interna automática** no `ads-autopilot-request-adjustment`: se a 1ª passagem não devolver nova proposta filha após o watermark, fazer 2ª chamada imediata com instrução reforçada anexada ao feedback do usuário.
3. **Gravação síncrona do aprendizado**: `ads-autopilot-feedback-record` deve `await` o `ads-ai-learnings-write`. Fire-and-forget é proibido (worker do Edge mata a invoke antes de gravar). Se a invoke falhar ou vier sem confirmação, o próprio feedback-record deve criar/reforçar o aprendizado diretamente antes de responder.
4. **Espelho de aprovação canônico na nova versão**: se a nova proposta estratégica tem contrato válido, zero blocker e zero `pending_dependency`, então `status`, `approval_status`, `metadata.validation_status` e `metadata.is_approvable` precisam ficar coerentes. É proibido contrato válido + UI com tarja residual "Plano incompleto".
5. **Fallback seguro**: se ambas as tentativas falharem por erro real (timeout/créditos/Meta down), a proposta original volta para `pending_approval` (NÃO fica `superseded` órfão) e o usuário recebe mensagem de negócio em PT-BR.
6. **Banner "IA analisando sua conta" anti-flicker**: `AdsStartupProgress` deve manter `shownSessionsRef: Set<string>` por montagem do componente. Sem isso, o poll de 5s reabre o banner indefinidamente após o término da sessão.

**Por que**: o usuário não pode ficar sem retorno após pedir um ajuste — quebra a confiança no Gestor de Tráfego IA. A sugestão escrita SEMPRE precisa virar aprendizado (mesmo em fallback) para alimentar o ciclo da IA e ficar disponível em "Aprendizado da IA".

**Anti-regressão crítica**: "Ajustar" nunca pode marcar a proposta como `rejected` — só "Recusar" faz isso. Lifecycle correto: original → `superseded` + `<tipo>_needs_adjustment`; nova versão → `pending_approval` com `parent_action_id` + `superseded_by_action_id` cruzados.

Doc oficial: `docs/especificacoes/marketing/gestor-trafego.md` seção "Onda 3.1 (2026-06-17) — Ajuste de proposta sempre gera nova versão".
