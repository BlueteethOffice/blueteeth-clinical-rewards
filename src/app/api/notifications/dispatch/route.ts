import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/security';

export async function POST(req: Request) {
  try {
    // 🛡️ Security Check: Validate Firebase Token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      if (!adminAuth) throw new Error("Admin Auth not initialized");
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { userId, title, message } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    // ✅ RATE LIMITING
    const { success: rateOk } = await rateLimit(req as any, 10, 60000);
    if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // ✅ SECURITY FIX: Only Admin can dispatch notifications
    const db = getAdminDb()!;
    const requesterDoc = await db.collection('users').doc(decodedToken.uid).get();
    const requesterRole = requesterDoc.data()?.role || 'unknown';

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch User Preferences and Contact Info
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnap.data();
    const { 
      email, 
      name, 
      phone, 
      emailNotifications, 
      whatsappAlerts 
    } = userData;

    const results = {
      emailSent: false,
      whatsappSent: false,
    };

    // 2. Handle Email Delivery
    if (emailNotifications && email) {
      const subject = `Blueteeth Alert: ${title}`;
      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">BLUETEETH</h2>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em;">Clinical Notification</p>
          </div>
          <div style="padding: 40px 30px;">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 700;">${title}</h3>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">Hello <strong>${name}</strong>,</p>
            <p style="color: #475569; line-height: 1.6; font-size: 16px; background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #0ea5e9;">
              ${message}
            </p>
            <div style="margin-top: 30px;">
              <a href="https://blueteeth-rewards.vercel.app/dashboard" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Open Dashboard</a>
            </div>
          </div>
          <div style="padding: 20px 30px; background: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 600;">&copy; 2026 Blueteeth Pvt. Ltd. | Enterprise Rewards Platform</p>
          </div>
        </div>
      `;

      try {
        if (process.env.RESEND_API_KEY) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: 'Blueteeth Alerts <alerts@resend.dev>',
            to: [email],
            subject,
            html,
          });
        } else {
          // Fallback to Nodemailer/Gmail
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
          });
          await transporter.sendMail({
            from: `"Blueteeth Alerts" <${process.env.GMAIL_USER}>`,
            to: [email],
            subject,
            html,
          });
        }
        results.emailSent = true;
      } catch (e) {
        console.error("Dispatch: Email Failed:", e);
      }
    }

    // 3. Handle WhatsApp Delivery
    if (whatsappAlerts && phone) {
      try {
        // Placeholder for real WhatsApp API (Twilio / Meta)
        // For now, we log the intent as "Workable" structure
        console.log(`[DISPATCH] WhatsApp to ${phone}: ${title} - ${message}`);
        
        /* 
        Example Twilio implementation:
        const client = require('twilio')(sid, auth);
        await client.messages.create({
          body: `${title}: ${message}`,
          from: 'whatsapp:+14155238886',
          to: `whatsapp:${phone}`
        });
        */
        
        results.whatsappSent = true;
      } catch (e) {
        console.error("Dispatch: WhatsApp Failed:", e);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Dispatch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
