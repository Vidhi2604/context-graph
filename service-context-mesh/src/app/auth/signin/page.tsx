"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signing_in" | "redirecting">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("signing_in");
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Invalid email or password");
      setStatus("idle");
    } else {
      setStatus("redirecting");
      router.refresh();
      router.push("/dashboard");
    }
  };

  const loading = status !== "idle";
  const buttonLabel = status === "redirecting" ? "Redirecting..." : status === "signing_in" ? "Signing in..." : "Sign In";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size={36} /></div>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          <form onSubmit={handleCredentials} className="space-y-4">
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
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              )}
              {buttonLabel}
            </button>
          </form>

          <div className="flex justify-between text-sm">
            <Link href="/auth/forgot-password" className="text-gray-500 hover:text-emerald-400 transition-colors">
              Forgot password?
            </Link>
            <Link href="/auth/signup" className="text-emerald-400 hover:underline">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
