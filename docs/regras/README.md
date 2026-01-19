# Regras por Módulo

Este diretório contém as regras e especificações separadas por módulo para consulta rápida.

## Índice de Arquivos

| Arquivo | Módulo | Arquivos Relacionados |
|---------|--------|----------------------|
| [regras-gerais.md](./regras-gerais.md) | Regras Gerais | TODO o sistema |
| [header.md](./header.md) | Header/Cabeçalho | `src/components/storefront/StorefrontHeader*.tsx` |
| [footer.md](./footer.md) | Footer/Rodapé | `src/components/storefront/StorefrontFooter*.tsx` |
| [builder.md](./builder.md) | Builder/Editor | `src/components/builder/*`, `src/pages/storefront/*` |
| [checkout.md](./checkout.md) | Checkout | `src/components/storefront/checkout/*` |
| [ofertas.md](./ofertas.md) | Aumentar Ticket | `src/pages/Offers.tsx`, `src/components/offers/*` |
| [avaliacoes.md](./avaliacoes.md) | Avaliações | `src/pages/Reviews.tsx`, `src/components/reviews/*` |
| [midias-uploads.md](./midias-uploads.md) | Mídias e Uploads | `src/lib/upload*.ts`, `src/hooks/useSystemUpload.ts` |
| [edge-functions.md](./edge-functions.md) | Edge Functions | `supabase/functions/*` |
| [descontos.md](./descontos.md) | Cupons de Desconto | `src/pages/Discounts.tsx`, `src/components/discounts/*`, `src/contexts/DiscountContext.tsx` |
| [checkouts-abandonados.md](./checkouts-abandonados.md) | Checkouts Abandonados | `src/pages/AbandonedCheckouts.tsx`, `src/hooks/useCheckoutSessions.ts`, `src/lib/checkoutSession.ts` |
| [platform-emails.md](./platform-emails.md) | Emails da Plataforma | `src/pages/SystemEmails.tsx`, `src/components/integrations/SystemEmail*.tsx` |

---

## Como Usar

**Antes de editar qualquer arquivo, leia o doc de regras correspondente:**

| Se for editar... | Leia... |
|------------------|---------|
| `src/components/storefront/StorefrontHeader*.tsx` | `header.md` |
| `src/components/storefront/StorefrontFooter*.tsx` | `footer.md` |
| `src/components/builder/*` | `builder.md` |
| `src/components/storefront/checkout/*` | `checkout.md` |
| `src/pages/Offers.tsx`, `src/components/offers/*` | `ofertas.md` |
| `src/pages/Reviews.tsx`, `src/components/reviews/*` | `avaliacoes.md` |
| `src/lib/upload*.ts`, upload de imagens | `midias-uploads.md` |
| `supabase/functions/*` | `edge-functions.md` |
| `src/pages/Discounts.tsx`, `src/components/discounts/*` | `descontos.md` |
| `src/pages/AbandonedCheckouts.tsx`, `src/hooks/useCheckoutSessions.ts` | `checkouts-abandonados.md` |
| `src/pages/SystemEmails.tsx`, `src/components/integrations/SystemEmail*.tsx` | `platform-emails.md` |

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar estes documentos por conta própria. |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]`. |

---

## Documento Principal

O documento principal com TODAS as regras continua sendo: [`docs/REGRAS.md`](../REGRAS.md)

Estes arquivos por módulo são extrações para consulta rápida e devem estar sincronizados com o documento principal.
