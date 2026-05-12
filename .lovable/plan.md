
# Análise — Qualidade Pixel + CAPI (Respeite o Homem)

## Como funciona hoje (resumo executivo)

A loja envia cada evento para a Meta por dois caminhos em paralelo (Pixel no navegador + API de Conversões no servidor), com regras já documentadas para garantir cookies (`_fbp`, `_fbc`), IP, identidade do cliente e desduplicação.

Última grande entrega: **v8.32.0 (07/05/2026)** — corrigiu paridade de `_fbp` no topo do funil, `predicted_ltv` no Purchase, beacon-first em AddToCart/InitiateCheckout e `delivery_category` faltando.

O painel da Meta exibido nos prints reflete uma janela de **7 dias**, ou seja, **mistura dados pré e pós 07/05**. Parte do que aparece como "erro ativo" é resíduo dessa janela.

---

## O que eu confirmei nos dados reais (últimos 7 dias, CAPI)

| Evento | Total | `_fbp` | `_fbc` | Email | Telefone | Endereço |
|---|---:|---:|---:|---:|---:|---:|
| PageView | 1.779 | 87,6% | 37,7% | 8,9% | 8,9% | 0% |
| ViewCategory | 854 | 81,9% | 40,7% | 14,2% | 14,2% | 0% |
| ViewContent | 361 | 79,5% | 30,7% | 8,3% | 8,3% | 0% |
| AddToCart | 152 | 93,4% | 47,4% | 38,2% | 38,2% | 0% |
| InitiateCheckout | 142 | 99,3% | 48,6% | 28,9% | 28,9% | 0% |
| Lead | 80 | 98,8% | 51,3% | 100% | 100% | 0% |
| AddShippingInfo | 40 | 100% | 37,5% | 100% | 100% | 100% |
| AddPaymentInfo | 43 | 100% | 39,5% | 100% | 100% | 100% |
| **Purchase** | 44 | **75,0%** | 29,5% | 100% | 100% | 100% |

`predicted_ltv` em Purchase pós-v8.32.0: **100% válido** (39 dos 44 já são pós-deploy).

---

## Diagnóstico item a item

### 1. `_fbc` baixo em todos os eventos — **NORMAL, não é bug**
O `_fbc` só existe quando o visitante chega num link com `fbclid` (clique em anúncio Meta). Visitantes orgânicos, diretos, vindos do Google, do Instagram bio, de e-mail, etc., **não geram `_fbc`**. É esperado que a cobertura fique entre 15% e 50%, dependendo da fração de tráfego pago Meta.

**Ação:** nenhuma. O comportamento atende a especificação.

### 2. Avisos de IPv4/IPv6 em ViewContent / AddToCart / InitiateCheckout — **PRECISA INVESTIGAR**
A Meta detecta que o Pixel (navegador) reporta IPv6 mas a API de Conversões está enviando IPv4. Isso reduz match e pode disparar alerta "IPs divergentes". O documento já prevê leitura na ordem certa (`cf-connecting-ip` primeiro), mas precisamos confirmar se o navegador moderno está usando IPv6 e o servidor está pegando IPv4 de outro header em algum ponto do pipeline.

**Ação proposta:** auditar amostras reais de Purchase/InitiateCheckout para verificar qual IP está sendo gravado, confirmar se é IPv4 mesmo quando o cliente é IPv6 e ajustar a fonte de IP se necessário (priorizar IPv6 quando disponível em cf-connecting-ip).

### 3. Erro "predicted_ltv inválido em 40% dos Purchase" — **JÁ CORRIGIDO, aguardando janela**
A correção v8.32.0 garante `predicted_ltv = value × 1.8` apenas quando o valor é > 0. Os dados reais pós-deploy mostram **100% de cobertura válida**. O alerta no painel ainda mostra 40% porque a Meta usa janela de 7 dias e ainda há eventos pré-correção misturados.

**Ação proposta:** nenhuma técnica. Apenas aguardar até **14/05** para o alerta sair sozinho. Se permanecer após 14/05, reabrir investigação.

### 4. `_fbp` em Purchase em 75% — **PRECISA INVESTIGAR**
A meta documental é ≥99% pós-v8.32.0. A página de "obrigado" (origem do Purchase) **não é renderizada pelo edge HTML** — é parte da SPA. Então o helper que sintetiza `_fbp` no servidor não roda nessa rota. Em fluxos onde o cliente é redirecionado ao gateway (Mercado Pago) e volta direto para `/thank-you`, o cookie pode ter sido setado em outro contexto/domínio e o navegador pode chegar sem ele.

