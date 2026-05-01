---
name: Plano principal — Pedido Manual (em andamento)
description: Plano macro do fluxo de criação manual de pedido sendo executado em frentes; contexto para não perder o fio enquanto agravantes são tratados
type: preference
---

**Status:** Plano principal vivo em `.lovable/plan.md`. Estamos atacando agravantes pontuais de UMA frente do plano (criação manual: numeração, visibilidade na lista, fiscal não dispara, transportadoras filtradas, scroll branco).

**Frentes do plano (resumo):**
1. Alinhar vocabulário no banco (enums payment_status / shipping_status canônicos) — fonte de verdade única.
2. Corrigir `create_order` no edge para usar canônico + aceitar overrides iniciais (pagamento/envio/método/carrier/tracking).
3. Refatorar tela "Novo Pedido": status iniciais obrigatórios (pagamento + envio + métodos), liberar Correios/manual, aviso fiscal.
4. Refinar overrides na tela de detalhe + ação "Estornar pagamento" real via gateway.
5. Espelhar pedido manual no fluxo automático: dispara fiscal_draft_queue + remessa do carrier escolhido (Correios, Frenet, etc.) com particularidades de cada um.

**Onde estamos agora:** frente 5 + agravantes residuais da 3 (numeração com gap, lista escondendo `pending`, scroll branco em Novo Pedido e Produtos, Correios não aparecendo no select). Triggers já migrados para `AFTER INSERT OR UPDATE`. Edge mapeia `paid → approved`. Pedido teste #388 deletado.

**Não esquecer:** ao fechar os agravantes, voltar e validar frentes 1, 2 e 4 do plano principal. Doc formal a atualizar no fechamento: `docs/especificacoes/transversais/mapa-ui.md` e doc do módulo Pedidos.
