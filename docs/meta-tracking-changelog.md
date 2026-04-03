# Meta Pixel/CAPI — Histórico de Alterações e Notas de Qualidade

Este documento registra cada rodada de ajustes feita no rastreamento Meta (Pixel + API de Conversões),
incluindo as notas de qualidade antes e depois, para permitir comparação e evitar regressões.

---

## Registro #1 — Ajuste de 27/mar/2026

**O que foi feito:** Priorização de IPv4 (dotted-quad) nos headers `x-forwarded-for` para resolver erro de "IP mismatch" entre Pixel e CAPI. Implementação do polling de `fbp` (waitForFbp 1.5s). Transporte híbrido fetch+keepalive / sendBeacon.

**Notas ANTES do ajuste:** *(não registrado — baseline perdido)*

**Notas APÓS o ajuste (estimativa retroativa):**
| Evento | Nota | Observação |
|--------|------|------------|
| Lead | ~9.3 | Referência do usuário |
| Purchase | ~9.3 | Referência do usuário |
| *(demais)* | — | Não registrado |

---

## Registro #2 — Leitura de 03/abr/2026 (diagnóstico, sem ajuste ainda)

**Contexto:** Notas caíram significativamente em relação ao registro #1. Meta agora reporta 3 erros ativos.

**Notas atuais (03/abr/2026):**
| Evento | Nota | Volume (7d) | Status |
|--------|------|-------------|--------|
| Lead | 8.6 | 176 | ⚠️ Caiu de ~9.3 |
| Purchase (Comprar) | 8.4 | 40 | ⚠️ Caiu de ~9.3 |
| AddShippingInfo | 6.0 | 132 | — |
| AddPaymentInfo | 6.0 | 96 | — |
| InitiateCheckout | 5.1 | 569 | ⚠️ "Atualização recomendada" |
| PageView | 4.8 | 5.100 | ❌ Baixo |
| ViewCategory | 3.9 | 2.300 | ❌ Baixo |
| ViewContent | 3.9 | 727 | ❌ "Atualização recomendada" |
| AddToCart | 3.9 | 325 | ❌ "Atualização recomendada" |

**Cobertura de parâmetros por evento (CAPI):**

### PageView
| Parâmetro | Cobertura |
|-----------|-----------|
| Email | 2.47% |
| IP | 100% |
| User Agent | 100% |
| Telefone | 2.47% |
| fbp | 20.27% |
| external_id | 63.29% |
| País | 100% |
| fbc | 25.75% |

### ViewContent
| Parâmetro | Cobertura |
|-----------|-----------|
| IP | 100% |
| User Agent | 100% |
| external_id | 27.66% |
| País | 100% |
| fbc | 14.89% |
| fbp | ❌ Não enviado (sugerido: +16.53% conversões) |

### AddToCart
| Parâmetro | Cobertura |
|-----------|-----------|
| IP | 100% |
| User Agent | 100% |
| fbp | 4.76% |
| external_id | 42.86% |
| País | 100% |
| fbc | 19.05% |

### InitiateCheckout
| Parâmetro | Cobertura |
|-----------|-----------|
| IP | 100% |
| User Agent | 100% |
| fbp | 48.57% |
| external_id | 68.57% |
| País | 100% |
| fbc | 40% |
| Conversões adicionais CAPI | +50% |

### Purchase
| Parâmetro | Cobertura |
|-----------|-----------|
| Email | 100% |
| IP | 85.71% |
| User Agent | 85.71% |
| Telefone | 100% |
| fbp | 71.43% |
| external_id | 100% |
| CEP | 100% |
| País | 100% |
| Nome/Sobrenome | 100% |
| Cidade/Estado | 100% |
| fbc | 14.29% |

**Erros ativos no diagnóstico Meta (03/abr/2026):**
1. ⚠️ "Baixa taxa de eventos de pixel cobertos pela API de Conversões" — Evento Purchase
2. ⚠️ "Atualize seus endereços IP da API de Conversões para o formato IPv6" — 52% dos eventos (PageView)
3. ⚠️ "Envie endereços IP que correspondam ao Pixel" — 52% dos eventos (PageView)

**Discrepância de vendas (período 27/mar–03/abr):**
- Vendas registradas na loja: **21 pedidos aprovados**
- Vendas atribuídas nas campanhas Meta: **~11 compras**
- Gap: ~10 vendas não atribuídas (~48% de perda de atribuição)
- Possíveis causas: queda de qualidade do matching, conflito IPv4/IPv6, fbp baixo nos eventos de navegação

---

## Registro #3 — Ajuste de 03/abr/2026, ~18:00 UTC-3 (v8.25.0)

**Notas ANTES:** (Registro #2 acima)

**O que foi feito:**
1. **Removida priorização IPv4** — O CAPI agora envia o IP exatamente como recebido do proxy (cf-connecting-ip > true-client-ip > x-real-ip > x-forwarded-for), sem filtrar por formato. Isso resolve o conflito IPv4/IPv6 que afetava 52% dos eventos.
2. **Timeout do fbp aumentado de 1.5s para 5s** — Mais tempo para capturar o cookie `_fbp` do Meta Pixel, especialmente em conexões lentas. Polling a cada 250ms (antes 200ms). Se o cookie aparecer antes, resolve imediatamente.
3. **external_id já estava garantido** — Verificação confirmou que o cookie `_sf_vid` já é criado sincronamente antes de qualquer evento no MarketingTrackerProvider.

**Notas APÓS:** *(aguardando 48-72h para a Meta recalcular)*

**Erros esperados a resolver:**
- ⚠️ "Atualize seus endereços IP para IPv6" — deve desaparecer
- ⚠️ "IP mismatch entre Pixel e CAPI" — deve desaparecer
- ⚠️ "Baixa cobertura CAPI em Purchase" — deve melhorar com melhor matching

**Validação planejada:**
- Comparar notas do Events Manager em 06/abr/2026
- Verificar se discrepância de vendas (loja vs campanhas) reduziu

---

## Template para próximos registros

```
## Registro #N — [data]

**O que foi feito:**

**Notas ANTES:**
| Evento | Nota |
|--------|------|

**Notas APÓS:**
| Evento | Nota |
|--------|------|

**Cobertura de parâmetros (se relevante):**

**Erros ativos:**

**Discrepância de vendas:**
```
