import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// One call carries 8 images and the model thinks before writing;
// give it more headroom than the default function timeout.
export const maxDuration = 120;

const PHOTO_COUNT = 8;
const LONG_EDGE = 1024;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  // This route spends real money — only the signed-in photographer may call it.
  // (The proxy only guards /dashboard pages, not API routes.)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("placeholder")) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set in .env.local" },
      { status: 500 },
    );
  }

  const { id } = await params;
  const { data: shoot } = await supabase
    .from("shoots")
    .select("id, address, beds, baths, sqft, notes, photos(storage_path, sort_order)")
    .eq("id", id)
    .single();

  if (!shoot) {
    return NextResponse.json({ error: "Shoot not found" }, { status: 404 });
  }
  if (shoot.photos.length === 0) {
    return NextResponse.json({ error: "This shoot has no photos" }, { status: 400 });
  }

  // Pick photos evenly spaced across the shoot, always including first and
  // last, so exteriors and closing shots both make it in.
  const sorted = shoot.photos.sort((a, b) => a.sort_order - b.sort_order);
  const picks =
    sorted.length <= PHOTO_COUNT
      ? sorted
      : Array.from(
          new Set(
            Array.from({ length: PHOTO_COUNT }, (_, i) =>
              Math.round((i * (sorted.length - 1)) / (PHOTO_COUNT - 1)),
            ),
          ),
          (idx) => sorted[idx],
        );

  // Fetch originals and shrink to ~1024px on the long edge. Full-res photos
  // would cost far more tokens without helping the description.
  const images: { data: string }[] = [];
  for (const photo of picks) {
    const url = supabase.storage.from("photos").getPublicUrl(photo.storage_path)
      .data.publicUrl;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const resized = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(LONG_EDGE, LONG_EDGE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      images.push({ data: resized.toString("base64") });
    } catch {
      // A single unreadable file shouldn't sink the whole run.
    }
  }
  if (images.length === 0) {
    return NextResponse.json(
      { error: "Could not load any photos for this shoot" },
      { status: 502 },
    );
  }

  const prompt = buildPrompt(shoot);

  const anthropic = new Anthropic();
  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8000, // covers the model's internal reasoning plus the JSON
      // Guarantees the reply is valid JSON with exactly these three fields.
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              short: { type: "string" },
              medium: { type: "string" },
              long: { type: "string" },
            },
            required: ["short", "medium", "long"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            ...images.map(
              (img) =>
                ({
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: img.data,
                  },
                }) as const,
            ),
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined this request. Try regenerating." },
        { status: 502 },
      );
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return NextResponse.json(
        { error: "The model returned no text. Try regenerating." },
        { status: 502 },
      );
    }
    raw = textBlock.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown API error";
    return NextResponse.json(
      { error: `Description generation failed: ${message}` },
      { status: 502 },
    );
  }

  // Belt and suspenders: strip code fences before parsing, and verify all
  // three fields are non-empty strings.
  let parsed: { short: string; medium: string; long: string };
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const candidate = JSON.parse(cleaned);
    if (
      typeof candidate.short !== "string" ||
      typeof candidate.medium !== "string" ||
      typeof candidate.long !== "string"
    ) {
      throw new Error("missing fields");
    }
    parsed = {
      short: candidate.short.trim(),
      medium: candidate.medium.trim(),
      long: candidate.long.trim(),
    };
  } catch {
    return NextResponse.json(
      { error: "The model's response wasn't valid JSON. Try regenerating." },
      { status: 502 },
    );
  }

  const { error: updateError } = await supabase
    .from("shoots")
    .update({
      description_short: parsed.short,
      description_medium: parsed.medium,
      description_long: parsed.long,
    })
    .eq("id", shoot.id);

  if (updateError) {
    return NextResponse.json(
      { error: `Generated, but saving failed: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

function buildPrompt(shoot: {
  address: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  notes: string | null;
}): string {
  const facts = [
    shoot.address,
    shoot.beds != null && shoot.baths != null
      ? `${shoot.beds}bd/${shoot.baths}ba`
      : null,
    shoot.sqft != null ? `${shoot.sqft} sqft` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return `You are writing an MLS listing description. Based on the photos and details below, write three versions: 250 characters, 600 characters, and 1000 characters.

CRITICAL — Fair Housing Act compliance. Describe the PROPERTY, never the buyer. Never reference or imply race, color, religion, sex, disability, familial status, or national origin. Banned phrases include: family, family-friendly, kids, bachelor, empty nesters, safe, crime-free, quiet neighborhood, walking distance, exclusive, near churches or schools. Use "primary bedroom," never "master bedroom."

Lead with the strongest visual feature. Concrete nouns over adjectives — "quartz waterfall island" beats "stunning kitchen." No exclamation points. Do not invent features you cannot see in the photos.

Property: ${facts}
Notes from photographer: ${shoot.notes ?? "(none)"}

Return only valid JSON: {"short": "...", "medium": "...", "long": "..."}`;
}
