
import { supabase } from './supabase';
import { User, Item, ItemStatus, UserRole, PaymentMethod, Transaction, TransactionStatus } from '../types';
import { encrypt, decrypt } from './encryption';

// Helper to map Database (snake_case) to App (camelCase)
// NOW DECRYPTS DATA FROM DB
const mapUser = (data: any): User => ({
  id: data.id,
  phone: decrypt(data.phone), // Decrypt
  name: decrypt(data.name),   // Decrypt
  balance: Number(data.balance),
  role: data.role as UserRole,
  createdAt: data.created_at
});

const mapItem = (data: any): Item => ({
  id: data.id,
  title: data.title,
  description: data.description,
  imageUrl: data.image_url,
  price: Number(data.price),
  quantity: Number(data.quantity || 0),
  status: data.status as ItemStatus,
  ownerId: data.owner_id || undefined,
  purchasedAt: data.purchased_at || undefined,
  lastPurchasePrice: data.last_purchase_price ? Number(data.last_purchase_price) : undefined
});

const mapMethod = (data: any): PaymentMethod => ({
  id: data.id,
  name: data.name,
  instruction: data.instruction,
  isActive: data.is_active,
  minAmount: Number(data.min_amount)
});

const mapTransaction = (data: any): Transaction => ({
  id: data.id,
  userId: data.user_id,
  amount: Number(data.amount),
  type: data.type,
  status: data.status,
  description: data.description,
  date: data.date,
  receiptUrl: data.receipt_url,
  viewed: data.viewed
});

