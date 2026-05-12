---
name: PFX Reader Single Source
description: Toda leitura de certificado A1 (.pfx) no módulo fiscal usa exclusivamente _shared/pfx-reader.ts. Proibido importar node-forge direto para abrir PFX.
type: constraint
---

Toda função fiscal que precise abrir um arquivo `.pfx` (PKCS#12) DEVE usar exclusivamente `readPfx()` de `supabase/functions/_shared/pfx-reader.ts`.

**Proibido:**
- Importar `node-forge` diretamente em qualquer função fiscal só para parsear PFX.
- Duplicar lógica de fallback PKI.js↔forge fora do `pfx-reader.ts`.
- Retornar `status: 4xx/5xx` quando o erro for de negócio (senha errada, formato não suportado, certificado vencido) — sempre 200 + `success:false` + mensagem categorizada via `pfxErrorToUserMessage`.

**Por quê:** node-forge 1.3 só abre PFX em TripleDES. Certificados A1 modernos vêm em PBES2/AES-256 e quebram tanto no upload quanto na assinatura do XML da NF-e. Centralizar num único leitor com fallback (PKI.js → forge) elimina o problema nos dois pontos críticos e impede regressões silenciosas em emissão.

**Como aplicar:**
1. Para validar/cadastrar um PFX: `const bundle = await readPfx(pfxBase64, password);` — devolve `{ privateKeyPem, certificatePem, certificateBase64, subject, cn, cnpj, serialNumber, validity, reader }`.
2. Para assinar XML da NF-e: `loadCertificate()` em `_shared/xml-signer.ts` já consome `readPfx`. Não chamar forge direto no signer.
3. Para erros: capturar `PfxError`, ler `.code`, traduzir com `pfxErrorToUserMessage` e retornar 200 + envelope.
4. Senha incorreta NÃO dispara fallback entre leitores (mesma senha vai falhar igual em ambos) — `WRONG_PASSWORD` é terminal.

**Pontos de uso atuais:**
- `supabase/functions/fiscal-upload-certificate/index.ts`
- `supabase/functions/_shared/xml-signer.ts → loadCertificate`

Qualquer nova função fiscal que precise abrir o PFX deve ser adicionada à lista acima neste arquivo.
