# Plano de Correção — IA de Atendimento (Reg #2.17, pós-ondas A–D)

> Base: `docs/tecnico/temp/reg-2-17-ondas-diagnostico.md` + docs oficiais (`modo-vendas-whatsapp.md`, `pipeline-f2-vendas-ia.md`, `turn-orchestrator.md`, `ia-atendimento-changelog.md`).
> Escopo: corrigir 3 falhas estruturais de raciocínio sem mudar UI/UX nem contrato de negócio. Tudo reversível por flag.

## O que muda para o cliente final
Nada visualmente. A IA passa a:
- tratar dor física do cliente como oportunidade de venda, não como reclamação;
- reconhecer CEP isolado, pergunta de frete, pergunta de pós-venda e turno curto/ambíguo;
- nunca escalar para humano quando o cliente diz claramente "quero comprar".

## Bugs identificados
1. **Dor confundida com reclamação** (A2, C2) → handoff prematuro.
2. **Roteador de prompt ignora o intent classificado** (B1, B3, D2, D3) → cai em "Me conta o que você precisa".
3. **Camada paralela de handoff sobrescreve o intent** (C2) → escala mesmo com `purchase_intent`.

---

## Fase 1 — Separar dor do cliente de reclamação (bug #1)

**Diagnóstico:** o classificador de turno só tem `complaint`. Sintoma físico ("ressecada", "coçando") e até intenção de compra com termo do produto entram como reclamação. A regra de handoff escala automaticamente quando `intent=complaint` com urgência alta, **antes** da máquina de estados (que já sabe tratar dor — regra `pain_or_objective_declared_advance_to_recommendation`).

**Correção:**
1. No classificador de turno, separar dois sinais:
   - `is_product_pain_symptom` — dor/sintoma que o catálogo resolve (ressecamento, queda, caspa, coçando, oleosidade, calvície, etc.). Sempre oportunidade comercial.
   - `is_order_complaint` — reclamação de pedido/entrega/atendimento/produto já comprado. Caminho atual de handoff.
2. A regra de handoff por reclamação passa a exigir `is_order_complaint=true`. Sintoma puro nunca dispara handoff.
3. Quando `is_product_pain_symptom=true` em modo vendas, o estado avança para `recommendation` (já existe) com probe de catálogo.

**Trava anti-regressão:** se `intent=purchase_intent` ou `is_product_pain_symptom=true`, é proibido `shouldHandoff=true` salvo agressividade explícita ou pedido direto do cliente para falar com humano. Cenários A2 e D1 viram testes fixos.

## Fase 2 — Motor único de handoff (bug #3)

**Diagnóstico:** existem hoje pelo menos 4 caminhos que setam `shouldHandoff` (intent classifier, palavras-chave, regras custom, knowledge insuficiente). Alguns rodam em paralelo ao classificador e ignoram seu resultado — origem do C2 (purchase_intent + handoff no mesmo turno).

**Correção:**
1. Consolidar a decisão num motor único, executado **depois** do classificador, com regra dura: `purchase_intent` ou `product_pain_symptom` vetam handoff comercial.
2. As fontes secundárias passam a ser sugestões; o motor decide.
3. Log estruturado por turno: qual fonte sugeriu handoff, qual era o intent, e a decisão final. Sem isso o problema vira invisível de novo.

**Trava anti-regressão:** C2 vira teste fixo (não escala). D1 continua escalando.

## Fase 3 — Quatro reflexos determinísticos do roteador (bug #2)

**Diagnóstico:** turnos curtos, ambíguos, com CEP isolado ou pós-venda caem em fallback genérico de descoberta. O classificador acerta, o roteador não consome.

**Correção — 4 detectores determinísticos rodando ANTES do template livre, sobre o texto já consolidado pelo Turn Orchestrator:**

1. **CEP recebido** — turno contém CEP válido:
   - Se há item no carrinho/foco de produto → cota frete.
   - Senão → confirma CEP, pede o produto, mantém o CEP no contexto.
2. **Pergunta de frete** — menciona frete/entrega/prazo:
   - CEP presente → cota.
   - CEP ausente → pede CEP.
   - Nunca cai em descoberta genérica.
3. **Pergunta de pós-venda** — menciona pedido/rastreio/entrega com sinais de pós-compra:
   - Roteia para o estado `support` (já existe na máquina) e pede identificação.
   - Jamais responde com pergunta de descoberta de venda.
4. **Turno curto + intent classificado** — 1 a 3 palavras com `intent=purchase_intent` ou família mencionada:
   - Consome o intent: lista variantes / pede qualificação curta / avança no funil.
   - Fallback de descoberta só roda quando `intent=general` de fato.

**Compatibilidade:** os 4 reflexos respeitam o Turn Orchestrator (consomem o texto consolidado, não o último fragmento) e a máquina de estados existente (alimentam o estado certo, não bypassam).

**Trava anti-regressão:** B1, B3, D2, D3 viram testes fixos. Métrica nova: % de turnos onde `intent != general` e a resposta foi "Me conta...". Meta: < 5%.

## Fase 4 — Governança e fechamento

Cada fase técnica produz, antes de fechar:
- 1 registro no changelog da IA (Reg #2.17 A/B/C).
- 1 memória de constraint indexada em `mem://`.
- Atualização do mapa de qualidade no topo do changelog.

Ao final das 3 fases técnicas, descartar o doc temporário `docs/tecnico/temp/reg-2-17-ondas-diagnostico.md`.

---

## Validação por fase
- Cada fase liberada por flag (infra já existe).
- Após cada fase, rodar a bateria de 12 cenários (A–D) via `ai-test-sandbox` Agent Mode.
- Comparar com o doc temporário. Promover só se a fase corrigir o sintoma sem quebrar os ✅ atuais.
- Reversão = desligar a flag.

## Ordem de execução
1. **Fase 1** (dor vs reclamação) — destrava A2 e C2.
2. **Fase 2** (motor único de handoff) — fecha C2 e qualquer regressão lateral.
3. **Fase 3** (4 reflexos do roteador) — fecha B1/B3/D2/D3.
4. **Fase 4** (changelog + memórias).

## Fora de escopo (não mexer agora)
- Latência alta do B2 (40s) — entrega separada de performance.
- Unificação de "fase comercial" do plano antigo — segue depois destes 3 bugs.
- Qualquer mudança de UI/UX ou regra de negócio.

## Checklist de conformidade
- Doc de Regras do Sistema lido ✓
- Doc formal do tema lido (modo-vendas, pipeline-f2, turn-orchestrator, changelog) ✓
- Fluxo afetado: WhatsApp / IA de Atendimento (modo vendas e informativo)
- Fonte de verdade: classificador de turno + motor de handoff + roteador de prompt (no agente de atendimento e no shared sales-pipeline)
- Módulos impactados: classificador, handoff, roteador, máquina de estados (consumo, não estrutura)
- UI impactada: nenhuma
- Situação: Aguardando confirmação do usuário para iniciar a Fase 1
