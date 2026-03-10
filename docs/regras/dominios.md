# Domínios e DNS — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-03-06

---

## Visão Geral

O sistema de domínios implementa o padrão multi-tenant SaaS (similar ao Shopify/Tray):
- **Admin:** `app.comandocentral.com.br`
- **Storefront Padrão:** `{tenantSlug}.shops.comandocentral.com.br` (gratuito, automático)
- **Domínio Personalizado:** `loja.cliente.com.br` (self-service)

---

## Arquitetura de Domínios

### 1. Tipos de Domínio

| Tipo | Formato | SSL | Automático |
|------|---------|-----|------------|
| **Platform Subdomain** | `{slug}.shops.comandocentral.com.br` | ACM Wildcard | ✅ Sim |
| **Custom Domain** | `loja.cliente.com.br` | Custom Hostname | ❌ Self-service |
| **App Domain** | `app.comandocentral.com.br` | Cloudflare | ✅ Fixo |

### 2. Invariantes do Sistema

| Regra | Descrição |
|-------|-----------|
| **Domínio Padrão Obrigatório** | Todo tenant SEMPRE tem `{slug}.shops.comandocentral.com.br` |
| **Provisionamento Automático** | Criado automaticamente no signup via `domains-provision-default` |
| **Domínio Padrão Imutável** | Não pode ser removido; serve como backup e fallback |
| **Canonical Switching** | Quando custom domain vira primary, todos os links mudam automaticamente |
| **Redirect 301** | Worker faz redirect de domínio não-canonical para canonical |

---

## Tabela: tenant_domains

```sql
CREATE TABLE tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  domain TEXT NOT NULL,                    -- ex: "loja.cliente.com.br"
  type TEXT NOT NULL,                      -- 'platform_subdomain' | 'custom'
  status TEXT DEFAULT 'pending',           -- 'pending' | 'verified' | 'failed'
  ssl_status TEXT DEFAULT 'none',          -- 'none' | 'pending' | 'active' | 'failed'
  is_primary BOOLEAN DEFAULT false,
  verification_token TEXT,
  verified_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  external_id TEXT,                        -- Cloudflare Custom Hostname ID
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, domain)
);
```

### Status Flow

```
pending → verified (DNS TXT ok) → ssl_pending → ssl_active
                                             ↘ ssl_failed
```

---

## Edge Functions

### 1. domains-provision-default

**Propósito:** Provisionar domínio padrão no signup

| Campo | Valor |
|-------|-------|
| **Rota** | `POST /domains-provision-default` |
| **Auth** | Service Role (interno) |
| **verify_jwt** | `false` |
| **Chamado por** | `CreateStore.tsx` após criar tenant |

**Payload:**
```typescript
{ tenant_id: string; tenant_slug: string; }
```

**Comportamento:**
1. Cria/atualiza row em `tenant_domains` com `type='platform_subdomain'`
2. Define `status='verified'`, `ssl_status='active'` (ACM wildcard cobre)
3. Define `is_primary=true` se não existir outro primary
4. NÃO cria Custom Hostname no Cloudflare (ACM resolve)

---

### 2. domains-create

**Propósito:** Adicionar domínio personalizado

| Campo | Valor |
|-------|-------|
| **Rota** | `POST /domains-create` |
| **Auth** | JWT (owner/admin) |
| **verify_jwt** | `true` |

**Payload:**
```typescript
{ tenant_id: string; domain: string; }
```

**Response:**
```typescript
{
  success: boolean;
  domain_id?: string;
  dns_instructions?: {
    cname_host: string;      // ex: "loja"
    cname_target: string;    // "shops.comandocentral.com.br"
    txt_host: string;        // "_cc-verify" ou "_cc-verify.loja"
    txt_value: string;       // "cc-verify=TOKEN"
  };
}
```

---

### 3. domains-verify

**Propósito:** Verificar DNS TXT para domínio custom

| Campo | Valor |
|-------|-------|
| **Rota** | `POST /domains-verify` |
| **Auth** | JWT |
| **verify_jwt** | `true` |

