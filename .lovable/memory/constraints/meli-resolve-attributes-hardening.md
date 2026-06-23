---
name: ML Resolve Attributes Hardening
description: Regras invioláveis do resolvedor de atributos do Mercado Livre — anti-alucinação de marca, tolerância a formato da IA, isolamento por atributo, fila de concorrência no painel.
type: constraint
---

Regras invioláveis aplicadas em `meli-resolve-attributes` e `MeliAttributesPanel` (a partir da v1.5.0):

1. **IA nunca inventa marca.** Se `products.brand` for vazio, o atributo `BRAND` vai para `missing` com mensagem "Preencha a marca no cadastro do produto". É proibido aceitar sugestão da IA para `BRAND` quando o cadastro não tem marca. **Quando há marca no cadastro, ela é enviada ao ML em texto livre mesmo que a categoria publique uma lista fechada de marcas** (marca própria de loja nunca está na lista do ML, mas o ML aceita). O mesmo vale para `GTIN`, `EAN`, `MODEL` e `SELLER_SKU` — exceções de free-form no resolver e na sanitização do `meli-publish-listing` (set `FREE_FORM_IDS`).

2. **Lista negra de marcas famosas.** Helper `isBlacklistedBrand()` bloqueia sugestões da IA com marcas como L'Oréal, Nivea, Dove, Garnier, Natura, Boticário, Samsung, Apple, Nike etc. mesmo se vierem por erro do modelo. Lista vive no topo de `meli-resolve-attributes/index.ts`. Para adicionar marca, editar `FAMOUS_BRAND_BLACKLIST`.

3. **GTIN/EAN nunca pela IA.** Só vem de `products.gtin`.

4. **Sanitização universal.** Toda resposta da IA passa por `toSafeString(v)` antes de qualquer `.trim()`. Array vira "a, b, c"; objeto vira `value`/`name` ou JSON truncado; null/undefined vira "". Elimina o crash `(...).trim is not a function`.

5. **Isolamento por atributo.** O loop `for (const a of aiPending)` envolve cada atributo em `try/catch`. Falha individual nunca derruba o produto inteiro nem os demais atributos.

6. **Anti-repetição preguiçosa.** Sugestões opcionais que apenas repetem palavras do nome do produto (sem lista fechada) são descartadas (`isJustRepeatingName`). Evita "Volume" aparecer em "Tipo de cuidado", "Efeitos" e "Tipo de aplicação" ao mesmo tempo.

7. **Fila de concorrência no painel.** `MeliAttributesPanel` usa fila global (`MAX_CONCURRENT = 3`) compartilhada no app inteiro. Quando o dialog de configuração em lote abre com N produtos, apenas 3 chamadas ao motor rodam por vez — as demais aparecem "aguardando vez na fila". Proíbe alterar para mais sem nova auditoria de custo de IA e rate-limit.

8. **Retry isolado por produto.** UI mostra erro amigável em PT-BR (sem stacktrace) e botão "Tentar de novo" apenas para o produto afetado. `friendlyError()` mapeia 429/timeout/non-2xx para mensagens de negócio.

9. **Cache obrigatório.** O painel hidrata de `meli_listings.attributes` quando `category_id` bate. Só chama o resolvedor quando o usuário aperta "Recalcular" ou quando não há nada salvo. Proibido recalcular automático ao reabrir o dialog.

10. **Sugestão da IA = verde com etiqueta de origem (v1.6.0).** Todo atributo resolvido com valor (cadastro, derivação, dicionário ou IA) entra como `status: "filled"`. O painel diferencia visualmente apenas pela etiqueta de origem: **"Do cadastro do produto"** (verde) vs **"Sugerido pela IA"** (azul) vs **"Editado manualmente"** (roxo, `source: "manual"`). Não existe mais bloco amarelo "para revisar" — proibido reintroduzir status `review` para sugestões da IA, porque cria fricção falsa e desencoraja a publicação. O lojista enxerga claramente que **tudo o que está verde/azul/roxo será enviado ao Mercado Livre**.

11. **Edição manual em qualquer linha (v1.7.0).** Toda característica é editável inline (lápis no hover nas linhas compactas, input direto nas demais). Ao editar, o atributo vira `source: "manual"` e é persistido imediatamente em `meli_listings.attributes`. Proibido bloquear edição "porque veio do cadastro ou da IA" — o lojista precisa poder corrigir erros sem voltar ao cadastro do produto.

12. **Auto-persistência + Recalcular todos + Aplicar a todos (v1.7.0).** O painel grava o resultado do resolver em `meli_listings.attributes` imediatamente após o cálculo (não só no "Continuar" da etapa) — reabrir o dialog hidrata do banco e nunca dispara IA de novo para a mesma combinação `listingId + categoryId`. O `MeliListingCreator` expõe dois controles na etapa Características: botão **"Recalcular todos"** no topo (incrementa `recalcToken` em todos os painéis) e botão **"Aplicar a todos"** por produto (copia atributos do produto fonte para outros anúncios **da mesma categoria do ML**, via `seedToken + seedAttributes`). Proibido aplicar entre categorias diferentes.

13. **Multi-valor, garantia e órgão regulatório (v1.8.0).** (a) Atributos do ML marcados como `tags.multivalued=true` ou `value_max_quantity>1` (ex.: HAIR_TYPES, HAIR_TREATMENT_FORMAT) viajam como `values: [{id, name}]` no resolver, no painel (persistido em `meli_listings.attributes.values`) e no publish. Proibido enviar multi como `value_name` único com vírgulas — o ML aceita só 1 e descarta o resto. (b) Garantia (WARRANTY_TYPE + WARRANTY_TIME) é derivada do cadastro (`warranty_type` `vendor`→"Garantia do vendedor" / `factory`→"Garantia de fábrica"; `warranty_duration` em texto livre). WARRANTY_TIME entra na exceção de free-form na sanitização. (c) Quando `regulatory_regime` contém "anvisa", o publish preenche automaticamente o atributo de órgão regulatório da categoria (REGULATORY_AGENCY / SANITARY_REGISTRY_AGENCY / HEALTH_REGISTRATION_INSTITUTION / REGULATORY_BODY / ANVISA_REGISTRY_INSTITUTION — só o que existir na categoria) com "ANVISA". (d) Prompt da IA reescrito: para multi-select, "marcar TODAS as opções compatíveis"; para single-select obrigatório (Tipo de cuidado), "escolher sempre uma opção, a mais próxima do produto".

Docs: `docs/especificacoes/marketplaces/mercado-livre.md` seções "Anti-Alucinação e Tolerância a Erros da IA (v1.5.0)", "Fila de Concorrência no Painel (v1.5.0)", "Marca/GTIN/Modelo em Texto Livre e Etiqueta de Origem (v1.6.0)" e "Edição Manual, Recalcular Todos e Aplicar a Todos (v1.7.0)".
