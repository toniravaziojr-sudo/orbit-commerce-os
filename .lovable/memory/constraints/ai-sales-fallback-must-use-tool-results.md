---
name: ai-sales-fallback-must-use-tool-results
description: Pipeline de vendas IA — fonte de verdade para is_kit, ordenação no servidor, prompts ensinam a lógica, scrubber é só rede de segurança.
type: constraint
---
Regra estrutural do pipeline de vendas IA (ai-support-chat + sales-pipeline). Aplica a qualquer agente comercial com tool-calling sobre catálogo.

### Causa raiz vs remendo
Decisões de produto vs kit, primeira oferta e linguagem natural devem ser corrigidas:
1. **Na fonte de verdade dos dados** (tool retornando o sinal certo).
2. **No prompt de cada estado** (ensinando a lógica conceitual ao modelo).
3. Só por último em **rede de segurança** (scrubber/fallback). Scrubber não é solução, é alarme.

### Fonte de verdade para `is_kit`
- Produto com linhas em `product_components` = kit. Sem composição = produto único.
- A tool `search_products` (ai-support-chat) marca `is_kit=true` quando há composição.
- **Heurística por nome é proibida em padrões ambíguos**: "duo", "trio", "x", "leve", "pack", "c/3" pegam produtos únicos legítimos. Fallback de nome só aceita prefixo explícito `^kit\b` ou `^combo\b` para o caso raro de kit cadastrado sem composição formal.

### Enforcement no servidor
- `search_products` ordena o array com **produtos únicos primeiro, kits no fim**. Mesmo se o modelo errar a regra do prompt, ao mostrar até 3 ele acerta naturalmente.
- Kits permanecem no array (não são removidos) para upsell explícito.

### Prompts ensinam a lógica (não só listam regras)
Em `_shared/sales-pipeline/prompts/`:
- **discovery.ts** e **recommendation.ts**: ensinam o conceito "produto único = ingrediente, kit = receita pronta. Vendedora oferece ingrediente primeiro; receita pronta vem como upsell ou quando o cliente pede".
- **product-detail.ts**: a partir daqui kit é válido como upsell (cliente já escolheu base).
- Todos têm exemplo BOM e exemplo RUIM com fala natural de vendedora ("Temos sim", "Trabalhamos com") vs fala de sistema ("Encontrei esses produtos reais", "Consultei o catálogo").

### Fallback conclusivo (`buildHumanFallbackFromTools`)
Quando o modelo termina sem texto útil mas as tools rodaram:
1. Usa snapshot real das tools do turno (não promessa genérica).
2. Filtra `is_kit=true` na primeira oferta.
3. Prioridade: `get_product_details` real > `search_products` real (uniques) > `view_cart` real.
4. Fala como vendedora ("Temos sim, o X. Quer que eu te conte mais?"), nunca como sistema.

### Scrubber de linguagem de sistema = rede de segurança mínima
- Mantido enxuto: só os 3 padrões mais agressivos ("encontrei esses produtos reais", "já consultei o catálogo", "deixa/deixe eu ver/buscar").
- Log com `console.warn` orientando a corrigir o prompt do estado, não expandir o scrubber.
- Se disparar com frequência: o problema está no prompt, não na rede.

**Why:** No fluxo WhatsApp, "queria esse shampoo" estava devolvendo "Encontrei esses produtos reais para você: Kit Calvície Zero (6x), Combo…" — três falhas estruturais simultâneas: (a) linguagem de sistema na resposta do modelo, (b) kits aparecendo como primeira oferta, (c) tentativa anterior de corrigir foi via heurística por nome + scrubber gigante, que mascarava produtos únicos legítimos com "duo/trio/x" no nome e tratava sintoma em vez de causa.

**How to apply:** Em qualquer agente comercial com tool-calling:
1. A tool de catálogo precisa retornar o sinal estrutural (is_kit) calculado da composição real, não do nome.
2. O servidor deve ordenar o resultado de forma que a regra de negócio aconteça mesmo se o modelo errar.
3. O prompt do estado ensina a lógica como conceito + exemplo BOM/RUIM, não como lista de proibições.
4. Scrubber e fallback são alarmes — se disparam muito, o prompt está errado. Não expanda o scrubber, conserte o prompt.
