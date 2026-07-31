"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateDescriptionButton({
  shootId,
  hasDescription,
}: {
  shootId: string;
  hasDescription: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shoots/${shootId}/description`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Failed (${res.status})`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-neutral-900 disabled:opacity-50"
      >
        {busy
          ? "Writing…"
          : hasDescription
            ? "Regenerate description"
            : "Generate description"}
      </button>
      {error && <span className="max-w-56 text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
