# Regras: Módulo ChatGPT

> **Caminho:** `/chatgpt`  
> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-27

## 1. Visão Geral

O módulo ChatGPT é um assistente de IA integrado que permite aos usuários realizar pesquisas, consultas e interações de forma conversacional, similar à experiência do ChatGPT original.

**IMPORTANTE**: Este módulo é SEPARADO do Auxiliar de Comando. Cada um tem seu próprio histórico de conversas.

| Módulo | Propósito | Tabelas |
|--------|-----------|---------|
| **Auxiliar de Comando** | Executar ações no sistema (editar produtos, criar campanhas, etc.) | `command_conversations`, `command_messages` |
| **ChatGPT** | Pesquisas gerais, tirar dúvidas, gerar conteúdo | `chatgpt_conversations`, `chatgpt_messages` |

---

## 2. Restrição por Plano

O módulo ChatGPT possui restrições de acesso baseadas no plano do tenant:

| Plano | Acesso | Limite Incluído (USD/mês) | Excedente |
|-------|--------|---------------------------|-----------|
| `basico` | ❌ Bloqueado | - | - |
| `evolucao` | ❌ Bloqueado | - | - |
| `profissional` | ✅ Liberado | US$ 2,00 | Cobrado à parte |
| `avancado` | ✅ Liberado | US$ 5,00 | Cobrado à parte |
| `impulso` | ✅ Liberado | US$ 10,00 | Cobrado à parte |
| `consolidar` | ✅ Liberado | US$ 15,00 | Cobrado à parte |
| `comando_maximo` | ✅ Liberado | US$ 25,00 | Cobrado à parte |
| `customizado` | ✅ Liberado | Ilimitado | - |

### 2.1 Tabelas de Controle

| Tabela | Campo | Descrição |
|--------|-------|-----------|
| `plan_limits` | `chatgpt_included_usd` | Limite mensal incluído no plano |
| `plan_module_access` | `module_key = 'chatgpt'` | Nível de acesso (none/full) |
| `tenant_monthly_usage` | `chatgpt_usage_usd` | Uso acumulado no mês |
| `tenant_monthly_usage` | `chatgpt_extra_usd` | Valor excedente a cobrar |

### 2.2 Funções RPC

| Função | Descrição |
|--------|-----------|
| `check_chatgpt_access(tenant_id)` | Verifica acesso e retorna limites |
| `record_chatgpt_usage(tenant_id, cost_usd)` | Registra uso e calcula excedente |

### 2.3 Comportamento

1. **Planos bloqueados (basico, evolucao):**
   - Exibir tela de upgrade com CTA
   - Não permitir envio de mensagens

2. **Planos liberados:**
   - Permitir uso normal até atingir limite
   - Após limite: continuar funcionando, mas cobrar excedente na fatura mensal
   - Exibir indicador de uso atual vs limite

---

## 3. Arquitetura

### 3.1 Componentes

| Componente | Caminho | Descrição |
|------------|---------|-----------|
| Página Principal | `src/pages/ChatGPT.tsx` | Interface completa do chat |
| Input Multimodal | `src/components/chatgpt/ChatGPTChatInput.tsx` | Input com áudio e anexos |
| Hook de Estado | `src/hooks/useChatGPT.ts` | Gerenciamento de conversas e mensagens |
| Edge Function | `supabase/functions/chatgpt-chat/index.ts` | Proxy para AI Gateway |

### 3.2 Tabelas (Separadas do Auxiliar de Comando)

| Tabela | Descrição |
|--------|-----------|
| `chatgpt_conversations` | Armazena conversas do ChatGPT |
| `chatgpt_messages` | Armazena mensagens do ChatGPT |

**NÃO REUTILIZAR** as tabelas `command_conversations` e `command_messages` - essas são exclusivas do Auxiliar de Comando.

---

## 4. Funcionalidades

### 4.1 Modos de Operação

O ChatGPT possui 3 modos de operação selecionáveis via chips no input:

| Modo | Ícone | Modelo | Descrição |
|------|-------|--------|-----------|
| **Chat** | `MessageSquare` | `openai/gpt-5` | Conversa padrão (default) |
| **Thinking** | `Brain` | `o3-mini` | Raciocínio avançado via OpenAI direta |
| **Busca** | `Search` | Firecrawl + `gemini-2.5-flash` | Pesquisa na internet em tempo real |

**Seleção de modo:**
- Chips coloridos acima do input
- Azul = Chat, Roxo = Thinking, Verde = Busca
- Modo é salvo no metadata da mensagem

