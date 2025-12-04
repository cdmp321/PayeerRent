
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
    setLoading(true);
    setError('');

    try {
      if (isAdminMode) {
        // Admin/Manager Login
        const user = await api.loginAdmin(phone, password);
        onLogin(user);
      } else {
        // User Login/Register - Now accepts password
        const user = await api.loginOrRegister(phone, password, name);
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsAdminMode(!isAdminMode);
    setError('');
    setPhone('');
    setPassword('');
    setName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-50">
       {/* Background Decoration */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 right-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
       </div>

      <div className="max-w-md w-full bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl border border-white/50 relative z-10 animate-fade-in scale-90 shadow-[0_-20px_60px_-15px_rgba(79,70,229,0.5)]">
        
        <div className="flex flex-col items-center mb-10">
          <button 
            type="button" 
            onClick={handleSecretClick}
            className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl transform transition-transform active:scale-95 ${isAdminMode ? 'bg-slate-900 rotate-12' : 'bg-indigo-600 -rotate-3'}`}
          >
            {isAdminMode ? (
              <ShieldCheck className="w-10 h-10 text-white" />
            ) : (
              <Briefcase className="w-10 h-10 text-white" />
            )}
          </button>
          
          <h2 className="text-4xl font-black text-slate-800 tracking-tight text-center">
            {isAdminMode ? 'Служебный вход' : 'PayeerRent'}
          </h2>
          <p className="text-slate-500 font-medium mt-2 text-center">
            {isAdminMode ? 'Только для персонала' : 'Магазин товаров и услуг'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <div className="relative group">
              <Phone className="w-7 h-7 text-indigo-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none peer-focus:opacity-0 transition-opacity z-10" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isAdminMode ? "Логин сотрудника" : "Номер телефона"}
                className="peer w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-lg text-slate-800 placeholder-slate-400 shadow-inner focus:shadow-lg focus:shadow-indigo-100"
                required
              />
            </div>

            {/* Password Field (Now for BOTH Admin and Client) */}
            <div className="relative group">
                <Lock className="w-7 h-7 text-indigo-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none peer-focus:opacity-0 transition-opacity z-10" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isAdminMode ? "Пароль доступа" : "Придумайте пароль"}
                  className="peer w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-lg text-slate-800 placeholder-slate-400 shadow-inner focus:shadow-lg focus:shadow-indigo-100"
                  required
                />
            </div>

            {/* Name field - only for client registration */}
            {!isAdminMode && (
              <div className="relative group">
                <UserIcon className="w-7 h-7 text-indigo-600 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none peer-focus:opacity-0 transition-opacity z-10" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше имя"
                  className="peer w-full pl-14 pr-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white transition-all font-bold text-lg text-slate-800 placeholder-slate-400 shadow-inner focus:shadow-lg focus:shadow-indigo-100"
                  required
                />
              </div>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-sm font-bold text-center border-2 border-red-100 animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-black text-xl text-white shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
              isAdminMode 
                ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-300' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-300'
            }`}
          >
            {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : (isAdminMode ? 'Войти в систему' : 'Продолжить')}
          </button>
        </form>

      </div>
    </div>
  );
};
