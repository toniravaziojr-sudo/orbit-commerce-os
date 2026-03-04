# Auxiliar de Comando — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-03-03  
> **Versão do Pipeline:** v3.14.0 | **AI Router:** v1.2.0  
> **Cobertura:** 61+ tools — 100% dos módulos (Fases 1–5 completas)

---

## Upload de Arquivos e Imagens

O Auxiliar de Comando suporta upload de arquivos e imagens diretamente no chat:

### Funcionamento

1. **Botão de Anexo**: Clique no ícone 📎 (Paperclip) para selecionar arquivos
2. **Ctrl+V / Cmd+V**: Cole screenshots diretamente no campo de texto — a imagem é detectada automaticamente do clipboard, nomeada como `screenshot-{timestamp}.png` e enviada para upload
3. **Tipos Aceitos**: Imagens, PDFs, documentos Office, TXT, CSV
4. **Limite**: 10MB por arquivo
5. **Preview**: Imagens mostram miniatura antes do envio
6. **Upload**: Arquivos são enviados para o System Drive automaticamente

### Processamento Multimodal (v3.12.0)

A IA **enxerga** as imagens enviadas:

- **Imagens** (PNG, JPG, WEBP, etc.): São passadas como `image_url` com `detail: "high"` no conteúdo multimodal da mensagem. O modelo Gemini 2.5 Flash analisa visualmente a imagem
- **Histórico**: Imagens de mensagens anteriores na conversa também são incluídas no contexto visual
- **Arquivos texto/PDF**: Atualmente enviados como link — a IA vê a URL mas **não lê o conteúdo** automaticamente (feature futura)

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

## Arquitetura (v3.8.0 — OpenAI Nativa + Linguagem Natural para Empreendedores)

### Modelo de IA

> **Mudança v3.5.0**: Migração de Gemini (via Lovable Gateway) para **OpenAI nativa (gpt-4o)** com `preferProvider: 'openai'`. Motivo: Gemini via OpenAI-compat não suportava `tools` de forma confiável, causando alucinações onde a IA dizia "estou buscando" sem chamar nenhuma tool.

### Filosofia de Interpretação (v3.8.0)

> **Princípio**: O usuário é um empreendedor comum, NÃO um especialista em prompts. A IA deve interpretar a **intenção**, não as palavras exatas.

**Regras fundamentais do system prompt:**

1. **Cada mensagem é um pedido independente** — o histórico anterior é referência, não "modo de operação ativo". Se o usuário muda de assunto, a IA deve abandonar o raciocínio anterior imediatamente.
2. **Interpretação de intenção** — "aplica descontos nos kits" = desconto percentual. "agora faz X" = nova tarefa. A IA infere sem exigir termos técnicos.
3. **Não esperar prompts perfeitos** — se ambíguo, perguntar em 1 frase simples em vez de assumir errado.
4. **Nunca reciclar raciocínio anterior** — se a tarefa anterior era "recalcular preços" e agora pede "aplicar descontos", começar do zero.

**Tabela de decisão para kits (no system prompt):**

| O que o usuário quer | Como identificar | Ferramenta |
|---|---|---|
| Desconto/promoção | "desconto", "%", valor menor, promoção | `listKitsSummary` → `applyKitDiscount` |
| Corrigir preço base | "recalcular", "preço mudou" | `findKitsContainingProduct` → `recalculateKitPrices` |
| Frete grátis (em massa) | "frete grátis", "frete gratuito", "free shipping" | `bulkUpdateProductsFreeShipping` |
| Frete grátis (individual) | "frete grátis no produto X" | `updateProduct` com `freeShipping: true` |
| Não ficou claro | Qualquer dúvida | Perguntar em 1 frase simples |

### 🔧 Feature: Frete Grátis em Massa (v3.13.0)

> **Problema corrigido**: Quando o usuário pedia "ative frete grátis nos kits", a IA não tinha ferramenta específica e usava `bulkUpdateProductsPrice` incorretamente, gerando mensagens de sucesso sobre "preço" quando o pedido era sobre "frete". A ação também falhava no banco pois a tool não suportava o campo `free_shipping`.

**Novas tools:**

1. **`bulkUpdateProductsFreeShipping`** (Escrita com confirmação): Atualiza `free_shipping` em massa. Suporta filtros:
   - `productIds`: Array de IDs específicos
   - `categoryId`: Filtrar por categoria
   - `productFormat`: Filtrar por formato (`simple`, `with_composition`, `with_variants`)
   - `minComponents`: Número mínimo de **unidades totais** na composição (soma das quantidades dos componentes, NÃO contagem de linhas). Ex: `minComponents=3` inclui kits com 1 componente em quantidade 3 ou kits com 3 componentes diferentes em quantidade 1 cada.
   - `freeShipping`: Boolean — ativar ou desativar

> ⚠️ **REGRA CRÍTICA (v3.13.1):** O filtro `minComponents` calcula `SUM(product_components.quantity)` por kit, e NÃO `COUNT(product_components.id)`. Um kit com 1 produto em quantidade 5 tem `minComponents = 5`, não 1.
2. **`updateProduct` expandido**: Agora aceita `freeShipping` e `requiresShipping` como parâmetros opcionais para edição individual

**Tabela de decisão atualizada no system prompt:**

| Palavras-chave | Ferramenta correta | ❌ NÃO usar |
|---|---|---|
| "frete grátis", "frete gratuito", "free shipping" | `bulkUpdateProductsFreeShipping` | `bulkUpdateProductsPrice` |
| "preço", "desconto", "%" | `bulkUpdateProductsPrice` / `applyKitDiscount` | `bulkUpdateProductsFreeShipping` |

