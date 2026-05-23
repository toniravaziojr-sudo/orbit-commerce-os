# Plano de correção — pós-Frentes B–E da Base Universal

## 📋 CHECKLIST DE CONFORMIDADE
- ✅ Doc de Regras do Sistema lido (memórias de governança e anti-regressão da pipeline de vendas).
- ✅ Docs formais lidos: documento temporário das ondas, bateria de regressão congelada e changelog da IA de atendimento (registros 2.17, 30, 31, 32, 33, 34, 35).
- ✅ Fluxo afetado: WhatsApp Modo Vendas — orquestração do prompt da IA de atendimento (continuidade, escopo, ficha institucional, âncora do turno).
- ✅ Fonte de verdade: configuração da IA por tenant, memória da conversa de vendas, log de turnos e catálogo do tenant.
- ✅ Módulos impactados: pipeline de vendas (continuidade, escopo, reflexos, prompts) + painel admin da IA.
- ✅ Impacto cruzado mapeado (Frente C × Frente E × Onda 18 Fase A; ficha vazia × Onda 8 institucional; empilhamento de blocos de instrução).
- ⚠️ UI impactada: precisa de tela de edição da ficha institucional — entra no plano.
- 📌 STATUS DA ENTREGA: Diagnóstico → Proposta (este plano).

---

## Como funciona hoje (resumo executivo)

As Frentes B, C, D e E foram aplicadas em sequência, no código, sem rodar uma única vez a bateria de regressão da Rodada 2 em sandbox real. As 4 Frentes empilham instruções no prompt da IA (continuidade, escopo, ficha institucional, âncora) sem ordem clara entre si. Além disso:

1. A **ficha institucional** depende de uma estrutura de dados por tenant que não está populada para ninguém — não existe tela de edição nem semente. Quando o cliente pergunta sobre horário/entrega/cupom/garantia, a IA é instruída a oferecer humano em vez de responder, mesmo quando antes ela já respondia bem.
2. A **Frente C** amplia a vitrine quando o cliente faz pergunta genérica de catálogo, ignorando a família que estava em foco. A **Frente E** injeta no mesmo turno a instrução "mantenha o foco na família X". Resultado: prompt contraditório.
3. A regra ativa só no Respeite o Homem (priorizar base antes de kits) também pode brigar com a Frente C nas perguntas genéricas de catálogo, porque uma manda restringir e a outra manda ampliar.
4. A **continuidade** detecta agradecimento, ruído social ("kkk") e ping de presença ("alô?"), mas só emite instrução de texto — não troca o estado da conversa. O estado segue rodando em paralelo e pode escolher um caminho de venda enquanto a continuidade pede fechamento cordial.
5. A IA recebe hoje cerca de 9 blocos de instrução por turno empilhados. Latência sobe e regras críticas (silêncio comercial em handoff, controle de preço) competem com instruções menos importantes.
6. A bateria fixa de 19 cenários nunca rodou — não há baseline empírico, e regressões reais (horário de atendimento, pergunta sobre kit mais completo) podem ter voltado.

## O problema (causas raiz)

- **P1 — Validação ausente.** Quatro Frentes em produção sem evidência sandbox.
- **P2 — Ficha institucional vazia destrava o pior cenário.** O tenant de teste hoje cai em "ofereço humano" para horário, entrega, cupom e garantia, perdendo respostas boas que existiam antes.
- **P3 — Conflito entre Frente C, Frente E e regra do Respeite o Homem.** Ampliação de catálogo e foco em família entram no mesmo prompt.
- **P4 — Sem hierarquia entre blocos de instrução.** 9 blocos justapostos sem ordem fixa.
- **P5 — Continuidade é só texto, não decisão de estado.** Agradecimento, ruído social e ping de presença ficam dependendo da boa vontade do modelo.
- **P6 — Sem painel para editar ficha institucional.** Frente D é estruturalmente correta, operacionalmente inutilizável.
- **P7 — Sem baseline arquivado da bateria.** Critério de "não regrediu" fica qualitativo, sem transcrição para comparar.
- **P8 — Catálogo amplo brigando com regra de base antes de kit.** Nas perguntas genéricas de catálogo, o tratamento da Frente C pode anular a Onda 18 Fase A no único tenant onde ela está ativa.

## O que eu faria (6 passos sequenciais com validação entre cada um)

Nada vai pra Frente F ou novas ondas até a bateria voltar verde.

### Passo 1 — Coletar baseline empírico da bateria (sem mexer em código)
Rodar os 19 cenários congelados e mais os cenários novos das Frentes B, C, D e E em sandbox, conversas isoladas, no tenant Respeite o Homem. Arquivar transcrição turno a turno no documento temporário das ondas, na seção "Baseline pós-Frentes B–E". Marcar cada cenário como passou, variação aceitável ou regrediu, comparando com a Rodada 2. **Esse passo determina a lista real de regressões — o restante do plano só ataca o que aparecer vermelho aqui.**

### Passo 2 — Tornar a ficha institucional operacional

**2a) Semente imediata.** Popular a ficha do tenant Respeite o Homem com horário de atendimento, formas de pagamento, cobertura nacional, política de cupom e garantia/troca, usando o que já está no site e no histórico recente. Esse passo desbloqueia o teste sem esperar a tela admin.

