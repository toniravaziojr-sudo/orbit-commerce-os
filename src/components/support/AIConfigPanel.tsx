import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Bot, Brain, MessageCircle, Sparkles } from "lucide-react";
import { useAiSupportConfig, type AiSupportConfig, type AIRule } from "@/hooks/useAiSupportConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { AIRulesEditor } from "./AIRulesEditor";
import { AILanguageDictionaryEditor } from "./AILanguageDictionaryEditor";
import { AIIntentObjectionEditor } from "./AIIntentObjectionEditor";
import { AIBusinessContextSection } from "./AIBusinessContextSection";
import { AIContextChecklistCard } from "./AIContextChecklistCard";
import { AIPageRoleSummary } from "./AIPageRoleSummary";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type TabId = "essencial" | "atendimento";

const ANCHOR_TO_TAB: Record<string, TabId> = {
  "#bloco-contexto": "essencial",
  "#bloco-regras": "essencial",
  "#bloco-claims": "essencial",
  "#bloco-conhecimento-adicional": "essencial",
  "#bloco-vendas": "essencial",
  "#bloco-paginas": "essencial",
  "#tab-objections": "atendimento",
};

export function AIConfigPanel() {
  const { config, isLoading, upsertConfig } = useAiSupportConfig();
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<Partial<AiSupportConfig>>({});
  const [rules, setRules] = useState<AIRule[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("essencial");
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

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

  const handleBootstrap = async () => {
    if (!currentTenant?.id) return;
    setBootstrapLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-config-bootstrap", {
        body: { tenant_id: currentTenant.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao gerar");
      // limpa o draft local para refletir o que veio do servidor
      setLocalConfig({});
      await queryClient.invalidateQueries({ queryKey: ["ai-support-config"] });
      toast.success("Configurações preenchidas pela IA. Revise e ajuste antes de salvar alterações.");
    } catch (e) {
      toast.error(`Erro ao preencher com IA: ${(e as Error).message}`);
    } finally {
      setBootstrapLoading(false);
    }
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

  const aiActive = getValue("is_enabled") ?? true;
  const salesActive = getValue("sales_mode_enabled") ?? false;

  return (
    <div className="space-y-4 p-4">
      {/* HEADER MASTER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configuração da IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Personalize como a IA atende e vende para seus clientes
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Master toggle */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
            <Switch
              id="ai-master"
              checked={aiActive}
              onCheckedChange={(checked) => updateField("is_enabled", checked)}
            />
            <Label htmlFor="ai-master" className="font-medium">
              {aiActive ? "IA Ativa" : "Ativar IA"}
            </Label>
          </div>

          {/* Sub-toggles aparecem só quando IA Ativa */}
          {aiActive && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground mr-1">Modos:</span>
              <div className="flex items-center gap-2 pr-3 border-r">
                <Switch id="mode-attendance" checked disabled />
                <Label htmlFor="mode-attendance" className="text-sm">Atendimento</Label>
              </div>
              <div className="flex items-center gap-2 pl-1">
                <Switch
                  id="mode-sales"
                  checked={salesActive}
                  onCheckedChange={(checked) => updateField("sales_mode_enabled", checked)}
                />
                <Label htmlFor="mode-sales" className="text-sm">Modo Vendas</Label>
              </div>
            </div>
          )}

          {/* Botão central de bootstrap */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={bootstrapLoading}>
                <Sparkles className="h-4 w-4 mr-1" />
                {bootstrapLoading ? "Gerando..." : "Preencher com IA"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Preencher configurações com IA?</AlertDialogTitle>
                <AlertDialogDescription>
                  A IA vai analisar seu catálogo e gerar automaticamente o
                  <strong> Contexto do negócio</strong>, as <strong>Regras gerais
                  de atendimento</strong> e o <strong>Conhecimento adicional</strong>.
                  <br /><br />
                  <strong className="text-destructive">Tudo que você já preencheu nesses três campos será substituído.</strong>
                  <br /><br />
                  Use isso como ponto de partida — depois revise e ajuste manualmente o que achar melhor.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleBootstrap}>
                  Sim, preencher
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
            hideRules
          />

          {/* Conhecimento adicional (texto livre) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conhecimento adicional</CardTitle>
              <CardDescription>
                Detalhes específicos da loja, exceções, promoções e informações que não cabem nos campos acima.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div id="bloco-conhecimento-adicional" className="scroll-mt-24">
                <Textarea
                  placeholder="Ex.: O Kit Banho leva 2 dias úteis a mais para envio. Cupom BEMVINDO10 só vale primeira compra. Atendemos somente o Brasil."
                  value={getValue("custom_knowledge") || ""}
                  onChange={(e) => updateField("custom_knowledge", e.target.value)}
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Páginas oficiais (FAQ + Políticas) — agora marcadas dentro de cada página */}
          <div id="bloco-paginas" className="scroll-mt-24">
            <AIPageRoleSummary />
          </div>

          {/* Fontes automáticas (Produtos / Categorias) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fontes automáticas de catálogo</CardTitle>
              <CardDescription>
                A IA aprende automaticamente sobre produtos e categorias da sua loja.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== ATENDIMENTO ========== */}
        <TabsContent value="atendimento" className="space-y-4 mt-4">
          {/* Identidade + Linguagem agrupados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identidade e linguagem</CardTitle>
              <CardDescription>
                Como a IA se apresenta e como ela fala com seus clientes — tudo num lugar só.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do assistente</Label>
                <Input
                  placeholder="Ex.: Sofia, Assistente Virtual"
                  value={getValue("personality_name") || ""}
                  onChange={(e) => updateField("personality_name", e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t">
                <Switch
                  id="use-emojis"
                  checked={getValue("use_emojis") ?? true}
                  onCheckedChange={(checked) => updateField("use_emojis", checked)}
                />
                <Label htmlFor="use-emojis">Usar emojis nas respostas</Label>
              </div>
            </CardContent>
          </Card>

          {/* Vocabulário & dicionário (contém Estilo do tom + tratamento) */}
          <AILanguageDictionaryEditor />

          {/* Objeções e intenções */}
          <div id="tab-objections" className="scroll-mt-24">
            <AIIntentObjectionEditor />
          </div>

          {/* Regras condicionais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Regras condicionais (Quando X → faça Y)</CardTitle>
              <CardDescription>
                Para regras gerais em texto livre, use a aba Conhecimento Essencial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIRulesEditor rules={rules} onChange={setRules} />
            </CardContent>
          </Card>

          {/* Transferência para humano */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transferência para humano</CardTitle>
              <CardDescription>Quando a IA deve passar o atendimento para um agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                </div>
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

          {/* Mídia */}
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

          {/* Restrições de conversa — UNIFICADO (tópicos + termos) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Restrições de conversa</CardTitle>
              <CardDescription>
                Assuntos e palavras que a IA nunca deve abordar. Para promessas comerciais
                ou jurídicas, use <em>Claims/promessas proibidas</em> na aba Conhecimento Essencial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Lista de restrições (separadas por vírgula)</Label>
                <Input
                  placeholder="política, religião, concorrentes, palavrão"
                  value={(getValue("forbidden_topics") || []).join(", ")}
                  onChange={(e) =>
                    updateField(
                      "forbidden_topics",
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  A IA não tratará desses assuntos nem usará essas palavras nas respostas.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
