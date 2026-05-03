import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bot, Brain, MessageCircle } from "lucide-react";
import { useAiSupportConfig, type AiSupportConfig, type AIRule } from "@/hooks/useAiSupportConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { AIRulesEditor } from "./AIRulesEditor";
import { AILanguageDictionaryEditor } from "./AILanguageDictionaryEditor";
import { AIIntentObjectionEditor } from "./AIIntentObjectionEditor";
import { AIBusinessContextSection } from "./AIBusinessContextSection";
import { AIContextChecklistCard } from "./AIContextChecklistCard";

/**
 * Onda 1A.1 — Configuração da IA reorganizada em 5 abas:
 * Essencial | Conhecimento | Atendimento | Vendas | Avançado.
 *
 * Apenas reorganização visual. Fontes de verdade preservadas:
 * - business_context, attendance_rules, custom_knowledge, system_prompt → ai_support_config
 * - banned_claims, do_not_do → tenant_brand_context
 * - ai_language_dictionary, ai_intent_objection_map, knowledge_base_docs inalterados.
 */
type TabId = "essencial" | "atendimento";

// Maps anchor IDs → tab where the anchor lives. Used by checklist CTAs.
const ANCHOR_TO_TAB: Record<string, TabId> = {
  "#bloco-contexto": "essencial",
  "#bloco-regras": "essencial",
  "#bloco-claims": "essencial",
  "#bloco-conhecimento-adicional": "essencial",
  "#bloco-vendas": "essencial",
  "#tab-objections": "atendimento",
};