**Comportamento:**
1. Consulta `_cc-verify.{domain}` via DoH (Cloudflare DNS-over-HTTPS)
2. Verifica se TXT contém `cc-verify={verification_token}`
3. Atualiza `status='verified'`, `verified_at=now()`

---

### 4. domains-provision

**Propósito:** Criar/verificar/deletar Custom Hostname no Cloudflare

| Campo | Valor |
|-------|-------|
| **Rota** | `POST /domains-provision` |
| **Auth** | JWT |
| **verify_jwt** | `true` |

**Actions:**
- `provision`: Cria Custom Hostname no Cloudflare
- `check_status`: Verifica status do SSL
- `delete`: Remove Custom Hostname

**Cloudflare API:**
```typescript
// Create Custom Hostname
POST /zones/{zone_id}/custom_hostnames
{
  hostname: "loja.cliente.com.br",
  ssl: {
    method: "http",
    type: "dv",
    settings: { http2: "on", min_tls_version: "1.2" }
  }
}
```

---

### 5. domains-refresh-status

**Propósito:** Atualizar status de verificação e SSL

| Campo | Valor |
|-------|-------|
| **Rota** | `POST /domains-refresh-status` |
| **Auth** | JWT |
| **verify_jwt** | `true` |

---

### 6. resolve-domain

**Propósito:** Resolver hostname para tenant (usado pelo Worker e como fallback)

| Campo | Valor |
|-------|-------|
| **Rota** | `GET/POST /resolve-domain` |
| **Auth** | Público |
| **verify_jwt** | `false` |
| **Versão** | v2.0.0 — Refatorado para usar `_shared/resolveTenant.ts` |

> **NOTA (v4.0.0 do bootstrap):** Para o storefront, `storefront-bootstrap` aceita `hostname` diretamente e faz a resolução internamente usando a mesma lógica compartilhada. `resolve-domain` continua existindo para o Worker e outros consumidores.

**Lógica Compartilhada:**
```
supabase/functions/_shared/resolveTenant.ts
  ├─ resolveTenantFromHostname(supabase, hostname) → ResolvedTenant | ResolveNotFound
  ├─ parsePlatformSubdomain(hostname) → string | null
  └─ isAppDomain(hostname) → boolean
```

**PROIBIDO:** Duplicar lógica de resolução de domínio. Sempre importar de `_shared/resolveTenant.ts`.

**Response:**
```typescript
{
  found: boolean;
  tenant_slug?: string;
  tenant_id?: string;
  domain_type?: 'platform_subdomain' | 'custom';
  canonical_origin?: string;
  primary_public_host?: string;
  is_primary?: boolean;
  has_custom_primary?: boolean;
}
```

---

## Cloudflare Setup

### DNS Records Necessários

| Tipo | Nome | Destino | Proxy |
|------|------|---------|-------|
| CNAME | `shops` | `origin-server.lovable.app` | ✅ ON |
| CNAME | `*.shops` | `shops.comandocentral.com.br` | ✅ ON |

### SSL/TLS

| Configuração | Valor |
|--------------|-------|
| **Mode** | Full (Strict) |
| **ACM** | Wildcard `*.shops.comandocentral.com.br` |
| **Custom Hostnames** | Apenas para domínios externos |

### Worker Routes

```
*.shops.comandocentral.com.br/*  →  shops-router
shops.comandocentral.com.br/*    →  shops-router
```

### Secrets Necessários

| Secret | Descrição |
|--------|-----------|
| `CLOUDFLARE_API_TOKEN` | Token com permissões Custom Hostnames + DNS |
| `CLOUDFLARE_ZONE_ID` | Zone ID de `comandocentral.com.br` |

---

## Frontend: Hooks e Helpers

### useTenantDomains

```typescript
// src/hooks/useTenantDomains.ts
const {
  domains,           // Lista de domínios
  isLoading,
  addDomain,         // Adicionar custom domain (retorna TenantDomain)
  verifyDomain,      // Verificar DNS
  provisionSSL,      // Criar Custom Hostname
  checkSSLStatus,    // Verificar SSL
  setPrimaryDomain,  // Definir como principal
  removeDomain,      // Remover (exceto platform_subdomain)
  provisionDefaultDomain, // Provisionar padrão
  refetch,           // Recarregar lista de domínios
} = useTenantDomains();
```

