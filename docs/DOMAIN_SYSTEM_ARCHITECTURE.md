# Sistema de Domínios Multi-Tenant (SaaS)

## Objetivo Final

Modelo SaaS profissional de domínios para storefronts, seguindo as melhores práticas de plataformas como Shopify/Tray.

## Invariantes do Sistema

### 1. Domínio Padrão (Backup Imutável)

- Todo tenant **SEMPRE** possui um domínio padrão: `https://{tenantSlug}.shops.comandocentral.com.br`
- Este domínio **NÃO PODE ser removido** pelo cliente na UI
- Serve como **backup permanente** caso o domínio custom seja removido ou tenha problemas
- SSL é automático via ACM (AWS Certificate Manager)

### 2. Domínios Personalizados (Custom)

- O cliente pode **adicionar/remover/substituir** domínios personalizados
- Um domínio pode ser marcado como **Principal**
- Para ser Principal, o domínio deve estar:
  - Verificado (status = 'verified')
  - Com SSL ativo (ssl_status = 'active')

### 3. Canonicalização e Redirects

Quando existe um domínio custom como **Principal**:

| Origem | Destino | Tipo |
|--------|---------|------|
| `{tenantSlug}.shops.comandocentral.com.br/*` | `loja.cliente.com.br/*` | 301 Redirect |
| `loja.cliente.com.br/*` | (serve conteúdo) | 200 OK |

Quando **NÃO existe** domínio custom:

| Origem | Destino | Tipo |
|--------|---------|------|
| `{tenantSlug}.shops.comandocentral.com.br/*` | (serve conteúdo) | 200 OK |

### 4. URL Limpa

- No domínio custom ou platform subdomain: URLs **limpas** sem `/store/{tenant}`
  - `https://loja.cliente.com.br/`
  - `https://loja.cliente.com.br/p/produto`
  - `https://loja.cliente.com.br/c/categoria`
  
- O path `/store/{tenantSlug}` é **interno** (traduzido pelo Worker) e nunca aparece na barra do navegador

### 5. Separação de Responsabilidades

| Domínio | Propósito |
|---------|-----------|
| `app.comandocentral.com.br` | Admin/Dashboard |
| `{tenantSlug}.shops.comandocentral.com.br` | Storefront público (platform) |
| `loja.cliente.com.br` | Storefront público (custom) |

## Arquitetura de Roteamento

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE (Worker)                          │
│  - Resolve hostname → tenant                                    │
│  - Path translation: / → /store/{tenant}/ (interno)             │
│  - Redirect 301: platform → custom (quando custom é Primary)    │
│  - URL limpa no browser (sem /store/{tenant})                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORIGIN (app.comandocentral.com.br)           │
│  - Recebe requests com /store/{tenant}/...                      │
│  - Roteia internamente via React Router                         │
│  - Retorna conteúdo do tenant                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Edge Functions Relacionadas

| Função | Propósito |
|--------|-----------|
| `resolve-domain` | Resolve hostname → tenant + canonical info |
| `domains-provision` | Provisiona SSL via Cloudflare for SaaS |
| `domains-provision-default` | Provisiona domínio platform subdomain |
| `domains-verify` | Verifica DNS TXT para domínios custom |

## Arquivos-Chave do Frontend

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/canonicalDomainService.ts` | Config SaaS + helpers de domínio |
| `src/lib/canonicalUrls.ts` | Geração de URLs canônicas |
| `src/lib/publicUrls.ts` | Geração de URLs públicas (para storefront) |
| `src/hooks/usePrimaryPublicHost.ts` | **Hook para URLs públicas no ADMIN** |
| `src/hooks/useStorefrontUrls.ts` | Hook para URLs no storefront |
| `src/hooks/useCanonicalUrls.ts` | Hook para URLs canônicas |
| `src/hooks/useTenantDomains.ts` | Gerenciamento de domínios |
| `src/hooks/useTenantCanonicalDomain.ts` | Fetch do domínio canônico |
| `src/components/storefront/TenantStorefrontLayout.tsx` | Layout + canonical redirect |
| `src/pages/Domains.tsx` | UI de gerenciamento de domínios |

## Regras Anti-Regressão (CRÍTICO)

### Regra 1: URLs Públicas no Admin

**NUNCA** usar as seguintes funções no código do admin (pages, components fora de storefront):
- `getPublicProductUrl` de `publicUrls.ts` (usa `window.location` errado)
- `getPublicCategoryUrl` de `publicUrls.ts`
- `getPublicPageUrl` de `publicUrls.ts`
- `getPublicLandingUrl` de `publicUrls.ts`

**SEMPRE** usar no admin:
```typescript
import { usePrimaryPublicHost, buildPublicStorefrontUrl } from '@/hooks/usePrimaryPublicHost';

