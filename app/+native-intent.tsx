// When the OS opens an EPUB with Vellum ("Open with…" / "Open in…"), the app
// receives the file's own URL (file:// on iOS, content:// on Android) instead
// of a vellum:// deep link. Route it to the Library, which imports and opens it.
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (/^(file|content):\/\//i.test(path)) {
      return `/library?importUri=${encodeURIComponent(path)}`;
    }
  } catch {}
  return path;
}
