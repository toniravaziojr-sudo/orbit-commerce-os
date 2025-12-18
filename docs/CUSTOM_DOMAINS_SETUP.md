# Configuração de Domínios Personalizados por Tenant

Este documento descreve como configurar a infraestrutura para suportar domínios personalizados por tenant com SSL automático.

## Visão Geral

O sistema usa Cloudflare como edge/proxy para:
1. Receber requisições de domínios de clientes
2. Resolver qual tenant corresponde ao domínio
3. Emitir SSL automaticamente via Custom Hostnames
4. Encaminhar para o storefront correto

## Pré-requisitos

- Conta Cloudflare com o domínio base da plataforma (respeiteohomem.com.br)
- Cloudflare for SaaS / Custom Hostnames habilitado (plano Business ou Enterprise, ou add-on)
- Acesso às configurações de Workers e DNS

## Configuração Passo a Passo

### 1. Configurar o Hostname Base (SaaS Hostname)

No Cloudflare Dashboard:

1. Vá para o domínio `respeiteohomem.com.br`
2. DNS → Adicione um registro:
   - **Tipo:** A (ou CNAME se preferir)
   - **Nome:** `shops`
   - **Destino:** IP do seu servidor ou CNAME para Lovable
   - **Proxy:** Ativado (laranja)

### 2. Habilitar Cloudflare for SaaS

1. Vá para **SSL/TLS → Custom Hostnames**
2. Configure o fallback origin: `shops.respeiteohomem.com.br`
3. Anote o **Zone ID** (visível na página Overview)

### 3. Criar API Token

1. Vá para **My Profile → API Tokens**
2. Crie um token com permissões:
   - **Zone:SSL and Certificates:Edit**
   - **Zone:DNS:Edit** (opcional)
3. Escopo: Zona específica (`respeiteohomem.com.br`)
4. Anote o token gerado

### 4. Configurar Secrets no Supabase

Adicione os seguintes secrets no projeto Supabase:

```
CLOUDFLARE_API_TOKEN=seu_token_aqui
CLOUDFLARE_ZONE_ID=seu_zone_id_aqui
```

Comandos (via Supabase CLI):
```bash
supabase secrets set CLOUDFLARE_API_TOKEN=seu_token_aqui
supabase secrets set CLOUDFLARE_ZONE_ID=seu_zone_id_aqui
```

### 5. Deploy do Cloudflare Worker (Opcional mas Recomendado)

O Worker roteia requisições por hostname para o tenant correto.

1. Crie um novo Worker no Cloudflare Dashboard
2. Cole o código de `docs/cloudflare-worker-template.js`
3. Configure as variáveis de ambiente:
   - `ORIGIN_HOST`: `orbit-commerce-os.lovable.app`
   - `SUPABASE_URL`: `https://ojssezfjhdvvncsqyhyq.supabase.co`
4. Configure as rotas:
   - `shops.respeiteohomem.com.br/*` → Worker

### 6. Criar KV Namespace (Para Cache)

1. Workers & Pages → KV
2. Crie um namespace: `TENANT_CACHE`
3. Vincule ao Worker nas configurações

## Fluxo de Uso (Cliente/Tenant)

### Do lado do cliente (usuário da plataforma):

1. **Admin → Configurações → Domínios**
2. Clica "Adicionar Domínio" e digita `loja.respeiteohomem.com.br`
3. Sistema gera um token de verificação
4. Cliente configura no DNS dele:
   - TXT `_cc-verify` com valor `cc-verify=TOKEN`
   - CNAME `loja` → `shops.respeiteohomem.com.br`
5. Clica "Verificar DNS"
6. Após verificado, clica "Ativar SSL"
7. Aguarda SSL ficar "Ativo"
8. Define como "Principal" se desejar

### O que acontece por trás:

1. **Verificação:** Edge function `domains-verify` consulta DNS via DoH
2. **Provisionamento:** Edge function `domains-provision` cria Custom Hostname no Cloudflare
3. **SSL:** Cloudflare emite certificado automaticamente
4. **Roteamento:** Worker resolve hostname → tenant e encaminha para storefront

## Troubleshooting

### SSL não ativa

- Verifique se o CNAME está apontando corretamente
- DNS pode levar até 48h para propagar
- Verifique logs da edge function `domains-provision`

### Domínio não resolve

- Confirme que o Worker está configurado na rota correta
- Verifique logs do Worker
- Confirme que `resolve-domain` está retornando o tenant

### Erro de credenciais

- Verifique se os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ZONE_ID` estão configurados
- Confirme que o token tem as permissões corretas

## Arquitetura

```
Cliente acessa: loja.respeiteohomem.com.br
         │
         ▼
┌─────────────────────────┐
│   Cloudflare Edge       │
│   (Custom Hostname)     │
│   SSL: loja.*.com.br    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Cloudflare Worker     │
│   resolve hostname      │
│   → tenant_slug         │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Edge Function         │
│   resolve-domain        │
│   query: tenant_domains │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Origin (Lovable)      │
│   /store/{tenant_slug}  │
└─────────────────────────┘
```

## Referências

- [Cloudflare Custom Hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
