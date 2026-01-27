import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, ArrowRight, Zap, Crown, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface UpgradePromptProps {
  moduleKey: string;
  moduleName: string;
  moduleDescription?: string;
  currentPlan: string;
  variant?: 'card' | 'inline' | 'minimal';
}

// Mapeamento de planos para nomes amigáveis e cores
const PLAN_INFO: Record<string, { name: string; color: string; minPlan: string }> = {
  basico: { name: 'Básico', color: 'bg-slate-500', minPlan: 'evolucao' },
  evolucao: { name: 'Evolução', color: 'bg-blue-500', minPlan: 'profissional' },
  profissional: { name: 'Profissional', color: 'bg-indigo-500', minPlan: 'avancado' },
  avancado: { name: 'Avançado', color: 'bg-purple-500', minPlan: 'impulso' },
  impulso: { name: 'Impulso', color: 'bg-amber-500', minPlan: 'consolidar' },
  consolidar: { name: 'Consolidar', color: 'bg-emerald-500', minPlan: 'comando_maximo' },
  comando_maximo: { name: 'Comando Máximo', color: 'bg-rose-500', minPlan: 'customizado' },
};

// Mapeamento de módulos para planos mínimos
const MODULE_MIN_PLANS: Record<string, string> = {
  marketing_advanced: 'profissional',
  crm_whatsapp: 'profissional',
  crm_support: 'profissional',
  erp_finance: 'impulso',
  erp_purchases: 'impulso',
  partnerships: 'impulso',
  users_permissions: 'avancado',
  blog_ai: 'profissional',
  central_analytics: 'profissional',
  central_assistant: 'avancado',
};

/**
 * Componente de prompt para upgrade de plano.
 * 
 * Exibe uma UI amigável informando que o módulo requer upgrade,
 * com CTA para ver planos ou falar com suporte.
 */
export function UpgradePrompt({ 
  moduleKey, 
  moduleName, 
  moduleDescription,
  currentPlan,
  variant = 'card',
}: UpgradePromptProps) {
  const navigate = useNavigate();
  const [showContactDialog, setShowContactDialog] = useState(false);
  
  const currentPlanInfo = PLAN_INFO[currentPlan] || { name: currentPlan, color: 'bg-slate-500', minPlan: 'evolucao' };
  const minPlanKey = MODULE_MIN_PLANS[moduleKey] || currentPlanInfo.minPlan;
  const minPlanInfo = PLAN_INFO[minPlanKey] || { name: minPlanKey, color: 'bg-indigo-500', minPlan: '' };

  const handleViewPlans = () => {
    navigate('/settings/plans');
  };

  const handleContact = () => {
    setShowContactDialog(true);
  };

  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        <span>Requer plano {minPlanInfo.name}</span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={handleViewPlans}>
          Ver planos
        </Button>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{moduleName}</p>
            <p className="text-sm text-muted-foreground">
              Disponível a partir do plano {minPlanInfo.name}
            </p>
          </div>
        </div>
        <Button onClick={handleViewPlans} size="sm">
          <Sparkles className="h-4 w-4 mr-2" />
          Fazer Upgrade
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className="max-w-md mx-auto border-primary/20 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Módulo Bloqueado</CardTitle>
          <CardDescription className="text-base">
            {moduleDescription || `O módulo "${moduleName}" não está disponível no seu plano atual.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Comparação de planos */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <Badge variant="outline" className="mb-2">
                Seu plano
              </Badge>
              <p className="font-semibold">{currentPlanInfo.name}</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <Badge className={`${minPlanInfo.color} text-white mb-2`}>
                Necessário
              </Badge>
              <p className="font-semibold">{minPlanInfo.name}</p>
            </div>
          </div>

          {/* Benefícios do upgrade */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              O que você ganha com o upgrade:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
              <li>• Acesso completo ao {moduleName}</li>
              <li>• Mais recursos e funcionalidades</li>
              <li>• Suporte prioritário</li>
            </ul>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Button onClick={handleViewPlans} className="w-full" size="lg">
              <Sparkles className="h-4 w-4 mr-2" />
              Ver Planos e Fazer Upgrade
            </Button>
            <Button onClick={handleContact} variant="outline" className="w-full">
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com Suporte
            </Button>
          </div>

          {/* Nota */}
          <p className="text-xs text-center text-muted-foreground">
            Não tem cartão de crédito? Fale conosco para outras formas de pagamento.
          </p>
        </CardContent>
      </Card>

      {/* Dialog de contato */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Falar com Suporte</DialogTitle>
            <DialogDescription>
              Nossa equipe está pronta para ajudar você a escolher o melhor plano.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <a 
                    href="https://wa.me/5511999999999" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    (11) 99999-9999
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Email</p>
                  <a 
                    href="mailto:suporte@comandocentral.com.br"
                    className="text-sm text-primary hover:underline"
                  >
                    suporte@comandocentral.com.br
                  </a>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Horário de atendimento: Seg-Sex 9h às 18h
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
