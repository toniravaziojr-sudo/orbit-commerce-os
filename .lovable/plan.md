# Mercado Livre — Onda 1.8.0 (Garantia, ANVISA, Multi-valor)

📌 STATUS: Ajuste aplicado — pendente de validação pelo lojista.

## O que mudou

1. **Tipos de cabelo / Formatos de tratamento capilar (multi-seleção)** agora marcam **todas** as opções aplicáveis. O sistema cruza nome + descrição + tipos cadastrados + lista oficial da categoria e marca tudo que faz sentido. Antes ia uma só ("Todo tipo de cabelo").
2. **Tipo de cuidado (single-select obrigatório)** sempre escolhe uma opção da lista do ML, com base no nome do produto e nos tratamentos cadastrados.
3. **Garantia** vai automática para o ML quando estiver preenchida no cadastro do produto (tipo + duração). Aparece no painel como verde "Do cadastro do produto" e pode ser editada manualmente.
4. **Órgão regulatório (ANVISA)** é preenchido automaticamente quando o produto for cosmético regime ANVISA, sempre que a categoria do ML expuser esse campo.
5. **Anti-erro**: atributos cujo ID não exista na categoria do ML são descartados antes do envio (evita rejeição do anúncio inteiro).

## Validação técnica
- Typecheck do projeto: ✅ passou.
- Mudanças preservam contratos do painel (campo `values` é aditivo; legado `value_name` continua funcionando).

## O que o lojista precisa testar
1. Abrir o wizard de anúncios com os mesmos 21 produtos → "Recalcular todos".
2. Conferir nas Características de um produto de calvície:
   - Tipos de cabelo deve aparecer com **várias** opções marcadas (Oleoso, Ralo, Crespo, etc.).
   - Formatos de tratamento capilar deve aparecer com pelo menos uma opção.
   - Tipo de cuidado deve aparecer preenchido.
   - Garantia (Tipo + Tempo) deve aparecer com origem "Do cadastro do produto".
3. Publicar e abrir no Mercado Livre → conferir que os 4 campos aparecem preenchidos e que o painel "Corrija as características" sumiu.

## Como atualizar os 21 anúncios já publicados
Anúncios não recebem atributo retroativo sozinhos. Selecionar os 21 no módulo de Anúncios → "Recalcular todos" no painel → "Salvar e publicar".

## 📝 Documentação atualizada
- `docs/especificacoes/marketplaces/mercado-livre.md` — nova seção v1.8.0.
- Memória `meli-resolve-attributes-hardening` — regra 13 nova.
- Índice de memórias atualizado.
