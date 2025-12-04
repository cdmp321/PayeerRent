
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

// SHA-256 Hashing for Passwords
export const hashPassword = async (text: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Convert bytes to hex string
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Simple JWT Simulation (Frontend Only)
// In a real app, this should be generated and verified by a backend with a secret key.
export const generateToken = (payload: any): string => {
  try {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + (24 * 60 * 60 * 1000) })); // 24h
    const signature = btoa("mock_secure_signature"); // Simulation
    return `${header}.${body}.${signature}`;
  } catch (e) {
    return "invalid_token";
  }
};
