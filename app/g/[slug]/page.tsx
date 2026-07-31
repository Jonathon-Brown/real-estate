import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DescriptionCard } from "./description-card";
import { Gallery } from "./gallery";

// cache() dedupes the query when both generateMetadata and the page ask for
// the same shoot during one request.
const getShoot = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shoots")
    .select(
      "id, slug, address, description_short, description_medium, description_long, photos(storage_path, sort_order)",
    )
    .eq("slug", slug)
    .single();
  return data;
});

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

  const supabase = await createClient();
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
    </main>
  );
}
