"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Reset failed");
    } else {
      router.push("/auth/signin?reset=success");
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
          Invalid reset link. Please request a new one.
        </div>
        <Link href="/auth/forgot-password" className="text-sm text-emerald-400 hover:underline">
          Request new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-lg px-4 py-2 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div>
        <label className="text-sm text-gray-400 block mb-1.5">New Password</label>
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
      <div>
        <label className="text-sm text-gray-400 block mb-1.5">Confirm Password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          placeholder="Repeat password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-3 rounded-xl font-medium transition-colors"
      >
        {loading ? "Resetting..." : "Set New Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-emerald-400">Context</span>Mesh
          </h1>
          <p className="text-gray-500 mt-2">Set a new password</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          <Suspense fallback={<div className="text-gray-400 text-sm">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
