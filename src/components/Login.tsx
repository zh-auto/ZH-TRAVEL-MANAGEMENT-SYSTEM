/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Mail, Lock, ShieldAlert, LogIn, LogOut, User, Eye, EyeOff, MapPin, Building, HelpCircle, X, Phone, CheckCircle2, ShieldCheck, Key, Zap, Terminal, Code, Sparkles, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthUser } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp, addDoc, onSnapshot } from 'firebase/firestore';
import DeveloperWelcomeSplash from './developer/DeveloperWelcomeSplash';
import { ZH_OFFICIAL_LOGO } from '../assets/logo';

interface LoginProps {
  onLoginSuccess: (user: AuthUser) => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
  sessionTerminatedNotice?: string;
  onClearSessionTerminatedNotice?: () => void;
  globalLogo?: string;
}

const LogoZH = ({
  className = 'w-16 h-16 sm:w-20 sm:h-20 mb-3',
  logoSrc,
}: {
  className?: string;
  logoSrc?: string;
}) => (
  <div className={`flex items-center justify-center ${className} select-none relative`}>
    <div className="w-full h-full p-1.5 rounded-xl bg-white border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.25)] flex items-center justify-center overflow-hidden">
      <img
        src={logoSrc || ZH_OFFICIAL_LOGO}
        alt="ZH Official Brand Logo"
        className="w-full h-full object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = ZH_OFFICIAL_LOGO;
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  </div>
);

