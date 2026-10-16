import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import JSZip from "jszip";
import { Platform } from "react-native";

// Imported books live in documentDirectory on both platforms. Unlike the
// cache directory, the OS never purges it, and for imported books the
// app's copy may be the only one the user has.
export const IMPORTS_DIR_NAME = "VellumImports/";
export const IMPORTS_DIR = FileSystem.documentDirectory + IMPORTS_DIR_NAME;

export type EpubMeta = {
  title: string;
  authors: string[];
  language?: string;
  description?: string;
  publisher?: string;
  identifier?: string;
  subjects: string[];
  cover?: { base64: string; ext: string };
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const decodeEntities = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const cleanText = (s: string) =>
  decodeEntities(decodeEntities(s).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const parseAttrs = (raw: string) => {
  const attrs: Record<string, string> = {};
  raw.replace(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (_, key, dq, sq) => {
    attrs[key.toLowerCase()] = decodeEntities(dq ?? sq ?? "");
    return "";
  });
  return attrs;
};

// Matches <tag>, <dc:tag>, <opf:tag> etc. — namespace prefixes vary between files.
const getElements = (xml: string, tag: string) => {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}\\s*>)`,
    "gi",
  );
  const out: { attrs: Record<string, string>; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    out.push({ attrs: parseAttrs(m[1] || ""), text: m[2] || "" });
  }
  return out;
};

const resolvePath = (baseDir: string, href: string) => {
  let decoded = href.split("#")[0];
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}
  const parts = (baseDir + decoded).split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else if (p && p !== ".") stack.push(p);
  }
  return stack.join("/");
};

const findZipFile = (zip: JSZip, path: string) => {
  const exact = zip.file(path);
  if (exact) return exact;
  const lower = path.toLowerCase();
  const match = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
  return match ? zip.file(match) : null;
};

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

// ── Metadata parsing ─────────────────────────────────────────────────────────
export const parseEpub = async (base64: string): Promise<EpubMeta> => {
  const zip = await JSZip.loadAsync(base64, { base64: true });

  const container = await findZipFile(zip, "META-INF/container.xml")?.async(
    "string",
  );
  const rootfile = container
    ? getElements(container, "rootfile")[0]?.attrs["full-path"]
    : undefined;
  const opfPath =
    rootfile ||
    Object.keys(zip.files).find((k) => k.toLowerCase().endsWith(".opf"));
  if (!opfPath) throw new Error("Not a valid EPUB (no package file)");

  const opf = await findZipFile(zip, opfPath)?.async("string");
  if (!opf) throw new Error("Not a valid EPUB (unreadable package file)");
  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";

  const metadataXml =
    /<(?:[\w-]+:)?metadata\b[\s\S]*?<\/(?:[\w-]+:)?metadata\s*>/i.exec(
      opf,
    )?.[0] || opf;
  const manifestXml =
    /<(?:[\w-]+:)?manifest\b[\s\S]*?<\/(?:[\w-]+:)?manifest\s*>/i.exec(
      opf,
    )?.[0] || opf;

  const title = cleanText(getElements(metadataXml, "title")[0]?.text || "");

  const creators = getElements(metadataXml, "creator");
  const authorCreators = creators.filter((c) => {
    const role = c.attrs["opf:role"] || c.attrs["role"];
    return !role || role === "aut";
  });
  const authors = (authorCreators.length ? authorCreators : creators)
    .map((c) => cleanText(c.text))
    .filter(Boolean);

  // Prefer the identifier the package itself declares as unique.
  const uniqueIdRef = getElements(opf, "package")[0]?.attrs[
    "unique-identifier"
  ];
  const identifiers = getElements(metadataXml, "identifier");
  const identifier = cleanText(
    (
      identifiers.find((i) => uniqueIdRef && i.attrs.id === uniqueIdRef) ||
      identifiers[0]
    )?.text || "",
  );

  // ── Cover image ──
  const items = getElements(manifestXml, "item").map((i) => i.attrs);
  const coverMetaId = getElements(metadataXml, "meta").find(
    (m) => m.attrs.name?.toLowerCase() === "cover",
  )?.attrs.content;
  const isImage = (i: Record<string, string>) =>
    !!IMAGE_EXT[(i["media-type"] || "").toLowerCase()];
  const coverItem =
    items.find(
      (i) =>
        isImage(i) && (i.properties || "").split(/\s+/).includes("cover-image"),
    ) ||
    items.find(
      (i) =>
        isImage(i) &&
        coverMetaId &&
        (i.id === coverMetaId || i.href === coverMetaId),
    ) ||
    items.find((i) => isImage(i) && /cover/i.test(`${i.id} ${i.href}`));

  let cover: EpubMeta["cover"];
  if (coverItem?.href) {
    const file = findZipFile(zip, resolvePath(opfDir, coverItem.href));
    if (file) {
      cover = {
        base64: await file.async("base64"),
        ext: IMAGE_EXT[coverItem["media-type"].toLowerCase()],
      };
    }
  }

  return {
    title,
    authors,
    language:
      cleanText(getElements(metadataXml, "language")[0]?.text || "") ||
      undefined,
    description:
      cleanText(getElements(metadataXml, "description")[0]?.text || "") ||
      undefined,
    publisher:
      cleanText(getElements(metadataXml, "publisher")[0]?.text || "") ||
      undefined,
    identifier: identifier || undefined,
    subjects: getElements(metadataXml, "subject")
      .map((s) => cleanText(s.text))
      .filter(Boolean),
    cover,
  };
};

// ── File access ──────────────────────────────────────────────────────────────
// Reads an EPUB the OS handed us (file:// on iOS, usually content:// on
// Android) and returns its bytes as base64. Nothing leaves the device.
export const readExternalEpub = async (sourceUri: string): Promise<string> => {
  let base64: string;
  if (Platform.OS === "ios") {
    // The new File API wraps the read in start/stopAccessingSecurityScopedResource,
    // which "Open in place" URLs from the Files app require.
    base64 = await new File(sourceUri).base64();
  } else {
    // Android hands out content:// URIs, which readAsStringAsync can't open
    // directly but copyAsync can (via the ContentResolver).
    const tmp = `${FileSystem.cacheDirectory}vellum_import_${Date.now()}.epub`;
    try {
      await FileSystem.copyAsync({ from: sourceUri, to: tmp });
      base64 = await FileSystem.readAsStringAsync(tmp, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } finally {
      FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => {});
    }
  }
  // Every EPUB is a zip archive, which starts with "PK\x03\x04".
  if (!base64.startsWith("UEsDB")) {
    throw new Error("This file is not a valid EPUB.");
  }
  return base64;
};

export const ensureImportsDir = async () => {
  const info = await FileSystem.getInfoAsync(IMPORTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMPORTS_DIR, { intermediates: true });
  }
};

export const writeImportedFiles = async (
  id: number,
  base64: string,
  meta: EpubMeta,
) => {
  await ensureImportsDir();
  const safeTitle = (meta.title || "book")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .substring(0, 30);
  const key = `${safeTitle}_${Math.abs(id)}`;

  const epubUri = `${IMPORTS_DIR}${key}.epub`;
  await FileSystem.writeAsStringAsync(epubUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  let coverUri: string | undefined;
  if (meta.cover) {
    coverUri = `${IMPORTS_DIR}${key}_cover.${meta.cover.ext}`;
    try {
      await FileSystem.writeAsStringAsync(coverUri, meta.cover.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      coverUri = undefined;
    }
  }
  return { epubUri, coverUri };
};

// Files shared into the app on iOS (AirDrop, Mail, "Copy to Vellum") land in
// Documents/Inbox. Once we've made our own copy, the inbox copy is clutter.
export const cleanupInboxCopy = async (sourceUri: string) => {
  if (
    Platform.OS === "ios" &&
    FileSystem.documentDirectory &&
    sourceUri.startsWith(FileSystem.documentDirectory + "Inbox/")
  ) {
    try {
      await FileSystem.deleteAsync(sourceUri, { idempotent: true });
    } catch {}
  }
};

// Absolute paths into the app container change on iOS between app updates,
// so re-anchor any stored imports path onto the current documentDirectory.
export const rebaseImportPath = (uri?: string) => {
  if (!uri) return uri;
  const idx = uri.indexOf("/" + IMPORTS_DIR_NAME);
  if (idx < 0) return uri;
  return IMPORTS_DIR + uri.slice(idx + IMPORTS_DIR_NAME.length + 1);
};

export const isImportedBook = (book: any) => book?.source === "local";

// Builds a book object shaped like the Gutendex records used everywhere else
// in the app, so cards, details, shelves and the reader all work unchanged.
export const buildImportedBook = (
  id: number,
  meta: EpubMeta,
  fileName: string | undefined,
  coverUri?: string,
) => {
  const fallbackTitle = (fileName || "Untitled")
    .replace(/\.epub$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const title = meta.title || fallbackTitle || "Untitled";
  const authors = meta.authors.length ? meta.authors : ["Unknown"];
  return {
    id,
    source: "local",
    localKey: importKey(meta, fileName),
    title,
    authors: authors.map((name) => ({ name })),
    formats: coverUri ? { "image/jpeg": coverUri } : {},
    languages: meta.language ? [meta.language.split("-")[0].toLowerCase()] : [],
    summaries: meta.description ? [meta.description] : [],
    subjects: meta.subjects,
    bookshelves: [],
    publisher: meta.publisher,
    media_type: "EPUB",
    download_count: 0,
    fileName,
  };
};

// Identifies "the same book" across repeat imports so opening a file twice
// reopens the existing entry (keeping progress and notes) instead of duplicating it.
export const importKey = (meta: EpubMeta, fileName?: string) =>
  meta.identifier
    ? `id:${meta.identifier}`
    : `tb:${meta.title}|${meta.authors.join(",")}|${meta.title ? "" : fileName || ""}`;

export const fileNameFromUri = (uri: string) => {
  const last = uri.split("?")[0].split("/").pop() || "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};
