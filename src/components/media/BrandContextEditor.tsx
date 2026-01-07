import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Save, 
  Upload, 
  Trash2, 
  Palette,
  Package,
  AlertTriangle,
} from "lucide-react";

const formSchema = z.object({
  brand_summary: z.string().optional(),
  tone_of_voice: z.string().optional(),
  visual_style_guidelines: z.string().optional(),
  banned_claims: z.string().optional(),
  do_not_do: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function BrandContextEditor() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [packshotFile, setPackshotFile] = useState<File | null>(null);
  const [packshotPreview, setPackshotPreview] = useState<string | null>(null);
  const [isUploadingPackshot, setIsUploadingPackshot] = useState(false);

  // Fetch existing brand context
  const { data: brandContext, isLoading } = useQuery({
    queryKey: ["brand-context", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from("tenant_brand_context")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brand_summary: "",
      tone_of_voice: "",
      visual_style_guidelines: "",
      banned_claims: "",
      do_not_do: "",
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (brandContext) {
      form.reset({
        brand_summary: brandContext.brand_summary || "",
        tone_of_voice: brandContext.tone_of_voice || "",
        visual_style_guidelines: brandContext.visual_style_guidelines || "",
        banned_claims: brandContext.banned_claims?.join(", ") || "",
        do_not_do: brandContext.do_not_do?.join(", ") || "",
      });
      if (brandContext.packshot_url) {
        setPackshotPreview(brandContext.packshot_url);
      }
    }
  }, [brandContext, form]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!currentTenant?.id) throw new Error("Tenant não encontrado");

      const banned_claims = values.banned_claims
        ? values.banned_claims.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      const do_not_do = values.do_not_do
        ? values.do_not_do.split(",").map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        tenant_id: currentTenant.id,
        brand_summary: values.brand_summary || null,
        tone_of_voice: values.tone_of_voice || null,
        visual_style_guidelines: values.visual_style_guidelines || null,
        banned_claims,
        do_not_do,
        manually_edited_at: new Date().toISOString(),
      };

      if (brandContext?.id) {
        const { error } = await supabase
          .from("tenant_brand_context")
          .update(payload)
          .eq("id", brandContext.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_brand_context")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Contexto de marca salvo");
      queryClient.invalidateQueries({ queryKey: ["brand-context"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    },
  });

  // Upload packshot
  const handlePackshotUpload = async () => {
    if (!packshotFile || !currentTenant?.id) return;

    setIsUploadingPackshot(true);
    try {
      const fileExt = packshotFile.name.split(".").pop();
      const filePath = `${currentTenant.id}/packshots/main.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("media-assets")
        .upload(filePath, packshotFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL (using signed URL since bucket is private)
      const { data: signedUrl } = await supabase.storage
        .from("media-assets")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year

      if (!signedUrl?.signedUrl) throw new Error("Erro ao gerar URL");

      // Save to brand context
      const payload = {
        tenant_id: currentTenant.id,
        packshot_url: signedUrl.signedUrl,
      };

      if (brandContext?.id) {
        await supabase
          .from("tenant_brand_context")
          .update(payload)
          .eq("id", brandContext.id);
      } else {
        await supabase.from("tenant_brand_context").insert(payload);
      }

      setPackshotPreview(signedUrl.signedUrl);
      setPackshotFile(null);
      toast.success("Packshot enviado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["brand-context"] });
    } catch (error) {
      console.error("Packshot upload error:", error);
      toast.error("Erro ao enviar packshot");
    } finally {
      setIsUploadingPackshot(false);
    }
  };

  // Remove packshot
  const handleRemovePackshot = async () => {
    if (!brandContext?.id) return;

    try {
      await supabase
        .from("tenant_brand_context")
        .update({ packshot_url: null })
        .eq("id", brandContext.id);

      setPackshotPreview(null);
      toast.success("Packshot removido");
      queryClient.invalidateQueries({ queryKey: ["brand-context"] });
    } catch (error) {
      toast.error("Erro ao remover packshot");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPackshotFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = () => setPackshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Packshot Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Packshot do Produto
          </CardTitle>
          <CardDescription>
            Imagem de referência do seu produto. A IA usará isso para preservar
            rótulos e embalagens nos criativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-start">
            {packshotPreview ? (
              <div className="relative">
                <img
                  src={packshotPreview}
                  alt="Packshot"
                  className="w-32 h-32 object-contain rounded-lg border bg-white"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={handleRemovePackshot}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 space-y-2">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                PNG com fundo transparente recomendado para melhor resultado
              </p>
              {packshotFile && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handlePackshotUpload}
                  disabled={isUploadingPackshot}
                >
                  {isUploadingPackshot ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Enviar packshot
                </Button>
              )}
            </div>
          </div>

          {packshotPreview && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                ✓ Packshot configurado
              </Badge>
              <span className="text-sm text-green-700 dark:text-green-300">
                A IA usará esta imagem como referência
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Context Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Identidade Visual e Tom de Voz
          </CardTitle>
          <CardDescription>
            Configure o contexto da sua marca para criativos consistentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="brand_summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resumo da Marca</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva sua marca em poucas palavras..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Ex: "Marca premium de cosméticos masculinos focada em
                      ingredientes naturais"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tone_of_voice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tom de Voz</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Direto, masculino, premium, confiante"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visual_style_guidelines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Diretrizes Visuais</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descreva o estilo visual desejado..."
                        className="min-h-[60px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Ex: "Fotos de estúdio com fundo clean, iluminação
                      profissional, paleta de cores escuras"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Restrições</span>
              </div>

              <FormField
                control={form.control}
                name="banned_claims"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Claims Proibidos</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: resultados médicos, antes/depois, cura"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Separados por vírgula. A IA evitará esses termos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="do_not_do"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Não Fazer</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: inventar rótulos, alterar cores do produto, mostrar mãos"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Separados por vírgula. Regras que a IA deve seguir.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar contexto
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
