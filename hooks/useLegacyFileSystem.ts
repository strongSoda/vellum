import * as FileSystem from 'expo-file-system/legacy';

export const useLegacyFileSystem = () => {
  return {
    documentDirectory: FileSystem.documentDirectory,
    cacheDirectory: FileSystem.cacheDirectory,
    writeAsStringAsync: FileSystem.writeAsStringAsync,
    readAsStringAsync: FileSystem.readAsStringAsync,
    deleteAsync: FileSystem.deleteAsync,
    getInfoAsync: FileSystem.getInfoAsync,
    makeDirectoryAsync: FileSystem.makeDirectoryAsync,
    downloadAsync: FileSystem.downloadAsync,
    // The library specifically looks for this method to handle remote EPUBs
    downloadFile: async (url: string, filename: string) => {
      const path = `${FileSystem.documentDirectory}${filename}`;
      const result = await FileSystem.downloadAsync(url, path);
      return { uri: result.uri };
    }
  };
};
