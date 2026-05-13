import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

function extractCloudinaryParts(url: string) {
  const match = url.match(/res\.cloudinary\.com\/([^/]+)\/(image|raw|video)\/upload\/(?:v(\d+)\/)?(.+)$/);
  if (!match) return null;
  const fullPath = match[4]; // e.g. blueteeth_proofs/xgm3wjets0bxhk43de4r.pdf
  const resourceType = match[2];
  // For image type, strip extension from public_id
  const publicId = resourceType === 'image'
    ? fullPath.replace(/\.[^/.]+$/, '')
    : fullPath;
  const format = fullPath.split('.').pop() || 'pdf';
  return { resourceType, publicId, format, version: match[3] };
}

export async function GET(req: NextRequest) {
  try {
    const rawUrl = req.nextUrl.searchParams.get('url');
    if (!rawUrl) return NextResponse.json({ error: 'URL required' }, { status: 400 });

    const fileUrl = decodeURIComponent(rawUrl);

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
      secure: true,
    });

    let pdfBuffer: ArrayBuffer;

    const parts = extractCloudinaryParts(fileUrl);
    if (parts) {
      // ✅ Use Cloudinary private_download_url — authenticated, always works
      const downloadUrl = cloudinary.utils.private_download_url(
        parts.publicId,
        parts.format,
        {
          resource_type: parts.resourceType,
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 600,
        }
      );

      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`Cloudinary download failed: ${res.status}`);
      pdfBuffer = await res.arrayBuffer();
    } else {
      // Non-Cloudinary URL — try direct fetch
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      pdfBuffer = await res.arrayBuffer();
    }

    // ✅ Render using pdf.js in an HTML page (works for ALL browsers, no download managers)
    const base64 = Buffer.from(pdfBuffer).toString('base64');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Clinical Document — Blueteeth</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; min-height: 100vh; }
    .toolbar { background: #1e293b; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .brand { font-size: 11px; font-weight: 900; letter-spacing: 3px; color: #94a3b8; text-transform: uppercase; }
    .brand span { color: #22d3ee; }
    .actions { display: flex; gap: 10px; align-items: center; }
    .btn { background: #0ea5e9; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; transition: all 0.2s; }
    .btn:hover { background: #38bdf8; }
    .btn.secondary { background: rgba(255,255,255,0.08); }
    .page-info { color: #475569; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
    #viewer { flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 32px 16px; gap: 24px; }
    canvas { box-shadow: 0 25px 60px rgba(0,0,0,0.6); border-radius: 8px; max-width: 100%; background: white; display: block; }
    #loader { color: #22d3ee; font-size: 11px; font-weight: 900; letter-spacing: 6px; text-transform: uppercase; margin: auto; padding: 80px 0; }
    @media print {
      .toolbar { display: none !important; }
      body { background: white !important; }
      #viewer { padding: 0 !important; }
      canvas { box-shadow: none !important; width: 100% !important; page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="brand">BLUETEETH <span>CLINICAL DOC</span></div>
    <div class="actions">
      <span id="pageInfo" class="page-info"></span>
      <button onclick="window.print()" class="btn secondary">Print / Save</button>
    </div>
  </div>
  <div id="viewer"><div id="loader">Loading Document...</div></div>
  <script>
    const pdfData = atob("${base64}");
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
      document.getElementById('loader').remove();
      document.getElementById('pageInfo').textContent = pdf.numPages + ' PAGE' + (pdf.numPages > 1 ? 'S' : '');
      const viewer = document.getElementById('viewer');
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = window.devicePixelRatio >= 2 ? 1.5 : 2.0;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = Math.min(viewport.width / scale, window.innerWidth - 32) + 'px';
        canvas.style.height = 'auto';
        viewer.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    }).catch((e) => {
      document.getElementById('loader').textContent = 'Error loading document: ' + e.message;
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });

  } catch (error: any) {
    console.error('PDF View Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
