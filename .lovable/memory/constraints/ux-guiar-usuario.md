# Restrição: Guiar o usuário sempre que o fluxo depende do cadastro

**Origem:** REGRAS-DO-SISTEMA.md §36.

## Regra dura

1. Campos do cadastro que alimentam fluxos externos (marketplaces, fiscal, frete, ads, IA) **devem** mostrar um selo + tooltip explicando para que serve.
2. Quando o fluxo falhar por dado faltante/genérico, a UI **deve** mostrar:
   - motivo em linguagem de negócio,
   - ação corretiva,
   - link direto para o local de correção.
3. **Proibido** exibir erro técnico cru (stack trace, JSON, "trim is not a function", código HTTP).

## Implementações canônicas

- Selo de campo: `src/components/marketplaces/MarketplaceFieldHint.tsx`.
- Diagnóstico de categorização ML: `src/lib/marketplaces/mlReadiness.ts → diagnoseCategoryFailure`.
- Aviso contextual: `src/components/marketplaces/MeliListingCreator.tsx` (etapa categorização).

## Quando estender

Qualquer novo módulo que dependa do cadastro do produto/cliente/pedido deve seguir o mesmo padrão (selo no campo + diagnóstico amigável no ponto da falha). Implementações que ignorem esta regra são consideradas regressão.
