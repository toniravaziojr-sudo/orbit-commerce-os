import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { useRegenerateVariant } from "@/hooks/useAssetGeneration";

interface RegenerateFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string | null;
  onComplete: () => void;
}

const quickFeedbackOptions = [
  "Mais claro",
  "Mais premium",
  "Menos elementos",
  "Mais contraste",
  "Cores mais vibrantes",
  "Mais minimalista",
  "Fundo mais limpo",
  "Mais profissional",
];

export function RegenerateFeedbackModal({
  open,
  onOpenChange,
  variantId,
  onComplete,
}: RegenerateFeedbackModalProps) {
  const [feedback, setFeedback] = useState("");
  const [selectedQuick, setSelectedQuick] = useState<string[]>([]);
  
  const regenerateVariant = useRegenerateVariant();

  const handleQuickClick = (option: string) => {
    setSelectedQuick((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option]
    );
  };

  const handleSubmit = async () => {
    if (!variantId) return;

    const fullFeedback = [...selectedQuick, feedback].filter(Boolean).join(". ");
    
    if (!fullFeedback.trim()) {
      return;
    }

    await regenerateVariant.mutateAsync({
      variantId,
      feedback: fullFeedback,
    });

    setFeedback("");
    setSelectedQuick([]);
    onComplete();
  };

  const handleClose = () => {
    setFeedback("");
    setSelectedQuick([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Regenerar com ajustes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Ajustes rápidos
            </label>
            <div className="flex flex-wrap gap-2">
              {quickFeedbackOptions.map((option) => (
                <Badge
                  key={option}
                  variant={selectedQuick.includes(option) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handleQuickClick(option)}
                >
                  {option}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Feedback adicional (opcional)
            </label>
            <Textarea
              placeholder="Descreva outros ajustes que você gostaria..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              regenerateVariant.isPending ||
              (selectedQuick.length === 0 && !feedback.trim())
            }
          >
            {regenerateVariant.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Regenerando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
