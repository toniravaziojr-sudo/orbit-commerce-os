# Onda H.4.5 — Copy contextualizada + feedback visível no passo Anúncios

## Por que a IA escreveu copy de "guarda-roupa" para um shampoo

O gerador de textos do passo Anúncios manda para a IA praticamente só o nome do produto. Fica de fora:

1. **A descrição real do produto** (hoje só é buscada para a imagem).
2. **A camada de funil e o público do anúncio** — o caso do print é "LAL 1% Compra | TOF | Shampoo Calvície Zero", ou seja **público frio**. Para frio, "não perca nossas promoções / compre o seu agora" queima a campanha. A etapa do funil e o tipo de público nunca chegam no prompt.
3. **A estratégia e a promessa da campanha** (objetivo, ângulo, hipótese) — existem no rascunho da proposta mas não entram no briefing.
4. **A voz da marca** (nome da loja, tom, categoria do negócio, persona).
5. **Travas anti-alucinação** — sem regra explícita para não inventar oferta/desconto/garantia e não usar vocabulário de outro nicho (moda, guarda-roupa, etc.).

Resultado: a IA cai em molde genérico e escreve copy de outro segmento.

## O que vou ajustar

### 1. Briefing enriquecido na geração e regeneração de textos

Antes de chamar o modelo, monto um briefing único com:

- **Produto:** nome, descrição real, preço e categoria (busca no cadastro).
- **Funil e público:** lê o conjunto vinculado ao anúncio e extrai etapa (frio/morno/quente), tipo de público (Lookalike, Interesse, Retargeting, Advantage+) e objetivo da campanha.
- **Promessa, ângulo e formato** do criativo planejado.
- **Voz da marca:** nome da loja, tom e categoria do negócio.
- **Aprendizados recentes** de copy daquela loja (últimos correções) para não repetir erros já apontados.

E reescrevo as instruções do modelo com regras por etapa:

- **Frio (topo):** dor/desejo/curiosidade, sem "promoção/desconto/compre agora", CTA de descoberta.
- **Morno (meio):** prova, comparação, benefício específico, urgência leve.
- **Quente/Retargeting (fundo):** oferta direta, urgência, fechamento.

Mais travas duras:
- Proibido inventar desconto, frete grátis, garantia, prazo ou claim regulado que não esteja na descrição.
- Proibido usar vocabulário de outro nicho — a copy precisa encostar no produto real (nome, categoria, benefício declarado).
- Proibido frases-clichê ("ofertas exclusivas hoje", "renove seu guarda-roupa", "qualidade e preço justo").

A mesma base de briefing alimenta a regeneração de campo único (título, texto principal, descrição), preservando o feedback do lojista como instrução de maior prioridade.

### 2. Feedback de regeneração sempre visível

Hoje o lojista clica em "Regerar com IA" e só então aparece o campo de feedback — fica escondido. Vou:

- Trocar o botão "Regerar com IA" por um bloco compacto sempre visível em cada campo: rótulo "Ajustar este texto" + textarea + botão "Regenerar com este feedback" (desabilitado até 5 caracteres).
- Aviso curto explicando que esse feedback é usado para o aprendizado da IA daquela loja (já é, hoje vira aprendizado registrado).
- Mesma mudança no bloco de imagem: quando já existe imagem, o campo de feedback fica visível direto, igual ao padrão.

Isso é resposta direta ao pedido do usuário ("precisa ter como o usuário dar o feedback dela pra ajustar o aprendizado da IA"), então sigo sem nova consulta — sem mexer em mais nada da UI do wizard.

### 3. Documentação e memória

- Atualizar a memória da Onda H.4.4 incluindo as regras novas de contexto + travas anti-alucinação (vira H.4.5).
- Atualizar o doc do Gestor de Tráfego na seção do passo Anúncios para refletir o briefing enriquecido e o feedback visível.
- Sem impacto em mapa-ui.md (não muda rota nem sidebar).

## Validação técnica que vou rodar antes de fechar

- Disparar `generate_copy` numa proposta real do tenant Respeite o Homem e conferir que: a copy cita o produto correto, respeita o estágio frio (sem "compre agora"), e não usa termos de outro nicho.
- Disparar `regen_copy_field` em "texto principal" com feedback "mais focado no benefício de combater queda" e conferir que o novo texto incorpora o feedback e gera registro de aprendizado.
- Conferir nos logs que o briefing enviado contém produto + funil + voz da marca.

Se algum desses pontos falhar, volto para diagnóstico antes de declarar entrega.

## Detalhes técnicos (opcional)

- Edge `ads-creative-inline-generate`: nova função interna `buildBriefing(propData, adIndex, supabase)` que junta `products` (description/price/category), `propData.adsets[ad.adset_index]` (funnel_stage/audience_type), `propData.campaign` (objective), `tenant_brand_context`/`ai_support_config` (voz) e top 3 `ads_ai_learnings` ativos `creative_copy_feedback`. Prompt do sistema reescrito com guia por etapa + lista de proibições. Contrato de resposta inalterado (`headline`/`primary_text`/`description`).
- `AdCreativeAIPanel.tsx`: remover `openField`/toggle; cada campo passa a renderizar textarea + botão de regenerar direto. Sem nova action no backend — reaproveita `regen_copy_field` que já recebe feedback obrigatório.
- `AdImageAIControls`: igual, textarea sempre visível quando `hasImage`.
- Confirmação de custo da sessão (sessionStorage) preservada.
- Sem alteração em etapas 1, 2, 3 e 5 do wizard.
