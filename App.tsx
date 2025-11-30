
import React, { useEffect, useState, useCallback } from 'react';
import { Auth } from './components/Auth';
import { Wallet } from './components/Wallet';
import { ItemList } from './components/ItemList';
import { AdminDashboard } from './components/AdminDashboard';
import { api } from './services/api';
import { supabaseUrl, supabase } from './services/supabase';
import { User, UserRole } from './types';
import { LogOut, Settings, Home, Wallet as WalletIcon, ShoppingBag, Store, AlertTriangle, Database, RefreshCw, Copy, Check } from 'lucide-react';

const SCHEMA_SQL = `-- 1. Очистка старых таблиц (ПЕРЕУСТАНОВКА)
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.items;
DROP TABLE IF EXISTS public.payment_methods;
DROP TABLE IF EXISTS public.users;

-- 2. Пользователи (Данные: phone, name, password хранятся в ЗАШИФРОВАННОМ виде)
create table public.users (
  id uuid default gen_random_uuid() primary key,
  phone text unique not null,
  name text not null,
  password text,
  balance numeric default 0,
  role text default 'USER', -- 'USER', 'ADMIN', 'MANAGER'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Товары
create table public.items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  image_url text,
  price numeric not null,
  quantity numeric default 1, -- 0 = Unlimited
  status text default 'AVAILABLE',
  owner_id uuid references public.users(id) on delete set null,
  purchased_at timestamp with time zone default timezone('utc'::text, now())
  last_purchase_price numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Транзакции
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  amount numeric not null,
  type text not null,
  status text not null,
  description text,
  receipt_url text,
  viewed boolean default false,
  date timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Методы оплаты
create table public.payment_methods (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  instruction text not null,
  is_active boolean default true,
  min_amount numeric default 0,
  image_url text
);

-- 6. Сотрудники (ЗАШИФРОВАННЫЕ ДАННЫЕ)

-- Администратор (Логин: 000, Пароль: admin)
-- Encoded: 000 -> wADM, admin -> =4mWdaY
insert into public.users (phone, name, password, role, balance)
values ('wADM', '==gcldhcnRzaW5pbWRWQ', '=4mWdaY', 'ADMIN', 0);

-- Менеджер (Логин: 001, Пароль: manager)
-- Encoded: 001 -> xADM, manager -> ==gcldYNaWb
insert into public.users (phone, name, password, role, balance)
values ('xADM', '==gcldYNaWFT', '==gcldYNaWb', 'MANAGER', 0);

-- 7. Доступ (RLS)
alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_methods enable row level security;

create policy "Public access users" on public.users for all using (true);
create policy "Public access items" on public.items for all using (true);
create policy "Public access transactions" on public.transactions for all using (true);
create policy "Public access payment_methods" on public.payment_methods for all using (true);

-- ОБНОВЛЕНИЕ: Добавление колонки image_url, если её нет (для исправления ошибки)
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS image_url text;
`;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // User Navigation State
  const [activeUserTab, setActiveUserTab] = useState<'market' | 'purchases' | 'wallet'>('market');

  // Initialize Auth
  useEffect(() => {
    const initApp = async () => {
        // 1. Check configuration format
        if (!supabaseUrl || supabaseUrl.includes('ВАШ_PROJECT_URL') || !supabaseUrl.trim().startsWith('http')) {
            setError("Необходимо настроить подключение к базе данных в файле services/supabase.ts");
            setLoading(false);
            return;
        }

        try {
            // 2. Check DB connection and Schema existence
            const { error: dbError } = await supabase.from('users').select('id').limit(1);
            
            if (dbError) {
                // If the client failed to init (mock client), show generic error
                if (dbError.code === "CLIENT_INIT_ERROR") {
                     setError("Ошибка инициализации клиента Supabase. Проверьте консоль.");
                     setLoading(false);
                     return;
                }

                if (dbError.code === '42P01') {
                    setError("SCHEMA_MISSING");
                    setLoading(false);
                    return;
                }
                if (dbError.code === 'PGRST301' || dbError.message.includes('JWT')) {
                     setError("Ошибка авторизации. Проверьте API ключи.");
                     setLoading(false);
                     return;
                }
                console.warn("DB Check warning:", dbError.message);
            }

            // 3. Get current user session
            const u = await api.getCurrentUser();
            setUser(u);
            if (u?.role === UserRole.ADMIN || u?.role === UserRole.MANAGER) {
                setIsAdminView(true);
            }
        } catch (err: any) {
            console.error("Failed to initialize:", err);
            setError("Ошибка инициализации приложения: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    initApp();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setError(null);
    if (loggedInUser.role === UserRole.ADMIN || loggedInUser.role === UserRole.MANAGER) {
      setIsAdminView(true);
    } else {
        setActiveUserTab('market');
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setIsAdminView(false);
  };

  const handleRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    if(user) {
        api.getCurrentUser().then(setUser);
    }
  }, [user]);

  // Auto-refresh interval (60 seconds)
  useEffect(() => {
    if (!user) return; // Don't run interval if not logged in

    const intervalId = setInterval(() => {
      handleRefresh();
      console.log('Auto-refresh triggered');
    }, 60000); // 60000 ms = 60 seconds

    return () => clearInterval(intervalId);
  }, [user, handleRefresh]);

  const copySchema = () => {
      navigator.clipboard.writeText(SCHEMA_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-transparent">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-slate-500 font-medium">Загрузка PayeerRent...</div>
        </div>
    );
  }

  if (error) {
    const isSchemaError = error === "SCHEMA_MISSING";
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-transparent">
        <div className="glass-panel p-8 rounded-2xl w-full max-w-lg">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner ${isSchemaError ? 'bg-blue-50' : 'bg-red-50'}`}>
                {isSchemaError ? <Database className="w-8 h-8 text-blue-600" /> : <AlertTriangle className="w-8 h-8 text-red-500" />}
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {isSchemaError ? "База данных подключена!" : "Ошибка подключения"}
            </h2>
            
            <p className="text-slate-500 mb-8 font-medium">
                {isSchemaError 
                    ? "Необходимо обновить структуру базы для поддержки шифрования и новых функций." 
                    : error}
            </p>

            {isSchemaError ? (
                <div className="text-left mb-8">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">SQL Код для вставки</span>
                        <button 
                            onClick={copySchema}
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Скопировано' : 'Копировать'}
                        </button>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-inner">
                        <pre className="text-xs text-slate-300 font-mono overflow-auto max-h-48 custom-scrollbar whitespace-pre-wrap">
                            {SCHEMA_SQL}
                        </pre>
                    </div>
                    
                    <div className="mt-4 text-xs text-slate-600 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                        1. Скопируйте код выше.<br/>
                        2. Перейдите в <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold hover:text-blue-700">Supabase SQL Editor</a>.<br/>
                        3. Вставьте код и нажмите <b>Run</b>.
                    </div>
                </div>
            ) : (
                 <div className="text-xs text-left bg-slate-50 p-4 rounded-xl text-slate-600 mb-8 border border-slate-200">
                    <p className="font-bold mb-1">Совет:</p>
                    <p>Проверьте ключи в файле <code>services/supabase.ts</code>.</p>
                </div>
            )}

            <button 
                onClick={() => window.location.reload()}
                className={`w-full text-white py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 ${isSchemaError ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
                <RefreshCw className="w-5 h-5" />
                {isSchemaError ? "Я выполнил код, войти" : "Попробовать снова"}
            </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-transparent pb-10 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header / Navbar */}
      <header className="glass-header sticky top-0 z-30 transition-all duration-300">
        {/* Dynamic max-width based on role */}
        <div className={`${isAdminView ? 'max-w-7xl px-6' : 'max-w-md px-4'} mx-auto py-3.5 flex justify-between items-center`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-300">
                <Store className="w-6 h-6" />
            </div>
            <h1 className="font-extrabold text-xl text-slate-800 tracking-tight">PayeerRent</h1>
            {isAdminView && (
                <span className={`text-white text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ml-1 ${user.role === UserRole.MANAGER ? 'bg-purple-600' : 'bg-slate-800'}`}>
                    {user.role === UserRole.MANAGER ? 'Manager' : 'Admin'}
                </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Settings Button - Top Right, Before Logout */}
            {(user.role === UserRole.ADMIN || user.role === UserRole.MANAGER) && !isAdminView && (
               <button 
                 onClick={() => setIsAdminView(true)}
                 className="p-2.5 rounded-full transition-all duration-200 flex items-center gap-2 hover:bg-slate-100 text-slate-500 hover:text-indigo-600"
                 title="Панель управления"
               >
                  <Settings className="w-6 h-6" />
               </button>
            )}
            
            {/* Logout Button - Blue Filled Style */}
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl shadow-lg shadow-blue-200 font-bold text-sm transition-all flex items-center gap-2"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - Responsive Container */}
      <main className={`${isAdminView ? 'max-w-7xl px-6' : 'max-w-md px-4'} mx-auto py-6 transition-all duration-300`}>
        {isAdminView ? (
          <AdminDashboard user={user} />
        ) : (
          <>
            {/* User Content Area */}
            {activeUserTab === 'market' && (
                <div className="animate-fade-in">
                    <div className="mb-6 px-1">
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Магазин</h2>
                        <p className="text-slate-500 font-medium">Доступные товары и услуги</p>
                    </div>
                    <ItemList 
                        user={user} 
                        refreshTrigger={refreshTrigger} 
                        onRentAction={handleRefresh} 
                        viewMode="market"
                        onNavigateToWallet={() => setActiveUserTab('wallet')}
                        onNavigateToPurchases={() => setActiveUserTab('purchases')}
                    />
                </div>
            )}

            {activeUserTab === 'purchases' && (
                <div className="animate-fade-in">
                     <div className="mb-6 px-1">
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Мои товары</h2>
                        <p className="text-slate-500 font-medium">Ваши активные бронирования</p>
                    </div>
                    <ItemList 
                        user={user} 
                        refreshTrigger={refreshTrigger} 
                        onRentAction={handleRefresh} 
                        viewMode="purchases"
                        onNavigateToMarket={() => setActiveUserTab('market')}
                    />
                </div>
            )}

            {activeUserTab === 'wallet' && (
                <div className="animate-fade-in">
                    <div className="mb-6 px-1">
                        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Кошелек</h2>
                        <p className="text-slate-500 font-medium">Управление балансом</p>
                    </div>
                    <Wallet user={user} onUpdateUser={setUser} />
                </div>
            )}

            {/* User Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-white/50 px-6 py-2 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe">
                {/* MARKET TAB - BLUE */}
                <button 
                    onClick={() => setActiveUserTab('market')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-2xl flex-1 transition-all duration-300 group ${activeUserTab === 'market' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <div className={`p-2 rounded-2xl transition-all duration-300 ${activeUserTab === 'market' ? 'bg-blue-50 shadow-inner scale-110' : 'group-hover:bg-slate-50'}`}>
                        <Store className="w-8 h-8 stroke-[1.5px]" />
                    </div>
                    <span className={`text-[10px] font-bold transition-all duration-300 ${activeUserTab === 'market' ? 'opacity-100 translate-y-0 text-blue-600' : 'opacity-0 translate-y-2 hidden'}`}>Магазин</span>
                </button>

                {/* PURCHASES TAB - PURPLE */}
                <button 
                    onClick={() => setActiveUserTab('purchases')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-2xl flex-1 transition-all duration-300 group ${activeUserTab === 'purchases' ? 'text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <div className={`p-2 rounded-2xl transition-all duration-300 ${activeUserTab === 'purchases' ? 'bg-purple-50 shadow-inner scale-110' : 'group-hover:bg-slate-50'}`}>
                        <ShoppingBag className="w-8 h-8 stroke-[1.5px]" />
                    </div>
                    <span className={`text-[10px] font-bold transition-all duration-300 ${activeUserTab === 'purchases' ? 'opacity-100 translate-y-0 text-purple-600' : 'opacity-0 translate-y-2 hidden'}`}>Моё</span>
                </button>

                {/* WALLET TAB - EMERALD */}
                <button 
                    onClick={() => setActiveUserTab('wallet')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-2xl flex-1 transition-all duration-300 group ${activeUserTab === 'wallet' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <div className={`p-2 rounded-2xl transition-all duration-300 ${activeUserTab === 'wallet' ? 'bg-emerald-50 shadow-inner scale-110' : 'group-hover:bg-slate-50'}`}>
                        <WalletIcon className="w-8 h-8 stroke-[1.5px]" />
                    </div>
                    <span className={`text-[10px] font-bold transition-all duration-300 ${activeUserTab === 'wallet' ? 'opacity-100 translate-y-0 text-emerald-600' : 'opacity-0 translate-y-2 hidden'}`}>Кошелек</span>
                </button>
            </nav>
          </>
        )}
      </main>
    </div>
  );
};
export default App;
