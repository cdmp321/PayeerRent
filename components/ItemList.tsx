
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
        alert(`Недостаточно средств. Ваш баланс: ${user.balance} ®. Необходимо: ${amountToPay} ®.\n\nПереходим к пополнению баланса.`);
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
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <div className="text-slate-400 font-bold tracking-wide">Загрузка витрины...</div>
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
        <div className="space-y-6 pb-24 w-full">
            <h3 className="text-xl font-extrabold text-slate-800 px-2 flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-indigo-600 stroke-[2.5]" />
                Мои покупки
            </h3>
            
            {myReservations.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                    <Package className="w-20 h-20 mb-4 opacity-30 text-indigo-400" />
                    <p className="text-lg font-bold">У вас пока нет товаров</p>
                    {onNavigateToMarket && (
                        <button onClick={onNavigateToMarket} className="text-base mt-4 text-white bg-indigo-600 px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                            В магазин
                        </button>
                    )}
                 </div>
            ) : (
                <div className="space-y-5">
                    {myReservations.map(item => {
                        const isFreePrice = item.price === 0;
                        const currentInputAmount = customAmounts[item.id] || '';
                        const isProcessing = processingIds.has(item.id);

                        return (
                        <div key={item.id} className="bg-white p-6 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-emerald-400 to-emerald-600"></div>
                            <div className="pl-4">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="w-full min-w-0">
                                        <h4 className="font-extrabold text-slate-900 break-words pr-2 text-xl leading-tight">{item.title}</h4>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="bg-emerald-100/80 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Активен
                                            </span>
                                            {item.purchasedAt && <span className="text-xs font-bold text-slate-400">{new Date(item.purchasedAt).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col gap-4">
                                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                                        <div className="text-xs font-black text-slate-500 uppercase mb-3 flex items-center gap-1.5 tracking-wide">
                                            <Wallet className="w-4 h-4 text-emerald-500" />
                                            Пополнение баланса
                                        </div>
                                        {isFreePrice ? (
                                            <div className="flex gap-3">
                                                <div className="relative flex-1">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Сумма"
                                                        value={currentInputAmount}
                                                        onChange={(e) => handleCustomAmountChange(item.id, e.target.value)}
                                                        disabled={isProcessing}
                                                        className="w-full pl-4 pr-8 py-3.5 border-2 border-slate-200 rounded-xl text-base focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 font-bold bg-white transition-all"
                                                    />
                                                    <span className="absolute right-3.5 top-3.5 text-slate-900 font-black text-base">®</span>
                                                </div>
                                                <button 
                                                    onClick={() => handlePayRent(item)}
                                                    disabled={isProcessing}
                                                    className={`px-5 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center ${
                                                        isProcessing 
                                                        ? 'bg-slate-300 cursor-not-allowed text-white' 
                                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200 active:scale-95'
                                                    }`}
                                                >
                                                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handlePayRent(item)}
                                                disabled={isProcessing}
                                                className={`w-full py-3.5 rounded-xl font-extrabold text-base shadow-lg transition-all flex items-center justify-center gap-2 ${
                                                    isProcessing 
                                                    ? 'bg-slate-300 text-white cursor-not-allowed shadow-none' 
                                                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 active:scale-95'
                                                }`}
                                            >
                                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                                {isProcessing ? 'Обработка...' : `Внести платеж (${item.price} ®)`}
                                            </button>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => handleUnreserve(item)}
                                        className="w-full bg-white text-rose-500 py-3.5 rounded-xl hover:bg-rose-50 transition-all flex items-center justify-center gap-2 font-bold text-sm active:scale-[0.98] border-2 border-rose-100 hover:border-rose-200"
                                    >
                                        <RefreshCcw className="w-4 h-4 stroke-[2.5]" />
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
    <div className="space-y-8 pb-24 w-full">
      {/* Available Items */}
      <div>
        <h3 className="text-xl font-extrabold text-slate-800 mb-5 px-2 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-600 stroke-[2.5]" />
            Витрина
        </h3>

        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8 px-1">
            <div className="relative flex-1 group">
                <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors stroke-[2.5]" />
                <input 
                    type="text"
                    placeholder="Поиск товаров..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-10 py-4 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none transition-all bg-white shadow-sm font-bold text-slate-800 placeholder-slate-400"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-4 p-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                        <X className="w-4 h-4 stroke-[3]" />
                    </button>
                )}
            </div>
            <button 
                onClick={() => setSortType(current => {
                    if (current === 'newest') return 'price_asc';
                    if (current === 'price_asc') return 'price_desc';
                    return 'newest';
                })}
                className="px-5 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95 min-w-[140px]"
            >
                <ArrowUpDown className="w-5 h-5 text-indigo-500 stroke-[2.5]" />
                <span className="text-sm">
                    {sortType === 'newest' && 'Новые'}
                    {sortType === 'price_asc' && 'Дешевле'}
                    {sortType === 'price_desc' && 'Дороже'}
                </span>
            </button>
        </div>
        
        {filteredAvailableItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white/50 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400">
              {searchQuery ? (
                  <>
                    <Search className="w-16 h-16 mb-4 opacity-20" />
                    <p className="font-bold">Ничего не найдено</p>
                    <button onClick={() => setSearchQuery('')} className="text-indigo-600 font-extrabold mt-3 hover:underline">Очистить поиск</button>
                  </>
              ) : (
                  <>
                     <Package className="w-16 h-16 mb-4 opacity-20" />
                     <p className="font-bold">Витрина пуста</p>
                  </>
              )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {filteredAvailableItems.map(item => {
                const currentInputAmount = parseFloat(customAmounts[item.id] || '0');
                const isFreePrice = item.price === 0;

                return (
                <div key={item.id} className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-50 hover:border-indigo-100 overflow-hidden flex flex-col w-full group transform transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-100/50 relative">
                    
                    {/* Modern Image Container with Glassmorphic Badges */}
                    {item.imageUrl ? (
                        <div className="h-72 bg-slate-100 relative shrink-0 w-full overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 z-10" />
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            
                            {/* Price Badge */}
                            <div className="absolute bottom-4 right-4 z-20">
                                {item.price > 0 ? (
                                    <div className="bg-white/95 backdrop-blur-md text-slate-900 px-5 py-2.5 rounded-2xl text-lg font-black shadow-lg flex items-center gap-1">
                                        {item.price} <span className="text-sm">®</span>
                                    </div>
                                ) : (
                                    <div className="bg-blue-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg border border-white/20 uppercase tracking-wide">
                                        Свободная цена
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Fallback pattern if no image
                        <div className="h-40 bg-gradient-to-br from-slate-50 to-indigo-50 relative w-full border-b border-slate-100 flex items-center justify-center">
                            <div className="text-slate-200 group-hover:text-indigo-200 transition-colors duration-500">
                                <Package className="w-20 h-20" />
                            </div>
                            <div className="absolute top-4 right-4">
                                {item.price > 0 ? (
                                    <div className="bg-white text-slate-900 px-4 py-2 rounded-xl text-base font-black shadow-sm border border-slate-100">
                                        {item.price} ®
                                    </div>
                                ) : (
                                    <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-black uppercase">
                                        Свободная цена
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="p-7 flex flex-col flex-grow min-w-0 bg-white relative z-20">
                        <div className="flex justify-between items-start mb-3">
                            <h4 className="font-extrabold text-slate-900 text-2xl leading-tight break-words tracking-tight">{item.title}</h4>
                        </div>
                        
                        <p className="text-base text-slate-500 mb-8 break-words leading-relaxed font-medium">{item.description}</p>
                        
                        {/* Control Area */}
                        <div className="space-y-4 mt-auto w-full">
                            {isFreePrice && (
                                <div className="relative w-full group/input">
                                    <input 
                                        type="number" 
                                        placeholder="Сумма пополнения"
                                        value={customAmounts[item.id] || ''}
                                        onChange={(e) => handleCustomAmountChange(item.id, e.target.value)}
                                        className="w-full pl-5 pr-12 py-4 border-2 border-slate-100 rounded-2xl text-lg outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all bg-slate-50 focus:bg-white font-bold text-slate-800 placeholder-slate-400"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-900 text-lg font-black">®</span>
                                </div>
                            )}
                            
                            <button 
                                onClick={() => handleReserve(item)}
                                className="w-full py-4 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-3 transition-all bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 active:scale-[0.98] relative overflow-hidden group/btn"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                                <CreditCard className="w-6 h-6 shrink-0 stroke-[2.5]" />
                                <span className="relative z-10">
                                {isFreePrice 
                                    ? (currentInputAmount > 0 ? `Оплатить ${currentInputAmount} ®` : 'Перейти к оплате') 
                                    : `Оплатить ${item.price} ®`
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