**Arquivos alterados:** `supabase/functions/command-assistant-chat/index.ts`, `supabase/functions/command-assistant-execute/index.ts`

### Arquitetura de Tools: Leitura Automática vs Escrita com Confirmação

O sistema usa **native tool calling** da OpenAI para executar tools de leitura automaticamente no servidor, sem confirmação do usuário. Apenas tools de escrita exigem confirmação via botão.

#### Tools de Leitura (Auto-executáveis — server-side)

Essas tools são executadas internamente pela Edge Function `command-assistant-chat` antes de gerar a resposta final. O usuário não vê botão de confirmação para elas:

`searchProducts`, `listProducts`, `getProductDetails`, `listProductComponents`, `findKitsContainingProduct`, `listKitsSummary`, `searchOrders`, `getOrderDetails`, `listDiscounts`, `listCategories`, `getDashboardStats`, `getTopProducts`, `listCustomerTags`, `searchCustomers`, `listBlogPosts`, `listOffers`, `listReviews`, `listPages`, `getFinancialSummary`, `listShippingMethods`, `listNotifications`, `listFiles`, `getStorageUsage`, `listEmailLists`, `listSubscribers`, `listCampaigns`, `listAgendaTasks`, `inventoryReport`, `customersReport`, `salesReport`

#### Tools de Escrita (Confirmação via botão)

Todas as demais (create, update, delete, bulk) mantêm o fluxo com botão "Confirmar".

### ⚠️ Regra Anti-Alucinação (v3.1.0)

> **Problema corrigido**: A IA gerava texto dizendo "estou buscando seus produtos..." sem realmente chamar nenhuma tool de busca, causando UX onde o usuário ficava esperando sem nada acontecer.

**Regras implementadas no system prompt:**

1. **NUNCA** dizer "vou buscar" ou "estou buscando" sem REALMENTE chamar uma tool na mesma resposta
2. Se precisa de dados (nome, preço, ID de produto), CHAMAR `searchProducts`/`listProducts` IMEDIATAMENTE via function calling
3. Se o usuário pede ação sobre produtos, PRIMEIRO buscar via tool calling, DEPOIS propor a ação
4. **PROIBIDO** gerar texto anunciando intenção de ação SEM realmente executar — tools são síncronas
5. Se não tem IDs → CHAMAR searchProducts. Não responder sem chamar.

### 🔧 Feature: Desconto por Faixa de Kits (v3.7.0)

> **Problema corrigido**: Quando o usuário pedia "aplique descontos nos kits: 2 unidades = 12-15%, 3 unidades = 18-20%", a IA não tinha como listar kits por quantidade de unidades nem aplicar descontos percentuais.

**Novas tools:**

1. **`listKitsSummary`** (Leitura auto-executável): Lista TODOS os kits com nome, SKU, preço e **total de unidades** (soma das quantidades dos componentes). Aceita filtros `minUnits`/`maxUnits`.
2. **`applyKitDiscount`** (Escrita com confirmação): Aplica desconto percentual sobre kits. Define `compare_at_price` = preço cheio (soma dos componentes) e `price` = preço com desconto. Aceita array de `{kitId, discountPercent}`.

**Fluxo esperado:** `listKitsSummary` (sem filtro, pegar TODOS) → agrupar por faixa → **UMA ÚNICA chamada** `applyKitDiscount` com TODOS os kits de TODAS as faixas

### 🔧 Fix: Anti-Fragmentação de Descontos em Kits (v3.9.0)

> **Problema corrigido**: Ao pedir descontos por faixa (ex: "2x=12-15%, 3x=18-20%, 6x=25-30%, 12x=38%"), a IA fragmentava em 4+ ações separadas (uma por faixa), exigindo múltiplas confirmações. Também re-listava o plano completo várias vezes antes de executar, e às vezes esquecia faixas inteiras.

**Mudanças:**

1. **Regra Anti-Fragmentação no system prompt**: Instrução explícita de que `applyKitDiscount` DEVE receber TODOS os kits de TODAS as faixas em uma ÚNICA chamada
2. **Workflow obrigatório**: `listKitsSummary` (1x, sem filtro) → agrupar → 1 bloco `action` com array completa
3. **Proibição de re-listagem**: A IA não deve listar o plano inteiro múltiplas vezes antes de executar
4. **Exceção à regra "Uma Ação por Vez"**: `applyKitDiscount` é explicitamente marcada como exceção que aceita operações em lote

**Arquivo alterado:** `supabase/functions/command-assistant-chat/index.ts` (system prompt)

### 🔧 Fix: Anti-Alucinação por Detecção de Padrão (v3.14.0)

> **Problema corrigido**: Quando OpenAI retornava 429 e o Gemini assumia via fallback, o Gemini frequentemente gerava respostas de texto dizendo "vou verificar agora mesmo" ou "já estou buscando" **sem chamar nenhuma tool**. O sistema aceitava essa resposta como válida ("Phase 1 complete") e a enviava ao usuário, que ficava esperando uma verificação que nunca acontecia.

**Mudanças:**

