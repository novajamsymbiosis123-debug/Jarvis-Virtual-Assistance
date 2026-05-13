"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogin } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Zap, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiLogin(email, password);
      setUser(data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-jarvis-600 flex items-center justify-center">
            <Zap size={22} className="text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight">JARVIS</span>
        </div>

        <div className="p-8 rounded-2xl border border-surface-200 bg-white dark:bg-surface-100">
          <h2 className="font-display font-bold text-xl mb-1">Welcome back</h2>
          <p className="text-sm text-surface-700 mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 focus:border-transparent transition text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 focus:border-transparent transition text-sm"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-jarvis-600 text-white rounded-lg font-semibold text-sm hover:bg-jarvis-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-700 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-jarvis-600 font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
