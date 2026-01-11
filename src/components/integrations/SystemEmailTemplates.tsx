import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { EmailRichTextEditor } from "./EmailRichTextEditor";
import { 
  Mail, 
  RefreshCw, 
  Send, 
  Eye,
  Save,
  FileText,
  UserPlus,
  KeyRound,
  BookOpen,
  Info,
  Copy,
  Check,
  Plus,
  AlertCircle
} from "lucide-react";

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  variables: string[];
  is_active: boolean;
  send_delay_minutes: number | null;
  auto_send: boolean | null;
  created_at: string;
  updated_at: string;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  auth_confirm: <UserPlus className="h-4 w-4" />,
  welcome: <Mail className="h-4 w-4" />,
  password_reset: <KeyRound className="h-4 w-4" />,
  tutorials: <BookOpen className="h-4 w-4" />,
  tenant_user_invite: <Mail className="h-4 w-4" />,
};

// NF-e template is tenant-scoped (in fiscal_settings), not a system template
const TEMPLATE_ORDER = ["auth_confirm", "welcome", "password_reset", "tutorials", "tenant_user_invite"];

// Variable descriptions (system templates only - NF-e is tenant-scoped)
const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  app_name: "Nome do aplicativo (Comando Central)",
  user_name: "Nome do usuário",
  confirmation_url: "Link de confirmação de email",
  dashboard_url: "Link para o painel/dashboard",
  reset_url: "Link para redefinir senha",
  tenant_name: "Nome da loja/tenant",
  inviter_name: "Nome de quem enviou o convite",
  user_type_label: "Tipo do usuário convidado (ex: Gerente, Editor)",
  accept_url: "Link para aceitar o convite",
  expires_at: "Data de expiração do convite",
  invited_email: "Email do convidado",
};

// URL redirect info per template (NF-e is tenant-scoped, not here)
const TEMPLATE_REDIRECT_INFO: Record<string, string> = {
  auth_confirm: "Após confirmar, o usuário é redirecionado para o login",
  welcome: "O botão direciona para app.comandocentral.com.br (dashboard)",
  password_reset: "Após clicar, abre a página de nova senha, depois vai para o login",
  tutorials: "Enviado automaticamente 1 hora após criação da conta. O botão direciona para o dashboard.",
  tenant_user_invite: "O botão leva para a página de aceite do convite (app.comandocentral.com.br/accept-invite?token=...)",
};

