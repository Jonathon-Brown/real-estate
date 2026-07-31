import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        This link doesn&apos;t exist
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        The gallery may have been removed, or the address was mistyped. Check
        the link you were sent.
      </p>
      <p className="mt-8 text-sm">
        <Link href="/" className="text-accent hover:underline">
          ShootLink
        </Link>
      </p>
    </main>
  );
}
