import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  type CatalogStatusFilter,
  formatPriceBRL,
  parseTagsInput,
  statusLabel,
} from "@/lib/catalog";
import type { CatalogFile, CatalogItem, CatalogItemStatus, CatalogItemInput } from "@shared/schema";
import { catalogItemStatusValues } from "@shared/schema";
import { AlertCircle, CheckCircle2, Download, ExternalLink, FileText, Loader2, Paperclip, Pencil, Plus, RefreshCw, Sparkles, Tag, Trash2, UploadCloud, XCircle, Package, Search, Filter, MoreHorizontal, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const optionalText = z.preprocess(
  (value) => (value == null ? "" : typeof value === "string" ? value.trim() : String(value).trim()),
  z.string().default(""),
);

const catalogFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do item"),
  description: optionalText,
  category: optionalText,
  manufacturer: optionalText,
  price: z.preprocess(
    (value) => {
      if (value == null || value === "") return 0;
      return value;
    },
    z.coerce.number().nonnegative("Preço deve ser zero ou positivo").default(0),
  ),
  status: z.enum(catalogItemStatusValues).default("ativo"),
  tagsText: z.string().optional(),
});

type CatalogFormValues = z.infer<typeof catalogFormSchema>;
type CatalogMutationPayload = CatalogItemInput;
type CatalogImportRowError = {
  row: number;
  fields: string[];
  message: string;
};
type CatalogImportResult = {
  created: number;
  durationMs: number;
  sampleIds?: number[];
};

type CatalogAssistSuggestions = Partial<Pick<CatalogMutationPayload, "description" | "category" | "price" | "status" | "tags">>;
type CatalogAssistResponse = {
  suggestions: CatalogAssistSuggestions;
  suggestedFields?: string[];
  missingFields?: Array<keyof CatalogAssistSuggestions>;
  model?: string;
  message?: string;
};

const catalogImportMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const catalogImportMaxBytes = 5 * 1024 * 1024;

