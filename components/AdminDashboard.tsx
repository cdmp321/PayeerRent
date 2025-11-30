
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { supabase } from '../services/supabase'; // Import supabase for Realtime
import { Item, User, PaymentMethod, UserRole, Transaction, TransactionStatus } from '../types';
import { Users, Package, CreditCard, Plus, Trash2, RefreshCw, FileText, Check, X, TrendingUp, ArrowUpRight, ArrowDownLeft, Shield, User as UserIcon, Settings, ImageIcon, RotateCcw, Archive, ArchiveRestore, Search, Calendar, Bitcoin, CheckCircle2, ChevronUp, ChevronDown, Lock, Unlock } from 'lucide-react';

interface AdminDashboardProps {
  user: User | null;
}

// Payment Icon Helper Component
export const PaymentIcon = ({ imageUrl }: { imageUrl?: string }) => {
    if (!imageUrl) return <CreditCard className="w-8 h-8 text-gray-400" />;

    // Preset Icons
    if (imageUrl.startsWith('preset:')) {
        const type = imageUrl.split(':')[1];
        switch(type) {
            case 'card':
                return (
                    <div className="w-10 h-7 rounded bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative shadow-sm overflow-hidden flex items-center justify-center border border-white/20">
                        <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-yellow-300 rounded-full opacity-80 shadow-sm"></div>
                        <div className="absolute bottom-1 right-1 w-4 h-2 bg-white/20 rounded-sm backdrop-blur-sm"></div>
                    </div>
                );
            case 'crypto':
                return (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm text-white border-2 border-white ring-1 ring-orange-200">
                        <Bitcoin className="w-5 h-5" />
                    </div>
                );
            case 'master':
                 return (
                    <div className="w-10 h-7 rounded bg-slate-900 relative shadow-sm flex items-center justify-center overflow-hidden border border-slate-700">
                        <div className="w-4 h-4 rounded-full bg-red-500/90 -mr-1.5 z-10 mix-blend-screen"></div>
                        <div className="w-4 h-4 rounded-full bg-yellow-500/90 -ml-1.5 z-0 mix-blend-screen"></div>
                    </div>
                 );
            case 'mir':
                return (
                     <div className="w-10 h-7 rounded bg-emerald-600 flex items-center justify-center shadow-sm border border-emerald-500 relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-tr from-emerald-800 to-transparent opacity-50"></div>
                         <span className="text-[9px] font-black text-white tracking-tighter uppercase italic relative z-10">MIR</span>
                     </div>
                );
            case 'visa':
                return (
                    <div className="w-10 h-7 rounded bg-white border border-gray-200 flex items-center justify-center shadow-sm relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-4 h-4 bg-blue-100 rounded-bl-full opacity-50"></div>
                         <span className="text-[10px] font-black text-blue-800 uppercase italic tracking-tighter">VISA</span>
                    </div>
                );
            default:
                return <CreditCard className="w-8 h-8 text-gray-400" />;
        }
    }

    // Normal Image
    return (
        <div className="w-10 h-10 rounded-lg border border-gray-200 bg-white flex items-center justify-center p-0.5 overflow-hidden">
             <img src={imageUrl} alt="Method" className="w-full h-full object-contain" />
        </div>
    );
};


