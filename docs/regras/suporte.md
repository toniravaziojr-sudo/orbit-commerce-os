# Suporte — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-04-01

---

## Visão Geral

Sistema de tickets para comunicação entre lojista e equipe da plataforma, incluindo sugestões de melhorias e solicitações de customização.

Inclui também o módulo de **Atendimento** (central de atendimento unificada com IA) que gerencia conversas com clientes via múltiplos canais (WhatsApp, Email, Chat do Site, Messenger, Instagram DM, Comentários Instagram, Comentários Facebook, Mercado Livre, Shopee, etc.).

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

## Lista de Conversas (ConversationList)

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente |
| **Localização** | `src/components/support/ConversationList.tsx` |
| **Descrição** | Lista lateral de conversas de atendimento com preview compacto |

### Card de Conversa (v8.5.4)

Cada item da lista exibe:

| Linha | Conteúdo | Comportamento |
|-------|----------|---------------|
| 1 | Nome do cliente + badge de não lidas | Nome truncado; badge vermelho se `unread_count > 0` |
| 2 | Preview da última mensagem | Campo `summary`; truncado em 1 linha com `...` |
| 3 | Bolinha de status + data | Cor do status + data formatada (Hoje/Ontem/dia da semana/dd/mm/yyyy) |

### Ícones de Canal

Cada conversa exibe o ícone do canal sobre o avatar (canto inferior direito):

| Canal | Ícone | Cor |
|-------|-------|-----|
| WhatsApp | SVG oficial WhatsApp | Verde (`text-green-500`) |
| Email | `Mail` (lucide) | Azul (`text-blue-500`) |
| Facebook Messenger | `MessageSquare` (lucide) | Azul escuro (`text-blue-600`) |
| Instagram DM | `Instagram` (lucide) | Rosa (`text-pink-500`) |
| Comentários Instagram | `Instagram` (lucide) | Rosa claro (`text-pink-400`) |
| Comentários Facebook | `MessageSquare` (lucide) | Azul (`text-blue-500`) |
| Mercado Livre | `ShoppingCart` (lucide) | Amarelo (`text-yellow-500`) |
| Shopee | `ShoppingCart` (lucide) | Laranja (`text-orange-500`) |
| TikTok Shop | `Music` (lucide) | Foreground |
| Chat do Site | `Globe` (lucide) | Primary |

### Canais com Auto-Detecção Meta (v4.5)

Os canais `instagram_dm`, `facebook_messenger`, `instagram_comments` e `facebook_comments` detectam automaticamente a integração Meta ativa na tabela `tenant_meta_integrations`. Quando ativados via Integrações, aparecem como "Ativo — Via Integrações Meta" sem necessidade de configuração manual no Atendimento. Se a integração não estiver ativa, o card exibe "Ative este recurso em Integrações Meta" com botão para navegar.

Mapeamento de `integration_id` → `channel_type`:
| integration_id | channel_type |
|---|---|
| `instagram_direct` | `instagram_dm` |
| `facebook_messenger` | `facebook_messenger` |
| `instagram_comentarios` | `instagram_comments` |
| `facebook_comentarios` | `facebook_comments` |

### Tipos de Canal (`SupportChannelType`)

| Valor | Nome exibido | Categoria |
|-------|-------------|-----------|
| `whatsapp` | WhatsApp | Linked (auto-detect via config) |
| `email` | Email | Linked (auto-detect via config) |
| `facebook_messenger` | Messenger | Meta (auto-detect) |
| `instagram_dm` | Instagram DM | Meta (auto-detect) |
| `instagram_comments` | Comentários Instagram | Meta (auto-detect) |
| `facebook_comments` | Comentários Facebook | Meta (auto-detect) |
| `mercadolivre` | Mercado Livre | Marketplace |
| `shopee` | Shopee | Marketplace |
| `tiktokshop` | TikTok Shop | Marketplace |
| `chat` | Chat do Site | Próprio |

### Configuração de IA por Canal (`AIChannelConfigDialog`)

Cada canal suporta configuração individual de IA com restrições específicas:

| Canal | Restrições padrão |
|-------|------------------|
| Comentários Instagram | "Respostas devem ser curtas e públicas" |
| Comentários Facebook | "Respostas devem ser curtas e públicas" |
| Marketplace (todos) | "Não enviar links externos", "Não mencionar outras plataformas", "Não solicitar contato fora da plataforma" |
| Demais canais | Sem restrições padrão |

### Arquivos Alterados (v4.5)

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useConversations.ts` | Adicionados tipos `instagram_comments` e `facebook_comments` ao `SupportChannelType` |
| `src/components/support/ChannelIntegrations.tsx` | Auto-detecção de integrações Meta ativas; novos cards para Comentários IG/FB |
| `src/components/support/ConversationList.tsx` | Ícones e filtros para novos canais |
| `src/components/support/AIChannelConfigDialog.tsx` | Configuração de IA para novos canais com restrições |
| `src/components/support/ChannelConfigDialog.tsx` | Docs de configuração para novos canais |

### Abas de Filtro

| Aba | Filtro | Badge |
|-----|--------|-------|
| Em aberto | `needs_attention` | Vermelho (destructive) |
| Atendendo | `in_progress` | Cinza (secondary) |
| IA | `bot` | Roxo (`bg-purple-500`) |

### Formatação de Data

| Condição | Exibição |
|----------|----------|
| Hoje | "Hoje" |
| Ontem | "Ontem" |
| < 7 dias | Nome do dia da semana (ex: "segunda-feira") |
| ≥ 7 dias | `dd/MM/yyyy` |
