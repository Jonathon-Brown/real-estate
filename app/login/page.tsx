"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">ShootLink</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sign in to your dashboard.
      </p>

      {status === "sent" ? (
        <div className="mt-10 border border-neutral-200 p-5 text-sm leading-relaxed">
          <p className="font-medium">Check your email.</p>
          <p className="mt-1 text-neutral-500">
            We sent a sign-in link to {email}. Open it on this device.
          </p>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-10 flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900"
            placeholder="you@example.com"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-2 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send sign-in link"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
