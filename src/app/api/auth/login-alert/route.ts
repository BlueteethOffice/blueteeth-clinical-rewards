import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { formatName } from '@/lib/utils';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { rateLimit, logAuditAction } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const { success: rateOk } = await rateLimit(req as any, 10, 60000);
    if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // ✅ SECURITY FIX: Require authenticated user token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let decodedToken;
    try {
      const token = authHeader.split('Bearer ')[1];
      if (!adminAuth) throw new Error('Auth missing');
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    let { email, name, role, userAgent, ip } = await req.json();

    // Validate email matches token to prevent spoofing alerts for others
    if (email !== decodedToken.email) {
      return NextResponse.json({ error: 'Forbidden: Email mismatch' }, { status: 403 });
    }

    // Auto-detect browser info if missing
    if (!userAgent) {
      userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    }

    const date = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const displayName = name && role ? formatName(name, role) : (name || 'User');

    const subject = 'New Login Detected – Blueteeth Account';
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="background: #ef4444; padding: 30px 20px; text-align: center; color: white;">
          <div style="background: rgba(255,255,255,0.2); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;">
            <span style="font-size: 20px;">🛡️</span>
          </div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.025em; text-transform: uppercase;">Security Alert</h1>
        </div>
        <div style="padding: 40px; background: white;">
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 18px; font-weight: 700;">New Sign-in Detected</h2>
          <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">Hello <strong>${displayName}</strong>,<br><br>Your Blueteeth account was accessed from a new device or browser. Please review the details below:</p>
          
          <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Date & Time</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 700; text-align: right;">${date} (IST)</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Role Type</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 700; text-align: right; text-transform: capitalize;">${role || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Device Info</td>
                <td style="padding: 10px 0; color: #64748b; text-align: right; font-size: 11px;">${userAgent || 'Desktop Browser'}</td>
              </tr>
            </table>
          </div>

          <div style="border-left: 4px solid #f59e0b; background: #fffbeb; padding: 16px; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #92400e; font-weight: 600;">
              If this wasn't you, please reset your password immediately and contact security@blueteeth.in
            </p>
          </div>
        </div>
      </div>
    `;

    try {
      // 🔔 CREATE FIRESTORE NOTIFICATION
      const db = getAdminDb();
      if (db) {
        const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!userQuery.empty) {
          const uid = userQuery.docs[0].id;
          await db.collection('notifications').add({
            userId: uid,
            title: 'Security Alert: New Login',
            message: `A new login was detected on ${userAgent || 'a new device'} at ${date}.`,
            type: 'security',
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            link: '/dashboard/settings'
          });
        }
      }

      const mailPromise = (async () => {
        if (process.env.RESEND_API_KEY) {
          const resend = new Resend(process.env.RESEND_API_KEY);
          return await resend.emails.send({
            from: 'Blueteeth Pvt. Ltd. <security@resend.dev>',
            to: [email],
            subject,
            html
          });
        } else {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
          });
          return await transporter.sendMail({
            from: `"Blueteeth Security" <${process.env.GMAIL_USER}>`,
            to: [email],
            subject,
            html
          });
        }
      })();

      await Promise.race([
        mailPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
      ]);
    } catch (mailError) {
      console.error("Login alert mail error:", mailError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
