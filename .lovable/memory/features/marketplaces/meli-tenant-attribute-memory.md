---
name: ML Memória de Ajustes Manuais por Produto
description: A IA do motor de características do Mercado Livre aprende com cada ajuste manual do lojista. Memória por (tenant, produto, nome da característica); última edição vence; aplicada antes da IA na cascata; não há histórico nem UI de edição.
type: feature
---

# ML — Memória de ajustes manuais por produto (v2.1.0)

## Regra de negócio
Toda vez que o lojista edita manualmente uma característica de um anúncio do Mercado Livre (inclui marcar "Não se aplica"), o valor é gravado como **preferência da loja para aquele produto**. Da próxima vez que o painel de características for aberto para o **mesmo produto**, o valor lembrado já entra preenchido (sem chamar a IA).

- Chave única: `(tenant_id, product_id, attribute_name)`. Casamento por **nome** da característica (ML troca IDs entre categorias — mesmo padrão da v2.0.0 para ANVISA). Fallback por ID quando disponível.
- **Última edição sempre vence.** Sem histórico, sem versionamento, sem promoção/contradição.
- **Sem UI de gerenciamento** — funciona em segundo plano. O rótulo "Editado manualmente" (roxo) já existente continua aparecendo nos campos preenchidos pela memória.
- **Isolamento por produto.** Edição em produto A não influencia produto B.
- **Limpeza em cascata.** Excluir o produto remove a memória.

## Cascata atualizada no motor
```
Cadastro do produto
   ↓
Derivação automática
   ↓
Dicionário universal
   ↓
👉 Memória de ajustes manuais da loja (este produto)
   ↓
Heurística determinística por nome do atributo
   ↓
IA
   ↓
Marcador "Não se aplica" (opcionais)
```

A memória entra **antes** da chamada de IA. Match positivo pula a IA inteiramente para aquela característica (economia de crédito/processamento).

## Compatibilidade com a categoria atual do ML
- **Texto livre** (Marca, Modelo, números regulatórios, descritivos): aplica direto.
- **Lista fechada**: valida se o valor lembrado existe na lista da categoria atual. Se não existir, a memória é **ignorada** para esse atributo e segue a cascata (IA pode opinar).
- **Multi-valor**: aplica cada item lembrado contra a lista atual; os que casarem entram.
- **"Não se aplica"**: usa a opção oficial da categoria quando existe; fallback "Não se aplica".

## Onde está aplicado
- Armazenamento: tabela `meli_product_attribute_memory` (RLS por tenant; cascade em delete de produto).
- Captura: `MeliAttributesPanel.handleEdit` e `handleMarkNotApplicable` chamam `upsert` direto no banco (silencioso, não bloqueia UX).
- Leitura/aplicação: `supabase/functions/meli-resolve-attributes/index.ts` carrega `tenantMemoryByName`/`tenantMemoryById` e aplica no início do loop por atributo.

## Proibido
- Criar UI de listagem/edição/remoção dessa memória sem aprovação explícita do usuário.
- Compartilhar memória entre produtos diferentes (mesmo da mesma loja).
- Versionar/manter histórico — a regra é "última edição vence".
- Aplicar memória da loja **acima** do cadastro/derivação/dicionário (a fonte primária continua sendo o cadastro do produto).
- Forçar valor lembrado em lista fechada que não tem o item — sempre validar antes.
