📋 CHECKLIST DE CONFORMIDADE
- Doc de Regras do Sistema lido: ✅
- Doc formal do tema lido: ✅ Pré-Flight Fiscal/Logístico, Logística, constraint dos Correios CWS, constraint "DC silenciosa proibida no Módulo de Remessas"
- Fluxo afetado identificado: ✅ Criação do PV → DC nativa automática → Objeto de postagem com DC anexada → Envio aos Correios
- Fonte de verdade identificada: ✅ Pedido de Venda continua como âncora; a DC passa a ser artefato nativo do PV
- Módulos impactados listados: ✅ Fiscal (PV/DC), Logística (objeto, etiqueta), UI de Pedidos de Venda, UI do módulo de Remessas, Integração WMS, Reconciliação
- Impacto cruzado mapeado: ✅ NF-e (coexistência opcional), Pratika, Correios, pré-flight
- UI impactada? mapa-ui.md será atualizado: ✅ Ação única "Imprimir Declaração de Conteúdo" no PV; remoção do botão "Emitir DC" em Remessas
- Situação: Aguardando confirmação do plano final

📌 STATUS DA ENTREGA: Proposta

## Decisões já confirmadas com o usuário
1. **DC nasce junto com o PV.** Não existe mais "gerar DC" como ação — só "Imprimir Declaração de Conteúdo".
2. **NF-e e DC convivem.** O lojista decide na hora do envio: pode mandar com NF, com DC, ou com as duas. Quem decide é ele.
3. **Backfill no tenant Respeite o Homem.** Todos os PVs existentes devem ser reprocessados para nascerem no formato novo: DC emitida e anexada ao objeto de postagem correspondente.

## Como funciona hoje
- O PV nasce sem documento de transporte. A DC só é gerada sob demanda, geralmente já dentro do módulo de Remessas, com um diálogo de motivo e aceite de responsabilidade.
- O envio aos Correios depende de NF-e autorizada OU DC emitida. Quando nenhuma das duas existe no momento certo, a remessa cai em Pendentes com o erro técnico "Declaração de Conteúdo não emitida".
- No tenant Respeite o Homem hoje existem PVs ativos sem DC nativa, o que reproduz exatamente esse erro.

## O que eu faria

### 1. DC nativa em todo PV novo
- Toda criação de PV (vinda de pedido real, duplicação ou manual) dispara, no mesmo instante, a geração da DC e o vínculo ao PV.
- O motivo padrão da DC fica fixo como "Venda/remessa" (sem precisar do diálogo de motivo, já que vira parte natural do PV).
- O aceite de responsabilidade do remetente é registrado de forma sistêmica (o lojista já aceitou os termos uma vez na configuração da loja; isso fica documentado no registro da DC).
- Se faltar dado obrigatório (peso de produto, endereço incompleto, etc.), o pré-flight atual barra o salvamento do PV com a mesma mensagem PT-BR de hoje — mantendo o portão único.

### 2. Vínculo automático com o objeto de postagem
- Quando o objeto de postagem nasce a partir do PV, a DC já está amarrada a ele.
- Hora de despachar pelos Correios:
  - Se houver NF-e autorizada **e** o lojista quiser usar NF, vai pela NF-e.
  - Se houver NF-e autorizada **e** o lojista quiser usar só DC, vai pela DC.
  - Se houver NF-e **e** DC e o lojista quiser as duas, ambas seguem amarradas ao objeto.
  - Se não houver NF-e, vai pela DC nativa.
- Em qualquer cenário, o vínculo fiscal nunca fica vazio — porque a DC sempre está lá.

### 3. Simplificação da UI
- No Pedido de Venda: única ação relacionada a DC = **"Imprimir Declaração de Conteúdo"**.
- No módulo de Remessas: o botão "Emitir DC" sai. Remessas deixa de ser ponto de emissão e volta a ser ponto de despacho.
- Quando o lojista for despachar, aparece uma escolha simples: "Enviar com NF / Enviar com DC / Enviar com NF + DC" — só com as opções disponíveis no PV.
- Indicador discreto no PV se houver dado faltante para a DC ("Faltam dados para a Declaração de Conteúdo: peso do produto X"), com link direto pro cadastro.
- mapa-ui.md atualizado refletindo: ação única no PV, remoção do botão em Remessas, novo seletor de documento no despacho.

