import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Image as ImageIcon, FileText, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MediaCalendarItem } from "@/hooks/useMediaCampaigns";

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MediaCalendarItem[];
  onApprove: (selectedIds: string[]) => Promise<void>;
  isApproving: boolean;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  facebook: <Facebook className="h-3.5 w-3.5 text-blue-500" />,
};

export function ApprovalDialog({ open, onOpenChange, items, onApprove, isApproving }: ApprovalDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map(i => i.id)));

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  };

  const handleApprove = async () => {
    await onApprove(Array.from(selectedIds));
    onOpenChange(false);
  };

  // Reset selection when items change
  if (open && items.length > 0 && selectedIds.size === 0) {
    setSelectedIds(new Set(items.map(i => i.id)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Aprovar Publicações
          </DialogTitle>
          <DialogDescription>
            Revise e selecione os itens que deseja aprovar para publicação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/30">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={selectedIds.size === items.length}
              onCheckedChange={toggleAll}
            />
            Selecionar todos ({items.length})
          </label>
          <Badge variant="outline">
            {selectedIds.size} selecionado(s)
          </Badge>
        </div>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-3 py-4">
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const platforms = item.target_platforms || [];
              
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    "flex gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="mt-1 shrink-0"
                  />

                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {item.asset_url ? (
                      <img
                        src={item.asset_url}
                        alt={item.title || "Criativo"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        {item.content_type === "text" ? (
                          <FileText className="h-6 w-6" />
                        ) : (
                          <ImageIcon className="h-6 w-6" />
                        )}
                        <span className="text-[10px] mt-1">Sem criativo</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium truncate">{item.title}</h4>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(item.scheduled_date), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    
                    {item.copy && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.copy}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {platforms.map(p => (
                        <span key={p} className="flex items-center gap-1 text-xs text-muted-foreground">
                          {platformIcons[p] || null}
                          <span className="capitalize">{p}</span>
                        </span>
                      ))}
                      {item.scheduled_time && (
                        <span className="text-xs text-muted-foreground">
                          🕐 {item.scheduled_time.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleApprove}
            disabled={selectedIds.size === 0 || isApproving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isApproving ? "Aprovando..." : `Aprovar ${selectedIds.size} item(ns)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
