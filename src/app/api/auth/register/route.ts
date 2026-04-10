import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Password storage: signup sends plaintext → server hashes SHA-256 → stored.
    // Login (auth.ts): SHA-256(incoming plaintext) == stored → match.
    // Production upgrade: replace with bcrypt (cost=12).
    const stored = createHash("sha256").update(password).digest("hex");

    const user = await prisma.user.create({
      data: { name: name || null, email, password: stored },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
