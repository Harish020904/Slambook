// Firebase Configuration for SLAM Chronicles
// This file handles Firebase initialization and configuration

// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Your Firebase configuration
// Replace these with your actual Firebase project credentials from Firebase Console
const firebaseConfig = {
  // REPLACE THESE WITH YOUR ACTUAL VALUES FROM FIREBASE CONSOLE:
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
  measurementId: "your-measurement-id"

  // Example of what it should look like:
  // apiKey: "AIzaSyC1234567890abcdefghijklmnop",
  // authDomain: "slam-chronicles-john.firebaseapp.com",
  // projectId: "slam-chronicles-john",
  // storageBucket: "slam-chronicles-john.appspot.com",
  // messagingSenderId: "123456789012",
  // appId: "1:123456789012:web:abcdef1234567890",
  // measurementId: "G-ABCDEF1234"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Analytics (optional)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

// Development mode configuration
const isDevelopment = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1';

if (isDevelopment) {
  console.log('🔥 Firebase initialized in development mode');

  // Connect to Firebase emulators in development
  // Uncomment these lines if you want to use Firebase emulators
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectAuthEmulator(auth, 'http://localhost:9099');
}

// Export the Firebase app instance
export default app;

// Firebase configuration status
export const firebaseStatus = {
  initialized: true,
  services: {
    firestore: !!db,
    auth: !!auth,
    analytics: !!analytics
  },
  environment: isDevelopment ? 'development' : 'production'
};

console.log('🔥 Firebase Configuration Loaded:', firebaseStatus);