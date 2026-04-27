import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

/**
 * Tela padrão de bloqueio para rotas restritas a operadores da plataforma.
 * Usada como fallback do PlatformAdminGate em rotas como /platform/system-health.
 */
export function PlatformAccessDenied() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Acesso restrito</CardTitle>
          <CardDescription>
            Esta área é exclusiva para operadores da plataforma. Sua conta atual
            não possui permissão para visualizá-la.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
