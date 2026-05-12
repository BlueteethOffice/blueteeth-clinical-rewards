import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, normalize, resolve } from 'path';
import { existsSync } from 'fs';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { rateLimit, checkFileAccessByPath, isTrustedDomain } from '@/lib/security';

// ✅ SECURITY: Only allow fetching from trusted domains
const ALLOWED_DOMAINS = [
  'res.cloudinary.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',
];

// Local helper removed in favor of @/lib/security

import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  // ✅ SECURITY FIX: Multi-mode Auth Support (Token or Cookie)
  const authHeader = request.headers.get('authorization');
  const session = (await cookies()).get('session')?.value;
  
  let decodedToken = null;

  try {
    if (!adminAuth) throw new Error('Admin missing');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      decodedToken = await adminAuth.verifyIdToken(token);
    } else if (session) {
      decodedToken = await adminAuth.verifySessionCookie(session, true);
    } else {
      return NextResponse.json({ error: 'Unauthorized: Missing credentials' }, { status: 401 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Unauthorized: ${e.message}` }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  // ✅ RATE LIMITING
  const { success: rateOk } = await rateLimit(request as any, 20, 60000);
  if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    let fileBuffer: Buffer;
    let contentType: string;

    const userRole = (await getAdminDb()?.collection('users').doc(decodedToken.uid).get())?.data()?.role || 'unknown';

    if (targetUrl.startsWith('/uploads/')) {
      // ✅ SECURITY: Ownership Check
      const hasAccess = await checkFileAccessByPath(targetUrl, decodedToken.uid, userRole);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied: You do not own this file' }, { status: 403 });
      }

      // ✅ SECURITY FIX: Path traversal prevention
      const uploadsBase = resolve(join(process.cwd(), 'public', 'uploads'));
      const requestedPath = resolve(join(process.cwd(), 'public', normalize(targetUrl)));

      // Ensure resolved path stays inside uploads directory
      if (!requestedPath.startsWith(uploadsBase)) {
        return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
      }

      if (!existsSync(requestedPath)) {
        return NextResponse.json({ error: 'Local file not found' }, { status: 404 });
      }
      fileBuffer = await readFile(requestedPath);
      const ext = targetUrl.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp'
      };
      contentType = mimeTypes[ext || ''] || 'application/octet-stream';
    } else {
      // ✅ SECURITY FIX: Enforce domain allowlist — no SSRF possible
      if (!isTrustedDomain(targetUrl, ALLOWED_DOMAINS)) {
        return NextResponse.json({ error: 'Forbidden: Domain not allowed' }, { status: 403 });
      }

      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error('Failed to fetch from source');
      contentType = response.headers.get('Content-Type') || 'application/octet-stream';
      fileBuffer = Buffer.from(await response.arrayBuffer());
    }

    if (contentType === 'application/pdf') {
      const base64 = fileBuffer.toString('base64');
      // 🛡️ IDM BYPASS: Reverse the base64 string so IDM regex can't detect the PDF signature in the HTML source
      const reversedBase64 = base64.split('').reverse().join('');
      
      const html = `<!DOCTYPE html>
<html>
<head>
    <title>Clinical Document Viewer — Blueteeth</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; min-height: 100vh; overflow-x: hidden; }
        .toolbar { background: #1e293b; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
        .brand { font-size: 11px; font-weight: 900; letter-spacing: 3px; color: #94a3b8; text-transform: uppercase; }
        .brand span { color: #22d3ee; }
        .btn { background: #0ea5e9; color: white; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; transition: all 0.2s; }
        .btn:hover { background: #38bdf8; transform: translateY(-1px); }
        #viewer { flex: 1; overflow-y: auto; display: flex; flex-direction: column; align-items: center; padding: 32px 16px; gap: 24px; }
        canvas { box-shadow: 0 25px 60px rgba(0,0,0,0.6); border-radius: 8px; max-width: 100%; background: white; display: block; }
        .loading { color: #22d3ee; font-size: 11px; font-weight: 900; letter-spacing: 6px; text-transform: uppercase; margin: auto; padding: 80px 0; }
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
        <button onclick="window.print()" class="btn">Print / Save PDF</button>
    </div>
    <div id="viewer"><div id="loading" class="loading">DECRYPTING DOCUMENT...</div></div>

    <script>
        const reversed = "${reversedBase64}";
        const pdfData = atob(reversed.split('').reverse().join(''));
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

        async function renderPDF() {
            const loadingTask = pdfjsLib.getDocument({data: pdfData});
            const pdf = await loadingTask.promise;
            document.getElementById('loading').remove();
            const container = document.getElementById('viewer');

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({scale: window.devicePixelRatio >= 2 ? 1.5 : 2.0});
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.width = Math.min(viewport.width / 2, window.innerWidth - 32) + 'px';
                canvas.style.height = 'auto';
                container.appendChild(canvas);
                await page.render({canvasContext: context, viewport: viewport}).promise;
            }
        }
        renderPDF().catch(err => {
            console.error(err);
            document.getElementById('loading').textContent = "ERROR LOADING DOCUMENT";
        });
    </script>
</body>
</html>`;

      return new NextResponse(html, {
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
      },
    });

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to fetch proof' }, { status: 500 });
  }
}
