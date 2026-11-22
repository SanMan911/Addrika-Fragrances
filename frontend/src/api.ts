// API client and auth helpers for Aarohmm Pad.
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
const TOKEN_KEY = "aarohmm_pad_access_token";
const REFRESH_KEY = "aarohmm_pad_refresh_token";

export type Role = "retailer" | "distributor" | "admin";

export interface Profile {
  id: string;
  gstin: string;
  email: string | null;
  name: string;
  business_name: string | null;
  phone: string | null;
  role: Role;
  assigned_distributor_id: string | null;
  is_active: boolean;
}

export interface Product {
  sku: string;
  name: string;
  category: string | null;
  size_label: string | null;
  pieces_per_carton: number;
  mrp: number | null;
  b2b_price: number | null;
  stock_pieces: number;
  image_url: string | null;
  is_active: boolean;
}

export interface Distributor {
  id: string;
  name: string;
  business_name: string | null;
  gstin: string;
  city: string | null;
  state: string | null;
}

export type OrderStatus = "placed" | "confirmed" | "dispatched" | "delivered" | "cancelled";

export interface OrderItemLine {
  sku: string;
  name: string;
  size_label?: string | null;
  quantity: number;
  unit_price: number;
  pieces_per_carton?: number | null;
}

export interface Order {
  id: string;
  order_number: string;
  placed_by_id: string;
  placed_by_role: "retailer" | "distributor";
  distributor_id: string | null;
  items: OrderItemLine[];
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  placed_by?: {
    name: string;
    business_name: string | null;
    gstin: string;
    role: Role;
    email: string | null;
    phone: string | null;
  };
  distributor?: {
    name: string;
    business_name: string | null;
    gstin: string;
  };
}

async function request<T>(path: string, opts: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = await storage.secureGet(TOKEN_KEY, "");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail = (data && data.detail) || text || `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const api = {
  async register(body: {
    gstin: string;
    password: string;
    name: string;
    email: string;
    business_name?: string;
    phone?: string;
    role: "retailer" | "distributor";
    assigned_distributor_id?: string;
  }) {
    return request<{ access_token: string; refresh_token: string; user: Profile }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
  },
  async login(body: { gstin: string; password: string }) {
    return request<{ access_token: string; refresh_token: string; user: Profile }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify(body) },
      false,
    );
  },
  async me() {
    return request<Profile>("/auth/me");
  },
  async products() {
    return request<{ products: Product[] }>("/products");
  },
  async distributors() {
    return request<{ distributors: Distributor[] }>("/distributors");
  },
  async createOrder(body: { items: OrderItemLine[]; distributor_id?: string; notes?: string }) {
    return request<{ order: Order }>("/orders", { method: "POST", body: JSON.stringify(body) });
  },
  async orders() {
    return request<{ orders: Order[] }>("/orders");
  },
  async actionable() {
    return request<{ orders: Order[] }>("/orders/actionable");
  },
  async order(id: string) {
    return request<{ order: Order }>(`/orders/${id}`);
  },
  async updateStatus(id: string, status: OrderStatus) {
    return request<{ order: Order }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  async setDistributor(retailer_id: string, distributor_id: string | null) {
    return request("/retailer/set-distributor", {
      method: "POST",
      body: JSON.stringify({ retailer_id, distributor_id }),
    });
  },
};

export async function saveSession(access_token: string, refresh_token: string) {
  await storage.secureSet(TOKEN_KEY, access_token);
  await storage.secureSet(REFRESH_KEY, refresh_token);
}

export async function clearSession() {
  await storage.secureRemove(TOKEN_KEY);
  await storage.secureRemove(REFRESH_KEY);
}

export async function getToken(): Promise<string | null> {
  const t = await storage.secureGet(TOKEN_KEY, "");
  return t ? (t as string) : null;
}
