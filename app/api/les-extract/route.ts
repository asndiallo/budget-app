import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

async function extractPdfText(buffer: Uint8Array): Promise<string> {
  // Use the legacy build — it's designed for Node.js / Bun server environments
  // and avoids the browser-only DOMMatrix dependency in the standard build.
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdfjs-dist's documented Node.js pattern: register the worker module on
  // globalThis so PDFWorker runs it in-process instead of spawning a real
  // Worker thread from a resolved workerSrc path (which an empty string no
  // longer suppresses on this version, and which Next's bundler can't resolve
  // dynamically at runtime anyway).
  // @ts-expect-error — no type declarations ship for the worker submodule.
  const pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // parseLes() is line-oriented — it takes the last dollar amount per line,
    // so every text item must land on its own line, not run together as one
    // giant line. pdf.js marks each item's line break via hasEOL.
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += (item as { str: string }).str;
      text += (item as { hasEOL?: boolean }).hasEOL ? '\n' : ' ';
    }
    pageTexts.push(text);
  }

  return pageTexts.join('\n');
}

export const POST = withAuth(async (req) => {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const text = isPdf
    ? await extractPdfText(new Uint8Array(await file.arrayBuffer()))
    : await file.text();

  return NextResponse.json({ text });
});
