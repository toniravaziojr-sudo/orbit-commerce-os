# Regras por Módulo

Este diretório contém as regras e especificações separadas por módulo para consulta rápida.

## Índice de Arquivos

| Arquivo | Módulo | Arquivos Relacionados |
|---------|--------|----------------------|
| [header.md](./header.md) | Header/Cabeçalho | `src/components/storefront/StorefrontHeader*.tsx`, `src/components/builder/theme-settings/HeaderSettings.tsx` |
| [footer.md](./footer.md) | Footer/Rodapé | `src/components/storefront/StorefrontFooter*.tsx`, `src/components/builder/theme-settings/FooterSettings.tsx` |
| [builder.md](./builder.md) | Builder/Editor | `src/components/builder/*`, `src/pages/storefront/*` |
| [edge-functions.md](./edge-functions.md) | Edge Functions | `supabase/functions/*` |

---

## Como Usar

**Antes de editar qualquer arquivo, leia o doc de regras correspondente:**

| Se for editar... | Leia... |
|------------------|---------|
| `src/components/storefront/StorefrontHeader*.tsx` | `docs/regras/header.md` |
| `src/components/storefront/StorefrontFooter*.tsx` | `docs/regras/footer.md` |
| `src/components/builder/theme-settings/HeaderSettings.tsx` | `docs/regras/header.md` |
| `src/components/builder/theme-settings/FooterSettings.tsx` | `docs/regras/footer.md` |
| `src/components/builder/*` | `docs/regras/builder.md` |
| `src/pages/storefront/*` | `docs/regras/builder.md` |
| `supabase/functions/*` | `docs/regras/edge-functions.md` |

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar, atualizar ou "melhorar" estes documentos por conta própria. |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]`. |
| **Reporte de lacunas** | Se identificar inconsistência, apenas **REPORTAR** e propor texto para aprovação — **SEM ALTERAR**. |

---

## Documento Principal

O documento principal com TODAS as regras continua sendo: [`docs/REGRAS.md`](../REGRAS.md)

Estes arquivos por módulo são extrações para consulta rápida e devem estar sincronizados com o documento principal.
