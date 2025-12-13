import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Eye, Monitor, Smartphone, Tablet, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { StoreSettings } from "@/pages/StoreBuilder";

interface StorePreviewTabProps {
  storeUrl: string;
  settings: StoreSettings | null;
}

type DeviceType = "desktop" | "tablet" | "mobile";

const deviceWidths: Record<DeviceType, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export function StorePreviewTab({ storeUrl, settings }: StorePreviewTabProps) {
  const [device, setDevice] = useState<DeviceType>("desktop");

  const fullUrl = `${window.location.origin}${storeUrl}`;
  const isPublished = settings?.is_published;

  return (
    <div className="space-y-4">
      {/* Warning if not published */}
      {!isPublished && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Prévia de Rascunho
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Sua loja ainda não está publicada. Ative "Publicar Loja" na aba Aparência 
                  para que clientes possam acessá-la.
                </p>
              </div>
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                Rascunho
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévia da Loja
            </CardTitle>
            <CardDescription>
              Visualize como sua loja aparece para os clientes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg p-1">
              <Button
                variant={device === "desktop" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice("desktop")}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={device === "tablet" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice("tablet")}
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={device === "mobile" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDevice("mobile")}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" asChild>
              <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em Nova Aba
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4">
            <div
              className="mx-auto bg-background rounded-lg shadow-lg overflow-hidden transition-all duration-300"
              style={{
                width: deviceWidths[device],
                maxWidth: "100%",
              }}
            >
              <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 border-b">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 bg-background rounded px-3 py-1 text-xs text-muted-foreground truncate">
                  {fullUrl}
                </div>
              </div>
              <iframe
                src={fullUrl}
                className="w-full border-0"
                style={{
                  height: device === "mobile" ? "600px" : "500px",
                }}
                title="Prévia da Loja"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Link da sua loja</p>
              <p className="text-sm text-muted-foreground">{fullUrl}</p>
            </div>
            <div className="flex items-center gap-2">
              {isPublished && (
                <Badge variant="default" className="bg-green-600">
                  Publicada
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(fullUrl);
                }}
              >
                Copiar Link
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
