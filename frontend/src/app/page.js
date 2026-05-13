"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth";
import { useTheme } from "./layout";
import { Mic, MessageSquare, Shield, Zap, Sun, Moon } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { dark, setDark } = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-jarvis-600 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">JARVIS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-lg hover:bg-surface-200 transition-colors"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <Link
              href="/dashboard"
              className="px-5 py-2 bg-jarvis-600 text-white rounded-lg font-medium text-sm hover:bg-jarvis-700 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-4 py-2 text-sm font-medium hover:text-jarvis-600 transition-colors">
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-5 py-2 bg-jarvis-600 text-white rounded-lg font-medium text-sm hover:bg-jarvis-700 transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 text-xs font-medium mb-8 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            AI-POWERED VOICE ASSISTANT
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Your intelligent
            <br />
            <span className="bg-gradient-to-r from-jarvis-500 to-jarvis-700 bg-clip-text text-transparent">
              voice companion
            </span>
          </h1>
          <p className="text-lg md:text-xl text-surface-700 max-w-xl mx-auto mb-10 leading-relaxed">
            Speak naturally, get things done. Jarvis understands your voice, executes commands,
            and remembers your conversations — all in real time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={user ? "/dashboard" : "/register"}
              className="px-8 py-3.5 bg-jarvis-600 text-white rounded-xl font-semibold hover:bg-jarvis-700 transition-all shadow-lg shadow-jarvis-600/25 hover:shadow-jarvis-600/40"
            >
              Start Talking to Jarvis
            </Link>
            <Link
              href="#features"
              className="px-8 py-3.5 border border-surface-300 rounded-xl font-semibold hover:bg-surface-100 transition-all"
            >
              See Features
            </Link>
          </div>
        </div>
      </main>

      {/* Features */}
      <section id="features" className="px-6 md:px-12 py-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Mic,
              title: "Voice First",
              desc: "Speak naturally with real-time speech recognition and neural text-to-speech responses.",
            },
            {
              icon: MessageSquare,
              title: "Smart Chat",
              desc: "Powered by Claude AI with streaming responses, conversation memory, and action execution.",
            },
            {
              icon: Shield,
              title: "Production Ready",
              desc: "JWT auth, rate limiting, encrypted credentials, Docker deployment, and full API documentation.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-6 rounded-2xl border border-surface-200 hover:border-jarvis-300 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-jarvis-100 dark:bg-jarvis-950 flex items-center justify-center mb-4 group-hover:bg-jarvis-200 transition-colors">
                <Icon size={22} className="text-jarvis-600" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
              <p className="text-surface-700 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-surface-200 text-center text-sm text-surface-700">
        Jarvis AI Assistant &copy; {new Date().getFullYear()} &middot; Built with FastAPI, Next.js, and Claude AI
      </footer>
    </div>
  );
}
