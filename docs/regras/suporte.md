# Suporte — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-26

---

## Visão Geral

Sistema de tickets para comunicação entre lojista e equipe da plataforma, incluindo sugestões de melhorias e solicitações de customização.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/SupportCenter.tsx` | Central de chamados |
| `src/hooks/useSupportTickets.ts` | CRUD tickets |
| `src/components/support-center/` | Componentes UI |

## Tabelas

### support_tickets

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK |
| `created_by` | UUID | Usuário criador |
| `subject` | TEXT | Assunto |
| `category` | TEXT | Categoria |
| `priority` | TEXT | `low`, `normal`, `high` |
| `status` | TEXT | `open`, `pending`, `closed` |

### support_ticket_messages

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ticket_id` | UUID | FK |
| `sender_type` | TEXT | `tenant`, `platform` |
| `content` | TEXT | Mensagem |

## Acesso

- **Lojistas**: Veem apenas tickets do próprio tenant
- **Platform Operators**: Veem todos os tickets

## Abas do SupportCenter

| Aba | Valor | Descrição |
|-----|-------|-----------|
| Chamados | `tickets` | Lista de tickets de suporte (filtros: todos/abertos/fechados) |
| Tutoriais | `tutorials` | Galeria de vídeos tutoriais |
| Sugestões | `suggestions` | Envio de ideias e melhorias para a plataforma |
| Customização | `customization` | Solicitação de recursos personalizados e integrações |

## Cards de Ação Rápida (tenants)

| Card | Ação |
|------|------|
| Abrir Chamado | Abre dialog de criação de ticket |
| Meus Chamados | Navega para aba `tickets` com filtro `open` |
| Tutoriais | Navega para aba `tutorials` |
| Sugestões | Navega para aba `suggestions` |
| Customização | Navega para aba `customization` |
| Falar com Suporte | Abre WhatsApp externo |

## Regras

- Sugestões e Customizações utilizam o mesmo dialog de criação de tickets (`CreateTicketDialog`)
- O usuário pode escolher a categoria apropriada ao criar o ticket
- Platform Operators não veem os cards de ação rápida
