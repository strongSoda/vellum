import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import React, { createContext, useContext, useEffect, useState } from 'react';
// FIX: Specific import for legacy delete to avoid crash
import { Directory, File, Paths } from 'expo-file-system';
import { deleteAsync } from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';

// Types
type BookStatus = 'to read' | 'reading' | 'completed';
export type SavedBook = {
  id: number;
  book: any;
  status: BookStatus;
  notes: string;
  dateAdded: number;
  localUri?: string;
  readerUri?: string;
};

type LibraryContextType = {
  savedBooks: SavedBook[];
  activeDownload: any | null;
  isOffline: boolean;
  saveBook: (book: any, status?: BookStatus, localUri?: string, readerUri?: string) => Promise<void>;
  removeBook: (id: number) => Promise<void>;
  updateStatus: (id: number, status: BookStatus) => Promise<void>;
  updateNotes: (id: number, notes: string) => Promise<void>;
  checkBookStatus: (id: number) => SavedBook | undefined;
  startDownload: (book: any) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextType>({} as any);

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export const LibraryProvider = ({ children }: { children: React.ReactNode }) => {
  const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [activeDownload, setActiveDownload] = useState<any | null>(null);

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
      const stored = await AsyncStorage.getItem('@vellum_library_v6');
      if (stored) setSavedBooks(JSON.parse(stored));
    } catch (e) { console.error(e); }
  };

  const persist = async (newData: SavedBook[]) => {
    setSavedBooks(newData);
    await AsyncStorage.setItem('@vellum_library_v6', JSON.stringify(newData));
  };

  const startDownload = async (book: any) => {
    if (activeDownload) return;
    setActiveDownload(book);

    try {
      const booksDir = new Directory(Paths.document, 'VellumLibrary');
      if (!booksDir.exists) await booksDir.create();
      
      const safeTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);

      // 1. Download EPUB
      const epubUrl = book.formats['application/epub+zip'];
      let epubUri = undefined;
      
      if (epubUrl) {
          const epubFile = new File(booksDir, `${safeTitle}_${book.id}.epub`);
          // Legacy delete to prevent "Destination exists" error
          await deleteAsync(epubFile.uri, { idempotent: true });
          
          const res = await File.downloadFileAsync(epubUrl, epubFile);
          epubUri = res.uri;
      }

      // 2. Download HTML
      const htmlUrl = book.formats['text/html'] || book.formats['text/html; charset=utf-8'];
      let htmlUri = undefined;
      
      if (htmlUrl) {
          const htmlFile = new File(booksDir, `${safeTitle}_${book.id}.html`);
          await deleteAsync(htmlFile.uri, { idempotent: true });
          
          const res = await File.downloadFileAsync(htmlUrl, htmlFile);
          htmlUri = res.uri;
      }

      await saveBook(book, 'reading', epubUri, htmlUri);

      await Notifications.scheduleNotificationAsync({
        content: { title: "Book Ready", body: `${book.title} is ready to read.` },
        trigger: null,
      });

    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setActiveDownload(null);
    }
  };

  const saveBook = async (book: any, status: BookStatus = 'to read', localUri?: string, readerUri?: string) => {
    const existingIndex = savedBooks.findIndex(b => b.id === book.id);
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
            id: book.id, book, status, notes: '', dateAdded: Date.now(),
            localUri, readerUri
        });
    }
    await persist(newBooks);
  };

  const removeBook = async (id: number) => {
    await persist(savedBooks.filter(b => b.id !== id));
  };

  const updateStatus = async (id: number, status: BookStatus) => {
    const updated = savedBooks.map(b => b.id === id ? { ...b, status } : b);
    await persist(updated);
  };

  const updateNotes = async (id: number, notes: string) => {
    const updated = savedBooks.map(b => b.id === id ? { ...b, notes } : b);
    await persist(updated);
  };

  const checkBookStatus = (id: number) => savedBooks.find(b => b.id === id);

  return (
    <LibraryContext.Provider value={{ savedBooks, activeDownload, saveBook, removeBook, updateStatus, updateNotes, isOffline, checkBookStatus, startDownload }}>
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => useContext(LibraryContext);
