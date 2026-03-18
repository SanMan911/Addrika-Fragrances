import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Header from '../components/Header';
import Hero from '../components/Hero';
import CategoryGrid from '../components/CategoryGrid';
import FragranceGrid from '../components/FragranceGrid';
import USPSection from '../components/USPSection';
import CSRSection from '../components/CSRSection';
import PackagingSection from '../components/PackagingSection';
import InstagramFeed from '../components/InstagramFeed';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';
import InquiryModal from '../components/InquiryModal';
import RecentlyViewedSection from '../components/RecentlyViewedSection';
import PromoBanner from '../components/PromoBanner';
import QuickReorder from '../components/QuickReorder';
import SEO from '../components/SEO';

const LandingPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('retail');
  const { setIsCartOpen } = useCart();
  const navigate = useNavigate();

  const handleOpenModal = (type) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen">
      <SEO 
        title="Addrika | Premium Incense Sticks - Sacred Luxury in Every Scent"
        description="Discover authentic arabic oud ambiance with Addrika's premium natural incense. Featuring Kesar Chandan, Regal Rose, Oriental Oudh & Bold Bakhoor - 40+ minute burn time for home aromatherapy."
        url="https://centraders.com"
        type="website"
      />
      <Header onInquiryClick={() => handleOpenModal('wholesale')} />
      <Hero 
        onBuyClick={() => document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' })} 
        promoBanner={<PromoBanner />}
      />
      {/* Quick Reorder for returning customers */}
      <QuickReorder />
      <CategoryGrid />
      <FragranceGrid />
      <RecentlyViewedSection maxItems={4} />
      <USPSection />
      <CSRSection />
      <PackagingSection />
      <InstagramFeed />
      <CTASection 
        onRetailClick={() => navigate('/find-retailers')}
        onWholesaleClick={() => handleOpenModal('wholesale')}
      />
      <Footer />
      <InquiryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={modalType}
      />
    </div>
  );
};

export default LandingPage;