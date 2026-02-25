// =============================================
// USE CONFIRM DIALOG — Hook reutilizável para substituir window.confirm()
// Retorna estado + componente AlertDialog estilizado
// =============================================

import { useState, useCallback, useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmVariant = "destructive" | "warning" | "info" | "default";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

const VARIANT_CONFIG: Record<ConfirmVariant, {
  icon: typeof Info;
  iconColor: string;
  buttonClass: string;
}> = {
  destructive: {
    icon: Trash2,
    iconColor: "text-destructive",
    buttonClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    buttonClass: "bg-amber-600 text-white hover:bg-amber-700",
  },
  info: {
    icon: Info,
    iconColor: "text-primary",
    buttonClass: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
  default: {
    icon: Send,
    iconColor: "text-primary",
    buttonClass: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "",
    description: "",
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const variant = options.variant || "default";
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2.5">
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              variant === "destructive" && "bg-destructive/10",
              variant === "warning" && "bg-amber-500/10",
              variant === "info" && "bg-primary/10",
              variant === "default" && "bg-primary/10",
            )}>
              <Icon className={cn("h-4.5 w-4.5", config.iconColor)} />
            </div>
            {options.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="pl-[46px]">
            {options.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {options.cancelLabel || "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className={config.buttonClass}>
            {options.confirmLabel || "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
