
# Plano de correção — Reg #10 (rodada pós Reg #9)

Doc fonte: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (Mapa + Reg #9 + Reg #2.15/#2.16).

## O que o novo teste mostrou (conv `e44ad453`)

Mesmo com Reg #9 deployada e o log `[name-policy] suppressing vocative for corporate-like name: "Cliente de teste"` aparecendo, três falhas reais persistiram:

1. **Vocativo "Cliente" voltou:** a IA respondeu *"Fechado, Cliente, tô gerando o link."* — o sistema só **instrui** o LLM a não usar vocativo via system prompt; o `gpt-5-mini` ignorou. Defesa atual é prompt, não determinística.
2. **Promessa sem ação + pedido de CEP/pagamento sobreviveram:** *"tô gerando o link… Me passa o CEP pra eu calcular o prazo"* e depois *"Qual forma de pagamento prefere: cartão ou PIX?"*. Os gates `enforcePromiseWithoutAction` e `enforceNoCheckoutDataAsk` da Reg #9 sinalizaram `closeLoopDetected=true`, mas a regeneração usa o caminho do **Pacote E v2** com `tool_choice="none"` — não força `generate_checkout_link`, só pede texto novo. Resultado: a IA repete a mesma promessa.
3. **Auto-add não disparou (Reg #2.15):** log `auto_add_skipped reason=presented_count=3`. Quando a IA apresenta Shampoo + Loção + Balm e depois o cliente conversa só sobre o **Balm** ("Me fala mais do balm" 3×, "Quanto custa?", "Pode separar 1 pra mim, quero fechar"), o foco já está consolidado no Balm — mas o auto-add exige `presented_count==1` e ignora `product_focus`. Resultado: carrinho vazio na hora do "Pode fechar" → tool falha → IA cai no caminho de pedir CEP.

Bonus observado nos logs: `gpt-5-mini` rejeita o parâmetro `reasoning` no primeiro try e faz retry (+3-4s de latência por turno). Não é alvo desta rodada — vai para diagnóstico próprio.

## Causa raiz (uma frase)

A Reg #9 fechou o sintoma errado: instalou gates de **detecção** mas o gatilho de regeneração existente só refaz texto, não força a tool; e o auto-add elegível ignora o sinal mais forte que temos sobre a escolha do cliente — o `product_focus`.

## Correções propostas

### Correção A — Scrubber determinístico de vocativo proibido (latência zero)
- Local novo: `supabase/functions/_shared/sales-pipeline/output-gates.ts` → `stripForbiddenVocative({ aiResponse, suppressedNameTokens })`.
- Quando o handler decide suprimir vocativo, passa os tokens (`["Cliente","Cliente de teste","teste"]` etc.) para o scrubber, que regrava removendo as construções `^(Olá|Oi|Fala|Boa tarde|Bom dia|Boa noite|Fechado|Show|Beleza)[ ,]+(<token>)\b[,]?` e `\b,\s*<token>\b` no início ou no meio da frase.
- Wiring no `ai-support-chat/index.ts` no mesmo bloco de `enforceCloseOnConfirmedIntent`/Reg #9, **antes** de persistir a mensagem.

### Correção B — Auto-add por `product_focus` quando há mais de 1 produto apresentado
- Local: `ai-support-chat/index.ts` handler `generate_checkout_link` (~linha 1866, bloco Reg #2.15).
- Hoje: só auto-adiciona se `presented_product_ids.length === 1`.
- Mudar para: se vazio, tentar nesta ordem:
  1. `presented_product_ids.length === 1` (regra atual).
  2. `currentProductFocus.product_id` definido E presente em `presented_product_ids` E produto sem variantes mandatórias.
  3. `presented_product_ids.length > 1` E há **um único produto recentemente debatido em profundidade** — derivado do contador de menções no histórico recente (já calculamos famílias em `intent-fingerprint`).
- Em (2) e (3), mesmo critério atual de `status='active'` + `has_variants=false`. Logar `[Reg #10] auto_add_on_focus product_id=… reason=focus|recent_debate`.

### Correção C — Regen com `tool_choice` forçado quando o motivo é "promise/data_ask"
- Local: `ai-support-chat/index.ts` ~linha 6310 + bloco do Pacote E v2 (~linha 6395).
- Hoje: `closeLoopDetected` herda em `semanticDuplicateDetected`, mas o caminho de regen usa `tool_choice="none"` (só texto).
- Mudar: introduzir flag `forceCheckoutOnRegen` (true quando `closeLoopReason ∈ {client_confirmed_but_ai_asked_again, promise_without_action, checkout_data_ask}` E `generateCheckoutAvailable` E `checkoutChecklist.ready`). No regen, em vez de `tool_choice="none"`, usa `tool_choice={type:"function", function:{name:"generate_checkout_link"}}` e re-roda o loop de tools (1 iteração extra). Limite hardcoded de 1 regen por turno (mantém custo).
- Caso `checkoutChecklist.ready` esteja falso mas a Correção B tenha condições, primeiro chama o auto-add server-side **antes** da regen.

### Correção D — Bloquear "promise/data_ask" também quando a tool foi chamada e falhou
- Local: `output-gates.ts` `enforcePromiseWithoutAction` (linha 388).
- Hoje: `checkoutCalledOk` retorna true se a tool foi chamada com `success=true`. OK.
- Adicionar contraparte explícita: se a tool foi chamada com `success=false` (cart vazio etc.), o gate deve disparar igualmente — atualmente cai em `noop` por causa do regex de promessa não bater quando o texto não promete (mas no nosso caso real o texto promete). Garantir cobertura via teste unit-style mental: `toolFailed = chamou e success=false` → vira sinal forte para a Correção C usar.

### Não escopo desta rodada
- Latência (gpt-5-mini reasoning rejection + 25s) — vira Reg #11 de diagnóstico.
- Eixo 1.7 (handoff por loop) continua como rede final.
- Working Memory shadow → ativo: aguarda Reg #2.9 sair de observação.

## Validação técnica obrigatória
1. `rg` confirma novos símbolos (`stripForbiddenVocative`, `forceCheckoutOnRegen`, log `[Reg #10]`).
2. Build sem erro + deploy `ai-support-chat`.
3. Bateria E2E pelo `ai-test-sandbox` (tenant Respeite o Homem) com **roteiro completo de venda**:
   - Saudação ("Oi, tudo bem?") → resposta sem vocativo "Cliente".
   - Dor ("Tô com queda de cabelo") → 3 produtos.
   - Foco ("Me fala mais do balm") + preço + "Pode separar 1, quero fechar" → URL no mesmo turno; sem pedido de CEP/pagamento.
4. Conferir nos logs:
   - `[Reg #10] auto_add_on_focus`
   - `[Reg #10] forcing tool_choice=generate_checkout_link reason=promise_without_action|checkout_data_ask`
   - Ausência de `Carrinho vazio` no resultado final.
5. Conferir em `messages` que a mensagem persistida da IA contém `https://`.

## Documentação obrigatória pós-implementação
- **Registro #10** em `ia-atendimento-changelog.md` com sintoma, diagnóstico, correções A–D, validação e anti-regressão.
- **Atualizar Mapa de qualidade** (linhas 53–57): rebaixar Reg #9 onde aplicável e adicionar:
  - "Vocativo proibido removido determinísticamente" → ✅ Reg #10
  - "Auto-add on focus quando há múltiplos produtos apresentados" → ✅ Reg #10
  - "Regen pós-loop força tool de checkout" → ✅ Reg #10
- **Memórias anti-regressão** (`mem://constraints/`):
  - `ai-vocative-suppression-must-be-deterministic-not-prompt-only`
  - `checkout-auto-add-must-use-product-focus-when-multiple-presented`
  - `close-loop-regen-must-force-checkout-tool-choice`
- Indexar as 3 em `mem://index.md`.

📌 STATUS DA ENTREGA: Proposta — aguardando confirmação para implementar.