**2b) Tela administrativa.** Construir a tela de edição da ficha institucional dentro das Configurações da IA, com os 9 campos (cobertura, horário, pagamento, cupom, garantia, prova social, loja física, atendimento humano, observações). Texto de ajuda explicando que campos vazios fazem a IA oferecer humano em vez de inventar. Atualizar o mapa de UI.

Validar perguntas institucionais (entrega, prazo, pagamento, horário) com a ficha preenchida. Só fechar quando voltarem verdes.

### Passo 3 — Resolver o conflito entre catálogo amplo e foco em família
Quando o turno é classificado como "pergunta de catálogo" e o cliente não citou família nova, a âncora do turno deixa de pedir manutenção do foco em família. Em vez disso, registra "família vista anteriormente — pode mostrar outras famílias sem trocar o foco persistido". O handler de busca segue ampliando, e o prompt deixa de contradizer. A regra ativa no Respeite o Homem (base antes de kit) é preservada dentro de cada família, sem ser anulada pela ampliação.

### Passo 4 — Hierarquizar os blocos de instrução
Definir ordem fixa única, do mais determinístico ao mais contextual: silêncio em handoff, reflexos determinísticos, estado por bucket, continuidade, âncora, ficha institucional, memória de trabalho, contexto comercial, espelho de saudação. Suprimir blocos que não fazem sentido em cada contexto (ex.: bloco comercial não entra em pedido de humano ou pós-venda). Rodar a bateria após o ajuste para confirmar que nenhum cenário verde regrediu.

### Passo 5 — Promover a continuidade a override de estado
Quando a IA detecta agradecimento, ruído social ou ping de presença, força o estado da conversa para um caminho terminal/leve antes de montar o prompt — o mesmo padrão dos reflexos determinísticos já consolidados (CEP, frete, pós-venda). O bloco de texto continua existindo como reforço, mas a decisão deixa de depender só da fala do modelo. Cobre os cenários de "kkk", "vlw" e "alô?" da Onda 10.

### Passo 6 — Documentação e fechamento
- Atualizar o changelog oficial da IA de atendimento com um novo registro consolidando os 5 ajustes acima e o resultado da bateria.
- Atualizar o documento temporário das ondas arquivando baseline e pós-correção, e marcando se a Frente F está liberada ou adiada.
- Atualizar o mapa de UI com a tela nova de Ficha Institucional.
- Criar memória anti-regressão sobre a ordem fixa dos blocos de instrução e estender a memória dos reflexos determinísticos com os 3 reflexos novos.

## Resultado final

- Bateria de 19 cenários congelados volta para 100% verde ou variação aceitável (zero regressão).
- O tenant de teste responde institucional (horário, entrega, pagamento, cupom, garantia) sem cair na muleta nem oferecer humano desnecessariamente.
- Catálogo amplo e foco em família convivem sem prompt contraditório, e a regra de base antes de kit segue funcionando dentro de cada família.
- Agradecimento, ruído social e ping de presença viram decisão determinística, não negociação com o modelo.
- Prompt fica enxuto, com ordem fixa e auditável — pré-requisito para abrir Frente F com segurança.
- Tudo registrado nos docs formais, sem nada vivendo só em memória.

## Anti-regressão
- Bateria fixa rodada antes e depois de cada passo (procedimento já oficializado).
- Memória nova sobre ordenação dos blocos de instrução.
- Reforço da memória dos reflexos determinísticos com os 3 reflexos novos.
- Registro novo no changelog da IA de atendimento.

---

## Bloco técnico (opcional — leitura só se quiser detalhe de implementação)

- **Passo 1:** rodar via `ai-test-sandbox` em Agent Mode, modelo `gpt-5`, `sales_mode=true`, conversas isoladas. Tenant `respeite-o-homem` (`d1a4d0ed-8842-495e-b741-540a9a345b25`).
- **Passo 2a:** UPDATE em `ai_support_config.metadata` com chave `institutional_sheet` (jsonb) — sem migração, coluna já existe.
- **Passo 2b:** nova tela em `src/pages/Settings.tsx` (aba IA) consumindo `ai_support_config.metadata.institutional_sheet`.
- **Passo 3:** ajustar `_shared/sales-pipeline/turn-anchor.ts` para receber `intentBucket` e suprimir a linha de família quando `catalog_question`. Validar que `enforceFamilyBaseFirst` da Onda 18 Fase A continua atuando por família, e não no agregado.
- **Passo 4:** introduzir array fixo `BLOCK_ORDER` em `prompt-router.ts`, ordenar `contextualBlocks` antes de concatenar; podar blocos por bucket (ex.: working memory comercial sai em `human_request`/`post_sale`).
- **Passo 5:** estender `_shared/sales-pipeline/deterministic-reflexes.ts` com 3 reflexos novos (`thanks_terminal`, `social_noise`, `presence_ping`) que devolvem override de estado, e remover do continuity-gate a duplicidade de prompt onde for redundante.
- **Passo 6:** edição direta nos arquivos `.md` listados, sem migração.

## 📝 DOCUMENTAÇÃO NECESSÁRIA
- Changelog da IA de atendimento — Registro #36.
- Documento temporário das ondas — baseline + pós-correção.
- Mapa de UI — nova tela de Ficha Institucional.
- Nova memória de governança sobre ordenação dos blocos + atualização da memória dos reflexos determinísticos.

Aguardando "ok" para executar a partir do **Passo 1 (coletar baseline em sandbox)** — esse passo é só leitura/observação, não toca em código.
