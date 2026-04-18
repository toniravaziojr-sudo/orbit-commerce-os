# Padrões Operacionais Transversais

> **Status:** 🟢 Ativo
> **Camada:** Layer 3 — Especificações / Transversais
> **Última atualização:** 2026-04-17

Este documento consolida padrões operacionais que se aplicam a múltiplos módulos do sistema. Promovido de memória para doc formal em 2026-04-17.

---

## 1. Padrão de Resposta de Edge Functions

### Regra
Toda Edge Function que represente uma operação de negócio deve responder com **HTTP 200** e um envelope JSON contendo um campo booleano `success`. Erros de negócio, validação ou regra impeditiva NÃO devem usar status 4xx/5xx.

### Formato canônico
```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "Mensagem clara em PT-BR", "code": "CODIGO_OPCIONAL" }
```

### Quando usar 4xx/5xx (exceções)
- Falha real de infraestrutura (timeout, banco fora do ar)
- Autenticação ausente ou inválida (401)
- Método HTTP não suportado (405)
- Payload malformado a ponto de não conseguir parsear (400)

### Motivo
- Evita que o front trate erro de negócio como crash
- Permite mensagens consistentes em PT-BR para o usuário
- Compatível com retry/polling sem disparar tratamento de exceção

### Anti-padrão
- Retornar 400 com `{ "error": "..." }` sem o envelope `success`
- Retornar 500 quando o erro é de regra (ex: cupom expirado, estoque zerado)

---

## 2. Validação de Cache da Vitrine (`?cb=`)

### Regra
Para validar tecnicamente alterações publicadas na vitrine pública (Live), é OBRIGATÓRIO testar a URL com o parâmetro `?cb=<timestamp>` para forçar bypass do cache do Cloudflare e obter o HTML real renderizado pelo Edge.

### Como aplicar
- URL de validação: `https://<dominio-do-tenant>/<rota>?cb=<timestamp_unix>`
- Sempre comparar a resposta com o que está no banco (snapshot ou `storefront_prerendered_pages`)
- Diferença entre `?cb=` e URL normal indica cache stale → seguir o pipeline de revalidação

### Motivo
A vitrine usa cache agressivo no Cloudflare. Sem o bypass, a IA pode "validar" um HTML antigo e declarar sucesso erroneamente.

### Anti-padrão
- Validar apenas via preview do Builder (não reflete o Edge)
- Confiar na URL pública sem `?cb=` quando há suspeita de cache

---

## 3. Invalidação de Prerender em Mudança de Compiler

### Regra
Toda alteração em `supabase/functions/_shared/block-compiler/` (registro/remoção/renomeação de compiler ou alteração no HTML gerado) DEVE ser seguida da marcação de páginas pré-renderizadas como obsoletas:

```sql
UPDATE storefront_prerendered_pages
SET status = 'stale'
WHERE status = 'active';
```

### Por quê
O parâmetro `?_revalidate=1` NÃO invalida snapshots persistidos. Sem o `UPDATE` acima, a vitrine continua servindo o HTML antigo mesmo após o deploy do compiler novo.

### Quando NÃO é necessário
- Alteração apenas em código de runtime que não afeta o HTML gerado
- Alteração em CSS/JS dinâmico carregado fora do snapshot

### Anti-padrão
- Confiar em `?_revalidate=1` como invalidador universal
- Esperar TTL natural do cache (pode levar dias)

---

## 4. SendGrid como Provedor Mandatório de E-mail

### Regra
SendGrid é o **provedor único e obrigatório** para todos os envios de e-mail do sistema (transacionais, marketing, notificações de plataforma e de tenant). Qualquer outra integração de e-mail (SMTP genérico, Resend, Mailgun, etc.) está PROIBIDA.

### Escopo de aplicação
- E-mails de autenticação (signup, recuperação de senha)
- Notificações de pedido (confirmação, status, rastreio)
- Campanhas de e-mail marketing
- Alertas de plataforma (billing, limites, falhas)
- Convites de equipe e usuários

### Configuração
- Credencial: `SENDGRID_API_KEY` em `platform_credentials`
- Domínio remetente: configurado por tenant via `tenant_email_settings`
- Verificação SPF/DKIM obrigatória antes de habilitar envios em massa

### Anti-padrão
- Usar `supabase.auth` com SMTP padrão sem rotear via SendGrid
- Adicionar segundo provedor "de fallback" sem aprovação formal

---

## 5. Auxiliar de Comando — Inventário Operacional

### Versão atual
**v4.0.0** — Modelo primário: Gemini 2.5 Flash (chamada nativa). Fallback: Lovable AI Gateway.

### Escopo
O Auxiliar de Comando (`/command-center`, aba Auxiliar) tem acesso a aproximadamente **150 ferramentas** distribuídas pelos módulos do sistema, divididas em duas categorias:

- **Ferramentas de leitura** (~90): consultas e relatórios
- **Ferramentas de escrita** (~60): criação, atualização e operações

