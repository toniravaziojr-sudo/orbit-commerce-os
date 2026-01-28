// =============================================
// TIKTOK OAUTH CALLBACK PAGE
// Handles the OAuth redirect from TikTok
// =============================================

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Music2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function TikTokOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const processedRef = useRef(false);

  // Função para notificar janela pai e fechar popup
  const notifyParentAndClose = (success: boolean, error?: string) => {
    const messageData = {
      type: "tiktok:connected",
      success,
      error,
    };

    // Tentar comunicar com janela pai (se aberto como popup)
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, "*");
        console.log("[TikTokOAuthCallback] Mensagem enviada para janela pai");
      } catch (e) {
        console.error("[TikTokOAuthCallback] Falha ao enviar postMessage:", e);
      }

      // Fechar popup após mostrar resultado
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      // Sem opener - redirecionar após delay
      setTimeout(() => {
        const baseUrl = window.location.origin;
        const redirectUrl = success
          ? `${baseUrl}/marketing?tiktok_connected=true`
          : `${baseUrl}/marketing?tiktok_error=${encodeURIComponent(error || 'Erro')}`;
        window.location.href = redirectUrl;
      }, 2000);
    }
  };

  useEffect(() => {
    // Evitar processamento duplo (React StrictMode)
    if (processedRef.current) return;

    const authCode = searchParams.get("auth_code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    
    // Se veio com success=true (redirect antigo), tratar como sucesso
    const successParam = searchParams.get("success");

    if (successParam === "true") {
      setStatus("success");
      notifyParentAndClose(true);
      return;
    }

    // Se veio com erro do TikTok
    if (error) {
      processedRef.current = true;
      const errMsg = errorDescription || getErrorMessage(error);
      setStatus("error");
      setErrorMessage(errMsg);
      notifyParentAndClose(false, errMsg);
      return;
    }

    // Se tem auth_code e state, processar OAuth
    if (authCode && state) {
      processedRef.current = true;
      processOAuthCallback(authCode, state);
      return;
    }

    // Se não tem nenhum parâmetro válido
    processedRef.current = true;
    const errMsg = "Acesso inválido. Inicie a conexão pelo módulo de Marketing.";
    setStatus("error");
    setErrorMessage(errMsg);
    notifyParentAndClose(false, errMsg);
  }, [searchParams]);

  async function processOAuthCallback(authCode: string, state: string) {
    try {
      const { data, error } = await supabase.functions.invoke("tiktok-oauth-callback", {
        body: { auth_code: authCode, state },
      });

      if (error || !data?.success) {
        console.error("[TikTokOAuthCallback] Erro:", error || data);
        const errMsg = data?.error || error?.message || "Erro ao processar autorização";
        setStatus("error");
        setErrorMessage(errMsg);
        notifyParentAndClose(false, errMsg);
        return;
      }

      console.log("[TikTokOAuthCallback] Conexão realizada:", data.connection);
      setStatus("success");
      notifyParentAndClose(true);
      
    } catch (err) {
      console.error("[TikTokOAuthCallback] Exceção:", err);
      const errMsg = err instanceof Error ? err.message : "Erro inesperado";
      setStatus("error");
      setErrorMessage(errMsg);
      notifyParentAndClose(false, errMsg);
    }
  }

  function getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      access_denied: "Você negou o acesso ao TikTok",
      invalid_request: "Requisição inválida",
      unauthorized_client: "Aplicativo não autorizado",
      invalid_scope: "Permissões solicitadas são inválidas",
      server_error: "Erro interno do TikTok",
    };
    return errorMessages[errorCode] || `Erro: ${errorCode}`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Music2 className="h-6 w-6" />
          </div>
          <CardTitle>
            {status === "loading" && "Conectando TikTok..."}
            {status === "success" && "Conectado!"}
            {status === "error" && "Falha na conexão"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Processando autorização, aguarde..."}
            {status === "success" && "Sua conta TikTok foi conectada com sucesso."}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          {status === "loading" && (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          )}
          {status === "success" && (
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          )}
          {status === "error" && (
            <XCircle className="h-12 w-12 text-destructive" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
