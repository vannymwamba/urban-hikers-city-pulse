import {
  GoogleAuthProvider, OAuthProvider, linkWithPopup, signInWithPopup,
  EmailAuthProvider, linkWithCredential,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';
import { getVisitorProfile, mergeVisitorProfiles } from './visitorProfile';

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
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? '',
    session_uuid: sessionId,
    linked_session_uuid: sessionId,
  }, { merge: true });
  return profile;
}

// Google: link the anonymous account in place (keeps UID). Falls back to a
// normal sign-in only if that Google account already exists elsewhere.
export async function upgradeWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  let user;
  if (auth.currentUser?.isAnonymous) {
    const anonUid = auth.currentUser.uid;
    try {
      user = (await linkWithPopup(auth.currentUser, provider)).user;
    } catch (e: any) {
      if (['auth/credential-already-in-use','auth/email-already-in-use','auth/provider-already-linked'].includes(e.code)) {
        // Read anonymous visitor profile BEFORE signing into existing account
        const anonProfile = await getVisitorProfile(anonUid);
        user = (await signInWithPopup(auth, provider)).user;
        if (anonProfile && user.uid !== anonUid) {
          await mergeVisitorProfiles(anonProfile, user.uid);
        }
      } else throw e;
    }
  } else {
    user = (await signInWithPopup(auth, provider)).user;
  }
  return upsertHiker(user);
}

// Apple: link the anonymous account in place or sign in and merge
export async function upgradeWithApple(): Promise<UserProfile> {
  const provider = new OAuthProvider('apple.com');
  let user;
  if (auth.currentUser?.isAnonymous) {
    const anonUid = auth.currentUser.uid;
    try {
      user = (await linkWithPopup(auth.currentUser, provider)).user;
    } catch (e: any) {
      if (['auth/credential-already-in-use','auth/email-already-in-use','auth/provider-already-linked'].includes(e.code)) {
        const anonProfile = await getVisitorProfile(anonUid);
        user = (await signInWithPopup(auth, provider)).user;
        if (anonProfile && user.uid !== anonUid) {
          await mergeVisitorProfiles(anonProfile, user.uid);
        }
      } else throw e;
    }
  } else {
    user = (await signInWithPopup(auth, provider)).user;
  }
  return upsertHiker(user);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// Link email & password to current anonymous user, or sign in & merge if account already exists
export async function linkEmailWithPassword(email: string, password: string): Promise<UserProfile> {
  const currentUser = auth.currentUser;
  let user: any = currentUser;

  if (!currentUser) {
    try {
      const signInResult = await signInWithEmailAndPassword(auth, email, password);
      user = signInResult.user;
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        const createResult = await createUserWithEmailAndPassword(auth, email, password);
        user = createResult.user;
      } else {
        throw e;
      }
    }
    // Update visitor_profiles email
    try {
      await setDoc(doc(db, 'visitor_profiles', user.uid), { email }, { merge: true });
    } catch (err) {
      console.warn('Could not update email in visitor_profiles:', err);
    }
    return upsertHiker(user);
  }

  const anonUid = currentUser.uid;
  const cred = EmailAuthProvider.credential(email, password);

  if (currentUser.isAnonymous) {
    try {
      const linkResult = await linkWithCredential(currentUser, cred);
      user = linkResult.user;
    } catch (e: any) {
      if (['auth/credential-already-in-use', 'auth/email-already-in-use', 'auth/provider-already-linked'].includes(e.code)) {
        // Read anonymous profile before signing into existing user
        const anonProfile = await getVisitorProfile(anonUid);
        const signInResult = await signInWithEmailAndPassword(auth, email, password);
        user = signInResult.user;
        if (anonProfile && user.uid !== anonUid) {
          await mergeVisitorProfiles(anonProfile, user.uid);
        }
      } else {
        throw e;
      }
    }
  } else {
    try {
      const linkResult = await linkWithCredential(currentUser, cred);
      user = linkResult.user;
    } catch (e: any) {
      if (['auth/credential-already-in-use', 'auth/email-already-in-use'].includes(e.code)) {
        const signInResult = await signInWithEmailAndPassword(auth, email, password);
        user = signInResult.user;
      } else {
        throw e;
      }
    }
  }

  // Update visitor_profiles email
  try {
    await setDoc(doc(db, 'visitor_profiles', user.uid), { email }, { merge: true });
  } catch (err) {
    console.warn('Could not update email in visitor_profiles:', err);
  }

  return upsertHiker(user);
}

// Passwordless email: send the keep-link now; UID is preserved on return.
export async function sendKeepLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth, email, { url: window.location.href, handleCodeInApp: true });
  localStorage.setItem(EMAIL_KEY, email);
  if (auth.currentUser?.uid) {
    try {
      await setDoc(doc(db, 'visitor_profiles', auth.currentUser.uid), { email }, { merge: true });
    } catch (err) {
      console.warn('Could not update email in visitor_profiles on send link:', err);
    }
  }
}

// Run once on app load. If the user arrived via a keep-link, complete it,
// linking to the existing anonymous UID when possible.
export async function completeEmailLinkIfPresent(): Promise<UserProfile | null> {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  const email = localStorage.getItem(EMAIL_KEY) || window.prompt('Confirm your email to keep your night') || '';
  if (!email) return null;
  let user;
  if (auth.currentUser?.isAnonymous) {
    const anonUid = auth.currentUser.uid;
    try {
      const cred = EmailAuthProvider.credentialWithLink(email, window.location.href);
      user = (await linkWithCredential(auth.currentUser, cred)).user;
    } catch {
      // Credential already in use: read anonymous profile BEFORE signing in
      const anonProfile = await getVisitorProfile(anonUid);
      user = (await signInWithEmailLink(auth, email, window.location.href)).user;
      if (anonProfile && user.uid !== anonUid) {
        await mergeVisitorProfiles(anonProfile, user.uid);
      }
    }
  } else {
    user = (await signInWithEmailLink(auth, email, window.location.href)).user;
  }
  localStorage.removeItem(EMAIL_KEY);
  return upsertHiker(user);
}
