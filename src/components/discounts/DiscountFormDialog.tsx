import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiscounts, Discount, DiscountType, discountTypeLabels } from "@/hooks/useDiscounts";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useProducts";
import { Percent, Tag, Truck, Sparkles, Package, FolderTree, Globe } from "lucide-react";

type AppliesTo = 'all' | 'specific_products' | 'specific_categories';

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().max(50, "Máximo 50 caracteres").optional().nullable(),
  type: z.enum(["order_percent", "order_fixed", "free_shipping"]),
  value: z.number().min(0, "Valor deve ser positivo"),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  is_active: z.boolean(),
  usage_limit_total: z.number().min(1).optional().nullable(),
  usage_limit_per_customer: z.number().min(1).optional().nullable(),
  min_subtotal: z.number().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
  auto_apply_first_purchase: z.boolean(),
  applies_to: z.enum(['all', 'specific_products', 'specific_categories']),
  product_ids: z.array(z.string()),
  category_ids: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

interface DiscountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discount: Discount | null;
}

export function DiscountFormDialog({ open, onOpenChange, discount }: DiscountFormDialogProps) {
  const { createDiscount, updateDiscount } = useDiscounts();
  const { products } = useProducts();
  const { categories } = useCategories();
  const isEditing = !!discount;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "order_percent",
      value: 10,
      starts_at: null,
      ends_at: null,
      is_active: true,
      usage_limit_total: null,
      usage_limit_per_customer: null,
      min_subtotal: null,
      description: null,
      auto_apply_first_purchase: false,
      applies_to: 'all',
      product_ids: [],
      category_ids: [],
    },
  });

  const watchAppliesTo = form.watch("applies_to");

  useEffect(() => {
    if (discount) {
      const discountData = discount as any;
      form.reset({
        name: discount.name,
        code: discount.code || "",
        type: discount.type,
        value: discount.value,
        starts_at: discount.starts_at ? discount.starts_at.slice(0, 16) : null,
        ends_at: discount.ends_at ? discount.ends_at.slice(0, 16) : null,
        is_active: discount.is_active,
        usage_limit_total: discount.usage_limit_total,
        usage_limit_per_customer: discount.usage_limit_per_customer,
        min_subtotal: discount.min_subtotal,
        description: discount.description,
        auto_apply_first_purchase: discountData.auto_apply_first_purchase || false,
        applies_to: discountData.applies_to || 'all',
        product_ids: discountData.product_ids || [],
        category_ids: discountData.category_ids || [],
      });
    } else {
      form.reset({
        name: "",
        code: "",
        type: "order_percent",
        value: 10,
        starts_at: null,
        ends_at: null,
        is_active: true,
        usage_limit_total: null,
        usage_limit_per_customer: null,
        min_subtotal: null,
        description: null,
        auto_apply_first_purchase: false,
        applies_to: 'all',
        product_ids: [],
        category_ids: [],
      });
    }
  }, [discount, form]);

  const onSubmit = async (values: FormValues) => {
    const data = {
      name: values.name,
      code: values.auto_apply_first_purchase 
        ? null 
        : (values.code?.toUpperCase().replace(/\s/g, "") || null),
      type: values.type,
      value: values.value,
      is_active: values.is_active,
      starts_at: values.starts_at || null,
      ends_at: values.ends_at || null,
      usage_limit_total: values.usage_limit_total || null,
      usage_limit_per_customer: values.usage_limit_per_customer || null,
      min_subtotal: values.min_subtotal || null,
      description: values.description || null,
      auto_apply_first_purchase: values.auto_apply_first_purchase,
      applies_to: values.applies_to,
      product_ids: values.applies_to === 'specific_products' ? values.product_ids : [],
      category_ids: values.applies_to === 'specific_categories' ? values.category_ids : [],
    };

    if (isEditing) {
      await updateDiscount.mutateAsync({ id: discount.id, ...data });
    } else {
      await createDiscount.mutateAsync(data);
    }

    onOpenChange(false);
  };

  const watchType = form.watch("type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar cupom" : "Criar cupom"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do cupom</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Primeira compra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: PRIMEIRACOMPRA"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/\s/g, ""))}
                      />
                    </FormControl>
                    <FormDescription>O código que o cliente irá inserir</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Discount Type and Value */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de desconto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="order_percent">
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            Desconto no pedido (%)
                          </div>
                        </SelectItem>
                        <SelectItem value="order_fixed">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4" />
                            Desconto no pedido (R$)
                          </div>
                        </SelectItem>
                        <SelectItem value="free_shipping">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Frete grátis
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchType !== "free_shipping" && (
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchType === "order_percent" ? "Percentual (%)" : "Valor (R$)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={watchType === "order_percent" ? "1" : "0.01"}
                          min="0"
                          max={watchType === "order_percent" ? "100" : undefined}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Product Scope */}
            <FormField
              control={form.control}
              name="applies_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aplica-se a</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Todos os produtos
                        </div>
                      </SelectItem>
                      <SelectItem value="specific_products">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Produtos específicos
                        </div>
                      </SelectItem>
                      <SelectItem value="specific_categories">
                        <div className="flex items-center gap-2">
                          <FolderTree className="h-4 w-4" />
                          Categorias específicas
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {field.value === 'all' && 'O desconto será aplicado em qualquer produto'}
                    {field.value === 'specific_products' && 'O desconto só será aplicado nos produtos selecionados'}
                    {field.value === 'specific_categories' && 'O desconto só será aplicado em produtos das categorias selecionadas'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Product Selection */}
            {watchAppliesTo === 'specific_products' && (
              <FormField
                control={form.control}
                name="product_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selecione os produtos</FormLabel>
                    <ScrollArea className="h-48 rounded-md border p-4">
                      <div className="space-y-2">
                        {products.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
                        ) : (
                          products.map((product) => (
                            <div key={product.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`product-${product.id}`}
                                checked={field.value.includes(product.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, product.id]);
                                  } else {
                                    field.onChange(field.value.filter((id) => id !== product.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`product-${product.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {product.name}
                                <span className="text-muted-foreground ml-2">({product.sku})</span>
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    {field.value.length > 0 && (
                      <FormDescription>
                        {field.value.length} produto(s) selecionado(s)
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Category Selection */}
            {watchAppliesTo === 'specific_categories' && (
              <FormField
                control={form.control}
                name="category_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selecione as categorias</FormLabel>
                    <ScrollArea className="h-48 rounded-md border p-4">
                      <div className="space-y-2">
                        {categories.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada</p>
                        ) : (
                          categories.map((category) => (
                            <div key={category.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`category-${category.id}`}
                                checked={field.value.includes(category.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, category.id]);
                                  } else {
                                    field.onChange(field.value.filter((id) => id !== category.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`category-${category.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {category.name}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    {field.value.length > 0 && (
                      <FormDescription>
                        {field.value.length} categoria(s) selecionada(s)
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="starts_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de início (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ends_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de expiração (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="usage_limit_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite total de usos</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Sem limite"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Deixe vazio para ilimitado</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usage_limit_per_customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite por cliente</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Sem limite"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Por e-mail do cliente</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="min_subtotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor mínimo (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Sem mínimo"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Subtotal mínimo do carrinho</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descrição interna do cupom..."
                      {...field}
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Auto-apply First Purchase */}
            <FormField
              control={form.control}
              name="auto_apply_first_purchase"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      Desconto de primeira compra
                    </FormLabel>
                    <FormDescription>
                      Aplica automaticamente para clientes sem pedidos anteriores. Não requer código.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Active Switch */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Cupom ativo</FormLabel>
                    <FormDescription>
                      Desative para impedir que o cupom seja utilizado
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createDiscount.isPending || updateDiscount.isPending}>
                {isEditing ? "Salvar" : "Criar cupom"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
