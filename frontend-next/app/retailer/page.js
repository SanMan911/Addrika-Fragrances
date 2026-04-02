import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Retailer Portal | Addrika',
  description: 'Access the Addrika retailer portal to manage your orders, view performance, and grow your business.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RetailerPage() {
  redirect('/retailer/login');
}
