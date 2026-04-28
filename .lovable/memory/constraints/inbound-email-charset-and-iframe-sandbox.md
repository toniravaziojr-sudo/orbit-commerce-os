---
name: Inbound Email Charset, Iframe Sandbox & Autolink
description: SendGrid inbound MUST decode using `charsets` field; EmailViewer iframe MUST allow popups, inject base target + meta charset, AND autolink URLs in plain text. E-mails antigos com U+FFFD são irrecuperáveis.
type: constraint
---

# Regra anti-regressão — Caixa de e-mail (ingestão + visualização)

## Por que existe

E-mails entrando via SendGrid Inbound Parse aparentavam mojibake (`Olá` →
`Ol\uFFFD`) e links não eram clicáveis no viewer. Causa raiz dupla:

1. **Ingestão** ignorava o campo `charsets` do payload SendGrid e lia
   campos Latin-1 como UTF-8.
2. **Visualização** usava `sandbox="allow-same-origin"` puro, bloqueando
   top-navigation e popups → links morriam ao clicar. HTML sem `<meta
   charset>` também renderizava mojibake só no iframe.

## Regra obrigatória

### Ingestão (`supabase/functions/support-email-inbound/index.ts`)

- Ler `formData.get('charsets')` como JSON e mapear charset por campo.
- Usar helper `decodeField(field)` para todo campo textual (`from`, `to`,
  `subject`, `text`, `html`, `headers`, `envelope`).
- Suportar campo como `File` (decodificar `arrayBuffer`) ou string
  (round-trip via Latin-1 → `TextDecoder(charset)`).
- **PROIBIDO**: `formData.get('subject') as string || ''` direto para
  campos textuais.

### Visualização (`src/components/emails/EmailViewer.tsx`)

- Iframe **DEVE** usar:
  `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"`.
- HTML **DEVE** passar por `prepareEmailHtml()` antes do `srcDoc`, que:
  1. injeta `<meta charset="utf-8">`,
  2. injeta `<base target="_blank" rel="noopener noreferrer">`,
  3. roda `autolinkHtml()` — converte URLs em texto puro para `<a>` clicáveis,
     preservando `<a>`, `<script>`, `<style>` e atributos de tag existentes.
- **PROIBIDO**: `<iframe srcDoc={message.body_html}>` direto, ou sandbox
  apenas com `allow-same-origin`, ou pular o autolink (muitos remetentes
  como Pagar.me e Bradesco enviam URLs em texto puro).

### E-mails antigos corrompidos (`\uFFFD` / `�`)

- Registros gravados ANTES da correção da ingestão contêm bytes
  substituídos por U+FFFD — informação perdida no momento da decodificação.
- **PROIBIDO** propor "scripts de recuperação" ou novas heurísticas para
  esses registros: a informação não está mais no banco. Única solução é
  reenvio pelo remetente.

## Como validar

- Mock de payload com `charsets={"subject":"iso-8859-1"}` + bytes Latin-1
  → asserir UTF-8 correto persistido.
- Clicar em link no viewer → abre em nova aba sem ser bloqueado.
- Autolink: `<p><b>https://x.com/y</b></p>` → vira `<a href>` clicável.
  URL já dentro de `<a>` ou `<style>` não pode ser duplicada.

## Doc formal

`docs/especificacoes/sistema/caixas-de-email.md`