### AddDomainDialog

```typescript
// Props
interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDomainAdded?: () => void; // Callback para recarregar lista após adicionar domínio
}
```

**IMPORTANTE:** O `DomainSettingsContent` deve passar `refetch` como `onDomainAdded` para sincronizar a lista após o dialog fechar.

### usePrimaryPublicHost

```typescript
// src/hooks/usePrimaryPublicHost.ts
const {
  primaryHost,        // Host principal (custom ou platform)
  primaryOrigin,      // https://{primaryHost}
  hasCustomDomain,    // true se custom domain ativo
  platformSubdomainUrl,
  customDomain,
} = usePrimaryPublicHost(tenantId, tenantSlug);
```

### useTenantCanonicalDomain

```typescript
// src/hooks/useTenantCanonicalDomain.ts
const {
  domain,            // Custom domain verificado/ativo ou null
  isLoading,
  hasCustomDomain,
} = useTenantCanonicalDomain(tenantId);
```

### Canonical URL Helpers

```typescript
// src/lib/canonicalDomainService.ts
SAAS_CONFIG.domain              // "comandocentral.com.br"
SAAS_CONFIG.storefrontSubdomain // "shops"
SAAS_CONFIG.appSubdomain        // "app"
SAAS_CONFIG.fallbackOrigin      // "https://orbit-commerce-os.lovable.app"
SAAS_CONFIG.targetHostname      // "app.comandocentral.com.br"

getPlatformSubdomainUrl(slug)   // "https://{slug}.shops.comandocentral.com.br"
getCanonicalOrigin(custom, slug) // Retorna origin correto
getPublicProductUrl(slug, productSlug, custom)
getPublicCategoryUrl(slug, categorySlug, custom)
getPublicCheckoutUrl(slug, custom)
// etc.
```

---

## Fluxo de Cadastro de Domínio Custom

### Regra Principal: Um Domínio = Uma Entrada

O sistema cadastra **exatamente um domínio** por vez. Não há criação automática de companion (apex↔www).
O usuário escolhe qual domínio será servido pela loja e cadastra apenas esse.

Se o usuário quiser que ambas as versões (com e sem www) funcionem, ele configura um **redirect** da outra versão no seu gerenciador de DNS (ex: Cloudflare Page Rules).

### 1. Cliente adiciona domínio

```
Admin → Configurações → Domínios → "Adicionar Domínio"
↓
Sistema valida formato e gera token
↓
Cria UMA entrada no banco (tenant_domains)
↓
Exibe instruções de DNS:
  - TXT de verificação com nome correto (_cc-verify ou _cc-verify.{sub})
  - CNAME apontando para shops.comandocentral.com.br
  - Aviso sobre domínio raiz (CNAME Flattening necessário)
  - Dica sobre redirect da outra versão (www↔apex)
```

#### Instruções por tipo de domínio

##### Domínio raiz (ex: `respeiteohomem.com.br`)

| Registro | Nome | Destino/Valor | Propósito |
|----------|------|---------------|-----------|
| TXT | `_cc-verify` | `cc-verify=TOKEN` | Verificar propriedade |
| CNAME | `@` | `shops.comandocentral.com.br` | Apontar domínio |

⚠️ **CNAME no raiz requer gerenciador com CNAME Flattening** (ex: Cloudflare). Provedores tradicionais como Registro.br não suportam. Nesses casos, o sistema orienta o usuário a cadastrar a versão `www` ou migrar o DNS para Cloudflare.

##### Subdomínio (ex: `www.respeiteohomem.com.br` ou `loja.cliente.com.br`)

| Registro | Nome | Destino/Valor | Propósito |
|----------|------|---------------|-----------|
| TXT | `_cc-verify.{sub}` | `cc-verify=TOKEN` | Verificar propriedade |
| CNAME | `{sub}` (www, loja, etc.) | `shops.comandocentral.com.br` | Apontar domínio |

### 2. Cliente configura DNS

