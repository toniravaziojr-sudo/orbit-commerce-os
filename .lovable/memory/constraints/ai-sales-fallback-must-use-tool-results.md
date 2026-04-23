---
name: ai-sales-fallback-must-use-tool-results
description: O fallback conclusivo da IA de vendas tem que usar produtos reais das tools, nunca falar como sistema, e nunca apresentar kits na primeira oferta.
type: constraint
---
Sempre que um turno da IA de vendas chamar tools de catálogo/carrinho e o modelo terminar sem texto útil:
1. O fallback final deve ser montado a partir do resultado real mais recente das tools executadas no turno (snapshot estruturado).
2. É proibido responder com:
   - promessa genérica do tipo "já consultei o catálogo", "deixa eu ver", "um instante";
   - linguagem de sistema do tipo "encontrei esses produtos reais", "pelos dados que tenho", "segundo o sistema", "aqui na base", "no nosso banco";
   - reabrir descoberta genérica se já há produtos reais encontrados.
3. A prioridade do fallback é:
   - detalhes reais do produto quando `get_product_details` já trouxe item válido;
   - lista curta (até 3) de produtos REAIS quando `search_products` já encontrou produtos;
   - estado real do carrinho quando `view_cart` já trouxe itens.
4. Filtro de KITS na primeira oferta:
   - Produtos com `is_kit=true` (têm composição em product_components) NÃO entram na vitrine inicial.
   - Sempre priorizar produtos únicos. Kits só são oferecidos quando o cliente já escolheu um produto (upsell) ou pediu explicitamente "kit/combo/mais unidades".
5. A fala precisa soar como vendedora real ("Temos sim", "Trabalhamos com", "Olha, pra esse caso a gente tem"), não como sistema explicando o que fez.
6. A observabilidade do turno deve registrar se o fallback foi conclusivo apoiado em resultado real de tool ou conclusivo genérico.

**Why:** No fluxo de vendas WhatsApp, a tool `search_products` encontrou produtos reais para "queria esse shampoo", mas (a) o fallback antigo dizia "Já consultei o catálogo aqui..." e (b) quando passou a usar produtos reais, escreveu "Encontrei esses produtos reais para você: Kit X, Combo Y..." — duas violações: linguagem de sistema + apresentou kits na primeira oferta em vez de produtos únicos.

**How to apply:** Em qualquer fallback pós-tool de agentes comerciais, FAQ dinâmica ou assistentes com tool-calling:
- verificar primeiro o snapshot dos resultados de tool do turno antes de usar texto padrão;
- ao montar fala a partir de produtos, filtrar `is_kit=true` na primeira apresentação;
- redigir como vendedora humana, sem expor o mecanismo (nada de "encontrei", "consultei", "no sistema");
- atualizar também os prompts por estado (recommendation/discovery) para reforçar a mesma regra no lado do modelo.
