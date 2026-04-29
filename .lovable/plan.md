
# Plano — Documento Especial "IA de Atendimento — Histórico, Diagnóstico e Correções"

## Por que criar esse doc

Hoje o tema "IA de atendimento" está espalhado em 4 arquivos (`modo-vendas-whatsapp.md`, `pipeline-f2-vendas-ia.md`, `validacao-modo-vendas-whatsapp.md`, `crm-atendimento.md`) — todos são **especificações** (como deve funcionar). Não existe um lugar único onde fique registrado, em ordem cronológica:

- O que foi observado em conversas reais (sintomas).
- Qual a causa raiz identificada.
- Qual a correção aplicada e quando.
- Como a IA estava se comportando antes vs depois.

Esse padrão já existe e funciona muito bem para o **Meta Pixel/CAPI** (`docs/meta-tracking-changelog.md`) — vamos replicar a mesma estrutura para a IA de atendimento.

## Onde o doc vai morar

`docs/especificacoes/whatsapp/ia-atendimento-changelog.md`

Fica ao lado dos outros docs da IA de WhatsApp, mas tem uma função diferente: é histórico vivo, não especificação.

## Estrutura do documento (replicando o padrão do Meta)

1. **Cabeçalho** — propósito, escopo, como ler, regra de não-regressão.
2. **Mapa de qualidade atual** — tabela viva com os principais sintomas comportamentais sendo monitorados (saudação espelhada, respeito a pergunta direta, troca de produto sem aviso, repetição de confirmação, link com domínio próprio, carrinho hidratado etc.) com status atual de cada um.
3. **Registros cronológicos** — um bloco por rodada de ajuste, no formato:
   - **Data**
   - **Conversa de origem / cliente reportado** (id da conversa quando houver)
   - **Sintomas observados** (lista objetiva)
   - **Diagnóstico técnico** (causa raiz, sem jargão pesado no corpo, com bloco técnico opcional)
   - **Correção aplicada** (o que mudou no fluxo, em linguagem de negócio)
   - **Validação** (o que foi testado e como)
   - **Anti-regressão** (memória criada, regra adicionada ao prompt, scrubber criado)
4. **Glossário curto** — pipeline, estado, scrubber, foco de produto, modo vendas, modo informativo, janela 24h.
5. **Onde está cada coisa** — mapa rápido apontando pra: spec do modo vendas, pipeline F2, validação E2E, CRM atendimento.

## Conteúdo que entra na primeira versão (já temos hoje)

### Bloco "Mapa de qualidade atual"
Status inicial dos comportamentos críticos, marcando o que já está coberto e o que está em correção neste ciclo (saudação espelhada ⚠️, preço sob demanda ❌, link com domínio próprio ❌, carrinho hidratado ❌, anti-troca silenciosa de produto ⚠️, anti-loop de confirmação ✅, imagem na 1ª apresentação ⚠️, honrar pergunta direta ⚠️).

### Registro #1 — Histórico retroativo (consolida o que já existe nas memórias)
Resumo das correções já aplicadas em ciclos anteriores e que viraram memória anti-regressão:
- Trava de troca de produto após confirmação (`PRODUCT_LOCK_MISMATCH`).
- Anti-loop "posso finalizar?" → handoff forçado.
- Scrubber de invenção de ações ("já encaminhei para o suporte" sem tool).
- Anti-repetição por hash de prefixo.
- Pipeline F2 com 8 estados e máquina de transição.
- Modo vendas com 15 tools (incl. envio de imagem, janela 24h).

### Registro #2 — Conversa do cliente das 14:14 (caso atual, em correção)
Conversa real `97b54ad3-f2d7-4771-a1d7-6c651bc9b512` no tenant Respeite o Homem.

