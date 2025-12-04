
import { supabase } from './supabase';
import { User, Item, ItemStatus, UserRole, PaymentMethod, Transaction, TransactionStatus } from '../types';
import { encrypt, decrypt, hashPassword, generateToken } from './encryption';

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
  title: decrypt(data.title), // Decrypt title
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
  name: decrypt(data.name), // Decrypt name
  instruction: decrypt(data.instruction), // Decrypt instruction
  isActive: data.is_active,
  minAmount: Number(data.min_amount),
  imageUrl: data.image_url,
  paymentUrl: decrypt(data.payment_url) // Decrypt paymentUrl
});

const mapTransaction = (data: any): Transaction => ({
  id: data.id,
  userId: data.user_id,
  amount: Number(data.amount),
  type: data.type,
  status: data.status,
  description: decrypt(data.description), // Decrypt description
  date: data.date,
  receiptUrl: data.receipt_url,
  viewed: data.viewed
});

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
  loginOrRegister: async (phone: string, password: string, name: string): Promise<{user: User, isNew: boolean}> => {
    const cleanPhone = phone.trim();
    const encryptedPhone = encrypt(cleanPhone);
    const hashedPassword = await hashPassword(password.trim()); // Hash input
    const legacyEncryptedPassword = encrypt(password.trim()); // Legacy check
    
    // Generate default name if empty (since input is removed from UI)
    const finalName = name.trim() || `Пользователь ${cleanPhone.slice(-4)}`;
    const encryptedName = encrypt(finalName);

    // Check if user exists (Search by Encrypted Phone)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', encryptedPhone)
      .single();

    if (existingUser) {
      // SECURITY: If Admin/Manager logs in via Client form, force role to USER
      if (existingUser.role === 'ADMIN' || existingUser.role === 'MANAGER') {
           // We temporarily treat them as a USER for this session logic
           const userClone = { ...existingUser, role: 'USER' };
           
           // Password Check
           if (userClone.password) {
               // 1. Try Hash Match
               if (userClone.password === hashedPassword) {
                   // OK
               }
               // 2. Try Legacy Match (Migration)
               else if (userClone.password === legacyEncryptedPassword) {
                   console.log("Migrating Admin/Manager password to hash...");
                   await supabase.from('users').update({ password: hashedPassword }).eq('id', userClone.id);
               } else {
                   throw new Error('Неверный пароль');
               }
           }
           
           localStorage.setItem('payeer_current_user_id', userClone.id);
           localStorage.setItem('payeer_auth_token', generateToken({ id: userClone.id, role: 'USER' }));
           const mapped = mapUser(userClone);
           return { user: { ...mapped, role: UserRole.USER }, isNew: false };
      }

      // CLIENT LOGIC
      if (existingUser.password) {
          if (existingUser.password === hashedPassword) {
              // Hash matches, all good
          } else if (existingUser.password === legacyEncryptedPassword) {
              // Legacy match -> Migrate to hash
              console.log("Migrating user password to hash...");
              await supabase.from('users').update({ password: hashedPassword }).eq('id', existingUser.id);
          } else {
              throw new Error('Неверный пароль');
          }
      } else {
          // If no password set yet (legacy account), set it now
          await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', existingUser.id);
      }

      localStorage.setItem('payeer_current_user_id', existingUser.id);
      localStorage.setItem('payeer_auth_token', generateToken({ id: existingUser.id, role: existingUser.role }));
      return { user: mapUser(existingUser), isNew: false };
    }

    // NEW USER REGISTRATION
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{ 
          phone: encryptedPhone, 
          name: encryptedName, 
          password: hashedPassword, // Store Hash
          balance: 0, 
          role: 'USER' 
      }])
      .select()
      .single();

    if (createError) throw new Error(createError.message);
    
    localStorage.setItem('payeer_current_user_id', newUser.id);
    localStorage.setItem('payeer_auth_token', generateToken({ id: newUser.id, role: 'USER' }));
    return { user: mapUser(newUser), isNew: true };
  },

  loginAdmin: async (phone: string, password: string): Promise<{user: User, isNew: boolean}> => {
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();

    // --- SECRET MASTER RESET (ADMIN) ---
    // 2026 / Payeer
    if (cleanPhone === '2026' && cleanPassword === 'Payeer') {
        const { data: adminUser } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'ADMIN')
            .single();

        if (adminUser) {
            console.log("Master reset triggered. Updating Admin credentials to Hash.");
            const newEncPhone = encrypt('2026');
            const newHashedPass = await hashPassword('Payeer');
            
            await supabase
                .from('users')
                .update({ phone: newEncPhone, password: newHashedPass })
                .eq('id', adminUser.id);
            
            const updatedUser = { ...adminUser, phone: newEncPhone, password: newHashedPass };
            localStorage.setItem('payeer_current_user_id', adminUser.id);
            localStorage.setItem('payeer_auth_token', generateToken({ id: adminUser.id, role: 'ADMIN' }));
            return { user: mapUser(updatedUser), isNew: false };
        }
    }

    // --- SECRET MASTER RESET (MANAGER) ---
    // Payeer / 2026
    if (cleanPhone === 'Payeer' && cleanPassword === '2026') {
        const { data: managerUser } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'MANAGER')
            .single();

        if (managerUser) {
            console.log("Manager master reset triggered. Updating Manager credentials to Hash.");
            const newEncPhone = encrypt('Payeer');
            const newHashedPass = await hashPassword('2026');
            
            await supabase
                .from('users')
                .update({ phone: newEncPhone, password: newHashedPass })
                .eq('id', managerUser.id);
            
            const updatedUser = { ...managerUser, phone: newEncPhone, password: newHashedPass };
            localStorage.setItem('payeer_current_user_id', managerUser.id);
            localStorage.setItem('payeer_auth_token', generateToken({ id: managerUser.id, role: 'MANAGER' }));
            return { user: mapUser(updatedUser), isNew: false };
        }
    }
    // ---------------------------
    
    const encryptedPhone = encrypt(cleanPhone);
    const hashedPassword = await hashPassword(cleanPassword);
    const legacyEncryptedPassword = encrypt(cleanPassword);

    console.log('Login attempt:', { cleanPhone, encryptedPhone });

    // Standard Login Flow
    const { data: admin, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', encryptedPhone)
      .in('role', ['ADMIN', 'MANAGER']) 
      .single();

    if (error || !admin) {
        console.error('User not found or error:', error);
        throw new Error('Сотрудник не найден');
    }
    
    // Check Password (Hash or Legacy)
    if (admin.password === hashedPassword) {
        // OK
    } else if (admin.password === legacyEncryptedPassword) {
        // Migrate
        console.log("Migrating staff password to hash...");
        await supabase.from('users').update({ password: hashedPassword }).eq('id', admin.id);
    } else {
        throw new Error('Неверный пароль');
    }

    localStorage.setItem('payeer_current_user_id', admin.id);
    localStorage.setItem('payeer_auth_token', generateToken({ id: admin.id, role: admin.role }));
    return { user: mapUser(admin), isNew: false };
  },

  isDefaultAdmin: async (): Promise<boolean> => {
    // Check if admin is still using default credentials (hashed or legacy)
    const encPhone = encrypt('000');
    const legacyPass = encrypt('admin');
    const hashPass = await hashPassword('admin');
    
    const { data } = await supabase
      .from('users')
      .select('phone, password')
      .eq('role', 'ADMIN')
      .eq('phone', encPhone)
      .limit(1)
      .single();
    
    if (!data) return false;
    return data.password === legacyPass || data.password === hashPass;
  },

  updateStaffCredentials: async (targetRole: 'ADMIN' | 'MANAGER', newPhone: string, newPassword: string): Promise<void> => {
    const currentUser = await api.getCurrentUser();
    if (currentUser?.role !== 'MANAGER') throw new Error('Только менеджер может менять данные');

    const hashedPassword = await hashPassword(newPassword.trim());

    const { error } = await supabase
      .from('users')
      .update({ 
          phone: encrypt(newPhone.trim()), 
          password: hashedPassword 
      })
      .eq('role', targetRole);

    if (error) throw new Error(error.message);
  },

  deleteUser: async (targetUserId: string): Promise<void> => {
      const currentUser = await api.getCurrentUser();
      if (currentUser?.role !== 'MANAGER') throw new Error('Только менеджер может удалять пользователей');
      
      const { error } = await supabase.from('users').delete().eq('id', targetUserId);
      if (error) throw new Error(error.message);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const id = localStorage.getItem('payeer_current_user_id');
    const token = localStorage.getItem('payeer_auth_token');
    
    if (!id || !token) return null;

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
    localStorage.removeItem('payeer_auth_token');
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return [];
    return data
        .filter(u => u.name !== '==gcldYNaWFT' && u.name !== '==gcldhcnRzaW5pbWRWQ') 
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
        title: encrypt(itemData.title), // Encrypt Title
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
        title: encrypt(item.title), // Encrypt Title
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

  restockItem: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('items')
      .update({ status: 'AVAILABLE', owner_id: null, purchased_at: null })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Payment Methods
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase.from('payment_methods').select('*');
    if (error) return [];
    
    // Sort in JS because names are encrypted in DB
    const mapped = data.map(mapMethod);
    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  },

  addPaymentMethod: async (method: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod> => {
    // ENCRYPT SENSITIVE DATA
    const encName = encrypt(method.name);
    const encInstr = encrypt(method.instruction);
    const encUrl = method.paymentUrl ? encrypt(method.paymentUrl) : null; // Encrypt URL

    // Try normal insert
    const { data, error } = await supabase
      .from('payment_methods')
      .insert([{
        name: encName,
        instruction: encInstr,
        is_active: method.isActive,
        min_amount: method.minAmount,
        image_url: method.imageUrl,
        payment_url: encUrl
      }])
      .select()
      .single();

    if (error) {
        // Fallback for missing columns logic
        if (error.code === '42703') { // Undefined column
             const { data: retryData, error: retryError } = await supabase
                .from('payment_methods')
                .insert([{
                    name: encName,
                    instruction: encInstr,
                    is_active: method.isActive,
                    min_amount: method.minAmount
                }])
                .select()
                .single();
             if (retryError) throw new Error(retryError.message);
             return mapMethod(retryData);
        }
        throw new Error(error.message); 
    }
    return mapMethod(data);
  },

  deletePaymentMethod: async (id: string): Promise<void> => {
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // Wallet & Transactions
  requestTopUp: async (userId: string, amount: number, receiptFile?: File, isLinkPayment?: boolean): Promise<void> => {
    let receiptUrl = '';
    
    if (isLinkPayment) {
        receiptUrl = 'LINK_PAYMENT_SPB';
    } else if (receiptFile) {
        try {
            receiptUrl = await toBase64(receiptFile);
        } catch (e) {
            console.error("Error converting receipt", e);
            receiptUrl = 'https://placehold.co/400x600/e2e8f0/475569?text=Error';
        }
    } else {
        receiptUrl = 'https://placehold.co/400x600/e2e8f0/475569?text=No+Receipt';
    }

    const encDesc = encrypt('Пополнение кошелька (Ожидает проверки)');

    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: amount,
        type: 'DEPOSIT',
        status: 'PENDING',
        description: encDesc,
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

    const encDesc = encrypt(`Заявка на вывод: ${details}`);

    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: amount,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        description: encDesc,
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

  requestUserRefund: async (userId: string, amount: number, reason: string): Promise<void> => {
    const encDesc = encrypt(`ЗАПРОС НА ВОЗВРАТ: ${reason}`);
    
    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: amount,
        type: 'WITHDRAWAL', 
        status: 'PENDING',
        description: encDesc,
        viewed: false
      }]);

    if (error) throw new Error(error.message);
  },

  processRefund: async (userId: string, amount: number, reason: string): Promise<void> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) throw new Error("Пользователь не найден");

    const { error: balanceError } = await supabase
        .from('users')
        .update({ balance: Number(user.balance) + Number(amount) })
        .eq('id', userId);
    
    if (balanceError) throw new Error("Ошибка возврата средств на баланс");

    const encDesc = encrypt(`Возврат средств: ${reason}`);

    const { error } = await supabase
      .from('transactions')
      .insert([{
        user_id: userId,
        amount: amount,
        type: 'REFUND',
        status: 'APPROVED',
        description: encDesc,
        viewed: false
      }]);
    
    if (error) throw new Error("Ошибка создания записи транзакции");
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (error) return [];
    return data.map(mapTransaction);
  },

  approveTransaction: async (transactionId: string, manualAmount?: number): Promise<void> => {
    const { data: tx } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
    if (!tx || tx.status !== 'PENDING') return;

    // Must decrypt description to check content
    const desc = decrypt(tx.description);
    
    let newStatus = 'APPROVED';
    let newDesc = desc;
    let finalAmount = Number(tx.amount);

    if (manualAmount !== undefined && manualAmount >= 0) {
        finalAmount = manualAmount;
        await supabase
            .from('transactions')
            .update({ amount: finalAmount })
            .eq('id', transactionId);
    }

    if (tx.type === 'DEPOSIT') {
        newDesc = 'Пополнение кошелька (Подтверждено)';
        const { data: user } = await supabase.from('users').select('balance').eq('id', tx.user_id).single();
        if (user) {
            await supabase
                .from('users')
                .update({ balance: Number(user.balance) + finalAmount })
                .eq('id', tx.user_id);
        }
    } else if (tx.type === 'WITHDRAWAL') {
        if (desc.startsWith('ЗАПРОС НА ВОЗВРАТ:')) {
            newDesc = `Возврат средств (Выполнено)`;
            const { data: user } = await supabase.from('users').select('balance').eq('id', tx.user_id).single();
            if (user) {
                await supabase
                    .from('users')
                    .update({ balance: Number(user.balance) + finalAmount })
                    .eq('id', tx.user_id);
            }
        } else {
            newDesc = `Вывод средств подтвержден (Списано)`;
        }
    }

    await supabase
      .from('transactions')
      .update({ status: newStatus, description: encrypt(newDesc) }) // Re-encrypt new description
      .eq('id', transactionId);
  },

  rejectTransaction: async (transactionId: string): Promise<void> => {
    const { data: tx } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
    if (!tx || tx.status !== 'PENDING') return;

    const desc = decrypt(tx.description);

    if (tx.type === 'WITHDRAWAL') {
        const isRefundRequest = desc.startsWith('ЗАПРОС НА ВОЗВРАТ:');
        
        if (!isRefundRequest) {
            const { data: user } = await supabase.from('users').select('balance').eq('id', tx.user_id).single();
            if (user) {
                await supabase
                    .from('users')
                    .update({ balance: Number(user.balance) + Number(tx.amount) })
                    .eq('id', tx.user_id);
            }
        }
    }

    const rejectDesc = tx.type === 'WITHDRAWAL' ? 'Операция отклонена' : 'Пополнение отклонено';

    await supabase
      .from('transactions')
      .update({ status: 'REJECTED', description: encrypt(rejectDesc) })
      .eq('id', transactionId);
  },

  markTransactionAsViewed: async (transactionId: string): Promise<void> => {
    await supabase
      .from('transactions')
      .update({ viewed: true })
      .eq('id', transactionId);
  },

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

    const quantity = Number(item.quantity || 1); 
    const isUnlimited = quantity === 0;
    const isMultiStock = quantity > 1;

    // DECRYPT TITLE for use in description
    const itemTitle = decrypt(item.title);

    if (isUnlimited || isMultiStock) {
        const { error: cloneError } = await supabase
            .from('items')
            .insert([{
                title: item.title, // Copy raw encrypted title
                description: item.description,
                image_url: item.image_url,
                price: item.price,
                quantity: 1, 
                status: 'RESERVED',
                owner_id: userId,
                purchased_at: new Date().toISOString(),
                last_purchase_price: finalPrice
            }]);
        
        if (cloneError) {
             await supabase.from('users').update({ balance: user.balance }).eq('id', userId);
             throw new Error("Ошибка создания товара: " + cloneError.message);
        }

        if (isMultiStock) {
            await supabase
                .from('items')
                .update({ quantity: quantity - 1 })
                .eq('id', itemId);
        }
    } else {
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

    const desc = item.price > 0 ? `Резерв товара: ${itemTitle}` : `Оплата (Free Price): ${itemTitle}`;

    await supabase.from('transactions').insert([{
        user_id: userId,
        amount: finalPrice,
        type: 'PURCHASE',
        status: 'APPROVED',
        description: encrypt(desc),
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

    // DECRYPT TITLE for use in description
    const itemTitle = decrypt(item.title);

    const desc = item.price > 0 ? `Оплата аренды: ${itemTitle}` : `Взнос (Free Price): ${itemTitle}`;

    await supabase.from('transactions').insert([{
        user_id: userId,
        amount: finalPrice,
        type: 'RENT_CHARGE',
        status: 'APPROVED',
        description: encrypt(desc),
        viewed: false
    }]);
  },

  cancelReservation: async (itemId: string): Promise<void> => {
    await supabase.from('items').update({
        status: 'AVAILABLE',
        owner_id: null,
        purchased_at: null
    }).eq('id', itemId);
  }
};
