// =============================================
// ADMIN TOASTER - Sistema Comando Central APENAS
// NÃO usar em componentes da loja pública (storefront)
// =============================================

import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * AdminToaster - Toaster estilizado para o painel administrativo
 * 
 * REGRA CRÍTICA: Este componente é EXCLUSIVO do admin (Comando Central).
 * NÃO deve ser usado em nenhum componente da loja pública.
 * 
 * Para a loja pública, use o Toaster padrão que herda do tema do tenant.
 */
const AdminToaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#1e3a5f] group-[.toaster]:text-white group-[.toaster]:border-[#2563eb]/30 group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-white/80",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-[#1e3a5f] group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-white/20 group-[.toast]:text-white",
          success: "group-[.toaster]:bg-[#1e3a5f] group-[.toaster]:text-white group-[.toaster]:border-[#2563eb]/30",
          error: "group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground group-[.toaster]:border-destructive/30",
          warning: "group-[.toaster]:bg-amber-600 group-[.toaster]:text-white group-[.toaster]:border-amber-500/30",
          info: "group-[.toaster]:bg-[#1e3a5f] group-[.toaster]:text-white group-[.toaster]:border-[#2563eb]/30",
        },
      }}
      {...props}
    />
  );
};

export { AdminToaster, toast };
