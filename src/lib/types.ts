export type Establishment = {
  id: string; name: string; slug: string;
  logo_url: string | null; cover_url: string | null;
  primary_color: string; secondary_color: string;
  font: 'urbanist' | 'inter' | 'poppins' | 'merriweather' | 'nunito';
  card_style: 'list' | 'grid';
  description: string | null; opening_hours: string | null; address: string | null;
  instagram: string | null; whatsapp: string | null; active: boolean;
};
export type Category = { id: string; establishment_id: string; name: string; position: number };
export type Addon = { id: string; product_id: string; name: string; price: number; available: boolean };
export type Product = {
  id: string; establishment_id: string; category_id: string; name: string;
  description: string | null; price: number; photo_url: string | null;
  available: boolean; position: number; product_addons?: Addon[];
};
export type Role = 'owner' | 'waiter' | 'cashier';
