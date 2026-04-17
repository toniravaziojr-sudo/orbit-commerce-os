---
name: features/fiscal/settings-page-architecture
description: Configurações Fiscais é página dedicada com 3 abas — proibido voltar ao formato modal/dialog
type: constraint
---

# Configurações Fiscais — Página Dedicada (rev 2026-04-17)

## Regra
As Configurações Fiscais são uma **página dedicada** em `/fiscal/configuracoes`, NÃO um modal/dialog.

## Estrutura obrigatória
- Rota: `/fiscal/configuracoes` (componente `src/pages/FiscalSettings.tsx`)
- Acesso exclusivo: botão "Configurações" no header de `/fiscal`. **Não aparece na sidebar.**
- Botão "Voltar" no topo: sempre retorna para `/fiscal?tab=pedidos`
- 3 abas (controladas via query param `?aba=`):
  1. `emitente` (default) — `EmitenteSettings.tsx` — dados da empresa, endereço, certificado A1
  2. `natureza` — `OperationNaturesContent.tsx` — naturezas de operação
  3. `outros` — `OutrosSettings.tsx` — inutilização, automação, e-mail, remessa, desmembramento

## Proibições
- ❌ NÃO voltar ao formato modal/Dialog para Configurações Fiscais
- ❌ NÃO adicionar Configurações Fiscais na sidebar (acesso só via botão do módulo Fiscal)
- ❌ NÃO criar nova página separada para Naturezas de Operação (consolidada como aba)

## Redirects legados mantidos
- `/settings/fiscal` → `/fiscal/configuracoes`
- `/fiscal?tab=configuracoes` → `/fiscal/configuracoes` (via useEffect em Fiscal.tsx)
- `/fiscal/operation-natures` → `/fiscal/configuracoes?aba=natureza`

## Motivo
Modal sobre modal era confuso e apertado. Página dedicada dá espaço, organização e escalabilidade para crescer (cada aba pode evoluir independentemente).

## Doc formal
`docs/especificacoes/erp/erp-fiscal.md` (seção Arquivos) e `docs/especificacoes/transversais/mapa-ui.md` (seção ERP).