1. **Guard de detecção de padrão**: Após cada rodada de tool calling, se a IA responde com texto (sem tool_calls) contendo padrões como "vou verificar", "estou buscando", "deixa eu checar", o sistema detecta automaticamente
2. **Injeção de correção**: Ao detectar alucinação, injeta uma mensagem de sistema forçando a IA a chamar as tools disponíveis na próxima rodada
3. **Retry automático**: A rodada não é encerrada — o loop de tool calling continua, dando à IA chance de chamar as tools corretamente
4. **Padrões detectados**: `vou (verificar|buscar|checar|conferir|consultar|analisar)`, `estou (buscando|verificando)`, `já estou (buscando|verificando)`, `deixa eu (verificar|buscar)`, `vou te (informar|avisar)`
5. **Proteção contra loops**: A detecção só ocorre se NÃO for a última rodada (`!isLastRound`), evitando loops infinitos

**Arquivo alterado:** `supabase/functions/command-assistant-chat/index.ts` (tool calling loop)

### 🔧 Fix: Anti-Alucinação Reforçada + Auto-Continuação (v3.10.0)

> **Problemas corrigidos**:
> 1. A IA dizia "vou buscar todos os kits e produtos" mas NÃO chamava nenhuma tool — ficava parada esperando resposta do usuário
> 2. Após o usuário confirmar ("sim", "pode prosseguir"), a IA re-listava o plano inteiro e pedia confirmação NOVAMENTE (loop de re-confirmação)
> 3. Após executar uma etapa com sucesso (ex: descontos em kits 2x), a IA parava e pedia confirmação para continuar com as próximas faixas em vez de auto-continuar
> 4. A IA esquecia faixas inteiras (ex: aplicava 2x e 12x, esquecia 3x e 6x)

**Mudanças:**

1. **Anti-Alucinação reforçada**: Regra explícita de que se precisa de dados, deve chamar a tool SILENCIOSAMENTE, não anunciar intenção
2. **Proibição de loops de re-confirmação**: Se o usuário já disse "sim", é PROIBIDO re-listar o plano ou pedir "quer aplicar?" novamente
3. **Auto-continuação pós-execução**: Após ação bem-sucedida, se há etapas pendentes do pedido original, a IA DEVE executar imediatamente SEM pedir nova confirmação
4. **Checklist de completude**: Regra de revisar o pedido original e verificar se TUDO foi feito antes de finalizar

**Arquivo alterado:** `supabase/functions/command-assistant-chat/index.ts` (system prompt)

### 🔧 Fix: Few-Shot Examples + Formato Obrigatório + Sem Separação (v3.11.0)

> **Problemas corrigidos**:
> 1. A IA anunciava "vou buscar" repetidamente sem chamar nenhuma tool — mesmo com regras v3.10.0, faltavam EXEMPLOS concretos
> 2. A IA mostrava JSON cru no chat (fora do bloco ` ```action``` `), então o frontend não renderizava botões de ação
> 3. A IA separava "kits" de "produtos" desnecessariamente quando o usuário pedia "todos os produtos" — `bulkUpdateProductsPrice` sem `productIds` já aplica em TUDO

**Mudanças:**

1. **Few-shot examples obrigatórios**: Exemplos concretos no system prompt mostrando a resposta CORRETA vs ERRADA para pedidos comuns (ex: "aplica 5% de desconto em todos os produtos")
2. **Formato de ação obrigatório**: Regra explícita com destaque máximo (🚨🚨🚨) de que JSON fora de bloco ` ```action``` ` será IGNORADO pelo sistema. Exemplos visuais do formato correto vs errado
3. **Regra "Sem IDs = TODOS"**: `bulkUpdateProductsPrice` sem `productIds` = aplica em TODOS os produtos (incluindo kits). NÃO é necessário listar antes. NÃO separar kits de produtos
4. **Tabela de decisão atualizada**: Diferencia "desconto em kits ESPECÍFICOS" (→ applyKitDiscount) de "desconto em TODOS os produtos" (→ bulkUpdateProductsPrice sem filtro)

**Arquivo alterado:** `supabase/functions/command-assistant-chat/index.ts` (system prompt)

### 🔧 Fix: Rate Limit Memory no AI Router (v1.2.0)

> **Problema corrigido**: Quando OpenAI retornava 429 (rate limit) no round 1, o sistema fazia fallback para Gemini com sucesso. Porém, no round 2 de tool calling, o router esquecia que OpenAI estava em rate limit e tentava novamente — gastando 35s+ em retries (5s + 10s + 20s) até a conexão SSE morrer ("connection closed before message completed"). O usuário via a IA dizer "vou buscar" mas nunca receber resposta.

**Mudanças:**

1. **Rate Limit Memory**: O router agora marca providers que retornaram 429 e os pula automaticamente nas chamadas subsequentes (TTL: 60s)
2. **Skip log**: Quando um provider é pulado, loga `⏭️ Skipping {provider} (rate-limited in this request lifecycle)`
3. **Retries reduzidos para command-assistant**: `maxRetries: 1` e `baseDelayMs: 3000` (antes era 3 retries com 5s base = até 35s de espera)
4. **`aiChatCompletionJSON` atualizado**: Agora propaga `maxRetries` e `baseDelayMs` para `aiChatCompletion`

**Arquivos alterados:** 
- `supabase/functions/_shared/ai-router.ts` (v1.2.0 — rate limit memory)
- `supabase/functions/command-assistant-chat/index.ts` (retry config reduzido)

### 🔧 Fix: SSE Keep-Alive + Streaming Imediato (v3.8.2)

> **Problema corrigido**: A edge function fazia todas as rodadas de tool calling (~60s) **antes** de retornar qualquer byte ao navegador. Conexões eram dropadas por timeout do browser/proxy, deixando o usuário travado em "Pensando..." eternamente.

