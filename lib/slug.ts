// 8 chars from a 32-letter alphabet = ~1 trillion combinations, so a slug is
// unguessable in practice. Ambiguous characters (0/o, 1/l) are excluded since
// agents may read links aloud over the phone. 256 % 32 === 0, so taking bytes
// mod 32 introduces no bias.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function generateSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
