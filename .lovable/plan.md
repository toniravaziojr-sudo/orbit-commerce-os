## Contexto

O ajuste de **MEI / CRT 4** já foi aplicado e o cadastro interno da loja está correto. Também já foi corrigido o problema de **reuso de referência** no reenvio de NF rejeitada.

Mesmo assim, a NF 1-289 continua sendo rejeitada com o código 481 porque o fluxo ainda permite transmitir a nota quando o **cadastro do emitente no provedor fiscal está desatualizado em relação ao cadastro salvo localmente**.

Evidência do caso real:
- o cadastro local foi salvo novamente às **05:50** com CRT 4 / MEI;
- a última sincronização confirmada com o provedor permaneceu em **05:07**;
- a nota foi reenviada às **05:48** com nova referência e voltou a rejeição 481 real da SEFAZ.

Conclusão: o problema atual **não está mais na nota em si**, e sim na ausência de um **gate de sincronização obrigatória** entre o salvamento fiscal e a emissão/reemissão.

## O que será feito

### 1. Gate obrigatório de sincronização antes de emitir / reenviar
- Antes de qualquer emissão ou reenvio, o backend vai comparar a versão local do cadastro fiscal com a última sincronização confirmada no provedor.
- Se o cadastro local estiver mais novo, o backend tentará sincronizar automaticamente o emitente **antes** de transmitir a nota.
- Se a sincronização falhar, a transmissão será bloqueada com mensagem objetiva, em vez de mandar a nota para a SEFAZ com cadastro defasado.

### 2. Salvamento fiscal sem falha silenciosa
- O fluxo de salvar configurações fiscais deixará de tratar falha de sincronização como detalhe secundário ou silencioso.
- Quando o cadastro local salvar mas a atualização externa falhar, o sistema vai sinalizar isso claramente e manter o estado operacional coerente.

### 3. Retry de NF rejeitada continua preservado
- A regra já implementada de gerar nova referência em reenvios de nota rejeitada será mantida.
- Ela segue necessária, mas passa a operar junto com a garantia de sincronização do emitente.

### 4. Atualização da documentação fiscal
- Atualizar o doc oficial do módulo Fiscal registrando o novo gate de sincronização obrigatória.
- Como não há mudança de UI prevista neste ajuste, o mapa de UI só será atualizado se surgir impacto visual real durante a implementação.

## Como você valida

1. Salvar as Configurações Fiscais com CRT 4 / MEI.
2. Reenviar a NF 1-289.
3. Esperado: se o cadastro externo estiver defasado, o sistema sincroniza primeiro e só depois transmite.
4. Se a sincronização externa falhar, o sistema não transmite a NF e informa claramente que o cadastro fiscal do emitente ainda não foi atualizado no provedor.
5. Após sincronização bem-sucedida, o reenvio deve seguir para avaliação real da SEFAZ.

## Risco e segurança

- **Risco de regressão:** Médio-baixo. O ajuste mexe no pipeline de emissão fiscal, mas reduz envio inválido para a SEFAZ.
- **Segurança:** A mudança permanece restrita ao cadastro fiscal do próprio tenant e reforça o uso do backend como fonte de controle do fluxo.
- **Reversibilidade:** Se necessário, o gate pode ser relaxado sem desfazer os dados salvos; porém a direção correta é manter o bloqueio seguro.

---

### Bloco técnico (opcional, para registro)

- Manter a regra atual de `focus_ref` novo em retry de `rejected`.
- Em `fiscal-submit` e `fiscal-emit`, comparar `fiscal_settings.updated_at` vs `focus_ultima_sincronizacao` e executar sincronização automática do emitente quando o cadastro local estiver mais novo.
- Se a sincronização falhar, retornar erro de negócio claro e não transmitir a NF.
- No fluxo de salvar configuração fiscal, tratar falha da sincronização subsequente como falha operacional relevante, sem silêncio.
- Atualizar o doc fiscal com a regra de "sincronização obrigatória antes de emitir/reenviar quando o cadastro local estiver mais novo que o snapshot externo".
