import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Meta OAuth Callback Page
 * 
 * Recebe o code e state do Meta OAuth, chama a edge function para processar,
 * e exibe o resultado ao usuário.
 * 
 * Fluxo:
 * 1. Meta redireciona para esta página com ?code=...&state=...
 * 2. Esta página chama meta-oauth-callback via POST com code e state
 * 3. A edge function valida, troca tokens, salva conexão
 * 4. Esta página mostra sucesso/erro e redireciona
 */
export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const processedRef = useRef(false);

  useEffect(() => {
    // Evitar processamento duplo (React StrictMode)
    if (processedRef.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    
    // Se já veio com success=true (redirect antigo), tratar como sucesso
    const successParam = searchParams.get("success");
    const returnPath = searchParams.get("return_path") || "/integrations";

    if (successParam === "true") {
      setStatus("success");
      setTimeout(() => navigate(returnPath, { replace: true }), 2000);
      return;
    }

    // Se veio com erro do Meta
    if (error) {
      processedRef.current = true;
      setStatus("error");
      setErrorMessage(getErrorMessage(error, errorDescription || ""));
      return;
    }

    // Se tem code e state, processar OAuth
    if (code && state) {
      processedRef.current = true;
      processOAuthCallback(code, state);
      return;
    }

    // Se não tem nenhum parâmetro válido
    processedRef.current = true;
    setStatus("error");
    setErrorMessage("Acesso inválido. Inicie a conexão pelo módulo de Integrações.");
  }, [searchParams, navigate]);

  async function processOAuthCallback(code: string, state: string) {
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-callback", {
        body: { code, state },
      });

      if (error || !data?.success) {
        console.error("[MetaOAuthCallback] Erro:", error || data);
        setStatus("error");
        setErrorMessage(data?.error || error?.message || "Erro ao processar autorização");
        return;
      }

      setStatus("success");
      
      // Redirecionar após 2 segundos
      const returnPath = data.returnPath || "/integrations";
      setTimeout(() => {
        navigate(returnPath, { replace: true });
      }, 2000);

    } catch (err) {
      console.error("[MetaOAuthCallback] Erro inesperado:", err);
      setStatus("error");
      setErrorMessage("Erro inesperado. Tente novamente.");
    }
  }

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
