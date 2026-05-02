
# Plano de Correção — Auditoria IA Atendimento Respeite o Homem (rodada pós-leitura dos docs oficiais)

📋 CHECKLIST DE CONFORMIDADE
- ✅ Doc de Regras do Sistema lido (governance/working-rules, ia-atendimento-changelog-mandatory)
- ✅ Doc formal do tema lido (`ia-atendimento-changelog.md`, `modo-vendas-whatsapp.md`, `crm-atendimento.md` §4)
- ✅ Fluxo afetado: IA de atendimento (modos informativo + vendas) sobre WhatsApp e Chat
- ✅ Fonte de verdade: `crm-atendimento.md` §4 (guardrails, allowlist, scrubbers) + `modo-vendas-whatsapp.md` §3/§5 (tools, handoff terminal/idempotente) + changelog Reg #1–#9
- ✅ Módulos impactados: ai-support-chat, output-gates, sales-pipeline, support_tickets, conversations
- ✅ Impacto cruzado: CRM/atendimento (filas, SLA), pós-venda (consulta de pedido), notificações
- 🟡 UI impactada: painel de fila de handoffs com SLA — `mapa-ui.md` precisa atualização se Onda 12 prosseguir
- Situação: **Aguardando confirmação do usuário** — proposta com ações de escrita

---

## Diagnóstico ancorado nos docs

A spec já proíbe quase tudo que a auditoria flagrou. O problema não é "spec faltando", é **defesa furada ou desligada**:

