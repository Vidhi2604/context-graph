import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword, email, adminSecret } = await req.json();

    // Admin reset (no token needed)
    if (adminSecret) {
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!email || !newPassword) {
        return NextResponse.json({ error: "Email and newPassword required" }, { status: 400 });
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const hashed = createHash("sha256").update(newPassword).digest("hex");
      await prisma.user.update({ where: { email }, data: { password: hashed } });
      return NextResponse.json({ message: "Password reset successfully" });
    }

    // Token-based reset (user flow)
    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token and newPassword required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!resetToken) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    if (resetToken.expires < new Date()) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return NextResponse.json({ error: "Reset link has expired. Please request a new one." }, { status: 400 });
    }

    const hashed = createHash("sha256").update(newPassword).digest("hex");
    await prisma.user.update({ where: { email: resetToken.email }, data: { password: hashed } });
    await prisma.passwordResetToken.delete({ where: { token } });

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
