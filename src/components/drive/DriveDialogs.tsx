import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function RenameDialog({ open, onOpenChange, name, onNameChange, onConfirm, isPending }: RenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Novo nome"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            Renomear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SubfolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentFolderName: string;
  name: string;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function SubfolderDialog({ open, onOpenChange, parentFolderName, name, onNameChange, onConfirm, isPending }: SubfolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova subpasta em "{parentFolderName}"</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Nome da subpasta"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}