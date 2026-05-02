
# Plano de correção — Rodada de testes pós Reg #8

Doc fonte: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (Mapa de qualidade + Reg #2.x e #5/#7/#8).

## O que o teste mostrou
1. **Vocativo genérico** — IA chamou o cliente de "Cliente" porque `customer_name = "Cliente de teste"`. O filtro atual só barra nomes corporativos (loja/ltda/me), não placeholders de teste/contato.
2. **Promessa sem ação (Reg #1.7 violada na borda)** — IA respondeu "tô gerando o link" sem chamar `generate_checkout_link`, e ainda perguntou CEP + forma de pagamento. O `forceCheckoutLink` (FIX-B) não disparou porque `explicitBuyNow` regex não cobriu a fala do cliente desse turno.
3. **Pediu CEP / forma de pagamento pelo WhatsApp** — esses dados são preenchidos na própria página de checkout. O prompt já diz isso (linha 4196 do handler), mas a IA continuou pedindo.
4. **(Observação)** Latência 24–25s em turnos com tool — diagnóstico, não corrigido nesta rodada.

## Correções propostas

### Correção 1 — Sanitizar vocativo de placeholders genéricos
- Local: `supabase/functions/ai-support-chat/index.ts`, bloco `[PIPELINE-FIX 2026-04-29] Uso estratégico do nome` (linha ~4548).
- Ampliar a heurística `looksCorporate` para incluir também placeholders: `cliente`, `teste`, `contato`, `usuário`, `customer`, `test`, `lead`, `prospect`, `visitante`, `whatsapp`, `desconhecido`. Quando bater, segue o mesmo caminho já existente: instruir o modelo a NÃO usar vocativo. Renomear a variável para `looksGenericOrCorporate` para refletir a intenção.
- Resultado: IA volta a abrir formal sem nome ("Olá, boa tarde, tudo bem?…") em vez de "Olá, Cliente, …".

### Correção 2 — Fechar de verdade quando intenção é confirmada
Defesa em duas camadas (espelho do que a Reg #2.16 já aplicou para "Posso gerar o link?", agora estendido para o outro lado: cliente disse "sim, fecha pra mim" e IA escapou pelo lado da promessa).

- **2a — `explicitBuyNow` (handler, linha ~5077):** ampliar a regex para cobrir também as falas reais do teste: `sim,? pode fechar`, `fecha pra mim`, `pode fechar`, `bora fechar`, `fechado`, `quero levar`, `me manda (a|o) (link|pagamento)`, `como pago`, `como (eu )?pago`, `quero pagar`. Mantém filtro `eligibleStateForForce` (decision/recommendation/product_detail/checkout_assist) já existente.
- **2b — Output gate `enforcePromiseWithoutAction`** novo em `supabase/functions/_shared/sales-pipeline/output-gates.ts`. Detecta no texto da IA padrões de promessa de link sem `generate_checkout_link` chamada com `success=true` neste turno: `/tô gerando|estou gerando|vou gerar (o )?link|gerando seu link|preparando o link|aguarde (um|só) instante.*link/i`. Ação: marca `semanticDuplicateDetected=true` (mesma rede de segurança da Reg #2.16) para forçar regeneração com `tool_choice = generate_checkout_link`. NÃO reescreve texto.
- Logar: `[Frente 4] promise_without_action match="…"`.

### Correção 3 — Bloquear pedido de CEP / forma de pagamento via WhatsApp
- Novo gate `enforceNoCheckoutDataAsk` em `output-gates.ts`. Em estados `recommendation|decision|checkout_assist`, se a resposta da IA contiver pedido de dados de checkout (`/qual (o )?seu (cep|endereço|cpf|e-?mail)|me (passa|envia|manda) (o )?(cep|cpf|endereço|e-?mail)|qual a forma de pagamento|como (você )?(prefere|quer) pagar|cartão ou pix|pix ou (cartão|boleto)/i`), e há tool `generate_checkout_link` disponível: marca `semanticDuplicateDetected=true` para regeneração com `tool_choice=generate_checkout_link`. Mesmo padrão da 2b.
- Reforço de prompt redundante NÃO será adicionado (já existe na linha 4196). A defesa nova é determinística.

## Validação técnica obrigatória
1. `rg` confirma novas regex e novos gates no código.
2. Build sem erros.
3. Bateria E2E pelo `ai-test-sandbox` (mesmo tenant Respeite o Homem) com 3 cenários:
   - "Cliente de teste" abre a conversa → resposta não usa vocativo.
   - Cliente "manda o link aí" → resposta contém URL `https://…/checkout?…` no mesmo turno.
   - Cliente "pode fechar" + IA promete link → próximo turno (forçado) traz a URL e NÃO pergunta CEP/pagamento.
4. Logs esperados: `[FIX-B] forcing tool_choice=generate_checkout_link explicit=true` e/ou `[Frente 4] promise_without_action match=…`.

## Documentação obrigatória pós-implementação
- **Adicionar Registro #9** em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` com sintoma do teste, diagnóstico, correções 1/2/3, validação técnica e anti-regressão.
- **Atualizar Mapa de qualidade** (linhas 38–55): manter ✅ as linhas já cobertas e acrescentar nova linha "Não pedir CEP/forma de pagamento pelo WhatsApp" → ✅ Reg #9.
- **Memórias anti-regressão** (`mem://constraints/`):
  - `ai-vocative-must-skip-generic-placeholders` — lista canônica de placeholders a suprimir.
  - `ai-promise-without-action-forces-regeneration` — promessa de link sem tool dispara regeneração com `tool_choice` forçado.
  - `ai-must-not-ask-checkout-data-on-whatsapp` — CEP/CPF/email/forma de pagamento são coletados na página de checkout.
- Indexar as 3 memórias em `mem://index.md`.

## Fora desta rodada
- Latência de 24–25s em turnos com tool — vai virar diagnóstico em rodada própria (precisa medir tool por tool antes de mexer).
- Frente 1 (sandbox stale) e Frente 6 (auditoria de tom robótico) seguem na fila do plano principal.

📌 STATUS DA ENTREGA: Proposta — aguardando confirmação para implementar.