function formatBytes(value: number | null | undefined): string {
  if (!value || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDurationMs(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function CatalogFilesDialog({
  item,
  open,
  onOpenChange,
}: {
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) setSelectedFile(null);
  }, [open]);

  const filesQuery = useQuery({
    queryKey: ["catalog-files", item?.id],
    enabled: Boolean(item?.id) && open,
    queryFn: async () => {
      if (!item) throw new Error("Item não selecionado");
      const res = await fetch(`/api/catalog/${item.id}/files`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      return (await res.json()) as {
        files: CatalogFile[];
        limits?: { maxSizeBytes?: number; allowedMimeTypes?: string[] };
      };
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!item) throw new Error("Item não encontrado para upload");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/catalog/${item.id}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      return (await res.json()) as { file: CatalogFile };
    },
    onSuccess: () => {
      toast({ title: "Arquivo enviado", description: "Upload concluído com sucesso." });
      if (item?.id) queryClient.invalidateQueries({ queryKey: ["catalog-files", item.id] });
      setSelectedFile(null);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro ao enviar arquivo", description: error instanceof Error ? error.message : "Não foi possível enviar o arquivo." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await fetch(`/api/catalog/files/${fileId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      return (await res.json()) as { deleted: boolean };
    },
    onSuccess: () => {
      if (item?.id) queryClient.invalidateQueries({ queryKey: ["catalog-files", item.id] });
      toast({ title: "Arquivo removido", description: "O arquivo foi excluído do catálogo." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro ao remover arquivo", description: error instanceof Error ? error.message : "Não foi possível remover o arquivo." });
    },
  });

  const files = filesQuery.data?.files ?? [];
  const limits = filesQuery.data?.limits;
  const handleUpload = () => {
    if (!selectedFile) {
      toast({ variant: "destructive", title: "Selecione um arquivo", description: "Escolha um arquivo para enviar para o item." });
      return;
    }
    uploadMutation.mutate(selectedFile);
  };
  const acceptTypes = limits?.allowedMimeTypes?.join(",");
  const maxSizeLabel = limits?.maxSizeBytes ? `${(limits.maxSizeBytes / (1024 * 1024)).toFixed(1)}MB` : "10MB";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto glass border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Arquivos: {item?.name}</DialogTitle>
          <DialogDescription>Gerencie arquivos e anexos deste item.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Upload de arquivo</p>
                <p className="text-xs text-muted-foreground">Tipos: {limits?.allowedMimeTypes?.join(", ") ?? "pdf, doc, img"} | Max {maxSizeLabel}</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept={acceptTypes}
                  className="max-w-xs bg-black/20 border-white/10"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                <Button onClick={handleUpload} disabled={uploadMutation.isPending || !selectedFile} className="glass-button">
                  {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Enviar
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Arquivos Existentes</h3>
              {filesQuery.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.map((file) => (
                <div key={file.id} className="relative group p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.originalName}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)} • {new Date(file.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                      <a href={file.blobUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive" onClick={() => deleteMutation.mutate(file.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {!filesQuery.isLoading && files.length === 0 && (
                <div className="col-span-2 py-8 text-center text-muted-foreground text-sm border border-dashed border-white/10 rounded-xl">
                  Nenhum arquivo encontrado.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const statusFilters: { value: CatalogStatusFilter; label: string }[] = [
  { value: "ativo", label: "Ativos" },
  { value: "arquivado", label: "Arquivados" },
  { value: "all", label: "Todos" },
];

function CatalogFormDialog({
  mode,
  open,
  onOpenChange,
  initialItem,
  onSubmit,
  isSubmitting,
}: {
  mode: "create" | "edit";
  open: boolean;
  initialItem: CatalogItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CatalogMutationPayload) => void;
  isSubmitting: boolean;
}) {
  const form = useForm<CatalogFormValues>({
    resolver: zodResolver(catalogFormSchema),
    defaultValues: { name: "", description: "", category: "", manufacturer: "", price: 0, status: "ativo", tagsText: "" },
  });

  useEffect(() => {
    if (!open) { form.reset(); return; }
    if (initialItem) {
      form.reset({
        name: initialItem.name,
        description: initialItem.description,
        category: initialItem.category,
        manufacturer: initialItem.manufacturer,
        price: initialItem.price,
        status: initialItem.status,
        tagsText: initialItem.tags.join(", "),
      });
    } else {
      form.reset({ name: "", description: "", category: "", manufacturer: "", price: 0, status: "ativo", tagsText: "" });
    }
  }, [form, initialItem, open]);

  const aiAssistMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await apiRequest("POST", "/api/catalog/assist", payload);
      return (await response.json()) as CatalogAssistResponse;
    },
    onSuccess: (data) => {
      const suggestions = data.suggestions || {};
      if (suggestions.description) form.setValue("description", suggestions.description, { shouldDirty: true });
      if (suggestions.category) form.setValue("category", suggestions.category, { shouldDirty: true });
      if (suggestions.price) form.setValue("price", suggestions.price, { shouldDirty: true });
      if (suggestions.tags) form.setValue("tagsText", suggestions.tags.join(", "), { shouldDirty: true });
      toast({ title: "Sugestões aplicadas", description: "Campos preenchidos com inteligência artificial." });
    },
    onError: (err) => toast({ variant: "destructive", title: "Erro na IA", description: "Não foi possível gerar sugestões." }),
  });

  const handleCompleteWithAi = () => {
    const { name, manufacturer, description, category, price, tagsText } = form.getValues();
    if (!name.trim() || !manufacturer.trim()) {
      toast({ variant: "destructive", title: "Campos necessários", description: "Preencha Nome e Fabricante para usar a IA." });
      return;
    }
    aiAssistMutation.mutate({ name, manufacturer, description, category, price: Number(price), tags: parseTagsInput(tagsText) });
  };

  const handleSubmit = (values: CatalogFormValues) => {
    onSubmit({
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      manufacturer: values.manufacturer.trim(),
      price: values.price,
      status: values.status as CatalogItemStatus,
      tags: parseTagsInput(values.tagsText),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isSubmitting && onOpenChange(val)}>
      <DialogContent className="max-w-3xl bg-background/95 backdrop-blur-xl border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display font-bold text-foreground">{mode === "create" ? "Novo Item" : "Editar Item"}</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">Preencha os dados do produto abaixo.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-6 mt-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-bold text-primary">Assistente de IA</p>
                <p className="text-xs text-muted-foreground">Preencha Nome e Fabricante para autocompletar o resto.</p>
              </div>
              <Button type="button" size="sm" onClick={handleCompleteWithAi} disabled={aiAssistMutation.isPending} className="bg-background hover:bg-muted text-primary border border-primary/20 shadow-sm">
                {aiAssistMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Autocompletar
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Nome do Produto</FormLabel>
                  <FormControl><Input placeholder="Ex: Semente Soja Premium" className="bg-muted/50 border-input focus:border-primary focus:bg-background transition-all h-11 text-foreground placeholder:text-muted-foreground/50" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Categoria</FormLabel>
                  <FormControl><Input placeholder="Ex: Grãos" className="bg-muted/50 border-input focus:border-primary focus:bg-background transition-all h-11 text-foreground placeholder:text-muted-foreground/50" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="manufacturer" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Fabricante</FormLabel>
                  <FormControl><Input placeholder="Ex: AgroTech" className="bg-muted/50 border-input focus:border-primary focus:bg-background transition-all h-11 text-foreground placeholder:text-muted-foreground/50" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Preço (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" className="bg-muted/50 border-input focus:border-primary focus:bg-background transition-all h-11 text-foreground placeholder:text-muted-foreground/50" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-medium">Descrição</FormLabel>
                <FormControl><Textarea rows={4} className="bg-muted/50 border-input focus:border-primary focus:bg-background resize-none min-h-[100px] text-foreground placeholder:text-muted-foreground/50" placeholder="Detalhes do produto..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-6 md:grid-cols-2">
              <FormField control={form.control} name="tagsText" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Tags (separadas por vírgula)</FormLabel>
                  <FormControl><Input placeholder="soja, premium, safra 2024" className="bg-muted/50 border-input focus:border-primary focus:bg-background transition-all h-11 text-foreground placeholder:text-muted-foreground/50" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-medium">Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="bg-muted/50 border-input focus:border-primary focus:bg-background h-11 text-foreground"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="h-11 px-8">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Criar Item" : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );

}

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CatalogStatusFilter>("ativo");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [filesItem, setFilesItem] = useState<CatalogItem | null>(null);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const catalogQuery = useQuery({
    queryKey: ["catalog", { search, status }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as [string, { search: string; status: CatalogStatusFilter }];
      const query = new URLSearchParams();
      if (params.search.trim()) query.set("search", params.search.trim());
      if (params.status && params.status !== "ativo") query.set("status", params.status);
      const res = await apiRequest("GET", `/api/catalog?${query.toString()}`);
      return (await res.json()).items as CatalogItem[];
    },
  });

  const invalidateCatalog = () => queryClient.invalidateQueries({ queryKey: ["catalog"] });

  const createMutation = useMutation({
    mutationFn: async (payload: CatalogMutationPayload) => {
      const res = await apiRequest("POST", "/api/catalog", payload);
      return (await res.json()).item;
    },
    onSuccess: () => { toast({ title: "Sucesso", description: "Item criado." }); invalidateCatalog(); setFormOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: CatalogMutationPayload }) => {
      const res = await apiRequest("PUT", `/api/catalog/${id}`, payload);
      return (await res.json()).item;
    },
    onSuccess: () => { toast({ title: "Sucesso", description: "Item atualizado." }); invalidateCatalog(); setFormOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/catalog/${id}`);
    },
    onSuccess: () => { toast({ title: "Sucesso", description: "Item removido/arquivado." }); invalidateCatalog(); setDeleteTarget(null); },
  });

  const items = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  return (
    <div className="container mx-auto p-6 max-w-7xl h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">Catálogo</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu inventário de produtos e inteligência.</p>
        </div>
        <Button onClick={() => { setFormMode("create"); setEditingItem(null); setFormOpen(true); }} className="glass-button">
          <Plus className="mr-2 h-5 w-5" /> Novo Item
        </Button>
      </div>

      <div className="glass-card p-4 rounded-2xl mb-6 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-30">
        <div className="relative flex-1 w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, tag ou categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-black/5 border-black/5 dark:bg-white/5 dark:border-white/10 rounded-xl"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setViewMode('table')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-border hidden md:block" />

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={status} onValueChange={(v) => setStatus(v as CatalogStatusFilter)}>
              <SelectTrigger className="w-[140px] bg-transparent border-0 ring-0 shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusFilters.map(sf => <SelectItem key={sf.value} value={sf.value}>{sf.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <span className="text-sm text-muted-foreground whitespace-nowrap px-2">
            {items.length} itens
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar -mx-6 px-6 pb-20">
        {catalogQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-[280px] rounded-2xl bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
            <Package className="h-20 w-20 text-muted-foreground mb-4 opacity-20" />
            <p className="text-xl font-medium">Nenhum item encontrado</p>
            <p className="text-sm text-muted-foreground">Tente ajustar seus filtros ou crie um novo item.</p>
          </div>
        ) : viewMode === 'table' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/10 overflow-hidden glass-card"
          >
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-white/10">
                  <TableHead className="w-[300px]">Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/20 border-white/5 transition-colors">
                    <TableCell>
                      <div className="font-medium text-foreground">{item.name}</div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.manufacturer}</TableCell>
                    <TableCell className="text-sm font-semibold">{formatPriceBRL(item.price)}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "ativo" ? "outline" : "secondary"} className={cn(
                        item.status === 'ativo' ? "border-green-500/30 text-green-500 bg-green-500/5" : "text-muted-foreground"
                      )}>
                        {statusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setFormMode("edit"); setEditingItem(item); setFormOpen(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setFilesItem(item); setFilesDialogOpen(true); }}>
                            <Paperclip className="mr-2 h-4 w-4" /> Arquivos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(item)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  className="group relative flex flex-col glass-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 rounded-2xl overflow-hidden border border-white/10"
                >
                  <div className={cn(
                    "h-32 w-full bg-gradient-to-br p-6 flex items-center justify-center relative overflow-hidden",
                    item.status === 'arquivado' ? "from-gray-800 to-gray-900 grayscale" : "from-blue-500/10 to-purple-500/10"
                  )}>
                    <div className="absolute top-3 right-3 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/40"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setFormMode("edit"); setEditingItem(item); setFormOpen(true); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setFilesItem(item); setFilesDialogOpen(true); }}>
                            <Paperclip className="mr-2 h-4 w-4" /> Arquivos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(item)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Package className={cn(
                      "h-12 w-12 opacity-50 transition-transform duration-500 group-hover:scale-110",
                      item.status === 'arquivado' ? "text-gray-500" : "text-primary"
                    )} />
                    {item.price > 0 && (
                      <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg text-white text-xs font-semibold">
                        {formatPriceBRL(item.price)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-5 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors pr-4">{item.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{item.category || "Sem categoria"}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1 min-h-[40px]">{item.description || "Sem descrição..."}</p>

                    <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          #{tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">+{item.tags.length - 3}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <CatalogFormDialog mode={formMode} open={formOpen} initialItem={editingItem} onOpenChange={setFormOpen} onSubmit={(pl) => formMode === "create" ? createMutation.mutate(pl) : updateMutation.mutate({ id: editingItem!.id, payload: pl })} isSubmitting={createMutation.isPending || updateMutation.isPending} />
      <CatalogFilesDialog item={filesItem} open={filesDialogOpen} onOpenChange={setFilesDialogOpen} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Remover Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
