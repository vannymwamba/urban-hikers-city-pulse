import {
  GoogleAuthProvider, linkWithPopup, signInWithPopup,
  EmailAuthProvider, linkWithCredential,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

const EMAIL_KEY = 'uh_keep_email';

async function upsertHiker(user: any): Promise<UserProfile> {
  const sessionId = localStorage.getItem('uh_session_id') || 'session_fallback';
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as UserProfile;
    await updateDoc(ref, {
      uid: user.uid, email: user.email ?? data.email,
      session_uuid: sessionId, linked_session_uuid: sessionId,
    });
    return { ...data, uid: user.uid, email: user.email ?? data.email };
  }
  const profile: UserProfile = {
    uid: user.uid, email: user.email ?? '', role: 'hiker',
    session_uuid: sessionId, linked_session_uuid: sessionId,
  };
  await setDoc(ref, profile, { merge: true });
  return profile;
}

// Google: link the anonymous account in place (keeps UID). Falls back to a
// normal sign-in only if that Google account already exists elsewhere.
export async function upgradeWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  let user;
  if (auth.currentUser?.isAnonymous) {
    try {
      user = (await linkWithPopup(auth.currentUser, provider)).user;
    } catch (e: any) {
      if (['auth/credential-already-in-use','auth/email-already-in-use','auth/provider-already-linked'].includes(e.code)) {
        user = (await signInWithPopup(auth, provider)).user;
      } else throw e;
    }
  } else {
    user = (await signInWithPopup(auth, provider)).user;
  }
  return upsertHiker(user);
}

// Passwordless email: send the keep-link now; UID is preserved on return.
export async function sendKeepLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, { url: window.location.href, handleCodeInApp: true });
  localStorage.setItem(EMAIL_KEY, email);
}

// Run once on app load. If the user arrived via a keep-link, complete it,
// linking to the existing anonymous UID when possible.
export async function completeEmailLinkIfPresent(): Promise<UserProfile | null> {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  const email = localStorage.getItem(EMAIL_KEY) || window.prompt('Confirm your email to keep your night') || '';
  if (!email) return null;
  let user;
  if (auth.currentUser?.isAnonymous) {
    try {
      const cred = EmailAuthProvider.credentialWithLink(email, window.location.href);
      user = (await linkWithCredential(auth.currentUser, cred)).user;
    } catch {
      user = (await signInWithEmailLink(auth, email, window.location.href)).user;
    }
  } else {
    user = (await signInWithEmailLink(auth, email, window.location.href)).user;
  }
  localStorage.removeItem(EMAIL_KEY);
  return upsertHiker(user);
}
