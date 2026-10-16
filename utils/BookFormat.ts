/** "Doyle, Arthur Conan" → "Arthur Conan Doyle" */
export const formatAuthor = (book: any) =>
  book?.authors?.[0]?.name.split(",").reverse().join(" ").trim() || "Unknown";
