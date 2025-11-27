
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER'
}

export interface User {
  id: string;
  phone: string;
  name: string;
  balance: number; // In PAYEER®
  role: UserRole;
  createdAt: string;
}

export enum ItemStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD = 'SOLD',
  RESERVED = 'RESERVED',
  UNAVAILABLE = 'UNAVAILABLE' // Administratively disabled
}

export interface Item {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  price: number; // Fixed cost
  status: ItemStatus;
  ownerId?: string; // User ID
  purchasedAt?: string; // ISO Date
  lastPurchasePrice?: number; // The actual amount paid (useful for dynamic pricing refunds)
}

export interface PaymentMethod {
  id: string;
  name: string; // e.g., "Bank Card", "Crypto"
  instruction: string; // Instructions shown to user
  isActive: boolean;
  minAmount?: number; // Minimum deposit amount (0 or undefined = no limit)
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'DEPOSIT' | 'RENT_CHARGE' | 'PURCHASE' | 'REFUND' | 'WITHDRAWAL';
  status: TransactionStatus;
  description: string;
  date: string;
  receiptUrl?: string; // Simulated URL or base64
  viewed?: boolean; // For admin notifications
}