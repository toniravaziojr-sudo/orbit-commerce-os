# Plano — Classificação Inteligente para Marketplaces (Cadastro + Envio)

## Status
Aprovado em 2026-06-21.
- ✅ Etapa 1 — Taxonomia Universal (37 categorias) entregue 2026-06-21.
- ✅ Etapa 2 — Dicionário Universal de Atributos (50 atributos mapeados para Mercado Livre) entregue 2026-06-21.
- ✅ Etapa 3 — Ajustes no cadastro (categoria universal, regime regulatório expandido, conteúdo líquido, público) entregue 2026-06-21.

## Achados da revisão prévia
O cadastro de produto **já tem** infraestrutura parcial: `regulatory_category`
(enum com 3 valores), `ai_product_type`, `ai_main_function` e `regulatory_info`
(jsonb). Vamos **reaproveitar e expandir**, não duplicar.

## Motor de IA
Gemini 2.5 Flash nativo (principal) via roteador padrão do sistema
(`_shared/ai-router.ts`), com fallback automático já existente. Sem chamadas
diretas ao gateway.

## Etapas

### Etapa 1 — Taxonomia Universal de Categorias (base)
Árvore única do sistema baseada em ML + Shopee + TikTok. 15 grupos macro.
Cada nó traz regime regulatório aplicável e mapeamento para marketplaces.
Sem UI. Pura base de dados, seed do sistema.

### Etapa 2 — Dicionário Universal de Mapeamento (base)
Tabela única ligando cada atributo universal nosso ao código de cada
marketplace (ML, Shopee, TikTok). Seed inicial cobre os atributos
recorrentes em beleza, cosméticos, eletrônicos, moda, alimentos.

### Etapa 3 — Ajustes mínimos no Cadastro
- Expandir `regulatory_category` (incluir INMETRO, ANATEL, MAPA, não regulado, etc.).
- Adicionar **Categoria Universal** (seletor com busca, ligada à taxonomia da Etapa 1).
- Adicionar **Volume / Conteúdo líquido** com unidade.
- Adicionar **Gênero do público** quando aplicável.
- Reutilizar `ai_product_type` / `ai_main_function` já existentes.
- Botão "Classificar com IA" no topo do cadastro (sob demanda).

### Etapa 4 — Derivações Automáticas
Cálculos prontos a partir do cadastro: é kit (composição), unidades por
embalagem (soma da composição), peso líquido, condição, garantia, regime
regulatório a partir da Categoria Universal.

### Etapa 5 — IA no Dialog de Envio do Mercado Livre (núcleo)
A IA roda automaticamente assim que o lojista escolhe categoria do ML:
busca atributos exigidos em tempo real, cruza com dados do produto e
inferências, e mostra painel "Atributos para o anúncio" em 3 blocos:
preenchido / revisar / faltando. Bloqueia publicação só por obrigatório
real. Cada correção vira aprendizado por tenant.

### Etapa 6 — Validação com os 8 kits que falharam
Reprocessar os 8 kits travados pelo novo fluxo para confirmar qualidade 100%.

### Etapa 7 — Extensão para Shopee e TikTok Shop
Mesmo dialog e motor; só muda o dicionário de mapeamento da Etapa 2.

### Etapa 8 — Documentação
Atualizar `mercado-livre.md`, `_padrao-canonico-marketplaces.md` e
`mapa-ui.md` a cada etapa relevante.

## Ordem de execução
1. Etapas 1 + 2 (base, sem UI). ← em andamento
2. Etapa 3 (cadastro).
3. Etapa 4 (derivações).
4. Etapa 5 (IA no dialog ML).
5. Etapa 6 (validar os 8 kits).
6. Etapa 7 (Shopee + TikTok).
7. Etapa 8 (doc) ao final de cada etapa relevante.

## Governança
- Mudanças de UI/UX ou de regra de negócio passam por aprovação do usuário.
- Decisões técnicas e de fluxo de trabalho ficam com a IA, sempre privilegiando
  solidez, eficiência, segurança e baixo custo de processamento.
- Toda entrega encerra com bloco de documentação ou justificativa formal.
