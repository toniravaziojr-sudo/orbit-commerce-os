# Plano Mestre Final v4 — IA de Atendimento e Vendas do Comando Central

> **Status:** ✅ Aprovado como versão final do plano mestre.
> **Escopo:** Pipeline completa de atendimento e venda IA, com WhatsApp como canal prioritário da Fase 1.
> **Substitui:** Plano v2 (Pipeline Básica com Contexto de Negócio).

---

## 📋 Checklist de Conformidade
- Doc de Regras do Sistema: aplicado (Knowledge de governança em uso)
- Doc formal do tema: lacuna documental declarada — Layer 2 macro de IA de vendas a ser criado no fechamento do rollout
- Fluxo afetado: pipeline completa de atendimento e venda IA WhatsApp + checkout
- Fonte de verdade: catálogo + variantes + config IA + memória híbrida + contrato de checkout por canal
- Módulos impactados: Modo Vendas IA, Configuração IA, Pipeline F2, Catálogo, Checkout, Cupom, Frete, Memória híbrida, Observabilidade, UI override
- Impacto cruzado mapeado: sim
- UI impactada: sim (UI de override + tela de métricas + aviso de catálogo incompleto)
- 📌 Status: Plano v4 aprovado — pronto para servir como base oficial da implementação

---

## Visão macro

Transformar a IA de "buscador reativo de catálogo" em **vendedora/atendente de alto nível** que entra na conversa já entendendo o negócio, os produtos, as dores que resolve, a lógica comercial, a linguagem do cliente e o contrato operacional do tenant. Funciona bem por padrão (com ou sem configuração manual), degrada com elegância em catálogo ruim, respeita compliance por nicho, e se mede com métricas comerciais reais — não só logs técnicos.

## Princípio central

A IA **não pode depender de "buscar no catálogo quando o cliente perguntar"**. Ela precisa entrar na conversa já sabendo o que vende, para quem, qual problema cada produto resolve, qual o papel comercial de cada item, como traduzir a fala do cliente em dor, e qual o contrato operacional do tenant para fechar a venda.

---

## Pacotes (16 — A a P)

### Núcleo de inteligência prévia

- **A** — Inferência automática do negócio + matriz de precedência de fontes (catálogo > FAQ > Drive > avaliações; override do tenant é última camada antes do guardrail estrutural)
- **B** — Árvore real de contexto universal (negócio → público → macrocategoria → subcategoria → tipo → dor → produtos), com suporte explícito a **tenant híbrido / multi-linha** como sub-regra
- **C** — Mapa produto ↔ dor/objetivo N:N com peso (principal vs secundária)
- **H** — Variantes de produto (tamanho, cor, voltagem, volume, modelo, fragrância, numeração, acabamento): quando obrigatória, como perguntar só a necessária, como não confundir produto com variante
- **J** — Contrato de payload comercial por produto (objeto pronto, não cru): nome comercial, papel comercial, dor principal, dores secundárias, para quem serve, quando NÃO indicar, diferenciais, prova social curta condicional, resumo curto/médio, argumentos de comparação

### Motor comercial e jornada

- **D** — Motor comercial universal, com regras explícitas:
  - termo amplo → listar opções reais agrupadas por dor (nunca preço/tamanho de cara)
  - dor declarada → conectar ao produto certo (não categoria genérica)
  - produto citado nominalmente → falar daquele produto
  - intenção clara → avançar, parar de enrolar
  - upsell único e respeitoso (kit/3un/complemento) na fase de decisão
  - confiança → comportamento (alta = afirma; média = sugere e confirma; baixa = não recomenda assertivo, conduz descoberta)
  - perfil de cliente: novo / recorrente sem pendência / com sinal ativo (carrinho, pedido recente, reclamação, elegível cupom de retorno)
  - **regra objetiva de perguntar vs recomendar** (tabela de decisão)
- **M** — **Dicionário de linguagem do cliente**: camada explícita que traduz como o cliente fala para dor/objetivo real ("cabelo ralo / falhas / entradas / caindo muito" → queda capilar; "mais arrumado / casual / social" → estilo; "bom / sem travar / para jogo / para trabalho" → uso). Construído por nicho, alimentado por inferência + override do tenant. Vive no payload de contexto do turno, não no prompt fixo.
- **N** — **Regras explícitas de anti-indicação** (regra formal do motor comercial). A IA não recomenda quando:
  - produto sem estoque
  - variante incompatível com o que o cliente declarou
  - kit cedo demais (antes de dor entendida + intenção)
  - produto inadequado para a dor (peso baixo no mapa N:N)
  - complemento fora de hora (antes do principal)
  - premium cedo demais (sem sinal de orçamento/intenção)
  - alternativa sempre obrigatória quando bloquear (substituto compatível pela mesma dor)

### Compliance e operação

