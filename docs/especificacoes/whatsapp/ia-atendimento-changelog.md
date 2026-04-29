# IA de Atendimento — Histórico de Diagnósticos e Correções

> **Histórico vivo de qualidade da IA de atendimento (modos informativo e vendas).**
> Mesmo padrão do `docs/meta-tracking-changelog.md` (Pixel/CAPI).
> Não substitui as especificações — registra o que aconteceu, por quê, o que foi corrigido e o que ficou de regra anti-regressão.

---

## Como ler este documento

- **Mapa de qualidade atual** — fotografia dos comportamentos críticos sob monitoramento.
- **Registros cronológicos** — um bloco por rodada de ajuste, na ordem cronológica decrescente (mais novo no topo a partir do registro #2).
- **Regra de não-regressão** — toda correção que tenha potencial de reaparecer vira memória em `mem://constraints/*` e fica linkada no registro.

## Especificações relacionadas (fontes de verdade do "como funciona")

- **Modo Vendas (tools, contratos, janelas):** `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md`
- **Pipeline F2 (8 estados, transições, prompts por estado):** `docs/especificacoes/whatsapp/pipeline-f2-vendas-ia.md`
- **Validação E2E do Modo Vendas:** `docs/especificacoes/whatsapp/validacao-modo-vendas-whatsapp.md`
- **CRM/Atendimento (filas, SLAs, humano + IA):** `docs/especificacoes/crm/crm-atendimento.md`
- **Recepção Meta WhatsApp (webhook, conformidade 24h):** `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md`

## Glossário curto

- **Pipeline F2** — máquina de 8 estados que decide o "momento da conversa" (saudação, descoberta, recomendação, detalhe de produto, decisão, fechamento, suporte, handoff).
- **Estado** — nó da pipeline. Cada estado tem prompt próprio, conjunto restrito de tools e parâmetros (temperatura, max tokens).
- **Foco de produto** — produto que está sendo discutido na conversa. Persistido entre turnos para evitar troca silenciosa.
- **Scrubber** — última camada do servidor: pega a resposta da IA e regrava/bloqueia se violar uma regra dura (ex.: prometer ação sem chamar tool).
- **Modo vendas** — toggle por tenant que ativa o vendedor consultivo (15 tools de catálogo/carrinho/checkout/imagem).
- **Modo informativo** — modo padrão (sem vendas). Foco em resposta a dúvidas e handoff.
- **Janela 24h** — regra Meta: mensagem livre só pode sair se o cliente respondeu nas últimas 24h. Fora da janela, só template aprovado.
- **PRODUCT_LOCK_MISMATCH** — bloqueio do servidor quando a IA tenta colocar no carrinho um produto diferente do produto em foco sem sinal explícito de troca do cliente.

---

## Mapa de qualidade atual — abr/2026

| Comportamento | Status | Mecanismo de defesa | Última verificação |
|---|---|---|---|
| Não inventar ação executada ("já encaminhei…") | ✅ Coberto | Scrubber `unsupported_action_promised` | Reg. #1 |
| Não trocar produto após confirmação | ✅ Coberto | `PRODUCT_LOCK_MISMATCH` + resolver com `focusProductId` | Reg. #1 |
| Não pedir nova confirmação após "sim/manda" | ✅ Coberto | FIX-B `tool_choice` forçado + scrubber `confirmation_loop_detected` | Reg. #1 |
| Não repetir a mesma frase/intenção | ⚠️ Parcial | Hash de prefixo (não pega família semântica) | Reg. #2 |
| Não citar preço sem o cliente perguntar | ❌ Sem defesa | — | Reg. #2 |
| Não trocar conjunto ofertado por kit consolidado | ⚠️ Parcial | Trava cobre item único, não conjunto | Reg. #2 |
| Espelhar saudação ("boa tarde" → "boa tarde") | ⚠️ Só prompt | Sem reforço no servidor | Reg. #2 |
| Honrar pergunta consultiva antes de listar produto | ⚠️ Só prompt | Sem regra dura | Reg. #2 |
| Enviar imagem na 1ª apresentação real do produto | ⚠️ Opcional | Existe a tool, não é obrigatória | Reg. #2 |
| Link de checkout no domínio próprio da loja | ❌ Quebrado | Consulta tabela inexistente | Reg. #2 |
| Carrinho hidratado ao abrir o link enviado | ❌ Quebrado | Hidratador rodava depois do empty-state | Reg. #2 |
| Filtro estrito por família no `search_products` | ✅ Coberto | `family_focus` persistente | mem://features/ai/sales-pipeline-anti-repetition-and-family-focus |
| Janela Meta 24h (mensagem livre + imagem) | ✅ Coberto | `meta-whatsapp-send` valida antes de enviar | Reg. #1 |

Legenda: ✅ coberto · ⚠️ parcial · ❌ sem defesa / quebrado

---

## Registro #1 — Histórico retroativo (consolidado, ciclos anteriores)

**Período coberto:** desde a estreia do Modo Vendas até abr/2026.
**Origem:** consolidação das memórias `mem://constraints/*` e `mem://features/ai/*` que já tratavam de IA de atendimento.

### Correções já aplicadas e ativas

| # | Problema observado | Correção | Onde mora |
|---|---|---|---|
| 1.1 | IA dizia "já encaminhei pro suporte" sem ter chamado tool de handoff | Scrubber `unsupported_action_promised` reescreve a resposta e força handoff real | `ai-support-chat/index.ts` (FIX-D) · `mem://constraints/ai-action-invention-scrubber` |
| 1.2 | IA confirmava produto X e adicionava produto Y no carrinho | Bloqueio `PRODUCT_LOCK_MISMATCH` no `add_to_cart` + resolver com `focusProductId` e quantificador (1x/2x/3x/6x) | `ai-support-chat/index.ts` + `_shared/sales-pipeline/product-resolver.ts` · `mem://constraints/ai-must-not-swap-confirmed-product` |
| 1.3 | Loop infinito "posso finalizar pra você?" mesmo após o cliente dizer "sim, manda" | FIX-B força `tool_choice=generate_checkout_link` em `checkout_assist`; rede de segurança força handoff comercial | `ai-support-chat/index.ts` (Eixo 1.7) · `mem://constraints/ai-sales-must-close-on-confirmed-intent` |
| 1.4 | IA repetia a mesma resposta em turnos consecutivos | Anti-repetição por hash de prefixo (regeneração obrigatória) | `mem://constraints/ai-response-anti-repetition-prefix-hash` |
| 1.5 | Erro técnico de SQL (`products.images` inexistente) levava a handoff indevido | 6 SELECTs migrados para `product_images` (subquery por `is_primary`/`sort_order`) | `mem://features/ai/sales-mode-conversational-commerce` |
| 1.6 | IA negava produto sem ter consultado o catálogo | Regra dura: chamar `search_products` antes de afirmar inexistência | `mem://constraints/ai-must-search-catalog-before-denying-product` |
| 1.7 | IA caía em handoff ao receber mensagem ambígua / vazia | Detector de input ambíguo pré-modelo | `mem://constraints/ambiguous-input-pre-model-detector` |
| 1.8 | Pipeline em loop por reabrir vitrine de produtos sem foco | Máquina de estados F2 (8 nós) + `family_focus` persistente | `pipeline-f2-vendas-ia.md` · `mem://features/ai/sales-pipeline-anti-repetition-and-family-focus` |
| 1.9 | Mensagem livre/imagem fora da janela Meta 24h | Bloqueio em `meta-whatsapp-send`; só template aprovado fora da janela | `mem://features/ai/sales-mode-conversational-commerce` |
| 1.10 | Mensagens humanas não retroalimentavam o aprendizado da IA | Captura `learning_event` também para mensagens de agente humano | `mem://constraints/ai-human-agent-messages-feed-ai-learning` |

**Status do registro:** ✅ Todas as correções acima estão em produção e cobertas por memória anti-regressão.

---

## Registro #2 — Conversa Respeite o Homem, 14:14 BRT (em correção)

**Data do diagnóstico:** 29/abr/2026
**Tenant:** Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`)
**Conversa:** `97b54ad3-f2d7-4771-a1d7-6c651bc9b512`
**Canal:** WhatsApp
**Modo da IA:** Vendas
**Reportado por:** dono da loja, simulando cliente interessado em comprar.

### Sintomas observados

1. **Saudação não espelhada.** Cliente abriu com "Boa tarde" + descrição do caso e foto. IA respondeu "Olá, tudo bem?" — perdeu reciprocidade.
2. **Pergunta consultiva ignorada.** Cliente perguntou explicitamente *"qual seria o tratamento mais indicado pra mim?"*. IA pulou direto para listar dois shampoos, sem acolher o caso nem fazer 1 pergunta de qualificação.
3. **Preço apresentado sem ser perguntado.** Já no 1º turno de produto a IA cravou "custa R$ 93,01" sem o cliente ter pedido valor.
4. **Loop de confirmação.** "Deixo separado pra você?" repetido em dois turnos seguidos com leve variação de palavra. O hash exato do anti-repetição não pegou.
5. **Troca silenciosa de produto.** IA ofertou Shampoo + Loção (R$ 184,21 em 2 itens). Quando o cliente confirmou o fechamento, ela adicionou no carrinho um *Kit Banho Calvície Zero Noite* consolidado de R$ 138,46 — produto diferente, valor diferente, sem avisar.
6. **Domínio errado no link.** O link gerado caiu em `respeite-o-homem.shops.comandocentral.com.br` em vez de `www.respeiteohomem.com.br` (domínio próprio verificado e ativo do tenant).
7. **Carrinho vazio na storefront.** Ao abrir o link, o cliente viu "Seu carrinho está vazio". Venda morreu na linha de chegada.

### Diagnóstico técnico (causa raiz por sintoma)

- **Sintoma 6 (domínio errado).** O `ai-support-chat` consulta uma tabela chamada `custom_domains` que **não existe** no banco. A consulta retorna sempre vazio e o código cai no fallback `slug.shops.comandocentral.com.br`. A tabela canônica de domínios próprios é `tenant_domains` (memória `tenant-domain-resolution-logic-ptbr`), com colunas `domain`, `is_primary`, `status='verified'`, `ssl_status='active'`. Consulta confirmada: o tenant tem `www.respeiteohomem.com.br` cadastrado e ativo lá.

- **Sintoma 7 (carrinho vazio).** O hidratador `useCheckoutLinkLoader` (que lê `?link=` da URL e popula o carrinho) está montado **dentro** do `CheckoutStepWizard`. O wizard, por sua vez, só monta quando a página de carrinho decide que não está vazia. Como o carrinho **começa** vazio, a página renderiza o empty-state ("Seu carrinho está vazio") antes do wizard montar — e o hidratador nunca chega a rodar. É uma race lógica de ordem de montagem, não um bug de dados (o `checkout_links` está correto, o produto está ativo, o slug bate).

- **Sintomas 3 e 5 (preço espontâneo + troca silenciosa).** Os prompts de `recommendation` e `product-detail` instruem a IA a "contar preço e disponibilidade" já na 1ª apresentação. Não existe regra global de "preço sob demanda". A trava `PRODUCT_LOCK_MISMATCH` só protege quando há um foco único — não cobre o caso "ofertei N itens e adicionei outro item agregador no lugar".

- **Sintoma 1 (saudação não espelhada).** Existe regra no prompt de `greeting` para espelhar período do dia, mas é só recomendação no system prompt. Não há scrubber no servidor que detecte a quebra e reescreva a abertura.

- **Sintoma 2 (pergunta consultiva ignorada).** Não há classificação de "turno consultivo" (cliente descreveu caso/sintoma + pediu recomendação personalizada + mandou foto). A IA tratou como se fosse uma pergunta genérica de catálogo.

- **Sintoma 4 (loop de confirmação).** O detector existente trabalha por **hash exato** do prefixo da resposta. "Deixo separado pra você" e "Posso separar e te mando o link?" não casam, mesmo sendo a mesma intenção semântica.

### Correção em curso (Blocos do plano técnico aprovado)

| Bloco | O que muda | Status |
|---|---|---|
| 1 — Domínio próprio no link | Trocar fonte do domínio do `ai-support-chat` de `custom_domains` → `tenant_domains` (filtro `status='verified'`, `ssl_status='active'`, preferindo `is_primary=true`) | ⏳ A aplicar |
| 2 — Hidratação do carrinho antes do empty-state | Mover `useCheckoutLinkLoader` para o nível da página `StorefrontCart`. Detectar `?link=`/`?product=` antes de renderizar empty-state. Mostrar "Carregando seu pedido…" enquanto hidrata | ⏳ A aplicar |
| 3.1 — Preço sob demanda | Regra global nos prompts de `discovery`/`recommendation`/`product-detail`: preço só com pergunta direta do cliente ou no fechamento | ⏳ A aplicar |
| 3.2 — Trava de conjunto ofertado | Novo invariante `OFFERED_BUNDLE_LOCK` no `add_to_cart`: comparar carrinho real vs "carrinho proposto" do turno; se divergir e não houver pedido de troca, bloqueia e força reconfirmação | ⏳ A aplicar |
| 3.3 — Reforço de saudação espelhada | Promover regra a "dura" no prompt + scrubber leve no servidor que reescreve a abertura quando o cliente saudou e a IA não espelhou | ⏳ A aplicar |
| 3.4 — Anti-repetição por família semântica | Ampliar detector para reconhecer família ("posso separar / deixo separado / mantenho a quantidade / posso reservar") como mesma intenção; regenerar na 2ª ocorrência sem avanço de estado | ⏳ A aplicar |
| 3.5 — Imagem na 1ª apresentação real | Em `product_detail`, tornar `send_product_image` obrigatória (1x por produto, respeitando anti-spam) | ⏳ A aplicar |
| 3.6 — Honrar pergunta consultiva | Classificar turno consultivo (sintoma + pedido de recomendação + foto). Forçar acolhida em 1 linha + no máximo 1 pergunta de qualificação antes de listar produto | ⏳ A aplicar |
| 4 — Validação | Smoke test do link (domínio + carrinho). Refazer roteiro do cliente real no canal de teste. Documentar nas specs e indexar memórias anti-regressão | ⏳ A executar |

### Anti-regressão prevista

Memórias a criar e indexar quando os blocos forem aplicados (cada uma vira 1 entrada `mem://constraints/*`):

- `checkout-link-domain-source-of-truth` — fonte de verdade do domínio é `tenant_domains`; `custom_domains` não existe.
- `checkout-link-must-show-loading-not-empty` — empty-state do carrinho proibido enquanto `?link=`/`?product=` estiver sendo hidratado.
- `ai-must-not-mention-price-unsolicited` — preço só com pergunta direta ou no fechamento.
- `ai-must-not-swap-offered-bundle` — conjunto ofertado vira "carrinho proposto"; substituir exige reconfirmação.
- `ai-must-mirror-greeting-period` — espelhamento de "bom dia/boa tarde/boa noite" reforçado por scrubber.
- `ai-must-honor-consultative-question-first` — turno consultivo precisa de acolhida antes de listar produto.
- `ai-anti-repetition-semantic-family` — anti-repetição por família semântica, não só hash exato.
- `ai-product-detail-image-mandatory-on-first-mention` — imagem obrigatória na 1ª apresentação real do produto.

### Próximas ações

1. Aplicar Blocos 1 → 4 na ordem de impacto na receita (domínio + carrinho primeiro, depois protocolo conversacional).
2. Cada bloco aplicado abre seu próprio sub-registro abaixo (Reg. #2.1, #2.2, …) com o "antes/depois" e o link da memória criada.
3. Quando todos os blocos estiverem aplicados e validados, o Registro #2 é fechado com o resumo final do "depois" e o `Mapa de qualidade atual` é atualizado.

**Status do registro:** ⏳ Diagnóstico concluído · Correção em fase de aplicação · Validação pendente.

---

*Documento criado em 29/abr/2026.*
