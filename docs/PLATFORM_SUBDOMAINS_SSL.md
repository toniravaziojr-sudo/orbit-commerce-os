# SSL para Subdomínios da Plataforma

## O Problema

O Cloudflare Universal SSL cobre apenas:
- `comandocentral.com.br` (raiz)
- `*.comandocentral.com.br` (subdomínios de primeiro nível, ex: `shops.comandocentral.com.br`)

**NÃO cobre sub-subdomínios**:
- `respeite-o-homem.shops.comandocentral.com.br` ❌

## A Solução

Para que sub-subdomínios (`{tenant}.shops.comandocentral.com.br`) tenham SSL, usamos **Cloudflare for SaaS / Custom Hostnames**.

Cada tenant recebe um Custom Hostname individual que provisiona certificado DV automaticamente.

## Fluxo Automático

1. Usuário cria conta → `create_tenant_for_user()` cria tenant com slug
2. Sistema chama `domains-provision-default` com `tenant_id` e `tenant_slug`
3. Edge function:
   - Cria Custom Hostname no Cloudflare: `{slug}.shops.comandocentral.com.br`
   - Custom Origin Server: `shops.comandocentral.com.br`
   - SSL method: HTTP DCV (Domain Control Validation)
   - Salva `external_id` (CF hostname ID) no banco
4. Cloudflare provisiona certificado (1-5 minutos)
5. Quando usuário clica "Ativar Domínio" novamente, sistema verifica status via CF API

## Configuração Necessária no Cloudflare

### 1. DNS Records
```
shops.comandocentral.com.br     CNAME   origin-server.lovable.app   (Proxied ✓)
*.shops.comandocentral.com.br   CNAME   shops.comandocentral.com.br (Proxied ✓)
```

### 2. SSL/TLS Settings
- Encryption mode: **Full (Strict)**
- Edge Certificates: Universal SSL ativo

### 3. Cloudflare for SaaS (Custom Hostnames)
- Fallback Origin: `shops.comandocentral.com.br`
- Fallback Origin deve ser um hostname válido na mesma zona

### 4. Worker Routes
```
*.shops.comandocentral.com.br/*  →  shops-router (seu worker)
shops.comandocentral.com.br/*    →  shops-router
```

### 5. Secrets no Supabase
- `CLOUDFLARE_API_TOKEN`: Token com permissões para Custom Hostnames
- `CLOUDFLARE_ZONE_ID`: Zone ID da zona `comandocentral.com.br`

## Verificando Status

No painel do Cloudflare:
1. Vá em SSL/TLS → Custom Hostnames
2. Procure por `{tenant}.shops.comandocentral.com.br`
3. Status deve mostrar "Active" para SSL

No banco de dados:
```sql
SELECT domain, ssl_status, external_id, last_error 
FROM tenant_domains 
WHERE type = 'platform_subdomain';
```

## Troubleshooting

### ERR_SSL_VERSION_OR_CIPHER_MISMATCH
- Custom Hostname não existe ou SSL não está ativo
- Verificar se `external_id` está preenchido no banco
- Clicar "Ativar Domínio" para reprovisionar

### SSL pendente por muito tempo
- Verificar se fallback origin está configurado
- Verificar se DNS wildcard está proxied (laranja)
- Verificar logs da edge function `domains-provision-default`

### Custom Hostname não foi criado
- Verificar credenciais Cloudflare (token/zone_id)
- Ver logs da edge function para erros específicos

## Alternativa: Advanced Certificate Manager

Se preferir não usar Custom Hostnames individuais, é possível:
1. Adquirir Advanced Certificate Manager no Cloudflare
2. Criar certificado wildcard de segundo nível: `*.shops.comandocentral.com.br`
3. Remover lógica de Custom Hostnames da aplicação

Custo: ~$10/mês (pricing pode variar)