- **I** — Política de claims, promessas e limites comerciais (compliance por nicho: beleza, suplementos, saúde, íntimo, eletrônico). Nunca prometer resultado clínico, prazo sem confirmação, comparação desonesta, prova social inventada, desconto fora da autonomia.
- **O** — **Contrato de checkout por tenant/canal**. Define explicitamente, por canal (WhatsApp prioritário) e por tenant:
  - quais dados a IA coleta no chat (nome, email, CPF, CEP, endereço, telefone)
  - quais são obrigatórios por canal antes de avançar
  - quando a IA continua no chat até gerar link
  - quando manda direto para checkout (link gerado mais cedo)
  - como adapta por tenant sem quebrar base universal (override permitido em "ordem de coleta", "campos opcionais", "ponto de transição chat→link"; nunca permitido em "campos legalmente obrigatórios" nem em segurança de pagamento)
  - regra de retomada: se cliente sair no meio, ao voltar a IA continua de onde parou (não recomeça coleta)

### Robustez, UI e governança

- **E** — UI de override do tenant (visualizar inferência, corrigir cada nível da árvore, ajustar vínculos N:N, dicionário customizado, contrato de checkout)
- **G** — Robustez (catálogo ruim → modo neutro + aviso UI; regeneração automática incremental quando catálogo muda; override do tenant nunca sobrescrito por regeneração)

### Validação, performance e observabilidade

- **F** — Matriz de validação multi-arquétipo (3 nichos × 13 cenários: termo amplo, dor declarada, refinamento de dor no turno seguinte, variante obrigatória, sem estoque, recorrente, objeção de preço, objeção de confiança, produto citado nominal, pedido existente, catálogo ruim, recusa de upsell, "ok/eai?", produto com várias dores, tenant híbrido)
- **K** — SLA por estado + degradação graciosa. Fase 1 = medir baseline real P50/P95 por estado; só depois cravar alvo. Degradação: modelo mais rápido se exceder limite, resposta curta primeiro, tool simplificada.
- **L** — Observabilidade comercial (não só técnica): por turno registrar o que a IA "sabia" do negócio, dor entendida, produtos considerados, por que recomendou aquele, qual fonte de verdade venceu conflito, estado da jornada, tools usadas, falhas, fallback, continuação, anti-duplicidade, stall, latência.
- **P** — **Métricas de sucesso por fase** (critério objetivo de aprovação, não só rollout):
  - **Taxa de recomendação correta** (recomendação alinhada à dor declarada — auditada amostralmente)
  - **Taxa de repetição indevida** (mesma pergunta genérica feita 2+ vezes no mesmo fluxo)
  - **Taxa de handoff indevido** (handoff em caso simples que IA deveria ter resolvido)
  - **Tempo de resposta por estado** (P50/P95)
  - **Taxa de oferta de kit na hora certa** (kit oferecido só após dor + intenção; não antes)
  - **Taxa de fechamento após intenção clara** (cliente declarou intenção → quanto fechou)
  - **Taxa de fallback ativo** (modo neutro / catálogo ruim disparado)
  - **Taxa de variante perguntada corretamente** (perguntada quando obrigatória, não perguntada quando irrelevante)
  - Cada fase do rollout só fecha se métricas relevantes ficarem dentro do limite definido por nicho

---

## Matriz de precedência de fontes (resolução de conflito)

Em conflito sobre um fato de produto/negócio, vence nesta ordem:

1. **Guardrail estrutural** (segurança, máquina de estados, política de imagem, fiscal, checkout) — nunca quebrável
2. **Override manual do tenant** (UI Pacote E)
3. **Catálogo do tenant** (produto, variante, estoque, preço, descrição)
4. **Configuração IA do tenant** (system_prompt, persona, instruções de canal)
5. **Snapshot de inferência** (árvore + mapa N:N + dicionário)
6. **FAQ / políticas do tenant**
7. **Drive / materiais de marca**
8. **Avaliações / prova social** (só se estruturada e confiável; senão, IA não usa)
9. **Memória híbrida** (aprendizado cruzado, último recurso)

A IA declara internamente qual fonte venceu (vai para o log do Pacote L).

---

## Camadas de precedência de prompt (estrutura do turno)

1. Linguagem-base PT-BR (fixa)
2. Prompt do estado atual (fixo)
3. **Snapshot de negócio + payload comercial dos produtos relevantes + dicionário de linguagem** (Pacotes A+B+C+J+M)
4. Camada do tenant (system_prompt + custom_instructions — complementa)
5. Guardrails estruturais + anti-indicação + compliance (Pacotes N+I — fixos no final, não quebráveis pelo tenant)
6. Contexto da conversa (histórico, memória, cliente, carrinho)

---

## Decisões fechadas (input para Fase 1)

### 1. Canal prioritário
**WhatsApp é a prioridade absoluta da Fase 1.** Reaproveitamento em outros canais (chat na loja, Instagram) fica como herança natural, não entregável da Fase 1.

### 2. Autonomia comercial da IA
A IA pode **aplicar automaticamente cupons, benefícios e vantagens que já estejam previstos nas regras do tenant e validados pelo sistema**.

> ⚠️ **Definição explícita e não-negociável:** "aplicação automática de cupom" significa **apenas uso de regras já elegíveis e validadas pelo sistema**. Nunca autonomia livre para a IA criar desconto, conceder benefício fora da política configurada, ou inventar vantagem comercial.

