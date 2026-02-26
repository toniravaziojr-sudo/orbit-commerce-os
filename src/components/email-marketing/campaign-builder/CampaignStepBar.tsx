import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Configuração", description: "Nome, tipo e lista" },
  { label: "Conteúdo", description: "Monte seu email" },
  { label: "Revisar & Enviar", description: "Confirme e dispare" },
];

interface CampaignStepBarProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  canNavigate: (step: number) => boolean;
}

export function CampaignStepBar({ currentStep, onStepClick, canNavigate }: CampaignStepBarProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      {STEPS.map((s, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        const isClickable = canNavigate(i);

        return (
          <div key={i} className="flex items-center flex-1">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(i)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left",
                isCurrent && "bg-primary/10 border border-primary/30",
                isCompleted && "bg-muted hover:bg-muted/80",
                !isCurrent && !isCompleted && "opacity-50",
                isClickable && !isCurrent && "cursor-pointer hover:bg-muted/60",
                !isClickable && "cursor-not-allowed"
              )}
            >
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors",
                  isCurrent && "bg-primary text-primary-foreground",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isCurrent && !isCompleted && "bg-muted-foreground/20 text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className={cn("text-sm font-medium truncate", isCurrent && "text-primary")}>
                  {s.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">{s.description}</p>
              </div>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px w-4 mx-1 shrink-0", isCompleted ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
