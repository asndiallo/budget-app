import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/route-helpers';

async function extractPdfText(buffer: Uint8Array): Promise<string> {
  // Use the legacy build — it's designed for Node.js / Bun server environments
  // and avoids the browser-only DOMMatrix dependency in the standard build.
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Preserve whitespace between items so the line-oriented parser works correctly
    const lineText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    pageTexts.push(lineText);
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
