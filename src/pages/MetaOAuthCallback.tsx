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
 * 4. Esta página mostra sucesso/erro
 * 5. Se em popup: notifica janela pai e fecha
 * 6. Se não em popup: redireciona
 */
export default function MetaOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const processedRef = useRef(false);

  // Função para redirecionar de forma robusta
  // IMPORTANTE: O Google Tradutor pode quebrar window.opener e postMessage
  // Por isso, SEMPRE fazemos redirect direto após um breve delay
  const notifyParentAndClose = (success: boolean, error?: string) => {
    // Limpar flag de OAuth em progresso
    sessionStorage.removeItem('oauth_in_progress');
    
    const baseUrl = window.location.origin;
    // Adicionar timestamp para evitar cache
    const redirectUrl = success
      ? `${baseUrl}/integrations?meta_connected=true&t=${Date.now()}`
      : `${baseUrl}/integrations?meta_error=${encodeURIComponent(error || 'Erro')}&t=${Date.now()}`;

    // Tentar notificar janela pai (pode falhar com Google Tradutor)
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: "meta:connected",
          success,
          error,
        }, "*");
        console.log("[MetaOAuthCallback] postMessage enviado");
      }
    } catch (e) {
      console.warn("[MetaOAuthCallback] postMessage falhou (esperado com Google Tradutor):", e);
    }

    // SEMPRE redirecionar após delay - não depender de window.close()
    // O Google Tradutor frequentemente quebra window.opener e window.close()
    setTimeout(() => {
      // Tentar fechar se for popup
      try {
        if (window.opener && !window.opener.closed) {
          window.close();
        }
      } catch (e) {
        console.warn("[MetaOAuthCallback] window.close() falhou:", e);
      }
      
      // Após mais um breve delay, forçar redirect se ainda estiver aberto
      setTimeout(() => {
        console.log("[MetaOAuthCallback] Forçando redirect para:", redirectUrl);
        // Usar href ao invés de replace para garantir navegação
        window.location.href = redirectUrl;
      }, 300);
    }, 1200);
  };

  useEffect(() => {
    // Evitar processamento duplo (React StrictMode)
    if (processedRef.current) return;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    
    // Se já veio com success=true (redirect antigo), tratar como sucesso
    const successParam = searchParams.get("success");

    if (successParam === "true") {
      setStatus("success");
      notifyParentAndClose(true);
      return;
    }

    // Se veio com erro do Meta
    if (error) {
      processedRef.current = true;
      const errMsg = getErrorMessage(error, errorDescription || "");
      setStatus("error");
      setErrorMessage(errMsg);
      notifyParentAndClose(false, errMsg);
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
    const errMsg = "Acesso inválido. Inicie a conexão pelo módulo de Integrações.";
    setStatus("error");
    setErrorMessage(errMsg);
    notifyParentAndClose(false, errMsg);
  }, [searchParams]);

  async function processOAuthCallback(code: string, state: string) {
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-callback", {
        body: { code, state },
      });

      if (error || !data?.success) {
        console.error("[MetaOAuthCallback] Erro:", error || data);
        const errMsg = data?.error || error?.message || "Erro ao processar autorização";
        setStatus("error");
        setErrorMessage(errMsg);
        notifyParentAndClose(false, errMsg);
        return;
      }

      setStatus("success");
      notifyParentAndClose(true);

    } catch (err) {
      console.error("[MetaOAuthCallback] Erro inesperado:", err);
      const errMsg = "Erro inesperado. Tente novamente.";
      setStatus("error");
      setErrorMessage(errMsg);
      notifyParentAndClose(false, errMsg);
    }
  }

  // Função para fechar manualmente
  const handleClose = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      navigate("/integrations", { replace: true });
    }
  };

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
            {status === "success" && "Sua conta Meta foi conectada. Fechando..."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === "error" && (
            <Button
              onClick={handleClose}
              className="mt-4"
            >
              {window.opener ? "Fechar" : "Voltar para Integrações"}
            </Button>
          )}
          {status === "success" && (
            <p className="text-sm text-muted-foreground mt-2">
              Esta janela será fechada automaticamente...
            </p>
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
