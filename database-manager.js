// Database Manager for SLAM Chronicles
// Handles all database operations with Firebase Firestore

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase-config.js';

class DatabaseManager {
  constructor() {
    this.db = db;
    this.currentUser = null;
    this.listeners = new Map(); // For real-time listeners
  }

  // Set current user
  setCurrentUser(userId) {
    this.currentUser = userId;
  }

  // User Management
  async createUser(userId, userData) {
    try {
      const userRef = doc(this.db, 'users', userId);
      const userDoc = {
        ...userData,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };

      await setDoc(userRef, userDoc);
      console.log('✅ User created successfully:', userId);
      return { success: true, data: userDoc };
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return { success: false, error: error.message };
    }
  }

  async getUser(userId) {
    try {
      const userRef = doc(this.db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return { success: true, data: userSnap.data() };
      } else {
        return { success: false, error: 'User not found' };
      }
    } catch (error) {
      console.error('❌ Error getting user:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUser(userId, userData) {
    try {
      const userRef = doc(this.db, 'users', userId);
      await updateDoc(userRef, {
        ...userData,
        updatedAt: serverTimestamp()
      });

      console.log('✅ User updated successfully:', userId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return { success: false, error: error.message };
    }
  }

  // Chronicle Management
  async createChronicle(userId, chronicleData) {
    try {
      const chroniclesRef = collection(this.db, 'users', userId, 'chronicles');
      const chronicleDoc = {
        ...chronicleData,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        memoryCount: 0
      };

      const docRef = await addDoc(chroniclesRef, chronicleDoc);
      console.log('✅ Chronicle created successfully:', docRef.id);
      return { success: true, id: docRef.id, data: chronicleDoc };
    } catch (error) {
      console.error('❌ Error creating chronicle:', error);
      return { success: false, error: error.message };
    }
  }

  async getChronicles(userId) {
    try {
      const chroniclesRef = collection(this.db, 'users', userId, 'chronicles');
      const q = query(chroniclesRef, orderBy('lastUpdated', 'desc'));
      const querySnapshot = await getDocs(q);

      const chronicles = [];
      querySnapshot.forEach((doc) => {
        chronicles.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, data: chronicles };
    } catch (error) {
      console.error('❌ Error getting chronicles:', error);
      return { success: false, error: error.message };
    }
  }

  async getChronicle(userId, chronicleId) {
    try {
      const chronicleRef = doc(this.db, 'users', userId, 'chronicles', chronicleId);
      const chronicleSnap = await getDoc(chronicleRef);

      if (chronicleSnap.exists()) {
        return { success: true, data: { id: chronicleId, ...chronicleSnap.data() } };
      } else {
        return { success: false, error: 'Chronicle not found' };
      }
    } catch (error) {
      console.error('❌ Error getting chronicle:', error);
      return { success: false, error: error.message };
    }
  }

  async updateChronicle(userId, chronicleId, chronicleData) {
    try {
      const chronicleRef = doc(this.db, 'users', userId, 'chronicles', chronicleId);
      await updateDoc(chronicleRef, {
        ...chronicleData,
        lastUpdated: serverTimestamp()
      });

      console.log('✅ Chronicle updated successfully:', chronicleId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating chronicle:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteChronicle(userId, chronicleId) {
    try {
      // Delete all memories in the chronicle first
      const memoriesRef = collection(this.db, 'users', userId, 'chronicles', chronicleId, 'memories');
      const memoriesSnapshot = await getDocs(memoriesRef);

      const batch = writeBatch(this.db);
      memoriesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete the chronicle itself
      const chronicleRef = doc(this.db, 'users', userId, 'chronicles', chronicleId);
      batch.delete(chronicleRef);

      await batch.commit();
      console.log('✅ Chronicle deleted successfully:', chronicleId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting chronicle:', error);
      return { success: false, error: error.message };
    }
  }

  // Memory Management
  async createMemory(userId, chronicleId, memoryData) {
    try {
      const memoriesRef = collection(this.db, 'users', userId, 'chronicles', chronicleId, 'memories');
      const memoryDoc = {
        ...memoryData,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(memoriesRef, memoryDoc);

      // Update chronicle's memory count and last updated
      await this.updateChronicleStats(userId, chronicleId);

      console.log('✅ Memory created successfully:', docRef.id);
      return { success: true, id: docRef.id, data: memoryDoc };
    } catch (error) {
      console.error('❌ Error creating memory:', error);
      return { success: false, error: error.message };
    }
  }

  async getMemories(userId, chronicleId) {
    try {
      const memoriesRef = collection(this.db, 'users', userId, 'chronicles', chronicleId, 'memories');
      const q = query(memoriesRef, orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);

      const memories = [];
      querySnapshot.forEach((doc) => {
        memories.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, data: memories };
    } catch (error) {
      console.error('❌ Error getting memories:', error);
      return { success: false, error: error.message };
    }
  }

  async updateMemory(userId, chronicleId, memoryId, memoryData) {
    try {
      const memoryRef = doc(this.db, 'users', userId, 'chronicles', chronicleId, 'memories', memoryId);
      await updateDoc(memoryRef, {
        ...memoryData,
        lastModified: serverTimestamp()
      });

      // Update chronicle's last updated
      await this.updateChronicleStats(userId, chronicleId);

      console.log('✅ Memory updated successfully:', memoryId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating memory:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteMemory(userId, chronicleId, memoryId) {
    try {
      const memoryRef = doc(this.db, 'users', userId, 'chronicles', chronicleId, 'memories', memoryId);
      await deleteDoc(memoryRef);

      // Update chronicle's memory count and last updated
      await this.updateChronicleStats(userId, chronicleId);

      console.log('✅ Memory deleted successfully:', memoryId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting memory:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to update chronicle statistics
  async updateChronicleStats(userId, chronicleId) {
    try {
      const memoriesRef = collection(this.db, 'users', userId, 'chronicles', chronicleId, 'memories');
      const memoriesSnapshot = await getDocs(memoriesRef);
      const memoryCount = memoriesSnapshot.size;

      const chronicleRef = doc(this.db, 'users', userId, 'chronicles', chronicleId);
      await updateDoc(chronicleRef, {
        memoryCount: memoryCount,
        lastUpdated: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Error updating chronicle stats:', error);
    }
  }

  // Real-time listeners
  listenToChronicles(userId, callback) {
    const chroniclesRef = collection(this.db, 'users', userId, 'chronicles');
    const q = query(chroniclesRef, orderBy('lastUpdated', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chronicles = [];
      snapshot.forEach((doc) => {
        chronicles.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(chronicles);
    });

    this.listeners.set(`chronicles_${userId}`, unsubscribe);
    return unsubscribe;
  }

  listenToMemories(userId, chronicleId, callback) {
    const memoriesRef = collection(this.db, 'users', userId, 'chronicles', chronicleId, 'memories');
    const q = query(memoriesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memories = [];
      snapshot.forEach((doc) => {
        memories.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(memories);
    });

    this.listeners.set(`memories_${chronicleId}`, unsubscribe);
    return unsubscribe;
  }

  // Clean up listeners
  removeListener(key) {
    const unsubscribe = this.listeners.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(key);
    }
  }

  removeAllListeners() {
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
  }

  // Data migration from localStorage
  async migrateLocalStorageData(userId) {
    try {
      console.log('🔄 Starting data migration from localStorage...');

      // Get existing localStorage data
      const existingUsers = JSON.parse(localStorage.getItem('slamChroniclesUsers')) || {};
      const currentUser = localStorage.getItem('currentSlamUser') || localStorage.getItem('currentUser');

      if (!currentUser || !existingUsers[currentUser]) {
        console.log('ℹ️ No localStorage data to migrate');
        return { success: true, message: 'No data to migrate' };
      }

      const userData = existingUsers[currentUser];

      // Migrate user profile
      await this.createUser(userId, {
        secretName: currentUser,
        bio: userData.bio || '',
        secretMessage: userData.secretMessage // Note: In production, don't store passwords!
      });

      // Migrate chronicles (books)
      const books = JSON.parse(localStorage.getItem(`memoryBooks_${currentUser}`)) || [];

      for (const book of books) {
        const chronicleResult = await this.createChronicle(userId, {
          title: book.title,
          subtitle: book.subtitle,
          color: book.color,
          originalCreatedAt: book.createdAt
        });

        if (chronicleResult.success && book.memories) {
          // Migrate memories
          for (const memory of book.memories) {
            await this.createMemory(userId, chronicleResult.id, {
              title: memory.title,
              content: memory.content,
              date: memory.date,
              emotion: memory.emotion,
              originalCreatedAt: memory.createdAt
            });
          }
        }
      }

      console.log('✅ Data migration completed successfully');
      return { success: true, message: 'Data migrated successfully' };
    } catch (error) {
      console.error('❌ Error during data migration:', error);
      return { success: false, error: error.message };
    }
  }

  // Backup data
  async backupUserData(userId) {
    try {
      const user = await this.getUser(userId);
      const chronicles = await this.getChronicles(userId);

      const backup = {
        user: user.data,
        chronicles: [],
        exportedAt: new Date().toISOString()
      };

      if (chronicles.success) {
        for (const chronicle of chronicles.data) {
          const memories = await this.getMemories(userId, chronicle.id);
          backup.chronicles.push({
            ...chronicle,
            memories: memories.success ? memories.data : []
          });
        }
      }

      return { success: true, data: backup };
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a singleton instance
export const dbManager = new DatabaseManager();
export default DatabaseManager;