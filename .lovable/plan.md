## Princípio que guia tudo

**O agente é um vendedor e atendente universal.** Ele não sabe "falar cosmético", "falar pet" ou "falar moda" — ele sabe **ler a loja em que está plugado** (catálogo, marca, políticas, tom de voz) e atender qualquer cliente em qualquer segmento. As personalizações que o lojista faz são **tempero** sobre uma base que já entende, atende e vende bem sozinha.

Tudo que for "lista de palavras travadas no código por segmento" sai. Não fica como rede de segurança, não fica comentado, não fica atrás de flag — sai de vez. Manter isso só atrasaria o aprendizado e poluiria a pipeline daqui pra frente.

---

## O que vai mudar na pipeline base

A base passa a depender só de coisas universais:

1. **Classificador de turno** (intenção do cliente: saudação, dor/necessidade, pergunta de produto, pergunta de preço, pergunta de frete, pós-venda, reclamação real).
2. **Detecção de família a partir do catálogo da loja** — a IA descobre quais "famílias" existem lendo o catálogo do tenant, não uma lista no código.
3. **Sondagem de catálogo** que, quando o cliente expressa dor/necessidade, traz um representante de cada família relevante daquele tenant (sem filtro estrito por uma família só).
4. **Reflexos determinísticos universais** que já existem (CEP, frete, pós-venda, turno curto com intenção) — esses são genéricos por natureza, ficam.
5. **Gates de saída universais** (não vazar preço/frete em saudação, espelhar período do dia, usar nome do cliente recorrente, não resetar thread ativa) — também genéricos, ficam.

Sai do código:
- Listas de sintomas por segmento (cabelo, pele, barba, etc.).
- Listas de famílias enumeradas no código (shampoo, balm, loção, etc.) — viram leitura do catálogo do tenant.
- Aliases comerciais hardcoded por vertical.
- Qualquer "se for cosmético, faça X" implícito.

Fica do código:
- Sinais universais de pós-venda ("meu pedido", "rastreio", "não chegou", "reembolso", "garantia") — esses são iguais em qualquer e-commerce.
- Mecânica do classificador, dos reflexos, dos gates, da máquina de estados, da anti-repetição.

---

## Como vamos executar

### Fase 1 — Implementar a base universal (entrega única)

- Remover do código todas as listas de vocabulário por segmento.
- Trocar a detecção de família por leitura do catálogo do tenant (categorias + nome/descrição dos produtos), com cache leve por tenant.
- Ajustar a sondagem de catálogo para operar a partir das famílias descobertas no tenant atual, não de uma lista fixa.
- Ligar as 4 chaves universais como **padrão**, sem flag de tenant. A pipeline base passa a ser essa.
- Atualizar os documentos formais da IA de atendimento (changelog, motor de contexto comercial, modo vendas) refletindo a nova base.

Sem rede de segurança legada. Se algo quebrar, a gente vê na bateria de testes e corrige na causa, não com remendo segmentado.

### Fase 2 — Bateria de testes em ondas

Para não estourar limite de uso de IA, divido as conversas de teste em **ondas pequenas e temáticas**. Cada onda roda, descansa, e o resultado é documentado.

Proposta de ondas (cada onda ≈ 6 a 10 conversas, espaçadas):

- **Onda 1 — Saudação e abertura** (puro "oi", "boa noite", saudação no meio de thread, cliente recorrente vs novo).
- **Onda 2 — Dor e necessidade sem citar produto** ("tô careca", "meu cachorro não come", "preciso de algo pra dormir", "minha pele coça") — em segmentos diferentes.
- **Onda 3 — Pergunta direta de produto / família** ("vocês têm shampoo?", "tem ração úmida?", "tem tênis 42?").
- **Onda 4 — Troca de família no meio da conversa** (começa em uma categoria, muda para outra).
- **Onda 5 — Preço, frete e CEP** (pergunta de preço, pergunta de frete sem CEP, CEP isolado, CEP + carrinho).
- **Onda 6 — Pós-venda real** ("meu pedido não chegou", "quero rastrear", "produto veio com defeito").
- **Onda 7 — Reclamação que NÃO é pós-venda** (cliente irritado pedindo solução de produto — a IA tem que continuar vendendo, não escalar).
- **Onda 8 — Turnos curtos e ambíguos** ("?", "e aí", "manda aí", "sim").
- **Onda 9 — Multi-segmento** (rodar uma conversa-tipo de cada onda anterior em lojas fictícias de pet, moda e suplemento, para provar universalidade).
- **Onda 10 — Fechamento** (cliente decide comprar, pede link, pergunta forma de pagamento, finaliza).

Cada conversa de teste será simulada de ponta a ponta no Respeite o Homem (e nas lojas fictícias na Onda 9), com o cenário, o que esperávamos e o que aconteceu de fato.

### Fase 3 — Documentação onda a onda

Vou manter um documento temporário só desse tema — uma seção por onda — registrando:

- Cenário e mensagem do cliente.
- Resposta da IA.
- O que estava certo.
- O que estava errado (e qual hipótese de causa, em linguagem clara).
- Sinais cruzados (estado da conversa, intenção classificada, família detectada, reflexo acionado).

Sem propor correção ainda. O objetivo da Fase 3 é **mapear honestamente o estado real da base universal**.

### Fase 4 — Análise consolidada e plano de ajuste

Quando todas as ondas estiverem rodadas e documentadas, analiso o conjunto e te trago **um plano de correção único**, agrupando os problemas por causa raiz (não por sintoma). Você decide o que entra na próxima rodada de implementação. Aí ciclamos: implementa → bateria de novo → documenta → ajusta — até a base estar 100%.

---

## Critérios para considerar a base "100%"

- Funciona igual de bem em conversas de cosmético, pet, moda e suplemento (lojas fictícias).
- Não depende de nenhuma palavra-chave de segmento no código.
- Passa nas 10 ondas de teste sem fallback genérico em cenários onde a intenção foi corretamente classificada.
- Não regrediu em nada que hoje funciona no Respeite o Homem.
- Documentos formais atualizados refletindo a nova base.

---

## O que está fora deste plano

- Personalizações do lojista (tom, vocabulário próprio, regras custom) — entram **depois** que a base estiver 100%, exatamente como tempero. Hoje a maior parte disso já existe na configuração da IA; só vamos garantir que continuam respeitando precedência sobre a base.
- Outros agentes da IA (criativos, landing, conteúdo).
- Qualquer trabalho em outros tenants antes da base passar nas 10 ondas.

---

## O que eu preciso de você para começar

Uma confirmação: **"sim, implementa a base universal sem legado e depois roda as ondas"**.

Com o ok, sigo para a Fase 1 (implementação) e te aviso quando estiver pronto para começar a Onda 1 da bateria.