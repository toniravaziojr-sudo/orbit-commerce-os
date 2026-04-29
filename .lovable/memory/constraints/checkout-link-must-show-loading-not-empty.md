---
name: Checkout Link Must Show Loading Not Empty
description: useCheckoutLinkLoader inicia isLoading=true quando há ?link= ou ?product= na URL, evitando flicker do empty-state do carrinho.
type: constraint
---

O hook `useCheckoutLinkLoader` (e qualquer loader equivalente para hidratação assíncrona de carrinho via URL) DEVE detectar `?link=` ou `?product=` na inicialização do `useState` e nascer com `isLoading=true`. O guard de empty-state do carrinho (`StorefrontCart` / `CheckoutStepWizard`) DEVE consultar esse `isLoading` antes de renderizar "Seu carrinho está vazio".

**Why:** Se o loader só sobe `isLoading` dentro do `useEffect`, há uma janela de render onde `items.length===0 && !linkLoading` é verdadeiro e o cliente vê "carrinho vazio" antes da hidratação rodar — venda morre na linha de chegada.

**How to apply:** Qualquer hook futuro que hidrate carrinho a partir da URL deve seguir o mesmo padrão (state inicial computado a partir de `window.location.search`). Empty-state do carrinho proibido enquanto qualquer hidratador estiver carregando.
