# Checklist Anti-Regressão: URLs e Navegação no Storefront

## Regras Obrigatórias

### 1. NUNCA montar URLs manualmente no Storefront

```tsx
// ❌ PROIBIDO - Vai falhar no ESLint
navigate(`/store/${tenantSlug}/checkout`);
<Link to={`/store/${tenantSlug}/cart`}>Carrinho</Link>

// ✅ CORRETO - Usar helpers domain-aware
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';

const urls = useStorefrontUrls(tenantSlug);
navigate(urls.checkout());
<Link to={urls.cart()}>Carrinho</Link>
```

### 2. Helpers disponíveis (useStorefrontUrls)

| Método | Descrição |
|--------|-----------|
| `urls.home()` | Página inicial |
| `urls.cart()` | Carrinho |
| `urls.checkout()` | Checkout |
| `urls.thankYou()` | Página de obrigado |
| `urls.product(slug)` | Página de produto |
| `urls.category(slug)` | Página de categoria |
| `urls.page(slug)` | Página institucional |
| `urls.account()` | Área do cliente |
| `urls.accountOrders()` | Meus pedidos |
| `urls.accountOrderDetail(id)` | Detalhe do pedido |
| `urls.landing(slug)` | Landing page |

### 3. Comportamento por domínio

| Domínio | Base URL | Exemplo checkout |
|---------|----------|------------------|
| Custom (loja.example.com) | `/` (raiz) | `/checkout` |
| Platform ({tenant}.shops...) | `/` (raiz) | `/checkout` |
| Admin/Preview | `/store/{tenant}` | `/store/{tenant}/checkout` |

---

## Checklist de Validação (antes de PR/deploy)

### Testes obrigatórios em aba anônima:

- [ ] **Custom domain** (ex: loja.respeiteohomem.com.br)
  - [ ] Home → Produto → Carrinho → Checkout → Obrigado
  - [ ] Nenhuma URL contém `/store/{slug}`
  - [ ] Links "voltar" funcionam corretamente

- [ ] **Platform domain** (ex: {tenant}.shops.comandocentral.com.br)
  - [ ] Mesmo fluxo acima
  - [ ] Rotas funcionam na raiz do subdomínio

- [ ] **Área do cliente**
  - [ ] Login → Meus pedidos → Detalhe → Voltar
  - [ ] Logout redireciona corretamente

### Verificações técnicas:

- [ ] Console: sem erros de navegação
- [ ] Network: sem 404 em rotas
- [ ] Nenhuma chamada para `app.comandocentral.com.br` do storefront público
- [ ] Parâmetros `?preview=1` não propagados para links públicos

---

## ESLint: Regras ativas

O build **FALHARÁ** se detectar:

1. String literal contendo `/store/` em arquivos do storefront
2. Template string com `/store/` ou `tenantSlug` montando URL
3. Arquivos afetados: `src/pages/storefront/**` e `src/components/storefront/**`

**Mensagem de erro:**
```
❌ URL hardcoded detectada! Use useStorefrontUrls() ou publicUrls helpers.
```

---

## Arquivos-chave para referência

- `src/hooks/useStorefrontUrls.ts` - Hook principal para URLs
- `src/lib/publicUrls.ts` - Funções utilitárias de URL
- `src/lib/canonicalUrls.ts` - URLs canônicas para SEO
- `eslint.config.js` - Regras de lint anti-hardcode

---

## Troubleshooting

### "Meu link quebrou após deploy"
1. Verificar se usou helper ou hardcode
2. Testar em custom domain + platform domain
3. Checar console/network por 404

### "ESLint reclamando do meu código"
1. Substituir string manual por `useStorefrontUrls()`
2. Importar o hook no componente
3. Usar o método correspondente (ex: `urls.checkout()`)

### "Preciso de uma URL que não existe no helper"
1. Adicionar novo método em `useStorefrontUrls.ts`
2. Seguir o padrão: `isOnCustomDomain ? '/path' : basePath + '/path'`
3. Exportar e documentar aqui
