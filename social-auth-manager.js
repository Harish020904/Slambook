// Social Authentication Manager for SLAM Chronicles
// Handles Google, Facebook, Instagram, and other social logins + MFA

import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  unlink,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier
} from 'firebase/auth';
import { auth } from './firebase-config.js';
import { dbManager } from './database-manager.js';
import { authManager } from './auth-manager.js';

class SocialAuthManager {
  constructor() {
    this.auth = auth;
    this.providers = {
      google: new GoogleAuthProvider(),
      facebook: new FacebookAuthProvider(),
      twitter: new TwitterAuthProvider()
    };

    this.setupProviders();
    this.recaptchaVerifier = null;
  }

  // Setup provider configurations
  setupProviders() {
    // Google Provider Configuration
    this.providers.google.addScope('profile');
    this.providers.google.addScope('email');
    this.providers.google.setCustomParameters({
      prompt: 'select_account'
    });

    // Facebook Provider Configuration
    this.providers.facebook.addScope('email');
    this.providers.facebook.addScope('public_profile');
    this.providers.facebook.setCustomParameters({
      display: 'popup'
    });

    // Twitter Provider Configuration
    this.providers.twitter.setCustomParameters({
      lang: 'en'
    });
  }

  // 🔐 SOCIAL LOGIN METHODS