| Falha observada | Spec/Defesa que deveria ter pego | Por que vazou |
|---|---|---|
| "Anexei o PDF ao pedido" (Antônio) | `crm-atendimento.md` §4.4 regra 1 + §4.6.3 scrubber `unsupported_action_promised` (Reg #1.1) | Regex do scrubber só pega `reenviei/cancelei/acionei/atualizei seu cadastro`. **Não cobre** `anexei/encaminhei pro suporte/solicitei reset/te aviso quando`. |
| "Reenviei o reset de senha pra X" (Romero) | mesma defesa acima | tool `request_password_reset` não existe E o scrubber não cobre o verbo. Dupla falha. |
| "Encaminhei pro suporte com seu email" (Romero) | mesma | idem |
| "Te aviso quando voltar ao estoque/quando postar" (9 conversas) | spec §4.4 regra 4: "NUNCA PROMETA PRAZOS OU RESULTADOS que não pode garantir" | Sem scrubber para verbos no futuro sem job real. |
| Handoff disparado, IA continua respondendo (Moacir, Joel, Anthero, Gilson, etc.) | `modo-vendas-whatsapp.md` §5.3 + `crm-atendimento.md` §4.2 "Handoff é terminal" | Não há lock real: `conversations.status='waiting_agent'` é setado, mas a IA não verifica isso ANTES de responder. Idempotência de ticket existe (Reg #2 mem), mas a fala continua. |
| Pergunta de pós-venda tratada como discovery (Edilson) | TPR (Reg #2.8) + pipeline F2 deveria detectar `order_status` | TPR não tem intent `post_sale_inquiry` separado. Cai em `other` → discovery genérica. |
| Saudação genérica reseta contexto a cada "Oi" (Geraldo, Antônio) | greeting-mirror (Reg #5) | Greeting mirror dispara em qualquer "Oi" mesmo no meio de thread ativa há minutos. Falta gate "no-restart-mid-thread". |
| Lookup de cliente recorrente falha (William, Handy) | tool `lookup_customer` | Provavelmente match estrito por email com case/format mismatch. Sem fallback por phone normalizado. |
| Mídia recebida → "analisando" → silêncio (Anthero, Geraldo, Handy, Gilson, William) | spec não cobre fluxo de mídia em modo informativo | Lacuna real: o "analisando" é placeholder, não há tool de visão ligada. |
| Loop "Você procura específico ou opções?" (Geraldo 3x, Anthero 3x) | anti-repetição por hash de prefixo (Reg #1.4) | Hash não pega família semântica (já marcado ⚠️ Parcial no Mapa de qualidade). |

**Causa-raiz unificadora:** spec sólida, scrubber existente subdimensionado, ausência de lock terminal de handoff e ausência de detecção de intenção pós-venda. Todas correções de pipeline server-side, não de prompt.

---

## Correções propostas — alinhadas ao Mapa de qualidade

Cada correção referencia o Mapa de qualidade do changelog (linhas 38–58) e atualiza o status correspondente.

### Reg #11 — Fundo de hallucination de ação (prioridade máxima)

**Alvo:** linha 40 do mapa ("Não inventar ação executada"), hoje ✅ Coberto na realidade está vazando.

1. **Ampliar `unsupported_action_promised`** (`ai-support-chat/index.ts` FIX-D + `output-gates.ts`):
   - Adicionar verbos: `anexei|anexar|incluí no pedido|solicitei o reset|enviei o link de redefinição|encaminhei pro suporte|encaminhei por email|abri um chamado por email|te aviso quando|vou te avisar|vou avisar|fico no aguardo|aguardo o sistema|reenviei o link|notifico você quando`.
   - Padrões no futuro sem job real: `quando voltar ao estoque|quando for postado|quando o e?mail chegar|quando sair do faturamento`.
   - Quando dispara: substituir trecho prometido por "vou registrar essa solicitação com a equipe" + forçar `request_human_handoff` se ainda não foi chamado.

2. **Whitelist de ações que PODEM ser afirmadas** (positiva, não negativa):
   - Ações executadas só podem ser afirmadas se houver tool call com `success=true` no mesmo turno. Catálogo fechado: `add_to_cart`, `apply_coupon`, `generate_checkout_link`, `send_product_image`, `request_human_handoff`, `save_customer_data`, `update_customer_record`.
   - Qualquer outro verbo de ação no texto sem tool correspondente → bloqueio.

3. **Mapa de qualidade:** rebaixar linha 40 para ⚠️ Parcial, depois ✅ após gate ampliado.

### Reg #12 — Handoff terminal real (lock server-side)

**Alvo:** spec `modo-vendas-whatsapp.md` §5.3 e `crm-atendimento.md` §4.2 ("terminal"). Hoje não é terminal de fato.

1. **Lock de IA quando há ticket aberto sem assignment** (`ai-support-chat/index.ts` antes do STEP do modelo):
   - Se `conversations.status='waiting_agent'` E existe `support_tickets` aberto vinculado E `assigned_to IS NULL` há mais de X minutos → IA não responde, ou responde uma única mensagem padrão por janela de 4h: "Sua solicitação está na fila com a equipe. Responderemos por aqui assim que possível."
   - Idempotência: rate-limit por conversa (1 mensagem desse tipo a cada 4h, não a cada inbound).

2. **Auto-escalonamento quando handoff "envelhece":**
   - Cron a cada 30min: tickets com `created_at < NOW()-INTERVAL '2h'` E `assigned_to IS NULL` → marca `priority='urgent'` e dispara notificação interna (email para owner do tenant + badge no painel).

3. **Painel de fila de handoffs com SLA visível** (Layer 3 — UI):
   - Tela `/support-center` aba "Fila de Handoffs": tickets ordenados por idade, badge vermelho quando >2h sem assignment.
   - Atualizar `docs/especificacoes/transversais/mapa-ui.md`.

4. **Mapa de qualidade:** nova linha "Handoff é terminal e silencia IA até atendimento humano" → ✅ Reg #12.

### Reg #13 — Detecção de pós-venda e lookup automático de pedido

**Alvo:** sintoma A2/A3/A4. Hoje TPR não distingue pós-venda; lookup falha por mismatch.

1. **TPR ganha intents adicionais** (`turn-pre-router.ts`):
   - `post_sale_status` (cliente pergunta sobre pedido pago/rastreio/entrega/NFe)
   - `post_sale_complaint` (já existe parcialmente como `complaint`)
   - Quando TPR retorna `post_sale_*`, pula discovery e força tool de lookup de pedido.

2. **Tool nova `lookup_order_by_conversation_context`** (modo informativo + modo vendas):
   - Input: `tenant_id` + `conversation_id` (interno, não exposto).
   - Resolução em cascata: customer_id da conversa → telefone normalizado E.164 → email lowercased trim → CPF se já coletado.
   - Retorna últimos 3 pedidos com `id`, `status`, `tracking_code`, `created_at`, `total`.
   - Adicionar à allowlist em `crm-atendimento.md` §4.2 (ambos os modos — é leitura escopada do próprio cliente).

3. **Fallback no `lookup_customer`:** normalizar email/phone antes do match (lowercase, trim, regex E.164). Hoje match estrito gerou "não achei" para William.

4. **Mapa de qualidade:** nova linha "Pós-venda detectada e pedido consultado automaticamente" → ✅ Reg #13.

### Reg #14 — Greeting não reseta contexto ativo

**Alvo:** linha 46 do mapa (greeting mirror) — hoje ✅ mas reseta thread.

1. **Gate `noGreetingRestartMidThread`** (`output-gates.ts`):
   - Se já houve mensagem do bot ou cliente nas últimas 30 min nesta conversa, e o turno atual seria saudação genérica ("Como posso ajudar hoje? Me conta o que você está procurando."), trocar por mensagem curta de continuação: "Oi de novo, [Nome]. Em que posso continuar te ajudando?" — sem reset de discovery.
   - Não bloqueia o greeting-mirror em si (período do dia continua espelhado), bloqueia apenas o "Me conta o que você está procurando" no meio de thread.

2. **Mapa de qualidade:** linha 46 vira ✅ + nova linha "Saudação não reseta contexto de thread ativa" → ✅ Reg #14.

### Reg #15 — Mídia recebida tem resposta determinística

**Alvo:** sintoma D3 — placeholder "analisando" sem follow-up.

1. **Modo informativo:** quando inbound é mídia (image/audio/document) sem visão habilitada, IA responde uma única vez: "Recebi sua mídia. Pra eu entender melhor, me descreve em texto o que você precisa que eu olhe?" — sem prometer análise.
2. **Modo vendas:** se já existe foto de produto candidato no histórico recente do cliente (cliente fez foto do produto que tem em mãos), tentar `search_products` por palavras já mencionadas; senão cair no mesmo padrão informativo.
3. Remover frase atual "só um instante enquanto eu analiso e já te respondo" (promessa que não cumpre).

4. **Mapa de qualidade:** nova linha "Mídia recebida tem resposta determinística (sem 'analisando…' órfão)" → ✅ Reg #15.

### Reg #16 — Loop semântico ("Você procura específico ou opções?")

**Alvo:** linha 43 do mapa (anti-repetição), hoje ⚠️ Parcial — pendente desde Reg #2.

1. **Hash semântico por intenção**, não só prefixo:
   - Se a IA já fez pergunta de qualificação aberta nos últimos 2 turnos do mesmo bot, próximo turno NÃO pode repetir a mesma classe ("escolha aberta entre específico/opções"). Forçar variação ou progressão para `recommendation`/`product_detail`.
2. Aproveita o contador `discovery_questions_asked` (já existe — `modo-vendas-whatsapp.md` §5.4): quando >= 2 sem progresso, pula para handoff técnico ou recommendation com top-3 da KB.

3. **Mapa de qualidade:** linha 43 vira ✅ Reg #16.

---

## Ondas e ordem de entrega proposta

| Onda | Conteúdo | Estimativa de risco | Documentação |
|---|---|---|---|
| 11 | Reg #11 (hallucination) — só ampliar regex + whitelist | Baixo (defesa, não muda fluxo) | Reg #11 no changelog + 1 memória anti-regressão |
| 12 | Reg #12 (handoff terminal) — lock + cron + UI fila | Médio (toca UI e cron) | Reg #12 + atualização `mapa-ui.md` + spec `crm-atendimento.md` §5 |
| 13 | Reg #13 (pós-venda + tool nova) — toca allowlist | Médio (nova tool, allowlist em 2 modos) | Reg #13 + atualização `modo-vendas-whatsapp.md` §3 e `crm-atendimento.md` §4.2 |
| 14 | Reg #14 (greeting no-restart) | Baixo | Reg #14 + memória |
| 15 | Reg #15 (mídia) | Baixo | Reg #15 |
| 16 | Reg #16 (loop semântico) | Médio | Reg #16 |

Cada onda: implementação → validação técnica (consulta DB + curl edge function + leitura de logs) → registro no changelog → memória anti-regressão indexada → atualização do Mapa de qualidade.

---

## Validação técnica obrigatória por onda

- Onda 11: replay determinístico das 3 conversas-âncora (Antônio anexar PDF, Romero reset senha, Geraldo "te aviso") via `curl_edge_functions` com fixtures, conferir que gate dispara e texto final não contém promessa.
- Onda 12: SQL confirma `support_tickets` com `assigned_to IS NULL` E `created_at > 2h` recebem `priority='urgent'`. Tentar enviar inbound em conversa já em handoff — IA não responde além da mensagem rate-limited.
- Onda 13: chamar nova tool com phone do William e do Antônio — retornar pedidos. Testar match de email com case diferente.
- Onda 14: simular "Oi" em conversa com última mensagem há 5min — IA não emite "Me conta o que está procurando".
- Onda 15: inbound de imagem sem caption — resposta única, sem follow-up vazio.
- Onda 16: simular "ajuda" + "ajuda" — segundo turno não repete "específico ou opções".

---

📌 STATUS DA ENTREGA: Proposta — aguardando confirmação para iniciar pela Onda 11.

📝 DOCUMENTAÇÃO NECESSÁRIA:
- `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — Registros #11 a #16 + atualização do Mapa de qualidade (linhas 40, 43, 46 + 5 novas linhas).
- `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` §3 — adicionar `lookup_order_by_conversation_context` à tabela de tools.
- `docs/especificacoes/crm/crm-atendimento.md` §4.2 — adicionar a mesma tool à allowlist informativa+vendas; §5 — formalizar lock terminal de handoff.
- `docs/especificacoes/transversais/mapa-ui.md` — nova aba "Fila de Handoffs" em `/support-center` (Onda 12).
- Memórias anti-regressão a indexar em `mem://index.md`:
  - `mem://constraints/ai-no-fake-action-extended-vocabulary` (Onda 11)
  - `mem://constraints/handoff-must-silence-ai-until-human-assigns` (Onda 12)
  - `mem://constraints/post-sale-intent-must-trigger-order-lookup` (Onda 13)
  - `mem://constraints/greeting-must-not-restart-mid-thread` (Onda 14)
  - `mem://constraints/media-inbound-must-have-deterministic-reply` (Onda 15)
  - `mem://constraints/anti-repetition-must-use-semantic-class-not-just-prefix` (Onda 16)

Confirma que sigo pela Onda 11 (hallucination)?
