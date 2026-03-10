

# Plano: Remoção Total da Renderização SPA para Páginas de Conteúdo

## Objetivo
Eliminar completamente o fallback SPA para páginas de conteúdo (Home, Categoria, Produto, Blog, Pages, Landing Pages). Se a Edge Function não renderizar, o usuário verá um erro claro (404), facilitando a identificação de problemas.

## Páginas a REMOVER das rotas (conteúdo Edge-only)

| Rota | Componente | Ação |
|---|---|---|
| `index` (Home) | `StorefrontHome` | Remover das rotas |
| `c/:categorySlug` | `StorefrontCategory` | Remover das rotas |
| `p/:productSlug` | `StorefrontProduct` | Remover das rotas |
| `page/:pageSlug` | `StorefrontPage` | Remover das rotas |
| `lp/:pageSlug` | `StorefrontLandingPage` | Remover das rotas |
| `blog` | `StorefrontBlog` | Remover das rotas |
| `blog/:postSlug` | `StorefrontBlogPost` | Remover das rotas |

## Páginas que PERMANECEM (SPA interativas)

Cart, Checkout, Obrigado, Conta/*, Rastreio, Busca, Quiz, Avaliação, Minhas Compras

## Mudanças

### 1. `src/App.tsx`
- **Bloco `TenantStorefrontLayout`** (linha 237-261): Remover rotas de conteúdo (index, c/, p/, page/, lp/, blog, blog/:postSlug). Manter apenas rotas SPA interativas.
- **Bloco `StorefrontLayout`** (linha 267-290): Remover completamente o bloco inteiro. O `/store/:tenantSlug` não precisa mais servir conteúdo SPA.
- Recriar um bloco mínimo `/store/:tenantSlug` com `StorefrontLayout` **apenas para rotas SPA** (cart, checkout, conta, etc.) para manter preview/app domain funcional.
- Remover imports lazy não utilizados: `StorefrontHome`, `StorefrontCategory`, `StorefrontProduct`, `StorefrontPage`, `StorefrontLandingPage`, `StorefrontBlog`, `StorefrontBlogPost`.
- Adicionar rota `/carrinho` como alias para `/cart` em ambos os layouts.

### 2. `src/components/storefront/StorefrontLayout.tsx`
- Manter o arquivo mas simplificado — ainda necessário como wrapper de Cart/Checkout no app domain (`/store/:tenantSlug/cart`, etc.).

### 3. Deletar `src/components/storefront/StorefrontPageRenderer.tsx`
- Não é usado em lugar nenhum.

### 4. `src/components/storefront/CouponInput.tsx` (linha 170-177)
- Botão "Aplicar" usar cores do tema:
```tsx
<button
  type="button"
  onClick={handleApply}
  disabled={isLoading || !code.trim()}
  style={{ backgroundColor: 'var(--theme-button-primary-bg)', color: 'var(--theme-button-primary-text, #fff)' }}
  className="px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
>
```

### 5. `supabase/functions/storefront-html/index.ts`
- Trocar link do cart drawer de `/carrinho` para `/cart`.

### 6. Navegação Edge ↔ SPA
- No `TenantStorefrontLayout`, as rotas de conteúdo não existirão mais no React Router. Se o usuário clicar no logo do checkout (SPA), o `<a href="/">` fará full reload e o Edge servirá o HTML. Sem conflito.
- Verificar que links no header do checkout/cart usam `<a href>` nativo e não `<Link>`.

### 7. Documentação
- Atualizar `docs/regras/` com a nova política: conteúdo = Edge only, SPA = interatividade only.

## Resultado Esperado
- Páginas de conteúdo servidas exclusivamente pelo Edge
- Se Edge falhar, o browser mostra 404 (erro visível e claro)
- Zero conflito de hidratação entre Edge HTML e React SPA
- Bugs de navegação eliminados (não há mais SPA renderizando conteúdo stale)

