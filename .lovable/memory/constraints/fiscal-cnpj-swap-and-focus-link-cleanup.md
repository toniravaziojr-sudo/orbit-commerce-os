---
name: Fiscal CNPJ Swap and Focus NFe Link Cleanup
description: Toda troca/remoção de certificado A1 deve recalibrar `fiscal_settings.cnpj` e zerar `focus_empresa_id` para evitar emitir NF-e com vínculo Focus NFe de outra empresa.
type: constraint
---

**Regra:** O certificado digital A1 é a fonte de verdade do CNPJ emissor.

**Obrigações:**
1. `fiscal-upload-certificate`: se `certificado_cnpj` ≠ `fiscal_settings.cnpj`, atualizar `cnpj` e zerar `focus_empresa_id`, `focus_empresa_criada_em`, `focus_ultima_sincronizacao` antes de sincronizar com a Focus NFe.
2. `fiscal-remove-certificate`: limpar também `focus_empresa_id`, `focus_empresa_criada_em`, `focus_ultima_sincronizacao` (não deixar vínculo órfão).
3. `fiscal-emit` e `fiscal-submit`: bloquear emissão quando `certificado_cnpj` ≠ `cnpj` (200 OK + `success:false`, mensagem clara).
4. UI `EmitenteSettings`: alerta vermelho de divergência de CNPJ no card do certificado.

**Why:** sem isso, ao trocar certificado por outro CNPJ a NF-e era enviada para a empresa errada na Focus (PUT em `focus_empresa_id` antigo), gerando rejeição/inconsistência fiscal.

**How to apply:** qualquer mudança nos fluxos de upload/remoção/emissão de NF-e deve preservar essas 4 garantias. Documentado em `docs/especificacoes/erp/erp-fiscal.md` (seção "Protocolo de Troca de CNPJ / Substituição de Certificado A1").
