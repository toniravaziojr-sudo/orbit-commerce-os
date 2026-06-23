---
name: ML Resolve Attributes Hardening
description: Regras invioláveis do resolvedor de atributos do Mercado Livre — anti-alucinação de marca, tolerância a formato da IA, isolamento por atributo, fila de concorrência no painel.
type: constraint
---

Regras invioláveis aplicadas em `meli-resolve-attributes` e `MeliAttributesPanel` (a partir da v1.5.0):

1. **IA nunca inventa marca.** Se `products.brand` for vazio, o atributo `BRAND` vai para `missing` com mensagem "Preencha a marca no cadastro do produto". É proibido aceitar sugestão da IA para `BRAND` quando o cadastro não tem marca.

2. **Lista negra de marcas famosas.** Helper `isBlacklistedBrand()` bloqueia sugestões da IA com marcas como L'Oréal, Nivea, Dove, Garnier, Natura, Boticário, Samsung, Apple, Nike etc. mesmo se vierem por erro do modelo. Lista vive no topo de `meli-resolve-attributes/index.ts`. Para adicionar marca, editar `FAMOUS_BRAND_BLACKLIST`.

3. **GTIN/EAN nunca pela IA.** Só vem de `products.gtin`.

4. **Sanitização universal.** Toda resposta da IA passa por `toSafeString(v)` antes de qualquer `.trim()`. Array vira "a, b, c"; objeto vira `value`/`name` ou JSON truncado; null/undefined vira "". Elimina o crash `(...).trim is not a function`.

5. **Isolamento por atributo.** O loop `for (const a of aiPending)` envolve cada atributo em `try/catch`. Falha individual nunca derruba o produto inteiro nem os demais atributos.

6. **Anti-repetição preguiçosa.** Sugestões opcionais que apenas repetem palavras do nome do produto (sem lista fechada) são descartadas (`isJustRepeatingName`). Evita "Volume" aparecer em "Tipo de cuidado", "Efeitos" e "Tipo de aplicação" ao mesmo tempo.

7. **Fila de concorrência no painel.** `MeliAttributesPanel` usa fila global (`MAX_CONCURRENT = 3`) compartilhada no app inteiro. Quando o dialog de configuração em lote abre com N produtos, apenas 3 chamadas ao motor rodam por vez — as demais aparecem "aguardando vez na fila". Proíbe alterar para mais sem nova auditoria de custo de IA e rate-limit.

8. **Retry isolado por produto.** UI mostra erro amigável em PT-BR (sem stacktrace) e botão "Tentar de novo" apenas para o produto afetado. `friendlyError()` mapeia 429/timeout/non-2xx para mensagens de negócio.

9. **Cache obrigatório.** O painel hidrata de `meli_listings.attributes` quando `category_id` bate. Só chama o resolvedor quando o usuário aperta "Recalcular" ou quando não há nada salvo. Proibido recalcular automático ao reabrir o dialog.

Docs: `docs/especificacoes/marketplaces/mercado-livre.md` seção "Anti-Alucinação e Tolerância a Erros da IA (v1.5.0)" + "Fila de Concorrência no Painel (v1.5.0)".