// Default templates for seeding
const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    template_key: 'tenant_user_invite',
    name: 'Convite de Equipe',
    description: 'Email enviado quando um membro é convidado para a equipe',
    subject: 'Você foi convidado para {{tenant_name}} - Comando Central',
    body_html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; padding: 24px 20px; background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);">
      <img src="https://app.comandocentral.com.br/images/email-logo.png" alt="Comando Central" style="height: 120px; width: auto; display: block; margin: 0 auto;" />
    </div>
    <div style="padding: 40px 20px; background-color: #FFFFFF;">
      <h1 style="color: #1E293B; margin: 0 0 20px; font-size: 24px;">Você foi convidado!</h1>
      <p style="color: #475569; line-height: 1.6;">
        <strong>{{inviter_name}}</strong> convidou você para fazer parte da equipe de <strong>{{tenant_name}}</strong> no Comando Central.
      </p>
      <p style="color: #475569; line-height: 1.6;">
        Seu perfil de acesso será: <strong>{{user_type_label}}</strong>
      </p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{accept_url}}" style="background-color: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Aceitar Convite</a>
      </p>
      <p style="color: #64748B; font-size: 14px;">Este convite expira em: {{expires_at}}</p>
    </div>
    <div style="text-align: center; padding: 20px; background-color: #F8FAFC; border-top: 1px solid #E2E8F0;">
      <p style="color: #64748B; font-size: 12px; margin: 0;">© 2025 Comando Central — O centro de comando do seu e-commerce.</p>
    </div>
  </div>`,
    variables: ['tenant_name', 'inviter_name', 'user_type_label', 'accept_url', 'expires_at', 'invited_email'],
    is_active: true,
    send_delay_minutes: 0,
    auto_send: false,
  },
];

export function SystemEmailTemplates() {
  const { toast } = useToast();
  const { isPlatformOperator, isLoading: authLoading } = usePlatformOperator();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<Partial<EmailTemplate>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isPlatformOperator) {
      loadTemplates();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isPlatformOperator]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      console.log('[SystemEmailTemplates] Loading templates...');
      const { data, error } = await supabase
        .from("system_email_templates")
        .select("*")
        .order("template_key");

      if (error) {
        console.error('[SystemEmailTemplates] Query error:', error);
        throw error;
      }
      
      console.log('[SystemEmailTemplates] Loaded templates:', data?.length || 0);
      
      // Sort by predefined order
      const sorted = (data || []).sort((a, b) => {
        const aIndex = TEMPLATE_ORDER.indexOf(a.template_key);
        const bIndex = TEMPLATE_ORDER.indexOf(b.template_key);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
      
      setTemplates(sorted);
      
      // Select first template by default
      if (sorted.length > 0 && !selectedTemplate) {
        setSelectedTemplate(sorted[0].template_key);
        setEditedTemplate(sorted[0]);
      }
    } catch (error: any) {
      console.error("[SystemEmailTemplates] Error loading templates:", error);
      setLoadError(error.message || 'Erro desconhecido ao carregar templates');
      toast({ 
        title: "Erro ao carregar templates", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (templateKey: string) => {
    const template = templates.find(t => t.template_key === templateKey);
    if (template) {
      setSelectedTemplate(templateKey);
      setEditedTemplate(template);
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate || !editedTemplate) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("system_email_templates")
        .update({
          subject: editedTemplate.subject,
          body_html: editedTemplate.body_html,
          is_active: editedTemplate.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("template_key", selectedTemplate);

      if (error) throw error;

      toast({ title: "Template salvo com sucesso!" });
      await loadTemplates();
    } catch (error: any) {
      console.error('[SystemEmailTemplates] Save error:', error);
      toast({ 
        title: "Erro ao salvar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDefaultTemplates = async () => {
    setIsCreating(true);
    try {
      console.log('[SystemEmailTemplates] Creating default templates...');
      
      for (const template of DEFAULT_TEMPLATES) {
        const { error } = await supabase
          .from("system_email_templates")
          .upsert(
            {
              ...template,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'template_key' }
          );
        
        if (error) {
          console.error(`[SystemEmailTemplates] Error creating template ${template.template_key}:`, error);
          throw error;
        }
      }

      toast({ 
        title: "Templates criados!", 
        description: "Os templates padrão foram criados com sucesso." 
      });
      await loadTemplates();
    } catch (error: any) {
      console.error('[SystemEmailTemplates] Create error:', error);
      toast({ 
        title: "Erro ao criar templates", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast({ title: "Informe um email válido", variant: "destructive" });
      return;
    }

    if (!editedTemplate.subject || !editedTemplate.body_html) {
      toast({ title: "Template incompleto", variant: "destructive" });
      return;
    }

    setIsTesting(true);
    try {
      // Replace variables with sample values
      let html = editedTemplate.body_html || "";
      let subject = editedTemplate.subject || "";
      
      const sampleValues: Record<string, string> = {
        app_name: "Comando Central",
        user_name: "Usuário Teste",
        confirmation_url: "https://app.comandocentral.com.br/auth?confirmed=true",
        dashboard_url: "https://app.comandocentral.com.br",
        reset_url: "https://app.comandocentral.com.br/reset-password?token=sample",
        tenant_name: "Loja de Teste",
        inviter_name: "João Admin",
        user_type_label: "Gerente",
        accept_url: "https://app.comandocentral.com.br/accept-invite?token=sample",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        invited_email: testEmail,
      };

      Object.entries(sampleValues).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, "g");
        html = html.replace(regex, value);
        subject = subject.replace(regex, value);
      });

      const { data, error } = await supabase.functions.invoke("send-system-email", {
        body: {
          to: testEmail.trim(),
          subject: `[TESTE] ${subject}`,
          html,
          email_type: "template_test"
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({ title: "Email de teste enviado!", description: `Verifique ${testEmail}` });
      } else {
        toast({ title: "Falha ao enviar", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      console.error('[SystemEmailTemplates] Test send error:', error);
      toast({ title: "Erro ao enviar teste", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const copyVariable = async (variable: string) => {
    const text = `{{${variable}}}`;
    await navigator.clipboard.writeText(text);
    setCopiedVar(variable);
    toast({ title: "Copiado!", description: text });
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const getPreviewHtml = () => {
    let html = editedTemplate.body_html || "";
    const sampleValues: Record<string, string> = {
      app_name: "Comando Central",
      user_name: "João Silva",
      confirmation_url: "#",
      dashboard_url: "#",
      reset_url: "#",
      tenant_name: "Minha Loja",
      inviter_name: "Maria Admin",
      user_type_label: "Gerente",
      accept_url: "#",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      invited_email: "convidado@exemplo.com",
    };

    Object.entries(sampleValues).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, value);
    });

    return html;
  };

  // Don't render if not platform admin
  if (!isPlatformOperator) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Templates de Email do App</CardTitle>
              <CardDescription>
                Personalize os emails padrão enviados pelo sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Carregando templates...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle>Templates de Email do App</CardTitle>
              <CardDescription>
                Personalize os emails padrão enviados pelo sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Erro ao carregar templates: {loadError}</span>
              <Button variant="outline" size="sm" onClick={loadTemplates}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Templates de Email do App</CardTitle>
              <CardDescription>
                Personalize os emails padrão enviados pelo sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Nenhum template encontrado</h3>
              <p className="text-muted-foreground mt-1">
                Crie os templates padrão para começar a personalizar os emails do sistema.
              </p>
            </div>
            <Button onClick={handleCreateDefaultTemplates} disabled={isCreating}>
              {isCreating ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Criar templates padrão
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentTemplate = templates.find(t => t.template_key === selectedTemplate);

  // Calculate dynamic grid columns based on template count
  const getGridCols = () => {
    const count = templates.length;
    if (count <= 2) return 'grid-cols-2';
    if (count <= 3) return 'grid-cols-3';
    if (count <= 4) return 'grid-cols-4';
    if (count <= 6) return 'grid-cols-3 sm:grid-cols-6';
    return 'grid-cols-4 sm:grid-cols-4';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Templates de Email do App</CardTitle>
              <CardDescription>
                Personalize os emails padrão enviados pelo sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTemplate || ""} onValueChange={handleSelectTemplate}>
            <div className="overflow-x-auto -mx-1 px-1 mb-6">
              <TabsList className={`grid w-full ${getGridCols()}`}>
                {templates.map((template) => (
                  <TabsTrigger 
                    key={template.template_key} 
                    value={template.template_key} 
                    className="gap-2 text-xs sm:text-sm"
                  >
                    {TEMPLATE_ICONS[template.template_key] || <FileText className="h-4 w-4" />}
                    <span className="hidden sm:inline truncate">{template.name}</span>
                    <span className="sm:hidden truncate">{template.name.split(' ')[0]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {templates.map((template) => (
              <TabsContent key={template.template_key} value={template.template_key} className="space-y-6">
                {/* Template Info */}
                <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {TEMPLATE_ICONS[template.template_key] || <FileText className="h-4 w-4" />}
                      {template.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${template.template_key}`} className="text-sm">
                        Ativo
                      </Label>
                      <Switch
                        id={`active-${template.template_key}`}
                        checked={editedTemplate.is_active ?? template.is_active}
                        onCheckedChange={(checked) => 
                          setEditedTemplate({ ...editedTemplate, is_active: checked })
                        }
                      />
                    </div>
                    <Badge variant={editedTemplate.is_active ?? template.is_active ? "default" : "secondary"}>
                      {editedTemplate.is_active ?? template.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>

                {/* Redirect Info */}
                {TEMPLATE_REDIRECT_INFO[template.template_key] && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Redirecionamento:</strong> {TEMPLATE_REDIRECT_INFO[template.template_key]}
                      {template.template_key === 'tutorials' && template.auto_send && (
                        <span className="block mt-1">
                          <strong>Envio automático:</strong> {template.send_delay_minutes} minutos após criação da conta ({Math.round((template.send_delay_minutes || 60) / 60)} hora{(template.send_delay_minutes || 60) >= 120 ? 's' : ''})
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Variables - Clickable to copy */}
                <div className="p-4 rounded-lg border bg-background">
                  <Label className="text-sm font-medium mb-3 block">
                    Variáveis disponíveis (clique para copiar):
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {template.variables.map((v) => (
                      <Button
                        key={v}
                        variant="outline"
                        size="sm"
                        className="h-auto py-1.5 px-3 font-mono text-xs gap-1.5 hover:bg-primary/10"
                        onClick={() => copyVariable(v)}
                      >
                        {copiedVar === v ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {`{{${v}}}`}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    {template.variables.map((v) => (
                      <div key={v}>
                        <code className="text-primary">{`{{${v}}}`}</code>: {VARIABLE_DESCRIPTIONS[v] || v}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Assunto do Email</Label>
                  <Input
                    id="subject"
                    value={editedTemplate.subject || ""}
                    onChange={(e) => setEditedTemplate({ ...editedTemplate, subject: e.target.value })}
                    placeholder="Assunto do email..."
                  />
                </div>

                {/* Body - Rich Text Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="body">Corpo do Email</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPreviewOpen(true)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Visualizar
                    </Button>
                  </div>
                  <EmailRichTextEditor
                    value={editedTemplate.body_html || ""}
                    onChange={(html) => setEditedTemplate({ ...editedTemplate, body_html: html })}
                    placeholder="Digite o conteúdo do email..."
                    templateKey={template.template_key}
                    minHeight="350px"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                    {isSaving ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar Template
                  </Button>

                  <div className="flex gap-2 flex-1">
                    <Input
                      type="email"
                      placeholder="email@teste.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleTestSend} 
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-visualização do Email</DialogTitle>
            <DialogDescription>
              {editedTemplate.subject?.replace(/{{app_name}}/g, "Comando Central").replace(/{{tenant_name}}/g, "Minha Loja")}
            </DialogDescription>
          </DialogHeader>
          <div 
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