**Mudanças:**

1. **Response SSE imediata**: A `Response` com `TransformStream` é retornada instantaneamente. O processamento de tool calling acontece em background writer
2. **Heartbeat a cada 8s**: Envia `": heartbeat\n\n"` (comentário SSE) durante as rodadas para manter a conexão viva
3. **Status events por rodada**: Cada rodada emite `{ status: "processing", round: N }` — ignorado pelo frontend parser
4. **Headers otimizados**: `Cache-Control: no-cache` + `Connection: keep-alive` na response SSE
5. **Frontend atualizado**: Ambos os parsers SSE (sendMessage e executeAction) filtram eventos `status: "processing"`

**Arquivos alterados:** `supabase/functions/command-assistant-chat/index.ts`, `src/hooks/useCommandAssistant.ts`

### 🔧 Fix: Forced Response na Última Rodada + Fallback Gemini (v3.8.1)

> **Problema corrigido**: Em comandos complexos (ex: "aplique descontos em todos os kits por faixa"), a IA usava todas as 5 rodadas de tool calling sem nunca produzir uma resposta final. O fallback `streamFromAI` usava OpenAI que já estava com rate limit (429), causando shutdown da função sem resposta ao usuário.

**Mudanças:**

1. **Forced text response na última rodada**: Na rodada 5/5 (última), as tools são removidas da chamada à IA e uma instrução de sistema é injetada forçando resposta textual com os dados já coletados
2. **Fallback streaming via Gemini**: O `streamFromAI` agora usa `google/gemini-2.5-flash` com `preferProvider: 'gemini'` em vez de `openai/gpt-5`, evitando conflito de rate limit quando OpenAI já foi throttled nas rodadas anteriores
3. **Garantia**: Mesmo em cenários com muitas ferramentas, o usuário SEMPRE recebe uma resposta

**Arquivo alterado:** `supabase/functions/command-assistant-chat/index.ts`

### 🔧 Fix: Confirmação Pós-Execução (v3.6.1)

> **Problema corrigido**: Após executar uma ação (ex: recalcular preços de kits), o frontend enviava o resultado para a IA gerar uma resposta de follow-up via streaming. Se esse streaming falhasse (rate limit 429, timeout, ou resposta vazia), o `catch` apenas logava no console — o usuário nunca via confirmação no chat, precisando perguntar "já fez?".

**Mudanças:**

1. **Fallback de stream vazio**: Se o streaming retorna mas `assistantContent` está vazio, insere mensagem local de confirmação com o resultado da ação
2. **Fallback de erro de stream**: Se o fetch do follow-up falha (catch), insere mensagem local de confirmação em vez de silenciar
3. **Garantia**: O usuário SEMPRE vê uma confirmação no chat após execução, independente do estado da IA

**Arquivo alterado:** `src/hooks/useCommandAssistant.ts` (função `executeAction`)

### 🔧 Fix: Busca Reversa de Kits (v3.6.0)

> **Problema corrigido**: Ao perguntar "quais kits contêm o produto X?", a IA usava apenas `listProductComponents` (parent→children) e não encontrava nada, pois o produto X não era um kit. A busca reversa (child→parents) não existia, causando a resposta incorreta "não há kits associados".

**Mudanças:**

1. **Nova tool `findKitsContainingProduct`**: Busca reversa na tabela `product_components` filtrando por `component_product_id`, retornando todos os kits-pai com nome, SKU, preço e quantidade do componente
2. **System prompt atualizado**: Seção "KITS E COMPOSIÇÕES" instrui a IA a SEMPRE usar `findKitsContainingProduct` quando o usuário perguntar sobre kits que contêm um produto específico
3. **Regra de uso**: `listProductComponents` = "o que tem DENTRO deste kit"; `findKitsContainingProduct` = "quais kits USAM este produto"

### 🔧 Fix: Uma Ação por Vez (v3.5.0)

> **Problema corrigido**: Para comandos multi-etapa (ex: "duplique o produto X e altere o nome"), a IA tentava propor múltiplas ações de uma vez (array no bloco `action`) ou usava placeholders como `<novoID>`. Isso causava falhas no parser e ações inválidas.

**Mudanças:**

1. **Uma ação por bloco `action`**: Cada bloco deve conter EXATAMENTE um objeto JSON (nunca array)
2. **Sequenciamento obrigatório**: Para multi-step, propor APENAS a primeira etapa. Após confirmação e resultado, propor a próxima
3. **Parser com fallback de array**: Se a IA retornar array, o parser extrai o primeiro elemento gracefully
4. **Proibição de placeholders**: Nunca usar `<novoID>` — esperar o resultado real da etapa anterior

### 🔧 Fix Multi-Step Post-Execution (v3.2.0)

> **Problema corrigido**: Quando o usuário pedia operações em múltiplas etapas (ex: "atualize preços E recalcule os kits"), o fluxo pós-execução pulava a Fase 1 (tool calling) inteiramente. Isso impedia a IA de chamar `searchProducts` para encontrar IDs dos kits para a próxima etapa, causando a IA a alucinar "estou aguardando a busca" e travar.

**Mudanças:**

1. **Pós-execução agora permite tool calling**: O fluxo `is_tool_result: true` não mais pula a Fase 1. A IA pode chamar tools de leitura para buscar dados necessários para a próxima etapa.
2. **System prompt pós-execução atualizado**: Em vez de "PROIBIDO incluir blocos action", agora instrui "PROIBIDO propor a MESMA ação, mas PROSSIGA para a PRÓXIMA etapa se houver".
3. **Frontend parseProposedActions no follow-up**: O `executeAction` no hook agora parseia `proposed_actions` da resposta de follow-up, permitindo que a IA proponha a próxima ação na sequência.

