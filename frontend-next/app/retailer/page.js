import { redirect } from 'next/navigation';
import BRAND from '../../lib/brand.config';

export const metadata = {
  title: `Retailer Portal | ${BRAND.name}`,
  description: `Access the ${BRAND.name} retailer portal to manage your orders, view performance, and grow your business.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function RetailerPage() {
  redirect('/retailer/login');
}
