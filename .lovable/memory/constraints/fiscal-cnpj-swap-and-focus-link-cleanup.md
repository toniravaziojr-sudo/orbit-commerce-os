---
name: Fiscal CNPJ Swap and Focus NFe Link Cleanup
description: Troca/remoção de certificado A1 deve preservar consistência entre fiscal_settings.cnpj, certificado_cnpj e focus_empresa_id. Caminho B (rev 2026-05) — sem auto-swap silencioso de CNPJ.
type: constraint
---

**Regra:** O certificado digital A1 é a fonte de verdade do CNPJ emissor.

**Obrigações (Caminho B — rev 2026-05):**
1. `fiscal-upload-certificate`: delega validação ao Focus NFe. Não lê `.pfx` localmente. Quando o Focus rejeita por CNPJ divergente, devolve resposta amigável (`focus-error-translator.ts`) — não atualiza `fiscal_settings.cnpj` automaticamente. O lojista precisa ajustar dados do emitente e reenviar (UI oferece botão "Atualizar CNPJ do emitente para X" no card do certificado).
2. `fiscal-remove-certificate`: limpar também `focus_empresa_id`, `focus_empresa_criada_em`, `focus_ultima_sincronizacao` (não deixar vínculo órfão).
3. `fiscal-emit` e `fiscal-submit`: bloquear emissão quando `certificado_cnpj` ≠ `cnpj` (200 OK + `success:false`, mensagem clara).
4. UI `EmitenteSettings` (rev UX 2026-05): Cartão de Prontidão Fiscal exibe item "CNPJ do certificado coincide com o do emitente" como bloqueado (vermelho) quando há divergência. Card "Certificado Digital A1" mostra banner vermelho com botões: "Atualizar CNPJ do emitente para XX.XXX.XXX/XXXX-XX" (preenche o campo) e "Enviar outro certificado".
5. Após upload bem-sucedido, `useFiscalSettings.uploadCertificate` invalida `['fiscal-settings']` — o card deve atualizar imediatamente sem refresh manual. Se algum dia for movido para optimistic UI, garantir refetch + reset dos estados locais (`selectedFile`, `certPassword`, `showReplaceForm`).
6. **Contato do emitente (rev 2026-05b):** `fiscal_settings.email` e `fiscal_settings.telefone` são opcionais mas sempre que preenchidos devem ser propagados ao Focus NFe via `fiscal-sync-focus-nfe` (`PUT /v2/empresas/{id}` no payload `email`/`telefone`). E-mail vazio só impede o envio automático do DANFE pelo Focus — não bloqueia emissão. Validação local de formato de e-mail é obrigatória antes de salvar.

**Why:** sem isso, ao trocar certificado por outro CNPJ a NF-e era enviada para a empresa errada na Focus, gerando rejeição/inconsistência fiscal. O auto-swap antigo dependia de leitura local do `.pfx`, que foi removida no Caminho B.

**How to apply:** qualquer mudança nos fluxos de upload/remoção/emissão de NF-e deve preservar essas 5 garantias. Documentado em `docs/especificacoes/erp/erp-fiscal.md` (seções "Protocolo de Troca de CNPJ / Substituição de Certificado A1" e "Validação do certificado A1 (Caminho B)").
