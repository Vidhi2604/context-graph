"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "signing_in" | "redirecting">("idle");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("creating");
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Sign up failed");
        setStatus("idle");
        return;
      }

      setStatus("signing_in");
      const result = await signIn("credentials", { email, password, redirect: false });

      if (result?.error) {
        setError("Account created but sign in failed. Please sign in manually.");
        setStatus("idle");
      } else {
        setStatus("redirecting");
        router.refresh();
        router.push("/onboarding");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const loading = status !== "idle";
  const buttonLabel =
    status === "creating" ? "Creating account..." :
    status === "signing_in" ? "Signing in..." :
    status === "redirecting" ? "Redirecting..." :
    "Create Account";

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center"><Logo size={36} /></div>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Your name"
              />
            </div>
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
                minLength={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Min 8 characters"
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

          <p className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-emerald-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
