import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { X, Save, AlertCircle } from 'lucide-react';
import { validateSlugFormat, generateSlug as generateSlugUtil } from '@/lib/slugPolicy';
import { ImageUploaderWithLibrary } from '@/components/builder/ImageUploaderWithLibrary';
import { GenerateSeoButton } from '@/components/seo/GenerateSeoButton';
interface CategoryFormProps {
  formData: {
    name: string;
    slug: string;
    description: string;
    image_url: string;
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
  editingCategoryId?: string;
  isLoading?: boolean;
}


export function CategoryForm({
  formData,
  onChange,
  onSubmit,
  onClose,
  isEditing,
  editingCategoryId,
  isLoading,
}: CategoryFormProps) {
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
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            placeholder="Descrição da categoria"
            rows={3}
          />
        </div>

        {/* Miniatura (Thumbnail) */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">Miniatura</h4>
          <div className="space-y-2">
            <Label>Imagem de Miniatura</Label>
            <p className="text-xs text-muted-foreground mb-2">Exibida na listagem de categorias. Recomendado: 200×200px</p>
            <ImageUploaderWithLibrary
              value={formData.image_url || ''}
              onChange={(url) => onChange({ ...formData, image_url: url })}
              variant="desktop"
              aspectRatio="square"
            />
          </div>
        </div>

        {/* Banner section */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3 text-sm text-muted-foreground">Banner da Categoria</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Banner Desktop</Label>
              <p className="text-xs text-muted-foreground mb-2">Recomendado: 1920×400px</p>
              <ImageUploaderWithLibrary
                value={formData.banner_desktop_url || ''}
                onChange={(url) => onChange({ ...formData, banner_desktop_url: url })}
                variant="desktop"
                aspectRatio="banner"
              />
            </div>
            <div className="space-y-2">
              <Label>Banner Mobile</Label>
              <p className="text-xs text-muted-foreground mb-2">Recomendado: 768×300px</p>
              <ImageUploaderWithLibrary
                value={formData.banner_mobile_url || ''}
                onChange={(url) => onChange({ ...formData, banner_mobile_url: url })}
                variant="mobile"
                aspectRatio="banner"
              />
            </div>
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
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm text-muted-foreground">SEO</h4>
            <GenerateSeoButton
              input={{
                type: 'category',
                name: formData.name,
                description: formData.description,
              }}
              onGenerated={(result) => {
                onChange({
                  ...formData,
                  seo_title: result.seo_title,
                  seo_description: result.seo_description,
                });
              }}
              disabled={!formData.name}
            />
          </div>
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
