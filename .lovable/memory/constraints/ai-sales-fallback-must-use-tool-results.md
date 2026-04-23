---
name: ai-sales-fallback-must-use-tool-results
description: Quando a IA de vendas executa tool com sucesso mas termina sem texto, o fallback conclusivo deve usar o resultado real da tool e nunca voltar para promessa genérica ou linguagem de sistema.
type: constraint
---
Sempre que um turno da IA de vendas chamar tools de catálogo/carrinho e o modelo terminar sem texto útil:
1. O fallback final deve ser montado a partir do resultado real mais recente das tools executadas no turno.
2. É proibido responder com promessa genérica do tipo "já consultei o catálogo", "deixa eu ver", "um instante" ou reabrir descoberta genérica se já há produtos reais encontrados.
3. A prioridade do fallback deve ser:
   - detalhes reais do produto quando `get_product_details` já trouxe item válido;
   - lista curta de opções reais quando `search_products` já encontrou produtos;
   - estado real do carrinho quando `view_cart` já trouxe itens.
4. A observabilidade do turno deve registrar se o fallback foi apenas conclusivo ou conclusivo apoiado em resultado real de tool.

**Why:** No fluxo de vendas WhatsApp, a tool `search_products` encontrou produtos reais para "queria esse shampoo", mas a saída caiu em resposta vazia e o fallback devolveu "Já consultei o catálogo aqui... pra qual uso é...", repetindo exatamente o comportamento proibido pelo produto e ignorando o resultado já disponível.

**How to apply:** Em qualquer fallback pós-tool de agentes comerciais, FAQ dinâmica ou assistentes com tool-calling, verificar primeiro o snapshot dos resultados de tool do turno antes de usar texto padrão. Se houver dado real disponível, a resposta final deve reaproveitar esse dado e avançar a conversa.