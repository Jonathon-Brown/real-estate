import { cache } from "react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { DescriptionCard } from "./description-card";
import { Gallery } from "./gallery";

// cache() dedupes the query when both generateMetadata and the page ask for
// the same shoot during one request.
const getShoot = cache(async (slug: string) => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("shoots")
    .select(
      "id, slug, address, description_short, description_medium, description_long, photos(storage_path, sort_order)",
    )
    .eq("slug", slug)
    .single();
  return data;
});

// Every agent and seller who opens a gallery link sees this, so it is the
// one marketing surface the deliverable already has. Unset means no footer —
// the app still runs for anyone who hasn't filled it in.
function studioCredit() {
  const name = process.env.STUDIO_NAME?.trim();
  if (!name) return null;

  const rawUrl = process.env.STUDIO_URL?.trim();
  return {
    name,
    // Accept "example.com" or "https://example.com"; show it without the
    // protocol either way.
    href: rawUrl ? (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`) : null,
    label: rawUrl?.replace(/^https?:\/\//i, "").replace(/\/$/, "") ?? null,
    email: process.env.STUDIO_EMAIL?.trim() || null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const shoot = await getShoot((await params).slug);
  return {
    title: shoot ? `${shoot.address} — Photos` : "Not found",
    // Galleries are client deliverables, not marketing pages.
    robots: { index: false },
  };
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shoot = await getShoot(slug);
  if (!shoot) notFound();

  const studio = studioCredit();
  const supabase = createAdminClient();
  const photos = shoot.photos
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p, i) => ({
      src: supabase.storage.from("photos").getPublicUrl(p.storage_path).data
        .publicUrl,
      alt: `${shoot.address} — photo ${i + 1}`,
    }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {shoot.address}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </p>
        </div>
        {photos.length > 0 && (
          <a
            href={`/g/${shoot.slug}/download`}
            className="shrink-0 self-start border border-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-900 hover:text-white sm:self-auto"
          >
            Download all
          </a>
        )}
      </header>

      <div className="mt-8">
        {photos.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No photos in this shoot yet.
          </p>
        ) : (
          <Gallery photos={photos} />
        )}
      </div>

      {shoot.description_short &&
        shoot.description_medium &&
        shoot.description_long && (
          <DescriptionCard
            descriptions={{
              short: shoot.description_short,
              medium: shoot.description_medium,
              long: shoot.description_long,
            }}
          />
        )}

      {studio && (
        <footer className="mt-16 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
          <p>
            Photographed by{" "}
            <span className="font-medium text-neutral-900">{studio.name}</span>
          </p>
          {(studio.href || studio.email) && (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {studio.href && (
                <a
                  href={studio.href}
                  target="_blank"
                  rel="noopener"
                  className="text-accent hover:underline"
                >
                  {studio.label}
                </a>
              )}
              {studio.email && (
                <a
                  href={`mailto:${studio.email}`}
                  className="text-accent hover:underline"
                >
                  {studio.email}
                </a>
              )}
            </p>
          )}
        </footer>
      )}
    </main>
  );
}
