# Memory: features/marketing/ads-autopilot-creative-funnel-matching-v1-20-0
Updated: now

## Vínculo de Criativos por Funil (v1.26.0)

### Regra Principal (INVIOLÁVEL)
É **terminantemente proibido** reutilizar os mesmos criativos e copys entre campanhas de Topo de Funil (TOF/Venda Direta) e Fundo de Funil (BOF/Remarketing).

### Lógica Estratégica
- **TOF (Venda Direta):** Criativos de aquisição — apresentam o produto pela primeira vez ao público frio.
- **BOF (Remarketing):** Criativos de reconversão — o cliente já viu os criativos de TOF e não comprou. Mostrar os mesmos criativos é ineficaz.
- **Remarketing deve usar:** ângulos diferentes (prova social, urgência, comparativo, depoimento, kit/bundle), copys distintas e, quando possível, formatos visuais diferenciados.

### Implementação Técnica
- O parâmetro `funnel_stage` (`tof`, `mof`, `bof`, `test`) é **obrigatório** na ferramenta `generate_creative`.
- O matching de criativos na Fase 2 (montagem) exige correspondência de `product_id` AND `funnel_stage`.
- A IA deve gerar criativos separados para cada estágio do funil, com ângulos e copys distintos.

### Checklist Anti-Regressão
- [ ] Criativos de BOF nunca são iguais aos de TOF para o mesmo produto
- [ ] `funnel_stage` sempre propagado nos metadados do ativo
- [ ] Copys de remarketing atacam objeções diferentes das copys de aquisição
