import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { Customer, CustomerFormData, CustomerTag } from '@/hooks/useCustomers';

const customerSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  cpf: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other', 'not_informed']).optional().nullable(),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  accepts_marketing: z.boolean().default(true),
  tag_ids: z.array(z.string()).default([]),
  // New canonical fields (PF/PJ + marketing consents)
  person_type: z.enum(['pf', 'pj']).optional().nullable(),
  cnpj: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  ie: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  accepts_email_marketing: z.boolean().optional().nullable(),
  accepts_sms_marketing: z.boolean().optional().nullable(),
  accepts_whatsapp_marketing: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  customerTagIds?: string[];
  availableTags?: CustomerTag[];
  onSubmit: (data: CustomerFormData & { tag_ids: string[] }) => void;
  isLoading?: boolean;
}

export function CustomerForm({
  open,
  onOpenChange,
  customer,
  customerTagIds = [],
  availableTags = [],
  onSubmit,
  isLoading,
}: CustomerFormProps) {
  const isEditing = !!customer;

  const form = useForm<FormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      cpf: '',
      phone: '',
      birth_date: '',
      gender: 'not_informed',
      status: 'active',
      accepts_marketing: true,
      tag_ids: [],
      // New fields
      person_type: null,
      cnpj: '',
      company_name: '',
      ie: '',
      rg: '',
      accepts_email_marketing: true,
      accepts_sms_marketing: false,
      accepts_whatsapp_marketing: false,
      notes: '',
    },
  });

  // Reset form when customer changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        full_name: customer?.full_name ?? '',
        email: customer?.email ?? '',
        cpf: customer?.cpf ?? '',
        phone: customer?.phone ?? '',
        birth_date: customer?.birth_date ?? '',
        gender: customer?.gender ?? 'not_informed',
        status: customer?.status ?? 'active',
        accepts_marketing: customer?.accepts_marketing ?? true,
        tag_ids: customerTagIds,
        // New fields
        person_type: customer?.person_type ?? null,
        cnpj: customer?.cnpj ?? '',
        company_name: customer?.company_name ?? '',
        ie: customer?.ie ?? '',
        rg: customer?.rg ?? '',
        accepts_email_marketing: customer?.accepts_email_marketing ?? true,
        accepts_sms_marketing: customer?.accepts_sms_marketing ?? false,
        accepts_whatsapp_marketing: customer?.accepts_whatsapp_marketing ?? false,
        notes: customer?.notes ?? '',
      });
    }
  }, [open, customer, customerTagIds, form]);

  const handleSubmit = (data: FormValues) => {
    onSubmit({
      full_name: data.full_name,
      email: data.email,
      cpf: data.cpf || null,
      phone: data.phone || null,
      birth_date: data.birth_date || null,
      gender: data.gender || null,
      status: data.status,
      accepts_marketing: data.accepts_marketing,
      tag_ids: data.tag_ids,
      // New fields
      person_type: data.person_type || null,
      cnpj: data.cnpj || null,
      company_name: data.company_name || null,
      ie: data.ie || null,
      rg: data.rg || null,
      accepts_email_marketing: data.accepts_email_marketing,
      accepts_sms_marketing: data.accepts_sms_marketing,
      accepts_whatsapp_marketing: data.accepts_whatsapp_marketing,
      notes: data.notes || null,
    } as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações do cliente.'
              : 'Preencha os dados para cadastrar um novo cliente.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="João da Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="joao@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(11) 99999-9999" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de nascimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gênero</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'not_informed'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="not_informed">Não informado</SelectItem>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Feminino</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accepts_marketing"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Aceita marketing</FormLabel>
                    <FormDescription>
                      Cliente aceita receber comunicações promocionais
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {availableTags.length > 0 && (
              <FormField
                control={form.control}
                name="tag_ids"
                render={() => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg">
                      {availableTags.map((tag) => (
                        <FormField
                          key={tag.id}
                          control={form.control}
                          name="tag_ids"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(tag.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, tag.id]);
                                    } else {
                                      field.onChange(field.value?.filter((id) => id !== tag.id));
                                    }
                                  }}
                                />
                              </FormControl>
                              <Badge 
                                variant="secondary" 
                                style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}
                                className="cursor-pointer border"
                              >
                                <span style={{ color: tag.color }}>{tag.name}</span>
                              </Badge>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