### 🔧 Fix History Filtering (v3.3.0)

> **Problema corrigido**: Mensagens de resultado de execução (`is_tool_result`) eram salvas como `role: "tool"` no banco de dados, mas o filtro de histórico removia TODAS as mensagens `role: "tool"` antes de enviar ao modelo. Resultado: a IA nunca via o resultado da ação executada e alucinava dizendo "estou aguardando a busca" ou re-propunha a mesma ação.

**Mudanças:**

1. **Mensagens de resultado salvas como `role: "user"`**: Resultados de ações confirmadas agora são salvos como mensagem do usuário (em vez de "tool") com prefixo `[AÇÃO_CONCLUÍDA]` ou `[AÇÃO_FALHOU]` e metadata `is_tool_result: true`, garantindo que não sejam filtradas do histórico.
2. **Synthetic stream emite `proposed_actions`**: O streaming sintético da Phase 1 agora inclui as ações propostas no SSE, permitindo que o frontend renderize botões de confirmação imediatamente sem depender do refetch.

### Pipeline de Processamento (v3.5)

> **Mudança crítica v3**: O pipeline anterior tinha 2 fases (tool calling + streaming separado), o que causava "raciocínio duplo" — a IA pensava uma vez com os dados e depois gerava outra resposta do zero. Agora o pipeline é unificado.

#### Fluxo Normal (mensagem do usuário)

```
1. Usuário digita mensagem
   ↓
2. POST /command-assistant-chat
   - Carrega histórico (50 mensagens, filtradas — sem role "tool")
   - Injeta memórias + system prompt comprimido (~4KB)
   ↓
3. Fase 1: Tool Calling (non-streaming, até 5 rodadas) — OpenAI gpt-4o
   - OpenAI decide se precisa buscar dados
   - Se sim: executa tools → injeta resultado → repete
   - Se não: gera resposta final com content
   ↓
4. ⚡ STREAMING DA RESPOSTA (sem Fase 2 separada!)
   - Se Fase 1 gerou content (sem mais tool_calls):
     → Faz STREAMING SINTÉTICO da resposta já gerada
     → NÃO chama a API novamente (elimina "raciocínio duplo")
   - Se Fase 1 nunca foi chamada: streaming direto normal (OpenAI gpt-5)
   ↓
5. Frontend renderiza resposta
   - Extrai proposed_actions dos blocos ```action (UM objeto por bloco)
   - Se há ações de escrita: mostra botões de confirmação
```

#### Fluxo Pós-Execução (is_tool_result: true) — v3.2.0

```
1. Usuário confirma ação → POST /command-assistant-execute
   ↓
2. Frontend envia resultado de volta (is_tool_result: true, prefixo [AÇÃO_CONCLUÍDA])
   ↓
3. MESMO pipeline que fluxo normal (Fase 1 com tool calling habilitado)
   - A IA PODE chamar searchProducts/etc para buscar dados da PRÓXIMA etapa
   - System prompt reforça: NÃO re-propor a ação que acabou de executar
   ↓
4. Frontend renderiza follow-up
   - Se há próxima etapa: mostra botão de confirmação para nova ação
   - Se concluído: apenas confirmação textual
```

### Otimizações v3.5

| Aspecto | Antes (v2) | v3.3 | v3.5 |
|---------|------------|------|------|
| Modelo IA | Gemini | Gemini (Lovable Gateway) | OpenAI nativa (gpt-4o/gpt-5) |
| Chamadas API por turno | 2 | 1 | 1 |
| Pós-execução | Re-executava pipeline completo | Pipeline completo com tools | Pipeline completo com tools |
| Multi-step | Travava na 2ª etapa | ✅ Suporte completo | ✅ Uma ação por vez (sequencial) |
| Histórico | 20 mensagens | 50 mensagens (resultados como "user") | 50 mensagens (resultados como "user" com prefixo) |
| Ações no streaming sintético | Não emitidas | ✅ Emitidas via SSE | ✅ Emitidas via SSE |
| Tool calling confiável | ❌ Gemini ignorava tools | ⚠️ Via Lovable Gateway | ✅ OpenAI nativa |
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

### Streaming Sintético (v3)

Quando a Fase 1 gera a resposta final (sem mais tool_calls), o conteúdo é enviado ao frontend via **streaming sintético** — chunks de ~50 caracteres enviados em formato SSE idêntico ao streaming real. Isso garante a mesma UX de "digitação" sem chamar a API novamente.

```typescript
// Server-side: streaming sintético
const chunks = splitIntoChunks(phase1Content, 50);
for (const chunk of chunks) {
  controller.enqueue(`data: ${JSON.stringify({
    choices: [{ delta: { content: chunk } }]
  })}\n\n`);
}
```

---

## Ações Suportadas (Tools) — Cobertura 100%

> **Total: 56+ tools** — Implementação completa Fases 1–5 (Jan/2025)

---

### Produtos (Escrita)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createProduct` | Criar produto | owner, admin, manager, editor |
| `updateProduct` | Editar qualquer campo de um produto (nome, descrição, preço, peso, dimensões, SEO, estoque, status) | owner, admin, manager, editor |
| `deleteProducts` | Deletar produtos | owner, admin, manager |
| `duplicateProduct` | Duplicar produto (copia categorias, inicia inativo) | owner, admin, manager, editor |
| `bulkUpdateProductsNCM` | Atualizar NCM em massa | owner, admin, manager |
| `bulkUpdateProductsCEST` | Atualizar CEST em massa | owner, admin, manager |
| `bulkUpdateProductsPrice` | Atualizar preços em massa (%, fixo, aumento, redução, **apply_discount**). Suporta filtros: `productFormat`, `excludeKits`. `type=apply_discount` cria preço de/por (promocional). | owner, admin, manager |
| `bulkUpdateProductsStock` | Atualizar estoque em massa (set, add, subtract) | owner, admin, manager |
| `bulkActivateProducts` | Ativar/desativar em massa | owner, admin, manager |

