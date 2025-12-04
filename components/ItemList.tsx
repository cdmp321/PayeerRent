
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Item, ItemStatus, User } from '../types';
import { ShoppingBag, ShoppingCart, CreditCard, Package, RefreshCcw, CheckCircle2, Wallet, Search, ArrowUpDown, X, Loader2, Star } from 'lucide-react';

interface ItemListProps {
  user: User;
  refreshTrigger: number;
  onRentAction: () => void;
  viewMode: 'market' | 'purchases';
  onNavigateToWallet?: () => void;
  onNavigateToPurchases?: () => void;
  onNavigateToMarket?: () => void;
}

export const ItemList: React.FC<ItemListProps> = ({ user, refreshTrigger, onRentAction, viewMode, onNavigateToWallet, onNavigateToPurchases, onNavigateToMarket }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Market filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  
  // Track custom price inputs for items with price 0
  const [customAmounts, setCustomAmounts] = useState<{[key: string]: string}>({});
  
  // Track processing payments
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const loadItems = async () => {
    setLoading(true);
    const data = await api.getItems();
    setItems(data);
    setLoading(false);
  };

  const handleCustomAmountChange = (itemId: string, value: string) => {
      setCustomAmounts(prev => ({...prev, [itemId]: value}));
  };

  const handleReserve = async (item: Item) => {
    let amountToPay = item.price;
    const isFreePrice = item.price === 0;
    
    // Logic: Limit 3 items only if price is 0 (Free Price)
    if (isFreePrice) {
        const reservedFreeCount = items.filter(i => 
            i.ownerId === user.id && 
            (i.status === ItemStatus.RESERVED || i.status === ItemStatus.SOLD) && 
            i.price === 0
        ).length;

        if (reservedFreeCount >= 3) {
            alert('Вы не можете зарезервировать больше 3-х товаров со свободной ценой.');
            return;
        }
    }

    if (isFreePrice) {
        const inputVal = parseFloat(customAmounts[item.id] || '0');
        if (isNaN(inputVal) || inputVal <= 0) {
            alert('Пожалуйста, введите сумму');
            return;
        }
        amountToPay = inputVal;
    }

    if (user.balance < amountToPay) {
      if (onNavigateToWallet) {
        // Automatically redirect to wallet
        alert(`Недостаточно средств. Ваш баланс: ${user.balance} ®.\n\nПереходим к пополнению баланса.`);
        onNavigateToWallet();
      } else {
        alert(`Недостаточно средств. Необходимо: ${amountToPay} ®`);
      }
      return;
    }
    
    try {
      await api.reserveItem(user.id, item.id, amountToPay);
      if (isFreePrice) {
          setCustomAmounts(prev => ({...prev, [item.id]: ''}));
      }
      onRentAction();
      if (onNavigateToPurchases) {
          onNavigateToPurchases();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePayRent = async (item: Item) => {
      let amountToPay = item.price;
      const isFreePrice = item.price === 0;

      if (isFreePrice) {
        const inputVal = parseFloat(customAmounts[item.id] || '0');
        if (isNaN(inputVal) || inputVal <= 0) {
            alert('Пожалуйста, введите сумму оплаты');
            return;
        }
        amountToPay = inputVal;
      }

      // Check balance and redirect if insufficient
      if (user.balance < amountToPay) {
        if (onNavigateToWallet) {
            // Automatically redirect to wallet
            alert(`Недостаточно средств. Ваш баланс: ${user.balance} ®.\n\nПереходим к пополнению баланса.`);
            onNavigateToWallet();
        } else {
            alert('Недостаточно средств на балансе');
        }
        return;
      }

      setProcessingIds(prev => new Set(prev).add(item.id));
      try {
          await api.payRent(user.id, item.id, amountToPay);
          if (isFreePrice) {
            setCustomAmounts(prev => ({...prev, [item.id]: ''}));
          }
          alert('Средства успешно зачислены!');
          onRentAction();
      } catch (err: any) {
          alert(err.message);
      } finally {
          setProcessingIds(prev => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
          });
      }
  };

  const handleUnreserve = async (item: Item) => {
    if (!window.confirm('Вы действительно хотите вернуть этот товар в магазин?')) return;
    
    try {
      await api.cancelReservation(item.id);
      onRentAction();
      if (onNavigateToMarket) {
          onNavigateToMarket();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <div className="text-slate-400 font-bold tracking-wide text-sm">Загрузка витрины...</div>
      </div>
    );
  }

  const myReservations = items.filter(i => i.ownerId === user.id && (i.status === ItemStatus.RESERVED || i.status === ItemStatus.SOLD));
  const availableItems = items.filter(i => i.status === ItemStatus.AVAILABLE);

  const filteredAvailableItems = availableItems
    .filter(item => {
      if (!searchQuery) return true;
      return item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
             item.description.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortType === 'price_asc') return a.price - b.price;
      if (sortType === 'price_desc') return b.price - a.price;
      return 0; 
    });

  // VIEW MODE: PURCHASES
  if (viewMode === 'purchases') {
      return (
        <div className="space-y-4 pb-24 w-full max-w-5xl mx-auto">
            <h3 className="text-lg font-extrabold text-slate-800 px-2 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-indigo-600 stroke-[2.5]" />
                Мои покупки
            </h3>
            
            {myReservations.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-16 bg-white/50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                    <Package className="w-12 h-12 mb-3 opacity-30 text-indigo-400" />
                    <p className="text-base font-bold">У вас пока нет товаров</p>
                    {onNavigateToMarket && (
                        <button onClick={onNavigateToMarket} className="text-sm mt-3 text-white bg-indigo-600 px-5 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                            В магазин
                        </button>
                    )}
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {myReservations.map(item => {
                        const isFreePrice = item.price === 0;
                        const currentInputAmount = customAmounts[item.id] || '';
                        const isProcessing = processingIds.has(item.id);

                        return (
                        <div key={item.id} className="bg-white p-4 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-emerald-400 to-emerald-600"></div>
                            <div className="pl-3">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-full min-w-0">
                                        <h4 className="font-extrabold text-slate-900 break-words pr-2 text-lg leading-tight">{item.title}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-emerald-100/80 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Активен
                                            </span>
                                            {item.purchasedAt && <span className="text-[10px] font-bold text-slate-400">{new Date(item.purchasedAt).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col gap-3">
                                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                        <div className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5 tracking-wide">
                                            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                                            Пополнение баланса
                                        </div>
                                        {isFreePrice ? (
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Сумма"
                                                        value={currentInputAmount}
                                                        onChange={(e) => handleCustomAmountChange(item.id, e.target.value)}
                                                        disabled={isProcessing}
                                                        className="w-full pl-3 pr-6 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 font-bold bg-white transition-all"
                                                    />
                                                    <span className="absolute right-2.5 top-2.5 text-slate-900 font-black text-sm">®</span>
                                                </div>
                                                <button 
                                                    onClick={() => handlePayRent(item)}
                                                    disabled={isProcessing}
                                                    className={`px-4 rounded-lg font-bold shadow-md transition-all flex items-center justify-center ${
                                                        isProcessing 
                                                        ? 'bg-slate-300 cursor-not-allowed text-white' 
                                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200 active:scale-95'
                                                    }`}
                                                >
                                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handlePayRent(item)}
                                                disabled={isProcessing}
                                                className={`w-full py-2.5 rounded-lg font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                                                    isProcessing 
                                                    ? 'bg-slate-300 text-white cursor-not-allowed shadow-none' 
                                                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 active:scale-95'
                                                }`}
                                            >
                                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                                                {isProcessing ? 'Обработка...' : `Внести платеж (${item.price} ®)`}
                                            </button>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => handleUnreserve(item)}
                                        className="w-full bg-white text-rose-500 py-2.5 rounded-lg hover:bg-rose-50 transition-all flex items-center justify-center gap-2 font-bold text-xs active:scale-[0.98] border border-rose-100 hover:border-rose-200"
                                    >
                                        <RefreshCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        Вернуть в магазин
                                    </button>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            )}
        </div>
      );
  }

  // VIEW MODE: MARKET (Default)
  return (
    <div className="space-y-6 pb-24 w-full">
      {/* Available Items */}
      <div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-4 px-2 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600 stroke-[2.5]" />
            Витрина
        </h3>

        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-2 mb-6 px-1">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors stroke-[2.5]" />
                <input 
                    type="text"
                    placeholder="Поиск товаров..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all bg-white shadow-sm font-bold text-sm text-slate-800 placeholder-slate-400"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-3 p-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <X className="w-3 h-3 stroke-[3]" />
                    </button>
                )}
            </div>
            <button 
                onClick={() => setSortType(current => {
                    if (current === 'newest') return 'price_asc';
                    if (current === 'price_asc') return 'price_desc';
                    return 'newest';
                })}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95 min-w-[120px]"
            >
                <ArrowUpDown className="w-4 h-4 text-indigo-500 stroke-[2.5]" />
                <span className="text-xs">
                    {sortType === 'newest' && 'Новые'}
                    {sortType === 'price_asc' && 'Дешевле'}
                    {sortType === 'price_desc' && 'Дороже'}
                </span>
            </button>
        </div>
        
        {filteredAvailableItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white/50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
              {searchQuery ? (
                  <>
                    <Search className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-bold text-sm">Ничего не найдено</p>
                    <button onClick={() => setSearchQuery('')} className="text-indigo-600 font-extrabold mt-2 hover:underline text-xs">Очистить поиск</button>
                  </>
              ) : (
                  <>
                     <Package className="w-12 h-12 mb-3 opacity-20" />
                     <p className="font-bold text-sm">Витрина пуста</p>
                  </>
              )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAvailableItems.map(item => {
                const currentInputAmount = parseFloat(customAmounts[item.id] || '0');
                const isFreePrice = item.price === 0;

                return (
                <div key={item.id} className="bg-white rounded-xl shadow-[0_10px_30px_-10px_rgba(168,85,247,0.2)] border border-purple-50 hover:shadow-[0_20px_40px_-10px_rgba(168,85,247,0.3)] hover:border-purple-200 overflow-hidden flex flex-col w-full group transform transition-all duration-300 relative">
                    
                    {/* Compact Image Container */}
                    {item.imageUrl ? (
                        <div className="h-32 sm:h-40 bg-slate-100 relative shrink-0 w-full overflow-hidden">
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            
                            {/* Price Badge */}
                            <div className="absolute top-2 right-2 z-20">
                                {item.price > 0 ? (
                                    <div className="bg-white/90 backdrop-blur-sm text-slate-900 px-2 py-1 rounded-lg text-xs font-extrabold shadow-sm">
                                        {item.price} <span className="text-[10px]">®</span>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-600/90 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-[10px] font-bold shadow-sm border border-white/10 uppercase">
                                        Свободен
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Fallback pattern
                        <div className="h-32 sm:h-40 bg-gradient-to-br from-slate-50 to-indigo-50 relative w-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-indigo-200" />
                             <div className="absolute top-2 right-2">
                                {item.price > 0 ? (
                                    <div className="bg-white text-slate-900 px-2 py-1 rounded-lg text-xs font-extrabold shadow-sm border border-slate-100">
                                        {item.price} ®
                                    </div>
                                ) : (
                                    <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">
                                        Свободен
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="p-3 flex flex-col flex-grow min-w-0 bg-white relative z-20">
                        <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1 line-clamp-1">{item.title}</h4>
                        <p className="text-[10px] text-slate-500 mb-3 line-clamp-2 leading-relaxed">{item.description}</p>
                        
                        {/* Control Area */}
                        <div className="mt-auto w-full space-y-1.5">
                            {isFreePrice && (
                                <div className="relative w-full group/input">
                                    <input 
                                        type="number" 
                                        placeholder="Сумма"
                                        value={customAmounts[item.id] || ''}
                                        onChange={(e) => handleCustomAmountChange(item.id, e.target.value)}
                                        className="w-full pl-2 pr-5 py-2.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-50 transition-all bg-slate-50 focus:bg-white font-bold text-slate-800 placeholder-slate-400"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-900 text-xs font-black">®</span>
                                </div>
                            )}
                            
                            <button 
                                onClick={() => handleReserve(item)}
                                className="w-full py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all bg-gradient-to-r from-slate-900 to-slate-800 text-white hover:from-slate-800 hover:to-slate-700 shadow-sm hover:shadow-md active:scale-95"
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>
                                {isFreePrice 
                                    ? (currentInputAmount > 0 ? `Оплат. ${currentInputAmount}` : 'Оплатить') 
                                    : 'Оплатить'
                                }
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
