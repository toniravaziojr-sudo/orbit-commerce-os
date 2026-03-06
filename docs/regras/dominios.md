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

**Propósito:** Resolver hostname para tenant (usado pelo Worker)

| Campo | Valor |
|-------|-------|
| **Rota** | `GET/POST /resolve-domain` |
| **Auth** | Público |
| **verify_jwt** | `false` |

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
  addDomain,         // Adicionar custom domain (retorna { primary, companion })
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

### 1. Cliente adiciona domínio

```
Admin → Configurações → Domínios → "Adicionar Domínio"
↓
Sistema valida formato e gera token
↓
Exibe instruções de DNS COM o nome correto do TXT:
  - AddDomainDialog usa getTxtRecordName() dinâmico
  - Para subdomínios (www, loja, etc.): _cc-verify.{sub}
  - Para apex (incluindo .com.br): _cc-verify
  - IMPORTANTE: getSubdomainName() considera TLDs de duas partes (.com.br, .co.uk)
    - respeiteohomem.com.br → apex → TXT: _cc-verify
    - www.respeiteohomem.com.br → sub "www" → TXT: _cc-verify.www
  - Token é exibido com botão de copiar e destaque visual
```

#### Regras para Domínio Apex (raiz) ↔ www (Fluxo Unificado)

Quando o domínio adicionado é um **domínio apex** (ex: `respeiteohomem.com.br`) OU **www** (ex: `www.respeiteohomem.com.br`), o sistema:

1. **Cria automaticamente AMBOS os registros** (apex + www) no banco — o usuário NÃO precisa cadastrar duas vezes
2. **Exibe instruções completas para os dois domínios** no mesmo fluxo (dois TXTs + dois CNAMEs)
3. **Cada domínio gera seu próprio token** — o token do apex ≠ token do www

| Registro | Nome | Destino/Valor | Propósito |
|----------|------|---------------|-----------|
| CNAME | `@` (raiz) | `shops.comandocentral.com.br` | Apontar domínio raiz |
| CNAME | `www` | `shops.comandocentral.com.br` | Apontar subdomínio www |
| TXT | `_cc-verify` | `cc-verify=TOKEN_APEX` | Verificar domínio raiz |
| TXT | `_cc-verify.www` | `cc-verify=TOKEN_WWW` | Verificar subdomínio www |

4. **O prefixo `www.` é preservado** na lógica de classificação para garantir o nome correto do registro TXT
5. **Após ambos verificados**, o usuário define qual é o **Principal** — o outro redireciona automaticamente via Worker
6. **Instrução de CNAME apex inclui aviso**: se já existir registro A/AAAA/CNAME para `@`, instruir o usuário a alterar o destino (não duplicar)

#### Regras para Subdomínio (ex: `loja.cliente.com.br`)

Quando é um **subdomínio**, apenas UM conjunto é necessário:

| Registro | Nome | Destino/Valor |
|----------|------|---------------|
| CNAME | `loja` | `shops.comandocentral.com.br` |
| TXT | `_cc-verify.loja` | `cc-verify=TOKEN` |

### 2. Cliente configura DNS

```
Cliente acessa provedor de DNS (Cloudflare, GoDaddy, etc.)
↓
Adiciona registros CNAME e TXT (conforme instruções acima)
↓
Importante: Proxy deve estar DESLIGADO (nuvem cinza / "DNS only")
↓
Aguarda propagação (até 48h)
```

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
Cliente clica "Definir como Principal"
↓
Sistema valida: status='verified' && ssl_status='active'
↓
is_primary=true (outros viram false)
↓
Todos os links da loja agora usam este domínio
```

---

## Canonical Redirect (Worker)

### Comportamento

1. Request chega em `{slug}.shops.comandocentral.com.br`
2. Worker chama `resolve-domain` para obter `primary_public_host`
3. Se `has_custom_primary=true` e host atual ≠ primary:
   - 301 Redirect para `https://{primary_public_host}{path}{query}`
4. Se não tem custom primary ou é o host correto:
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
| `DomainsList` | `src/components/settings/DomainsList.tsx` | Lista de domínios |
| `AddDomainDialog` | `src/components/settings/AddDomainDialog.tsx` | Modal adicionar |
| `DomainStatusBadge` | `src/components/settings/DomainStatusBadge.tsx` | Badge de status |
| `DNSInstructions` | `src/components/settings/DNSInstructions.tsx` | Instruções DNS |
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

---

## ⚠️ Limitação: Domínios Apex no Cloudflare (Erro 1014)

### Problema

Quando o domínio do cliente está configurado **como zona no Cloudflare** (nameservers apontando para o Cloudflare), domínios **apex (raiz)** apresentam **Erro 1014: CNAME Cross-User Banned**.

**Causa:** O Cloudflare realiza **CNAME flattening** internamente para domínios apex. Quando o destino do CNAME (`shops.comandocentral.com.br`) pertence a outra conta Cloudflare, o Cloudflare bloqueia a resolução por segurança.

**Subdomínios NÃO são afetados** — `loja.cliente.com.br` ou `www.cliente.com.br` funcionam normalmente porque não passam por CNAME flattening.

**Este problema é EXCLUSIVO do Cloudflare.** Outros provedores DNS (Registro.br, GoDaddy, Namecheap, Route53, etc.) funcionam sem problemas.

### Soluções para o Cliente

| Opção | Descrição | Estabilidade |
|-------|-----------|--------------|
| **1. Transferir DNS para registrador (Recomendada)** | No Registro.br: "Utilizar DNS do Registro.br". Criar CNAMEs lá. | ✅ Estável |
| **2. DNS-only no Cloudflare** | Manter no Cloudflare com proxy **desativado** (nuvem cinza) em todos os registros CNAME | ⚠️ Pode não resolver para apex |
| **3. Usar apenas subdomínio** | Usar `www.cliente.com.br` ou `loja.cliente.com.br` como primary | ✅ Estável |

### UI: Aviso no AddDomainDialog

O componente `AddDomainDialog` exibe um alerta laranja (`AlertTriangle`) na etapa de instruções DNS, informando sobre essa limitação e as soluções disponíveis. O aviso aparece para **todos os domínios** (apex e subdomínio) pois o sistema não tem como saber se o cliente usa Cloudflare.

### Regras

| Regra | Descrição |
|-------|-----------|
| **Aviso obrigatório** | O alerta sobre Cloudflare DEVE estar presente no fluxo de cadastro |
| **Não bloquear cadastro** | O sistema NÃO deve impedir o cadastro — apenas alertar |
| **Instrução de proxy** | Sempre instruir "DNS-only (nuvem cinza)" nos CNAMEs |

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

---

## Documentação Relacionada

| Arquivo | Conteúdo |
|---------|----------|
| `docs/DOMAIN_SYSTEM_ARCHITECTURE.md` | Arquitetura completa |
| `docs/CUSTOM_DOMAINS_SETUP.md` | Setup inicial |
| `docs/CLOUDFLARE_SETUP_GUIDE.md` | Configuração Cloudflare |
| `docs/PLATFORM_SUBDOMAINS_SSL.md` | SSL para subdomínios |
| `docs/SUBZONE_SETUP_GUIDE.md` | Subzone alternativa |
