// Countries this store actually serves — the client table's data is a mix
// of +996 (Kyrgyzstan) and a handful of +998 (Uzbekistan) numbers, plus some
// malformed entries (wrong digit count, missing country code). Rejecting
// anything that isn't a clean match is safer than guessing a country code
// for a bare local number, since a wrong guess silently messages a stranger.
const SUPPORTED_COUNTRY_CODES = ["996", "998"];

/** Returns an E.164 WhatsApp-ready number ("+996XXXXXXXXX") or null if the phone can't be trusted. */
export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  for (const code of SUPPORTED_COUNTRY_CODES) {
    if (digits.startsWith(code) && digits.length === code.length + 9) {
      return `+${digits}`;
    }
  }
  return null;
}
