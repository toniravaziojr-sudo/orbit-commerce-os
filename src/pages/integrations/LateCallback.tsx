import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Callback page for Late OAuth flow
 * This page is opened in a popup after Late's OAuth finishes.
 * It receives the result via URL params (from edge function redirect)
 * and communicates with the parent window via postMessage.
 */
export default function LateCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processando conexão...");

  useEffect(() => {
    // Get params from URL (set by edge function redirect)
    const lateConnected = searchParams.get("late_connected");
    const lateError = searchParams.get("late_error");
    const platform = searchParams.get("platform") || "facebook";

    if (lateConnected === "true") {
      setStatus("success");
      setMessage(`${platform === 'instagram' ? 'Instagram' : 'Facebook'} conectado com sucesso!`);
      notifyParentAndClose(true, platform);
    } else if (lateError) {
      setStatus("error");
      setMessage(decodeURIComponent(lateError));
      notifyParentAndClose(false, platform, decodeURIComponent(lateError));
    } else {
      // No clear result params - show error
      setStatus("error");
      setMessage("Callback inválido ou incompleto");
      notifyParentAndClose(false, platform, "Callback inválido");
    }
  }, [searchParams]);

  // Função para redirecionar de forma robusta
  // IMPORTANTE: O Google Tradutor pode quebrar window.opener e postMessage
  const notifyParentAndClose = (
    success: boolean,
    platform: string,
    error?: string
  ) => {
    const baseUrl = window.location.origin;
    const redirectUrl = success
      ? `${baseUrl}/integrations?late_connected=true&platform=${platform}`
      : `${baseUrl}/integrations?late_error=${encodeURIComponent(error || 'Erro')}`;

    // Tentar notificar janela pai (pode falhar com Google Tradutor)
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: "late:connected",
          success,
          platform,
          error,
        }, "*");
      }
    } catch (e) {
      console.warn("[LateCallback] postMessage falhou:", e);
    }

    // SEMPRE redirecionar após delay
    setTimeout(() => {
      try {
        if (window.opener && !window.opener.closed) {
          window.close();
        }
      } catch (e) {
        console.warn("[LateCallback] window.close() falhou:", e);
      }
      
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 300);
    }, 1200);
  };

  const handleClose = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
    } else {
      window.location.href = "/integrations";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/80 to-primary">
      <div className="bg-background rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
        {status === "processing" && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processando</h2>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Conectado!</h2>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Esta janela fechará automaticamente...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erro na Conexão</h2>
            <p className="text-muted-foreground mb-4">{message}</p>
            <Button onClick={handleClose} variant="outline">
              Fechar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
