import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAdminDb, getAdminError } from '@/lib/firebase-admin';

import { rateLimit } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, name } = body;
    const email = (body.email || '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // ✅ UNIFIED RATE LIMITING
    const { success: rateOk } = await rateLimit(req as any, 5, 5 * 60000);
    if (!rateOk) {
      return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: `Database connection failed: ${getAdminError() || 'Unknown error'}` }, { status: 500 });
    }

    // ─── SEND OTP ─────────────────────────────────────────────────────────────
    if (action === 'send') {

      // ✅ SECURITY FIX: Cross-Role Email Check
      // Prevent any signup if the email already exists in our users registry
      const existingUser = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!existingUser.empty) {
        return NextResponse.json({ error: 'This email is already registered with another account.' }, { status: 400 });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;

      await db.collection('otps').doc(email).set({ otp, expiresAt, used: false });

      // ✅ SECURITY FIX: Never log the actual OTP value
      console.log(`[OTP] Code sent to ${email}`);

      // Send email — fire and forget (never blocks the response)
      const subject = `${otp} is your Blueteeth verification code`;
      const html = `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:30px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#0891b2;margin:0 0 16px;">Blueteeth Verification</h2>
          <p style="color:#475569;">Hello <strong>${(name || 'User').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>,</p>
          <p style="color:#475569;">Your one-time verification code is:</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;font-size:36px;font-weight:900;letter-spacing:8px;color:#0891b2;">${otp}</div>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Valid for 10 minutes. Do not share this code.</p>
        </div>
      `;

      (async () => {
        // Try Resend first
        if (process.env.RESEND_API_KEY) {
          try {
            const r = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Blueteeth <onboarding@resend.dev>',
                to: [email],
                subject,
                html
              })
            });
            const d = await r.json();
            if (d.id) { console.log('✅ Email sent via Resend:', d.id); return; }
            console.error('❌ Resend error:', JSON.stringify(d));
          } catch (e: any) {
            console.error('❌ Resend exception:', e.message);
          }
        }

        // Fallback to Gmail
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
          try {
            const t = nodemailer.createTransport({
              host: 'smtp.gmail.com',
              port: 587,
              secure: false,
              auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
              }
            });
            await t.sendMail({
              from: `"Blueteeth" <${process.env.GMAIL_USER}>`,
              to: email,
              subject,
              html
            });
            console.log('✅ Email sent via Gmail');
          } catch (e: any) {
            console.error('❌ Gmail error:', e.message);
          }
        }

        if (!process.env.RESEND_API_KEY && !process.env.GMAIL_USER) {
          console.warn('⚠️  No email provider configured. Code is in terminal above.');
        }
      })();

      // Respond IMMEDIATELY — email sends in background
      return NextResponse.json({ message: 'OTP sent' });
    }

    // ─── VERIFY OTP ───────────────────────────────────────────────────────────
    if (action === 'verify') {

      const submittedOtp = (body.otp || '').trim();

      console.log(`[OTP-VERIFY] Attempt for ${email}`);

      const otpDoc = await db.collection('otps').doc(email).get();

      if (!otpDoc.exists) {
        console.log(`❌ No OTP found in Firestore for ${email}`);
        return NextResponse.json(
          { error: 'No code found. Please request a new one.' },
          { status: 400 }
        );
      }

      const record = otpDoc.data() as { otp: string; expiresAt: number; used: boolean };

      // ✅ SECURITY FIX: Never log stored OTP
      console.log(`[OTP-VERIFY] Record found for ${email}, used=${record.used}`);

      if (record.used) {
        return NextResponse.json({ error: 'Code already used.' }, { status: 400 });
      }

      if (Date.now() > record.expiresAt) {
        await db.collection('otps').doc(email).delete();
        return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
      }

      if (record.otp !== submittedOtp) {
        // ✅ SECURITY FIX: Never log expected OTP
        console.log(`[OTP-VERIFY] Invalid code for ${email}`);
        return NextResponse.json({ error: 'Invalid code.' }, { status: 400 });
      }

      // Mark used and clean up
      await db.collection('otps').doc(email).delete();
      console.log(`✅ Verified successfully for ${email}`);
      return NextResponse.json({ success: true });
    }

    // ─── CHECK USER ──────────────────────────────────────────────────────────
    if (action === 'check') {
      const userDoc = await db.collection('users').where('email', '==', email).limit(1).get();
      return NextResponse.json({ exists: !userDoc.empty });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('OTP Route Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
