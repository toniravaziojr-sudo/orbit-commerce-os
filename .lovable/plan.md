# Numeração soberana da NF + Bloco transportador + Auditoria de salto

**Status:** Implementado — pendente de validação na próxima emissão.

## Diagnóstico do salto 410 → 412 (encerrado)

- Cursores de Pedido de Venda e de Nota Fiscal **já são independentes**. Duplicar PV não consome número de NF.
- O salto aconteceu porque a SEFAZ rejeitou o 411 como duplicado (resíduo de emissão antiga apagada localmente). O motor de retry agiu corretamente: avançou para 412 e a SEFAZ autorizou.
- Sistema funcionou como projetado. O 411 fica como lacuna no histórico — pode ser inutilizado formalmente pela tela existente (Configurações Fiscais → Outros → Inutilizar Numeração) se você quiser regularizar.

## O que foi entregue nesta rodada

1. **Numeração soberana** (já em produção): toda NF vai para a Focus com `numero`/`serie` explícitos, e o retry de duplicidade incrementa monotonicamente o cursor.
2. **Bloco transportador** (já em produção): nome, CNPJ (quando catalogado), serviço e volumes vão na NF e no XML. Correios reconhecido por padrão.
3. **Auditoria de salto (novo)**: toda vez que a SEFAZ rejeita um número por duplicidade e o sistema avança o cursor, é registrado um evento estruturado na linha do tempo da nota com: número rejeitado, próximo número, série, motivo. Assim, qualquer "lacuna" futura é explicável em segundos, sem investigação manual.

## O que NÃO foi alterado (precisaria sua aprovação)

- Bloqueio de exclusão silenciosa de NF com número alocado.
- Banner no módulo Fiscal sugerindo inutilização de faixas puladas.
- Realinhamento automático do cursor com a SEFAZ (custo de API recorrente).

Se quiser qualquer um desses, me chama que eu monto uma proposta dedicada.

## Como validar

1. Emitir uma NF normal — comportamento idêntico ao atual, só com registro extra de auditoria se a SEFAZ rejeitar algum número.
2. Se houver um salto futuro, abrir a linha do tempo da nota emitida — o evento "numero_duplicado_sefaz" aparece com os detalhes.
