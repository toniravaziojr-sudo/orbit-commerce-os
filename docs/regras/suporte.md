# Suporte — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2026-03-13

---

## Visão Geral

Sistema de tickets para comunicação entre lojista e equipe da plataforma, incluindo sugestões de melhorias e solicitações de customização.

Inclui também o módulo de **Atendimento** (central de atendimento unificada com IA) que gerencia conversas com clientes via múltiplos canais (WhatsApp, Email, Chat do Site, Mercado Livre, Shopee, etc.).

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/SupportCenter.tsx` | Central de chamados |
| `src/hooks/useSupportTickets.ts` | CRUD tickets |
| `src/components/support-center/` | Componentes UI |
| `src/pages/Support.tsx` | Página de Atendimento (conversas) |
| `src/hooks/useConversations.ts` | CRUD conversas |
| `src/hooks/useMessages.ts` | CRUD mensagens |
| `src/components/support/` | Componentes de atendimento |

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

### conversations

Conversas de atendimento com clientes (multi-canal).

### messages

Mensagens dentro de cada conversa de atendimento.

## Políticas RLS — Atendimento (conversations + messages)

### Acesso autenticado (membros do tenant)
- **Tenant members can manage conversations** — ALL para membros do tenant (via `user_roles`)
- **Tenant members can view conversations** — SELECT para membros do tenant
- **Tenant members can manage messages** — ALL para membros do tenant
- **Tenant members can view messages** — SELECT para membros do tenant

### Acesso anônimo (chat widget da vitrine)
- **Anon can insert chat conversations** — INSERT para `anon`, restrito a `channel_type = 'chat'`
- **Anon can read own chat conversation** — SELECT para `anon`, restrito a `channel_type = 'chat'`
- **Anon can insert chat messages** — INSERT para `anon`, restrito a `direction = 'inbound'`, `sender_type = 'customer'` e conversa com `channel_type = 'chat'`
- **Anon can read chat messages** — SELECT para `anon`, restrito a mensagens de conversas com `channel_type = 'chat'`

> **Nota**: Essas políticas anônimas são necessárias porque o widget de chat na vitrine (storefront) usa a chave anônima do Supabase, sem autenticação de usuário.

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
