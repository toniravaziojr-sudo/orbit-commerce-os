---
name: Greeting Mirror Vars Must Be Re-Resolved Per Call Site
description: Variáveis customerName/isRecurring passadas para gateGreetingMirror (e fallback) em ai-support-chat devem ser re-resolvidas no escopo de cada call site a partir de conversation.customer_name + customerId, nunca puxadas de uma variável de escopo externo que pode estar undefined em ramos da pipeline.
type: constraint
---

## Regra

Toda chamada a `gateGreetingMirror`, `gateGreetingMirrorFallback` ou `applyGreetingScrub` em `supabase/functions/ai-support-chat/index.ts` DEVE passar `customerName` e `isRecurring` re-resolvidos no próprio bloco:

```ts
const greetCustomerName = conversation?.customer_name || null;
const greetIsRecurring = (messages?.length ?? 0) > 1 || !!customerId;
```

É PROIBIDO depender de uma variável `customerName` declarada no topo do handler ou herdada por closure de outro bloco — a pipeline tem múltiplos ramos (TPR ok, TPR fallback, regeneração após anti-repetição, scrub legado) e nem todos têm a mesma variável em escopo.

## Por quê

Hotfix Reg #8 (mai/2026): em um ramo da regeneração pós-anti-repetição, `customerName` estava `undefined` porque a variável só existia no escopo do bloco principal. O gate rodava com `customerName=undefined`, o opening saía sem nome para clientes recorrentes ("Olá, boa tarde, tudo bem?" em vez de "Olá, João, boa tarde, tudo bem?"), e o teste do sandbox só pegou em produção.

## Como aplicar

- Toda nova chamada aos gates de saudação re-declara `greetCustomerName` e `greetIsRecurring` no bloco.
- Se for adicionar um novo gate que precise de dados de cliente, seguir o mesmo padrão (re-resolver, não importar de cima).
- Doc formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` Registro #8.
