import React, { createContext, useContext, useState } from 'react';

const InquiryContext = createContext();

export const useInquiry = () => {
  const context = useContext(InquiryContext);
  if (!context) {
    // Return a no-op function instead of throwing to prevent crashes
    console.warn('useInquiry called outside InquiryProvider');
    return { 
      isInquiryOpen: false, 
      inquiryType: 'wholesale', 
      openInquiry: () => console.log('Inquiry context not available'),
      closeInquiry: () => {}
    };
  }
  return context;
};

export const InquiryProvider = ({ children }) => {
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [inquiryType, setInquiryType] = useState('wholesale');

  const openInquiry = (type = 'wholesale') => {
    setInquiryType(type);
    setIsInquiryOpen(true);
  };

  const closeInquiry = () => {
    setIsInquiryOpen(false);
  };

  return (
    <InquiryContext.Provider value={{ isInquiryOpen, inquiryType, openInquiry, closeInquiry }}>
      {children}
    </InquiryContext.Provider>
  );
};
