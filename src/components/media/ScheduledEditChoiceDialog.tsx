import { RefreshCw, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaCalendarItem } from "@/hooks/useMediaCampaigns";

interface ScheduledEditChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MediaCalendarItem | null;
  onReplace: (item: MediaCalendarItem) => void;
  onDuplicate: (item: MediaCalendarItem) => void;
}

export function ScheduledEditChoiceDialog({
  open,
  onOpenChange,
  item,
  onReplace,
  onDuplicate,
}: ScheduledEditChoiceDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Item Agendado
          </DialogTitle>
          <DialogDescription>
            Este item já está agendado para publicação. Como deseja prosseguir?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <button
            type="button"
            onClick={() => {
              onReplace(item);
              onOpenChange(false);
            }}
            className="w-full flex items-start gap-3 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
          >
            <RefreshCw className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Editar e substituir agendamento</p>
              <p className="text-xs text-muted-foreground mt-1">
                Abre o editor. Ao salvar, o agendamento anterior será cancelado e o item voltará para aprovação com o mesmo horário.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onDuplicate(item);
              onOpenChange(false);
            }}
            className="w-full flex items-start gap-3 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
          >
            <Copy className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Duplicar como nova versão</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cria uma cópia como rascunho novo, sem mexer no agendamento atual.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
