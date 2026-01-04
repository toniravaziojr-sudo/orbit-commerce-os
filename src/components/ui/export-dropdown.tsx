import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportDropdownProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
}

export function ExportDropdown({ onExportCSV, onExportExcel, disabled }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Excel (.xls)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCSV} className="gap-2">
          <FileText className="h-4 w-4" />
          CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
