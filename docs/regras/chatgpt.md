# Regras: Módulo ChatGPT

> **Caminho:** `/chatgpt`  
> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-27

## 1. Visão Geral

O módulo ChatGPT é um assistente de IA integrado que permite aos usuários realizar pesquisas, consultas e interações de forma conversacional, similar à experiência do ChatGPT original.

## 2. Arquitetura

### 2.1 Componentes

| Componente | Caminho | Descrição |
|------------|---------|-----------|
| Página Principal | `src/pages/ChatGPT.tsx` | Interface completa do chat |
| Edge Function | `supabase/functions/chatgpt-chat/index.ts` | Proxy para AI Gateway |

### 2.2 Tabelas Utilizadas

O módulo reutiliza as tabelas existentes do Auxiliar de Comando:

- `command_conversations` - Armazena conversas
- `command_messages` - Armazena mensagens

## 3. Funcionalidades

### 3.1 Chat Conversacional

- **Streaming de respostas** - Respostas aparecem em tempo real
- **Histórico de conversas** - Sidebar com conversas anteriores
- **Markdown rendering** - Suporte completo a formatação
- **Modelo utilizado** - `openai/gpt-5` via Lovable AI Gateway

### 3.2 Interface

- **Sidebar colapsável** - Lista de conversas com busca
- **Área principal** - Chat com input fixo no rodapé
- **Nova conversa** - Botão para iniciar nova sessão
- **Responsivo** - Adapta para mobile e desktop

## 4. Edge Function: chatgpt-chat

### 4.1 Configuração

```toml
[functions.chatgpt-chat]
verify_jwt = false
```

### 4.2 Endpoint

```
POST /functions/v1/chatgpt-chat
```

### 4.3 Request Body

```typescript
{
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>
}
```

### 4.4 Response

- **Content-Type:** `text/event-stream`
- **Formato:** Server-Sent Events (SSE)

### 4.5 System Prompt

O assistente é configurado para:
- Responder perguntas sobre qualquer assunto
- Ajudar com pesquisas e análises
- Gerar textos, resumos e conteúdo
- Auxiliar com cálculos e lógica
- Fornecer explicações claras
- Ajudar com programação e código
- Traduzir textos entre idiomas
- Responder no idioma da pergunta

## 5. Tratamento de Erros

| Código | Mensagem | Ação |
|--------|----------|------|
| 429 | Rate limits exceeded | Retry após delay |
| 402 | Payment required | Verificar créditos |
| 500 | AI gateway error | Log + fallback |

## 6. Navegação

- **Grupo:** Principal (logo abaixo de "Central de Comando")
- **Ícone:** `MessageSquare`
- **Label:** "ChatGPT"

## 7. Proibições

| Proibido | Motivo |
|----------|--------|
| Armazenar API keys no código | Segurança |
| Desabilitar streaming | UX degradada |
| Remover system prompt | Comportamento inconsistente |
| Usar modelo diferente sem aprovação | Custos e qualidade |

## 8. Dependências

- `react-markdown` - Renderização de markdown
- `@tanstack/react-query` - Cache e gerenciamento de estado
- Lovable AI Gateway - Backend de IA
