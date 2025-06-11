// Authentication Manager for SLAM Chronicles
// Handles user authentication with Firebase Auth

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth } from './firebase-config.js';
import { dbManager } from './database-manager.js';

class AuthManager {
  constructor() {
    this.auth = auth;
    this.currentUser = null;
    this.authStateListeners = [];
    this.setupAuthStateListener();
  }

  // Set up authentication state listener
  setupAuthStateListener() {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      if (user) {
        dbManager.setCurrentUser(user.uid);
        console.log('✅ User authenticated:', user.uid);
      } else {
        console.log('ℹ️ User signed out');
      }

      // Notify all listeners
      this.authStateListeners.forEach(callback => callback(user));
    });
  }

  // Add auth state listener
  onAuthStateChange(callback) {
    this.authStateListeners.push(callback);
    // Call immediately with current state
    callback(this.currentUser);

    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  // Create new user account
  async createAccount(secretName, secretMessage, email, additionalData = {}) {
    try {
      console.log('🔄 Creating new user account...');

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, secretMessage);
      const user = userCredential.user;

      // Update user profile with secret name
      await updateProfile(user, {
        displayName: secretName
      });

      // Create user document in Firestore
      const userResult = await dbManager.createUser(user.uid, {
        secretName: secretName,
        email: email,
        ...additionalData
      });

      if (!userResult.success) {
        throw new Error(userResult.error);
      }

      console.log('✅ User account created successfully:', user.uid);
      return {
        success: true,
        user: user,
        message: 'Account created successfully!'
      };
    } catch (error) {
      console.error('❌ Error creating account:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Sign in existing user
  async signIn(email, secretMessage) {
    try {
      console.log('🔄 Signing in user...');

      const userCredential = await signInWithEmailAndPassword(this.auth, email, secretMessage);
      const user = userCredential.user;

      // Update last login time
      await dbManager.updateUser(user.uid, {
        lastLoginAt: new Date().toISOString()
      });

      console.log('✅ User signed in successfully:', user.uid);
      return {
        success: true,
        user: user,
        message: 'Welcome back!'
      };
    } catch (error) {
      console.error('❌ Error signing in:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Sign out current user
  async signOut() {
    try {
      await signOut(this.auth);
      dbManager.removeAllListeners();
      console.log('✅ User signed out successfully');
      return { success: true, message: 'Signed out successfully' };
    } catch (error) {
      console.error('❌ Error signing out:', error);
      return { success: false, error: error.message };
    }
  }

  // Send password reset email
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(this.auth, email);
      console.log('✅ Password reset email sent');
      return {
        success: true,
        message: 'Password reset email sent! Check your inbox.'
      };
    } catch (error) {
      console.error('❌ Error sending password reset:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Update user profile
  async updateUserProfile(displayName, additionalData = {}) {
    try {
      if (!this.currentUser) {
        throw new Error('No user signed in');
      }

      // Update Firebase Auth profile
      if (displayName) {
        await updateProfile(this.currentUser, { displayName });
      }

      // Update Firestore user document
      const updateResult = await dbManager.updateUser(this.currentUser.uid, {
        secretName: displayName,
        ...additionalData
      });

      if (!updateResult.success) {
        throw new Error(updateResult.error);
      }

      console.log('✅ User profile updated successfully');
      return { success: true, message: 'Profile updated successfully!' };
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete user account
  async deleteAccount(currentPassword) {
    try {
      if (!this.currentUser) {
        throw new Error('No user signed in');
      }

      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(
        this.currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(this.currentUser, credential);

      const userId = this.currentUser.uid;

      // Delete user data from Firestore first
      // Note: In production, you might want to keep some data for analytics
      const chronicles = await dbManager.getChronicles(userId);
      if (chronicles.success) {
        for (const chronicle of chronicles.data) {
          await dbManager.deleteChronicle(userId, chronicle.id);
        }
      }

      // Delete user document
      // Note: You'll need to implement deleteUser in dbManager

      // Delete Firebase Auth user
      await deleteUser(this.currentUser);

      console.log('✅ User account deleted successfully');
      return { success: true, message: 'Account deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting account:', error);
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  // Get current user info
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get user ID
  getUserId() {
    return this.currentUser?.uid || null;
  }

  // Get user email
  getUserEmail() {
    return this.currentUser?.email || null;
  }

  // Get user display name (secret name)
  getUserDisplayName() {
    return this.currentUser?.displayName || null;
  }

  // Convert Firebase error codes to user-friendly messages
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password should be at least 6 characters long.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/requires-recent-login': 'Please sign in again to complete this action.',
      'auth/invalid-credential': 'Invalid credentials. Please check your email and password.'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  // Migrate from localStorage authentication
  async migrateFromLocalStorage() {
    try {
      console.log('🔄 Checking for localStorage data to migrate...');

      const existingUsers = JSON.parse(localStorage.getItem('slamChroniclesUsers')) || {};
      const currentUser = localStorage.getItem('currentSlamUser') || localStorage.getItem('currentUser');

      if (!currentUser || !existingUsers[currentUser]) {
        console.log('ℹ️ No localStorage authentication data found');
        return { success: true, message: 'No data to migrate' };
      }

      const userData = existingUsers[currentUser];

      // Create a temporary email for migration
      const tempEmail = `${currentUser.toLowerCase().replace(/\s+/g, '')}@slamchronicles.local`;

      // Try to create account with existing data
      const result = await this.createAccount(
        currentUser,
        userData.secretMessage,
        tempEmail,
        {
          bio: userData.bio || '',
          migratedFromLocalStorage: true,
          originalCreatedAt: userData.createdAt
        }
      );

      if (result.success) {
        // Migrate database data
        await dbManager.migrateLocalStorageData(result.user.uid);

        console.log('✅ Successfully migrated from localStorage');
        return {
          success: true,
          message: 'Your data has been migrated to the cloud!',
          tempEmail: tempEmail
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Error migrating from localStorage:', error);
      return { success: false, error: error.message };
    }
  }

  // Check for existing localStorage data
  hasLocalStorageData() {
    const existingUsers = JSON.parse(localStorage.getItem('slamChroniclesUsers')) || {};
    const currentUser = localStorage.getItem('currentSlamUser') || localStorage.getItem('currentUser');

    return !!(currentUser && existingUsers[currentUser]);
  }

  // Clear localStorage data after successful migration
  clearLocalStorageData() {
    localStorage.removeItem('slamChroniclesUsers');
    localStorage.removeItem('currentSlamUser');
    localStorage.removeItem('currentUser');

    // Clear any other localStorage data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('memoryBooks_') || key.startsWith('currentBook'))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    console.log('✅ localStorage data cleared after migration');
  }
}

// Create and export singleton instance
export const authManager = new AuthManager();
export default AuthManager;