# Bateria de Regressão — Base Universal de Vendas (IA de Atendimento)

> **Status:** congelada após Rodada 2 (pós-Frentes 1–4) em 2026-05-23.
> **Fonte de verdade dos cenários:** `_temp-base-universal-ondas-de-teste.md` (Rodada 2, status ✅ ou ↑).
> **Tenant de referência:** `respeite-o-homem` (`d1a4d0ed-8842-495e-b741-540a9a345b25`).
> **Como executar:** `ai-test-sandbox` em Agent Mode (`x-agent-mode: true`), modelo `gpt-5`, `sales_mode=true`, conversas isoladas (criar e descartar `conversation_id` por cenário).

## Para que serve

Esta bateria **DEVE** ser executada antes e depois de cada Frente do plano de Fase 4 da base universal (Frentes B, C, D, E, F). Toda Frente só fecha se nenhum cenário desta bateria regredir em relação ao baseline da Rodada 2.

Se algum cenário regredir, a Frente volta para Diagnóstico — não importa quão maduro estiver o código novo.

## Critério de "não regrediu"

Para cada cenário, comparar a resposta da Frente atual com o baseline da Rodada 2 e classificar:

- ✅ **Mantido ou superior** — comportamento igual ou melhor (ganho de naturalidade, dados extras, ancoragem).
- ⚠️ **Variação aceitável** — texto diferente, mas mesma intenção, sem perda de função (ex.: tom mais direto, fechamento mais curto).
- ❌ **Regressão** — perda de função (preço sumiu, fuzzy match falhou, muleta voltou, viés voltou). **Bloqueia a Frente.**

## Os cenários congelados

### Onda 1 — Saudação e abertura

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B1.1 | "oi" | Saudação espelhando período do servidor + reciprocidade + discovery aberto, sem vazar produto/preço. |
| B1.2 | "boa noite" (servidor em tarde) | Saudação espelhando "boa noite" (sobrescreve servidor) + discovery aberto. |
| B1.3 | "olá tudo bem?" | Reciprocidade do "tudo bem?" + discovery aberto. |
| B1.4 | Turno 1 "oi" → Turno 2 "oi de novo" | Turno 2 NÃO refaz saudação completa, NÃO emite duas mensagens, continua discovery em mensagem única. |
| B1.5 | "bom dia" | Saudação espelhando "bom dia" (sobrescreve servidor) + discovery aberto. |

### Onda 3 — Pergunta direta por categoria

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B3.1 | "vocês têm shampoo?" | Confirma + lista as 2 opções do tenant com diferenciação curta + devolve a bola. |
| B3.2 | "tem balm?" | Reconhece família, apresenta o item, contextualiza uso, devolve a bola. |
| B3.3 | "vende perfume?" | Declara honestamente que NÃO trabalha com perfume + reconduz pelo catálogo. |

### Onda 5 — Pedido por nome de produto

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B5.1 | "vocês têm minoxidil?" | Declara que não trabalha com minoxidil + traduz a intenção + oferece a alternativa do catálogo (Calvície Zero). |
| B5.2 | "Shampoo Preventive Power" exato (após contexto de compra) | Reconhece o produto, adiciona ao carrinho, mantém preço (R$) na resposta, oferece checkout/cross-sell. |

### Onda 6 — Vendas consultivas

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B6.1 | "qual a diferença entre os dois?" (com 2 produtos em foco) | Comparação direta com 1–2 linhas por critério, devolve a bola para escolha. |
| B6.2 | "qual você recomenda?" | Recomenda explicitamente um, justifica em 1–2 linhas, qualifica com 1 pergunta para confirmar. |

### Onda 8 — Institucional

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B8.1 | "como funciona o pagamento?" | Explica fluxo de checkout/link + CTA para fechar. |

### Onda 9 — Pós-venda

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B9.1 | "cadê meu pedido?" | Empatia + ação imediata + pede dados (nome+pedido OU CPF/e-mail) + qualifica problema. |
| B9.2 | "quero trocar o produto" | Empatia + escala equipe + pede dados (nome, pedido, descrição) + qualifica troca (lacrado/usado, se possível). |
| B9.3 | "minha compra não chegou" | Empatia + ação + pede dados com fallback. Handoff acionado (complaint + urgency). |
| B9.4 | "como rastreio?" | Explica parte operacional (código por e-mail quando postado) + pede dados para verificar. |

### Onda 10 — Ruído social e handoff

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B10.1 | "boa noite!" (mid-thread ou primeira) | Saudação devolvida + abertura natural. |
| B10.2 | "preciso falar com humano" | Aceita escalar sem resistência + promete encaminhamento. |

### Onda 4 — Catálogo (parcialmente bom)

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B4.1 | "qual o kit mais completo?" (Rodada 1 era ✅) | Identifica os kits, ranqueia por completude, explica diferenças, devolve a bola. **Atenção:** este cenário regrediu na Rodada 2 — deve ser restaurado pela Frente C. Após restauração entra como obrigatório na bateria. |

### Onda 6 — Hesitação

| Código | Mensagem do cliente | Comportamento esperado |
|---|---|---|
| B6.3 | "depois eu vejo" / "preciso pensar" | Acolhe sem pressionar, deixa porta aberta. |

## Procedimento de execução

1. Para cada Frente (B, C, D, E, F), antes de aplicar mudança: rodar a bateria e arquivar resposta de cada cenário como **baseline**.
2. Aplicar a Frente.
3. Rodar a bateria novamente. Comparar cenário a cenário com baseline.
4. Documentar resultado no doc temporário das ondas em uma seção "Frente X — bateria de regressão".
5. Se houver ❌, **abortar a Frente**, voltar a estado anterior, replanejar.
6. Se tudo ✅/⚠️, declarar Frente fechada e seguir.

## Atualização da bateria

A bateria é congelada agora. Só pode ser estendida (nunca reduzida) ao longo das Frentes:

- Quando uma Frente resolver um cenário ❌ persistente (ex.: "tem garantia?" pela Frente D), o cenário entra como obrigatório a partir da Frente seguinte.
- Quando uma Frente resolver uma regressão da Rodada 2 (ex.: B4.1 "kit mais completo"), o cenário volta à bateria obrigatória.

Toda extensão é registrada com data + Frente que a originou.

## Histórico de execuções

(preencher por Frente)

- **Baseline Rodada 2 (2026-05-23):** todos os cenários acima respondidos conforme esperado pela Rodada 2. Detalhe completo no doc temporário.
- _Frente B: pendente._
- _Frente C: pendente._
- _Frente D: pendente._
- _Frente E: pendente._
- _Frente F: pendente._
