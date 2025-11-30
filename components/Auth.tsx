
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { Phone, User as UserIcon, ShieldCheck, Loader2, Lock, Briefcase } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDefaultAdmin, setIsDefaultAdmin] = useState(true);
  
  // Secret Trigger State
  const [secretClicks, setSecretClicks] = useState(0);

  useEffect(() => {
      // Add catch to prevent crash if local storage is corrupt
      api.isDefaultAdmin()
        .then(setIsDefaultAdmin)
        .catch(() => setIsDefaultAdmin(false));
  }, []);

  const handleSecretClick = () => {
    setSecretClicks(prev => {
        const newCount = prev + 1;
        if (newCount >= 7) {
            toggleMode();
            return 0;
        }
        return newCount;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Explicit trim again just to be safe
    const cleanPhone = phone.trim();
    const cleanPass = password.trim();
    const cleanName = name.trim();

    setLoading(true);
    try {
      if (isAdminMode) {
        if (!cleanPhone || !cleanPass) {
           throw new Error('Введите логин и пароль');
        }
        const user = await api.loginAdmin(cleanPhone, cleanPass);
        onLogin(user);
      } else {
        if (cleanPhone.length < 3 || cleanName.length < 2) {
          throw new Error('Пожалуйста, введите корректные данные');
        }
        const user = await api.loginOrRegister(cleanPhone, cleanName);
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsAdminMode(prev => !prev);
    setError('');
    setPhone('');
    setName('');
    setPassword('');
    setSecretClicks(0);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-fade-in">
      <div className="glass-panel p-8 sm:p-10 rounded-[2.5rem] w-full max-w-sm transition-all duration-300 shadow-2xl border border-white/60 relative overflow-hidden">
        
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        {/* Header Icon - Secret Trigger */}
        <div className="flex justify-center mb-10 relative z-10">
          <div 
            onClick={handleSecretClick}
            className={`w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-xl rotate-3 transition-all duration-300 cursor-pointer active:scale-95 border-4 border-white ${isAdminMode ? 'bg-slate-900 shadow-slate-400/50' : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-indigo-300/50'}`}
          >
            {isAdminMode ? <Briefcase className="w-10 h-10 text-white stroke-[2]" /> : <ShieldCheck className="w-12 h-12 text-white stroke-[2]" />}
          </div>
        </div>
        
        <h2 className="text-3xl font-extrabold text-center text-slate-900 mb-2 tracking-tight">
            {isAdminMode ? 'Панель сотрудников' : 'PayeerRent'}
        </h2>
        <p className="text-center text-slate-500 mb-10 font-medium text-sm tracking-wide uppercase">
            {isAdminMode ? 'Вход для Админа и Менеджера' : 'Магазин товаров и услуг'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10" autoComplete="off">
          {/* Fake inputs to disable autocomplete more effectively in some browsers */}
          <input type="text" style={{display: 'none'}} />
          <input type="password" style={{display: 'none'}} />

          {!isAdminMode && (
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:opacity-0 pointer-events-none z-10">
                <UserIcon className="h-6 w-6 text-indigo-600 stroke-[2.5]" />
              </div>
              <input
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="peer w-full pl-14 pr-5 py-4.5 border-2 border-slate-100 bg-slate-50/50 backdrop-blur-md rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-900 placeholder-slate-400 font-bold text-lg shadow-sm focus:pl-5"
              />
            </div>
          )}
          
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:opacity-0 pointer-events-none z-10">
                <Phone className="h-6 w-6 text-indigo-600 stroke-[2.5]" />
            </div>
            <input
              type="text" 
              placeholder={isAdminMode ? (isDefaultAdmin ? "Логин (000 или 001)" : "Логин сотрудника") : "Номер телефона"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              className="peer w-full pl-14 pr-5 py-4.5 border-2 border-slate-100 bg-slate-50/50 backdrop-blur-md rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-900 placeholder-slate-400 font-bold text-lg shadow-sm focus:pl-5"
            />
          </div>

          {isAdminMode && (
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 transition-all duration-200 peer-focus:opacity-0 pointer-events-none z-10">
                    <Lock className="h-6 w-6 text-indigo-600 stroke-[2.5]" />
                </div>
                <input
                    type="password"
                    placeholder={isDefaultAdmin ? "Пароль (admin или manager)" : "Пароль"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="peer w-full pl-14 pr-5 py-4.5 border-2 border-slate-100 bg-slate-50/50 backdrop-blur-md rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-slate-900 placeholder-slate-400 font-bold text-lg shadow-sm focus:pl-5"
                />
              </div>
          )}

          {error && <p className="text-red-600 text-sm text-center font-bold bg-red-50 py-3 rounded-xl border border-red-100 animate-fade-in">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-4.5 rounded-2xl font-extrabold text-lg shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-4 ${
                isAdminMode 
                ? 'bg-slate-900 shadow-slate-300 hover:bg-slate-800' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-indigo-300 hover:to-indigo-700'
            }`}
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Вход...' : (isAdminMode ? 'Войти' : 'Продолжить')}
          </button>
        </form>
      </div>
    </div>
  );
};
