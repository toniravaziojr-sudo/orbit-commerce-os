# Memory: features/ai/openai-api-parameters-compatibility
Updated: now

## Compatibilidade de Parâmetros da OpenAI API

### Problema Identificado
Modelos GPT-5 e GPT-5-mini da OpenAI utilizam parâmetros diferentes dos modelos anteriores para controle de tokens.

### Parâmetros por Modelo

| Modelo | Parâmetro de Tokens | Parâmetro de Temperature |
|--------|---------------------|--------------------------|
| `gpt-4o`, `gpt-4-turbo` | `max_tokens` | `temperature: 0-2` |
| `gpt-5`, `gpt-5.2` | `max_completion_tokens` | `temperature: 0-2` |
| `gpt-5-mini`, `gpt-5-nano` | `max_completion_tokens` | `temperature: 1` (fixo!) |

### Implementação Correta

```typescript
// Detectar se é modelo GPT-5
const isGpt5Model = modelToTry.startsWith("gpt-5");

// Usar parâmetro correto
const tokenParams = isGpt5Model 
  ? { max_completion_tokens: 1024 }
  : { max_tokens: 1024 };

// Para gpt-5-mini: NÃO passar temperature diferente de 1
// O modelo retorna erro 400 se temperature != 1
```

### Tratamento de Erros no Fallback

Ao implementar fallback entre modelos:

1. **Não consumir response.text() múltiplas vezes** - causa erro "Body already consumed"
2. **Armazenar erro em variável externa** ao loop
3. **Resetar response para null** antes de tentar próximo modelo

```typescript
let lastErrorText = "";
for (const modelToTry of modelsToTry) {
  try {
    response = await fetch(...);
    
    if (response.ok) break;
    
    // Ler erro apenas uma vez
    lastErrorText = await response.text();
    console.warn(`Model ${modelToTry} failed:`, lastErrorText);
    
    // Resetar para tentar próximo modelo
    if (response.status === 404 || response.status === 400) {
      response = null;
      continue;
    }
    break;
  } catch (fetchError) {
    response = null;
  }
}

// Usar erro armazenado
if (!response || !response.ok) {
  const errorText = lastErrorText || "No response";
}
```

### Arquivos Afetados
- `supabase/functions/ai-support-chat/index.ts` - Chat de atendimento IA
- Qualquer edge function que use OpenAI API diretamente

### Checklist Anti-Regressão

- [ ] Verificar qual modelo será usado
- [ ] Usar `max_completion_tokens` para modelos GPT-5
- [ ] Não passar `temperature` customizada para `gpt-5-mini`
- [ ] Armazenar erro antes de tentar fallback
- [ ] Nunca chamar `response.text()` duas vezes
