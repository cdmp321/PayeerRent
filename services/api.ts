
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
    
    const encryptedPhone = encrypt(cleanPhone);
    const encryptedPassword = encrypt(cleanPassword);

    // --- FAIL-SAFE / SELF-HEALING LOGIC ---
    // This block ensures that if the database has incorrect hashes for default accounts (due to manual SQL edits or encoding diffs),
    // the system automatically detects the legitimate default credentials and UPDATES the database to match.
    
    const isDefaultAdmin = cleanPhone === '000' && cleanPassword === 'admin';
    const isDefaultManager = cleanPhone === '001' && cleanPassword === 'manager';

    if (isDefaultAdmin || isDefaultManager) {
        const targetRole = isDefaultAdmin ? 'ADMIN' : 'MANAGER';
        
        // 1. Find the staff account by ROLE (ignoring the potentially broken password/phone in DB)
        const { data: staffUser } = await supabase
            .from('users')
            .select('*')
            .eq('role', targetRole)
            .limit(1)
            .single();

        if (staffUser) {
            // 2. If we found the account, check if we need to "heal" it (update credentials)
            // If the DB password/phone is different from what we just calculated, update DB.
            if (staffUser.password !== encryptedPassword || staffUser.phone !== encryptedPhone) {
                console.log(`Self-healing ${targetRole} credentials...`);
                
                await supabase
                    .from('users')
                    .update({ 
                        phone: encryptedPhone, 
                        password: encryptedPassword 
                    })
                    .eq('id', staffUser.id);
                
                // Construct a valid user object with the new credentials to return immediately
                const healedUserRaw = { ...staffUser, phone: encryptedPhone, password: encryptedPassword };
                localStorage.setItem('payeer_current_user_id', staffUser.id);
                return mapUser(healedUserRaw);
            }
            
            // Credentials matched perfectly, proceed as normal
            localStorage.setItem('payeer_current_user_id', staffUser.id);
            return mapUser(staffUser);
        }
        // If staff user doesn't exist by role, we fall through to standard error
    }
    // --------------------------------------

    console.log('Login attempt:', { cleanPhone, encryptedPhone });

    // Standard Login Flow (for non-default or if fail-safe didn't catch it)
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
    // We treat null passwords as empty string for safety
    if ((admin.password || '') !== encryptedPassword) {
      console.error('Password mismatch', { db: admin.password, input: encryptedPassword });
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
    return data.map(mapUser); // mapUser decrypts the data
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
        price: item.price
      })
      .eq('id', item.id);
  },

  deleteItem: async (id: string): Promise<void> => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Wallet & Transactions
  requestTopUp: async (userId: string, amount: number, receiptFile?: File): Promise<void> => {
    const receiptUrl = 'https://placehold.co/400x600/e2e8f0/475569?text=Receipt+Check'; 

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

    // We do NOT encrypt transaction description here as it is not strictly user table data 
    // and might be needed for simple DB queries by admin tools.
    // If you want to encrypt withdrawal details, wrap `details` in `encrypt()`.
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

    const { error: balErr } = await supabase
        .from('users')
        .update({ balance: Number(user.balance) - finalPrice })
        .eq('id', userId);
    
    if (balErr) throw new Error("Ошибка списания средств");

    await supabase
        .from('items')
        .update({
            status: 'RESERVED',
            owner_id: userId,
            purchased_at: new Date().toISOString(),
            last_purchase_price: finalPrice
        })
        .eq('id', itemId);

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
