import {
  buildImportedBook,
  cleanupInboxCopy,
  fileNameFromUri,
  importKey,
  isImportedBook,
  parseEpub,
  readExternalEpub,
  rebaseImportPath,
  writeImportedFiles,
} from "@/utils/LocalBooks";
import { triggerAppRating } from "@/utils/Ratings";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Network from "expo-network";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

type BookStatus = "toread" | "reading" | "completed";
export type Snippet = {
  id: string;
  text: string;
  cfi?: string;
  createdAt: number;
  /** Set when the snippet is also a highlight drawn in the book. */
  color?: string;
};
export type SavedBook = {
  id: number;
  book: any;
  status: BookStatus;
  notes: string;
  dateAdded: number;
  localUri?: string;
  readerUri?: string;
  lastLocation?: string;
  snippets?: Snippet[];
};

type LibraryContextType = {
  savedBooks: SavedBook[];
  isLoaded: boolean;
  activeDownload: any | null;
  downloadProgress: number;
  isOffline: boolean;
  saveBook: (
    book: any,
    status?: BookStatus,
    localUri?: string,
    readerUri?: string,
  ) => Promise<void>;
  removeBook: (id: number) => Promise<void>;
  updateStatus: (id: number, status: BookStatus) => Promise<void>;
  updateNotes: (id: number, notes: string) => Promise<void>;
  checkBookStatus: (id: number) => SavedBook | undefined;
  startDownload: (book: any, opts?: { textOnly?: boolean }) => Promise<void>;
  updateLocation: (id: number, cfi: string) => Promise<void>;
  importBook: (sourceUri: string, fileName?: string) => Promise<SavedBook>;
  addSnippet: (
    id: number,
    text: string,
    cfi?: string,
    color?: string,
  ) => Promise<Snippet | null>;
  updateSnippetColor: (id: number, snippetId: string, color?: string) => Promise<void>;
  removeSnippet: (id: number, snippetId: string) => Promise<void>;
};

// Snippets used to be appended to a book's notes as `Snippet: "..."` blocks.
// Move them into their own list and leave the rest of the notes untouched.
// A block that doesn't match exactly stays in the notes, so nothing is lost.
const SNIPPET_BLOCK = /^Snippet: "([\s\S]*)"$/;
const migrateSnippets = (b: SavedBook): SavedBook => {
  if (b.snippets) return b;
  const snippets: Snippet[] = [];
  const kept: string[] = [];
  (b.notes || "").split("\n\n").forEach((chunk, i) => {
    const match = chunk.trim().match(SNIPPET_BLOCK);
    if (match && match[1].trim()) {
      snippets.push({
        id: `${b.id}-legacy-${i}`,
        text: match[1].trim(),
        createdAt: b.dateAdded + i,
      });
    } else {
      kept.push(chunk);
    }
  });
  return {
    ...b,
    notes: snippets.length ? kept.join("\n\n").trim() : b.notes,
    snippets,
  };
};

const LibraryContext = createContext<LibraryContextType>({} as any);

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {}

// ── Download helpers with progress callback ──────────────────────────────────
// Streams straight to disk, so large illustrated books (15MB+) never have to
// fit in JS memory.
const downloadNative = async (
  url: string,
  destPath: string,
  onProgress?: (progress: number) => void,
): Promise<boolean> => {
  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    destPath,
    {},
    (downloadProgress) => {
      if (downloadProgress.totalBytesExpectedToWrite > 0) {
        const pct =
          downloadProgress.totalBytesWritten /
          downloadProgress.totalBytesExpectedToWrite;
        onProgress?.(pct);
      }
    },
  );
  const result = await downloadResumable.downloadAsync();
  return result?.status === 200;
};

// iOS fallback: XHR + blob, written out as base64. Holds the whole file in
// memory, so it is only used if the native download fails.
const downloadViaXhr = async (
  url: string,
  destPath: string,
  onProgress?: (progress: number) => void,
): Promise<boolean> => {
  const base64 = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "blob";

    xhr.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`HTTP ${xhr.status}`));
        return;
      }
      const blob = xhr.response as Blob;
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve((reader.result as string).split(",")[1]);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    };

    xhr.onerror = () => reject(new Error("XHR network error"));
    xhr.send();
  });

  await FileSystem.writeAsStringAsync(destPath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return true;
};

