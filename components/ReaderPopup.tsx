import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ReaderTheme } from "../constants/ReaderThemes";

export const ReaderPopup = ({
  data,
  onSave,
  onDownload,
  onClose,
  downloading,
  downloadProgress,
  theme,
}: any) => {
  if (!data) return null;
  const t: ReaderTheme = theme;

  const isDownloading = data.type === "downloading" || downloading;
  const progressPercent = Math.round((downloadProgress || 0) * 100);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Tap-outside-to-dismiss backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Sheet now drops from the TOP so it sits above OS selection handles */}
      <View style={[styles.sheet, { backgroundColor: t.chrome }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.link }]}>
            {isDownloading
              ? "DOWNLOADING DICTIONARY"
              : data.type === "definition"
                ? "DICTIONARY"
                : "SAVE SNIPPET"}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close-circle" size={24} color={t.muted} />
          </TouchableOpacity>
        </View>

        {/* Scrollable content area */}
        <ScrollView style={styles.content} bounces={false}>
          {isDownloading ? (
            <View>
              <View style={styles.downloadContainer}>
                <ActivityIndicator color={t.link} size="small" />
                <Text style={[styles.downloadText, { color: t.text }]}>
                  {progressPercent > 0
                    ? `Downloading... ${progressPercent}%`
                    : "Starting download..."}
                </Text>
              </View>
              {progressPercent > 0 && (
                <View style={[styles.progressBarBg, { backgroundColor: t.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
              )}
              {data.word && (
                <Text style={[styles.downloadHint, { color: t.muted }]}>
                  Will show meaning for “{data.word}” when complete
                </Text>
              )}
            </View>
          ) : data.type === "definition" || data.type === "prompt_download" ? (
            <View>
              <Text style={[styles.wordTitle, { color: t.text }]}>{data.word?.toUpperCase()}</Text>
              <Text style={[styles.definitionText, { color: t.text }]}>{data.content}</Text>
              {data.justDownloaded && (
                <Text style={[styles.downloadedBadge, { color: t.link }]}>✓ Dictionary ready</Text>
              )}
            </View>
          ) : (
            <View>
              <Text
                style={[
                  styles.snippetPreview,
                  { color: t.text, backgroundColor: t.background, borderColor: t.border },
                ]}
              >
                “{data.content}”
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Fixed action buttons - always visible at bottom, outside ScrollView */}
        {!isDownloading && (
          <View style={[styles.actionArea, { borderTopColor: t.border }]}>
            {data.type === "prompt_download" ? (
              <TouchableOpacity style={styles.saveBtn} onPress={onDownload}>
                <Text style={styles.saveBtnText}>
                  Download Dictionary (8MB)
                </Text>
              </TouchableOpacity>
            ) : data.type === "snippet" ? (
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => onSave(data.content)}
              >
                <Text style={styles.saveBtnText}>Save Snippet</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={[styles.handle, { backgroundColor: t.border }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end", // ← top-aligned instead of flex-end
    zIndex: 9999,
    elevation: 10,
  },
  sheet: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    paddingTop: 12,
    maxHeight: "50%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontWeight: "bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  content: { flexShrink: 1 },
  wordTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  definitionText: { fontSize: 15, lineHeight: 22, opacity: 0.85 },
  snippetPreview: {
    fontSize: 14,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
  },
  // Fixed action area - never scrolls away
  actionArea: {
    paddingTop: 15,
    borderTopWidth: 1,
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: "#2DDA93",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#000", fontWeight: "bold" },
  // Download progress styles
  downloadContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  downloadText: { fontSize: 16, fontWeight: "600" },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2DDA93",
    borderRadius: 3,
  },
  downloadHint: { fontSize: 13, fontStyle: "italic" },
  downloadedBadge: {
    fontSize: 13,
    marginTop: 10,
    fontWeight: "600",
  },
});
