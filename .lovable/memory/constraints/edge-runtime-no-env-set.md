---
name: Edge Runtime — Deno.env.set Proibido
description: Supabase Edge Runtime não permite Deno.env.set — usar cache em memória via loadPlatformCredentials + monkey-patch de Deno.env.get
type: constraint
---

# Deno.env.set É Proibido em Edge Functions

## Regra

**Nunca chamar `Deno.env.set(...)` em código de Edge Function.** O runtime da Supabase (Deno serverless) sempre retorna `"The operation is not supported"` — a chamada falha em silêncio e gera log ruído.

## Por quê

Descoberto em 2026-07-02 investigando 32× erros 404 Pagar.me + 4× erros 500 fiscal em 20 min. Todos causados por `_shared/load-platform-credentials.ts` tentando reescrever env vars com credenciais do banco: as escritas falhavam e as funções continuavam usando chaves antigas do boot até um redeploy manual.

## Como fazer certo

Credenciais gerenciadas pelo painel de Integrações da Plataforma são carregadas em **cache em memória do processo** (`Map<string,string>`) por `loadPlatformCredentials()`. Esse loader instala uma vez um wrapper em `Deno.env.get` que consulta o cache antes da env real:

```typescript
// Antes de qualquer leitura de credencial gerenciada pelo painel:
await loadPlatformCredentials();

// Depois disso, Deno.env.get(KEY) retorna o valor mais recente do banco
// para as chaves cadastradas em platform_credentials, ou o valor real
// da env como fallback. Zero mudança nos callers legados.
const key = Deno.env.get("PAGARME_API_KEY");

// Alternativa explícita (mesmo resultado, mais claro):
import { getPlatformCredential } from "../_shared/load-platform-credentials.ts";
const key = getPlatformCredential("PAGARME_API_KEY");
```

## Janela de propagação

- TTL do cache: **60 segundos** por processo.
- Após salvar uma chave no painel, propagação máxima de 60s.
- Cross-process: cada instância de Edge Function tem seu próprio cache; a próxima chamada em cada processo recarrega automaticamente.

## Anti-regressão

- Nunca reintroduzir `Deno.env.set` — nem em novas funções nem em refactors.
- Nunca chamar `Deno.env.get` sem antes ter chamado `loadPlatformCredentials()` quando a chave for gerenciada pelo painel.
- Chaves que NÃO passam pelo painel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY managed, tokens OAuth de tenant) continuam sendo lidas direto de env normalmente.
