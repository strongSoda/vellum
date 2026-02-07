import { Reader } from "@epubjs-react-native/core";
import React from "react";

/**
 * JavaScript injected into the epub WebView after the book is ready.
 *
 * WHY THIS APPROACH:
 * The library's template.ts creates `book` and `rendition` as globals in the
 * outer WebView document. epub.js renders each chapter inside a sandboxed iframe.
 * Link clicks happen INSIDE the iframe — normal document-level click listeners
 * on the outer document never see them.
 *
 * SOLUTION:
 * epub.js provides `rendition.hooks.content.register(fn)` — an official hook that
 * fires with each Content object when a new section is rendered into a view.
 * The Content object exposes `.document` — the iframe's document, which is
 * same-origin accessible. We attach a capturing click listener there to intercept
 * internal link clicks (TOC refs, footnotes, cross-references) and route them
 * through `rendition.display(href)` for proper epub-internal navigation.
 *
 * TRIPLE STRATEGY:
 * 1. rendition.hooks.content.register() — catches all future section renders
 * 2. rendition.on('rendered') + getContents() — fallback for edge cases
 * 3. Immediate getContents() scan — catches the first section already rendered
 *    before this script is injected (injectedJavascript runs on 'onReady')
 *
 * The script MUST end with `true;` — react-native-webview requirement.
 */
const LINK_HANDLER_JS = `
(function() {
  if (typeof rendition === 'undefined') return;

  function attachLinkHandler(contents) {
    var doc;
    if (contents && contents.document) {
      doc = contents.document;
    } else if (contents && contents.querySelectorAll) {
      doc = contents;
    }
    if (!doc) return;
    if (doc._vellumLinksHandled) return;
    doc._vellumLinksHandled = true;

    doc.addEventListener('click', function(e) {
      var el = e.target;
      while (el && el.tagName !== 'A') {
        el = el.parentElement;
      }
      if (!el) return;

      var href = el.getAttribute('href');
      if (!href) return;

      // Skip external links, mailto, tel — let onPressExternalLink handle those
      if (/^(https?:\\/\\/|mailto:|tel:)/.test(href)) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        rendition.display(href);
      } catch(err) {
        // Fallback: try relative to current section
        try {
          var current = rendition.currentLocation();
          if (current && current.start && current.start.href) {
            var base = current.start.href.replace(/[^\\/]*$/, '');
            rendition.display(base + href);
          }
        } catch(e2) {}
      }
    }, true);
  }

  // 1. Hook into future content renders (epub.js official hook)
  if (rendition.hooks && rendition.hooks.content) {
    rendition.hooks.content.register(function(contents) {
      attachLinkHandler(contents);
    });
  }

  // 2. Fallback: re-attach on every 'rendered' event
  rendition.on('rendered', function() {
    try {
      var allContents = rendition.getContents();
      if (allContents && allContents.forEach) {
        allContents.forEach(function(c) { attachLinkHandler(c); });
      }
    } catch(e) {}
  });

  // 3. Immediate: handle already-rendered first section
  try {
    var existing = rendition.getContents();
    if (existing && existing.forEach) {
      existing.forEach(function(c) { attachLinkHandler(c); });
    }
  } catch(e) {}
})();
true;
`;

export const MemoizedReader = React.memo(
  ({
    src,
    fileSystem,
    onLocationChange,
    onSelected,
    onLocationsReady,
    defaultTheme,
    onPressExternalLink,
    onFinish,
    onBeginning,
    onNavigationLoaded,
    onChangeSection,
    onSingleTap,
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
        onPressExternalLink={onPressExternalLink}
        onFinish={onFinish}
        onBeginning={onBeginning}
        onNavigationLoaded={onNavigationLoaded}
        onChangeSection={onChangeSection}
        onSingleTap={onSingleTap}
      />
    );
  },
  (prev, next) => {
    // ONLY re-render if the source file changes.
    // This prevents the "reset to page 1" bug.
    // All callbacks are stable refs — the library's View.js captures them on mount.
    return prev.src === next.src;
  },
);
