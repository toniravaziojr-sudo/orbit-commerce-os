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

### 4.1 Chat Conversacional

- **Streaming de respostas** - Respostas aparecem em tempo real
- **Histórico independente** - Separado do Auxiliar de Comando
- **Markdown rendering** - Suporte completo a formatação com `prose` classes
- **Modelo utilizado** - `openai/gpt-5` via Lovable AI Gateway

### 4.2 Interface

- **Sidebar colapsável** - Lista de conversas com busca
- **Área principal** - Chat com input fixo no rodapé
- **Nova conversa** - Botão para iniciar nova sessão
- **Responsivo** - Adapta para mobile e desktop
- **Indicador de uso** - Mostra consumo vs limite do plano

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
    content: string;
  }>;
  tenant_id: string; // Para registro de uso
}
```

### 5.4 Response

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

```
Básico       → Bloqueado (não exibir na página de planos)
Evolução     → Bloqueado (não exibir na página de planos)
Profissional → ChatGPT: até US$ 2/mês incluídos
Avançado     → ChatGPT: até US$ 5/mês incluídos
Impulso      → ChatGPT: até US$ 10/mês incluídos
Consolidar   → ChatGPT: até US$ 15/mês incluídos
Comando Máximo → ChatGPT: até US$ 25/mês incluídos
Customizado  → ChatGPT: Ilimitado
```

### 10.2 Feature Bullets (para exibição)

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

### 10.3 Observações para o Site

1. **Texto explicativo sugerido:**
   > "Pesquise na internet, tire dúvidas e gere conteúdo com inteligência artificial. Uso acima do limite incluído é cobrado à parte na fatura mensal."

2. **Tooltip/Help:**
   > "O ChatGPT é um assistente de IA para pesquisas e geração de conteúdo. Cada plano inclui um limite mensal de uso em dólares. Uso excedente é cobrado proporcionalmente."

3. **Destaque visual:**
   - Usar ícone `Sparkles` ou similar
   - Cores: verde para incluído, cinza para bloqueado
