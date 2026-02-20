# Memory: features/marketing/meta-ads-full-technical-control-v1-25
Updated: now

## Controle Técnico Completo Meta Ads (v1.26.0)

### Schema de Ferramentas (35+ parâmetros)
A integração Meta Ads oferece controle técnico total ao expandir o schema de ferramentas, removendo configurações hardcoded e nomenclaturas obsoletas.

### Campos Técnicos Modernos
| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| `performance_goal` | Meta de desempenho | "Maximizar Conversões" |
| `conversion_location` | Local da conversão | "Site" |
| `attribution_model` | Modelo de atribuição | "Padrão (7-day click)" |
| `geo_locations` | Segmentação geográfica | `["BR"]` |
| `publisher_platforms` | Posicionamentos (Placements) | `["facebook", "instagram"]` |
| `ad_format` | Formato do anúncio | `SINGLE_IMAGE`, `CAROUSEL`, `VIDEO` |
| `optimization_goal` | Otimização do AdSet | `OFFSITE_CONVERSIONS` |
| `conversion_event` | Evento de conversão | `PURCHASE` |

### Tradução de Formatos na UI (PT-BR)
| Valor Técnico | Label na UI |
|---------------|-------------|
| `SINGLE_IMAGE` | Imagem Única |
| `CAROUSEL` | Carrossel |
| `VIDEO` | Vídeo |
| `COLLECTION` | Coleção |
| `DYNAMIC` | Dinâmico (DPA) |
| `STORIES` | Stories |
| `REELS` | Reels |

### URLs de Destino
- Resolvidas via `tenant_domains` (type='custom', is_primary=true) + `product.slug`.
- Formato: `https://{domain}/produto/{slug}?utm_source=meta&utm_medium=cpc&utm_campaign={campaign_name}`
- **Proibido** usar UUIDs como URL de destino.

### Checklist Anti-Regressão
- [ ] `destination_url` usa slug do produto, nunca UUID
- [ ] Formatos traduzidos para PT-BR na interface de aprovação
- [ ] Todos os campos técnicos propagados para a API da Meta
