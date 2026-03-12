
Objetivo: corrigir definitivamente o campo de CEP no mini carrinho para impedir “duplo hífen”, liberar edição com Backspace/Delete e manter o limite correto de 8 dígitos (máscara XXXXX-XXX).

Diagnóstico do problema (com base no código atual):
- O campo com bug é o do mini carrinho (`src/components/storefront/MiniCartDrawer.tsx`), que ainda está em padrão legado.
- Hoje ele salva CEP já mascarado no estado compartilhado (`setShippingCep(formatted)`), em vez de salvar apenas dígitos.
- O input usa `value={shipping.cep}` direto e não aplica o padrão “estado limpo” completo (faltam atributos e proteção extra para autofill), o que favorece comportamento inconsistente ao usar pré-seleção do navegador.
- Resultado: hífen pode ficar “travado” na edição, ocorrer máscara inconsistente, e o último dígito pode ser bloqueado.

Plano de implementação:
1) Padronizar o CEP do mini carrinho para “estado limpo”
- Manter no estado apenas dígitos (`0-9`, máximo 8).
- Aplicar máscara apenas na renderização (`value`).
- Ajustar `handleCepChange` para sempre normalizar com `replace(/\D/g, '').slice(0,8)`.

2) Blindar o estado global do carrinho
- Em `src/contexts/CartContext.tsx`, normalizar dentro de `setShippingCep` (defesa central).
- Normalizar também CEP vindo de hidratação antiga do localStorage (para limpar dados legados com hífen duplicado).

3) Fortalecer comportamento de input no mini carrinho
- Adicionar `inputMode="numeric"`, `autoComplete="off"`, `autoCorrect="off"`.
- Manter `maxLength={9}` (está correto para máscara brasileira).
- Garantir que ao colar ou autofill o valor seja saneado para 8 dígitos antes de salvar.

4) Ajustar exibição onde necessário
- Onde `shipping.cep` é exibido como texto (ex.: resumo), aplicar formatação de exibição para não mostrar CEP “cru” caso o estado passe a ser só dígitos.

5) Validação funcional (fim a fim)
- Digitação manual: `45990408` deve virar `45990-408` com apenas 1 hífen.
- Backspace contínuo do fim até vazio sem travar no hífen.
- Selecionar CEP da sugestão do navegador sem gerar duplo hífen.
- Selecionar tudo + Delete e redigitar: aceitar o último dígito normalmente.
- Cálculo de frete continua funcionando no mini carrinho, carrinho e checkout.

Detalhes técnicos:
- Arquivos principais:
  - `src/components/storefront/MiniCartDrawer.tsx` (correção principal do campo com bug)
  - `src/contexts/CartContext.tsx` (normalização central de CEP)
  - `src/components/storefront/checkout/CheckoutShipping.tsx` (garantia de exibição consistente, se necessário)
- Estratégia de prevenção de regressão:
  - Unificar regra: “estado = dígitos, UI = máscara”.
  - Normalização na borda de entrada + normalização no setter global.
  - Compatibilidade com dados antigos armazenados no navegador.
