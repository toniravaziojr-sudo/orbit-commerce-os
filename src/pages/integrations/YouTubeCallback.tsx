import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    // Get params from URL (set by edge function redirect)
    const youtubeConnected = searchParams.get("youtube_connected");
    const youtubeError = searchParams.get("youtube_error");
    const channelName = searchParams.get("channel");

    if (youtubeConnected === "true") {
      setStatus("success");
      setChannel(channelName);
      setMessage(channelName ? `Canal "${channelName}" conectado!` : "YouTube conectado com sucesso!");
      notifyParentAndClose(true, channelName);
    } else if (youtubeError) {
      setStatus("error");
      setMessage(decodeURIComponent(youtubeError));
      notifyParentAndClose(false, null, decodeURIComponent(youtubeError));
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
    error?: string
  ) => {
    const messageData = {
      type: "youtube:connected",
      success,
      channel,
      error,
    };

    // Try to communicate with parent window
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(messageData, "*");
      } catch (e) {
        console.error("Failed to postMessage:", e);
      }

      // Close popup after showing result
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      // No opener - redirect after delay
      setTimeout(() => {
        const baseUrl = window.location.origin;
        const redirectUrl = success
          ? `${baseUrl}/integrations?youtube_connected=true`
          : `${baseUrl}/integrations?youtube_error=${encodeURIComponent(error || "Erro")}`;
        window.location.href = redirectUrl;
      }, 2000);
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
