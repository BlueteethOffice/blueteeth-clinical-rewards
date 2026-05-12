import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { rateLimit, checkFileAccess, checkFileAccessByPath } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // 🛡️ Security Check: Validate Firebase Token or Session Cookie
    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get('session')?.value;
    
    let decodedToken;
    try {
      if (!adminAuth) {
        return NextResponse.json({ success: false, error: 'Server misconfiguration: auth unavailable' }, { status: 503 });
      }

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split('Bearer ')[1];
        decodedToken = await adminAuth.verifyIdToken(token);
      } else if (sessionCookie) {
        decodedToken = await adminAuth.verifySessionCookie(sessionCookie);
      } else {
        return NextResponse.json({ error: 'Unauthorized: Missing token or session' }, { status: 401 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: `Unauthorized: ${e.message}` }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    const path = searchParams.get('path');

    if (!fileId && !path) {
      return NextResponse.json({ error: 'No file ID or path provided' }, { status: 400 });
    }

    // ✅ RATE LIMITING
    const { success: rateOk } = await rateLimit(request as any, 20, 60000); // 20 views per minute
    if (!rateOk) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // ✅ SECURITY: Validate User Data
    const userRole = (await getAdminDb()?.collection('users').doc(decodedToken.uid).get())?.data()?.role || 'unknown';

    // ✅ CHECK OWNERSHIP/ACCESS
    let storagePath: string | null | boolean = null;
    
    if (fileId) {
      storagePath = await checkFileAccess(fileId, decodedToken.uid, userRole);
    } else if (path) {
      const hasAccess = await checkFileAccessByPath(path, decodedToken.uid, userRole);
      if (hasAccess) storagePath = path;
    }

    if (!storagePath) {
      return NextResponse.json({ error: 'Access denied: You do not have permission to view this file' }, { status: 403 });
    }

    // Handle boolean return from checkFileAccessByPath if it was true but storagePath is not a string
    const finalPath = typeof storagePath === 'string' ? storagePath : (path as string);
    const absolutePath = join(process.cwd(), 'public', finalPath);

    if (!existsSync(absolutePath)) {
      console.error(`❌ File Missing on Disk: ${absolutePath}`);
      return NextResponse.json({ error: 'File exists in database but missing on server disk' }, { status: 404 });
    }

    const fileBuffer = await readFile(absolutePath);
    const ext = absolutePath.split('.').pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    const mimeType = mimeTypes[ext || ''] || 'application/octet-stream';

    // 🛡️ IDM BYPASS: Serve PDFs as an HTML+pdf.js page.
    // IDM intercepts raw application/pdf responses. Serving text/html bypasses it completely.
    if (mimeType === 'application/pdf') {
      const base64 = fileBuffer.toString('base64');
      // Reverse the base64 string so IDM regex can't detect the PDF signature
      const reversedBase64 = base64.split('').reverse().join('');

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Clinical Document Viewer — Blueteeth</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; min-height: 100vh; }
    .toolbar { background: #1e293b; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .brand { font-size: 11px; font-weight: 900; letter-spacing: 3px; color: #94a3b8; text-transform: uppercase; }
    .brand span { color: #22d3ee; }
    .actions { display: flex; gap: 10px; }
    .btn { background: #0ea5e9; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; transition: all 0.2s; }
    .btn:hover { background: #38bdf8; transform: translateY(-1px); }
    .btn.secondary { background: rgba(255,255,255,0.08); }
    .btn.secondary:hover { background: rgba(255,255,255,0.15); }
    #viewer { flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 32px 16px; gap: 24px; }
    canvas { box-shadow: 0 25px 60px rgba(0,0,0,0.6); border-radius: 8px; max-width: 100%; background: white; display: block; }
    #loader { color: #22d3ee; font-size: 11px; font-weight: 900; letter-spacing: 6px; text-transform: uppercase; margin: auto; padding: 80px 0; }
    .page-info { color: #475569; font-size: 10px; font-weight: 700; letter-spacing: 2px; }
    @media print {
      .toolbar { display: none !important; }
      body { background: white !important; }
      #viewer { padding: 0 !important; }
      canvas { box-shadow: none !important; border-radius: 0 !important; width: 100% !important; page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="brand">BLUETEETH <span>SECURE DOC</span></div>
    <div class="actions">
      <span id="pageInfo" class="page-info"></span>
      <button onclick="window.print()" class="btn secondary">Print / Save</button>
    </div>
  </div>
  <div id="viewer"><div id="loader">Loading Document...</div></div>
  <script>
    const reversed = "${reversedBase64}";
    const pdfData = atob(reversed.split('').reverse().join(''));
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
      document.getElementById('loader').remove();
      document.getElementById('pageInfo').textContent = pdf.numPages + ' PAGE' + (pdf.numPages > 1 ? 'S' : '');
      const viewer = document.getElementById('viewer');
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: window.devicePixelRatio >= 2 ? 1.5 : 2.0 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = Math.min(viewport.width / 2, window.innerWidth - 32) + 'px';
        canvas.style.height = 'auto';
        viewer.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    }).catch(() => {
      document.getElementById('loader').textContent = 'Error loading document.';
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
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${fileId || finalPath.split('/').pop()}.${ext}"`,
      },
    });
  } catch (error: any) {
    console.error('🔥 View File Error:', error);
    return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
}
