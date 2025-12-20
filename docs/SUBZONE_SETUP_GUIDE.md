# Configuração da Subzona shops.comandocentral.com.br

## Por que subzona separada?

O Universal SSL do Cloudflare cobre apenas:
- `domain.com`
- `*.domain.com`

**NÃO cobre** sub-subdomínios como `*.shops.comandocentral.com.br`.

Criando uma **zona separada** para `shops.comandocentral.com.br`, o Universal SSL dessa zona cobre automaticamente:
- `shops.comandocentral.com.br`
- `*.shops.comandocentral.com.br` ✅

## Passo a Passo

### 1. Criar a Zona no Cloudflare

1. No Cloudflare Dashboard, clique em **"Add a Site"**
2. Digite: `shops.comandocentral.com.br`
3. Selecione o plano **Free**
4. O Cloudflare vai mostrar os nameservers (ex: `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`)
5. **ANOTE OS NAMESERVERS** - você vai precisar deles

### 2. Delegar NS na Zona Pai

Na zona `comandocentral.com.br`, adicione registros NS:

| Type | Name | Content |
|------|------|---------|
| NS | shops | ada.ns.cloudflare.com |
| NS | shops | bob.ns.cloudflare.com |

Isso delega `shops.comandocentral.com.br` para os nameservers do Cloudflare da nova zona.

**IMPORTANTE**: Remova qualquer registro A/CNAME existente para `shops` na zona pai.

### 3. Configurar DNS na Nova Zona

Na zona `shops.comandocentral.com.br`, adicione:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | @ | orbit-commerce-os.lovable.app | ✅ ON |
| CNAME | * | shops.comandocentral.com.br | ✅ ON |

O wildcard (`*`) faz todos os subdomínios resolverem corretamente.

### 4. Configurar SSL/TLS

Na nova zona:
- Vá em **SSL/TLS** → **Overview**
- Selecione **Full (strict)**
- Vá em **Edge Certificates** e confirme que Universal SSL está ativo

### 5. Criar o Worker

Na nova zona:
1. Vá em **Workers Routes**
2. Clique em **Add Route**
3. Configure:
   - Route: `*.shops.comandocentral.com.br/*`
   - Worker: `shops-router` (seu worker existente)
4. Adicione outra rota:
   - Route: `shops.comandocentral.com.br/*`
   - Worker: `shops-router`

### 6. Configurar Variáveis do Worker

O Worker precisa das variáveis:
- `ORIGIN_HOST`: `orbit-commerce-os.lovable.app`
- `SUPABASE_URL`: `https://ojssezfjhdvvncsqyhyq.supabase.co`
- `SUPABASE_ANON_KEY`: sua chave anon

### 7. Aguardar Propagação DNS

- A delegação NS pode levar **até 48 horas** para propagar
- O Universal SSL deve ativar em **minutos** após a propagação

## Verificação

Use estes comandos para verificar:

```bash
# Verificar NS delegation
dig NS shops.comandocentral.com.br

# Verificar resolução do wildcard
dig respeite-o-homem.shops.comandocentral.com.br

# Verificar SSL (deve mostrar certificado válido)
curl -I https://respeite-o-homem.shops.comandocentral.com.br/
```

## O que muda no código

Com a subzona configurada:

1. **NÃO criar Custom Hostname** para subdomínios internos `*.shops.comandocentral.com.br`
2. **Manter Custom Hostname** apenas para domínios externos de clientes (ex: `loja.cliente.com.br`)
3. O `domains-provision-default` deve apenas registrar no banco com `ssl_status: 'active'` (SSL é automático via Universal)

## Troubleshooting

### NS não propagou
- Verifique se os registros NS na zona pai estão corretos
- Use `dig NS shops.comandocentral.com.br` para verificar
- Aguarde até 48h para propagação completa

### SSL não ativou
- Verifique se a zona está ativa no Cloudflare
- Vá em Edge Certificates e veja o status
- Universal SSL deve mostrar "Active"

### Worker não está processando
- Verifique as Worker Routes na nova zona
- O worker precisa estar vinculado à zona correta
- Verifique os logs do Worker

## Arquitetura Final

```
┌─────────────────────────────────────────────────────────────┐
│                    Zona: comandocentral.com.br              │
│                                                              │
│  NS shops → (delega para subzona)                           │
│  app.comandocentral.com.br → Admin                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Zona: shops.comandocentral.com.br              │
│                                                              │
│  Universal SSL cobre:                                        │
│    - shops.comandocentral.com.br                            │
│    - *.shops.comandocentral.com.br ✅                        │
│                                                              │
│  DNS:                                                        │
│    @ CNAME → origin                                         │
│    * CNAME → @                                              │
│                                                              │
│  Worker Routes:                                              │
│    *.shops.comandocentral.com.br/* → shops-router           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Origin (Lovable)                         │
│              orbit-commerce-os.lovable.app                   │
└─────────────────────────────────────────────────────────────┘
```
