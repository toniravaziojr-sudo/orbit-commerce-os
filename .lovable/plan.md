

# Plano: Fluxo de Seleção de Ativos Meta nos Toggles (Fase 4.4)

## Contexto

Hoje, ao ativar um toggle (ex: WhatsApp Notificações), o sistema apenas marca `status: active` no banco sem pedir ao usuário qual ativo usar. Os dados de ativos existem no `discovered_assets` do grant (conta empresarial, páginas, WABAs, números, pixels), mas não são apresentados na interface para seleção.

## O que será construído

Quando o usuário ligar um toggle, em vez de ativar imediatamente, o sistema abre um fluxo inline de seleção em 2 passos:
1. **Selecionar Conta Empresarial** (se houver mais de uma)
2. **Selecionar o Ativo específico** (página, número, pixel, etc.) conforme o tipo de integração

Só após a seleção o ativo é salvo e a integração fica ativa. Quando ativo, o toggle mostra qual ativo está vinculado e permite alterar ou remover.

## Mapeamento: Toggle → Tipo de Ativo

| Toggle | Ativo a selecionar |
|--------|-------------------|
| whatsapp_notificacoes / whatsapp_atendimento | WABA → Número de telefone |
| instagram_publicacoes / instagram_direct / instagram_comentarios | Conta Instagram (vinculada a página) |
| facebook_publicacoes / facebook_messenger / facebook_lives / facebook_comentarios | Página do Facebook |
| pixel_facebook / conversions_api | Pixel (via Ad Account) |
| leads | Página do Facebook |
| anuncios | Conta de Anúncio |
| catalogos | Catálogo (criado via API) |
| catalogo_insights | Página (para insights) |

## Alterações Técnicas

### 1. Backend — Edge Function `meta-integrations-manage`

**Mudanças no POST (activate):**
- Aceitar campo opcional `selected_assets` no body
- Se `selected_assets` vier preenchido, salvar no registro da integração
- Se não vier (toggle ligado sem seleção), retornar `success: true` com flag `requiresAssetSelection: true` + lista de `availableAssets` extraída de `discovered_assets` do grant ativo

**Mudanças no GET:**
- Incluir `discovered_assets` do grant na resposta (já existe no banco, só precisa adicionar ao SELECT)

**Nova action `save_assets`:**
- Recebe `tenant_id`, `integration_id`, `selected_assets`
- Atualiza a coluna `selected_assets` na integração existente
- Executa side-effects conforme o tipo (WhatsApp → upsert `whatsapp_configs`, Pixel → upsert `marketing_integrations`, etc.)

### 2. Frontend — Hook `useMetaIntegrations`

- Adicionar `discoveredAssets` ao retorno (vem do GET)
- Nova mutation `saveAssets` para chamar a action `save_assets`
- Expor `availableAssets` por integração (filtrando `discoveredAssets` pelo tipo)

### 3. Frontend — Componente de Seleção de Ativos

**Novo componente: `MetaAssetSelector`**

Exibido inline abaixo do toggle quando:
- Toggle é ligado E não tem `selected_assets` ainda
- Ou usuário clica "Alterar" em um ativo já selecionado

Fluxo visual:
```text
┌─────────────────────────────────────────┐
│ [Toggle ON] WhatsApp Notificações       │
│                                         │
│  Selecione a conta empresarial:         │
│  ○ Respeite o Homem (ID: 123...)        │
│  ○ Outra Empresa (ID: 456...)           │
│                                         │
│  Selecione o número:                    │
│  ○ +55 11 99999-0001 (Respeite o Homem) │
│  ○ +55 11 99999-0002 (Atendimento)      │
│                                         │
│  [Confirmar]  [Cancelar]                │
└─────────────────────────────────────────┘
```

Para integrações que já tem ativo selecionado:
```text
┌─────────────────────────────────────────┐
│ [Toggle ON] Facebook Publicações        │
│  📄 Respeite o Homem (Página)           │
│  [Alterar] [Remover]                    │
└─────────────────────────────────────────┘
```

### 4. Frontend — `MetaIntegrationToggleRow` (refactor)

- Ao ligar o toggle: não chama `activate` direto → abre o `MetaAssetSelector` inline
- Ao confirmar seleção: chama `activate` com `selected_assets` + executa side-effects no backend
- Ao desligar: chama `deactivate` normalmente (limpa ativo vinculado)
- Quando ativo com ativo selecionado: mostra info do ativo + botões "Alterar" e "Remover"

### 5. Side-Effects por Tipo (Backend)

Quando `selected_assets` é salvo junto com ativação:

| Integração | Side-effect |
|-----------|-------------|
| whatsapp_* | Upsert `whatsapp_configs` com phone_number_id, waba_id, etc. |
| pixel_facebook | Upsert `marketing_integrations.meta_pixel_id` + `meta_enabled` |
| conversions_api | Upsert `marketing_integrations.meta_capi_enabled` |
| catalogos | Chamar `meta-save-selected-assets` lógica de catálogo (reutilizar) |

### 6. Catálogo de Integrações — Asset Type Mapping

Adicionar ao `metaIntegrationCatalog.ts` um campo `assetType` para cada integração:

```typescript
assetType: 'page' | 'instagram_account' | 'waba_phone' | 'pixel' | 'ad_account' | 'catalog' | 'none'
```

Isso permite que o componente `MetaAssetSelector` saiba qual tipo de ativo filtrar do `discovered_assets`.

## Ordem de Implementação

1. Catálogo — adicionar `assetType` a cada integração
2. Backend — alterar `meta-integrations-manage` (GET retorna `discovered_assets`, POST aceita `selected_assets`, nova action `save_assets` com side-effects)
3. Hook — expor `discoveredAssets` + mutation `saveAssets`
4. Componente `MetaAssetSelector` — seleção inline em 2 passos
5. Refatorar `MetaIntegrationToggleRow` — integrar seletor + exibir ativo vinculado
6. Documentar em `docs/regras/integracoes.md` (Fase 4.4)

## Resultado Final

- Todo toggle novo começa desligado
- Ligar um toggle abre a seleção de ativo inline (conta empresarial → ativo específico)
- Ativo selecionado é salvo no banco e side-effects são executados (WhatsApp, Pixel, etc.)
- Toggle ativo mostra qual ativo está vinculado com opção de alterar
- Funcionalidades operam com o ativo correto (número de WhatsApp certo, página certa, pixel certo)

