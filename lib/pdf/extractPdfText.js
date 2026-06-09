// Client-side PDF text extraction using pdf.js. Loaded lazily so the
// (fairly large) library is only fetched when a user actually picks a PDF.

let pdfjsPromise;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      // Match the worker to the exact installed version to avoid API/worker
      // version-mismatch errors. Served from unpkg (mirrors the npm package).
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Extract plain text from a PDF File/Blob, page by page.
 * @param {File|Blob} file
 * @returns {Promise<string>} the extracted text
 */
export async function extractPdfText(file) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  try {
    await doc.cleanup();
  } catch {
    // best-effort cleanup
  }

  return pages.join("\n\n").trim();
}
