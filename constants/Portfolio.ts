export const DEVELOPER_PROFILE = {
  name: "Imran Khan",
  role: "Founding Engineer @ Attain (YC)",
  bio: "I built Vellum because I love reading classics and wanted a clean, distraction-free way to browse Project Gutenberg. In my spare time, I research AI, LLMs, and build developer tools.",
  linkedin: "https://www.linkedin.com/in/imrankhan001/",
  avatar: "https://i.ibb.co/gFB3xJLs/Screenshot-2025-07-20-at-11-08-28-PM.png", // Using your GitHub avatar
};

// Catalog ids from constants/books. `title` is the short display title; the
// details screen shows the full catalog title.
export const FAVORITE_BOOKS = [
  { id: 580, title: "The Pickwick Papers" },
  { id: 289, title: "The Wind in the Willows" },
  { id: 844, title: "The Importance of Being Earnest" },
  { id: 1023, title: "Bleak House" },
  { id: 46, title: "A Christmas Carol" },
  { id: 308, title: "Three Men in a Boat" },
  { id: 902, title: "The Happy Prince and Other Tales" },
  { id: 1400, title: "Great Expectations" },
  { id: 74, title: "The Adventures of Tom Sawyer" },
  { id: 60976, title: "Rip Van Winkle" },
];

// Every Sherlock Holmes volume in the catalog, in publication order.
// (The Sign of the Four isn't in the catalog yet.)
export const SHERLOCK_HOLMES_BOOKS = [
  { id: 244, title: "A Study in Scarlet" },
  { id: 1661, title: "The Adventures of Sherlock Holmes" },
  { id: 834, title: "The Memoirs of Sherlock Holmes" },
  { id: 2852, title: "The Hound of the Baskervilles" },
  { id: 108, title: "The Return of Sherlock Holmes" },
  { id: 3289, title: "The Valley of Fear" },
  { id: 2350, title: "His Last Bow" },
  { id: 69700, title: "The Case-Book of Sherlock Holmes" },
];

export const PROJECTS = [
  {
    id: "ai-dir",
    title: "Spiff.store",
    desc: "A curated directory of AI tools and resources.",
    icon: "hardware-chip-outline",
    url: "https://spiff.store/",
  },
  {
    id: "bmi",
    title: "BMI Calculator",
    desc: "Simple health tracking utility.",
    icon: "calculator-outline",
    url: "https://rref-calculator.com/calculators/bmi",
  },
  {
    id: "tip",
    title: "Tip Calculator",
    desc: "Quick bill splitting and tipping tool.",
    icon: "cash-outline",
    url: "https://rref-calculator.com/calculators/tip-calculator",
  },
  {
    id: "qr",
    title: "QR Code Maker",
    desc: "Generate custom QR codes instantly.",
    icon: "qr-code-outline",
    url: "https://rref-calculator.com/calculators/qr-code",
  },
  {
    id: "zip",
    title: "Zip Code Lookup",
    desc: "Find location details by zip code.",
    icon: "map-outline",
    url: "https://rref-calculator.com/calculators/zip-lookup",
  },
];
