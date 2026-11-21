// Shared frontend types for model listings (mirrors the core-api `GET /api/models` contract)

export const LICENSES = ['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL'] as const;
export type License = (typeof LICENSES)[number];

export const GALLERY_TAGS = ['character', 'vehicle', 'architecture', 'nature', 'sci-fi', 'props', 'abstract', 'animal'] as const;

export interface Model {
  id: string;
  ownerId?: string;
  title: string;
  creator: string;
  creatorAvatarUrl?: string;
  tags: string[];
  license: License;
  priceCents: number;
  likeCount: number;
  downloadCount: number;
  posterUrl?: string;
  description?: string;
}

export interface ModelsParams {
  q?: string;
  tag?: string;
  license?: License;
  price?: 'free' | 'paid';
  page?: number;
}

export interface ModelsPage {
  items: Model[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'creator' | 'admin';
  is_seller: boolean;
  avatar_url?: string | null;
  bio?: string | null;
  featured_model_ids?: string[] | null;
}

export interface PurchaseItem {
  id: string;
  modelId: string;
  title: string;
  priceCents: number;
  amountCents: number;
  currency: string;
  licenseType: License | string;
  watermarkHash: string | null;
  embedKey: string;
  paidAt: string;
  purchasedAt: string;
  posterUrl?: string | null;
}

export interface PurchaseDetail {
  id: string;
  modelId: string;
  title: string;
  sellerName?: string;
  priceCents: number;
  amountCents: number;
  currency: string;
  licenseType: License | string;
  watermarkHash: string | null;
  status: 'pending' | 'paid';
  provider?: 'mock' | 'stripe';
  paidAt: string | null;
  createdAt: string;
}

export interface QrPaymentResponse {
  provider: 'mock' | 'stripe';
  purchaseId: string;
  paymentIntentId?: string;
  qrImageUrl: string | null;
  hostedUrl?: string | null;
  qrData?: string | null;
  amountSatang: number;
  currency: string;
}

export interface SellerWallet {
  grossEarnedCents: number;
  withdrawnGrossCents: number;
  availableGrossCents: number;
  feeRateBps: number;
  feeRatePercent: number;
  estimatedFeeCents: number;
  estimatedNetCents: number;
}

export interface SellerWithdrawal {
  id: string;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
  feeRateBps: number;
  currency: string;
  payoutMethod: string;
  payoutAccount: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  createdAt: string;
  processedAt: string | null;
}

export interface SellerWalletResponse {
  wallet: SellerWallet;
  withdrawals: SellerWithdrawal[];
}

export interface SellerModelItem {
  id: string;
  title: string;
  description?: string;
  license?: License | string;
  priceCents: number;
  currency: string;
  viewCount: number;
  downloadCount: number;
  posterUrl?: string | null;
  isHidden: boolean;
  createdAt: string;
}

export interface SellerSalesSummary {
  totalRevenue: number;
  totalSales: number;
  sales: {
    purchaseId: string;
    modelId: string;
    title: string;
    priceCents: number;
    currency: string;
    buyerName: string;
    soldAt: string;
  }[];
}
