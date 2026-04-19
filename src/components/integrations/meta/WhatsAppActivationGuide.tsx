import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ShieldCheck,
  CreditCard,
  KeyRound,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useWhatsAppActivationSteps, StepKey, StepStatus } from "@/hooks/useWhatsAppActivationSteps";

/**
 * WhatsAppActivationGuide
 *
 * Checklist visual didático com os 4 passos obrigatórios para ativar o WhatsApp Cloud API
 * no modelo BYOA (Bring Your Own Account). Tom: didático com porquê.
 *
 * Variants:
 *  - "full"    → versão completa (usada dentro do card de WhatsApp em /integrations).
 *  - "compact" → versão de banner (usada no dashboard). Some quando 100% concluído.
 */

interface Props {
  variant?: "full" | "compact";
}

interface StepConfig {
  key: StepKey;
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  why: string;
  cta: { label: string; href: string; external?: boolean } | null;
}

const STEPS: StepConfig[] = [
  {
    key: "account_connected",
    icon: ShieldCheck,
    title: "Autorizar a sua conta Meta",
    description: "Conecte o Facebook Business para criar a sua conta WhatsApp Business (WABA).",
    why: "Sem essa autorização, não temos como vincular o seu número à API oficial da Meta.",
    cta: { label: "Conectar Meta", href: "/integrations" },
  },
  {
    key: "payment_method",
    icon: CreditCard,
    title: "Cadastrar uma forma de pagamento na Meta",
    description: "Acesse o Business Manager e adicione um cartão de crédito na sua conta WhatsApp.",
    why: "A Meta cobra diretamente o envio das mensagens (modelo BYOA). Sem cartão ativo, a conta é bloqueada e o número fica fora do ar.",
    cta: {
      label: "Abrir cobrança no Business Manager",
      href: "https://business.facebook.com/billing_hub/payment_settings",
      external: true,
    },
  },
  {
    key: "pin_defined",
    icon: KeyRound,
    title: "Definir o PIN de 6 dígitos",
    description: "Crie um PIN exclusivo do número e guarde com você.",
    why: "Esse PIN é exigido pela Meta toda vez que o número precisa ser re-registrado (após manutenção ou reativação). Salvo no sistema, fazemos esse reparo automaticamente quando necessário.",
    cta: { label: "Gerenciar PIN", href: "/integrations" },
  },
  {
    key: "number_verified",
    icon: PhoneCall,
    title: "Aguardar a verificação do número",
    description: "A Meta confirma o número (SMS/voz) e libera o envio de mensagens.",
    why: "Esse é o passo final, controlado pela Meta. Geralmente leva poucos minutos, mas pode demorar até 24h.",
    cta: null,
  },
];

const StepIcon = ({ status }: { status: StepStatus }) => {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "blocked") return <AlertTriangle className="h-5 w-5 text-destructive" />;
  return <Circle className="h-5 w-5 text-muted-foreground" />;
};

export function WhatsAppActivationGuide({ variant = "full" }: Props) {
  const { state, isLoading } = useWhatsAppActivationSteps();

  if (isLoading || !state) {
    if (variant === "compact") return null;
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No banner, esconde quando tudo estiver pronto.
  if (variant === "compact" && state.isFullyActivated) return null;

  const progressPct = (state.completedCount / state.totalSteps) * 100;

  // ---------- COMPACT (Dashboard banner) ----------
  if (variant === "compact") {
    return (
      <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
              <PhoneCall className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Finalize a ativação do seu WhatsApp ({state.completedCount} de {state.totalSteps} passos)
              </p>
              <p className="text-xs text-muted-foreground">
                Faltam algumas etapas obrigatórias na Meta para começar a enviar mensagens.
              </p>
              <Progress value={progressPct} className="h-1.5 w-full sm:w-64" />
            </div>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link to="/integrations">
              Continuar ativação
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---------- FULL (dentro do card WhatsApp em /integrations) ----------
  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Guia de ativação do WhatsApp</CardTitle>
            <CardDescription className="text-xs">
              {state.isFullyActivated
                ? "Tudo pronto. Seu número está ativo e pronto para enviar mensagens."
                : "Para enviar mensagens, é necessário concluir os 4 passos obrigatórios da Meta. Você só precisa fazer isso uma vez."}
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Progresso</p>
            <p className="text-sm font-semibold">
              {state.completedCount}/{state.totalSteps}
            </p>
          </div>
        </div>
        <Progress value={progressPct} className="h-1.5 mt-2" />
      </CardHeader>

      <CardContent className="space-y-3">
        {STEPS.map((step, idx) => {
          const stepState = state.steps.find((s) => s.key === step.key)!;
          const Icon = step.icon;
          const isDone = stepState.status === "done";
          const isBlocked = stepState.status === "blocked";

          return (
            <div
              key={step.key}
              className={`rounded-lg border p-3 transition-colors ${
                isDone
                  ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                  : isBlocked
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-background"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <StepIcon status={stepState.status} />
                  {idx < STEPS.length - 1 && (
                    <div className={`h-6 w-px ${isDone ? "bg-green-300 dark:bg-green-800" : "bg-border"}`} />
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-semibold">
                      {idx + 1}. {step.title}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  <p className="text-[11px] text-muted-foreground/90 italic">
                    Por que: {step.why}
                  </p>

                  {stepState.reason && !isDone && (
                    <p className="text-[11px] text-destructive/80 mt-1">
                      → {stepState.reason}
                    </p>
                  )}

                  {!isDone && step.cta && (
                    <div className="pt-1">
                      {step.cta.external ? (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                          <a href={step.cta.href} target="_blank" rel="noopener noreferrer">
                            {step.cta.label}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                          <Link to={step.cta.href}>{step.cta.label}</Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
