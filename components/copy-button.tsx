"use client";

import { useState } from "react";

// `path` may be site-relative ("/g/abc"); the full URL is built in the
// browser at click time, since only the browser reliably knows the origin.
export function CopyButton({
  path,
  label = "Copy link",
}: {
  path: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = path.startsWith("/") ? window.location.origin + path : path;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-neutral-900"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
