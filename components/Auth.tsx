import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { Phone, User as UserIcon, ShieldCheck, Loader2, Lock, ArrowLeft } from 'lucide-react';

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

  useEffect(() => {
      // Add catch to prevent crash if local storage is corrupt
      api.isDefaultAdmin()
        .then(setIsDefaultAdmin)
        .catch(() => setIsDefaultAdmin(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    setLoading(true);
    try {
      if (isAdminMode) {
        if (!phone || !password) {
           throw new Error('Введите логин и пароль');
        }
        const user = await api.loginAdmin(phone, password);
        onLogin(user);
      } else {
        if (phone.length < 3 || name.length < 2) {
          throw new Error('Пожалуйста, введите корректные данные');
        }
        const user = await api.loginOrRegister(phone, name);
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка входа. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsAdminMode(!isAdminMode);
    setError('');
    setPhone('');
    setName('');
    setPassword('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 transition-all duration-300">
        
        {/* Header Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300 ${isAdminMode ? 'bg-slate-800 shadow-slate-200' : 'bg-blue-600 shadow-blue-200'}`}>
            {isAdminMode ? <Lock className="w-8 h-8 text-white" /> : <ShieldCheck className="w-8 h-8 text-white" />}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
            {isAdminMode ? 'Вход администратора' : 'PayeerRent'}
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
            {isAdminMode ? 'Введите учетные данные для доступа' : 'Бронирование товаров и оборудования'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {!isAdminMode && (
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-700 bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
              />
            </div>
          )}
          
          <div className="relative">
            <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              placeholder={isAdminMode ? (isDefaultAdmin ? "Логин (000)" : "Логин") : "Номер телефона"}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border border-gray-700 bg-gray-800 rounded-xl focus:ring-2 focus:border-transparent outline-none transition-all text-white placeholder-gray-500 ${isAdminMode ? 'focus:ring-slate-500' : 'focus:ring-blue-500'}`}
            />
          </div>

          {isAdminMode && (
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <input
                    type="password"
                    placeholder={isDefaultAdmin ? "Пароль (admin)" : "Пароль"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-700 bg-gray-800 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-500"
                />
              </div>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-4 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex justify-center items-center gap-2 ${
                isAdminMode 
                ? 'bg-slate-800 shadow-slate-200 hover:bg-slate-700' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 shadow-blue-200'
            }`}
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Вход...' : (isAdminMode ? 'Войти в панель' : 'Войти / Регистрация')}
          </button>
        </form>
        
        <div className="mt-8 text-center">
            <button 
                type="button"
                onClick={toggleMode}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1 mx-auto"
            >
                {isAdminMode ? (
                    <>
                        <ArrowLeft className="w-4 h-4" /> Вернуться к входу для клиентов
                    </>
                ) : (
                    "Я администратор"
                )}
            </button>
        </div>
      </div>
    </div>
  );
};