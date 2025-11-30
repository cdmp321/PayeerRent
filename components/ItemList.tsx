import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Item, ItemStatus, User } from '../types';
import { ShoppingBag, ShoppingCart, CreditCard, Package, RefreshCcw, CheckCircle2, Wallet, Search, ArrowUpDown, X, Loader2 } from 'lucide-react';

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
    // If price > 0 (Fixed Price), there is no limit.
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

    // If free price item, use input value
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
        alert(`Недостаточно средств. Ваш баланс: ${user.balance} Ⓡ. Необходимо: ${amountToPay} Ⓡ.\n\nПереходим к пополнению баланса.`);
        onNavigateToWallet();
      } else {
        alert(`Недостаточно средств. Необходимо: ${amountToPay} Ⓡ`);
      }
      return;
    }
    
    // Auto-pay without confirmation dialog

    try {
      await api.reserveItem(user.id, item.id, amountToPay);
      // Clear input
      if (isFreePrice) {
          setCustomAmounts(prev => ({...prev, [item.id]: ''}));
      }
      onRentAction();
      // Navigate to My Purchases tab automatically
      if (onNavigateToPurchases) {
          onNavigateToPurchases();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Logic for recurring payments (Rent/Extend)
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
            alert(`Недостаточно средств. Ваш баланс: ${user.balance} Ⓡ.`);
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
    // Removed confirmation for smoother user flow
    try {
      await api.cancelReservation(item.id);
      onRentAction();
      // Redirect back to Market (Showcase)
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
        <div className="text-gray-400 font-medium">Загрузка витрины...</div>
      </div>
    );
  }

  // Separate active purchases and available items
  const myReservations = items.filter(i => i.ownerId === user.id && (i.status === ItemStatus.RESERVED || i.status === ItemStatus.SOLD));
  const availableItems = items.filter(i => i.status === ItemStatus.AVAILABLE);
  const otherReserved = items.filter(i => (i.status === ItemStatus.RESERVED || i.status === ItemStatus.SOLD) && i.ownerId !== user.id);

  // Filter and Sort Available Items
  const filteredAvailableItems = availableItems
    .filter(item => {
      if (!searchQuery) return true;
      return item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
             item.description.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortType === 'price_asc') return a.price - b.price;
      if (sortType === 'price_desc') return b.price - a.price;
      // Default 'newest' relies on API order or could be explicit:
      // return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0; 
    });

  // VIEW MODE: PURCHASES
  if (viewMode === 'purchases') {
      return (
        <div className="space-y-6 pb-24 w-full">
            <h3 className="text-xl font-bold text-gray-800 px-2 flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-indigo-600" />
                Мои покупки и резервы
            </h3>
            
            {myReservations.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                    <Package className="w-16 h-16 mb-4 opacity-50 text-indigo-200" />
                    <p className="text-lg font-medium">У вас пока нет товаров</p>
                    {onNavigateToMarket && (
                        <button onClick={onNavigateToMarket} className="text-base mt-3 text-indigo-600 font-bold hover:underline">
                            Перейти в магазин
                        </button>
                    )}
                 </div>
            ) : (
                <div className="space-y-4">
                    {myReservations.map(item => {
                        const isFreePrice = item.price === 0;
                        const currentInputAmount = customAmounts[item.id] || '';
                        const isProcessing = processingIds.has(item.id);

                        return (
                        <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                            <div className="pl-4">
                                <div className="flex justify-between items-start mb-4">
                                <div className="w-full min-w-0">
                                    <h4 className="font-bold text-gray-800 break-words pr-2 text-xl">{item.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded">ЗАРЕЗЕРВИРОВАНО</span>
                                        {item.purchasedAt && <span className="text-xs text-gray-400">{new Date(item.purchasedAt).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                </div>
                                
                                <div className="flex flex-col gap-3">
                                    {/* Rent / Recurring Payment Block */}
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <div className="text-xs font-bold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                                            <Wallet className="w-4 h-4" />
                                            Пополнение средств
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
                                                        className="w-full pl-3 pr-8 py-2.5 border border-emerald-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                    />
                                                    <span className="absolute right-3 top-2.5 text-gray-400 font-bold text-sm">Ⓡ</span>
                                                </div>
                                                <button 
                                                    onClick={() => handlePayRent(item)}
                                                    disabled={isProcessing}
                                                    className={`px-4 rounded-lg font-bold shadow-sm transition-all flex items-center justify-center ${
                                                        isProcessing 
                                                        ? 'bg-gray-400 cursor-not-allowed' 
                                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                                                    }`}
                                                >
                                                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <CheckCircle2 className="w-6 h-6" />}
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handlePayRent(item)}
                                                disabled={isProcessing}
                                                className={`w-full py-3 rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2 ${
                                                    isProcessing 
                                                    ? 'bg-gray-400 text-white cursor-not-allowed shadow-none' 
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 active:scale-95'
                                                }`}
                                            >
                                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                                {isProcessing ? 'Обработка...' : `Внести платеж (${item.price} Ⓡ)`}
                                            </button>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => handleUnreserve(item)}
                                        className="w-full bg-white text-red-500 py-3 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2 font-bold text-sm active:scale-[0.98] border-2 border-red-50"
                                    >
                                        <RefreshCcw className="w-5 h-5" />
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
        <h3 className="text-xl font-bold text-gray-800 mb-4 px-2 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-blue-600" />
            Витрина
        </h3>

        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 px-1">
            <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 h-6 w-6 text-indigo-500" />
                <input 
                    type="text"
                    placeholder="Поиск товаров..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-10 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white shadow-sm font-medium"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-3.5 p-0.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
            <button 
                onClick={() => setSortType(current => {
                    if (current === 'newest') return 'price_asc';
                    if (current === 'price_asc') return 'price_desc';
                    return 'newest';
                })}
                className="px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm min-w-[140px]"
            >
                <ArrowUpDown className="w-6 h-6 text-indigo-600" />
                <span className="text-sm">
                    {sortType === 'newest' && 'Новые'}
                    {sortType === 'price_asc' && 'Дешевле'}
                    {sortType === 'price_desc' && 'Дороже'}
                </span>
            </button>
        </div>
        
        {filteredAvailableItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
              {searchQuery ? (
                  <>
                    <Search className="w-12 h-12 mb-2 opacity-30" />
                    <p>По запросу "{searchQuery}" ничего не найдено</p>
                    <button onClick={() => setSearchQuery('')} className="text-indigo-600 font-bold mt-2 text-sm">Очистить поиск</button>
                  </>
              ) : (
                  <>
                     <Package className="w-12 h-12 mb-2 opacity-30" />
                     <p>Нет доступных товаров</p>
                  </>
              )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredAvailableItems.map(item => {
                const currentInputAmount = parseFloat(customAmounts[item.id] || '0');
                const isFreePrice = item.price === 0;

                return (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col w-full group">
                    
                    {/* Conditionally render image if URL exists */}
                    {item.imageUrl && (
                        <div className="h-64 bg-gray-200 relative shrink-0 w-full overflow-hidden">
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        {item.price > 0 ? (
                            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur text-gray-900 px-4 py-2 rounded-xl text-base font-extrabold shadow-md">
                                {item.price} Ⓡ
                            </div>
                        ) : (
                            <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">
                                Свободная цена
                            </div>
                        )}
                        </div>
                    )}

                    <div className="p-6 flex flex-col flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                        <h4 className="font-bold text-gray-900 text-2xl leading-tight mb-2 break-words">{item.title}</h4>
                        {/* Show price badge here if no image */}
                        {!item.imageUrl && (
                            <div className={`px-3 py-1.5 rounded-xl text-sm font-bold whitespace-nowrap ml-2 ${item.price > 0 ? 'bg-gray-100 text-gray-900' : 'bg-blue-100 text-blue-700'}`}>
                                {item.price > 0 ? `${item.price} Ⓡ` : 'Свободная цена'}
                            </div>
                        )}
                    </div>
                    
                    <p className="text-base text-gray-500 mb-6 break-words leading-relaxed">{item.description}</p>
                    
                    {/* Control Area */}
                    <div className="space-y-4 mt-auto w-full">
                        {isFreePrice && (
                            <div className="relative w-full">
                                <input 
                                    type="number" 
                                    placeholder="Пополнение средств"
                                    value={customAmounts[item.id] || ''}
                                    onChange={(e) => handleCustomAmountChange(item.id, e.target.value)}
                                    className="w-full pl-4 pr-10 py-4 border-2 border-gray-100 rounded-xl text-lg outline-none focus:border-indigo-500 focus:ring-0 transition-all bg-gray-50 focus:bg-white font-bold text-gray-800 placeholder-gray-400"
                                />
                                <span className="absolute right-4 top-4 text-gray-400 text-lg font-bold">Ⓡ</span>
                            </div>
                        )}
                        
                        <button 
                            onClick={() => handleReserve(item)}
                            className="w-full py-4 rounded-xl font-extrabold text-lg flex items-center justify-center gap-2.5 transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-[0.98]"
                        >
                            <CreditCard className="w-7 h-7 shrink-0" />
                            <span className="truncate">
                            {isFreePrice 
                                ? (currentInputAmount > 0 ? `Оплатить ${currentInputAmount} Ⓡ` : 'Оплатить') 
                                : `Оплатить ${item.price} Ⓡ`
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

      {/* Other Reserved Items */}
      {otherReserved.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-bold text-gray-400 mb-4 px-2 uppercase tracking-wide text-xs">Недавно куплено</h3>
          <div className="grid grid-cols-1 gap-3 opacity-60 grayscale hover:grayscale-0 transition-all">
            {otherReserved.map(item => (
              <div key={item.id} className="bg-gray-50 p-3 rounded-xl flex items-center gap-4 overflow-hidden w-full border border-gray-100">
                {item.imageUrl ? (
                    <div className="w-14 h-14 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-14 h-14 bg-gray-200 rounded-lg flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-6 h-6 text-gray-400" />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-gray-600 truncate text-base">{item.title}</h4>
                  <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold uppercase mt-1">
                    <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                    Продано
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};