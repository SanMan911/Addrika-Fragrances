import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Star, Send, Package, CheckCircle, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ReviewPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order') || '');
  const [email, setEmail] = useState('');
  const [products, setProducts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  
  // Review form state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const verifyOrder = async (e) => {
    e.preventDefault();
    if (!orderNumber || !email) {
      toast.error('Please enter both order number and email');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const url = `${API_URL}/api/reviews/order/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`;
      
      // Use XMLHttpRequest to bypass fetch interceptors
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.onload = function() {
          try {
            const response = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(response);
            } else {
              reject(new Error(response.detail || 'Order not found'));
            }
          } catch (e) {
            reject(new Error('Invalid server response'));
          }
        };
        xhr.onerror = function() {
          reject(new Error('Network error'));
        };
        xhr.send();
      });
      
      setProducts(data.products || []);
      setCustomerName(data.customer_name || '');
      setVerified(true);
      toast.success('Order verified! Select a product to review.');
    } catch (err) {
      // Handle both fetch errors and JSON parsing errors
      const errorMessage = err.message || 'Order not found';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !comment) {
      toast.error('Please select a product and write a review');
      return;
    }
    
    if (comment.length < 10) {
      toast.error('Review must be at least 10 characters');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await fetch(
        `${API_URL}/api/reviews/order/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(email)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: selectedProduct.productId,
            rating,
            title: title || null,
            comment
          })
        }
      );
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to submit review');
      }
      
      toast.success('Thank you! Your review has been submitted for approval.');
      setSubmitted(true);
      
      // Mark product as reviewed locally
      setProducts(products.map(p => 
        p.productId === selectedProduct.productId 
          ? { ...p, already_reviewed: true }
          : p
      ));
      
      // Reset form
      setSelectedProduct(null);
      setRating(5);
      setTitle('');
      setComment('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const reviewableProducts = products.filter(p => !p.already_reviewed);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream to-white">
      <Header />
      
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
              Rate Your Purchase
            </h1>
            <p style={{ color: 'var(--text-subtle)' }}>
              Your feedback helps us improve and helps other customers make informed decisions.
            </p>
          </div>
          
          {!verified ? (
            <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
                Verify Your Order
              </h2>
              <form onSubmit={verifyOrder} className="space-y-4">
                <div>
                  <Label htmlFor="orderNumber">Order Number *</Label>
                  <Input
                    id="orderNumber"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g., ADD-18FEB2026-120530-A1B2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your registered email"
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  {loading ? 'Verifying...' : 'Verify Order'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle size={20} />
                  <span className="font-medium">Order Verified</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Welcome back, {customerName}! Order: {orderNumber}
                </p>
              </div>
              
              {/* Products to Review */}
              {reviewableProducts.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-6 border" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
                    <Package size={20} className="inline mr-2" />
                    Products You Can Review
                  </h2>
                  
                  <div className="space-y-3 mb-6">
                    {reviewableProducts.map((product) => (
                      <div
                        key={product.productId}
                        onClick={() => setSelectedProduct(product)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedProduct?.productId === product.productId
                            ? 'border-japanese-indigo bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium" style={{ color: 'var(--japanese-indigo)' }}>
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-500">Size: {product.size}</p>
                          </div>
                          {selectedProduct?.productId === product.productId && (
                            <CheckCircle size={20} className="text-green-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {selectedProduct && (
                    <form onSubmit={submitReview} className="space-y-4 pt-4 border-t">
                      <h3 className="font-medium" style={{ color: 'var(--japanese-indigo)' }}>
                        Review: {selectedProduct.name}
                      </h3>
                      
                      {/* Star Rating */}
                      <div>
                        <Label>Your Rating *</Label>
                        <div className="flex gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              className="p-1 transition-transform hover:scale-110"
                            >
                              <Star
                                size={32}
                                fill={(hoverRating || rating) >= star ? '#d4af37' : 'transparent'}
                                stroke={(hoverRating || rating) >= star ? '#d4af37' : '#cbd5e1'}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Review Title */}
                      <div>
                        <Label htmlFor="title">Review Title (Optional)</Label>
                        <Input
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Wonderful fragrance!"
                          maxLength={100}
                        />
                      </div>
                      
                      {/* Review Comment */}
                      <div>
                        <Label htmlFor="comment">Your Review *</Label>
                        <Textarea
                          id="comment"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Share your experience with this product... (minimum 10 characters)"
                          rows={4}
                          minLength={10}
                          maxLength={1000}
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {comment.length}/1000 characters
                        </p>
                      </div>
                      
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="w-full text-white"
                        style={{ backgroundColor: 'var(--metallic-gold)' }}
                      >
                        {submitting ? (
                          'Submitting...'
                        ) : (
                          <>
                            <Send size={18} className="mr-2" />
                            Submit Review
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm p-6 border text-center" style={{ borderColor: 'var(--border)' }}>
                  <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
                  <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                    All Products Reviewed!
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Thank you for sharing your feedback. Your reviews are pending approval.
                  </p>
                  <Button
                    onClick={() => navigate('/')}
                    variant="outline"
                  >
                    Back to Home
                  </Button>
                </div>
              )}
              
              {/* Already Reviewed Products */}
              {products.filter(p => p.already_reviewed).length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600">
                    <CheckCircle size={16} className="inline mr-1 text-green-600" />
                    Already reviewed: {products.filter(p => p.already_reviewed).map(p => p.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ReviewPage;
