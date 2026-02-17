

# Diagnóstico E2E: 3 Bugs Encontrados no Fluxo de Criativos e Campanhas

## Resumo Executivo

A geração de imagens funciona (as imagens existem no storage), mas o fluxo completo falha por 3 bugs distintos que impedem a IA de criar campanhas do zero com sucesso.

---

## Bug 1: Imagens vão para a pasta errada no Drive

**Sintoma**: A pasta "Gestor de Tráfego IA" está vazia no Meu Drive (como mostra seu screenshot).

**Causa**: A edge function `creative-image-generate` ignora o parâmetro `output_folder_id` que recebe do `ads-autopilot-creative`. Em vez de usar a pasta "Gestor de Tráfego IA", ela sempre cria/usa sua propia pasta fixa chamada "Criativos com IA" (dentro de "Uploads do sistema").

**Prova**: As 4 imagens geradas as 23:25 estao na pasta "Criativos com IA" (folder_id: `26a7cca5`), NAO na pasta "Gestor de Tráfego IA" (folder_id: `bce0665a`).

**Correção**: Na `creative-image-generate`, ao extrair o body, incluir `output_folder_id`. Se fornecido, usar esse folder em vez do padrão "Criativos com IA". Isso afeta 2 pontos no codigo (linhas 539-546 e 596-621).

---

## Bug 2: Geração de imagem é assincrona, mas criação de campanha é sincrona (Race Condition)

**Sintoma**: A IA chama `generate_creative_image` e `create_meta_campaign` no MESMO round de ferramentas (Tool round 2). A geração de imagem usa `EdgeRuntime.waitUntil()` e retorna imediatamente. Quando `create_meta_campaign` tenta buscar o criativo na tabela `ads_creative_assets`, ele ainda nao existe (o job está rodando em background), entao cai no fallback de imagem do catalogo.

**Prova nos logs**:
```
Tool round 2: get_product_images, generate_creative_image, create_meta_campaign, create_meta_campaign
Using catalog image for Kit Banho Calvície Zero (2x) Noite: [URL do catalogo]
```

**Causa**: `generate_creative_image` dispara a edge function `ads-autopilot-creative` que chama `creative-image-generate` que processa em background (~69 segundos). O `create_meta_campaign` roda em paralelo e nao encontra os assets.

**Correção**: No prompt do sistema da IA (dentro de `ads-chat`), adicionar instrução explícita: "NUNCA chame `generate_creative_image` e `create_meta_campaign` no mesmo round. Primeiro gere as imagens, aguarde confirmação, e só no round seguinte crie a campanha." Alternativamente, no codigo de `createMetaCampaign`, adicionar um polling/wait curto nos `ads_creative_assets` antes de cair no fallback.

---

## Bug 3: Erro de permissão no upload de imagens para Meta (adimages API)

**Sintoma**: A IA reportou "erro de permissão no upload de imagens" e desistiu de criar campanhas novas, usando apenas campanhas existentes.

**Causa provável**: A URL da imagem passada para `/act_{id}/adimages` (endpoint da Meta para upload) é uma URL interna do Supabase storage. A Meta precisa baixar essa URL, mas se o bucket `media-assets` estiver configurado como privado ou a URL nao for acessivel publicamente, a Meta retorna erro.

**Verificação necessaria**: Confirmar se o bucket `media-assets` tem acesso publico habilitado. As URLs geradas usam o path `/storage/v1/object/public/media-assets/...` — o "public" no path indica acesso publico, mas se o bucket nao estiver configurado assim, a Meta nao consegue baixar.

**Correção**: Se o bucket nao for publico, ou usar signed URLs (com token temporario de 30 dias) para o upload, ou usar a API da Meta com upload direto (multipart) em vez de URL.

---

## Plano de Correção (Ordem de Execução)

### Passo 1: Fix creative-image-generate (Bug 1)
- Extrair `output_folder_id` do body na `creative-image-generate`
- Se fornecido, usar em vez do folder padrao "Criativos com IA"
- Incrementar VERSION para v3.2.0

### Passo 2: Fix Race Condition (Bug 2)
- Adicionar instrução no system prompt do `ads-chat` proibindo gerar imagem e criar campanha no mesmo round
- Alternativamente: no `createMetaCampaign`, antes de usar fallback, verificar se ha `creative_jobs` recentes em status `running` para o produto e aguardar ou avisar

### Passo 3: Diagnosticar/Fix permissão Meta (Bug 3)
- Verificar configuração do bucket `media-assets`
- Se necessario, usar signed URLs ou upload direto multipart para a API da Meta

### Passo 4: Atualizar VERSION do ads-chat
- De v5.9.5 para v5.9.7

### Passo 5: Redeploy
- `creative-image-generate`
- `ads-chat`

---

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/creative-image-generate/index.ts` | Respeitar `output_folder_id` do body |
| `supabase/functions/ads-chat/index.ts` | Instrução no prompt + VERSION update |

