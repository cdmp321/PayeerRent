
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PaymentMethod, User, Transaction, TransactionStatus } from '../types';
import { Wallet as WalletIcon, Plus, CreditCard, AlertCircle, CheckCircle2, X, Upload, Clock, Loader2, Lock, ArrowUpRight, Banknote, History, ArrowDownLeft, Info, Copy, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface WalletProps {
  user: User;
  onUpdateUser: (user: User) => void; // Used to trigger refresh
}

export const Wallet: React.FC<WalletProps> = ({ user, onUpdateUser }) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawDetails, setWithdrawDetails] = useState('');

  // Refund State
  const [showRefundModal, setShowRefundModal] = useState(false);

  const [notification, setNotification] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // History Expansion State
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  
  // Copy state
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]); // Reload when user changes (after balance update)

  const loadData = async () => {
    const methodsData = await api.getPaymentMethods();
    setMethods(methodsData.filter(m => m.isActive));

    const allTxs = await api.getTransactions();
    // Filter transactions for this user
    const userTxs = allTxs.filter(t => t.userId === user.id);
    setTransactions(userTxs);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceipt(e.target.files[0]);
    }
  };

  const copyInstruction = () => {
      if (selectedMethod?.instruction) {
          navigator.clipboard.writeText(selectedMethod.instruction);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };

  const handleTopUpRequest = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      setNotification({ type: 'error', msg: 'Укажите корректную сумму' });
      return;
    }
    if (!selectedMethod) {
      setNotification({ type: 'error', msg: 'Выберите метод оплаты' });
      return;
    }
    if (selectedMethod.minAmount && val < selectedMethod.minAmount) {
        setNotification({ type: 'error', msg: `Минимальная сумма: ${selectedMethod.minAmount} P` });
        return;
    }
    if (!receipt) {
        setNotification({ type: 'error', msg: 'Прикрепите чек оплаты' });
        return;
    }

    setIsProcessing(true);
    try {
      await api.requestTopUp(user.id, val, receipt);
      
      setNotification({ type: 'success', msg: 'Заявка отправлена на проверку!' });
      setShowTopUpModal(false);
      setAmount('');
      setSelectedMethod(null);
      setReceipt(null);
      
      loadData(); 
    } catch (error) {
      setNotification({ type: 'error', msg: 'Ошибка отправки заявки' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleWithdrawRequest = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) {
          setNotification({ type: 'error', msg: 'Укажите корректную сумму' });
          return;
      }
      if (val > user.balance) {
          setNotification({ type: 'error', msg: 'Недостаточно средств' });
          return;
      }
      if (!withdrawDetails.trim()) {
          setNotification({ type: 'error', msg: 'Укажите реквизиты для получения' });
          return;
      }

      setIsProcessing(true);
      try {
          await api.requestWithdrawal(user.id, val, withdrawDetails);
          setNotification({ type: 'success', msg: 'Заявка на вывод создана!' });
          setShowWithdrawModal(false);
          setAmount('');
          setWithdrawDetails('');
          // Update local user state immediately for better UX
          const newUser = { ...user, balance: user.balance - val };
          onUpdateUser(newUser); // This triggers loadData too
      } catch (err: any) {
          setNotification({ type: 'error', msg: err.message || 'Ошибка вывода' });
      } finally {
          setIsProcessing(false);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const handleRefundRequest = async () => {
      const val = parseFloat(amount);
      if (!val || val <= 0) {
          setNotification({ type: 'error', msg: 'Укажите корректную сумму' });
          return;
      }
      
      setIsProcessing(true);
      try {
          await api.requestUserRefund(user.id, val, "Запрос пользователя");
          setNotification({ type: 'success', msg: 'Запрос на возврат отправлен!' });
          setShowRefundModal(false);
          setAmount('');
          // Do NOT update local user balance here, as funds are added only on approval
          loadData();
      } catch (err: any) {
          setNotification({ type: 'error', msg: err.message || 'Ошибка запроса' });
      } finally {
          setIsProcessing(false);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const pendingTransactions = transactions.filter(t => 
    t.status === TransactionStatus.PENDING && 
    (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
  );

  // Filter: Withdrawal history for the last 3 days
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const fullWithdrawalHistory = transactions.filter(t => 
      t.type === 'WITHDRAWAL' && 
      new Date(t.date) >= threeDaysAgo
  );

  // Logic: Show 5 items if collapsed, or all if expanded
  const displayedHistory = isHistoryExpanded 
      ? fullWithdrawalHistory 
      : fullWithdrawalHistory.slice(0, 5);

  return (
    <div className="space-y-6 pb-36">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 text-white relative overflow-hidden">
            {/* Abstract decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700/50 rounded-xl">
                    <WalletIcon className="w-8 h-8 text-emerald-300" />
                </div>
                <span className="font-medium text-slate-300 text-lg">Мой баланс</span>
            </div>
            <span className="text-sm font-mono bg-slate-700/50 px-3 py-1.5 rounded-lg text-emerald-300 font-bold">PAYEER®</span>
            </div>
            
            <div className="text-5xl font-extrabold mb-8 relative z-10 tracking-tight">
            {user.balance.toFixed(2)} <span className="text-2xl font-normal text-slate-400">P</span>
            </div>

            <div className="flex flex-col gap-3 relative z-10">
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowTopUpModal(true)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white h-16 rounded-xl font-extrabold text-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20 leading-none text-center"
                    >
                        Пополнить
                    </button>
                    <button 
                        onClick={() => setShowWithdrawModal(true)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white h-16 rounded-xl font-extrabold text-lg flex items-center justify-center gap-2 transition-colors border border-slate-600 leading-none text-center"
                    >
                        Вывести
                    </button>
                </div>
                {/* Updated Button Color: Dark Purple (bg-purple-900) */}
                <button 
                    onClick={() => setShowRefundModal(true)}
                    className="w-full bg-purple-900 hover:bg-purple-800 active:bg-purple-700 text-purple-100 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-purple-800"
                >
                    <RotateCcw className="w-4 h-4" />
                    Возврат средств
                </button>
            </div>
        </div>
        </div>

      {/* PENDING TRANSACTIONS NOTIFICATION */}
      {pendingTransactions.length > 0 && (
          <div className="space-y-4 animate-fade-in">
             {pendingTransactions.map(tx => {
                 const isRefundRequest = tx.description?.includes('ЗАПРОС НА ВОЗВРАТ');
                 return (
                 <div key={tx.id} className={`rounded-2xl p-5 relative overflow-hidden border-2 ${tx.type === 'DEPOSIT' || isRefundRequest ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full animate-pulse ${tx.type === 'DEPOSIT' || isRefundRequest ? 'bg-orange-200' : 'bg-blue-200'}`}>
                            <Clock className={`w-7 h-7 ${tx.type === 'DEPOSIT' || isRefundRequest ? 'text-orange-700' : 'text-blue-700'}`} />
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-bold text-lg ${tx.type === 'DEPOSIT' || isRefundRequest ? 'text-orange-900' : 'text-blue-900'}`}>
                                {tx.type === 'DEPOSIT' ? 'Обработка пополнения' : (isRefundRequest ? 'Обработка возврата' : 'Обработка вывода')}
                            </h3>
                            <div className={`text-sm mt-0.5 font-bold ${tx.type === 'DEPOSIT' || isRefundRequest ? 'text-orange-600/70' : 'text-blue-600/70'}`}>
                                {new Date(tx.date).toLocaleDateString()}
                            </div>
                        </div>
                        <div className={`font-black text-2xl ${tx.type === 'DEPOSIT' || isRefundRequest ? 'text-orange-600' : 'text-blue-600'}`}>
                            {tx.type === 'DEPOSIT' || isRefundRequest ? '+' : '-'}{tx.amount} P
                        </div>
                    </div>
                 </div>
             )})}
          </div>
      )}

      {/* WITHDRAWAL HISTORY */}
      {fullWithdrawalHistory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <History className="w-6 h-6 text-indigo-500" />
                    История (3 дня)
                </h3>
            </div>
            
            <div className="space-y-4">
                {displayedHistory.map(tx => {
                    const isRefund = tx.description?.includes('ЗАПРОС НА ВОЗВРАТ') || tx.description?.includes('Возврат средств');
                    const isApproved = tx.status === TransactionStatus.APPROVED;
                    
                    return (
                    <div key={tx.id} className="flex justify-between items-center border-b border-gray-50 pb-4 last:border-0 last:pb-0 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${
                                isRefund && isApproved ? 'bg-purple-100 text-purple-900' :
                                tx.status === TransactionStatus.APPROVED ? 'bg-green-100 text-green-600' :
                                tx.status === TransactionStatus.REJECTED ? 'bg-red-100 text-red-600' :
                                'bg-gray-100 text-gray-500'
                            }`}>
                                {isRefund ? <RotateCcw className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="font-bold text-gray-800">
                                    {isRefund ? 'Возврат средств' : 'Вывод средств'}
                                </div>
                                <div className="text-xs text-gray-400 font-medium">{new Date(tx.date).toLocaleString()}</div>
                                {tx.status === TransactionStatus.REJECTED && (
                                    <div className="text-xs text-red-500 mt-0.5 font-bold">Отклонено</div>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                             {/* UPDATED STYLE: Black if refund */}
                             <div className={`font-bold text-lg ${isRefund ? 'text-black' : 'text-gray-800'}`}>
                                 {isRefund ? '+' : '-'}{tx.amount} P
                             </div>
                             <div className={`text-xs font-bold uppercase ${
                                 isRefund && isApproved ? 'text-purple-900' :
                                 tx.status === TransactionStatus.APPROVED ? 'text-green-600' :
                                 tx.status === TransactionStatus.REJECTED ? 'text-red-500' :
                                 'text-orange-500'
                             }`}>
                                 {tx.status === TransactionStatus.APPROVED ? 'Выполнено' : 
                                  tx.status === TransactionStatus.REJECTED ? 'Отклонено' : 'В обработке'}
                             </div>
                        </div>
                    </div>
                )})}
            </div>

            {/* Expand/Collapse Button */}
            {fullWithdrawalHistory.length > 5 && (
                <button 
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="w-full mt-4 py-2 flex items-center justify-center gap-1 text-sm font-bold text-gray-400 hover:text-indigo-600 transition-colors border-t border-gray-100 pt-3"
                >
                    {isHistoryExpanded ? (
                        <>Свернуть <ChevronUp className="w-4 h-4" /></>
                    ) : (
                        <>Показать еще ({fullWithdrawalHistory.length - 5}) <ChevronDown className="w-4 h-4" /></>
                    )}
                </button>
            )}
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`mx-4 mt-4 p-4 rounded-xl flex items-center gap-3 text-base font-bold animate-fade-in border-2 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          {notification.msg}
        </div>
      )}

      {/* Top Up Modal Overlay */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-slide-up sm:animate-zoom-in shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0 bg-white z-10">
              <h3 className="text-xl font-extrabold text-gray-900">Пополнение кошелька</h3>
              <button onClick={() => setShowTopUpModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Сумма (PAYEER®)</label>
                <input 
                  type="number" 
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-2xl p-4 border border-gray-700 bg-gray-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-white placeholder-gray-500 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Способ оплаты</label>
                <div className="grid grid-cols-1 gap-3">
                  {methods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => {
                          setSelectedMethod(method);
                          setIsCopied(false);
                      }}
                      className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all group ${selectedMethod?.id === method.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className="text-left flex items-center gap-4">
                        {method.imageUrl ? (
                             <img 
                                src={method.imageUrl} 
                                alt={method.name} 
                                className={`w-10 h-10 object-contain rounded-lg border bg-white ${selectedMethod?.id === method.id ? 'border-emerald-200' : 'border-gray-200'}`}
                             />
                        ) : (
                            <div className={`p-3 rounded-xl transition-colors ${selectedMethod?.id === method.id ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 group-hover:bg-white'}`}>
                                <CreditCard className="w-6 h-6" />
                            </div>
                        )}
                        <div>
                             <span className="font-bold text-gray-800 block text-base">{method.name}</span>
                             {method.minAmount && method.minAmount > 0 && (
                                <span className="text-xs text-orange-500 font-bold uppercase">От {method.minAmount} P</span>
                             )}
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selectedMethod?.id === method.id ? 'border-emerald-500' : 'border-gray-300'}`}>
                        {selectedMethod?.id === method.id && <div className="w-3 h-3 bg-emerald-500 rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod && (
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-sm animate-fade-in">
                  <div className="mb-5">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-bold text-gray-500 uppercase">Реквизиты для перевода</p>
                        <button 
                            onClick={copyInstruction}
                            className="flex items-center gap-1.5 text-xs font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-indigo-600 hover:text-indigo-700 hover:border-indigo-200 transition-colors active:scale-95 shadow-sm"
                        >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'Скопировано' : 'Копировать'}
                        </button>
                      </div>
                      <p className="font-mono text-gray-800 whitespace-pre-wrap bg-white p-4 rounded-xl border border-gray-200 select-all text-sm leading-relaxed shadow-sm font-medium">{selectedMethod.instruction}</p>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-200">
                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-3 leading-relaxed border border-blue-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Info className="w-4 h-4 shrink-0" />
                            <p className="font-bold">Как подтвердить платеж:</p>
                        </div>
                        После совершения перевода сделайте скриншот чека или фото экрана. Загрузите его ниже. Администратор сверит данные и зачислит средства.
                    </div>

                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2 mt-2">Чек перевода</label>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 px-2">
                            {receipt ? (
                                <>
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                                    <span className="text-base font-bold text-emerald-700 truncate">{receipt.name}</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-6 h-6 text-gray-400" />
                                    <span className="text-sm font-bold text-gray-500">Загрузить скриншот</span>
                                </>
                            )}
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="p-5 pb-8 sm:pb-5 border-t border-gray-100 bg-white shrink-0 z-10">
              <button 
                onClick={handleTopUpRequest}
                disabled={isProcessing}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2.5"
              >
                {isProcessing ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {isProcessing ? 'Обработка...' : 'Отправить заявку'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl flex flex-col animate-slide-up sm:animate-zoom-in shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0 bg-white z-10">
              <h3 className="text-xl font-extrabold text-gray-900">Вывод средств</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
               <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 text-sm text-blue-800 mb-2 border border-blue-100">
                   <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-blue-600" />
                   <div>
                       <p className="font-bold text-base">Баланс: {user.balance.toFixed(2)} P</p>
                       <p className="text-xs opacity-80 mt-1 font-medium">Средства списываются сразу. При отказе возвращаются на баланс.</p>
                   </div>
               </div>

               <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Сумма вывода</label>
                <input 
                  type="number" 
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  max={user.balance}
                  className="w-full text-2xl p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-gray-800 placeholder-gray-400 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Куда вывести?</label>
                <textarea 
                  value={withdrawDetails}
                  onChange={(e) => setWithdrawDetails(e.target.value)}
                  placeholder="Номер карты, Payeer кошелек или номер телефона..."
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 h-28 resize-none text-base font-medium"
                />
              </div>
            </div>

            <div className="p-5 pb-8 sm:pb-5 border-t border-gray-100 bg-white shrink-0 z-10">
              <button 
                onClick={handleWithdrawRequest}
                disabled={isProcessing}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2.5"
              >
                {isProcessing ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {isProcessing ? 'Создание заявки...' : 'Создать заявку'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl flex flex-col animate-slide-up sm:animate-zoom-in shadow-2xl overflow-hidden border border-red-100">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0 bg-white z-10">
              <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                  <RotateCcw className="w-6 h-6 text-red-500" />
                  Возврат средств
              </h3>
              <button onClick={() => setShowRefundModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
               <div className="bg-red-50 p-4 rounded-xl flex items-start gap-3 text-sm text-red-800 mb-2 border border-red-100">
                   <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-red-600" />
                   <div>
                       <p className="font-bold text-base">Запрос на возврат</p>
                       <p className="text-xs opacity-80 mt-1 font-medium">Запрос на начисление средств (Кэшбэк / Возврат)</p>
                   </div>
               </div>

               <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Сумма возврата</label>
                <input 
                  type="number" 
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-2xl p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-mono text-gray-800 placeholder-gray-400 transition-all font-bold"
                />
              </div>

              {/* REPLACED Reason Textarea with Information Block */}
              <div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 leading-relaxed font-medium">
                      Укажите сумму возврата и отправьте запрос. После подтверждения ваша сумма пополнится в личном кошельке. Время возврата средств в среднем 5 мин.
                  </div>
              </div>
            </div>

            <div className="p-5 pb-8 sm:pb-5 border-t border-gray-100 bg-white shrink-0 z-10">
              <button 
                onClick={handleRefundRequest}
                disabled={isProcessing}
                className="w-full bg-red-600 text-white py-4 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl hover:bg-red-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2.5"
              >
                {isProcessing ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-6 h-6" />}
                {isProcessing ? 'Отправка...' : 'Отправить запрос'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
