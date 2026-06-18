## Objetivo
Garantir que **100% dos campos** definidos numa Proposta de Campanha sejam efetivamente enviados à Meta, no formato que ela aceita, sem perda, sem invenção e sem mudar a UI/UX.

## Mapa Proposta → Meta (auditoria campo a campo)

### Campanha
| Campo da proposta | Estado hoje | Ação |
|---|---|---|
| Nome | ✅ enviado | manter |
| Objetivo (sales/leads/...) | ✅ traduzido para OUTCOME_* | manter |
| Modo de compra (AUCTION/RESERVED) | ❌ não enviado | passar `buying_type` |
| Modo de orçamento (CBO/ABO) | ⚠️ parcial | confirmar CBO via `campaign.daily_budget` e bloquear orçamento de conjunto |
| Orçamento diário | ✅ enviado | manter |
| Estratégia de lance | ✅ enviado | manter |
| Categoria especial de anúncio | ✅ enviado | manter |
| Janela de atribuição | ❌ não enviado | enviar `attribution_spec` no conjunto |

### Conjunto (adset)
| Campo da proposta | Estado hoje | Ação |
|---|---|---|
| Nome | ✅ | manter |
| Localização (BR/estados/cidades) | ⚠️ só país BR | aceitar `geo_locations` estruturado quando vier |
| Idade min/max | ✅ | manter |
| **Gênero (Masculino/Feminino/Todos)** | ❌ não enviado | mapear para `genders:[1]/[2]/omit` |
| **Posicionamentos (advantage_plus / feed / reels / stories)** | ❌ não enviado | mapear corretamente: Advantage+ ⇒ `targeting_automation.advantage_audience=1` (placements automáticos); lista específica ⇒ `publisher_platforms` + `facebook_positions`/`instagram_positions`/`device_platforms` |
| **Públicos a incluir (custom audiences)** | ❌ não suportado | enviar `targeting.custom_audiences` com IDs |
| **Lookalikes a incluir** | ❌ não suportado | enviar nos `custom_audiences` (Meta trata igual) |
| Públicos a excluir | ✅ enviado | manter |
| Meta de otimização | ✅ enviado | manter |
| Evento de cobrança | ✅ enviado | manter |
| Evento de conversão + Pixel | ✅ enviado em `promoted_object` | manter |
| Orçamento do conjunto (ABO) | ✅ | manter |
| Agendamento (início/fim) | ⚠️ usa janela 00:01 BRT | manter contrato H.4.2 |

### Anúncio (ad / creative)
| Campo da proposta | Estado hoje | Ação |
|---|---|---|
| Texto principal | ✅ enviado | manter |
| Título (headline) | ✅ enviado | manter |
| Descrição | ❌ não enviado | enviar como `description` no `link_data` |
| CTA | ✅ enviado | manter |
| URL de destino + UTM | ✅ enviado | manter |
| Página do Facebook | ✅ enviado | manter |
| **Instagram Actor** | ❌ não enviado | passar `instagram_actor_id` no `object_story_spec` (sem isso, anúncio só roda no Facebook) |
| Imagem (binário + fallback URL) | ✅ enviado | manter |
| Vínculo ao conjunto correto | ✅ corrigido na H.5 | manter |

## Lacuna estrutural: materialização de público
Hoje o gerador de proposta deixa nomes de público em texto livre (ex.: "Lookalike 1% Compra 180D") sem materializar o ID real da conta. Quando o publicador for entregar para a Meta, não há ID a enviar.

**Decisão técnica**: o publicador, antes de criar cada conjunto, vai **resolver nomes → IDs reais** consultando a conta de anúncios da Meta:
- Buscar a lista de públicos customizados e lookalikes da conta uma vez por publicação (cache em memória).
- Para cada nome citado em "audience"/"required_audiences"/"required_lookalikes", procurar correspondência exata; se não houver, procurar por similaridade segura (igualdade case-insensitive sem acentos).
- Se encontrar → usar o ID.
- Se NÃO encontrar → falhar o conjunto com mensagem clara em português ("Público X não existe na conta") e devolver a proposta à fila, sem publicar parcialmente.

## Recuperação da campanha já publicada
A campanha "Shampoo Calvície Zero" subiu sem gênero, sem Instagram, sem Advantage+ e sem o Lookalike no CJ2.

**Recomendação**: pausar imediatamente os 2 conjuntos na Meta e republicar a proposta pelo fluxo corrigido. Editar in-place é mais arriscado (a Meta reinicia aprendizado em qualquer alteração estrutural; o efeito prático é o mesmo) e perde rastreabilidade. **Aguardo seu OK** entre pausar+republicar (recomendado) ou editar in-place.

## Anti-regressão
- Bateria de testes do publicador cobrindo: gênero PT-BR, Advantage+, lookalike por nome, atribuição, descrição e Instagram actor.
- Registro permanente em memória de governança: "publicador deve transcrever todos os campos da proposta sem perda; novos campos exigem mapper + teste".

## Documentação
- Atualizar gestor-trafego.md (H.4.2 — seção "Paridade total Proposta → Meta") com a tabela campo a campo.
- Atualizar plataformas-baseline.md com o mapeamento de gênero/placements/atribuição.

## Status pretendido após implementação
Diagnóstico ✅ → Proposta ✅ → **Aguardando sua confirmação** para aplicar (item da republicação em particular).

### Detalhes técnicos (opcional)
Alvos: `supabase/functions/ads-autopilot-publish-proposal/index.ts` (transmissor) e helper compartilhado `_shared/meta-audience-resolver.ts` (novo). Sem mexer em UI nem em geração de proposta — só transmissão e resolução de IDs no momento do publish.
