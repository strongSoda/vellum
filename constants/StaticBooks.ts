import { VOLUME_1 } from './books/volume1.ts';
import { VOLUME_2 } from './books/volume2.ts';
import { VOLUME_3 } from './books/volume3.ts';
// Add more imports as you create more files:

export const STATIC_BOOKS = [
  ...VOLUME_1,
  ...VOLUME_2,
  ...VOLUME_3,
];

export const LANGUAGES = [
  // More than 50 books
  { code: 'ca', name: 'Catalan' }, { code: 'zh', name: 'Chinese' }, { code: 'da', name: 'Danish' }, 
  { code: 'nl', name: 'Dutch' }, { code: 'en', name: 'English' }, { code: 'eo', name: 'Esperanto' }, 
  { code: 'fi', name: 'Finnish' }, { code: 'fr', name: 'French' }, { code: 'de', name: 'German' }, 
  { code: 'el', name: 'Greek' }, { code: 'hu', name: 'Hungarian' }, { code: 'it', name: 'Italian' }, 
  { code: 'la', name: 'Latin' }, { code: 'pt', name: 'Portuguese' }, { code: 'es', name: 'Spanish' }, 
  { code: 'sv', name: 'Swedish' }, { code: 'tl', name: 'Tagalog' },
  // Up to 50 books (Selected common ones for brevity, add all if needed)
  { code: 'af', name: 'Afrikaans' }, { code: 'ar', name: 'Arabic' }, { code: 'bg', name: 'Bulgarian' }, 
  { code: 'cs', name: 'Czech' }, { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' }, 
  { code: 'no', name: 'Norwegian' }, { code: 'pl', name: 'Polish' }, { code: 'ru', name: 'Russian' }, 
  { code: 'sa', name: 'Sanskrit' }, { code: 'cy', name: 'Welsh' }, { code: 'yi', name: 'Yiddish' }
];

export const TOPICS = [
  "Adventure", "American Literature", "British Literature", "French Literature", "German Literature", 
  "Russian Literature", "Classics of Literature", "Biographies", "Novels", "Short Stories", "Poetry", 
  "Plays", "Romance", "Science-Fiction", "Fantasy", "Mystery", "Mythology", "Humour", "Children", 
  "Science", "History", "Politics", "Philosophy", "Religion", "Art", "Music", "Travel"
];
