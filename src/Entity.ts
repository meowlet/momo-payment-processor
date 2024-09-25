import { ObjectId } from "mongodb";

interface Transaction {
  requestId: string;
  user: string | ObjectId;
  amount: number;
  type: TransactionType;
  orderInfo: string;
  status: PaymentStatus;
  orderId: string;
  premiumDuration?: PremiumDuration;
  authorId?: string | ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

enum PremiumDuration {
  ONE_MONTH = "ONE_MONTH",
  THREE_MONTH = "THREE_MONTH",
  SIX_MONTH = "SIX_MONTH",
  ONE_YEAR = "ONE_YEAR",
}

enum TransactionType {
  PREMIUM_SUBSCRIPTION = "premium_subscription",
  AUTHOR_PAYOUT = "author_payout",
}

enum PaymentStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
}

export { Transaction, PremiumDuration, TransactionType, PaymentStatus };