**Roteamento na Edge Function:**
```typescript
if (mode === "search") {
  return await handleSearchMode(messages);
} else if (mode === "thinking") {
  return await handleThinkingMode(messages);
} else {
  return await handleChatMode(messages, hasAttachments);
}
```

### 4.2 Chat Conversacional

- **Streaming de respostas** - Respostas aparecem em tempo real
- **Histórico independente** - Separado do Auxiliar de Comando
- **Markdown rendering** - Suporte completo a formatação com `prose` classes
- **Modelos utilizados:**
  - `openai/gpt-5` - Padrão para texto
  - `google/gemini-2.5-pro` - Ativado automaticamente quando há imagens

### 4.3 Modo Thinking (Raciocínio)

- **Modelo:** `o3-mini` (OpenAI direta)
- **Uso:** Problemas complexos, matemática, lógica
- **Características:**
  - Raciocínio em cadeia (chain-of-thought)
  - Decomposição de problemas
  - Verificação lógica

### 4.4 Modo Busca na Internet

- **Integração:** Firecrawl API
- **Fluxo:**
  1. Extrai query da última mensagem do usuário
  2. Busca 5 resultados via Firecrawl Search
  3. Sintetiza resposta usando Gemini
  4. Inclui citações das fontes

### 4.5 Suporte Multimodal

| Tipo | Suporte | Detalhes |
|------|---------|----------|
| **Imagens** | ✅ | Upload de JPG, PNG, GIF, WebP. Análise via Vision API |
| **Áudio** | ✅ | Gravação direta no navegador. Transcrição automática |
| **Arquivos** | ✅ | PDF, DOC, DOCX, TXT, CSV, XLS, XLSX |

**Componentes:**
- `ChatGPTChatInput.tsx` - Input unificado com gravação de áudio, upload e seleção de modo
- Limite de arquivos: 5 por mensagem
- Tamanho máximo: 10MB por arquivo

### 4.6 Interface

- **Sidebar colapsável** - Lista de conversas com busca
- **Área principal** - Chat com input fixo no rodapé
- **Chips de modo** - Seletor visual acima do input
- **Indicador de modo** - Badge na resposta indicando modo usado
- **Nova conversa** - Botão para iniciar nova sessão
- **Responsivo** - Adapta para mobile e desktop

---

## 5. Edge Function: chatgpt-chat

### 5.1 Configuração

```toml
[functions.chatgpt-chat]
verify_jwt = false
```

### 5.2 Endpoint

```
POST /functions/v1/chatgpt-chat
```

### 5.3 Request Body

```typescript
{
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{
      type: 'text' | 'image_url';
      text?: string;
      image_url?: { url: string };
    }>;
  }>;
  tenant_id: string;
  hasAttachments?: boolean; // Indica presença de mídia
}
```

### 5.4 Seleção Automática de Modelo

| Condição | Modelo Utilizado |
|----------|------------------|
| Apenas texto | `openai/gpt-5` |
| Contém imagens | `google/gemini-2.5-pro` |

### 5.5 Response

- **Content-Type:** `text/event-stream`
- **Formato:** Server-Sent Events (SSE)

### 5.5 System Prompt

