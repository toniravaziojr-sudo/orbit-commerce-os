import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAiChannelConfig } from "@/hooks/useAiChannelConfig";
import type { SupportChannelType } from "@/hooks/useConversations";
import { Loader2, Bot, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AIChannelConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelType: SupportChannelType;
  channelName: string;
}

const channelRestrictions: Partial<Record<SupportChannelType, { name: string; restrictions: string[] }>> = {
  mercadolivre: {
    name: "Mercado Livre",
    restrictions: [
      "Não é permitido enviar links externos",
      "Não mencionar outras plataformas de venda",
      "Não solicitar contato fora da plataforma",
    ]
  },
  shopee: {
    name: "Shopee",
    restrictions: [
      "Não é permitido enviar links externos",
      "Não mencionar outras plataformas de venda",
    ]
  },
  tiktokshop: {
    name: "TikTok Shop",
    restrictions: [
      "Não é permitido enviar links externos",
      "Não mencionar outras plataformas de venda",
      "Não solicitar contato fora da plataforma",
    ]
  },
  whatsapp: { name: "WhatsApp", restrictions: [] },
  email: { name: "Email", restrictions: [] },
  facebook_messenger: { name: "Messenger", restrictions: [] },
  instagram_dm: { name: "Instagram DM", restrictions: [] },
  chat: { name: "Chat do Site", restrictions: [] },
};

export function AIChannelConfigDialog({ open, onOpenChange, channelType, channelName }: AIChannelConfigDialogProps) {
  const { config, isLoading, upsertConfig } = useAiChannelConfig(channelType);
  
  const [isEnabled, setIsEnabled] = useState(true);
  const [customInstructions, setCustomInstructions] = useState("");
  const [forbiddenTopics, setForbiddenTopics] = useState("");
  const [maxResponseLength, setMaxResponseLength] = useState<string>("");
  const [useEmojis, setUseEmojis] = useState<boolean | null>(null);

  const channelInfo = channelRestrictions[channelType] || { name: channelName, restrictions: [] };

  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setCustomInstructions(config.custom_instructions || "");
      setForbiddenTopics(config.forbidden_topics?.join(", ") || "");
      setMaxResponseLength(config.max_response_length?.toString() || "");
      setUseEmojis(config.use_emojis);
    } else {
      // Defaults
      setIsEnabled(true);
      setCustomInstructions("");
      setForbiddenTopics("");
      setMaxResponseLength("");
      setUseEmojis(null);
    }
  }, [config, open]);

  const handleSave = async () => {
    const topics = forbiddenTopics
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    await upsertConfig.mutateAsync({
      channel_type: channelType,
      is_enabled: isEnabled,
      custom_instructions: customInstructions || null,
      forbidden_topics: topics,
      max_response_length: maxResponseLength ? parseInt(maxResponseLength) : null,
      use_emojis: useEmojis,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configurar IA - {channelName}
          </DialogTitle>
          <DialogDescription>
            Personalize o comportamento da IA para o canal {channelName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Restrições do canal */}
            {channelInfo.restrictions.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-2">Regras do {channelInfo.name}:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {channelInfo.restrictions.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2 text-muted-foreground">
                    A IA já aplica essas restrições automaticamente.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Ativar IA neste canal */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Ativar IA neste canal</Label>
                <p className="text-sm text-muted-foreground">
                  A IA responderá automaticamente neste canal
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            {isEnabled && (
              <>
                {/* Instruções personalizadas */}
                <div className="space-y-2">
                  <Label>Instruções adicionais para este canal</Label>
                  <Textarea
                    placeholder={`Ex: Neste canal, seja mais formal. Sempre mencione o prazo de entrega...`}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Instruções específicas que a IA seguirá apenas neste canal
                  </p>
                </div>

                {/* Tópicos proibidos */}
                <div className="space-y-2">
                  <Label>Tópicos proibidos neste canal</Label>
                  <Input
                    placeholder="preços concorrentes, promoções futuras, ..."
                    value={forbiddenTopics}
                    onChange={(e) => setForbiddenTopics(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Separados por vírgula. A IA evitará esses assuntos
                  </p>
                </div>

                {/* Comprimento máximo */}
                <div className="space-y-2">
                  <Label>Limite de caracteres por resposta</Label>
                  <Input
                    type="number"
                    placeholder="Usar padrão geral"
                    value={maxResponseLength}
                    onChange={(e) => setMaxResponseLength(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para usar o limite geral da configuração de IA
                  </p>
                </div>

                {/* Usar emojis */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Usar emojis</Label>
                    <p className="text-sm text-muted-foreground">
                      {useEmojis === null ? "Usar configuração geral" : useEmojis ? "Ativado" : "Desativado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {useEmojis === null ? "Padrão" : useEmojis ? "Sim" : "Não"}
                    </Badge>
                    <Switch
                      checked={useEmojis === true}
                      onCheckedChange={(checked) => setUseEmojis(checked ? true : useEmojis === true ? false : null)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={upsertConfig.isPending}>
            {upsertConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
