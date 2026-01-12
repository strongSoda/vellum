import * as FileSystem from 'expo-file-system/legacy';

const DICT_URL = 'https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/refs/heads/master/dictionary.json'; // Replace with your URL
const DICT_PATH = `${FileSystem.documentDirectory}dictionary.json`;

export const getLocalDefinition = async (word: string) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(DICT_PATH);
    if (!fileInfo.exists) return 'NOT_DOWNLOADED';

    // Read and parse the local file
    const content = await FileSystem.readAsStringAsync(DICT_PATH);
    const dict = JSON.parse(content);
    return dict[word.toLowerCase()] || 'NOT_FOUND';
  } catch (e) {
    return 'ERROR';
  }
};

export const downloadDictionary = async (onProgress: (p: number) => void) => {
  const downloadResumable = FileSystem.createDownloadResumable(
    DICT_URL,
    DICT_PATH,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      onProgress(progress);
    }
  );
  return await downloadResumable.downloadAsync();
};
