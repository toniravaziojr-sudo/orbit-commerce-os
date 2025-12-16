import { Category } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Image as ImageIcon, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { validateSlugFormat, generateSlug as generateSlugUtil } from '@/lib/slugPolicy';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CategoryFormProps {
  formData: {
    name: string;
    slug: string;
    description: string;
    image_url: string;
    parent_id: string;
    is_active: boolean;
    sort_order: number;
    seo_title: string;
    seo_description: string;
    banner_desktop_url: string;
    banner_mobile_url: string;
  };
  onChange: (data: CategoryFormProps['formData']) => void;
  onSubmit: () => void;
  onClose: () => void;
  isEditing: boolean;
  parentCategories: Category[];
  editingCategoryId?: string;
  isLoading?: boolean;
}

function ImageUploadField({ 
  label, 
  value, 
  onChange, 
  placeholder,
  helpText,
}: { 
  label: string; 
  value: string; 
  onChange: (url: string) => void; 
  placeholder: string;
  helpText?: string;
}) {
  const { currentTenant } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!currentTenant?.id) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${currentTenant.id}/categories/${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
      </div>
      {value && (
        <div className="h-20 w-full rounded border overflow-hidden bg-muted">
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

export function CategoryForm({
  formData,
  onChange,
  onSubmit,
  onClose,
  isEditing,
  parentCategories,
  editingCategoryId,
  isLoading,
}: CategoryFormProps) {
  // Filter out the current category and its children from parent options
  const availableParents = parentCategories.filter(c => c.id !== editingCategoryId);

  // Use centralized slug generation utility
  const handleGenerateSlug = (name: string) => generateSlugUtil(name);
  
  // Validate slug in real-time
  const slugValidation = validateSlugFormat(formData.slug);
  const isSlugValid = slugValidation.isValid;
  const slugError = slugValidation.error;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isEditing ? 'Editar Categoria' : 'Nova Categoria'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              onChange({
                ...formData,
                name,
                slug: formData.slug || handleGenerateSlug(name),
              });
            }}
            placeholder="Nome da categoria"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => onChange({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
            placeholder="slug-da-categoria"
            className={!isSlugValid && formData.slug ? 'border-destructive' : ''}
          />
          {!isSlugValid && formData.slug ? (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {slugError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Usado na URL: /c/{formData.slug || 'slug'}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="parent">Categoria Pai</Label>
          <Select
            value={formData.parent_id || 'none'}
            onValueChange={(v) => onChange({ ...formData, parent_id: v === 'none' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nenhuma (categoria raiz)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma (categoria raiz)</SelectItem>
              {availableParents.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            placeholder="Descrição da categoria"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="image_url">Imagem (miniatura)</Label>
          <div className="flex gap-2">
            <Input
              id="image_url"
              value={formData.image_url}
              onChange={(e) => onChange({ ...formData, image_url: e.target.value })}
              placeholder="URL da imagem"
            />
            {formData.image_url && (
              <div className="h-10 w-10 rounded border overflow-hidden flex-shrink-0">
                <img
                  src={formData.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Banner section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">Banner da Categoria</h4>
          <div className="space-y-4">
            <ImageUploadField
              label="Banner Desktop"
              value={formData.banner_desktop_url || ''}
              onChange={(url) => onChange({ ...formData, banner_desktop_url: url })}
              placeholder="URL do banner desktop"
              helpText="Recomendado: 1920×400px"
            />
            <ImageUploadField
              label="Banner Mobile"
              value={formData.banner_mobile_url || ''}
              onChange={(url) => onChange({ ...formData, banner_mobile_url: url })}
              placeholder="URL do banner mobile"
              helpText="Recomendado: 768×300px"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => onChange({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            Categoria ativa
          </Label>
        </div>

        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">SEO</h4>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="seo_title">Título SEO</Label>
              <Input
                id="seo_title"
                value={formData.seo_title}
                onChange={(e) => onChange({ ...formData, seo_title: e.target.value })}
                placeholder="Título para mecanismos de busca"
              />
              <p className="text-xs text-muted-foreground">
                {formData.seo_title.length}/60 caracteres
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo_description">Descrição SEO</Label>
              <Textarea
                id="seo_description"
                value={formData.seo_description}
                onChange={(e) => onChange({ ...formData, seo_description: e.target.value })}
                placeholder="Descrição para mecanismos de busca"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {formData.seo_description.length}/160 caracteres
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!formData.name || !isSlugValid || isLoading} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
