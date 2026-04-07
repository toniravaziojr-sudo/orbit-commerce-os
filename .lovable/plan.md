

# Plano de Correção Definitiva — Meta Pixel/CAPI v8.26.0

## Diagnóstico Completo por Evento

Investiguei todo o código de rastreamento (Edge HTML + SPA + Edge Function CAPI). A tabela abaixo mapeia TODOS os eventos e seus problemas de identidade:

| Evento | Contexto | external_id | fbp | fbc | IP | Problema |
|--------|----------|-------------|-----|-----|----|----------|
| PageView | Edge HTML | ❌ `_sf_vid` criado DEPOIS | ⚠️ retry 3.5s, sem polling | ✅ | ⚠️ Proxy IP | `gv()` na linha 1881, `_sfCapi` na linha 130 — cookie não existe no 1o carregamento |
| ViewContent | Edge HTML | ❌ Mesmo problema | ❌ Sem wait | ✅ | ⚠️ | Dispara inline, sem qualquer espera por `_fbp` |
| ViewCategory | Edge HTML | ❌ Mesmo problema | ❌ Sem wait | ✅ | ⚠️ | Idem |
| AddToCart | Edge HTML | ❌ Mesmo problema | ❌ Sem wait | ✅ | ⚠️ | `_sfCapi` chamado no click handler, fbp 3.1% |
| InitiateCheckout | Edge HTML (buy-now) | ❌ Mesmo problema | ❌ Sem wait | ✅ | ⚠️ | Dispara no click e redireciona imediatamente |
| InitiateCheckout | SPA | ✅ | ✅ waitForFbp 1.5s | ✅ | ⚠️ | OK exceto IP |
| Lead | SPA | ✅ | ✅ waitForFbp 1.5s | ✅ | ⚠️ | OK exceto IP |
| AddShippingInfo | SPA | ✅ | ✅ waitForFbp 1.5s | ✅ | ⚠️ | OK exceto IP |
| AddPaymentInfo | SPA | ✅ | ✅ waitForFbp 1.5s | ✅ | ⚠️ | OK exceto IP |
| Purchase | SPA + Server | ✅ | ✅ | ✅ | ⚠️ | OK exceto IP |

### Causas Raiz Confirmadas

**1. `external_id` baixo no Edge HTML (afeta PageView, ViewContent, ViewCategory, AddToCart, InitiateCheckout)**
- A função `gv()` que cria o cookie `_sf_vid` está no script de visit tracking, na **linha 1881** (fim da página).
- A função `_sfGetVid()` (linha 128) que lê o cookie é definida no **topo**, mas no primeiro carregamento o cookie simplesmente não existe ainda.
- Resultado: todos os eventos CAPI disparados no Edge HTML para novos visitantes vão sem `external_id`.

**2. `fbp` praticamente zero no Edge HTML**
- O `_sfCapi` (linha 130-141) lê `_fbp` de forma síncrona e imediata.
- O Meta Pixel é carregado via `requestIdleCallback` (timeout 3s) — o cookie `_fbp` só existe após o Pixel inicializar.
- No SPA existe `waitForFbp()` com polling. No Edge HTML **não existe nenhum mecanismo equivalente**.
- O único retry é para PageView (linha 155, setTimeout 3.5s), mas é um retry fixo, não polling, e **não cobre ViewContent, AddToCart, etc.**

**3. IP compartilhado (79% dos PageView)**
- O Edge Function recebe o IP do gateway Supabase, não do visitante real.
- Headers como `cf-connecting-ip` podem não ser propagados pela infraestrutura Supabase.
- O IP real do visitante só é acessível no navegador, mas não é enviado no payload CAPI.

**4. `fbc` abaixo do esperado**
- `fbc` só existe para tráfego pago Meta (presença de `fbclid`). O nível atual é parcialmente esperado.
- Porém, a captura no Edge HTML (linha 126) persiste corretamente em cookie + localStorage. No SPA, `captureClickIds()` faz o mesmo. **Não há bug real aqui** — a cobertura reflete o mix de tráfego pago vs orgânico.

---

## Plano de Implementação (4 Frentes)

### Frente 1 — Criar `_sf_vid` no topo do Edge HTML (antes de qualquer CAPI)

**Arquivo:** `supabase/functions/storefront-html/index.ts`