  // Google Sign In
  async signInWithGoogle() {
    try {
      console.log('🔄 Signing in with Google...');

      const result = await signInWithPopup(this.auth, this.providers.google);
      const user = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);

      // Create or update user profile
      await this.handleSocialSignIn(user, 'google', {
        accessToken: credential.accessToken,
        idToken: credential.idToken
      });

      console.log('✅ Google sign-in successful:', user.uid);
      return {
        success: true,
        user: user,
        provider: 'google',
        message: 'Welcome! Signed in with Google successfully!'
      };
    } catch (error) {
      console.error('❌ Google sign-in error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
        provider: 'google'
      };
    }
  }

  // Facebook Sign In
  async signInWithFacebook() {
    try {
      console.log('🔄 Signing in with Facebook...');

      const result = await signInWithPopup(this.auth, this.providers.facebook);
      const user = result.user;
      const credential = FacebookAuthProvider.credentialFromResult(result);

      await this.handleSocialSignIn(user, 'facebook', {
        accessToken: credential.accessToken
      });

      console.log('✅ Facebook sign-in successful:', user.uid);
      return {
        success: true,
        user: user,
        provider: 'facebook',
        message: 'Welcome! Signed in with Facebook successfully!'
      };
    } catch (error) {
      console.error('❌ Facebook sign-in error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
        provider: 'facebook'
      };
    }
  }

  // Twitter Sign In
  async signInWithTwitter() {
    try {
      console.log('🔄 Signing in with Twitter...');

      const result = await signInWithPopup(this.auth, this.providers.twitter);
      const user = result.user;
      const credential = TwitterAuthProvider.credentialFromResult(result);

      await this.handleSocialSignIn(user, 'twitter', {
        accessToken: credential.accessToken,
        secret: credential.secret
      });

      console.log('✅ Twitter sign-in successful:', user.uid);
      return {
        success: true,
        user: user,
        provider: 'twitter',
        message: 'Welcome! Signed in with Twitter successfully!'
      };
    } catch (error) {
      console.error('❌ Twitter sign-in error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code),
        provider: 'twitter'
      };
    }
  }

  // Handle social sign-in user creation/update
  async handleSocialSignIn(user, provider, credentials) {
    try {
      // Check if user exists in our database
      const existingUser = await dbManager.getUser(user.uid);

      if (!existingUser.success) {
        // Create new user profile
        await dbManager.createUser(user.uid, {
          secretName: user.displayName || `${provider}_user`,
          email: user.email,
          photoURL: user.photoURL,
          provider: provider,
          socialProviders: [provider],
          emailVerified: user.emailVerified,
          createdVia: 'social_login'
        });

        // Check for localStorage data to migrate
        if (authManager.hasLocalStorageData()) {
          await dbManager.migrateLocalStorageData(user.uid);
        }
      } else {
        // Update existing user
        const currentProviders = existingUser.data.socialProviders || [];
        if (!currentProviders.includes(provider)) {
          currentProviders.push(provider);
        }

        await dbManager.updateUser(user.uid, {
          lastLoginAt: new Date().toISOString(),
          socialProviders: currentProviders,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        });
      }
    } catch (error) {
      console.error('❌ Error handling social sign-in:', error);
      throw error;
    }
  }

  // 🔗 ACCOUNT LINKING METHODS

  // Link Google account to existing account
  async linkGoogleAccount() {
    try {
      if (!this.auth.currentUser) {
        throw new Error('No user signed in');
      }

      const result = await linkWithPopup(this.auth.currentUser, this.providers.google);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      // Update user profile
      await this.updateLinkedProviders('google');

      console.log('✅ Google account linked successfully');
      return {
        success: true,
        message: 'Google account linked successfully!',
        accessToken: credential.accessToken
      };
    } catch (error) {
      console.error('❌ Error linking Google account:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Link Facebook account
  async linkFacebookAccount() {
    try {
      if (!this.auth.currentUser) {
        throw new Error('No user signed in');
      }

      const result = await linkWithPopup(this.auth.currentUser, this.providers.facebook);
      await this.updateLinkedProviders('facebook');

      console.log('✅ Facebook account linked successfully');
      return {
        success: true,
        message: 'Facebook account linked successfully!'
      };
    } catch (error) {
      console.error('❌ Error linking Facebook account:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Unlink social account
  async unlinkAccount(providerId) {
    try {
      if (!this.auth.currentUser) {
        throw new Error('No user signed in');
      }

      await unlink(this.auth.currentUser, providerId);

      // Update user profile
      const user = await dbManager.getUser(this.auth.currentUser.uid);
      if (user.success) {
        const providers = user.data.socialProviders || [];
        const updatedProviders = providers.filter(p => p !== providerId);

        await dbManager.updateUser(this.auth.currentUser.uid, {
          socialProviders: updatedProviders
        });
      }

      console.log(`✅ ${providerId} account unlinked successfully`);
      return {
        success: true,
        message: `${providerId} account unlinked successfully!`
      };
    } catch (error) {
      console.error(`❌ Error unlinking ${providerId} account:`, error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Update linked providers in database
  async updateLinkedProviders(newProvider) {
    try {
      const user = await dbManager.getUser(this.auth.currentUser.uid);
      if (user.success) {
        const currentProviders = user.data.socialProviders || [];
        if (!currentProviders.includes(newProvider)) {
          currentProviders.push(newProvider);

          await dbManager.updateUser(this.auth.currentUser.uid, {
            socialProviders: currentProviders
          });
        }
      }
    } catch (error) {
      console.error('❌ Error updating linked providers:', error);
    }
  }

  // 📱 MULTI-FACTOR AUTHENTICATION (MFA)

  // Setup phone number for MFA
  async setupPhoneMFA(phoneNumber) {
    try {
      if (!this.auth.currentUser) {
        throw new Error('No user signed in');
      }

      // Setup reCAPTCHA verifier
      if (!this.recaptchaVerifier) {
        this.recaptchaVerifier = new RecaptchaVerifier(this.auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log('reCAPTCHA solved');
          }
        });
      }

      const phoneAuthProvider = new PhoneAuthProvider(this.auth);
      const phoneInfoOptions = {
        phoneNumber: phoneNumber,
        session: await multiFactor(this.auth.currentUser).getSession()
      };

      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        this.recaptchaVerifier
      );

      console.log('✅ SMS sent for MFA setup');
      return {
        success: true,
        verificationId: verificationId,
        message: 'SMS sent! Enter the verification code.'
      };
    } catch (error) {
      console.error('❌ Error setting up phone MFA:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Complete phone MFA setup
  async completePhoneMFASetup(verificationId, verificationCode, displayName = 'Phone') {
    try {
      if (!this.auth.currentUser) {
        throw new Error('No user signed in');
      }

      const phoneAuthCredential = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      await multiFactor(this.auth.currentUser).enroll(multiFactorAssertion, displayName);

      // Update user profile
      await dbManager.updateUser(this.auth.currentUser.uid, {
        mfaEnabled: true,
        mfaMethod: 'phone',
        mfaSetupAt: new Date().toISOString()
      });

      console.log('✅ Phone MFA setup completed');
      return {
        success: true,
        message: 'Multi-factor authentication enabled successfully!'
      };
    } catch (error) {
      console.error('❌ Error completing phone MFA setup:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Sign in with MFA
  async signInWithMFA(email, password) {
    try {
      console.log('🔄 Attempting sign-in with MFA...');

      const result = await authManager.signIn(email, password);

      if (!result.success && result.error.includes('multi-factor')) {
        // MFA required
        return {
          success: false,
          requiresMFA: true,
          message: 'Multi-factor authentication required'
        };
      }

      return result;
    } catch (error) {
      console.error('❌ MFA sign-in error:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  // Get user's linked accounts
  async getLinkedAccounts() {
    try {
      if (!this.auth.currentUser) {
        return { success: false, error: 'No user signed in' };
      }

      const user = await dbManager.getUser(this.auth.currentUser.uid);
      if (user.success) {
        const linkedProviders = user.data.socialProviders || [];
        const providerData = this.auth.currentUser.providerData || [];

        return {
          success: true,
          linkedProviders: linkedProviders,
          providerData: providerData,
          mfaEnabled: user.data.mfaEnabled || false
        };
      }

      return { success: false, error: 'User data not found' };
    } catch (error) {
      console.error('❌ Error getting linked accounts:', error);
      return { success: false, error: error.message };
    }
  }

  // 🛠️ UTILITY METHODS

  // Check if provider is available
  isProviderAvailable(provider) {
    return !!this.providers[provider];
  }

  // Get all available providers
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  // Clean up reCAPTCHA verifier
  cleanupRecaptcha() {
    if (this.recaptchaVerifier) {
      this.recaptchaVerifier.clear();
      this.recaptchaVerifier = null;
    }
  }

  // Convert error codes to user-friendly messages
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
      'auth/credential-already-in-use': 'This account is already linked to another user.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-verification-code': 'Invalid verification code.',
      'auth/invalid-verification-id': 'Invalid verification ID.',
      'auth/code-expired': 'Verification code has expired.',
      'auth/too-many-requests': 'Too many requests. Please try again later.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed before completion.',
      'auth/popup-blocked': 'Sign-in popup was blocked by the browser.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/requires-recent-login': 'Please sign in again to complete this action.'
    };

    return errorMessages[errorCode] || 'An unexpected error occurred. Please try again.';
  }
}

// Create and export singleton instance
export const socialAuthManager = new SocialAuthManager();
export default SocialAuthManager;