import { Reader } from "@epubjs-react-native/core";
import React from "react";

/**
 * JavaScript injected into the epub WebView to handle internal link clicks.
 * epub.js renders content inside an iframe — the template's rendition object
 * handles navigation. We intercept anchor clicks so TOC links, footnotes,
 * cross-references, etc. navigate within the book instead of being swallowed.
 */
const LINK_HANDLER_JS = `
(function() {
  function attachLinkHandler(doc) {
    doc.addEventListener('click', function(e) {
      var target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (target && target.tagName === 'A') {
        var href = target.getAttribute('href');
        if (!href) return;
        // Skip external links and mailto
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) return;
        e.preventDefault();
        e.stopPropagation();
        // Use epub.js rendition to navigate internally
        if (typeof rendition !== 'undefined' && rendition.display) {
          rendition.display(href);
        }
      }
    }, true);
  }
  // Attach to main document
  attachLinkHandler(document);
  // Also attach when epub.js renders content into iframes
  if (typeof rendition !== 'undefined') {
    rendition.on('rendered', function(section) {
      try {
        var contents = section.document || (section.contents && section.contents.document);
        if (contents) attachLinkHandler(contents);
      } catch(e) {}
    });
  }
})();
`;

export const MemoizedReader = React.memo(
  ({
    src,
    fileSystem,
    onLocationChange,
    onSelected,
    onLocationsReady,
    defaultTheme,
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
        allowPopups={true}
        allowScriptedContent={true}
        injectedJavascript={LINK_HANDLER_JS}
      />
    );
  },
  (prev, next) => {
    // ONLY re-render if the source file changes.
    // This is the ONLY way to prevent the "Reset to Page 1" bug.
    return prev.src === next.src;
  },
);