export function AIConfigPanel() {
  const { config, isLoading, upsertConfig } = useAiSupportConfig();
  const [localConfig, setLocalConfig] = useState<Partial<AiSupportConfig>>({});
  const [rules, setRules] = useState<AIRule[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("essencial");

  useEffect(() => {
    if (config?.rules) setRules(config.rules);
  }, [config?.rules]);

  const handleSave = () => upsertConfig.mutate({ ...localConfig, rules });

  const updateField = <K extends keyof AiSupportConfig>(key: K, value: AiSupportConfig[K]) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
  };

  const getValue = <K extends keyof AiSupportConfig>(key: K): AiSupportConfig[K] | undefined => {
    return (localConfig[key] as AiSupportConfig[K]) ?? config?.[key];
  };

  const handleAnchorNavigate = (target: string) => {
    const tab = ANCHOR_TO_TAB[target];
    if (tab && tab !== activeTab) setActiveTab(tab);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configuração da IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Personalize como a IA atende seus clientes
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="ai-enabled"
              checked={getValue("is_enabled") ?? true}
              onCheckedChange={(checked) => updateField("is_enabled", checked)}
            />
            <Label htmlFor="ai-enabled">IA Ativa</Label>
          </div>
          <Button onClick={handleSave} disabled={upsertConfig.isPending}>
            {upsertConfig.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <AIContextChecklistCard onNavigateAnchor={handleAnchorNavigate} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="essencial" className="gap-2">
            <Brain className="h-4 w-4" />
            Conhecimento Essencial
          </TabsTrigger>
          <TabsTrigger value="atendimento" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Atendimento
          </TabsTrigger>
        </TabsList>

        {/* ========== CONHECIMENTO ESSENCIAL ========== */}
        <TabsContent value="essencial" className="space-y-4 mt-4">
          <AIBusinessContextSection
            businessContext={getValue("business_context") || ""}
            attendanceRules={getValue("attendance_rules") || ""}
            onChange={(patch) => setLocalConfig((prev) => ({ ...prev, ...patch }))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fontes de Conhecimento</CardTitle>
              <CardDescription>
                A IA aprende automaticamente sobre seu negócio a partir destas fontes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Produtos</Label>
                    <p className="text-xs text-muted-foreground">Catálogo, preços, descrições</p>
                  </div>
                  <Switch
                    checked={getValue("auto_import_products") ?? true}
                    onCheckedChange={(checked) => updateField("auto_import_products", checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Categorias</Label>
                    <p className="text-xs text-muted-foreground">Organização do catálogo</p>
                  </div>
                  <Switch
                    checked={getValue("auto_import_categories") ?? true}
                    onCheckedChange={(checked) => updateField("auto_import_categories", checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Políticas</Label>
                    <p className="text-xs text-muted-foreground">Trocas, devoluções, frete</p>
                  </div>
                  <Switch
                    checked={getValue("auto_import_policies") ?? true}
                    onCheckedChange={(checked) => updateField("auto_import_policies", checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>FAQs</Label>
                    <p className="text-xs text-muted-foreground">Perguntas frequentes</p>
                  </div>
                  <Switch
                    checked={getValue("auto_import_faqs") ?? true}
                    onCheckedChange={(checked) => updateField("auto_import_faqs", checked)}
                  />
                </div>
              </div>

              <div id="bloco-conhecimento-adicional" className="space-y-2 scroll-mt-24 pt-4 border-t">
                <Label>Conhecimento adicional</Label>
                <p className="text-xs text-muted-foreground">
                  Detalhes específicos da loja, exceções, promoções e informações que não cabem nas fontes acima.
                </p>
                <Textarea
                  placeholder="Ex.: O Kit Banho leva 2 dias úteis a mais para envio. Cupom BEMVINDO10 só vale primeira compra."
                  value={getValue("custom_knowledge") || ""}
                  onChange={(e) => updateField("custom_knowledge", e.target.value)}
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>

          {/* Modo Vendas (antiga aba Vendas) */}
          <Card id="bloco-vendas" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Modo Vendas
                <Badge variant={getValue("sales_mode_enabled") ? "default" : "secondary"}>
                  {getValue("sales_mode_enabled") ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Quando ativado, a IA pode buscar produtos, oferecer cupons, montar carrinho e gerar links de checkout durante a conversa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Ativar Modo Vendas</Label>
                  <p className="text-sm text-muted-foreground">
                    A IA poderá sugerir produtos, aplicar cupons e gerar links de checkout durante o atendimento.
                  </p>
                </div>
                <Switch
                  checked={getValue("sales_mode_enabled") ?? false}
                  onCheckedChange={(checked) => updateField("sales_mode_enabled", checked)}
                />
              </div>
              {getValue("sales_mode_enabled") && (
                <div className="space-y-2 pl-4 border-l-2 border-primary/30 text-sm text-muted-foreground">
                  <p className="font-medium">Com o Modo Vendas ativo, a IA poderá:</p>
                  <ul className="space-y-1">
                    <li>• Buscar e sugerir produtos do catálogo</li>
                    <li>• Verificar cupons e elegibilidade para descontos</li>
                    <li>• Montar carrinho conversacional</li>
                    <li>• Oferecer upsells quando disponíveis</li>
                    <li>• Gerar link de checkout pré-preenchido</li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atendimento" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identidade da IA</CardTitle>
              <CardDescription>Como a IA se apresenta na conversa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do assistente</Label>
                  <Input
                    placeholder="Ex: Sofia, Assistente Virtual"
                    value={getValue("personality_name") || ""}
                    onChange={(e) => updateField("personality_name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tom de voz</Label>
                  <Select
                    value={getValue("personality_tone") || "friendly"}
                    onValueChange={(v) =>
                      updateField("personality_tone", v as "formal" | "friendly" | "casual")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="friendly">Amigável</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="use-emojis"
                  checked={getValue("use_emojis") ?? true}
                  onCheckedChange={(checked) => updateField("use_emojis", checked)}
                />
                <Label htmlFor="use-emojis">Usar emojis</Label>
              </div>
            </CardContent>
          </Card>

          <div id="tab-objections" className="scroll-mt-24">
            <AIIntentObjectionEditor />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Regras condicionais de comportamento</CardTitle>
              <CardDescription>
                Quando o cliente fizer X, a IA deve fazer Y. Para regras gerais em texto livre, use a aba Essencial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIRulesEditor rules={rules} onChange={setRules} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transferência para humano</CardTitle>
              <CardDescription>Quando a IA deve passar o atendimento para um agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Máximo de mensagens antes de sugerir humano</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={getValue("max_messages_before_handoff") || 10}
                  onChange={(e) => updateField("max_messages_before_handoff", parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Palavras-chave para transferência</Label>
                <Input
                  placeholder="falar com humano, atendente, pessoa"
                  value={(getValue("handoff_keywords") || []).join(", ")}
                  onChange={(e) =>
                    updateField(
                      "handoff_keywords",
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Separe por vírgula. Quando detectadas, a IA transfere para humano.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="approval-mode"
                  checked={getValue("approval_mode") ?? false}
                  onCheckedChange={(checked) => updateField("approval_mode", checked)}
                />
                <Label htmlFor="approval-mode">Modo de aprovação</Label>
                <Badge variant="secondary">Avançado</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando ativo, respostas da IA precisam ser aprovadas antes de enviar.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tratamento de mídia</CardTitle>
              <CardDescription>Como a IA lida com imagens, áudios e arquivos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={getValue("handle_images") ?? true}
                    onCheckedChange={(checked) => updateField("handle_images", checked)}
                  />
                  <Label>Analisar imagens</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={getValue("handle_audio") ?? true}
                    onCheckedChange={(checked) => updateField("handle_audio", checked)}
                  />
                  <Label>Transcrever áudios</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={getValue("handle_files") ?? true}
                    onCheckedChange={(checked) => updateField("handle_files", checked)}
                  />
                  <Label>Analisar documentos</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">O que evitar nas conversas</CardTitle>
              <CardDescription>
                Diferente de <em>claims/promessas proibidas</em> (aba Essencial), que são promessas comerciais ou jurídicas que sua marca não pode fazer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tópicos proibidos</Label>
                <Input
                  placeholder="política, religião, concorrentes"
                  value={(getValue("forbidden_topics") || []).join(", ")}
                  onChange={(e) =>
                    updateField(
                      "forbidden_topics",
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Assuntos que a IA não deve tratar.
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Termos proibidos</strong> (palavras/frases específicas que a IA nunca deve usar) ficam no
                <em> Vocabulário e linguagem do nicho</em>, na aba Conhecimento.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== VENDAS ========== */}
        <TabsContent value="vendas" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Modo Vendas
                <Badge variant={getValue("sales_mode_enabled") ? "default" : "secondary"}>
                  {getValue("sales_mode_enabled") ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Quando ativado, a IA se torna um agente de vendas conversacional capaz de buscar produtos,
                oferecer cupons, montar carrinho e gerar links de checkout pré-preenchidos — tudo dentro da conversa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Ativar Modo Vendas</Label>
                  <p className="text-sm text-muted-foreground">
                    A IA poderá sugerir produtos, aplicar cupons e gerar links de checkout durante o atendimento.
                  </p>
                </div>
                <Switch
                  checked={getValue("sales_mode_enabled") ?? false}
                  onCheckedChange={(checked) => updateField("sales_mode_enabled", checked)}
                />
              </div>

              {getValue("sales_mode_enabled") && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                  <p className="text-sm font-medium text-muted-foreground">Com o Modo Vendas ativo, a IA poderá:</p>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Buscar e sugerir produtos do catálogo durante a conversa</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Verificar cupons e elegibilidade do cliente para descontos</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Montar um carrinho conversacional com itens selecionados</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Oferecer upsells e ofertas de aumento de ticket quando disponíveis</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span><span>Gerar link de checkout com dados do cliente já preenchidos</span></li>
                  </ul>
                </div>
              )}

              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Em breve: regras de oferta, cupom automático, upsell e cross-sell configuráveis aqui.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== AVANÇADO ========== */}
        <TabsContent value="avancado" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurações técnicas</CardTitle>
              <CardDescription>
                Itens sensíveis que afetam diretamente o motor da IA. Altere apenas se souber o que está fazendo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modelo de IA</Label>
                <Select
                  value={getValue("ai_model") || "gpt-5.2"}
                  onValueChange={(v) => updateField("ai_model", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5.2">
                      <span className="flex items-center gap-2">
                        GPT-5.2 <Badge variant="secondary" className="text-xs">Recomendado</Badge>
                      </span>
                    </SelectItem>
                    <SelectItem value="gpt-5">GPT-5 (Alta qualidade)</SelectItem>
                    <SelectItem value="gpt-5-mini">GPT-5 Mini (Equilibrado)</SelectItem>
                    <SelectItem value="gpt-5-nano">GPT-5 Nano (Econômico)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Modelos mais avançados oferecem respostas melhores, mas consomem mais créditos.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tamanho máximo de resposta (caracteres)</Label>
                <Input
                  type="number"
                  min={100}
                  max={2000}
                  value={getValue("max_response_length") || 500}
                  onChange={(e) => updateField("max_response_length", parseInt(e.target.value))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Meta de primeira resposta (segundos)</Label>
                  <Input
                    type="number"
                    min={5}
                    value={getValue("target_first_response_seconds") || 60}
                    onChange={(e) =>
                      updateField("target_first_response_seconds", parseInt(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meta de resolução (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={getValue("target_resolution_minutes") || 30}
                    onChange={(e) =>
                      updateField("target_resolution_minutes", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prompt do sistema (legado)</CardTitle>
              <CardDescription>
                Mantido por compatibilidade. Use a aba Essencial para configurar a IA. Este campo continua sendo lido durante a transição.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Mostrar / editar prompt do sistema
                </summary>
                <Textarea
                  className="mt-3"
                  value={getValue("system_prompt") || ""}
                  onChange={(e) => updateField("system_prompt", e.target.value)}
                  rows={6}
                  placeholder="Instruções adicionais para a IA…"
                />
              </details>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
