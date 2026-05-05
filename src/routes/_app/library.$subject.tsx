import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, type Subject, SubjectIcon } from "@/lib/subjects";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, Search } from "lucide-react";

export const Route = createFileRoute("/_app/library/$subject")({
  component: SubjectQuestionsPage,
});

interface QRow {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

const PAGE_SIZE_DB = 1000;
const PER_PAGE = 20;

function SubjectQuestionsPage() {
  const { subject } = Route.useParams();
  const decoded = decodeURIComponent(subject) as Subject;
  const validSubject = (SUBJECTS as readonly string[]).includes(decoded);

  const [rows, setRows] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!validSubject) return;
    (async () => {
      setLoading(true);
      const all: QRow[] = [];
      let from = 0;
      for (let i = 0; i < 10; i++) {
        const { data, error } = await supabase
          .from("questions")
          .select("id, question_text, options, correct_index, explanation")
          .eq("subject", decoded)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE_DB - 1);
        if (error) break;
        const r = (data ?? []) as QRow[];
        all.push(...r);
        if (r.length < PAGE_SIZE_DB) break;
        from += PAGE_SIZE_DB;
      }
      setRows(all);
      setLoading(false);
    })();
  }, [decoded, validSubject]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.question_text.toLowerCase().includes(t) ||
        r.options.some((o) => o.toLowerCase().includes(t)) ||
        r.explanation.toLowerCase().includes(t),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const curPage = Math.min(page, totalPages);
  const slice = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE);

  if (!validSubject) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p>Materia no válida.</p>
        <Button asChild variant="outline" className="mt-3"><Link to="/library"><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto pb-24 md:pb-10">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/library"><ArrowLeft className="h-4 w-4 mr-1" /> Biblioteca</Link>
      </Button>
      <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2 mb-1">
        <SubjectIcon subject={decoded} className="h-7 w-7" /> {decoded}
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        {loading ? "Cargando…" : `${filtered.length} pregunta${filtered.length === 1 ? "" : "s"}`}
      </p>

      <div className="relative mb-5">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por texto, opción o explicación…"
          className="pl-9"
        />
      </div>

      {!loading && slice.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No hay preguntas que coincidan.</p>
      )}

      <div className="space-y-4">
        {slice.map((q, i) => (
          <Card key={q.id} className="p-5">
            <div className="text-xs text-muted-foreground mb-1">#{(curPage - 1) * PER_PAGE + i + 1}</div>
            <h3 className="font-semibold leading-snug mb-3">{q.question_text}</h3>
            <div className="space-y-1.5">
              {q.options.map((opt, j) => {
                const correct = j === q.correct_index;
                return (
                  <div
                    key={j}
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                      correct ? "border-success bg-success/10" : "border-border"
                    }`}
                  >
                    <span className="font-semibold">{String.fromCharCode(65 + j)}.</span>
                    <span className="flex-1">{opt}</span>
                    {correct && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                  </div>
                );
              })}
            </div>
            {q.explanation && (
              <div className="mt-3 rounded-md bg-secondary/50 border p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                <span className="font-semibold text-foreground">Explicación: </span>{q.explanation}
              </div>
            )}
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {curPage} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={curPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