### Produtos (Leitura)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `searchProducts` | Buscar produtos por nome/SKU | todos |
| `listProducts` | Listar produtos com filtros (status, preço, categoria, ordenação, **productFormat**, **excludeKits**). `productFormat`: `simple`, `with_composition`, `with_variants`. `excludeKits`: exclui kits. Output inclui SKU, formato e status. Limite máx 100. | todos |
| `getProductDetails` | Detalhes completos de um produto (preço, estoque, dimensões, SEO, categorias) | todos |

### Categorias

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createCategory` | Criar categoria | owner, admin, manager, editor |
| `updateCategory` | Atualizar categoria | owner, admin, manager, editor |
| `deleteCategory` | Deletar categoria | owner, admin, manager |
| `listCategories` | Listar todas as categorias (com filtro ativa/inativa) | todos |

### Cupons/Descontos

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createDiscount` | Criar cupom | owner, admin, manager |
| `updateDiscount` | Atualizar cupom | owner, admin, manager |
| `deleteDiscount` | Deletar cupom | owner, admin, manager |
| `listDiscounts` | Listar cupons (ativo/inativo, uso, validade) | todos |

### Pedidos (Escrita)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `updateOrderStatus` | Atualizar status do pedido | owner, admin, manager, attendant |
| `bulkUpdateOrderStatus` | Atualizar status em massa | owner, admin, manager |
| `addOrderNote` | Adicionar nota ao pedido | owner, admin, manager, attendant |
| `addTrackingCode` | Adicionar código de rastreio + transportadora | owner, admin, manager |
| `cancelOrder` | Cancelar pedido (com motivo) | owner, admin |
| `createManualOrder` | Criar pedido manual (busca/cria cliente, calcula totais) | owner, admin, manager |

### Pedidos (Leitura)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `searchOrders` | Buscar pedidos por número, cliente, status, período | todos |
| `getOrderDetails` | Detalhes completos (itens, pagamento, frete, endereço, rastreio) | todos |

### Clientes (Escrita)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createCustomer` | Criar cliente | owner, admin, manager, attendant |
| `updateCustomer` | Atualizar cliente | owner, admin, manager, attendant |
| `deleteCustomer` | Excluir cliente (soft delete) | owner, admin |
| `addCustomerTag` | Adicionar tag a clientes | owner, admin, manager, attendant |
| `removeCustomerTag` | Remover tag de clientes | owner, admin, manager |
| `createCustomerTag` | Criar nova tag de cliente | owner, admin, manager |

### Clientes (Leitura)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `searchCustomers` | Buscar clientes por nome/email/telefone | todos |
| `listCustomerTags` | Listar tags disponíveis | todos |

### Composição de Kits

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `addProductComponent` | Adicionar componente a um kit | owner, admin, manager, editor |
| `removeProductComponent` | Remover componente de um kit | owner, admin, manager, editor |
| `listProductComponents` | Listar composição de um kit (parent → children) | todos |
| `findKitsContainingProduct` | Busca reversa: quais kits contêm um produto como componente (child → parents) | todos |
| `listKitsSummary` | Lista TODOS os kits com resumo (nome, SKU, preço, total de unidades). Filtra por minUnits/maxUnits | todos |
| `bulkSetCompositionType` | Alterar tipo de composição (físico/virtual) em massa | owner, admin, manager |
| `autoCreateKitCompositions` | Detectar kits sem composição | owner, admin, manager |
| `recalculateKitPrices` | Recalcular preços de kits baseado nos componentes (Σ preço×qtd) | owner, admin, manager |
| `applyKitDiscount` | Aplicar desconto percentual sobre kits (compare_at_price = cheio, price = com desconto) | owner, admin, manager |

### Blog

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createBlogPost` | Criar post (rascunho ou publicado) | owner, admin, manager, editor |
| `updateBlogPost` | Editar post (título, conteúdo, status) | owner, admin, manager, editor |
| `deleteBlogPost` | Excluir post | owner, admin |
| `listBlogPosts` | Listar posts (filtro por status) | todos |

### Ofertas (Bump/Upsell)

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createOffer` | Criar regra de bump/upsell | owner, admin |
| `updateOffer` | Editar oferta | owner, admin |
| `deleteOffer` | Excluir oferta | owner, admin |
| `listOffers` | Listar ofertas (tipo, status) | todos |

### Avaliações

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `listReviews` | Listar avaliações (filtro por status) | todos |
| `approveReview` | Aprovar avaliação | owner, admin, manager |
| `rejectReview` | Rejeitar avaliação | owner, admin, manager |
| `respondToReview` | Responder avaliação | owner, admin, manager |

### Páginas Institucionais

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `listPages` | Listar páginas (publicadas/rascunho) | todos |
| `createPage` | Criar página institucional | owner, admin, manager, editor |
| `updatePage` | Editar página | owner, admin, manager, editor |

