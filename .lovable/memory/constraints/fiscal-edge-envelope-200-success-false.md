---
name: Fiscal Edge Envelope 200+success:false
description: Funções fiscais devem responder erro de negócio com 200 OK + success:false. supabase.functions.invoke esconde a mensagem real quando o status é 4xx, e o usuário só vê toast genérico ("Erro ao processar fiscal").
type: constraint
---

**Regra:** TODAS as edge functions do módulo fiscal (fiscal-upload-certificate, fiscal-emit, fiscal-submit, fiscal-cancel, fiscal-cce, fiscal-create-draft, fiscal-update-draft, fiscal-create-manual, fiscal-inutilizar, fiscal-validate-order, fiscal-sync-focus-nfe, fiscal-remove-certificate, fiscal-test-connection, fiscal-check-status, fiscal-get-status) devem retornar **HTTP 200 + `{ success: false, error: "<mensagem clara em PT-BR>" }`** para erros de negócio (senha errada, certificado inválido, CNPJ divergente, validação de dados, recurso não encontrado, etc.).

**Status 4xx/5xx fica reservado para:**
- Erros reais de infraestrutura (chave de criptografia ausente, falha de conexão com banco, exceções não tratadas).

**Por quê:** o cliente `supabase.functions.invoke()` trata respostas ≥400 como `FunctionsHttpError` e o corpo `{success:false, error}` não chega ao toast — o usuário vê apenas a mensagem genérica do `error-toast.ts`. Isso impede diagnóstico (ex.: "senha incorreta" vs "formato PFX não suportado") e gerou tickets recorrentes.

**Categorização obrigatória no upload de certificado A1:**
1. PEM no lugar de PFX → mensagem específica.
2. Cifra moderna não suportada (`Only X bits supported`, `unsupported cipher/algorithm/OID`) → orientar reexportar com TripleDES/compatibilidade.
3. MAC inválido / `invalid password` → "Senha incorreta".
4. Erro de parse ASN/DER → "Arquivo corrompido, reexporte".
5. Fallback genérico amigável.

**Aplicação:** qualquer mudança nessas funções deve preservar o envelope. Documentado em `docs/especificacoes/erp/erp-fiscal.md`.
