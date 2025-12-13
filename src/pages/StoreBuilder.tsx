import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Palette, FileText, Settings2, Eye } from "lucide-react";
import { StoreSettingsTab } from "@/components/store-builder/StoreSettingsTab";
import { StorePagesTab } from "@/components/store-builder/StorePagesTab";
import { StorePreviewTab } from "@/components/store-builder/StorePreviewTab";
import { toast } from "sonner";

export interface StoreSettings {
  id?: string;
  tenant_id: string;
  store_name: string;
  store_description: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  header_style: string;
  footer_style: string;
  social_facebook: string;
  social_instagram: string;
  social_whatsapp: string;
  seo_title: string;
  seo_description: string;
  google_analytics_id: string;
  facebook_pixel_id: string;
  is_published: boolean;
}

const defaultSettings: Omit<StoreSettings, "tenant_id"> = {
  store_name: "",
  store_description: "",
  logo_url: "",
  favicon_url: "",
  primary_color: "#6366f1",
  secondary_color: "#8b5cf6",
  accent_color: "#f59e0b",
  header_style: "default",
  footer_style: "default",
  social_facebook: "",
  social_instagram: "",
  social_whatsapp: "",
  seo_title: "",
  seo_description: "",
  google_analytics_id: "",
  facebook_pixel_id: "",
  is_published: false,
};

export default function StoreBuilder() {
  const { currentTenant } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tenant = currentTenant;

  useEffect(() => {
    if (tenant?.id) {
      fetchSettings();
    }
  }, [tenant?.id]);

  const fetchSettings = async () => {
    if (!tenant?.id) return;

    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings(data as StoreSettings);
      } else {
        setSettings({
          ...defaultSettings,
          tenant_id: tenant.id,
          store_name: tenant.name,
        });
      }
    } catch (error) {
      console.error("Error fetching store settings:", error);
      toast.error("Erro ao carregar configurações da loja");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<StoreSettings>) => {
    if (!tenant?.id || !settings) return;

    setSaving(true);
    try {
      const dataToSave = { ...settings, ...newSettings };

      if (settings.id) {
        const { error } = await supabase
          .from("store_settings")
          .update(dataToSave)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("store_settings")
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        setSettings(data as StoreSettings);
      }

      setSettings((prev) => (prev ? { ...prev, ...newSettings } : null));
      toast.success("Configurações salvas com sucesso");
    } catch (error) {
      console.error("Error saving store settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const storeUrl = tenant?.slug ? `/store/${tenant.slug}` : "";

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader
        title="Builder da Loja"
        description="Personalize a aparência e configurações da sua loja online"
      />

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="settings" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Páginas</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Prévia</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          {settings && (
            <StoreSettingsTab
              settings={settings}
              onSave={saveSettings}
              saving={saving}
            />
          )}
        </TabsContent>

        <TabsContent value="pages">
          <StorePagesTab tenantId={tenant?.id || ""} />
        </TabsContent>

        <TabsContent value="preview">
          <StorePreviewTab storeUrl={storeUrl} settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
