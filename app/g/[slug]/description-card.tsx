"use client";

import { useState } from "react";

const TABS = [
  { key: "short", label: "Short" },
  { key: "medium", label: "Medium" },
  { key: "long", label: "Long" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function DescriptionCard({
  descriptions,
}: {
  descriptions: Record<TabKey, string>;
}) {
  const [active, setActive] = useState<TabKey>("short");
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(descriptions[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mt-12 border border-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 pt-3 sm:px-6">
        <h2 className="pb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Listing description
        </h2>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActive(tab.key);
                setCopied(false);
              }}
              className={`px-3 pb-3 pt-1 text-sm font-medium ${
                active === tab.key
                  ? "border-b-2 border-neutral-900 text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {descriptions[active]}
        </p>
        <div className="mt-4 flex items-center justify-between">
          {/* MLS systems enforce hard character limits — show the count */}
          <span className="text-xs text-neutral-400">
            {descriptions[active].length} characters
          </span>
          <button
            type="button"
            onClick={copy}
            className="border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-neutral-900"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </section>
  );
}
