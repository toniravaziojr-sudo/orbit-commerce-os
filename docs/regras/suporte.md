# Suporte — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-19

---

## Visão Geral

Sistema de tickets para comunicação entre lojista e equipe da plataforma.

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