```
Cliente acessa provedor de DNS (Cloudflare, Registro.br, GoDaddy, etc.)
↓
Cria TXT de verificação
Cria CNAME apontando para shops.comandocentral.com.br
↓
Se usar Cloudflare: ver seção "Proxy Status do CNAME (Orange-to-Orange)" abaixo
↓
Aguarda propagação (até 48h)
```

#### ⚠️ Proxy Status do CNAME servido — Regra Orange-to-Orange (O2O)

**REGRA CRÍTICA:** O proxy status do CNAME que aponta para `shops.comandocentral.com.br` depende de **onde a zona do cliente está hospedada**:

| Cenário | Proxy Status | Motivo |
|---------|-------------|--------|
| Zona do cliente **no Cloudflare** (mesma ou outra conta) | **Proxied (🟠 nuvem laranja)** | Ativa roteamento Orange-to-Orange (O2O) — sem isso, Erro 1014 |
| Zona do cliente **fora do Cloudflare** (GoDaddy, Registro.br, etc.) | **DNS-only (cinza)** ou N/A | Sem proxy do Cloudflare; Custom Hostname funciona direto |

**Por que isso é necessário?**

Quando ambas as zonas (a do cliente e `comandocentral.com.br`) estão no Cloudflare, um CNAME DNS-only de uma conta para outra dispara o **Erro 1014: CNAME Cross-User Banned**. Mesmo com Custom Hostname ativo, o Cloudflare bloqueia na camada DNS antes de chegar ao Custom Hostname.

A solução é ativar o **proxy (nuvem laranja)** no CNAME do cliente. Isso ativa o roteamento **Orange-to-Orange (O2O)**, onde o Cloudflare reconhece internamente o Custom Hostname e roteia o tráfego corretamente entre as zonas.

**Diagnóstico rápido:**
- Erro 1014 no domínio custom + Custom Hostname ativo no painel → **cliente está no Cloudflare com CNAME DNS-only → trocar para Proxied**

**IMPORTANTE:** Essa regra se aplica APENAS ao CNAME do domínio servido (o que aponta para `shops.comandocentral.com.br`). Os registros de redirect (A dummy, etc.) seguem suas próprias regras de proxy.

### 3. Verificação

```
Cliente clica "Verificar DNS"
↓
Sistema consulta _cc-verify.{domain} via DoH
↓
Se TXT válido → status='verified'
```

### 4. Provisionamento SSL

```
Cliente clica "Ativar SSL"
↓
Sistema cria Custom Hostname no Cloudflare
↓
Cloudflare emite certificado DV (1-5 min)
↓
ssl_status='active'
```

### 5. Definir como Principal

```
Domínio ativo pode ser definido como principal
↓
Todos os links da loja usam esse domínio
↓
Platform subdomain redireciona para o domínio principal
```

### 6. Redirect da outra versão (opcional)

Se o usuário quiser que ambas as versões (com e sem www) funcionem:

```
O domínio cadastrado no sistema é o domínio "servido"
↓
A outra versão deve redirecionar via Cloudflare Redirect Rules
↓
Para isso, o registro DNS da outra versão precisa de PROXY ATIVADO (nuvem laranja)
```

#### Cenário: Cadastrou `www.seusite.com.br` e quer que `seusite.com.br` redirecione

1. No DNS do Cloudflare, crie: `A @ → 192.0.2.1` com **proxy ativado** (nuvem laranja)
   - O IP `192.0.2.1` é um endereço dummy (RFC 5737) — o tráfego nunca chega lá
   - O proxy precisa estar ativo para que Redirect Rules funcionem
2. Em **Rules → Redirect Rules**, crie:
   - **When:** Hostname equals `seusite.com.br`
   - **Then:** Dynamic redirect → `concat("https://www.seusite.com.br", http.request.uri.path)`
   - **Status:** 301 (Permanente)
   - **Preserve query string:** ✅

#### Cenário: Cadastrou `seusite.com.br` e quer que `www.seusite.com.br` redirecione

1. No DNS do Cloudflare, crie: `CNAME www → seusite.com.br` com **proxy ativado** (nuvem laranja)
2. Em **Rules → Redirect Rules**, crie:
   - **When:** Hostname equals `www.seusite.com.br`
   - **Then:** Dynamic redirect → `concat("https://seusite.com.br", http.request.uri.path)`
   - **Status:** 301 (Permanente)
   - **Preserve query string:** ✅

