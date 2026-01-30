// =============================================
// STOREFRONT TOASTER - Loja pública dos tenants
// Herda cores do tema do tenant (via CSS variables)
// =============================================

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster - Toaster para loja pública (storefront)
 * 
 * REGRA CRÍTICA: Este é o Toaster da LOJA PÚBLICA.
 * Ele herda as cores do tema do tenant via CSS variables.
 * 
 * Para o painel admin (Comando Central), use AdminToaster.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          // Usa semantic tokens que herdam do tema do tenant
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:bg-green-600 group-[.toaster]:text-white group-[.toaster]:border-green-500/30",
          error: "group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground group-[.toaster]:border-destructive/30",
          warning: "group-[.toaster]:bg-amber-600 group-[.toaster]:text-white group-[.toaster]:border-amber-500/30",
          info: "group-[.toaster]:bg-blue-600 group-[.toaster]:text-white group-[.toaster]:border-blue-500/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
