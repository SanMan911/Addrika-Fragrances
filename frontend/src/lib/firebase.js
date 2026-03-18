/**
 * Firebase Configuration and Push Notification Service
 * 
 * PLACEHOLDER SETUP - Configure Firebase credentials to enable push notifications.
 * 
 * Setup Instructions:
 * 1. Create a Firebase project at https://console.firebase.google.com/
 * 2. Add a web app to your project
 * 3. Copy the config values to frontend/.env:
 *    - REACT_APP_FIREBASE_API_KEY
 *    - REACT_APP_FIREBASE_AUTH_DOMAIN
 *    - REACT_APP_FIREBASE_PROJECT_ID
 *    - REACT_APP_FIREBASE_STORAGE_BUCKET
 *    - REACT_APP_FIREBASE_MESSAGING_SENDER_ID
 *    - REACT_APP_FIREBASE_APP_ID
 *    - REACT_APP_FIREBASE_VAPID_KEY (from Cloud Messaging settings)
 */

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;

// Check if Firebase is configured
export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    vapidKey
  );
};

// Firebase app instance (lazy initialized)
let firebaseApp = null;
let messagingInstance = null;

/**
 * Initialize Firebase (lazy loading)
 */
export const initializeFirebase = async () => {
  if (!isFirebaseConfigured()) {
    console.log('Firebase not configured - push notifications disabled');
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Dynamic import for code splitting
    const { initializeApp, getApps } = await import('firebase/app');
    
    // Check if already initialized
    const apps = getApps();
    if (apps.length > 0) {
      firebaseApp = apps[0];
    } else {
      firebaseApp = initializeApp(firebaseConfig);
    }
    
    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
};

/**
 * Get Firebase Messaging instance
 */
export const getMessaging = async () => {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (messagingInstance) {
    return messagingInstance;
  }

  try {
    const app = await initializeFirebase();
    if (!app) return null;

    const { getMessaging: getFirebaseMessaging, isSupported } = await import('firebase/messaging');
    
    // Check if messaging is supported in this browser
    const supported = await isSupported();
    if (!supported) {
      console.log('Push notifications not supported in this browser');
      return null;
    }

    messagingInstance = getFirebaseMessaging(app);
    return messagingInstance;
  } catch (error) {
    console.error('Failed to get messaging instance:', error);
    return null;
  }
};

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async () => {
  if (!isFirebaseConfigured()) {
    console.log('Firebase not configured');
    return { success: false, error: 'Push notifications not configured' };
  }

  // Check if notifications are supported
  if (!('Notification' in window)) {
    return { success: false, error: 'Notifications not supported in this browser' };
  }

  // Check permission status
  if (Notification.permission === 'denied') {
    return { 
      success: false, 
      error: 'Notifications are blocked. Please enable them in browser settings.' 
    };
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied' };
    }

    // Get FCM token
    const messaging = await getMessaging();
    if (!messaging) {
      return { success: false, error: 'Messaging not available' };
    }

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, { vapidKey });

    if (!token) {
      return { success: false, error: 'Failed to get notification token' };
    }

    console.log('FCM Token:', token);
    return { success: true, token };
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe to push notifications
 * Sends FCM token to backend for storage
 */
export const subscribeToPushNotifications = async (apiUrl) => {
  const result = await requestNotificationPermission();
  
  if (!result.success) {
    return result;
  }

  try {
    // Send token to backend
    const response = await fetch(`${apiUrl}/api/auth/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fcm_token: result.token,
        enabled: true
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription');
    }

    return { success: true, token: result.token };
  } catch (error) {
    console.error('Failed to subscribe to push:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPushNotifications = async (apiUrl) => {
  try {
    const response = await fetch(`${apiUrl}/api/auth/push-unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to unsubscribe');
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to unsubscribe from push:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Setup foreground message handler
 */
export const onForegroundMessage = async (callback) => {
  const messaging = await getMessaging();
  if (!messaging) return null;

  try {
    const { onMessage } = await import('firebase/messaging');
    return onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      callback(payload);
    });
  } catch (error) {
    console.error('Failed to setup message handler:', error);
    return null;
  }
};

export default {
  isFirebaseConfigured,
  initializeFirebase,
  getMessaging,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  onForegroundMessage
};
