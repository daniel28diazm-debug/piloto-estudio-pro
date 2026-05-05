import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SUBJECTS, SUBJECT_ICONS, type Subject, SubjectIcon } from "@/lib/subjects";
import { extractPdfText } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Upload, FileText, Sparkles, Trash2, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/library")({
  component: Library,
});

interface DocRow {
  id: string;
  file_name: string;
  subject: Subject;
  page_count: number;
  created_at: string;
  extracted_text: string;
}

function Library() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [subject, setSubject] = useState<Subject>("Meteorología");
  const [uploading, setUploading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, file_name, subject, page_count, created_at, extracted_text")
      .order("created_at", { ascending: false });
    setDocs((data as DocRow[]) ?? []);
  };

  useEffect(() => {
    if (user) refresh();
  }, [user]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.type !== "application/pdf") {
      toast.error("Solo se admiten archivos PDF");
      return;
    }
    setUploading(true);
    try {
      toast.info("Extrayendo texto del PDF…");
      const { text, pageCount } = await extractPdfText(file);

      const path = `${user.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("documents").upload(path, file, {
        contentType: "application/pdf",
      });
      if (up.error) throw up.error;

      const ins = await supabase.from("documents").insert({
        user_id: user.id,
        file_name: file.name,
        storage_path: path,
        subject,
        page_count: pageCount,
        extracted_text: text,
      });
      if (ins.error) throw ins.error;

      toast.success(`"${file.name}" subido (${pageCount} páginas)`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleGenerate = async (doc: DocRow) => {
    setGeneratingId(doc.id);
    try {
      toast.info("Generando 20 preguntas con IA…");
      const { data, error } = await supabase.functions.invoke("generate-questions", {
        body: { text: doc.extracted_text, subject: doc.subject, count: 20 },
      });
      if (error) throw error;
      const questions = data?.questions ?? [];
      if (!questions.length) throw new Error("La IA no devolvió preguntas");

      const rows = questions.map((q: {
        question_text: string; options: string[]; correct_index: number;
        explanation: string; difficulty: "fácil" | "medio" | "difícil";
      }) => ({
        user_id: user!.id,
        document_id: doc.id,
        subject: doc.subject,
        question_text: q.question_text,
        options: q.options,
        correct_index: q.correct_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
      }));

      const ins = await supabase.from("questions").insert(rows);
      if (ins.error) throw ins.error;

      // Auto-create flashcard reviews for each new question
      const { data: newQs } = await supabase
        .from("questions")
        .select("id")
        .eq("document_id", doc.id)
        .order("created_at", { ascending: false })
        .limit(rows.length);

      if (newQs?.length) {
        await supabase.from("flashcard_reviews").insert(
          newQs.map((q) => ({ user_id: user!.id, question_id: q.id })),
        );
      }

      toast.success(`${questions.length} preguntas generadas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar preguntas");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDelete = async (doc: DocRow) => {
    if (!confirm(`¿Eliminar "${doc.file_name}"? Las preguntas generadas se conservan.`)) return;
    await supabase.storage.from("documents").remove([`${user!.id}/${doc.file_name}`]).catch(() => {});
    await supabase.from("documents").delete().eq("id", doc.id);
    refresh();
  };

  const bySubject = SUBJECTS.map((s) => ({
    subject: s,
    items: docs.filter((d) => d.subject === s),
  }));

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-24 md:pb-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Biblioteca</h1>
        <p className="text-muted-foreground mt-1">Sube PDFs y genera preguntas con IA por materia.</p>
      </div>

      {/* Upload card */}
      <Card className="p-6 mb-8 bg-gradient-sky border-2 border-dashed">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 font-semibold">
              <Upload className="h-4 w-4" /> Subir un PDF
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona la materia y el archivo. La IA extraerá el texto automáticamente.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={subject} onValueChange={(v) => setSubject(v as Subject)}>
              <SelectTrigger className="w-full sm:w-56 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    <SubjectIcon subject={s} /> {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Subiendo…" : "Elegir PDF"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Docs by subject */}
      <div className="space-y-8">
        {bySubject.map(({ subject: s, items }) => (
          <section key={s}>
            <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-3">
              <span><SubjectIcon subject={s} /></span> {s}
              <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin documentos aún.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => (
                  <Card key={d.id} className="p-4 hover:shadow-card transition group">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate" title={d.file_name}>
                          {d.file_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.page_count} págs · {new Date(d.created_at).toLocaleDateString("es-MX")}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleGenerate(d)}
                        disabled={generatingId === d.id}
                      >
                        {generatingId === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {generatingId === d.id ? "Generando…" : "Generar preguntas"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(d)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
