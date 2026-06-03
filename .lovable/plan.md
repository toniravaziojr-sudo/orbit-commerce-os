📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras do Sistema lido: ✅
- Doc formal do tema lido: ✅ Fiscal/Logística e Pré-Flight fiscal/logístico
- Fluxo afetado identificado: ✅ Pedido de Venda → NF/DC → Objeto de postagem → Etiqueta → envio ao WMS
- Fonte de verdade identificada: ✅ Pedido de Venda como vínculo canônico do objeto; documento fiscal obrigatório para emissão local
- Módulos impactados listados: ✅ Fiscal, Logística, automações de reconciliação e integração WMS
- Impacto cruzado mapeado: ✅ espelho de status do PV, criação/remoção de objeto, emissão local, envio ao WMS
- UI impactada? mapa-ui.md atualizado (ou lacuna declarada): ⚠️ haverá atualização se a correção alterar comportamento visível
- Situação: Diagnóstico em andamento

📌 STATUS DA ENTREGA: Diagnóstico → Proposta

Como funciona hoje
- O objeto de postagem nasce a partir do Pedido de Venda.
- Para emissão local, o sistema exige documento válido: NF autorizada ou Declaração de Conteúdo emitida.
- Quando a NF autoriza, o sistema tenta enviar a NF ao WMS.
- Quando a etiqueta é gerada, o sistema deveria manter o objeto, registrar o rastreio e notificar o WMS com o código de envio.

O problema
- Há um defeito estrutural no espelho de status do Pedido de Venda: quando ele sai de “em aberto”, o sistema trata isso como cenário de remoção do objeto mesmo em casos válidos, como conclusão após emissão. Isso explica o caso do PV duplicado que ficou sem objeto.
- A reconciliação automática ainda está incompleta para fechar o fluxo inteiro: ela recupera parte dos casos, mas não cobre corretamente todos os PVs manuais/duplicados ativos.
- Hoje, no tenant analisado, os 271 objetos estão em rascunho e nenhum chegou a etiqueta gerada/rastreio. Então o envio de NF ao WMS já tem evidência real de sucesso, mas o envio de etiqueta ao WMS ainda não tem prova de produção concluída nesse tenant.

Evidência já confirmada no diagnóstico
- Tenant correto identificado e integração WMS ativa, com envio automático de NF e etiqueta habilitados.
- Há 275 Pedidos de Venda e 271 objetos: 3 são casos de chargeback e 1 é o PV duplicado/concluído sem objeto.
- O caso do PV 383 confirma a causa-raiz: o PV foi concluído, a NF 384 foi autorizada e enviada com sucesso ao WMS, mas o objeto vinculado sumiu.
- O envio de NF ao WMS já tem sucesso registrado em produção para esse tenant.
- O envio de etiqueta ao WMS ainda não tem sucesso registrado, porque ainda não existe etiqueta/rastreio gerado nesse tenant após a ativação desse fluxo.

O que eu faria
1. Corrigir a regra estrutural de remoção do objeto
- Ajustar o espelho de status para remover objeto apenas em saídas realmente cancelatórias ou impeditivas.
- Proteger explicitamente os casos válidos de evolução operacional, como conclusão/emissão, para o objeto não ser apagado.

2. Fechar a reconciliação de ponta a ponta
- Ampliar a reconciliação para recuperar também PV manual ou duplicado ativo que deva ter objeto e hoje está sem ele.
- Manter excluídos apenas os casos que realmente não devem gerar objeto, como chargeback perdido, cancelamento real e devolução final.

3. Reparar imediatamente os dados do tenant afetado
- Recriar o objeto faltante do PV duplicado válido.
- Rodar reconciliação dirigida no tenant para eliminar qualquer outro ativo sem objeto.
- Confirmar, no banco, a paridade esperada entre PVs ativos e objetos válidos.

4. Blindar a emissão local com documento obrigatório
- Validar o fluxo inteiro para garantir que nenhum objeto local seja emitido sem NF autorizada ou Declaração de Conteúdo emitida.
- Verificar também o caso de PV manual/duplicado para assegurar o mesmo bloqueio, sem exceções laterais.

5. Fechar a prova ponta a ponta com o WMS
- NF: validar novamente em produção um caso recente e confirmar registro de sucesso.
- Etiqueta: gerar uma etiqueta real em um objeto elegível do tenant, com documento já válido, e confirmar o registro de sucesso do envio de rastreio ao WMS.
- Se houver falha, corrigir a integração até obter sucesso real e documentado.

6. Validar tecnicamente antes de encerrar
- Conferir dados no banco: objeto criado, vínculo com PV, vínculo com NF/DC, status correto e ausência de órfãos indevidos.
- Conferir logs/auditoria: envio de NF e envio de etiqueta ao WMS com sucesso.
- Conferir comportamento operacional: objeto não some ao concluir o PV e só bloqueia quando realmente faltar documento fiscal válido.

Resultado final esperado
- Todo Pedido de Venda ativo que deve gerar objeto terá seu objeto corretamente criado e preservado.
- Nenhum objeto local poderá ser emitido sem NF autorizada ou Declaração de Conteúdo emitida.
- O caso do PV duplicado ficará corrigido.
- Haverá confirmação real de produção do envio ao WMS para os dois eventos: NF e etiqueta.

🔍 VALIDAÇÃO TÉCNICA JÁ EXECUTADA:
- Leitura formal das regras macro, especificação logística e portão único fiscal/logístico
- Consulta real do tenant analisado
- Verificação real da integração WMS ativa
- Verificação real de sucesso recente de envio de NF ao WMS
- Verificação real de ausência atual de sucesso de etiqueta ao WMS
- Resultado: ✅ diagnóstico da causa principal fechado | ✅ envio de NF já comprovado | ⚠️ envio de etiqueta ainda depende de emissão real para prova final

📝 DOCUMENTAÇÃO NECESSÁRIA:
- Doc(s) impactado(s): especificação de logística, regra transversal da UI e documentação técnica anti-regressão
- Motivo: a regra de remoção/reconciliação do objeto e a prova operacional com WMS precisam ficar formalizadas
- Proposta de atualização: registrar a nova regra de preservação do objeto em conclusão válida, ampliar a reconciliação para PV manual/duplicado ativo e documentar o protocolo de validação real do envio ao WMS
- Aguardando confirmação