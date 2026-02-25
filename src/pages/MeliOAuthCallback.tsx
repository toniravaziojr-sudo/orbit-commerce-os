// =============================================
// MELI OAUTH CALLBACK - Proxy page for Mercado Livre OAuth
// Captures code/state from ML redirect and forwards to edge function
// After edge function processes, handles popup close + opener notification
// =============================================

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Flow:
 * 1. ML redirects to /integrations/meli/callback?code=...&state=...
 * 2. This page captures the params
 * 3. Calls edge function via fetch (not redirect) to process OAuth
 * 4. On success: notifies opener window via postMessage and closes popup
 * 5. On error: shows error and auto-closes
 */
export default function MeliOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check if we're receiving the final result (redirected from edge function)
    const meliConnected = searchParams.get('meli_connected');
    const meliError = searchParams.get('meli_error');

    // If this is the final result page (after edge function redirect)
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

    // If ML returned an error
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

    // Call edge function via fetch instead of redirect
    processOAuth(code, state);
  }, [searchParams]);

  const processOAuth = async (code: string, state: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/meli-oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      
      console.log('[MeliOAuthCallback] Chamando edge function...');
      
      // Use fetch with redirect: 'manual' to capture the redirect URL
      const response = await fetch(edgeFunctionUrl, { redirect: 'manual' });
      
      if (response.type === 'opaqueredirect' || response.status === 302) {
        // Edge function returned a redirect - extract location
        const location = response.headers.get('Location');
        
        if (location?.includes('meli_connected=true')) {
          setStatus('success');
          notifyOpenerAndClose('meli_connected', true);
        } else if (location) {
          const url = new URL(location);
          const error = url.searchParams.get('meli_error') || 'unknown_error';
          setStatus('error');
          setErrorMsg(error);
          notifyOpenerAndClose('meli_error', error);
        } else {
          // Can't read Location header due to CORS, follow redirect in iframe
          // Fallback: navigate to the edge function URL directly
          window.location.href = edgeFunctionUrl;
        }
      } else {
        // Try to parse JSON response
        const data = await response.json().catch(() => null);
        if (data?.success) {
          setStatus('success');
          notifyOpenerAndClose('meli_connected', true);
        } else {
          setStatus('error');
          setErrorMsg(data?.error || 'Erro ao processar autorização');
          notifyOpenerAndClose('meli_error', data?.error || 'unknown');
        }
      }
    } catch (err) {
      console.error('[MeliOAuthCallback] Erro:', err);
      // Fallback: redirect directly (will work but won't close popup automatically)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      window.location.href = `${supabaseUrl}/functions/v1/meli-oauth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    }
  };

  const notifyOpenerAndClose = (type: string, value: unknown) => {
    try {
      // Notify the opener window
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type, value }, window.location.origin);
        // Close popup after brief delay
        setTimeout(() => {
          window.close();
        }, type === 'meli_connected' ? 1500 : 3000);
      } else {
        // Not in a popup - redirect to integrations page
        setTimeout(() => {
          window.location.href = `/integrations?tab=marketplaces&${type}=${encodeURIComponent(String(value))}`;
        }, type === 'meli_connected' ? 1500 : 3000);
      }
    } catch {
      // Fallback redirect
      setTimeout(() => {
        window.location.href = `/integrations?tab=marketplaces`;
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