// No componente:
const { primaryOrigin } = usePrimaryPublicHost(currentTenant?.id, currentTenant?.slug);

// Para gerar URLs:
const productUrl = buildPublicStorefrontUrl(primaryOrigin, `/p/${productSlug}`);
const categoryUrl = buildPublicStorefrontUrl(primaryOrigin, `/c/${categorySlug}`);
const pageUrl = buildPublicStorefrontUrl(primaryOrigin, `/page/${pageSlug}`);
const landingUrl = buildPublicStorefrontUrl(primaryOrigin, `/lp/${landingSlug}`);
```

### Regra 2: Separação Admin vs Storefront

| Contexto | Domínio Base | Funções Permitidas |
|----------|--------------|-------------------|
| Admin (src/pages/*.tsx exceto storefront) | `app.comandocentral.com.br` | `usePrimaryPublicHost` + `buildPublicStorefrontUrl` |
| Storefront (src/pages/storefront/*.tsx) | `{tenant}.shops...` ou custom | `getPublic*Url` de `publicUrls.ts` |
| Componentes do Builder (preview interno) | `app.comandocentral.com.br` | `getStoreBaseUrl` (caminhos relativos) |

### Regra 3: O que rege cada domínio

- **app.comandocentral.com.br** - Apenas admin/dashboard. NUNCA gerar links públicos usando este domínio.
- **{tenantSlug}.shops.comandocentral.com.br** - Storefront público (padrão/backup). 
- **loja.cliente.com.br** (custom) - Storefront público (primário quando ativo).

## Checklist de Testes (Anti-Regressão)

### Cenário 1: Sem domínio custom ativo

1. [ ] Acessar `https://{tenantSlug}.shops.comandocentral.com.br/` → 200 OK
2. [ ] Acessar `/p/{produto}` → 200 OK, URL limpa
3. [ ] Acessar `/c/{categoria}` → 200 OK, URL limpa
4. [ ] Acessar `/cart`, `/checkout`, `/obrigado` → 200 OK
5. [ ] Nenhum redirect 302

### Cenário 2: Com domínio custom Principal ativo

1. [ ] Acessar `https://loja.cliente.com.br/` → 200 OK
2. [ ] Acessar `/p/{produto}`, `/c/{categoria}` → 200 OK, URL limpa
3. [ ] Acessar `/cart`, `/checkout`, `/obrigado` → 200 OK
4. [ ] Acessar `https://{tenantSlug}.shops...` → **301 Redirect** para custom
5. [ ] URL na barra **nunca** mostra `/store/{tenant}`

### Cenário 3: Troca de domínio custom

1. [ ] Remover domínio custom atual → loja continua funcionando no platform
2. [ ] Adicionar novo domínio custom → verificar + SSL
3. [ ] Marcar como Principal → canonicalização funciona
4. [ ] Nenhum loop de 302 em nenhuma rota

### Cenário 4: Proteção do domínio padrão

1. [ ] Na UI, botão de excluir **NÃO aparece** para platform_subdomain
2. [ ] Se tentar excluir via código, retorna erro
3. [ ] Domínio padrão sempre existe como fallback

## Configuração do Worker (Cloudflare)

O Worker está documentado em: `docs/cloudflare-worker-template.js`

### Variáveis de Ambiente do Worker

| Variável | Valor |
|----------|-------|
| `ORIGIN_HOST` | `app.comandocentral.com.br` |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key (secreto) |

## Troubleshooting

### Loop de 302 Redirects

**Causa:** O origin está redirecionando para seu host canônico e o Worker reescreve, causando loop.

**Solução:**
1. Verificar que `ORIGIN_HOST` no Worker aponta para `app.comandocentral.com.br`
2. Worker segue redirects internamente (até 5x) sem expor ao browser
3. Worker reescreve headers `Location` para URL limpa

### ERR_TOO_MANY_REDIRECTS

**Causa:** Múltiplos redirects entre Worker e origin.

**Diagnóstico:**
1. Abrir DevTools → Network → "Preserve log"
2. Ver o primeiro 302 e seu header `Location`
3. O `Location` indica quem está forçando o redirect

### Domínio custom não funciona

1. Verificar DNS (CNAME apontando para `shops.comandocentral.com.br`)
2. Verificar TXT record de verificação
3. Verificar SSL status no painel
4. Cloudflare Custom Hostnames precisa estar provisionado

## Evolução Futura

Para escalar a 1000+ tenants com domínios custom:

1. **Cloudflare for SaaS (Custom Hostnames)** - já implementado
2. Wildcard SSL para `*.shops.comandocentral.com.br`
3. Cache no edge para assets estáticos
4. Possível migração do origin para Cloudflare Pages/Workers
