import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { rateLimit, checkFileAccessByPath } from '@/lib/security';

export async function GET(request: NextRequest) {
  let decodedToken = null;
  // ✅ SECURITY FIX: Verify Session Cookie
  const session = (await cookies()).get('session')?.value;
  if (!session) {
    return new NextResponse('Unauthorized: Please login to view documents.', { status: 401 });
  }

  try {
    if (adminAuth) {
      decodedToken = await adminAuth.verifySessionCookie(session, true);
    }
  } catch (e) {
    return new NextResponse('Session Expired: Please login again.', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const docId = searchParams.get('id');

  if (!docId || !docId.startsWith('/uploads/') || docId.includes('..')) {
    return NextResponse.json({ error: 'Invalid document' }, { status: 403 });
  }

  // ✅ RATE LIMITING
  const { success: rateOk } = await rateLimit(request as any, 20, 60000);
  if (!rateOk) return new NextResponse('Too many requests', { status: 429 });

  // ✅ SECURITY: Ownership Check
  const userRole = (await getAdminDb()?.collection('users').doc(decodedToken.uid).get())?.data()?.role || 'unknown';
  const hasAccess = await checkFileAccessByPath(docId, decodedToken.uid, userRole);
  
  if (!hasAccess) {
    return new NextResponse('Access Denied: Permission required to view this document.', { status: 403 });
  }

  try {
    const absolutePath = join(process.cwd(), 'public', docId);
    const fileBuffer = await readFile(absolutePath);
    
    // ✅ IDM STEALTH MODE: 
    // 1. Convert to Base64
    // 2. Reverse the string (Encryption) so IDM regex fails to find PDF signature
    const base64 = fileBuffer.toString('base64');
    const reversedBase64 = base64.split('').reverse().join('');

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Enterprise Document Vault</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
    <style>
      body { margin: 0; padding: 0; background: #020617; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
      #canvas-container { padding: 40px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 40px; }
      canvas { box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.8); border-radius: 12px; max-width: 90%; background: white; transition: transform 0.3s; }
      canvas:hover { transform: scale(1.01); }
      .toolbar { position: sticky; top: 0; width: 100%; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(20px); padding: 18px; display: flex; justify-content: center; gap: 30px; z-index: 100; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .btn { background: #0ea5e9; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 900; cursor: pointer; text-transform: uppercase; font-size: 10px; letter-spacing: 2px; transition: all 0.2s; box-shadow: 0 4px 14px 0 rgba(14, 165, 233, 0.3); }
      .btn:hover { background: #38bdf8; box-shadow: 0 6px 20px rgba(14, 165, 233, 0.4); }
      .page-info { color: #64748b; font-size: 10px; font-weight: 900; display: flex; align-items: center; letter-spacing: 3px; }
      .loader { color: #0ea5e9; margin-top: 250px; font-weight: 900; letter-spacing: 12px; text-transform: uppercase; font-size: 12px; }
      
      /* ✅ Professional Print Styles */
      @media print {
        .toolbar, .loader { display: none !important; }
        body { background: white !important; }
        #canvas-container { padding: 0 !important; margin: 0 !important; width: 100% !important; }
        canvas { 
          box-shadow: none !important; 
          border-radius: 0 !important; 
          width: 100% !important; 
          height: auto !important;
          page-break-after: always;
        }
      }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button id="prev" class="btn">Previous</button>
      <div class="page-info">DOCUMENT &nbsp; <span id="page_num" style="color:white"></span> &nbsp;/&nbsp; <span id="page_count"></span></div>
      <button id="next" class="btn">Next</button>
      <button onclick="window.print()" class="btn" style="background: #4f46e5; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);">Print View</button>
    </div>

    <div id="loader" class="loader">Unlocking Secure Document...</div>
    <div id="canvas-container">
      <canvas id="the-canvas"></canvas>
    </div>

    <script>
      // ✅ Bypass IDM by de-reversing the string only after page load
      const reversed = "${reversedBase64}";
      const pdfData = atob(reversed.split('').reverse().join(''));
      
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

      let pdfDoc = null, pageNum = 1, pageRendering = false, pageNumPending = null, scale = 2.0,
          canvas = document.getElementById('the-canvas'), ctx = canvas.getContext('2d');

      function renderPage(num) {
        pageRendering = true;
        pdfDoc.getPage(num).then((page) => {
          const viewport = page.getViewport({scale: scale});
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext = { canvasContext: ctx, viewport: viewport };
          const renderTask = page.render(renderContext);
          renderTask.promise.then(() => {
            pageRendering = false;
            document.getElementById('loader').style.display = 'none';
            if (pageNumPending !== null) { renderPage(pageNumPending); pageNumPending = null; }
          });
        });
        document.getElementById('page_num').textContent = num;
      }

      function queueRenderPage(num) {
        if (pageRendering) { pageNumPending = num; } else { renderPage(num); }
      }

      document.getElementById('prev').onclick = () => { if (pageNum <= 1) return; pageNum--; queueRenderPage(pageNum); };
      document.getElementById('next').onclick = () => { if (pageNum >= pdfDoc.numPages) return; pageNum++; queueRenderPage(pageNum); };

      pdfjsLib.getDocument({data: pdfData}).promise.then((pdfDoc_) => {
        pdfDoc = pdfDoc_;
        document.getElementById('page_count').textContent = pdfDoc.numPages;
        renderPage(pageNum);
      });
    </script>
  </body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new NextResponse('Document Access Denied', { status: 404 });
  }
}
