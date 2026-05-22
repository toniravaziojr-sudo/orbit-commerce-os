# Plano — Consolidação da Pipeline de Vendas IA (Reg #2.17)

## Diagnóstico (resumo executivo)

A pipeline tem 6 camadas funcionais, mas existem sobreposições onde duas peças decidem a mesma coisa sem se conversar. Itens encontrados:

1. **Leitura do turno em duplicidade.** O classificador inteligente (TPR) e ~7 detectores baseados em regex rodam em paralelo. O TPR já entrega tudo o que os detectores deduzem; os detectores deveriam ser apenas rede de segurança.
2. **Duas máquinas de fase comercial.** Uma decide o estado (greeting/discovery/recommendation/...), outra decide o estágio (social_only/exploring/...). A segunda está em modo observação desde abr/26 — vocabulários diferentes para a mesma coisa.
3. **Memória da conversa em dois lugares.** Tabela dedicada (correta) + coluna legada na tabela de conversas.
4. **Saudação com 4 caminhos** (atalho rápido, gate via TPR, gate fallback, scrub legado) — origem das regressões de “Olá” no meio da thread.
5. **3 gates anti-loop de fechamento** que convergem para o mesmo efeito (regenerar com tool forçada). Podem virar 1 motor com 3 sub-regras.
6. **Núcleo de reposicionamento espalhado.** Reg #19 (proativo), Reg #17 (reciprocidade), mudança de família, recusa — cada um vive num lugar.

## O que muda para o cliente final
**Nada.** Esta é uma reorganização interna para a IA respeitar um caminho lógico único e ter reflexos bem mapeados quando o cliente desvia.

## Fases (todas com flag por loja, reversíveis)

### Fase 1 — Unificar a leitura do turno *(esta entrega)*
- TPR vira fonte primária; regex vira rede de fallback (só roda se TPR caiu).
- Quem decide a transição passa a ler o resultado do TPR diretamente, em vez de re-classificar via regex.
- Log de comparação para medir divergência TPR × regex no primeiro período.
- Sem mudança em prompt, tool-filter, working memory ou gates de saída.

### Fase 2 — Unificar a fase comercial
- Estágio comercial vira fonte de verdade; o estado da pipeline passa a ser projeção derivada.
- Componentes legados continuam consumindo o nome antigo via tradução automática.

### Fase 3 — Núcleo único de reflexos comerciais
- Quatro reflexos nomeados: desvio de família, reciprocidade, proatividade, recusa.
- Cada um com gatilho, pré-condição, ação e trava anti-loop.
- Alimentam blocos contextuais que o roteador de prompt já consome.

### Fase 4 — Consolidar gates de saída
- Os três gates anti-loop de fechamento viram 1 motor com 3 sub-regras nomeadas.
- Saudação: o atalho rápido passa a respeitar o resultado do TPR; detectores duplicados saem do caminho ativo.

## Validação por fase
- Logs com prefixo único permitem comparar antes/depois.
- Bateria de 12 cenários (4 ondas A/B/C/D) roda antes e depois.
- Reversão = desligar a flag.

## Documentação
- Cada fase adiciona um registro novo (Reg #2.17 A–D) no changelog da IA de atendimento.
- Memórias de governança da pipeline atualizadas ao final de cada fase.
