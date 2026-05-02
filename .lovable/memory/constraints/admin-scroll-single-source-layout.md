---
name: Admin Scroll Single Source Layout
description: Em telas do admin dentro do AppShell, o scroll vertical deve vir só do shell; evitar padding inferior duplicado e colunas esticadas que criam branco artificial.
type: constraint
---

Em telas administrativas renderizadas dentro do AppShell, a área rolável vertical única é o `main` do shell.

Regras obrigatórias:
- Não adicionar padding-bottom extra na raiz da página só para “respiro”.
- Se houver barra de ação fixa local, a compensação inferior deve existir apenas no container coberto por ela.
- Em grids com sidebar/resumo, usar altura intrínseca (`self-start`) nas colunas curtas quando o stretch da grid gerar sensação de espaço branco falso no fim da rolagem.

Why: em 2026-05-02 as telas de Novo Pedido e Produtos passaram a criar scroll excedente por somar padding inferior local ao scroll do AppShell, e no Pedido o stretch da coluna lateral agravava a percepção do bug.