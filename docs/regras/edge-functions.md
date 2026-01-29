# Edge Functions — Regras e Especificações

> **REGRAS FIXAS** — Aplicáveis a TODAS as edge functions do projeto.

---

## ⚠️ VERSIONAMENTO OBRIGATÓRIO (Anti-Regressão)

**REGRA CRÍTICA**: Toda edge function DEVE ter uma constante de versão no topo do arquivo.

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Descrição breve da última mudança
// ===========================================================
```

**No início do handler, logar a versão:**
```typescript
console.log(`[function-name][${VERSION}] Request received`);
```

### Checklist de Deploy
1. [ ] Incrementar VERSION
2. [ ] Verificar nomes de colunas no schema atual
3. [ ] Logar erros de insert (não silenciar)
4. [ ] Após deploy, confirmar versão nos logs

---

## Sincronização Schema ↔ Código

### `whatsapp_messages` — Colunas Corretas
```typescript
// ✅ USAR ESTES NOMES:
{
  tenant_id: string,           // UUID obrigatório
  recipient_phone: string,     // NÃO "phone"
  message_type: string,        // "text", "template", etc.
  message_content: string,     // NÃO "message"
  status: string,              // "sent", "failed", "delivered"
  sent_at?: string,
  provider_message_id?: string, // NÃO "external_message_id"
  error_message?: string,
  provider_response?: object,
  notification_id?: string,
  metadata?: object
}

// ❌ COLUNAS INEXISTENTES (causam erro silencioso):
// - phone → usar recipient_phone
// - message → usar message_content
// - direction → removido
// - provider → removido
// - external_message_id → usar provider_message_id
```

### Mapeamento Tabela → Edge Functions
| Tabela | Edge Functions |
|--------|----------------|
| `whatsapp_messages` | `meta-whatsapp-send`, `run-notifications`, `whatsapp-send` |
| `notifications` | `run-notifications`, `process-events` |
| `orders` | `pagarme-webhook`, `mercadopago-webhook` |

**REGRA**: Ao alterar schema de tabela, atualizar TODAS as edge functions listadas.

---

## Regras Gerais

| Regra | Descrição |
|-------|-----------|
| **Erro de negócio** | HTTP 200 + `{ success: false, error: "...", code? }` |
| **CORS** | Completo em TODAS as respostas (OPTIONS + success + error). **Falta de CORS = bug crítico** |
| **Email** | Sempre `normalizeEmail()` (trim + lowercase) |
| **RLS** | Validar SELECT/INSERT/UPDATE/DELETE por tabela antes de dar "done" |

---

## Padrão de Resposta

### Sucesso
```typescript
return new Response(
  JSON.stringify({ success: true, data: result }),
  { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  }
);
```

### Erro de Negócio (NÃO é HTTP 4xx/5xx)
```typescript
return new Response(
  JSON.stringify({ success: false, error: 'Mensagem do erro', code: 'ERROR_CODE' }),
  { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  }
);
```

---

## CORS Headers (Obrigatório)

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

---

## Multi-Tenant (Regra Fixa)

- Tudo sempre tenant-scoped
- **Proibido** vazamento de dados/tokens/credenciais entre tenants
- Validar `tenant_id` em TODA operação

---

## Normalização de Email

```typescript
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

---

## Checklist Antes de Deploy

- [ ] VERSION incrementada
- [ ] CORS completo
- [ ] Erros de negócio = HTTP 200 + `{ success: false }`
- [ ] Nomes de colunas validados contra schema
- [ ] Emails normalizados
- [ ] Tenant-scoped
