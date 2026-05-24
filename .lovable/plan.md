# Plano de correção (revisado) — pipeline da IA pós-Frentes B–E

## 📋 CHECKLIST DE CONFORMIDADE
- ✅ Doc de Regras do Sistema lido (governança de pipeline e anti-regressão).
- ✅ Docs formais relidos: changelog da IA (Reg #2.17, #32–#39), bateria de regressão congelada, doc temporário das ondas (Baseline pós-Frentes B–E + P-EXEC-1 a P-EXEC-7), pipeline F2, modo vendas WhatsApp.
- ✅ Fluxo afetado: WhatsApp Modo Vendas — pipeline da IA (anchor, reflexos, catálogo, fallback de resposta vazia, ficha institucional).
- ✅ Fonte de verdade: configuração da IA por tenant, intent classifier, snapshot do turno consolidado, family_focus persistido, Catalog Probe.
- ✅ Módulos impactados: pipeline de vendas (anchor, transitions, catalog-probe, deterministic-reflexes, ai-support-chat), tela admin de Configurações da IA, observabilidade.
- ✅ Impacto cruzado mapeado: anchor × decideNextState × Catalog Probe × Onda 18 Fase A × intent classifier × fallback hardcoded.
- ⚠️ UI impactada: tela de Ficha Institucional precisa entrar no mapa de UI.
- 📌 STATUS DA ENTREGA: Diagnóstico → Proposta (este plano).

---

## Por que o plano anterior não era suficiente

Reli a seção "Baseline pós-Frentes B–E" do doc temporário e a conclusão é mais dura do que eu tinha lido na primeira passagem:

> "A muleta de discovery venceu a Âncora do Turno **sempre que havia família declarada sem dor, produto fora do catálogo com tradução possível ou dor declarada**. Plug imediato: a Âncora precisa virar **override de estado**, não bloco de prompt — quando houver dor declarada ou família em foco, o roteador tem que pular discovery e ir direto a recommendation/catalog."

Ou seja: **a muleta não vence só quando o modelo retorna vazio (P-EXEC-4/5). Vence porque o próprio modelo, com pipeline em `discovery`, produz a muleta como resposta legítima do estado.** Corrigir só o fallback de resposta vazia (como meu plano anterior) resolve "vlw / kkkk / alô?" mas **não resolve B3.1, B4.1, B5.1 nem B6.3-T1**, que foram as regressões mais graves do baseline.

A correção tem que mexer no roteador de estado, não só no prompt.

## Como funciona hoje (causas raiz)

- **C1 — A âncora do turno é só prompt, não decisão de estado.** Quando o cliente declara dor ("queda"), pergunta direto por família ("vocês têm shampoo?", "qual o kit mais completo?") ou cita produto fora do catálogo com tradução possível ("tem minoxidil?"), o roteador mantém o estado em `discovery`. O prompt da âncora pede pra ir pra recomendação, mas o estado oficial puxa pra muleta. O modelo segue o estado, não a âncora.
- **C2 — Catalog Probe não tem caminho direto para perguntas de família/kit sem família em foco.** Onda 18 Fase A protege de inflar kit antes de mostrar base, mas paralisa quando o cliente pergunta direto por kit.
- **C3 — Não existe tabela determinística de sinônimos / produtos fora do catálogo.** "Minoxidil → Calvície Zero" depende do prompt entender. O baseline mostrou que não entende.
- **C4 — Hesitação curta ("depois eu vejo", "preciso pensar", "vou ver") não é reflexo.** Cai em discovery e vira muleta.
- **C5 — Fallback de resposta vazia é cego ao reflexo.** Quando o modelo devolve vazio em turnos terminais (vlw / kkkk / alô?), a muleta de discovery sobrepõe o reflexo já disparado.
- **C6 — Ficha institucional sem tela admin.** Lojista depende de ajuste manual no banco.
- **C7 — Logs de reflexo e de override de âncora sem tag única.** Auditoria é manual.

## O que eu faria — 7 frentes na ordem de impacto

### Frente 1 — Âncora vira override de estado (a frente que mais destrava)
A âncora deixa de ser apenas um bloco de prompt. Vira decisão dura de roteamento, executada antes de `decideNextState`:

- Cliente declarou dor mapeada para alguma família do tenant → estado vai direto para `recommendation`, com Catalog Probe pré-carregando os 1–3 produtos da família.
- Cliente perguntou direto por família ("tem shampoo?", "tem balm?", "qual o kit mais completo?") → estado vai para `recommendation` com listagem da família/kits.
- Cliente já tem família em foco persistida e pergunta consultiva sobre catálogo → estado mantém recomendação, nunca volta para discovery.

A muleta de discovery deixa de ser caminho legítimo nesses três casos. Destrava B3.1, B4.1, B6.3-T1 e B6.2.

### Frente 2 — Catalog Probe responde direto a "kit", "shampoo", "balm" sem família em foco
Quando o cliente pergunta direto por uma família ou pelo "kit mais completo" e ainda não há família em foco, o probe lista até 3 itens da família ou ranqueia kits por completude e devolve para escolha. A regra "base antes de kit" (Onda 18 Fase A) continua valendo dentro de cada família, mas não bloqueia mais a pergunta direta. Combinada com a Frente 1, fecha B4.1 com sobra.

### Frente 3 — Tabela determinística de sinônimos e produtos fora do catálogo
Cada tenant ganha uma lista de termos do mercado que ele NÃO vende mas têm tradução para o que ele vende ("minoxidil → Calvície Zero", "perfume → não trabalhamos"). É consultada antes do roteador decidir o estado. Match positivo dispara resposta deterministicamente: declara que não trabalha com o termo + traduz para o produto certo + oferece. Fecha B5.1 sem depender de prompt.

### Frente 4 — Reflexo de hesitação
Adicionar reflexo terminal `hesitation` (peso 20, mesma família dos `thanks_terminal` e `social_noise`) cobrindo "depois eu vejo", "preciso pensar", "vou ver", "amanhã eu volto". Resposta é acolhimento curto + porta aberta, sem pergunta nova. Fecha B6.3-T2.

### Frente 5 — Fallback de resposta vazia ciente do reflexo
Quando o modelo retorna vazio e algum reflexo disparou no turno, a frase final é montada a partir do reflexo, não do estado da pipeline. Tabela dedicada para os 8 reflexos existentes. Só se nenhum reflexo disparou é que o fallback por estado entra. Fecha "vlw / kkkk / alô?" mesmo quando o modelo devolve vazio.

### Frente 6 — Tela admin da Ficha Institucional
Nova tela em Configurações > IA > Ficha Institucional, com os 9 campos atuais (cobertura, horário, pagamento, cupom, garantia, prova social, loja física, atendimento humano, observações). Texto de ajuda explicando que campo vazio faz a IA oferecer humano em vez de inventar. Mapa de UI atualizado.

### Frente 7 — Observabilidade dos reflexos e do override
Padronizar três tags únicas no log a cada turno: `[REFLEX-FIRED]`, `[ANCHOR-OVERRIDE]` e `[FALLBACK-EMPTY-RESPONSE]`, cada uma com os campos mínimos para auditar (reflexo, estado anterior, estado novo, motivo). Sem isso, a próxima rodada de bateria continua sem evidência.

## Como cada frente cobre cada problema da bateria

| Cenário ❌ atual | Frente que destrava | Reforço |
|---|---|---|
| B3.1 "vocês têm shampoo?" | F1 (anchor → recommendation) | F2 (probe direto) |
| B4.1 "qual o kit mais completo?" | F1 + F2 | — |
| B5.1 "tem minoxidil?" | F3 (sinônimos) | F1 |
| B6.3-T1 "queda" | F1 (dor → recommendation) | — |
| B6.3-T2 "depois eu vejo" | F4 (reflexo de hesitação) | — |
| "vlw obrigado" / "kkkk" / "alô?" | F5 (fallback ciente do reflexo) | F7 (logs) |

## Resultado final esperado

- 7+ cenários ❌ atuais voltam para verde na bateria (todas as regressões do Baseline pós-Frentes B–E).
- A muleta de discovery deixa de ser caminho legítimo quando há dor, família em foco ou pergunta direta.
- Tradução determinística de termos fora do catálogo é fonte de verdade — não depende mais do modelo entender.
- Hesitação curta vira reflexo, não muleta.
- Lojista mantém Ficha Institucional pela UI.
- Logs estruturados permitem auditar cada turno sem ler código.
- Frente F (próxima onda da base universal) liberada para abrir.

## Ordem de execução e validação

A cada frente, rodar a bateria fixa de 19 cenários antes de seguir. Se algum cenário ✅ regredir, abortar a frente.

1. F1 → confirma B3.1, B4.1, B6.3-T1 e B6.2 verdes.
2. F2 → reconfirma B4.1; confirma vitrine de kits direta.
3. F3 → confirma B5.1 verde.
4. F4 → confirma B6.3-T2 verde.
5. F5 → confirma vlw / kkkk / alô? verdes mesmo com modelo vazio.
6. F6 → smoke test salvando 9 campos pela UI e batendo nas 5 perguntas institucionais.
7. F7 → 1 conversa controlada, conferir as 3 tags no log.
8. Registro consolidado no histórico oficial da IA + atualização do mapa de UI + atualização das memórias.

## Anti-regressão

- Bateria fixa rodada antes e depois de cada frente.
- Memória nova: âncora vira override de estado (dor / pergunta de família / família em foco bloqueiam discovery).
- Memória nova: tabela determinística de sinônimos por tenant é fonte de verdade para "fora do catálogo".
- Memória nova: hesitação curta é reflexo terminal.
- Memória nova: fallback de resposta vazia obriga consultar `firedReflexId`.
- Memória existente atualizada: Onda 18 Fase A continua valendo, mas só dentro de cada família — não bloqueia pergunta direta.
- Mapa de UI atualizado.
- Registro novo no changelog da IA de atendimento.

---

## Bloco técnico (opcional)

- **F1:** introduzir `anchor-state-override.ts` consumido em `ai-support-chat/index.ts` antes de `decideNextState`. Inputs: `painSignal`, `family_focus`, `intentBucket`, `mentions_family`, `catalog_question`. Output: `forcedState: "recommendation" | null` + `prefetchSpec`. Quando `forcedState` é setado, `decideNextState` é ignorado e o snapshot do turno já entra com Catalog Probe disparado.
- **F2:** ajustar `_shared/sales-pipeline/catalog-probe.ts`. Aceitar `directKitQuestion=true` e `directFamilyQuestion=true` como bypass do `enforceFamilyBaseFirst` agregado. Manter base-antes-de-kit dentro de cada família individual.
- **F3:** nova tabela `tenant_ai_synonyms` (term, kind: `out_of_catalog_with_translation` | `out_of_catalog_pure_negation`, target_product_id?, target_family?, response_template). Consulta determinística antes do roteador. Tela admin pode entrar junto da Ficha (F6) ou em ciclo seguinte.
- **F4:** estender `deterministic-reflexes.ts` com reflexo `hesitation` (peso 20). Padrões: `\b(depois eu vejo|preciso pensar|vou ver|amanhã eu volto|deixa eu ver)\b`. Output curto + porta aberta.
- **F5:** estender bloco de fallback em `ai-support-chat/index.ts` (linhas 7368–7522) com tabela `FALLBACK_BY_REFLEX[reflexId]` consultada antes de `FALLBACK_PROMISE_BY_STATE`.
- **F6:** rota nova em `src/pages/Settings.tsx` (aba IA) → `InstitutionalSheetForm` consumindo `ai_support_config.metadata.institutional_sheet`.
- **F7:** padronizar `[REFLEX-FIRED reflexId=… newState=…]`, `[ANCHOR-OVERRIDE forcedState=… reason=…]`, `[FALLBACK-EMPTY-RESPONSE source=… reflexId=…]`.

## 📝 DOCUMENTAÇÃO NECESSÁRIA
- Registro novo no histórico oficial da IA de atendimento (Reg #40).
- Mapa de UI: rota da Ficha Institucional + (eventualmente) rota dos sinônimos do tenant.
- Memórias novas: âncora-override, sinônimos determinísticos, reflexo de hesitação, fallback × reflexId.
- Memória atualizada: Onda 18 Fase A escopo restrito a "dentro da família".
- Documento temporário das ondas: arquivar resultado da bateria pós-correção.

## Confirmação de solidez

Comparado ao plano anterior, este passa a:
1. Atacar a causa raiz declarada pelo próprio doc temporário (âncora como override de estado), não só o sintoma da resposta vazia.
2. Cobrir explicitamente B5.1 (que o plano anterior deixava de fora).
3. Cobrir B6.3-T2 (hesitação) que o plano anterior não nominava.
4. Manter Onda 18 Fase A funcionando, mas com escopo correto (dentro da família).
5. Usar a observabilidade como pré-requisito para validação, não como entregável final.

Aguardando "ok" para iniciar pela **Frente 1 (anchor vira override de estado)** — é a que destrava o maior número de cenários, e as Frentes 2–4 dependem dela para funcionar bem.