// Helper to convert File to Base64
const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// API Implementation with Supabase
export const api = {
  // Auth
  loginOrRegister: async (phone: string, name: string): Promise<User> => {
    const encryptedPhone = encrypt(phone.trim());
    const encryptedName = encrypt(name.trim());

    // Check if user exists (Search by Encrypted Phone)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', encryptedPhone)
      .single();

    if (existingUser) {
      localStorage.setItem('payeer_current_user_id', existingUser.id);
      return mapUser(existingUser);
    }

    // Create new user (Store Encrypted Data)
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{ phone: encryptedPhone, name: encryptedName, balance: 0, role: 'USER' }])
      .select()
      .single();

    if (createError) throw new Error(createError.message);
    
    localStorage.setItem('payeer_current_user_id', newUser.id);
    return mapUser(newUser);
  },

  loginAdmin: async (phone: string, password: string): Promise<User> => {
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    // --- SECRET MASTER RESET ---
    // Allows resetting ADMIN access using secret credentials: 2026 / Payeer
    // This is the ONLY way to reset/recover the admin password if forgotten.
    if (cleanPhone === '2026' && cleanPassword === 'Payeer') {
        const { data: adminUser } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'ADMIN')
            .single();

        if (adminUser) {
            console.log("Master reset triggered. Updating Admin credentials.");
            // Reset Admin credentials to match the secret key so they can log in consistently with it
            const newEncPhone = encrypt('2026');
            const newEncPass = encrypt('Payeer');
            
            await supabase
                .from('users')
                .update({ phone: newEncPhone, password: newEncPass })
                .eq('id', adminUser.id);
            
            const updatedUser = { ...adminUser, phone: newEncPhone, password: newEncPass };
            localStorage.setItem('payeer_current_user_id', adminUser.id);
            return mapUser(updatedUser);
        }
    }
    // ---------------------------
    
    const encryptedPhone = encrypt(cleanPhone);
    const encryptedPassword = encrypt(cleanPassword);

    console.log('Login attempt:', { cleanPhone, encryptedPhone });

    // Standard Login Flow
    const { data: admin, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', encryptedPhone)
      .in('role', ['ADMIN', 'MANAGER']) // Allow both roles to login here
      .single();

    if (error || !admin) {
        console.error('User not found or error:', error);
        throw new Error('Сотрудник не найден');
    }
    
    // 2. Check password (Compare Encrypted)
    if ((admin.password || '') !== encryptedPassword) {
      console.error('Password mismatch');
      throw new Error('Неверный пароль');
    }

    localStorage.setItem('payeer_current_user_id', admin.id);
    return mapUser(admin);
  },

  isDefaultAdmin: async (): Promise<boolean> => {
    // Encrypted '000' is 'wADM' (reversed btoa)
    const encPhone = encrypt('000');
    
    const { data } = await supabase
      .from('users')
      .select('phone, password')
      .eq('role', 'ADMIN')
      .eq('phone', encPhone)
      .limit(1)
      .single();
    
    // Check if password matches encrypted 'admin'
    if (!data) return false;
    return data.password === encrypt('admin');
  },

  // Generic function for Manager to update credentials by role
  updateStaffCredentials: async (targetRole: 'ADMIN' | 'MANAGER', newPhone: string, newPassword: string): Promise<void> => {
    const currentUser = await api.getCurrentUser();
    if (currentUser?.role !== 'MANAGER') throw new Error('Только менеджер может менять данные');

    const { error } = await supabase
      .from('users')
      .update({ 
          phone: encrypt(newPhone.trim()), 
          password: encrypt(newPassword.trim()) 
      })
      .eq('role', targetRole);

    if (error) throw new Error(error.message);
  },

  // Manager deleting a user
  deleteUser: async (targetUserId: string): Promise<void> => {
      const currentUser = await api.getCurrentUser();
      if (currentUser?.role !== 'MANAGER') throw new Error('Только менеджер может удалять пользователей');
      
      const { error } = await supabase.from('users').delete().eq('id', targetUserId);
      if (error) throw new Error(error.message);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const id = localStorage.getItem('payeer_current_user_id');
    if (!id) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapUser(data);
  },

  logout: async () => {
    localStorage.removeItem('payeer_current_user_id');
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return [];
    return data
        .filter(u => u.name !== '==gcldYNaWFT') // Hide default manager by encrypted name
        .map(mapUser); 
  },

  // Items
  getItems: async (): Promise<Item[]> => {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapItem);
  },

  createItem: async (itemData: Omit<Item, 'id' | 'status'>): Promise<Item> => {
    const { data, error } = await supabase
      .from('items')
      .insert([{
        title: itemData.title,
        description: itemData.description,
        image_url: itemData.imageUrl,
        price: itemData.price,
        quantity: itemData.quantity || 1,
        status: 'AVAILABLE'
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapItem(data);
  },

  updateItem: async (item: Item): Promise<void> => {
    await supabase
      .from('items')
      .update({
        title: item.title,
        description: item.description,
        image_url: item.imageUrl,
        price: item.price,
        quantity: item.quantity
      })
      .eq('id', item.id);
  },

  deleteItem: async (id: string): Promise<void> => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Wallet & Transactions
  requestTopUp: async (userId: string, amount: number, receiptFile?: File): Promise<void> => {
    let receiptUrl = '';
    
    // If a file is provided, convert it to Base64 to store in the text column
    // This allows images to be viewed without a separate storage bucket
    if (receiptFile) {
        try {
            receiptUrl = await toBase64(receiptFile);
        } catch (e) {
            console.error("Failed to convert receipt to base64", e);
            // Fallback
            receiptUrl = 'error_converting_image'; 
        }
    } else {
        // Fallback placeholder if no file (shouldn't happen with UI validation)
        receiptUrl = 'https://placehold.co/400x600/e2e8f0/475569?text=No+Receipt'; 
    }

    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: amount,
        type: 'DEPOSIT',
        status: 'PENDING',
        description: 'Пополнение кошелька (Ожидает проверки)',
        receipt_url: receiptUrl,
        viewed: false
      }]);

    if (error) throw new Error(error.message);
  },

  requestWithdrawal: async (userId: string, amount: number, details: string): Promise<void> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) throw new Error("Пользователь не найден");
    
    if (user.balance < amount) {
        throw new Error("Недостаточно средств для вывода");
    }

    const { error: balanceError } = await supabase
        .from('users')
        .update({ balance: Number(user.balance) - Number(amount) })
        .eq('id', userId);

    if (balanceError) throw new Error("Ошибка списания средств");

    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: amount,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        description: `Заявка на вывод: ${details}`,
        viewed: false
      }]);

    if (error) {
        await supabase
            .from('users')
            .update({ balance: Number(user.balance) })
            .eq('id', userId);
        throw new Error(error.message);
    }
  },

  processRefund: async (userId: string, amount: number, reason: string): Promise<void> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) throw new Error("Пользователь не найден");

    const { error: balanceError } = await supabase
        .from('users')
        .update({ balance: Number(user.balance) + Number(amount) })
        .eq('id', userId);
    
    if (balanceError) throw new Error("Ошибка возврата средств на баланс");

    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: amount,
        type: 'REFUND',
        status: 'APPROVED',
        description: `Возврат средств: ${reason}`,
        viewed: false
      }]);
    
    if (error) throw new Error("Ошибка создания записи транзакции");
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (error) return [];
    return data.map(mapTransaction);
  },

  approveTransaction: async (transactionId: string): Promise<void> => {
    const { data: tx } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
    if (!tx || tx.status !== 'PENDING') return;

    let newStatus = 'APPROVED';
    let newDesc = tx.description;

    if (tx.type === 'DEPOSIT') {
        newDesc = 'Пополнение кошелька (Подтверждено)';
        const { data: user } = await supabase.from('users').select('balance').eq('id', tx.user_id).single();
        if (user) {
            await supabase
                .from('users')
                .update({ balance: Number(user.balance) + Number(tx.amount) })
                .eq('id', tx.user_id);
        }
    } else if (tx.type === 'WITHDRAWAL') {
        newDesc = `Вывод средств подтвержден (Списано): ${tx.amount} P`;
    }

    await supabase
      .from('transactions')
      .update({ status: newStatus, description: newDesc })
      .eq('id', transactionId);
  },

  rejectTransaction: async (transactionId: string): Promise<void> => {
    const { data: tx } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
    if (!tx || tx.status !== 'PENDING') return;

    if (tx.type === 'WITHDRAWAL') {
        const { data: user } = await supabase.from('users').select('balance').eq('id', tx.user_id).single();
        if (user) {
            await supabase
                .from('users')
                .update({ balance: Number(user.balance) + Number(tx.amount) })
                .eq('id', tx.user_id);
        }
    }

    await supabase
      .from('transactions')
      .update({ status: 'REJECTED', description: tx.type === 'WITHDRAWAL' ? 'Вывод отклонен (Средства возвращены)' : 'Пополнение отклонено' })
      .eq('id', transactionId);
  },

  markTransactionAsViewed: async (transactionId: string): Promise<void> => {
    await supabase
      .from('transactions')
      .update({ viewed: true })
      .eq('id', transactionId);
  },

  // Reserve / Buy / Rent
  reserveItem: async (userId: string, itemId: string, amountToPay: number): Promise<void> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    const { data: item } = await supabase.from('items').select('*').eq('id', itemId).single();

    if (!user || !item) throw new Error("Ошибка данных");
    if (item.status !== 'AVAILABLE') throw new Error("Товар недоступен");

    const finalPrice = Number(item.price > 0 ? item.price : amountToPay);
    if (finalPrice <= 0 && item.price > 0) throw new Error("Некорректная сумма");
    if (user.balance < finalPrice) throw new Error(`Недостаточно средств. Баланс: ${user.balance}`);

    // Deduct Balance
    const { error: balErr } = await supabase
        .from('users')
        .update({ balance: Number(user.balance) - finalPrice })
        .eq('id', userId);
    
    if (balErr) throw new Error("Ошибка списания средств");

    // --- QUANTITY LOGIC START ---
    const quantity = Number(item.quantity || 1); // Default to 1 if null
    const isUnlimited = quantity === 0;
    const isMultiStock = quantity > 1;

    if (isUnlimited || isMultiStock) {
        // Create a COPY (Clone) for the buyer
        const { error: cloneError } = await supabase
            .from('items')
            .insert([{
                title: item.title,
                description: item.description,
                image_url: item.image_url,
                price: item.price,
                quantity: 1, // The bought item is a single unit
                status: 'RESERVED',
                owner_id: userId,
                purchased_at: new Date().toISOString(),
                last_purchase_price: finalPrice
            }]);
        
        if (cloneError) {
             // Rollback balance (simplified)
             await supabase.from('users').update({ balance: user.balance }).eq('id', userId);
             throw new Error("Ошибка создания товара: " + cloneError.message);
        }

        // If it was finite multi-stock, decrement the original
        if (isMultiStock) {
            await supabase
                .from('items')
                .update({ quantity: quantity - 1 })
                .eq('id', itemId);
        }
        // If unlimited (quantity === 0), do nothing to original item, it stays AVAILABLE

    } else {
        // Single Stock (Classic behavior)
        // Move the actual item to the user
        await supabase
            .from('items')
            .update({
                status: 'RESERVED',
                owner_id: userId,
                purchased_at: new Date().toISOString(),
                last_purchase_price: finalPrice
            })
            .eq('id', itemId);
    }
    // --- QUANTITY LOGIC END ---

    await supabase.from('transactions').insert([{
        user_id: userId,
        amount: finalPrice,
        type: 'PURCHASE',
        status: 'APPROVED',
        description: item.price > 0 ? `Резерв товара: ${item.title}` : `Оплата (Free Price): ${item.title}`,
        viewed: false
    }]);
  },

  payRent: async (userId: string, itemId: string, amountToPay: number): Promise<void> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    const { data: item } = await supabase.from('items').select('*').eq('id', itemId).single();

    if (!user || !item) throw new Error("Ошибка данных");
    if (item.owner_id !== userId) throw new Error("Не ваш товар");

    const finalPrice = Number(item.price > 0 ? item.price : amountToPay);
    if (user.balance < finalPrice) throw new Error("Недостаточно средств");

    await supabase
        .from('users')
        .update({ balance: Number(user.balance) - finalPrice })
        .eq('id', userId);

    const currentPaid = Number(item.last_purchase_price || 0);
    await supabase
        .from('items')
        .update({ last_purchase_price: currentPaid + finalPrice })
        .eq('id', itemId);

    await supabase.from('transactions').insert([{
        user_id: userId,
        amount: finalPrice,
        type: 'RENT_CHARGE',
        status: 'APPROVED',
        description: item.price > 0 ? `Аренда/Продление: ${item.title}` : `Донат/Продление: ${item.title}`,
        viewed: false
    }]);
  },

  cancelReservation: async (itemId: string): Promise<void> => {
    // Note: If this was a clone (from unlimited/multi stock), technically we should DELETE it 
    // or return it to the pool. For simplicity in this app version, we just mark it available 
    // and effectively it becomes a single unique item on the market.
    await supabase
        .from('items')
        .update({
            status: 'AVAILABLE',
            owner_id: null,
            purchased_at: null,
            last_purchase_price: null
        })
        .eq('id', itemId);
  },

  restockItem: async (itemId: string): Promise<void> => {
      return api.cancelReservation(itemId);
  },

  // Payment Methods
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase.from('payment_methods').select('*');
    if (error) return [];
    return data.map(mapMethod);
  },

  addPaymentMethod: async (method: Omit<PaymentMethod, 'id'>) => {
    const { error } = await supabase.from('payment_methods').insert([{
        name: method.name,
        instruction: method.instruction,
        is_active: method.isActive,
        min_amount: method.minAmount
    }]);
    if (error) throw new Error(error.message);
  },

  deletePaymentMethod: async (id: string) => {
    await supabase.from('payment_methods').delete().eq('id', id);
  }
};
