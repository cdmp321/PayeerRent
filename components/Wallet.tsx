
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { PaymentMethod, User, Transaction, TransactionStatus } from '../types';
import { Wallet as WalletIcon, AlertCircle, CheckCircle2, X, Upload, Clock, RotateCcw, History, ArrowUpRight, ArrowDownLeft, Banknote, Copy, Check, ChevronUp, ChevronDown, CreditCard, Bitcoin, ExternalLink, Link } from 'lucide-react';

interface WalletProps {
  user: User;
  onUpdateUser: (user: User) => void; 
}

// Helper Component for Payment Icons
const PaymentIcon = ({ imageUrl }: { imageUrl?: string }) => {
    if (!imageUrl) return <CreditCard className="w-8 h-8 text-gray-400" />;

    if (imageUrl.startsWith('preset:')) {
        const type = imageUrl.split(':')[1];
        switch(type) {
            case 'card':
                return (
                    <div className="w-full h-full rounded bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative shadow-sm overflow-hidden flex items-center justify-center border border-white/20">
                        <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-yellow-300 rounded-full opacity-80 shadow-sm"></div>
                        <div className="absolute bottom-1 right-1 w-4 h-2 bg-white/20 rounded-sm backdrop-blur-sm"></div>
                    </div>
                );
            case 'crypto':
                return (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm text-white border-2 border-white ring-1 ring-orange-200">
                        <Bitcoin className="w-5 h-5" />
                    </div>
                );
            case 'master':
                 return (
                    <div className="w-full h-full rounded bg-slate-900 relative shadow-sm flex items-center justify-center overflow-hidden border border-slate-700">
                        <div className="w-4 h-4 rounded-full bg-red-500/90 -mr-1.5 z-10 mix-blend-screen"></div>
                        <div className="w-4 h-4 rounded-full bg-yellow-500/90 -ml-1.5 z-0 mix-blend-screen"></div>
                    </div>
                 );
            case 'mir':
                return (
                     <div className="w-full h-full rounded bg-emerald-600 flex items-center justify-center shadow-sm border border-emerald-500 relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-tr from-emerald-800 to-transparent opacity-50"></div>
                         <span className="text-[9px] font-black text-white tracking-tighter uppercase italic relative z-10">MIR</span>
                     </div>
                );
            case 'visa':
                return (
                    <div className="w-full h-full rounded bg-white border border-gray-200 flex items-center justify-center shadow-sm relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-4 h-4 bg-blue-100 rounded-bl-full opacity-50"></div>
                         <span className="text-[10px] font-black text-blue-800 uppercase italic tracking-tighter">VISA</span>
                    </div>
                );
            default:
                return <CreditCard className="w-full h-full text-gray-400 p-1" />;
        }
    }

    return (
         <img 
            key={imageUrl}
            src={imageUrl} 
            alt="Method" 
            className="w-full h-full object-cover rounded-md" 
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('bg-gray-100');
            }}
        />
    );
};

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

  // Refs for auto-focus
  const amountInputRef = useRef<HTMLInputElement>(null);
  const receiptUploadRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    const methodsData = await api.getPaymentMethods();
    setMethods(methodsData.filter(m => m.isActive));

    const allTxs = await api.getTransactions();
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

  // Handler for Link-based payments
  const handleLinkPayment = async () => {
      const val = parseFloat(amount);
      
      if (!val || val <= 0) {
        setNotification({ type: 'error', msg: 'Укажите корректную сумму' });
        if (amountInputRef.current) {
            amountInputRef.current.focus();
            amountInputRef.current.parentElement?.classList.add('animate-pulse');
            setTimeout(() => amountInputRef.current?.parentElement?.classList.remove('animate-pulse'), 1000);
        }
        return;
      }
      
      if (!selectedMethod || !selectedMethod.paymentUrl) return;

      if (selectedMethod.minAmount && val < selectedMethod.minAmount) {
          setNotification({ type: 'error', msg: `Минимальная сумма: ${selectedMethod.minAmount} ®` });
          return;
      }

      // 1. Open link in new tab immediately
      window.open(selectedMethod.paymentUrl, '_blank');

      setIsProcessing(true);
      try {
        // 2. Create Request in background (no receipt needed)
        await api.requestTopUp(user.id, val); 
        
        setNotification({ type: 'success', msg: 'Заявка создана! Ожидайте зачисления.' });
        setShowTopUpModal(false);
        setAmount('');
        setSelectedMethod(null);
        setReceipt(null);
        loadData(); 
      } catch (error) {
        setNotification({ type: 'error', msg: 'Ошибка создания заявки' });
      } finally {
        setIsProcessing(false);
        setTimeout(() => setNotification(null), 3000);
      }
  };

  const handleTopUpRequest = async () => {
    const val = parseFloat(amount);
    
    if (!val || val <= 0) {
      setNotification({ type: 'error', msg: 'Укажите корректную сумму' });
      if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.parentElement?.classList.add('animate-pulse');
          setTimeout(() => amountInputRef.current?.parentElement?.classList.remove('animate-pulse'), 1000);
      }
      return;
    }
    
    if (!selectedMethod) {
      setNotification({ type: 'error', msg: 'Выберите метод оплаты' });
      return;
    }
    if (selectedMethod.minAmount && val < selectedMethod.minAmount) {
        setNotification({ type: 'error', msg: `Минимальная сумма: ${selectedMethod.minAmount} ®` });
        return;
    }
    
    // Only require receipt if it's NOT a link method
    if (!selectedMethod.paymentUrl) {
        if (!receipt) {
            setNotification({ type: 'error', msg: 'Загрузите чек оплаты' });
            if (receiptUploadRef.current) {
                receiptUploadRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const el = receiptUploadRef.current;
                el.classList.add('ring-4', 'ring-red-400', 'bg-red-50', 'border-red-400');
                setTimeout(() => {
                    el.classList.remove('ring-4', 'ring-red-400', 'bg-red-50', 'border-red-400');
                }, 2000);
            }
            return;
        }
    }

    setIsProcessing(true);
    try {
      await api.requestTopUp(user.id, val, receipt || undefined);
      
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
          const newUser = { ...user, balance: user.balance - val };
          onUpdateUser(newUser); 
      } catch (err: any) {
          setNotification({ type: 'error', msg: err.message || 'Ошибка вывода' });
      } finally {
          setIsProcessing(false);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  const handleRefundRequest = async () => {
      setIsProcessing(true);
      try {
          await api.requestUserRefund(user.id, 0, "Запрос пользователя на снятие/возврат");
          setNotification({ type: 'success', msg: 'Запрос на возврат отправлен!' });
          setShowRefundModal(false);
          setAmount('');
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

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const fullWithdrawalHistory = transactions.filter(t => 
      t.type === 'WITHDRAWAL' && 
      new Date(t.date) >= threeDaysAgo
  );

  const displayedHistory = isHistoryExpanded 
      ? fullWithdrawalHistory 
      : fullWithdrawalHistory.slice(0, 5);

  return (
    <div className="space-y-4 pb-36">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-700/50 rounded-lg">
                    <WalletIcon className="w-5 h-5 text-emerald-300" />
                </div>
                <span className="font-medium text-slate-300 text-sm">Мой баланс</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-700/50 px-2 py-1 rounded text-emerald-300 font-bold">PAYEER®</span>
            </div>
            
            <div className="text-4xl font-extrabold mb-6 relative z-10 tracking-tight flex items-baseline gap-1">
                {user.balance.toFixed(2)} <span className="text-xl font-normal text-black">®</span>
            </div>

            <div className="flex flex-col gap-3 relative z-10">
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowTopUpModal(true)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white h-14 rounded-xl font-extrabold text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20 leading-none text-center"
                    >
                        Пополнить
                    </button>
                    <button 
                        onClick={() => setShowWithdrawModal(true)}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white h-14 rounded-xl font-extrabold text-base flex items-center justify-center gap-2 transition-colors border border-slate-600 leading-none text-center"
                    >
                        Вывести
                    </button>
                </div>
                <button 
                    onClick={() => setShowRefundModal(true)}
                    className="w-full bg-purple-900 hover:bg-purple-800 active:bg-purple-700 text-purple-100 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-purple-800"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Возврат средств
                </button>
            </div>
        </div>
        </div>

      {pendingTransactions.length > 0 && (
          <div className="space-y-3 animate-fade-in">
             {pendingTransactions.map(tx => {
                 const isRefundRequest = tx.description?.includes('ЗАПРОС НА ВОЗВРАТ');
                 return (
                 <div key={tx.id} className={`rounded-xl p-4 relative overflow-hidden border ${
                    tx.type === 'DEPOSIT' 
                        ? 'bg-orange-50 border-orange-100' 
                        : (isRefundRequest ? 'bg-purple-50 border-purple-100' : 'bg-blue-50 border-blue-100')
                 }`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full animate-pulse ${
                            tx.type === 'DEPOSIT' 
                                ? 'bg-orange-200' 
                                : (isRefundRequest ? 'bg-purple-200' : 'bg-blue-200')
                        }`}>
                            <Clock className={`w-5 h-5 ${
                                tx.type === 'DEPOSIT' 
                                    ? 'text-orange-700' 
                                    : (isRefundRequest ? 'text-purple-700' : 'text-blue-700')
                            }`} />
                        </div>
                        <div className="flex-1">
                            <h3 className={`font-bold text-sm ${
                                tx.type === 'DEPOSIT' 
                                    ? 'text-orange-900' 
                                    : (isRefundRequest ? 'text-purple-900' : 'text-blue-900')
                            }`}>
                                {tx.type === 'DEPOSIT' ? 'Обработка пополнения' : (isRefundRequest ? 'Обработка возврата' : 'Обработка вывода')}
                            </h3>
                            <div className={`text-[10px] mt-0.5 font-bold ${
                                tx.type === 'DEPOSIT' 
                                    ? 'text-orange-600/70' 
                                    : (isRefundRequest ? 'text-purple-600/70' : 'text-blue-600/70')
                            }`}>
                                {new Date(tx.date).toLocaleDateString()}
                            </div>
                        </div>
                        <div className={`font-black text-lg ${
                            tx.type === 'DEPOSIT' 
                                ? 'text-orange-600' 
                                : (isRefundRequest ? 'text-purple-600' : 'text-blue-600')
                        }`}>
                            {tx.type === 'DEPOSIT' || isRefundRequest ? '+' : '-'}{tx.amount} ®
                        </div>
                    </div>
                 </div>
             )})}
          </div>
      )}

      {fullWithdrawalHistory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-500" />
                    История (3 дня)
                </h3>
            </div>
            
            <div className="space-y-3">
                {displayedHistory.map(tx => {
                    const isRefund = tx.description?.includes('ЗАПРОС НА ВОЗВРАТ') || tx.description?.includes('Возврат средств');
                    const isApproved = tx.status === TransactionStatus.APPROVED;
                    
                    return (
                    <div key={tx.id} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0 last:pb-0 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                                isRefund && isApproved ? 'bg-purple-100 text-purple-900' :
                                tx.status === TransactionStatus.APPROVED ? 'bg-green-100 text-green-600' :
                                tx.status === TransactionStatus.REJECTED ? 'bg-red-100 text-red-600' :
                                'bg-gray-100 text-gray-500'
                            }`}>
                                {isRefund ? <RotateCcw className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>
                            <div>
                                <div className="font-bold text-sm text-gray-800">
                                    {isRefund ? 'Возврат средств' : 'Вывод средств'}
                                </div>
                                <div className="text-[10px] text-gray-400 font-medium">{new Date(tx.date).toLocaleString()}</div>
                                {tx.status === TransactionStatus.REJECTED && (
                                    <div className="text-[10px] text-red-500 mt-0.5 font-bold">Отклонено</div>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                             <div className={`font-bold text-sm ${isRefund ? 'text-black' : 'text-gray-800'}`}>
                                 {isRefund ? '+' : '-'}{tx.amount} ®
                             </div>
                             <div className={`text-[10px] font-bold uppercase ${
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

            {fullWithdrawalHistory.length > 5 && (
                <button 
                    onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                    className="w-full mt-3 py-1.5 flex items-center justify-center gap-1 text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors border-t border-gray-100 pt-2"
                >
                    {isHistoryExpanded ? (
                        <>Свернуть <ChevronUp className="w-3 h-3" /></>
                    ) : (
                        <>Показать еще ({fullWithdrawalHistory.length - 5}) <ChevronDown className="w-3 h-3" /></>
                    )}
                </button>
            )}
        </div>
      )}

      {notification && (
        <div className={`mx-4 mt-4 p-3 rounded-xl flex items-center gap-2 text-sm font-bold animate-fade-in border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.msg}
        </div>
      )}

      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-slide-up sm:animate-zoom-in shadow-2xl overflow-hidden">
            
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0 bg-white z-10">
              <h3 className="text-lg font-extrabold text-gray-900">Пополнение кошелька</h3>
              <button onClick={() => setShowTopUpModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Сумма (PAYEER®)</label>
                <input 
                  ref={amountInputRef}
                  type="number" 
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-xl p-3 border border-gray-700 bg-gray-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-white placeholder-gray-500 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Выберите способ оплаты</label>
                <div className="space-y-3">
                  {methods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => {
                          setSelectedMethod(method);
                          setIsCopied(false);
                      }}
                      className={`relative w-full p-4 rounded-xl border transition-all group flex items-center justify-between overflow-hidden ${selectedMethod?.id === method.id ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-500' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                    >
                      <div className="flex flex-col items-start gap-1 relative z-10 pr-12">
                          <span className="font-extrabold text-slate-800 text-base">{method.name}</span>
                          {method.minAmount && method.minAmount > 0 && (
                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md">Min {method.minAmount}</span>
                          )}
                      </div>
                      
                      {/* Image in the Top-Right Corner */}
                      <div className="absolute top-2 right-2 w-14 h-10 bg-white rounded-lg border border-gray-100 flex items-center justify-center p-0.5 shadow-sm z-20">
                          <PaymentIcon imageUrl={method.imageUrl} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm animate-fade-in relative overflow-hidden">
                  
                  {/* Payment Logic Switch */}
                  {selectedMethod.paymentUrl ? (
                      /* LINK MODE - Replaces Requisites & Receipt Upload */
                      <div className="mb-4 relative z-10 space-y-4">
                           <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-indigo-900 font-bold leading-relaxed shadow-sm">
                               Введите сумму на которую вы хотите пополнить кошелек, нажмите кнопку ниже для перехода в аккаунт для оплаты, где нужно ввести в окне «другая сумма» то же сумму которую вы вводили при пополнении кошелька.
                           </div>
                           {/* Receipt upload and manual instructions are hidden in this mode */}
                      </div>
                  ) : (
                      /* MANUAL MODE */
                      <>
                           <div className="mb-4 relative z-10">
                               <p className="text-center text-[10px] font-bold text-gray-400 uppercase mb-2">Реквизиты для оплаты</p>
                               
                               {selectedMethod.instruction ? (
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase">Реквизиты для перевода</p>
                                            
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={copyInstruction}
                                                    className="flex items-center gap-1 text-[10px] font-bold bg-white border border-gray-200 px-2 py-1 rounded-lg text-indigo-600 hover:text-indigo-700 hover:border-indigo-200 transition-colors active:scale-95 shadow-sm"
                                                >
                                                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                    {isCopied ? 'Скопировано' : 'Копировать'}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="font-mono text-gray-800 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200 select-all text-xs leading-relaxed shadow-sm font-medium">
                                            {selectedMethod.instruction}
                                        </p>
                                    </div>
                               ) : null}
                          </div>
                          
                          {/* INSTRUCTION BLOCK - Only in Manual Mode */}
                          <div className="my-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 shadow-sm relative z-10">
                            <div className="flex items-start gap-3">
                               <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 shrink-0 mt-0.5">
                                  <Banknote className="w-4 h-4" />
                                </div>
                               <div>
                                  <h4 className="font-bold text-indigo-900 text-xs mb-1.5 uppercase tracking-wide">Как пополнить баланс?</h4>
                                  <ol className="text-[11px] text-indigo-800/90 space-y-1.5 list-none font-medium leading-tight">
                                     <li className="flex gap-1.5">
                                        <span className="font-bold text-indigo-500">1.</span>
                                        <span>Выполните перевод по реквизитам выше.</span>
                                     </li>
                                     <li className="flex gap-1.5">
                                        <span className="font-bold text-indigo-500">2.</span>
                                        <span>Сохраните чек или сделайте скриншот оплаты.</span>
                                     </li>
                                     <li className="flex gap-1.5">
                                        <span className="font-bold text-indigo-500">3.</span>
                                        <span>Загрузите чек в поле ниже и нажмите "Отправить заявку".</span>
                                     </li>
                                  </ol>
                               </div>
                            </div>
                          </div>

                          {/* RECEIPT UPLOAD - Only in Manual Mode */}
                          <div className="pt-2 border-t border-gray-200 relative z-10">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5 mt-2">Загрузка чека</label>
                            <label 
                                ref={receiptUploadRef}
                                className="flex flex-col items-center justify-center w-full h-16 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-gray-50 transition-all duration-300 relative overflow-hidden group"
                            >
                                <div className="flex items-center gap-2 px-2 relative z-10">
                                    {receipt ? (
                                        <>
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                            <span className="text-sm font-bold text-emerald-700 truncate max-w-[180px]">{receipt.name}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                            <span className="text-xs font-bold text-gray-500 group-hover:text-gray-700 transition-colors">Нажмите для загрузки</span>
                                        </>
                                    )}
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                          </div>
                      </>
                  )}
                </div>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="p-4 pb-8 sm:pb-4 border-t border-gray-100 bg-white shrink-0 z-10">
                {selectedMethod && selectedMethod.paymentUrl ? (
                     /* LINK MODE BUTTON - "Перейти к оплате" (Trigger both link and request) */
                    <button 
                        onClick={handleLinkPayment}
                        disabled={isProcessing}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-extrabold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         {isProcessing ? (
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                         ) : (
                             <ExternalLink className="w-5 h-5 stroke-[2.5]" />
                         )}
                        Перейти к оплате
                    </button>
                ) : (
                     /* MANUAL MODE BUTTON */
                    <button 
                        onClick={handleTopUpRequest}
                        disabled={isProcessing || !selectedMethod}
                        className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                        {isProcessing ? 'Обработка...' : 'Отправить заявку'}
                    </button>
                )}
            </div>

          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl flex flex-col animate-slide-up sm:animate-zoom-in shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0 bg-white z-10">
              <h3 className="text-lg font-extrabold text-gray-900">Вывод средств</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
               <div className="bg-blue-50 p-3 rounded-xl flex items-start gap-2 text-xs text-blue-800 mb-2 border border-blue-100">
                   <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                   <div>
                       <p className="font-bold text-sm">Баланс: {user.balance.toFixed(2)} ®</p>
                       <p className="opacity-80 mt-0.5 font-medium">Средства списываются сразу.</p>
                   </div>
               </div>

               <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Сумма вывода</label>
                <input 
                  type="number" 
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  max={user.balance}
                  className="w-full text-xl p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-gray-800 placeholder-gray-400 transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Куда вывести?</label>
                <textarea 
                  value={withdrawDetails}
                  onChange={(e) => setWithdrawDetails(e.target.value)}
                  placeholder="Номер карты, Payeer кошелек или номер телефона..."
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 h-24 resize-none text-sm font-medium"
                />
              </div>
            </div>

            <div className="p-4 pb-8 sm:pb-4 border-t border-gray-100 bg-white shrink-0 z-10">
              <button 
                onClick={handleWithdrawRequest}
                disabled={isProcessing}
                className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {isProcessing ? 'Создание заявки...' : 'Создать заявку'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl flex flex-col animate-slide-up sm:animate-zoom-in shadow-2xl overflow-hidden border border-red-100">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0 bg-white z-10">
              <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-red-500" />
                  Возврат средств
              </h3>
              <button onClick={() => setShowRefundModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
               <div className="bg-red-50 p-3 rounded-xl flex items-start gap-2 text-xs text-red-800 mb-2 border border-red-100">
                   <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                   <div>
                       <p className="font-bold text-sm">Запрос на возврат</p>
                       <p className="opacity-80 mt-0.5 font-medium">Запрос на начисление (Кэшбэк)</p>
                   </div>
               </div>
               
               <div>
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-xs text-blue-800 leading-relaxed font-medium">
                      отправьте запрос на снятие и возврат средств. После подтверждения ваша сумма пополнится в личном кошельке. Время возврата средств в среднем 5 мин.
                  </div>
              </div>
            </div>

            <div className="p-4 pb-8 sm:pb-4 border-t border-gray-100 bg-white shrink-0 z-10">
              <button 
                onClick={handleRefundRequest}
                disabled={isProcessing}
                className="w-full bg-red-600 text-white py-3.5 rounded-xl font-extrabold text-lg shadow-lg hover:shadow-xl hover:bg-red-700 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                {isProcessing ? 'Отправка...' : 'Отправить запрос'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
