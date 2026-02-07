import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export const ReaderPopup = ({
  data,
  onSave,
  onDownload,
  onClose,
  downloading,
  downloadProgress,
}: any) => {
  if (!data) return null;

  const isDownloading = data.type === "downloading" || downloading;
  const progressPercent = Math.round((downloadProgress || 0) * 100);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>
            {isDownloading
              ? "DOWNLOADING DICTIONARY"
              : data.type === "definition"
                ? "DICTIONARY"
                : "SAVE SNIPPET"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={24} color="#444" />
          </TouchableOpacity>
        </View>

        {/* Scrollable content area */}
        <ScrollView style={styles.content} bounces={false}>
          {isDownloading ? (
            <View>
              <View style={styles.downloadContainer}>
                <ActivityIndicator color="#2DDA93" size="small" />
                <Text style={styles.downloadText}>
                  {progressPercent > 0
                    ? `Downloading... ${progressPercent}%`
                    : "Starting download..."}
                </Text>
              </View>
              {progressPercent > 0 && (
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
              )}
              {data.word && (
                <Text style={styles.downloadHint}>
                  Will show meaning for "{data.word}" when complete
                </Text>
              )}
            </View>
          ) : data.type === "definition" || data.type === "prompt_download" ? (
            <View>
              <Text style={styles.wordTitle}>{data.word?.toUpperCase()}</Text>
              <Text style={styles.definitionText}>{data.content}</Text>
              {data.justDownloaded && (
                <Text style={styles.downloadedBadge}>✓ Dictionary ready</Text>
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.snippetPreview}>"{data.content}"</Text>
            </View>
          )}
        </ScrollView>

        {/* Fixed action buttons - always visible at bottom, outside ScrollView */}
        {!isDownloading && (
          <View style={styles.actionArea}>
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
                <Text style={styles.saveBtnText}>Save to Library Notes</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 9999,
    elevation: 10,
  },
  sheet: {
    backgroundColor: "#161616",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "50%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    color: "#2DDA93",
    fontWeight: "bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  content: { flexShrink: 1 },
  wordTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  definitionText: { color: "#BBB", fontSize: 15, lineHeight: 22 },
  snippetPreview: {
    color: "#FFF",
    fontSize: 14,
    backgroundColor: "#000",
    padding: 12,
    borderRadius: 8,
  },
  // Fixed action area - never scrolls away
  actionArea: {
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#222",
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
  downloadText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  progressBarBg: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2DDA93",
    borderRadius: 3,
  },
  downloadHint: { color: "#888", fontSize: 13, fontStyle: "italic" },
  downloadedBadge: {
    color: "#2DDA93",
    fontSize: 13,
    marginTop: 10,
    fontWeight: "600",
  },
});
