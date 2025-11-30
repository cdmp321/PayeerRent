
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
      <div className="glass-panel p-8 sm:p-10 rounded-3xl w-full max-w-sm transition-all duration-300">
        
        {/* Header Icon - Secret Trigger */}
        <div className="flex justify-center mb-6">
          <div 
            onClick={handleSecretClick}
            className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl rotate-3 transition-all duration-300 cursor-pointer active:scale-95 ${isAdminMode ? 'bg-slate-800 shadow-slate-300/50' : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-indigo-300/50'}`}
          >
            {isAdminMode ? <Briefcase className="w-9 h-9 text-white" /> : <ShieldCheck className="w-10 h-10 text-white" />}
          </div>
        </div>
        
        <h2 className="text-3xl font-extrabold text-center text-slate-800 mb-2 tracking-tight">
            {isAdminMode ? 'Панель сотрудников' : 'PayeerRent'}
        </h2>
        <p className="text-center text-slate-500 mb-8 font-medium">
            {isAdminMode ? 'Вход для Админа и Менеджера' : 'Магазин товаров и услуг'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {/* Fake inputs to disable autocomplete more effectively in some browsers */}
          <input type="text" style={{display: 'none'}} />
          <input type="password" style={{display: 'none'}} />

          {!isAdminMode && (
            <div className="relative group">
              <UserIcon className="absolute left-4 top-4 h-5 w-5 text-slate-800 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 border border-slate-200 bg-white/50 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-800 placeholder-slate-400 font-medium"
              />
            </div>
          )}
          
          <div className="relative group">
            <Phone className="absolute left-4 top-4 h-5 w-5 text-slate-800 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text" 
              placeholder={isAdminMode ? (isDefaultAdmin ? "Логин (000 или 001)" : "Логин сотрудника") : "Номер телефона"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3.5 border border-slate-200 bg-white/50 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-800 placeholder-slate-400 font-medium"
            />
          </div>

          {isAdminMode && (
              <div className="relative group">
                <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-800 group-focus-within:text-slate-600 transition-colors" />
                <input
                    type="password"
                    placeholder={isDefaultAdmin ? "Пароль (admin или manager)" : "Пароль"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 bg-white/50 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition-all text-slate-800 placeholder-slate-400 font-medium"
                />
              </div>
          )}

          {error && <p className="text-red-500 text-sm text-center font-bold bg-red-50 py-2 rounded-lg border border-red-100">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-4 ${
                isAdminMode 
                ? 'bg-slate-800 shadow-slate-200 hover:bg-slate-700' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-indigo-200 hover:to-indigo-700'
            }`}
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Вход...' : (isAdminMode ? 'Войти' : 'Продолжить')}
          </button>
        </form>
        
        {/* Removed Visible Switch Button */}
      </div>
    </div>
  );
};
