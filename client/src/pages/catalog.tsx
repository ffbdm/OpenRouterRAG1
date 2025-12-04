import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import { InstructionsPanel } from "@/components/InstructionsPanel";
import { AlertCircle, CheckCircle2, Download, ExternalLink, FileText, Loader2, Paperclip, Pencil, Plus, RefreshCw, Sparkles, Tag, Trash2, UploadCloud, XCircle } from "lucide-react";

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
    if (!open) {
      setSelectedFile(null);
    }
  }, [open]);

  const filesQuery = useQuery({
    queryKey: ["catalog-files", item?.id],
    enabled: Boolean(item?.id) && open,
    queryFn: async () => {
      if (!item) throw new Error("Item não selecionado");

      const res = await fetch(`/api/catalog/${item.id}/files`, { credentials: "include" });
      if (!res.ok) {
        const message = (await res.text()) || res.statusText;
        throw new Error(message);
      }

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

      if (!res.ok) {
        const message = (await res.text()) || res.statusText;
        throw new Error(message);
      }

      return (await res.json()) as { file: CatalogFile };
    },
    onSuccess: () => {
      toast({
        title: "Arquivo enviado",
        description: "Upload concluído com sucesso.",
      });
      if (item?.id) {
        queryClient.invalidateQueries({ queryKey: ["catalog-files", item.id] });
      }
      setSelectedFile(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao enviar arquivo",
        description: error instanceof Error ? error.message : "Não foi possível enviar o arquivo.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      const res = await fetch(`/api/catalog/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const message = (await res.text()) || res.statusText;
        throw new Error(message);
      }

      return (await res.json()) as { deleted: boolean };
    },
    onSuccess: () => {
      if (item?.id) {
        queryClient.invalidateQueries({ queryKey: ["catalog-files", item.id] });
      }
      toast({
        title: "Arquivo removido",
        description: "O arquivo foi excluído do catálogo.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover arquivo",
        description: error instanceof Error ? error.message : "Não foi possível remover o arquivo.",
      });
    },
  });

  const files = filesQuery.data?.files ?? [];
  const limits = filesQuery.data?.limits;

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Selecione um arquivo",
        description: "Escolha um arquivo para enviar para o item.",
      });
      return;
    }

    uploadMutation.mutate(selectedFile);
  };

  const acceptTypes = limits?.allowedMimeTypes?.join(",");
  const maxSizeLabel = limits?.maxSizeBytes ? `${(limits.maxSizeBytes / (1024 * 1024)).toFixed(1)}MB` : "10MB";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Arquivos do item</DialogTitle>
          <DialogDescription>
            Adicione arquivos de contexto para o item {item?.name}. Os uploads vão para o storage Vercel Blob.
          </DialogDescription>
        </DialogHeader>

        {!item && (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Selecione um item para gerenciar arquivos.
          </div>
        )}

        {item && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Upload de arquivo</p>
                  <p className="text-xs text-muted-foreground">
                    Tipos permitidos: {limits?.allowedMimeTypes?.join(", ") ?? "pdf, txt, doc, docx, md"} | Limite {maxSizeLabel}
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <Input
                    type="file"
                    accept={acceptTypes}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      setSelectedFile(file ?? null);
                    }}
                  />
                  <Button onClick={handleUpload} disabled={uploadMutation.isPending || !selectedFile}>
                    {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              </div>
              {selectedFile && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Selecionado: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              )}
            </div>

            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm font-medium">Arquivos enviados</p>
                {filesQuery.isFetching && (
                  <span className="text-xs text-muted-foreground">Atualizando...</span>
                )}
              </div>

              <div className="p-4">
                {filesQuery.isError && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {filesQuery.error instanceof Error ? filesQuery.error.message : "Erro ao carregar arquivos."}
                  </div>
                )}

                {filesQuery.isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando arquivos...
                  </div>
                )}

                {!filesQuery.isLoading && files.length === 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Nenhum arquivo enviado para este item.
                  </div>
                )}

                {files.length > 0 && (
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div key={file.id} className="flex flex-col gap-3 rounded-md border px-3 py-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <FileText className="h-4 w-4" />
                            {file.originalName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.mimeType} · {formatBytes(file.sizeBytes)} · {new Date(file.createdAt).toLocaleString("pt-BR")}
                          </div>
                          {file.textPreview && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {file.textPreview}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button asChild variant="outline" size="sm">
                            <a href={file.blobUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(file.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
    defaultValues: {
      name: "",
      description: "",
      category: "",
      manufacturer: "",
      price: 0,
      status: "ativo",
      tagsText: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      return;
    }

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
      form.reset({
        name: "",
        description: "",
        category: "",
        manufacturer: "",
        price: 0,
        status: "ativo",
        tagsText: "",
      });
    }
  }, [form, initialItem, open]);

  const aiAssistMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      manufacturer: string;
      description: string;
      category: string;
      price: number | null;
      tags: string[];
    }) => {
      const response = await apiRequest("POST", "/api/catalog/assist", payload);
      return (await response.json()) as CatalogAssistResponse;
    },
    onSuccess: (data) => {
      const suggestions = data.suggestions || {};
      const current = form.getValues();
      const updatedFields: string[] = [];

      if (suggestions.description && !current.description.trim()) {
        form.setValue("description", suggestions.description, { shouldDirty: true });
        updatedFields.push("Descrição");
      }

      if (suggestions.category && !current.category.trim()) {
        form.setValue("category", suggestions.category, { shouldDirty: true });
        updatedFields.push("Categoria");
      }

      if (typeof suggestions.price === "number" && !form.getFieldState("price").isDirty) {
        form.setValue("price", suggestions.price, { shouldDirty: true });
        updatedFields.push("Preço");
      }

      if (Array.isArray(suggestions.tags) && suggestions.tags.length > 0) {
        const existingTags = parseTagsInput(current.tagsText);
        if (existingTags.length === 0) {
          form.setValue("tagsText", suggestions.tags.join(", "), { shouldDirty: true });
          updatedFields.push("Tags");
        }
      }

      if (updatedFields.length === 0) {
        toast({
          title: "Nenhum campo atualizado",
          description: data.message ?? "Os campos já estavam preenchidos ou a IA não trouxe sugestões novas.",
        });
        return;
      }

      const modelNote = data.model ? ` (modelo: ${data.model})` : "";
      toast({
        title: "Campos preenchidos com IA",
        description: `Atualizado: ${updatedFields.join(", ")}${modelNote}`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Não foi possível completar com IA",
        description: error instanceof Error ? error.message : "Falha ao obter sugestões.",
      });
    },
  });

  const handleCompleteWithAi = () => {
    const values = form.getValues();
    const trimmedName = values.name.trim();
    const trimmedManufacturer = values.manufacturer.trim();

    if (!trimmedName) {
      form.setError("name", { type: "manual", message: "Informe o nome para usar a IA." });
    }

    if (!trimmedManufacturer) {
      form.setError("manufacturer", { type: "manual", message: "Informe o fabricante para usar a IA." });
    }

    if (!trimmedName || !trimmedManufacturer) {
      toast({
        variant: "destructive",
        title: "Preencha Nome e Fabricante",
        description: "Esses dois campos são obrigatórios para sugerir os demais.",
      });
      return;
    }

    const parsedTags = parseTagsInput(values.tagsText);
    const price = form.getFieldState("price").isDirty && Number.isFinite(values.price)
      ? Number(values.price)
      : null;

    aiAssistMutation.mutate({
      name: trimmedName,
      manufacturer: trimmedManufacturer,
      description: values.description.trim(),
      category: values.category.trim(),
      price,
      tags: parsedTags,
    });
  };

  const handleSubmit = (values: CatalogFormValues) => {
    const payload: CatalogMutationPayload = {
      name: values.name.trim(),
      description: values.description.trim(),
      category: values.category.trim(),
      manufacturer: values.manufacturer.trim(),
      price: values.price,
      status: values.status as CatalogItemStatus,
      tags: parseTagsInput(values.tagsText),
    };

    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSubmitting && onOpenChange(value)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo item de catálogo" : "Editar item"}</DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo. Todos os textos devem estar em português e refletir o que será exibido aos usuários.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Completar campos com IA</p>
                  <p className="text-xs text-muted-foreground">
                    Use Nome e Fabricante para sugerir os demais campos. Campos já preenchidos não serão sobrescritos.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCompleteWithAi}
                  disabled={aiAssistMutation.isPending || isSubmitting}
                >
                  {aiAssistMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Sparkles className="mr-2 h-4 w-4" />
                  Completar com IA
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Semente Premium Soja 64" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Sementes, Fertilizante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fabricante</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: AgroVale" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0,00"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Fale sobre características e diferenciais." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tagsText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="Separadas por vírgula (ex: sementes, soja)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="arquivado">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? "Criar item" : "Salvar alterações"}
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
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [hardDelete, setHardDelete] = useState(false);
  const [filesItem, setFilesItem] = useState<CatalogItem | null>(null);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<CatalogImportRowError[]>([]);
  const [importResult, setImportResult] = useState<CatalogImportResult | null>(null);
  const [isDraggingImport, setIsDraggingImport] = useState(false);

  const queryClient = useQueryClient();

  const catalogQuery = useQuery({
    queryKey: ["catalog", { search, status }],
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey as [string, { search: string; status: CatalogStatusFilter }];
      const query = new URLSearchParams();
      if (params.search.trim()) query.set("search", params.search.trim());
      if (params.status && params.status !== "ativo") query.set("status", params.status);

      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await apiRequest("GET", `/api/catalog${suffix}`);
      const data = await response.json();
      return (data.items ?? []) as CatalogItem[];
    },
  });

  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog"] });
  };

  const downloadTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/catalog/import/template", { credentials: "include" });
      if (!res.ok) {
        const message = (await res.text()) || res.statusText;
        throw new Error(message);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "catalogo-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Template baixado",
        description: "Planilha pronta para preencher.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao baixar template",
        description: error instanceof Error ? error.message : "Não foi possível gerar o template.",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/catalog/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const payload = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        const message = isJson
          ? (payload as { error?: string })?.error ?? "Erro ao importar catálogo"
          : (payload as string) || "Erro ao importar catálogo";

        const error = new Error(message) as Error & { details?: CatalogImportRowError[] };
        if (isJson && Array.isArray((payload as { errors?: CatalogImportRowError[] })?.errors)) {
          error.details = (payload as { errors?: CatalogImportRowError[] }).errors;
        }

        throw error;
      }

      return payload as CatalogImportResult;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setImportErrors([]);
      setImportFile(null);
      toast({
        title: "Importação concluída",
        description: `Foram criados ${data.created} itens em ${formatDurationMs(data.durationMs)}.`,
      });
      invalidateCatalog();
    },
    onError: (error: Error & { details?: CatalogImportRowError[] }) => {
      setImportResult(null);
      setImportErrors(error.details ?? []);
      toast({
        variant: "destructive",
        title: "Erro ao importar catálogo",
        description: error.message || "Falha ao processar a planilha.",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CatalogMutationPayload) => {
      const response = await apiRequest("POST", "/api/catalog", payload);
      const data = await response.json();
      return data.item as CatalogItem;
    },
    onSuccess: () => {
      toast({
        title: "Item criado",
        description: "O item foi adicionado ao catálogo.",
      });
      invalidateCatalog();
      setFormOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar item",
        description: error instanceof Error ? error.message : "Não foi possível criar o item.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: CatalogMutationPayload }) => {
      const response = await apiRequest("PUT", `/api/catalog/${id}`, payload);
      const data = await response.json();
      return data.item as CatalogItem;
    },
    onSuccess: () => {
      toast({
        title: "Item atualizado",
        description: "As alterações foram salvas.",
      });
      invalidateCatalog();
      setFormOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar item",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o item.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, hard }: { id: number; hard?: boolean }) => {
      const suffix = hard ? "?hard=true" : "";
      const response = await apiRequest("DELETE", `/api/catalog/${id}${suffix}`);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data?.deleted ? "Item removido" : "Item arquivado",
        description: data?.deleted
          ? "O item foi removido do catálogo."
          : "O item foi arquivado e não aparecerá nas buscas.",
      });
      invalidateCatalog();
      setDeleteTarget(null);
      setHardDelete(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover item",
        description: error instanceof Error ? error.message : "Não foi possível remover o item.",
      });
    },
  });

  const items = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);

  const openCreate = () => {
    setFormMode("create");
    setEditingItem(null);
    setFormOpen(true);
  };

  const openFilesDialog = (item: CatalogItem) => {
    setFilesItem(item);
    setFilesDialogOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setFormMode("edit");
    setEditingItem(item);
    setFormOpen(true);
  };

  const onSubmitForm = (payload: CatalogMutationPayload) => {
    if (formMode === "create") {
      createMutation.mutate(payload);
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload });
    }
  };

  const openDeleteDialog = (item: CatalogItem) => {
    setDeleteTarget(item);
    setHardDelete(false);
  };

  const handleFilesDialogChange = (open: boolean) => {
    setFilesDialogOpen(open);
    if (!open) {
      setFilesItem(null);
    }
  };

  const handleImportFile = (file: File | null) => {
    setImportErrors([]);
    setImportResult(null);

    if (!file) {
      setImportFile(null);
      return;
    }

    if (file.size > catalogImportMaxBytes) {
      toast({
        variant: "destructive",
        title: "Arquivo muito grande",
        description: `Limite de ${(catalogImportMaxBytes / (1024 * 1024)).toFixed(1)}MB por planilha.`,
      });
      return;
    }

    const isValidMime = file.type === catalogImportMime || file.name.toLowerCase().endsWith(".xlsx");
    if (!isValidMime) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "Envie um arquivo .xlsx gerado a partir do template.",
      });
      return;
    }

    setImportFile(file);
  };

  const handleDropImport = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingImport(false);
    const file = event.dataTransfer.files?.[0];
    handleImportFile(file ?? null);
  };

  const submitImport = () => {
    if (!importFile) {
      toast({
        variant: "destructive",
        title: "Selecione um arquivo",
        description: "Escolha a planilha .xlsx antes de enviar.",
      });
      return;
    }

    importMutation.mutate(importFile);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 pt-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            Listagem e CRUD completo dos itens. Todos os textos exibidos devem estar em português.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => catalogQuery.refetch()} disabled={catalogQuery.isFetching}>
            {catalogQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atualizar
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo item
          </Button>
        </div>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Importar catálogo em lote</p>
            <p className="text-xs text-muted-foreground">
              Envie uma planilha .xlsx seguindo o template. Limite de {(catalogImportMaxBytes / (1024 * 1024)).toFixed(1)}MB e 500 linhas úteis.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTemplateMutation.mutate()}
              disabled={downloadTemplateMutation.isPending}
            >
              {downloadTemplateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Download className="mr-2 h-4 w-4" />
              Baixar template
            </Button>
            <Button
              size="sm"
              onClick={submitImport}
              disabled={!importFile || importMutation.isPending}
            >
              {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UploadCloud className="mr-2 h-4 w-4" />
              Enviar planilha
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Input
            id="catalog-import-file"
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => handleImportFile(event.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="catalog-import-file"
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center text-sm transition ${
              isDraggingImport ? "border-primary bg-primary/5" : "border-muted-foreground/40"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingImport(true);
            }}
            onDragLeave={() => setIsDraggingImport(false)}
            onDrop={handleDropImport}
          >
            <UploadCloud className="h-5 w-5 text-primary" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Arraste e solte ou clique para selecionar o .xlsx</p>
              <p className="text-xs text-muted-foreground">
                Cabeçalho fixo: Nome, Descrição, Categoria, Fabricante, Preço, Status, Tags.
              </p>
            </div>

            {importFile ? (
              <p className="rounded-md bg-muted px-3 py-1 text-xs text-foreground">
                {importFile.name} ({formatBytes(importFile.size)})
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Aceita apenas arquivos .xlsx
              </p>
            )}
          </label>
        </div>

        {importResult && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/50 bg-emerald-500/5 p-3 text-sm text-emerald-700">
            <CheckCircle2 className="mt-[2px] h-4 w-4" />
            <div className="space-y-1">
              <p className="font-medium">Importação concluída</p>
              <p className="text-xs">
                {importResult.created} item{importResult.created === 1 ? "" : "s"} criado{importResult.created === 1 ? "" : "s"} em {formatDurationMs(importResult.durationMs)}.
              </p>
              {importResult.sampleIds && importResult.sampleIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  IDs de exemplo: {importResult.sampleIds.slice(0, 5).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {importErrors.length > 0 && (
          <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4" />
              Erros encontrados ({importErrors.length})
            </div>
            <div className="space-y-1 text-xs text-destructive">
              {importErrors.slice(0, 6).map((error) => (
                <div key={`${error.row}-${error.message}`} className="rounded bg-white/40 px-2 py-1">
                  Linha {error.row}: {error.message}
                  {error.fields.length > 0 && (
                    <span className="text-[11px] text-muted-foreground"> — campos: {error.fields.join(", ")}</span>
                  )}
                </div>
              ))}
              {importErrors.length > 6 && (
                <p className="text-[11px] text-muted-foreground">Mostrando 6 de {importErrors.length} erros.</p>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Input
                placeholder="Buscar por nome, categoria ou tag..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Limpar busca"
                disabled={!search}
                onClick={() => setSearch("")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="status-filter" className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </Label>
              <Select value={status} onValueChange={(value) => setStatus(value as CatalogStatusFilter)}>
                <SelectTrigger id="status-filter" className="w-[160px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  {statusFilters.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"} listado{items.length === 1 ? "" : "s"}
          </div>
        </div>

        {catalogQuery.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : "Erro ao carregar o catálogo."}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fabricante</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando catálogo...
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!catalogQuery.isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      Nenhum item encontrado com os filtros atuais. Cadastre um novo item ou ajuste a busca.
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-[260px] align-top">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">{item.manufacturer}</TableCell>
                  <TableCell className="align-top text-sm font-semibold">{formatPriceBRL(item.price)}</TableCell>
                  <TableCell className="align-top">
                    <Badge variant={item.status === "ativo" ? "default" : "outline"}>
                      {statusLabel(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.length === 0 && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          Sem tags
                        </Badge>
                      )}
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openFilesDialog(item)}>
                        <Paperclip className="mr-2 h-4 w-4" />
                        Arquivos
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(item)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CatalogFilesDialog item={filesItem} open={filesDialogOpen} onOpenChange={handleFilesDialogChange} />

      <CatalogFormDialog
        mode={formMode}
        open={formOpen}
        initialItem={editingItem}
        onOpenChange={setFormOpen}
        onSubmit={onSubmitForm}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setHardDelete(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hardDelete ? "Remover permanentemente?" : "Arquivar item?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {hardDelete
                  ? "Esta ação remove o item do banco de dados. Não será possível recuperá-lo."
                  : "O item será marcado como arquivado e sairá das buscas. Você pode restaurá-lo editando o status."}
              </p>
              {deleteTarget && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
                  {deleteTarget.name} — {deleteTarget.category}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex items-center gap-2 rounded-md border p-3">
            <Switch id="hard-delete" checked={hardDelete} onCheckedChange={setHardDelete} />
            <div className="space-y-0">
              <Label htmlFor="hard-delete" className="text-sm font-medium">
                Remover definitivamente
              </Label>
              <p className="text-xs text-muted-foreground">
                Se desativado, o item apenas será arquivado.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ id: deleteTarget.id, hard: hardDelete });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hardDelete ? "Remover" : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
