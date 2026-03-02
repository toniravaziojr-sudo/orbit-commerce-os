

## Diagnóstico Completo

Após análise detalhada dos 3 arquivos core (`command-assistant-chat`, `command-assistant-execute`, `useCommandAssistant.ts`), identifiquei o problema central e 4 problemas adjacentes que tornam a IA ineficiente:

### Problema Central: Arquitetura "Cega" — IA não consegue VER antes de AGIR

O fluxo atual funciona assim:

```text
Usuário: "Altere o preço do Shampoo Calvície Zero para R$ 97,90"
    ↓
IA gera: ```action { tool: "searchProducts", args: { query: "Shampoo..." } }```
    ↓
Frontend mostra botão "Confirmar" para BUSCA (!!!)
    ↓
Usuário clica → resultado volta → IA recebe resultado
    ↓
IA gera: ```action { tool: "bulkUpdateProductsPrice", args: {...} }```
    ↓
Frontend mostra botão "Confirmar" para AÇÃO
    ↓
Usuário clica → ação executa

TOTAL: 6+ interações para 1 tarefa
```

A IA está **cega** — ela precisa pedir permissão ao usuário até para LER dados. Isso causa:
- Busca retorna kit em vez do produto individual (busca `ilike` genérica)
- IA faz perguntas desnecessárias ("é esse mesmo?") porque não tem confiança nos dados
- Para 3 produtos = 6+ cliques + perguntas intermediárias
- IA "delira" tentando compensar a falta de informação

### Como outras IAs do sistema resolvem isso

O Motor Guardião e o Motor Estrategista (`ads-autopilot-guardian`, `ads-autopilot-analyze`) já usam **native tool calling** do Gemini:

```typescript
// Guardião - já funciona assim:
const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
  messages: [...],
  tools: GUARDIAN_TOOLS,   // ← IA chama tools direto
  tool_choice: "auto",     // ← sem confirmação humana
});
const toolCalls = aiResult.choices[0].message.tool_calls;
// Executa e processa resultado automaticamente
```

A IA de Anúncios já faz buscas, análises e ações automáticas com tool calling nativo. O Auxiliar de Comando precisa adotar o mesmo padrão para operações de leitura.

---

## Plano de Correção — 3 Mudanças Estruturais

### 1. Native Tool Calling para Leitura Automática (Mudança Principal)

Implementar tool calling nativo do Gemini na Edge Function `command-assistant-chat`, usando o mesmo padrão do Motor Guardião. A IA chamará tools de leitura internamente e só apresentará botão de confirmação para ações de escrita.

**Classificação de tools:**

| Tipo | Tools | Comportamento |
|------|-------|---------------|
| **Leitura (auto)** | `searchProducts`, `listProducts`, `getProductDetails`, `listProductComponents`, `searchOrders`, `getOrderDetails`, `listDiscounts`, `listCategories`, `getDashboardStats`, `getTopProducts`, `listCustomerTags`, `searchCustomers`, `listBlogPosts`, `listOffers`, `listReviews`, `listPages`, `getFinancialSummary`, `listShippingMethods`, `listNotifications`, `listFiles`, `getStorageUsage`, `listEmailLists`, `listSubscribers`, `listCampaigns`, `listAgendaTasks`, `inventoryReport`, `customersReport`, `salesReport` | IA executa server-side, resultado volta inline, sem botão |
| **Escrita (confirmar)** | Todos os demais (create, update, delete, bulk) | Mantém fluxo atual com botão Confirmar |

**Fluxo novo:**

```text
Usuário: "Altere o preço do Shampoo, Loção e Balm Calvície Zero"
    ↓
IA chama searchProducts("Shampoo Calvície Zero") → resultado inline
IA chama searchProducts("Loção pós-banho calvície zero") → resultado inline
IA chama searchProducts("Balm pós-banho calvície zero") → resultado inline
    ↓
IA propõe UMA ação com os 3 preços → botão Confirmar
    ↓
Usuário clica → execução

TOTAL: 2 interações (pedido + confirmar)
```

**Implementação na Edge Function `command-assistant-chat`:**

1. Converter as tools de leitura para formato OpenAI `tools` (array de `{type: "function", function: {name, description, parameters}}`)
2. Enviar na chamada ao Gemini com `tool_choice: "auto"`
3. Quando o modelo retornar `tool_calls`:
   - Executar as de leitura chamando o mesmo código do `command-assistant-execute` (importar ou invocar internamente)
   - Devolver resultado ao modelo como `tool` message
   - Deixar o modelo continuar gerando (pode chamar mais tools ou gerar resposta final com `action` block)
4. Quando o modelo gerar resposta final (sem mais tool_calls): stremar ao frontend normalmente
5. O frontend **não muda** — continua recebendo SSE como antes

**Implementação detalhada:**
- Extrair a função `executeTool()` do `command-assistant-execute` para um módulo compartilhado (`_shared/command-tools.ts`) ou duplicar as lógicas de leitura inline no chat
- Loop de tool calling: máximo 5 rodadas para evitar loops infinitos
- Permissões: validar `userRole` para cada tool de leitura chamada (reutilizar PERMISSION_MAP)

### 2. Melhorar Busca de Produtos

No handler `searchProducts` do execute:

- **Priorizar match exato**: Primeiro buscar `name.eq.{query}`, depois `ilike`
- **Excluir kits por padrão**: Filtrar `product_format.neq.with_composition` quando a busca é por produto-base
- **Adicionar parâmetros**: `excludeKits: boolean` e `exactMatch: boolean`
- **Buscar por SKU exato**: Se o query for numérico ou match padrão de SKU, buscar `sku.eq.{query}` primeiro

### 3. Adicionar Tool `recalculateKitPrices`

Nova tool que recalcula preços de kits baseado nos componentes:
- Recebe lista de product IDs (produtos-base que mudaram de preço)
- Busca todos os kits que contêm esses produtos via `product_components`
- Calcula novo preço = Σ(preço_componente × quantidade)
- Atualiza `price` e opcionalmente remove `compare_at_price`
- Retorna relatório (quais kits foram recalculados e novos preços)

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/command-assistant-chat/index.ts` | Implementar native tool calling loop; converter tools de leitura para formato Gemini tools; atualizar system prompt |
| `supabase/functions/command-assistant-execute/index.ts` | Melhorar `searchProducts`; adicionar `recalculateKitPrices`; adicionar permissões novas |
| `docs/regras/auxiliar-comando.md` | Documentar arquitetura de leitura automática vs escrita com confirmação |

### Estimativa
- `command-assistant-chat`: ~200 linhas novas (loop de tool calling + definição de tools OpenAI format)
- `command-assistant-execute`: ~80 linhas (melhorias de busca + recalculateKitPrices)
- Documentação: ~30 linhas

### Resultado esperado
O cenário que falhou (alterar preço de 3 produtos + recalcular kits) passará a funcionar em **2 interações** em vez de 6+. A IA terá "visão" completa dos dados antes de propor qualquer ação.

