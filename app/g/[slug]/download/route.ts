import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Streaming a large zip can outlive the default function timeout on Vercel.
export const maxDuration = 300;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: shoot } = await supabase
    .from("shoots")
    .select("id, address, photos(storage_path, sort_order)")
    .eq("slug", slug)
    .single();

  if (!shoot || shoot.photos.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const photos = shoot.photos.sort((a, b) => a.sort_order - b.sort_order);
  const publicUrl = (path: string) =>
    supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;

  // JPEGs are already compressed — `store` skips pointless re-compression.
  const archive = new ZipArchive({ store: true });

  // Feed the archive in the background while the response streams out.
  // One file is fetched and buffered at a time, so memory stays bounded
  // regardless of shoot size.
  (async () => {
    try {
      for (const photo of photos) {
        const res = await fetch(publicUrl(photo.storage_path));
        if (!res.ok) continue; // skip a missing file rather than corrupt the zip
        const entryDone = new Promise((resolve) =>
          archive.once("entry", resolve),
        );
        archive.append(Buffer.from(await res.arrayBuffer()), {
          name: photo.storage_path.split("/").pop() ?? photo.storage_path,
        });
        await entryDone;
      }
      await archive.finalize();
    } catch {
      archive.abort();
    }
  })();

  const zipName =
    shoot.address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || slug;

  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipName}.zip"`,
    },
  });
}
