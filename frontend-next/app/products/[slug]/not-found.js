import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-[#D4AF37] mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-[#2B3A4A] mb-4">Product Not Found</h2>
        <p className="text-gray-600 mb-8">
          The product you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-[#2B3A4A] text-white px-6 py-3 rounded-lg hover:bg-[#1a252f] transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
}
