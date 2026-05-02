---
name: Admin Scroll Single Source Layout
description: Em rotas admin, AppShell trava overflow do html/body/#root via useEffect; <main> do shell é a única área rolável. Mexer em padding/grid antes disso é perda de tempo.
type: constraint
---

Em rotas administrativas (dentro do `AppShell`), o scroll vertical é único e fica no `<main>` do shell. O documento global (`html`, `body`, `#root`) é travado em `overflow: hidden` + `height: 100dvh` por um `useEffect` no mount do `AppShell`, com restauração no unmount.

Regras obrigatórias:
- Não remover o `useEffect` de lock global no `AppShell.tsx` — sem ele a faixa branca no fim das telas (Novo Pedido, Produtos, etc.) volta.
- `AppShell` e `AppSidebar` compartilham régua de altura: ambos `h-dvh` + `min-h-0`. Não misturar `h-screen` legado.
- Páginas admin não usam `min-h-screen`/`h-screen` na raiz.
- Não duplicar `padding-bottom` na raiz da página + compensação de footer fixo.
- Em grids com coluna lateral curta, usar `self-start` para evitar stretch que amplifica o falso branco.
- Lock do shell não conflita com Radix Dialog/Sheet (que também trava body) — o cleanup do shell preserva ordem.

Diagnóstico para sintomas semelhantes ("espaço em branco no fim" em qualquer tela admin): antes de mexer em padding/grid, conferir no DevTools se `document.documentElement.scrollHeight > window.innerHeight`. Se sim, é scroll do documento (lock global), não do componente.

Why: em 2026-05-02 as telas Novo Pedido e Produtos exibiam faixa branca no fim mesmo após corrigir padding, stretch de grid e unificar `h-dvh` em shell+sidebar. A causa raiz era o documento global continuar rolável por fora do shell. Só travar `html`/`body`/`#root` com `overflow:hidden` + `100dvh` no mount do `AppShell` resolveu definitivamente.
