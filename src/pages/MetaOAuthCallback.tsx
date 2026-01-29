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

  // Função para notificar janela pai e fechar popup
  const notifyParentAndClose = (success: boolean, error?: string) => {
    const messageData = {
      type: "meta:connected",
      success,
      error,
    };

    const baseUrl = window.location.origin;
    const redirectUrl = success
      ? `${baseUrl}/integrations?meta_connected=true`
      : `${baseUrl}/integrations?meta_error=${encodeURIComponent(error || 'Erro')}`;

    // Tentar comunicar com janela pai (se aberto como popup)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, "*");
        console.log("[MetaOAuthCallback] Mensagem enviada para janela pai");
      } catch (e) {
        console.error("[MetaOAuthCallback] Falha ao enviar postMessage:", e);
      }

      // Tentar fechar popup após delay para mostrar resultado
      setTimeout(() => {
        // Verificar se estamos em um popup real (window.opener existe e não fechou)
        const isPopup = window.opener && !window.opener.closed;
        
        if (isPopup) {
          // Tentar fechar o popup
          window.close();
          
          // Verificar se realmente fechou após um breve delay
          // Se não fechou, redirecionar
          setTimeout(() => {
            // Se ainda estamos aqui, o browser bloqueou o fechamento
            console.log("[MetaOAuthCallback] Popup não fechou, redirecionando...");
            window.location.replace(redirectUrl);
          }, 500);
        } else {
          // Não é popup, redirecionar
          window.location.replace(redirectUrl);
        }
      }, 1500);
    } else {
      // Sem opener - redirecionar imediatamente para /integrations
      console.log("[MetaOAuthCallback] Sem opener, redirecionando para /integrations");
      // Usar replace para não adicionar ao histórico
      window.location.replace(redirectUrl);
    }
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