export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'items' | 'users' | 'payments' | 'deposits' | 'finances' | 'settings'>('deposits');
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Sorting State
  const [itemSort, setItemSort] = useState<{ key: keyof Item; dir: 'asc' | 'desc' }>({ key: 'title', dir: 'asc' });
  const [userSort, setUserSort] = useState<{ key: keyof User; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  // Finances Group Expansion State
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [fullHistoryUserId, setFullHistoryUserId] = useState<string | null>(null);
  
  // Archive State for Finances
  const [archivedUsers, setArchivedUsers] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('payeer_archived_users');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [showArchived, setShowArchived] = useState(false);
  
  // Withdrawal History Filters
  const [withdrawalSearchQuery, setWithdrawalSearchQuery] = useState('');
  const [withdrawalSearchDate, setWithdrawalSearchDate] = useState('');

  // Refund History Filters
  const [refundSearchQuery, setRefundSearchQuery] = useState('');
  const [refundSearchDate, setRefundSearchDate] = useState('');
  
  // Deposit History Filters (New)
  const [depositSearchQuery, setDepositSearchQuery] = useState('');
  const [depositSearchDate, setDepositSearchDate] = useState('');

  // Collapse States for History Tables
  const [expandWithdrawals, setExpandWithdrawals] = useState(false);
  const [expandRefunds, setExpandRefunds] = useState(false);
  const [expandDeposits, setExpandDeposits] = useState(false);

  // Refresh loading state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Transaction processing state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [processingTxId, setProcessingTxId] = useState<string | null>(null);
  
  // Refund Form State
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('Выплата клиенту на карту со списанием с внутренего кошелька');
  const [refundModalUser, setRefundModalUser] = useState<User | null>(null);

  // Form states - Items
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState(''); 
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1'); 
  const [newItemImage, setNewItemImage] = useState(''); // Base64 string
  const [newItemImageName, setNewItemImageName] = useState(''); 
  
  // Form states - Payment Methods
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodInstr, setNewMethodInstr] = useState('');
  const [newMethodMin, setNewMethodMin] = useState('');
  // Icon selector state
  const [selectedIconType, setSelectedIconType] = useState<string>('preset:card'); 

  // Settings State
  const [managerLogin, setManagerLogin] = useState('');
  const [managerPass, setManagerPass] = useState('');
  const [msgManager, setMsgManager] = useState('');
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [msgAdmin, setMsgAdmin] = useState('');

  // Receipt viewing state
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    refreshAll();

    const channel = supabase
      .channel('admin_dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => refreshAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => refreshAll())
      .subscribe();

    const intervalId = setInterval(() => {
        refreshAll();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, []);

  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
        const [itemsData, usersData, methodsData, transactionsData] = await Promise.all([
            api.getItems(),
            api.getUsers(),
            api.getPaymentMethods(),
            api.getTransactions()
        ]);
        
        setItems(itemsData);
        setUsers(usersData);
        setMethods(methodsData);
        setTransactions(transactionsData);
    } catch (e) {
        console.error('Error refreshing data:', e);
    } finally {
        setIsRefreshing(false);
    }
  };

  const toggleArchiveUser = (userId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setArchivedUsers(prev => {
          const next = new Set(prev);
          if (next.has(userId)) {
              next.delete(userId);
          } else {
              next.add(userId);
          }
          localStorage.setItem('payeer_archived_users', JSON.stringify(Array.from(next)));
          return next;
      });
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewItemImageName(file.name);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItemImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle) {
        alert('Введите название товара');
        return;
    }
    
    try {
        const priceVal = newItemPrice === '' ? 0 : parseFloat(newItemPrice);
        const quantityVal = newItemQuantity === '' ? 1 : parseFloat(newItemQuantity);

        await api.createItem({
            title: newItemTitle,
            description: newItemDesc || 'Описание отсутствует',
            imageUrl: newItemImage.trim(),
            price: isNaN(priceVal) ? 0 : priceVal,
            quantity: isNaN(quantityVal) ? 1 : quantityVal
        });
        
        setNewItemTitle('');
        setNewItemDesc('');
        setNewItemPrice('');
        setNewItemQuantity('1');
        setNewItemImage('');
        setNewItemImageName('');
        
        alert('Товар успешно добавлен!');
        refreshAll();
    } catch (e: any) {
        alert('Ошибка добавления: ' + e.message);
    }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodName || !newMethodInstr) {
        alert("Заполните название и инструкцию");
        return;
    }
    
    try {
        const minVal = parseFloat(newMethodMin);

        await api.addPaymentMethod({
        name: newMethodName,
        instruction: newMethodInstr,
        isActive: true,
        minAmount: isNaN(minVal) ? 0 : minVal,
        imageUrl: selectedIconType // Store the preset string as the image_url
        });
        
        setNewMethodName('');
        setNewMethodInstr('');
        setNewMethodMin('');
        setSelectedIconType('preset:card');
        
        alert('Метод оплаты добавлен!');
        refreshAll();
    } catch (e: any) {
        alert("Ошибка добавления метода: " + e.message);
    }
  };

  const handleUpdateManager = async (e: React.FormEvent) => { e.preventDefault(); if(!managerLogin || !managerPass) return; try { await api.updateStaffCredentials('MANAGER', managerLogin, managerPass); setMsgManager('Обновлено!'); setManagerLogin(''); setManagerPass(''); } catch (err: any) { setMsgManager('Ошибка: ' + err.message); } };
  const handleUpdateAdmin = async (e: React.FormEvent) => { e.preventDefault(); if(!adminLogin || !adminPass) return; try { await api.updateStaffCredentials('ADMIN', adminLogin, adminPass); setMsgAdmin('Обновлено!'); setAdminLogin(''); setAdminPass(''); } catch (err: any) { setMsgAdmin('Ошибка: ' + err.message); } };
  const handleRefundSubmit = async () => { if(!refundAmount || !refundReason || !refundModalUser) return; if(!window.confirm(`Вернуть ${refundAmount} ® клиенту ${refundModalUser.name}?`)) return; try { await api.processRefund(refundModalUser.id, parseFloat(refundAmount), refundReason); setRefundAmount(''); setRefundModalUser(null); alert("Возврат успешно выполнен!"); refreshAll(); } catch (e: any) { alert("Ошибка: " + e.message); } };
  const deleteItem = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (!window.confirm('Удалить?')) return; await api.deleteItem(id); await refreshAll(); };
  
  const handleCancelReservation = async (id: string) => {
      if(!window.confirm('Снять резерв с этого товара?')) return;
      try {
          await api.cancelReservation(id);
          alert('Резерв снят!');
          refreshAll();
      } catch (e: any) {
          alert('Ошибка: ' + e.message);
      }
  };

  const handleDeleteUser = async (id: string, e: React.MouseEvent) => { 
      e.stopPropagation(); 
      
      const targetUser = users.find(u => u.id === id);
      if (targetUser && targetUser.balance > 0) {
          alert(`Невозможно удалить пользователя ${targetUser.name}, так как у него есть средства на балансе (${targetUser.balance} ®).`);
          return;
      }

      if (!window.confirm('Удалить пользователя?')) return; 
      await api.deleteUser(id); 
      refreshAll(); 
  };

  const deleteMethod = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); if (!window.confirm('Удалить метод?')) return; await api.deletePaymentMethod(id); await refreshAll(); };
  const handleApproveTx = async (id: string) => { setProcessingTxId(id); try { await api.approveTransaction(id); await refreshAll(); } catch (e: any) { alert('Ошибка: ' + e.message); } finally { setProcessingTxId(null); } };
  const handleRejectTx = async (id: string) => { if(!window.confirm('Отклонить заявку?')) return; setProcessingTxId(id); try { await api.rejectTransaction(id); await refreshAll(); } catch (e: any) { alert('Ошибка: ' + e.message); } finally { setProcessingTxId(null); } };
  const handleMarkViewed = async (id: string, e: React.MouseEvent) => { e.stopPropagation(); setTransactions(prev => prev.map(t => t.id === id ? { ...t, viewed: true } : t)); await api.markTransactionAsViewed(id); refreshAll(); };
  const toggleUserExpansion = (userId: string) => { setExpandedUserId(prev => prev === userId ? null : userId); };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleItemSort = (key: keyof Item) => { setItemSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' })); };
  const toggleUserSort = (key: keyof User) => { setUserSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' })); };

  // --- Derived Data ---
  const visibleTransactions = useMemo(() => {
      const userIds = new Set(users.map(u => u.id));
      return transactions.filter(tx => userIds.has(tx.userId));
  }, [transactions, users]);

  const pendingRequests = visibleTransactions.filter(t => t.status === TransactionStatus.PENDING && t.type !== 'PURCHASE' && t.type !== 'RENT_CHARGE');
  const allWithdrawals = visibleTransactions.filter(t => t.type === 'WITHDRAWAL');
  const allRefunds = visibleTransactions.filter(t => t.type === 'REFUND');
  const allDeposits = visibleTransactions.filter(t => t.type === 'DEPOSIT' && t.status === TransactionStatus.APPROVED);

  // Filter Withdrawals
  const filteredWithdrawals = allWithdrawals.filter(tx => {
      let matchName = true;
      let matchDate = true;
      if (withdrawalSearchQuery) {
          const u = users.find(u => u.id === tx.userId);
          const search = withdrawalSearchQuery.toLowerCase();
          matchName = u ? (u.name.toLowerCase().includes(search) || u.phone.includes(search)) : false;
      }
      if (withdrawalSearchDate) {
          matchDate = new Date(tx.date).toLocaleDateString() === new Date(withdrawalSearchDate).toLocaleDateString();
      }
      return matchName && matchDate;
  });

  // Filter Refunds
  const filteredRefunds = allRefunds.filter(tx => {
      let matchName = true;
      let matchDate = true;
      if (refundSearchQuery) {
          const u = users.find(u => u.id === tx.userId);
          const search = refundSearchQuery.toLowerCase();
          matchName = u ? (u.name.toLowerCase().includes(search) || u.phone.includes(search)) : false;
      }
      if (refundSearchDate) {
          matchDate = new Date(tx.date).toLocaleDateString() === new Date(refundSearchDate).toLocaleDateString();
      }
      return matchName && matchDate;
  });
  
  // Filter Deposits (New)
  const filteredDeposits = allDeposits.filter(tx => {
      let matchName = true;
      let matchDate = true;
      if (depositSearchQuery) {
          const u = users.find(u => u.id === tx.userId);
          const search = depositSearchQuery.toLowerCase();
          matchName = u ? (u.name.toLowerCase().includes(search) || u.phone.includes(search)) : false;
      }
      if (depositSearchDate) {
          matchDate = new Date(tx.date).toLocaleDateString() === new Date(depositSearchDate).toLocaleDateString();
      }
      return matchName && matchDate;
  });
  
  const withdrawalsHistory = expandWithdrawals ? filteredWithdrawals : filteredWithdrawals.slice(0, 10);
  const refundsHistory = expandRefunds ? filteredRefunds : filteredRefunds.slice(0, 10);
  const depositsHistory = expandDeposits ? filteredDeposits : filteredDeposits.slice(0, 10);

  const unviewedIncomeCount = visibleTransactions.filter(t => (t.type === 'PURCHASE' || t.type === 'RENT_CHARGE') && !t.viewed).length;
  
  const sortedItems = [...items].sort((a, b) => {
      const valA = a[itemSort.key] as any;
      const valB = b[itemSort.key] as any;
      if (valA < valB) return itemSort.dir === 'asc' ? -1 : 1;
      if (valA > valB) return itemSort.dir === 'asc' ? 1 : -1;
      return 0;
  });

  const sortedUsers = [...users].sort((a, b) => {
      const valA = a[userSort.key] as any;
      const valB = b[userSort.key] as any;
      if (valA < valB) return userSort.dir === 'asc' ? -1 : 1;
      if (valA > valB) return userSort.dir === 'asc' ? 1 : -1;
      return 0;
  });

  const groupedFinances = useMemo(() => {
      const groups: {[key: string]: Transaction[]} = {};
      visibleTransactions
        .filter(t => t.type === 'PURCHASE' || t.type === 'RENT_CHARGE')
        .forEach(t => {
            if (!groups[t.userId]) groups[t.userId] = [];
            groups[t.userId].push(t);
        });
      return groups;
  }, [visibleTransactions]);


  // Navigation Items
  const navItems = [
    { id: 'deposits', label: 'Заявки', icon: <FileText className="w-5 h-5" />, count: pendingRequests.length },
    { id: 'finances', label: 'Финансы', icon: <TrendingUp className="w-5 h-5" />, count: unviewedIncomeCount },
    { id: 'users', label: 'Пользователи', icon: <Users className="w-5 h-5" /> },
    { id: 'items', label: 'Товары', icon: <Package className="w-5 h-5" /> },
    { id: 'payments', label: 'Метод оплаты', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'settings', label: 'Настройки', icon: <Settings className="w-5 h-5" /> },
  ];
  
  const displayNavItems = navItems.filter(item => {
      if (user?.role === UserRole.ADMIN) {
          if (item.id === 'payments' || item.id === 'settings') return false;
      }
      return true;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <aside className="w-full lg:w-72 flex-shrink-0 space-y-4 sticky top-6 self-start">
         <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 overflow-hidden">
             <nav className="space-y-1.5">
                {displayNavItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as any)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all relative ${
                        activeTab === item.id 
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-200' 
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                        {item.icon}
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.count ? (
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] text-white ${item.id === 'deposits' ? 'bg-orange-500' : 'bg-emerald-500'}`}>
                                {item.count}
                            </span>
                        ) : null}
                    </button>
                ))}
             </nav>
         </div>

         <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
             <h3 className="font-bold text-lg mb-1">Панель</h3>
             <p className="text-indigo-100 text-xs mb-4 opacity-80">Управление магазином</p>
             <button 
                onClick={refreshAll} 
                disabled={isRefreshing}
                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
             >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Обновление...' : 'Обновить данные'}
             </button>
         </div>
      </aside>

      <div className="flex-1 min-w-0 w-full">
        {/* DEPOSITS TAB */}
        {activeTab === 'deposits' && (
            <div className="space-y-6 animate-fade-in">
            {pendingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <CheckCircle2 className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-gray-400 font-medium">Нет новых заявок</p>
                </div>
            ) : (
                <div className="grid gap-4">
                {pendingRequests.map(tx => {
                     const u = users.find(u => u.id === tx.userId); const isWithdrawal = tx.type === 'WITHDRAWAL';
                     return (
                        <div key={tx.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${isWithdrawal ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${isWithdrawal ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{tx.description.startsWith('ЗАПРОС') ? 'Запрос возврата' : (isWithdrawal ? 'Вывод средств' : 'Пополнение')}</span>
                                    <span className="text-xs text-gray-400">{new Date(tx.date).toLocaleString()}</span>
                                </div>
                                <div className="flex items-baseline gap-2 mb-1"><span className="text-2xl font-black text-gray-800">{tx.amount} ®</span><span className="text-sm text-gray-500">от {u?.name}</span></div>
                                {isWithdrawal && <div className="mt-2 bg-gray-50 p-3 rounded-lg text-sm text-gray-700 font-medium">{tx.description.replace('Заявка на вывод: ', '').replace('ЗАПРОС НА ВОЗВРАТ: ', '')}</div>}
                                {!isWithdrawal && tx.receiptUrl && <button onClick={() => setViewingReceipt(tx.receiptUrl || null)} className="mt-3 flex items-center gap-2 text-sm text-indigo-600 font-bold hover:underline"><FileText className="w-4 h-4" /> Смотреть чек</button>}
                            </div>
                            <div className="flex flex-row sm:flex-col gap-2 justify-center border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-6">
                                <button onClick={() => handleApproveTx(tx.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white p-3 rounded-xl shadow-lg shadow-emerald-200"><Check className="w-5 h-5" /></button>
                                <button onClick={() => handleRejectTx(tx.id)} className="bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 p-3 rounded-xl"><X className="w-5 h-5" /></button>
                            </div>
                        </div>
                     )
                })}
                </div>
            )}
            </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                        <th className="p-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => toggleUserSort('name')}>Имя</th>
                        <th className="p-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => toggleUserSort('phone')}>Логин/Телефон</th>
                        <th className="p-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => toggleUserSort('balance')}>Баланс</th>
                        <th className="p-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Роль</th>
                        <th className="p-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {sortedUsers.filter(u => user?.role === UserRole.MANAGER ? u.role !== UserRole.ADMIN : true).map((u, index) => (
                            <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors ${index % 2 !== 0 ? 'bg-emerald-50/40' : 'bg-white'}`}>
                                <td className="p-4 font-bold text-gray-800">{u.name}</td>
                                <td className="p-4 text-sm text-gray-500 font-mono">{u.phone}</td>
                                <td className="p-4 font-mono font-bold text-emerald-600">{u.balance} ®</td>
                                <td className="p-4"><span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${u.role === 'ADMIN' ? 'bg-slate-800 text-white' : u.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'}`}>{u.role}</span></td>
                                <td className="p-4 text-right">
                                    {user?.role === UserRole.MANAGER && u.role === UserRole.USER && (
                                        <button onClick={(e) => handleDeleteUser(u.id, e)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>
            </div>
        )}

        {/* ITEMS TAB */}
        {activeTab === 'items' && (
            <div className="space-y-8 animate-fade-in">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-500" /> Добавить новый товар</h3>
                <form onSubmit={handleAddItem} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <input placeholder="Название товара" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                        <div className="flex gap-4">
                            <input type="number" placeholder="Цена (0 = Free)" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-1/2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                            <input type="number" placeholder="Кол-во" value={newItemQuantity} onChange={e => setNewItemQuantity(e.target.value)} className="w-1/2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                        </div>
                    </div>
                    <textarea placeholder="Описание" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium h-24 resize-none" />
                    <label className="flex items-center gap-3 w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                        <span className={`flex-1 font-medium truncate ${newItemImageName ? 'text-indigo-600' : 'text-gray-400'}`}>{newItemImageName || 'Выберите изображение'}</span>
                        <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                    </label>
                    <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 shadow-lg">Добавить товар</button>
                </form>
            </div>
            <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {sortedItems.map(item => {
                        // Check if item is reserved
                        const isReserved = item.ownerId && (item.status === 'RESERVED' || item.status === 'SOLD');
                        const ownerName = isReserved ? users.find(u => u.id === item.ownerId)?.name : null;

                        return (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 group p-5 flex flex-col gap-4 h-full relative">
                            {isReserved && (
                                <div className="absolute top-0 right-0 z-10 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl uppercase shadow-md">
                                    Зарезервирован
                                </div>
                            )}
                            <div className="w-full h-40 bg-gray-100 rounded-xl overflow-hidden shrink-0 relative">
                                {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Package className="w-12 h-12 opacity-50" /></div>}
                                <div className="absolute top-4 right-4 bg-white/95 px-4 py-2 rounded-xl text-base font-extrabold shadow-md">{item.price > 0 ? `${item.price} ®` : 'Свободная цена'}</div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col">
                                <h4 className="font-bold text-gray-800 truncate text-lg">{item.title}</h4>
                                <div className="flex items-center gap-2 mb-3">{item.quantity === 0 ? <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">Unlimited</span> : <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">x{item.quantity}</span>}</div>
                                
                                {isReserved && (
                                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 mb-3">
                                        <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wide mb-1">Резерв за:</div>
                                        <div className="text-sm font-bold text-orange-800 flex items-center justify-between">
                                            {ownerName || 'Unknown User'}
                                            <button 
                                                onClick={() => handleCancelReservation(item.id)}
                                                className="bg-white hover:bg-orange-100 text-orange-600 p-1.5 rounded-md border border-orange-200 transition-colors"
                                                title="Снять резерв"
                                            >
                                                <Unlock className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mt-auto">
                                    <button onClick={(e) => deleteItem(item.id, e)} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-2 rounded-lg ml-auto"><Trash2 className="w-3 h-3" /> Удалить</button>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            </div>
            </div>
        )}

        {/* FINANCES TAB */}
        {activeTab === 'finances' && (
            <div className="space-y-8 animate-fade-in">
            
            {/* Messages / Purchase History */}
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-gray-800">История покупок (Сообщения)</h3>
                    {user?.role === UserRole.MANAGER && (
                        <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${showArchived ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                            {showArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} {showArchived ? 'Активные' : 'Архив'}
                        </button>
                    )}
                </div>
                
                {Object.keys(groupedFinances).length === 0 ? (
                    <div className="text-center py-10 text-gray-400">Нет покупок</div>
                ) : (
                    Object.entries(groupedFinances)
                    .filter(([userId]) => { const isArchived = archivedUsers.has(userId); return showArchived ? isArchived : !isArchived; })
                    .map(([userId, userTxsRaw]) => {
                        const userTxs = userTxsRaw as Transaction[];
                        const u = users.find(user => user.id === userId);
                        if (!u) return null;
                        const isExpanded = expandedUserId === userId;
                        const hasUnread = userTxs.some(t => !t.viewed);
                        const hasBalance = u.balance > 0;
                        
                        // History Expansion Logic
                        const isFullHistory = fullHistoryUserId === userId;
                        const txsToShow = isFullHistory ? userTxs : userTxs.slice(0, 5);
                        
                        return (
                        <div key={userId} className={`rounded-2xl shadow-sm border transition-all overflow-hidden ${hasUnread ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-100'} ${hasBalance ? 'bg-emerald-100 border-emerald-200' : 'bg-white'}`}>
                            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => toggleUserExpansion(userId)}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${hasUnread ? 'bg-indigo-600' : 'bg-gray-300'}`}>{u.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div className="font-bold text-gray-800 flex items-center gap-2">{u.name}{hasUnread && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}</div>
                                        <div className="text-xs text-gray-400 font-medium">{userTxs.length} покупок</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={(e) => { e.stopPropagation(); setRefundModalUser(u); }} className="p-3 text-orange-600 bg-orange-100 hover:bg-orange-200 rounded-lg shadow-sm"><RotateCcw className="w-5 h-5" /></button>
                                    {user?.role === UserRole.MANAGER && <button onClick={(e) => toggleArchiveUser(userId, e)} className="p-3 text-gray-300 hover:text-indigo-600 rounded-full hover:bg-indigo-50"><Archive className="w-5 h-5" /></button>}
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                </div>
                            </div>
                            {isExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50/30 p-2 space-y-2">
                                    {txsToShow.map(tx => (
                                        <div key={tx.id} onClick={(e) => !tx.viewed && handleMarkViewed(tx.id, e)} className={`p-4 rounded-xl flex items-center justify-between transition-all cursor-pointer ${tx.viewed ? 'bg-gray-50' : 'bg-white border-l-4 border-indigo-500 shadow-sm'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${tx.viewed ? 'bg-gray-200 text-gray-400' : 'bg-emerald-100 text-emerald-600'}`}>{tx.description.includes('Донат') ? <ArrowDownLeft className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}</div>
                                                <div><div className="font-bold text-sm text-gray-900">{tx.description}</div><div className="text-xs text-gray-400">{new Date(tx.date).toLocaleString()}</div></div>
                                            </div>
                                            <div className="text-right"><div className={`font-black text-sm ${tx.viewed ? 'text-gray-400' : 'text-emerald-600'}`}>+{tx.amount} ®</div>{tx.viewed && <CheckCircle2 className="w-6 h-6 text-green-500 ml-auto mt-1" />}</div>
                                        </div>
                                    ))}
                                    
                                    {/* Show All / Collapse Button */}
                                    {userTxs.length > 5 && (
                                        <div className="pt-2 flex justify-center">
                                            {isFullHistory ? (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setFullHistoryUserId(null); }}
                                                    className="text-xs font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1 py-2 px-4 rounded-lg hover:bg-white transition-colors"
                                                >
                                                    Свернуть <ChevronUp className="w-3 h-3" />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setFullHistoryUserId(userId); }}
                                                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1 py-2 px-4 rounded-lg transition-colors border border-indigo-100"
                                                >
                                                    Открыть остальные ({userTxs.length - 5}) <ChevronDown className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )})
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Withdrawal History Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-orange-500" /> История вывода и возврата (Отправлен запрос от клиента)</h3>
                    </div>
                    <div className="p-4 border-b border-gray-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="text" placeholder="Имя или телефон..." value={withdrawalSearchQuery} onChange={(e) => setWithdrawalSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50" /></div>
                        <div className="relative"><Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="date" value={withdrawalSearchDate} onChange={(e) => setWithdrawalSearchDate(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50 text-gray-600" /></div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <tbody className="divide-y divide-gray-50">
                                {withdrawalsHistory.map(tx => {
                                    const u = users.find(u => u.id === tx.userId); 
                                    const isRefund = tx.description?.includes('ЗАПРОС НА ВОЗВРАТ') || tx.description?.includes('Возврат средств');
                                    return (
                                    <tr key={tx.id} className="group hover:bg-gray-50/50">
                                        <td className="p-4"><div className="flex flex-col"><span className="font-bold text-xs text-gray-800">{u?.name}</span><span className="text-[10px] text-gray-400">{new Date(tx.date).toLocaleDateString()}</span></div></td>
                                        <td className="p-4"><div className={`font-extrabold text-xs ${isRefund ? 'text-purple-600' : 'text-green-600'}`}>{tx.amount} ®</div><div className={`text-[10px] font-bold uppercase ${isRefund ? 'text-purple-600' : 'text-green-600'}`}>{isRefund ? 'Возврат' : 'Вывод'}</div></td>
                                        <td className="p-4"><div className="flex flex-col">{tx.status === TransactionStatus.APPROVED && <span className={`text-[10px] font-bold uppercase mb-1 ${isRefund ? 'text-purple-600' : 'text-green-600'}`}>{isRefund ? 'Выполнено' : 'Списано'}</span>}<div className="text-sm font-medium text-gray-700 whitespace-normal">{tx.description.replace('Заявка на вывод: ', '').replace('ЗАПРОС НА ВОЗВРАТ: ', '')}</div></div></td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                    {filteredWithdrawals.length > 10 && <button onClick={() => setExpandWithdrawals(!expandWithdrawals)} className="w-full py-3 text-xs font-bold text-gray-400 hover:text-indigo-600 hover:bg-gray-50 transition-colors border-t border-gray-100 flex items-center justify-center gap-1">{expandWithdrawals ? <>Свернуть <ChevronUp className="w-3 h-3" /></> : <>Показать все ({filteredWithdrawals.length}) <ChevronDown className="w-3 h-3" /></>}</button>}
                </div>

                {/* Refund History Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><RotateCcw className="w-5 h-5 text-purple-500" /> История возвратов клиентам от администратора</h3>
                    </div>
                    {/* SEARCH FOR REFUNDS */}
                    <div className="p-4 border-b border-gray-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="text" placeholder="Имя или телефон..." value={refundSearchQuery} onChange={(e) => setRefundSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50" /></div>
                        <div className="relative"><Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="date" value={refundSearchDate} onChange={(e) => setRefundSearchDate(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50/50 text-gray-600" /></div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <tbody className="divide-y divide-gray-50">
                                {refundsHistory.map(tx => {
                                    const u = users.find(u => u.id === tx.userId);
                                    return (
                                    <tr key={tx.id} className="hover:bg-gray-50/50">
                                        <td className="py-4 px-4 font-bold text-gray-700 text-xs">{u?.name}<div className="text-[10px] font-normal text-gray-400">{new Date(tx.date).toLocaleDateString()}</div></td>
                                        <td className="py-4 font-extrabold text-xs text-red-800">{tx.amount} ®</td>
                                        <td className="py-4"><div className="flex flex-col items-start gap-1"><span className="bg-red-100 text-red-800 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">Выполнено</span><span className="text-xs text-gray-500 font-medium whitespace-normal max-w-[200px]">{tx.description.replace('Возврат средств: ', '')}</span></div></td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                    {filteredRefunds.length > 10 && <button onClick={() => setExpandRefunds(!expandRefunds)} className="w-full py-3 text-xs font-bold text-gray-400 hover:text-indigo-600 hover:bg-gray-50 transition-colors border-t border-gray-100 flex items-center justify-center gap-1">{expandRefunds ? <>Свернуть <ChevronUp className="w-3 h-3" /></> : <>Показать все ({filteredRefunds.length}) <ChevronDown className="w-3 h-3" /></>}</button>}
                </div>
            </div>

            {/* NEW SECTION: Deposit History */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-6">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><ArrowDownLeft className="w-5 h-5 text-emerald-500" /> История пополнений (Одобрено)</h3>
                </div>
                <div className="p-4 border-b border-gray-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="text" placeholder="Имя или телефон..." value={depositSearchQuery} onChange={(e) => setDepositSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50/50" /></div>
                    <div className="relative"><Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="date" value={depositSearchDate} onChange={(e) => setDepositSearchDate(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-50/50 text-gray-600" /></div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <tbody className="divide-y divide-gray-50">
                            {depositsHistory.map(tx => {
                                const u = users.find(u => u.id === tx.userId);
                                return (
                                <tr key={tx.id} className="hover:bg-gray-50/50 group">
                                    <td className="py-4 px-4 font-bold text-gray-700 text-xs">{u?.name}<div className="text-[10px] font-normal text-gray-400">{new Date(tx.date).toLocaleDateString()}</div></td>
                                    <td className="py-4 font-extrabold text-xs text-emerald-600">+{tx.amount} ®</td>
                                    <td className="py-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">Одобрено</span>
                                        </div>
                                    </td>
                                    <td className="py-4 text-right pr-4">
                                         {tx.receiptUrl && (
                                            <button 
                                                onClick={() => setViewingReceipt(tx.receiptUrl || null)}
                                                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 justify-end"
                                            >
                                                <FileText className="w-3 h-3" /> Чек
                                            </button>
                                         )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                {filteredDeposits.length > 10 && <button onClick={() => setExpandDeposits(!expandDeposits)} className="w-full py-3 text-xs font-bold text-gray-400 hover:text-indigo-600 hover:bg-gray-50 transition-colors border-t border-gray-100 flex items-center justify-center gap-1">{expandDeposits ? <>Свернуть <ChevronUp className="w-3 h-3" /></> : <>Показать все ({filteredDeposits.length}) <ChevronDown className="w-3 h-3" /></>}</button>}
            </div>
            
            {/* Modal for User Refund (unchanged) */}
            {refundModalUser && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-zoom-in">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <h3 className="font-bold text-lg text-red-800 flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Возврат для {refundModalUser.name}</h3>
                            <button onClick={() => setRefundModalUser(null)} className="p-2 hover:bg-red-100 rounded-full transition-colors text-red-500"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Причина / Тип возврата</label><select value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium transition-all text-sm appearance-none"><option value="Выплата клиенту на карту со списанием с внутренего кошелька">Выплата клиенту на карту со списанием с внутренего кошелька</option><option value="Подарочный бонус">Подарочный бонус</option><option value="Сбой (претензия от клиента)">Сбой (претензия от клиента)</option></select></div>
                            <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Сумма (®)</label><input type="number" placeholder="0.00" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900 transition-all text-2xl" /></div>
                            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500">Баланс клиента: <span className="font-bold text-gray-800">{refundModalUser.balance} ®</span></div>
                        </div>
                        <div className="p-6 pt-0"><button onClick={handleRefundSubmit} className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200">Подтвердить возврат</button></div>
                    </div>
                </div>
            )}
            </div>
        )}

        {/* PAYMENT METHODS TAB - UPDATED WITH ICON SELECTION */}
        {activeTab === 'payments' && (
            <div className="space-y-8 animate-fade-in">
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-500" /> Добавить метод оплаты</h3>
                <form onSubmit={handleAddMethod} className="space-y-5">
                <input placeholder="Название (напр. Сбербанк)" value={newMethodName} onChange={e => setNewMethodName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all" />
                <textarea placeholder="Инструкция и реквизиты" value={newMethodInstr} onChange={e => setNewMethodInstr(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all h-24 resize-none" />
                <input type="number" placeholder="Мин. сумма (необязательно)" value={newMethodMin} onChange={e => setNewMethodMin(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all" />
                
                {/* ICON SELECTION */}
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Выберите иконку метода</label>
                    <div className="flex gap-4 flex-wrap">
                        {[
                            { id: 'preset:card', label: 'Карты', icon: <PaymentIcon imageUrl="preset:card" /> },
                            { id: 'preset:crypto', label: 'Крипто', icon: <PaymentIcon imageUrl="preset:crypto" /> },
                            { id: 'preset:master', label: 'Master', icon: <PaymentIcon imageUrl="preset:master" /> },
                            { id: 'preset:mir', label: 'Mir Pay', icon: <PaymentIcon imageUrl="preset:mir" /> },
                            { id: 'preset:visa', label: 'Visa', icon: <PaymentIcon imageUrl="preset:visa" /> },
                        ].map(type => (
                            <div 
                                key={type.id}
                                onClick={() => setSelectedIconType(type.id)}
                                className={`cursor-pointer rounded-xl p-3 border-2 transition-all flex flex-col items-center gap-2 min-w-[80px] ${selectedIconType === type.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-100 hover:bg-gray-50'}`}
                            >
                                <div className="scale-125">{type.icon}</div>
                                <span className={`text-[10px] font-bold uppercase ${selectedIconType === type.id ? 'text-indigo-700' : 'text-gray-400'}`}>{type.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg">Добавить метод</button>
                </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {methods.map(m => (
                <div key={m.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-md transition-all">
                    <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3 w-full">
                            <div className="shrink-0 scale-125 origin-left ml-1">
                                <PaymentIcon imageUrl={m.imageUrl} />
                            </div>
                            <h4 className="font-bold text-gray-800 text-lg self-center">{m.name}</h4>
                        </div>
                        {m.minAmount && m.minAmount > 0 && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded uppercase shrink-0">Min {m.minAmount}</span>}
                    </div>
                    <p className="text-sm text-gray-500 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">{m.instruction}</p>
                    </div>
                    <button onClick={(e) => deleteMethod(m.id, e)} className="w-full text-red-500 bg-red-50 hover:bg-red-100 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Удалить метод</button>
                </div>
                ))}
            </div>
            </div>
        )}

        {/* SETTINGS (unchanged) */}
        {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="text-center mb-8"><div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-slate-200"><Settings className="w-8 h-8" /></div><h2 className="text-2xl font-extrabold text-slate-800">Управление доступом</h2><p className="text-slate-500 font-medium">Смена паролей сотрудников</p></div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100"><h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-600" /> Доступ Админа</h3><form onSubmit={handleUpdateAdmin} className="space-y-4"><div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Новый логин</label><input value={adminLogin} onChange={e => setAdminLogin(e.target.value)} placeholder="Новый логин" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all" /></div><div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Новый пароль</label><input value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder="Новый пароль" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium transition-all" /></div>{msgAdmin && <p className={`text-sm font-bold ${msgAdmin.includes('Ошибка') ? 'text-red-500' : 'text-emerald-500'}`}>{msgAdmin}</p>}<button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">Обновить данные Админа</button></form></div>
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100"><h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><UserIcon className="w-5 h-5 text-purple-600" /> Доступ Менеджера</h3><form onSubmit={handleUpdateManager} className="space-y-4"><div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Новый логин</label><input value={managerLogin} onChange={e => setManagerLogin(e.target.value)} placeholder="Новый логин" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium transition-all" /></div><div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Новый пароль</label><input value={managerPass} onChange={e => setManagerPass(e.target.value)} placeholder="Новый пароль" type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium transition-all" /></div>{msgManager && <p className={`text-sm font-bold ${msgManager.includes('Ошибка') ? 'text-red-500' : 'text-emerald-500'}`}>{msgManager}</p>}<button type="submit" className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200">Обновить данные Менеджера</button></form></div>
            </div>
        )}

        {/* Receipt Viewer Modal */}
        {viewingReceipt && (
            <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setViewingReceipt(null)}>
                <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setViewingReceipt(null)} className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"><X className="w-8 h-8" /></button>
                    <img src={viewingReceipt} alt="Receipt" className="w-full h-full object-contain rounded-lg shadow-2xl" />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
