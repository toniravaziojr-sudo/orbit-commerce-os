import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Play, Pause } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FlowConfig } from "@/hooks/useAutomationBuilder";

interface AutomationTopBarProps {
  flowConfig: FlowConfig;
  onConfigChange: (config: FlowConfig) => void;
  onSave: () => void;
  onActivate: () => void;
  isSaving: boolean;
  flowStatus: string;
}

export function AutomationTopBar({
  flowConfig,
  onConfigChange,
  onSave,
  onActivate,
  isSaving,
  flowStatus,
}: AutomationTopBarProps) {
  const navigate = useNavigate();

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    archived: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    active: "Ativa",
    paused: "Pausada",
    archived: "Arquivada",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/email-marketing")}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Input
        value={flowConfig.name}
        onChange={(e) =>
          onConfigChange({ ...flowConfig, name: e.target.value })
        }
        placeholder="Nome da automação..."
        className="max-w-xs h-9 font-semibold"
      />

      <Badge className={statusColors[flowStatus] || statusColors.draft}>
        {statusLabels[flowStatus] || "Rascunho"}
      </Badge>

      <div className="flex-1" />

      <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving || !flowConfig.name.trim()}>
        <Save className="h-4 w-4 mr-1" />
        Salvar
      </Button>

      {flowStatus === "active" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onActivate()}
          disabled={isSaving}
        >
          <Pause className="h-4 w-4 mr-1" />
          Pausar
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onActivate}
          disabled={isSaving || !flowConfig.name.trim()}
        >
          <Play className="h-4 w-4 mr-1" />
          Ativar
        </Button>
      )}
    </div>
  );
}
