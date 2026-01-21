# Guia de Configuração do Cloudflare para Multi-Tenant SaaS

## Visão Geral

Este guia explica como configurar o Cloudflare para suportar:
1. **Subdomínios da plataforma**: `{tenant}.shops.comandocentral.com.br`
2. **Domínios personalizados**: `loja.cliente.com.br`

## Pré-requisitos

- Conta Cloudflare com a zona `comandocentral.com.br` configurada
- Cloudflare for SaaS habilitado (para Custom Hostnames)
- API Token do Cloudflare com permissões adequadas

---

## Passo 1: Configurar DNS no Cloudflare

### 1.1 Adicionar registros DNS

Vá em **DNS → Records** e adicione:

| Type | Name | Target | Proxy status |
|------|------|--------|--------------|
| CNAME | shops | orbit-commerce-os.lovable.app | Proxied (laranja) |
| CNAME | *.shops | orbit-commerce-os.lovable.app | Proxied (laranja) |

> **Importante**: NÃO remova esses registros. Eles são necessários para o Worker funcionar.

---

## Passo 2: Habilitar Cloudflare for SaaS

### 2.1 Ativar Custom Hostnames

1. Vá em **SSL/TLS → Custom Hostnames**
2. Clique em **Enable Cloudflare for SaaS**
3. Configure o **Fallback Origin**:
   - **Hostname**: `shops.comandocentral.com.br`

### 2.2 Gerar API Token

1. Vá em **My Profile → API Tokens → Create Token**
2. Selecione **Custom token**
3. Configure as permissões:

| Permission | Zone | Access |
|------------|------|--------|
| Zone - SSL and Certificates | comandocentral.com.br | Edit |
| Zone - Zone | comandocentral.com.br | Read |

4. Copie o token gerado

### 2.3 Obter Zone ID

1. Vá em **Overview** da zona `comandocentral.com.br`
2. No painel direito, copie o **Zone ID**

---

## Passo 3: Configurar Secrets no Supabase

No painel do Lovable Cloud, adicione os secrets:

| Secret Name | Value |
|-------------|-------|
| CLOUDFLARE_API_TOKEN | (token gerado no passo 2.2) |
| CLOUDFLARE_ZONE_ID | (zone ID copiado no passo 2.3) |

---

## Passo 4: Criar e Configurar o Worker

### 4.1 Criar o Worker

1. Vá em **Workers & Pages → Create application → Worker**
2. Nome: `shops-router`
3. Clique em **Edit code**
4. Cole o conteúdo do arquivo `docs/cloudflare-worker-template.js`
5. Clique em **Save and Deploy**

### 4.2 Configurar Variáveis do Worker

1. Vá em **Workers & Pages → shops-router → Settings → Variables**
2. Adicione as variáveis:

| Variable | Value |
|----------|-------|
| ORIGIN_HOST | orbit-commerce-os.lovable.app |
| SUPABASE_URL | https://ojssezfjhdvvncsqyhyq.supabase.co |
| SUPABASE_ANON_KEY | (sua anon key do Supabase) |

### 4.3 Configurar Rotas do Worker

1. Vá em **Workers & Pages → shops-router → Settings → Triggers → Routes**
2. Clique em **Add route**
3. Adicione as rotas:

| Route | Worker | Propósito |
|-------|--------|-----------|
| `*.shops.comandocentral.com.br/*` | shops-router | Storefronts multi-tenant |
| `shops.comandocentral.com.br/*` | shops-router | Redirect para app |
| `app.comandocentral.com.br/integrations/*` | shops-router | Proxy para Edge Functions |

> **Nota:** A rota `app.comandocentral.com.br/integrations/*` permite que webhooks de integrações (Meta, Stripe, etc.) usem URLs públicas do Comando Central em vez de URLs do Supabase.

---

## Passo 5: Testar a Configuração

### 5.1 Testar domínio padrão (shops)

1. No app, vá em **Configurações → Domínios**
2. Clique em **"Provisionar Domínio Padrão"**
3. Aguarde o status do SSL ficar "Active"
4. Em aba anônima, acesse: `https://{seu-tenant}.shops.comandocentral.com.br/`

### 5.2 Testar domínio personalizado

1. No app, vá em **Configurações → Domínios**
2. Clique em **"Adicionar Domínio Personalizado"**
3. Digite o domínio do cliente (ex: `loja.cliente.com.br`)
4. Siga as instruções de DNS (cliente deve configurar CNAME)
5. Clique em **"Verificar DNS"**
6. Após verificado, clique em **"Ativar SSL"**
7. Aguarde o status ficar "Active"

---

## Como Funciona

### Fluxo para domínios *.shops

```
Browser → Cloudflare Edge → Worker → Origin (Lovable)
                ↓
         Extrai tenant do subdomínio
         {tenant}.shops.comandocentral.com.br
                ↓
         X-Tenant-Slug: {tenant}
```

### Fluxo para domínios personalizados

```
Browser → Cloudflare Edge → Worker → Edge Function → Origin
                                         ↓
                                    resolve-domain
                                         ↓
                                  Consulta tenant_domains
                                         ↓
                                  Retorna tenant_slug
```

---

## Troubleshooting

### Erro SSL_VERSION_OR_CIPHER_MISMATCH

**Causa**: O hostname não tem certificado SSL válido no Cloudflare.

**Solução**: 
1. Verifique se o Custom Hostname foi criado no Cloudflare for SaaS
2. No app, chame a Edge Function `domains-provision-default` ou `domains-provision`
3. Aguarde o SSL ser emitido (pode levar alguns minutos)

### Erro "Domain not configured"

**Causa**: O Worker não conseguiu resolver o tenant.

**Solução**:
1. Verifique as rotas do Worker
2. Verifique as variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`
3. Verifique se o tenant existe no banco

### SSL demora para ativar

**Normal**: O Cloudflare pode levar até 15 minutos para emitir o certificado.

**Dica**: Clique em "Verificar Status SSL" para atualizar o status.

---

## Referências

- [Cloudflare Custom Hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare for SaaS API](https://developers.cloudflare.com/api/resources/custom_hostnames/)
