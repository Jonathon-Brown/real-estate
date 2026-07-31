"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateSlug } from "@/lib/slug";
import { CopyButton } from "@/components/copy-button";

const UPLOAD_CONCURRENCY = 4;

type Phase =
  | { step: "idle" }
  | { step: "saving" }
  | { step: "uploading"; done: number; total: number }
  | { step: "done"; slug: string; uploaded: number; failed: number }
  | { step: "error"; message: string };

export function NewShootForm() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...images]);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0) {
      setPhase({ step: "error", message: "Add at least one photo." });
      return;
    }

    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    setPhase({ step: "saving" });

    // Create the shoot row first so uploads have an id to file under.
    // Retry on the (vanishingly unlikely) slug collision.
    let shoot: { id: string; slug: string } | null = null;
    for (let attempt = 0; attempt < 3 && !shoot; attempt++) {
      const slug = generateSlug();
      const { data, error } = await supabase
        .from("shoots")
        .insert({
          slug,
          address: String(form.get("address")).trim(),
          beds: intOrNull(form.get("beds")),
          baths: numOrNull(form.get("baths")),
          sqft: intOrNull(form.get("sqft")),
          notes: textOrNull(form.get("notes")),
          agent_name: textOrNull(form.get("agent_name")),
        })
        .select("id, slug")
        .single();

      if (data) shoot = data;
      else if (error.code !== "23505") {
        setPhase({ step: "error", message: `Could not save shoot: ${error.message}` });
        return;
      }
    }
    if (!shoot) {
      setPhase({ step: "error", message: "Could not generate a unique link. Try again." });
      return;
    }

    // Upload straight from the browser to storage, a few files at a time.
    setPhase({ step: "uploading", done: 0, total: files.length });
    const uploaded: { storage_path: string; sort_order: number }[] = [];
    let done = 0;
    let next = 0;

    async function worker() {
      while (next < files.length) {
        const i = next++;
        const file = files[i];
        const path = `${shoot!.id}/${String(i).padStart(3, "0")}-${safeName(file.name)}`;
        const { error } = await supabase.storage
          .from("photos")
          .upload(path, file, { contentType: file.type });
        if (!error) uploaded.push({ storage_path: path, sort_order: i });
        done++;
        setPhase({ step: "uploading", done, total: files.length });
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker),
    );

    if (uploaded.length > 0) {
      const { error } = await supabase
        .from("photos")
        .insert(uploaded.map((u) => ({ ...u, shoot_id: shoot!.id })));
      if (error) {
        setPhase({ step: "error", message: `Photos uploaded but not recorded: ${error.message}` });
        return;
      }
    }

    setPhase({
      step: "done",
      slug: shoot.slug,
      uploaded: uploaded.length,
      failed: files.length - uploaded.length,
    });
    setFiles([]);
    formRef.current?.reset();
    router.refresh();
  }

  const busy = phase.step === "saving" || phase.step === "uploading";

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-5">
      <Field label="Property address" required>
        <input name="address" required disabled={busy} className={inputCls} placeholder="123 Maple St, Portland OR" />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Beds">
          <input name="beds" type="number" min="0" step="1" disabled={busy} className={inputCls} />
        </Field>
        <Field label="Baths">
          <input name="baths" type="number" min="0" step="0.5" disabled={busy} className={inputCls} />
        </Field>
        <Field label="Sqft">
          <input name="sqft" type="number" min="0" step="1" disabled={busy} className={inputCls} />
        </Field>
      </div>

      <Field label="Agent name">
        <input name="agent_name" disabled={busy} className={inputCls} placeholder="Jane Smith, Acme Realty" />
      </Field>

      <Field label="Notes for the listing description">
        <textarea
          name="notes"
          rows={3}
          disabled={busy}
          className={inputCls}
          placeholder="New roof 2024, walnut floors throughout, south-facing yard"
        />
      </Field>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer border border-dashed px-4 py-10 text-center text-sm transition-colors ${
          dragOver ? "border-neutral-900 bg-neutral-50" : "border-neutral-300 text-neutral-500"
        }`}
      >
        {files.length === 0
          ? "Drag photos here, or tap to choose"
          : `${files.length} photo${files.length === 1 ? "" : "s"} ready — drag or tap to add more`}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {files.length > 0 && !busy && (
        <ul className="max-h-48 divide-y divide-neutral-100 overflow-y-auto border border-neutral-200 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="truncate">{f.name}</span>
              <span className="flex shrink-0 items-center gap-3 text-neutral-400">
                {(f.size / 1024 / 1024).toFixed(1)} MB
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="text-neutral-400 hover:text-neutral-900"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="submit"
        disabled={busy}
        className="bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {phase.step === "saving" && "Saving shoot…"}
        {phase.step === "uploading" && `Uploading ${phase.done} of ${phase.total}…`}
        {!busy && "Create shoot"}
      </button>

      {phase.step === "uploading" && (
        <div className="h-1 w-full bg-neutral-100">
          <div
            className="h-1 bg-neutral-900 transition-all"
            style={{ width: `${(phase.done / phase.total) * 100}%` }}
          />
        </div>
      )}

      {phase.step === "error" && (
        <p className="text-sm text-red-600">{phase.message}</p>
      )}

      {phase.step === "done" && (
        <div className="border border-neutral-200 p-4 text-sm">
          <p className="font-medium">
            Shoot created — {phase.uploaded} photo{phase.uploaded === 1 ? "" : "s"} uploaded
            {phase.failed > 0 && (
              <span className="text-red-600"> ({phase.failed} failed)</span>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="bg-neutral-50 px-2 py-1 text-xs">
              {`${window.location.origin}/g/${phase.slug}`}
            </code>
            <CopyButton path={`/g/${phase.slug}`} />
          </div>
        </div>
      )}
    </form>
  );
}

const inputCls =
  "w-full border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-900 disabled:bg-neutral-50";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>
        {label}
        {required && <span className="text-neutral-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}
function textOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : null;
}
function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}