### 4. Backfill no tenant Respeite o Homem (item 3 do usuário)
- Rodar reprocessamento dirigido, em lote controlado, em todos os PVs ativos do tenant Respeite o Homem que hoje estão sem DC no formato novo.
- Para cada PV elegível:
  - Gera a DC nativa.
  - Vincula a DC ao objeto de postagem correspondente.
  - Marca o PV como migrado.
- PVs que não passem no pré-flight (dado faltante) ficam marcados como "DC pendente de dados" e aparecem em uma lista para o operador corrigir — não bloqueiam o restante do backfill.
- Relatório final do backfill: total de PVs processados, total de DCs criadas, total pendente de dados, lista dos pendentes.

### 5. Blindagem do erro "DC não encontrada"
- O pré-flight da remessa Correios deixa de aceitar como cenário válido um PV sem documento. Como toda PV passa a nascer com DC, a única razão para chegar nesse estado é dado faltante — e isso já é barrado no salvamento do PV.
- A mensagem técnica "Declaração de Conteúdo não emitida" sai do vocabulário operacional. Vira "Faltam dados X, Y, Z para gerar a Declaração de Conteúdo deste pedido".

### 6. Validação técnica antes de encerrar
- Confirmar em banco: todo PV novo do Respeite o Homem nasce com DC vinculada.
- Confirmar backfill: PVs ativos do Respeite o Homem ↔ DCs ativas, com a lista de "pendentes de dados" zerada ou justificada item a item.
- Confirmar que um pedido novo, do nascimento ao despacho, atravessa o fluxo sem nenhuma ação manual de DC.
- Confirmar três cenários de despacho:
  - PV só com DC → Correios aceita pela DC; Pratika recebe rastreio.
  - PV com NF-e + DC, escolha NF → Correios aceita pela NF; Pratika recebe NF + rastreio.
  - PV com NF-e + DC, escolha DC → Correios aceita pela DC; Pratika recebe NF + rastreio.
- Confirmar nos logs que o erro "DC não encontrada" desaparece.

### 7. Documentação obrigatória
- Atualizar a especificação de Pré-Flight Fiscal/Logístico declarando a DC como artefato nativo do PV.
- Atualizar a especificação de Logística refletindo o vínculo automático DC↔Objeto e o novo seletor de documento no despacho.
- Atualizar o mapa-ui.md (ação única no PV, remoção do botão em Remessas, novo seletor no despacho).
- Registrar memória de anti-regressão: "DC é nativa do PV — proibido reintroduzir botão de emissão manual de DC em qualquer módulo".

## Decisões técnicas que eu tomo (sem consulta)
- A DC é gerada de forma síncrona no nascimento do PV, para garantir que o PV nunca exista sem documento e evitar corrida com a fila de remessa.
- O motivo padrão fixo da DC nativa é "Venda/remessa", uniforme para todos os PVs novos, mantendo o documento dos Correios válido.
- O backfill roda em lotes, com tolerância a falha por item (um PV pendente não derruba o lote).
- A lista de "DC pendente de dados" é exposta no próprio módulo Fiscal, em uma aba/filtro discreto, sem criar tela nova.

## Resultado final esperado
- Todo Pedido de Venda nasce com sua Declaração de Conteúdo pronta e anexada ao objeto de postagem.
- O lojista escolhe na hora do despacho se manda com NF, com DC ou com as duas.
- O erro "Declaração de Conteúdo não encontrada" deixa de existir como cenário operacional.
- O tenant Respeite o Homem fica 100% migrado para o formato novo, com relatório claro de qualquer PV que precise de dados adicionais.

📝 DOCUMENTAÇÃO NECESSÁRIA
- Doc(s) impactado(s): Pré-Flight Fiscal/Logístico (Layer 2), Logística (Layer 3), mapa-ui.md (Layer 3 transversal), nova memória de anti-regressão "DC nativa do PV"
- Motivo: a DC muda de status (de "documento sob demanda" para "artefato nativo do PV"), a UI muda (ação única "Imprimir") e o despacho ganha seletor de documento
- Proposta de atualização: descrita no item 7 acima
- Aguardando confirmação para implementar
