# Pré-hidratação do cofre `_sf_identity` — v1 (somente e-mail marketing)

## Mudança em relação ao plano anterior

Após auditar o pipeline real, percebi que **mintar token no momento do clique (dentro do `email-track`) é muito mais simples e seguro do que mintar no broadcast**. O `email-track` já recebe `subscriber_id` + `tenant_id` na hora do clique e faz redirect 302 para a URL final. Isso elimina:
- Necessidade de pré-mintar milhões de tokens no broadcast
- Mudanças no compositor de e-mail
- TTL longo (passa a ser 5 min — clique→abertura é segundos)
- Risco de token vazado por link compartilhado (single-use + TTL ultra-curto)

WhatsApp fica para uma v2 — se a v1 entregar ganho de EMQ medível, replicamos o padrão lá com um redirect próprio.

## Objetivo

Elevar EMQ do ViewContent (e demais eventos de funil) para visitantes vindos de campanhas de e-mail, pré-hidratando o cofre `_sf_identity` com hashes de PII antes do primeiro disparo.

## Princípio anti-regressão (inalterado)

- Não inventa parâmetro novo para a Meta
- Só preenche mais cedo o cofre que já alimenta hoje todos os eventos CAPI
- Mesma normalização e hashing SHA-256 já usados em `meta-capi-sender.ts`

## Salvaguardas

1. **Token single-use**: marcado `used_at` na primeira leitura no edge `storefront-html`
2. **TTL 5 minutos**: clique → carregamento de página é questão de segundos
3. **Hidrata só se cofre vazio**: nunca sobrescreve identidade existente no navegador
4. **Service-role only**: tabela bloqueada para anon; só `email-track` escreve e `storefront-html` lê
5. **Hashes pré-computados server-side**: nunca passa PII em plaintext em URL/token
6. **Falha silenciosa**: token inválido/expirado → fluxo normal, sem erro

## Fluxo final

```text
1) Usuário clica em link no e-mail
   → bate em email-track?type=click&t=<email_token>&url=<dest>

2) email-track (modificado):
   - Marca clique como hoje
   - Busca subscriber_id → lê email/telefone/nome/endereço hashed se houver
   - Se há ao menos email_hashed OU phone_hashed:
       mint identity_prehydration_tokens (TTL 5 min, single-use)
       append ?ah=<token> em <dest> (apenas se <dest> for do mesmo tenant)
   - 302 redirect para <dest>

3) storefront-html (modificado, mudança cirúrgica):
   - Detecta ?ah= na query
   - Lookup service-role na tabela
   - Se válido + não usado + não expirado:
       marca used_at = NOW()
       injeta snippet que escreve _sf_identity em localStorage SE vazio
   - Continua fluxo normal de _sfEnsureFbp + PageView

4) Primeiro PageView, ViewContent, etc → cofre cheio → EMQ sobe
```

## O que vou criar/alterar

### Banco
- Migration: tabela `identity_prehydration_tokens` (token PK text, tenant_id uuid, subscriber_id uuid nullable, customer_id uuid nullable, identity_bundle jsonb, expires_at timestamptz, used_at timestamptz nullable, created_at)
- Índices: `(token)`, `(expires_at)` para limpeza
- RLS habilitada, sem policy para anon/authenticated; só service_role (GRANT ALL para service_role)

### `supabase/functions/email-track/index.ts` (mudança cirúrgica)
- Após o update de click_count, antes do redirect:
  - Buscar dados do subscriber (email/phone/name/addr) na tabela `email_marketing_subscribers` ou customer relacionado
  - Se há pelo menos um dado útil: hashar via mesma função do `meta-capi-sender`, montar bundle, inserir token
  - Validar que `redirect` aponta para domínio do mesmo tenant (via `tenant_domains`) antes de injetar `?ah=`
  - Se URL externa ou sem dado útil: redirect intacto (zero mudança)

### `supabase/functions/storefront-html/index.ts` (mudança cirúrgica)
- Antes de montar o script `_sfEnsureFbp`, se `?ah=` presente:
  - Lookup service-role + valida + marca usado
  - Injeta snippet inicial:
    ```js
    try {
      if (!localStorage.getItem('_sf_identity')) {
        localStorage.setItem('_sf_identity', JSON.stringify(<bundle com expires_at +30d>));
      }
    } catch(e){}
    ```
- Snippet roda **antes** de qualquer outro tracking

### Hash helper compartilhado
- Extrair função `hashForMeta` de `_shared/meta-capi-sender.ts` para `_shared/meta-hashing.ts` (se já não estiver lá) e reusar em `email-track`
- Garantir paridade exata: lowercase + trim + sha-256 hex

### Cleanup
- Adicionar ao job de manutenção existente (ou criar pg_cron simples): delete onde `expires_at < now() - interval '1 day'`
- Procurar primeiro um job de limpeza já existente para não duplicar

### Documentação
- `docs/especificacoes/marketing/meta-tracking.md`: nova seção "Pré-hidratação de identidade via clique em e-mail"
- `docs/meta-tracking-changelog.md`: entrada nova versão
- Memória `.lovable/memory/constraints/`: regra "nunca sobrescrever `_sf_identity` existente; pré-hidratação tem TTL 5min single-use"

## Validação técnica pós-implementação

1. Disparar e-mail real para um subscriber com PII conhecida → clicar link → DevTools verificar `localStorage._sf_identity` preenchido antes de qualquer ViewContent
2. Repetir clique no mesmo link → segunda vez deve ignorar (token já usado)
3. Aguardar 6 min → clicar → token expirado, fluxo normal
4. Clicar com cofre já existente (ex.: visitor que já comprou no device) → cofre NÃO sobrescrito
5. Conferir logs `marketing-capi-track` mostrando hashes em ViewContent imediatamente após clique
6. Conferir Gerenciador de Eventos Meta após 24-48h: variação positiva no EMQ de ViewContent para o segmento de tráfego de e-mail

## O que NÃO faço

- Não toco em `marketing-capi-track`, `meta-capi-sender`, `marketingTracker.ts` no pipeline de envio Meta
- Não mudo Pixel browser-side
- Não envio NENHUM campo novo para a Meta
- Não mexo em WhatsApp/SMS nesta v1
- Não mudo UI/UX em nada
- Não toco no compositor de e-mail nem no broadcast

## Esforço

Médio-pequeno. 1 migration, 1 helper compartilhado, 2 funções editadas, 1 cron-cleanup, doc + memória.

Confirma que sigo com a implementação?