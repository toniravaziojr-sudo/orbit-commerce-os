import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StoreSettings } from "@/pages/StoreBuilder";
import { Loader2, Upload, Palette, Globe, Share2, BarChart3 } from "lucide-react";

interface StoreSettingsTabProps {
  settings: StoreSettings;
  onSave: (settings: Partial<StoreSettings>) => Promise<void>;
  saving: boolean;
}

export function StoreSettingsTab({ settings, onSave, saving }: StoreSettingsTabProps) {
  const [formData, setFormData] = useState(settings);

  const handleChange = (field: keyof StoreSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="space-y-6">
      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Informações Básicas
          </CardTitle>
          <CardDescription>
            Configure o nome, descrição e imagens da sua loja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="store_name">Nome da Loja</Label>
              <Input
                id="store_name"
                value={formData.store_name}
                onChange={(e) => handleChange("store_name", e.target.value)}
                placeholder="Minha Loja"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo_url">URL do Logo</Label>
              <Input
                id="logo_url"
                value={formData.logo_url}
                onChange={(e) => handleChange("logo_url", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="store_description">Descrição da Loja</Label>
            <Textarea
              id="store_description"
              value={formData.store_description}
              onChange={(e) => handleChange("store_description", e.target.value)}
              placeholder="Descreva sua loja..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="favicon_url">URL do Favicon</Label>
            <Input
              id="favicon_url"
              value={formData.favicon_url}
              onChange={(e) => handleChange("favicon_url", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Cores e Aparência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Cores e Aparência
          </CardTitle>
          <CardDescription>
            Personalize as cores da sua loja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => handleChange("primary_color", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => handleChange("primary_color", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_color">Cor Secundária</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary_color"
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => handleChange("secondary_color", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.secondary_color}
                  onChange={(e) => handleChange("secondary_color", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent_color">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accent_color"
                  type="color"
                  value={formData.accent_color}
                  onChange={(e) => handleChange("accent_color", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.accent_color}
                  onChange={(e) => handleChange("accent_color", e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="header_style">Estilo do Cabeçalho</Label>
              <Select
                value={formData.header_style}
                onValueChange={(value) => handleChange("header_style", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="centered">Centralizado</SelectItem>
                  <SelectItem value="minimal">Minimalista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer_style">Estilo do Rodapé</Label>
              <Select
                value={formData.footer_style}
                onValueChange={(value) => handleChange("footer_style", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Padrão</SelectItem>
                  <SelectItem value="minimal">Minimalista</SelectItem>
                  <SelectItem value="expanded">Expandido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview das cores */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">Prévia das cores:</p>
            <div className="flex gap-4">
              <div
                className="h-12 w-24 rounded-md shadow-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: formData.primary_color }}
              >
                Primária
              </div>
              <div
                className="h-12 w-24 rounded-md shadow-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: formData.secondary_color }}
              >
                Secundária
              </div>
              <div
                className="h-12 w-24 rounded-md shadow-sm flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: formData.accent_color }}
              >
                Destaque
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes Sociais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Redes Sociais
          </CardTitle>
          <CardDescription>
            Links para suas redes sociais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="social_whatsapp">WhatsApp</Label>
              <Input
                id="social_whatsapp"
                value={formData.social_whatsapp}
                onChange={(e) => handleChange("social_whatsapp", e.target.value)}
                placeholder="5511999999999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="social_instagram">Instagram</Label>
              <Input
                id="social_instagram"
                value={formData.social_instagram}
                onChange={(e) => handleChange("social_instagram", e.target.value)}
                placeholder="@minhaloja"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="social_facebook">Facebook</Label>
              <Input
                id="social_facebook"
                value={formData.social_facebook}
                onChange={(e) => handleChange("social_facebook", e.target.value)}
                placeholder="https://facebook.com/minhaloja"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEO e Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            SEO e Analytics
          </CardTitle>
          <CardDescription>
            Configurações para buscadores e rastreamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seo_title">Título SEO</Label>
            <Input
              id="seo_title"
              value={formData.seo_title}
              onChange={(e) => handleChange("seo_title", e.target.value)}
              placeholder="Minha Loja - Os melhores produtos"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seo_description">Descrição SEO</Label>
            <Textarea
              id="seo_description"
              value={formData.seo_description}
              onChange={(e) => handleChange("seo_description", e.target.value)}
              placeholder="Descrição que aparecerá nos resultados de busca..."
              rows={2}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="google_analytics_id">Google Analytics ID</Label>
              <Input
                id="google_analytics_id"
                value={formData.google_analytics_id}
                onChange={(e) => handleChange("google_analytics_id", e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook_pixel_id">Facebook Pixel ID</Label>
              <Input
                id="facebook_pixel_id"
                value={formData.facebook_pixel_id}
                onChange={(e) => handleChange("facebook_pixel_id", e.target.value)}
                placeholder="123456789"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publicação */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="is_published" className="text-base">Publicar Loja</Label>
              <p className="text-sm text-muted-foreground">
                Ativar para tornar sua loja visível ao público
              </p>
            </div>
            <Switch
              id="is_published"
              checked={formData.is_published}
              onCheckedChange={(checked) => handleChange("is_published", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar Alterações"
          )}
        </Button>
      </div>
    </div>
  );
}
