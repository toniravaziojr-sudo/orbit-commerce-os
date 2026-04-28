# Caixas de E-mail — Atendimento e Mailbox

**Camada:** Layer 3 (especificação funcional)
**Última atualização:** 2026-04-28

## 1. Visão geral

O módulo "Emails" (rota `/emails`) oferece duas experiências:

1. **Caixas manuais (Mailbox)** — leitura, resposta e composição de e-mails
   recebidos em endereços corporativos do tenant (ex.: `loja@dominio.com`).
2. **Atendimento por e-mail** — e-mails enviados ao endereço de suporte
   configurado (ex.: `atendimento@dominio.com`) entram no funil de
   conversas (`/atendimento`) e podem ser respondidos pela IA ou por
   humano.

A ingestão é feita via **SendGrid Inbound Parse** apontando para a Edge
Function `support-email-inbound`. Essa função decide o roteamento entre
"Mailbox manual" e "Atendimento" e grava em `email_messages` ou `messages`
respectivamente.

## 2. Roteamento de entrada

Decisão tomada em `support-email-inbound`:

- E-mail enviado para o `support_email_address` configurado **OU** para o
  `from_email` (notificações transacionais) **E** com
  `support_email_enabled = true` → rota **Atendimento** (tabelas
  `conversations` + `messages`).
- Caso contrário → rota **Mailbox manual** (tabela `email_messages`,
  associada à `mailboxes` por endereço).

A origem (tenant) é determinada por busca em `email_provider_configs`
usando o domínio do destinatário.

## 3. Charset / Encoding (CRÍTICO)

### Problema histórico

SendGrid envia o webhook como `multipart/form-data`. Vários provedores
brasileiros (especialmente notificações de gateways de pagamento)
codificam o corpo em **ISO-8859-1 (Latin-1)** em vez de UTF-8. O Deno,
ao ler `formData.get('field') as string`, assume UTF-8 por padrão — o
resultado é mojibake (`Olá` → `Ol\uFFFD`, `não` → `n\uFFFDo`).

### Contrato definitivo

A função `support-email-inbound` **DEVE**:

1. Ler o campo `charsets` do payload SendGrid (JSON com `{from, to,
   subject, text, html, ...}` → nome do charset).
2. Decodificar cada campo textual com `TextDecoder(charset)` quando
   `charset !== 'utf-8'`.
3. Suportar dois cenários:
   - Campo chega como `File`/blob (Deno detecta charset não-UTF-8) →
     ler `arrayBuffer` e aplicar `TextDecoder`.
   - Campo chega como string já interpretada como UTF-8 → fazer
     round-trip Latin-1 (`Uint8Array.from(s, c => c.charCodeAt(0) & 0xff)`)
     e re-decodificar com o charset declarado.

Helper canônico: `decodeField(field)` no topo do handler.

### Regressão a evitar

Nunca voltar a usar `formData.get('subject') as string || ''` direto
para campos textuais. Sempre passar pelo `decodeField`.

## 4. Visualização (EmailViewer)

Componente: `src/components/emails/EmailViewer.tsx`.

### Sandbox do iframe

Sandbox correto:
```
sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
```

- `allow-same-origin` → necessário para medir `scrollHeight` e auto-resize.
- `allow-popups` + `allow-popups-to-escape-sandbox` → permite que links
  abram em nova aba sem bloqueio.

**NÃO usar** apenas `allow-same-origin` — bloqueia navegação dos links
e o usuário percebe links como "não clicáveis".

### Função `prepareEmailHtml(rawHtml)`

Toda renderização de `body_html` recebido **DEVE** passar por essa função
antes de virar `srcDoc` do iframe. Ela injeta:

1. `<meta charset="utf-8">` — evita mojibake quando o HTML do e-mail
   não declara charset.
2. `<base target="_blank" rel="noopener noreferrer">` — força todos os
   links a abrirem em nova aba (sandbox bloqueia top-navigation).
3. Best-effort: detecção heurística de mojibake clássico (sequências
   `[ÃÂ][\x80-\xBF]`) com tentativa de recuperação via
   `decodeURIComponent(escape(html))`. Só aplica se reduzir os marcadores
   de mojibake em mais de 50% (evita falso-positivo).

## 5. Problemas × Soluções (anti-regressão)

| Sintoma | Causa raiz | Correção definitiva |
|---|---|---|
| Caracteres "estranhos" (`Ã©`, `Ã£`, `\uFFFD`) em e-mails recebidos | Função de ingestão não respeitava o `charsets` do SendGrid (Latin-1 lido como UTF-8) | `decodeField` em `support-email-inbound` |
| Caracteres estranhos só na visualização (banco está OK) | HTML do e-mail não declara `<meta charset>` e o iframe assume Latin-1 | `prepareEmailHtml` injeta `<meta charset="utf-8">` |
| Links no e-mail não são clicáveis / não abrem | Sandbox `allow-same-origin` bloqueia top-navigation e popups | Sandbox `allow-same-origin allow-popups allow-popups-to-escape-sandbox` + `<base target="_blank">` |

## 6. Validação técnica

Cobertura mínima ao alterar este módulo:

- Mock de payload SendGrid com `charsets={"subject":"iso-8859-1","text":"iso-8859-1"}`
  e bytes Latin-1 → asserir que `subject`/`text`/`html` persistem em UTF-8
  correto em `email_messages`.
- Renderização visual: e-mail com link `<a href>` deve abrir em nova aba
  ao clicar.
- Mojibake recovery: e-mail histórico com `Olá` (mojibake) deve renderizar
  como `Olá` no viewer sem alterar o registro no banco.

## 7. Referências cruzadas

- Memory: `mem://constraints/inbound-email-charset-and-iframe-sandbox`
- Edge Function: `supabase/functions/support-email-inbound/index.ts`
- UI: `src/components/emails/EmailViewer.tsx`,
  `src/components/emails/MailboxInbox.tsx`
- Doc relacionada: `docs/especificacoes/crm/crm-atendimento.md` (rota
  Atendimento), `mem://infrastructure/email/sendgrid-provedor-prioritario.md`