**Ação proposta:** investigar a rota da página de obrigado e garantir que o `_fbp` esteja disponível antes do disparo do Purchase, seja por leitura do cookie já existente (cenário maioria), seja gerando sintético no momento do Purchase quando ausente. Usar a mesma lógica do edge HTML.

### 5. `_fbp` em PageView/ViewCategory/ViewContent entre 79% e 87% — **PARCIALMENTE RESÍDUO**
Esperávamos ≥95% após v8.32.0. Hipóteses:
- HTMLs em cache ainda anteriores ao deploy de 07/05 (mesmo com revalidação marcada).
- Visitantes com bloqueadores de cookie ou navegação privada.
- Bots/crawlers que entram sem suportar cookies.

**Ação proposta:** rodar uma nova invalidação dos prerenders e medir cobertura **só nas últimas 48h** para isolar o efeito real da v8.32.0. Se ainda ficar abaixo de 95%, investigar amostras concretas.

### 6. Alerta "Baixa taxa de eventos cobertos pela API de Conversões" no AddToCart — **MONITORAR**
Nossa cobertura CAPI de AddToCart está em 93,4% nos últimos 7 dias, perto do mínimo recomendado (75%). O alerta deve fechar naturalmente, mas se persistir após 14/05, validar se o `beacon-first` da v8.32.0 está sendo aceito em todos os navegadores de produção.

### 7. Email/Telefone baixos em ViewContent/AddToCart — **NORMAL com upside futuro**
O cofre de identidade só tem dados depois que o visitante deixa Lead/Checkout pelo menos uma vez. A maioria dos visitantes de PDP e carrinho ainda é **anônima na primeira visita**. Score sobe naturalmente com o tempo, conforme o cofre acumula visitantes recorrentes.

**Ação:** nenhuma técnica. Pode ser endereçado depois por uma estratégia de captura de e-mail mais cedo (popup já existe, mas conversão é função do design do popup).

---

## O que é normal, o que vou propor mexer

| Item | Status | Ação |
|---|---|---|
| `_fbc` baixo | Normal | Nada |
| Email/telefone baixo no topo de funil | Normal | Nada |
| `predicted_ltv` inválido | Já corrigido | Aguardar janela 14/05 |
| Cobertura CAPI em AddToCart | Quase no alvo | Monitorar até 14/05 |
| `_fbp` Purchase em 75% | **Bug residual** | Investigar a página de obrigado e corrigir |
| Avisos de IPv4/IPv6 | **Bug residual** | Auditar fonte de IP e ajustar prioridade |
| `_fbp` PageView/ViewContent abaixo de 95% | **Parcialmente resíduo** | Reinvalidar HTML e remedir em 48h |

---

## Resultado final esperado

Depois de aplicar os ajustes propostos:
- Score do Purchase deve subir de ~7,5 para ≥9,0.
- Os 3 alertas ativos do painel Meta devem fechar até 21/05.
- Match Quality estabiliza acima do score do Lead em toda a cadeia (cadeia natural respeitada).

Sem nenhum ajuste, o que vai melhorar sozinho até 14/05:
- Erro de `predicted_ltv` (já corrigido na v8.32.0).
- Cobertura CAPI de AddToCart (também já endereçado).

---

## Detalhe técnico (opcional)

Pontos a auditar na execução:
- `src/components/storefront/ThankYouContent.tsx` e rota da página de obrigado para ver se `_fbp` está disponível no momento do disparo do Purchase.
- Ordem efetiva de leitura de IP em `marketing-capi-track` quando o cliente é IPv6 (confirmar se `cf-connecting-ip` está realmente vencendo `x-forwarded-for[0]`).
- Última lista de prerenders ativos para validar se há HTML pré-07/05 ainda servido.

## Próxima execução recomendada

Investigar **`_fbp` no Purchase (item 4)** primeiro — é o de maior impacto no score do principal evento de conversão. Depois IPv4/IPv6 (item 2). Os demais ou são normais ou se resolvem sozinhos na janela de 7 dias.

**Não é necessário aprovar a correção agora.** Se você quiser que eu prossiga, eu abro a investigação técnica do item 4 e volto com o diagnóstico antes de propor o ajuste.
