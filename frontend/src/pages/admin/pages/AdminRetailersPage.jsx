/**
 * AdminRetailersPage - Retailer Management Dashboard
 * Features: List, Create, Edit, Verify, Suspend, Revoke, Remove, and Manage Retailers
 * Includes: Addrika Verified Partner badge, Top/Star Retailer labels, Performance Analytics
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Store, Plus, Search, Edit2, Trash2, CheckCircle, XCircle,
  FileText, Upload, Eye, EyeOff, AlertCircle, RefreshCw,
  MapPin, Phone, Mail, Building, User, Shield, X, ChevronDown, ChevronUp,
  Award, Star, Crown, Ban, RotateCcw, AlertTriangle, BarChart3, Trophy, TrendingUp,
  Users, Package, IndianRupee, Clock, Target
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function to capitalize first letter of each word (Title Case)
const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Fields that should be Title Case (capitalize first letter of each word)
const TITLE_CASE_FIELDS = [
  'business_name', 'trade_name', 'city', 'district', 'state',
  'spoc_name', 'spoc_designation'
];

// Fields that should be UPPERCASE
const UPPERCASE_FIELDS = ['gst_number'];

// Indian states for dropdown
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

// ID Proof types for SPOC
const ID_PROOF_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' }
];

// Country codes for phone number dropdowns
const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
];

// Designation options for SPOC
const DESIGNATION_OPTIONS = [
  { value: 'Owner', label: 'Owner' },
  { value: 'Proprietor', label: 'Proprietor' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Director', label: 'Director' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Store Manager', label: 'Store Manager' },
  { value: 'Sales Manager', label: 'Sales Manager' },
  { value: 'Accountant', label: 'Accountant' },
  { value: 'Authorized Signatory', label: 'Authorized Signatory' },
  { value: 'Other', label: 'Other' },
];

// Retailer Labels
const RETAILER_LABELS = [
  { value: '', label: 'No Label' },
  { value: 'top_retailer_month', label: 'Top Retailer of the Month', icon: Crown, color: 'text-amber-500' },
  { value: 'top_retailer_quarter', label: 'Top Retailer of the Quarter', icon: Crown, color: 'text-amber-600' },
  { value: 'star_retailer_month', label: 'Star Retailer of the Month', icon: Star, color: 'text-purple-500' },
  { value: 'star_retailer_quarter', label: 'Star Retailer of the Quarter', icon: Star, color: 'text-purple-600' },
  { value: 'rising_star', label: 'Rising Star', icon: Star, color: 'text-blue-500' },
  { value: 'best_performer', label: 'Best Performer', icon: Award, color: 'text-emerald-500' }
];

// Generate period options (current and last 6 months/quarters)
const generatePeriodOptions = () => {
  const options = [{ value: '', label: 'Select Period' }];
  const now = new Date();
  
  // Monthly options
  for (let i = 0; i < 6; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value: monthYear, label: monthYear });
  }
  
  // Quarterly options
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();
  for (let i = 0; i < 4; i++) {
    let q = currentQuarter - i;
    let y = currentYear;
    if (q <= 0) {
      q += 4;
      y -= 1;
    }
    options.push({ value: `Q${q} ${y}`, label: `Q${q} ${y}` });
  }
  
  return options;
};

// Empty form state for creating new retailer
const emptyFormData = {
  business_name: '',
  trade_name: '',
  gst_number: '',
  username: '',
  email: '',
  phone_country_code: '+91',
  phone: '',
  whatsapp_country_code: '+91',
  whatsapp: '',
  whatsapp_same_as_phone: false,
  registered_address: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  spoc_name: '',
  spoc_designation: '',
  spoc_phone_country_code: '+91',
  spoc_phone: '',
  spoc_email: '',
  spoc_dob: '',
  spoc_anniversary: '',
  spoc_id_proof_type: '',
  spoc_id_proof_number: '',
  password: '',
  // New fields for badges and labels
  is_addrika_verified_partner: false,
  retailer_label: '',
  label_period: ''
};

const AdminRetailersPage = () => {
  const { authFetch } = useOutletContext();
  
  // State
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  
  // Delete/Suspend modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteType, setDeleteType] = useState('soft'); // 'soft' or 'permanent'
  
  // Form state
  const [formData, setFormData] = useState(emptyFormData);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // GST Verification
  const [verifyingGST, setVerifyingGST] = useState(false);
  const [gstDetails, setGstDetails] = useState(null);
  
  // Badge notification toggle
  const [sendBadgeNotification, setSendBadgeNotification] = useState(true);
  
  // Pincode lookup state
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  
  // Expanded rows for mobile view
  const [expandedRows, setExpandedRows] = useState({});
  
  // Tab navigation: 'list' or 'analytics'
  const [activeTab, setActiveTab] = useState('list');
  
  // Performance analytics state
  const [performanceData, setPerformanceData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('all_time');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Fetch performance analytics
  const fetchPerformanceAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [perfRes, leaderRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/retailers/performance`),
        authFetch(`${API_URL}/api/admin/retailers/leaderboard?period=${leaderboardPeriod}`)
      ]);
      
      if (perfRes.ok) {
        const perfData = await perfRes.json();
        setPerformanceData(perfData);
      }
      
      if (leaderRes.ok) {
        const leaderData = await leaderRes.json();
        setLeaderboardData(leaderData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [authFetch, leaderboardPeriod]);

  // Fetch analytics when tab changes
  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchPerformanceAnalytics();
    }
  }, [activeTab, fetchPerformanceAnalytics]);
  const fetchRetailers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/list`);
      if (res.ok) {
        const data = await res.json();
        setRetailers(data.retailers || []);
      } else {
        toast.error('Failed to fetch retailers');
      }
    } catch (error) {
      console.error('Error fetching retailers:', error);
      toast.error('Error loading retailers');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchRetailers();
  }, [fetchRetailers]);

  // Filter retailers
  const filteredRetailers = retailers.filter(retailer => {
    const matchesSearch = 
      retailer.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      retailer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      retailer.gst_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      retailer.retailer_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || retailer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.business_name?.trim()) errors.business_name = 'Business name is required';
    if (!formData.gst_number?.trim()) errors.gst_number = 'GST number is required';
    else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gst_number.toUpperCase())) {
      errors.gst_number = 'Invalid GST number format';
    }
    if (!formData.email?.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
    if (!formData.phone?.trim()) errors.phone = 'Phone is required';
    else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) errors.phone = 'Phone must be 10 digits';
    if (!formData.registered_address?.trim()) errors.registered_address = 'Address is required';
    if (!formData.city?.trim()) errors.city = 'City is required';
    if (!formData.district?.trim()) errors.district = 'District is required';
    if (!formData.state) errors.state = 'State is required';
    if (!formData.pincode?.trim()) errors.pincode = 'Pincode is required';
    else if (!/^\d{6}$/.test(formData.pincode)) errors.pincode = 'Pincode must be 6 digits';
    if (!formData.spoc_name?.trim()) errors.spoc_name = 'SPOC name is required';
    if (!formData.spoc_phone?.trim()) errors.spoc_phone = 'SPOC phone is required';
    
    // Password only required for new retailers
    if (!showEditModal && !formData.password?.trim()) errors.password = 'Password is required';
    else if (!showEditModal && formData.password?.length < 6) errors.password = 'Password must be at least 6 characters';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form input change with auto-formatting
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Apply transformations based on field type
    let processedValue = value;
    
    if (UPPERCASE_FIELDS.includes(name)) {
      // GST number should be fully uppercase
      processedValue = value.toUpperCase();
    } else if (TITLE_CASE_FIELDS.includes(name)) {
      // Business name, trade name, etc. should be Title Case
      processedValue = capitalizeWords(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    
    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
    
    // Auto-fetch city/state when pincode is 6 digits
    if (name === 'pincode' && value.length === 6 && /^\d{6}$/.test(value)) {
      fetchCityStateFromPincode(value);
    }
  };

  // Fetch city and state from pincode using postal API
  const fetchCityStateFromPincode = async (pincode) => {
    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return;
    
    setPincodeLookupLoading(true);
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        const city = capitalizeWords(postOffice.District || postOffice.Name);
        const state = capitalizeWords(postOffice.State);
        const district = capitalizeWords(postOffice.District);
        
        setFormData(prev => ({ ...prev, city, state, district }));
        setFormErrors(prev => ({ ...prev, city: null, state: null, district: null }));
        toast.success(`Location found: ${city}, ${state}`);
      } else {
        toast.error('Invalid pincode. Please check and try again.');
      }
    } catch (error) {
      console.error('Pincode lookup failed:', error);
      toast.error('Could not fetch location. Please check your connection.');
    } finally {
      setPincodeLookupLoading(false);
    }
  };

  // Verify GST number
  const handleVerifyGST = async () => {
    if (!formData.gst_number || formData.gst_number.length !== 15) {
      toast.error('Please enter a valid 15-character GST number');
      return;
    }
    
    setVerifyingGST(true);
    setGstDetails(null);
    
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/gst-lookup/${formData.gst_number.toUpperCase()}`);
      const data = await res.json();
      
      if (res.ok && data.valid) {
        setGstDetails(data);
        // Auto-fill some fields from GST
        if (data.trade_name) {
          setFormData(prev => ({ 
            ...prev, 
            trade_name: data.trade_name,
            state: data.state || prev.state
          }));
        }
        toast.success('GST verified successfully');
      } else {
        toast.error(data.error || 'GST verification failed');
      }
    } catch (error) {
      toast.error('GST verification service unavailable');
    } finally {
      setVerifyingGST(false);
    }
  };

  // Create retailer
  const handleCreateRetailer = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Retailer ${data.retailer_id} created successfully`);
        setShowCreateModal(false);
        setFormData(emptyFormData);
        fetchRetailers();
      } else {
        toast.error(data.detail || 'Failed to create retailer');
      }
    } catch (error) {
      toast.error('Error creating retailer');
    } finally {
      setSubmitting(false);
    }
  };

  // Update retailer
  const handleUpdateRetailer = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setSubmitting(true);
    try {
      const updateData = { ...formData };
      delete updateData.password; // Don't send password in update unless changed
      
      // Include notification toggle in query param
      const notifyParam = sendBadgeNotification ? 'true' : 'false';
      
      const res = await authFetch(`${API_URL}/api/retailers/admin/${selectedRetailer.retailer_id}?send_notification=${notifyParam}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Show different message if notifications were sent
        if (data.notifications_sent && data.notifications_sent.length > 0) {
          toast.success('Retailer updated. Congratulations email sent!');
        } else {
          toast.success('Retailer updated successfully');
        }
        setShowEditModal(false);
        setSelectedRetailer(null);
        setSendBadgeNotification(true); // Reset for next time
        fetchRetailers();
      } else {
        toast.error(data.detail || 'Failed to update retailer');
      }
    } catch (error) {
      toast.error('Error updating retailer');
    } finally {
      setSubmitting(false);
    }
  };

  // Verify retailer GST
  const handleVerifyRetailerGST = async (retailerId) => {
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/${retailerId}/verify-gst`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('GST verified successfully');
        fetchRetailers();
      } else {
        toast.error(data.detail || 'GST verification failed');
      }
    } catch (error) {
      toast.error('Error verifying GST');
    }
  };

  // Toggle retailer status
  const handleToggleStatus = async (retailer) => {
    const newStatus = retailer.status === 'active' ? 'suspended' : 'active';
    
    // If suspending, open the suspend modal instead
    if (newStatus === 'suspended') {
      setSelectedRetailer(retailer);
      setSuspendReason('');
      setShowSuspendModal(true);
      return;
    }
    
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/${retailer.retailer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, suspended_reason: null })
      });
      
      if (res.ok) {
        toast.success(`Retailer activated`);
        fetchRetailers();
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  // Suspend retailer with reason
  const handleSuspendRetailer = async () => {
    if (!selectedRetailer) return;
    
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/${selectedRetailer.retailer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'suspended',
          suspended_reason: suspendReason || 'No reason provided'
        })
      });
      
      if (res.ok) {
        toast.success('Retailer suspended');
        setShowSuspendModal(false);
        setSelectedRetailer(null);
        setSuspendReason('');
        fetchRetailers();
      } else {
        toast.error('Failed to suspend retailer');
      }
    } catch (error) {
      toast.error('Error suspending retailer');
    }
  };

  // Delete retailer
  const handleDeleteRetailer = async () => {
    if (!selectedRetailer) return;
    
    try {
      const res = await authFetch(
        `${API_URL}/api/retailers/admin/${selectedRetailer.retailer_id}?permanent=${deleteType === 'permanent'}`,
        { method: 'DELETE' }
      );
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || 'Retailer deleted');
        setShowDeleteModal(false);
        setSelectedRetailer(null);
        setDeleteType('soft');
        fetchRetailers();
      } else {
        toast.error(data.detail || 'Failed to delete retailer');
      }
    } catch (error) {
      toast.error('Error deleting retailer');
    }
  };

  // Restore deleted retailer
  const handleRestoreRetailer = async (retailer) => {
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/${retailer.retailer_id}/restore`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success('Retailer restored');
        fetchRetailers();
      } else {
        toast.error(data.detail || 'Failed to restore retailer');
      }
    } catch (error) {
      toast.error('Error restoring retailer');
    }
  };

  // Toggle Addrika Verified Partner badge
  const handleToggleVerifiedPartner = async (retailer) => {
    const newValue = !retailer.is_addrika_verified_partner;
    
    try {
      const res = await authFetch(`${API_URL}/api/retailers/admin/${retailer.retailer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_addrika_verified_partner: newValue })
      });
      
      if (res.ok) {
        toast.success(newValue ? 'Marked as Addrika Verified Partner' : 'Removed Verified Partner badge');
        fetchRetailers();
      } else {
        toast.error('Failed to update badge');
      }
    } catch (error) {
      toast.error('Error updating badge');
    }
  };

  // Open edit modal with retailer data
  const openEditModal = (retailer) => {
    setSelectedRetailer(retailer);
    setFormData({
      business_name: retailer.business_name || '',
      trade_name: retailer.trade_name || '',
      gst_number: retailer.gst_number || '',
      username: retailer.username || '',
      email: retailer.email || '',
      phone_country_code: retailer.phone_country_code || '+91',
      phone: retailer.phone || '',
      whatsapp_country_code: retailer.whatsapp_country_code || '+91',
      whatsapp: retailer.whatsapp || '',
      whatsapp_same_as_phone: retailer.whatsapp === retailer.phone && retailer.whatsapp_country_code === retailer.phone_country_code,
      registered_address: retailer.registered_address || '',
      city: retailer.city || '',
      district: retailer.district || '',
      state: retailer.state || '',
      pincode: retailer.pincode || '',
      spoc_name: retailer.spoc?.name || '',
      spoc_designation: retailer.spoc?.designation || '',
      spoc_phone_country_code: retailer.spoc?.phone_country_code || '+91',
      spoc_phone: retailer.spoc?.phone || '',
      spoc_email: retailer.spoc?.email || '',
      spoc_dob: retailer.spoc?.date_of_birth || '',
      spoc_anniversary: retailer.spoc?.anniversary || '',
      spoc_id_proof_type: retailer.spoc?.id_proof_type || '',
      spoc_id_proof_number: retailer.spoc?.id_proof_number || '',
      password: '',
      // Include new badge/label fields
      is_addrika_verified_partner: retailer.is_addrika_verified_partner || false,
      retailer_label: retailer.retailer_label || '',
      label_period: retailer.label_period || ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // Status badge component
  const StatusBadge = ({ status, isVerified, gstVerified, isAddrikaVerified, retailerLabel, labelPeriod }) => {
    const getStatusColor = () => {
      if (status === 'deleted') return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      if (status === 'active' && isVerified) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      if (status === 'active') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      if (status === 'suspended') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    };
    
    const labelInfo = RETAILER_LABELS.find(l => l.value === retailerLabel);
    
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
          {status === 'active' ? (isVerified ? 'Verified' : 'Active') : status === 'deleted' ? 'Deleted' : status}
        </span>
        {gstVerified && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            GST ✓
          </span>
        )}
        {isAddrikaVerified && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
            <Award size={12} /> Verified Partner
          </span>
        )}
        {labelInfo && labelInfo.value && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 ${labelInfo.color} flex items-center gap-1`}>
            {labelInfo.icon && <labelInfo.icon size={12} />}
            {labelInfo.label.replace(' of the ', ' ')}
            {labelPeriod && <span className="opacity-75 ml-1">({labelPeriod})</span>}
          </span>
        )}
      </div>
    );
  };

  // Performance Analytics Tab Component
  const AnalyticsTab = () => {
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(amount || 0);
    };

    const getRankBadge = (rank) => {
      if (rank === 1) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', icon: '🥇' };
      if (rank === 2) return { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500', icon: '🥈' };
      if (rank === 3) return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', icon: '🥉' };
      return { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600', icon: rank };
    };

    if (analyticsLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="animate-spin text-amber-500" size={32} />
          <span className="ml-3 text-slate-600 dark:text-slate-300">Loading analytics...</span>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Aggregate Stats */}
        {performanceData?.aggregate && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Users size={16} />
                <span className="text-sm">Active Retailers</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{performanceData.aggregate.total_retailers}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Package size={16} />
                <span className="text-sm">Total Orders</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{performanceData.aggregate.total_orders}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <CheckCircle size={16} />
                <span className="text-sm">Completed</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{performanceData.aggregate.total_completed}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Clock size={16} />
                <span className="text-sm">Pending</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{performanceData.aggregate.total_pending}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Target size={16} />
                <span className="text-sm">Completion Rate</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{performanceData.aggregate.overall_completion_rate}%</p>
            </div>
          </div>
        )}

        {/* Leaderboard Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Trophy className="text-amber-500" size={20} />
              Retailer Leaderboard
            </h3>
            <select
              value={leaderboardPeriod}
              onChange={(e) => setLeaderboardPeriod(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm"
              data-testid="leaderboard-period"
            >
              <option value="all_time">All Time</option>
              <option value="monthly">Last 30 Days</option>
              <option value="weekly">Last 7 Days</option>
            </select>
          </div>

          {leaderboardData?.leaderboard?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="leaderboard-table">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Retailer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase hidden md:table-cell">Completed</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase hidden lg:table-cell">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Completion %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase hidden md:table-cell">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {leaderboardData.leaderboard.slice(0, 15).map((retailer) => {
                    const badge = getRankBadge(retailer.rank);
                    return (
                      <tr key={retailer.retailer_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${badge.bg} ${badge.text} text-sm font-bold`}>
                            {badge.icon}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-slate-800 dark:text-white">{retailer.name || retailer.business_name}</p>
                            <p className="text-xs text-slate-500">{retailer.city}, {retailer.state}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-slate-800 dark:text-white">{retailer.total_orders}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-green-600">{retailer.completed_orders}</span>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          <span className="font-medium text-slate-800 dark:text-white">{formatCurrency(retailer.total_revenue)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  retailer.completion_rate >= 90 ? 'bg-green-500' :
                                  retailer.completion_rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${retailer.completion_rate}%` }}
                              />
                            </div>
                            <span className={`text-sm font-medium ${
                              retailer.completion_rate >= 90 ? 'text-green-600' :
                              retailer.completion_rate >= 70 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {retailer.completion_rate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            retailer.overall_score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            retailer.overall_score >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {retailer.overall_score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <BarChart3 className="mx-auto text-slate-300" size={48} />
              <p className="text-slate-500 mt-2">No performance data available</p>
            </div>
          )}
        </div>

        {/* Top Performers Cards */}
        {leaderboardData?.top_performers && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top by Orders */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 mb-3">
                <Package className="text-blue-500" size={16} />
                Top by Orders
              </h4>
              <div className="space-y-2">
                {leaderboardData.top_performers.by_orders?.slice(0, 3).map((r, idx) => (
                  <div key={r.retailer_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-400">{idx + 1}.</span>
                      <span className="text-sm text-slate-800 dark:text-white truncate max-w-[140px]">{r.name || r.business_name}</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">{r.total_orders}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top by Revenue */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 mb-3">
                <IndianRupee className="text-green-500" size={16} />
                Top by Revenue
              </h4>
              <div className="space-y-2">
                {leaderboardData.top_performers.by_revenue?.slice(0, 3).map((r, idx) => (
                  <div key={r.retailer_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-400">{idx + 1}.</span>
                      <span className="text-sm text-slate-800 dark:text-white truncate max-w-[140px]">{r.name || r.business_name}</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(r.total_revenue)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top by Completion Rate */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 mb-3">
                <TrendingUp className="text-emerald-500" size={16} />
                Top by Completion Rate
              </h4>
              <div className="space-y-2">
                {leaderboardData.top_performers.by_completion_rate?.slice(0, 3).map((r, idx) => (
                  <div key={r.retailer_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-400">{idx + 1}.</span>
                      <span className="text-sm text-slate-800 dark:text-white truncate max-w-[140px]">{r.name || r.business_name}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">{r.completion_rate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Scoring Explanation */}
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-2">
            <Award size={16} />
            How Scores are Calculated
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Overall score is weighted: <strong>40% Completion Rate</strong> + <strong>30% Order Volume</strong> + <strong>20% Revenue</strong> + <strong>10% Satisfaction</strong>.
            Use these metrics to award Top/Star Retailer badges!
          </p>
        </div>
      </div>
    );
  };

  // Render form modal - NOT a component to avoid focus loss on re-render
  const renderFormModal = (isEdit) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 px-6 py-4 border-b dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Store className="text-amber-500" size={24} />
            {isEdit ? 'Edit Retailer' : 'Add New Retailer'}
          </h2>
          <button
            onClick={() => {
              isEdit ? setShowEditModal(false) : setShowCreateModal(false);
              setFormData(emptyFormData);
              setFormErrors({});
              setGstDetails(null);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={isEdit ? handleUpdateRetailer : handleCreateRetailer} className="p-6 space-y-6">
          {/* Business Details Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Building size={20} />
              Business Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.business_name ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                  placeholder="Registered business name"
                  data-testid="input-business-name"
                />
                {formErrors.business_name && <p className="text-red-500 text-xs mt-1">{formErrors.business_name}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Trade Name
                </label>
                <input
                  type="text"
                  name="trade_name"
                  value={formData.trade_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  placeholder="Display name (if different)"
                  data-testid="input-trade-name"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  GST Number *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="gst_number"
                    value={formData.gst_number}
                    onChange={handleInputChange}
                    maxLength={15}
                    className={`flex-1 px-3 py-2 rounded-lg border ${formErrors.gst_number ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white uppercase focus:ring-2 focus:ring-amber-500`}
                    placeholder="22AAAAA0000A1Z5"
                    data-testid="input-gst-number"
                  />
                  <Button
                    type="button"
                    onClick={handleVerifyGST}
                    disabled={verifyingGST || formData.gst_number?.length !== 15}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid="btn-verify-gst"
                  >
                    {verifyingGST ? <RefreshCw className="animate-spin" size={16} /> : 'Verify GST'}
                  </Button>
                </div>
                {formErrors.gst_number && <p className="text-red-500 text-xs mt-1">{formErrors.gst_number}</p>}
                {gstDetails && (
                  <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm">
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">GST Verified ✓</p>
                    <p className="text-emerald-600 dark:text-emerald-300">Legal Name: {gstDetails.legal_name}</p>
                    {gstDetails.trade_name && <p className="text-emerald-600 dark:text-emerald-300">Trade Name: {gstDetails.trade_name}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Phone size={20} />
              Contact Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Username - Only for Create */}
              {!isEdit && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Username * <span className="text-xs text-amber-500">(Cannot be changed later)</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={(e) => {
                      // Only allow alphanumeric and underscore, lowercase
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setFormData(prev => ({ ...prev, username: value }));
                      if (formErrors.username) setFormErrors(prev => ({ ...prev, username: null }));
                    }}
                    className={`w-full px-3 py-2 rounded-lg border ${formErrors.username ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                    placeholder="retailer_username (letters, numbers, underscore only)"
                    data-testid="input-username"
                  />
                  {formErrors.username && <p className="text-red-500 text-xs mt-1">{formErrors.username}</p>}
                  <p className="text-xs text-slate-500 mt-1">This will be used for retailer login</p>
                </div>
              )}
              
              {/* Username Display - For Edit */}
              {isEdit && formData.username && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Username <span className="text-xs text-slate-400">(Read-only)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white cursor-not-allowed"
                    data-testid="input-username-readonly"
                  />
                </div>
              )}
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, email: e.target.value }));
                    if (formErrors.email) setFormErrors(prev => ({ ...prev, email: null }));
                  }}
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.email ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                  placeholder="retailer@example.com"
                  data-testid="input-email"
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Phone *
                </label>
                <div className="flex gap-2">
                  <select
                    name="phone_country_code"
                    value={formData.phone_country_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone_country_code: e.target.value }))}
                    className="w-24 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 text-sm"
                    data-testid="select-phone-country-code"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData(prev => ({ 
                        ...prev, 
                        phone: value,
                        // Auto-update WhatsApp if checkbox is checked
                        ...(prev.whatsapp_same_as_phone ? { whatsapp: value, whatsapp_country_code: prev.phone_country_code } : {})
                      }));
                      if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: null }));
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg border ${formErrors.phone ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                    placeholder="9876543210"
                    data-testid="input-phone"
                  />
                </div>
                {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  WhatsApp
                </label>
                <div className="flex gap-2">
                  <select
                    name="whatsapp_country_code"
                    value={formData.whatsapp_country_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_country_code: e.target.value }))}
                    disabled={formData.whatsapp_same_as_phone}
                    className={`w-24 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 ${formData.whatsapp_same_as_phone ? 'bg-slate-100 dark:bg-slate-600 cursor-not-allowed' : 'bg-white dark:bg-slate-700'} text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 text-sm`}
                    data-testid="select-whatsapp-country-code"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={formData.whatsapp_same_as_phone ? formData.phone : formData.whatsapp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData(prev => ({ ...prev, whatsapp: value }));
                    }}
                    disabled={formData.whatsapp_same_as_phone}
                    className={`flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 ${formData.whatsapp_same_as_phone ? 'bg-slate-100 dark:bg-slate-600 cursor-not-allowed' : 'bg-white dark:bg-slate-700'} text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                    placeholder="WhatsApp number"
                    data-testid="input-whatsapp"
                  />
                </div>
                {/* Same as Phone checkbox */}
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.whatsapp_same_as_phone}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        whatsapp_same_as_phone: checked,
                        ...(checked ? { whatsapp: prev.phone, whatsapp_country_code: prev.phone_country_code } : {})
                      }));
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    data-testid="checkbox-whatsapp-same"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Same as phone number</span>
                </label>
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <MapPin size={20} />
              Registered Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Address *
                </label>
                <textarea
                  name="registered_address"
                  value={formData.registered_address}
                  onChange={handleInputChange}
                  rows={2}
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.registered_address ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                  placeholder="Full registered address as per GST"
                  data-testid="input-address"
                />
                {formErrors.registered_address && <p className="text-red-500 text-xs mt-1">{formErrors.registered_address}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Pincode *
                  {pincodeLookupLoading && <span className="text-xs text-blue-500 ml-2">Looking up...</span>}
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  maxLength={6}
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.pincode ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                  placeholder="Enter 6-digit pincode first"
                  data-testid="input-pincode"
                />
                {formErrors.pincode && <p className="text-red-500 text-xs mt-1">{formErrors.pincode}</p>}
                <p className="text-xs text-slate-500 mt-1">City & State will be auto-filled</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  readOnly
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.city ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white cursor-not-allowed`}
                  placeholder="Auto-filled from pincode"
                  data-testid="input-city"
                />
                {formErrors.city && <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  District *
                </label>
                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  readOnly
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.district ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white cursor-not-allowed`}
                  placeholder="Auto-filled from pincode"
                  data-testid="input-district"
                />
                {formErrors.district && <p className="text-red-500 text-xs mt-1">{formErrors.district}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  State *
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  readOnly
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.state ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white cursor-not-allowed`}
                  placeholder="Auto-filled from pincode"
                  data-testid="input-state"
                />
                {formErrors.state && <p className="text-red-500 text-xs mt-1">{formErrors.state}</p>}
              </div>
            </div>
          </div>

          {/* SPOC Details Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
              <User size={20} />
              Single Point of Contact (SPOC)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  SPOC Name *
                </label>
                <input
                  type="text"
                  name="spoc_name"
                  value={formData.spoc_name}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 rounded-lg border ${formErrors.spoc_name ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                  placeholder="Contact person name"
                  data-testid="input-spoc-name"
                />
                {formErrors.spoc_name && <p className="text-red-500 text-xs mt-1">{formErrors.spoc_name}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Designation
                </label>
                <select
                  name="spoc_designation"
                  value={formData.spoc_designation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  data-testid="select-spoc-designation"
                >
                  <option value="">Select Designation</option>
                  {DESIGNATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  SPOC Phone *
                </label>
                <div className="flex gap-2">
                  <select
                    name="spoc_phone_country_code"
                    value={formData.spoc_phone_country_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, spoc_phone_country_code: e.target.value }))}
                    className="w-24 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 text-sm"
                    data-testid="select-spoc-phone-country-code"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    name="spoc_phone"
                    value={formData.spoc_phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setFormData(prev => ({ ...prev, spoc_phone: value }));
                      if (formErrors.spoc_phone) setFormErrors(prev => ({ ...prev, spoc_phone: null }));
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg border ${formErrors.spoc_phone ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                    placeholder="SPOC phone number"
                    data-testid="input-spoc-phone"
                  />
                </div>
                {formErrors.spoc_phone && <p className="text-red-500 text-xs mt-1">{formErrors.spoc_phone}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  SPOC Email
                </label>
                <input
                  type="email"
                  name="spoc_email"
                  value={formData.spoc_email}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, spoc_email: e.target.value }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  placeholder="spoc@example.com"
                  data-testid="input-spoc-email"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="spoc_dob"
                  value={formData.spoc_dob}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  data-testid="input-spoc-dob"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Anniversary
                </label>
                <input
                  type="date"
                  name="spoc_anniversary"
                  value={formData.spoc_anniversary}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  data-testid="input-spoc-anniversary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  ID Proof Type
                </label>
                <select
                  name="spoc_id_proof_type"
                  value={formData.spoc_id_proof_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  data-testid="select-id-proof-type"
                >
                  <option value="">Select ID Type</option>
                  {ID_PROOF_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  ID Proof Number
                </label>
                <input
                  type="text"
                  name="spoc_id_proof_number"
                  value={formData.spoc_id_proof_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                  placeholder="ID number"
                  data-testid="input-id-proof-number"
                />
              </div>
            </div>
          </div>

          {/* Password Section - Only for Create */}
          {!isEdit && (
            <div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Shield size={20} />
                Login Credentials
              </h3>
              <div className="max-w-md">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 pr-10 rounded-lg border ${formErrors.password ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500`}
                    placeholder="Minimum 6 characters"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
                <p className="text-xs text-slate-500 mt-1">Retailer will use this password to login to their dashboard</p>
              </div>
            </div>
          )}

          {/* Badges & Labels Section - Only for Edit */}
          {isEdit && (
            <div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Award size={20} />
                Badges & Labels
              </h3>
              <div className="space-y-4">
                {/* Addrika Verified Partner Toggle */}
                <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Award className="text-amber-600" size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">Addrika Verified Partner</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Mark as a trusted, verified partner of Addrika</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_addrika_verified_partner"
                      checked={formData.is_addrika_verified_partner}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_addrika_verified_partner: e.target.checked }))}
                      className="sr-only peer"
                      data-testid="toggle-verified-partner"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 dark:peer-focus:ring-amber-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* Retailer Label Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Retailer Label
                    </label>
                    <select
                      name="retailer_label"
                      value={formData.retailer_label}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                      data-testid="select-retailer-label"
                    >
                      {RETAILER_LABELS.map(label => (
                        <option key={label.value} value={label.value}>{label.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Label Period
                    </label>
                    <select
                      name="label_period"
                      value={formData.label_period}
                      onChange={handleInputChange}
                      disabled={!formData.retailer_label}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                      data-testid="select-label-period"
                    >
                      {generatePeriodOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">e.g., "March 2026" or "Q1 2026"</p>
                  </div>
                </div>

                {/* Send Notification Toggle */}
                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Mail className="text-blue-600" size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">Send Congratulations Email</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Automatically notify retailer when badge/label is awarded</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendBadgeNotification}
                      onChange={(e) => setSendBadgeNotification(e.target.checked)}
                      className="sr-only peer"
                      data-testid="toggle-send-notification"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                isEdit ? setShowEditModal(false) : setShowCreateModal(false);
                setFormData(emptyFormData);
                setFormErrors({});
              }}
              className="border-slate-300 dark:border-slate-600"
              data-testid="btn-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="btn-submit"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="animate-spin" size={16} />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </span>
              ) : (
                isEdit ? 'Update Retailer' : 'Create Retailer'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="admin-retailers-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Store className="text-amber-500" />
            Retailer Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Onboard and manage your retail partners
          </p>
        </div>
        {activeTab === 'list' && (
          <Button
            onClick={() => {
              setFormData(emptyFormData);
              setFormErrors({});
              setGstDetails(null);
              setShowCreateModal(true);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="btn-add-retailer"
          >
            <Plus size={18} className="mr-2" />
            Add Retailer
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b dark:border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'list'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          data-testid="tab-list"
        >
          <Store size={18} />
          Retailers List
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'analytics'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-b-2 border-amber-500'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          data-testid="tab-analytics"
        >
          <BarChart3 size={18} />
          Performance Analytics
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'analytics' ? (
        <AnalyticsTab />
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by name, email, GST, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
                data-testid="search-retailers"
              />
            </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500"
          data-testid="filter-status"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        <Button
          variant="outline"
          onClick={fetchRetailers}
          className="border-slate-300 dark:border-slate-600"
          data-testid="btn-refresh"
        >
          <RefreshCw size={18} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{retailers.filter(r => r.status !== 'deleted').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Active</p>
          <p className="text-2xl font-bold text-green-600">{retailers.filter(r => r.status === 'active').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{retailers.filter(r => r.status === 'pending_verification').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Verified Partners</p>
          <p className="text-2xl font-bold text-amber-600">{retailers.filter(r => r.is_addrika_verified_partner).length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">Suspended</p>
          <p className="text-2xl font-bold text-orange-600">{retailers.filter(r => r.status === 'suspended').length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">GST Verified</p>
          <p className="text-2xl font-bold text-emerald-600">{retailers.filter(r => r.gst_verified).length}</p>
        </div>
      </div>

      {/* Retailers Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="animate-spin mx-auto text-amber-500" size={32} />
            <p className="text-slate-500 mt-2">Loading retailers...</p>
          </div>
        ) : filteredRetailers.length === 0 ? (
          <div className="p-8 text-center">
            <Store className="mx-auto text-slate-300" size={48} />
            <p className="text-slate-500 mt-2">
              {searchQuery || statusFilter !== 'all' 
                ? 'No retailers match your filters' 
                : 'No retailers yet. Add your first retailer!'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="retailers-table">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Retailer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase hidden md:table-cell">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase hidden lg:table-cell">GST Number</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredRetailers.map((retailer) => (
                  <React.Fragment key={retailer.retailer_id}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Store className="text-amber-600" size={20} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 dark:text-white">{retailer.business_name}</p>
                            <p className="text-sm text-slate-500">{retailer.retailer_id}</p>
                            <p className="text-xs text-slate-400">{retailer.email}</p>
                          </div>
                        </div>
                        {/* Mobile expand button */}
                        <button
                          className="md:hidden mt-2 text-sm text-amber-600 flex items-center gap-1"
                          onClick={() => setExpandedRows(prev => ({ ...prev, [retailer.retailer_id]: !prev[retailer.retailer_id] }))}
                        >
                          {expandedRows[retailer.retailer_id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {expandedRows[retailer.retailer_id] ? 'Less' : 'More'}
                        </button>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <p className="text-sm text-slate-600 dark:text-slate-300">{retailer.city}, {retailer.state}</p>
                        <p className="text-xs text-slate-400">{retailer.pincode}</p>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <p className="text-sm font-mono text-slate-600 dark:text-slate-300">{retailer.gst_number}</p>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge 
                          status={retailer.status} 
                          isVerified={retailer.is_verified} 
                          gstVerified={retailer.gst_verified}
                          isAddrikaVerified={retailer.is_addrika_verified_partner}
                          retailerLabel={retailer.retailer_label}
                          labelPeriod={retailer.label_period}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Deleted retailer - show restore button */}
                          {retailer.status === 'deleted' ? (
                            <button
                              onClick={() => handleRestoreRetailer(retailer)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                              title="Restore Retailer"
                              data-testid={`restore-${retailer.retailer_id}`}
                            >
                              <RotateCcw size={18} />
                            </button>
                          ) : (
                            <>
                              {/* Verify GST */}
                              {!retailer.gst_verified && retailer.status !== 'suspended' && (
                                <button
                                  onClick={() => handleVerifyRetailerGST(retailer.retailer_id)}
                                  className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"
                                  title="Verify GST"
                                  data-testid={`verify-gst-${retailer.retailer_id}`}
                                >
                                  <CheckCircle size={18} />
                                </button>
                              )}
                              
                              {/* Toggle Verified Partner Badge */}
                              <button
                                onClick={() => handleToggleVerifiedPartner(retailer)}
                                className={`p-2 rounded-lg ${
                                  retailer.is_addrika_verified_partner
                                    ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' 
                                    : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                title={retailer.is_addrika_verified_partner ? 'Remove Verified Partner badge' : 'Mark as Verified Partner'}
                                data-testid={`toggle-partner-${retailer.retailer_id}`}
                              >
                                <Award size={18} />
                              </button>
                              
                              {/* Edit */}
                              <button
                                onClick={() => openEditModal(retailer)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                                title="Edit"
                                data-testid={`edit-${retailer.retailer_id}`}
                              >
                                <Edit2 size={18} />
                              </button>
                              
                              {/* Suspend / Activate */}
                              <button
                                onClick={() => handleToggleStatus(retailer)}
                                className={`p-2 rounded-lg ${
                                  retailer.status === 'active' 
                                    ? 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20' 
                                    : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                }`}
                                title={retailer.status === 'active' ? 'Suspend' : 'Activate'}
                                data-testid={`toggle-status-${retailer.retailer_id}`}
                              >
                                {retailer.status === 'active' ? <Ban size={18} /> : <CheckCircle size={18} />}
                              </button>
                              
                              {/* Delete */}
                              <button
                                onClick={() => {
                                  setSelectedRetailer(retailer);
                                  setDeleteType('soft');
                                  setShowDeleteModal(true);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                title="Delete"
                                data-testid={`delete-${retailer.retailer_id}`}
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Mobile expanded row */}
                    {expandedRows[retailer.retailer_id] && (
                      <tr className="md:hidden bg-slate-50 dark:bg-slate-700/50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="space-y-2 text-sm">
                            <p><strong>Location:</strong> {retailer.city}, {retailer.state} - {retailer.pincode}</p>
                            <p><strong>GST:</strong> {retailer.gst_number}</p>
                            <p><strong>Phone:</strong> {retailer.phone}</p>
                            {retailer.spoc?.name && <p><strong>SPOC:</strong> {retailer.spoc.name}</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && renderFormModal(false)}
      
      {/* Edit Modal */}
      {showEditModal && renderFormModal(true)}
        </>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && selectedRetailer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Ban className="text-orange-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Suspend Retailer</h3>
                  <p className="text-sm text-slate-500">{selectedRetailer.business_name}</p>
                </div>
              </div>
              
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                This will temporarily deactivate the retailer account. They won't be able to access their dashboard or receive orders.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Reason for Suspension (Optional)
                </label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for suspension..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:ring-2 focus:ring-orange-500"
                  data-testid="suspend-reason"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSuspendModal(false);
                    setSelectedRetailer(null);
                    setSuspendReason('');
                  }}
                  className="border-slate-300 dark:border-slate-600"
                  data-testid="btn-cancel-suspend"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSuspendRetailer}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                  data-testid="btn-confirm-suspend"
                >
                  <Ban size={16} className="mr-2" />
                  Suspend Retailer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedRetailer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Delete Retailer</h3>
                  <p className="text-sm text-slate-500">{selectedRetailer.business_name}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-slate-600 dark:text-slate-300 mb-3">
                  Choose how you want to remove this retailer:
                </p>
                
                {/* Delete Type Selection */}
                <div className="space-y-3">
                  <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    deleteType === 'soft' 
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="deleteType"
                      value="soft"
                      checked={deleteType === 'soft'}
                      onChange={() => setDeleteType('soft')}
                      className="mt-1"
                      data-testid="delete-soft"
                    />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">Soft Delete (Recommended)</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Marks the retailer as deleted but retains all data. Can be restored later.
                      </p>
                    </div>
                  </label>
                  
                  <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    deleteType === 'permanent' 
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                      : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="deleteType"
                      value="permanent"
                      checked={deleteType === 'permanent'}
                      onChange={() => setDeleteType('permanent')}
                      className="mt-1"
                      data-testid="delete-permanent"
                    />
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">Permanent Delete</p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Permanently removes the retailer and all associated data. This action cannot be undone!
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedRetailer(null);
                    setDeleteType('soft');
                  }}
                  className="border-slate-300 dark:border-slate-600"
                  data-testid="btn-cancel-delete"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteRetailer}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-confirm-delete"
                >
                  <Trash2 size={16} className="mr-2" />
                  {deleteType === 'permanent' ? 'Permanently Delete' : 'Delete Retailer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRetailersPage;
