
import { createClient } from '@supabase/supabase-js';

// ==========================================
// ⚙️ НАСТРОЙКИ ПОДКЛЮЧЕНИЯ (ВСТАВЬТЕ ВАШИ КЛЮЧИ НИЖЕ)
// ==========================================

// 1. Ссылка на проект (Project URL)
// Найти здесь: Supabase -> Settings -> API -> Project URL
// Пример: 'https://xyzcompany.supabase.co'
const PROJECT_URL = 'https://nwcikoithzrydrtulovm.supabase.co'; 

// 2. Публичный ключ (Project API Key / Anon Key)
// Найти здесь: Supabase -> Settings -> API -> Project API keys -> anon / public
// Пример: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53Y2lrb2l0aHpyeWRydHVsb3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMDQ1MTcsImV4cCI6MjA3OTY4MDUxN30.gqlWBgqMiTYdDYq1dmY8ABKp7jOxGlfwffrJ_JE56-Y';

// ==========================================

let clientUrl = PROJECT_URL;
let clientKey = ANON_KEY;

// Попытка получить ключи из переменных окружения (для локальной разработки через Vite)
try {
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
    // @ts-ignore
    clientUrl = import.meta.env.VITE_SUPABASE_URL;
  }
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    // @ts-ignore
    clientKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }
} catch (e) {
  // Игнорируем ошибки доступа к env
}

export const supabaseUrl = clientUrl;
export const supabaseKey = clientKey;

// Инициализация клиента
let client;

// Заглушка на случай ошибок инициализации
const mockClient = {
  from: () => ({
    select: () => Promise.resolve({ data: null, error: { message: "Client init failed", code: "CLIENT_INIT_ERROR" } }),
    insert: () => Promise.resolve({ data: null, error: { message: "Client init failed" } }),
    update: () => Promise.resolve({ data: null, error: { message: "Client init failed" } }),
    delete: () => Promise.resolve({ data: null, error: { message: "Client init failed" } }),
    upsert: () => Promise.resolve({ data: null, error: { message: "Client init failed" } }),
  }),
  auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  }
};

try {
    const cleanUrl = clientUrl ? String(clientUrl).trim() : '';
    const cleanKey = clientKey ? String(clientKey).trim() : '';
    
    // Проверка валидности ключей
    if (cleanUrl && cleanKey && cleanUrl.startsWith('http') && !cleanUrl.includes('ВАШ_PROJECT_URL')) {
        client = createClient(cleanUrl, cleanKey);
    } else {
        // Если ключи не настроены, используем мок-клиент, чтобы приложение не упало сразу,
        // а показало красивое сообщение об ошибке в App.tsx
        console.warn("Supabase credentials not configured in services/supabase.ts");
        client = mockClient;
    }
} catch (e) {
    console.error("Supabase client critical init error:", e);
    client = mockClient;
}

// Cast to any to avoid strict type checking issues in development
export const supabase = client as any;
