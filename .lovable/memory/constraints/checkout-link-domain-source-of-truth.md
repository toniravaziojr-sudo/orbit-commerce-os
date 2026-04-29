---
name: Checkout Link Domain Source of Truth
description: Edge functions que geram link de checkout devem resolver domínio próprio em tenant_domains (status=verified, prefer is_primary). custom_domains não existe.
type: constraint
---

Toda edge function que monte URL de loja/checkout (incluindo `ai-support-chat`) DEVE resolver o domínio próprio consultando `public.tenant_domains` com `status='verified'`, preferindo `is_primary=true`. Fallback é `${tenant.slug}.shops.comandocentral.com.br`.

**Why:** A tabela `custom_domains` NÃO existe no schema. Usá-la retorna sempre vazio e o link cai no subdomínio padrão, queimando a venda no WhatsApp. A fonte de verdade canônica é `tenant_domains` (memória `tenant-domain-resolution-logic-ptbr`).

**How to apply:** Antes de qualquer mudança em link/URL gerada por edge function, conferir `rg "custom_domains"` no diretório de functions — qualquer ocorrência é bug.
