import * as pdfjsLib from 'pdfjs-dist';

// Point worker to unpkg/cdnjs or bundled worker for seamless Vite compatibility
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdfContent {
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  fullText: string;
  pages: ExtractedPage[];
  isScannedOrEmpty: boolean;
}

export async function extractTextFromPdf(file: File): Promise<ExtractedPdfContent> {
  // Validate format
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Invalid file format. Please upload a valid PDF document (.pdf).');
  }

  // Size limit: 30 MB
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('File is too large. Maximum supported PDF size is 30 MB.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pages: ExtractedPage[] = [];
  let fullText = '';

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .filter((s: string) => typeof s === 'string' && s.trim().length > 0);
      const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
      pages.push({ pageNumber: i, text: pageText });
      if (pageText.length > 0) {
        fullText += `[Page ${i}]\n${pageText}\n\n`;
      }
    } catch (err) {
      console.warn(`Error reading page ${i}:`, err);
      pages.push({ pageNumber: i, text: '' });
    }
  }

  const rawCleanText = fullText.replace(/\[Page \d+\]/g, '').trim();
  const isScannedOrEmpty = rawCleanText.length < 50;

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    pageCount,
    fullText: fullText.trim(),
    pages,
    isScannedOrEmpty,
  };
}
