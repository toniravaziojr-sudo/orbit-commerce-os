# Sincronização Semanal de Públicos (Meta + Google Ads)

> Módulo de automação que mantém públicos de anúncios atualizados com base nas listas de email marketing.

## Visão Geral

Todo **sábado às 23h (BRT)**, o sistema percorre todas as listas de email de cada tenant e:

1. **Cria** um público na Meta e/ou Google Ads (se ainda não existir)
2. **Atualiza** o público com os membros atuais da lista
3. **Renomeia** o público com a data da última atualização

## Nomenclatura dos Públicos

```
{Nome da Lista} - Atualizado {DD/MM/YYYY}
```

Exemplo: `Clientes - Atualizado 12/04/2026`

## Dados Enviados

### Meta (Custom Audiences)
Todos os dados são enviados como **hash SHA-256** (requisito obrigatório da API):

| Campo | Origem |
|-------|--------|
| EMAIL | `email_marketing_subscribers.email` |
| PHONE | `email_marketing_subscribers.phone` (normalizado E.164) |
| FN (First Name) | Primeira parte de `subscribers.name` |
| LN (Last Name) | Restante de `subscribers.name` |

- Tipo: `CUSTOM` com `customer_file_source: USER_PROVIDED_ONLY`
- Batches: 10.000 registros por chamada
- API: `POST /{audience_id}/users`

### Google Ads (Customer Match)
Dados também em SHA-256:

| Campo | Origem |
|-------|--------|
| hashedEmail | `subscribers.email` |
| hashedPhoneNumber | `subscribers.phone` |
| hashedFirstName | Primeira parte de `subscribers.name` |
| hashedLastName | Restante de `subscribers.name` |
| countryCode | `BR` (padrão) |

- Tipo: `CRM_BASED` via `OfflineUserDataJobService`
- Batches: 10.000 registros por operação
- API: Google Ads API v18

## Infraestrutura

### Tabelas

**`audience_sync_mappings`**
- Vincula cada lista de email → público na plataforma
- Campos: `tenant_id`, `list_id`, `platform`, `platform_audience_id`, `ad_account_id`, `audience_name`, `last_synced_at`, `members_synced`, `status`
- Constraint unique: `(tenant_id, list_id, platform)`

**`audience_sync_logs`**
- Log de cada execução de sincronização
- Campos: `tenant_id`, `list_id`, `platform`, `action`, `members_sent`, `error_message`, `duration_ms`

### Edge Function

**`audience-sync-weekly`**
- Aceita `tenant_id` para execução manual de um tenant específico
- Aceita `dry_run: true` para simular sem executar
- Sem `tenant_id`: processa todos os tenants (modo cron)

### Cron Job

- Nome: `audience-sync-weekly-sat-23h`
- Expressão: `0 2 * * 0` (domingo 02:00 UTC = sábado 23:00 BRT)
- Padrão de automação: **Padrão 3 (Edge Function Direta)** via cron

## Pré-requisitos por Tenant

### Meta
- Conexão Meta ativa (`tenant_meta_auth_grants` com status `active`)
- Escopo `ads_management` concedido
- **Termos de Serviço de Público Personalizado** aceitos na conta de anúncios
- Pelo menos uma conta de anúncios nos `discovered_assets`

### Google Ads
- Conexão Google ativa (`google_connections` com `is_active = true`)
- `GOOGLE_ADS_DEVELOPER_TOKEN` configurado como secret
- Customer ID disponível nos assets da conexão

## Execução Manual

Para testar ou forçar sincronização de um tenant:

```
POST /functions/v1/audience-sync-weekly
Body: { "tenant_id": "uuid-do-tenant" }
```

Para dry run:
```
POST /functions/v1/audience-sync-weekly
Body: { "tenant_id": "uuid-do-tenant", "dry_run": true }
```

## Histórico

| Data       | Mudança |
|------------|---------|
| 2026-04-12 | Criação do módulo. Tabelas, Edge Function e cron configurados. |
