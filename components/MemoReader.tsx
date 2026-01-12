import { Reader } from '@epubjs-react-native/core';
import React from 'react';

export const MemoizedReader = React.memo(({ 
  src, 
  fileSystem, 
  onLocationChange, 
  onSelected,
  onLocationsReady,
  defaultTheme 
}: any) => {
  return (
    <Reader
      src={src}
      fileSystem={fileSystem}
      onLocationChange={onLocationChange}
      onSelected={onSelected}
      onLocationsReady={onLocationsReady}
      defaultTheme={defaultTheme}
      enableSelection={true}
      allowPopups={true} // Enables internal links/anchors
      allowScriptedContent={true}
    />
  );
}, (prev, next) => {
  // ONLY re-render if the source file changes.
  // This is the ONLY way to prevent the "Reset to Page 1" bug.
  return prev.src === next.src;
});