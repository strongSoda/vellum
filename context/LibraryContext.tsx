import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system'; // Strict New API for Downloads
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Types
type BookStatus = 'toread' | 'reading' | 'completed';
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

// FIX: Wrap handler setup to prevent Expo Go crashes
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
} catch (e) { console.log("Notifications not supported in this environment"); }

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
      const stored = await AsyncStorage.getItem('@vellum_lib_v10');
      if (stored) setSavedBooks(JSON.parse(stored));
    } catch (e) { console.error(e); }
  };

  const persist = async (newData: SavedBook[]) => {
    setSavedBooks(newData);
    await AsyncStorage.setItem('@vellum_lib_v10', JSON.stringify(newData));
  };

  const startDownload = async (book: any) => {
    if (activeDownload) return;
    setActiveDownload(book);

    try {
      // 1. Setup Directory
      const booksDir = new Directory(Paths.document, 'VellumLibrary');
      if (!booksDir.exists) booksDir.create();
      
      const safeTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);

      // 2. Download EPUB
      const epubUrl = book.formats['application/epub+zip'];
      let epubUri = undefined;
      if (epubUrl) {
          const epubFile = new File(booksDir, `${safeTitle}_${book.id}.epub`);
          if (epubFile.exists) epubFile.delete(); // Clean up old file
          const result = await File.downloadFileAsync(epubUrl, epubFile);
          epubUri = result.uri;
      }

      // 3. Download HTML (Crucial for Reader)
      const htmlUrl = book.formats['text/html'] || book.formats['text/html; charset=utf-8'];
      let htmlUri = undefined;
      if (htmlUrl) {
          const htmlFile = new File(booksDir, `${safeTitle}_${book.id}.html`);
          if (htmlFile.exists) htmlFile.delete();
          const result = await File.downloadFileAsync(htmlUrl, htmlFile);
          htmlUri = result.uri;
      }

      // 4. Save to Library
      await saveBook(book, 'reading', epubUri, htmlUri);

      // FIX: Safe Notification Trigger
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: "Book Ready", body: `${book.title} is ready to read.` },
          trigger: null,
        });
      } catch (error) {
        console.log("Notification failed (Expected in Expo Go)");
      }

    } catch (e) {
      console.error("Download failed", e);
    } finally {
      setActiveDownload(null);
    }
  };

  const saveBook = async (book: any, status: BookStatus = 'toread', localUri?: string, readerUri?: string) => {
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
