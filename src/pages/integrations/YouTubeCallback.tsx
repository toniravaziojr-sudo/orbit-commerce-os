import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle, Youtube, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Error code to user-friendly messages with help context
 */
const ERROR_HELP: Record<string, { title: string; help: string; action?: string }> = {
  testing_mode_restriction: {
    title: "OAuth em Modo de Teste",
    help: "O app do Google está em modo Testing. Apenas emails cadastrados como 'Test users' no Google Cloud Console podem autorizar.",
    action: "Peça ao administrador para adicionar seu email ou publicar o app.",
  },
  unverified_app_cap: {
    title: "Limite de Usuários Atingido",
    help: "Apps não verificados pelo Google têm um limite de usuários. O administrador precisa submeter o app para verificação.",
    action: "Aguarde a verificação do app pelo Google.",
  },
  access_denied: {
    title: "Autorização Cancelada",
    help: "Você cancelou o processo de autorização do YouTube.",
    action: "Tente novamente e aceite todas as permissões solicitadas.",
  },
  consent_required: {
    title: "Consentimento Necessário",
    help: "Todas as permissões solicitadas são necessárias para o funcionamento correto.",
    action: "Reconecte e aceite todas as permissões.",
  },
  quota_exceeded: {
    title: "Quota da API Excedida",
    help: "O limite diário da API do YouTube foi atingido.",
    action: "Tente novamente amanhã quando a quota for resetada.",
  },
  no_channel: {
    title: "Canal Não Encontrado",
    help: "Você precisa ter um canal do YouTube criado para conectar.",
    action: "Crie um canal no YouTube e tente novamente.",
  },
  state_expired: {
    title: "Sessão Expirada",
    help: "O processo de autorização demorou demais.",
    action: "Tente conectar novamente.",
  },
};

/**
 * Callback page for YouTube OAuth flow
 * This page is opened in a popup after Google's OAuth finishes.
 * It receives the result via URL params (from edge function redirect)
 * and communicates with the parent window via postMessage.
 */
export default function YouTubeCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processando conexão...");
  const [channel, setChannel] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ title: string; help: string; action?: string } | null>(null);

  useEffect(() => {
    // Get params from URL (set by edge function redirect)
    const youtubeConnected = searchParams.get("youtube_connected");
    const youtubeError = searchParams.get("youtube_error");
    const errorCode = searchParams.get("error_code");
    const channelName = searchParams.get("channel");

    if (youtubeConnected === "true") {
      setStatus("success");
      setChannel(channelName);
      setMessage(channelName ? `Canal "${channelName}" conectado!` : "YouTube conectado com sucesso!");
      notifyParentAndClose(true, channelName);
    } else if (youtubeError) {
      setStatus("error");
      setMessage(decodeURIComponent(youtubeError));
      
      // Get detailed error help if available
      if (errorCode && ERROR_HELP[errorCode]) {
        setErrorDetails(ERROR_HELP[errorCode]);
      }
      
      notifyParentAndClose(false, null, decodeURIComponent(youtubeError), errorCode || undefined);
    } else {
      // No clear result params - show error
      setStatus("error");
      setMessage("Callback inválido ou incompleto");
      notifyParentAndClose(false, null, "Callback inválido");
    }
  }, [searchParams]);

  const notifyParentAndClose = (
    success: boolean,
    channel: string | null,
    error?: string,
    errorCode?: string
  ) => {
    const messageData = {
      type: "youtube:connected",
      success,
      channel,
      error,
      errorCode,
    };

    // Try to communicate with parent window
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, "*");
      } catch (e) {
        console.error("Failed to postMessage:", e);
      }

      // Close popup after showing result (longer for errors so user can read)
      setTimeout(() => {
        window.close();
      }, success ? 1500 : 5000);
    } else {
      // No opener - redirect after delay
      setTimeout(() => {
        const baseUrl = window.location.origin;
        const redirectUrl = success
          ? `${baseUrl}/integrations?youtube_connected=true`
          : `${baseUrl}/integrations?youtube_error=${encodeURIComponent(error || "Erro")}`;
        window.location.href = redirectUrl;
      }, success ? 2000 : 5000);
    }
  };

  const handleClose = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      window.location.href = "/integrations";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-600/80 to-red-700">
      <div className="bg-background rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        {status === "processing" && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processando</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="relative mx-auto mb-4 w-fit">
              <Youtube className="h-16 w-16 text-red-600" />
              <CheckCircle className="h-6 w-6 text-green-500 absolute -bottom-1 -right-1 bg-background rounded-full" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Conectado!</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Esta janela fechará automaticamente...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="relative mx-auto mb-4 w-fit">
              <Youtube className="h-16 w-16 text-red-600 opacity-50" />
              <XCircle className="h-6 w-6 text-destructive absolute -bottom-1 -right-1 bg-background rounded-full" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {errorDetails?.title || "Erro na Conexão"}
            </h2>
            <p className="text-muted-foreground mb-4">{message}</p>
            
            {errorDetails && (
              <Alert className="text-left mb-4">
                <HelpCircle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="text-sm">{errorDetails.help}</p>
                  {errorDetails.action && (
                    <p className="text-sm font-medium text-primary">
                      {errorDetails.action}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-2 justify-center">
              <Button onClick={handleClose} variant="outline">
                Fechar
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              Esta janela fechará em 5 segundos...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
