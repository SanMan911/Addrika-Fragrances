/**
 * Read layer — queries Supabase Postgres directly.
 *
 * Every table below is guarded by Row-Level Security keyed on the signed-in
 * retailer, so these queries physically cannot return another shop's rows.
 * That's why reading straight from the database is safe here, while writes
 * (orders, grievances) still go through FastAPI in `./api.ts`.
 */
import { supabase } from './supabase';

export type Product = {
  sku: string;
  name: string;
  category: string | null;
  size_label: string | null;
  pieces_per_carton: number;
  mrp: number | null;
  b2b_price: number | null;
  stock_pieces: number;
  image_url: string | null;
};

export type OrderRow = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  subtotal: number | null;
  gst_amount: number | null;
  total_amount: number | null;
  items: any[];
  invoice_url: string | null;
  placed_at: string | null;
  fy: string | null;
};

export type Scheme = {
  id: string;
  title: string;
  description: string | null;
  terms: string | null;
  min_cartons: number | null;
  discount_pct: number | null;
  banner_url: string | null;
  valid_from: string | null;
  valid_to: string | null;
};

export type Brochure = {
  id: string;
  title: string;
  file_url: string;
  version: string | null;
  published_at: string | null;
};

export type Grievance = {
  id: string;
  order_number: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
};

export type RetailerProfile = {
  id: string;
  gstin: string | null;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
};

function unwrap<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

export async function fetchProducts(): Promise<Product[]> {
  return unwrap<Product[]>(
    await supabase
      .from('app_products')
      .select('sku,name,category,size_label,pieces_per_carton,mrp,b2b_price,stock_pieces,image_url')
      .order('name')
  );
}

export async function fetchMyProfile(): Promise<RetailerProfile | null> {
  const rows = unwrap<RetailerProfile[]>(
    await supabase
      .from('app_retailers')
      .select('id,gstin,business_name,contact_name,email,phone,city,state')
      .limit(1)
  );
  return rows[0] ?? null;
}

export async function fetchOrders(fy?: string): Promise<OrderRow[]> {
  let q = supabase
    .from('app_orders')
    .select(
      'id,order_number,status,payment_status,subtotal,gst_amount,total_amount,items,invoice_url,placed_at,fy'
    )
    .order('placed_at', { ascending: false });
  if (fy) q = q.eq('fy', fy);
  return unwrap<OrderRow[]>(await q);
}

/** Distinct financial years this retailer has ordered in, newest first. */
export async function fetchOrderYears(): Promise<string[]> {
  const rows = unwrap<{ fy: string | null }[]>(
    await supabase.from('app_orders').select('fy').order('placed_at', { ascending: false })
  );
  const seen: string[] = [];
  for (const r of rows) {
    if (r.fy && !seen.includes(r.fy)) seen.push(r.fy);
  }
  return seen;
}

export async function fetchSchemes(): Promise<Scheme[]> {
  return unwrap<Scheme[]>(
    await supabase
      .from('app_schemes')
      .select('id,title,description,terms,min_cartons,discount_pct,banner_url,valid_from,valid_to')
      .order('updated_at', { ascending: false })
  );
}

export async function fetchBrochures(): Promise<Brochure[]> {
  return unwrap<Brochure[]>(
    await supabase
      .from('app_brochures')
      .select('id,title,file_url,version,published_at')
      .order('published_at', { ascending: false })
  );
}

export async function fetchGrievances(): Promise<Grievance[]> {
  return unwrap<Grievance[]>(
    await supabase
      .from('app_grievances')
      .select('id,order_number,category,subject,message,status,admin_reply,replied_at,created_at')
      .order('created_at', { ascending: false })
  );
}

/**
 * Upload a grievance photo into the retailer's own storage folder.
 * Storage RLS rejects any path outside `<retailer_id>/`, so a tampered
 * client can neither write into nor read another shop's folder.
 */
export async function uploadGrievanceImage(
  retailerId: string,
  uri: string,
  mimeType = 'image/jpeg'
): Promise<string> {
  const ext = (mimeType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const path = `${retailerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from('grievance-uploads')
    .upload(path, body, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Short-lived signed URL so the app can show a private attachment. */
export async function signedImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('grievance-uploads')
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
