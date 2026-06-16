import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SUBJECTS, type Subject, SubjectIcon } from "@/lib/subjects";
import { sourceLabel, sourceBucket, type SourceKey } from "@/lib/sources";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, ChevronDown, ChevronRight, CheckCircle, Pencil, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface QRow {
  id: string;
  subject: Subject;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  source: string | null;
  reference: string | null;
  document_id: string | null;
}

interface ProgRow {
  question_id: string;
  status: "new" | "in_progress" | "mastered";
  times_seen: number;
  times_correct: number;
  times_wrong: number;
}

type StatusFilter = "all" | "mastered" | "in_progress" | "new";
const PAGE_SIZE = 25;

export function AllQuestionsView() {
  const { user } = useAuth();
  const [rows, setRows] = useState<QRow[]>([]);
  const [prog, setProg] = useState<Record<string, ProgRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<"all" | Subject>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<Subject>>(new Set());
  const [expandedExp, setExpandedExp] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<QRow | null>(null);
  const [deleting, setDeleting] = useState<QRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    const all: QRow[] = [];
    let from = 0;
    for (let i = 0; i < 20; i++) {
      const { data } = await supabase
        .from("questions")
        .select("id, subject, question_text, options, correct_index, explanation, source, reference, document_id")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...(data as QRow[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    setRows(all);

    if (user) {
      const pmap: Record<string, ProgRow> = {};
      let pf = 0;
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase
          .from("study_progress")
          .select("question_id, status, times_seen, times_correct, times_wrong")
          .eq("user_id", user.id)
          .range(pf, pf + 999);
        if (!data || data.length === 0) break;
        for (const r of data as ProgRow[]) pmap[r.question_id] = r;
        if (data.length < 1000) break;
        pf += 1000;
      }
      setProg(pmap);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (subjectFilter !== "all" && r.subject !== subjectFilter) return false;
      if (sourceFilter !== "all" && sourceBucket(r.source, r.document_id) !== sourceFilter) return false;
      if (statusFilter !== "all") {
        const p = prog[r.id];
        const status = p?.status ?? "new";
        if (status !== statusFilter) return false;
      }
      if (!t) return true;
      return (
        r.question_text.toLowerCase().includes(t) ||
        r.options.some((o) => o.toLowerCase().includes(t)) ||
        (r.explanation ?? "").toLowerCase().includes(t)
      );
    });
  }, [rows, search, subjectFilter, sourceFilter, statusFilter, prog]);

  // Sort within subject: failed first → unseen → mastered last
  const sortKey = (r: QRow): number => {
    const p = prog[r.id];
    if (!p) return 1; // unseen middle
    if (p.status === "mastered") return 2;
    // failed: higher times_wrong → smaller (earlier)
    return -p.times_wrong;
  };

  const grouped = useMemo(() => {
    const map = new Map<Subject, QRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.subject) ?? [];
      arr.push(r);
      map.set(r.subject, arr);
    }
    for (const [, arr] of map) arr.sort((a, b) => sortKey(a) - sortKey(b));
    return SUBJECTS.filter((s) => map.has(s)).map((s) => ({ subject: s, items: map.get(s)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, prog]);

  // Flat paginated list (across subjects) for paging
  const flat = useMemo(() => grouped.flatMap((g) => g.items.map((it) => ({ ...it, _grp: g.subject }))), [grouped]);
  const totalPages = Math.max(1, Math.ceil(flat.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const sliceFlat = flat.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  // re-group the slice by subject again
  const sliceGrouped = useMemo(() => {
    const map = new Map<Subject, QRow[]>();
    for (const r of sliceFlat) {
      const arr = map.get(r._grp) ?? [];
      arr.push(r);
      map.set(r._grp, arr);
    }
    return SUBJECTS.filter((s) => map.has(s)).map((s) => ({ subject: s, items: map.get(s)! }));
  }, [sliceFlat]);

  const toggleCol = (s: Subject) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(s)) n.delete(s); else n.add(s);
      return n;
    });
  const toggleExp = (id: string) =>
    setExpandedExp((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  return (
    <div>
      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por palabra clave…"
              className="pl-9"
            />
          </div>
          <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v as "all" | Subject); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Materia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las materias</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v as SourceKey); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Fuente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fuentes</SelectItem>
              <SelectItem value="phak">PHAK</SelectItem>
              <SelectItem value="ciaac">CIAAC</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {([
            { k: "all", l: "Todas" }, { k: "mastered", l: "Dominadas" },
            { k: "in_progress", l: "En progreso" }, { k: "new", l: "Sin ver" },
          ] as { k: StatusFilter; l: string }[]).map((s) => (
            <button
              key={s.k}
              onClick={() => { setStatusFilter(s.k); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                statusFilter === s.k ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary"
              }`}
            >{s.l}</button>
          ))}
        </div>
      </Card>

      <p className="text-sm text-muted-foreground mb-4">
        {loading ? "Cargando…" : `Mostrando ${sliceFlat.length} de ${filtered.length} (de ${rows.length} totales)`}
      </p>

      <div className="space-y-6">
        {sliceGrouped.map(({ subject: s, items }) => {
          const isCol = collapsed.has(s);
          const totalInSubject = grouped.find((g) => g.subject === s)?.items.length ?? items.length;
          return (
            <section key={s}>
              <button
                onClick={() => toggleCol(s)}
                className="w-full flex items-center gap-2 mb-3 text-left p-2 hover:bg-secondary/50 rounded-lg"
              >
                {isCol ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <SubjectIcon subject={s} />
                <h2 className="font-display font-bold">{s}</h2>
                <span className="text-xs text-muted-foreground">({totalInSubject})</span>
              </button>
              {!isCol && (
                <div className="space-y-3">
                  {items.map((q, i) => {
                    const p = prog[q.id];
                    const expanded = expandedExp.has(q.id);
                    return (
                      <Card key={q.id} className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>#{(curPage - 1) * PAGE_SIZE + i + 1}</span>
                            <span className="px-1.5 py-0.5 rounded bg-secondary">{sourceLabel(q.source, q.document_id)}</span>
                            {p && (
                              <span className="text-[10px]">
                                Vista {p.times_seen}× · ✓{p.times_correct} ✗{p.times_wrong}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(q)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(q)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <h3 className="font-semibold leading-snug mb-3">{q.question_text}</h3>
                        <div className="space-y-1.5">
                          {q.options.map((opt, j) => {
                            const correct = j === q.correct_index;
                            return (
                              <div key={j} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                                correct ? "border-success bg-success/10" : "border-border"
                              }`}>
                                <span className="font-semibold">{String.fromCharCode(65 + j)}.</span>
                                <span className="flex-1">{opt}</span>
                                {correct && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                        {q.explanation && (
                          <button
                            onClick={() => toggleExp(q.id)}
                            className="mt-3 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                          >
                            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {expanded ? "Ocultar" : "Ver"} explicación
                          </button>
                        )}
                        {expanded && q.explanation && (
                          <div className="mt-2 rounded-md bg-secondary/50 border p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                            {q.explanation}
                            {q.reference && <div className="mt-2 text-xs text-primary">Fuente: {q.reference}</div>}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {curPage} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={curPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      <EditDialog
        question={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setRows((rs) => rs.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
          setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta pregunta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La pregunta y su registro en flashcards serán eliminados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                const id = deleting.id;
                await supabase.from("flashcard_reviews").delete().eq("question_id", id);
                const { error } = await supabase.from("questions").delete().eq("id", id);
                if (error) { toast.error(error.message); return; }
                setRows((rs) => rs.filter((r) => r.id !== id));
                setDeleting(null);
                toast.success("Pregunta eliminada");
              }}
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({ question, onClose, onSaved }: {
  question: QRow | null;
  onClose: () => void;
  onSaved: (q: QRow) => void;
}) {
  const [form, setForm] = useState<QRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(question ? { ...question } : null); }, [question]);

  if (!form) return null;

  const setOpt = (i: number, v: string) => {
    setForm((f) => f ? { ...f, options: f.options.map((o, j) => j === i ? v : o) } : f);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase.from("questions").update({
      question_text: form.question_text,
      options: form.options,
      correct_index: form.correct_index,
      explanation: form.explanation,
      subject: form.subject,
    }).eq("id", form.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pregunta actualizada");
    onSaved(form);
  };

  return (
    <Dialog open={!!question} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar pregunta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold">Pregunta</label>
            <Textarea value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} rows={3} />
          </div>
          {form.options.map((o, i) => (
            <div key={i}>
              <label className="text-xs font-semibold">Opción {String.fromCharCode(65 + i)}</label>
              <Input value={o} onChange={(e) => setOpt(i, e.target.value)} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold">Respuesta correcta</label>
              <Select value={String(form.correct_index)} onValueChange={(v) => setForm({ ...form, correct_index: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {form.options.map((_, i) => (
                    <SelectItem key={i} value={String(i)}>{String.fromCharCode(65 + i)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold">Materia</label>
              <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v as Subject })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold">Explicación</label>
            <Textarea value={form.explanation ?? ""} onChange={(e) => setForm({ ...form, explanation: e.target.value || null })} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
