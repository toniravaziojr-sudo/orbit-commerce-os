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

### Componentes Compartilhados de Chat (`src/components/chat/`) — v2 Modern

Todos os 3 chats do sistema (Auxiliar de Comando, ChatGPT, IA de Tráfego) utilizam componentes visuais compartilhados com design inspirado em ChatGPT/Claude/Gemini:

| Componente | Propósito |
|------------|-----------|
| `ChatMessageBubble` | Mensagens: **usuário** com bolha `bg-primary` alinhada à direita; **assistente** sem bolha (texto direto, estilo ChatGPT); **tool** com borda amber. Avatares redondos com `ring-1`. Timestamps visíveis no hover (assistente) ou fixos (usuário). Suporta markdown (remarkGfm), anexos (imagem, áudio, arquivo) e slot `actions`. |
| `ChatTypingIndicator` | Animação `pulse-dot` suave (keyframe customizado no tailwind) com label configurável ("Pensando", "Analisando", etc.) |
| `ChatEmptyState` | Estado vazio com ícone gradiente (`from-primary/15 to-primary/5` + `ring-1`), título, descrição, botão "Nova conversa" e **props opcionais**: `suggestions: string[]` e `onSuggestionClick` para chips de sugestão rápida |
| `ChatConversationList` | Lista de conversas com timestamps relativos ("agora", "5min", "2h", "3d"), indicador lateral ativo (`w-[3px] bg-primary`), dropdown de exclusão no hover |

### Input Unificado (Estilo ChatGPT)

Todos os inputs de chat usam o padrão **card pill**:
- Container `rounded-2xl border bg-muted/20` com `focus-within:border-primary/30`
- Botões (anexo, mic, enviar) integrados dentro do card
- `<textarea>` nativo sem borda (`bg-transparent focus:outline-none`)
- Botão stop: ícone `Square` preenchido com hover destrutivo
- Botão enviar: `rounded-xl h-8 w-8`

> ⚠️ **IMPORTANTE**: Ao criar novos chats no sistema, SEMPRE utilizar os componentes de `src/components/chat/` para manter consistência visual. Nunca criar bolhas/listas de conversa customizadas. O input deve seguir o padrão card pill.
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
   - Botão mostra "Executando..." com spinner (via executingActionId)
   - Botão fica disabled durante execução
   ↓
6. POST /command-assistant-execute
   - Valida permissões RBAC
   - Executa ação no banco
   - Retorna resultado
   ↓
7. Fluxo pós-execução (automático)
   - Frontend envia resultado da ação de volta ao chat (is_tool_result: true)
   - IA gera resposta de follow-up confirmando/resumindo a execução
   - UI mostra streaming da resposta de follow-up
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
- Botões de confirmação para ações (com loading via `executingActionId`)
- Histórico persistido por tenant
- Fluxo pós-execução: envia resultado de volta à IA automaticamente

### Props de CommandChatMessages

| Prop | Tipo | Descrição |
|------|------|-----------|
| `messages` | `CommandMessage[]` | Lista de mensagens |
| `isStreaming` | `boolean` | Se está recebendo streaming |
| `streamingContent` | `string` | Conteúdo parcial do streaming |
| `executingActionId` | `string \| null` | ID da ação em execução (mostra "Executando..." no botão) |
| `onExecuteAction` | `(action) => void` | Callback de execução |

### useCommandAssistant — Retorno

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `executingActionId` | `string \| null` | ID da ação sendo executada (para UI de loading) |
| `executeAction` | `(action) => Promise<void>` | Executa ação + envia resultado de volta à IA |
| `cancelStreaming` | `() => void` | Cancela streaming ativo |

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

## Sistema de Memória IA (v1.0.0)

Todas as IAs do sistema possuem memória persistente com escopo híbrido (tenant + usuário).

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `ai_memories` | Fatos de longo prazo (negócio, preferências, decisões, insights) |
| `ai_conversation_summaries` | Resumos automáticos de conversas anteriores |

### Escopo Híbrido

| Escopo | `user_id` | Visibilidade |
|--------|-----------|-------------|
| `tenant` | NULL | Compartilhado entre todos os usuários da loja |
| `user` | preenchido | Apenas o usuário que criou |

### IAs com Memória

| IA | `ai_agent` | Tipo de Memória |
|----|-----------|-----------------|
| ChatGPT | `chatgpt` | Fatos + Resumos |
| Auxiliar de Comando | `command_assistant` | Fatos + Resumos |
| IA de Tráfego (Chat) | `ads_chat` | Fatos + Resumos |
| Atendimento IA | `support` | Apenas fatos do tenant (sem resumos) |
| Autopilot | `ads_autopilot` | Fatos do tenant |

### Categorias de Memória

| Categoria | Descrição | Exemplo |
|-----------|-----------|---------|
| `business_fact` | Fato sobre o negócio | "Loja de cosméticos naturais, público 25-45 anos" |
| `preference` | Preferência do usuário | "Prefere relatórios resumidos com bullet points" |
| `decision` | Decisão tomada | "Orçamento de tráfego definido em R$ 50/dia" |
| `product_insight` | Insight de produto | "Kit Hidratação é o best-seller com 40% das vendas" |
| `persona` | Persona/avatar do cliente | "Cliente ideal: mulher 30+, preocupada com ingredientes" |

### Edge Function: `ai-memory-manager`

| Ação | Descrição |
|------|-----------|
| `extract_memories` | Extrai fatos importantes de uma conversa via IA |
| `summarize_conversation` | Gera resumo conciso de uma conversa |
| `save_memory` | Salva memória manualmente |
| `delete_memory` | Remove memória |

### RPCs do Banco

| Função | Descrição |
|--------|-----------|
| `get_ai_memories(tenant, user, agent, limit)` | Busca memórias relevantes (tenant + user) |
| `get_recent_conversation_summaries(tenant, user, agent, limit)` | Busca resumos recentes |

### Shared Helper: `_shared/ai-memory.ts`

```typescript
import { getMemoryContext } from "../_shared/ai-memory.ts";
const memoryContext = await getMemoryContext(supabase, tenantId, userId, "chatgpt");
// Retorna string formatada para injetar no system prompt
```

### Injeção no Prompt

O `memoryContext` é concatenado ao final do system prompt de cada IA, contendo:
1. **Fatos do Negócio** (compartilhados) — importância DESC
2. **Preferências do Usuário** (pessoais)
3. **Resumos de Conversas Anteriores** — últimas 5

---

## Checklist

- [ ] Painel abre com ⌘K
- [ ] Conversas persistem por tenant
- [ ] Streaming funciona corretamente
- [ ] Ações propostas são exibidas
- [ ] Confirmação executa ação
- [ ] Permissões RBAC respeitadas
- [ ] Linguagem UI-friendly (sem jargão técnico)
- [ ] Memória persistente funciona entre sessões