O assistente é configurado para:
- Responder perguntas sobre qualquer assunto
- Ajudar com pesquisas e análises
- Gerar textos, resumos e conteúdo
- Auxiliar com cálculos e lógica
- Fornecer explicações claras
- Ajudar com programação e código
- Traduzir textos entre idiomas
- Responder no idioma da pergunta
- Usar formatação Markdown (##, **, listas)

---

## 6. Tratamento de Erros

| Código | Mensagem | Ação |
|--------|----------|------|
| 403 | Plano não permite ChatGPT | Exibir CTA de upgrade |
| 429 | Rate limits exceeded | Retry após delay |
| 402 | Payment required | Verificar créditos |
| 500 | AI gateway error | Log + fallback |

---

## 7. Navegação

- **Grupo:** Principal (logo abaixo de "Central de Comando")
- **Ícone:** `Sparkles`
- **Label:** "ChatGPT"

---

## 8. Proibições

| Proibido | Motivo |
|----------|--------|
| Armazenar API keys no código | Segurança |
| Desabilitar streaming | UX degradada |
| Remover system prompt | Comportamento inconsistente |
| Usar modelo diferente sem aprovação | Custos e qualidade |
| Misturar histórico com Auxiliar de Comando | Confunde propósitos |
| Permitir acesso em planos bloqueados | Regra de negócio |

---

## 9. Dependências

- `react-markdown` - Renderização de markdown
- `remark-gfm` - GitHub Flavored Markdown
- `@tanstack/react-query` - Cache e gerenciamento de estado
- Lovable AI Gateway - Backend de IA
- `src/hooks/useChatGPT.ts` - Hook separado para estado

---

## 10. Instruções para Lovable Site

Para implementar este módulo nos planos do site (Lovable), seguir estas especificações:

### 10.1 Planos e Limites

| Plano | Acesso | Limite Incluído (USD/mês) | Excedente |
|-------|--------|---------------------------|-----------|
| Básico | ❌ Bloqueado | - | - |
| Evolução | ❌ Bloqueado | - | - |
| Profissional | ✅ Liberado | US$ 2,00 | Cobrado à parte |
| Avançado | ✅ Liberado | US$ 5,00 | Cobrado à parte |
| Impulso | ✅ Liberado | US$ 10,00 | Cobrado à parte |
| Consolidar | ✅ Liberado | US$ 15,00 | Cobrado à parte |
| Comando Máximo | ✅ Liberado | US$ 25,00 | Cobrado à parte |
| Customizado | ✅ Liberado | Ilimitado | - |

### 10.2 Feature Bullets (para exibição nos cards)

| Plano | Bullet Point |
|-------|--------------|
| Básico | ❌ ChatGPT: Não disponível |
| Evolução | ❌ ChatGPT: Não disponível |
| Profissional | ✅ ChatGPT: US$ 2/mês incluídos |
| Avançado | ✅ ChatGPT: US$ 5/mês incluídos |
| Impulso | ✅ ChatGPT: US$ 10/mês incluídos |
| Consolidar | ✅ ChatGPT: US$ 15/mês incluídos |
| Comando Máximo | ✅ ChatGPT: US$ 25/mês incluídos |
| Customizado | ✅ ChatGPT: Ilimitado |

### 10.3 Implementação Visual

**Ícone:** `Sparkles` (lucide-react)

**Estilização dos bullets:**
- Planos bloqueados: cor cinza/muted, ícone `X` vermelho
- Planos liberados: cor verde/success, ícone `Check` verde

### 10.4 Textos de Apoio

**Tooltip/Help (ao passar mouse sobre o bullet):**
> "O ChatGPT é um assistente de IA para pesquisas e geração de conteúdo. Cada plano inclui um limite mensal de uso em dólares. Uso excedente é cobrado proporcionalmente na fatura mensal."

**Descrição curta (para seção de features):**
> "Pesquise na internet, tire dúvidas e gere conteúdo com inteligência artificial. Uso acima do limite incluído é cobrado à parte na fatura mensal."

### 10.5 API de Dados

Os dados já estão disponíveis na API `public-plans`:

```
GET /functions/v1/public-plans
```

Response inclui `feature_bullets[]` com os textos já formatados para cada plano.

---

## 11. Prompt para Lovable Site

**Copiar e colar este prompt no projeto do site:**

---

### Implementar exibição do módulo ChatGPT na página de planos

A API `public-plans` (endpoint `/functions/v1/public-plans`) já retorna os dados atualizados com os bullets do ChatGPT no campo `feature_bullets`.

#### Requisitos:

1. **Exibir o bullet de ChatGPT em cada card de plano**, usando os dados já retornados pela API:

| Plano | Exibição |
|-------|----------|
| Básico | ❌ ChatGPT: Não disponível |
| Evolução | ❌ ChatGPT: Não disponível |
| Profissional | ✅ ChatGPT: US$ 2/mês incluídos |
| Avançado | ✅ ChatGPT: US$ 5/mês incluídos |
| Impulso | ✅ ChatGPT: US$ 10/mês incluídos |
| Consolidar | ✅ ChatGPT: US$ 15/mês incluídos |
| Comando Máximo | ✅ ChatGPT: US$ 25/mês incluídos |
| Customizado | ✅ ChatGPT: Ilimitado |

2. **Estilização:**
   - Usar ícone `Sparkles` (do lucide-react) ao lado do texto "ChatGPT"
   - Bullets com "Não disponível" devem ter cor cinza/muted e ícone ❌
   - Bullets com valores incluídos devem ter cor verde/success e ícone ✅

3. **Tooltip (opcional mas recomendado):**
   > "O ChatGPT é um assistente de IA para pesquisas e geração de conteúdo. Cada plano inclui um limite mensal de uso em dólares. Uso excedente é cobrado proporcionalmente na fatura mensal."

4. **Observação técnica:**
   - Os dados já vêm prontos do backend em `feature_bullets[]`
   - Não é necessário hardcodar valores, apenas renderizar o array
   - O bullet de ChatGPT está incluído junto com os demais features de cada plano

---