export default function Login({
  onLoginSuccess,
  currentUser,
  onLogout,
  sessionTerminatedNotice,
  onClearSessionTerminatedNotice,
  globalLogo,
}: LoginProps) {
  // Authentication mode: 'login' | 'register' | 'developer'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'developer'>('login');
  const [currentLogo, setCurrentLogo] = useState<string>(globalLogo || ZH_OFFICIAL_LOGO);

  // Dynamic real-time listener for global system brand logo from Firebase
  useEffect(() => {
    if (globalLogo) {
      setCurrentLogo(globalLogo);
    }
    const unsub = onSnapshot(
      doc(db, 'settings', 'developer_system_config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.appLogo && typeof data.appLogo === 'string' && data.appLogo.trim()) {
            setCurrentLogo(data.appLogo);
          } else {
            setCurrentLogo(ZH_OFFICIAL_LOGO);
          }
        }
      },
      (err) => {
        console.warn('Login logo listener note:', err);
      }
    );
    return () => unsub();
  }, [globalLogo]);

  // Common states
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Agency Login inputs
  const [agencyCodeInput, setAgencyCodeInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Developer Login inputs
  const [developerCodeInput, setDeveloperCodeInput] = useState('');
  const [developerEmail, setDeveloperEmail] = useState('');
  const [developerPassword, setDeveloperPassword] = useState('');
  const [showDeveloperPassword, setShowDeveloperPassword] = useState(false);

  // Register inputs
  const [agencyName, setAgencyName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [agencyLocation, setAgencyLocation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Email verification view states
  const [isVerifying, setIsVerifying] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  // Modals state
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Developer Login Success Animated Transition (approx. 3 seconds)
  const [developerSuccessData, setDeveloperSuccessData] = useState<AuthUser | null>(null);

  // Persistence of pending verification state from sessionStorage on mount
  useEffect(() => {
    const raw = sessionStorage.getItem('pending_agency_reg');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email) {
          setIsVerifying(true);
          setAgencyName(parsed.agencyName || '');
          setAdminName(parsed.adminName || '');
          setAgencyLocation(parsed.agencyLocation || '');
          setEmail(parsed.email || '');
        }
      } catch (e) {
        console.error('Failed to parse pending agency registration from session storage', e);
      }
    }
  }, []);

  /**
   * Password strength check algorithm
   */
  const checkPasswordStrength = (pwd: string) => {
    const hasMinLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
    
    let score = 0;
    if (pwd.length > 0) {
      if (hasMinLength) score++;
      if (hasUpper) score++;
      if (hasLower) score++;
      if (hasNumber) score++;
      if (hasSpecial) score++;
    }
    
    return {
      score,
      hasMinLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
    };
  };

  /**
   * Authentication forms submit trigger
   */
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // MODE 1: DEVELOPER LOGIN (Email + Developer Code / Password)
    if (authMode === 'developer') {
      onClearSessionTerminatedNotice?.();
      const inputEmail = developerEmail.trim().toLowerCase();
      const inputCode = developerCodeInput.trim();
      const inputPassword = developerPassword.trim();

      if (!inputEmail) {
        setError('Please enter your Developer Email.');
        return;
      }

      const passwordToUse = inputPassword || inputCode;
      if (!passwordToUse) {
        setError('Please enter your Developer Code or Password.');
        return;
      }

      setLoading(true);
      try {
        // 0. Fetch Developer Configuration from Firestore (settings/developer_system_config)
        let configDevEmail = '';
        let configDevCode = '';
        try {
          const configSnap = await getDoc(doc(db, 'settings', 'developer_system_config'));
          if (configSnap.exists()) {
            const cfg = configSnap.data();
            if (cfg.developerEmail) configDevEmail = cfg.developerEmail.trim().toLowerCase();
            if (cfg.developerCode) configDevCode = cfg.developerCode.trim();
          }
        } catch (e) {
          console.warn('Developer config fetch note:', e);
        }

        const normalizedInputEmail = inputEmail.trim().toLowerCase();
        const trimmedInputCode = inputCode.trim();

        // Generate a new unique developer session ID for single-device developer enforcement
        const newDevSessionId = `sess_dev_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
        try {
          sessionStorage.setItem('is_developer_logging_in', 'true');
          sessionStorage.setItem('pending_dev_session_id', newDevSessionId);
        } catch (e) {}

        // 1. Establish Firebase Auth session
        let user = auth.currentUser;
        if (!user || user.email?.toLowerCase() !== normalizedInputEmail) {
          try {
            const cred = await signInWithEmailAndPassword(auth, normalizedInputEmail, passwordToUse);
            user = cred.user;
          } catch (authErr: any) {
            console.error('Firebase Auth sign in failed:', authErr);
            sessionStorage.removeItem('is_developer_logging_in');
            sessionStorage.removeItem('pending_dev_session_id');
            const errCode = authErr?.code || '';
            if (errCode === 'auth/user-not-found' || errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
              setError('Invalid developer credentials.');
            } else if (errCode === 'auth/too-many-requests') {
              setError('Access temporarily disabled due to many failed attempts. Please try again later.');
            } else if (errCode === 'auth/network-request-failed') {
              setError('Network connection error. Please check your internet connection.');
            } else {
              setError(authErr?.message || 'Invalid developer credentials.');
            }
            setLoading(false);
            return;
          }
        }

        const devUid = user?.uid;
        if (!devUid) {
          sessionStorage.removeItem('is_developer_logging_in');
          sessionStorage.removeItem('pending_dev_session_id');
          setError('Failed to resolve authenticated developer identity.');
          setLoading(false);
          return;
        }

        // Save developer session to separate developer storage key
        try {
          localStorage.setItem(`counterpro_developer_session_${devUid}`, newDevSessionId);
          localStorage.setItem(`counterpro_session_${devUid}`, newDevSessionId);
        } catch (e) {}

        // 2. Fetch existing user document to verify server-side Developer status and Developer Code
        const userRef = doc(db, 'users', devUid);
        let devUserData: Record<string, any> = {};
        try {
          const userSnap = await getDoc(userRef);
          devUserData = userSnap.exists() ? userSnap.data() : {};
        } catch (e) {
          console.warn('Could not read user doc:', e);
        }

        // 3. Verify server-side developer authorization
        const isAuthorizedEmail =
          (configDevEmail && normalizedInputEmail === configDevEmail) ||
          normalizedInputEmail === 'zihanalam.at@gmail.com' ||
          devUserData.role === 'developer' ||
          devUserData.role === 'admin';

        const isCodeMatch =
          !configDevCode ||
          trimmedInputCode === configDevCode ||
          devUserData.agencyCode === trimmedInputCode ||
          devUserData.management?.agencyCode === trimmedInputCode;

        if (!isAuthorizedEmail || !isCodeMatch) {
          sessionStorage.removeItem('is_developer_logging_in');
          sessionStorage.removeItem('pending_dev_session_id');
          localStorage.removeItem(`counterpro_developer_session_${devUid}`);
          await signOut(auth).catch(() => {});
          setError('Invalid developer credentials. Account is not authorized as Developer.');
          setLoading(false);
          return;
        }

        const resolvedName = devUserData.name || devUserData.displayName || devUserData.information?.adminName || 'System Developer';

        // 4. Update developer session & profile in Firestore
        const updatedDoc = {
          role: 'developer',
          status: 'Active',
          accountStatus: true,
          isApproved: true,
          agencyCode: trimmedInputCode || devUserData.agencyCode || '',
          email: normalizedInputEmail,
          activeDevSessionId: newDevSessionId,
          activeSessionId: newDevSessionId,
          lastLogin: serverTimestamp(),
          lastActivity: serverTimestamp(),
          lastSessionAt: serverTimestamp(),
          'management.accountStatus': true,
          'management.agencyCode': trimmedInputCode || devUserData.agencyCode || '',
          'management.userName': resolvedName,
          'management.lastLogin': serverTimestamp(),
        };

        try {
          await setDoc(userRef, updatedDoc, { merge: true });
        } catch (e) {
          console.warn('Developer doc update note:', e);
        }

        // Record Developer Login in Activity Logs in Firestore
        try {
          await addDoc(collection(db, 'activity_logs'), {
            type: 'LOGIN',
            action: 'DEVELOPER_LOGIN',
            targetAgency: 'System Governance',
            targetEmail: normalizedInputEmail,
            targetUserId: devUid,
            performedBy: normalizedInputEmail,
            performedByRole: 'developer',
            details: `Developer accessed the Developer Control Panel`,
            timestamp: serverTimestamp(),
          });
        } catch (logErr) {
          console.warn('Developer login activity log notice:', logErr);
        }

        const devUserObj: AuthUser = {
          uid: devUid,
          email: normalizedInputEmail,
          displayName: resolvedName,
          name: resolvedName,
          loginId: trimmedInputCode || devUserData.agencyCode || '',
          agencyCode: trimmedInputCode || devUserData.agencyCode || '',
          agencyName: devUserData.information?.agencyName || 'Developer Panel',
          agencyLocation: devUserData.information?.agencyLocation || 'System Control',
          photoURL: user?.photoURL || null,
          role: 'developer',
          isApproved: true,
          memberIdAssigned: true,
          createdAt: devUserData.createdAt || serverTimestamp(),
          status: 'Active',
          accountStatus: true,
          activeSessionId: newDevSessionId,
          activeDevSessionId: newDevSessionId,
          information: {
            agencyName: devUserData.information?.agencyName || 'Developer Panel',
            adminName: resolvedName,
            email: normalizedInputEmail,
            agencyLocation: devUserData.information?.agencyLocation || 'HQ',
          },
          management: {
            agencyCode: trimmedInputCode || devUserData.agencyCode || '',
            accountStatus: 'Active',
            userName: resolvedName,
            activatedAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          },
        };

        // Clean up transient pending flags
        sessionStorage.removeItem('is_developer_logging_in');
        sessionStorage.removeItem('pending_dev_session_id');

        // Trigger professional animated typography transition (~3 seconds) before opening Developer Panel
        sessionStorage.setItem('trigger_dev_splash', 'true');
        onLoginSuccess(devUserObj);
      } catch (err: any) {
        console.error('Developer login error:', err);
        const code = err?.code || '';
        const msg = err?.message || '';

        if (code === 'auth/network-request-failed' || msg.includes('network-request-failed') || msg.includes('network')) {
          setError('Network connection error. Please check your internet connection and try again. (ইন্টারনেট কানেকশন সমস্যা। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।)');
        } else if (code === 'auth/too-many-requests') {
          setError('Access temporarily disabled due to many failed attempts. Please try again later.');
        } else {
          // Unified generic professional error to not reveal which credential was incorrect
          setError('Invalid developer credentials.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // MODE 2: AGENCY REGISTRATION
    if (authMode === 'register') {
      // 1. Validations
      if (!agencyName.trim() || !adminName.trim() || !agencyLocation.trim() || !email.trim() || !password || !confirmPassword) {
        setError('Please fill in all fields (অনুগ্রহ করে সব তথ্য পূরণ করুন)');
        return;
      }

      if (password !== confirmPassword) {
        setError('Confirm Password must match the password. (পাসওয়ার্ড দুটি মেলেনি।)');
        return;
      }

      const strength = checkPasswordStrength(password);
      if (!strength.hasMinLength) {
        setError('Password must be at least 8 characters. (পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।)');
        return;
      }
      if (!strength.hasUpper || !strength.hasLower || !strength.hasNumber || !strength.hasSpecial) {
        setError('Password must include uppercase, lowercase, number and special character. (পাসওয়ার্ডে অবশ্যই বড় ও ছোট হাতের অক্ষর, সংখ্যা এবং বিশেষ চিহ্ন থাকতে হবে।)');
        return;
      }

      setLoading(true);
      sessionStorage.setItem('is_registering', 'true');

      try {
        // 2. Create standard Firebase Authentication user
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = cred.user;

        // 3. Trigger Firebase Email verification
        await sendEmailVerification(user);

        // Save pending data in session storage to write into Firestore after verification
        const pendingData = {
          agencyName: agencyName.trim(),
          adminName: adminName.trim(),
          agencyLocation: agencyLocation.trim(),
          email: email.trim(),
          uid: user.uid,
        };
        sessionStorage.setItem('pending_agency_reg', JSON.stringify(pendingData));
        
        setIsVerifying(true);
        setSuccessMessage('Registration request accepted! A verification link has been sent to your Email address. (নিবন্ধন অনুরোধ গৃহীত হয়েছে! আপনার জিমেইলে একটি ভেরিফিকেশন লিংক পাঠানো হয়েছে।)');
      } catch (err: any) {
        console.error('Firebase Auth Create Error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setError('This email address is already registered. (এই ইমেইল এড্রেসটি ইতিমধ্যে নিবন্ধন করা হয়েছে।)');
        } else if (err.code === 'auth/invalid-email') {
          setError('Please enter a valid email address. (অনুগ্রহ করে একটি সঠিক ইমেইল এড্রেস লিখুন।)');
        } else {
          setError(err.message || 'Registration failed (নিবন্ধন ব্যর্থ হয়েছে)');
        }
      } finally {
        setLoading(false);
        sessionStorage.removeItem('is_registering');
      }
      return;
    }

    // MODE 3: AGENCY LOGIN
    if (authMode === 'login') {
      onClearSessionTerminatedNotice?.();
      if (!agencyCodeInput.trim() || !loginPassword) {
        setError('Please enter both Agency Code and Password. (এজেন্সি কোড এবং পাসওয়ার্ড পূরণ করুন)');
        return;
      }

      setLoading(true);

      try {
        // 1. Search users collection where agencyCode matches the input (or loginId or management.agencyCode)
        const usersRef = collection(db, 'users');
        let q = query(usersRef, where('agencyCode', '==', agencyCodeInput.trim()));
        let querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          const qMgmt = query(usersRef, where('management.agencyCode', '==', agencyCodeInput.trim()));
          querySnapshot = await getDocs(qMgmt);
        }

        if (querySnapshot.empty) {
          const qFallback = query(usersRef, where('loginId', '==', agencyCodeInput.trim()));
          querySnapshot = await getDocs(qFallback);
        }

        // 2. Error if Agency Code not found
        if (querySnapshot.empty) {
          setError('Invalid Agency Code (ভুল এজেন্সি কোড)');
          setLoading(false);
          return;
        }

        // 3. Inspect user status and management fields (Support Boolean accountStatus: true = Active, false = Suspended)
        const docSnap = querySnapshot.docs[0];
        const userData = docSnap.data();
        
        // Priority to management.accountStatus boolean, fallback to accountStatus, status, or isApproved
        const mgmtStatus = userData.management?.accountStatus;
        const topStatus = userData.accountStatus;
        const stringStatus = userData.status;
        
        const isAccountSuspended = 
          mgmtStatus === false || 
          topStatus === false || 
          mgmtStatus === 'Suspended' || 
          mgmtStatus === 'DEACTIVE' || 
          mgmtStatus === 'blocked' || 
          stringStatus === 'Suspended' || 
          stringStatus === 'DEACTIVE' || 
          stringStatus === 'blocked';

        if (isAccountSuspended) {
          setError('আপনার অ্যাকাউন্টটি সাসপেন্ড করা হয়েছে, দয়া করে ডেভেলপারের সাথে যোগাযোগ করুন। (Your account has been suspended, please contact the developer.)');
          setLoading(false);
          return;
        }

        const isAccountActive = 
          mgmtStatus === true || 
          topStatus === true || 
          mgmtStatus === 'Active' || 
          stringStatus === 'Active' || 
          userData.isApproved === true;

        if (!isAccountActive && (mgmtStatus === 'Pending' || stringStatus === 'Pending' || stringStatus === 'pending')) {
          setError('আপনার অ্যাকাউন্টটি অনুমোদনের জন্য অপেক্ষমাণ রয়েছে। (Your account is waiting for developer approval.)');
          setLoading(false);
          return;
        }

        // 4. Authenticate in Firebase Auth using registered email
        const userEmail = userData.information?.email || userData.email;
        const newSessionId = `sess_usr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
        try {
          sessionStorage.setItem('is_user_logging_in', 'true');
          sessionStorage.setItem('pending_user_session_id', newSessionId);
        } catch (e) {}

        const cred = await signInWithEmailAndPassword(auth, userEmail, loginPassword);
        const user = cred.user;

        // Store user-specific session ID in separate user storage key
        try {
          localStorage.setItem(`counterpro_user_session_${user.uid}`, newSessionId);
          localStorage.setItem(`counterpro_session_${user.uid}`, newSessionId);
        } catch (e) {}

        // 5. Success callback
        const resolvedName = userData.information?.agencyName || userData.agencyName || userData.name || userData.displayName || userEmail.split('@')[0];
        const assignedCode = userData.management?.agencyCode || userData.agencyCode || userData.loginId || '';
        const userObj: AuthUser = {
          uid: user.uid,
          email: userEmail,
          displayName: resolvedName,
          name: resolvedName,
          loginId: assignedCode,
          agencyCode: assignedCode,
          agencyName: userData.information?.agencyName || userData.agencyName || '',
          agencyLocation: userData.information?.agencyLocation || userData.agencyLocation || '',
          photoURL: userData.photoURL || null,
          role: userData.role || 'agency',
          isApproved: isAccountActive,
          memberIdAssigned: !!assignedCode,
          createdAt: userData.createdAt,
          status: isAccountActive ? 'Active' : (isAccountSuspended ? 'Suspended' : 'Pending'),
          accountStatus: isAccountActive,
          activeSessionId: newSessionId,
          information: userData.information,
          management: userData.management,
        };

        // Update activeSessionId, lastLogin and lastActivity on login success
        await setDoc(doc(db, 'users', user.uid), {
          activeSessionId: newSessionId,
          lastLogin: serverTimestamp(),
          lastActivity: serverTimestamp(),
          lastSessionAt: serverTimestamp(),
          'management.lastLogin': serverTimestamp(),
        }, { merge: true });

        // Record User Login in Activity Logs in Firestore
        try {
          await addDoc(collection(db, 'activity_logs'), {
            type: 'LOGIN',
            action: 'USER_LOGIN',
            targetAgency: resolvedName,
            targetEmail: userEmail,
            targetUserId: user.uid,
            performedBy: userEmail,
            performedByRole: 'agency',
            details: `Agency user logged in: ${resolvedName} (Agency Code: ${assignedCode})`,
            timestamp: serverTimestamp(),
          });
        } catch (logErr) {
          console.warn('User login activity log notice:', logErr);
        }

        sessionStorage.removeItem('is_user_logging_in');
        sessionStorage.removeItem('pending_user_session_id');

        onLoginSuccess(userObj);
      } catch (err: any) {
        sessionStorage.removeItem('is_user_logging_in');
        sessionStorage.removeItem('pending_user_session_id');
        console.error('Login error:', err);
        const code = err.code || '';
        const msg = err.message || '';

        if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setError('Incorrect Password (ভুল পাসওয়ার্ড)');
        } else if (code === 'auth/user-not-found') {
          setError('Authentication account not found. (অ্যাকাউন্ট পাওয়া যায়নি।)');
        } else if (code === 'auth/network-request-failed' || msg.includes('network-request-failed') || msg.includes('network')) {
          setError('Network connection error. Please check your internet connection and try again. (ইন্টারনেট কানেকশন সমস্যা। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।)');
        } else if (code === 'auth/too-many-requests') {
          setError('Too many failed attempts. Please try again later. (অতিরিক্ত বার ভুল চেষ্টার কারণে সাময়িকভাবে বন্ধ করা হয়েছে।)');
        } else {
          setError(msg || 'Login failed. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  /**
   * Run verification check of currently logged in user
   */
  const handleCheckVerification = async () => {
    setError('');
    setCheckingVerification(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError('No active session found. Please try registering again. (সেশন পাওয়া যায়নি। অনুগ্রহ করে আবার নিবন্ধন করুন।)');
        setCheckingVerification(false);
        return;
      }

      // Reload auth state to fetch verified boolean updates
      await user.reload();

      if (user.emailVerified) {
        // Double check pending data is present
        const raw = sessionStorage.getItem('pending_agency_reg');
        if (!raw) {
          setError('Registration data missing from cache. (নিবন্ধন তথ্য ক্যাশে পাওয়া যায়নি।)');
          setCheckingVerification(false);
          return;
        }

        const parsed = JSON.parse(raw);

        // Create the agency document in Firestore with information and management objects
        const userDocRef = doc(db, 'users', user.uid);
        const newAgencyName = parsed.agencyName || '';
        const newAdminName = parsed.adminName || '';
        const newEmail = parsed.email || user.email || '';
        const newLoc = parsed.agencyLocation || '';

        await setDoc(userDocRef, {
          agencyName: newAgencyName,
          adminName: newAdminName,
          agencyLocation: newLoc,
          email: newEmail,
          agencyCode: "",
          role: "agency",
          status: "Pending",
          information: {
            agencyName: newAgencyName,
            adminName: newAdminName,
            email: newEmail,
            agencyLocation: newLoc,
            registeredAt: serverTimestamp(),
          },
          management: {
            agencyCode: "",
            accountStatus: "Pending",
            userName: newAdminName || newAgencyName,
            activatedAt: null,
            lastLogin: serverTimestamp(),
            expiresAt: null,
          },
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          lastActivity: serverTimestamp(),
        });

        // Record User Registration in Activity Logs in Firestore
        try {
          await addDoc(collection(db, 'activity_logs'), {
            type: 'REGISTRATION',
            action: 'USER_REGISTRATION',
            targetAgency: newAgencyName,
            targetEmail: newEmail,
            targetUserId: user.uid,
            performedBy: newEmail,
            performedByRole: 'agency',
            details: `New agency account registered: ${newAgencyName} (Admin: ${newAdminName}, Location: ${newLoc})`,
            timestamp: serverTimestamp(),
          });
        } catch (logErr) {
          console.warn('Registration activity log notice:', logErr);
        }

        // Create Real-time Developer Notification for New User Registration
        try {
          await addDoc(collection(db, 'developer_notifications'), {
            type: 'NEW_REGISTRATION',
            title: `New Registration: ${newAgencyName}`,
            agencyName: newAgencyName,
            adminName: newAdminName,
            email: newEmail,
            agencyLocation: newLoc,
            userId: user.uid,
            accountStatus: 'Pending',
            agencyCodeAssigned: false,
            agencyCode: '',
            registeredAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            read: false,
            readAt: null,
          });
        } catch (notifErr) {
          console.warn('Developer notification creation notice:', notifErr);
        }

        // Registration complete! Clear cache
        sessionStorage.removeItem('pending_agency_reg');

        // Immediately logout as they must wait for the developer to assign an Agency Code
        await signOut(auth);

        setSuccessMessage('Email successfully verified! Your registration is complete. Your account is now pending developer approval with your Agency Code. (ইমেইল সফলভাবে ভেরিফাই করা হয়েছে! আপনার নিবন্ধন সম্পন্ন হয়েছে। ডেভেলপারের কাছ থেকে আপনার Agency Code পাওয়ার পর আপনি লগইন করতে পারবেন।)');
        setIsVerifying(false);
        setAuthMode('login');
        setAgencyName('');
        setAdminName('');
        setAgencyLocation('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError('Your email is not verified yet. Please check your inbox and click the verification link. (ইমেইল এখনো ভেরিফাই করা হয়নি। অনুগ্রহ করে ইনবক্স চেক করে লিংকে ক্লিক করুন।)');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Error occurred during verification check.');
    } finally {
      setCheckingVerification(false);
    }
  };

  /**
   * Resend Firebase Verification Link
   */
  const handleResendEmail = async () => {
    setError('');
    setSuccessMessage('');
    try {
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        setSuccessMessage('Verification link resent successfully! (ভেরিফিকেশন লিংক পুনরায় পাঠানো হয়েছে!)');
      } else {
        setError('Session expired. Please register again. (সেশন শেষ হয়েছে, অনুগ্রহ করে পুনরায় নিবন্ধন করুন।)');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend email');
    }
  };

  /**
   * Cancel and clear current registration sequence
   */
  const handleCancelVerification = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      sessionStorage.removeItem('pending_agency_reg');
      setIsVerifying(false);
      setError('');
      setSuccessMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-[#0B0F14] relative">
      {/* Professional Animated Typography Screen on Developer Login Success (3-second transition) */}
      <AnimatePresence>
        {developerSuccessData && (
          <DeveloperWelcomeSplash
            user={developerSuccessData}
            onComplete={() => onLoginSuccess(developerSuccessData)}
          />
        )}
      </AnimatePresence>

      <div className="w-full max-w-md p-8 bg-[#11161D] border border-[#252F3D] rounded-2xl shadow-2xl relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute top-[-50%] right-[-50%] w-96 h-96 rounded-full bg-radial from-[rgba(16,185,129,0.12)] to-transparent pointer-events-none" />

        <div className="flex flex-col items-center mb-5 text-center relative z-10">
          <LogoZH logoSrc={currentLogo} />
          <h1
            id="login-portal-title"
            style={{ color: '#FFFFFF' }}
            className="login-portal-title text-xl font-extrabold tracking-tight text-white !text-white font-display uppercase"
          >
            {authMode === 'developer' ? 'DEVELOPER ACCESS' : 'TRAVEL AGENCY PORTAL'}
          </h1>
          <p className="mt-1 text-xs text-[#9AA8B8]">
            {authMode === 'developer' ? 'Developer Authorization Control' : 'Premium Travel Agency Management System'}
          </p>
        </div>

        {/* 2-Option Segmented Tab Switcher (Login & Registration) */}
        {!currentUser && !isVerifying && authMode !== 'developer' && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#161D27] border border-[#252F3D] rounded-xl mb-5 relative z-10 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError('');
                setSuccessMessage('');
              }}
              className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                authMode === 'login'
                  ? 'bg-[#10B981] text-white shadow-md'
                  : 'text-[#9AA8B8] hover:text-[#E9EEF3] hover:bg-[#1E2736]/50'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setError('');
                setSuccessMessage('');
              }}
              className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                authMode === 'register'
                  ? 'bg-[#10B981] text-white shadow-md'
                  : 'text-[#9AA8B8] hover:text-[#E9EEF3] hover:bg-[#1E2736]/50'
              }`}
            >
              Registration
            </button>
          </div>
        )}

        {sessionTerminatedNotice && (
          <div className="flex items-start gap-2.5 p-3.5 mb-5 text-xs rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 leading-relaxed relative z-10 shadow-lg animate-in fade-in" id="session-terminated-alert">
            <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-rose-400" />
            <div className="flex-1">
              <div className="font-bold text-rose-200 mb-0.5 flex items-center gap-1.5">
                <span>Session Logged Out (সেশন সমাপ্ত)</span>
              </div>
              <p className="text-rose-200/90">{sessionTerminatedNotice}</p>
            </div>
            {onClearSessionTerminatedNotice && (
              <button
                type="button"
                onClick={onClearSessionTerminatedNotice}
                className="text-rose-400/60 hover:text-rose-200 transition-colors p-0.5 rounded cursor-pointer"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 mb-5 text-xs font-semibold rounded-lg bg-red-500/10 border border-red-500/20 text-[#EF4444] leading-relaxed relative z-10">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2 p-3 mb-5 text-xs font-semibold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[#10B981] leading-relaxed relative z-10" id="registration-success-banner">
            <div className="w-4 h-4 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] text-[10px] mt-0.5 flex-shrink-0 font-bold">✓</div>
            <span>{successMessage}</span>
          </div>
        )}

        {isVerifying ? (
          /* Email verification pending view */
          <div className="space-y-6 relative z-10 text-center">
            <div className="p-4 rounded-xl bg-[#161D27] border border-[#252F3D] space-y-4">
              <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#10B981] animate-bounce">
                <Mail size={24} />
              </div>
              <h3 className="text-sm font-extrabold text-[#E9EEF3]">Verify Your Email Address (ইমেইল ভেরিফিকেশন)</h3>
              <p className="text-xs text-[#9AA8B8] leading-relaxed">
                We have sent a verification email to <strong className="text-[#E9EEF3]">{email}</strong>. 
                Please open your Gmail, click the link to verify your email, then return here and click the check button below.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                disabled={checkingVerification}
                onClick={handleCheckVerification}
                className="w-full btn btn-primary flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all cursor-pointer"
              >
                {checkingVerification ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>I have Verified My Email (ভেরিফাই করেছি)</span>
                  </>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResendEmail}
                  className="w-1/2 btn btn-ghost py-2.5 rounded-xl text-xs font-semibold text-[#10B981]"
                >
                  Resend Verification
                </button>
                <button
                  type="button"
                  onClick={handleCancelVerification}
                  className="w-1/2 btn btn-danger-ghost py-2.5 rounded-xl text-xs font-semibold text-red-400"
                >
                  Cancel Registration
                </button>
              </div>
            </div>
          </div>
        ) : !currentUser ? (
          /* Standard Auth forms */
          <form onSubmit={handleAuthSubmit} className="space-y-4 relative z-10">
            {authMode === 'developer' ? (
              /* Dedicated Developer Login Interface */
              <>
                <div className="p-3.5 rounded-xl bg-[#161D27] border border-[#252F3D] text-xs text-[#9AA8B8] flex items-center gap-2.5 mb-2">
                  <ShieldCheck size={18} className="text-amber-400 flex-shrink-0" />
                  <span>Authorized developer authentication for system management.</span>
                </div>

                {/* Developer Email */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Developer Email
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="Enter developer email"
                      value={developerEmail}
                      onChange={(e) => setDeveloperEmail(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-4 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Developer Code */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Developer Code
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Key size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="Enter developer code"
                      value={developerCodeInput}
                      onChange={(e) => setDeveloperCodeInput(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-4 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>

                {/* Developer Password */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Developer Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Lock size={16} />
                    </span>
                    <input
                      type={showDeveloperPassword ? 'text' : 'password'}
                      placeholder="Enter developer password"
                      value={developerPassword}
                      onChange={(e) => setDeveloperPassword(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-10 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-amber-400"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowDeveloperPassword(!showDeveloperPassword)}
                      className="absolute right-3 top-3 text-[#5E6B7C] hover:text-[#9AA8B8] transition-colors p-1"
                    >
                      {showDeveloperPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Switch back link */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-xs text-[#9AA8B8] hover:text-[#E9EEF3] underline outline-none cursor-pointer transition-colors"
                  >
                    ← Back to Login
                  </button>
                </div>
              </>
            ) : authMode === 'register' ? (
              /* Agency Registration Fields */
              <>
                {/* Agency Name */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Agency Name (এজেন্সি নাম)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Building size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter agency name"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-4 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                  </div>
                </div>

                {/* Admin Name */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Admin Name (অ্যাডমিন নাম)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter admin name"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-4 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                  </div>
                </div>

                {/* Agency Location */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Agency Location (এজেন্সি ঠিকানা)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <MapPin size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter agency location"
                      value={agencyLocation}
                      onChange={(e) => setAgencyLocation(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-4 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Email Address (ইমেইল এড্রেস)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="Enter email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-4 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                  </div>
                </div>

                {/* Agency Password */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Agency Password (পাসওয়ার্ড)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Lock size={16} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-12 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#5E6B7C] hover:text-[#E9EEF3] transition-colors outline-none cursor-pointer focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Password strength meter */}
                  {password.length > 0 && (
                    <div className="mt-2.5 p-3 rounded-lg bg-[#161D27] border border-[#252F3D] space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-[#9AA8B8]">
                        <span>Password Strength:</span>
                        <span className={`font-extrabold ${
                          checkPasswordStrength(password).score <= 2 ? 'text-red-500' :
                          checkPasswordStrength(password).score <= 4 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {checkPasswordStrength(password).score <= 2 ? 'Weak (দুর্বল)' :
                           checkPasswordStrength(password).score <= 4 ? 'Medium (মাঝারি)' : 'Strong (শক্তিশালী)'}
                        </span>
                      </div>
                      <div className="flex gap-1 h-1.5 w-full bg-[#0B0F14] rounded-full overflow-hidden border border-[#252F3D]">
                        <div className={`h-full transition-all duration-300 rounded-full ${
                          checkPasswordStrength(password).score <= 2 ? 'bg-red-500' :
                          checkPasswordStrength(password).score <= 4 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${(checkPasswordStrength(password).score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Confirm Agency Password (পাসওয়ার্ড নিশ্চিত করুন)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Lock size={16} />
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-12 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-[#5E6B7C] hover:text-[#E9EEF3] transition-colors outline-none cursor-pointer focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Sub-links */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-xs text-[#10B981] hover:underline outline-none cursor-pointer"
                  >
                    Already registered? Sign In
                  </button>

                  <button
                    type="button"
                    onClick={() => setHelpModalOpen(true)}
                    className="flex items-center gap-1 text-xs text-[#9AA8B8] hover:text-[#E9EEF3] outline-none transition-colors"
                  >
                    <HelpCircle size={14} />
                    <span>How to Register?</span>
                  </button>
                </div>
              </>
            ) : (
              /* Agency Sign In Fields */
              <>
                {/* Agency Code */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-[#9AA8B8]">
                    Agency Code (এজেন্সি কোড)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Building size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter agency code"
                      value={agencyCodeInput}
                      onChange={(e) => setAgencyCodeInput(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-4 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-[#9AA8B8]">
                      Agency Password (পাসওয়ার্ড)
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-[#5E6B7C]">
                      <Lock size={16} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-[#161D27] border border-[#252F3D] rounded-xl py-3 pl-10 pr-12 text-sm text-[#E9EEF3] placeholder-[#5E6B7C] outline-none transition-all focus:border-[#10B981]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#5E6B7C] hover:text-[#E9EEF3] transition-colors outline-none cursor-pointer focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Sub-links */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                      setSuccessMessage('');
                    }}
                    className="text-xs text-[#10B981] hover:underline outline-none cursor-pointer"
                  >
                    Don't have an account? Register
                  </button>

                  <button
                    type="button"
                    onClick={() => setHelpModalOpen(true)}
                    className="flex items-center gap-1 text-xs text-[#9AA8B8] hover:text-[#E9EEF3] outline-none transition-colors"
                  >
                    <HelpCircle size={14} />
                    <span>How to Register?</span>
                  </button>
                </div>
              </>
            )}

            {/* Form submit button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2.5 py-3.5 mt-5 rounded-xl font-bold transition-all cursor-pointer relative shadow-lg ${
                authMode === 'developer'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'btn btn-primary'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {authMode === 'developer' ? (
                    <>
                      <ShieldCheck size={18} />
                      <span>Developer Login</span>
                    </>
                  ) : authMode === 'register' ? (
                    <>
                      <LogIn size={18} />
                      <span>Register Agency</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      <span>Login to Dashboard</span>
                    </>
                  )}
                </>
              )}
            </button>
          </form>
        ) : (
          /* Logged In screen (Safety catch) */
          <div className="text-center py-6 space-y-4 relative z-10">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] text-lg font-bold animate-pulse">
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#E9EEF3]">
                Signed In as {currentUser.displayName || currentUser.agencyName}
              </p>
              <p className="text-xs text-[#9AA8B8] font-mono mt-1">
                {currentUser.agencyCode || 'Agency Code Assigned'}
              </p>
              <p className="text-[11px] text-[#5E6B7C]">
                {currentUser.email}
              </p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full btn btn-danger-ghost flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all cursor-pointer"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        )}

        <div className="mt-7 text-center text-[10px] text-[#5E6B7C] leading-relaxed">
          <span>Security Notice: All sessions are securely audited via Firebase Modular Enterprise Identity Guard.</span>
        </div>

        {/* Small, subtle Developer Login link at bottom of authentication section */}
        {!currentUser && !isVerifying && authMode !== 'developer' && (
          <div className="mt-4 pt-3 border-t border-[#252F3D]/40 text-center">
            <button
              type="button"
              onClick={() => {
                setAuthMode('developer');
                setError('');
                setSuccessMessage('');
              }}
              className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer bg-transparent border-none outline-none font-normal"
            >
              Developer Login
            </button>
          </div>
        )}
      </div>

      {/* Registration Help Popup (Bangla, Dark Luxury theme) */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F14]/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 bg-[#11161D] border border-[#252F3D] rounded-2xl shadow-2xl relative overflow-y-auto max-h-[85vh] text-[#E9EEF3]">
            
            {/* Glow accent */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-radial from-[rgba(16,185,129,0.06)] to-transparent pointer-events-none" />

            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#252F3D]">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-[#10B981]" />
                <h2 className="text-base font-bold tracking-tight text-[#E9EEF3]">কীভাবে নিবন্ধন করবেন? (How to Register)</h2>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1.5 rounded-lg text-[#5E6B7C] hover:text-[#E9EEF3] hover:bg-[#161D27] transition-all"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-[#9AA8B8] leading-relaxed">
              <p className="font-semibold text-[#10B981]">অনুগ্রহ করে নিচে বর্ণিত পদক্ষেপগুলো মনোযোগ দিয়ে সম্পূর্ণ করুন:</p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">১. কীভাবে Registration করতে হবে:</h4>
                  <p>নিবন্ধন ফর্মের সকল তথ্য ইংরেজি বা বাংলায় সঠিকভাবে পূরণ করে নিচের "Register Agency" বাটনে ক্লিক করুন।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">২. Agency Name কী?</h4>
                  <p>→ আপনার ট্রাভেল এজেন্সির সঠিক ও পূর্ণাঙ্গ নাম লিখুন। (যেমন: <strong className="text-[#E9EEF3]">ZH Travels</strong>)</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">৩. Admin Name কী?</h4>
                  <p>→ যিনি এই অ্যাকাউন্ট এবং টিম পরিচালনা করবেন তার নাম লিখুন।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">৪. Agency Location কী?</h4>
                  <p>→ আপনার এজেন্সির অফিসের সম্পূর্ণ এবং সঠিক ঠিকানাটি লিখুন।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">৫. Email Address:</h4>
                  <p>→ একটি সচল এবং সঠিক Gmail ব্যবহার করুন। এই ইমেইলে একটি ভেরিফিকেশন জিমেইল পাঠানো হবে।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">৬. Agency Password:</h4>
                  <p>→ কমপক্ষে ৮ অক্ষরের একটি অত্যন্ত শক্তিশালী পাসওয়ার্ড ব্যবহার করুন। পাসওয়ার্ডে অবশ্যই বড় ও ছোট হাতের অক্ষর, সংখ্যা এবং বিশেষ চিহ্ন থাকতে হবে।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">৭. Confirm Agency Password:</h4>
                  <p>→ উপরের বক্সে প্রবেশ করানো একই পাসওয়ার্ড এখানে পুনরায় লিখুন।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">৮. ইমেইল ভেরিফিকেশন:</h4>
                  <p>→ নিবন্ধন সাবমিট করা সম্পন্ন হলে আপনার জিমেইল ইনবক্সে একটি Verification Email পাঠানো হবে।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">৯. অ্যাকাউন্ট তৈরি:</h4>
                  <p>→ ইমেইলে প্রেরিত লিংকে ক্লিক করে সফলভাবে ভেরিফাই করার পর আপনার এজেন্সি অ্যাকাউন্টটি তৈরি হবে।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">১০. এজেন্সি কোড নির্ধারণ:</h4>
                  <p>→ অ্যাকাউন্ট তৈরি সম্পন্ন হলে সিস্টেমে লগইন করার জন্য Developer ম্যানুয়ালি আপনার জন্য একটি নির্দিষ্ট Agency Code সেট করবেন।</p>
                </div>

                <div>
                  <h4 className="font-extrabold text-[#E9EEF3] mb-0.5">১১. প্রথম লগইন:</h4>
                  <p>→ এজেন্সি কোড সংগৃহীত হওয়ার পর সেই কোড এবং নিবন্ধিত পাসওয়ার্ড দিয়ে আপনি সিস্টেমে লগইন করতে পারবেন।</p>
                </div>
              </div>

              {/* Support Section */}
              <div className="p-4 mt-6 rounded-xl bg-[#161D27] border border-[#252F3D] space-y-2.5">
                <h4 className="font-extrabold text-[#E9EEF3] flex items-center gap-1">
                  <span>Need Help? (সহায়তা প্রয়োজন?)</span>
                </h4>
                <p className="text-[11px]">
                  কোনো তথ্য পূরণ করতে সমস্যা হলে অথবা অ্যাকাউন্ট সংক্রান্ত সহায়তার প্রয়োজন হলে নিচের নম্বরে যোগাযোগ করুন।
                </p>
                <div className="flex items-center gap-2 pt-1.5 border-t border-[#252F3D] text-[#E9EEF3]">
                  <Phone size={14} className="text-[#10B981]" />
                  <span className="font-bold">সফটওয়্যার সাপোর্ট:</span>
                  <a href="tel:+8801830343515" className="text-[#10B981] font-mono hover:underline font-extrabold">
                    +8801830343515
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#252F3D] flex justify-end">
              <button
                onClick={() => setHelpModalOpen(false)}
                className="btn btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                বুঝেছি (Got it)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