### Financeiro

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `getFinancialSummary` | Resumo financeiro (receita, pagos, pendentes, ticket médio) | owner, admin |

### Logística

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `listShippingMethods` | Listar métodos de frete configurados | todos |

### Notificações

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `listNotifications` | Listar notificações (lidas/não lidas) | todos |
| `markNotificationRead` | Marcar notificação como lida | todos |

### Mídia/Drive

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `listFiles` | Listar arquivos do drive (por pasta) | todos |
| `getStorageUsage` | Verificar uso de armazenamento | owner, admin |

### Email Marketing

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `listEmailLists` | Listar listas de email | todos |
| `listSubscribers` | Listar inscritos de uma lista | todos |
| `addSubscriber` | Adicionar inscrito (via RPC sync_subscriber_to_customer_with_tag) | owner, admin, manager |
| `createEmailCampaign` | Criar campanha de email | owner, admin |
| `listCampaigns` | Listar campanhas | todos |

### Dashboard e Relatórios

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `getDashboardStats` | Resumo do dashboard (receita, pedidos, ticket médio, clientes, produtos) | todos |
| `getTopProducts` | Produtos mais vendidos por período | todos |
| `salesReport` | Relatório de vendas por período | owner, admin, manager, editor, viewer |
| `inventoryReport` | Relatório de estoque (baixo, zerado) | owner, admin, manager, editor, viewer |
| `customersReport` | Relatório de clientes (total, novos no período) | owner, admin, manager, editor, viewer |

### Configurações

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `updateStoreSettings` | Atualizar configurações da loja (nome, email, telefone) | owner, admin |
| `updateShippingSettings` | Atualizar configurações de frete | owner, admin |

### Agenda

| Tool | Descrição | Permissões |
|------|-----------|------------|
| `createAgendaTask` | Criar tarefa na agenda (com lembretes) | todos |
| `listAgendaTasks` | Listar tarefas (filtro por status) | todos |
| `completeTask` | Marcar tarefa como concluída | todos |

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

## System Prompt (v3.0.0 — Comprimido)

> ⚠️ **O system prompt foi comprimido de ~12KB para ~4KB na v3.** Regras consolidadas, duplicações removidas, mapeamento de nomes em formato compacto.

### Princípios do Prompt v3

1. **Compacto**: ~4KB total (sem memórias), vs ~12KB na v2
2. **Focado**: Regras de alta prioridade no topo, mapeamento de tools em formato tabular
3. **Sem duplicação**: Cada regra aparece apenas 1 vez
4. **Memórias separadas**: Injetadas via `getMemoryContext()` após o prompt base

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
| `searchProducts` | "buscar produtos" |
| `listProducts` | "listar os produtos" |
| `getProductDetails` | "ver os detalhes do produto" |
| `searchOrders` | "buscar pedidos" |
| `getOrderDetails` | "ver os detalhes do pedido" |
| `listDiscounts` | "listar os cupons" |
| `listCategories` | "listar as categorias" |
| `getDashboardStats` | "ver o resumo do dashboard" |
| `getTopProducts` | "ver os produtos mais vendidos" |
| `updateProduct` | "editar o produto" |
| `duplicateProduct` | "duplicar o produto" |
| `addTrackingCode` | "adicionar código de rastreio" |
| `cancelOrder` | "cancelar o pedido" |
| `createManualOrder` | "criar um pedido manual" |
| `createBlogPost` | "criar um post no blog" |
| `listBlogPosts` | "listar os posts do blog" |
| `createOffer` | "criar uma oferta" |
| `listReviews` | "listar as avaliações" |
| `approveReview` | "aprovar a avaliação" |
| `respondToReview` | "responder a avaliação" |
| `listPages` | "listar as páginas" |
| `getFinancialSummary` | "ver o resumo financeiro" |
| `listEmailLists` | "listar as listas de email" |
| `addSubscriber` | "adicionar inscrito" |
| `createEmailCampaign` | "criar uma campanha de email" |
| `listNotifications` | "ver as notificações" |
| `listFiles` | "listar os arquivos" |
| `getStorageUsage` | "verificar uso de armazenamento" |
| `recalculateKitPrices` | "recalcular preços dos kits baseado nos componentes" |
| `listKitsSummary` | "listar todos os kits com quantidade de unidades" |
| `applyKitDiscount` | "aplicar descontos nos kits" |
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

## Regras de Layout do Chat (OBRIGATÓRIO)

**Scroll do chat** — O componente `CommandChatMessages` retorna um `div` com `flex-1 overflow-y-auto`. Para que o scroll funcione:

1. O **container pai direto** DEVE ser `flex flex-col` com `min-h-0` e `overflow-hidden`
2. Exemplo correto no `EmbeddedCommandAssistant.tsx`:
   ```
   <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
     <CommandChatMessages ... />
   </div>
   ```
3. Exemplo correto no `CommandAssistantPanel.tsx`:
   ```
   <div className="flex flex-1 flex-col min-h-0">
     <CommandChatMessages ... />
   </div>
   ```
4. **NUNCA** usar `ScrollArea` do Radix para o chat — usar `overflow-y-auto` nativo
5. **NUNCA** remover `min-h-0` ou `flex flex-col` dos containers pai — isso quebra o scroll

---

## Mapeamento de Colunas — Tabela `products`

> ⚠️ **CRÍTICO**: A Edge Function `command-assistant-execute` DEVE usar os nomes corretos das colunas do banco.

