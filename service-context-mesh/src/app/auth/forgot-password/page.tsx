"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      setMessage(data.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size={36} /></div>
          <p className="text-gray-500 mt-2">Reset your password</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          {message ? (
            <div className="text-center space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center text-2xl">
                  ✉️
                </div>
                <h2 className="text-white font-semibold text-lg">Check your inbox</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We&apos;ve sent a password reset link to your email address. It expires in 1 hour.
                </p>
                <p className="text-gray-600 text-xs">
                  Didn&apos;t receive it? Check your spam folder or{" "}
                  <button
                    onClick={() => setMessage("")}
                    className="text-emerald-400 hover:underline"
                  >
                    try again
                  </button>
                  .
                </p>
              </div>
              <Link href="/auth/signin" className="block text-sm text-gray-500 hover:text-emerald-400 transition-colors">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-400">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              {error && (
                <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="text-sm text-gray-400 block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 rounded-xl font-medium transition-colors"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <p className="text-center text-sm text-gray-600">
                <Link href="/auth/signin" className="text-emerald-400 hover:underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