**Sintomas observados (7 itens):**
1. Saudação não espelhada ("Boa tarde" → "Olá").
2. Pergunta consultiva ignorada ("qual seria o tratamento?" + foto → IA pulou para listar shampoo).
3. Preço apresentado sem o cliente perguntar.
4. Loop de confirmação ("deixo separado pra você" 2 turnos seguidos).
5. Troca silenciosa de produto: ofertou Shampoo + Loção (R$ 184,21 em 2 itens) → adicionou Kit consolidado de R$ 138,46 sem avisar.
6. Link de checkout caiu no domínio padrão da plataforma, não no domínio próprio da loja.
7. Link aberto pelo cliente: carrinho **vazio** na storefront.

**Causas raiz identificadas:**
- (item 6) Geração de link consulta tabela inexistente `custom_domains`; tabela correta é `tenant_domains`.
- (item 7) A hidratação do carrinho via `?link=` só roda dentro do wizard de checkout, que só monta se o carrinho não estiver vazio. Race lógica: empty-state ganha do hidratador.
- (itens 3 e 5) Prompts de recommendation/product-detail incentivam a IA a contar preço já na 1ª apresentação; trava existente de produto não cobre "conjunto ofertado".
- (item 1) Regra de espelhar saudação está só no prompt, sem reforço no servidor.
- (item 2) Não há regra explícita "honrar pergunta consultiva antes de listar".
- (item 4) Detector de repetição funciona por hash exato e não pega variação semântica.

**Correções planejadas neste ciclo** (ainda não aplicadas — depende do plano técnico aprovado no turno anterior):
- Bloco 1: trocar fonte do domínio para `tenant_domains` no `ai-support-chat`.
- Bloco 2: mover hidratação do `useCheckoutLinkLoader` para o nível da página de carrinho e mostrar loading antes do empty-state.
- Bloco 3.1: regra global "preço sob demanda" nos prompts de discovery/recommendation/product-detail.
- Bloco 3.2: novo invariante `OFFERED_BUNDLE_LOCK` no `add_to_cart`.
- Bloco 3.3: scrubber de saudação espelhada no servidor.
- Bloco 3.4: anti-repetição por família semântica.
- Bloco 3.5: imagem obrigatória na 1ª apresentação em product_detail.
- Bloco 3.6: regra "honrar pergunta consultiva" antes de listar produto.

**Status do registro:** Diagnóstico concluído. Correção em fase de aplicação. Validação pendente.

## Integração com governança

- Atualizar `docs/especificacoes/transversais/mapa-ui.md` com a referência ao novo doc na seção de WhatsApp/IA.
- Adicionar entrada no `mem://index.md` apontando para o novo doc como fonte de verdade do histórico de qualidade da IA de atendimento.
- Toda correção futura na IA de atendimento (qualquer prompt, scrubber, tool, regra de transição) passa a exigir um novo registro neste doc — incluído nos checklists de fechamento.

## O que **não** vai pra esse doc

- Especificação de como o pipeline funciona → continua em `pipeline-f2-vendas-ia.md`.
- Lista de tools e contratos → continua em `modo-vendas-whatsapp.md`.
- Roteiros de validação E2E → continuam em `validacao-modo-vendas-whatsapp.md`.
- Regras gerais de atendimento (humano + IA, filas, SLAs) → continuam em `crm-atendimento.md`.

Esse doc é **só o histórico vivo de qualidade e correções** — espelho exato do que `meta-tracking-changelog.md` faz para o Pixel/CAPI.

## Entregáveis

1. Criar `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` com a estrutura acima e os 2 registros iniciais já preenchidos.
2. Adicionar referência cruzada nos 4 docs existentes da IA (1 linha cada, no topo: "Histórico de correções: ver ia-atendimento-changelog.md").
3. Atualizar `mapa-ui.md` (linha de referência).
4. Indexar no `mem://index.md` como referência de governança.

## Próximo passo

Confirma que eu crio o doc com essa estrutura e os 2 registros iniciais já preenchidos? Em seguida sigo com a aplicação dos Blocos 1–4 do plano técnico anterior, e cada bloco vira um novo registro neste doc à medida que for aplicado e validado.
