import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  // ✅ SECURITY FIX: Require authenticated user token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    if (!adminAuth) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    }
    await adminAuth.verifyIdToken(token);
  } catch (e: any) {
    return NextResponse.json({ error: `Unauthorized: ${e.message}` }, { status: 401 });
  }

  try {
    const { email, name } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    const subject = 'Welcome to Blueteeth - Registration Successful';
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 30px; text-align: center;">
        <h1 style="color: #0891b2;">Registration Successful!</h1>
        <p style="font-size: 18px; color: #333;">Hello <strong>${name}</strong>,</p>
        <p style="color: #666; line-height: 1.6;">
          Your account has been successfully created and verified on the Blueteeth platform.<br>
          You can now login to access your professional dashboard.
        </p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-weight: bold; color: #0891b2;">Blueteeth Pvt. Ltd.</p>
          <p style="font-size: 12px; color: #999;">Enterprise Healthcare Rewards & Identity System</p>
        </div>
      </div>
    `;

    try {
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({ 
          from: 'Blueteeth Pvt. Ltd. <onboarding@resend.dev>', 
          to: [email], 
          subject, 
          html 
        });
      } else {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
        });
        await transporter.sendMail({ 
          from: `"Blueteeth Pvt. Ltd." <${process.env.GMAIL_USER}>`, 
          to: [email], 
          subject, 
          html 
        });
      }
    } catch (e) {
      console.error("Welcome email error:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

