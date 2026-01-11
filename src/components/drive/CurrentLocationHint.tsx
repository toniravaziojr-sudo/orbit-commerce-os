import { Info } from "lucide-react";

interface CurrentLocationHintProps {
  breadcrumb: { id: string | null; name: string }[];
}

export function CurrentLocationHint({ breadcrumb }: CurrentLocationHintProps) {
  // Build readable path
  const pathParts = breadcrumb.map((b, i) => (i === 0 ? 'Raiz' : b.name));
  const currentPath = pathParts.join(' > ');

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2 mt-2">
      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <div>
        <p>Você cria pastas e envia arquivos exatamente onde você está.</p>
        <p className="font-medium mt-0.5">Local atual: {currentPath}</p>
      </div>
    </div>
  );
}