**IMPORTANTE:**
- O sistema NÃO gerencia esse redirect. É responsabilidade do usuário configurar no Cloudflare.
- O registro DNS de redirect **PRECISA do proxy ativado** (nuvem laranja) — sem proxy, Redirect Rules não funcionam.
- O CNAME que aponta para `shops.comandocentral.com.br` (domínio servido) deve ser **Proxied (nuvem laranja)** se a zona do cliente estiver no Cloudflare (O2O), ou **DNS-only** se estiver fora do Cloudflare. Ver seção "Proxy Status do CNAME (Orange-to-Orange)".
- Page Rules NÃO funcionam sem proxy; prefira **Redirect Rules**.

---

## Canonical Redirect (Worker)

### Hostname no Worker

O Worker **NÃO remove `www.`** do hostname. O hostname exato do navegador é preservado e enviado para a edge function `resolve-domain`, que faz a busca com e sem www na tabela `tenant_domains`.

Isso permite que o lojista cadastre tanto `www.site.com.br` quanto `site.com.br` — o sistema resolve ambos corretamente.

```javascript
// Worker - linha de publicHost (SEM strip de www)
const publicHost = (cfHost || edgeHost).toLowerCase();
// ❌ ERRADO: .replace(/^www\./, '') — NÃO fazer isso
```

### Comportamento

1. Request chega em `{slug}.shops.comandocentral.com.br` ou domínio custom
2. Worker chama `resolve-domain` com o hostname **exato** (incluindo www se presente)
3. `resolve-domain` busca na tabela com `.or(domain.eq.${hostname},domain.eq.${hostnameWithoutWww},domain.eq.${hostnameWithWww})` — ou seja, busca o hostname exato, sem www e com www (3 variações)
4. Se `has_custom_primary=true` e host atual ≠ primary:
   - 301 Redirect para `https://{primary_public_host}{path}{query}`
5. Se não tem custom primary ou é o host correto:
   - Proxia para origin

### Paths que NÃO fazem redirect

```typescript
const NO_REDIRECT_PATHS = [
  '/auth', '/login', '/logout', 
  '/admin', '/account',
  '/api/', '/@vite/', '/assets/'
];
```

---

## Componentes de UI

| Componente | Local | Propósito |
|------------|-------|-----------|
| `AddDomainDialog` | `src/components/settings/AddDomainDialog.tsx` | Modal adicionar domínio |
| `DomainInstructionsDialog` | `src/components/settings/DomainInstructionsDialog.tsx` | Ver instruções de um domínio |
| `DomainSettingsContent` | `src/components/settings/DomainSettingsContent.tsx` | Painel completo de domínios |
| `DomainsPlatformSettings` | `src/components/integrations/DomainsPlatformSettings.tsx` | Config Cloudflare (admin) |

---

## Anti-Patterns (Proibidos)

| Proibido | Correto |
|----------|---------|
| `window.location.origin` para URLs públicas | `usePrimaryPublicHost()` ou `getPlatformSubdomainUrl()` |
| Hardcode `app.comandocentral.com.br` em links de loja | Usar `getPublicProductUrl()`, `getCanonicalOrigin()` |
| Criar Custom Hostname para `*.shops` | ACM wildcard já cobre |
| Deletar `platform_subdomain` | Proibido - é backup imutável |
| Usar `fallbackOrigin` como canonical em prod | Só para dev/preview |
| `getSubdomainName` sem tratar TLDs de 2 partes | Usar lógica com `twoPartTLDs` array |
| Mostrar `_cc-verify.respeiteohomem` para apex `.com.br` | Correto: `_cc-verify` (sem sufixo) |
| Criar companion apex↔www automaticamente | Sistema cria UMA entrada por domínio |
| Assumir que www ou apex será criado junto | Cada domínio é independente |

---

## ⚠️ Limitações Conhecidas

### Domínio Apex (raiz) — Requer CNAME Flattening

CNAME no domínio raiz não é universalmente suportado:

