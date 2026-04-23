

# Plano Reforçado v2 — Pipeline Básica com Contexto de Negócio (Universal + Robustez)

## 📋 Checklist de Conformidade
- Doc de Regras do Sistema: pendente leitura formal antes de executar
- Doc formal do tema (modo vendas WhatsApp): existe — será atualizado
- Fluxo afetado: atendimento e venda da IA no WhatsApp
- Fonte de verdade: catálogo do tenant (primária) + configuração da IA (override)
- Módulos impactados: Modo Vendas IA, Configuração da IA, Pipeline F2, Catálogo
- UI impactada: sim → mapa-ui.md atualizado na Fase 4
- 📌 Status: Proposta v2 — aguardando confirmação

---

## Onde concordo 100% com os 5 refinamentos

Os 5 pontos da crítica estão certos e entram no plano. Não tenho discordância nessa rodada — todos cobrem riscos reais que eu não tinha tornado explícitos.

## Como cada refinamento entra no plano

### Refinamento 1 — Nível de confiança da inferência
A IA classifica cada nível da árvore inferida como **alta**, **média** ou **baixa** confiança:
- **Alta:** quando há sinal forte e consistente (ex.: 80% dos produtos têm a palavra "shampoo" + categoria "cabelo")
- **Média:** sinal parcial (ex.: poucos produtos, mas convergem)
- **Baixa:** sinal fraco ou ambíguo (ex.: catálogo misto sem categoria clara)

Uso prático na conversa:
- Alta → IA fala com convicção ("temos estes shampoos")
- Média → IA confirma antes ("você está procurando algo de cabelo, é isso?")
- Baixa → IA pergunta abertamente sem fingir saber ("me conta o que você procura que eu te ajudo")

Nunca finge certeza que não tem.

### Refinamento 2 — Fallback para catálogo ruim
Se a inferência automática não conseguir montar a árvore (catálogo com nomes vagos, descrições vazias, categorias bagunçadas), o sistema:
1. Marca o tenant como "contexto incompleto"
2. A IA opera em **modo neutro**: sem assumir segmento/público, conduz a conversa por descoberta pura ("o que você procura?")
3. Mostra um aviso na UI da configuração da IA: "Não conseguimos entender bem seu catálogo automaticamente. Preencha manualmente para a IA atender melhor." → leva direto pra UI de override (Pacote E)
4. Continua funcionando, só sem a vantagem da árvore. Nunca quebra.

### Refinamento 3 — Produto pode resolver mais de uma dor
A estrutura do mapa produto ↔ dor passa a ser **N:N** (muitos para muitos), não 1:1:
- Um produto pode estar vinculado a várias dores (shampoo para queda + oleosidade)
- Uma dor pode ter vários produtos compatíveis
- Cada vínculo tem um "peso" (dor principal vs. dor secundária)

Quando o cliente descreve múltiplas dores ("queda e caspa"), a IA prioriza produtos que resolvem **as duas**, depois os que resolvem só a principal.

### Refinamento 4 — Critérios de aceite por arquétipo
Cada um dos 3 arquétipos (beleza, moda, eletrônico) só passa na validação se atender **todos** os critérios abaixo:

- **Termo amplo:** ao receber "shampoo" / "tênis" / "fone", a IA lista opções reais agrupadas por dor/uso. **Não** pergunta faixa de preço/tamanho de cara.
- **Dor descrita:** ao receber a dor, a IA conecta ao produto certo do catálogo (não a uma categoria genérica).
- **Intenção de compra:** a IA oferece **uma** alternativa de upsell (kit/combo/3 unidades), uma única vez, e respeita a recusa.
- **Fechamento:** a IA conduz coleta de dados, valida cupom/frete, mostra total e envia link sem fricção.
- **Linguagem:** zero ocorrências de "consultei o catálogo", "deixa eu ver", "vou buscar" ou similar.
- **Continuidade:** mensagem curta de retomada ("ok", "?", "eai") ou refinamento longo dentro do TTL é entendida como continuação, não como conversa nova.

