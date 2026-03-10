

# Plano: Fix Crítico do SUPER BUG + Correções de Navegação

## Causa Raiz Confirmada

Quando o SPA (Cart/Checkout) está carregado e o usuário navega para uma rota de conteúdo (/, /categoria/..., /produto/...), o React Router intercepta mas não tem rota filha correspondente. O `<Outlet />` renderiza vazio, "contaminando" toda a sessão.

## Correções (4 mudanças)

### 1. Catch-all reload no App.tsx (FIX DO SUPER BUG)

Adicionar componente `EdgeContentReload` e rota `*` wildcard em ambos os layouts (tenant root e `/store/:tenantSlug`). Quando React Router captura uma URL de conteúdo sem match, o catch-all força `window.location.reload()`, devolvendo o controle ao Edge/Worker.

```tsx
function EdgeContentReload() {
  useEffect(() => { window.location.reload(); }, []);
  return null;
}
```

Adicionado como última rota filha em ambos os layouts:
```tsx
<Route path="*" element={<EdgeContentReload />} />
```

Sem risco de loop: o Edge HTML não carrega React, então o reload não re-executa o componente.

### 2. Fix dropdown hover gap (header.ts)

Nos 3 estilos de dropdown (classic, elegant, minimal), o `margin-top: 12px/8px` no inline style cria um gap físico que quebra o `:hover`. O CSS global já tem `.sf-dropdown .sf-dropdown-menu{padding-top:8px;}` mas o inline margin sobrepõe.

**Fix:** Remover `margin-top` do inline style dos 3 dropdownStyles (linhas 181, 183, 185). O `padding-top` do CSS global (`.sf-dropdown .sf-dropdown-menu`) já cria o espaçamento visual. Aumentar esse padding-top de 8px para 12px para manter o espaçamento visual.

### 3. Links `/minha-conta` → `/conta` (header.ts + storefront-html/index.ts)

- `header.ts` linha 321: `href="/minha-conta"` → `href="/conta"`
- `storefront-html/index.ts` linha 2037: `href="/minha-conta"` → `href="/conta"`
- Manter a rota `minha-conta/redefinir-senha` no App.tsx (já existe como alias)

### 4. Deploy da Edge Function

Redeplorar `storefront-html` com as correções do dropdown e links.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Componente `EdgeContentReload` + rota `*` nos 2 layouts |
| `supabase/functions/_shared/block-compiler/blocks/header.ts` | Remover `margin-top` dos 3 dropdown styles; link `/conta` |
| `supabase/functions/storefront-html/index.ts` | Link mobile `/conta`; padding-top do dropdown CSS de 8px→12px |
| Deploy | `storefront-html` |

## Validação Necessária

Após implementação, testar no domínio público o fluxo completo:
Home → Categoria → Produto → Checkout → voltar para Home → Categoria → Produto

Critérios: navegação não contamina, menu não some, PDP funciona, `/conta` abre.