### Cobertura por módulo
| Módulo | Leitura | Escrita |
|--------|---------|---------|
| Pedidos | ✅ | ✅ |
| Produtos / Variantes | ✅ | ✅ |
| Categorias | ✅ | ✅ |
| Clientes | ✅ | ✅ |
| Cupons / Descontos | ✅ | ✅ |
| Fiscal (NF-e, configurações) | ✅ | ✅ |
| Logística (envios, etiquetas) | ✅ | ✅ |
| Marketing (campanhas, e-mails) | ✅ | ✅ |
| Atendimento (tickets, mensagens) | ✅ | ✅ |
| Páginas / Builder | ✅ | ✅ |
| Mídia (uploads, galerias) | ✅ | ✅ |
| Integrações (status, leitura) | ✅ | ⚠️ limitado |
| Sistema (usuários, configurações) | ✅ | ⚠️ owner-only |

### Regras de operação
1. Toda nova ferramenta DEVE ser validada contra o schema real do banco antes do deploy
2. Ferramentas de escrita DEVEM seguir soft-delete onde aplicável (`deleted_at = NOW()`)
3. Ferramentas DEVEM ser idempotentes ou retornar erro claro em caso de duplicidade
4. Toda ferramenta opera com `tenant_id` derivado do contexto do usuário autenticado

### Anti-padrão
- Adicionar ferramenta sem validar schema → retornou erro silencioso em produção (16 correções necessárias na v4.0.0)
- Ferramenta de leitura sem validar UUID de entrada
- DELETE direto em vez de soft-delete

### Histórico de correções relevantes
- **v4.0.0 (2026-04-15):** 16 ferramentas de escrita + 2 de leitura corrigidas contra schema real

---

## 6. Validação Técnica Obrigatória Pós-Entrega

### Regra
Toda entrega que altere comportamento do sistema DEVE incluir, antes do fechamento, uma validação técnica real executada pela IA. Sem validação técnica, o status máximo permitido é "Ajuste aplicado — pendente de validação".

### Tipos de validação aceitos
- Consulta direta ao banco (SQL)
- Chamada direta à Edge Function com payload de teste
- Leitura de logs de Edge Function
- Verificação de build (sem erros)
- Verificação de console/network do browser quando aplicável
- Validação de HTML real da vitrine via `?cb=` (ver seção 2)

### Tenant de teste padrão
Sempre que possível, usar o tenant **`respeiteohomem`** para validar novos ajustes ou implementações. Esse tenant funciona como ambiente de homologação informal.

### Formato de fechamento
```
🔍 VALIDAÇÃO TÉCNICA EXECUTADA:
- [o que foi testado]
- [resultado: ✅ passou | ❌ falhou — detalhe]
- [o que depende de validação do usuário, se aplicável]
```

### Anti-padrão
- Declarar "corrigido" apenas com base em deploy concluído
- Confiar em lógica teórica sem teste real
- Pular o tenant `respeiteohomem` quando o cenário permite teste seguro

---

## 7. Cache Edge no Cloudflare Worker — `ctx.waitUntil` é Mandatório

### Regra
Toda escrita na **Cache API** dentro do Worker `shops-router` (HTML pré-renderizado, assets do Vite, micro-cache de bootstrap) DEVE ser registrada via `ctx.waitUntil(caches.default.put(...))`. Sem isso, o runtime do Cloudflare cancela a operação assim que a resposta termina e o cache fica permanentemente como `MISS`.

### Por quê
Sintoma observado em produção (incidente Abril/2026): `cf-cache-status: DYNAMIC` em 100% das requisições, mesmo com `caches.default.put()` "bem-sucedido". A escrita era abortada porque o handler retornava antes do `put` completar.

### Como aplicar
```js
// ❌ ERRADO — escrita não persiste
await caches.default.put(cacheKey, cacheResponse);
return response;

// ✅ CERTO — escrita garantida pelo runtime
ctx.waitUntil(
  caches.default.put(cacheKey, cacheResponse)
    .catch(e => console.error('cache write error:', e))
);
return response;
```

### Onde se aplica no projeto
`docs/cloudflare-worker-template.js`:
- Cache de HTML pré-renderizado (`html-cache.internal/...`, TTL 15min, SWR 24h)
- Cache de assets do Vite (`assets-cache.internal/...`, TTL 30 dias, imutável)
- Micro-cache de `storefront-bootstrap` (`bootstrap-cache.internal/...`, TTL 60s)

### Princípio relacionado (Phase 4 padrão)
O Worker deve sempre tentar entregar HTML pré-renderizado antes de qualquer fallback para SPA, **independente do header `Accept`**. Bots, prefetches e clientes que omitem `Accept` recebem o mesmo HTML útil que um navegador comum.

### Anti-padrão
- `await caches.default.put(...)` no fim do handler sem `ctx.waitUntil`
- Confiar que a escrita do cache "vai acontecer no background" sem registrar via `waitUntil`
- Phase 4 condicional ao header `Accept: text/html` — bots e prefetches recebem shell SPA vazio (~5KB) mesmo com cache aquecido

### Validação
1. `curl -sI https://<dominio>/` — `cf-cache-status: HIT` na 2ª visita + `X-CC-Cache-Layer: html`
2. `curl -sI https://<dominio>/assets/<arquivo>.js` — `X-CC-Cache: HIT` + `cache-control: public, max-age=2592000, immutable`
3. Endpoint `/_debug` do Worker retorna `cache.usesWaitUntil: true`
