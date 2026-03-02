

# Diagnóstico Estrutural: Por que o Auxiliar de Comando é "fraco"

Após investigação completa do pipeline (`command-assistant-chat`, `useCommandAssistant.ts`, `ai-router.ts`), identifiquei **5 problemas estruturais graves** que explicam por que a IA parece "burra" e limitada.

---

## Problema 1 (CRÍTICO): A resposta da Fase 1 é DESCARTADA — a IA pensa duas vezes

O pipeline opera em 2 fases:
- **Fase 1**: Chamada NON-streaming com tools de leitura (loop de até 5 rodadas)
- **Fase 2**: Chamada STREAMING sem tools (para gerar a resposta final)

O problema: quando a Fase 1 termina (o modelo gera sua resposta final com os dados lidos), **essa resposta é jogada fora**. A Fase 2 pede ao modelo que gere tudo de novo, do zero, apenas com o histórico de mensagens. O modelo:

- Perde a "continuidade de raciocínio" entre ler dados e propor ação
- Pode gerar resposta completamente diferente
- Pode re-propor ações antigas ou ignorar dados que acabou de ler
- Faz 2x chamadas à API quando 1x bastaria

```text
FLUXO ATUAL (QUEBRADO):
Fase 1: Modelo lê dados → gera resposta final com ação → DESCARTADA
Fase 2: Modelo recebe mesmo contexto → gera OUTRA resposta → enviada ao usuário
         (pode ignorar os dados, inventar coisas, propor ação errada)
```

**Correção**: Quando a Fase 1 termina sem tool_calls, capturar a resposta gerada (`choice.message.content`) e fazer streaming sintético dela diretamente ao frontend, sem chamar a API novamente.

---

## Problema 2 (GRAVE): Tool results mapeados como "assistant" — IA confunde quem disse o quê

Linha 1293:
```typescript
role: m.role === "tool" ? "assistant" : m.role,
content: m.role === "tool" ? `[RESULTADO DE AÇÃO JÁ EXECUTADA]: ${m.content || ""}` : (m.content || ""),
```

Resultados de ferramentas executadas são mapeados como `role: "assistant"`. O modelo vê isso como se **ele mesmo** tivesse dito aquilo. Quando o usuário pede algo novo, o modelo "lembra" que já disse o resultado e fica confuso sobre o que já fez vs. o que precisa fazer.

**Correção**: Mapear como `role: "user"` com prefixo `[SISTEMA]` ou melhor, simplesmente NÃO armazenar mensagens de role "tool" no histórico persistido — elas já foram processadas durante o tool calling loop.

---

## Problema 3 (GRAVE): Limite de 20 mensagens no histórico

Linha 1270:
```typescript
.limit(20)
```

Com tool results, pós-execução e follow-ups, uma única tarefa pode gerar 5-6 mensagens. Em uma conversa de 3-4 tarefas, as mensagens mais antigas (contexto crítico) são descartadas. A IA literalmente **esquece** o que fez 3 turnos atrás.

**Correção**: Aumentar para 50 mensagens, E/OU implementar sumarização de mensagens antigas para manter contexto sem explodir tokens.

---

## Problema 4 (MODERADO): System prompt excessivamente longo (~12KB+)

O system prompt tem ~1200 linhas de texto, incluindo:
- Mapeamento de 60+ nomes de ferramentas para linguagem humana
- Descrições de todas as ferramentas de escrita
- Regras repetitivas em 5+ seções diferentes
- Memórias injetadas (~7KB extras)

Total: ~20KB de system prompt. Isso dilui a atenção do modelo — quanto mais texto no prompt, mais o modelo "esquece" regras específicas, especialmente as críticas como "não re-proponha ações já executadas".

**Correção**: Comprimir o system prompt para ~4KB. Mover o mapeamento de nomes para uma seção compacta. Remover duplicações. Consolidar regras em formato conciso.

---

## Problema 5 (MODERADO): Pós-execução re-executa o pipeline completo

Após o usuário confirmar uma ação, o frontend envia o resultado de volta como `is_tool_result: true` (linhas 346-428 de `useCommandAssistant.ts`). Isso dispara o pipeline INTEIRO novamente:
1. Tool calling Phase 1 (pode chamar tools desnecessariamente)
2. Streaming Phase 2 (gera follow-up)

A IA nesse momento pode chamar tools de leitura novamente, perder contexto, e propor a MESMA ação que acabou de ser executada — exatamente o bug que o usuário reportou.

**Correção**: Para `is_tool_result`, fazer chamada streaming DIRETA (sem Phase 1 tool calling), já que nenhuma ferramenta de leitura é necessária para confirmar uma execução.

---

## Plano de Implementação

### Mudança 1: Eliminar dupla-chamada (usar resposta da Fase 1)
Na `command-assistant-chat`, quando a Fase 1 termina sem tool_calls, capturar `choice.message.content` e fazer streaming sintético (SSE formatado) diretamente ao frontend. Eliminar a Fase 2 completamente nesses casos.

### Mudança 2: Pular tool calling para pós-execução
Quando `is_tool_result === true`, ir direto para streaming sem Phase 1. A IA não precisa buscar dados para confirmar que uma ação foi executada.

### Mudança 3: Corrigir mapeamento de role "tool" no histórico
Mudar de `"assistant"` para `"user"` com prefixo claro `[SISTEMA - resultado de execução]`, ou filtrar mensagens de role "tool" do histórico antes de enviar ao modelo (já foram processadas).

### Mudança 4: Aumentar limite de histórico
De 20 para 50 mensagens.

### Mudança 5: Comprimir system prompt
Reduzir de ~12KB para ~4KB, removendo duplicações e consolidando regras. Manter apenas as regras de maior impacto.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/command-assistant-chat/index.ts` | Todas as 5 mudanças |

### Resultado esperado
- IA deixa de "pensar duas vezes" e gera respostas coerentes com os dados que leu
- IA para de re-propor ações já executadas
- IA mantém contexto em conversas mais longas
- Latência reduzida (~50%, elimina 1 chamada API por turno)
- Raciocínio mais consistente com prompt mais focado