// An EPUB is a zip archive, so a good download starts with "PK". Anything
// else (an HTML error page, an empty or cut-off file) would leave the reader
// stuck on "Opening...".
const isValidEpubFile = async (path: string) => {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || !info.size || info.size < 1024) return false;
    const head = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 4,
    });
    return head.startsWith("UEs"); // base64 of "PK"
  } catch {
    return false;
  }
};

/**
 * Downloads into a temp file and only moves it to `destPath` once it is
 * complete (and, for EPUBs, verified), so a failed download never leaves a
 * broken book behind.
 */
const downloadFileWithProgress = async (
  url: string,
  destPath: string,
  onProgress?: (progress: number) => void,
  { isEpub = false } = {},
): Promise<boolean> => {
  const tempPath = destPath + ".part";
  const isGood = async () => {
    if (isEpub) return isValidEpubFile(tempPath);
    const info = await FileSystem.getInfoAsync(tempPath);
    return info.exists && !!info.size;
  };
  const attempts =
    Platform.OS === "ios" ? [downloadNative, downloadViaXhr] : [downloadNative];

  for (const attempt of attempts) {
    try {
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
      onProgress?.(0);
      if ((await attempt(url, tempPath, onProgress)) && (await isGood())) {
        await FileSystem.deleteAsync(destPath, { idempotent: true });
        await FileSystem.moveAsync({ from: tempPath, to: destPath });
        return true;
      }
    } catch (e) {
      console.warn("Download attempt failed:", url, e);
    }
  }
  await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
  return false;
};

// Project Gutenberg offers each book as an illustrated EPUB and a smaller
// text-only one; this maps the illustrated URL to the text-only one.
const textOnlyEpubUrl = (url: string) => {
  const textOnly = url.replace(/\.epub3?\.images$/, ".epub.noimages");
  return textOnly !== url ? textOnly : null;
};

