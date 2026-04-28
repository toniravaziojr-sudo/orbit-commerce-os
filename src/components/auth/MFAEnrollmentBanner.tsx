// Onda 5 F3: Banner não-bloqueante que recomenda ativar MFA (TOTP)
// Aparece apenas em rotas /platform/* quando o usuário ainda não tem fator TOTP enrolado
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const DISMISS_KEY = "mfa_banner_dismissed_until";
const DISMISS_HOURS = 24;

export function MFAEnrollmentBanner() {
  const location = useLocation();
  const { user } = useAuth();
  const [hasMfa, setHasMfa] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const isPlatformRoute = location.pathname.startsWith("/platform");

  useEffect(() => {
    if (!user || !isPlatformRoute) return;
    const dismissUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissUntil > Date.now()) {
      setDismissed(true);
      return;
    }
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = (data?.totp ?? []).some((f) => f.status === "verified");
      setHasMfa(verified);
    });
  }, [user, isPlatformRoute]);

  if (!isPlatformRoute || !user || hasMfa !== false || dismissed) return null;

  const dismissTemporarily = () => {
    const until = Date.now() + DISMISS_HOURS * 3600 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setDismissed(true);
  };

  const startEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setFactorId(data.id);
      setQrSvg(data.totp.qr_code);
      setSecret(data.totp.secret);
      setOpen(true);
    } catch (err: any) {
      toast.error("Não foi possível iniciar o 2FA: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyEnroll = async () => {
    if (!factorId || !code) return;
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;
      toast.success("2FA ativado com sucesso!");
      setOpen(false);
      setHasMfa(true);
    } catch (err: any) {
      toast.error("Código inválido: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Alert className="mb-4 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <ShieldCheck className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-900 dark:text-amber-200">
          Proteja seu acesso de administrador com 2FA
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4 text-amber-800 dark:text-amber-300">
          <span>
            Você ainda não ativou a autenticação em dois fatores. Recomendado para contas de administrador da plataforma.
          </span>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={startEnroll} disabled={loading}>
              Ativar agora
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissTemporarily}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ativar autenticação em 2 fatores</DialogTitle>
            <DialogDescription>
              Escaneie o QR code com Google Authenticator, Authy ou 1Password e digite o código gerado.
            </DialogDescription>
          </DialogHeader>
          {qrSvg && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-lg bg-white p-4"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              {secret && (
                <p className="text-xs text-muted-foreground break-all text-center">
                  Ou digite manualmente: <code className="font-mono">{secret}</code>
                </p>
              )}
              <div className="w-full space-y-2">
                <Label htmlFor="totp-code">Código de 6 dígitos</Label>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={verifyEnroll} disabled={code.length !== 6 || loading}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
