import { triggerAppRating } from '@/utils/Ratings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

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

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
} catch (e) {}

const downloadFileDirectly = async (url: string, destPath: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      // Android: downloadAsync to cache directory
      const result = await FileSystem.downloadAsync(url, destPath);
      return result.status === 200;
    } else {
      // iOS: KEEP EXACT WORKING CODE
      const response = await fetch(url);
      if (!response.ok) return false;
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await FileSystem.writeAsStringAsync(destPath, base64, { encoding: FileSystem.EncodingType.Base64 });
      return true;
    }
  } catch {
    return false;
  }
};


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
    } catch (e) {}
  };

  const persist = async (newData: SavedBook[]) => {
    setSavedBooks(newData);
    await AsyncStorage.setItem('@vellum_lib_v10', JSON.stringify(newData));
  };

  const startDownload = async (book: any) => {
    if (activeDownload) return;
    setActiveDownload(book);

    try {
      const booksDir = Platform.OS === 'android'
  ? FileSystem.cacheDirectory + 'VellumLibrary/'
  : FileSystem.documentDirectory + 'VellumLibrary/';
      
      const dirInfo = await FileSystem.getInfoAsync(booksDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(booksDir, { intermediates: true });
      }
      
      const safeTitle = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);

      const epubUrl = book.formats['application/epub+zip'];
      let epubUri = undefined;
      
      if (epubUrl) {
        const epubPath = booksDir + `${safeTitle}_${book.id}.epub`;
        const epubInfo = await FileSystem.getInfoAsync(epubPath);
        if (epubInfo.exists) await FileSystem.deleteAsync(epubPath);
        
        const success = await downloadFileDirectly(epubUrl, epubPath);
        if (success) epubUri = epubPath;
      }

      const htmlUrl = book.formats['text/html'] || book.formats['text/html; charset=utf-8'];
      let htmlUri = undefined;
      
      if (htmlUrl) {
        const htmlPath = booksDir + `${safeTitle}_${book.id}.html`;
        const htmlInfo = await FileSystem.getInfoAsync(htmlPath);
        if (htmlInfo.exists) await FileSystem.deleteAsync(htmlPath);
        
        const success = await downloadFileDirectly(htmlUrl, htmlPath);
        if (success) htmlUri = htmlPath;
      }

      if (!epubUri && !htmlUri) {
        throw new Error('No files downloaded');
      }

      await saveBook(book, 'reading', epubUri, htmlUri);

      console.log('book, reading, epubUri, htmlUri', book, 'reading', epubUri, htmlUri);
      

      setTimeout(() => triggerAppRating(), 1500);

      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: "Book Ready", body: `${book.title} is ready to read.` },
          trigger: null,
        });
      } catch {}

    } catch (e: any) {
      console.error('Download failed:', e);
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
    const bookToRemove = savedBooks.find(b => b.id === id);
    if (bookToRemove) {
      try {
        if (bookToRemove.localUri) {
          const fileInfo = await FileSystem.getInfoAsync(bookToRemove.localUri);
          if (fileInfo.exists) await FileSystem.deleteAsync(bookToRemove.localUri);
        }
        if (bookToRemove.readerUri) {
          const fileInfo = await FileSystem.getInfoAsync(bookToRemove.readerUri);
          if (fileInfo.exists) await FileSystem.deleteAsync(bookToRemove.readerUri);
        }
      } catch (e) {}
    }
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
