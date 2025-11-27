
// Простая утилита для кодирования данных (Obfuscation)
// Использует Base64 с поддержкой UTF-8 (кириллицы) и реверсом строки для маскировки

export const encrypt = (text: string): string => {
  if (!text) return text;
  try {
    // 1. Encode URI (fix Cyrillic) -> 2. Unescape -> 3. Base64 -> 4. Reverse string
    return btoa(unescape(encodeURIComponent(text))).split('').reverse().join('');
  } catch (e) {
    console.error("Encryption error", e);
    return text;
  }
};

export const decrypt = (text: string): string => {
  if (!text) return text;
  try {
    // 1. Reverse string back -> 2. Base64 decode -> 3. Escape -> 4. Decode URI
    return decodeURIComponent(escape(atob(text.split('').reverse().join(''))));
  } catch (e) {
    // Если текст не зашифрован (например, старые данные), возвращаем как есть
    return text;
  }
};
