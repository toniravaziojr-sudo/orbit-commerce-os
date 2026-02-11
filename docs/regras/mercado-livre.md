# Mercado Livre — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2026-02-11

---

## Visão Geral

Integração OAuth com Mercado Livre para sincronização de pedidos, atendimento e gestão de anúncios.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/MercadoLivre.tsx` | Dashboard com abas (Conexão, Pedidos, Anúncios) |
| `src/pages/MeliOAuthCallback.tsx` | Proxy page para callback OAuth (captura code/state, notifica via postMessage e fecha popup) |
| `src/hooks/useMeliConnection.ts` | Status/OAuth com listener de postMessage |
| `src/hooks/useMeliOrders.ts` | Pedidos |
| `src/hooks/useMeliListings.ts` | CRUD de anúncios (meli_listings) |
| `src/components/marketplaces/MeliListingsTab.tsx` | UI da aba Anúncios (preparar, aprovar, publicar) |
| `src/components/marketplaces/MeliConnectionCard.tsx` | Card de conexão OAuth |
| `src/components/marketplaces/MeliOrdersTab.tsx` | Aba de pedidos |
| `supabase/functions/meli-oauth-*` | Fluxo OAuth |
| `supabase/functions/meli-webhook/` | Notificações |

## Fluxo OAuth

```
1. meli-oauth-start → URL de autorização
2. Popup para ML
3. ML redireciona para /integrations/meli/callback (MeliOAuthCallback.tsx)
4. MeliOAuthCallback captura code/state e chama edge function meli-oauth-callback via fetch
5. meli-oauth-callback (edge function) → Troca code por tokens e salva no banco
6. MeliOAuthCallback envia window.opener.postMessage({ type: 'meli_connected' }) para janela principal
7. MeliOAuthCallback fecha o popup automaticamente (window.close())
8. Janela principal recebe postMessage e invalida queries de status
9. meli-token-refresh → Renovação automática
```

### Regra: Popup OAuth (OBRIGATÓRIO)

> O `MeliOAuthCallback.tsx` **NÃO deve redirecionar** o navegador. Deve:
> 1. Capturar `code` e `state` dos query params
> 2. Chamar a edge function `meli-oauth-callback` via fetch
> 3. Enviar resultado via `window.opener.postMessage()`
> 4. Fechar o popup com `window.close()`
>
> A janela principal (`useMeliConnection.ts`) escuta o `postMessage` e atualiza o estado.

## Rota Frontend

- **Path:** `/integrations/meli/callback`
- **Componente:** `MeliOAuthCallback`
- **Registrada em:** `src/App.tsx`
- **Função:** Proxy entre o redirect do ML e a edge function. Necessária porque o ML redireciona para o domínio do app, não diretamente para a edge function.

## Regra: Atendimento

> Mensagens do ML vão para módulo **Atendimento** (`channel_type='mercadolivre'`).
> **Proibido:** Manter aba de mensagens no marketplace.

## Fluxo de Anúncios (Listings)

### Pipeline: Preparar → Aprovar → Publicar

```
1. Lojista seleciona produto da loja na aba "Anúncios"
2. Preenche dados específicos do ML (título ≤60 chars, preço, estoque, tipo de anúncio, condição)
3. Anúncio salvo como status 'draft'
4. Lojista revisa e clica "Aprovar" → status 'approved'
5. (Futuro) Lojista clica "Publicar" → edge function envia para API do ML → status 'published'
```

### Regras de Anúncio

- **Título:** Máximo 60 caracteres (limite do ML)
- **Tipos de anúncio:** `gold_special` (Clássico), `gold_pro` (Premium), `gold` (Gold), `free` (Grátis)
- **Condição:** `new` (Novo) ou `used` (Usado)
- **Moeda:** `BRL` (padrão)
- **Unicidade:** Um produto só pode ter um anúncio ativo (constraint `idx_meli_listings_tenant_product`)

### Status do Anúncio

| Status | Descrição |
|--------|-----------|
| `draft` | Rascunho, editável |
| `ready` | Pronto para aprovação |
| `approved` | Aprovado, aguardando publicação |
| `publishing` | Em processo de envio ao ML |
| `published` | Publicado no ML |
| `error` | Erro na publicação |

## Tabela: marketplace_connections

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | UUID | FK |
| `marketplace` | TEXT | `mercadolivre` |
| `access_token` | TEXT | Token atual |
| `refresh_token` | TEXT | Renovação |
| `external_user_id` | TEXT | ID ML |
| `is_active` | BOOLEAN | Status |

## Tabela: meli_listings

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `product_id` | UUID | FK products |
| `status` | TEXT | draft/ready/approved/publishing/published/error |
| `meli_item_id` | TEXT | ID do anúncio no ML (após publicação) |
| `title` | TEXT | Título do anúncio (≤60 chars) |
| `description` | TEXT | Descrição HTML |
| `price` | NUMERIC | Preço no ML |
| `available_quantity` | INT | Estoque disponível |
| `category_id` | TEXT | Categoria ML |
| `listing_type` | TEXT | gold_special/gold_pro/gold/free |
| `condition` | TEXT | new/used |
| `currency_id` | TEXT | BRL |
| `images` | JSONB | Array de URLs |
| `attributes` | JSONB | Atributos ML |
| `shipping` | JSONB | Config de frete ML |
| `meli_response` | JSONB | Resposta da API ML |
| `error_message` | TEXT | Mensagem de erro |
| `published_at` | TIMESTAMPTZ | Data de publicação |

### RLS: meli_listings

- SELECT/INSERT/UPDATE/DELETE: `user_has_tenant_access(tenant_id)`
