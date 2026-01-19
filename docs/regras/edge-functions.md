# Edge Functions — Regras e Especificações

> **REGRAS FIXAS** — Aplicáveis a TODAS as edge functions do projeto.

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

### Erro de Sistema (HTTP 500)
```typescript
return new Response(
  JSON.stringify({ success: false, error: 'Internal server error' }),
  { 
    status: 500, 
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

// Início de TODA edge function:
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

**SEMPRE** normalizar antes de:
- Buscar usuário
- Criar usuário
- Comparar emails
- Enviar notificações

---

## Checklist Antes de Deploy

- [ ] CORS completo em OPTIONS, success E error
- [ ] Erros de negócio retornam HTTP 200 + `{ success: false }`
- [ ] Emails normalizados
- [ ] Tenant-scoped (sem vazamento)
- [ ] RLS validado nas tabelas afetadas