export const LibraryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  // Always-current copy for async flows (imports) that outlive a render.
  const savedBooksRef = useRef<SavedBook[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [activeDownload, setActiveDownload] = useState<any | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    loadLibrary();
    checkNetwork();
  }, []);

  const checkNetwork = async () => {
    const status = await Network.getNetworkStateAsync();
    setIsOffline(!status.isConnected);
  };

  const loadLibrary = async () => {
    try {
      const stored = await AsyncStorage.getItem("@vellum_lib_v10");
      if (stored) {
        const parsed: SavedBook[] = JSON.parse(stored);
        const needsMigration = parsed.some((b) => !b.snippets);
        const books: SavedBook[] = parsed.map(migrateSnippets).map((b) =>
          isImportedBook(b.book)
            ? {
                ...b,
                localUri: rebaseImportPath(b.localUri),
                book: {
                  ...b.book,
                  formats: b.book.formats["image/jpeg"]
                    ? {
                        "image/jpeg": rebaseImportPath(
                          b.book.formats["image/jpeg"],
                        ),
                      }
                    : {},
                },
              }
            : b,
        );
        savedBooksRef.current = books;
        setSavedBooks(books);
        if (needsMigration) {
          await AsyncStorage.setItem("@vellum_lib_v10", JSON.stringify(books));
        }
      }
    } catch (e) {
    } finally {
      setIsLoaded(true);
    }
  };

  const persist = async (newData: SavedBook[]) => {
    savedBooksRef.current = newData;
    setSavedBooks(newData);
    await AsyncStorage.setItem("@vellum_lib_v10", JSON.stringify(newData));
  };

  const startDownload = async (book: any, { textOnly = false } = {}) => {
    if (activeDownload) return;
    setActiveDownload(book);
    setDownloadProgress(0);

    try {
      const booksDir =
        Platform.OS === "android"
          ? FileSystem.cacheDirectory + "VellumLibrary/"
          : FileSystem.documentDirectory + "VellumLibrary/";

      const dirInfo = await FileSystem.getInfoAsync(booksDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(booksDir, { intermediates: true });
      }

      const safeTitle = book.title
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()
        .substring(0, 30);

      // ── EPUB download ──
      // Illustrated edition first; if it fails (or the reader asked for it),
      // fall back to the smaller text-only edition.
      const epubUrl: string | undefined = book.formats["application/epub+zip"];
      const textOnlyUrl = epubUrl ? textOnlyEpubUrl(epubUrl) : null;
      const epubUrls = [
        ...(epubUrl && !(textOnly && textOnlyUrl) ? [epubUrl] : []),
        ...(textOnlyUrl ? [textOnlyUrl] : []),
      ];
      let epubUri: string | undefined = undefined;

      for (const url of epubUrls) {
        const epubPath = booksDir + `${safeTitle}_${book.id}.epub`;
        const success = await downloadFileWithProgress(
          url,
          epubPath,
          (p) => {
            // epub is the primary format — map its progress to 0–0.85
            setDownloadProgress(p * 0.85);
          },
          { isEpub: true },
        );
        if (success) {
          epubUri = epubPath;
          break;
        }
      }

      // ── HTML fallback download ──
      const htmlUrl =
        book.formats["text/html"] || book.formats["text/html; charset=utf-8"];
      let htmlUri = undefined;

      if (htmlUrl) {
        const htmlPath = booksDir + `${safeTitle}_${book.id}.html`;
        const success = await downloadFileWithProgress(
          htmlUrl,
          htmlPath,
          (p) => {
            // If epub already downloaded, html is the remaining 15%; otherwise full range
            const base = epubUri ? 0.85 : 0;
            const range = epubUri ? 0.15 : 1;
            setDownloadProgress(base + p * range);
          },
        );
        if (success) htmlUri = htmlPath;
      }

      // A failed re-download leaves the previous copy untouched — keep it if
      // it is still good.
      const previous = savedBooksRef.current.find((b) => b.id === book.id);
      if (!epubUri && previous?.localUri && (await isValidEpubFile(previous.localUri))) {
        epubUri = previous.localUri;
      }
      if (!htmlUri && previous?.readerUri) {
        const info = await FileSystem.getInfoAsync(previous.readerUri);
        if (info.exists) htmlUri = previous.readerUri;
      }

      if (!epubUri && !htmlUri) {
        throw new Error("No files downloaded");
      }

      setDownloadProgress(1);

      // Record exactly the files we have now: an older path may point at a
      // file that no longer exists, which would leave the reader stuck.
      await persist(
        previous
          ?savedBooksRef.current.map((b) =>
              b.id === book.id
                ? { ...b, status: "reading", localUri: epubUri, readerUri: htmlUri }
                : b,
            )
          : [
              ...savedBooksRef.current,
              {
                id: book.id,
                book,
                status: "reading",
                notes: "",
                dateAdded: Date.now(),
                localUri: epubUri,
                readerUri: htmlUri,
              },
            ],
      );

      setTimeout(() => triggerAppRating(), 1500);

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Book Ready",
            body: `${book.title} is ready to read.`,
          },
          trigger: null,
        });
      } catch {}
    } catch (e: any) {
      console.error("Download failed:", e);
    } finally {
      setActiveDownload(null);
      setDownloadProgress(0);
    }
  };

  const saveBook = async (
    book: any,
    status: BookStatus = "toread",
    localUri?: string,
    readerUri?: string,
  ) => {
    const existingIndex = savedBooks.findIndex((b) => b.id === book.id);
    let newBooks = [...savedBooks];

    if (existingIndex >= 0) {
      newBooks[existingIndex] = {
        ...newBooks[existingIndex],
        status,
        localUri: localUri || newBooks[existingIndex].localUri,
        readerUri: readerUri || newBooks[existingIndex].readerUri,
      };
    } else {
      newBooks.push({
        id: book.id,
        book,
        status,
        notes: "",
        dateAdded: Date.now(),
        localUri,
        readerUri,
      });
    }
    await persist(newBooks);
  };

  const removeBook = async (id: number) => {
    const bookToRemove = savedBooks.find((b) => b.id === id);
    if (bookToRemove) {
      try {
        const coverUri = bookToRemove.book?.formats?.["image/jpeg"];
        if (isImportedBook(bookToRemove.book) && coverUri) {
          await FileSystem.deleteAsync(coverUri, { idempotent: true });
        }
        if (bookToRemove.localUri) {
          const fileInfo = await FileSystem.getInfoAsync(bookToRemove.localUri);
          if (fileInfo.exists)
            await FileSystem.deleteAsync(bookToRemove.localUri);
        }
        if (bookToRemove.readerUri) {
          const fileInfo = await FileSystem.getInfoAsync(
            bookToRemove.readerUri,
          );
          if (fileInfo.exists)
            await FileSystem.deleteAsync(bookToRemove.readerUri);
        }
      } catch (e) {}
    }
    await persist(savedBooks.filter((b) => b.id !== id));
  };

  const updateStatus = async (id: number, status: BookStatus) => {
    const updated = savedBooks.map((b) => (b.id === id ? { ...b, status } : b));
    await persist(updated);
  };

  const updateNotes = async (id: number, notes: string) => {
    const updated = savedBooks.map((b) => (b.id === id ? { ...b, notes } : b));
    await persist(updated);
  };

  const updateLocation = async (id: number, cfi: string) => {
    const updated = savedBooks.map((b) =>
      b.id === id ? { ...b, lastLocation: cfi } : b,
    );
    await persist(updated);
  };

  const addSnippet = async (
    id: number,
    text: string,
    cfi?: string,
    color?: string,
  ) => {
    const clean = text.trim();
    if (!clean || !savedBooksRef.current.some((b) => b.id === id)) return null;
    const snippet: Snippet = {
      id: `${id}-${Date.now()}`,
      text: clean,
      cfi,
      createdAt: Date.now(),
      ...(color ? { color } : {}),
    };
    await persist(
      savedBooksRef.current.map((b) =>
        b.id === id ? { ...b, snippets: [...(b.snippets || []), snippet] } : b,
      ),
    );
    return snippet;
  };

  const updateSnippetColor = async (
    id: number,
    snippetId: string,
    color?: string,
  ) => {
    await persist(
      savedBooksRef.current.map((b) =>
        b.id === id
          ? {
              ...b,
              snippets: (b.snippets || []).map((s) =>
                s.id === snippetId ? { ...s, color } : s,
              ),
            }
          : b,
      ),
    );
  };

  const removeSnippet = async (id: number, snippetId: string) => {
    await persist(
      savedBooksRef.current.map((b) =>
        b.id === id
          ? { ...b, snippets: (b.snippets || []).filter((s) => s.id !== snippetId) }
          : b,
      ),
    );
  };

  const checkBookStatus = (id: number) => savedBooks.find((b) => b.id === id);

  // ── Local EPUB import ──────────────────────────────────────────────────────
  // Copies a user's EPUB into app storage and adds it to the library. Nothing
  // is uploaded; metadata and cover are read from the file on-device.
  const lastImportId = useRef(0);
  const importBook = async (sourceUri: string, fileName?: string) => {
    const name = fileName || fileNameFromUri(sourceUri);
    try {
      const base64 = await readExternalEpub(sourceUri);
      const meta = await parseEpub(base64);

      // Same book imported again → reopen the existing entry, keeping progress.
      const key = importKey(meta, name);
      const existing = savedBooksRef.current.find(
        (b) => isImportedBook(b.book) && b.book.localKey === key,
      );
      if (existing?.localUri) {
        const info = await FileSystem.getInfoAsync(existing.localUri);
        if (info.exists) return existing;
      }

      // Negative ids can never collide with Project Gutenberg ids.
      const id = Math.min(-Date.now(), lastImportId.current - 1);
      lastImportId.current = id;

      const { epubUri, coverUri } = await writeImportedFiles(id, base64, meta);
      const book = buildImportedBook(id, meta, name, coverUri);

      let entry: SavedBook;
      let newBooks: SavedBook[];
      if (existing) {
        // Entry exists but its file went missing — restore the file in place.
        entry = {
          ...existing,
          localUri: epubUri,
          book: { ...book, id: existing.id },
        };
        newBooks = savedBooksRef.current.map((b) =>
          b.id === existing.id ? entry : b,
        );
      } else {
        entry = {
          id,
          book,
          status: "toread",
          notes: "",
          dateAdded: Date.now(),
          localUri: epubUri,
        };
        newBooks = [...savedBooksRef.current, entry];
      }
      await persist(newBooks);
      return entry;
    } finally {
      await cleanupInboxCopy(sourceUri);
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        savedBooks,
        isLoaded,
        activeDownload,
        downloadProgress,
        saveBook,
        removeBook,
        updateStatus,
        updateNotes,
        isOffline,
        checkBookStatus,
        startDownload,
        updateLocation,
        importBook,
        addSnippet,
        updateSnippetColor,
        removeSnippet,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
