import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getApp } from 'firebase/app'

export async function isSuperAdmin(): Promise<boolean> {
  try {
    const user = getAuth().currentUser
    if (!user) return false

    // Use getApp() with explicit database ID
    const db = getFirestore(getApp(), 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a')

    const snap = await getDoc(
      doc(db, 'admins', user.uid)
    )

    return snap.exists() &&
      snap.data()?.role === 'super_admin'

  } catch (err) {
    console.warn('Admin check failed:', err)
    return false
  }
}
