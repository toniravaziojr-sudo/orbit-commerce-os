import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmailPreview } from "./EmailPreview";
import { CampaignConfig, CampaignContent } from "@/hooks/useEmailCampaignBuilder";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { Send, Clock, Loader2, Mail, Users, ListPlus } from "lucide-react";

interface StepReviewProps {
  config: CampaignConfig;
  content: CampaignContent;
  html: string;
  onSend: (scheduledAt?: string) => Promise<void>;
  isSending: boolean;
}

export function StepReview({ config, content, html, onSend, isSending }: StepReviewProps) {
  const { lists } = useEmailMarketing();
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");

  const selectedList = lists.find((l: any) => l.id === config.list_id);

  const handleSend = () => {
    if (mode === "schedule" && scheduleDate) {
      onSend(new Date(scheduleDate).toISOString());
    } else {
      onSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo da Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Campanha</p>
                <p className="font-medium text-sm truncate">{config.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <ListPlus className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Lista</p>
                <p className="font-medium text-sm truncate">{selectedList?.name || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Assunto</p>
                <p className="font-medium text-sm truncate">{content.subject}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge variant="secondary">{config.type === 'broadcast' ? 'Broadcast' : 'Automação'}</Badge>
            <Badge variant="outline">{content.blocks.length} blocos</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preview do Email</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailPreview html={html} />
        </CardContent>
      </Card>

      {/* Send options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Envio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant={mode === "now" ? "default" : "outline"}
              onClick={() => setMode("now")}
              className="gap-2"
            >
              <Send className="h-4 w-4" /> Enviar agora
            </Button>
            <Button
              variant={mode === "schedule" ? "default" : "outline"}
              onClick={() => setMode("schedule")}
              className="gap-2"
            >
              <Clock className="h-4 w-4" /> Agendar
            </Button>
          </div>

          {mode === "schedule" && (
            <div className="space-y-2 max-w-xs">
              <Label>Data e hora de envio</Label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
              />
            </div>
          )}

          <Button
            size="lg"
            onClick={handleSend}
            disabled={isSending || (mode === "schedule" && !scheduleDate)}
            className="gap-2 mt-2"
          >
            {isSending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="h-4 w-4" /> {mode === "now" ? "Enviar Campanha" : "Agendar Campanha"}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