| Conceito | Coluna CORRETA | ❌ NÃO usar |
|----------|---------------|-------------|
| Status ativo/inativo | `status` (string: `"active"` / `"inactive"`) | `is_active` (não existe) |
| Código NCM | `ncm` | `ncm_code` (não existe) |
| Código CEST | `cest` | `cest_code` (não existe) |
| Soft delete | `deleted_at` (timestamp, NULL = ativo) | — |

### Regras de uso

- **Filtrar ativos**: `.eq("status", "active")`
- **Ativar produto**: `.update({ status: "active" })`
- **Desativar produto**: `.update({ status: "inactive" })`
- **Excluir (soft)**: `.update({ deleted_at: new Date().toISOString() })`
- **Listar não-deletados**: `.is("deleted_at", null)`

### bulkUpdateProductsPrice — Validação de Resultado

A tool `bulkUpdateProductsPrice` retorna `success: false` se `updateCount === 0` (nenhum produto atualizado). Isso impede que a IA trate uma atualização falhada como sucesso e entre em loop de retry.

### recalculateKitPrices — Isolamento de Tenant

> ⚠️ **CRÍTICO**: A tabela `product_components` **NÃO possui** coluna `tenant_id`. O isolamento de tenant é feito via tabela `products` (que possui `tenant_id`).

**Fluxo correto:**
1. Identificar kits do tenant via `products` (`.eq("tenant_id", tenant_id).eq("product_format", "with_composition")`)
2. Buscar componentes via `product_components` filtrando por `parent_product_id` (IDs já validados pelo tenant)
3. **NUNCA** filtrar `product_components` por `tenant_id` — causa erro `column does not exist`

---

## Persistência de Rascunho (Draft)

O campo de input do chat salva automaticamente o texto digitado no `localStorage`, por conversa.

### Comportamento

- **Salva automaticamente**: A cada keystroke, o rascunho é persistido em `localStorage` com chave `cmd_chat_draft_{conversationId}`
- **Restaura ao voltar**: Ao trocar de conversa e retornar, o rascunho anterior é restaurado
- **Limpa ao enviar**: Após enviar a mensagem, o rascunho é removido do storage
- **Isolamento por conversa**: Cada conversa tem seu próprio rascunho independente
- **Resistente a falhas**: Se a internet cair ou a página recarregar, o rascunho sobrevive

### Implementação

- Prop `conversationId` no `CommandChatInput` (substitui o padrão `key={}` para reset)
- **NÃO** usar `key={conversationId}` no input — isso destrói o componente e perde o draft
- Efeito `useEffect` monitora mudança de `conversationId` para trocar o rascunho ativo

### Anti-Pattern

> ⚠️ **NÃO** usar `key={conversationId}` no `CommandChatInput` — isso força remount e impede a persistência do rascunho.

---

## Injeção de Dados Internos (CRÍTICO)

Quando a Edge Function `command-assistant-chat` executa tools de leitura automaticamente (native tool calling), o resultado é injetado de volta ao Gemini em **dois formatos**:

1. **Texto legível** — para o modelo gerar resposta amigável ao lojista
2. **JSON interno** — marcado com `[DADOS_INTERNOS_JSON]...[/DADOS_INTERNOS_JSON]` — contendo os **UUIDs reais** do banco

### Por que dois formatos?

Sem o JSON interno, o modelo **inventa IDs falsos** (ex: `prod_12345`, `abc-123`) porque não consegue extrair UUIDs de texto natural. O JSON garante que o modelo use os IDs reais ao propor ações de escrita.

### Regras do System Prompt

O system prompt instrui o modelo a:
- **EXTRAIR** IDs exclusivamente do bloco `[DADOS_INTERNOS_JSON]`
- **NUNCA** inventar, inferir ou fabricar IDs
- **Buscar cada produto individualmente** em operações batch (um `searchProducts` por item)
- **Propor ação imediatamente** quando a busca retorna resultado único

---

## Regra de Decisão Rápida (System Prompt)

A IA deve ser DECISIVA e não fazer perguntas desnecessárias ao lojista.

### Comportamento Esperado

- **1 resultado na busca**: Assumir que é o item correto e propor ação IMEDIATAMENTE com botão Confirmar
- **Múltiplos resultados**: Perguntar qual, de forma CONCISA
- **Informações completas**: Propor ação direto, sem pedir "confirmação textual" antes do botão

### Fluxo Ideal (máx. 2-3 mensagens)

1. Usuário pede algo → busca (se necessário) → propõe ação com botão Confirmar
2. Usuário clica Confirmar → execução → resultado

### Anti-Patterns PROIBIDOS

- ❌ "Encontrei o produto X. Você confirma que quer alterar?" (sem botão de ação)
- ❌ "O ID do produto é prod-0026. É esse mesmo?"
- ❌ Repetir dados já visíveis em mensagens anteriores
- ❌ Fazer 2+ perguntas antes de propor a ação
- ❌ Inventar IDs curtos como `prod_12345` — usar UUID real do JSON interno
- ✅ "Encontrei o **Shampoo X** (R$ 311,82). Vou atualizar para **R$ 97,90**:" + bloco action

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
- [ ] **Chat scrollável** (container pai é flex flex-col min-h-0)
- [ ] **Rascunho persiste** entre trocas de conversa e reloads
- [ ] **Decisão rápida**: IA não pergunta demais, propõe ação direto
- [ ] **Ctrl+V paste**: Screenshots colados no textarea são detectados e enviados como anexo
- [ ] **Visão multimodal**: Imagens enviadas são analisadas visualmente pelo modelo de IA