Mover a lógica `gv()` (criar/ler `_sf_vid`) do script de visit tracking (linha ~1881) para o bloco de inicialização (linha ~125), **antes** da definição de `_sfCapi`. A função `_sfGetVid` passará a usar o valor já criado.

Ordem final do script de inicialização:
```text
1. _sfEvtId (gerador de event_id)
2. Captura fbclid → _fbc cookie  
3. _sfGetOrCreateVid (NOVO — cria _sf_vid AQUI)
4. _sfGetFbc, _sfGetVid (agora lê o cookie que acabou de ser criado)
5. _sfGetAM
6. _sfCapi (já com vid garantido)
```

**Impacto:** `external_id` sobe de ~32-40% para ~95%+ em todos os eventos Edge HTML.

### Frente 2 — Adicionar `waitForFbp` no Edge HTML para TODOS os eventos CAPI

**Arquivo:** `supabase/functions/storefront-html/index.ts`

Refatorar `_sfCapi` para incluir polling assíncrono do cookie `_fbp`:
- Verifica `_fbp` imediatamente
- Se ausente, faz polling a cada 250ms (até 6 tentativas = 1.5s)
- Após timeout, envia com o que tem (graceful degradation)
- Não bloqueia a UI — a chamada CAPI é assíncrona

Isso cobre: PageView, ViewContent, ViewCategory, AddToCart, InitiateCheckout.

O retry fixo de 3.5s para PageView (linha 155) será removido pois o polling dentro do `_sfCapi` já resolve.

**Impacto:** `fbp` sobe de ~3-20% para ~70-85% nos eventos Edge HTML.

### Frente 3 — Enviar IP real do visitante no payload CAPI

**Arquivos:**
- `supabase/functions/storefront-html/index.ts` — O `_sfCapi` passará a enviar `client_ip_from_browser` no payload, obtido via uma chamada leve ao próprio endpoint CAPI que retorna o IP detectado
- `supabase/functions/marketing-capi-track/index.ts` — Aceitar campo opcional `user_data.client_ip_from_browser` e usá-lo como valor preferencial para `client_ip_address`
- `src/lib/marketingTracker.ts` — O `sendServerEvent` do SPA também enviará o IP capturado, se disponível

Estratégia: Na primeira chamada CAPI (PageView), o response do Edge Function retornará o IP detectado. O script armazena em `window._sfClientIp` e o inclui em todas as chamadas subsequentes.

**Impacto:** Reduz "IPs associados a vários usuários" de 79% para ~10-20%.

### Frente 4 — Aumentar timeout do `waitForFbp` no SPA de 1.5s para 3s

**Arquivo:** `src/lib/marketingTracker.ts`

Na linha 405, o `waitForFbp(1500)` está usando 1.5s, mas a própria função suporta até 5s (linha 294). Aumentar para 3s para maximizar captura sem impactar UX.

**Impacto:** Melhora marginal no `fbp` dos eventos SPA (InitiateCheckout, AddShippingInfo, AddPaymentInfo).

---

## Documentação

### Atualização do `docs/meta-tracking-changelog.md`

Adicionar **Registro #4** com:
- Notas ANTES (capturar dos prints atuais do usuário)
- Detalhamento das 4 frentes aplicadas
- Template para acompanhamento APÓS (48-72h)

### Atualização da memória `meta-tracking-standard`

Registrar a versão v8.26.0 com as mudanças de identidade no Edge HTML.

---

## Resultado Esperado

| Parâmetro | Antes (Edge HTML) | Depois | Antes (SPA) | Depois |
|-----------|-------------------|--------|-------------|--------|
| external_id | 32-40% | ~95%+ | 72-87% | ~98%+ |
| fbp | 3-20% | ~70-85% | 52-87% | ~85-90% |
| fbc | 18-62% | Sem mudança (limitado ao tráfego pago) | 40-62% | Idem |
| IP único | ~21% | ~80-90% | Idem | Idem |

---

## Arquivos Impactados

1. `supabase/functions/storefront-html/index.ts` — Frentes 1, 2 e 3
2. `supabase/functions/marketing-capi-track/index.ts` — Frente 3 (aceitar IP do browser)
3. `src/lib/marketingTracker.ts` — Frentes 3 e 4
4. `docs/meta-tracking-changelog.md` — Registro #4
5. `.lovable/memory/infrastructure/marketing/meta-tracking-standard` — Atualização v8.26.0

