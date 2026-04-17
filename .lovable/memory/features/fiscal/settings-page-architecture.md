---
name: features/fiscal/settings-page-architecture
description: Configurações Fiscais — página dedicada com 3 abas, casa oficial em Sistema→Configurações, atalho no Fiscal e botão Voltar contextual. Proibido voltar ao formato modal/dialog.
type: constraint
---

# Configurações Fiscais — Página Dedicada (rev 2026-04-17b)

## Regra
As Configurações Fiscais são uma **página dedicada** em `/fiscal/configuracoes`, NÃO um modal/dialog.

## Casa oficial e acesso
- **Casa oficial:** `Sistema → Configurações → aba "Fiscal"` (`/system/settings?tab=fiscal`)
- **Atalho:** botão "Configurações" no header de `/fiscal`
- A página NÃO aparece como item próprio na sidebar.

## Estrutura obrigatória
- Rota única: `/fiscal/configuracoes` (componente `src/pages/FiscalSettings.tsx`)
- 3 abas internas (controladas via query param `?aba=`):
  1. `emitente` (default) — `EmitenteSettings.tsx` — dados da empresa, endereço, certificado A1
  2. `natureza` — `OperationNaturesContent.tsx` — naturezas de operação
  3. `outros` — `OutrosSettings.tsx` — inutilização, automação, e-mail, remessa, desmembramento

## Botão "Voltar" — CONTEXTUAL via `?from=`
- `?from=fiscal`   → volta para `/fiscal?tab=pedidos` (label: "Voltar para Fiscal")
- `?from=settings` → volta para `/system/settings?tab=fiscal` (label: "Voltar para Configurações")
- Sem param        → default `/system/settings?tab=fiscal` (casa oficial)
- Trocar de aba interna deve **preservar** o `?from=` na URL.

## Como cada origem chama a página
- `Fiscal.tsx` → `navigate('/fiscal/configuracoes?from=fiscal')`
- `SystemSettings.tsx` (aba "Fiscal") → `navigate('/fiscal/configuracoes?from=settings')` e também redireciona via `useEffect` quando a URL chega com `?tab=fiscal`.

## Proibições
- ❌ NÃO voltar ao formato modal/Dialog para Configurações Fiscais
- ❌ NÃO adicionar Configurações Fiscais como item próprio na sidebar
- ❌ NÃO criar nova página separada para Naturezas de Operação (consolidada como aba)
- ❌ NÃO duplicar a página dentro de SystemSettings — a aba "Fiscal" deve apenas redirecionar para `/fiscal/configuracoes`

## Redirects legados mantidos
- `/settings/fiscal` → `/fiscal/configuracoes`
- `/fiscal?tab=configuracoes` → `/fiscal/configuracoes` (via useEffect em `Fiscal.tsx`)
- `/fiscal/operation-natures` → `/fiscal/configuracoes?aba=natureza`
- `/system/settings?tab=fiscal` → `/fiscal/configuracoes?from=settings` (via useEffect em `SystemSettings.tsx`)

## Motivo
Casa oficial em Sistema→Configurações alinha com a expectativa de que toda configuração da loja viva em um lugar só. O atalho no Fiscal preserva produtividade. O Voltar contextual evita perder o usuário longe de onde ele estava.

## Doc formal
`docs/especificacoes/erp/erp-fiscal.md` (seção Arquivos) e `docs/especificacoes/transversais/mapa-ui.md` (seções ERP e Sistema).
