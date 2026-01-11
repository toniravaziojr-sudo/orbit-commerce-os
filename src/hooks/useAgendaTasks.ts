import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export type TaskStatus = 'pending' | 'completed' | 'cancelled';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number; // every X days/weeks/months
  byweekday?: number[]; // 0=Sunday, 1=Monday, etc.
  bymonthday?: number; // day of month
}

export interface AgendaTask {
  id: string;
  tenant_id: string;
  created_by: string;
  title: string;
  description: string | null;
  due_at: string;
  status: TaskStatus;
  is_recurring: boolean;
  recurrence: RecurrenceConfig | null;
  reminder_offsets: number[] | null; // minutes before due_at
  created_at: string;
  updated_at: string;
}

export interface AgendaReminder {
  id: string;
  tenant_id: string;
  task_id: string;
  channel: 'whatsapp';
  remind_at: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  due_at: string;
  is_recurring?: boolean;
  recurrence?: RecurrenceConfig;
  reminder_offsets?: number[]; // in minutes: 1440 = 1 day, 120 = 2h, 15 = 15min
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: TaskStatus;
}

// Helper to convert DB row to typed AgendaTask
function toAgendaTask(row: {
  id: string;
  tenant_id: string;
  created_by: string;
  title: string;
  description: string | null;
  due_at: string;
  status: string;
  is_recurring: boolean | null;
  recurrence: Json | null;
  reminder_offsets: Json | null;
  created_at: string;
  updated_at: string;
}): AgendaTask {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    created_by: row.created_by,
    title: row.title,
    description: row.description,
    due_at: row.due_at,
    status: row.status as TaskStatus,
    is_recurring: row.is_recurring ?? false,
    recurrence: row.recurrence as unknown as RecurrenceConfig | null,
    reminder_offsets: row.reminder_offsets as number[] | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useAgendaTasks() {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Fetch all tasks
  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ["agenda-tasks", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("agenda_tasks")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("due_at", { ascending: true });

      if (error) throw error;
      return (data || []).map(toAgendaTask);
    },
    enabled: !!tenantId,
  });

  // Fetch reminders for all tasks
  const { data: reminders = [], isLoading: remindersLoading } = useQuery({
    queryKey: ["agenda-reminders", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("agenda_reminders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("remind_at", { ascending: true });

      if (error) throw error;
      return (data || []).map(row => ({
        ...row,
        channel: row.channel as 'whatsapp',
        status: row.status as AgendaReminder['status'],
      })) as AgendaReminder[];
    },
    enabled: !!tenantId,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      if (!tenantId || !user?.id) throw new Error("Não autenticado");

      // Create task
      const { data: task, error: taskError } = await supabase
        .from("agenda_tasks")
        .insert({
          tenant_id: tenantId,
          created_by: user.id,
          title: input.title,
          description: input.description || null,
          due_at: input.due_at,
          is_recurring: input.is_recurring || false,
          recurrence: input.recurrence as unknown as Json || null,
          reminder_offsets: input.reminder_offsets as unknown as Json || null,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Create reminders based on offsets
      if (input.reminder_offsets && input.reminder_offsets.length > 0) {
        const dueAt = new Date(input.due_at);
        const reminderInserts = input.reminder_offsets.map(offsetMinutes => {
          const remindAt = new Date(dueAt.getTime() - offsetMinutes * 60 * 1000);
          return {
            tenant_id: tenantId,
            task_id: task.id,
            channel: 'whatsapp',
            remind_at: remindAt.toISOString(),
            status: 'pending',
          };
        });

        const { error: remindersError } = await supabase
          .from("agenda_reminders")
          .insert(reminderInserts);

        if (remindersError) {
          console.error("Error creating reminders:", remindersError);
          // Don't throw, task was created successfully
        }
      }

      return toAgendaTask(task);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-tasks", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["agenda-reminders", tenantId] });
      toast.success("Tarefa criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar tarefa: ${error.message}`);
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) => {
      if (!tenantId) throw new Error("Não autenticado");

      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.due_at !== undefined) updateData.due_at = input.due_at;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.is_recurring !== undefined) updateData.is_recurring = input.is_recurring;
      if (input.recurrence !== undefined) updateData.recurrence = input.recurrence;
      if (input.reminder_offsets !== undefined) updateData.reminder_offsets = input.reminder_offsets;

      const { data, error } = await supabase
        .from("agenda_tasks")
        .update(updateData)
        .eq("id", taskId)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;

      const typedData = toAgendaTask(data);

      // If due_at or reminder_offsets changed, update reminders
      if (input.due_at !== undefined || input.reminder_offsets !== undefined) {
        // Delete existing pending reminders
        await supabase
          .from("agenda_reminders")
          .delete()
          .eq("task_id", taskId)
          .eq("status", "pending");

        // Create new reminders if offsets exist
        const offsets = input.reminder_offsets ?? typedData.reminder_offsets;
        const dueAt = input.due_at ?? typedData.due_at;
        
        if (offsets && offsets.length > 0 && dueAt) {
          const dueDate = new Date(dueAt);
          const reminderInserts = offsets.map(offsetMinutes => {
            const remindAt = new Date(dueDate.getTime() - offsetMinutes * 60 * 1000);
            return {
              tenant_id: tenantId,
              task_id: taskId,
              channel: 'whatsapp',
              remind_at: remindAt.toISOString(),
              status: 'pending',
            };
          });

          await supabase.from("agenda_reminders").insert(reminderInserts);
        }
      }

      return typedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-tasks", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["agenda-reminders", tenantId] });
      toast.success("Tarefa atualizada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar tarefa: ${error.message}`);
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!tenantId) throw new Error("Não autenticado");

      const { error } = await supabase
        .from("agenda_tasks")
        .delete()
        .eq("id", taskId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agenda-tasks", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["agenda-reminders", tenantId] });
      toast.success("Tarefa excluída!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir tarefa: ${error.message}`);
    },
  });

  // Mark task complete
  const completeTask = (taskId: string) => {
    updateTaskMutation.mutate({ taskId, input: { status: 'completed' } });
  };

  // Cancel task
  const cancelTask = (taskId: string) => {
    updateTaskMutation.mutate({ taskId, input: { status: 'cancelled' } });
  };

  // Get reminders for a specific task
  const getTaskReminders = (taskId: string) => {
    return reminders.filter(r => r.task_id === taskId);
  };

  return {
    tasks,
    reminders,
    isLoading: tasksLoading || remindersLoading,
    refetchTasks,
    createTask: createTaskMutation.mutateAsync,
    updateTask: updateTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    completeTask,
    cancelTask,
    getTaskReminders,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
  };
}
