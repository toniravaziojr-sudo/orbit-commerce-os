import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  Check
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
  created_at: string;
  updated_at: string;
}

// Only this email can see this component
const PLATFORM_ADMIN_EMAIL = "respeiteohomem@gmail.com";

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  auth_confirm: <UserPlus className="h-4 w-4" />,
  welcome: <Mail className="h-4 w-4" />,
  password_reset: <KeyRound className="h-4 w-4" />,
  tutorials: <BookOpen className="h-4 w-4" />,
};

const TEMPLATE_ORDER = ["auth_confirm", "welcome", "password_reset", "tutorials"];

// Variable descriptions
const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  app_name: "Nome do aplicativo (Comando Central)",
  user_name: "Nome do usuário",
  confirmation_url: "Link de confirmação de email",
  dashboard_url: "Link para o painel/dashboard",
  reset_url: "Link para redefinir senha",
};

// URL redirect info per template
const TEMPLATE_REDIRECT_INFO: Record<string, string> = {
  auth_confirm: "Após confirmar, o usuário é redirecionado para o login",
  welcome: "O botão direciona para app.comandocentral.com.br (dashboard)",
  password_reset: "Após clicar, abre a página de nova senha, depois vai para o login",
  tutorials: "O botão direciona para app.comandocentral.com.br (dashboard)",
};

export function SystemEmailTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<Partial<EmailTemplate>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email || null);
      if (user?.email === PLATFORM_ADMIN_EMAIL) {
        loadTemplates();
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_email_templates")
        .select("*")
        .order("template_key");

      if (error) throw error;
      
      // Sort by predefined order
      const sorted = (data || []).sort((a, b) => {
        const aIndex = TEMPLATE_ORDER.indexOf(a.template_key);
        const bIndex = TEMPLATE_ORDER.indexOf(b.template_key);
        return aIndex - bIndex;
      });
      
      setTemplates(sorted);
      
      // Select first template by default
      if (sorted.length > 0 && !selectedTemplate) {
        setSelectedTemplate(sorted[0].template_key);
        setEditedTemplate(sorted[0]);
      }
    } catch (error: any) {
      console.error("Error loading templates:", error);
      toast({ title: "Erro ao carregar templates", description: error.message, variant: "destructive" });
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
          updated_at: new Date().toISOString()
        })
        .eq("template_key", selectedTemplate);

      if (error) throw error;

      toast({ title: "Template salvo com sucesso!" });
      await loadTemplates();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
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
    };

    Object.entries(sampleValues).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, value);
    });

    return html;
  };

  // Don't render if not platform admin
  if (currentUserEmail !== PLATFORM_ADMIN_EMAIL) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentTemplate = templates.find(t => t.template_key === selectedTemplate);

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
            <TabsList className="grid w-full grid-cols-4 mb-6">
              {templates.map((template) => (
                <TabsTrigger key={template.template_key} value={template.template_key} className="gap-2">
                  {TEMPLATE_ICONS[template.template_key]}
                  <span className="hidden sm:inline">{template.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {templates.map((template) => (
              <TabsContent key={template.template_key} value={template.template_key} className="space-y-6">
                {/* Template Info */}
                <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {TEMPLATE_ICONS[template.template_key]}
                      {template.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                  </div>
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {/* Redirect Info */}
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Redirecionamento:</strong> {TEMPLATE_REDIRECT_INFO[template.template_key]}
                  </AlertDescription>
                </Alert>

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
              {editedTemplate.subject?.replace(/{{app_name}}/g, "Comando Central")}
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