1. **Registro.br** — Não suporta CNAME no apex
2. **Cloudflare** — Suporta via CNAME Flattening (proxy deve estar desativado para nosso caso)
3. **Route53, Vercel DNS** — Suportam via ALIAS/CNAME Flattening

Se o provedor não suporta, o sistema orienta o usuário a:
- Cadastrar a versão `www` do domínio, ou
- Migrar o DNS para um gerenciador como Cloudflare (gratuito)

### Redirect da outra versão (www↔apex)

O sistema **não gerencia** o redirect entre www e apex. Isso é responsabilidade do usuário, configurado no Cloudflare (Redirect Rules). A UI agora exibe instruções detalhadas incluindo:
- Registro A dummy (`192.0.2.1`) com proxy ativado para apex
- Registro CNAME com proxy ativado para www
- Configuração de Redirect Rule com expressão dinâmica

### UI: Avisos no AddDomainDialog e DomainInstructionsDialog

Os componentes `AddDomainDialog` e `DomainInstructionsDialog` exibem:
- Aviso âmbar para domínio raiz (sobre CNAME Flattening)
- Aviso âmbar sobre **proxy O2O**: se DNS do cliente está no Cloudflare, o CNAME servido deve estar com proxy ativado (nuvem laranja 🟠) para evitar Erro 1014
- Instruções detalhadas de redirect (registro A/CNAME + Redirect Rule) contextuais ao tipo de domínio

### Regras

| Regra | Descrição |
|-------|-----------|
| **Um domínio = uma entrada** | Sistema cria exatamente um registro por domínio cadastrado |
| **Sem companion automático** | Não criar apex+www juntos automaticamente |
| **CNAME para todos** | Instrução é sempre CNAME, com aviso sobre apex |
| **Redirect é externo** | Redirect www↔apex é responsabilidade do usuário no Cloudflare |
| **Instrução de proxy (CNAME servido)** | Se zona no Cloudflare: Proxied (laranja/O2O). Se zona fora: DNS-only (cinza) |
| **Instrução de proxy (redirect)** | Registro de redirect: sempre proxy ativado (laranja) |
| **Registro A dummy** | Para redirect de apex: `A @ → 192.0.2.1` com proxy (RFC 5737) |

---

## Checklist de Validação

- [ ] Todo tenant tem domínio padrão ao criar conta
- [ ] Domínio padrão é `{slug}.shops.comandocentral.com.br`
- [ ] Domínio padrão tem `ssl_status='active'` automaticamente
- [ ] Não é possível remover domínio padrão
- [ ] Custom domain só pode ser primary se `status='verified' && ssl_status='active'`
- [ ] Canonical redirect funciona de platform subdomain para custom domain
- [ ] Links na loja usam domínio primary corretamente
- [ ] Worker deleta Host header antes de proxiar (evita 404)
- [ ] AddDomain cria UMA entrada (sem companion)
- [ ] Instruções DNS corretas para apex vs subdomínio

---

## Purge de Cache

| Campo | Valor |
|-------|-------|
| **Tipo** | Ação / Botão |
| **Localização** | `src/components/settings/DomainSettingsContent.tsx` |
| **Contexto** | Configurações → Domínios → Card "Limpar Cache da Loja" |
| **Descrição** | Permite ao tenant limpar o cache do Cloudflare Worker manualmente quando alterações (produtos, menus, etc.) não aparecem na loja pública |
| **Comportamento** | Chama `cachePurge.full(tenantId)` via `storefrontCachePurge`. Exibe loading state e toast de sucesso/erro |
| **Condições** | Requer tenant logado com domínio configurado |
| **Afeta** | Cache do Cloudflare Worker para todos os domínios do tenant |

---

## Documentação Relacionada

| Arquivo | Conteúdo |
|---------|----------|
| `docs/DOMAIN_SYSTEM_ARCHITECTURE.md` | Arquitetura completa |
| `docs/CUSTOM_DOMAINS_SETUP.md` | Setup inicial |
| `docs/CLOUDFLARE_SETUP_GUIDE.md` | Configuração Cloudflare |
| `docs/PLATFORM_SUBDOMAINS_SSL.md` | SSL para subdomínios |
| `docs/SUBZONE_SETUP_GUIDE.md` | Subzone alternativa |