Se qualquer critério falhar em qualquer arquétipo, a fase não fecha.

### Refinamento 5 — Atualização do contexto quando o catálogo mudar
A árvore e o mapa produto↔dor são **regenerados automaticamente** quando:
- Produto novo é cadastrado
- Produto existente é editado (nome, descrição, categoria, tags)
- Produto é arquivado/excluído
- Categoria nova é criada

A regeneração é incremental (só recalcula o que mudou) e roda em background. Se a regeneração falhar, o contexto antigo continua valendo (nunca deixa a IA sem contexto). Há também uma regeneração completa diária por segurança.

A configuração manual do tenant (UI de override) **não** é sobrescrita pela regeneração — overrides são preservados.

---

## Pacotes consolidados (com os 5 refinamentos integrados)

- **Pacote A — Contexto automático do negócio** (com nível de confiança alta/média/baixa)
- **Pacote B — Árvore real de contexto** (negócio → público → macrocategoria → subcategoria → tipo → dor → produtos)
- **Pacote C — Mapa produto ↔ dor N:N** (um produto pode resolver várias dores, cada vínculo com peso)
- **Pacote D — Pipeline comportamental universal** (4 regras: termo amplo, dor→produto, upsell único, linguagem limpa)
- **Pacote E — UI de override** (visualizar inferência, corrigir cada nível, ajustar vínculos manualmente)
- **Pacote F — Validação multi-arquétipo** (beleza + moda + eletrônico, com critérios de aceite explícitos)
- **Pacote G — Robustez** (fallback de catálogo ruim + regeneração automática quando catálogo muda)

## Travas obrigatórias (mantidas)
- Não mexer na máquina de transição F1/F2
- Não mexer no filtro de tools por estado
- Não mexer na política de imagem
- Não mexer em checkout/frete/cupom/fiscal
- Configuração do tenant tem precedência sobre a base universal
- Observabilidade tolerante a falha (se inferência ou regeneração quebrar, IA continua funcionando)

## Rollout (mantido, com Pacote G distribuído nas fases certas)

1. **Fase 1 — Inferência automática + Robustez base** (Pacotes A + B + C + parte do G: fallback de catálogo ruim). Comportamento da IA passa a usar contexto inferido com nível de confiança. Sem UI ainda.
2. **Fase 2 — Pipeline comportamental** (Pacote D). Ajuste dos prompts pra usar árvore + mapa + linguagem limpa + N:N.
3. **Fase 3 — Validação multi-arquétipo** (Pacote F). Rodar critérios de aceite em beleza + moda + eletrônico. Só avança se os 3 passarem.
4. **Fase 4 — UI de override + Regeneração automática** (Pacote E + parte restante do G). Tela de ajuste fino + recálculo automático quando catálogo muda.
5. **Fase 5 — Documentação.** Atualizar doc do modo vendas + mapa-ui + memória.

## Resultado final esperado

Para qualquer tenant, **com ou sem configuração**, **com catálogo bom ou ruim**:
- Catálogo bom → IA atende com convicção, lista opções reais, conecta dor → produto certo, fecha venda.
- Catálogo médio → IA confirma antes de assumir, evita pergunta genérica, ainda conduz bem.
- Catálogo ruim → IA não inventa contexto, conduz por descoberta pura, e a UI avisa o tenant pra preencher manualmente.

E a árvore se mantém viva conforme o tenant cadastra/edita produtos, sem intervenção manual.

## Documentação necessária
📝 Ao final do rollout:
- Doc do modo vendas WhatsApp → adicionar "Inferência automática", "Árvore de negócio", "Mapa produto ↔ dor N:N", "Níveis de confiança", "Fallback de catálogo ruim", "Regeneração automática"
- mapa-ui.md → registrar tela "Sobre o seu negócio" + aviso de catálogo incompleto (Fase 4)
- Memória do modo vendas → atualizar com a base universal v2

## Status
📌 **Proposta v2 — aguardando confirmação para iniciar pela Fase 1**

