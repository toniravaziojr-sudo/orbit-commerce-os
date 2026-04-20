

## Plano de Estabilização — Recepção WhatsApp Meta (foco no presente)

📋 CHECKLIST DE CONFORMIDADE
- Doc de Regras do Sistema: pendente releitura na execução
- Doc formal do tema: `infrastructure/whatsapp-meta-integration-standard-v3-2` + `infrastructure/whatsapp/template-approval-workflow-v2` — referenciados; lacuna documental do **Fluxo de Recepção** será criada nesta entrega
- Fluxo afetado: Webhook Meta → Auditoria → Roteamento por tenant → Conversa → IA (Suporte/Agenda) → Resposta
- Fonte de verdade: assinatura ativa do webhook na Meta + auditoria de mensagens + token Meta válido
- Módulos impactados: WhatsApp (recepção), IA Atendimento, IA Agenda, Central de Comando (alertas)
- Impacto cruzado: qualquer tenant Meta ativo se beneficia (não é específico do Respeite o Homem)
- UI impactada: card de alerta na Central de Comando — `mapa-ui.md` será atualizado
- Situação: Aguardando confirmação do usuário

---

## Princípio (anti-regressão)

**Foco:** garantir que **a partir de agora** toda mensagem que entrar seja recebida, roteada e respondida — sem mexer em histórico antigo, sem reprocessar nada de jan/fev. Mensagens órfãs ficam arquivadas como histórico.

**Não vou mexer em:**
- ❌ Mensagens antigas (não reprocessar, não recriar conversa retroativa)
- ❌ Configuração da Meta do lado do cliente (token, número, billing)
- ❌ Lógica da IA (Suporte e Agenda continuam como estão)
- ❌ Versão da API Meta (mantém v25.0 que está funcionando hoje)

**Vou mexer apenas em:**
- ✅ Defesas automáticas que detectam quando o fluxo quebra
- ✅ Auto-reparo da assinatura do webhook (já existe parcialmente, vou completar)
- ✅ Alarme visível quando algo travar
- ✅ Documentação do fluxo

---

## Etapas

### Etapa 1 — Healthcheck completo da assinatura do webhook
Hoje já existe rotina diária que testa se o token Meta está vivo. Falta a peça crítica: **verificar se a Meta ainda está com o nosso webhook assinado para o campo `messages`**. Foi exatamente isso que silenciou o fluxo por 2 meses.

- Estender o healthcheck diário para, em cada tenant Meta ativo, perguntar à Meta: "você ainda está me entregando mensagens?"
- Se a resposta for não, **reassinar automaticamente** (ação segura, idempotente, já existe no auto-reparo).
- Se a reassinatura falhar, marcar o tenant como "recepção comprometida" e gerar alerta.

### Etapa 2 — Alarme de mensagem órfã
Quando uma mensagem cai na auditoria mas não vira conversa em até 5 minutos, isso é um sintoma de bug crítico (foi o que aconteceu em jan/fev).

- Rotina de vigilância a cada 15 minutos: conta mensagens recebidas nas últimas 2h sem processamento.
- Se houver qualquer uma, gerar incidente visível na Central de Comando do tenant afetado, com nome do número, horário e quantidade.
- Sem auto-reprocessamento (proibido por princípio nesta entrega) — só visibilidade para decisão humana.

### Etapa 3 — Sinal de saúde do fluxo na Central de Comando
Card simples no painel do tenant mostrando:
- Última mensagem recebida (data/hora)
- Última resposta da IA (data/hora)
- Status da assinatura do webhook (verde/amarelo/vermelho)
- Se houver órfãs nas últimas 24h, número e botão "ver detalhes"

Se o número ficar mais de 12h sem receber nada e o tenant tiver volume normal, alerta amarelo. Mais de 24h, vermelho.

### Etapa 4 — Validação técnica obrigatória
Antes de declarar entrega:
1. Forçar uma derrubada simulada da assinatura e confirmar que o healthcheck detecta + reassina sozinho.
2. Inserir uma mensagem fake na auditoria sem processamento e confirmar que o alarme dispara em até 15 min.
3. Confirmar que o card da Central de Comando mostra dados reais do Respeite o Homem (última mensagem, status verde).
4. Conferir que crons novos estão registrados e ativos.

Bloco obrigatório:
```
🔍 VALIDAÇÃO TÉCNICA EXECUTADA:
- [item testado]
- [resultado: ✅ | ❌]
- [pendência do usuário, se aplicável]
```

### Etapa 5 — Teste E2E real (você + eu)
- Você manda "oi" do seu celular (73991681425) para o número da loja.
- Eu acompanho em tempo real: chegou na auditoria → criou conversa → IA respondeu → status final ok.
- Repetir com 1 áudio curto e 1 imagem para cobrir os tipos mais comuns.

### Etapa 6 — Documentação
1. **Criar doc Layer 3:** `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` — fluxo completo Webhook → Auditoria → Roteamento → IA → Resposta, com contratos, gatilhos e mecanismos de defesa.
2. **Atualizar memória** `infrastructure/whatsapp-meta-integration-standard-v3-2` para a v3.3 incluindo: healthcheck de assinatura obrigatório, alarme de órfã, card de saúde.
3. **Criar memória anti-regressão** `constraints/whatsapp-inbound-pipeline-must-never-be-silent`: regra "mensagem na auditoria sem processamento em 5 min = incidente crítico" + "assinatura do webhook precisa ser verificada diariamente, não só o token".
4. **Atualizar** `docs/especificacoes/transversais/mapa-ui.md` com o novo card da Central de Comando.
5. **Atualizar `recent-topics.md`** rotacionando slot conforme política de memória.

---

## Bloco de fechamento obrigatório
Ao final entrego:
- 🔍 VALIDAÇÃO TÉCNICA EXECUTADA preenchido
- 📝 DOCUMENTAÇÃO NECESSÁRIA preenchido
- 📌 STATUS: avançando de "Diagnóstico" → "Ajuste aplicado — pendente de validação" → "Corrigido e validado" só após teste E2E com você

---

## Ordem de execução
1. Etapas 1+2+3 (defesas + alarme + card)
2. Deploy
3. Etapa 4 (validação técnica)
4. Etapa 5 (teste E2E com você)
5. Etapa 6 (documentação)

**Estimativa:** 1 loop completo. Sem tocar em mensagens antigas, sem reprocessamento, sem regressão.

📌 STATUS: Aguardando sua confirmação para sair do modo Plan e executar.

