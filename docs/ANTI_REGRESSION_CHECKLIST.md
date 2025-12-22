# Checklist Anti-Regressão: URLs e Navegação no Storefront

> **IMPORTANTE**: Este documento define as regras obrigatórias para geração de URLs no storefront.
> Violações bloqueiam o build automaticamente.

---

## 🚨 Guardrails Implementados

### 1. ESLint (falha o build)
Arquivos em `src/pages/storefront/**` e `src/components/storefront/**` falham no build se contiverem:
- String literal com `/store/`
- Template string com `/store/` ou `tenantSlug`

### 2. Script de verificação
```bash
node scripts/check-hardcoded-urls.js
```
Escaneia o código e lista todas as violações com arquivo e linha.

### 3. Runtime safeguard (dev only)
Em modo desenvolvimento, warnings no console se uma URL gerada contiver:
- `/store/{slug}` em domínio custom
- `app.comandocentral.com.br` em link público

---

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

## 📋 Checklist de Release (antes de PR/deploy)

### Testes obrigatórios em aba anônima:

- [ ] **Rodar verificação de hardcoded URLs**
  ```bash
  node scripts/check-hardcoded-urls.js
  ```

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
- [ ] Console: sem warnings de DEV GUARD
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

## 🔧 Comandos úteis

```bash
# Verificar hardcoded URLs (roda antes do build)
node scripts/check-hardcoded-urls.js

# Lint completo
npm run lint

# Build (inclui lint)
npm run build
```

---

## Arquivos-chave para referência

- `src/hooks/useStorefrontUrls.ts` - Hook principal para URLs
- `src/lib/publicUrls.ts` - Funções utilitárias de URL
- `src/lib/canonicalUrls.ts` - URLs canônicas para SEO
- `src/lib/devGuards.ts` - Runtime safeguards (dev only)
- `scripts/check-hardcoded-urls.js` - Script de verificação
- `eslint.config.js` - Regras de lint anti-hardcode

---

## Troubleshooting

### "Meu link quebrou após deploy"
1. Verificar se usou helper ou hardcode
2. Rodar `node scripts/check-hardcoded-urls.js`
3. Testar em custom domain + platform domain
4. Checar console/network por 404

### "ESLint reclamando do meu código"
1. Substituir string manual por `useStorefrontUrls()`
2. Importar o hook no componente
3. Usar o método correspondente (ex: `urls.checkout()`)

### "Console mostrando DEV GUARD warning"
1. Identificar o contexto no warning
2. Substituir o código por helper domain-aware
3. Testar em ambos os domínios

### "Preciso de uma URL que não existe no helper"
1. Adicionar novo método em `useStorefrontUrls.ts`
2. Seguir o padrão: `isOnCustomDomain ? '/path' : basePath + '/path'`
3. Exportar e documentar aqui

---

## Fluxos críticos para validar

1. **Cart → Checkout**: Botão "Finalizar compra"
2. **Checkout → Obrigado**: Após criar pedido
3. **Obrigado → Home/Pedidos**: Links de navegação
4. **Header/Menu**: Links de categorias/páginas
5. **Conta → Pedidos → Detalhe**: Navegação completa
6. **MiniCart**: CTA e links de produtos
