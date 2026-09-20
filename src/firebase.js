import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyDnhBOiA2daTnPlgS4CB-rCk6JxmaKL4DI',
  authDomain: 'tinta-club-82098.firebaseapp.com',
  projectId: 'tinta-club-82098',
  storageBucket: 'tinta-club-82098.firebasestorage.app',
  messagingSenderId: '673665305398',
  appId: '1:673665305398:web:3fd3f9fa646557d7cd0197',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
