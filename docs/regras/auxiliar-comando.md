# Auxiliar de Comando — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-25

---

## Upload de Arquivos e Imagens

O Auxiliar de Comando suporta upload de arquivos e imagens diretamente no chat:

### Funcionamento

1. **Botão de Anexo**: Clique no ícone 📎 (Paperclip) para selecionar arquivos
2. **Tipos Aceitos**: Imagens, PDFs, documentos Office, TXT, CSV
3. **Limite**: 10MB por arquivo
4. **Preview**: Imagens mostram miniatura antes do envio
5. **Upload**: Arquivos são enviados para o System Drive automaticamente

### Estrutura do Anexo

```typescript
interface Attachment {
  url: string;       // URL pública do arquivo no storage
  filename: string;  // Nome original do arquivo
  mimeType: string;  // Tipo MIME (image/png, application/pdf, etc.)
}
```

### Exibição no Chat

- **Imagens**: Miniatura clicável com ícone de imagem
- **Arquivos**: Ícone de documento com nome e link de download
- Todos os anexos são renderizados abaixo do conteúdo da mensagem

### Anti-Pattern: Gravação de Áudio

> ⚠️ **Gravação de áudio foi REMOVIDA** — o modelo de IA atual não suporta processamento de áudio. Use apenas texto e arquivos.

---

## Visão Geral

Assistente de IA integrado à **Central de Execuções** para execução de tarefas operacionais via linguagem natural. Pode ser ativado via:
- `⌘K` (atalho global)
- Botão no header
- Aba "Auxiliar" na Central de Execuções (embedded)

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/components/command-assistant/CommandAssistantPanel.tsx` | Painel flutuante |
| `src/components/command-assistant/CommandAssistantTrigger.tsx` | Gatilho visual |
| `src/components/command-assistant/EmbeddedCommandAssistant.tsx` | Versão embedded para Central de Execuções |
| `src/components/command-assistant/CommandChatMessages.tsx` | Renderização de mensagens (usa componentes compartilhados) |
| `src/components/command-assistant/CommandChatInput.tsx` | Input com upload de arquivos |
| `src/hooks/useCommandAssistant.ts` | Lógica de conversas e streaming |
| `src/contexts/CommandAssistantContext.tsx` | Context global |

### Componentes Compartilhados de Chat (`src/components/chat/`)

Todos os 3 chats do sistema (Auxiliar de Comando, ChatGPT, IA de Tráfego) utilizam componentes visuais compartilhados:

| Componente | Propósito |
|------------|-----------|
| `ChatMessageBubble` | Bolha de mensagem moderna com markdown (remarkGfm), avatares, anexos e timestamps |
| `ChatTypingIndicator` | Indicador animado de digitação (3 dots bounce) |
| `ChatEmptyState` | Estado vazio unificado com ícone, título, descrição e botão |
| `ChatConversationList` | Lista de conversas com seleção, criação e exclusão |

> ⚠️ **IMPORTANTE**: Ao criar novos chats no sistema, SEMPRE utilizar os componentes de `src/components/chat/` para manter consistência visual. Nunca criar bolhas/listas de conversa customizadas.
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

### Produtos

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createProduct` | Criar produto | owner, admin, manager, editor |
| `updateProduct` | Atualizar produto | owner, admin, manager, editor |
| `deleteProduct` | Deletar produto | owner, admin, manager |
| `bulkUpdateProductsNCM` | Atualizar NCM em massa | owner, admin, manager |
| `bulkUpdateProductsCEST` | Atualizar CEST em massa | owner, admin, manager |
| `bulkUpdateProductsPrice` | Atualizar preços em massa | owner, admin, manager |
| `bulkUpdateProductsStock` | Atualizar estoque em massa | owner, admin, manager |
| `bulkActivateProducts` | Ativar/desativar em massa | owner, admin, manager |

### Categorias

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createCategory` | Criar categoria | owner, admin, manager, editor |
| `updateCategory` | Atualizar categoria | owner, admin, manager, editor |
| `deleteCategory` | Deletar categoria | owner, admin, manager |

### Cupons/Descontos

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createDiscount` | Criar cupom | owner, admin, manager |
| `updateDiscount` | Atualizar cupom | owner, admin, manager |
| `deleteDiscount` | Deletar cupom | owner, admin, manager |

### Pedidos

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `updateOrderStatus` | Atualizar status do pedido | owner, admin, manager, attendant |
| `bulkUpdateOrderStatus` | Atualizar status em massa | owner, admin, manager |
| `addOrderNote` | Adicionar nota ao pedido | owner, admin, manager, attendant |

### Clientes

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createCustomer` | Criar cliente | owner, admin, manager, attendant |
| `updateCustomer` | Atualizar cliente | owner, admin, manager, attendant |
| `deleteCustomer` | Deletar cliente | owner, admin, manager |

### Relatórios

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `salesReport` | Relatório de vendas | owner, admin, manager, editor, viewer |
| `inventoryReport` | Relatório de estoque | owner, admin, manager, editor, viewer |
| `customersReport` | Relatório de clientes | owner, admin, manager, editor, viewer |

### Configurações

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `updateStoreSettings` | Atualizar configurações da loja | owner, admin |

### Agenda

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createAgendaTask` | Criar tarefa na agenda | todos |

### Formato de Ação Proposta

```json
{
  "tool": "bulkUpdateProductsNCM",
  "params": {
    "ncm": "33051000",
    "productIds": ["all"]
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
| Expor nomes internos de ferramentas (ex: `bulkUpdateProductsNCM`) | Usar linguagem da UI (ex: "atualizar o NCM dos produtos") |
| Mencionar `tool_name`, `tool_args`, IDs de sistema | Usar linguagem natural que o lojista entende |

---

## Regra de Linguagem UI (OBRIGATÓRIA — Regra Global)

> ⚠️ **Aplicável a TODOS os chats do sistema** (Auxiliar de Comando, ChatGPT, IA de Tráfego)

O assistente NUNCA deve expor nomes internos de ferramentas, variáveis, IDs ou termos técnicos ao usuário. Deve sempre usar a linguagem visível na interface (UI) da plataforma.

### Mapeamento interno → linguagem do lojista

| Interno | Fala do Assistente |
|---------|-------------------|
| `bulkUpdateProductsNCM` | "atualizar o NCM dos produtos" |
| `bulkUpdateProductsPrice` | "ajustar os preços dos produtos" |
| `createDiscount` | "criar um cupom de desconto" |
| `updateOrderStatus` | "atualizar o status do pedido" |
| `salesReport` | "gerar um relatório de vendas" |
| `createAgendaTask` | "criar uma tarefa na Agenda" |
| `tool_name` / `tool_args` | NUNCA mencionar |
| `tenant_id`, `user_id` | NUNCA mencionar |
| `autopilot_config` | "Configurações da IA de Tráfego" |

---

## Checklist

- [ ] Painel abre com ⌘K
- [ ] Conversas persistem por tenant
- [ ] Streaming funciona corretamente
- [ ] Ações propostas são exibidas
- [ ] Confirmação executa ação
- [ ] Permissões RBAC respeitadas
- [ ] Linguagem UI-friendly (sem jargão técnico)
