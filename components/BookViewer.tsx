import { useEffect, useRef, useState } from "react";
import { DetailsModal } from "./DetailsModal";
import { EpubReaderModal } from "./EpubReader";
import { ReaderModal } from "./Reader";

/**
 * Book details plus the readers it can open. The parent only tracks which
 * book is selected; this keeps the book around while the details modal
 * closes and a reader slides in (iOS presents one modal at a time).
 */
export const BookViewer = ({
  book,
  onClose,
}: {
  book: any | null;
  onClose: () => void;
}) => {
  const lastBook = useRef<any>(null);
  useEffect(() => {
    if (book) lastBook.current = book;
  }, [book]);

  const [htmlReader, setHtmlReader] = useState<{ book: any; uri: string } | null>(null);
  const [htmlVisible, setHtmlVisible] = useState(false);
  const [epubReader, setEpubReader] = useState<{ book: any; uri: string } | null>(null);
  const [epubVisible, setEpubVisible] = useState(false);

  const openHtml = (uri: string) => {
    setHtmlReader({ book: lastBook.current, uri });
    onClose();
    setTimeout(() => setHtmlVisible(true), 300);
  };

  const openEpub = (uri: string) => {
    setEpubReader({ book: lastBook.current, uri });
    onClose();
    setTimeout(() => setEpubVisible(true), 600);
  };

  return (
    <>
      <DetailsModal
        book={book}
        visible={!!book}
        onClose={onClose}
        onRead={openHtml}
        onReadEpub={openEpub}
      />

      <ReaderModal
        visible={htmlVisible}
        book={htmlReader?.book}
        localUri={htmlReader?.uri}
        onClose={() => setHtmlVisible(false)}
      />

      <EpubReaderModal
        visible={epubVisible}
        book={epubReader?.book}
        epubUri={epubReader?.uri}
        onClose={() => {
          setEpubVisible(false);
          setTimeout(() => setEpubReader(null), 500);
        }}
      />
    </>
  );
};
