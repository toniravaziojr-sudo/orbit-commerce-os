# Memory: features/ai/special-tenant-ui-visibility
Updated: now

## Regra: Visibilidade de Informações Técnicas de IA na UI

### Princípio
Nomes de modelos de IA, provedores, versões de pipeline e detalhes técnicos de geração são **informação sensível de negócio** (sigilo industrial). Devem ser ocultados de tenants comuns para simplificar a UX e proteger a stack proprietária.

### Quem pode ver
- **Tenants especiais** (Respeite o Homem, Amazgan) — marcados via `isSpecialPartnerTenant()`
- **Comando Central** (Admin) — marcado via `isComandoCentralTenant()`

### O que é ocultado para tenants comuns
| Categoria | Exemplos ocultados |
|---|---|
| Nomes de modelos | Kling v3, Veo 3.1, Wan 2.6, GPT Image 1, GPT-5, Gemini |
| Provedores | fal.ai, ElevenLabs, OpenAI, Akool |
| Versões de pipeline | v2.0, v3.0, v7.0 |
| Badges técnicos | Alertas de pipeline, modelo utilizado em jobs |
| Descrições de motor | Substituídos por "Motor A", "Motor B" ou descrições funcionais |

### Como implementar (padrão)
```tsx
import { useIsSpecialTenant } from '@/hooks/useIsSpecialTenant';

const { isSpecialTenant } = useIsSpecialTenant();

// Condicional para exibir info técnica
{isSpecialTenant && <Badge>fal.ai GPT Image 1</Badge>}

// Anonimização para tenants comuns
<span>{isSpecialTenant ? 'Kling v3 Pro' : 'Melhor fidelidade de produto'}</span>
```

### Hook de controle
- `useIsSpecialTenant()` em `src/hooks/useIsSpecialTenant.ts`
- Internamente usa `useTenantAccess().showStatusIndicators`

### Arquivos afetados (referência)
- `UnifiedVideoTab.tsx` — Pipeline de vídeo
- `VideoGeneratorForm.tsx` — Tiers de qualidade
- `UGCRealForm.tsx` / `UGCAIForm.tsx` — Provedores UGC
- `ProviderSelector.tsx` / `CostEstimate.tsx` — Motor de imagens
- `VideoJobsList.tsx` / `CreativeJobsList.tsx` — Badges de jobs
- `AIPipelineInfo.tsx` / `CustomPipelineInfo.tsx` — Info de pipeline (já tinham filtro próprio)
- `Creatives.tsx` — Descrições de abas

### Regra de ouro
> Todo novo componente que exiba nome de modelo, provedor ou versão de pipeline **deve** usar `useIsSpecialTenant()` para condicionar a exibição. Descrições para tenants comuns devem ser **puramente funcionais** (o que faz, não como faz).
