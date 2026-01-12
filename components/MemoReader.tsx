import { Reader } from '@epubjs-react-native/core';
import React from 'react';

// This component only updates if the epubUri changes
export const MemoizedReader = React.memo(({ src, fileSystem, onSelected, defaultTheme }: any) => {
  return (
    <Reader
      src={src}
      fileSystem={fileSystem}
      enableSelection={true}
      onSelected={onSelected}
      defaultTheme={defaultTheme}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if the source file itself changes (switching books)
  return prevProps.src === nextProps.src;
});
