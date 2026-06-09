# Reaproveitamento de numeração para rascunhos puros (NF, PV, Objeto Logístico)

## ⚠️ Mudança de regra de negócio (precisa ser reconhecida)

A regra fiscal oficial hoje, documentada e implementada, é **numeração estritamente monotônica**: o número nunca recua e nunca é reaproveitado, mesmo se o documento for excluído. Foi uma decisão consciente (Onda 3, v2026-05-17) para garantir auditoria fiscal limpa.

O que você está pedindo agora **reverte essa regra** para um cenário específico: rascunhos puros que nunca tocaram ninguém de fora (SEFAZ, Correios, transportadora). É uma reversão segura do ponto de vista fiscal — a SEFAZ continua sendo a fonte de verdade externa e a marca alta dela protege contra reuso de número já queimado lá fora — mas é, formalmente, uma mudança de regra de negócio. Por isso preciso destacar antes de implementar.

---

## Princípio novo

Numeração só é "queimada para sempre" quando o documento toca um sistema externo (SEFAZ para NF, Correios/transportadora para objeto logístico) **ou** ganha uma dependência viva (PV ligado a pedido real, PV com NF emitida, objeto dentro de remessa despachada). Enquanto for rascunho puro, excluir libera o número para a próxima criação (manual, automática ou duplicação).

---

## 1. Nota Fiscal (NF)

**Hoje:** o próximo número é o maior entre `último número local + 1` e um cursor interno que só sobe. Apagar rascunho nunca reaproveita.

**Mudança:** trocar o cursor interno por uma **marca alta da SEFAZ** (maior número que alguma vez foi aceito ou rejeitado pela SEFAZ). Essa marca só sobe — garante que nenhum número já queimado lá fora seja reusado. O próximo número passa a ser `max(maior número local vivo + 1, marca alta da SEFAZ + 1)`.

Resultado: excluir um rascunho puro de NF derruba o "maior local" e libera o número para a próxima criação automaticamente, sem mexer em cursor manualmente.

**Quem pode excluir:** somente NF em rascunho puro
- Nunca foi enviada à SEFAZ (sem chave de acesso e sem nenhum registro de tentativa);
- Sem objeto logístico emitido vinculado.

NF que já tocou a SEFAZ continua só com cancelamento/inutilização e **nunca** reaproveita.

---

## 2. Pedido de Venda (PV)

**Hoje:** mesma lógica do cursor monotônico.

**Mudança:** numerar por `max(maior PV local vivo + 1)`. PV não vai para SEFAZ, então não existe marca externa — só o maior local importa.

**Quem pode excluir:**
- **Bloqueado** quando o PV tem pedido real vinculado em status ativo (trava já existe). Mensagem na UI cita o número do pedido: *"Este Pedido de Venda está vinculado ao pedido #1234. Cancele o pedido na tela de Pedidos antes de excluir."*
- **Bloqueado** quando o PV gerou NF com chave de acesso ou está vinculado a remessa despachada.
- **Permitido** em PV duplicado, manual ou de pedido cancelado, desde que sem NF emitida nem remessa despachada vinculadas. Excluir libera o número.

---

## 3. Objeto Logístico

**Hoje:** numeração sequencial natural (`maior + 1`) — já reaproveita o último automaticamente. Cascata de exclusão por PV respeita agrupamento em remessa.

**Mudança:** manter como está. Só reforçar a trava — objeto só é excluído (direto ou em cascata por PV) quando não tem emissão real: sem etiqueta Correios autorizada, sem rastreio ativo, sem remessa despachada/finalizada. Quando tem emissão real e o PV é excluído, o objeto é desvinculado em vez de apagado.

---

## 4. Remessa

Mantém o que já existe:
- Numeração é timestamp, naturalmente única — não há reuso aplicável.
- Excluída automaticamente quando todos os objetos saem e ela ainda está em rascunho/emitida.
- Remessa despachada/finalizada nunca é apagada automaticamente.

---

## 5. UI

Diálogos de exclusão (NF, PV, Objeto) passam a mostrar em PT-BR, conforme o caso:
- **Liberado:** *"Excluir permanentemente. O número #X ficará disponível para a próxima criação."*
- **Bloqueado por SEFAZ/emissão:** caminho de cancelamento/inutilização, sem opção de excluir-e-reaproveitar.
- **Bloqueado por dependência (PV ↔ pedido):** instrução clara citando o número do pedido vinculado.

Sem jargão técnico no corpo dos diálogos.

---

## 6. Auditoria

- PV já tem auditoria de exclusão. Criar equivalente para NF excluída (mesmo padrão: número, série, motivo, quem excluiu, snapshot dos itens). Rastreabilidade total.
- Objeto logístico: registrar evento no histórico antes de apagar.

---

## 7. Não-regressão (o que NÃO muda)

- Envio para a Pratika, fluxo de emissão, retry de duplicidade SEFAZ, bloco transportador, auditoria de salto: nada disso é tocado.
- Trava de PV pago/ativo continua igual.
- Cascata de exclusão de PV respeitando agrupamento de remessa continua igual.
- NF que tocou a SEFAZ continua intocável quanto a reuso.

---

## 8. Validação obrigatória após implementar

1. Criar NF rascunho → excluir → criar outra NF → confirmar reuso do número.
2. Emitir NF de verdade → tentar excluir → confirmar bloqueio e mensagem correta.
3. Duplicar PV → excluir o duplicado → criar novo PV → confirmar reuso.
4. Tentar excluir PV de pedido pago → confirmar bloqueio com nome do pedido.
5. Excluir PV rascunho com objeto logístico só em rascunho → confirmar cascata e reuso.
6. Despachar remessa → tentar excluir PV → confirmar bloqueio (não cascateia).
7. Emitir uma NF completa pela Pratika → confirmar zero regressão.

---

## 9. Decisão pendente

Antes de seguir, preciso de uma confirmação só: **você confirma a reversão da regra de numeração estritamente monotônica para o cenário de rascunhos puros?** É a única peça que sai do meu escopo de decisão técnica.

Se sim, implemento tudo na sequência: marca alta da SEFAZ, troca do motor de numeração, travas de exclusão, mensagens da UI, auditoria de NF excluída, atualização dos docs fiscais/logísticos e da memória anti-regressão.
