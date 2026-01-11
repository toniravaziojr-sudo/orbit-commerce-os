import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

/**
 * Meta OAuth Callback Page
 * 
 * Recebe o resultado do OAuth do Meta e exibe status.
 * Redireciona automaticamente para Integrações após sucesso.
 */
export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const returnPath = searchParams.get("return_path") || "/integrations";

    if (success === "true") {
      setStatus("success");
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate(returnPath, { replace: true });
      }, 2000);
    } else if (error) {
      setStatus("error");
      setErrorMessage(getErrorMessage(error, errorDescription || ""));
    } else {
      // Se não tem nenhum parâmetro, provavelmente acessou direto
      setStatus("error");
      setErrorMessage("Acesso inválido. Inicie a conexão pelo módulo de Integrações.");
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Conectando..."}
            {status === "success" && "Conectado com sucesso!"}
            {status === "error" && "Erro na conexão"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Finalizando a conexão com o Meta..."}
            {status === "success" && "Sua conta Meta foi conectada. Redirecionando..."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "error" && (
            <Button
              onClick={() => navigate("/integrations", { replace: true })}
              className="mt-4"
            >
              Voltar para Integrações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getErrorMessage(error: string, description: string): string {
  const errorMessages: Record<string, string> = {
    access_denied: "Você cancelou a autorização.",
    missing_params: "Parâmetros de autorização ausentes.",
    invalid_state: "Sessão de autorização expirada ou inválida. Tente novamente.",
    token_exchange_failed: "Erro ao obter tokens de acesso. Tente novamente.",
    save_failed: "Erro ao salvar a conexão. Tente novamente.",
    not_configured: "Integração Meta não configurada. Contate o administrador.",
    internal_error: "Erro interno. Tente novamente mais tarde.",
  };

  if (description) {
    return description;
  }

  return errorMessages[error] || `Erro desconhecido: ${error}`;
}
