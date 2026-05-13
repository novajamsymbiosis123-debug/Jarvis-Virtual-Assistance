"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRegister } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Zap, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", username: "", password: "", fullName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const data = await apiRegister(form.email, form.username, form.password, form.fullName);
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
          <h2 className="font-display font-bold text-xl mb-1">Create account</h2>
          <p className="text-sm text-surface-700 mb-6">Start your AI assistant experience</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={update("fullName")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="Tony Stark"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={update("username")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="ironman"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={update("email")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={update("password")}
                className="w-full px-4 py-2.5 rounded-lg border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 transition text-sm"
                placeholder="••••••••"
              />
              <p className="text-xs text-surface-700 mt-1">Minimum 8 characters</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-jarvis-600 text-white rounded-lg font-semibold text-sm hover:bg-jarvis-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Create Account
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-surface-700 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-jarvis-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
