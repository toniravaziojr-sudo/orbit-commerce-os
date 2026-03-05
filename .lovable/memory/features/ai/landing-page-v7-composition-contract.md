# Memory: features/ai/landing-page-v7-composition-contract
Updated: now

## Pipeline V4.1 — Background-Only + CSS Composition

A arquitetura V4.1 SEPARA cenário de produto para eliminar distorções de IA.

### Princípios Fundamentais:
1. **Produto é SEMPRE uma camada real**: A foto original do catálogo (packshot) é SEMPRE renderizada como overlay CSS. A IA NUNCA redesenha o produto.
2. **IA gera APENAS o background**: O prompt instrui a IA a criar cenários/ambientes fotorrealistas SEM nenhum produto na imagem.
3. **Scene é upgrade, não requisito**: Se a geração de background falhar, o produto ainda aparece com fallback gradient/CSS. O produto NUNCA desaparece.
4. **blockCatalogOutsidePricing NÃO bloqueia productImageUrl**: A regra de bloqueio de catálogo só se aplica a backgrounds, nunca ao packshot overlay.

### Composição CSS (Frontend):
- **Desktop**: Grid 2 colunas — texto LEFT, produto RIGHT com `max-width: clamp(240px, 28vw, 360px)` e `drop-shadow`
- **Mobile**: Produto acima do texto com `max-height: clamp(280px, 42vh, 480px)` e contact shadow
- **Sombras**: `drop-shadow(0 20px 50px var(--lp-shadow))` + contact shadow blur na base

### Prompt da IA (enhance-images):
- Instrução: "Gere APENAS cenário/fundo, SEM produto"
- Produto enviado como referência de cores/atmosfera, NÃO para reprodução
- Layout: Desktop reserva lado direito para overlay CSS; Mobile reserva terço inferior
