
import React, { useEffect, useState, useCallback } from 'react';
import { Auth } from './components/Auth';
import { Wallet } from './components/Wallet';
import { ItemList } from './components/ItemList';
import { AdminDashboard } from './components/AdminDashboard';
import { api } from './services/api';
import { supabaseUrl, supabase } from './services/supabase';
import { User, UserRole } from './types';
import { LogOut, Settings, Home, Wallet as WalletIcon, ShoppingBag, Store, AlertTriangle, Database, RefreshCw, Copy, Check } from 'lucide-react';

const SCHEMA_SQL = `-- 1. Пользователи
create table public.users (
  id uuid default gen_random_uuid() primary key,
  phone text unique not null,
  name text not null,
  password text,
  balance numeric default 0,
  role text default 'USER',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Товары
create table public.items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  image_url text,
  price numeric not null,
  status text default 'AVAILABLE',
  owner_id uuid references public.users(id),
  purchased_at timestamp with time zone,
  last_purchase_price numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Транзакции
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  amount numeric not null,
  type text not null,
  status text not null,
  description text,
  receipt_url text,
  viewed boolean default false,
  date timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Методы оплаты
create table public.payment_methods (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  instruction text not null,
  is_active boolean default true,
  min_amount numeric default 0
);

-- 5. Админ (000 / admin)
insert into public.users (phone, name, password, role, balance)
values ('000', 'Administrator', 'admin', 'ADMIN', 0)
on conflict (phone) do nothing;

-- 6. Доступ
alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.transactions enable row level security;
alter table public.payment_methods enable row level security;

create policy "Public access users" on public.users for all using (true);
create policy "Public access items" on public.items for all using (true);
create policy "Public access transactions" on public.transactions for all using (true);
create policy "Public access payment_methods" on public.payment_methods for all using (true);
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
            if (u?.role === UserRole.ADMIN) {
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
    if (loggedInUser.role === UserRole.ADMIN) {
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

  const copySchema = () => {
      navigator.clipboard.writeText(SCHEMA_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-gray-500 font-medium">Загрузка PayeerRent...</div>
        </div>
    );
  }

  if (error) {
    const isSchemaError = error === "SCHEMA_MISSING";
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-lg border border-red-100 w-full">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isSchemaError ? 'bg-blue-100' : 'bg-red-100'}`}>
                {isSchemaError ? <Database className="w-7 h-7 text-blue-600" /> : <AlertTriangle className="w-7 h-7 text-red-500" />}
            </div>
            
            <h2 className="text-xl font-bold text-gray-800 mb-2">
                {isSchemaError ? "База данных подключена!" : "Ошибка подключения"}
            </h2>
            
            <p className="text-gray-500 mb-6 text-sm">
                {isSchemaError 
                    ? "Теперь нужно создать таблицы в Supabase." 
                    : error}
            </p>

            {isSchemaError ? (
                <div className="text-left mb-6">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">SQL Код для вставки</span>
                        <button 
                            onClick={copySchema}
                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                        >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'Скопировано!' : 'Копировать'}
                        </button>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-3 border border-slate-700 relative group">
                        <pre className="text-xs text-slate-300 font-mono overflow-auto max-h-48 custom-scrollbar whitespace-pre-wrap">
                            {SCHEMA_SQL}
                        </pre>
                    </div>
                    
                    <div className="mt-4 text-xs text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        1. Скопируйте код выше.<br/>
                        2. Перейдите в <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Supabase SQL Editor</a>.<br/>
                        3. Вставьте код и нажмите <b>Run</b>.
                    </div>
                </div>
            ) : (
                 <div className="text-xs text-left bg-gray-50 p-4 rounded-lg text-gray-600 mb-6 border border-gray-200">
                    <p className="font-bold mb-2">Совет:</p>
                    <p>Проверьте ключи в <code>services/supabase.ts</code>.</p>
                </div>
            )}

            <button 
                onClick={() => window.location.reload()}
                className={`w-full text-white py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${isSchemaError ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
                <RefreshCw className="w-4 h-4" />
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
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header / Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        {/* Dynamic max-width based on role */}
        <div className={`${isAdminView ? 'max-w-7xl px-6' : 'max-w-md px-4'} mx-auto py-3 flex justify-between items-center transition-all duration-300`}>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl text-gray-900 tracking-tight">PayeerRent</h1>
            {isAdminView && <span className="bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">Admin Panel</span>}
          </div>
          
          <div className="flex items-center gap-3">
            {user.role === UserRole.ADMIN && (
               <button 
                 onClick={() => setIsAdminView(!isAdminView)}
                 className={`p-2 rounded-full transition-colors flex items-center gap-2 ${isAdminView ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'}`}
               >
                 {isAdminView ? (
                    <>
                        <Home className="w-5 h-5" />
                        <span className="text-xs font-bold hidden sm:inline">К клиенту</span>
                    </>
                 ) : (
                    <>
                        <Settings className="w-5 h-5" />
                        <span className="text-xs font-bold hidden sm:inline">Админка</span>
                    </>
                 )}
               </button>
            )}
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - Responsive Container */}
      <main className={`${isAdminView ? 'max-w-7xl px-6' : 'max-w-md px-4'} mx-auto py-6 transition-all duration-300`}>
        {isAdminView ? (
          <AdminDashboard />
        ) : (
          <>
            {/* User Content Area */}
            {activeUserTab === 'market' && (
                <div className="animate-fade-in">
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-gray-900">Магазин</h2>
                        <p className="text-gray-500 text-sm">Доступные товары и услуги</p>
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
                     <div className="mb-4">
                        <h2 className="text-2xl font-bold text-gray-900">Мои товары</h2>
                        <p className="text-gray-500 text-sm">Ваши активные бронирования</p>
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
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-gray-900">Кошелек</h2>
                        <p className="text-gray-500 text-sm">Управление балансом</p>
                    </div>
                    <Wallet user={user} onUpdateUser={setUser} />
                </div>
            )}

            {/* User Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={() => setActiveUserTab('market')}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl flex-1 transition-all duration-300 ${activeUserTab === 'market' ? 'text-blue-600 -translate-y-2' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${activeUserTab === 'market' ? 'bg-blue-50 shadow-blue-100 shadow-lg' : ''}`}>
                        <Store className="w-7 h-7" strokeWidth={2.5} />
                    </div>
                    <span className={`text-[10px] font-bold ${activeUserTab === 'market' ? 'opacity-100' : 'opacity-0 h-0'}`}>Магазин</span>
                </button>

                <button 
                    onClick={() => setActiveUserTab('purchases')}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl flex-1 transition-all duration-300 ${activeUserTab === 'purchases' ? 'text-indigo-600 -translate-y-2' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${activeUserTab === 'purchases' ? 'bg-indigo-50 shadow-indigo-100 shadow-lg' : ''}`}>
                        <ShoppingBag className="w-7 h-7" strokeWidth={2.5} />
                    </div>
                    <span className={`text-[10px] font-bold ${activeUserTab === 'purchases' ? 'opacity-100' : 'opacity-0 h-0'}`}>Моё</span>
                </button>

                <button 
                    onClick={() => setActiveUserTab('wallet')}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl flex-1 transition-all duration-300 ${activeUserTab === 'wallet' ? 'text-emerald-600 -translate-y-2' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    <div className={`p-2 rounded-xl transition-all ${activeUserTab === 'wallet' ? 'bg-emerald-50 shadow-emerald-100 shadow-lg' : ''}`}>
                        <WalletIcon className="w-7 h-7" strokeWidth={2.5} />
                    </div>
                    <span className={`text-[10px] font-bold ${activeUserTab === 'wallet' ? 'opacity-100' : 'opacity-0 h-0'}`}>Кошелек</span>
                </button>
            </nav>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
