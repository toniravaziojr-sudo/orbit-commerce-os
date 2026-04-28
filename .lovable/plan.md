
# Plano REVISADO — Correção do Agente IA Vendas + Cérebro Regenerativo (respeiteohomem)

## Por que este plano mudou após reler os docs

Reli `docs/REGRAS-DO-SISTEMA.md` (Layer 2), `docs/especificacoes/sistema/central-comando.md` (§4 Cérebro Regenerativo v2.0), `docs/especificacoes/crm/crm-atendimento.md` (§3 IA Atendente), `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` (Layer 3) e `docs/especificacoes/whatsapp/pipeline-f2-vendas-ia.md` (F2 — máquina de estados, anti-repetição, family_focus). Quatro ajustes importantes resultaram disso:

1. **Conflito documental Layer 2 ↔ Layer 3 (precisa decisão sua):** o Doc de Regras §9.2 e CRM §3 dizem que a IA Atendente é "**puramente informativa, NUNCA executa ações**". O doc do Modo Vendas (Layer 3) define que ela executa carrinho/checkout. Os dois coexistem hoje porque o sales_mode é toggle por tenant, mas a Layer 2 não reconhece essa exceção. Antes de qualquer ajuste comportamental, vou propor texto de reconciliação no Doc de Regras (a forma definitiva exige sua confirmação).
2. **Cérebro Regenerativo v2.0 já está totalmente especificado** (4 etapas, 4 sub-abas, captura por trigger, injeção via `ai_brain_active_view`). O modelo oficial **não inclui** "prompt do usuário na aprovação". Sua nova solicitação (admin escrever orientação simples ao aprovar) é **ampliação da spec** — mantenho no plano, mas sinalizo como evolução documental v2.1, não conserto.
3. **Pipeline F2 (modo vendas) já documenta** máquina de estados completa (greeting → discovery → recommendation → product_detail → decision → checkout_assist → handoff), anti-repetição estrutural com regeneração obrigatória, family_focus persistente. Vários "ajustes" do plano anterior eram, na verdade, **regressões em relação ao já documentado**. Foco muda para descobrir por que o que está escrito não está acontecendo.
4. **Conflito de nomenclatura encontrado:** o banco grava `sales_state='checkout'` (4 conversas), mas o código `tool-filter.ts` só conhece `checkout_assist`. Quando cai no nome errado, o filtro retorna lista vazia → IA fica sem `generate_checkout_link`. Esta é provavelmente a causa raiz do bug do Luiz. **Achado novo, não estava no plano anterior.**

---

## Diagnóstico final (consolidado)

### A) Comportamento do agente — 9 problemas (5 confirmados como BUG, 4 como divergência da spec)

