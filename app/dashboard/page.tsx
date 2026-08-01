import { createClient } from "@/lib/supabase/server";
import { CopyButton } from "@/components/copy-button";
import { GenerateDescriptionButton } from "./generate-description-button";
import { NewShootForm } from "./new-shoot-form";

export const metadata = { title: "Dashboard — ShootLink" };

export default async function DashboardPage() {
  const supabase = await createClient();

  // The proxy guarantees a signed-in user here. Filtering by owner as well as
  // relying on RLS means a policy regression alone cannot leak another
  // photographer's shoots.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shoots, error } = await supabase
    .from("shoots")
    .select("id, slug, address, created_at, description_short, photos(count)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">ShootLink</h1>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-neutral-500 hover:text-neutral-900">
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-medium">New shoot</h2>
        <div className="mt-4">
          <NewShootForm />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-medium">Past shoots</h2>
        {error && (
          <p className="mt-4 text-sm text-red-600">
            Could not load shoots: {error.message}
          </p>
        )}
        {shoots && shoots.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">
            Nothing yet. Your first shoot will show up here.
          </p>
        )}
        {shoots && shoots.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100 border-y border-neutral-200">
            {shoots.map((shoot) => {
              const count = shoot.photos[0]?.count ?? 0;
              return (
                <li
                  key={shoot.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <a
                      href={`/g/${shoot.slug}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {shoot.address}
                    </a>
                    <p className="text-sm text-neutral-500">
                      {new Date(shoot.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {" · "}
                      {count} photo{count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                    <GenerateDescriptionButton
                      shootId={shoot.id}
                      hasDescription={Boolean(shoot.description_short)}
                    />
                    <CopyButton path={`/g/${shoot.slug}`} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
