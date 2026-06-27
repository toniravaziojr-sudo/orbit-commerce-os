import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Selo universal "Campo importante para categorizar o produto corretamente nos Marketplaces".
 * Use ao lado do FormLabel de qualquer campo cujo valor o sistema usa para classificar,
 * publicar ou enriquecer dados em marketplaces (Mercado Livre, Shopee, TikTok Shop, etc.).
 *
 * Regra de governança: REGRAS-DO-SISTEMA.md §36 (Guiar o Usuário).
 */
export function MarketplaceFieldHint({ text }: { text?: string }) {
  const message =
    text ??
    "Campo importante para categorizar o produto corretamente nos Marketplaces.";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center text-primary/70 hover:text-primary cursor-help"
            aria-label={message}
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
