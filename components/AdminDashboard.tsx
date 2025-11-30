
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { Item, User, PaymentMethod, ItemStatus, UserRole, Transaction, TransactionStatus } from '../types';
import { Users, Package, CreditCard, Plus, Trash2, RefreshCw, FileText, Check, X, ExternalLink, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, ChevronDown, ChevronUp, User as UserIcon, Phone, Settings, Shield, LayoutGrid, ArrowUpRight, ArrowDownLeft, Lock, UserCog, CornerUpLeft, Info, HelpCircle, Upload, Image as ImageIcon } from 'lucide-react';

interface AdminDashboardProps {
  user: User | null;
}

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
  
  // Refund Form State
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Form states
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState(''); 
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('1'); // Default to 1
  const [newItemImage, setNewItemImage] = useState(''); // Base64 string
  const [newItemImageName, setNewItemImageName] = useState(''); // For display
  
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodInstr, setNewMethodInstr] = useState('');
  const [newMethodMin, setNewMethodMin] = useState('');

  // Settings State - Manager
  const [managerLogin, setManagerLogin] = useState('');
  const [managerPass, setManagerPass] = useState('');
  const [msgManager, setMsgManager] = useState('');

  // Settings State - Admin
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [msgAdmin, setMsgAdmin] = useState('');

  // Receipt viewing state
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  useEffect(() => {
    refreshAll();
  }, []);

  const refreshAll = async () => {
    const i = await api.getItems();
    const u = await api.getUsers();
    const m = await api.getPaymentMethods();
    const t = await api.getTransactions();
    setItems(i);
    setUsers(u);
    setMethods(m);
    setTransactions(t);
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
    if (!newMethodName || !newMethodInstr) return;
    
    const minVal = parseFloat(newMethodMin);

    await api.addPaymentMethod({
      name: newMethodName,
      instruction: newMethodInstr,
      isActive: true,
      minAmount: isNaN(minVal) ? 0 : minVal
    });
    setNewMethodName('');
    setNewMethodInstr('');
    setNewMethodMin('');
    refreshAll();
  };

  const handleUpdateManager = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!managerLogin || !managerPass) {
          setMsgManager('Заполните все поля');
          return;
      }
      try {
          await api.updateStaffCredentials('MANAGER', managerLogin, managerPass);
          setMsgManager('Данные Менеджера обновлены!');
          setManagerLogin('');
          setManagerPass('');
          setTimeout(() => setMsgManager(''), 3000);
      } catch (err: any) {
          setMsgManager('Ошибка: ' + err.message);
      }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!adminLogin || !adminPass) {
          setMsgAdmin('Заполните все поля');
          return;
      }
      try {
          await api.updateStaffCredentials('ADMIN', adminLogin, adminPass);
          setMsgAdmin('Данные Админа обновлены!');
          setAdminLogin('');
          setAdminPass('');
          setTimeout(() => setMsgAdmin(''), 3000);
      } catch (err: any) {
          setMsgAdmin('Ошибка: ' + err.message);
      }
  };

  const handleRefund = async (userId: string) => {
      if(!refundAmount || !refundReason) {
          alert("Заполните сумму и причину возврата");
          return;
      }
      if(!window.confirm(`Вернуть ${refundAmount} P клиенту?`)) return;

      try {
          await api.processRefund(userId, parseFloat(refundAmount), refundReason);
          setRefundAmount('');
          setRefundReason('');
          alert("Возврат успешно выполнен!");
          refreshAll();
      } catch (e: any) {
          alert("Ошибка: " + e.message);
      }
  };

  const forceRestock = async (itemId: string) => {
    await api.restockItem(itemId);
    await refreshAll();
  };

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    
    const item = items.find(i => i.id === id);
    if (!item) return;

    let confirmMsg = 'Вы уверены, что хотите удалить этот товар безвозвратно?';
    if (item.status === ItemStatus.RESERVED || item.status === ItemStatus.SOLD) {
        confirmMsg = '⚠️ ВНИМАНИЕ: Товар находится в резерве!\n\nСредства НЕ будут возвращены покупателю.\n\nВы действительно хотите удалить товар?';
    }

    if (!window.confirm(confirmMsg)) return;
    
    await api.deleteItem(id);
    await refreshAll();
  };

  const handleDeleteUser = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm('Вы действительно хотите удалить этого пользователя? Все его транзакции и товары будут удалены.')) return;
      try {
          await api.deleteUser(id);
          refreshAll();
      } catch (err: any) {
          alert('Ошибка удаления: ' + err.message);
      }
  };

  const deleteMethod = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Удалить метод оплаты?')) return;
    await api.deletePaymentMethod(id);
    await refreshAll();
  };

  const handleApproveTx = async (id: string) => {
      try {
        await api.approveTransaction(id);
        await refreshAll();
      } catch (e: any) {
        alert('Ошибка: ' + e.message);
      }
  };

  const handleRejectTx = async (id: string) => {
      if(!window.confirm('Вы действительно хотите отклонить заявку? Если это вывод средств, деньги вернутся на баланс пользователя.')) return;
      try {
        await api.rejectTransaction(id);
        await refreshAll();
      } catch (e: any) {
         alert('Ошибка: ' + e.message);
      }
  };

  const handleMarkViewed = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation(); 
      await api.markTransactionAsViewed(id);
      refreshAll();
  };

  const toggleUserExpansion = (userId: string) => {
      setExpandedUserId(prev => prev === userId ? null : userId);
      setRefundAmount('');
      setRefundReason('');
  };

  // Sorting Helpers
  const toggleItemSort = (key: keyof Item) => {
    setItemSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleUserSort = (key: keyof User) => {
    setUserSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (currentSort: { key: string; dir: 'asc' | 'desc' }, key: string) => {
    if (currentSort.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return currentSort.dir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />;
  };

  // Filter transactions to only those belonging to visible users
  const visibleTransactions = useMemo(() => {
    const userIds = new Set(users.map(u => u.id));
    return transactions.filter(t => userIds.has(t.userId));
  }, [transactions, users]);

  // Include WITHDRAWAL in pending requests
  const pendingRequests = visibleTransactions.filter(t => 
      t.status === TransactionStatus.PENDING && 
      (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
  );
  
  const unviewedIncomeCount = visibleTransactions.filter(t => (t.type === 'PURCHASE' || t.type === 'RENT_CHARGE') && !t.viewed).length;
  
  const refundsHistory = visibleTransactions.filter(t => t.type === 'REFUND');
  const withdrawalsHistory = visibleTransactions.filter(t => t.type === 'WITHDRAWAL');

  const groupedFinances = useMemo(() => {
    const incomeTransactions = visibleTransactions.filter(t => t.type === 'PURCHASE' || t.type === 'RENT_CHARGE');
    
    const groups: Record<string, { user: User | undefined, txs: Transaction[], total: number, lastDate: number, hasUnread: boolean }> = {};

    incomeTransactions.forEach(tx => {
        if (!groups[tx.userId]) {
            const user = users.find(u => u.id === tx.userId);
            groups[tx.userId] = {
                user,
                txs: [],
                total: 0,
                lastDate: 0,
                hasUnread: false
            };
        }
        groups[tx.userId].txs.push(tx);
        groups[tx.userId].total += tx.amount;
        
        const txDate = new Date(tx.date).getTime();
        if (txDate > groups[tx.userId].lastDate) {
            groups[tx.userId].lastDate = txDate;
        }

        if (!tx.viewed) {
            groups[tx.userId].hasUnread = true;
        }
    });

    return Object.values(groups).sort((a, b) => b.lastDate - a.lastDate);
  }, [visibleTransactions, users]);


  const sortedItems = [...items].sort((a, b) => {
    const valA = a[itemSort.key];
    const valB = b[itemSort.key];
    if (valA === valB) return 0;
    if (valA < valB) return itemSort.dir === 'asc' ? -1 : 1;
    return itemSort.dir === 'asc' ? 1 : -1;
  });

  const sortedUsers = [...users]
    .filter(u => u.role !== UserRole.ADMIN) 
    .sort((a, b) => {
        const valA = a[userSort.key];
        const valB = b[userSort.key];
        if (valA === valB) return 0;
        if (valA < valB) return userSort.dir === 'asc' ? -1 : 1;
        return userSort.dir === 'asc' ? 1 : -1;
    });

  // Navigation Items Config
  // SWAPPED USERS AND ITEMS as requested
  const navItems = [
      { id: 'deposits', label: 'Заявки', icon: FileText, count: pendingRequests.length },
      { id: 'finances', label: 'Финансы', icon: TrendingUp, count: unviewedIncomeCount },
      { id: 'users', label: 'Юзеры', icon: Users },
      { id: 'items', label: 'Товары', icon: Package },
  ];

  // ONLY MANAGER can see Payments and Settings
  if (user?.role === UserRole.MANAGER) {
      navItems.push({ id: 'payments', label: 'Метод оплаты', icon: CreditCard } as any);
      navItems.push({ id: 'settings', label: 'Настр.', icon: Settings } as any);
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[80vh] gap-6 pb-24 md:pb-0 relative">
      
      {/* Receipt Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setViewingReceipt(null)}>
            <div className="bg-white p-2 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
                <div className="absolute top-4 right-4 z-10">
                    <button onClick={() => setViewingReceipt(null)} className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-auto custom-scrollbar rounded-xl">
                    <img src={viewingReceipt} alt="Receipt" className="w-full h-auto object-contain" />
                </div>
                <div className="p-4 text-center">
                    <a href={viewingReceipt} download="receipt.png" className="text-indigo-600 font-bold hover:underline">Скачать изображение</a>
                </div>
            </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 gap-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-3 h-fit sticky top-24">
         <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Меню</div>
         {navItems.map(item => (
             <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${activeTab === item.id ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
             >
                 <item.icon className="w-5 h-5" />
                 <span className="flex-1 text-left">{item.label}</span>
                 {item.count !== undefined && item.count > 0 && (
                     <span className={`px-2 py-0.5 rounded-md text-xs ${activeTab === item.id ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                         {item.count}
                     </span>
                 )}
             </button>
         ))}
         <button onClick={refreshAll} className="mt-4 flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-blue-600 transition-colors text-sm font-bold border-t border-gray-100">
             <RefreshCw className="w-5 h-5" />
             Обновить данные
         </button>
      </aside>

      {/* MOBILE HEADER (Refresh only) */}
      <div className="md:hidden bg-slate-800 text-white p-4 rounded-xl flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">Админ Панель</h2>
        <button onClick={refreshAll} className="p-2 hover:bg-slate-700 rounded-full">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 w-full min-w-0">
        
        {/* CONTENT: DEPOSITS & WITHDRAWALS */}
        {activeTab === 'deposits' && (
            <div className="space-y-4">
                <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl mb-4">Заявки (Ввод/Вывод)</h3>
                {pendingRequests.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl text-gray-500 border-2 border-dashed">
                        Нет новых заявок
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {pendingRequests.map(tx => {
                            const user = users.find(u => u.id === tx.userId);
                            const isWithdrawal = tx.type === 'WITHDRAWAL';
                            return (
                                <div key={tx.id} className={`bg-white p-5 rounded-2xl shadow-sm border border-l-4 flex flex-col h-full ${isWithdrawal ? 'border-l-indigo-500' : 'border-l-emerald-500'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="font-bold text-xl text-gray-800">{user?.name || 'Unknown'}</div>
                                            <div className="text-sm text-gray-500 font-medium">{user?.phone}</div>
                                            <div className="text-xs text-gray-400 mt-1">{new Date(tx.date).toLocaleString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-extrabold text-2xl flex items-center justify-end gap-1 ${isWithdrawal ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                                {isWithdrawal ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                                                {tx.amount} P
                                            </div>
                                            <div className={`text-xs px-2 py-1 rounded font-bold inline-block mt-2 ${isWithdrawal ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {isWithdrawal ? 'Заявка на вывод' : 'Пополнение счета'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Transaction Details / Receipt */}
                                    <div className="bg-gray-50 p-4 rounded-xl mb-5 border border-gray-100 mt-auto">
                                        {isWithdrawal ? (
                                            <div>
                                                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Реквизиты клиента</div>
                                                <div className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{tx.description.replace('Заявка на вывод: ', '')}</div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                                                    <FileText className="w-5 h-5 text-gray-400" />
                                                    Чек/Скриншот
                                                </div>
                                                {tx.receiptUrl && (
                                                    <button 
                                                        onClick={() => setViewingReceipt(tx.receiptUrl || null)}
                                                        className="text-sm text-blue-600 font-bold underline cursor-pointer flex items-center gap-1 hover:text-blue-700"
                                                    >
                                                        Посмотреть <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleApproveTx(tx.id)}
                                            className={`flex-1 text-white py-3 rounded-xl font-extrabold text-sm flex justify-center items-center gap-2 active:scale-[0.98] transition-all shadow-md ${isWithdrawal ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}
                                        >
                                            <Check className="w-4 h-4" /> {isWithdrawal ? 'Подтвердить списание' : 'Принять'}
                                        </button>
                                        <button 
                                            onClick={() => handleRejectTx(tx.id)}
                                            className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-extrabold text-sm flex justify-center items-center gap-2 hover:bg-red-100 active:scale-[0.98] transition-all"
                                        >
                                            <X className="w-4 h-4" /> {isWithdrawal ? 'Вернуть средства' : 'Отклонить'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {/* CONTENT: FINANCES (GROUPED BY USER) */}
        {activeTab === 'finances' && (
            <div className="space-y-8">
                {/* 1. INCOME Section */}
                <div>
                    <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl mb-4">Поступления от клиентов</h3>
                    {groupedFinances.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border-2 border-dashed">Пока нет оплат</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {groupedFinances.map(group => {
                                if (!group.user) return null;
                                const isExpanded = expandedUserId === group.user.id;
                                const sortedTxs = [...group.txs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                                return (
                                    <div key={group.user.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
                                        {/* User Header Summary */}
                                        <div 
                                            onClick={() => toggleUserExpansion(group.user!.id)}
                                            className={`p-5 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                                        {group.user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {group.hasUnread && !isExpanded && (
                                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800 text-lg leading-tight">{group.user.name}</div>
                                                    <div className="text-sm text-gray-500 font-medium">{group.user.phone}</div>
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="font-extrabold text-lg text-emerald-600">+{group.total} P</div>
                                                <div className="text-xs text-gray-400 flex items-center justify-end gap-1 mt-1">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Transactions List & Refund Form */}
                                        {isExpanded && (
                                            <div className="bg-slate-50 border-t border-gray-100 px-4 py-4 animate-slide-up">
                                                {/* Refund Action Section */}
                                                <div className="mb-6 bg-red-50 p-4 rounded-xl border border-red-100">
                                                    <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                                                        <CornerUpLeft className="w-4 h-4" />
                                                        Сделать возврат клиенту
                                                    </h4>
                                                    <div className="flex flex-col md:flex-row gap-3">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Сумма возврата (P)" 
                                                            value={refundAmount}
                                                            onChange={e => setRefundAmount(e.target.value)}
                                                            className="flex-1 p-2.5 rounded-lg border border-red-200 text-sm focus:border-red-500 outline-none"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Причина (например, отмена услуги)" 
                                                            value={refundReason}
                                                            onChange={e => setRefundReason(e.target.value)}
                                                            className="flex-[2] p-2.5 rounded-lg border border-red-200 text-sm focus:border-red-500 outline-none"
                                                        />
                                                        <button 
                                                            onClick={() => handleRefund(group.user!.id)}
                                                            className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-red-700 active:scale-95 transition-all"
                                                        >
                                                            Вернуть
                                                        </button>
                                                    </div>
                                                </div>

                                                <h4 className="font-bold text-gray-400 text-xs uppercase mb-3">История покупок</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {sortedTxs.map(tx => (
                                                        <div 
                                                            key={tx.id} 
                                                            onClick={(e) => handleMarkViewed(tx.id, e)}
                                                            className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-300 relative cursor-pointer h-full ${
                                                                tx.viewed ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-100 shadow-sm hover:border-blue-300'
                                                            }`}
                                                        >
                                                            <div className="mb-2">
                                                                <div className="font-bold text-gray-800 text-sm">{tx.description}</div>
                                                                <div className="text-xs text-gray-400 mt-1">{new Date(tx.date).toLocaleString()}</div>
                                                            </div>
                                                            <div className="flex justify-between items-end mt-auto">
                                                                <div className={`font-bold text-lg ${tx.viewed ? 'text-gray-400' : 'text-emerald-600'}`}>+{tx.amount} P</div>
                                                                <CheckCircle2 className={`w-6 h-6 ${tx.viewed ? 'text-green-500' : 'text-gray-200'}`} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* 2. WITHDRAWAL HISTORY Section */}
                <div className="pt-8 border-t border-gray-200">
                    <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl mb-4 flex items-center gap-2">
                        <ArrowUpRight className="w-6 h-6 text-indigo-500" />
                        История выводов (Отправлено клиентам)
                    </h3>
                    {withdrawalsHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl text-sm font-medium">История выводов пуста</div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="p-4">Клиент</th>
                                        <th className="p-4">Сумма</th>
                                        <th className="p-4 hidden md:table-cell">Реквизиты</th>
                                        <th className="p-4">Статус</th>
                                        <th className="p-4 hidden md:table-cell">Дата</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {withdrawalsHistory.map(tx => {
                                        const u = users.find(user => user.id === tx.userId);
                                        return (
                                            <tr key={tx.id} className="hover:bg-gray-50/50">
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800">{u ? u.name : 'Unknown'}</div>
                                                    <div className="text-xs text-gray-400 md:hidden">{new Date(tx.date).toLocaleDateString()}</div>
                                                </td>
                                                <td className="p-4 font-bold text-indigo-600">-{tx.amount} P</td>
                                                <td className="p-4 text-gray-600 font-mono text-xs hidden md:table-cell">{tx.description.replace('Заявка на вывод: ', '')}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                                                        tx.status === TransactionStatus.APPROVED ? 'bg-green-100 text-green-700' :
                                                        tx.status === TransactionStatus.REJECTED ? 'bg-red-100 text-red-700' :
                                                        'bg-orange-100 text-orange-700'
                                                    }`}>
                                                        {tx.status === TransactionStatus.APPROVED ? 'Успешно' :
                                                         tx.status === TransactionStatus.REJECTED ? 'Отклонено' : 'Ожидание'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-400 text-xs hidden md:table-cell">{new Date(tx.date).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 3. REFUND HISTORY Section */}
                <div className="pt-8 border-t border-gray-200">
                    <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl mb-4 flex items-center gap-2">
                        <CornerUpLeft className="w-6 h-6 text-red-500" />
                        История возвратов клиентам
                    </h3>
                    {refundsHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl text-sm font-medium">История возвратов пуста</div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="p-4">Клиент</th>
                                        <th className="p-4">Сумма</th>
                                        <th className="p-4">Причина</th>
                                        <th className="p-4 hidden md:table-cell">Дата</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {refundsHistory.map(tx => {
                                        const u = users.find(user => user.id === tx.userId);
                                        return (
                                            <tr key={tx.id} className="hover:bg-gray-50/50">
                                                <td className="p-4 font-bold text-gray-800">{u ? u.name : 'Unknown'}</td>
                                                <td className="p-4 font-bold text-red-500">-{tx.amount} P</td>
                                                <td className="p-4 text-gray-600">{tx.description.replace('Возврат средств: ', '')}</td>
                                                <td className="p-4 text-gray-400 text-xs hidden md:table-cell">{new Date(tx.date).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* CONTENT: ITEMS */}
        {activeTab === 'items' && (
            <div className="space-y-6">
            <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl">Управление товарами</h3>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold mb-4 text-lg">Добавить новый товар</h3>
                <form onSubmit={handleAddItem} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input 
                            placeholder="Название" 
                            value={newItemTitle}
                            onChange={e => setNewItemTitle(e.target.value)}
                            className="border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition-colors font-medium w-full" 
                        />
                         {/* Replaced Text Input with File Upload + Text Fallback */}
                         <div className="relative">
                            <label className="flex items-center gap-3 w-full border-2 border-gray-100 border-dashed p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <Upload className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-gray-700 truncate">
                                        {newItemImageName || "Выберите изображение"}
                                    </div>
                                    <div className="text-xs text-gray-400">JPG, PNG, WEBP</div>
                                </div>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleImageFileChange}
                                    className="hidden" 
                                />
                            </label>
                         </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        {/* Price Input with Tooltip */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Цена (RUB)</label>
                                <div className="group relative">
                                    <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        0 = Клиент сам вводит сумму (Донат/Свободная цена)
                                    </div>
                                </div>
                            </div>
                            <input 
                                placeholder="0" 
                                type="number"
                                value={newItemPrice}
                                onChange={e => setNewItemPrice(e.target.value)}
                                className="border-2 border-white p-3 rounded-xl focus:border-blue-500 outline-none transition-colors font-medium w-full shadow-sm" 
                            />
                            <div className="text-[10px] text-gray-400 mt-1 pl-1">
                                {parseFloat(newItemPrice) === 0 || !newItemPrice ? "Свободная цена" : "Фиксированная стоимость"}
                            </div>
                        </div>

                        {/* Quantity Input with Tooltip */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Количество (Шт)</label>
                                <div className="group relative">
                                    <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        0 = Неограниченное количество (Товар всегда доступен)
                                    </div>
                                </div>
                            </div>
                            <input 
                                placeholder="1" 
                                type="number"
                                value={newItemQuantity}
                                onChange={e => setNewItemQuantity(e.target.value)}
                                className="border-2 border-white p-3 rounded-xl focus:border-blue-500 outline-none transition-colors font-medium w-full shadow-sm" 
                            />
                            <div className="text-[10px] text-gray-400 mt-1 pl-1">
                                {parseFloat(newItemQuantity) === 0 ? "Бесконечный товар" : "Ограниченный запас"}
                            </div>
                        </div>
                    </div>
                    
                    <textarea 
                        placeholder="Описание товара..." 
                        value={newItemDesc}
                        onChange={e => setNewItemDesc(e.target.value)}
                        className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition-colors font-medium h-24 resize-none" 
                    />

                    <button className="w-full bg-green-600 text-white p-3 rounded-xl font-extrabold text-base flex justify-center items-center gap-2 shadow-lg hover:shadow-xl hover:bg-green-700 transition-all active:scale-[0.98]">
                        <Plus className="w-5 h-5" /> Добавить товар
                    </button>
                </form>
            </div>

            <div className="space-y-4">
                {/* Sort Controls */}
                <div className="flex gap-2 overflow-x-auto pb-2 px-1">
                <button onClick={() => toggleItemSort('title')} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-bold transition-colors">
                    Название {getSortIcon(itemSort, 'title')}
                </button>
                <button onClick={() => toggleItemSort('price')} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-bold transition-colors">
                    Цена {getSortIcon(itemSort, 'price')}
                </button>
                <button onClick={() => toggleItemSort('status')} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-bold transition-colors">
                    Статус {getSortIcon(itemSort, 'status')}
                </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedItems.map(item => {
                    const owner = item.ownerId ? users.find(u => u.id === item.ownerId) : null;
                    return (
                        <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="flex flex-row md:flex-col gap-4 mb-4 flex-1">
                                {item.imageUrl ? (
                                    <div className="w-24 h-24 md:w-full md:h-48 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 md:w-full md:h-48 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300 shrink-0">
                                        <ImageIcon className="w-8 h-8" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <div className="font-extrabold text-lg text-gray-800 break-words leading-tight">{item.title}</div>
                                    
                                    <div className="text-sm text-gray-600 font-medium mt-1">
                                        {(item.status === ItemStatus.RESERVED || item.status === ItemStatus.SOLD) && item.lastPurchasePrice !== undefined
                                            ? <span className="text-emerald-600 font-bold">Оплачено: {item.lastPurchasePrice} P</span>
                                            : `Цена: ${item.price === 0 ? 'Свободная' : `${item.price} P`}`
                                        }
                                    </div>
                                    
                                    <div className="text-sm mt-3 flex flex-wrap gap-2 items-center">
                                        <span className={`font-bold px-2 py-1 rounded text-xs uppercase tracking-wide ${
                                        item.status === ItemStatus.RESERVED ? 'bg-indigo-100 text-indigo-700' : 
                                        item.status === ItemStatus.SOLD ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                        {item.status === ItemStatus.RESERVED ? 'Бронь' : 
                                        item.status === ItemStatus.SOLD ? 'Продано' : 'Доступно'}
                                        </span>
                                        
                                        {/* Display Stock Info */}
                                        {item.status === ItemStatus.AVAILABLE && (
                                            <span className="font-bold px-2 py-1 rounded text-xs uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-100">
                                                {item.quantity === 0 ? "∞ Безлимит" : `${item.quantity} шт.`}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Client info block (only shown if reserved) */}
                                    {(item.status === ItemStatus.RESERVED || item.status === ItemStatus.SOLD) && owner && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
                                            <div className="text-gray-400 font-bold uppercase mb-1">Клиент</div>
                                            <div className="font-bold text-gray-800">{owner.name}</div>
                                            <div className="text-gray-500">{owner.phone}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                                {(item.status === ItemStatus.RESERVED || item.status === ItemStatus.SOLD) && (
                                    <button 
                                        onClick={() => forceRestock(item.id)} 
                                        className="flex-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 active:scale-95"
                                        title="Вернуть в наличие"
                                    >
                                    <RefreshCw className="w-3 h-3" /> Вернуть
                                    </button>
                                )}
                                <button 
                                    onClick={(e) => deleteItem(item.id, e)} 
                                    className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors flex items-center justify-center active:scale-95 ml-auto"
                                    title="Удалить товар"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )})}
                </div>
            </div>
            </div>
        )}

        {/* CONTENT: USERS */}
        {activeTab === 'users' && (
            <div className="space-y-4">
            <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl">Пользователи</h3>
            
            <div className="flex gap-2 px-1 mb-2">
                <button onClick={() => toggleUserSort('name')} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-bold transition-colors">
                    Имя {getSortIcon(userSort, 'name')}
                </button>
                <button onClick={() => toggleUserSort('balance')} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full text-sm font-bold transition-colors">
                    Баланс {getSortIcon(userSort, 'balance')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedUsers.map(u => (
                    <div key={u.id} className="bg-white p-5 rounded-2xl shadow-sm border flex flex-col hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                     <UserIcon className="w-5 h-5" />
                                 </div>
                                 <div>
                                     <div className="font-bold text-lg text-gray-800 leading-none">{u.name}</div>
                                     <div className="text-sm text-gray-500 font-mono mt-1">{u.phone}</div>
                                 </div>
                             </div>
                             {/* Delete User Button - Only for Manager */}
                             {user?.role === UserRole.MANAGER && u.role !== UserRole.ADMIN && (
                                 <button 
                                    onClick={(e) => handleDeleteUser(u.id, e)}
                                    className="text-gray-300 hover:text-red-500 p-2 rounded-lg transition-colors active:scale-90"
                                    title="Удалить пользователя"
                                 >
                                     <Trash2 className="w-5 h-5" />
                                 </button>
                             )}
                        </div>
                        <div className="mt-auto pt-3 border-t border-gray-50">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400 uppercase font-bold">Баланс</span>
                                <span className={`font-bold ${u.balance > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>{u.balance.toFixed(2)} P</span>
                            </div>
                            <div className="text-xs text-gray-300 mt-2 font-mono truncate">ID: {u.id}</div>
                        </div>
                    </div>
                ))}
            </div>
            </div>
        )}

        {/* CONTENT: PAYMENTS (ONLY MANAGER) */}
        {activeTab === 'payments' && user?.role === UserRole.MANAGER && (
            <div className="space-y-6">
                <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl">Методы оплаты</h3>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl">
                    <h3 className="font-bold mb-4 text-lg">Добавить метод оплаты</h3>
                    <form onSubmit={handleAddMethod} className="flex flex-col gap-4">
                    <input 
                        placeholder="Название (например, Карта)" 
                        value={newMethodName}
                        onChange={e => setNewMethodName(e.target.value)}
                        className="border-2 border-gray-100 p-4 rounded-xl focus:border-blue-500 outline-none transition-colors font-medium" 
                    />
                    <textarea 
                        placeholder="Инструкция для пользователя (реквизиты)" 
                        value={newMethodInstr}
                        onChange={e => setNewMethodInstr(e.target.value)}
                        className="border-2 border-gray-100 p-4 rounded-xl h-28 resize-none focus:border-blue-500 outline-none transition-colors font-medium" 
                    />
                    <div className="relative">
                        <input 
                            type="number"
                            placeholder="Минимальная сумма (0 - без лимита)" 
                            value={newMethodMin}
                            onChange={e => setNewMethodMin(e.target.value)}
                            className="border-2 border-gray-100 p-4 rounded-xl w-full focus:border-blue-500 outline-none transition-colors font-medium" 
                        />
                        <div className="text-xs text-gray-400 mt-2 ml-1">Если 0 или пусто - лимит отсутствует</div>
                    </div>
                    <button className="bg-green-600 text-white p-4 rounded-xl font-extrabold text-lg flex justify-center items-center gap-2 shadow-lg active:scale-[0.98] transition-all">
                        <Plus className="w-6 h-6" /> Добавить
                    </button>
                    </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {methods.map(m => (
                    <div key={m.id} className="bg-white p-5 rounded-2xl shadow-sm border flex flex-col justify-between h-full relative group">
                        <div>
                            <div className="flex justify-between items-start">
                                <div className="font-bold text-xl text-gray-800">{m.name}</div>
                                <button onClick={(e) => deleteMethod(m.id, e)} className="text-gray-300 hover:text-red-500 p-2 rounded-xl transition-colors">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="text-sm text-gray-600 mt-4 whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100 font-mono text-xs">{m.instruction}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100">
                             {m.minAmount && m.minAmount > 0 ? (
                                <div className="text-sm text-orange-600 font-bold flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Мин. сумма: {m.minAmount} P
                                </div>
                            ) : (
                                <div className="text-sm text-green-600 font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Без лимита
                                </div>
                            )}
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        )}

         {/* CONTENT: SETTINGS (ONLY MANAGER) */}
         {activeTab === 'settings' && user?.role === UserRole.MANAGER && (
             <div className="w-full">
                 <h3 className="font-bold text-gray-700 px-2 text-lg md:text-2xl mb-4">Настройки доступа</h3>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     
                     {/* Column 1: Update Manager (Self) */}
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <UserCog className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-800">Данные Менеджера</h3>
                         </div>
                         <form onSubmit={handleUpdateManager} className="space-y-4">
                             <div>
                                 <label className="block text-sm font-bold text-gray-500 mb-1">Новый Логин</label>
                                 <input 
                                    value={managerLogin}
                                    onChange={e => setManagerLogin(e.target.value)}
                                    placeholder="Например: manager_new"
                                    className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-indigo-600 outline-none transition-colors"
                                 />
                             </div>
                             <div>
                                 <label className="block text-sm font-bold text-gray-500 mb-1">Новый Пароль</label>
                                 <input 
                                    value={managerPass}
                                    onChange={e => setManagerPass(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-indigo-600 outline-none transition-colors"
                                 />
                             </div>
                             {msgManager && (
                                 <div className={`text-sm font-bold ${msgManager.startsWith('Ошибка') ? 'text-red-500' : 'text-green-600'}`}>
                                     {msgManager}
                                 </div>
                             )}
                             <button className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]">
                                 Обновить Менеджера
                             </button>
                         </form>
                     </div>

                     {/* Column 2: Update Admin (Target) */}
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                         <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                                <Lock className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-800">Данные Администратора</h3>
                         </div>
                         <form onSubmit={handleUpdateAdmin} className="space-y-4">
                             <div>
                                 <label className="block text-sm font-bold text-gray-500 mb-1">Новый Логин</label>
                                 <input 
                                    value={adminLogin}
                                    onChange={e => setAdminLogin(e.target.value)}
                                    placeholder="Например: admin_new"
                                    className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-slate-800 outline-none transition-colors"
                                 />
                             </div>
                             <div>
                                 <label className="block text-sm font-bold text-gray-500 mb-1">Новый Пароль</label>
                                 <input 
                                    value={adminPass}
                                    onChange={e => setAdminPass(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-slate-800 outline-none transition-colors"
                                 />
                             </div>
                             {msgAdmin && (
                                 <div className={`text-sm font-bold ${msgAdmin.startsWith('Ошибка') ? 'text-red-500' : 'text-green-600'}`}>
                                     {msgAdmin}
                                 </div>
                             )}
                             <button className="w-full bg-slate-800 text-white p-4 rounded-xl font-bold hover:bg-slate-700 shadow-lg shadow-slate-200 transition-all active:scale-[0.98]">
                                 Обновить Администратора
                             </button>
                         </form>
                     </div>
                 </div>
             </div>
         )}

      </div>

      {/* MOBILE BOTTOM NAVIGATION (Hidden on Desktop) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 px-2 py-3 flex justify-between items-center z-50 text-[10px] sm:text-xs shadow-lg overflow-x-auto">
          {navItems.map(item => (
            <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl min-w-[60px] flex-1 transition-all ${activeTab === item.id ? 'text-blue-600 bg-blue-50 font-bold' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            >
                <div className="relative">
                    <item.icon className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={2.5} />
                    {item.count !== undefined && item.count > 0 && activeTab !== item.id && (
                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold h-5 min-w-[1.25rem] flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
                            {item.count}
                        </span>
                    )}
                </div>
                <span>{item.label}</span>
            </button>
          ))}
      </nav>
    </div>
  );
};