Operacionalmente:
- IA consulta elegibilidade via tool (`check_customer_coupon_eligibility`, `check_coupon`)
- Só aplica o que o sistema retornar como válido para aquele cliente/carrinho
- Nunca propõe desconto livre ("posso te dar 10%")
- Nunca aceita pedido de desconto do cliente fora das regras configuradas (encaminha para handoff se insistir)

### 3. Handoff
- **Se existir fila/atendente humano configurado para o tenant:** usar essa fila.
- **Se não existir:** comportamento padrão seguro:
  - avisar o cliente explicitamente que o caso será encaminhado
  - registrar e resumir o contexto da conversa
  - silenciar a IA até intervenção humana
  - **nunca fingir** que já existe um atendente respondendo

---

## Rollout final (ordem revisada — ferramentas/payload antes de linguagem)

1. **Inferência + árvore + mapa + variantes + payload comercial + base de robustez** (A+B+C+H+J+G base)
2. **Motor comercial + anti-indicação + compliance + contrato de checkout + dicionário** (D+N+I+O+M)
3. **Linguagem e dinâmica de turno** (anti-repetição, anti-greeting, continuidade, debounce, agrupamento, lock de turno)
4. **Validação multi-arquétipo pesada** (F) — 3 nichos × 13 cenários, com métricas do Pacote P como critério de aceite
5. **UI de override + regeneração automática** (E + G restante)
6. **Observabilidade comercial + SLA + métricas de sucesso** (L+K+P)
7. **Handoff disciplinado** (critérios objetivos, resumo do contexto, nada já resolvível pela IA, respeitando decisão #3)
8. **Documentação formal** (Layer 2 macro de IA de vendas + atualização Layer 3 Pipeline F2 + mapa-ui)

---

## Critérios de aceite por fase

- **Fase 1:** snapshot gerado para 3 tenants reais de nichos diferentes; árvore válida; payload comercial preenchido para ≥80% dos produtos ativos; fallback de catálogo ruim acionável.
- **Fase 2:** motor comercial passa nos 4 cenários básicos por nicho (termo amplo, dor, intenção, recusa de upsell); contrato de checkout respeitado por canal; dicionário traduzindo ≥10 expressões por nicho; anti-indicação bloqueando os 6 casos definidos; cupom automático só com elegibilidade validada.
- **Fase 3:** zero ocorrência de "consultei o catálogo / vou buscar / deixa eu ver"; continuação correta para "ok/eai/?".
- **Fase 4:** matriz 3×13 verde; métricas P dentro do limite por nicho.
- **Fase 5:** UI de override funcional e usada em ≥1 tenant piloto.
- **Fase 6:** observabilidade comercial mostra dor + produto + fonte vencedora em 100% dos turnos.
- **Fase 7:** taxa de handoff indevido < limite definido; respeito ao protocolo de aviso ao cliente.
- **Fase 8:** docs Layer 2 + Layer 3 + mapa-ui atualizados.

---

## Travas obrigatórias

- Não mexer na máquina F1/F2 além do necessário
- Não mexer no filtro de tools por estado
- Não mexer na política de imagem
- Não mexer em checkout/frete/cupom/fiscal além do contrato declarado no Pacote O
- Configuração do tenant tem precedência sobre base universal **mas não sobre guardrail estrutural**
- IA nunca cria desconto/benefício fora da política configurada (regra explícita da decisão #2)
- Handoff nunca finge atendente humano (regra explícita da decisão #3)
- Observabilidade tolerante a falha (se quebrar, IA continua funcionando)

---

## Documentação a produzir no fechamento

📝 DOCUMENTAÇÃO NECESSÁRIA:
- **Doc novo Layer 2:** "IA de Atendimento e Vendas — Macro" (este plano vira a base oficial)
- **Atualização Layer 3:** `docs/especificacoes/whatsapp/pipeline-f2-vendas-ia.md` (incorporar Pacotes H, I, J, M, N, O, P + decisões fechadas)
- **Atualização mapa-ui:** nova tela "Sobre o seu negócio (visão IA)" + tela "Métricas da IA de vendas" + aviso de catálogo incompleto
- **Memória de governança:** atualizar `mem://features/ai/sales-mode-conversational-commerce` apontando para o novo Layer 2

---

## Resultado final esperado

Para qualquer tenant, com ou sem configuração, com catálogo bom ou ruim, em qualquer nicho:

- **Catálogo bom →** IA atende com convicção, lista opções reais, conecta dor → produto certo, aplica cupom elegível automaticamente, respeita variantes, fecha venda no contrato de checkout do tenant.
- **Catálogo médio →** IA confirma antes de assumir, evita pergunta genérica, ainda conduz bem, usa dicionário para entender a fala do cliente.
- **Catálogo ruim →** IA não inventa contexto, conduz por descoberta pura em modo neutro, e a UI avisa o tenant para preencher manualmente.

E a árvore + mapa + payload comercial se mantêm vivos conforme o tenant cadastra/edita produtos, sem intervenção manual, sem sobrescrever override do tenant.

---

📌 **Plano v4 aprovado como versão final.** Pronto para iniciar Fase 1.
