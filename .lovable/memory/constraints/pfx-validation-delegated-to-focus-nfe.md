---
name: PFX Validation Delegated to Focus NFe
description: Upload de certificado A1 NUNCA tenta abrir o .pfx no runtime de borda. Validação (senha, expiração, CNPJ, integridade) é delegada ao Focus NFe via sync de empresa.
type: constraint
---

**Regra:** A função de upload de certificado A1 (`fiscal-upload-certificate`) NÃO abre o arquivo `.pfx` localmente. O fluxo correto é:

1. Sanity mínima: rejeitar PEM disfarçado e arquivos sem assinatura PKCS#12 (primeiro byte ≠ `0x30`).
2. Cifrar `.pfx` + senha com AES-CBC (`FISCAL_ENCRYPTION_KEY`) e gravar em `fiscal_settings`.
3. Disparar `fiscal-sync-focus-nfe`. O Focus NFe valida senha, integridade ASN.1, expiração, cifra (AES-256/PBES2/TripleDES) e CNPJ.
4. Sucesso do sync → metadados (`certificado_valido_ate`, `certificado_cn`, `certificado_cnpj`) são preenchidos a partir da resposta do Focus.
5. Erro do sync com causa **no certificado** (`isCertificateRelatedError`) → apagar cert salvo e responder 200 + `success:false` + mensagem traduzida (`translateFocusCertificateError`).
6. Erro do sync com causa **fora do certificado** (dados de empresa incompletos, indisponibilidade) → manter cert salvo, retornar 200 + `success:true` + `status: 'pending_validation'` + mensagem orientativa.

**Proibido:**
- Importar `readPfx`, PKI.js, `node-forge` ou qualquer parser PKCS#12 dentro de `fiscal-upload-certificate`.
- Bloquear o upload por validação local de cifra/MAC/CNPJ — só o Focus pode dar a palavra final.
- Status 4xx/5xx para erros de negócio. Sempre 200 + envelope.

**Por quê:** PKI.js tem incompatibilidade conhecida com o runtime Deno das edge functions (`Cannot assign to read only property 'undefined' of object '#<Window>'`), e `node-forge` só abre certificados em TripleDES — certificados modernos (AES-256/PBES2) sempre falhavam. O Focus NFe é fonte de verdade fiscal e já valida todos os formatos em produção.

**Pontos de uso:**
- `supabase/functions/fiscal-upload-certificate/index.ts` — não abre PFX.
- `supabase/functions/fiscal-sync-focus-nfe/index.ts` — propaga `certificado_validade` do Focus para `fiscal_settings`.
- `supabase/functions/_shared/focus-error-translator.ts` — tradução PT-BR única.

**Escopo restante de `_shared/pfx-reader.ts`:**
- Continua disponível APENAS para `_shared/xml-signer.ts` (cenário hipotético de assinatura local de XML que hoje não é usado, pois a emissão passa pelo Focus). Se em algum dia esse cenário for ativado, a abordagem correta NÃO é PKI.js no runtime de borda — é microserviço dedicado em Node nativo ou WASM com OpenSSL.
