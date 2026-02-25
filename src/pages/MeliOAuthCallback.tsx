// =============================================
// MELI OAUTH CALLBACK - Proxy page for Mercado Livre OAuth
// Captures code/state from ML redirect and forwards to edge function
// After edge function processes, handles popup close + opener notification
// =============================================

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Flow:
 * 1. ML redirects to /integrations/meli/callback?code=...&state=...
 * 2. This page captures the params
 * 3. Calls edge function via POST JSON (single exchange)
 * 4. On success: notifies opener window via postMessage and closes popup
 * 5. On error: shows error and auto-closes
 */
export default function MeliOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Legacy fallback support when callback receives final params directly
    const meliConnected = searchParams.get('meli_connected');
    const meliError = searchParams.get('meli_error');

    if (meliConnected === 'true') {
      setStatus('success');
      notifyOpenerAndClose('meli_connected', true);
      return;
    }

    if (meliError) {
      setStatus('error');
      setErrorMsg(meliError);
      notifyOpenerAndClose('meli_error', meliError);
      return;
    }

    if (error) {
      setStatus('error');
      setErrorMsg('Acesso negado pelo Mercado Livre');
      notifyOpenerAndClose('meli_error', error);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setErrorMsg('Parâmetros de autorização ausentes. Tente conectar novamente.');
      notifyOpenerAndClose('meli_error', 'missing_params');
      return;
    }

    // Prevent duplicate token exchange in strict/effect re-runs
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    void processOAuth(code, state);
  }, [searchParams]);

  const processOAuth = async (code: string, state: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/meli-oauth-callback`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ code, state }),
      });

      const data = await response.json().catch(() => null);

      if (data?.success) {
        setStatus('success');
        notifyOpenerAndClose('meli_connected', true);
        return;
      }

      const errorCode = data?.error || 'internal_error';
      setStatus('error');
      setErrorMsg(errorCode);
      notifyOpenerAndClose('meli_error', errorCode);
    } catch (err) {
      console.error('[MeliOAuthCallback] Erro:', err);
      setStatus('error');
      setErrorMsg('internal_error');
      notifyOpenerAndClose('meli_error', 'internal_error');
    }
  };

  const notifyOpenerAndClose = (type: string, value: unknown) => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type, value }, window.location.origin);
        setTimeout(() => {
          window.close();
        }, type === 'meli_connected' ? 1500 : 3000);
      } else {
        setTimeout(() => {
          window.location.href = `/integrations?tab=marketplaces&${type}=${encodeURIComponent(String(value))}`;
        }, type === 'meli_connected' ? 1500 : 3000);
      }
    } catch {
      setTimeout(() => {
        window.location.href = '/integrations?tab=marketplaces';
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md px-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Conectando ao Mercado Livre...</h2>
            <p className="text-muted-foreground text-sm">
              Processando autorização. Aguarde...
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Conectado com sucesso!</h2>
            <p className="text-muted-foreground text-sm">
              Esta janela será fechada automaticamente.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Erro na conexão</h2>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <p className="text-muted-foreground text-xs mt-2">
              Esta janela será fechada automaticamente.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

