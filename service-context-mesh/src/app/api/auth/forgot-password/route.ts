import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to avoid user enumeration
    if (!user) {
      return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
    }

    // Invalidate any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({ where: { email } });

    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.passwordResetToken.create({ data: { email, token, expires } });

    const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your ContextMesh password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #34d399;">ContextMesh</h2>
          <p>You requested a password reset. Click the button below to set a new password.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
            Reset Password
          </a>
          <p style="color: #6b7280; font-size: 13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          <p style="color: #6b7280; font-size: 12px;">Or copy this link: ${resetUrl}</p>
        </div>
      `,
    });

    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
  }
}