| # | Problema | Status vs. spec |
|---|---|---|
| 1 | `sales_state='checkout'` no banco vs. `checkout_assist` no código → filtro retorna nada → IA sem tool de checkout | **Drift de schema/código** (Luiz fez tudo certo, IA travou) |
| 2 | Promete handoff e não chama `request_human_handoff` (Mário, Alexandre) | **Bug** — viola §5.3 do modo-vendas (handoff é atômico) |
| 3 | `request_human_handoff` sem idempotência (já gerou 117 tickets antes) | **Lacuna na spec** + bug |
| 4 | Inputs não-textuais (`???`/`!!!`) resetam para greeting | **Lacuna** — F2 não trata input degenerado |
| 5 | Anti-repetição `last_bot_response_hash` falha em variações mínimas | **Bug** — F2 §13 prevê regeneração com hash normalizado, mas hash atual é frágil |
| 6 | IA inventa ações ("reenviei e-mail", "encaminhei pro suporte") | **Viola** Doc de Regras §9.2 e CRM §4 ("nunca invente informações") + F2 §7 anti-padrões |
| 7 | Loop de confirmação eterno na hora de fechar venda (Luiz, 3x sim) | **Bug do nome de estado (#1)** + falta de regra "1 confirmação = chama tool" |
| 8 | Bot diz "não consigo confirmar" sobre produto do catálogo (Fast Upgrade) | **Viola** F2 §7 anti-padrão "inventar produto" no inverso (nega produto real) |
| 9 | 23 conversas em `waiting_agent` invisíveis (`assigned_to=null`) | **Lacuna na UI do Atendimento** — sem fila de não atribuídos |

### B) Pipeline regenerativo — 5 elos quebrados

| Elo (spec) | Real | Diagnóstico |
|---|---|---|
| Captura via trigger `conversations_signal_capture_on_resolve` | **Trigger não existe no banco** (information_schema confirma) | Spec não foi implementada OU foi removida silenciosamente |
| Conversas precisam virar `resolved` para captura disparar | **Apenas 1 conversa em `resolved` em 30 dias** (de ~150 totais) | Falta automação para resolver conversas; agentes não fecham handoffs |
| `tenant_learning_events` (898 eventos em 7d) | Coletado mas **não conectado** ao `ai_signal_capture_queue` | Pipeline paralelo legado que nunca foi descontinuado nem unificado |
| `ai-signal-consolidate` (cron seg 06:00 BRT) gera insights | **0 insights gerados** apesar de 68 grupos canônicos | Threshold restritivo OU bug no consolidador |
| Aprovação humana com prompt do usuário (sua nova ideia) | **Não previsto na spec v2.0** | Ampliação para v2.1 — exige migração + UI + injeção priorizada |

---

## O que vou ajustar

### Eixo 1 — Bugs e regressões do agente de vendas

**1.1 Reconciliação `checkout` vs `checkout_assist`** (causa raiz do Luiz)
Decidir o nome canônico (proposta: `checkout_assist` por ser o que F2 documenta). Migrar 4 conversas do banco. Adicionar guarda no `decideNextState` que rejeite nomes desconhecidos com log.

**1.2 Handoff atômico, terminal e idempotente**
- Após `request_human_handoff` chamado, conversa entra em `waiting_agent` e o orquestrador **encerra o turno** sem mais tools/respostas livres.
- Lock por conversa de 10 min: se já tem ticket aberto, retorna o mesmo `ticket_id`.
- Scrubber pré-envio: se a resposta contiver "vou chamar humano / equipe / atendente / suporte" e a tool não foi chamada no turno → força chamada.

**1.3 Tratamento de input degenerado**
Detectar pré-modelo (regex: <2 alfanuméricos OU só pontuação OU só emoji). Em conversa com >5 mensagens, responde "Não entendi sua última mensagem, pode reescrever?" sem mexer em `sales_state`. 3 ambíguos seguidos → handoff `reason=ambiguous_input`.

**1.4 Anti-repetição de fato**
Trocar hash exato por **prefixo normalizado de 80 chars** (lower + sem pontuação + sem espaços extras). Colisão força regeneração com `tool_choice='none'` e instrução de variação substantiva — exatamente como F2 §13 já manda, mas com hash mais robusto.

**1.5 Proibição reforçada de ações inventadas**
- Lista branca explícita no prompt: "Você só pode AFIRMAR uma ação se chamou a tool correspondente no mesmo turno."
- Scrubber pós-resposta: se contiver verbos `reenviei|encaminhei|acionei|enviei e-mail|aciono o suporte` e nenhuma tool comercial/handoff foi chamada → força handoff `reason=unsupported_action_promised` em vez de mandar a fala.

**1.6 Search obrigatório antes de negar produto**
Se a resposta da IA contiver `não consigo confirmar|não tenho|não conhecemos|não temos esse produto` E `search_products` não foi chamado neste turno com termo similar ao do cliente → força regeneração obrigando chamada à tool antes de negar.

**1.7 Fechar venda quando cliente confirma**
Em `recommendation`/`product_detail`/`decision`, se a última mensagem do cliente contiver sinal de fechamento ("sim/quero/manda/fechado/pode mandar/pode gerar") OU email+CPF+CEP no mesmo turno → orquestrador **bloqueia o envio** se o turno não chamar `add_to_cart` + `generate_checkout_link`. Após 1 confirmação explícita, **proibido pedir nova confirmação** (zero "confirma de novo?").

**1.8 Saúde da máquina de estados**
- Incrementar `discovery_questions_asked` toda pergunta de qualificação (hoje sempre 0 → discovery nunca avança por contagem).
- Bloquear transição para `checkout_assist` sem `cart_id` real associado.

**1.9 Visibilidade do `waiting_agent` no Atendimento**
- Aba/seção "Aguardando atendimento (não atribuído)" no `/support-center` filtrando `status='waiting_agent' AND assigned_to IS NULL`, ordenado por tempo de espera, badge "há Xmin".
- Anexar ao ticket o resumo automático (últimas 6 mensagens + reason + last_intent + carrinho se houver).

---

### Eixo 2 — Cérebro Regenerativo (fechar o ciclo, depois ampliar)

**2.1 Restaurar a captura (FALTA NO BANCO)**
- Criar o trigger `conversations_signal_capture_on_resolve` que a spec §4.5 promete e o banco não tem. Enfileira em `ai_signal_capture_queue` quando `status` muda para `resolved`.
- Cron `ai-signal-capture-batch` já roda diário 7h — vai começar a processar.

**2.2 Garantir que conversas viram `resolved`**
- Hoje só 1 conversa em 30 dias virou `resolved`. Sem isso, cérebro nunca recebe matéria-prima.
- Adicionar regra: ao agente humano fechar ticket de handoff OU passados 7 dias sem nova mensagem em `waiting_customer`, marcar `resolved`. Cron diário.

**2.3 Investigar e destravar `ai-signal-consolidate`**
- Banco tem 72 candidates e 68 canonical_groups, mas **0 insights**. Cron está ativo (seg 06:00 BRT) mas nada sai dele.
- Diagnóstico técnico: ler critério de promoção (provável threshold de evidence_count alto demais ou bug). Disparar manualmente para o tenant para gerar primeiro lote de insights e validar.

**2.4 Descontinuar pipeline paralelo `tenant_learning_memory`**
- Tem 40 itens parados em `pending_review` há semanas, sem UI de aprovação, sem leitura no agente (só em `status='active'` que ninguém consegue gerar).
- Decisão: parar o `ai-learning-aggregator-6h`, manter dados como histórico, descontinuar leitura. Toda aprendizagem flui pelo Cérebro v2.0 oficial.

**2.5 Ampliação v2.1 — Aprovação com diretiva do usuário (sua nova solicitação)**
- Migração: adicionar `user_directive` (text) e `directive_updated_at` (timestamp) em `ai_brain_insights`.
- UI: modal de aprovação ganha campo obrigatório "**Como a IA deve agir nesses casos?**" (placeholder com exemplo, máx 500 chars). Sem texto, botão "Aprovar" desabilitado.
- Aba "Ativos" mostra a diretiva do usuário em destaque, com botões "Editar diretiva" / "Pausar" / "Revogar".
- Histórico: criar `ai_brain_insights_history` com versionamento da diretiva (data, autor, texto antigo, texto novo).
- Injeção priorizada: `getBrainContextForPrompt` formata as diretivas como bloco "**REGRAS DEFINIDAS PELO DONO DO NEGÓCIO (obrigatórias)**" no topo; `recommendation` da IA original vira contexto secundário.
- Métrica: `usage_count++` quando regra é incluída no prompt para mostrar frequência ao admin.

---

### Eixo 3 — Reconciliação documental (Layer 2 vs Layer 3)

Antes de implementar 1 e 2, atualizar `docs/REGRAS-DO-SISTEMA.md` §9.2:

- Esclarecer que a IA Atendente é "informativa por padrão" mas **pode operar em Modo Vendas (toggle por tenant)** quando `ai_support_config.sales_mode_enabled = true`, executando carrinho/checkout dentro das tools auditadas (referenciar Layer 3).
- Adicionar nota: "Modo Vendas ativo NÃO autoriza execução fora do conjunto de tools listado em `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` §3."

Sem essa reconciliação, qualquer correção em 1.1-1.8 fica em conflito com o Layer 2.

---

## Validação técnica obrigatória

Para cada item:
1. Consulta SQL confirmando o efeito (ex: 1.1 → 0 conversas com `sales_state='checkout'` após migração).
2. `curl_edge_function` ao `ai-support-chat` simulando o cenário.
3. Logs do edge function confirmando tool chamada/bloqueada conforme regra.
4. Regressão: rodar 3 conversas saudáveis e confirmar que nada quebrou.

---

## Testes simulados (alinhados ao doc oficial de validação modo-vendas §1-7)

| # | Cenário | Resultado esperado |
|---|---|---|
| A | Cenário 1 do doc oficial — venda completa produto sem variante | `add_to_cart` + `generate_checkout_link` chamados; cart no banco; link clicável |
| B | Cliente confirma compra com email+CPF+CEP | Próxima resposta do bot CONTÉM o link; sem nova pergunta de confirmação |
| C | Cliente cita produto exato do catálogo ("Fast Upgrade") | `search_products` chamado antes de qualquer negativa |
| D | Cliente manda "???" 3x | 1ª/2ª: pede esclarecimento sem resetar estado; 3ª: handoff |
| E | Cliente bravo: "vocês não resolvem nada" | Handoff imediato, conversa em `waiting_agent`, aparece no topo da fila não atribuída |
| F | Cliente pergunta sobre pedido pago | IA NÃO inventa "reenvio"; chama `request_human_handoff` |
| G | Bot tenta repetir resposta com variação cosmética | Hash normalizado pega; força regeneração |
| H | Handoff disparado 3x em 5min | 1 ticket único (idempotência) |
| I | Conversa marcada `resolved` | Trigger enfileira em `ai_signal_capture_queue` |
| J | `ai-signal-consolidate` rodado manualmente após I | Gera ≥1 `ai_brain_insights` em `pending` |
| K | Admin aprova insight com diretiva "ofereça desconto de 10%" | `user_directive` salvo; próxima conversa similar recebe regra no prompt; bot oferece desconto |
| L | Admin edita diretiva | `ai_brain_insights_history` cria nova versão; uso passa a refletir versão nova |

---

## Documentação a atualizar (entrega não fecha sem isso)

| Doc | O que atualizar |
|---|---|
| `docs/REGRAS-DO-SISTEMA.md` §9.2 (Layer 2) | Reconciliar exceção do Modo Vendas vs "puramente informativa" |
| `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` (L3) | Estado canônico `checkout_assist`; regra "1 confirmação = chama tool"; scrubber de ações inventadas; search obrigatório antes de negar; idempotência do handoff |
| `docs/especificacoes/whatsapp/pipeline-f2-vendas-ia.md` (L3) | Atualizar §13 (anti-repetição) para hash de prefixo normalizado; nova seção sobre input degenerado; nome canônico de estado |
| `docs/especificacoes/crm/crm-atendimento.md` (L3) | Aba/fila "Aguardando atendimento (não atribuído)"; resumo no ticket; regra de auto-resolve em 7d |
| `docs/especificacoes/sistema/central-comando.md` §4 | Atualizar v2.0 → v2.1 com `user_directive`, histórico, injeção priorizada |
| `docs/especificacoes/transversais/mapa-ui.md` | Nova aba/fila no Atendimento; campo de diretiva no modal de aprovação |
| `mem://constraints/sales-state-name-canonical-checkout-assist` (novo) | Anti-regressão do drift `checkout` vs `checkout_assist` |
| `mem://constraints/ai-handoff-must-be-atomic-terminal-and-idempotent` (novo) | Anti-regressão handoff |
| `mem://constraints/ai-must-not-promise-unsupported-actions` (novo) | Anti-regressão ações inventadas |
| `mem://constraints/ai-sales-must-close-on-confirmed-intent` (novo) | Anti-regressão do bug do Luiz |
| `mem://constraints/ai-must-search-catalog-before-denying-product` (novo) | Anti-regressão Fast Upgrade |
| `mem://constraints/brain-capture-trigger-must-exist-in-db` (novo) | Anti-regressão do trigger ausente |
| `mem://features/ai/brain-regenerative-v2-1-with-user-directive` (novo) | Pipeline ampliado |
| `mem://features/ai/sales-mode-conversational-commerce` | Atualizar com novas regras |
| `mem://index.md` | Indexar todas |

---

## Ordem de execução proposta (segura)

1. **Reconciliação documental** (Eixo 3) — não toca código, destrava o resto.
2. **Bug do nome de estado** (1.1) — pequeno, alta probabilidade de explicar a "venda perdida do Luiz".
3. **Handoff terminal/idempotente + scrubber de ações inventadas** (1.2 e 1.5) — destrava 5 conversas em loop infinito.
4. **Visibilidade no Atendimento** (1.9) — destrava as 23 conversas presas em `waiting_agent`.
5. **Restantes do agente** (1.3, 1.4, 1.6, 1.7, 1.8).
6. **Cérebro v2.0 fechar o ciclo** (2.1, 2.2, 2.3, 2.4).
7. **Cérebro v2.1 com diretiva do usuário** (2.5) — só após v2.0 estar gerando insight.
8. **Validação técnica + testes simulados + docs**.

Cada etapa só fecha após validação técnica explícita e tem checklist de regressão.

---

**Confirma que sigo com este plano?** Em caso afirmativo, começo pela reconciliação documental e pelo bug do nome de estado (Eixo 3 + 1.1) — são os dois itens de menor risco e maior impacto imediato.
