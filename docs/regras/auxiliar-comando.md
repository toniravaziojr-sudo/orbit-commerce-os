# Auxiliar de Comando — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-19

---

## Visão Geral

Assistente de IA integrado ao CommandCenter para execução de tarefas operacionais via linguagem natural. Ativado via `⌘K` ou botão no header.

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/components/command-assistant/CommandAssistantPanel.tsx` | Painel flutuante |
| `src/components/command-assistant/CommandAssistantTrigger.tsx` | Gatilho visual |
| `src/hooks/useCommandAssistant.ts` | Lógica de conversas e streaming |
| `src/contexts/CommandAssistantContext.tsx` | Context global |
| `supabase/functions/command-assistant-chat/` | Processamento de mensagens |
| `supabase/functions/command-assistant-execute/` | Execução de ações |

---

## Tabelas do Banco

### command_conversations

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `user_id` | UUID | Criador |
| `title` | TEXT | Título da conversa |
| `created_at` | TIMESTAMPTZ | Data |

### command_messages

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `conversation_id` | UUID | FK conversation |
| `tenant_id` | UUID | FK tenants |
| `user_id` | UUID | Autor |
| `role` | ENUM | `user`, `assistant`, `tool` |
| `content` | TEXT | Conteúdo da mensagem |
| `metadata` | JSONB | Ações propostas, resultados |

---

## Arquitetura

### Fluxo de Mensagem

```
1. Usuário digita mensagem no painel
   ↓
2. useCommandAssistant.sendMessage()
   - Cria conversa se necessário
   - Adiciona mensagem otimisticamente
   ↓
3. POST /command-assistant-chat (streaming SSE)
   - Recebe contexto do tenant
   - Processa com modelo de IA
   - Retorna chunks via SSE
   - Extrai proposed_actions do texto
   ↓
4. Frontend renderiza resposta
   - Se há ações: mostra botões de confirmação
   ↓
5. Usuário confirma ação
   ↓
6. POST /command-assistant-execute
   - Valida permissões RBAC
   - Executa ação no banco
   - Retorna resultado
```

### Streaming SSE

```typescript
// Frontend lê stream
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // Parse SSE chunks
  // data: {"choices":[{"delta":{"content":"..."}}]}
}
```

---

## Ações Suportadas (Tools)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createCategory` | Criar categoria de produtos | owner, admin, manager, editor |
| `createDiscount` | Criar cupom de desconto | owner, admin, manager |
| `salesReport` | Gerar relatório de vendas | owner, admin, manager, editor, viewer |
| `createAgendaTask` | Criar tarefa na agenda | todos |

### Formato de Ação Proposta

```json
{
  "tool": "createDiscount",
  "params": {
    "code": "PROMO10",
    "type": "percentage",
    "value": 10,
    "min_subtotal": 100
  }
}
```

---

## Sistema de Permissões

```typescript
const PERMISSION_MAP: Record<string, string[]> = {
  createCategory: ["owner", "admin", "manager", "editor"],
  createDiscount: ["owner", "admin", "manager"],
  salesReport: ["owner", "admin", "manager", "editor", "viewer"],
  createAgendaTask: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
};
```

---

## System Prompt

```
Você é o Auxiliar de Comando, um assistente inteligente para e-commerce.
Você pode ajudar o usuário a executar ações como:
- Criar categorias de produtos
- Criar cupons de desconto
- Gerar relatórios de vendas
- Criar tarefas na Agenda

Quando propor uma ação, formate em bloco ```action ... ```
```

---

## Interface

### CommandAssistantTrigger

```tsx
// Botão no header
<button onClick={openAssistant}>
  <Sparkles />
  Auxiliar de Comando...
  <kbd>⌘K</kbd>
</button>
```

### CommandAssistantPanel

- Lista de conversas anteriores
- Área de chat com streaming
- Botões de confirmação para ações
- Histórico persistido por tenant

---

## User Type: assistant

O sistema define um user type específico para "Auxiliar":

```typescript
assistant: {
  label: 'Auxiliar',
  description: 'Suporte operacional: pedidos, estoque e logística',
  permissions: {
    ecommerce: { orders: true, products: true },
    erp: { shipping: true },
  }
}
```

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Executar ação sem confirmação | Sempre mostrar preview + botão confirmar |
| Ignorar permissões RBAC | Validar server-side antes de executar |
| Salvar dados sensíveis no content | Usar metadata.proposed_actions |

---

## Checklist

- [ ] Painel abre com ⌘K
- [ ] Conversas persistem por tenant
- [ ] Streaming funciona corretamente
- [ ] Ações propostas são exibidas
- [ ] Confirmação executa ação
- [ ] Permissões RBAC respeitadas
