---
name: Changelog obrigatório da IA de atendimento
description: Toda correção/ajuste/scrubber/regra na IA de atendimento (modos informativo e vendas) DEVE gerar um registro em ia-atendimento-changelog.md antes de fechar a entrega.
type: preference
---

## Regra

Qualquer alteração que mude o comportamento da IA de atendimento — prompt, tool, scrubber, máquina de estados, hidratação de carrinho via link da IA, geração de link de checkout pela IA, regras de janela 24h, anti-repetição, anti-loop, fontes de domínio etc. — **deve produzir um novo registro** em:

`docs/especificacoes/whatsapp/ia-atendimento-changelog.md`

O registro segue o template já existente no arquivo:
- Data, conversa de origem (quando houver), sintomas, diagnóstico, correção aplicada, validação, anti-regressão (memórias criadas).

## Por quê

Esse doc é o equivalente do `docs/meta-tracking-changelog.md` para o Pixel/CAPI: histórico vivo de qualidade. Sem ele, o aprendizado se perde entre ciclos e os mesmos sintomas voltam disfarçados de "bug novo".

## Como aplicar

- A entrega só pode ser fechada (status "Corrigido e validado") depois de:
  1. Adicionar o registro no changelog.
  2. Atualizar o "Mapa de qualidade atual" no topo do mesmo doc, mudando o status do comportamento corrigido (✅/⚠️/❌).
  3. Indexar memórias anti-regressão correspondentes em `mem://index.md` quando aplicável.
- O bloco `📝 DOCUMENTAÇÃO NECESSÁRIA` da entrega obrigatoriamente cita esse changelog quando a alteração tocar IA de atendimento.

## Onde NÃO entra

- Especificação de "como funciona" continua nos docs próprios (modo-vendas-whatsapp, pipeline-f2-vendas-ia, validacao-modo-vendas-whatsapp, crm-atendimento).
- O changelog é só o histórico de diagnósticos/correções, não a spec.
