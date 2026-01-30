import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-left"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#1e3a5f] group-[.toaster]:text-white group-[.toaster]:border-[#2563eb]/30 group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-blue-100",
          actionButton: "group-[.toast]:bg-white group-[.toast]:text-[#1e3a5f] group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-white/20 group-[.toast]:text-white",
          success: "group-[.toaster]:bg-[#1e3a5f] group-[.toaster]:text-white group-[.toaster]:border-[#2563eb]/30",
          error: "group-[.toaster]:bg-red-600 group-[.toaster]:text-white group-[.toaster]:border-red-500/30",
          warning: "group-[.toaster]:bg-amber-600 group-[.toaster]:text-white group-[.toaster]:border-amber-500/30",
          info: "group-[.toaster]:bg-[#1e3a5f] group-[.toaster]:text-white group-[.toaster]:border-[#2563eb]/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
