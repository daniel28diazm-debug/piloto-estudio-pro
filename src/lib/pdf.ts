// Lazy-loaded PDF text extraction using pdfjs-dist (browser only)
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  // Use the worker shipped with pdfjs-dist via Vite ?url import
  // @ts-expect-error - Vite worker URL import
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => (item as { str?: string }).str ?? "")
      .join(" ");
    fullText += pageText + "\n\n";
  }

  return { text: fullText.trim(), pageCount: pdf.numPages };
}
